// Contract for the ranked visit list.
//
// The three rules that are not obvious, made executable: tier 2 groups by the
// error; a class-wide error says reteach instead of handing over names; and
// splitting the harder factor is CORRECT, never a tier 1 call.
//
// Run: npm run test:visit-list

import assert from "node:assert/strict";
import { buildVisitList, RETEACH_SHARE, VISIT_TIER_LABELS } from "../.tmp-mastery/visitList.js";

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  console.log(`  ok  ${name}`);
}

const student = (overrides) => ({
  studentKey: "k", name: "Student", correct: [true, true], fist: 5, ...overrides,
});

console.log("visit-list contract");

check("both checks wrong is tier 1, a call to the table", () => {
  const list = buildVisitList([student({ studentKey: "a", name: "Ana", correct: [false, false] })]);
  assert.equal(list.rows.length, 1);
  assert.equal(list.rows[0].tier, 1);
  assert.equal(list.rows[0].tierLabel, "Call");
  assert.equal(VISIT_TIER_LABELS[1], "Call");
});

check("nine students with one error are ONE stop, not nine visits", () => {
  const nine = Array.from({ length: 9 }, (_, index) => student({
    studentKey: `s${index}`, name: `Student ${index}`,
    correct: [true, false], error: "Only multiplied one part",
  }));
  // Plus one with a DIFFERENT error, which must stay its own stop.
  const other = student({
    studentKey: "z", name: "Zoe", correct: [true, false], error: "Parts do not add back to the original",
  });
  const list = buildVisitList([...nine, other]);
  assert.equal(list.rows.length, 2, "same error must collapse into one row");
  const grouped = list.rows.find((row) => row.error === "Only multiplied one part");
  assert.equal(grouped.students.length, 9);
  assert.equal(grouped.grouped, true);
  assert.ok(grouped.headline.includes("one stop"));
  // Still counts nine unreached students, even though it is one stop.
  assert.equal(list.unreached, 10);
});

check("tier 1 and tier 3 stay per-student even with a shared error", () => {
  const list = buildVisitList([
    student({ studentKey: "a", name: "Ana", correct: [false, false], error: "Changes the whole" }),
    student({ studentKey: "b", name: "Ben", correct: [false, false], error: "Changes the whole" }),
  ]);
  assert.equal(list.rows.length, 2, "a call is a conversation with one student");
});

check("splitting the harder factor is correct, never a tier 1 call", () => {
  // 8 x 12 cut as (4 + 4) x 12 = 48 + 48 = 96. Slower, completely correct.
  const list = buildVisitList([student({
    studentKey: "h", name: "Harder Factor", correct: [true, true], fist: 4, slowerButCorrect: true,
  })]);
  assert.equal(list.rows.length, 0, "this student needs no visit at all");
  assert.equal(list.leaveAlone.length, 1);
  assert.equal(list.leaveAlone[0].name, "Harder Factor");
});

check("arithmetic slips never escalate to a tier 1 call", () => {
  // Both readiness checks wrong, but every miss was only the final total: the
  // decomposition was right both times. Concept intact, so this is a Check.
  const list = buildVisitList([student({
    studentKey: "ar", name: "Arithmetic", correct: [false, false],
    error: "Arithmetic, concept is fine", conceptIntact: true,
  })]);
  assert.equal(list.rows[0].tier, 3, "sending them to the table teaches nothing");
  assert.equal(list.rows[0].tierLabel, "Check");

  // The same two wrong answers WITHOUT the flag stay a call.
  const conceptual = buildVisitList([student({
    studentKey: "c", name: "Conceptual", correct: [false, false], error: "Changes the whole",
  })]);
  assert.equal(conceptual.rows[0].tier, 1);
});

