"use client";

// Host election for classroom audio.
//
// As of 2026-08-07 the projector (/teacher/present) is the PRIMARY audio host,
// because it is the always-foreground fullscreen tab and browsers throttle
// hidden tabs hard - which is why sound played from /control's hidden second tab
// was unreliable in the real room (the timer cues, per-state music, and iPad
// sound-bank cues all came from that one throttled tab). /control stays the
// BACKUP host: it plays only when it cannot hear a live, ARMED /present host,
// so a rush day driven from a laptop, or a crashed present tab, is never silent.
//
// /present announces "I have the sound" on TWO channels so both cases are covered:
//   - a same-origin BroadcastChannel, delivered even to a hidden/throttled tab
//     with no live socket (the normal setup: present + Control are two tabs in
//     the panel's one browser), and
//   - a Supabase realtime room, which reaches a Control on a DIFFERENT machine
//     (the laptop case). A hidden Control's realtime socket may be suspended,
//     but the BroadcastChannel covers that; a laptop Control is foregrounded, so
//     its socket is alive and realtime covers it.
//
// A claim carries `armed`, so Control only yields once /present can actually make
// noise - an un-armed present (nobody tapped it yet) must not silence the backup.

import { joinRealtimeRoom } from "@/lib/realtimeRooms";

const HOST_BROADCAST_CHANNEL = "bdm-audio-host";
const HOST_REALTIME_EVENT = "host";
const HEARTBEAT_MS = 2000;
// A claim older than this is treated as gone. Comfortably longer than the
// heartbeat so a delayed message from a throttled tab cannot briefly un-suppress
// Control mid-lesson; short enough that a crashed present hands the room back in
// a few seconds.
const STALE_MS = 6000;

function hostRealtimeTopic(sessionId: string): string {
  return `audio-host-${sessionId}`;
}

type HostClaim = { type: "audio-host"; sessionId: string; armed: boolean; ts: number };

function isHostClaim(value: unknown): value is HostClaim {
  return !!value && typeof value === "object"
    && (value as { type?: unknown }).type === "audio-host"
    && typeof (value as { armed?: unknown }).armed === "boolean";
}

/** A running claimer: `stop` tears it down; `beat` announces the current armed
 *  state immediately (call it right after arming so the backup yields at once
 *  instead of waiting out the next heartbeat). */
export interface AudioHostClaimer {
  stop: () => void;
  beat: () => void;
}

/**
 * Announce that this surface (/present) is the audio host. Sends an immediate
 * claim, then heartbeats. `getArmed` is read each beat, so the claim reflects
 * whether /present can currently play.
 */
export function claimAudioHost(sessionId: string, getArmed: () => boolean): AudioHostClaimer {
  let stopped = false;
  let channel: BroadcastChannel | null = null;
  try {
    channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(HOST_BROADCAST_CHANNEL) : null;
  } catch {
    channel = null;
  }
  const room = joinRealtimeRoom<HostClaim>(hostRealtimeTopic(sessionId), () => { /* claimer ignores */ }, undefined, HOST_REALTIME_EVENT);

  const beat = () => {
    if (stopped) return;
    const claim: HostClaim = { type: "audio-host", sessionId, armed: getArmed(), ts: Date.now() };
    try { channel?.postMessage(claim); } catch { /* ignore */ }
    try { room.send(claim); } catch { /* ignore */ }
  };
  beat();
  const interval = window.setInterval(beat, HEARTBEAT_MS);

  return {
    stop: () => {
      stopped = true;
      window.clearInterval(interval);
      try { channel?.close(); } catch { /* ignore */ }
      room.close();
    },
    beat,
  };
}

/**
 * Watch for a live /present host on THIS session. Calls `onSuppressed(true)`
 * while an armed host is heard and `onSuppressed(false)` the moment the host
 * says it is not armed (e.g. after a deploy reload, before the teacher re-taps)
 * or its claims go stale (present closed/crashed). /control uses this to fall
 * silent while /present has the room and to resume the instant it does not.
 * Returns a stop function.
 */
export function watchAudioHost(sessionId: string, onSuppressed: (suppressed: boolean) => void): () => void {
  let lastArmedAt = 0;
  let suppressed = false;
  let channel: BroadcastChannel | null = null;

  const apply = (next: boolean) => {
    if (next === suppressed) return;
    suppressed = next;
    onSuppressed(next);
  };
  const onClaim = (value: unknown) => {
    if (!isHostClaim(value)) return;
    // The realtime topic is already session-scoped; the BroadcastChannel is not,
    // so filter here so a present on another session can never silence this one.
    if (value.sessionId !== sessionId) return;
    if (value.armed) {
      lastArmedAt = Date.now();
      apply(true);
    } else {
      // The host is present but cannot play (un-armed, or reloading after a
      // deploy). Hand the room back to the backup now rather than waiting out
      // the staleness window.
      apply(false);
    }
  };

  try {
    channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(HOST_BROADCAST_CHANNEL) : null;
    if (channel) channel.onmessage = (event: MessageEvent) => onClaim(event.data);
  } catch {
    channel = null;
  }
  const room = joinRealtimeRoom<HostClaim>(hostRealtimeTopic(sessionId), onClaim, undefined, HOST_REALTIME_EVENT);

  // Expire a stale claim so Control resumes if /present is closed or crashes.
  const sweep = window.setInterval(() => {
    if (suppressed && Date.now() - lastArmedAt > STALE_MS) apply(false);
  }, 1000);

  return () => {
    window.clearInterval(sweep);
    try { channel?.close(); } catch { /* ignore */ }
    room.close();
  };
}
