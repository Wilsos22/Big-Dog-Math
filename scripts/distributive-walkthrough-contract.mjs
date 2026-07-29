// Contract for the "Stuck?" distributive walkthrough (M1.T1.L1).
//
// The one that matters in the room: THE WORDS COME FROM NOTION. The student is
// meant to read the same six help steps their teacher authored on the lesson
// page, animated - so the authored path drives the copy, and a path that is not
// six steps must refuse to animate rather than illustrate the wrong routine.
// Everything else here protects the built-in fallback copy and the number ranges
// the stage's hand-tuned geometry can actually draw.
//
// Run: npm run test:distributive-walkthrough

import assert from "node:assert/strict";
import {
  DEFAULT_WALKTHROUGH,
  WALKTHROUGH_STEP_COUNT,
  friendlySplit,
  normalizeWalkthrough,
  parseHelpPath,
  walkthroughEquation,
  walkthroughSteps,
  walkthroughStepsFromHelpPath,
  walkthroughValues,
} from "../.tmp-mastery/distributiveWalkthrough.js";

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  console.log(`  ok  ${name}`);
}

console.log("distributive-walkthrough contract");

check("six steps, and the titles are the words used at the board", () => {
  const steps = walkthroughSteps(DEFAULT_WALKTHROUGH);
  assert.equal(WALKTHROUGH_STEP_COUNT, 6);
  assert.equal(steps.length, 6);
  assert.deepEqual(steps.map((s) => s.title), [
    "Rewrite the problem",
    "Draw the template",
    "Which factor is easier to work with?",
    "Split the other factor",
    "Multiply spot 1 by spot 2",
    "Multiply spot 1 by spot 3, then add",
  ]);
  // Step 3 is the lesson's only decision rather than a move. If this stops
  // being a question, the lesson has lost its point.
  assert.ok(steps[2].title.endsWith("?"));
});

check("every step carries a rail label, a sentence and a spoken summary", () => {
  for (const step of walkthroughSteps(DEFAULT_WALKTHROUGH)) {
    for (const field of ["label", "title", "sentence", "summary"]) {
      assert.equal(typeof step[field], "string", `${field} missing`);
      assert.ok(step[field].trim().length > 0, `${field} empty`);
    }
  }
});

check("the sentences carry the problem's own numbers, not the default's", () => {
  const problem = { a: 6, b: 13, split: [10, 3] };
  const steps = walkthroughSteps(problem);
  assert.match(steps[0].sentence, /6 × 13/);
  assert.match(steps[2].sentence, /^6 is the friendly one/);
  assert.match(steps[3].sentence, /add to 13\. Use 10 and 3\./);
  assert.match(steps[4].sentence, /6 × 10.*: 60\./);
  assert.match(steps[5].sentence, /6 × 3 = 18\. Now 60 \+ 18 = 78/);
  // Nothing anywhere may leak the example the copy was written against.
  for (const step of steps) assert.doesNotMatch(step.sentence, /14|70/);
});

check("multiplication is always the times sign, never the letter x", () => {
  for (const step of walkthroughSteps({ a: 5, b: 14, split: [10, 4] })) {
    assert.doesNotMatch(step.sentence, /\d\s*x\s*\d/);
  }
});

check("step 1's sentence points where the answer actually is", () => {
  const right = walkthroughSteps(DEFAULT_WALKTHROUGH, { answerLocation: "right" });
  const above = walkthroughSteps(DEFAULT_WALKTHROUGH, { answerLocation: "above" });
  assert.match(right[0].sentence, /on the right/);
  assert.match(above[0].sentence, /up above/);
  assert.doesNotMatch(above[0].sentence, /on the right/);
  // Default is the wide layout, which is what a projector and a Chromebook get.
  assert.match(walkthroughSteps(DEFAULT_WALKTHROUGH)[0].sentence, /on the right/);
});

check("friendlySplit pulls the ten out, and halves when there is no ten to pull", () => {
  assert.deepEqual(friendlySplit(14), [10, 4]);
  assert.deepEqual(friendlySplit(27), [20, 7]);
  assert.deepEqual(friendlySplit(39), [30, 9]);
  assert.deepEqual(friendlySplit(20), [10, 10]);
  assert.deepEqual(friendlySplit(10), [5, 5]);
  assert.deepEqual(friendlySplit(8), [4, 4]);
  assert.deepEqual(friendlySplit(7), [4, 3]);
  assert.deepEqual(friendlySplit(3), [2, 1]);
});

check("every friendlySplit adds back to the number it split", () => {
  for (let b = 3; b <= 40; b += 1) {
    const [p, q] = friendlySplit(b);
    assert.equal(p + q, b, `split of ${b} does not add back`);
    assert.ok(p >= 1 && q >= 1, `split of ${b} has an empty part`);
  }
});

check("normalizeWalkthrough repairs a split that does not add up", () => {
  assert.deepEqual(normalizeWalkthrough({ a: 5, b: 14, split: [9, 9] }).split, [10, 4]);
  assert.deepEqual(normalizeWalkthrough({ a: 5, b: 14, split: [14, 0] }).split, [10, 4]);
  assert.deepEqual(normalizeWalkthrough({ a: 5, b: 14, split: null }).split, [10, 4]);
  // A split that works is left exactly as the teacher wrote it, even a non-ten.
  assert.deepEqual(normalizeWalkthrough({ a: 5, b: 14, split: [7, 7] }).split, [7, 7]);
});

