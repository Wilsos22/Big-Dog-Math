"use client";

// The classroom sound bank - the button bank that replaced the Abbie AI deck on
// the iPad Remote (Steele, 2026-07-29: "id rather have other sound clips
// attached to a button bank like that so i can have an applause sound and a sad
// trombone when i ask a question and i get silence or i embarrass myself").
//
// TWO THINGS MAKE THIS SAFE TO SHIP WITH AN EMPTY public/sounds/ FOLDER.
// 1. Every cue SYNTHESIZES in Web Audio, so the bank works today with zero
//    assets in the repo and nothing binary to commit.
// 2. Every cue also prefers /sounds/<id>.mp3 the moment that file exists in the
//    deploy - the same trick src/lib/attentionCall.ts uses for the attention
//    call. That is why the ids are lowercase and hyphenated: THE ID IS THE
//    FILENAME. Drop applause.mp3 into public/sounds/ and the synthesized clap is
//    replaced with no code change.
//
// THIS FILE IS THE SINGLE SOURCE OF TRUTH. The iPad deck buttons in
// src/lib/remoteDeck.ts are DERIVED from SOUND_CUES, a cue's remote action is
// always `play-<id>`, and `npm run test:sound-bank` asserts the three lists
// (cues, deck, TEACHER_REMOTE_ACTIONS) cannot drift apart. A hand-copied list of
// these ids anywhere is the same defect class as the hand-copied poll-kind array
// that silently stored every multiple-choice-explain poll as a short answer.
//
// IT SOUNDS ON THE CLASSROOM COMPUTER, not the iPad. The Remote only sends the
// command; /control receives it in the same handler that already answers
// play-warning / play-countdown / play-times-up, and plays it through the
// laptop's speakers. Deliberately one mechanism, not two.
//
// It imports nothing local on purpose - the contract compiles this file in
// isolation (tsc --ignoreConfig drops the "@/" path aliases).

export const SOUND_CUE_IDS = [
  "applause",
  "sad-trombone",
  "crickets",
  "drumroll",
  "rimshot",
  "ding",
  "buzzer",
] as const;
export type SoundCueId = (typeof SOUND_CUE_IDS)[number];

export interface SoundCue {
  /** Lowercase, hyphenated, and file-safe: it is also the /sounds/<id>.mp3 name. */
  id: SoundCueId;
  /** What the teacher reads on the deck key. */
  label: string;
  /** The deck key's second line. */
  detail: string;
  /** Deck key tone class - must be one the Remote's stylesheet actually styles. */
  tone: string;
  /** Synthesize the cue into `out`, starting at context time `t`. */
  render: (c: AudioContext, out: AudioNode, t: number) => void;
}

// ── Synthesis building blocks ───────────────────────────────────────────────

const NOISE_SECONDS = 3;
let noiseBuffers: WeakMap<AudioContext, AudioBuffer> | null = null;

function noiseBuffer(c: AudioContext): AudioBuffer {
  if (!noiseBuffers) noiseBuffers = new WeakMap();
  const cached = noiseBuffers.get(c);
  if (cached) return cached;
  const buffer = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * NOISE_SECONDS)), c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  noiseBuffers.set(c, buffer);
  return buffer;
}

interface NoiseHit {
  duration: number;
  peak: number;
  filter: BiquadFilterType;
  freq: number;
  q?: number;
  attack?: number;
}

// One shaped burst of filtered noise - the building block for claps, snare
// hits, cymbals and cricket wings. Each burst reads the noise buffer from a
// random offset so repeated hits never phase-lock into an audible pitch.
function noiseHit(c: AudioContext, out: AudioNode, t: number, o: NoiseHit) {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = o.filter;
  filter.frequency.value = o.freq;
  filter.Q.value = o.q ?? 1;
  const gain = c.createGain();
  const attack = o.attack ?? 0.004;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(o.peak, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + o.duration);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  src.start(t, Math.max(0, Math.random() * (NOISE_SECONDS - Math.min(o.duration, NOISE_SECONDS - 0.1) - 0.05)));
  src.stop(t + o.duration + 0.05);
}

