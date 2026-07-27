"use client";

// The class attention call - the big dog barks, the pack knocks back.
//
// One signature sound for the room. Default: a deep double knock synthesized
// in Web Audio (no asset file needed). The moment /sounds/attention-call.mp3
// exists in the deploy it replaces the knock automatically - the intended
// recording is Abbie herself, barking twice.
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

// One knock: a low thump (pitch falling 170 -> 52 Hz) under a short knuckle
// click of band-passed noise. Two of these 0.34s apart make the call.
function knockAt(c: AudioContext, out: AudioNode, t: number) {
  const body = c.createOscillator();
  const bodyGain = c.createGain();
  body.type = "sine";
  body.frequency.setValueAtTime(170, t);
  body.frequency.exponentialRampToValueAtTime(52, t + 0.11);
  bodyGain.gain.setValueAtTime(0.0001, t);
  bodyGain.gain.exponentialRampToValueAtTime(0.95, t + 0.006);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
  body.connect(bodyGain);
  bodyGain.connect(out);
  body.start(t);
  body.stop(t + 0.26);

  const len = Math.max(1, Math.floor(c.sampleRate * 0.03));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const click = c.createBufferSource();
  click.buffer = buf;
  const band = c.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 1400;
  band.Q.value = 0.8;
  const clickGain = c.createGain();
  clickGain.gain.value = 0.25;
  click.connect(band);
  band.connect(clickGain);
  clickGain.connect(out);
  click.start(t);
  click.stop(t + 0.03);
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
  const t0 = c.currentTime + 0.02;
  knockAt(c, master, t0);
  knockAt(c, master, t0 + 0.34);
}
