// The guided decimal engine: one problem in, an ordered list of decisions out.
//
// Every step is a QUESTION with multiple choices, because the thing being
// taught is what to do next, not the arithmetic. The distractors are real
// sixth-grade errors, never filler: starting from the left, writing a whole
// two-digit sum in one column, flipping a subtraction to avoid regrouping,
// using the LARGER decimal count in a product instead of the sum, moving the
// decimal in the divisor only.
//
// The setup question is the point of the whole tool and its answer DIFFERS BY
// OPERATION - that is the misconception it exists to catch:
//   +  and  -   line up by the decimal point
//   x           line up the right edges and ignore the decimals until the end
//   /           neither; move the decimal until the divisor is whole
//
// This module is pure and holds no React. It computes on integers scaled by a
// power of ten - never on floats - so 0.1 + 0.2 is 0.3 here and the boards
// cannot drift. Rendering (and the "actually move the decimal" interaction the
// division setup demands) lives in DecimalStepsBoard.

export type DecimalOp = "+" | "-" | "x" | "/";

export const DECIMAL_MAX_INT_DIGITS = 4;
export const DECIMAL_MAX_PLACES = 3;
export const DECIMAL_MAX_PROBLEMS = 12;
/** A quotient that never terminates cannot be walked, so a set is refused. */
export const DECIMAL_MAX_QUOTIENT_PLACES = 3;

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

/**
 * How a board is drawn. The three shapes are genuinely different, and that
 * difference is itself the lesson:
 *   column  - digits AND the decimal points share one grid (+ and -)
 *   product - digits right-aligned, decimal points floating between columns
 *             and greyed out until the very last step (x)
 *   house   - long division, with the decimals riding as movable markers (/)
 */
export type DecimalLayout = "column" | "product" | "house";

export type DecimalRow =
  | "carry"
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
  /** Grid column. For `house`, column 0 is the dividend's leftmost digit. */
  col: number;
  text: string;
  /** `pad` is a zero written in to fill an empty place - it renders lighter. */
  kind: "digit" | "dot" | "pad" | "struck" | "op";
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

/**
 * An interaction the student performs AFTER choosing correctly.
 *
 * Only division uses it, and it is Steele's requirement: having named how many
 * places the decimal moves, they have to actually move it that many times, on
 * the divisor and then on the dividend. Naming the number is not the same as
 * doing it, and moving only the divisor is the error this catches.
 */
export interface DecMoveAction {
  kind: "move-decimal";
  target: "divisor" | "dividend";
  places: number;
}

export interface DecStep {
  id: string;
  /** Short label for the step rail beside the board. */
  rail: string;
  question: string;
  choices: DecChoice[];
  /** Cell and marker ids that appear once this step is taken. */
  reveal: string[];
  /** Cell and marker ids lit while this step is the current one. */
  highlight: string[];
  /** The sentence left on screen after the step is taken. */
  say: string;
  action?: DecMoveAction;
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
  /** Division only: how far the decimals travel, for the move interaction. */
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

/** Split a scaled integer into its integer and decimal digit strings. */
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

/** The name of a place, so every question can say where it is working. */
function placeName(posFromLeft: number, intW: number, decW: number): string {
  if (posFromLeft < intW) return INT_PLACES[intW - 1 - posFromLeft] ?? "left";
  void decW;
  return DEC_PLACES[posFromLeft - intW] ?? "right";
}

/** Grid column of a digit position, allowing for the shared decimal column. */
function colOf(posFromLeft: number, intW: number): number {
  return posFromLeft < intW ? posFromLeft : posFromLeft + 1;
}

/**
 * The "wrong direction" distractor for a column step.
 *
 * It has to change with where the column sits, or it reads as nonsense: on the
 * leftmost column "skip to the tens" names the column you are already in, which
 * is not a wrong answer so much as an unreadable one.
 */
function wrongWayChoice(p: number, last: number, intW: number, decW: number, verb: string): DecChoice {
  if (p === last) {
    return {
      text: `Start on the left with the ${placeName(0, intW, decW)}`,
      correct: false,
      why: `${verb === "added" ? "Adding" : "Subtracting"} starts on the right, because a carry or a regroup always travels leftward. Start on the left and there is nowhere for it to go.`,
    };
  }
  if (p > 0) {
    return {
      text: `Skip to the ${placeName(p - 1, intW, decW)}`,
      correct: false,
      why: `Every column gets ${verb}, in order. Skipping one drops part of the number.`,
    };
  }
  return {
    text: "Stop here - the answer looks finished",
    correct: false,
    why: `This is the last column on the left, and it still has to be ${verb}.`,
  };
}

// ── the setup question, which is the whole point ────────────────────────────

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
    why: "Dividing by 0.4 with the decimal still in place is the step almost everybody gets wrong. Make the divisor whole first.",
  },
  {
    text: "Round both numbers to whole numbers",
    correct: false,
    why: "Rounding changes the numbers, so the answer would only be close. Moving the decimal keeps it exact.",
  },
];

