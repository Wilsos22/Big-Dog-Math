// Framework-free model behind the Lesson Screen Studio and (later) the live surfaces: phase-accent
// tokens reconciled to the canonical class-state ids, the component vocabulary + field specs, the
// default-zone derivation, and the mapping from a Notion Lesson Step to the per-component auto
// values. The React renderer (components/screen/LessonScreen.tsx) reads everything here; nothing in
// this file touches React, the DOM, or Notion, so it stays testable and reusable on any surface.

import type {
  ScreenBlock,
  ScreenComponentType,
  ScreenKey,
  ScreenZones,
  StepScreenLayout,
} from "./lessonScreenLayout";
import { SCREEN_KEYS } from "./lessonScreenLayout";

export type { ScreenKey, ScreenComponentType, ScreenBlock, ScreenZones, StepScreenLayout } from "./lessonScreenLayout";
export { SCREEN_KEYS } from "./lessonScreenLayout";

// ---- Phase accents -----------------------------------------------------------------------------

export interface PhaseStyle {
  word: string;      // the vertical band label (rendered uppercase)
  accent: string;    // the band background - white text must clear AA on it
  ink: string;       // headings + timer inside white component cards
  chipBg: string;    // numbered-chip background
  chipInk: string;   // numbered-chip text
}

// The four AA-tuned families from the design handoff. White band text clears AA on every accent;
// ink is the on-cream companion.
const ORANGE: Omit<PhaseStyle, "word"> = { accent: "#F2820C", ink: "#C4660A", chipBg: "#FCE6CC", chipInk: "#8F4A07" };
const TEAL: Omit<PhaseStyle, "word"> = { accent: "#50A3A4", ink: "#2E4A54", chipBg: "#DCEBEB", chipInk: "#2E4A54" };
const GREEN: Omit<PhaseStyle, "word"> = { accent: "#2E9E5A", ink: "#1F7A45", chipBg: "#DAEEDF", chipInk: "#155A33" };
const BROWN: Omit<PhaseStyle, "word"> = { accent: "#674A40", ink: "#674A40", chipBg: "#ECE7DD", chipInk: "#4A453E" };

// Keyed to the CANONICAL class-state ids in classStates.ts, not the handoff's per-lesson ids. The
// band word is a short label; colour follows the state's role (warm/independent = orange, target/
// review/close = teal, the CRA build states = green, the private show-me/exit states = brown).
const STATE_STYLE: Record<string, PhaseStyle> = {
  warmup: { word: "Warm-up", ...ORANGE },
  review: { word: "Review", ...TEAL },
  "learning-target-readers": { word: "Target", ...TEAL },
  "ipad-kid": { word: "Role", ...TEAL },
  launch: { word: "Launch", ...ORANGE },
  concrete: { word: "Build it", ...GREEN },
  representational: { word: "Show it", ...GREEN },
  abstract: { word: "Write it", ...GREEN },
  "learning-check": { word: "Show me", ...BROWN },
  discussion: { word: "Discuss", ...TEAL },
  "gallery-walk": { word: "Gallery", ...GREEN },
  "small-group": { word: "Groups", ...GREEN },
  independent: { word: "Work time", ...ORANGE },
  exit: { word: "Exit", ...BROWN },
  closeout: { word: "Close", ...TEAL },
  "transition-hustle": { word: "Move", ...BROWN },
  "transition-reset": { word: "Reset", ...BROWN },
  "transition-settle": { word: "Settle", ...BROWN },
  "i-do": { word: "I do", ...ORANGE },
  "we-do": { word: "We do", ...GREEN },
  question: { word: "Question", ...BROWN },
  poll: { word: "Poll", ...BROWN },
};

function shortWord(label: string): string {
  const cleaned = String(label || "").replace(/^\d+\.\s*/, "").trim();
  if (!cleaned) return "Step";
  const words = cleaned.split(/\s+/);
  return words.slice(0, 2).join(" ");
}

// Resolve a phase style. Tool states (`tool-*`) read green; anything unknown falls back to warm
// orange with a word derived from the step label, so a new state never renders a blank band.
export function stateStyleFor(stateId: string | null | undefined, label?: string): PhaseStyle {
  const id = String(stateId || "").trim().toLowerCase();
  if (STATE_STYLE[id]) return STATE_STYLE[id];
  if (id.startsWith("tool-")) return { word: label ? shortWord(label) : "Build", ...GREEN };
  return { word: label ? shortWord(label) : "Warm-up", ...ORANGE };
}

