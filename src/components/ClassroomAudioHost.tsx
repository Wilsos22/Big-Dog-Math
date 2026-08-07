"use client";

// The room's audio host, mounted on /teacher/present (the projector).
//
// WHY THIS EXISTS. Until 2026-08-07 every classroom sound - the timer cues, the
// per-state music, and the iPad sound-bank clips - played from /control. In the
// real room /control is a hidden second tab behind /present fullscreen, and
// browsers throttle hidden tabs, so its timers slowed and its realtime socket
// suspended: the sounds fired late or not at all, and /control's own "tap to
// start the music" prompt was on a tab nobody could see. This moves playback to
// /present, the always-foreground tab, so the sound is never throttled. /control
// stays the BACKUP host (see audioHostChannel.ts) and falls silent while this
// host is armed.
//
// The playback engine here mirrors /control's; the shared, drift-prone pieces
// (tone patterns, duck levels, the countdown rule) live in timerCues.ts and the
// store keys in classroomAudio.ts, imported by both so they cannot diverge.
//
// Browser autoplay means one real tap is required before any sound. A big prompt
// is shown until the teacher taps; any tap on the projector also arms silently.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  bankAudioKey,
  CLASSROOM_AUDIO_CHANNEL,
  getClassroomAudio,
  musicAudioKey,
} from "@/lib/classroomAudio";
import { DEFAULT_STATES } from "@/lib/classStates";
import {
  liveTimerSeconds,
  type LiveClassFlowSnapshot,
  type TeacherRemoteCommand,
} from "@/lib/liveClassFlow";
import { joinRealtimeRoom } from "@/lib/realtimeRooms";
import {
  isRemoteCommandPing,
  pingPlaysDirectly,
  REMOTE_COMMAND_PING_EVENT,
  remoteCommandTopic,
  type RemoteCommandPing,
} from "@/lib/remoteCommandPing";
import { SOUND_CUES, armSoundBank, installUserClip, playSoundCue, soundCueIdForAction } from "@/lib/soundBank";
import {
  CUE_DUCK_FALLBACK_SECONDS,
  genTone,
  MUSIC_DUCK_VOLUME,
  MUSIC_FULL_VOLUME,
  TIMER_TONE_PATTERNS,
  timerCueForTransition,
  type TimerCueKey,
} from "@/lib/timerCues";
import { armAttentionAudio } from "@/lib/attentionCall";
import { claimAudioHost } from "@/lib/audioHostChannel";

interface ClassroomAudioHostProps {
  // Real projector only. False inside the /ipad Write-on-screen embed, on /demo,
  // and in Studio preview - none of those is the room's speakers.
  active: boolean;
  sessionId: string | null;
  stateId: string | null;
  timer: LiveClassFlowSnapshot["timer"];
  interludeStateId: string | null;
  remoteCommand: TeacherRemoteCommand | null;
}

const BANK_KEY_PREFIX = "bank:";

