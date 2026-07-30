/**
 * The classroom state strip: eyes, voice, supplies, body.
 *
 * Modelled on a garment care label. Four slots, ALWAYS in this order, one
 * monochrome glyph each, on the pace and support projector for the whole
 * period. The mechanism it serves is PRECORRECTION - naming the state before
 * the transition that breaks it - rather than correction after, which is why
 * the values are authored per step and ship with the lesson instead of being
 * one more thing to manage from the iPad mid-class.
 *
 * Three redundant cues carry each slot (State Strip Icons v3, 2026-07-29):
 *   - POSITION tells you which slot - the four rows never reorder.
 *   - GLYPH tells you the value - one glyph PER VALUE now, not one per slot, so
 *     "The speaker" and "The screen" are two different silhouettes a student
 *     reads at 25 feet rather than the same eye plus different words.
 *   - COLOUR tells you how much is happening in the room - a single hue at four
 *     lightness steps (the ramp), monotonic so it survives greyscale and colour
 *     vision deficiency both. Colour no longer distinguishes slots; that job
 *     moved to the glyph.
 * The word stays UNDER/beside each glyph permanently (Steele, 2026-07-29: "it
 * can say what it means under it no problem"), so nothing depends on a student
 * memorising a symbol.
 *
 * ALL FOUR OR NOTHING. A step missing any value renders no strip at all rather
 * than a partial one: a strip that is sometimes empty is a strip students stop
 * scanning, and a stale slot is how a student ends up holding rods during the
 * exit ticket. `stripFromStep` returns null unless every slot resolves, and
 * `/control` names the incomplete steps in its load message.
 *
 * The vocabulary here MUST match the `Eyes` / `Voice` / `Supplies` / `Body`
 * select options on the Notion "Math 6 Lesson Steps" data source.
 * `npm run test:state-strip` asserts the shape both engines depend on.
 */

export const STATE_STRIP_SLOTS = ["eyes", "voice", "supplies", "body"] as const;
export type StateStripSlot = (typeof STATE_STRIP_SLOTS)[number];

// THREE PER SLOT (Steele, 2026-07-29: "no 3 for all"). v3 draws one glyph per
// value and made exactly three per slot, so the vocabulary matches it: Eyes drops
// "Teacher" and "Your build" (both fold into "Own paper" - eyes on your own
// surface), and Voice drops "3 presenting" (a table-group voice aimed at the
// room, which the ramp shows as "2 table" one shade darker rather than a fourth
// glyph). No lesson had these authored yet, so the reduction breaks no data.
export const EYES_VALUES = ["Own paper", "The speaker", "The screen"] as const;
export const VOICE_VALUES = ["0 silent", "1 partner", "2 table"] as const;
export const SUPPLIES_VALUES = ["In the tray", "In your hands", "Parked flat"] as const;
export const BODY_VALUES = ["Seated", "Standing to talk", "Moving"] as const;

export type EyesValue = (typeof EYES_VALUES)[number];
export type VoiceValue = (typeof VOICE_VALUES)[number];
export type SuppliesValue = (typeof SUPPLIES_VALUES)[number];
export type BodyValue = (typeof BODY_VALUES)[number];

export interface ClassroomStateStrip {
  eyes: EyesValue;
  voice: VoiceValue;
  supplies: SuppliesValue;
  body: BodyValue;
}

/** The raw per-step values as they arrive from Notion - any may be blank. */
export interface ClassroomStateStripInput {
  eyes?: string | null;
  voice?: string | null;
  supplies?: string | null;
  body?: string | null;
}

const SLOT_VALUES: Record<StateStripSlot, readonly string[]> = {
  eyes: EYES_VALUES,
  voice: VOICE_VALUES,
  supplies: SUPPLIES_VALUES,
  body: BODY_VALUES,
};

export const STATE_STRIP_SLOT_LABELS: Record<StateStripSlot, string> = {
  eyes: "Eyes",
  voice: "Voice",
  supplies: "Supplies",
  body: "Body",
};

export const STATE_STRIP_RAMP_STEPS = [0, 1, 2, 3] as const;
export type RampStep = (typeof STATE_STRIP_RAMP_STEPS)[number];

/**
 * Room-activity intensity per value - the ramp step each glyph's tile is filled
 * at. One hue, four lightness steps, monotonic so a student reads "louder /
 * busier" straight up the strip and greyscale keeps the ordering. All four steps
 * stay in the darker half so they hold against the cream pace screen.
 *
 * Voice and supplies top out at step 2: at a full-room moment the supplies slot
 * holds at "Parked flat" and voice at "2 table" one shade down, so the strip is
 * never short a glyph. Only eyes and body reach step 3.
 */
const STATE_STRIP_INTENSITY: Record<StateStripSlot, Record<string, RampStep>> = {
  eyes: { "Own paper": 0, "The speaker": 2, "The screen": 3 },
  voice: { "0 silent": 0, "1 partner": 1, "2 table": 2 },
  supplies: { "In the tray": 0, "In your hands": 1, "Parked flat": 2 },
  body: { "Seated": 0, "Standing to talk": 2, "Moving": 3 },
};