// Math color coding - constant across the whole lesson, never varied per phase.
export const MATH_COLORS = {
  frontFactor: "#50A3A4",
  frontFactorInk: "#3D8586",
  firstAddend: "#FCAF38",
  firstAddendFill: "rgba(252,175,56,.44)",
  firstAddendInk: "#9C6310",
  secondAddend: "#845BC9",
  secondAddendFill: "rgba(132,91,201,.3)",
  secondAddendInk: "#4D3079",
} as const;

// Neutrals used by the studio shell and screens.
export const SCREEN_NEUTRALS = {
  ink: "#201E1A",
  body: "#4A453E",
  muted: "#8A8378",
  placeholder: "#A79E90",
  placeholderSoft: "#BDB4A6",
  hairline: "#DBD5C9",
  paper: "#F6F3EC",
  screenBase: "#F3F0E7",
  appGround: "#ECE8E0",
  dotScreen: "#BEB5A1",
  dotApp: "#C9C1B0",
  promptInk: "#2E4A54",
} as const;

// ---- Component vocabulary ----------------------------------------------------------------------

export interface PaletteEntry {
  type: ScreenComponentType;
  label: string;
  field: string; // the Notion property it binds to, shown under the palette label
}

export const SCREEN_PALETTE: PaletteEntry[] = [
  { type: "prompt", label: "Prompt", field: "Main Display" },
  { type: "text", label: "Screen note", field: "Screen Notes" },
  { type: "model", label: "Area model", field: "Anchor Problem" },
  { type: "doThis", label: "Do this list", field: "Pace Directions" },
  { type: "timer", label: "Timer", field: "Duration" },
  { type: "support", label: "Support words", field: "Vocabulary" },
  { type: "equation", label: "Answer boxes", field: "Question" },
  { type: "legend", label: "Color legend", field: "Slide Overlay" },
  { type: "callout", label: "Callout", field: "Student Directions" },
];

export interface FieldSpec {
  key: string;
  label: string;
}

// Inspector fields per component type. Every value is a string override; blanking one restores the
// Notion value (the studio deletes the override rather than storing "").
export const SCREEN_FIELD_SPECS: Record<ScreenComponentType, FieldSpec[]> = {
  prompt: [{ key: "mainDisplay", label: "Main Display" }],
  text: [{ key: "screenNotes", label: "Screen Notes" }],
  model: [
    { key: "modelTitle", label: "Model title" },
    { key: "modelHint", label: "Model hint" },
    { key: "rows", label: "Rows" },
    { key: "cols", label: "Columns" },
    { key: "split", label: "Split at" },
    { key: "leftLabel", label: "Left label" },
    { key: "rightLabel", label: "Right label" },
  ],
  doThis: [
    { key: "doThisTitle", label: "List heading" },
    { key: "paceDirections", label: "Pace Directions - one per line" },
  ],
  timer: [
    { key: "time", label: "Clock" },
    { key: "timerLabel", label: "Timer label" },
  ],
  support: [
    { key: "supportTitle", label: "Panel heading" },
    { key: "vocabulary", label: "Vocabulary - one per line" },
  ],
  equation: [
    { key: "front", label: "Front factor" },
    { key: "partA", label: "First part" },
    { key: "partB", label: "Second part" },
    { key: "equationNote", label: "Note under boxes" },
  ],
  legend: [{ key: "legendTitle", label: "Legend heading" }],
  callout: [{ key: "studentDirections", label: "Student Directions" }],
};

// Zone flex per screen (zone 0 / zone 1). Matches the handoff's projector proportions.
export const ZONE_FLEX: Record<ScreenKey, [string, string]> = {
  main: ["1.38 1 0", "0.62 1 0"],
  pace: ["1.3 1 0", "0.7 1 0"],
  student: ["1 1 0", "0.62 1 0"],
};

export const ZONE_EMPTY_LABEL: Record<ScreenKey, [string, string]> = {
  main: ["Model zone", "Prompt zone"],
  pace: ["Direction zone", "Timer + support zone"],
  student: ["Task zone", "Model zone"],
};

