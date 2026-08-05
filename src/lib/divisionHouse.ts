// The blank long-division house: a map of the algorithm, not the arithmetic.
//
// Steele's ask, and the reason it is its OWN tool rather than a mode of
// /decimal-steps: "there should be a blank long division house where students
// just have to click where the numbers are located and what operation they are
// doing there". The numbers are worked out FOR the student. What they supply is
// the choreography - which spot, then which operation, then where the answer
// lands - because knowing that 4 goes into 9 twice is useless if you cannot say
// where the 2 belongs.
//
// So the drill per round is exactly the sequence he described:
//   the number we are dividing -> divide -> the number we divide BY ->
//   where the answer goes -> multiply -> by which spot -> where that goes ->
//   subtract -> where that goes -> bring down -> which digit -> where it goes
// and then it resets for the next round.
//
// Pure, no React. The board geometry is a single grid so the component can draw
// the animated ÷ / x / − / arrow between any two slots by their row and column.
//
// EVERY ROUND TRACES THE SAME SIX MOVES, and Steele named them by direction:
// "to the left, up, diagonal left, diagonal right, down, down".
//
//   1  ÷   the number we are dividing  ->  the divisor      (left)
//   2  =   the divisor                 ->  the quotient     (up)
//   3  x   the quotient                ->  the divisor      (diagonal left)
//   4  =   the divisor                 ->  the product      (diagonal right)
//   5  −   the number we are dividing  ->  the product      (down)
//   6      the product                 ->  the difference   (down, arrow alone)
//
// plus a bring-down arrow on every round but the last. "I want students to see
// the pathway the numbers take every time" - so the component keeps each round
// on the board in its own colour rather than clearing it. Dropping a `visual`
// from any of the six breaks a shape the student is being taught to expect.

export const HOUSE_MAX_DIVIDEND = 9999;
export const HOUSE_MAX_PROBLEMS = 12;

export type HouseRow = "quotient" | "dividend" | "divisor" | `work${number}` | `rest${number}`;

export type HouseOp = "divide" | "multiply" | "subtract" | "bringdown";

export const HOUSE_OPS: { op: HouseOp; label: string; sign: string }[] = [
  { op: "divide", label: "Divide", sign: "÷" },
  { op: "multiply", label: "Multiply", sign: "x" },
  { op: "subtract", label: "Subtract", sign: "−" },
  { op: "bringdown", label: "Bring down", sign: "↓" },
];

export interface HouseSlot {
  id: string;
  row: HouseRow;
  /** Grid row index, so the component can position without measuring. */
  rowIndex: number;
  col: number;
  text: string;
  /** Given from the start (the problem) rather than filled by clicking. */
  given: boolean;
}

export interface HousePrompt {
  id: string;
  /** `slot` wants a click on the board; `operation` wants one of the four. */
  kind: "slot" | "operation";
  ask: string;
  /**
   * The spots that answer a "slot" prompt. Clicking ANY of them counts, and
   * all of them light up together, because the number being pointed at is
   * often more than one digit - the leftover plus the digit brought down beside
   * it IS one number, and highlighting half of it teaches the wrong thing.
   */
  slots?: string[];
  /** The operation that must be chosen, for kind "operation". */
  op?: HouseOp;
  /**
   * The order the four operation buttons are offered in, for kind "operation".
   *
   * Fixed cycle order made "tap the leftmost unlit chip" answer every operation
   * question without reading it. The Divide / Multiply / Subtract / Bring down
   * STRIP stays in cycle order - that is the reference the drill is teaching -
   * but the buttons a student presses are seated.
   */
  options?: HouseOp[];
  /** Slots that get written in once this prompt is answered. */
  fill: string[];
  /** The sign to animate between two slots, and where it goes. */
  visual?: { sign: string; from: string; to: string };
  /** Said after the prompt is answered. */
  say: string;
  /** Said when they click or choose the wrong thing - a nudge, never the spot. */
  hint: string;
  /** Which round of divide/multiply/subtract/bring down this belongs to. */
  round: number;
}

