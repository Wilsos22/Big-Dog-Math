"use client";

// A self-running protocol timeline: ONE screen showing every authored phase as
// a bullet with its own timer bar, walking itself through the sequence on the
// step's shared clock. It replaces the old round-by-round overlay for steps
// that author `Discussion Phases` - the teacher does not advance each beat, the
// bars do. The active phase highlights; on a projector (sound), a ding marks
// each new beat. Every device reads the same endsAt, so the room stays in sync.

import { useEffect, useRef, useState } from "react";
import {
  activeDiscussionPhase,
  discussionPhaseLabel,
  type AuthoredDiscussionPhase,
} from "@/lib/discussionPhases";
// Moved to src/lib/timerBeeps.ts so the Gallery Walk timeline rings the SAME
// two cues instead of a third private copy. Behaviour is byte-for-byte the same.
import { playDing, playTick } from "@/lib/timerBeeps";

function formatDuration(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(whole / 60);
  const secs = whole % 60;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

export interface DiscussionTimelineProps {
  phases: AuthoredDiscussionPhase[];
  totalSeconds: number;
  /** Live countdown reference. When running, the bars advance against this. */
  secondsLeft: number;
  endsAt?: string | null;
  running?: boolean;
  /** True on a room display: play a ding at each new beat. Never on Chromebooks. */
  sound?: boolean;
}

export default function DiscussionTimeline({
  phases,
  totalSeconds,
  secondsLeft,
  endsAt,
  running = false,
  sound = false,
}: DiscussionTimelineProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const lastPhaseRef = useRef<number>(-1);
  const lastTickRef = useRef<number | null>(null);

  // Tick locally only while running and anchored to a shared endsAt, so the
  // bars move smoothly and identically on every device. Paused or un-anchored,
  // the passed secondsLeft is authoritative and the bars hold still.
  useEffect(() => {
    if (!running || !endsAt) return;
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [running, endsAt]);

  const liveSecondsLeft = running && endsAt
    ? Math.max(0, (new Date(endsAt).getTime() - nowMs) / 1000)
    : Math.max(0, secondsLeft);
  const elapsed = Math.max(0, totalSeconds - liveSecondsLeft);
  const progress = activeDiscussionPhase(phases, elapsed);

  // Ding on each new beat (arming-permitting). Skipped for the very first
  // paint so opening the screen is silent; only real transitions ring.
  useEffect(() => {
    if (!sound) return;
    if (lastPhaseRef.current === -1) {
      lastPhaseRef.current = progress.index;
      return;
    }
    if (progress.index !== lastPhaseRef.current) {
      lastPhaseRef.current = progress.index;
      if (progress.index > 0 && !progress.done) playDing();
      else if (progress.done) playDing();
    }
  }, [progress.index, progress.done, sound]);

  // The last five seconds of each beat tick once per second, so the room hears
  // the wrap-up coming before the ding lands. Projector only (sound), like the
  // ding - never thirty Chromebooks. Re-arms above 5s so every beat counts down.
  const activePhase = !progress.done ? phases[progress.index] : undefined;
  const phaseSecondsLeft = activePhase
    ? Math.max(0, Math.ceil(activePhase.seconds - progress.phaseElapsed))
    : 0;
  useEffect(() => {
    if (!sound || progress.done || phaseSecondsLeft > 5) {
      lastTickRef.current = null;
      return;
    }
    if (phaseSecondsLeft > 0 && phaseSecondsLeft !== lastTickRef.current) {
      lastTickRef.current = phaseSecondsLeft;
      playTick();
    }
  }, [phaseSecondsLeft, sound, progress.done]);

  return (
    <div className="dt-root" aria-label="Discussion protocol">
      <ol className="dt-list">
        {phases.map((phase, index) => {
          const state = progress.done || index < progress.index ? "done" : index === progress.index ? "active" : "upcoming";
          // Drains, not fills (Steele, 2026-08-07): a phase starts full and
          // runs out as its own clock counts down, so "how much is left" is
          // what the eye reads, not "how much has passed."
          const fill = state === "done" ? 0 : state === "active" ? Math.max(0, 1 - progress.phaseFraction) : 1;
          const isActive = state === "active";
          // The ACTIVE beat counts DOWN its own remaining time; every other beat
          // shows its full length. Showing phase.seconds on the active one was
          // the bug - the bar emptied but the number never moved.
          const shown = isActive ? phaseSecondsLeft : phase.seconds;
          const urgency = !isActive ? "" : phaseSecondsLeft <= 5 ? " final" : phaseSecondsLeft <= 15 ? " urgent" : "";
          return (
            <li className={`dt-phase ${state}`} key={`${phase.mode}-${index}`}>
              <span className="dt-label">{discussionPhaseLabel(phase)}</span>
              <span className="dt-direction">{phase.direction}</span>
              <span className="dt-bar-wrap">
                <span className="dt-bar" style={{ width: `${Math.round(fill * 100)}%` }} />
                <span className={`dt-time${isActive ? " active" : ""}${urgency}`}>{formatDuration(shown)}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <style>{`
        .dt-root { width:min(100%, 60em); margin:0 auto; }
        .dt-list { list-style:none; margin:0; padding:0; display:grid; gap:0.7em; }
        .dt-phase { display:grid; grid-template-columns:minmax(4.5em,auto) 1fr minmax(9em,16em); align-items:center; gap:0.6em 1em; padding:0.7em 0.9em; border-radius:0.7em; border:2px solid var(--dt-line, #ece4d4); background:var(--dt-card, #fff); transition:border-color .2s, background .2s, opacity .2s; }
        .dt-phase.upcoming { opacity:0.55; }
        .dt-phase.active { border-color:var(--dt-accent, #50a3a4); background:color-mix(in srgb, var(--dt-accent, #50a3a4) 9%, var(--dt-card, #fff)); box-shadow:0 3px 14px rgba(32,30,26,0.10); }
        .dt-phase.done { opacity:0.9; }
        .dt-label { font-size:0.9em; font-weight:900; text-transform:uppercase; letter-spacing:0.05em; color:var(--dt-accent-text, #3c7d7e); }
        .dt-phase.upcoming .dt-label { color:var(--dt-soft, #7a7061); }
        .dt-direction { font-size:1em; font-weight:800; color:var(--dt-ink, #201e1a); line-height:1.25; }
        .dt-bar-wrap { position:relative; height:2em; border-radius:999px; background:var(--dt-track, #f3ecdd); border:1px solid var(--dt-line, #ece4d4); overflow:hidden; display:flex; align-items:center; }
        .dt-bar { position:absolute; left:0; top:0; bottom:0; background:var(--dt-accent, #50a3a4); border-radius:999px; }
        .dt-phase.done .dt-bar { background:var(--dt-done, #2f9e6f); }
        .dt-time { position:relative; margin-left:auto; margin-right:0.7em; font-size:0.85em; font-weight:900; color:var(--dt-ink, #201e1a); font-variant-numeric:tabular-nums; }
        /* The live beat's number is the one that moves, so it reads bigger. */
        .dt-time.active { font-size:1.3em; color:var(--dt-accent-text, #3c7d7e); }
        .dt-time.urgent { color:#f95335; animation:dt-time-pulse 1s ease-in-out infinite; }
        .dt-time.final { color:#f95335; animation:dt-time-pulse 0.5s ease-in-out infinite; }
        @keyframes dt-time-pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        @media (prefers-reduced-motion: reduce) { .dt-time.urgent, .dt-time.final { animation:none; } }
        @media (max-width: 640px) {
          .dt-phase { grid-template-columns:1fr; gap:0.35em; }
          .dt-bar-wrap { width:100%; }
        }
      `}</style>
    </div>
  );
}