export const BLOCK_FLEX: Record<ScreenComponentType, string> = {
  prompt: "0 0 auto",
  text: "0 0 auto",
  model: "1 1 0",
  doThis: "1 1 auto",
  timer: "0 0 auto",
  support: "1 1 auto",
  equation: "1 1 0",
  legend: "0 0 auto",
  callout: "0 0 auto",
};

// Components that land in zone 1 when added from the palette; everything else lands in zone 0.
const SECONDARY_ZONE_TYPES = new Set<ScreenComponentType>(["timer", "support", "legend"]);

export function paletteDropZone(type: ScreenComponentType): 0 | 1 {
  return SECONDARY_ZONE_TYPES.has(type) ? 1 : 0;
}

// ---- Step data ---------------------------------------------------------------------------------

// The subset of a Notion Lesson Step the screens read. Both LessonStepData and the studio's
// LessonStep satisfy this structurally.
export interface ScreenStepInput {
  order: number;
  duration: number;
  title: string;
  stateId: string;
  mainDisplay: string;
  paceDirections: string;
  studentDirections: string;
  vocabulary: string;
  question: string;
  responseMode: string;
  screenNotes?: string;
}

export interface ModelShape {
  rows: number;
  cols: number;
  split: number;
  leftLabel: string;
  rightLabel: string;
  title: string;
  hint: string;
}

export interface EquationShape {
  front: string;
  partA: string;
  partB: string;
  note: string;
}

export interface ScreenStepData {
  order: number;
  duration: number;
  title: string;
  stateId: string;
  mainDisplay: string;
  screenNotes: string;
  paceDirections: string;
  studentDirections: string;
  vocabulary: string;
  question: string;
  responseMode: string;
  hasModel: boolean;
  hasEquation: boolean;
  model: ModelShape;
  equation: EquationShape;
}

// Pull the first "A x B" / "A by B" / "A × B" pair out of a line of text.
function parseDimensions(...sources: string[]): { rows: number; cols: number } | null {
  for (const source of sources) {
    const match = String(source || "").match(/(\d{1,3})\s*(?:x|×|by)\s*(\d{1,3})/i);
    if (match) {
      const rows = Number(match[1]);
      const cols = Number(match[2]);
      if (rows >= 1 && cols >= 1) return { rows, cols };
    }
  }
  return null;
}

// A friendly starting split: the largest ten below cols, else half, always within 1..cols-1.
function suggestedSplit(cols: number): number {
  if (cols <= 2) return Math.max(1, cols - 1);
  const tens = Math.floor((cols - 1) / 10) * 10;
  const guess = tens >= 1 ? tens : Math.floor(cols / 2);
  return Math.min(cols - 1, Math.max(1, guess));
}

// Parse a distributive question like "5 x 27 = 5 x ( 20 + 7 ) = ..." into front / partA / partB.
// Bracket placeholders ("[ ]", "___") are kept as-is so the student sees blanks to fill.
function parseEquation(question: string, fallbackFront: string): EquationShape {
  const text = String(question || "");
  const front = text.match(/^\s*(\d{1,3})\s*(?:x|×)/i)?.[1] || fallbackFront;
  const inside = text.match(/\(\s*([^)]+?)\s*\)/)?.[1] || "";
  const parts = inside.split("+").map((part) => part.trim());
  const isBlank = (value: string) => value === "" || /^(\[\s*\]|_+)$/.test(value);
  const partA = parts[0] && !isBlank(parts[0]) ? parts[0] : "[   ]";
  const partB = parts[1] && !isBlank(parts[1]) ? parts[1] : "[   ]";
  return { front, partA, partB, note: "" };
}

