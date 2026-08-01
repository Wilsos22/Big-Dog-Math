// Fraction-ordering sets for the Number Line tool.
//
// One string - "1/2, 7/3, 2 1/4, 3" - travels the same three ways as the
// Distributive Area series (see lib/distributiveProblems): the ?set= URL param
// on /number-line-plus, the teacher's field in the /control tool setup, and the
// live_flow tool config broadcast to joined devices. A semicolon or a newline
// starts a new ROUND, so a teacher can queue several boards and students get
// one at a time.
//
// The line is 0 to 5 with a tick every half, positive numbers only. Students
// place each card by eye and are judged on TWO things, in this order: the cards
// read left to right in ascending order, and each one sits within half of the
// line (PLACEMENT_TOLERANCE) of where it truly lands. Ordering is the point;
// the tolerance only stops a card that is nowhere near right from passing on a
// lucky sequence. Equivalent cards (3/2 and 6/4) are a tie and may sit in
// either order - that is the whole reason to put both in a set.
//
// A card may be authored as a whole number, a proper or improper fraction, a
// mixed number, a decimal, or a percent. The compare-the-forms work wants all
// five on one line eventually; parsing them here costs nothing today and means
// switching a set over is a typing change, not a code change.

export type FractionCardKind = "whole" | "fraction" | "mixed" | "decimal" | "percent";

export interface FractionCard {
  /** Canonical authored text - unique within a round, so it doubles as the id. */
  id: string;
  kind: FractionCardKind;
  /** Where it truly lands on the line. */
  value: number;
  text: string;
  /** Whole part of a mixed number; 0 otherwise. */
  whole: number;
  /** Numerator / denominator for fraction and mixed cards; 0 / 1 otherwise. */
  num: number;
  den: number;
}

export const FRACTION_LINE_MIN = 0;
export const FRACTION_LINE_MAX = 5;
export const FRACTION_LINE_TICK = 0.5;

/**
 * How far off a card may sit and still count as placed.
 *
 * Half of the line, matching the tick spacing: a sixth grader eyeballing 7/3
 * between the 2 and the 2 1/2 marks is doing the thinking this tool is for, and
 * demanding pixel accuracy would fail them for the wrong reason. This is the
 * one dial - tighten it here and every surface follows.
 */
export const PLACEMENT_TOLERANCE = 0.5;

export const MAX_CARDS_PER_ROUND = 8;
export const MAX_FRACTION_ROUNDS = 8;
const MAX_DENOMINATOR = 100;

function cardFrom(
  kind: FractionCardKind,
  value: number,
  text: string,
  whole = 0,
  num = 0,
  den = 1,
): FractionCard | null {
  if (!Number.isFinite(value)) return null;
  if (value < FRACTION_LINE_MIN || value > FRACTION_LINE_MAX) return null;
  return { id: text, kind, value, text, whole, num, den };
}

/**
 * One card. Returns null for anything unreadable, negative, or off the line -
 * a bad chunk is skipped rather than failing the whole set, same as the other
 * set parsers.
 */
export function parseFractionCard(raw: string | null | undefined): FractionCard | null {
  if (!raw) return null;
  const t = raw.trim().replace(/\s+/g, " ");
  if (!t) return null;

  const percent = t.match(/^(\d+(?:\.\d+)?)\s*%$/);
  if (percent) {
    return cardFrom("percent", Number(percent[1]) / 100, `${percent[1]}%`);
  }

  // "2 1/4" and "2_1/4". A hyphen is deliberately NOT a separator: "2-1/4"
  // reads as subtraction to half the room, and this line is positive only.
  const mixed = t.match(/^(\d+)[\s_]+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    const whole = Number(mixed[1]);
    const num = Number(mixed[2]);
    const den = Number(mixed[3]);
    if (den <= 0 || den > MAX_DENOMINATOR) return null;
    return cardFrom("mixed", whole + num / den, `${whole} ${num}/${den}`, whole, num, den);
  }

  const fraction = t.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fraction) {
    const num = Number(fraction[1]);
    const den = Number(fraction[2]);
    if (den <= 0 || den > MAX_DENOMINATOR) return null;
    return cardFrom("fraction", num / den, `${num}/${den}`, 0, num, den);
  }

  const plain = t.match(/^(\d+(?:\.\d+)?)$/);
  if (plain) {
    const value = Number(plain[1]);
    return cardFrom(plain[1].includes(".") ? "decimal" : "whole", value, plain[1], Math.floor(value));
  }

  return null;
}

