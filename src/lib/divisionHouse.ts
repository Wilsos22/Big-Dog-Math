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
  const firstDivisorSlot = "ds-0";

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

    prompts.push({
      id: `pick-partial-${i}`,
      kind: "slot",
      ask: i === 0
        ? "Start with the first number inside the house. Click it."
        : "Which number are we dividing now? Click it.",
      slots: partialSlots,
      fill: [],
      say: `We are dividing ${c.partial}.`,
      hint: i === 0
        ? "It is the first digit under the bracket, on the left."
        : "It is what was left over, with the digit you brought down beside it.",
      round: i,
    });
    prompts.push({
      id: `op-divide-${i}`,
      kind: "operation",
      ask: "What operation are we doing here?",
      op: "divide",
      fill: [],
      visual: { sign: "÷", from: partialSlot, to: firstDivisorSlot },
      say: "Divide.",
      hint: "We are asking how many times one number fits inside the other.",
      round: i,
    });
    prompts.push({
      id: `pick-divisor-${i}`,
      kind: "slot",
      ask: "Where is the number we are dividing WITH? Click it.",
      slots: [firstDivisorSlot],
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
      say: `${divisor} goes into ${c.partial} ${c.q} time${c.q === 1 ? "" : "s"}, and it goes up top.`,
      hint: "The answer to a division step goes above the bracket, over the digit you just used.",
      round: i,
    });

    prompts.push({
      id: `op-multiply-${i}`,
      kind: "operation",
      ask: "Now what operation?",
      op: "multiply",
      fill: [],
      say: "Multiply.",
      hint: "Next we find out how much of the number we just used up.",
      round: i,
    });
    prompts.push({
      id: `pick-mult-${i}`,
      kind: "slot",
      ask: "Multiply that answer by which spot? Click it.",
      slots: [firstDivisorSlot],
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
      say: `${c.product} goes under the number we divided.`,
      hint: "A product is written under the number it came out of, ready to be taken away.",
      round: i,
    });

    prompts.push({
      id: `op-subtract-${i}`,
      kind: "operation",
      ask: "What operation now?",
      op: "subtract",
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
        reason: divisor > dividend
          ? "the divisor is bigger than the dividend"
          : `whole numbers only, dividend up to ${HOUSE_MAX_DIVIDEND} and divisor up to 99`,
      });
      continue;
    }
    problems.push({ dividend, divisor });
    if (problems.length >= HOUSE_MAX_PROBLEMS) break;
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
