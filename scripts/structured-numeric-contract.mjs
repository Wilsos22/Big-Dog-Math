// Contract for the structured-numeric response kind.
//
// The acceptance criteria from the runtime work order, made executable. The
// one that matters most in the room: a student whose only wrong box is the
// final total is an ARITHMETIC visit (tier 3), never a concept call (tier 1).
//
// Run: npm run test:structured-numeric

import assert from "node:assert/strict";
import {
  parseStructuredNumericSpec,
  diagnoseStructuredNumeric,
  structuredNumericBoxCount,
  canonicalStructuredNumericAnswer,
  structuredNumericBlankCount,
  structuredNumericSegments,
  structuredNumericSplitConcentration,
  summarizeStructuredNumeric,
  splitKeyFor,
} from "../.tmp-mastery/structuredNumeric.js";

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  console.log(`  ok  ${name}`);
}

function spec(text) {
  const parsed = parseStructuredNumericSpec(text);
  assert.equal(parsed.ok, true, `expected spec to parse: ${JSON.stringify(parsed.errors || [])}`);
  return parsed.spec;
}

// The exit ticket: 6 x 28 = 6 x ( [ ] + [ ] ) = [ ] + [ ] = [ ]
const EXIT_TICKET = ["boxes: 5", "sum(1,2)=28", "3=6*1", "4=6*2", "5=168"].join("\n");

// The learning check, where the split is already given:
// 5 x 27 = 5 x ( 20 + 7 ) = [ ] + [ ] = [ ]
const LEARNING_CHECK = ["boxes: 3", "1=100", "2=35", "3=135"].join("\n");

console.log("structured-numeric contract");

check("parses every supported rule form", () => {
  const parsed = spec(EXIT_TICKET);
  assert.equal(parsed.boxes, 5);
  assert.equal(parsed.rules.length, 4);
  assert.equal(parsed.rules[0].kind, "sum");
  assert.deepEqual(parsed.rules[0].boxes, [1, 2]);
  assert.equal(parsed.rules[0].total, 28);
  // a=K*b must NOT be swallowed by the plain a=N form.
  assert.equal(parsed.rules[1].kind, "multiple");
  assert.equal(parsed.rules[1].factor, 6);
  assert.equal(parsed.rules[1].ofBox, 1);
  assert.equal(parsed.rules[3].kind, "equals");
  assert.equal(parsed.rules[3].value, 168);
});

check("a parse failure fails loudly and never silently accepts", () => {
  for (const bad of [
    "boxes: 5\n3 = 6 x 1",          // wrong multiplication glyph
    "sum(1,2)=28",                   // no boxes: line
    "boxes: 5",                      // no rules
    "boxes: 3\nsum(1,9)=28",        // box out of declared range
    "boxes: 2\nboxes: 3\n1=4",      // repeated declaration
  ]) {
    const parsed = parseStructuredNumericSpec(bad);
    assert.equal(parsed.ok, false, `expected a parse failure for: ${JSON.stringify(bad)}`);
    assert.ok(parsed.errors.length > 0, "a failed parse must explain itself");
    assert.ok(parsed.errors.every((message) => typeof message === "string" && message.trim()));
  }
});

check("ANY valid split passes - there is no single correct answer string", () => {
  const parsed = spec(EXIT_TICKET);
  const cutAtTen = diagnoseStructuredNumeric(parsed, [20, 8, 120, 48, 168]);
  const cutInHalf = diagnoseStructuredNumeric(parsed, [14, 14, 84, 84, 168]);
  assert.equal(cutAtTen.correct, true);
  assert.equal(cutAtTen.tier, 4);
  assert.equal(cutInHalf.correct, true);
  assert.equal(cutInHalf.tier, 4);
  // ...and the two students are recorded as having chosen DIFFERENT splits.
  assert.notEqual(cutAtTen.splitKey, cutInHalf.splitKey);
  assert.equal(cutAtTen.splitKey, "8+20");
  assert.equal(cutInHalf.splitKey, "14+14");
});

check("100 / 7 / 107 is diagnosed 'only multiplied one part', not just wrong", () => {
  const result = diagnoseStructuredNumeric(spec(LEARNING_CHECK), [100, 7, 107]);
  assert.equal(result.correct, false);
  assert.equal(result.phrase, "Only multiplied one part");
  assert.equal(result.tier, 1);
  assert.equal(result.misconception, "distributes to first term only");
  assert.equal(result.role, "partial");
});

check("100 / 35 / 125 is arithmetic at tier 3, NOT a tier 1 concept call", () => {
  const result = diagnoseStructuredNumeric(spec(LEARNING_CHECK), [100, 35, 125]);
  assert.equal(result.correct, false);
  assert.equal(result.phrase, "Arithmetic, concept is fine");
  assert.equal(result.tier, 3);
  assert.equal(result.misconception, null, "an arithmetic slip is not a misconception");
  assert.equal(result.role, "total");
});

check("parts that do not rebuild the original are 'changes the whole'", () => {
  // 20 + 7 does not total 28 - the decomposition is not equivalent.
  const result = diagnoseStructuredNumeric(spec(EXIT_TICKET), [20, 7, 120, 42, 162]);
  assert.equal(result.tier, 1);
  assert.equal(result.phrase, "Parts do not add back to the original");
  assert.equal(result.misconception, "changes the whole");
  assert.equal(result.role, "whole");
});

check("the first failing rule wins, in authored order", () => {
  // Both the sum and the partials are wrong; the sum is authored first.
  const result = diagnoseStructuredNumeric(spec(EXIT_TICKET), [20, 7, 1, 1, 1]);
  assert.equal(result.ruleId, "sum(1,2)=28");
});

