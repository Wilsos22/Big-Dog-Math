// Board logic for /weekly-display - the two all-day TVs in the back of the room.
//
// This holds every pure decision the board makes so the surface itself stays a
// renderer: the day palettes, the rotation clock, how a learning intention is
// cut into tokens so the key term can be highlighted and then travel, and how
// the Notion "Discussion Vocabulary" text becomes a term, a definition and an
// optional worked-example figure.
//
// Lives in src/lib because an App Router page.tsx may only export the default
// component plus the fixed config exports - exporting a helper from the page
// fails the build.

export const WEEKDAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

export const SCREEN_KEYS = ["learning", "success", "week", "bells"] as const;
export type ScreenKey = (typeof SCREEN_KEYS)[number];

export const SCREEN_LABELS: Record<ScreenKey, string> = {
  learning: "Learning intention",
  success: "Success criteria",
  week: "Weekly schedule",
  bells: "Bell schedule",
};

// Board neutrals. Warm ink and warm paper, matching the --bdb-* palette.
export const BOARD_INK = "#201E1A";
export const BOARD_PAPER = "#F6F3EC";
export const BOARD_CREAM = "#E4DFD5";
export const BOARD_LINE = "#DBD5C9";
export const BOARD_MUTED = "#4A453E";
export const BOARD_FAINT = "#8A8378";
export const BOARD_WHITE = "#FFFFFF";

export interface DayPalette {
  /** The bright hue: decorative fills, rails, the Today pill, the bells ground. */
  accent: string;
  /** The dark companion: anything carrying paper-white text, plus the highlighter. */
  deep: string;
  /** The wash: the learning-intention ground. */
  tint: string;
}

// One hue per teaching day, drawn from the design-system flat accents (amber,
// green, orange, violet, teal). Every `deep` is dark enough to carry
// BOARD_PAPER text at AA, and every ground pairs with BOARD_INK - the pairs
// that fail (white on bright teal/green) are never used together here.
export const DAY_PALETTES: Record<WeekdayKey, DayPalette> = {
  monday: { accent: "#FCAF38", deep: "#9C6310", tint: "#FDEAC2" },
  tuesday: { accent: "#2E9E5A", deep: "#155A33", tint: "#DAEEDF" },
  wednesday: { accent: "#F2820C", deep: "#8F4A07", tint: "#FCE6CC" },
  thursday: { accent: "#845BC9", deep: "#4E2F86", tint: "#E4DAF6" },
  friday: { accent: "#50A3A4", deep: "#256364", tint: "#D7EBEB" },
};

// The reveal timeline, in seconds from the moment a learning-intention frame
// lands. Read it top to bottom: the sentence wipes in, the highlighter sweeps
// the key term, the verbs pulse, then everything except the term drops away
// while the term pans up and the definition and example populate around it.
export const BOARD_TIMING = {
  exitMs: 500,
  typeStart: 0.28,
  typeDuration: 1.05,
  highlightStart: 1.45,
  highlightDuration: 0.85,
  verbPulseStart: 2.5,
  verbPulseStagger: 0.42,
  dropStart: 5.4,
  dropStagger: 0.022,
  travelDuration: 3.2,
  auraDelay: 0.8,
  definitionDelay: 1.35,
  figureDelay: 1.95,
} as const;

/** Seconds a screen holds before the rotation advances. */
export function dwellSeconds(screen: ScreenKey, baseSeconds: number, revealing: boolean): number {
  const base = Math.max(4, baseSeconds);
  // The learning screen has to outlast its own reveal - the term does not even
  // finish travelling until dropStart + travelDuration - or the board cuts away
  // mid-definition.
  if (screen === "learning" && revealing) return Math.max(16, base + 6);
  return base;
}

export const BOARD_ACTION_VERBS = new Set([
  "analyze", "apply", "build", "calculate", "check", "choose", "classify", "compare", "construct",
  "convert", "create", "define", "demonstrate", "describe", "determine", "divide", "estimate",
  "evaluate", "explain", "find", "graph", "identify", "interpret", "justify", "measure", "model",
  "multiply", "plot", "prove", "read", "reason", "represent", "scale", "show", "simplify", "solve",
  "use", "verify", "write",
]);