export function stripIntensity(slot: StateStripSlot, value: string): RampStep {
  return STATE_STRIP_INTENSITY[slot][value] ?? 0;
}

/**
 * Which of the twelve v3 glyphs a value draws. The glyph is the cue that tells
 * two values in the same slot apart at room distance, which is why there is one
 * per value. The SVG path data lives in `ClassroomStateStrip.tsx`; this is only
 * the id, so the lib stays free of pixels and the contract can assert every
 * value has one.
 */
const STATE_STRIP_GLYPH: Record<StateStripSlot, Record<string, string>> = {
  eyes: { "Own paper": "eyes-own-work", "The speaker": "eyes-speaker", "The screen": "eyes-board" },
  voice: { "0 silent": "voice-0", "1 partner": "voice-1", "2 table": "voice-2" },
  supplies: { "In the tray": "supplies-away", "In your hands": "supplies-using", "Parked flat": "supplies-flat" },
  body: { "Seated": "body-seated", "Standing to talk": "body-standing", "Moving": "body-moving" },
};

export function stripGlyphId(slot: StateStripSlot, value: string): string {
  return STATE_STRIP_GLYPH[slot][value] ?? "";
}

/**
 * Match a Notion select value to the vocabulary, tolerantly.
 *
 * Case and surrounding whitespace are ignored, and the voice slot also accepts
 * the bare digit, because "0" is what a teacher types and what the projector
 * shows. Anything else returns null, which makes the step incomplete and gets
 * it named in the load message - a silently coerced value would put a wrong
 * state on a classroom screen, which is worse than no strip.
 */
function matchSlot(slot: StateStripSlot, raw: string | null | undefined): string | null {
  const value = (raw || "").trim();
  if (!value) return null;
  const lower = value.toLowerCase();
  const hit = SLOT_VALUES[slot].find((option) => option.toLowerCase() === lower);
  if (hit) return hit;
  if (slot === "voice") {
    const digit = VOICE_VALUES.find((option) => option.startsWith(`${value} `) || option[0] === value);
    if (digit) return digit;
  }
  return null;
}

/** The digit a voice value leads with. It stays on the strip after the words come off. */
export function voiceDigit(voice: VoiceValue): string {
  return voice[0];
}

/** The words after the digit, e.g. "partner" for "1 partner". */
export function voiceWords(voice: VoiceValue): string {
  return voice.slice(1).trim();
}

/**
 * Build a strip from raw per-step values, or null if any slot is unresolved.
 * Callers must treat null as "render nothing", never as "render a blank strip".
 */
export function stripFromStep(input: ClassroomStateStripInput | null | undefined): ClassroomStateStrip | null {
  if (!input) return null;
  const eyes = matchSlot("eyes", input.eyes);
  const voice = matchSlot("voice", input.voice);
  const supplies = matchSlot("supplies", input.supplies);
  const body = matchSlot("body", input.body);
  if (!eyes || !voice || !supplies || !body) return null;
  return {
    eyes: eyes as EyesValue,
    voice: voice as VoiceValue,
    supplies: supplies as SuppliesValue,
    body: body as BodyValue,
  };
}

/**
 * Which slots a step failed to fill, for the load message. An unrecognised
 * value is reported the same as a blank one, and named, so a typo in Notion is
 * findable instead of being silently dropped.
 */
export function missingStripSlots(input: ClassroomStateStripInput | null | undefined): StateStripSlot[] {
  return STATE_STRIP_SLOTS.filter((slot) => !matchSlot(slot, input?.[slot]));
}

/**
 * Apply a live override to an authored strip.
 *
 * The override exists for Settle 30s and the moments the plan did not predict.
 * It is stamped with the sequence index it was issued at and expires the
 * instant the lesson advances, so nothing has to remember to clear it - the
 * same reversion-by-key idiom the iPad's spinner tracker uses.
 */
export interface ClassroomStateStripOverride {
  eyes?: EyesValue;
  voice?: VoiceValue;
  supplies?: SuppliesValue;
  body?: BodyValue;
  atIndex: number;
}

export function applyStripOverride(
  strip: ClassroomStateStrip | null,
  override: ClassroomStateStripOverride | null | undefined,
  currentIndex: number | null | undefined,
): ClassroomStateStrip | null {
  if (!strip) return null;
  if (!override) return strip;
  if (override.atIndex !== (currentIndex ?? -1)) return strip;
  return {
    eyes: override.eyes ?? strip.eyes,
    voice: override.voice ?? strip.voice,
    supplies: override.supplies ?? strip.supplies,
    body: override.body ?? strip.body,
  };
}

/** True when the override is still live for this step. Drives the "overridden" cue. */
export function overrideIsLive(
  override: ClassroomStateStripOverride | null | undefined,
  currentIndex: number | null | undefined,
): boolean {
  return Boolean(override) && override!.atIndex === (currentIndex ?? -1);
}