export function stepScreenData(step: ScreenStepInput): ScreenStepData {
  const dims = parseDimensions(step.mainDisplay, step.question);
  const rows = dims?.rows ?? 6;
  const cols = dims?.cols ?? 10;
  const front = String(step.mainDisplay || step.question || "").match(/^\s*(\d{1,3})\s*(?:x|×)/i)?.[1]
    || String(rows);
  return {
    order: step.order,
    duration: step.duration,
    title: step.title,
    stateId: step.stateId,
    mainDisplay: step.mainDisplay || "",
    screenNotes: step.screenNotes || "",
    paceDirections: step.paceDirections || "",
    studentDirections: step.studentDirections || "",
    vocabulary: step.vocabulary || "",
    question: step.question || "",
    responseMode: step.responseMode || "",
    hasModel: Boolean(dims),
    hasEquation: /\(/.test(step.question || "") || /=\s*\d+\s*x/i.test(step.question || ""),
    model: {
      rows,
      cols,
      split: suggestedSplit(cols),
      leftLabel: "",
      rightLabel: "",
      title: dims ? `${rows} x ${cols}` : "Area model",
      hint: dims ? "Drag the line" : "Set rows and columns",
    },
    equation: parseEquation(step.question, front),
  };
}

export function mmss(minutes: number): string {
  const safe = Number.isFinite(minutes) ? minutes : 0;
  const whole = Math.floor(safe);
  const seconds = Math.round((safe - whole) * 60);
  return `${whole}:${String(seconds).padStart(2, "0")}`;
}

// The auto (Notion) value for a component field. An override in a block's `ov` map wins over this.
export function autoScreenValue(data: ScreenStepData, key: string): string {
  const { model, equation } = data;
  const map: Record<string, string | number> = {
    mainDisplay: data.mainDisplay,
    screenNotes: data.screenNotes,
    paceDirections: data.paceDirections,
    studentDirections: data.studentDirections,
    vocabulary: data.vocabulary,
    time: mmss(data.duration),
    timerLabel: data.responseMode || "On task",
    doThisTitle: "Do this",
    supportTitle: data.vocabulary ? "Words we are using" : "Support",
    legendTitle: "Color coding",
    modelTitle: model.title,
    modelHint: model.hint,
    rows: model.rows,
    cols: model.cols,
    split: model.split,
    leftLabel: model.leftLabel,
    rightLabel: model.rightLabel,
    front: equation.front,
    partA: equation.partA,
    partB: equation.partB,
    equationNote: equation.note,
  };
  const value = map[key];
  return value === undefined || value === null ? "" : String(value);
}

export function resolveScreenValue(data: ScreenStepData, block: ScreenBlock, key: string): string {
  const override = block.ov[key];
  return override !== undefined ? override : autoScreenValue(data, key);
}

// ---- Default layout derivation -----------------------------------------------------------------

// The zone/component arrangement a screen falls back to when the teacher has not customized it.
// A step with no content yields the same shape with empty text - a valid blank template.
export function defaultZoneTypes(data: ScreenStepData, screen: ScreenKey): ScreenComponentType[][] {
  if (screen === "main") {
    if (data.hasModel) return [["model"], data.hasEquation ? ["prompt", "equation"] : ["prompt", "text"]];
    if (data.hasEquation) return [["prompt", "equation"], []];
    return [["prompt", "text"], []];
  }
  if (screen === "pace") {
    return [["doThis"], data.vocabulary ? ["timer", "support"] : ["timer"]];
  }
  const left: ScreenComponentType[] = ["prompt"];
  left.push(data.hasEquation ? "equation" : "callout");
  return [left, data.hasModel ? ["model"] : []];
}

let blockSeq = 0;
function nextBlockId(): string {
  blockSeq += 1;
  return `b${blockSeq}`;
}

export function defaultZones(data: ScreenStepData, screen: ScreenKey): ScreenZones {
  return defaultZoneTypes(data, screen).map((types) =>
    types.map((type) => ({ id: nextBlockId(), type, ov: {} })),
  );
}

// Wire signature of a screen's zones, ignoring runtime ids, used to tell a customized screen from
// one still on its default (so save only persists real changes and "reset to auto" is free).
function zoneSignature(zones: ScreenZones): string {
  return JSON.stringify(
    zones.map((zone) =>
      zone.map((block) => {
        const keys = Object.keys(block.ov).sort();
        return [block.type, keys.map((key) => [key, block.ov[key]])];
      }),
    ),
  );
}

export function zonesMatchDefault(data: ScreenStepData, screen: ScreenKey, zones: ScreenZones): boolean {
  return zoneSignature(zones) === zoneSignature(defaultZones(data, screen));
}

// Build the persistable layout for one step: only the screens that differ from their derived
// default are included, so the blob stays small and a reset screen simply drops out.
export function persistableLayout(
  data: ScreenStepData,
  materialized: Partial<Record<ScreenKey, ScreenZones>>,
): StepScreenLayout {
  const layout: StepScreenLayout = {};
  for (const screen of SCREEN_KEYS) {
    const zones = materialized[screen];
    if (!zones) continue;
    if (zonesMatchDefault(data, screen, zones)) continue;
    layout[screen] = zones;
  }
  return layout;
}