function normalizeWord(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * THE FRAMING IS FIXED (Steele, 2026-07-29): the learning intention reads
 * "I am learning to ...", the success criteria read "I can ...". That is the
 * standard pairing - the intention names what we are working toward, the
 * criteria are what a student checks their own finished work against - and the
 * two must not be phrased alike or the second screen looks like a restatement
 * of the first.
 *
 * Notion authors the intention as "I can ...", so this restems it. Anything
 * already stemmed correctly is left alone.
 */
export const LEARNING_INTENTION_STEM = "I am learning to";

export function learningIntentionStatement(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const body = trimmed
    .replace(/^\s*(?:I|we|you)\s+(?:can|will|could|should|am\s+learning\s+to|are\s+learning\s+to)\s+/i, "")
    .replace(/^\s*students\s+will\s+(?:be\s+able\s+to\s+)?/i, "")
    .replace(/^\s*(?:today\s+)?(?:we\s+are\s+)?learning\s+(?:how\s+)?to\s+/i, "")
    .trim();
  if (!body) return trimmed;
  // Only lower-case a leading capital that is there because it started the
  // sentence - never one that belongs to the word ("I", "GCF", "Pythagoras").
  const head = /^[A-Z][a-z]/.test(body) ? body.charAt(0).toLocaleLowerCase() + body.slice(1) : body;
  return `${LEARNING_INTENTION_STEM} ${head}`;
}

export interface VocabularyEntry {
  term: string;
  definition: string;
}

export type BoardFigure =
  | { kind: "table"; rows: { label: string; cells: string[]; highlight: number }[] }
  | { kind: "lines"; lines: { label: string; ticks: string[] }[] }
  | { kind: "grid"; shaded: number; caption: string }
  | { kind: "blocks"; blocks: string[] }
  | { kind: "steps"; steps: string[] }
  | { kind: "text"; text: string };

export interface BoardVocabulary {
  entries: VocabularyEntry[];
  figure: BoardFigure | null;
}

interface LabelledRow {
  label: string;
  cells: string[];
  /** Index of the cell drawn as the answer. Defaults to the last one. */
  highlight: number;
}

/**
 * "Cups = 3, 6, *9" - one row, three cells, the third one marked as the answer.
 * Without a marker the last cell is the answer, which is how a ratio table
 * reads; the marker exists because a list of factors ends at the number itself
 * and the thing worth pointing at is somewhere in the middle.
 */
function labelledRows(value: string): LabelledRow[] {
  return value
    .split("|")
    .map((part) => {
      const [label, cells] = part.split("=");
      if (!cells) return null;
      const raw = cells.split(",").map((cell) => cell.trim()).filter(Boolean);
      if (!label.trim() || !raw.length) return null;
      const marked = raw.findIndex((cell) => cell.startsWith("*"));
      return {
        label: label.trim(),
        cells: raw.map((cell) => cell.replace(/^\*/, "").trim()),
        highlight: marked >= 0 ? marked : raw.length - 1,
      };
    })
    .filter((row): row is LabelledRow => row !== null);
}

/**
 * An optional worked example for the vocabulary reveal, authored as one more
 * line in the SAME Discussion Vocabulary property - no new Notion column. Each
 * form fails safe: a line that does not parse is simply not a figure.
 *
 *   table: Cups = 3, 6, 9 | Scoops = 2, 4, 6
 *   lines: Miles = 0, 4, 8, 12 | Hours = 0, 1, 2, 3
 *   grid: 45 | 45 of 100 = 0.45
 *   rate: $4.50 for 3 lb -> $1.50 per 1 lb
 *   steps: Name the strategy | Show the steps | Check it is reasonable
 *   example: Estimate first, then compare it to your answer.
 */
export function parseBoardFigure(line: string): BoardFigure | null {
  const match = line.match(/^\s*(table|lines|grid|rate|steps|example)\s*:\s*(.+)$/i);
  if (!match) return null;
  const kind = match[1].toLowerCase();
  const body = match[2].trim();
  if (!body) return null;

  if (kind === "table") {
    const rows = labelledRows(body);
    return rows.length ? { kind: "table", rows } : null;
  }
  if (kind === "lines") {
    const rows = labelledRows(body);
    return rows.length ? { kind: "lines", lines: rows.map((row) => ({ label: row.label, ticks: row.cells })) } : null;
  }
  if (kind === "grid") {
    const [count, ...rest] = body.split("|");
    const shaded = Number(count.trim().replace(/[^0-9]/g, ""));
    if (!Number.isFinite(shaded) || shaded < 0 || shaded > 100) return null;
    return { kind: "grid", shaded, caption: rest.join("|").trim() || `${shaded} of 100` };
  }
  if (kind === "rate") {
    const blocks = body.split(/->|→/).map((block) => block.trim()).filter(Boolean);
    return blocks.length >= 2 ? { kind: "blocks", blocks } : { kind: "text", text: body };
  }
  if (kind === "steps") {
    const steps = body.split("|").map((step) => step.trim()).filter(Boolean);
    return steps.length ? { kind: "steps", steps } : null;
  }
  return { kind: "text", text: body };
}

/**
 * Reads the Notion "Discussion Vocabulary" text. Terms split on newlines and
 * semicolons only - NOT commas the way splitLiveFlowVocabulary does, because a
 * definition is a sentence and commas would shred it.
 *
 * A term carries its definition after a dash: "Ratio table - a table of
 * equivalent ratios." That is the same convention /teacher/pace already reads,
 * so nothing new has to be authored for the vocabulary cards and this board to
 * agree.
 */
export function readBoardVocabulary(raw: string): BoardVocabulary {
  let figure: BoardFigure | null = null;
  const entries: VocabularyEntry[] = [];

  for (const line of (raw || "").split(/[\n;]+/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parsed = parseBoardFigure(trimmed);
    if (parsed) {
      figure = figure ?? parsed;
      continue;
    }
    const split = trimmed.match(/^(.{1,48}?)\s+[-–—:]\s+(.+)$/);
    entries.push(split
      ? { term: split[1].trim(), definition: split[2].trim() }
      : { term: trimmed, definition: "" });
  }

  return { entries, figure };
}

export interface PhraseMatch {
  start: number;
  length: number;
}

/**
 * Where a term sits inside the learning intention. Tolerates a plural in the
 * sentence against a singular term ("ratio tables" for "Ratio table"), because
 * that is how the two fields are actually written.
 */
export function findPhrase(text: string, term: string): PhraseMatch | null {
  const cleaned = term.trim().replace(/\s+/g, " ");
  if (!cleaned) return null;
  const words = cleaned.split(" ").map((word) => word.replace(/[^\p{L}\p{N}]/gu, ""));
  if (words.some((word) => !word)) return null;
  const last = words[words.length - 1];
  const head = words.slice(0, -1).map(escapeRegExp);
  // The final word may pick up or drop an -s/-es between the two fields: the
  // vocabulary says "Ratio table" and the sentence says "ratio tables". Both
  // strippings of a word ending in -es are plausible ("lines" -> "line" or
  // "lin"), so try each, and never strip down to a stub that would match a
  // different word.
  const stems = new Set([last]);
  if (last.length > 3 && /s$/i.test(last)) stems.add(last.slice(0, -1));
  if (last.length > 4 && /es$/i.test(last)) stems.add(last.slice(0, -2));
  const forms = new Set<string>();
  for (const stem of stems) {
    forms.add(stem);
    forms.add(`${stem}s`);
    forms.add(`${stem}es`);
  }
  const tail = `(?:${[...forms].sort((a, b) => b.length - a.length).map(escapeRegExp).join("|")})`;
  const pattern = new RegExp(`\\b${[...head, tail].join("\\s+")}\\b`, "iu");
  const found = pattern.exec(text);
  return found ? { start: found.index, length: found[0].length } : null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface KeyTerm {
  term: string;
  definition: string;
  /** Where the term appears in the (already stripped) intention, if it does. */
  phrase: PhraseMatch | null;
}

/**
 * Picks the term the board will highlight and then lift out of the sentence.
 * Prefers a term that is BOTH defined and visible in the intention, because
 * that is the only combination the reveal can actually tell a story about;
 * longest match wins so "double number line" beats "line".
 */
export function selectKeyTerm(entries: VocabularyEntry[], intention: string): KeyTerm | null {
  if (!entries.length) return null;
  const scored = entries.map((entry) => {
    const phrase = findPhrase(intention, entry.term);
    return {
      entry,
      phrase,
      rank: (phrase ? 2 : 0) + (entry.definition ? 1 : 0),
      length: entry.term.length,
    };
  });
  scored.sort((left, right) => right.rank - left.rank || right.length - left.length);
  const best = scored[0];
  return { term: best.entry.term, definition: best.entry.definition, phrase: best.phrase };
}

export interface BoardToken {
  text: string;
  /** True for the single token holding the key term. */
  hit: boolean;
  index: number;
  verb: boolean;
}

/**
 * Cuts the intention into animatable pieces. The key term stays ONE token so
 * the highlighter sweeps it as a unit and it travels as a unit; everything else
 * becomes a word that can drop away independently.
 */
export function tokenizeIntention(text: string, phrase: PhraseMatch | null): BoardToken[] {
  const segments: { text: string; hit: boolean }[] = phrase
    ? [
      { text: text.slice(0, phrase.start), hit: false },
      { text: text.slice(phrase.start, phrase.start + phrase.length), hit: true },
      { text: text.slice(phrase.start + phrase.length), hit: false },
    ]
    : [{ text, hit: false }];

  const tokens: BoardToken[] = [];
  for (const segment of segments) {
    if (segment.hit) {
      const trimmed = segment.text.trim();
      if (trimmed) tokens.push({ text: trimmed, hit: true, index: tokens.length, verb: false });
      continue;
    }
    for (const word of segment.text.split(/\s+/)) {
      if (!word) continue;
      tokens.push({
        text: word,
        hit: false,
        index: tokens.length,
        verb: BOARD_ACTION_VERBS.has(normalizeWord(word)),
      });
    }
  }
  return tokens;
}

/** Starting type size for the intention. The board shrinks from here to fit. */
export function intentionMaxSize(text: string): number {
  if (text.length > 110) return 116;
  if (text.length > 86) return 124;
  return 138;
}

export function successSize(text: string): number {
  if (text.length > 108) return 88;
  if (text.length > 84) return 98;
  return 108;
}

/**
 * These boards are 55-inch 16:9 panels mounted at the back of the room, so the
 * stage's 1080 rows cover about 27 inches of real screen: one stage pixel is
 * roughly 0.025in. Reading comfortably at a distance D wants a cap height near
 * D/200, and a student on the far side of a classroom is ~25ft away - which
 * works out at about 85 stage px of font size.
 *
 * Only one to three success criteria can be set that large and still fit. That
 * is a CONTENT fact, not a layout bug: fewer, shorter criteria are readable
 * from the whole room, and a longer list is for the students nearer the panel.
 */
export const CRITERION_ROOM_LEGIBLE_PX = 85;

/**
 * The smallest a criterion may be shrunk to in order to fit. About 1in of type
 * on a 55-inch panel - readable from most of a classroom, not from the far
 * corner. Six long criteria fit at this floor; a longer list than that clips,
 * which is the deliberate end of the line rather than type nobody can read.
 */
export const CRITERION_FLOOR_PX = 38;

/**
 * The success screen carries however many criteria the lesson authored, so the
 * type and the check marks scale to the count and the longest line. One
 * criterion keeps the design's single hero statement exactly.
 */
/**
 * The starting type size for a list of criteria. The board then measures the
 * real rendered height and steps DOWN from here until the list fits - the same
 * autosize the learning intention uses, because a glyph-width estimate cannot
 * predict where a sentence wraps and a criterion sliding under the standard
 * chips on a classroom TV is not an acceptable failure.
 */
export function successStartSize(count: number): number {
  if (count <= 2) return 96;
  if (count === 3) return 84;
  if (count === 4) return 70;
  if (count === 5) return 60;
  return 52;
}

export function successGaps(count: number): { gap: number; rowGap: number } {
  return count > 4 ? { gap: 22, rowGap: 14 } : { gap: 30, rowGap: 26 };
}

/** How much the key term grows (or shrinks) once it is alone at the top. */
export function termTravelScale(fontSize: number): number {
  return Math.min(1.3, Math.max(0.72, 138 / Math.max(1, fontSize)));
}

export function padTwo(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

export function weekdayKeyFor(weekday: string): WeekdayKey {
  const normalized = weekday.trim().toLocaleLowerCase();
  return WEEKDAY_KEYS.includes(normalized as WeekdayKey) ? (normalized as WeekdayKey) : "monday";
}
