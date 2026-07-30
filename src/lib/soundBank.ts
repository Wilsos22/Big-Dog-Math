"use client";

// The classroom sound bank - the button bank that replaced the Abbie AI deck on
// the iPad Remote (Steele, 2026-07-29: "id rather have other sound clips
// attached to a button bank like that so i can have an applause sound and a sad
// trombone when i ask a question and i get silence or i embarrass myself").
//
// THREE SOURCES, IN THIS ORDER: a clip the teacher loaded on the classroom
// laptop (src/lib/soundBankStore.ts, IndexedDB, installed into this module by
// /control at mount), then a committed public/sounds/<id>.mp3, then the
// synthesized cue. A button can therefore never be silent, and loading a real
// sound no longer needs a binary in the repo and a deploy.
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
  "air-horn",
  "applause",
  "cheering",
  "crickets",
  "drum-roll",
  "dun-dun-dun",
  "jeopardy",
  "locked-in",
  "stank-face",
  "true",
  "a-few-moments-later",
  "another-one",
  "bingo",
  "bruh",
  "directed-by-robert",
  "never-know",
  "law-and-order",
  "what",
  "metro",
  "money",
  "record-scratch",
  "straight-up",
  "omg",
  "be-right-back",
  "you",
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
  /**
   * Filename stems this cue answers to, normalized the way slugFileName does.
   * They exist so loading a folder of clips at once maps each file to the right
   * button instead of asking the teacher to place twenty-five of them by hand.
   */
  match?: readonly string[];
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

// Most of the bank is Steele's own recordings - a voice clip cannot be
// synthesized, so these carry a short neutral blip until his file is loaded.
// It exists so a key pressed before the clip is in place makes a sound rather
// than nothing, which is indistinguishable from a broken button.
function renderBlip(c: AudioContext, out: AudioNode, t: number) {
  pitched(c, out, t, { freq: 660, duration: 0.1, peak: 0.16, type: "sine", attack: 0.004, release: 0.06 });
}

export const SOUND_CUES: readonly SoundCue[] = [
  { id: "air-horn", label: "Air horn", detail: "Big noise", tone: "red", render: renderBuzzer, match: ["air-horn"] },
  { id: "applause", label: "Applause", detail: "The room claps", tone: "green", render: renderApplause, match: ["applause"] },
  { id: "cheering", label: "Cheering", detail: "They earned it", tone: "green", render: renderApplause, match: ["cheering"] },
  { id: "crickets", label: "Crickets", detail: "Nobody answered", tone: "teal", render: renderCrickets, match: ["crickets"] },
  { id: "drum-roll", label: "Drum roll", detail: "Build to the reveal", tone: "gold", render: renderDrumroll, match: ["drum-roll", "drumroll"] },
  { id: "dun-dun-dun", label: "Dun dun dun", detail: "The twist", tone: "purple", render: renderSadTrombone, match: ["dun-dun-dun"] },
  { id: "jeopardy", label: "Jeopardy", detail: "Thinking time", tone: "gold", render: renderDing, match: ["jeopardy-theme-song", "jeopardy"] },
  { id: "locked-in", label: "Locked in", detail: "Heads down", tone: "blue", render: renderDing, match: ["locked-in"] },
  { id: "stank-face", label: "Stank face", detail: "That was nasty", tone: "purple", render: renderBlip, match: ["sponge-stank-noise", "stank"] },
  { id: "true", label: "True", detail: "Hard agree", tone: "green", render: renderBlip, match: ["2-chainz-says-true"] },
  { id: "a-few-moments-later", label: "A few moments later", detail: "Time passes", tone: "teal", render: renderBlip, match: ["a-few-moments-later"] },
  { id: "another-one", label: "Another one", detail: "Next problem", tone: "orange", render: renderBlip, match: ["another-one"] },
  { id: "bingo", label: "Bingo", detail: "Exactly right", tone: "green", render: renderDing, match: ["bingo"] },
  { id: "bruh", label: "Bruh", detail: "Come on now", tone: "purple", render: renderBlip, match: ["bruh-sound-effect", "bruh"] },
  { id: "directed-by-robert", label: "Directed by Robert B", detail: "Roll credits", tone: "blue", render: renderBlip, match: ["directed-by-robert-b", "directed-by-robert"] },
  { id: "never-know", label: "We will never know", detail: "Unanswerable", tone: "teal", render: renderBlip, match: ["i-guess-well-never-know-kanye", "i-guess-well-never-know"] },
  { id: "law-and-order", label: "Law and order", detail: "Case closed", tone: "blue", render: renderBlip, match: ["law-and-order"] },
  { id: "what", label: "What", detail: "Said with feeling", tone: "red", render: renderBlip, match: ["lil-jon-what"] },
  { id: "metro", label: "Metro", detail: "Producer tag", tone: "purple", render: renderBlip, match: ["metroooo", "metro"] },
  { id: "money", label: "Money", detail: "Cha-ching", tone: "gold", render: renderDing, match: ["money-soundfx", "money"] },
  { id: "record-scratch", label: "Record scratch", detail: "Stop right there", tone: "orange", render: renderBlip, match: ["record-scratch"] },
  { id: "straight-up", label: "Straight up", detail: "No notes", tone: "orange", render: renderBlip, match: ["straight-up-travis-scott", "straight-up"] },
  { id: "omg", label: "OMG", detail: "Genuine shock", tone: "red", render: renderBlip, match: ["travisscott-omg", "omg"] },
  { id: "be-right-back", label: "Be right back", detail: "Hold on", tone: "teal", render: renderBlip, match: ["well-be-right-back", "be-right-back"] },
  { id: "you", label: "You", detail: "Yes, you", tone: "blue", render: renderBlip, match: ["you"] },
];