check("a class-wide error says reteach instead of handing over names", () => {
  const many = Array.from({ length: 7 }, (_, index) => student({
    studentKey: `s${index}`, name: `Student ${index}`,
    correct: [true, false], error: "Only multiplied one part",
  }));
  const rest = Array.from({ length: 3 }, (_, index) => student({
    studentKey: `c${index}`, name: `Correct ${index}`,
  }));
  const list = buildVisitList([...many, ...rest]);
  assert.ok(list.reteach, "7 of 10 sharing an error must trigger reteach");
  assert.equal(list.reteach.error, "Only multiplied one part");
  assert.equal(list.reteach.count, 7);
  assert.equal(list.reteach.total, 10);
  assert.ok(7 / 10 > RETEACH_SHARE);

  // Under the threshold, routing is still the right answer.
  const balanced = buildVisitList([
    student({ studentKey: "a", name: "Ana", correct: [true, false], error: "Only multiplied one part" }),
    student({ studentKey: "b", name: "Ben" }),
    student({ studentKey: "c", name: "Cy" }),
  ]);
  assert.equal(balanced.reteach, null);
});

check("correct but shaky confidence is tier 3, not tier 4", () => {
  const list = buildVisitList([
    student({ studentKey: "q", name: "Quiet", correct: [true, true], fist: 2 }),
    student({ studentKey: "s", name: "Sure", correct: [true, true], fist: 3 }),
  ]);
  assert.equal(list.rows.length, 1);
  assert.equal(list.rows[0].tier, 3);
  assert.equal(list.rows[0].students[0].name, "Quiet");
  assert.equal(list.leaveAlone[0].name, "Sure");
});

check("a checked-in student leaves the walking order", () => {
  const before = buildVisitList([student({ studentKey: "a", name: "Ana", correct: [false, false] })]);
  assert.equal(before.rows.length, 1);
  assert.equal(before.unreached, 1);

  const after = buildVisitList([student({
    studentKey: "a", name: "Ana", correct: [false, false],
    checkIn: { status: "got-it", at: "2026-08-14T17:05:00.000Z" },
  })]);
  assert.equal(after.rows.length, 0, "what is left on screen is who has NOT been reached");
  assert.equal(after.unreached, 0);
  assert.equal(after.cleared.length, 1);
  assert.equal(after.cleared[0].status, "got-it");
});

check("a check-in on one student does not clear the rest of their group", () => {
  const list = buildVisitList([
    student({ studentKey: "a", name: "Ana", correct: [true, false], error: "Only multiplied one part" }),
    student({ studentKey: "b", name: "Ben", correct: [true, false], error: "Only multiplied one part" }),
    student({
      studentKey: "c", name: "Cy", correct: [true, false], error: "Only multiplied one part",
      checkIn: { status: "partly", at: "2026-08-14T17:05:00.000Z" },
    }),
  ]);
  assert.equal(list.rows.length, 1);
  assert.equal(list.rows[0].students.length, 2);
  assert.equal(list.cleared.length, 1);
  assert.equal(list.unreached, 2);
});

check("no answers at all is a visit, not silently left alone", () => {
  const list = buildVisitList([student({ studentKey: "n", name: "No Answer", correct: [null, null], fist: null })]);
  assert.equal(list.rows.length, 1);
  assert.equal(list.rows[0].tier, 2);
  assert.equal(list.leaveAlone.length, 0);
});

check("most urgent first, and the order is stable between polls", () => {
  const list = buildVisitList([
    student({ studentKey: "c", name: "Cy", correct: [true, true], fist: 1 }),
    student({ studentKey: "a", name: "Ana", correct: [false, false] }),
    student({ studentKey: "b", name: "Ben", correct: [true, false], error: "Only multiplied one part" }),
  ]);
  assert.deepEqual(list.rows.map((row) => row.tier), [1, 2, 3]);
  // Same input in a different order produces the same walking order.
  const reordered = buildVisitList([
    student({ studentKey: "b", name: "Ben", correct: [true, false], error: "Only multiplied one part" }),
    student({ studentKey: "c", name: "Cy", correct: [true, true], fist: 1 }),
    student({ studentKey: "a", name: "Ana", correct: [false, false] }),
  ]);
  assert.deepEqual(reordered.rows.map((row) => row.id), list.rows.map((row) => row.id));
});

console.log(`\n${checks} visit-list checks passed`);
