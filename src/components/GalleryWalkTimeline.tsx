"use client";

// The Gallery Walk's self-running rotation timeline: ONE screen showing every
// authored station as a row with its own bar, walking itself on the STEP'S
// SHARED CLOCK, then a closing "back in your seats" row.
//
// This is DiscussionTimeline's twin on purpose - same shape, same clock
// primitive, same CSS variable names (`--dt-*`) so a host surface that already
// themes one themes the other with no new style block. What differs is what the
// spec asked for and a discussion does not have: a per-second BEEP through the
// last `beepWindowSeconds` of each station, and silence through the closing
// seats-check. The engine decides when that is (`galleryWalkStageCountdown`
// returns `beeping`); this component only obeys it.
//
// AUDIO, SAID PLAINLY. A browser blocks sound until the page has been tapped, so
// a projector nobody has touched is SILENT and nothing on screen would say so.
// When `sound` is on and the display has not been armed, this renders a
// persistent "Turn on the rotation beeps" chip - not a 90-second one - because a
// beep the room cannot hear is the same as no beep at all. Tapping it arms audio
// through the same `attentionCall` primitive the attention chime uses, so one tap
// arms everything on the display.

import { useEffect, useRef, useState } from "react";
import {
  activeGalleryWalkPhase,
  galleryWalkStageCountdown,
  DEFAULT_GALLERY_BEEP_WINDOW_SECONDS,
  type GalleryWalkPhase,
} from "@/lib/galleryWalkTimer";
import { playDing, playTick } from "@/lib/timerBeeps";
import { armAttentionAudio, attentionAudioArmed, onAttentionAudioChange } from "@/lib/attentionCall";

