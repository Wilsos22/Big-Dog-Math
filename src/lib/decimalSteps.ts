// The guided decimal engine: one problem in, an ordered list of moves out.
//
// v2, rebuilt from Steele's twenty toolbar comments on /decimal-steps. The
// shape that changed: a step is no longer always a multiple choice. Students
// now TYPE the arithmetic and only CHOOSE on the decisions, because picking
// "9 + 7 = 16" off a list is recognition, not computation. Three kinds:
//   choice - the decisions (which rule, what to do with a carry, what next)
//   input  - a number the student works out and types
//   move   - the student physically drags a decimal point across places
//
// The set-up question is still the point of the tool and its answer still
// DIFFERS BY OPERATION - the misconception it exists to catch:
//   +  and  -   line up by the decimal point
//   x           line up the right edges and ignore the decimals until the end
//   /           neither; move the decimal until the divisor is whole
//
// Multiplication is digit by digit ("we can only multiply two numbers at once,
// so we start with the 4 and the 2"), not a row at a time. Division asks how
// many times the divisor goes in "without going over", in those words.
//
// This module is pure and holds no React. It computes on integers scaled by a
// power of ten - never on floats - so 0.1 + 0.2 is 0.3 here and the boards
// cannot drift.

export type DecimalOp = "+" | "-" | "x" | "/";

export const DECIMAL_MAX_INT_DIGITS = 4;
export const DECIMAL_MAX_PLACES = 3;
export const DECIMAL_MAX_PROBLEMS = 12;
/** A quotient that never terminates cannot be walked, so a set is refused. */
export const DECIMAL_MAX_QUOTIENT_PLACES = 3;
/**
 * A walk longer than this is not a lesson, it is an endurance test - and the
 * board is unusable past nine columns on a Chromebook. Both are inside the
 * documented input range, so the ceiling has to be its own refusal.
 */
export const DECIMAL_MAX_STEPS = 40;
export const DECIMAL_MAX_COLUMNS = 9;

/** A decimal literal, held exactly: value = int / 10^places. */
export interface Dec {
  text: string;
  int: number;
  places: number;
}

export interface DecimalProblem {
  a: Dec;
  b: Dec;
  op: DecimalOp;
}

export type DecimalLayout = "column" | "product" | "house";

export type DecimalRow =
  | "carry"
  /** Carries for the addition of the PARTIAL rows, which sit lower down. */
  | "sumcarry"
  | "regroup"
  | "a"
  | "b"
  | "rule"
  | "sum"
  | "quotient"
  | "dividend"
  | "divisor"
  | `work${number}`
  | `rest${number}`
  | `part${number}`;

export interface DecCell {
  id: string;
  row: DecimalRow;
  col: number;
  text: string;
  /** `carrybox` is the small square a student writes a carried digit into. */
  kind: "digit" | "dot" | "pad" | "carrybox" | "op";
}

/**
 * A decimal point that is not part of the digit grid.
 *
 * `boundary` is the gap it sits in: boundary N means "just left of column N".
 * Product boards float every point this way (the operands' points are ignored
 * during the multiply), and division boards do it because the points MOVE.
 */
export interface DecMarker {
  id: string;
  row: DecimalRow;
  boundary: number;
  muted: boolean;
}

export interface DecChoice {
  text: string;
  correct: boolean;
  /** Shown when this choice is picked - the reason, never just "wrong". */
  why: string;
}

/** A number the student works out and types. */
export interface DecInput {
  /** The exact string expected, unless `tolerance` makes it a range. */
  expect: string;
  /** Small label in front of the box, e.g. "4 + 7 =". */
  label: string;
  /** Cell ids filled in once it is right. */
  fills: string[];
  /** Said when they type something else - a nudge, never the answer. */
  hint: string;
  /**
   * An estimate is judged by NEARNESS to this value, not by matching `expect`.
   *
   * It is the true answer, not the rounded one, and the band is centred here.
   * Centring on the rounded value instead is what made "round 0.4 up to a half,
   * so about 19" fail on 9.6 / 0.4 while 28 passed - the exact move the step is
   * asking for, marked wrong.
   */
  about?: number;
  /** Half-width of the band around `about`. Absent means exact match. */
  tolerance?: number;
}

/**
 * The student physically moving a decimal point.
 *
 * Steele's requirement, twice over: "they move the decimal themselves" and
 * "student should have to click the decimal and move it themselves". Naming
 * how many places is a separate step from doing it.
 */
export interface DecMoveAction {
  kind: "move-decimal";
  target: "divisor" | "dividend" | "product";
  places: number;
  direction: "left" | "right";
}

export type DecStepKind = "choice" | "input" | "move";

export interface DecStep {
  id: string;
  kind: DecStepKind;
  /** Short label for the step rail beside the board. */
  rail: string;
  question: string;
  choices: DecChoice[];
  input?: DecInput;
  action?: DecMoveAction;
  /** Cell and marker ids that appear once this step is taken. */
  reveal: string[];
  /** Cell and marker ids lit while this step is the current one. */
  highlight: string[];
  /** The sentence left on screen after the step is taken. */
  say: string;
}

export interface DecimalTrace {
  problem: DecimalProblem;
  layout: DecimalLayout;
  headline: string;
  cells: DecCell[];
  markers: DecMarker[];
  steps: DecStep[];
  rows: DecimalRow[];
  columns: number;
  answerText: string;
  /** Division only: how far the decimals travel. */
  shift: number;
}

// ── exact decimal arithmetic ────────────────────────────────────────────────

export function parseDec(raw: string): Dec | null {
  const t = raw.trim();
  if (!new RegExp(`^\\d{1,${DECIMAL_MAX_INT_DIGITS}}(\\.\\d{1,${DECIMAL_MAX_PLACES}})?$`).test(t)) return null;
  const [i, d = ""] = t.split(".");
  const int = Number(i + d);
  if (!Number.isFinite(int)) return null;
  return { text: t, int, places: d.length };
}

function scaleTo(d: Dec, places: number): number {
  return d.int * 10 ** (places - d.places);
}

function digitsOf(int: number, places: number): { ints: string; decs: string } {
  const s = String(int).padStart(places + 1, "0");
  return { ints: s.slice(0, s.length - places), decs: places ? s.slice(s.length - places) : "" };
}

export function formatDec(int: number, places: number): string {
  const { ints, decs } = digitsOf(int, places);
  return places ? `${ints}.${decs}` : ints;
}

/**
 * The same value with the algorithm's trailing zeros dropped.
 *
 * Kept SEPARATE from the answer the board builds: 0.25 x 0.4 really does come
 * out of the algorithm as 0.100, and showing that first, then naming it 0.1, is
 * the moment the trailing zero stops being mysterious.
 */
export function trimTrailingZeros(text: string): string {
  if (!text.includes(".")) return text;
  const trimmed = text.replace(/0+$/, "").replace(/\.$/, "");
  return trimmed || "0";
}

const DEC_PLACES = ["tenths", "hundredths", "thousandths"];
const INT_PLACES = ["ones", "tens", "hundreds", "thousands"];

function placeName(posFromLeft: number, intW: number): string {
  if (posFromLeft < intW) return INT_PLACES[intW - 1 - posFromLeft] ?? "left";
  return DEC_PLACES[posFromLeft - intW] ?? "right";
}

function colOf(posFromLeft: number, intW: number): number {
  return posFromLeft < intW ? posFromLeft : posFromLeft + 1;
}

