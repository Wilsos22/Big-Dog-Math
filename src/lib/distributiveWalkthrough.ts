// The "Stuck?" walkthrough for M1.T1.L1 - the worked example a student pulls up
// when the distributive area method has stopped making sense mid-problem.
//
// Six steps, one decision, in the same words the teacher uses at the board:
//
//     a x b  ->  [ ] ( [ ] + [ ] )  ->  a ( p + q )  ->  a x p  +  a x q  ->  total
//
// `a` is the friendly factor that stays out front, `b` is the one that gets cut
// into `p + q`. Step 3 is the only step that is a DECISION rather than a move
// ("which factor is easier for me to work with?") - that is the step the lesson
// is actually about, so its copy never gets shortened.
//
// Everything here is pure so the component is only a renderer and the copy is
// testable: npm run test:distributive-walkthrough.
//
// THE RULE THAT MATTERS MOST: a walkthrough must never demonstrate the problem
// the student is currently working. Solving the work in front of them is an
// escape hatch, and an escape hatch cheaper than the work gets used instead of
// the work - the same reason /homework-help has no "skip it" exit. Reach for
// walkthroughExampleFor() at every call site that knows the student's problem.

import {
  DISTRIBUTIVE_SIDE_MAX,
  DISTRIBUTIVE_SIDE_MIN,
  DISTRIBUTIVE_TOP_MAX,
  DISTRIBUTIVE_TOP_MIN,
  type DistributiveProblem,
} from "./distributiveProblems";

/** One worked example: `a x b`, with `b` cut into `split`. */
export interface WalkthroughProblem {
  a: number;                // the friendly factor - stays whole, out front
  b: number;                // the factor that gets split
  split: [number, number];  // how b breaks apart, in the order it is written
}

export interface WalkthroughStep {
  /** Rail label and the tail of each step button's aria-label. */
  label: string;
  title: string;
  sentence: string;
  /**
   * What the stage shows once this step has finished drawing, in words. The
   * stage itself is absolutely-positioned decorative glyphs, so this is the
   * only version of the picture a screen reader ever gets.
   */
  summary: string;
}

export const WALKTHROUGH_STEP_COUNT = 6;

/** The example this lesson is taught from, and the walkthrough's default. */
export const DEFAULT_WALKTHROUGH: WalkthroughProblem = { a: 5, b: 14, split: [10, 4] };

// Clamped to the same domain as the tool the walkthrough backs up, which is what
// keeps the stage's hand-tuned geometry honest: every numeral it can be asked to
// draw is at most three digits (20 x 40 = 800), so nothing overflows the fixed
// label widths and the stage never needs to shrink its own font.
const A_MIN = DISTRIBUTIVE_SIDE_MIN;
const A_MAX = DISTRIBUTIVE_SIDE_MAX;
const B_MIN = DISTRIBUTIVE_TOP_MIN;
const B_MAX = DISTRIBUTIVE_TOP_MAX;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * The split a sixth grader should reach for: pull the ten out and leave the
 * ones. Falls back to halves when there is no ten to pull (b under 11, or a
 * round b like 20, where 10 + 10 is the friendly cut).
 */
export function friendlySplit(b: number): [number, number] {
  const ones = b % 10;
  if (b > 10 && ones !== 0) return [b - ones, ones];
  const half = Math.floor(b / 2);
  return [b - half, half];
}

function splitFits(b: number, split: [number, number] | null | undefined): split is [number, number] {
  if (!split) return false;
  const [p, q] = split;
  return Number.isInteger(p) && Number.isInteger(q) && p >= 1 && q >= 1 && p + q === b;
}

/**
 * Bring anything - a URL param, a teacher's typed numbers, a props object - into
 * a problem the stage can actually draw. An unusable split is replaced rather
 * than rejected: the walkthrough always has something to show.
 */
export function normalizeWalkthrough(input: {
  a: number;
  b: number;
  split?: [number, number] | null;
}): WalkthroughProblem {
  const a = clamp(Math.round(input.a) || DEFAULT_WALKTHROUGH.a, A_MIN, A_MAX);
  const b = clamp(Math.round(input.b) || DEFAULT_WALKTHROUGH.b, B_MIN, B_MAX);
  const split = splitFits(b, input.split) ? input.split : friendlySplit(b);
  return { a, b, split };
}

/** The numbers each step writes, derived once so no caller recomputes them. */
export function walkthroughValues(problem: WalkthroughProblem) {
  const [p, q] = problem.split;
  return {
    a: problem.a,
    b: problem.b,
    p,
    q,
    firstProduct: problem.a * p,
    secondProduct: problem.a * q,
    total: problem.a * problem.b,
  };
}

/**
 * Where the target answer is parked. It rides to the right of the work on a
 * laptop or a projector and above it on a phone, and step 1's sentence points at
 * it out loud - so the words have to follow the layout rather than contradict it.
 */
export type AnswerLocation = "right" | "above";

const ANSWER_PHRASE: Record<AnswerLocation, string> = {
  right: "on the right",
  above: "up above",
};

/**
 * The six steps, with the numbers filled in. Titles are verbatim from the
 * lesson - they are the words said at the board, so they do not get reworded
 * per problem.
 */
