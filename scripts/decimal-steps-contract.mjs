// Contract for the guided decimal tool (/decimal-steps).
//
// The one that matters in the room: THE SET-UP QUESTION HAS A DIFFERENT RIGHT
// ANSWER FOR EVERY OPERATION. Adding and subtracting line up the decimal
// points; multiplying lines up the right edges and counts places at the end;
// dividing moves the decimal until the divisor is whole. A student who answers
// "line up the decimals" for all four has the misconception this tool exists to
// catch, so a change that makes one answer serve every operation has broken the
// point of it.
//
// The rest guards the things that were actually wrong while building it: a
// distractor word-for-word identical to the correct answer, a product and a
// difference laid into the same grid row so the product vanished, a question
// about a column the answer never reaches, and float drift.
//
// Run: npm run test:decimal-steps

import assert from "node:assert/strict";
import {
  DECIMAL_MAX_QUOTIENT_PLACES,
  DEFAULT_DECIMAL_SET,
  buildDecimalTrace,
  formatDec,
  normalizeDecimalSet,
  parseDec,
  parseDecimalSet,
  trimTrailingZeros,
} from "../.tmp-mastery/decimalSteps.js";

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  console.log(`  ok  ${name}`);
}

const traceFor = (text) => {
  const { problems, rejected } = parseDecimalSet(text);
  assert.equal(problems.length, 1, `${text} should parse (${JSON.stringify(rejected)})`);
  const t = buildDecimalTrace(problems[0]);
  assert.ok(t, `${text} should build a trace`);
  return t;
};
const correctOf = (step) => step.choices.find((c) => c.correct).text;
const inputOf = (step) => step.input.expect;
const stepById = (t, id) => t.steps.find((s) => s.id === id);

console.log("decimal-steps contract");

check("the set-up question's right answer changes with the operation", () => {
  assert.match(correctOf(stepById(traceFor("12.4 + 3.75"), "lineup")), /decimal points/i);
  assert.match(correctOf(stepById(traceFor("8.3 - 4.68"), "lineup")), /decimal points/i);
  // Multiplying is the contrast: right edges, decimals ignored until the end.
  const mul = correctOf(stepById(traceFor("6.2 x 0.4"), "lineup"));
  assert.match(mul, /right-hand edges/i);
  assert.match(mul, /ignore the decimals/i);
  // And "line up the decimal points" must be OFFERED there and be wrong - that
  // is the whole misconception, so it cannot quietly stop being a choice.
  const mulStep = stepById(traceFor("6.2 x 0.4"), "lineup");
  const trap = mulStep.choices.find((c) => /line up the decimal points/i.test(c.text));
  assert.ok(trap, "multiplying must still offer the adding rule as a trap");
  assert.equal(trap.correct, false);
  // Dividing asks something else entirely.
  assert.match(correctOf(stepById(traceFor("9.6 / 0.4"), "setup")), /divisor is a whole number/i);
});

check("every walk opens by naming the operation, then estimating", () => {
  // Steele: "students shold have to select what operation are we doing? before
  // anything" and "we should make an estimation feature first".
  for (const text of ["12.4 + 3.75", "8.3 - 4.68", "6.2 x 0.4", "9.6 / 0.4"]) {
    const t = traceFor(text);
    assert.equal(t.steps[0].id, "operation");
    assert.equal(t.steps[0].kind, "choice");
    assert.equal(t.steps[0].choices.length, 4);
    assert.equal(t.steps[1].id, "estimate");
    assert.equal(t.steps[1].kind, "input");
    // An estimate is judged by nearness, or a student who rounds sensibly fails.
    assert.ok(t.steps[1].input.tolerance > 0);
  }
});