// ── addition and subtraction ────────────────────────────────────────────────

interface ColumnBoard {
  cells: DecCell[];
  markers: DecMarker[];
  intW: number;
  decW: number;
  columns: number;
  paddedA: string;
  paddedB: string;
  paddedS: string;
  /** Positions where a pad zero had to be written in. */
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
      // A decimal place the student has to write a zero into: past what they
      // were given, but inside the width the other number forces.
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

  return { cells, markers: [], intW, decW, columns, paddedA, paddedB, paddedS, padsA, padsB };
}

function zeroFillStep(board: ColumnBoard, a: Dec, b: Dec): DecStep | null {
  const pads = [...board.padsA, ...board.padsB];
  if (!pads.length) return null;
  const shorter = board.padsA.length ? a : b;
  const missing = placeName(board.intW + shorter.places, board.intW, board.decW);
  return {
    id: "zeros",
    rail: "Fill the gap",
    question: `${shorter.text} has nothing in the ${missing} place. What goes there?`,
    choices: [
      {
        text: "Write a zero to hold the place",
        correct: true,
        why: `Right - a zero on the end does not change the value, and now every column has a digit to work with.`,
      },
      {
        text: "Leave it empty",
        correct: false,
        why: "An empty column is easy to misread and easy to skip. A zero says out loud that there are none of those.",
      },
      {
        text: "Slide the digits over to fill it",
        correct: false,
        why: "Sliding a digit changes its place value - the 4 in the tenths would become 4 hundredths, a different number.",
      },
    ],
    reveal: [...board.padsA.map((p) => `a-${p}`), ...board.padsB.map((p) => `b-${p}`)],
    highlight: pads.map((p) => `${board.padsA.includes(p) ? "a" : "b"}-${p}`),
    say: "Every place has a digit now.",
  };
}

function bringDownStep(intW: number): DecStep {
  return {
    id: "point",
    rail: "Decimal down",
    question: "Where does the decimal point go in the answer?",
    choices: [
      {
        text: "Straight down, in line with the others",
        correct: true,
        why: "Right - the columns already line up, so the answer's point drops straight down.",
      },
      {
        text: "At the end of the answer",
        correct: false,
        why: "That would make the answer a whole number and multiply it by ten or a hundred.",
      },
      {
        text: "Count the decimal places in both numbers and use that many",
        correct: false,
        why: "Counting places is the multiplying rule. When you add or subtract, the point comes straight down.",
      },
    ],
    reveal: ["sum-dot"],
    highlight: ["a-dot", "b-dot", "sum-dot"],
    say: "Write it before you add and you cannot forget it.",
    ...(intW ? {} : {}),
  };
}