export function walkthroughSteps(
  problem: WalkthroughProblem,
  options?: { answerLocation?: AnswerLocation },
): WalkthroughStep[] {
  const { a, b, p, q, firstProduct, secondProduct, total } = walkthroughValues(problem);
  const parked = ANSWER_PHRASE[options?.answerLocation || "right"];

  return [
    {
      label: "Rewrite",
      title: "Rewrite the problem",
      sentence:
        `Write it down where you can see it: ${a} × ${b}. Park the answer you're aiming for ` +
        `${parked} — that's what we'll check against.`,
      summary: `${a} times ${b} is written out. The answer to match is still blank.`,
    },
    {
      label: "Template",
      title: "Draw the template",
      sentence: "One box out front, then two boxes inside parentheses: [ ] ( [ ] + [ ] ).",
      summary: "An empty template: one box out front, then two boxes inside parentheses.",
    },
    {
      label: "Easier factor",
      title: "Which factor is easier to work with?",
      sentence: `${a} is the friendly one — circle it. It goes out front in spot 1.`,
      summary: `${a} is circled and written in the box out front.`,
    },
    {
      label: "Split",
      title: "Split the other factor",
      sentence: `Spots 2 and 3 need two numbers that add to ${b}. Use ${p} and ${q}.`,
      summary: `${b} is split into ${p} and ${q}, written in the two boxes inside the parentheses.`,
    },
    {
      label: "First product",
      title: "Multiply spot 1 by spot 2",
      sentence: `That's ${a} × ${p}. Write the multiplication first, then the answer: ${firstProduct}.`,
      summary: `${a} times ${p} is ${firstProduct}.`,
    },
    {
      label: "Add & check",
      title: "Multiply spot 1 by spot 3, then add",
      sentence:
        `${a} × ${q} = ${secondProduct}. Now ${firstProduct} + ${secondProduct} = ${total} ` +
        `— the same answer as ${a} × ${b}, so it checks out.`,
      summary:
        `${a} times ${q} is ${secondProduct}. ${firstProduct} plus ${secondProduct} is ${total}, ` +
        `the same as ${a} times ${b}.`,
    },
  ];
}

/** The whole method as one line, for the screen-reader summary of the stage. */
export function walkthroughEquation(problem: WalkthroughProblem): string {
  const { a, b, p, q, firstProduct, secondProduct, total } = walkthroughValues(problem);
  return (
    `${a} times ${b} equals ${a} times open paren ${p} plus ${q} close paren, ` +
    `which is ${firstProduct} plus ${secondProduct}, which is ${total}.`
  );
}

/**
 * The examples the walkthrough is allowed to demonstrate. Every one has a ten to
 * pull out of the split factor and single-digit products, so the picture stays
 * readable and the arithmetic never gets in the way of the method.
 */
export const WALKTHROUGH_EXAMPLES: readonly WalkthroughProblem[] = [
  { a: 5, b: 14, split: [10, 4] },
  { a: 6, b: 13, split: [10, 3] },
  { a: 4, b: 17, split: [10, 7] },
];

/**
 * Pick an example to walk through for a student who is stuck on `current`.
 *
 * Never returns the student's own problem. The point of the walkthrough is to
 * re-teach the method on a problem they are not being graded on; handing them a
 * solved copy of the one in front of them replaces the work instead of
 * unblocking it.
 */
export function walkthroughExampleFor(current?: DistributiveProblem | null): WalkthroughProblem {
  if (!current) return DEFAULT_WALKTHROUGH;
  // The tool splits `top` and keeps `side` out front, which is (b, a) here.
  const sameProblem = (example: WalkthroughProblem) =>
    example.a === current.side && example.b === current.top;
  return WALKTHROUGH_EXAMPLES.find((example) => !sameProblem(example)) || DEFAULT_WALKTHROUGH;
}

/**
 * Read a problem out of a query string, for the standalone /stuck route: any of
 * `?a=5&b=14&split=10,4`, `?split=10+4`, or nothing at all. Missing or unusable
 * values fall back through normalizeWalkthrough, so a mistyped link still opens
 * a working walkthrough rather than an error.
 */
export function parseWalkthroughParams(params: URLSearchParams): WalkthroughProblem {
  const num = (key: string) => {
    const raw = params.get(key);
    const value = raw == null ? NaN : Number(raw.trim());
    return Number.isFinite(value) ? value : NaN;
  };
  const a = num("a");
  const b = num("b");

  const rawSplit = params.get("split");
  let split: [number, number] | null = null;
  if (rawSplit) {
    const parts = rawSplit
      .split(/[,+\s]+/)
      .map((part) => Number(part.trim()))
      .filter((part) => Number.isFinite(part));
    if (parts.length === 2) split = [Math.round(parts[0]), Math.round(parts[1])];
  }

  return normalizeWalkthrough({
    a: Number.isFinite(a) ? a : DEFAULT_WALKTHROUGH.a,
    b: Number.isFinite(b) ? b : DEFAULT_WALKTHROUGH.b,
    split,
  });
}

/** The link that opens this problem's walkthrough full screen. */
export function walkthroughHref(problem: WalkthroughProblem): string {
  const { a, b, split } = problem;
  return `/stuck?a=${a}&b=${b}&split=${split[0]},${split[1]}`;
}