export interface HouseTrace {
  dividend: number;
  divisor: number;
  headline: string;
  quotient: number;
  remainder: number;
  slots: HouseSlot[];
  prompts: HousePrompt[];
  columns: number;
  rows: number;
  /** How many grid columns the divisor occupies, left of the bracket. */
  divisorWidth: number;
  /** The column the house starts at - the bracket is drawn on its left edge. */
  houseCol: number;
}

interface Cycle {
  pos: number;
  partial: number;
  q: number;
  product: number;
  rest: number;
}

/**
 * Seat the four operation buttons.
 *
 * Deterministic on the seed so a re-render cannot reshuffle under a student
 * mid-question, and the seed carries the PROBLEM as well as the prompt so a set
 * does not teach its own button positions - the same lesson /decimal-steps
 * learned when every board seated `lineup` in the same slot.
 */
function seatOps(seed: string): HouseOp[] {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h ^ seed.charCodeAt(i)) >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
  }
  h = (h ^ (h >>> 16)) >>> 0;
  h = Math.imul(h, 2246822507) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 3266489909) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  const out = HOUSE_OPS.map((o) => o.op);
  for (let i = out.length - 1; i > 0; i -= 1) {
    h = (Math.imul(h, 1103515245) + 12345) >>> 0;
    const j = (h >>> 16) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Build the whole drill.
 *
 * Returns null for anything the house cannot draw - a divisor that does not fit
 * the dividend at all, or numbers outside classroom size. Refused loudly by the
 * caller rather than rendering a broken board.
 */
export function buildHouseTrace(dividend: number, divisor: number): HouseTrace | null {
  if (!Number.isInteger(dividend) || !Number.isInteger(divisor)) return null;
  if (divisor <= 0 || dividend <= 0) return null;
  if (dividend > HOUSE_MAX_DIVIDEND || divisor > 99) return null;
  if (divisor > dividend) return null;

  const digits = String(dividend).split("");
  const dsText = String(divisor);
  const divisorWidth = dsText.length;

  // Walk the algorithm. Nothing goes above the bracket until the divisor fits,
  // exactly as it is written by hand.
  const cycles: Cycle[] = [];
  let remainder = 0;
  let started = false;
  for (let i = 0; i < digits.length; i += 1) {
    const partial = remainder * 10 + Number(digits[i]);
    if (!started && partial < divisor) {
      remainder = partial;
      continue;
    }
    started = true;
    const q = Math.floor(partial / divisor);
    cycles.push({ pos: i, partial, q, product: q * divisor, rest: partial - q * divisor });
    remainder = partial - q * divisor;
  }
  if (!cycles.length) return null;

  // Grid: divisor on the left, then a CLEAR GUTTER COLUMN, then the dividend.
  // The gutter is not decoration - the divide and multiply signs and their
  // arrows live in it, and without it they pile on top of the digits.
  const GUTTER = 1;
  const houseCol = divisorWidth + GUTTER;
  const columns = houseCol + digits.length;
  const dividendCol = (i: number) => houseCol + i;

  const slots: HouseSlot[] = [];
  let rowIndex = 0;
  const QUOTIENT_ROW = rowIndex++;
  const DIVIDEND_ROW = rowIndex++;

  cycles.forEach((c) => {
    slots.push({
      id: `q-${c.pos}`,
      row: "quotient",
      rowIndex: QUOTIENT_ROW,
      col: dividendCol(c.pos),
      text: String(c.q),
      given: false,
    });
  });
  digits.forEach((ch, i) => {
    slots.push({ id: `dv-${i}`, row: "dividend", rowIndex: DIVIDEND_ROW, col: dividendCol(i), text: ch, given: true });
  });
  dsText.split("").forEach((ch, i) => {
    slots.push({ id: `ds-${i}`, row: "divisor", rowIndex: DIVIDEND_ROW, col: i, text: ch, given: true });
  });

  const rowOf: Record<string, number> = {};
  cycles.forEach((c, i) => {
    const workRow = rowIndex++;
    const restRow = rowIndex++;
    rowOf[`work${i}`] = workRow;
    rowOf[`rest${i}`] = restRow;
    const product = String(c.product);
    product.split("").forEach((ch, k) => {
      slots.push({
        id: `w${i}-${k}`,
        row: `work${i}` as HouseRow,
        rowIndex: workRow,
        col: dividendCol(c.pos) - product.length + 1 + k,
        text: ch,
        given: false,
      });
    });
    const rest = String(c.rest);
    rest.split("").forEach((ch, k) => {
      slots.push({
        id: `r${i}-${k}`,
        row: `rest${i}` as HouseRow,
        rowIndex: restRow,
        col: dividendCol(c.pos) - rest.length + 1 + k,
        text: ch,
        given: false,
      });
    });
    if (i < cycles.length - 1) {
      slots.push({
        id: `bd${i}`,
        row: `rest${i}` as HouseRow,
        rowIndex: restRow,
        col: dividendCol(cycles[i + 1].pos),
        text: digits[cycles[i + 1].pos],
        given: false,
      });
    }
  });

  // ── the prompts ───────────────────────────────────────────────────────────
  const prompts: HousePrompt[] = [];
  // EVERY DIGIT OF THE DIVISOR, not just the first.
  //
  // The divisor is laid one digit per cell and every cell is a live button, so
  // on 144 / 12 a student who tapped the 2 - which IS the divisor - was told
  // "It sits outside the house, on the left." The pulse lit only the 1, which
  // also presented "12" as though the 1 were a number on its own. That inverts
  // the rule this tool is built on: a multi-digit number is ONE number, which
  // is why a prompt carries `slots: string[]` and not a single id.
  const divisorSlots = dsText.split("").map((_, i) => `ds-${i}`);
  const firstDivisorSlot = divisorSlots[0];
  const signature = `${dividend}/${divisor}`;

  cycles.forEach((c, i) => {
    const qSlot = `q-${c.pos}`;
    const productIds = String(c.product).split("").map((_, k) => `w${i}-${k}`);
    const restIds = String(c.rest).split("").map((_, k) => `r${i}-${k}`);
    // What the student is dividing INTO, as ALL of its digits: the dividend
    // digits used so far on round one, and after that the leftover together
    // with the digit brought down beside it.
    const partialSlots = i === 0
      ? Array.from({ length: c.pos + 1 }, (_, k) => `dv-${k}`)
      : [
        ...String(cycles[i - 1].rest).split("").map((_, k) => `r${i - 1}-${k}`),
        `bd${i - 1}`,
      ];
    const partialSlot = partialSlots[0];

    // ROUND ZERO WHEN THE DIVISOR DOES NOT FIT THE FIRST DIGIT is the single
    // most important case in the whole drill, and it used to be the one nothing
    // said out loud: 138 / 6 pulsed two cells under an ask that said "the first
    // number" and a hint that said "the first digit", and the reason - 6 does
    // not go into 1, so we take 13 - appeared nowhere.
    const takesExtraDigits = i === 0 && c.pos > 0;
    prompts.push({
      id: `pick-partial-${i}`,
      kind: "slot",
      ask: takesExtraDigits
        ? `${divisor} does not fit into the first digit. Click the smallest number at the front of the house that it does fit into.`
        : i === 0
          // "the one closest to the door" is the pop-out's wording too, so the
          // card that opens the problem and the rail that carries it agree. The
          // qualifier only holds in THIS branch - when the divisor does not fit
          // the first digit the answer is two cells wide and the nearest one is
          // the wrong click, which is why the other ask says something else.
          ? "Start with the first number inside the house - the one closest to the door. Click it."
          : "Which number are we dividing now? Click it.",
      slots: partialSlots,
      fill: [],
      // NOT "We are dividing 13" - the very next prompt asks what operation we
      // are doing, and the rail keeps the previous sentence on screen while it
      // asks. The question was answering itself, every round of every problem.
      say: `${c.partial} is the number under the bracket now.`,
      hint: takesExtraDigits
        ? `${divisor} is bigger than ${digits[0]}, so one digit is not enough. Take the next one with it and click any part of that number.`
        : i === 0
          ? "It is the first digit under the bracket, on the left."
          : "It is what was left over, with the digit you brought down beside it.",
      round: i,
    });
    prompts.push({
      id: `op-divide-${i}`,
      kind: "operation",
      ask: "What operation are we doing here?",
      op: "divide",
      options: seatOps(`op-divide-${i}@${signature}`),
      fill: [],
      visual: { sign: "÷", from: partialSlot, to: firstDivisorSlot },
      say: "Divide.",
      hint: "We are asking how many times one number fits inside the other.",
      round: i,
    });
    prompts.push({
      id: `pick-divisor-${i}`,
      kind: "slot",
      // "dividing by not with" (Steele, 2026-08-03). You divide BY a number.
      // "Dividing with" is not how the operation is said, and this ask is a
      // sentence sixth graders repeat back - the `say` under it already said
      // "Dividing by 4", so the tool was teaching both at once.
      ask: "Where is the number we are dividing BY? Click it.",
      slots: divisorSlots,
      fill: [],
      say: `Dividing by ${divisor}.`,
      hint: "It sits outside the house, on the left.",
      round: i,
    });
    prompts.push({
      id: `place-quotient-${i}`,
      kind: "slot",
      ask: "Where does that answer go? Click the spot.",
      slots: [qSlot],
      fill: [qSlot],
      // Move 2 of the six. The divisor is where the answer CAME FROM, so the
      // equals runs from it up to the quotient - "4 goes into 9 twice, and the
      // 2 lives up here". Without it the board drew the question (9 ÷ 4) and
      // never drew the answer arriving.
      visual: { sign: "=", from: firstDivisorSlot, to: qSlot },
      // Two numerals with only a space between them read as one: "4 goes into
      // 9 2 times", and on a zero quotient "3 goes into 1 0 times", which a
      // sixth grader reads as "3 goes into 10 times".
      say: `${c.partial} ÷ ${divisor} = ${c.q}, and the ${c.q} goes up top.`,
      hint: "The answer to a division step goes above the bracket, over the digit you just used.",
      round: i,
    });

    prompts.push({
      id: `op-multiply-${i}`,
      kind: "operation",
      ask: "Now what operation?",
      op: "multiply",
      options: seatOps(`op-multiply-${i}@${signature}`),
      fill: [],
      say: "Multiply.",
      hint: "Next we find out how much of the number we just used up.",
      round: i,
    });
    prompts.push({
      id: `pick-mult-${i}`,
      kind: "slot",
      ask: "Multiply that answer by which spot? Click it.",
      slots: divisorSlots,
      fill: [],
      visual: { sign: "x", from: qSlot, to: firstDivisorSlot },
      say: `${c.q} x ${divisor} = ${c.product}.`,
      hint: "You multiply the digit you just wrote by the number outside the house.",
      round: i,
    });
    prompts.push({
      id: `place-product-${i}`,
      kind: "slot",
      ask: "Where does that answer go? Click the spot.",
      slots: productIds,
      fill: productIds,
      // Move 4. Steele: "there should be an = and arrow between 4 and 8" - the
      // multiply arrow already ran quotient -> divisor, and this is the other
      // half of the same sentence, the product landing under the house.
      visual: { sign: "=", from: firstDivisorSlot, to: productIds[0] },
      say: `${c.product} goes under the number we divided.`,
      hint: "A product is written under the number it came out of, ready to be taken away.",
      round: i,
    });

    prompts.push({
      id: `op-subtract-${i}`,
      kind: "operation",
      ask: "What operation now?",
      op: "subtract",
      options: seatOps(`op-subtract-${i}@${signature}`),
      fill: [],
      visual: { sign: "−", from: partialSlot, to: productIds[0] },
      say: "Subtract.",
      hint: "We take away the part we have already divided up.",
      round: i,
    });
    prompts.push({
      id: `place-rest-${i}`,
      kind: "slot",
      ask: "Where does that answer go? Click the spot.",
      slots: restIds,
      fill: restIds,
      // Move 6, the second "down". ANCHORED ON THE LAST DIGIT OF EACH, not the
      // first: the product and the difference are both right-aligned under the
      // number being divided, so last-to-last is a true vertical drop while
      // first-to-first slants whenever they are different widths.
      // EMPTY SIGN MEANS THE ARROW ALONE - the minus sign and its rule are
      // already sitting beside these two numbers, so a glyph here would be the
      // third mark saying the same thing. Same call the bring-down arrow makes.
      visual: { sign: "", from: productIds[productIds.length - 1], to: restIds[restIds.length - 1] },
      say: `${c.partial} − ${c.product} = ${c.rest}.`,
      hint: "A difference is written underneath the numbers you subtracted.",
      round: i,
    });

    if (i < cycles.length - 1) {
      const next = cycles[i + 1];
      prompts.push({
        id: `op-bring-${i}`,
        kind: "operation",
        ask: "What is the next step?",
        op: "bringdown",
        options: seatOps(`op-bring-${i}@${signature}`),
        fill: [],
        say: "Bring down.",
        hint: "There are still digits under the bracket that have not been divided.",
        round: i,
      });
      prompts.push({
        id: `pick-bring-${i}`,
        kind: "slot",
        ask: "Which number do we bring down? Click it.",
        slots: [`dv-${next.pos}`],
        fill: [],
        say: `Bring down the ${digits[next.pos]}.`,
        hint: "The next digit under the bracket that has not been used yet.",
        round: i,
      });
      prompts.push({
        id: `place-bring-${i}`,
        kind: "slot",
        ask: "Where does it go? Click the spot.",
        slots: [`bd${i}`],
        fill: [`bd${i}`],
        visual: { sign: "↓", from: `dv-${next.pos}`, to: `bd${i}` },
        say: `It lands beside the ${c.rest}, and now we start again.`,
        hint: "It comes straight down and sits next to what was left over.",
        round: i,
      });
    }
  });

  const last = cycles[cycles.length - 1];
  const quotient = Number(cycles.map((c) => c.q).join(""));
  return {
    dividend,
    divisor,
    headline: `${dividend} ÷ ${divisor}`,
    quotient,
    remainder: last.rest,
    slots,
    prompts,
    columns,
    rows: rowIndex,
    divisorWidth,
    houseCol,
  };
}

// ── the problem-set format ──────────────────────────────────────────────────

export interface HouseSetParse {
  problems: { dividend: number; divisor: number }[];
  rejected: { text: string; reason: string }[];
}

/**
 * "96/4, 738/6" - the same shape as every other teacher-set series, and a
 * problem the house cannot draw is REPORTED rather than dropped.
 */
export function parseHouseSet(raw: string | null | undefined): HouseSetParse {
  const problems: { dividend: number; divisor: number }[] = [];
  const rejected: { text: string; reason: string }[] = [];
  if (!raw) return { problems, rejected };
  for (const chunk of raw.split(/[,;\n]+/)) {
    const text = chunk.trim();
    if (!text) continue;
    const m = text.match(/^(\d+)\s*[/÷]\s*(\d+)$/);
    if (!m) {
      rejected.push({ text, reason: "not a problem like 96/4" });
      continue;
    }
    const dividend = Number(m[1]);
    const divisor = Number(m[2]);
    if (!buildHouseTrace(dividend, divisor)) {
      rejected.push({
        text,
        reason: divisor === 0 || dividend === 0
          ? "nothing can be divided by zero, and zero has nothing to divide"
          : divisor > dividend
            ? "the divisor is bigger than the dividend"
            : `whole numbers only, dividend up to ${HOUSE_MAX_DIVIDEND} and divisor up to 99`,
      });
      continue;
    }
    // Past the ceiling the extras are REPORTED, not silently dropped - a
    // teacher who pastes fifteen problems and reads "12 problems." has no way
    // to know which three went missing or why.
    if (problems.length >= HOUSE_MAX_PROBLEMS) {
      rejected.push({ text, reason: `only the first ${HOUSE_MAX_PROBLEMS} problems run in one set` });
      continue;
    }
    problems.push({ dividend, divisor });
  }
  return { problems, rejected };
}

export function serializeHouseSet(problems: { dividend: number; divisor: number }[]): string {
  return problems.map((p) => `${p.dividend}/${p.divisor}`).join(", ");
}

export function normalizeHouseSet(raw: string | null | undefined): string {
  return serializeHouseSet(parseHouseSet(raw).problems);
}

/** Climbs: one round, then two, then a zero in the quotient, then a remainder. */
export const DEFAULT_HOUSE_SET = "96/4, 738/6, 618/6, 875/4";