interface PitchedHit {
  freq: number;
  duration: number;
  peak: number;
  type?: OscillatorType;
  attack?: number;
  /** Slide to this frequency across the note - the sad trombone's whole joke. */
  glideTo?: number;
  /** Hold at peak and cut in this many seconds, instead of decaying the whole note. */
  release?: number;
  lowpass?: number;
}

// One pitched note, optionally bent and optionally darkened.
function pitched(c: AudioContext, out: AudioNode, t: number, o: PitchedHit) {
  const osc = c.createOscillator();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.freq, t);
  if (o.glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.glideTo), t + o.duration);
  let node: AudioNode = osc;
  if (o.lowpass) {
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = o.lowpass;
    osc.connect(lp);
    node = lp;
  }
  const gain = c.createGain();
  const attack = o.attack ?? 0.01;
  const release = o.release ?? 0;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(o.peak, t + attack);
  if (release > 0 && o.duration > attack + release) {
    gain.gain.setValueAtTime(o.peak, t + o.duration - release);
  }
  gain.gain.exponentialRampToValueAtTime(0.0001, t + o.duration);
  node.connect(gain);
  gain.connect(out);
  osc.start(t);
  osc.stop(t + o.duration + 0.05);
}

// ── The cues ────────────────────────────────────────────────────────────────

// A room clapping: a wide band of noise that swells in and decays over about two
// seconds, with two dozen discrete claps scattered on top so it reads as people
// rather than static.
function renderApplause(c: AudioContext, out: AudioNode, t: number) {
  noiseHit(c, out, t, { duration: 2.1, peak: 0.30, filter: "bandpass", freq: 1500, q: 0.6, attack: 0.22 });
  for (let i = 0; i < 26; i += 1) {
    noiseHit(c, out, t + 0.05 + Math.random() * 1.7, {
      duration: 0.055 + Math.random() * 0.04,
      peak: 0.10 + Math.random() * 0.12,
      filter: "highpass",
      freq: 1200 + Math.random() * 1400,
      q: 0.7,
      attack: 0.002,
    });
  }
}

// Wah, wah, wah, waaah. Four brass notes walking down chromatically from B flat,
// each one sliding flat as it dies, the last one falling a long way. The bend is
// the joke; a clean descending scale is not funny.
function renderSadTrombone(c: AudioContext, out: AudioNode, t: number) {
  const notes: [number, number, number][] = [
    [233.08, 220.00, 0.30],
    [220.00, 207.65, 0.30],
    [207.65, 196.00, 0.30],
    [196.00, 155.56, 1.10],
  ];
  let at = t;
  for (const [from, to, duration] of notes) {
    pitched(c, out, at, { freq: from, glideTo: to, duration, peak: 0.34, type: "sawtooth", attack: 0.03, lowpass: 1200 });
    // An octave below, quiet, so it reads as a horn body rather than a buzz.
    pitched(c, out, at, { freq: from / 2, glideTo: to / 2, duration, peak: 0.15, type: "triangle", attack: 0.03 });
    at += duration + 0.05;
  }
}

// The silence joke: a barely-there night-air hiss with four cricket chirps over
// it. A chirp is three fast pulses, which is what a cricket actually does - one
// long beep sounds like a machine, not a field.
function renderCrickets(c: AudioContext, out: AudioNode, t: number) {
  noiseHit(c, out, t, { duration: 3.0, peak: 0.02, filter: "highpass", freq: 3000, q: 0.5, attack: 0.4 });
  for (let group = 0; group < 4; group += 1) {
    const start = t + 0.25 + group * 0.72;
    for (let pulse = 0; pulse < 3; pulse += 1) {
      const at = start + pulse * 0.075;
      pitched(c, out, at, { freq: 4300, duration: 0.045, peak: 0.15, type: "sine", attack: 0.006 });
      noiseHit(c, out, at, { duration: 0.045, peak: 0.05, filter: "bandpass", freq: 4600, q: 8, attack: 0.005 });
    }
  }
}