// ── choice order ────────────────────────────────────────────────────────────

/**
 * Put the choices in a stable but not-always-first order.
 *
 * Steele: "make sure the correct answer isnt in the first slot every itme".
 * Every builder writes the right answer first because that is how you read the
 * code, and the result was a tool a student could beat by always tapping the
 * top button.
 *
 * THE SEED IS THE STEP ID **PLUS THE PROBLEM**, and the second half is what was
 * missing. Step ids are constant across problems, so hashing the id alone gave
 * every problem the same seat: `lineup` was the third button on every board
 * ever built, and a student working a four-problem set learned to tap it by
 * problem two without reading it. Determinism is only there so a re-render
 * cannot reshuffle under a student mid-question - it never needed to hold
 * across problems.
 */
function seatChoices(id: string, choices: DecChoice[]): DecChoice[] {
  if (choices.length < 2) return choices;
  let h = 2166136261 >>> 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (h ^ id.charCodeAt(i)) >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
  }
  // Avalanche, so two seeds one character apart do not draw the same slot.
  // Without it the two-choice "Which way" step seated Left second on seven of
  // eight problems, which is the same learnable pattern in a different seat.
  h = (h ^ (h >>> 16)) >>> 0;
  h = Math.imul(h, 2246822507) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 3266489909) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  const out = [...choices];
  // Fisher-Yates driven by the hash, so the arrangement is a pure function of
  // the step and cannot land the answer in the same slot every time.
  //
  // EVERY STEP HERE IS 32-BIT INTEGER MATH. The old `h * 1103515245` ran past
  // 2^53, so the low bits - the only ones `% (i + 1)` reads - were rounding
  // noise rather than the generator's output, and the "shuffle" barely moved:
  // the correct answer landed in the first slot twice in fifty steps.
  for (let i = out.length - 1; i > 0; i -= 1) {
    h = (Math.imul(h, 1103515245) + 12345) >>> 0;
    // Take the HIGH bits: an LCG's low bits have short periods.
    const j = (h >>> 16) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ── the shared opening: name the operation, then estimate ───────────────────

const OP_WORD: Record<DecimalOp, string> = { "+": "Add", "-": "Subtract", "x": "Multiply", "/": "Divide" };
const OP_SIGN: Record<DecimalOp, string> = { "+": "+", "-": "−", "x": "x", "/": "÷" };

function operationStep(op: DecimalOp): DecStep {
  const wrongWhy: Record<DecimalOp, string> = {
    "+": "The sign says add - the two numbers are being put together.",
    "-": "The sign says subtract - one number is being taken away from the other.",
    "x": "The sign says multiply - one number is being taken that many times.",
    "/": "The sign says divide - one number is being shared into groups.",
  };
  return {
    id: "operation",
    kind: "choice",
    rail: "The operation",
    question: "What operation are we doing?",
    choices: (["+", "-", "x", "/"] as DecimalOp[]).map((candidate) => ({
      text: `${OP_WORD[candidate]}  ${OP_SIGN[candidate]}`,
      correct: candidate === op,
      why: candidate === op
        ? `Right - this is a ${OP_WORD[candidate].toLowerCase()}ing problem, so the rules for ${OP_WORD[candidate].toLowerCase()}ing apply.`
        : wrongWhy[op],
    })),
    reveal: [],
    highlight: [],
    say: `${OP_WORD[op]}.`,
  };
}

/**
 * Estimate first (Steele: "we should make an estimation feature first").
 *
 * Judged by NEARNESS, not equality - a student who rounds differently but lands
 * in the right neighbourhood has done the thinking. The band is centred on the
 * TRUE value and scales with it, and the hint teaches the rounding rather than
 * leaking the answer.
 *
 * BELOW ONE THE WHOLE-NUMBER QUESTION IS MEANINGLESS and the step becomes a
 * size question instead. Asking "about what whole number" when the answer is
 * 0.056 accepted anything at all - a flat one-wide band swallowed the entire
 * neighbourhood, including 0 and -1 - so the step ran and taught nothing on
 * most of the multiply curriculum.
 */
const ESTIMATE_BAND = 0.25;

function estimateStep(a: Dec, b: Dec, op: DecimalOp, value: number): DecStep {
  if (Math.abs(value) < 1) return smallEstimateStep(a, b, op);
  const rounded = Math.round(value);
  const tolerance = Math.max(1, Math.abs(value) * ESTIMATE_BAND);
  const nudge: Record<DecimalOp, string> = {
    "+": `Round ${a.text} and ${b.text} to the nearest whole number, then add those.`,
    "-": `Round ${a.text} and ${b.text} to the nearest whole number, then subtract those.`,
    "x": `Round each number to something easy. Is ${b.text} about a half? about one? about two? Then take that much of ${a.text}.`,
    "/": `About how many ${b.text}s fit inside ${a.text}? Round both to something easy first.`,
  };
  return {
    id: "estimate",
    kind: "input",
    rail: "Estimate",
    question: "Before we work it out - about what whole number should the answer be?",
    choices: [],
    input: {
      expect: String(rounded),
      label: "About",
      fills: [],
      hint: nudge[op],
      about: value,
      tolerance,
    },
    reveal: [],
    highlight: [],
    say: "Now we have something to check the answer against.",
  };
}

/** The estimate when the answer is smaller than one whole. */
function smallEstimateStep(a: Dec, b: Dec, op: DecimalOp): DecStep {
  const nudge: Record<DecimalOp, string> = {
    "+": `${a.text} and ${b.text} are both small. Put them together roughly - do they reach a whole one?`,
    "-": `${b.text} takes away nearly all of ${a.text}. What is left of one whole?`,
    "x": `Taking ${b.text} of ${a.text} means taking a PIECE of it. A piece of something small.`,
    "/": `How many whole ${b.text}s fit inside ${a.text}? If ${b.text} is bigger, not even one.`,
  };
  return {
    id: "estimate",
    kind: "choice",
    rail: "Estimate",
    question: "Before we work it out - about how big will the answer be?",
    choices: [
      {
        text: "Between 0 and 1",
        correct: true,
        why: "Right - the answer is a piece of one whole, not a whole number. That is what we check it against.",
      },
      {
        text: "Between 1 and 10",
        correct: false,
        why: `That needs the answer to be at least one whole. Look at the size of ${a.text} and ${b.text} again. ${nudge[op]}`,
      },
      {
        text: "More than 10",
        correct: false,
        why: `That is far bigger than anything these two numbers can make. ${nudge[op]}`,
      },
    ],
    reveal: [],
    highlight: [],
    say: "Less than one whole. Now we have something to check the answer against.",
  };
}

// ── the set-up question, whose answer changes with the operation ────────────

const LINEUP_BY_DECIMAL: DecChoice[] = [
  {
    text: "Line up the decimal points",
    correct: true,
    why: "Right - the decimal points stack, so tenths sit over tenths and ones sit over ones.",
  },
  {
    text: "Line up the right-hand edges",
    correct: false,
    why: "That works for whole numbers, but here it would put tenths under hundredths and add places that do not match.",
  },
  {
    text: "Line up the left-hand edges",
    correct: false,
    why: "The left edge does not tell you the place value. 12.4 and 3.75 both start in a different place.",
  },
];

const LINEUP_RIGHT_EDGE: DecChoice[] = [
  {
    text: "Line up the right-hand edges and ignore the decimals for now",
    correct: true,
    why: "Right - multiply as if they were whole numbers, then count the decimal places at the end.",
  },
  {
    text: "Line up the decimal points",
    correct: false,
    why: "That is the rule for adding and subtracting. Multiplying does not need the places to match - you count them at the end instead.",
  },
  {
    text: "Add a zero so both have the same number of decimal places",
    correct: false,
    why: "Matching the places is an adding move. It would not be wrong, but it does not help here - you still multiply every digit by every digit.",
  },
];

const DIVISION_SETUP: DecChoice[] = [
  {
    text: "Move the decimal until the divisor is a whole number",
    correct: true,
    why: "Right - you cannot divide by a piece of a number, so make the divisor whole first.",
  },
  {
    text: "Move the decimal in the dividend only",
    correct: false,
    why: "That changes the answer. Whatever you do to the divisor you must do to the dividend, so the two numbers keep the same relationship.",
  },
  {
    text: "Nothing - start dividing",
    correct: false,
    why: "Dividing by a piece of a number is the step almost everybody gets wrong. Make the divisor whole first.",
  },
  {
    text: "Round both numbers to whole numbers",
    correct: false,
    why: "Rounding changes the numbers, so the answer would only be close. Moving the decimal keeps it exact.",
  },
];

// ── carrying, which is now three moves instead of one ───────────────────────

/**
 * The carry steps.
 *
 * Steele: "They put in the answer and it stops them and says what do we do with
 * the second 1? and they write carry it. and they have to physically put the
 * one in a small box over the 2 that solidifies when they input". So a carry is
 * a decision AND a physical act, not a number that appears on its own.
 */
function carrySteps(idBase: string, total: number, carryOut: number, digit: number, boxId: string, place: string): DecStep[] {
  const second = String(total)[0];
  return [
    {
      id: `${idBase}-what`,
      kind: "choice",
      rail: "Carry",
      question: `${total} does not fit in one column. What do we do with the ${second}?`,
      choices: [
        {
          text: "Carry it into the next column to the left",
          correct: true,
          why: `Right - the ${digit} stays in the ${place} and the ${carryOut} is worth ten of them, so it moves left.`,
        },
        {
          text: `Write the whole ${total} in the ${place}`,
          correct: false,
          why: "Only one digit fits in a column. Two digits in one place changes what the number means.",
        },
        {
          text: "Drop it",
          correct: false,
          why: `Dropping it loses ${carryOut === 1 ? "ten" : `${carryOut} tens`}. Every part of the number has to go somewhere.`,
        },
      ],
      reveal: [],
      highlight: [boxId],
      say: `Carry the ${carryOut}.`,
    },
    {
      id: `${idBase}-write`,
      kind: "input",
      rail: "Write it",
      question: "Put the carried digit in the box above the next column.",
      choices: [],
      input: {
        expect: String(carryOut),
        label: "Carry",
        fills: [boxId],
        // Deliberately not "${digit} ${place}" - on a multiplication row the
        // place word is "column", which reads as "2 column".
        hint: `${total} is ${carryOut} ten and ${digit} left over. The ${carryOut} is what moves.`,
      },
      reveal: [boxId],
      highlight: [boxId],
      say: `${carryOut} is waiting in the next column.`,
    },
  ];
}

// ── addition and subtraction ────────────────────────────────────────────────

interface ColumnBoard {
  cells: DecCell[];
  intW: number;
  decW: number;
  columns: number;
  paddedA: string;
  paddedB: string;
  paddedS: string;
  padsA: number[];
  padsB: number[];
}

function buildColumnBoard(a: Dec, b: Dec, resultInt: number, decW: number): ColumnBoard {
  const A = scaleTo(a, decW);
  const B = scaleTo(b, decW);
  const da = digitsOf(A, decW);
  const db = digitsOf(B, decW);
  const ds = digitsOf(resultInt, decW);
  const intW = Math.max(da.ints.length, db.ints.length, ds.ints.length);
  const pad = (d: { ints: string; decs: string }) => d.ints.padStart(intW, " ") + d.decs;
  const paddedA = pad(da);
  const paddedB = pad(db);
  const paddedS = pad(ds);
  const columns = intW + 1 + decW;

  const cells: DecCell[] = [];
  const padsA: number[] = [];
  const padsB: number[] = [];
  const push = (row: DecimalRow, padded: string, source: Dec, pads: number[]) => {
    for (let p = 0; p < padded.length; p += 1) {
      const ch = padded[p];
      if (ch === " ") continue;
      const isPad = p >= intW && p - intW >= source.places;
      if (isPad) pads.push(p);
      cells.push({ id: `${row}-${p}`, row, col: colOf(p, intW), text: ch, kind: isPad ? "pad" : "digit" });
    }
    cells.push({ id: `${row}-dot`, row, col: intW, text: ".", kind: "dot" });
  };
  push("a", paddedA, a, padsA);
  push("b", paddedB, b, padsB);
  for (let p = 0; p < paddedS.length; p += 1) {
    if (paddedS[p] === " ") continue;
    cells.push({ id: `sum-${p}`, row: "sum", col: colOf(p, intW), text: paddedS[p], kind: "digit" });
  }
  cells.push({ id: "sum-dot", row: "sum", col: intW, text: ".", kind: "dot" });

  return { cells, intW, decW, columns, paddedA, paddedB, paddedS, padsA, padsB };
}

function zeroFillStep(board: ColumnBoard, a: Dec, b: Dec): DecStep | null {
  const pads = [...board.padsA, ...board.padsB];
  if (!pads.length) return null;
  const shorter = board.padsA.length ? a : b;
  const missing = placeName(board.intW + shorter.places, board.intW);
  return {
    id: "zeros",
    kind: "choice",
    rail: "Fill the gap",
    question: `${shorter.text} has nothing in the ${missing} place. What goes there?`,
    choices: [
      { text: "Write a zero to hold the place", correct: true, why: "Right - a zero on the end does not change the value, and now every column has a digit to work with." },
      { text: "Leave it empty", correct: false, why: "An empty column is easy to misread and easy to skip. A zero says out loud that there are none of those." },
      { text: "Slide the digits over to fill it", correct: false, why: "Sliding a digit changes its place value - the 4 in the tenths would become 4 hundredths, a different number." },
    ],
    reveal: [...board.padsA.map((p) => `a-${p}`), ...board.padsB.map((p) => `b-${p}`)],
    highlight: pads.map((p) => `${board.padsA.includes(p) ? "a" : "b"}-${p}`),
    say: "Every place has a digit now.",
  };
}

function bringDownStep(): DecStep {
  return {
    id: "point",
    kind: "choice",
    rail: "Decimal down",
    question: "Where does the decimal point go in the answer?",
    choices: [
      { text: "Straight down, in line with the others", correct: true, why: "Right - the columns already line up, so the answer's point drops straight down." },
      { text: "At the end of the answer", correct: false, why: "That would make the answer a whole number and multiply it by ten or a hundred." },
      { text: "Count the decimal places in both numbers and use that many", correct: false, why: "Counting places is the multiplying rule. When you add or subtract, the point comes straight down." },
    ],
    reveal: ["sum-dot"],
    highlight: ["a-dot", "b-dot", "sum-dot"],
    say: "Write it before you add and you cannot forget it.",
  };
}

function buildAddition(a: Dec, b: Dec): DecimalTrace {
  const decW = Math.max(a.places, b.places);
  const sumInt = scaleTo(a, decW) + scaleTo(b, decW);
  const board = buildColumnBoard(a, b, sumInt, decW);
  const { intW, paddedA, paddedB } = board;

  const steps: DecStep[] = [
    operationStep("+"),
    estimateStep(a, b, "+", sumInt / 10 ** decW),
    {
      id: "lineup",
      kind: "choice",
      rail: "Line up",
      question: `We are adding ${a.text} and ${b.text}. How do we line them up?`,
      choices: LINEUP_BY_DECIMAL,
      reveal: board.cells.filter((c) => (c.row === "a" || c.row === "b") && c.kind !== "pad").map((c) => c.id),
      highlight: ["a-dot", "b-dot"],
      say: "Decimal over decimal, so every place matches.",
    },
  ];
  const zeros = zeroFillStep(board, a, b);
  if (zeros) steps.push(zeros);
  steps.push(bringDownStep());

  let carry = 0;
  for (let p = paddedA.length - 1; p >= 0; p -= 1) {
    const dA = paddedA[p] === " " ? 0 : Number(paddedA[p]);
    const dB = paddedB[p] === " " ? 0 : Number(paddedB[p]);
    const total = dA + dB + carry;
    const digit = total % 10;
    const carryOut = Math.floor(total / 10);
    const place = placeName(p, intW);
    const carryBox = `carry-${p}`;
    const label = carry ? `${dA} + ${dB} + ${carry} =` : `${dA} + ${dB} =`;

    steps.push({
      id: `col-${p}`,
      kind: "input",
      rail: place,
      question: `Add the ${place} column.`,
      choices: [],
      input: {
        expect: String(total),
        label,
        fills: [`sum-${p}`],
        hint: carry
          ? `Do not forget the ${carry} carried into this column.`
          : `Add just this column: ${dA} and ${dB}.`,
      },
      reveal: [`sum-${p}`],
      highlight: [`a-${p}`, `b-${p}`, `sum-${p}`, ...(carry ? [carryBox] : [])],
      say: total >= 10 ? `${total} - only the ${digit} fits here.` : `${total} in the ${place}.`,
    });

    if (carryOut) {
      const nextBox = `carry-${p - 1}`;
      board.cells.push({ id: nextBox, row: "carry", col: colOf(p - 1, intW), text: String(carryOut), kind: "carrybox" });
      steps.push(...carrySteps(`col-${p}`, total, carryOut, digit, nextBox, place));
    }
    carry = carryOut;
  }

  return {
    problem: { a, b, op: "+" },
    layout: "column",
    headline: `${a.text} + ${b.text}`,
    cells: board.cells,
    markers: [],
    steps,
    rows: ["carry", "a", "b", "rule", "sum"],
    columns: board.columns,
    answerText: formatDec(sumInt, decW),
    shift: 0,
  };
}

function buildSubtraction(a: Dec, b: Dec): DecimalTrace {
  const decW = Math.max(a.places, b.places);
  const A = scaleTo(a, decW);
  const B = scaleTo(b, decW);
  const board = buildColumnBoard(a, b, A - B, decW);
  const { intW, paddedA, paddedB } = board;

  const steps: DecStep[] = [
    operationStep("-"),
    estimateStep(a, b, "-", (A - B) / 10 ** decW),
    {
      id: "lineup",
      kind: "choice",
      rail: "Line up",
      question: `We are subtracting ${b.text} from ${a.text}. How do we line them up?`,
      choices: LINEUP_BY_DECIMAL,
      reveal: board.cells.filter((c) => (c.row === "a" || c.row === "b") && c.kind !== "pad").map((c) => c.id),
      highlight: ["a-dot", "b-dot"],
      say: "Decimal over decimal, so every place matches.",
    },
  ];
  const zeros = zeroFillStep(board, a, b);
  if (zeros) steps.push(zeros);
  steps.push(bringDownStep());

  const top = paddedA.split("").map((c) => (c === " " ? -1 : Number(c)));
  for (let p = paddedA.length - 1; p >= 0; p -= 1) {
    const dB = paddedB[p] === " " ? 0 : Number(paddedB[p]);
    const place = placeName(p, intW);

    if (top[p] < dB) {
      let lender = p - 1;
      while (lender >= 0 && top[lender] <= 0) lender -= 1;
      const changed: string[] = [];
      for (let k = lender; k < p; k += 1) {
        const from = top[k] < 0 ? 0 : top[k];
        top[k] = k === lender ? from - 1 : 9;
        board.cells.push({ id: `regroup-${k}`, row: "regroup", col: colOf(k, intW), text: String(top[k]), kind: "digit" });
        changed.push(`regroup-${k}`, `a-${k}`);
      }
      top[p] += 10;
      board.cells.push({ id: `regroup-${p}`, row: "regroup", col: colOf(p, intW), text: String(top[p]), kind: "digit" });
      changed.push(`regroup-${p}`);

      steps.push({
        id: `regroup-${p}`,
        kind: "choice",
        rail: "Regroup",
        question: `In the ${place} we need to take ${dB} from ${top[p] - 10}. What do we do?`,
        choices: [
          { text: `Regroup: take one from the ${placeName(lender, intW)} to make it ${top[p]}`, correct: true, why: `Right - one ${placeName(lender, intW)} is ten ${place}, so the column becomes ${top[p]}.` },
          { text: `Turn it around and do ${dB} take away ${top[p] - 10}`, correct: false, why: "Subtraction does not flip. Taking the small one from the big one in a column gives the wrong answer every time - regroup instead." },
          { text: "Write a zero and move on", correct: false, why: "That throws the column away. The value is still there, it just needs regrouping from the place to its left." },
        ],
        reveal: changed,
        highlight: changed,
        say: `The ${place} column is ${top[p]} now.`,
      });
    }

    if (board.paddedS[p] === " ") continue;
    const result = top[p] - dB;
    steps.push({
      id: `col-${p}`,
      kind: "input",
      rail: place,
      question: `Subtract the ${place} column.`,
      choices: [],
      input: {
        expect: String(result),
        label: `${top[p]} − ${dB} =`,
        fills: [`sum-${p}`],
        hint: `Take ${dB} away from ${top[p]}, just in this column.`,
      },
      reveal: [`sum-${p}`],
      highlight: [`a-${p}`, `b-${p}`, `sum-${p}`, `regroup-${p}`],
      say: `${result} in the ${place}.`,
    });
  }

  return {
    problem: { a, b, op: "-" },
    layout: "column",
    headline: `${a.text} − ${b.text}`,
    cells: board.cells,
    markers: [],
    steps,
    rows: ["regroup", "a", "b", "rule", "sum"],
    columns: board.columns,
    answerText: formatDec(A - B, decW),
    shift: 0,
  };
}

// ── multiplication, digit by digit ──────────────────────────────────────────

function buildMultiplication(a: Dec, b: Dec): DecimalTrace {
  const da = String(a.int);
  const db = String(b.int);
  const productInt = a.int * b.int;
  const places = a.places + b.places;
  const partials = db.split("").reverse().map((d, i) => a.int * Number(d) * 10 ** i);
  const prod = String(productInt).padStart(places + 1, "0");
  const single = partials.length === 1;
  const columns = Math.max(da.length, db.length, prod.length, ...partials.map((p) => String(p).length));

  const cells: DecCell[] = [];
  const markers: DecMarker[] = [];
  const lay = (row: DecimalRow, text: string, idPrefix: string) => {
    const offset = columns - text.length;
    text.split("").forEach((ch, i) => {
      cells.push({ id: `${idPrefix}-${i}`, row, col: offset + i, text: ch, kind: "digit" });
    });
    return offset;
  };
  const offA = lay("a", da, "a");
  const offB = lay("b", db, "b");
  markers.push({ id: "a-dot", row: "a", boundary: offA + da.length - a.places, muted: true });
  markers.push({ id: "b-dot", row: "b", boundary: offB + db.length - b.places, muted: true });

  const steps: DecStep[] = [
    operationStep("x"),
    estimateStep(a, b, "x", productInt / 10 ** places),
    {
      id: "lineup",
      kind: "choice",
      rail: "Line up",
      question: `We are multiplying ${a.text} by ${b.text}. How do we line them up?`,
      choices: LINEUP_RIGHT_EDGE,
      reveal: cells.filter((c) => c.row === "a" || c.row === "b").map((c) => c.id).concat("a-dot", "b-dot"),
      highlight: ["a-dot", "b-dot"],
      say: `Multiply ${da} by ${db} first. The points are greyed out until the end.`,
    },
  ];

  // ONE PAIR OF DIGITS AT A TIME. Steele: "we can only multiple 2 numbers at
  // once. So we strt with the 4 and the 2" - a whole row in one step is the
  // answer appearing, not the algorithm being taught.
  // The characters of `prod` that exist ONLY because of the padStart - the
  // placeholder zeros that give the decimal point somewhere to travel into.
  // 0.3 x 0.3 is nine hundredths written into a row one digit wide; without
  // them the board spells ". 9" while its own headline says 0.09.
  const placeholderIds = Array.from(
    { length: prod.length - String(productInt).length },
    (_, z) => `prod-${z}`,
  );

  partials.forEach((value, j) => {
    const mult = Number(db[db.length - 1 - j]);
    // On a one-digit multiplier the partial row IS the product row, so it has
    // to be laid from the PADDED string - the unpadded one never created the
    // placeholder cells at all.
    const text = single ? prod : String(value);
    const prefix = single ? "prod" : `p${j}`;
    const offset = columns - text.length;
    text.split("").forEach((ch, i) => {
      cells.push({ id: `${prefix}-${i}`, row: single ? "sum" : (`part${j}` as DecimalRow), col: offset + i, text: ch, kind: "digit" });
    });

    let carry = 0;
    for (let i = da.length - 1; i >= 0; i -= 1) {
      const dTop = Number(da[i]);
      const total = dTop * mult + carry;
      const digit = total % 10;
      const carryOut = Math.floor(total / 10);
      // Which cell in this partial row holds that digit.
      const rowPos = text.length - 1 - (da.length - 1 - i) - j;
      const cellId = `${prefix}-${rowPos}`;
      const carryBox = `mcarry-${j}-${i}`;
      // On the LAST digit of the row there is no column left to carry into, so
      // the carry simply becomes the row's leading digit and is written with
      // it. Without this the leading digit is never placed and the row reads
      // short by one - 6 x 4 = 24 would show only the 4.
      const leadsWithCarry = carryOut > 0 && i === 0;
      const fills = leadsWithCarry ? [`${prefix}-${rowPos - 1}`, cellId] : [cellId];
      steps.push({
        id: `mul-${j}-${i}`,
        kind: "input",
        rail: `${mult} x ${dTop}`,
        question: `Multiply just these two digits.${j > 0 ? ` This row is the ${mult} in the tens, so it sits one place left.` : ""}`,
        choices: [],
        input: {
          expect: String(total),
          label: carry ? `${mult} x ${dTop} + ${carry} =` : `${mult} x ${dTop} =`,
          fills,
          hint: carry ? `Multiply first, then add the ${carry} you carried.` : "Two digits at a time - just these two.",
        },
        reveal: fills,
        highlight: [`a-${i}`, `b-${db.length - 1 - j}`, ...fills, ...(carry ? [carryBox] : [])],
        say: `${mult} x ${dTop}${carry ? ` + ${carry}` : ""} = ${total}.`,
      });
      if (carryOut && i > 0) {
        const nextBox = `mcarry-${j}-${i - 1}`;
        cells.push({ id: nextBox, row: "carry", col: columns - (da.length - i) - j - 1, text: String(carryOut), kind: "carrybox" });
        steps.push(...carrySteps(`mul-${j}-${i}`, total, carryOut, digit, nextBox, "column"));
      }
      carry = carryOut;
    }
    if (j > 0) {
      // The placeholder zeros that shift the row left.
      for (let z = 0; z < j; z += 1) {
        const zeroId = `${prefix}-${text.length - 1 - z}`;
        if (!steps.some((s) => s.reveal.includes(zeroId))) steps[steps.length - 1].reveal.push(zeroId);
      }
    }
  });

  if (!single) {
    lay("sum", prod, "prod");
    steps.push(...partialSumSteps(partials, prod, columns, placeholderIds.length, cells));
  }
  // An empty row still takes its height on the board, so the carry row for the
  // partial addition only exists when that addition actually carries.
  const sumCarryRow: DecimalRow[] = cells.some((c) => c.row === "sumcarry") ? ["sumcarry"] : [];

  // The decimal, exactly as Steele described it: count the digits right of the
  // points, then say WHICH WAY and HOW FAR, then physically move it.
  markers.push({ id: "prod-dot", row: "sum", boundary: columns, muted: false });
  steps.push({
    id: "count",
    kind: "input",
    rail: "Count places",
    question: "Count the digits to the right of the decimal point in BOTH numbers. How many altogether?",
    choices: [],
    input: {
      expect: String(places),
      label: "Digits after the points",
      fills: [],
      hint: `${a.text} has ${a.places}, and ${b.text} has ${b.places}. Add them, do not take the bigger one.`,
    },
    reveal: ["prod-dot"],
    highlight: ["a-dot", "b-dot"],
    say: `${a.places} + ${b.places} = ${places}.`,
  });
  steps.push({
    id: "direction",
    kind: "choice",
    rail: "Which way",
    question: `Which way does the decimal point move to make ${places} place${places === 1 ? "" : "s"}?`,
    // The reason is PLACE VALUE, never size. An earlier version said the answer
    // "gets smaller, which is what multiplying by a piece of a number does" -
    // unconditionally, so 6.2 x 3 = 18.6 told a student that three is a piece
    // of a number and that 18.6 is smaller than 6.2. Delivered as the
    // confirmation of a correct answer, at the moment the rule is forming.
    choices: [
      {
        text: "Left",
        correct: true,
        why: `Right - the two numbers have ${places} digit${places === 1 ? "" : "s"} after their points altogether, so the answer needs ${places}. You count those in from the right end, which puts the point to the left.`,
      },
      {
        text: "Right",
        correct: false,
        why: `Moving right takes decimal places away. We counted ${places}, so the point has to end up with ${places} digit${places === 1 ? "" : "s"} behind it - count in from the right end.`,
      },
    ],
    // The placeholder zeros arrive HERE, at the moment they are needed: the
    // point has further to travel than the row has digits.
    reveal: placeholderIds,
    highlight: ["prod-dot", ...placeholderIds],
    say: placeholderIds.length
      ? `${places} place${places === 1 ? "" : "s"} to the left - there are not enough digits, so a zero holds each empty place.`
      : `${places} place${places === 1 ? "" : "s"} to the left.`,
  });
  steps.push({
    id: "move-product",
    kind: "move",
    rail: "Move it",
    question: `Drag the decimal point ${places} place${places === 1 ? "" : "s"} to the left.`,
    choices: [],
    action: { kind: "move-decimal", target: "product", places, direction: "left" },
    reveal: [],
    highlight: ["prod-dot"],
    say: `The answer is ${formatDec(productInt, places)}.`,
  });

  return {
    problem: { a, b, op: "x" },
    layout: "product",
    headline: `${a.text} x ${b.text}`,
    cells,
    markers,
    steps,
    rows: single
      ? ["carry", "a", "b", "rule", "sum"]
      : ["carry", "a", "b", "rule", ...partials.map((_, i) => `part${i}` as DecimalRow), ...sumCarryRow, "rule", "sum"],
    columns,
    answerText: formatDec(productInt, places),
    shift: 0,
  };
}

/**
 * Adding the partial rows, column by column, with the same carry ritual every
 * other addition in this tool uses.
 *
 * The one-line `125 + 1750 =` step this replaces was the same failure as
 * multiplying a whole row at once, arriving on the addition side - and it was
 * the LAST step, so a student who could not do it in their head was stuck with
 * a one-line hint and no way through.
 *
 * The placeholder columns are deliberately NOT walked: those zeros exist only
 * so the decimal point has somewhere to travel, and they arrive at the step
 * that needs them, not as a column with nothing in it to add.
 */
function partialSumSteps(
  partials: number[],
  prod: string,
  columns: number,
  placeholders: number,
  cells: DecCell[],
): DecStep[] {
  const texts = partials.map((p) => String(p));
  const offsets = texts.map((t) => columns - t.length);
  const prodOffset = columns - prod.length;
  const steps: DecStep[] = [];
  let carry = 0;

  for (let c = columns - 1; c >= prodOffset + placeholders; c -= 1) {
    const addends: number[] = [];
    texts.forEach((t, j) => {
      if (c >= offsets[j]) addends.push(Number(t[c - offsets[j]]));
    });
    const total = addends.reduce((sum, d) => sum + d, 0) + carry;
    const digit = total % 10;
    const carryOut = Math.floor(total / 10);
    const cellId = `prod-${c - prodOffset}`;

    if (addends.length + (carry ? 1 : 0) < 2) {
      // One digit and nothing to add to it. It comes down with the step before
      // rather than becoming a question with a single number in it - and the
      // step before SAYS so, or the digit appears from nowhere.
      const prev = steps[steps.length - 1];
      if (prev) {
        prev.reveal.push(cellId);
        prev.say = `${prev.say} ${addends.length === 0
          ? `The carried ${carry} lands in the next column on its own.`
          : `Nothing to add in the next column, so the ${digit} comes straight down.`}`;
      }
      carry = carryOut;
      continue;
    }

    const label = `${addends.join(" + ")}${carry ? ` + ${carry}` : ""} =`;
    steps.push({
      id: `sum-${c}`,
      kind: "input",
      rail: "Add down",
      question: "Add this column of the rows together.",
      choices: [],
      input: {
        expect: String(total),
        label,
        fills: [cellId],
        hint: carry
          ? `Add just this column, and do not forget the ${carry} carried into it.`
          : "Add just this column - one column at a time, the same as any other addition.",
      },
      reveal: [cellId],
      highlight: [cellId, ...texts.map((t, j) => (c >= offsets[j] ? `p${j}-${c - offsets[j]}` : "")).filter(Boolean)],
      say: total >= 10 ? `${total} - only the ${digit} fits in this column.` : `${total} in this column.`,
    });

    if (carryOut) {
      const box = `pcarry-${c - 1}`;
      cells.push({ id: box, row: "sumcarry", col: c - 1, text: String(carryOut), kind: "carrybox" });
      steps.push(...carrySteps(`sum-${c}`, total, carryOut, digit, box, "column"));
    }
    carry = carryOut;
  }

  return steps;
}

// ── division ────────────────────────────────────────────────────────────────

function buildDivision(a: Dec, b: Dec): DecimalTrace | null {
  const shift = b.places;
  const divisor = b.int;
  if (divisor === 0) return null;
  const dividendPlaces = Math.max(0, a.places - shift);
  const dividendInt = a.int * 10 ** Math.max(0, shift - a.places);
  const dividendText = formatDec(dividendInt, dividendPlaces);

  const digits = dividendText.replace(".", "").split("");
  const dotAt = dividendText.includes(".") ? dividendText.indexOf(".") : digits.length;
  const givenDigits = a.text.replace(".", "").length;

  let remainder = 0;
  const cycles: { pos: number; partial: number; q: number; product: number; rest: number }[] = [];
  let extra = 0;
  let started = false;
  for (let i = 0; i < digits.length || (remainder !== 0 && extra < DECIMAL_MAX_QUOTIENT_PLACES); i += 1) {
    const next = i < digits.length ? Number(digits[i]) : 0;
    if (i >= digits.length) extra += 1;
    const partial = remainder * 10 + next;
    if (!started && partial < divisor) {
      remainder = partial;
      continue;
    }
    started = true;
    const q = Math.floor(partial / divisor);
    cycles.push({ pos: i, partial, q, product: q * divisor, rest: partial - q * divisor });
    remainder = partial - q * divisor;
  }
  if (remainder !== 0 || !cycles.length) return null;

  const totalDigits = digits.length + extra;
  const columns = totalDigits;
  const cells: DecCell[] = [];
  const markers: DecMarker[] = [];

  for (let i = 0; i < totalDigits; i += 1) {
    const ch = i < digits.length ? digits[i] : "0";
    cells.push({ id: `dv-${i}`, row: "dividend", col: i, text: ch, kind: i < givenDigits ? "digit" : "pad" });
  }
  String(divisor).split("").forEach((ch, i) => {
    cells.push({ id: `ds-${i}`, row: "divisor", col: i, text: ch, kind: "digit" });
  });
  cycles.forEach((c) => {
    cells.push({ id: `q-${c.pos}`, row: "quotient", col: c.pos, text: String(c.q), kind: "digit" });
  });

  // A quotient smaller than one still needs its zero in the ones place.
  //
  // The cycle loop skips every position the divisor does not reach, which is
  // exactly right for 7.35 / 2.1 - that reads 3.5, never 03.5 - but wrong when
  // NO digit ever lands left of the point: 4.5 / 5 built only q-1 and the board
  // spelled ".9" while `answerText` said 0.9. Writing the zero in the ones
  // place is graded convention, and this is where a 6th grade unit starts.
  const onesZeroId = cycles.some((c) => c.pos < dotAt) ? null : `q-${dotAt - 1}`;
  if (onesZeroId) {
    cells.push({ id: onesZeroId, row: "quotient", col: dotAt - 1, text: "0", kind: "digit" });
  }

  markers.push({ id: "ds-dot", row: "divisor", boundary: String(b.int).length - b.places, muted: false });
  markers.push({ id: "dv-dot", row: "dividend", boundary: a.text.includes(".") ? a.text.indexOf(".") : givenDigits, muted: false });
  markers.push({ id: "q-dot", row: "quotient", boundary: dotAt, muted: false });

  const quotient = quotientText(cycles, dotAt, totalDigits);
  const steps: DecStep[] = [
    operationStep("/"),
    estimateStep(a, b, "/", Number(quotient)),
    {
      id: "setup",
      kind: "choice",
      rail: "Before we start",
      question: `We are dividing ${a.text} by ${b.text}. What do we have to do before we can start?`,
      choices: shift > 0
        ? DIVISION_SETUP
        : [
          { text: `Nothing - ${b.text} is already a whole number`, correct: true, why: `Right - the decimal only moves when the divisor has one. ${b.text} is ready to divide by.` },
          { text: `Move the decimal in ${b.text} to the right`, correct: false, why: `${b.text} is already whole, so there is nothing to move. Check the DIVISOR before you reach for that rule.` },
          { text: `Move the decimal in ${a.text} to the right`, correct: false, why: "Moving the dividend on its own changes the answer. The dividend only moves to match a move in the divisor." },
        ],
      reveal: cells.filter((c) => (c.row === "dividend" || c.row === "divisor") && c.kind === "digit").map((c) => c.id).concat("ds-dot", "dv-dot"),
      highlight: ["ds-dot"],
      say: shift > 0 ? `${b.text} is not a whole number yet.` : `${b.text} is already whole - nothing to move.`,
    },
  ];

  if (shift > 0) {
    steps.push({
      id: "howfar",
      kind: "input",
      rail: "How far",
      question: `How many places does the decimal move to make ${b.text} whole?`,
      choices: [],
      input: {
        expect: String(shift),
        label: "Places",
        fills: [],
        hint: `Count the digits after the point in ${b.text}. That is how far it travels.`,
      },
      reveal: [],
      highlight: ["ds-dot"],
      say: `${shift} place${shift > 1 ? "s" : ""} to the right.`,
    });
    steps.push({
      id: "move-divisor",
      kind: "move",
      rail: "Move it",
      question: `Drag the decimal point in ${b.text} ${shift} place${shift > 1 ? "s" : ""} to the right.`,
      choices: [],
      action: { kind: "move-decimal", target: "divisor", places: shift, direction: "right" },
      reveal: [],
      highlight: ["ds-dot"],
      say: `The divisor is ${divisor} now.`,
    });
    steps.push({
      id: "and-the-other",
      kind: "choice",
      rail: "And the other",
      question: `We moved the divisor ${shift} place${shift > 1 ? "s" : ""}. What about ${a.text}?`,
      choices: [
        { text: `Move it ${shift} place${shift > 1 ? "s" : ""} the same way`, correct: true, why: "Right - both numbers move the same amount, so the answer does not change." },
        { text: "Leave it where it is", correct: false, why: `Moving only the divisor makes it a different problem. ${a.text} has to travel the same distance.` },
        { text: `Move it ${shift} place${shift > 1 ? "s" : ""} the other way`, correct: false, why: "Going the other way divides where you multiplied. Both decimals move in the same direction." },
      ],
      reveal: [],
      highlight: ["dv-dot"],
      say: `${a.text} moves too.`,
    });
    steps.push({
      id: "move-dividend",
      kind: "move",
      rail: "Move it",
      question: `Drag the decimal point in ${a.text} ${shift} place${shift > 1 ? "s" : ""} to the right.`,
      choices: [],
      action: { kind: "move-decimal", target: "dividend", places: shift, direction: "right" },
      reveal: cells.filter((c) => c.row === "dividend" && c.col >= givenDigits && c.col < digits.length).map((c) => c.id),
      highlight: ["dv-dot"],
      say: `${a.text} becomes ${dividendText}.`,
    });
  }

  steps.push({
    id: "qpoint",
    kind: "choice",
    rail: "Decimal up",
    question: "Where does the decimal point go in the answer?",
    choices: [
      { text: "Straight up from its new spot in the dividend", correct: true, why: "Right - once the divisor is whole, the answer's point sits directly above the dividend's." },
      { text: "At the end of the answer", correct: false, why: "That would make the answer a whole number when it is not one." },
      { text: "Where the decimal started, before we moved it", correct: false, why: "The old spot belongs to the old problem. The point goes up from where the dividend's decimal is NOW." },
    ],
    reveal: onesZeroId ? ["q-dot", onesZeroId] : ["q-dot"],
    highlight: onesZeroId ? ["dv-dot", "q-dot", onesZeroId] : ["dv-dot", "q-dot"],
    say: onesZeroId
      ? "Put it up before you divide and you cannot lose it. Nothing lands in the ones place here, so a zero holds it."
      : "Put it up before you divide and you cannot lose it.",
  });

  const CYCLE = ["Divide", "Multiply", "Subtract", "Bring down"];
  cycles.forEach((c, i) => {
    const workRow = `work${i}` as DecimalRow;
    const restRow = `rest${i}` as DecimalRow;
    const productText = String(c.product);
    productText.split("").forEach((ch, k) => {
      cells.push({ id: `w${i}-${k}`, row: workRow, col: c.pos - productText.length + 1 + k, text: ch, kind: "digit" });
    });
    const restText = String(c.rest);
    restText.split("").forEach((ch, k) => {
      cells.push({ id: `r${i}-${k}`, row: restRow, col: c.pos - restText.length + 1 + k, text: ch, kind: "digit" });
    });
    if (i < cycles.length - 1) {
      cells.push({ id: `bd${i}`, row: restRow, col: c.pos + 1, text: cells.find((x) => x.id === `dv-${c.pos + 1}`)?.text ?? "0", kind: "digit" });
    }

    steps.push({
      id: `divide-${i}`,
      kind: "input",
      rail: CYCLE[0],
      // Steele's words, and they are the words used at the board.
      question: `How many ${divisor}'s are in ${c.partial} without going over?`,
      choices: [],
      input: {
        expect: String(c.q),
        label: `${divisor}'s in ${c.partial}`,
        fills: [`q-${c.pos}`],
        hint: c.q === 0
          ? `${divisor} is bigger than ${c.partial}, so it fits zero times - write the 0 and carry on.`
          : `Count up by ${divisor} until one more would pass ${c.partial}.`,
      },
      reveal: [`q-${c.pos}`],
      highlight: i === 0
        ? [`q-${c.pos}`, ...rangeIds(cells, "dividend", 0, c.pos)]
        : [`q-${c.pos}`, ...rangeIds(cells, `rest${i - 1}` as DecimalRow, 0, c.pos)],
      say: `${divisor} goes into ${c.partial} ${c.q} time${c.q === 1 ? "" : "s"}.`,
    });

    steps.push({
      id: `multiply-${i}`,
      kind: "input",
      rail: CYCLE[1],
      question: "Multiply, to see how much of it we used.",
      choices: [],
      input: {
        expect: String(c.product),
        label: `${c.q} x ${divisor} =`,
        fills: productText.split("").map((_, k) => `w${i}-${k}`),
        hint: `Multiply the digit you just wrote by the divisor, ${divisor}.`,
      },
      reveal: productText.split("").map((_, k) => `w${i}-${k}`),
      highlight: [`q-${c.pos}`, ...String(divisor).split("").map((_, k) => `ds-${k}`), ...productText.split("").map((_, k) => `w${i}-${k}`)],
      say: `${c.q} x ${divisor} = ${c.product}.`,
    });

    steps.push({
      id: `subtract-${i}`,
      kind: "input",
      rail: CYCLE[2],
      question: "Subtract, to see what is left over.",
      choices: [],
      input: {
        expect: String(c.rest),
        label: `${c.partial} − ${c.product} =`,
        fills: restText.split("").map((_, k) => `r${i}-${k}`),
        hint: "Take the product away from the number above it.",
      },
      reveal: restText.split("").map((_, k) => `r${i}-${k}`),
      highlight: [...productText.split("").map((_, k) => `w${i}-${k}`), ...restText.split("").map((_, k) => `r${i}-${k}`)],
      say: `${c.partial} − ${c.product} = ${c.rest}.`,
    });

    if (i < cycles.length - 1) {
      steps.push({
        id: `bring-${i}`,
        kind: "choice",
        rail: CYCLE[3],
        question: "What do we do next?",
        choices: [
          { text: "Bring down the next digit", correct: true, why: "Right - it joins the leftover to make the next number to divide." },
          { text: "Stop - we have the answer", correct: false, why: "There are still digits under the bracket. Every one of them gets divided." },
          { text: "Bring down every remaining digit at once", correct: false, why: "One at a time. Bringing two down skips a digit in the answer." },
        ],
        reveal: [`dv-${c.pos + 1}`, `bd${i}`],
        highlight: [`dv-${c.pos + 1}`, `bd${i}`, ...restText.split("").map((_, k) => `r${i}-${k}`)],
        say: "Bring down the next digit.",
      });
    }
  });

  return {
    problem: { a, b, op: "/" },
    layout: "house",
    headline: `${a.text} ÷ ${b.text}`,
    cells,
    markers,
    steps,
    rows: ["quotient", "dividend", ...cycles.flatMap((_, i) => [`work${i}` as DecimalRow, `rest${i}` as DecimalRow])],
    columns,
    answerText: quotient,
    shift,
  };
}

function rangeIds(cells: DecCell[], row: DecimalRow, from: number, to: number): string[] {
  return cells.filter((c) => c.row === row && c.col >= from && c.col <= to).map((c) => c.id);
}

function quotientText(cycles: { pos: number; q: number }[], dotAt: number, totalDigits: number): string {
  const slots = Array.from({ length: totalDigits }, () => "0");
  cycles.forEach((c) => { slots[c.pos] = String(c.q); });
  const whole = slots.slice(0, dotAt).join("").replace(/^0+(?=\d)/, "") || "0";
  const frac = slots.slice(dotAt).join("").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

/**
 * Drop reveal/highlight ids that name nothing, and seat the choices.
 *
 * A number narrower than the grid has no digit in the leading columns - 3.75
 * under 12.4 has no tens - so a column step naturally reaches for a cell that
 * was never built. Left in, the highlight silently lights nothing, which is
 * indistinguishable from a highlight that is broken.
 */
function finish(trace: DecimalTrace): DecimalTrace {
  const ids = new Set([...trace.cells.map((c) => c.id), ...trace.markers.map((m) => m.id)]);
  // The seat has to vary BETWEEN problems, or a set teaches its own button
  // positions - see seatChoices.
  const signature = `${trace.problem.a.text}${trace.problem.op}${trace.problem.b.text}`;
  for (const step of trace.steps) {
    step.reveal = step.reveal.filter((id) => ids.has(id));
    step.highlight = step.highlight.filter((id) => ids.has(id));
    if (step.kind === "choice") step.choices = seatChoices(`${step.id}@${signature}`, step.choices);
  }
  return trace;
}

export function buildDecimalTrace(problem: DecimalProblem): DecimalTrace | null {
  const { a, b, op } = problem;
  if (op === "+") return finish(buildAddition(a, b));
  if (op === "-") {
    if (scaleTo(a, Math.max(a.places, b.places)) < scaleTo(b, Math.max(a.places, b.places))) return null;
    return finish(buildSubtraction(a, b));
  }
  if (op === "x") return finish(buildMultiplication(a, b));
  const div = buildDivision(a, b);
  return div ? finish(div) : null;
}

// ── the problem-set format ──────────────────────────────────────────────────

const OP_ALIASES: Record<string, DecimalOp> = {
  "+": "+", "-": "-", "−": "-", "x": "x", "*": "x", "×": "x", "/": "/", "÷": "/",
};

export interface DecimalSetParse {
  problems: DecimalProblem[];
  /** Problems that will not run, and the reason - reported, never swallowed. */
  rejected: { text: string; reason: string }[];
}

export function parseDecimalSet(raw: string | null | undefined): DecimalSetParse {
  const out: DecimalProblem[] = [];
  const rejected: { text: string; reason: string }[] = [];
  if (!raw) return { problems: out, rejected };

  for (const chunk of raw.split(/[,;\n]+/)) {
    const text = chunk.trim();
    if (!text) continue;
    const m = text.match(/^(\d+(?:\.\d+)?)\s*([-+x*×/÷−])\s*(\d+(?:\.\d+)?)$/i);
    if (!m) {
      rejected.push({ text, reason: "not a problem like 12.4 + 3.75" });
      continue;
    }
    const a = parseDec(m[1]);
    const b = parseDec(m[3]);
    const op = OP_ALIASES[m[2]];
    if (!a || !b || !op) {
      rejected.push({ text, reason: `numbers need at most ${DECIMAL_MAX_INT_DIGITS} digits and ${DECIMAL_MAX_PLACES} decimal places` });
      continue;
    }
    if (b.int === 0 && op === "/") {
      rejected.push({ text, reason: "cannot divide by zero" });
      continue;
    }
    const trace = buildDecimalTrace({ a, b, op });
    if (!trace) {
      rejected.push({
        text,
        reason: op === "-"
          ? "the answer would be negative"
          : `the answer does not end within ${DECIMAL_MAX_QUOTIENT_PLACES} decimal places`,
      });
      continue;
    }
    // A problem inside the documented input range can still be far too big to
    // walk: 9999.999 x 9999.999 builds 140 steps across 14 columns, which is
    // unusable on a Chromebook and impossible in a period. Refused OUT LOUD,
    // with a reason /control prints verbatim.
    if (trace.steps.length > DECIMAL_MAX_STEPS || trace.columns > DECIMAL_MAX_COLUMNS) {
      rejected.push({ text, reason: "too many steps to walk in class - use smaller numbers" });
      continue;
    }
    out.push({ a, b, op });
    if (out.length >= DECIMAL_MAX_PROBLEMS) break;
  }
  return { problems: out, rejected };
}

export function serializeDecimalSet(problems: DecimalProblem[]): string {
  return problems.map((p) => `${p.a.text} ${p.op} ${p.b.text}`).join(", ");
}

export function normalizeDecimalSet(raw: string | null | undefined): string {
  return serializeDecimalSet(parseDecimalSet(raw).problems);
}

/** One of each operation, in the order a unit teaches them. */
export const DEFAULT_DECIMAL_SET = "12.4 + 3.75, 8.3 - 4.68, 6.2 x 0.4, 9.6 / 0.4";

/** The four operations, for the picker in the tool's top bar. */
export const DECIMAL_OPS: { op: DecimalOp; label: string; sign: string }[] = [
  { op: "+", label: "Add", sign: "+" },
  { op: "-", label: "Subtract", sign: "−" },
  { op: "x", label: "Multiply", sign: "x" },
  { op: "/", label: "Divide", sign: "÷" },
];