export default function ClassroomAudioHost({
  active,
  sessionId,
  stateId,
  timer,
  interludeStateId,
  remoteCommand,
}: ClassroomAudioHostProps) {
  const [armed, setArmed] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const cueRef = useRef<HTMLAudioElement | null>(null);
  const duckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The state whose music the speakers should be carrying now. Written synchronously
  // so a blob that finishes reading late can check whether it is still wanted.
  const wantedMusicStateRef = useRef<string | null>(null);
  const soundUrlsRef = useRef<Record<string, string>>({});
  const objectUrlsRef = useRef<Set<string>>(new Set());
  const playedCueNoncesRef = useRef<Set<string>>(new Set());
  const armedRef = useRef(false);
  const hostClaimerRef = useRef<{ beat: () => void } | null>(null);
  const timerRef = useRef(timer);
  timerRef.current = timer;
  const lastMusicStateRef = useRef<string | null>(null);

  // ── One AudioContext for this surface ──────────────────────────────────────
  // An AudioBuffer only crosses contexts cleanly when their sample rates agree,
  // so every clip is decoded AND played on this one context. Safe to build before
  // a gesture: it starts suspended, decodeAudioData still works, the first tap
  // resumes it.
  const ensureAudioCtx = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    try {
      audioCtxRef.current = audioCtxRef.current
        ?? new (window.AudioContext
          || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      return audioCtxRef.current;
    } catch {
      return null;
    }
  }, []);

  // ── Music ──────────────────────────────────────────────────────────────────
  const stopMusic = useCallback(() => {
    wantedMusicStateRef.current = null;
    setBlocked(false);
    if (duckTimerRef.current) {
      clearTimeout(duckTimerRef.current);
      duckTimerRef.current = null;
    }
    if (musicRef.current) {
      musicRef.current.pause();
      musicRef.current.currentTime = 0;
      musicRef.current = null;
    }
  }, []);

  const duckMusic = useCallback((seconds: number) => {
    const music = musicRef.current;
    if (!music) return;
    if (duckTimerRef.current) clearTimeout(duckTimerRef.current);
    music.volume = MUSIC_DUCK_VOLUME;
    duckTimerRef.current = setTimeout(() => {
      // Re-read the ref: the track may have been swapped or stopped while ducked.
      if (musicRef.current) musicRef.current.volume = MUSIC_FULL_VOLUME;
      duckTimerRef.current = null;
    }, Math.max(300, seconds * 1000));
  }, []);

  const playMusicUrl = useCallback((url: string, forStateId: string) => {
    if (wantedMusicStateRef.current !== forStateId) return;
    const a = new Audio(url);
    a.loop = true;
    a.volume = MUSIC_FULL_VOLUME;
    musicRef.current = a;
    a.play()
      .then(() => setBlocked(false))
      .catch(() => {
        // A refused play is fixable with one tap and must be visible, not swallowed.
        if (wantedMusicStateRef.current === forStateId) setBlocked(true);
      });
  }, []);

  const startMusicFor = useCallback((nextStateId: string | null) => {
    stopMusic();
    if (!nextStateId) return;
    wantedMusicStateRef.current = nextStateId;
    const key = musicAudioKey(nextStateId);
    const cached = soundUrlsRef.current[key];
    if (cached) {
      playMusicUrl(cached, nextStateId);
      return;
    }
    void (async () => {
      const blob = await getClassroomAudio(key).catch(() => undefined);
      if (!blob) {
        // No song for this state. Silence is correct; drop any stale blocked banner.
        if (wantedMusicStateRef.current === nextStateId) setBlocked(false);
        return;
      }
      if (wantedMusicStateRef.current !== nextStateId) return;
      const url = URL.createObjectURL(blob);
      objectUrlsRef.current.add(url);
      soundUrlsRef.current = { ...soundUrlsRef.current, [key]: url };
      playMusicUrl(url, nextStateId);
    })();
  }, [stopMusic, playMusicUrl]);

  // ── Timer cues (30s warning, 10-1 ticks, time's up) ─────────────────────────
  const playCue = useCallback((key: TimerCueKey) => {
    const url = soundUrlsRef.current[key];
    if (url) {
      // One cue channel: a cue is an interruption, so a new one replaces whatever
      // is still sounding rather than layering.
      if (cueRef.current) {
        cueRef.current.pause();
        cueRef.current.currentTime = 0;
      }
      const a = new Audio(url);
      cueRef.current = a;
      a.addEventListener("ended", () => {
        if (cueRef.current === a) cueRef.current = null;
        if (duckTimerRef.current) clearTimeout(duckTimerRef.current);
        duckTimerRef.current = null;
        if (musicRef.current) musicRef.current.volume = MUSIC_FULL_VOLUME;
      });
      duckMusic(Number.isFinite(a.duration) && a.duration > 0 ? a.duration : CUE_DUCK_FALLBACK_SECONDS);
      a.addEventListener("loadedmetadata", () => {
        if (cueRef.current === a && Number.isFinite(a.duration) && a.duration > 0) duckMusic(a.duration);
      });
      a.play().catch(() => { /* ignore */ });
      return;
    }
    duckMusic(key === "tick" ? 0.4 : 1);
    const ctx = ensureAudioCtx();
    if (ctx) genTone(ctx, TIMER_TONE_PATTERNS[key]);
  }, [duckMusic, ensureAudioCtx]);

  // ── Sound bank + manual timer cues, from the iPad Remote ────────────────────
  // One play per command nonce, whichever path (ping or poll) arrives first.
  const handleRemoteAudio = useCallback((action: string, nonce: string) => {
    const seen = playedCueNoncesRef.current;
    if (seen.has(nonce)) return;
    seen.add(nonce);
    if (seen.size > 200) for (const old of [...seen].slice(0, 100)) seen.delete(old);
    if (action === "play-warning") playCue("warn30");
    else if (action === "play-countdown") playCue("tick");
    else if (action === "play-times-up") playCue("end");
    else {
      const cue = soundCueIdForAction(action);
      // Decode-and-play on THIS surface's own context (ensureAudioCtx, never a
      // possibly-null ref) so a committed clip can never be primed on the bank's
      // shared context and then fail to play on ours.
      if (cue) playSoundCue(cue, ensureAudioCtx());
    }
  }, [playCue, ensureAudioCtx]);

  // ── Arming ───────────────────────────────────────────────────────────────
  const armAll = useCallback(() => {
    const ctx = ensureAudioCtx();
    if (!ctx) return;
    const finish = () => {
      const running = ctx.state === "running";
      armedRef.current = running;
      setArmed(running);
      if (running) {
        void armSoundBank(ctx);
        void armAttentionAudio();
        // Tell the backup at once that this host is armed, so /control yields
        // now rather than after the next 2s heartbeat (no cue-doubling window).
        hostClaimerRef.current?.beat();
        const wanted = wantedMusicStateRef.current;
        if (wanted) startMusicFor(wanted);
      }
    };
    if (ctx.state !== "running") ctx.resume().then(finish).catch(finish);
    else finish();
  }, [ensureAudioCtx, startMusicFor]);

  useEffect(() => { armedRef.current = armed; }, [armed]);

  // Any tap or key on the projector arms silently, so the teacher never has to
  // find the prompt - it is a reassurance, not a gate.
  useEffect(() => {
    if (!active || armed) return;
    const arm = () => armAll();
    window.addEventListener("pointerdown", arm);
    window.addEventListener("keydown", arm);
    return () => {
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
    };
  }, [active, armed, armAll]);

  // ── Prefetch uploaded clips from this browser's store ───────────────────────
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void (async () => {
      const keys = [
        "warn30", "tick", "end",
        ...DEFAULT_STATES.map((s) => musicAudioKey(s.id)),
        ...SOUND_CUES.map((c) => bankAudioKey(c.id)),
      ];
      const next: Record<string, string> = {};
      for (const key of keys) {
        const blob = await getClassroomAudio(key).catch(() => undefined);
        if (blob) {
          const url = URL.createObjectURL(blob);
          objectUrlsRef.current.add(url);
          next[key] = url;
        }
      }
      if (cancelled) {
        Object.values(next).forEach((url) => { URL.revokeObjectURL(url); objectUrlsRef.current.delete(url); });
        return;
      }
      // Live entries (startMusicFor may have read one straight from disk while
      // this loop ran) win over the prefetch.
      soundUrlsRef.current = { ...next, ...soundUrlsRef.current };
      // Hand the bank its clips, decoded on THIS context so playback does not
      // fail on a cross-context buffer.
      for (const cue of SOUND_CUES) {
        const blob = await getClassroomAudio(bankAudioKey(cue.id)).catch(() => undefined);
        if (!cancelled && blob) void installUserClip(cue.id, await blob.arrayBuffer(), ensureAudioCtx());
      }
    })();
    return () => { cancelled = true; };
  }, [active, ensureAudioCtx]);

  // ── A clip uploaded on /teacher/audio (or in /control's Sounds panel) reaches
  //    the speakers without a reload. ──────────────────────────────────────────
  useEffect(() => {
    if (!active || typeof BroadcastChannel === "undefined") return;
    let channel: BroadcastChannel;
    try {
      channel = new BroadcastChannel(CLASSROOM_AUDIO_CHANNEL);
    } catch {
      return;
    }
    channel.onmessage = (event: MessageEvent) => {
      const key = (event.data as { key?: unknown } | null)?.key;
      if (typeof key !== "string") return;
      void (async () => {
        const blob = await getClassroomAudio(key).catch(() => undefined);
        const previousUrl = soundUrlsRef.current[key];
        const next = { ...soundUrlsRef.current };
        if (blob) {
          const url = URL.createObjectURL(blob);
          objectUrlsRef.current.add(url);
          next[key] = url;
        } else {
          delete next[key];
        }
        soundUrlsRef.current = next;
        if (key.startsWith(BANK_KEY_PREFIX) && blob) {
          void installUserClip(key.slice(BANK_KEY_PREFIX.length), await blob.arrayBuffer(), ensureAudioCtx());
        }
        const wanted = wantedMusicStateRef.current;
        if (wanted && key === musicAudioKey(wanted)) startMusicFor(wanted);
        if (previousUrl) {
          URL.revokeObjectURL(previousUrl);
          objectUrlsRef.current.delete(previousUrl);
        }
      })();
    };
    return () => channel.close();
  }, [active, ensureAudioCtx, startMusicFor]);

  // ── Per-state music: interlude wins, else the running state's song ──────────
  const timerRunning = Boolean(timer?.running);
  useEffect(() => {
    if (!active) return;
    const musicStateId = interludeStateId ?? (timerRunning ? stateId : null);
    if (musicStateId === lastMusicStateRef.current) return;
    lastMusicStateRef.current = musicStateId;
    wantedMusicStateRef.current = musicStateId;
    if (!armed) return; // arming picks up the wanted state
    startMusicFor(musicStateId);
  }, [active, armed, stateId, interludeStateId, timerRunning, startMusicFor]);

  // ── Countdown cues, fired off the same endsAt /control publishes ────────────
  useEffect(() => {
    if (!active || !armed || !timerRunning) return;
    let previous = liveTimerSeconds(timerRef.current);
    const id = window.setInterval(() => {
      const current = timerRef.current;
      if (!current || !current.running) return;
      const next = liveTimerSeconds(current);
      if (next === previous) return;
      const cue = timerCueForTransition(previous, next);
      previous = next;
      if (cue === "end") { stopMusic(); playCue("end"); }
      else if (cue) playCue(cue);
    }, 250);
    return () => window.clearInterval(id);
  }, [active, armed, timerRunning, playCue, stopMusic]);

  // ── Low-latency Remote ping (a rimshot lands on the beat) ───────────────────
  useEffect(() => {
    if (!active || !sessionId) return;
    const room = joinRealtimeRoom<RemoteCommandPing>(
      remoteCommandTopic(sessionId),
      (ping) => {
        if (!isRemoteCommandPing(ping)) return;
        if (pingPlaysDirectly(ping.action)) handleRemoteAudio(ping.action, ping.nonce);
      },
      undefined,
      REMOTE_COMMAND_PING_EVENT,
    );
    return () => room.close();
  }, [active, sessionId, handleRemoteAudio]);

  // ── The poll path: the session row's remote_command, deduped by the same nonce ─
  useEffect(() => {
    if (!active || !remoteCommand) return;
    handleRemoteAudio(remoteCommand.action, remoteCommand.nonce);
    // Only the nonce matters; a repeated identical command keeps its nonce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, remoteCommand?.nonce]);

  // ── Claim the host role so /control stays silent while this surface plays ────
  useEffect(() => {
    if (!active || !sessionId) {
      hostClaimerRef.current = null;
      return;
    }
    const claimer = claimAudioHost(sessionId, () => armedRef.current);
    hostClaimerRef.current = claimer;
    return () => {
      hostClaimerRef.current = null;
      claimer.stop();
    };
  }, [active, sessionId]);

  // ── Cleanup ────────────────────────────────────────────────────────────────
  useEffect(() => () => {
    stopMusic();
    if (cueRef.current) { cueRef.current.pause(); cueRef.current = null; }
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current.clear();
  }, [stopMusic]);

  if (!active || (armed && !blocked)) return null;

  return (
    <button
      type="button"
      onClick={armAll}
      aria-label="Turn on classroom sound"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "none",
        background: "color-mix(in srgb, #201e1a 42%, transparent)",
        cursor: "pointer",
        font: "inherit",
      }}
    >
      <span
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
          padding: "34px 46px",
          borderRadius: 22,
          background: "#faf6ee",
          border: "3px solid #fcaf38",
          boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
          color: "#201e1a",
          maxWidth: "80vw",
          textAlign: "center",
        }}
      >
        <span style={{ fontSize: "clamp(1.6rem, 3.4vw, 2.6rem)", fontWeight: 800, letterSpacing: "-0.02em" }}>
          {blocked ? "Sound was blocked" : "Tap to turn on classroom sound"}
        </span>
        <span style={{ fontSize: "clamp(0.95rem, 1.6vw, 1.2rem)", color: "#6f675c", fontWeight: 600 }}>
          One tap here plays the music, timer cues, and sound bank through the room speakers.
        </span>
      </span>
    </button>
  );
}