function formatDuration(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(whole / 60);
  const secs = whole % 60;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

export interface GalleryWalkTimelineProps {
  phases: GalleryWalkPhase[];
  totalSeconds: number;
  /** Live countdown reference. When running, the bars advance against this. */
  secondsLeft: number;
  endsAt?: string | null;
  running?: boolean;
  /** The window the phases were BUILT with - pass the builder's own value. */
  beepWindowSeconds?: number;
  /** True on a room display only: beep the last seconds of each station. Never on Chromebooks. */
  sound?: boolean;
  /** The authored prompts, shown above the rotation so the directions stay on screen. */
  prompts?: { label: string; body: string }[];
  /** e.g. "4 stations - 3 min per rotation". */
  caption?: string;
}

export default function GalleryWalkTimeline({
  phases,
  totalSeconds,
  secondsLeft,
  endsAt,
  running = false,
  beepWindowSeconds = DEFAULT_GALLERY_BEEP_WINDOW_SECONDS,
  sound = false,
  prompts = [],
  caption,
}: GalleryWalkTimelineProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [armed, setArmed] = useState(true);
  const lastPhaseRef = useRef<number>(-1);
  const lastBeepRef = useRef<number | null>(null);

  // Tick locally only while running and anchored to a shared endsAt, so the bars
  // move smoothly and identically on every device. Paused or un-anchored, the
  // passed secondsLeft is authoritative and the bars hold still. Identical to
  // DiscussionTimeline - the room must not have two different notions of "now".
  useEffect(() => {
    if (!running || !endsAt) return;
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [running, endsAt]);

  // Only a sound surface cares whether audio is armed; a silent one never shows
  // the chip. Starts optimistic (true) so a Chromebook never flashes it.
  useEffect(() => {
    if (!sound) return;
    setArmed(attentionAudioArmed());
    return onAttentionAudioChange(setArmed);
  }, [sound]);

  const liveSecondsLeft = running && endsAt
    ? Math.max(0, (new Date(endsAt).getTime() - nowMs) / 1000)
    : Math.max(0, secondsLeft);
  const progress = activeGalleryWalkPhase(phases, Math.max(0, totalSeconds - liveSecondsLeft));
  // The single source of truth for "is it beeping" is the engine, pinned by
  // test:gallery-walk-timer - never a local `secondsLeft <= 10` reinvention.
  const stage = galleryWalkStageCountdown(phases, totalSeconds, liveSecondsLeft, beepWindowSeconds);
  const phaseSecondsLeft = stage && !stage.done ? stage.secondsLeft : 0;

  // Ding on each new phase (arming permitting). Skipped on the very first paint
  // so opening the screen is silent; only real rotations ring.
  useEffect(() => {
    if (!sound) return;
    if (lastPhaseRef.current === -1) {
      lastPhaseRef.current = progress.index;
      return;
    }
    if (progress.index !== lastPhaseRef.current) {
      lastPhaseRef.current = progress.index;
      playDing();
    }
  }, [progress.index, sound]);

  // One beep per second through the station's closing window. `stage.beeping` is
  // already false during the seats-check phase, which is the spec: beeps tell
  // them to write and move, not to sit still.
  useEffect(() => {
    if (!sound || !stage?.beeping) {
      lastBeepRef.current = null;
      return;
    }
    if (phaseSecondsLeft > 0 && phaseSecondsLeft !== lastBeepRef.current) {
      lastBeepRef.current = phaseSecondsLeft;
      playTick();
    }
  }, [phaseSecondsLeft, stage?.beeping, sound]);

  async function armNow() {
    const ok = await armAttentionAudio();
    // Sound the tick back so the tap doubles as a speaker check.
    if (ok) playTick();
  }

  return (
    <div className="gw-root" aria-label="Gallery Walk rotation">
      {caption ? <p className="gw-caption">{caption}</p> : null}
      {prompts.length ? (
        <ul className="gw-prompts">
          {prompts.map((prompt) => (
            <li className="gw-prompt" key={prompt.label}>
              <span className="gw-prompt-label">{prompt.label}</span>
              <strong className="gw-prompt-body">{prompt.body}</strong>
            </li>
          ))}
        </ul>
      ) : null}
      <ol className="gw-list">
        {phases.map((phase, index) => {
          const state = progress.done || index < progress.index ? "done" : index === progress.index ? "active" : "upcoming";
          const fill = state === "done" ? 1 : state === "active" ? Math.min(1, progress.phaseFraction) : 0;
          const isActive = state === "active";
          // The ACTIVE row counts DOWN its own remaining time; every other row
          // shows its full length.
          const shown = isActive ? phaseSecondsLeft : phase.seconds;
          const urgency = !isActive ? "" : stage?.beeping ? " final" : "";
          return (
            <li className={`gw-phase ${state} ${phase.kind}`} key={`${phase.kind}-${index}`}>
              <span className="gw-label">{phase.label}</span>
              <span className="gw-direction">{phase.direction}</span>
              <span className="gw-bar-wrap">
                <span className="gw-bar" style={{ width: `${Math.round(fill * 100)}%` }} />
                <span className={`gw-time${isActive ? " active" : ""}${urgency}`}>{formatDuration(shown)}</span>
              </span>
            </li>
          );
        })}
      </ol>
      {sound && !armed ? (
        <button type="button" className="gw-arm" onClick={() => void armNow()}>
          Tap to turn on the rotation beeps
        </button>
      ) : null}
      <style>{`
        .gw-root { width:min(100%, 60em); margin:0 auto; display:grid; gap:0.7em; }
        .gw-caption { margin:0; color:var(--dt-accent-text, #3c7d7e); font-size:0.9em; font-weight:900; letter-spacing:0.08em; text-transform:uppercase; }
        .gw-prompts { list-style:none; margin:0; padding:0; display:grid; grid-template-columns:repeat(auto-fit,minmax(14em,1fr)); gap:0.5em; }
        .gw-prompt { display:grid; gap:0.15em; padding:0.5em 0.7em; border-radius:0.6em; border:1px solid var(--dt-line, #ece4d4); background:var(--dt-card, #fff); }
        .gw-prompt-label { font-size:0.72em; font-weight:900; letter-spacing:0.1em; text-transform:uppercase; color:var(--dt-accent-text, #3c7d7e); }
        .gw-prompt-body { font-size:0.92em; font-weight:800; color:var(--dt-ink, #201e1a); line-height:1.25; }
        .gw-list { list-style:none; margin:0; padding:0; display:grid; gap:0.55em; }
        .gw-phase { display:grid; grid-template-columns:minmax(7em,auto) 1fr minmax(9em,16em); align-items:center; gap:0.6em 1em; padding:0.6em 0.9em; border-radius:0.7em; border:2px solid var(--dt-line, #ece4d4); background:var(--dt-card, #fff); transition:border-color .2s, background .2s, opacity .2s; }
        .gw-phase.upcoming { opacity:0.55; }
        .gw-phase.active { border-color:var(--dt-accent, #50a3a4); background:color-mix(in srgb, var(--dt-accent, #50a3a4) 9%, var(--dt-card, #fff)); box-shadow:0 3px 14px rgba(32,30,26,0.10); }
        .gw-phase.done { opacity:0.9; }
        /* The seats-check row is the one that is NOT a station, so it reads as a
           different kind of thing even when it is not the active row. */
        .gw-phase.final { border-style:dashed; }
        .gw-label { font-size:0.9em; font-weight:900; text-transform:uppercase; letter-spacing:0.05em; color:var(--dt-accent-text, #3c7d7e); }
        .gw-phase.upcoming .gw-label { color:var(--dt-soft, #7a7061); }
        .gw-direction { font-size:1em; font-weight:800; color:var(--dt-ink, #201e1a); line-height:1.25; }
        .gw-bar-wrap { position:relative; height:2em; border-radius:999px; background:var(--dt-track, #f3ecdd); border:1px solid var(--dt-line, #ece4d4); overflow:hidden; display:flex; align-items:center; }
        .gw-bar { position:absolute; left:0; top:0; bottom:0; background:var(--dt-accent, #50a3a4); border-radius:999px; }
        .gw-phase.done .gw-bar { background:var(--dt-done, #2f9e6f); }
        .gw-time { position:relative; margin-left:auto; margin-right:0.7em; font-size:0.85em; font-weight:900; color:var(--dt-ink, #201e1a); font-variant-numeric:tabular-nums; }
        .gw-time.active { font-size:1.3em; color:var(--dt-accent-text, #3c7d7e); }
        /* Red and pulsing is the DEAF-SAFE mirror of the beep: it turns on and
           off with the exact same engine flag, so the cue exists on a silent
           display and for a student who cannot hear it. */
        .gw-time.final { color:#f95335; animation:gw-time-pulse 0.5s ease-in-out infinite; }
        @keyframes gw-time-pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        @media (prefers-reduced-motion: reduce) { .gw-time.final { animation:none; } }
        .gw-arm { justify-self:center; min-height:44px; padding:0 18px; border-radius:999px; border:1.5px solid var(--dt-accent, #50a3a4); background:var(--dt-card, #fff); color:var(--dt-accent-text, #3c7d7e); font:inherit; font-size:0.8em; font-weight:900; cursor:pointer; }
        @media (max-width: 640px) {
          .gw-phase { grid-template-columns:1fr; gap:0.35em; }
          .gw-bar-wrap { width:100%; }
        }
      `}</style>
    </div>
  );
}