// Snare hits closing up from about eleven a second to thirty-six a second over
// a second and a half, getting louder the whole way, then a cymbal crash with a
// low thud under it for weight.
function renderDrumroll(c: AudioContext, out: AudioNode, t: number) {
  let at = t;
  let gap = 0.090;
  let peak = 0.10;
  while (at < t + 1.5) {
    noiseHit(c, out, at, { duration: 0.05, peak, filter: "highpass", freq: 1800, q: 0.8, attack: 0.002 });
    at += gap;
    gap = Math.max(0.028, gap * 0.955);
    peak = Math.min(0.26, peak * 1.035);
  }
  noiseHit(c, out, at, { duration: 1.4, peak: 0.34, filter: "highpass", freq: 900, q: 0.4, attack: 0.004 });
  pitched(c, out, at, { freq: 110, glideTo: 60, duration: 0.5, peak: 0.28, type: "sine", attack: 0.004 });
}

// Ba-dum-tss. The punchline stinger, for when the joke lands - the sad trombone
// is for when it does not.
function renderRimshot(c: AudioContext, out: AudioNode, t: number) {
  const hits: [number, number][] = [[t, 210], [t + 0.17, 250]];
  for (const [at, freq] of hits) {
    noiseHit(c, out, at, { duration: 0.13, peak: 0.30, filter: "highpass", freq: 1400, q: 0.7, attack: 0.002 });
    pitched(c, out, at, { freq, glideTo: freq * 0.7, duration: 0.14, peak: 0.24, type: "triangle", attack: 0.003 });
  }
  noiseHit(c, out, t + 0.36, { duration: 0.95, peak: 0.26, filter: "highpass", freq: 5200, q: 0.5, attack: 0.004 });
}

// One bright bell - yes, that is the one. Struck a couple of octaves above the
// attention call on purpose: the room must never confuse "good answer" with
// "eyes up".
function renderDing(c: AudioContext, out: AudioNode, t: number) {
  const partials: [number, number, number][] = [[1, 0.42, 1.5], [2, 0.16, 0.9], [2.98, 0.06, 0.5]];
  for (const [ratio, peak, duration] of partials) {
    pitched(c, out, t, { freq: 1046.5 * ratio, duration, peak, type: "sine", attack: 0.008 });
  }
}

// Game-show wrong-answer blat: two detuned sawtooths low enough to feel, held
// flat and cut off hard, filtered dark so it is harsh without being shrill.
function renderBuzzer(c: AudioContext, out: AudioNode, t: number) {
  for (const freq of [104, 110]) {
    pitched(c, out, t, { freq, duration: 0.62, peak: 0.26, type: "sawtooth", attack: 0.006, release: 0.05, lowpass: 760 });
  }
  pitched(c, out, t, { freq: 55, duration: 0.62, peak: 0.20, type: "square", attack: 0.006, release: 0.05, lowpass: 300 });
}

export const SOUND_CUES: readonly SoundCue[] = [
  { id: "applause", label: "Applause", detail: "The room claps", tone: "green", render: renderApplause },
  { id: "sad-trombone", label: "Sad trombone", detail: "That went badly", tone: "purple", render: renderSadTrombone },
  { id: "crickets", label: "Crickets", detail: "Nobody answered", tone: "teal", render: renderCrickets },
  { id: "drumroll", label: "Drumroll", detail: "Build to the reveal", tone: "gold", render: renderDrumroll },
  { id: "rimshot", label: "Rimshot", detail: "The joke landed", tone: "orange", render: renderRimshot },
  { id: "ding", label: "Ding", detail: "That is the one", tone: "blue", render: renderDing },
  { id: "buzzer", label: "Buzzer", detail: "Not that one", tone: "red", render: renderBuzzer },
];

