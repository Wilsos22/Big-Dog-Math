// Contract: the teacher-facing "Slide Type" Notion dropdown must always resolve
// to a REAL class state. Steele authors the kind of each Lesson Step from this
// friendly select (2026-08-02) and the runtime maps it back to a canonical State
// ID; a label pointing at a state that does not exist would render nothing on a
// classroom screen - the exact silent-drift failure the Response Mode / Poll Kind
// traps in CLAUDE.md warn about. Compile classStates.ts in isolation, then check.

import assert from "node:assert/strict";
import {
  DEFAULT_STATES,
  SLIDE_TYPE_OPTIONS,
  stateIdForSlideType,
} from "../.tmp-mastery/classStates.js";

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  console.log(`  ok  ${name}`);
}

const ids = new Set(DEFAULT_STATES.map((state) => state.id));

check("every Slide Type option maps to a real class state", () => {
  for (const option of SLIDE_TYPE_OPTIONS) {
    assert.ok(
      ids.has(option.stateId),
      `Slide Type "${option.label}" points at unknown state id "${option.stateId}"`,
    );
  }
});

check("Slide Type labels are unique (case-insensitive)", () => {
  const labels = SLIDE_TYPE_OPTIONS.map((option) => option.label.trim().toLowerCase());
  assert.equal(new Set(labels).size, labels.length, "two Slide Type options share a label");
});

check("stateIdForSlideType resolves labels tolerantly and empties on anything else", () => {
  assert.equal(stateIdForSlideType("Discussion"), "discussion");
  assert.equal(stateIdForSlideType("  Learning Targets "), "learning-target-readers");
  assert.equal(stateIdForSlideType("EXIT TICKET"), "exit");
  // Unknown, blank, and null all fall through to "" so the caller uses State ID.
  assert.equal(stateIdForSlideType(""), "");
  assert.equal(stateIdForSlideType("Not A Real Slide Type"), "");
  assert.equal(stateIdForSlideType(null), "");
  assert.equal(stateIdForSlideType(undefined), "");
});

console.log(`\n${checks} slide-type checks passed`);
console.log("PASS - the friendly dropdown can never point at a state that does not exist.");
