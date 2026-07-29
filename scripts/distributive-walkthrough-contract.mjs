// Contract for the "Stuck?" distributive walkthrough (M1.T1.L1).
//
// The one that matters in the room: the walkthrough NEVER demonstrates the
// problem the student is currently working. A helper that solves the question in
// front of them replaces the work instead of unblocking it, which is the same
// reason /homework-help has no skip button. Everything else here protects the
// step copy (those titles are the words said at the board) and the number ranges
// the stage's hand-tuned geometry can actually draw.
//
// Run: npm run test:distributive-walkthrough

import assert from "node:assert/strict";
import {
  DEFAULT_WALKTHROUGH,
  WALKTHROUGH_EXAMPLES,
  WALKTHROUGH_STEP_COUNT,
  friendlySplit,
  normalizeWalkthrough,
  parseWalkthroughParams,
  walkthroughEquation,
  walkthroughExampleFor,
  walkthroughHref,
  walkthroughSteps,
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

check("the walkthrough never demonstrates the student's own problem", () => {
  // The tool splits `top` and keeps `side` out front, so 14 x 5 in tool terms is
  // exactly the default example. A stuck student on that problem must be shown
  // a different one.
  const shown = walkthroughExampleFor({ top: 14, side: 5 });
  assert.notEqual(`${shown.a}x${shown.b}`, "5x14");
  assert.deepEqual(shown, { a: 6, b: 13, split: [10, 3] });

  // And every other problem still gets the example the lesson is taught from.
  assert.deepEqual(walkthroughExampleFor({ top: 24, side: 7 }), DEFAULT_WALKTHROUGH);
  assert.deepEqual(walkthroughExampleFor(null), DEFAULT_WALKTHROUGH);
  assert.deepEqual(walkthroughExampleFor(), DEFAULT_WALKTHROUGH);

  // No matter which problem is on screen, something openable comes back and it
  // is never that problem.
  for (let top = 3; top <= 40; top += 1) {
    for (let side = 2; side <= 20; side += 1) {
      const example = walkthroughExampleFor({ top, side });
      assert.ok(example, `no example for ${top}x${side}`);
      assert.ok(
        !(example.a === side && example.b === top),
        `walkthrough would solve the student's own ${top}x${side}`,
      );
    }
  }
});

check("every curated example is drawable and has a friendly split", () => {
  assert.ok(WALKTHROUGH_EXAMPLES.length >= 2, "one example cannot avoid itself");
  for (const example of WALKTHROUGH_EXAMPLES) {
    const [p, q] = example.split;
    assert.equal(p + q, example.b, `${example.a}x${example.b} split does not add back`);
    // A ten to pull out is the whole strategy the lesson teaches.
    assert.ok(p % 10 === 0 || q % 10 === 0, `${example.a}x${example.b} has no ten in its split`);
    // Same clamp the stage geometry depends on.
    assert.deepEqual(normalizeWalkthrough(example), example);
    const values = walkthroughValues(example);
    for (const n of [values.firstProduct, values.secondProduct, values.total]) {
      assert.ok(String(n).length <= 3, `${n} is too wide for the stage`);
    }
  }
});

check("values derive the products and the total from the split", () => {
  const values = walkthroughValues({ a: 5, b: 14, split: [10, 4] });
  assert.deepEqual(values, { a: 5, b: 14, p: 10, q: 4, firstProduct: 50, secondProduct: 20, total: 70 });
  // The point of the last step: the two routes have to agree.
  assert.equal(values.firstProduct + values.secondProduct, values.total);
});

check("query params open the problem they name", () => {
  const parse = (query) => parseWalkthroughParams(new URLSearchParams(query));
  assert.deepEqual(parse("a=6&b=13&split=10,3"), { a: 6, b: 13, split: [10, 3] });
  assert.deepEqual(parse("a=6&b=13&split=10+3"), { a: 6, b: 13, split: [10, 3] });
  assert.deepEqual(parse("a=6&b=13"), { a: 6, b: 13, split: [10, 3] });
  // A mistyped link still opens a working walkthrough rather than an error.
  assert.deepEqual(parse(""), DEFAULT_WALKTHROUGH);
  assert.deepEqual(parse("a=abc&b=&split=nonsense"), DEFAULT_WALKTHROUGH);
  assert.deepEqual(parse("a=5&b=14&split=3"), DEFAULT_WALKTHROUGH);
});

check("the href round-trips through the parser", () => {
  for (const example of WALKTHROUGH_EXAMPLES) {
    const href = walkthroughHref(example);
    assert.ok(href.startsWith("/stuck?"), href);
    const parsed = parseWalkthroughParams(new URLSearchParams(href.slice(href.indexOf("?") + 1)));
    assert.deepEqual(parsed, example);
  }
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