check("normalizeWalkthrough clamps to numbers the stage can draw", () => {
  const huge = normalizeWalkthrough({ a: 9999, b: 9999 });
  assert.ok(huge.a <= 20 && huge.b <= 40, `clamp failed: ${JSON.stringify(huge)}`);
  const tiny = normalizeWalkthrough({ a: 0, b: 0 });
  assert.deepEqual(tiny, DEFAULT_WALKTHROUGH);
  // Three digits is the widest numeral the fixed label widths hold.
  assert.ok(String(walkthroughValues(huge).total).length <= 3);
});



check("values derive the products and the total from the split", () => {
  const values = walkthroughValues({ a: 5, b: 14, split: [10, 4] });
  assert.deepEqual(values, { a: 5, b: 14, p: 10, q: 4, firstProduct: 50, secondProduct: 20, total: 70 });
  // The point of the last step: the two routes have to agree.
  assert.equal(values.firstProduct + values.secondProduct, values.total);
});



// The real M1.T1.L1 `Help Path` property, verbatim from the lesson page.
const M1T1L1_HELP_PATH = [
  "1. Rewrite the problem.",
  "2. Draw the template:  [   ] ( [   ] + [   ] )",
  "3. Ask: which factor is easier for me to work with? That one goes out front. Split the other one.",
  "4. Spots 2 and 3: two numbers that add to the factor you are splitting.",
  "5. Multiply spot 1 by spot 2.",
  "6. Multiply spot 1 by spot 3. Add them. Does it match step 1?",
].join("\n");

check("the Help Path parses to one step per line, numbering stripped", () => {
  const steps = parseHelpPath(M1T1L1_HELP_PATH);
  assert.equal(steps.length, 6);
  assert.equal(steps[0], "Rewrite the problem.");
  assert.match(steps[2], /^Ask: which factor/);
  // The screen supplies its own counter, so no step may still carry one.
  for (const step of steps) assert.doesNotMatch(step, /^\s*(?:\d+\s*[.)]|[-*•])/);
});

check("Notion's escaped brackets are unescaped before a student reads them", () => {
  // Notion escapes markdown punctuation in text properties. Left alone the
  // student reads the backslashes.
  const steps = parseHelpPath("1. Draw the template:  \\[   \\] ( \\[   \\] + \\[   \\] )");
  assert.equal(steps[0], "Draw the template:  [   ] ( [   ] + [   ] )");
  assert.doesNotMatch(steps[0], /\\/);
});

check("the authored Help Path becomes the words the student reads", () => {
  const steps = walkthroughStepsFromHelpPath(DEFAULT_WALKTHROUGH, M1T1L1_HELP_PATH);
  assert.ok(steps, "the real M1.T1.L1 help path must animate");
  assert.equal(steps.length, 6);
  const authored = parseHelpPath(M1T1L1_HELP_PATH);
  assert.deepEqual(steps.map((s) => s.sentence), authored);
  // The built-in copy is replaced, not appended to.
  const builtIn = walkthroughSteps(DEFAULT_WALKTHROUGH);
  for (let i = 0; i < steps.length; i += 1) {
    assert.notEqual(steps[i].sentence, builtIn[i].sentence);
    // The rail label, heading and spoken picture still come from here.
    assert.equal(steps[i].label, builtIn[i].label);
    assert.equal(steps[i].title, builtIn[i].title);
    assert.equal(steps[i].summary, builtIn[i].summary);
  }
});

check("a Help Path that is not six steps refuses to animate", () => {
  // The stage draws six specific things in a fixed order. Illustrating some
  // other routine with a distributive picture is worse than not animating, so
  // the caller has to be told to fall back to the plain list.
  assert.equal(walkthroughStepsFromHelpPath(DEFAULT_WALKTHROUGH, ""), null);
  assert.equal(walkthroughStepsFromHelpPath(DEFAULT_WALKTHROUGH, null), null);
  assert.equal(walkthroughStepsFromHelpPath(DEFAULT_WALKTHROUGH, "1. Only one step."), null);
  const sevenSteps = Array.from({ length: 7 }, (_, i) => `${i + 1}. Step ${i + 1}.`).join("\n");
  assert.equal(walkthroughStepsFromHelpPath(DEFAULT_WALKTHROUGH, sevenSteps), null);
  // Blank lines in the property are not steps and must not break the match.
  assert.ok(walkthroughStepsFromHelpPath(DEFAULT_WALKTHROUGH, `\n${M1T1L1_HELP_PATH}\n\n`));
});

check("the spoken equation says the whole method out loud", () => {
  const spoken = walkthroughEquation(DEFAULT_WALKTHROUGH);
  assert.equal(
    spoken,
    "5 times 14 equals 5 times open paren 10 plus 4 close paren, which is 50 plus 20, which is 70.",
  );
  // Nothing a screen reader has to read may contain a bare times sign.
  assert.doesNotMatch(spoken, /×/);
});

console.log(`\n${checks} distributive-walkthrough checks passed`);
