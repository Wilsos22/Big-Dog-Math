"use client";

// The class attention call.
//
// One signature sound for the room. Default: a two-tone bing-bong chime
// synthesized in Web Audio (no asset file needed) - a descending doorbell
// third with a full quarter-note of air between the notes (Steele's timing,
// 2026-07-27: "bing, quarter note, bong" - his Stream Deck clip was too
// fast). The moment /sounds/attention-call.mp3 exists in the deploy it
// replaces the chime automatically - Abbie's real bark or any clip he picks.
//
// Browser autoplay policy: a display may not sound audio until it has received
// one REAL tap or click after page load. armAttentionAudio() must therefore be
// reached from inside a genuine user gesture the first time; AttentionPulse
// handles that (it arms silently on any tap, and shows an arming chip when a
// call arrives before the display has ever been tapped).

let ctx: AudioContext | null = null;
let armed = false;
let fileBuffer: AudioBuffer | null = null;
let filePromise: Promise<void> | null = null;
const listeners = new Set<(armed: boolean) => void>();

export function attentionAudioArmed(): boolean {
  return armed;
}

export function onAttentionAudioChange(fn: (armed: boolean) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function setArmed(next: boolean) {
  if (armed === next) return;
  armed = next;
  for (const fn of listeners) fn(next);
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext
      || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

export async function armAttentionAudio(): Promise<boolean> {
  const c = getCtx();
  if (!c) return false;
  try {
    if (c.state !== "running") await c.resume();
  } catch {
    // Stays suspended until a qualifying gesture arrives.
  }
  const ok = c.state === "running";
  if (ok) {
    setArmed(true);
    void loadCallFile(c);
  }
  return ok;
}

// Fetch the custom call once per page load; absence is the normal case.
function loadCallFile(c: AudioContext): Promise<void> {
  if (!filePromise) {
    filePromise = (async () => {
      try {
        const head = await fetch("/sounds/attention-call.mp3", { method: "HEAD" });
        if (!head.ok) return;
        const res = await fetch("/sounds/attention-call.mp3");
        if (!res.ok) return;
        fileBuffer = await c.decodeAudioData(await res.arrayBuffer());
      } catch {
        // Keep the synthesized knock.
      }
    })();
  }
  return filePromise;
}

// The gap between bing and bong: one quarter note at an easy ~90 bpm.
export const CALL_BEAT_S = 0.66;

// One chime note: a soft-struck bell - fundamental plus two decaying
// partials, gentle 12ms attack so it rings rather than stabs.
function chimeAt(c: AudioContext, out: AudioNode, t: number, freq: number, peak: number, decay: number) {
  const partials: [number, number][] = [[1, 1], [2, 0.35], [2.98, 0.1]];
  for (const [ratio, amp] of partials) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(freq * ratio, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak * amp, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + decay + 0.05);
  }
}

export function playAttentionCall(): void {
  const c = getCtx();
  if (!c || c.state !== "running") return;
  const master = c.createGain();
  master.gain.value = 0.9;
  master.connect(c.destination);
  if (fileBuffer) {
    const s = c.createBufferSource();
    s.buffer = fileBuffer;
    s.connect(master);
    s.start();
    return;
  }
  // Bing: E5, ringing into the rest. Bong: C5, longer ring - the classic
  // descending doorbell third, unhurried.
  const t0 = c.currentTime + 0.02;
  chimeAt(c, master, t0, 659.25, 0.55, 1.0);
  chimeAt(c, master, t0 + CALL_BEAT_S, 523.25, 0.6, 1.7);
}