function buildAddition(a: Dec, b: Dec): DecimalTrace {
  const decW = Math.max(a.places, b.places);
  const sumInt = scaleTo(a, decW) + scaleTo(b, decW);
  const board = buildColumnBoard(a, b, sumInt, decW);
  const { intW, paddedA, paddedB } = board;

  const steps: DecStep[] = [
    {
      id: "lineup",
      rail: "Line up",
      question: `We are adding ${a.text} and ${b.text}. How do we line them up?`,
      choices: LINEUP_BY_DECIMAL,
      reveal: board.cells.filter((c) => c.row === "a" || c.row === "b").filter((c) => c.kind !== "pad").map((c) => c.id),
      highlight: ["a-dot", "b-dot"],
      say: "Decimal over decimal, so every place matches.",
    },
  ];
  const zeros = zeroFillStep(board, a, b);
  if (zeros) steps.push(zeros);
  steps.push(bringDownStep(intW));

  // Right to left, one column at a time.
  let carry = 0;
  for (let p = paddedA.length - 1; p >= 0; p -= 1) {
    const dA = paddedA[p] === " " ? 0 : Number(paddedA[p]);
    const dB = paddedB[p] === " " ? 0 : Number(paddedB[p]);
    const total = dA + dB + carry;
    const digit = total % 10;
    const carryOut = Math.floor(total / 10);
    const place = placeName(p, intW, board.decW);
    const carryPart = carry ? ` + ${carry} carried` : "";
    const choices: DecChoice[] = [
      {
        text: total >= 10
          ? `Add the ${place}: ${dA} + ${dB}${carryPart} = ${total}. Write ${digit}, carry ${carryOut}`
          : `Add the ${place}: ${dA} + ${dB}${carryPart} = ${total}`,
        correct: true,
        why: total >= 10
          ? `Right - ${total} is too big for one column, so ${digit} stays and ${carryOut} moves left.`
          : "Right - one column at a time, working right to left.",
      },
    ];
    if (total >= 10) {
      choices.push({
        text: `Add the ${place}: ${dA} + ${dB}${carryPart} = ${total}. Write ${total}`,
        correct: false,
        why: `Only one digit fits in a column. Write ${digit} and carry the ${carryOut} into the next place left.`,
      });
    }
    choices.push(wrongWayChoice(p, paddedA.length - 1, intW, board.decW, "added"));
    if (choices.length < 3) {
      choices.push({
        text: `Multiply the ${place}: ${dA} x ${dB}`,
        correct: false,
        why: "This is an addition problem - the columns get added, not multiplied.",
      });
    }

    steps.push({
      id: `col-${p}`,
      rail: place,
      question: "What do we do next?",
      choices,
      reveal: [`sum-${p}`, ...(carryOut ? [`carry-${p - 1}`] : [])],
      highlight: [`a-${p}`, `b-${p}`, `sum-${p}`, ...(carry ? [`carry-${p}`] : [])],
      say: total >= 10 ? `${total} - write ${digit}, carry ${carryOut}.` : `${total} in the ${place}.`,
    });
    if (carryOut) {
      board.cells.push({ id: `carry-${p - 1}`, row: "carry", col: colOf(p - 1, intW), text: String(carryOut), kind: "digit" });
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
    {
      id: "lineup",
      rail: "Line up",
      question: `We are subtracting ${b.text} from ${a.text}. How do we line them up?`,
      choices: LINEUP_BY_DECIMAL,
      reveal: board.cells.filter((c) => c.row === "a" || c.row === "b").filter((c) => c.kind !== "pad").map((c) => c.id),
      highlight: ["a-dot", "b-dot"],
      say: "Decimal over decimal, so every place matches.",
    },
  ];
  const zeros = zeroFillStep(board, a, b);
  if (zeros) steps.push(zeros);
  steps.push(bringDownStep(intW));

  // Work on a mutable copy of the top row so regrouping can rewrite it.
  const top = paddedA.split("").map((c) => (c === " " ? -1 : Number(c)));
  for (let p = paddedA.length - 1; p >= 0; p -= 1) {
    const dB = paddedB[p] === " " ? 0 : Number(paddedB[p]);
    const place = placeName(p, intW, board.decW);

    if (top[p] < dB) {
      // Walk left for a digit that can lend one.
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
        rail: "Regroup",
        question: `In the ${place} we need to take ${dB} from ${top[p] - 10}. What do we do?`,
        choices: [
          {
            text: `Regroup: take one from the ${placeName(lender, intW, board.decW)} to make it ${top[p]}`,
            correct: true,
            why: `Right - one ${placeName(lender, intW, board.decW)} is ten ${place}, so the column becomes ${top[p]}.`,
          },
          {
            text: `Turn it around and do ${dB} take away ${top[p] - 10}`,
            correct: false,
            why: "Subtraction does not flip. Taking the small one from the big one in a column gives the wrong answer every time - regroup instead.",
          },
          {
            text: "Write a zero and move on",
            correct: false,
            why: "That throws the column away. The value is still there, it just needs regrouping from the place to its left.",
          },
        ],
        reveal: changed,
        highlight: changed,
        say: `The ${place} column is ${top[p]} now.`,
      });
    }

    const result = top[p] - dB;
    // A leading column the difference does not reach (100.5 − 99.75 has no
    // hundreds in its answer) has nothing to write, so asking about it would be
    // a step with no move. The regrouping above still runs.
    if (board.paddedS[p] === " ") continue;
    steps.push({
      id: `col-${p}`,
      rail: place,
      question: "What do we do next?",
      choices: [
        {
          text: `Subtract the ${place}: ${top[p]} − ${dB} = ${result}`,
          correct: true,
          why: "Right - one column at a time, working right to left.",
        },
        wrongWayChoice(p, paddedA.length - 1, intW, board.decW, "subtracted"),
        {
          text: `Add the ${place}: ${top[p]} + ${dB} = ${top[p] + dB}`,
          correct: false,
          why: "This is a subtraction problem - read the sign before you work the column.",
        },
      ],
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

// ── multiplication ──────────────────────────────────────────────────────────

function buildMultiplication(a: Dec, b: Dec): DecimalTrace {
  const da = String(a.int);
  const db = String(b.int);
  const productInt = a.int * b.int;
  const places = a.places + b.places;
  const partials = db.split("").reverse().map((d, i) => a.int * Number(d) * 10 ** i);
  // Pad so a digit always sits LEFT of the answer's point: 0.25 x 0.4 is 100
  // with three places, and printing that as ".100" gives a student nothing to
  // read the ones place from.
  const prod = String(productInt).padStart(places + 1, "0");
  // Right-aligned digit grid: no shared decimal column, because the points are
  // deliberately out of play until the last step.
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
  // The operands keep their points, floating between digit columns and muted -
  // visible, but not part of the multiply.
  markers.push({ id: "a-dot", row: "a", boundary: offA + da.length - a.places, muted: true });
  markers.push({ id: "b-dot", row: "b", boundary: offB + db.length - b.places, muted: true });

  const steps: DecStep[] = [
    {
      id: "lineup",
      rail: "Line up",
      question: `We are multiplying ${a.text} by ${b.text}. How do we line them up?`,
      choices: LINEUP_RIGHT_EDGE,
      reveal: cells.filter((c) => c.row === "a" || c.row === "b").map((c) => c.id).concat("a-dot", "b-dot"),
      highlight: ["a-dot", "b-dot"],
      say: `Multiply ${da} by ${db} first. The points are greyed out until the end.`,
    },
  ];

  // A single-digit multiplier has one row, and that row IS the product - a
  // separate answer row would print the same number twice.
  const single = partials.length === 1;
  partials.forEach((value, i) => {
    const digit = Number(db[db.length - 1 - i]);
    const text = String(value);
    const prefix = single ? "prod" : `p${i}`;
    lay(single ? "sum" : (`part${i}` as DecimalRow), text, prefix);
    const ids = text.split("").map((_, k) => `${prefix}-${k}`);
    const zeroNote = i > 0 ? ` and a ${"zero".concat(i > 1 ? "s" : "")} placeholder` : "";
    steps.push({
      id: `partial-${i}`,
      rail: `x ${digit}`,
      question: "What do we do next?",
      choices: [
        {
          text: `Multiply every digit of ${da} by ${digit}${i > 0 ? `, then shift ${i} place${i > 1 ? "s" : ""} left` : ""}`,
          correct: true,
          why: i > 0
            ? `Right - that ${digit} is worth ${digit}${"0".repeat(i)}, so its row slides ${i} place${i > 1 ? "s" : ""} left.`
            : `Right - ${da} x ${digit} = ${text}.`,
        },
        {
          text: `Multiply only the first digit of ${da} by ${digit}`,
          correct: false,
          why: `Every digit of ${da} gets multiplied, not just one. That is the same mistake as distributing to the first term only.`,
        },
        i > 0
          ? {
            text: `Multiply every digit of ${da} by ${digit} and line it up on the right`,
            correct: false,
            why: `That ${digit} sits in the tens, so it is really ${digit}0. Its row has to shift left or the two rows add up wrong.`,
          }
          : {
            text: `Add ${da} and ${digit}`,
            correct: false,
            why: "This is a multiplication problem - read the sign before you work the row.",
          },
      ],
      reveal: ids,
      highlight: [...ids, ...cells.filter((c) => c.row === "a").map((c) => c.id), `b-${db.length - 1 - i}`],
      say: `${da} x ${digit}${zeroNote} is ${text}.`,
    });
  });

  if (!single) lay("sum", prod, "prod");
  if (!single) {
    steps.push({
      id: "addpartials",
      rail: "Add rows",
      question: "What do we do next?",
      choices: [
        {
          text: "Add the rows together",
          correct: true,
          why: `Right - ${partials.join(" + ")} = ${prod}.`,
        },
        {
          text: "Multiply the rows together",
          correct: false,
          why: "The rows are pieces of one product. Pieces get added back together, not multiplied.",
        },
        {
          text: "Keep only the longest row",
          correct: false,
          why: "Every row is part of the answer. Dropping one throws away part of the product.",
        },
      ],
      reveal: prod.split("").map((_, i) => `prod-${i}`),
      highlight: prod.split("").map((_, i) => `prod-${i}`),
      say: `${partials.join(" + ")} = ${prod}.`,
    });
  }

  const wrong = Math.max(a.places, b.places);
  const countChoices: DecChoice[] = [
    {
      text: `${places} - ${a.places} from ${a.text} plus ${b.places} from ${b.text}`,
      correct: true,
      why: `Right - you add the decimal places, so the answer gets ${places}.`,
    },
  ];
  if (wrong !== places) {
    countChoices.push({
      text: `${wrong} - whichever number has more`,
      correct: false,
      why: "Taking the larger count is the most common multiplying error. The places add: every place in each factor makes the answer smaller, and both count.",
    });
  }
  countChoices.push({
    text: "0 - the answer is a whole number",
    correct: false,
    why: `Both factors are less than whole in places, so the product cannot lose its decimal. ${a.text} x ${b.text} is about ${estimateText(a, b)}.`,
  });
  if (countChoices.length < 3) {
    countChoices.push({
      text: `${places + 1} - one more to be safe`,
      correct: false,
      why: "Each extra place divides the answer by ten. Count them exactly: one for each place in each factor.",
    });
  }

  markers.push({ id: "prod-dot", row: "sum", boundary: columns - places, muted: false });
  steps.push({
    id: "count",
    rail: "Count places",
    question: "How many decimal places does the answer need?",
    choices: countChoices,
    reveal: ["prod-dot"],
    highlight: ["a-dot", "b-dot", "prod-dot"],
    say: `${a.places} + ${b.places} = ${places}, counted in from the right.`,
  });

  return {
    problem: { a, b, op: "x" },
    layout: "product",
    headline: `${a.text} x ${b.text}`,
    cells,
    markers,
    steps,
    rows: single
      ? ["a", "b", "rule", "sum"]
      : ["a", "b", "rule", ...partials.map((_, i) => `part${i}` as DecimalRow), "rule", "sum"],
    columns,
    answerText: formatDec(productInt, places),
    shift: 0,
  };
}

function estimateText(a: Dec, b: Dec): number {
  return Math.round(a.int * b.int / 10 ** (a.places + b.places) * 100) / 100;
}

// ── division ────────────────────────────────────────────────────────────────

function buildDivision(a: Dec, b: Dec): DecimalTrace | null {
  // Shift both until the divisor is whole. That shift IS the lesson.
  const shift = b.places;
  const divisor = b.int; // b scaled by 10^b.places is exactly its digits
  if (divisor === 0) return null;
  const dividendPlaces = Math.max(0, a.places - shift);
  const dividendInt = a.int * 10 ** Math.max(0, shift - a.places);
  const dividendText = formatDec(dividendInt, dividendPlaces);

  // Long division over the dividend's digits; the quotient must terminate.
  const digits = dividendText.replace(".", "").split("");
  const dotAt = dividendText.includes(".") ? dividendText.indexOf(".") : digits.length;
  // How many of those digits the student was actually given. Anything past this
  // arrived from the shift, so it appears when the decimal moves - not before.
  const givenDigits = a.text.replace(".", "").length;

  let remainder = 0;
  const cycles: { pos: number; partial: number; q: number; product: number; rest: number }[] = [];
  let extra = 0;
  let started = false;
  for (let i = 0; i < digits.length || (remainder !== 0 && extra < DECIMAL_MAX_QUOTIENT_PLACES); i += 1) {
    const next = i < digits.length ? Number(digits[i]) : 0;
    if (i >= digits.length) extra += 1;
    const partial = remainder * 10 + next;
    // Nothing goes above the bracket until the divisor actually fits, which is
    // how it is written by hand: 21 into 7 is not a step, it is a wider look.
    if (!started && partial < divisor) {
      remainder = partial;
      continue;
    }
    started = true;
    const q = Math.floor(partial / divisor);
    cycles.push({ pos: i, partial, q, product: q * divisor, rest: partial - q * divisor });
    remainder = partial - q * divisor;
  }
  if (remainder !== 0 || !cycles.length) return null; // does not terminate - refuse it

  const totalDigits = digits.length + extra;
  const columns = totalDigits;
  const cells: DecCell[] = [];
  const markers: DecMarker[] = [];

  // Dividend. Three kinds of digit, revealed at three different moments:
  // what the student was given, what the shift produced, and the zeros the
  // algorithm appends past the last digit to finish the quotient.
  for (let i = 0; i < totalDigits; i += 1) {
    const ch = i < digits.length ? digits[i] : "0";
    cells.push({
      id: `dv-${i}`,
      row: "dividend",
      col: i,
      text: ch,
      kind: i < givenDigits ? "digit" : "pad",
    });
  }
  String(divisor).split("").forEach((ch, i) => {
    cells.push({ id: `ds-${i}`, row: "divisor", col: i, text: ch, kind: "digit" });
  });
  cycles.forEach((c) => {
    cells.push({ id: `q-${c.pos}`, row: "quotient", col: c.pos, text: String(c.q), kind: "digit" });
  });

  // Decimal markers start where the ORIGINAL numbers put them and move.
  markers.push({ id: "ds-dot", row: "divisor", boundary: String(b.int).length - b.places, muted: false });
  markers.push({ id: "dv-dot", row: "dividend", boundary: a.text.includes(".") ? a.text.indexOf(".") : givenDigits, muted: false });
  markers.push({ id: "q-dot", row: "quotient", boundary: dotAt, muted: false });

  const steps: DecStep[] = [
    {
      id: "setup",
      rail: "Before we start",
      question: `We are dividing ${a.text} by ${b.text}. What do we have to do before we can start?`,
      // A divisor that is ALREADY whole needs a different question, or the
      // "correct" answer would be an instruction to move a decimal that has
      // nowhere to go. Knowing when no move is needed is its own decision.
      choices: shift > 0
        ? DIVISION_SETUP
        : [
          {
            text: `Nothing - ${b.text} is already a whole number`,
            correct: true,
            why: `Right - the decimal only moves when the divisor has one. ${b.text} is ready to divide by.`,
          },
          {
            text: `Move the decimal in ${b.text} to the right`,
            correct: false,
            why: `${b.text} is already whole, so there is nothing to move. Check the DIVISOR before you reach for that rule.`,
          },
          {
            text: `Move the decimal in ${a.text} to the right`,
            correct: false,
            why: `Moving the dividend on its own changes the answer. The dividend only moves to match a move in the divisor.`,
          },
        ],
      reveal: cells.filter((c) => c.row === "dividend" || c.row === "divisor").filter((c) => c.kind === "digit").map((c) => c.id).concat("ds-dot", "dv-dot"),
      highlight: ["ds-dot"],
      say: shift > 0 ? `${b.text} is not a whole number yet.` : `${b.text} is already whole - nothing to move.`,
    },
  ];

  if (shift > 0) {
    steps.push({
      id: "howfar",
      rail: "How far",
      question: `How many places does the decimal move to make ${b.text} whole?`,
      choices: [
        { text: `${shift}`, correct: true, why: `Right - ${b.text} needs ${shift} place${shift > 1 ? "s" : ""} to become ${divisor}.` },
        {
          text: `${shift + 1}`,
          correct: false,
          why: `That would take it past whole. Move it just far enough to clear the last digit of ${b.text}.`,
        },
        {
          text: "0 - it is already whole",
          correct: false,
          why: `${b.text} still has a decimal point with digits after it, so it is not a whole number yet.`,
        },
      ],
      reveal: [],
      highlight: ["ds-dot"],
      say: `${shift} place${shift > 1 ? "s" : ""} to the right.`,
    });
    steps.push({
      id: "move-divisor",
      rail: "Move it",
      question: `Move the decimal in ${b.text} ${shift} place${shift > 1 ? "s" : ""} to the right.`,
      choices: [
        { text: "Move it", correct: true, why: `${b.text} becomes ${divisor}.` },
      ],
      reveal: [],
      highlight: ["ds-dot"],
      say: `The divisor is ${divisor} now.`,
      action: { kind: "move-decimal", target: "divisor", places: shift },
    });
    steps.push({
      id: "move-dividend",
      rail: "And the other",
      question: `We moved the divisor ${shift} place${shift > 1 ? "s" : ""}. What about ${a.text}?`,
      choices: [
        {
          text: `Move it ${shift} place${shift > 1 ? "s" : ""} the same way`,
          correct: true,
          why: "Right - both numbers move the same amount, so the answer does not change.",
        },
        {
          text: "Leave it where it is",
          correct: false,
          why: `Moving only the divisor makes it a different problem. ${a.text} has to travel the same distance.`,
        },
        {
          text: `Move it ${shift} place${shift > 1 ? "s" : ""} the other way`,
          correct: false,
          why: "Going the other way divides where you multiplied. Both decimals move in the same direction.",
        },
      ],
      // The digits the shift produced arrive with the move that produced them.
      reveal: cells.filter((c) => c.row === "dividend" && c.col >= givenDigits && c.col < digits.length).map((c) => c.id),
      highlight: ["dv-dot"],
      say: `${a.text} becomes ${dividendText}.`,
      action: { kind: "move-decimal", target: "dividend", places: shift },
    });
  }

  steps.push({
    id: "qpoint",
    rail: "Decimal up",
    question: "Where does the decimal point go in the answer?",
    choices: [
      {
        text: "Straight up from its new spot in the dividend",
        correct: true,
        why: "Right - once the divisor is whole, the answer's point sits directly above the dividend's.",
      },
      {
        text: "At the end of the answer",
        correct: false,
        why: "That would make the answer a whole number when it is not one.",
      },
      {
        text: "Where the decimal started, before we moved it",
        correct: false,
        why: "The old spot belongs to the old problem. The point goes up from where the dividend's decimal is NOW.",
      },
    ],
    reveal: ["q-dot"],
    highlight: ["dv-dot", "q-dot"],
    say: "Put it up before you divide and you cannot lose it.",
  });

  // Divide / multiply / subtract / bring down, one cycle per dividend digit.
  const CYCLE = ["Divide", "Multiply", "Subtract", "Bring down"];
  cycles.forEach((c, i) => {
    // The product and the difference are two SEPARATE rows, written the way it
    // is written by hand: product under the partial, a line, the difference
    // under that. One row for both would put them in the same grid columns,
    // and the product would simply vanish under the difference.
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
    // The digit brought down lands beside the difference, in the same row -
    // together they ARE the next number to divide.
    if (i < cycles.length - 1) {
      cells.push({ id: `bd${i}`, row: restRow, col: c.pos + 1, text: cells.find((x) => x.id === `dv-${c.pos + 1}`)?.text ?? "0", kind: "digit" });
    }

    steps.push({
      id: `divide-${i}`,
      rail: CYCLE[0],
      question: "What do we do next?",
      choices: [
        {
          text: `Divide: ${c.partial} ÷ ${divisor} = ${c.q}`,
          correct: true,
          why: c.q === 0
            ? `Right - ${divisor} does not fit into ${c.partial}, so a zero goes up top and we keep going.`
            : `Right - ${divisor} fits into ${c.partial} ${c.q} time${c.q > 1 ? "s" : ""}.`,
        },
        {
          text: `Multiply: ${c.partial} x ${divisor}`,
          correct: false,
          why: "Multiplying comes second. First find how many times the divisor fits.",
        },
        {
          text: `Divide: ${divisor} ÷ ${c.partial}`,
          correct: false,
          why: `The divisor goes INTO the number under the bracket, not the other way round.`,
        },
      ],
      reveal: [`q-${c.pos}`],
      // The number being divided is the dividend's digits on the first round,
      // and after that the leftover with the brought-down digit beside it.
      highlight: i === 0
        ? [`q-${c.pos}`, ...rangeIds(cells, "dividend", 0, c.pos)]
        : [`q-${c.pos}`, ...rangeIds(cells, `rest${i - 1}` as DecimalRow, 0, c.pos)],
      say: `${divisor} goes into ${c.partial} ${c.q} time${c.q === 1 ? "" : "s"}.`,
    });

    steps.push({
      id: `multiply-${i}`,
      rail: CYCLE[1],
      question: "What do we do next?",
      choices: [
        {
          text: `Multiply: ${c.q} x ${divisor} = ${c.product}`,
          correct: true,
          why: `Right - that is how much of the ${c.partial} we have used up.`,
        },
        {
          text: `Subtract: ${c.partial} − ${divisor} = ${c.partial - divisor}`,
          correct: false,
          why: "Subtracting comes third, and it takes away the product, not the divisor itself.",
        },
        {
          text: `Multiply: ${c.q} x ${c.partial} = ${c.q * c.partial}`,
          correct: false,
          why: "Multiply the digit you just wrote by the DIVISOR - that is what tells you how much you used.",
        },
      ],
      reveal: productText.split("").map((_, k) => `w${i}-${k}`),
      highlight: [`q-${c.pos}`, ...String(divisor).split("").map((_, k) => `ds-${k}`), ...productText.split("").map((_, k) => `w${i}-${k}`)],
      say: `${c.q} x ${divisor} = ${c.product}.`,
    });

    steps.push({
      id: `subtract-${i}`,
      rail: CYCLE[2],
      question: "What do we do next?",
      choices: [
        {
          text: `Subtract: ${c.partial} − ${c.product} = ${c.rest}`,
          correct: true,
          why: c.rest === 0
            ? "Right - nothing is left over in this round."
            : `Right - ${c.rest} is left over and travels into the next round.`,
        },
        {
          text: `Add: ${c.partial} + ${c.product} = ${c.partial + c.product}`,
          correct: false,
          why: "The product gets taken away. It is the part of the number we have already divided up.",
        },
        // When the product equals the partial, "flip the subtraction" would be
        // word-for-word the correct answer, so the distractor has to change.
        c.product === c.partial
          ? {
            text: "Bring the next digit down now",
            correct: false,
            why: "Subtract first, then bring down. Bringing a digit down early hides what was left over.",
          }
          : {
            text: `Subtract: ${c.product} − ${c.partial}`,
            correct: false,
            why: "The number under the bracket is on top, so it goes first - you take the product away from it, not the other way round.",
          },
      ],
      reveal: restText.split("").map((_, k) => `r${i}-${k}`),
      highlight: [...productText.split("").map((_, k) => `w${i}-${k}`), ...restText.split("").map((_, k) => `r${i}-${k}`)],
      say: `${c.partial} − ${c.product} = ${c.rest}.`,
    });

    if (i < cycles.length - 1) {
      steps.push({
        id: `bring-${i}`,
        rail: CYCLE[3],
        question: "What do we do next?",
        choices: [
          {
            text: `Bring down the next digit`,
            correct: true,
            why: "Right - it joins the leftover to make the next number to divide.",
          },
          {
            text: "Stop - we have the answer",
            correct: false,
            why: "There are still digits under the bracket. Every one of them gets divided.",
          },
          {
            text: "Bring down every remaining digit at once",
            correct: false,
            why: "One at a time. Bringing two down skips a digit in the answer.",
          },
        ],
        reveal: [`dv-${c.pos + 1}`, `bd${i}`],
        highlight: [`dv-${c.pos + 1}`, `bd${i}`, ...restText.split("").map((_, k) => `r${i}-${k}`)],
        say: `Bring down the ${i + 2 <= digits.length ? "next digit" : "zero"}.`,
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
    answerText: quotientText(cycles, dotAt, totalDigits),
    shift,
  };
}

/**
 * Drop reveal/highlight ids that name nothing.
 *
 * A number narrower than the grid has no digit in the leading columns - 3.75
 * under 12.4 has no tens - so a column step naturally reaches for a cell that
 * was never built. Left in, the highlight silently lights nothing, which is
 * indistinguishable from a highlight that is broken.
 */
function pruneGhostIds(trace: DecimalTrace): DecimalTrace {
  const ids = new Set([...trace.cells.map((c) => c.id), ...trace.markers.map((m) => m.id)]);
  for (const step of trace.steps) {
    step.reveal = step.reveal.filter((id) => ids.has(id));
    step.highlight = step.highlight.filter((id) => ids.has(id));
  }
  return trace;
}

function rangeIds(cells: DecCell[], row: DecimalRow, from: number, to: number): string[] {
  return cells.filter((c) => c.row === row && c.col >= from && c.col <= to).map((c) => c.id);
}

/**
 * Read the quotient off the columns it was actually written in.
 *
 * The digits are sparse - nothing is written above the bracket until the
 * divisor first fits - so the answer is assembled by column, not by pushing
 * onto a list. Columns before the first quotient digit are worth zero.
 */
function quotientText(
  cycles: { pos: number; q: number }[],
  dotAt: number,
  totalDigits: number,
): string {
  const slots = Array.from({ length: totalDigits }, () => "0");
  cycles.forEach((c) => { slots[c.pos] = String(c.q); });
  const whole = slots.slice(0, dotAt).join("").replace(/^0+(?=\d)/, "") || "0";
  const frac = slots.slice(dotAt).join("").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

// ── the public entry point ──────────────────────────────────────────────────

export function buildDecimalTrace(problem: DecimalProblem): DecimalTrace | null {
  const { a, b, op } = problem;
  if (op === "+") return pruneGhostIds(buildAddition(a, b));
  if (op === "-") {
    // A negative difference is out of scope for this board, not a silent wrong
    // answer: the caller refuses the problem and says why.
    if (scaleTo(a, Math.max(a.places, b.places)) < scaleTo(b, Math.max(a.places, b.places))) return null;
    return pruneGhostIds(buildSubtraction(a, b));
  }
  if (op === "x") return pruneGhostIds(buildMultiplication(a, b));
  const div = buildDivision(a, b);
  return div ? pruneGhostIds(div) : null;
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

/**
 * Forgiving on the shape, strict on what can actually be walked.
 *
 * A problem the board cannot draw is REPORTED rather than dropped, because a
 * teacher who typed `10 / 3` needs to know the quotient repeats before class,
 * not to find a broken step mid-lesson.
 */
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