const SOUND_CUE_BY_ID = new Map<string, SoundCue>(SOUND_CUES.map((cue) => [cue.id, cue]));

export function soundCue(id: string): SoundCue | null {
  return SOUND_CUE_BY_ID.get(id) ?? null;
}

// ── Remote action naming ────────────────────────────────────────────────────
//
// A cue's action is always `play-<id>`, matching the three timer cues that were
// already there (play-warning / play-countdown / play-times-up). Those three are
// NOT sound-bank cues - they are Control's own timer cue sounds, uploadable per
// computer, and soundCueIdForAction deliberately returns null for them.

export const SOUND_CUE_ACTION_PREFIX = "play-";

export function soundCueAction(id: SoundCueId): string {
  return `${SOUND_CUE_ACTION_PREFIX}${id}`;
}

export function soundCueIdForAction(action: string): SoundCueId | null {
  if (!action.startsWith(SOUND_CUE_ACTION_PREFIX)) return null;
  const id = action.slice(SOUND_CUE_ACTION_PREFIX.length);
  return SOUND_CUE_BY_ID.has(id) ? (id as SoundCueId) : null;
}

export function soundCueFileUrl(id: SoundCueId): string {
  return `/sounds/${id}.mp3`;
}

// ── Playback ────────────────────────────────────────────────────────────────

let ownCtx: AudioContext | null = null;
const fileBuffers = new Map<string, AudioBuffer>();
let primed = false;

function sharedContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ownCtx) {
    const AC = window.AudioContext
      || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ownCtx = new AC();
  }
  return ownCtx;
}

// Absence is the normal case, so nothing is fetched until the teacher actually
// uses the bank. The first press of a cue synthesizes while the HEADs are in
// flight; every press after it plays whatever real clip is installed.
async function loadCueFile(c: AudioContext, id: SoundCueId): Promise<void> {
  const url = soundCueFileUrl(id);
  try {
    const head = await fetch(url, { method: "HEAD" });
    if (!head.ok) return;
    const res = await fetch(url);
    if (!res.ok) return;
    fileBuffers.set(id, await c.decodeAudioData(await res.arrayBuffer()));
  } catch {
    // Keep the synthesized cue.
  }
}

function primeCueFiles(c: AudioContext) {
  if (primed) return;
  primed = true;
  for (const cue of SOUND_CUES) void loadCueFile(c, cue.id);
}

/**
 * Resume the audio context from inside a real user gesture. Browsers refuse to
 * sound anything until a page has been touched once, and a sound-bank press
 * arrives from the iPad rather than from a click on this machine - so a surface
 * that has had no local interaction should arm on any tap.
 */
export async function armSoundBank(existing?: AudioContext | null): Promise<boolean> {
  const c = existing ?? sharedContext();
  if (!c) return false;
  try {
    if (c.state !== "running") await c.resume();
  } catch {
    // Stays suspended until a qualifying gesture arrives.
  }
  if (c.state === "running") primeCueFiles(c);
  return c.state === "running";
}

/**
 * Play one cue. Pass the calling surface's own AudioContext when it has one -
 * /control does, already unlocked by the teacher's clicks - otherwise the bank
 * creates and reuses its own.
 */
export function playSoundCue(id: SoundCueId, existing?: AudioContext | null): void {
  const cue = SOUND_CUE_BY_ID.get(id);
  if (!cue) return;
  const c = existing ?? sharedContext();
  if (!c) return;
  if (c.state !== "running") void c.resume().catch(() => { /* sounds once armed */ });
  primeCueFiles(c);
  const master = c.createGain();
  master.gain.value = 0.9;
  master.connect(c.destination);
  const at = c.currentTime + 0.02;
  const file = fileBuffers.get(id);
  if (file) {
    const src = c.createBufferSource();
    src.buffer = file;
    src.connect(master);
    src.start(at);
    return;
  }
  cue.render(c, master, at);
}
