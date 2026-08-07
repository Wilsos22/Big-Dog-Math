// Shared timer-cue tones, music-duck levels, and the countdown-transition rule.
//
// TWO surfaces play classroom timer cues: /teacher/present (the projector, the
// PRIMARY audio host as of 2026-08-07 because it is the always-foreground tab)
// and /control (the BACKUP host on the classroom laptop). They must sound
// identical, so the tone patterns, the duck volumes, and the "which cue fires at
// this second" rule live here and are imported by both - a tone tweaked in one
// place can never drift from the other, the exact "two engines drift" failure
// this codebase keeps hitting.
//
// Pure Web Audio, no local imports, so this can be reasoned about (and, if ever
// needed, contract-compiled) in isolation the way soundBank.ts is.

export type TimerCueKey = "warn30" | "tick" | "end";

// State music sits UNDER a cue rather than stopping for it - a song that cuts
// out every time a tick fires is worse than one that dips. 0.18 is quiet enough
// that a spoken cue reads clearly over it.
export const MUSIC_FULL_VOLUME = 1;
export const MUSIC_DUCK_VOLUME = 0.18;
// Used until a clip reports its real duration. Longer than any cue in the bank,
// short enough that a clip which never loads cannot leave the music quiet for
// the rest of the period.
export const CUE_DUCK_FALLBACK_SECONDS = 3;

type TonePart = { f: number; t: number; d: number };

// The synthesized fallback tones, played when no uploaded clip exists for a cue.
// Frequencies and timings are the originals from /control's countdown engine.
export const TIMER_TONE_PATTERNS: Record<TimerCueKey, TonePart[]> = {
  tick: [{ f: 660, t: 0, d: 0.07 }],
  warn30: [{ f: 880, t: 0, d: 0.18 }, { f: 660, t: 0.22, d: 0.18 }],
  end: [{ f: 880, t: 0, d: 0.2 }, { f: 880, t: 0.25, d: 0.2 }, { f: 880, t: 0.5, d: 0.2 }],
};

/** Synthesize a tone pattern on an already-constructed context. Never throws. */
export function genTone(ctx: AudioContext, pattern: TonePart[]): void {
  try {
    pattern.forEach(({ f, t, d }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = f;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + d);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + d + 0.02);
    });
  } catch { /* ignore */ }
}

/**
 * Which cue a one-second countdown transition should fire, if any. Mirrors
 * /control's countdown engine: the end cue when the clock reaches zero, a warn
 * at the 30-second crossing, and a tick for each of 10..1.
 */
export function timerCueForTransition(previous: number, next: number): TimerCueKey | null {
  if (next <= 0 && previous > 0) return "end";
  if (previous > 30 && next <= 30) return "warn30";
  if (next <= 10 && next >= 1) return "tick";
  return null;
}
