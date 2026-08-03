// Contract: the Direction Screen's pure sizing + formatting hold to the design spec and never
// produce an illegible or malformed projector value.
//
// WHY THIS EXISTS. The Direction Screen is the native auto-default info frame - composed from a
// Notion step every day with no human in the loop - so the one piece of real logic (auto-fit) has
// to degrade predictably. Three ways it could fail quietly, all pinned here:
//   1. The headline growing past its two design sizes, or shrinking below the back-of-room floor.
//   2. The clock formatting wrong (a projector reading "45:00" for 45 seconds, or "-1:-5").
//   3. The step counter reading "Part 0 of 0" instead of dropping when there is no position.
//
// Run: npm run test:direction-screen

import assert from "node:assert/strict";
import {
  DIRECTION_FONT_MAX,
  DIRECTION_FONT_FLOOR,
  directionFontSize,
  planStepFontSize,
  formatClock,
  stepLabel,
  planSteps,
} from "../.tmp-mastery/directionScreen.js";

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  console.log(`  ok  ${name}`);
}

// The two hand-picked sizes from the Claude Design export.
check("short design direction is 112px", () => {
  assert.equal(directionFontSize("Solve problems 1–4 on your own."), 112);
});
check("long design direction is 92px", () => {
  assert.equal(
    directionFontSize("Solve problems 1–4 on your own, show every step, and circle the answer you are most sure about."),
    92,
  );
});

check("headline is bounded by max and floor", () => {
  for (const text of ["", "x", "a".repeat(30), "a".repeat(300)]) {
    const size = directionFontSize(text);
    assert.ok(size <= DIRECTION_FONT_MAX, `${size} <= ${DIRECTION_FONT_MAX}`);
    assert.ok(size >= DIRECTION_FONT_FLOOR, `${size} >= ${DIRECTION_FONT_FLOOR}`);
  }
});

check("headline size never grows as text lengthens", () => {
  let prev = Infinity;
  for (let len = 0; len <= 300; len += 5) {
    const size = directionFontSize("a".repeat(len));
    assert.ok(size <= prev, `len ${len}: ${size} <= ${prev}`);
    prev = size;
  }
});

check("very long direction hits the floor", () => {
  assert.equal(directionFontSize("a".repeat(200)), DIRECTION_FONT_FLOOR);
});

check("plan step size shrinks with count, three reads big", () => {
  assert.equal(planStepFontSize(1), 72);
  assert.equal(planStepFontSize(3), 72);
  assert.equal(planStepFontSize(4), 60);
  assert.equal(planStepFontSize(5), 52);
  assert.equal(planStepFontSize(8), 46);
});

check("clock formats seconds as m:ss", () => {
  assert.equal(formatClock(480), "8:00");
  assert.equal(formatClock(45), "0:45");
  assert.equal(formatClock(2520), "42:00");
  assert.equal(formatClock(5), "0:05");
  assert.equal(formatClock(65), "1:05");
});

check("clock clamps garbage to 0:00", () => {
  assert.equal(formatClock(0), "0:00");
  assert.equal(formatClock(-5), "0:00");
  assert.equal(formatClock(NaN), "0:00");
  assert.equal(formatClock(null), "0:00");
  assert.equal(formatClock(undefined), "0:00");
});

check("step counter reads Part N of M, clamps, and drops when absent", () => {
  assert.equal(stepLabel(3, 4), "Part 3 of 4");
  assert.equal(stepLabel(5, 4), "Part 4 of 4"); // clamp N to M
  assert.equal(stepLabel(0, 4), "");
  assert.equal(stepLabel(1, 0), "");
  assert.equal(stepLabel(null, 4), "");
  assert.equal(stepLabel(3, null), "");
});

check("plan steps split lines, drop blanks, strip numbering", () => {
  assert.deepEqual(planSteps("a\nb\n\n  c "), ["a", "b", "c"]);
  assert.deepEqual(planSteps("1. Warm-up\n2) Ratio tables"), ["Warm-up", "Ratio tables"]);
  assert.deepEqual(planSteps(""), []);
});

console.log(`\nDirection Screen contract: ${checks} checks passed.`);
