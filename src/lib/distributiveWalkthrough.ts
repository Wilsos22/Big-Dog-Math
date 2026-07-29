// The "Stuck?" walkthrough - the animated version of a lesson's Help Path.
//
// This is homework and absence support, not a lesson surface. A student who was
// out, or who is at a kitchen table at 8pm, taps Stuck on the homepage and gets
// the SAME six help steps their teacher authored in Notion - one per screen,
// with the method drawing itself as they advance.
//
// THE WORDS COME FROM NOTION. `Help Path` on the lesson page is the authoring
// surface, so editing that property changes what the student reads and nothing
// here needs to change. This module only supplies what the property cannot: a
// short rail label per step, the worked numbers the animation draws, and a
// spoken description of the picture for a screen reader. If the authored path
// stops being six steps, walkthroughStepsFromHelpPath returns null and the
// caller falls back to the plain one-step-per-screen list - the stage draws six
// specific things, and animating a seven-step fraction routine with a
// distributive picture would be worse than not animating it at all.
//
// For M1.T1.L1 the authored path is:
//   1. Rewrite the problem.
//   2. Draw the template:  [   ] ( [   ] + [   ] )
//   3. Ask: which factor is easier for me to work with? ...
//   4. Spots 2 and 3: two numbers that add to the factor you are splitting.
//   5. Multiply spot 1 by spot 2.
//   6. Multiply spot 1 by spot 3. Add them. Does it match step 1?
//
// Step 3 is the only step that is a DECISION rather than a move, which is the
// whole point of the lesson; its built-in title stays a question.

import {
  DISTRIBUTIVE_SIDE_MAX,
  DISTRIBUTIVE_SIDE_MIN,
  DISTRIBUTIVE_TOP_MAX,
  DISTRIBUTIVE_TOP_MIN,
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
  /** What the student reads. Comes from Notion when the Help Path supplies it. */
  sentence: string;
  /**
   * What the stage shows once this step has finished drawing, in words. The
   * stage itself is absolutely-positioned decorative glyphs, so this is the
   * only version of the picture a screen reader ever gets.
   */
  summary: string;
}

export const WALKTHROUGH_STEP_COUNT = 6;

/**
 * The example the walkthrough demonstrates: M1.T1.L1's own independent problem
 * (the lesson's Screen Delivery tab shows 5 x 14 for exactly this beat). It is
 * deliberately NOT one of the problems on the practice sheet - the walkthrough
 * re-teaches the method, it does not do tonight's homework.
 */
export const DEFAULT_WALKTHROUGH: WalkthroughProblem = { a: 5, b: 14, split: [10, 4] };

// Clamped to the same domain as the tool this backs up, which is what keeps the
// stage's hand-tuned geometry honest: every numeral it can be asked to draw is
// at most three digits (20 x 40 = 800), so nothing overflows the fixed label
// widths and the stage never needs to shrink its own font.
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
 * Bring anything - a teacher's typed numbers, a props object - into a problem
 * the stage can actually draw. An unusable split is replaced rather than
 * rejected: the walkthrough always has something to show.
 */
export function normalizeWalkthrough(input: {
  a: number;
  b: number;
  split?: [number, number] | null;
}): WalkthroughProblem {
  const a = clamp(Math.round(input.a) || DEFAULT_WALKTHROUGH.a, A_MIN, A_MAX);
  const b = clamp(Math.round(input.b) || DEFAULT_WALKTHROUGH.b, B_MIN, B_MAX);
  return { a, b, split: splitFits(b, input.split) ? input.split : friendlySplit(b) };
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
 * laptop and above it on a phone, and the first step's fallback sentence points
 * at it out loud - so the words have to follow the layout rather than
 * contradict it.
 */
export type AnswerLocation = "right" | "above";

const ANSWER_PHRASE: Record<AnswerLocation, string> = {
  right: "on the right",
  above: "up above",
};

/**
 * Notion escapes markdown punctuation in text properties, so the Help Path's
 * `[   ] ( [   ] + [   ] )` template can arrive with backslashes in front of
 * every bracket. Left alone the student reads the escape characters. Related
 * hazard, already documented: never author `___` in a Notion text property -
 * the parser eats it.
 */
function unescapeNotionText(line: string): string {
  return line.replace(/\\([[\]()*_`#+.\-!])/g, "$1");
}

/**
 * Split an authored Help Path into steps.
 *
 * The property is one step per line. Leading "1." / "1)" / "-" numbering is
 * stripped because every surface that renders it supplies its own step counter,
 * and a teacher writes the list either way.
 */
export function parseHelpPath(helpPath: string | null | undefined): string[] {
  return (helpPath || "")
    .split(/\r?\n/)
    .map((line) => unescapeNotionText(line.replace(/^\s*(?:\d+\s*[.)]|[-*•])\s*/, "").trim()))
    .filter(Boolean);
}

/**
 * The six steps with the built-in copy, used when no authored Help Path is
 * available to speak for itself. Titles are the words said at the board.
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
      sentence: "One box out front, then two boxes inside parentheses: [   ] ( [   ] + [   ] ).",
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

/**
 * The six steps with the TEACHER'S authored words, which is the point of the
 * feature: the student reads the same help path their teacher wrote in Notion,
 * animated.
 *
 * Returns null when the authored path is not six steps. The stage draws six
 * specific things in a fixed order, so a path of any other length is a path
 * this animation cannot honestly illustrate - the caller falls back to the
 * plain one-step-per-screen list rather than showing the wrong picture. The
 * numbers stay out of the words on purpose: they are drawn on the stage, where
 * the student can watch them land.
 */
export function walkthroughStepsFromHelpPath(
  problem: WalkthroughProblem,
  helpPath: string | null | undefined,
  options?: { answerLocation?: AnswerLocation },
): WalkthroughStep[] | null {
  const authored = parseHelpPath(helpPath);
  if (authored.length !== WALKTHROUGH_STEP_COUNT) return null;
  return walkthroughSteps(problem, options).map((step, i) => ({
    ...step,
    sentence: authored[i],
  }));
}

/** The whole method as one line, for the screen-reader summary of the stage. */
export function walkthroughEquation(problem: WalkthroughProblem): string {
  const { a, b, p, q, firstProduct, secondProduct, total } = walkthroughValues(problem);
  return (
    `${a} times ${b} equals ${a} times open paren ${p} plus ${q} close paren, ` +
    `which is ${firstProduct} plus ${secondProduct}, which is ${total}.`
  );
}