/**
 * Rounds separated by `;` or a newline, cards within a round by a comma.
 *
 * Duplicate TEXT inside a round is dropped - two identical cards make the
 * ordering unanswerable. Duplicate VALUE is kept: 3/2 beside 6/4 is the point
 * of a set, and the order check treats them as a tie.
 */
export function parseFractionRounds(raw: string | null | undefined): FractionCard[][] {
  if (!raw) return [];
  const rounds: FractionCard[][] = [];
  for (const line of raw.split(/[;\n]+/)) {
    const seen = new Set<string>();
    const cards: FractionCard[] = [];
    for (const chunk of line.split(",")) {
      const card = parseFractionCard(chunk);
      if (!card || seen.has(card.id)) continue;
      seen.add(card.id);
      cards.push(card);
      if (cards.length >= MAX_CARDS_PER_ROUND) break;
    }
    // One card cannot be put in order with anything, so it is not a round.
    if (cards.length < 2) continue;
    rounds.push(cards);
    if (rounds.length >= MAX_FRACTION_ROUNDS) break;
  }
  return rounds;
}

export function serializeFractionRounds(rounds: FractionCard[][]): string {
  return rounds.map((round) => round.map((c) => c.text).join(", ")).join("; ");
}

/** Round-trips whatever the teacher typed into the form stored on the session. */
export function normalizeFractionSet(raw: string | null | undefined): string {
  return serializeFractionRounds(parseFractionRounds(raw));
}

export interface Placement {
  id: string;
  value: number;
  /** Where the student put it, in line units. */
  position: number;
}

export interface OrderCheck {
  /** Left to right, every card reads in ascending order (ties allowed). */
  ordered: boolean;
  /** The smallest set of cards that must move to fix the order. */
  outOfPlace: string[];
  /** Cards further than PLACEMENT_TOLERANCE from where they truly land. */
  farOff: string[];
  /** Ordered AND every card inside the tolerance. */
  correct: boolean;
}

/**
 * Judge a board.
 *
 * The order verdict blames the SMALLEST set of cards that would fix it (the
 * complement of the longest non-decreasing run), not every card that happens to
 * sit beside a wrong one - a student who put one card in the wrong place should
 * be told to move one card.
 */
export function checkOrder(placed: Placement[]): OrderCheck {
  const seq = [...placed].sort((a, b) => a.position - b.position);
  const farOff = seq.filter((p) => Math.abs(p.position - p.value) > PLACEMENT_TOLERANCE).map((p) => p.id);

  if (seq.length < 2) {
    return { ordered: true, outOfPlace: [], farOff, correct: farOff.length === 0 };
  }

  const len = seq.map(() => 1);
  const prev = seq.map(() => -1);
  let best = 0;
  for (let i = 0; i < seq.length; i += 1) {
    for (let j = 0; j < i; j += 1) {
      if (seq[j].value <= seq[i].value && len[j] + 1 > len[i]) {
        len[i] = len[j] + 1;
        prev[i] = j;
      }
    }
    if (len[i] > len[best]) best = i;
  }

  const keep = new Set<number>();
  for (let i = best; i >= 0; i = prev[i]) keep.add(i);
  const outOfPlace = seq.filter((_, i) => !keep.has(i)).map((p) => p.id);

  return {
    ordered: outOfPlace.length === 0,
    outOfPlace,
    farOff,
    correct: outOfPlace.length === 0 && farOff.length === 0,
  };
}

/**
 * The built-in rounds, used when no teacher set is published.
 *
 * They climb: every card on a tick, then quarters, then thirds, then an
 * equivalent pair, then the four forms on one line - which is the compare
 * decimals-to-fractions-to-percents work, reachable today by typing a set.
 */
export const DEFAULT_FRACTION_SET = [
  "1/2, 2, 5/2, 7/2, 4",
  "3/4, 1 1/2, 9/4, 3, 15/4",
  "2/3, 4/3, 2 1/2, 8/3, 4 1/3",
  "5/6, 1 1/4, 3/2, 6/4, 17/5",
  "0.75, 1/2, 60%, 1 1/4, 250%",
].join("; ");