check("a blank box fails its rule rather than counting as zero", () => {
  const result = diagnoseStructuredNumeric(spec(LEARNING_CHECK), [100, null, null]);
  assert.equal(result.correct, false);
  assert.equal(result.ruleId, "2=35");
});

check("no partial correct at all is a tier 2 visit, not a tier 1 call", () => {
  const result = diagnoseStructuredNumeric(spec(LEARNING_CHECK), [7, 9, 16]);
  assert.equal(result.tier, 2);
  assert.equal(result.phrase, "Partial products do not match the split");
});

check("box count is the only piece of the spec that crosses to a student", () => {
  assert.equal(structuredNumericBoxCount(EXIT_TICKET), 5);
  assert.equal(structuredNumericBoxCount(LEARNING_CHECK), 3);
  // A non-spec Correct Answer (an ordinary text answer) yields no boxes.
  assert.equal(structuredNumericBoxCount("168"), null);
  assert.equal(structuredNumericBoxCount(""), null);
  assert.equal(structuredNumericBoxCount(null), null);
});

check("answer stays the final box so City Routes keeps exact-matching", () => {
  assert.equal(canonicalStructuredNumericAnswer([20, 8, 120, 48, 168]), "168");
  assert.equal(canonicalStructuredNumericAnswer([100, 35, null]), "35");
  assert.equal(canonicalStructuredNumericAnswer([]), "");
  // Never JSON - a JSON array in `answer` silently breaks recommendRoute.
  assert.ok(!canonicalStructuredNumericAnswer([1, 2, 3]).includes("["));
});

check("questions lay out inline from bracket blanks, not underscores", () => {
  const question = "6 x 28 = 6 x ( [ ] + [ ] ) = [ ] + [ ] = [ ]";
  assert.equal(structuredNumericBlankCount(question), 5);
  assert.equal(structuredNumericSegments(question).length, 6);
  assert.equal(structuredNumericBlankCount("no blanks here"), 0);
});

check("split concentration surfaces a class that found one cut and stopped", () => {
  const converged = structuredNumericSplitConcentration(["8+20", "8+20", "8+20", "14+14"]);
  assert.equal(converged.topKey, "8+20");
  assert.equal(converged.count, 3);
  assert.equal(converged.total, 4);
  assert.ok(converged.share > 0.7);
  // Order-independent: 20+8 is the same decomposition as 8+20.
  assert.equal(splitKeyFor([20, 8]), splitKeyFor([8, 20]));
  const empty = structuredNumericSplitConcentration([null, null]);
  assert.equal(empty.topKey, null);
  assert.equal(empty.share, 0);
});

check("nine students with one error are ONE stop, not nine visits", () => {
  const parsed = spec(LEARNING_CHECK);
  const responses = [
    ...Array.from({ length: 9 }, (_, index) => ({
      id: `s${index}`, name: `Student ${index}`, values: [100, 7, 107],
    })),
    { id: "ok1", name: "Correct One", values: [100, 35, 135] },
    { id: "ar1", name: "Arithmetic One", values: [100, 35, 125] },
  ];
  const summary = summarizeStructuredNumeric(parsed, responses);
  assert.equal(summary.total, 11);
  assert.equal(summary.correct, 1);
  // Two groups, not ten rows.
  assert.equal(summary.groups.length, 2);
  assert.equal(summary.groups[0].phrase, "Only multiplied one part");
  assert.equal(summary.groups[0].students.length, 9);
  assert.equal(summary.groups[0].tier, 1);
  assert.equal(summary.groups[0].tierLabel, "Call");
  // Most urgent first: the tier 1 group outranks the tier 3 arithmetic group.
  assert.ok(summary.groups[0].tier < summary.groups[1].tier);
  assert.equal(summary.groups[1].phrase, "Arithmetic, concept is fine");
});

check("a class-wide error says reteach instead of handing over names", () => {
  const parsed = spec(LEARNING_CHECK);
  const many = Array.from({ length: 7 }, (_, index) => ({
    id: `s${index}`, name: `Student ${index}`, values: [100, 7, 107],
  }));
  const few = Array.from({ length: 3 }, (_, index) => ({
    id: `c${index}`, name: `Correct ${index}`, values: [100, 35, 135],
  }));
  assert.equal(summarizeStructuredNumeric(parsed, [...many, ...few]).reteachPhrase, "Only multiplied one part");
  // Under the threshold, routing is still the right answer.
  const balanced = summarizeStructuredNumeric(parsed, [
    { id: "a", name: "A", values: [100, 7, 107] },
    { id: "b", name: "B", values: [100, 35, 135] },
    { id: "c", name: "C", values: [100, 35, 135] },
  ]);
  assert.equal(balanced.reteachPhrase, null);
});

check("summary reports split concentration even when everyone is correct", () => {
  const parsed = spec(EXIT_TICKET);
  const summary = summarizeStructuredNumeric(parsed, [
    { id: "a", name: "A", values: [20, 8, 120, 48, 168] },
    { id: "b", name: "B", values: [20, 8, 120, 48, 168] },
    { id: "c", name: "C", values: [20, 8, 120, 48, 168] },
  ]);
  assert.equal(summary.correct, 3);
  assert.equal(summary.groups.length, 0);
  // Everyone right, and everyone cut at the ten - flexibility has not landed.
  assert.equal(summary.splits.topKey, "8+20");
  assert.equal(summary.splits.share, 1);
});

console.log(`\n${checks} structured-numeric checks passed`);