check("division walks Steele's script, in order", () => {
  const t = traceFor("9.6 / 0.4");
  const ids = t.steps.map((s) => s.id);
  assert.deepEqual(ids.slice(2, 8), ["setup", "howfar", "move-divisor", "and-the-other", "move-dividend", "qpoint"]);
  assert.deepEqual(t.steps.slice(8, 12).map((s) => s.rail), ["Divide", "Multiply", "Subtract", "Bring down"]);
  // "how many 4's are in 9 without going over?" - Steele's words, and the
  // words used at the board.
  const divide = t.steps.find((s) => s.id === "divide-0");
  assert.match(divide.question, /how many 4's are in 9 without going over/i);
  assert.equal(divide.kind, "input");
});

check("naming the number of places is not enough - the decimal has to be moved", () => {
  const t = traceFor("9.6 / 0.25");
  const divisor = stepById(t, "move-divisor");
  const dividend = stepById(t, "and-the-other");
  assert.deepEqual(divisor.action, { kind: "move-decimal", target: "divisor", places: 2, direction: "right" });
  assert.deepEqual(stepById(t, "move-dividend").action, { kind: "move-decimal", target: "dividend", places: 2, direction: "right" });
  assert.equal(divisor.kind, "move");
  assert.equal(t.shift, 2);
  // Moving only the divisor is the error, so it has to be an offered choice.
  const leaveIt = dividend.choices.find((c) => /leave it where it is/i.test(c.text));
  assert.ok(leaveIt);
  assert.equal(leaveIt.correct, false);
});

check("a divisor that is already whole gets a different question", () => {
  const t = traceFor("4.5 / 5");
  assert.equal(t.shift, 0);
  // No move steps at all, and the right answer is that nothing needs moving -
  // NOT an instruction to move a decimal that has nowhere to go.
  assert.ok(!t.steps.some((s) => s.action));
  assert.match(correctOf(stepById(t, "setup")), /already a whole number/i);
});

check("the product's decimal is counted, aimed, and then physically moved", () => {
  // Steele: "it should ask them to count the numbers to the right of the
  // decimal they input that number and then it asks which direction and how
  // many spots and they press the left button".
  const t = traceFor("6.2 x 0.4");
  const count = stepById(t, "count");
  assert.equal(count.kind, "input");
  assert.equal(inputOf(count), "2");
  assert.match(count.input.hint, /Add them, do not take the bigger one/);
  const dir = stepById(t, "direction");
  assert.equal(correctOf(dir), "Left");
  const move = stepById(t, "move-product");
  assert.deepEqual(move.action, { kind: "move-decimal", target: "product", places: 2, direction: "left" });
});

check("multiplying is two digits at a time, never a whole row at once", () => {
  // Steele: "we can only multiple 2 numbers at once. So we strt with the 4 and
  // the 2". A step that multiplies a row in one go is the answer appearing.
  const t = traceFor("6.2 x 0.4");
  const pairs = t.steps.filter((s) => s.id.startsWith("mul-"));
  assert.equal(pairs.length, 2, "62 x 4 is two digit pairs");
  assert.deepEqual(pairs.map((s) => s.rail), ["4 x 2", "4 x 6"]);
  for (const s of pairs) assert.equal(s.kind, "input");
  assert.ok(!t.steps.some((s) => /every digit of/i.test(s.question)));
});

check("the correct answer is not parked in the first slot", () => {
  // Steele: "make sure the correct answer isnt in the first slot every itme".
  // Every builder writes the right answer first, so without seating, a student
  // beats the tool by always tapping the top button.
  let first = 0;
  let total = 0;
  for (const text of ["12.4 + 3.75", "10.4 - 3.75", "3.6 x 2.4", "0.25 x 0.4", "9.6 / 0.4", "7.35 / 2.1", "1.2 / 0.03", "4.5 / 5", "100.5 - 99.75", "6.2 x 3"]) {
    for (const s of traceFor(text).steps) {
      if (s.kind !== "choice" || s.choices.length < 2) continue;
      total += 1;
      if (s.choices[0].correct) first += 1;
    }
  }
  assert.ok(total > 20, "needs a real sample");
  // Seating is deterministic, so this is a fact about the build, not a flake.
  assert.ok(first < total * 0.55, `correct sat first in ${first} of ${total} choice steps`);
  assert.ok(first > 0, "an order that never puts it first is just as learnable");
});

check("arithmetic is typed, decisions are chosen", () => {
  // The shift Steele asked for: "students should have to enter the value of the
  // addition in the answer". Picking 9 + 7 = 16 off a list is recognition.
  const add = traceFor("12.4 + 3.75");
  for (const s of add.steps.filter((s) => s.id.startsWith("col-") && !s.id.includes("-"))) {
    assert.equal(s.kind, "input");
  }
  const cols = add.steps.filter((s) => /^col-\d+$/.test(s.id));
  assert.ok(cols.length >= 4);
  for (const s of cols) assert.equal(s.kind, "input");
  // ... and the set-up rules are still choices.
  assert.equal(stepById(add, "lineup").kind, "choice");
  assert.equal(stepById(add, "point").kind, "choice");
});

check("a carry is decided, then physically written into a box", () => {
  // Steele: "what do we do with the second 1? and they write carry it. and rhey
  // have to physically put the one in a small box over the 2".
  const t = traceFor("12.4 + 3.75");
  const what = stepById(t, "col-2-what");
  const write = stepById(t, "col-2-write");
  assert.ok(what && write, "a carrying column needs both moves");
  assert.equal(what.kind, "choice");
  assert.match(what.question, /does not fit in one column/i);
  assert.equal(write.kind, "input");
  assert.equal(inputOf(write), "1");
  // The box is a real cell on the board, not a number that appears by itself.
  const box = t.cells.find((c) => c.id === write.input.fills[0]);
  assert.ok(box, "the carry box must exist on the board");
  assert.equal(box.kind, "carrybox");
  assert.equal(box.row, "carry");
});

check("every step has exactly one right answer and no repeated choice", () => {
  for (const text of ["12.4 + 3.75", "10.4 - 3.75", "3.6 x 2.4", "0.25 x 0.4", "9.6 / 0.4", "7.35 / 2.1", "1.2 / 0.03", "4.5 / 5", "100.5 - 99.75"]) {
    const t = traceFor(text);
    for (const s of t.steps) {
      if (s.kind === "choice") {
        assert.equal(s.choices.filter((c) => c.correct).length, 1, `${text} / ${s.id}`);
        assert.equal(new Set(s.choices.map((c) => c.text)).size, s.choices.length, `${text} / ${s.id} repeats a choice`);
        for (const c of s.choices) assert.ok(c.why.trim(), `${text} / ${s.id} has a choice with no reason`);
      }
      if (s.kind === "input") {
        assert.ok(s.input, `${text} / ${s.id} is an input step with no input`);
        assert.ok(s.input.expect.length, `${text} / ${s.id} expects nothing`);
        assert.ok(s.input.hint.trim(), `${text} / ${s.id} has no nudge`);
      }
      if (s.kind === "move") assert.ok(s.action, `${text} / ${s.id} is a move with no action`);
    }
  }
});

check("nothing on the board is unreachable, and nothing reveals a cell that is not there", () => {
  for (const text of ["12.4 + 3.75", "10.4 - 3.75", "3.6 x 2.4", "9.6 / 0.4", "7.35 / 2.1", "100.5 - 99.75"]) {
    const t = traceFor(text);
    const ids = new Set([...t.cells.map((c) => c.id), ...t.markers.map((m) => m.id)]);
    const revealed = new Set(t.steps.flatMap((s) => s.reveal));
    for (const s of t.steps) {
      for (const id of [...s.reveal, ...s.highlight]) assert.ok(ids.has(id), `${text} / ${s.id} points at missing ${id}`);
    }
    for (const x of [...t.cells, ...t.markers]) assert.ok(revealed.has(x.id), `${text} leaves ${x.id} on the board forever`);
  }
});

check("in long division the product and the difference are separate rows", () => {
  // They were laid into one row once, and the grid silently dropped the
  // product - the board showed a subtraction with nothing to subtract.
  const t = traceFor("7.35 / 2.1");
  for (const cell of t.cells) {
    if (/^w\d+-/.test(cell.id)) assert.match(cell.row, /^work\d+$/, `${cell.id} is not on a work row`);
    if (/^r\d+-/.test(cell.id)) assert.match(cell.row, /^rest\d+$/, `${cell.id} is not on a rest row`);
  }
  const collisions = new Map();
  for (const cell of t.cells) {
    const key = `${cell.row}:${cell.col}`;
    assert.ok(!collisions.has(key), `two cells share ${key}: ${collisions.get(key)} and ${cell.id}`);
    collisions.set(key, cell.id);
  }
});

check("the arithmetic is exact - no float drift anywhere", () => {
  // 0.1 + 0.2 is the canonical float trap and has to come out 0.3.
  assert.equal(traceFor("0.1 + 0.2").answerText, "0.3");
  const table = [
    ["12.4 + 3.75", "16.15"], ["8.3 - 4.68", "3.62"], ["10.4 - 3.75", "6.65"],
    ["100.5 - 99.75", "0.75"], ["6.2 x 0.4", "2.48"], ["3.6 x 2.4", "8.64"],
    ["9.6 / 0.4", "24"], ["7.35 / 2.1", "3.5"], ["9.6 / 0.25", "38.4"],
    ["1.2 / 0.03", "40"], ["4.5 / 5", "0.9"],
  ];
  for (const [text, answer] of table) assert.equal(traceFor(text).answerText, answer, text);
});

check("a product keeps the algorithm's trailing zeros, and names the tidy value too", () => {
  // 0.25 x 0.4 really is 0.100 out of the algorithm. Showing that and THEN
  // naming it 0.1 is what makes the trailing zero stop being mysterious - so
  // the board must not quietly tidy it away.
  const t = traceFor("0.25 x 0.4");
  assert.equal(t.answerText, "0.100");
  assert.equal(trimTrailingZeros(t.answerText), "0.1");
  // And a digit always sits left of the point, never a bare ".100".
  assert.match(t.answerText, /^\d/);
});

check("a problem the board cannot walk is refused OUT LOUD, never silently", () => {
  const { problems, rejected } = parseDecimalSet("10 / 3, 4.2 - 9.1, 5 / 0, banana, 12.4 + 3.75");
  assert.equal(problems.length, 1);
  const reasons = Object.fromEntries(rejected.map((r) => [r.text, r.reason]));
  assert.match(reasons["10 / 3"], new RegExp(`${DECIMAL_MAX_QUOTIENT_PLACES} decimal places`));
  assert.match(reasons["4.2 - 9.1"], /negative/);
  assert.match(reasons["5 / 0"], /divide by zero/);
  assert.match(reasons["banana"], /not a problem/);
});

check("the set format round-trips and takes every operator a teacher might type", () => {
  const { problems } = parseDecimalSet("1.5+2.5; 4.5−1.5\n2.5×2, 9/3, 8.4÷2.1, 3*1.5");
  assert.deepEqual(problems.map((p) => p.op), ["+", "-", "x", "/", "/", "x"]);
  const normalized = normalizeDecimalSet("12.4+3.75 , 9.6/0.4");
  assert.equal(normalized, "12.4 + 3.75, 9.6 / 0.4");
  assert.equal(normalizeDecimalSet(normalized), normalized);
  assert.equal(normalizeDecimalSet(""), "");
  assert.equal(normalizeDecimalSet(null), "");
});

check("numbers are held exactly, and out-of-range ones are refused", () => {
  assert.deepEqual(parseDec("12.4"), { text: "12.4", int: 124, places: 1 });
  assert.deepEqual(parseDec("3"), { text: "3", int: 3, places: 0 });
  assert.equal(formatDec(1615, 2), "16.15");
  assert.equal(formatDec(75, 2), "0.75");
  assert.equal(parseDec("1.2345"), null); // too many places
  assert.equal(parseDec("12345"), null); // too many digits
  assert.equal(parseDec("-1.5"), null);
  assert.equal(parseDec(""), null);
});

check("the built-in set teaches one of each operation", () => {
  const { problems, rejected } = parseDecimalSet(DEFAULT_DECIMAL_SET);
  assert.deepEqual(rejected, []);
  assert.deepEqual(problems.map((p) => p.op), ["+", "-", "x", "/"]);
  for (const p of problems) assert.ok(buildDecimalTrace(p), `${p.a.text} ${p.op} ${p.b.text} must build`);
});

check("a question is never asked about a column the answer never reaches", () => {
  // 100.5 − 99.75 has no hundreds or tens in its difference, so those columns
  // would be steps with nothing to write.
  const t = traceFor("100.5 - 99.75");
  const cols = t.steps.filter((s) => /^col-\d+$/.test(s.id));
  for (const s of cols) assert.ok(s.reveal.length > 0, `${s.id} writes nothing`);
});

console.log(`\n${checks} checks passed`);