const SOUND_CUE_BY_ID = new Map<string, SoundCue>(SOUND_CUES.map((cue) => [cue.id, cue]));

export function soundCue(id: string): SoundCue | null {
  return SOUND_CUE_BY_ID.get(id) ?? null;
}

// ── Matching a dropped file to a button ─────────────────────────────────────
//
// Steele's clips come out of a Stream Deck sound board, so the filenames carry
// spaces, capitals, " copy", and the random suffix a download site appends
// ("bruh-sound-effect_WstdzdM.mp3"). Normalizing all of that away lets one
// multi-file load place twenty-five clips on the right twenty-five buttons
// instead of asking him to do it by hand.

/** "Drum roll.mp3" and "another-one_dPvHt2Z.mp3" -> "drum-roll", "another-one". */
export function slugFileName(name: string): string {
  return name
    .replace(/\.[a-z0-9]+$/i, "")        // extension
    .replace(/[_-][A-Za-z0-9]{7,}$/, "")  // download-site suffix
    .replace(/\s*\(\d+\)\s*$/, "")       // "(1)" from a second download
    .replace(/\s*copy\s*$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Which button a file belongs on, or null if nothing claims it. Exact matches
 * win over partial ones so "you.mp3" cannot be swallowed by a cue that merely
 * contains "you", and the longest partial wins so "drum-roll" beats a shorter
 * accidental overlap.
 */
export function matchSoundCueFile(fileName: string): SoundCueId | null {
  const slug = slugFileName(fileName);
  if (!slug) return null;
  let partial: { id: SoundCueId; len: number } | null = null;
  for (const cue of SOUND_CUES) {
    for (const hint of [cue.id, ...(cue.match ?? [])]) {
      if (slug === hint) return cue.id;
      if (slug.includes(hint) && (!partial || hint.length > partial.len)) {
        partial = { id: cue.id, len: hint.length };
      }
    }
  }
  return partial?.id ?? null;
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

// ── Teacher-loaded clips ────────────────────────────────────────────────────
// Held here as decoded buffers. This module deliberately imports nothing local
// - its contract compiles it in isolation with the "@/" aliases dropped - so
// the store does not reach in; /control reads IndexedDB and pushes clips down.

const userBuffers = new Map<string, AudioBuffer>();

/**
 * Assign decoded audio to a cue for the rest of this page's life. Returns false
 * if the bytes would not decode, so a caller can tell the teacher the file is
 * broken instead of leaving a button that silently falls back.
 */
export async function installUserClip(
  id: string,
  bytes: ArrayBuffer,
  existing?: AudioContext | null,
): Promise<boolean> {
  const c = existing ?? sharedContext();
  if (!c) return false;
  try {
    userBuffers.set(id, await c.decodeAudioData(bytes.slice(0)));
    return true;
  } catch {
    return false;
  }
}

/** Drop a loaded clip; the cue falls back to its file, then to synthesis. */
export function clearUserClip(id: string): void {
  userBuffers.delete(id);
}

/** Which cues are currently playing a teacher-loaded clip. */
export function loadedUserClipIds(): string[] {
  return [...userBuffers.keys()];
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
  // Teacher's own clip first, then a committed file, then synthesis.
  const chosen = userBuffers.get(id) ?? fileBuffers.get(id);
  if (chosen) {
    const src = c.createBufferSource();
    src.buffer = chosen;
    src.connect(master);
    src.start(at);
    return;
  }
  cue.render(c, master, at);
}
