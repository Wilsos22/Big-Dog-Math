"use client";

// The two short synthesized cues a running phase timer makes, in one place.
//
// EXTRACTED, NOT INVENTED (2026-08-06). These were private to
// DiscussionTimeline.tsx. GalleryWalkTimeline needs the same two sounds for the
// same reason - a beat changed, a beat is about to change - and a third private
// copy is how two classroom screens end up sounding different in the same room.
// DiscussionProtocol.tsx still has its own older `tone()`; it is a different
// component on a different clock and is deliberately left alone in this pass.
//
// AUTOPLAY. Both are BEST EFFORT. A browser will not sound audio until the page
// has received one real tap, so a projector nobody has touched since the last
// deploy is silent. Every caller must therefore treat the visual highlight as
// the primary cue and put an arming affordance on screen - see
// `attentionCall.ts` / `AttentionPulse` for the proven one.

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext
    || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  return new Ctx();
}

/** A short two-note ding: a beat just changed. Synthesized, so no committed asset. */
export function playDing(): void {
  try {
    const ctx = audioContext();
    if (!ctx) return;
    const start = ctx.currentTime;
    [
      { freq: 784, at: 0 },
      { freq: 1047, at: 0.12 },
    ].forEach(({ freq, at }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start + at);
      gain.gain.exponentialRampToValueAtTime(0.32, start + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + at + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start + at);
      osc.stop(start + at + 0.42);
    });
    window.setTimeout(() => { try { void ctx.close(); } catch { /* ignore */ } }, 800);
  } catch {
    /* audio unavailable - the highlight is the primary cue */
  }
}

/**
 * A single blip for a per-second countdown: a beat is ABOUT to change.
 * Deliberately lighter and higher than the ding so a tick is never mistaken for
 * the change itself.
 */
export function playTick(): void {
  try {
    const ctx = audioContext();
    if (!ctx) return;
    const start = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 1046;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.2, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.14);
    window.setTimeout(() => { try { void ctx.close(); } catch { /* ignore */ } }, 300);
  } catch {
    /* audio unavailable - the highlight is the primary cue */
  }
}
