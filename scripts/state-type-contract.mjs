// Contract: the teacher-facing "State Type" Notion dropdown must always resolve
// to a REAL class state. Steele authors the kind of each Lesson Step from this
// friendly select (2026-08-02) and the runtime maps it back to a canonical State
// ID; a label pointing at a state that does not exist would render nothing on a
// classroom screen - the exact silent-drift failure the Response Mode / Poll Kind
// traps in CLAUDE.md warn about. Compile classStates.ts in isolation, then check.

import assert from "node:assert/strict";
import {
  DEFAULT_STATES,
  STATE_TYPE_OPTIONS,
  stateIdForStateType,
} from "../.tmp-mastery/classStates.js";

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  console.log(`  ok  ${name}`);
}

const ids = new Set(DEFAULT_STATES.map((state) => state.id));

check("every State Type option maps to a real class state", () => {
  for (const option of STATE_TYPE_OPTIONS) {
    assert.ok(
      ids.has(option.stateId),
      `State Type "${option.label}" points at unknown state id "${option.stateId}"`,
    );
  }
});

check("State Type labels are unique (case-insensitive)", () => {
  const labels = STATE_TYPE_OPTIONS.map((option) => option.label.trim().toLowerCase());
  assert.equal(new Set(labels).size, labels.length, "two State Type options share a label");
});

check("stateIdForStateType resolves labels tolerantly and empties on anything else", () => {
  assert.equal(stateIdForStateType("Discussion"), "discussion");
  assert.equal(stateIdForStateType("  Learning Targets "), "learning-target-readers");
  assert.equal(stateIdForStateType("EXIT TICKET"), "exit");
  // Unknown, blank, and null all fall through to "" so the caller uses State ID.
  assert.equal(stateIdForStateType(""), "");
  assert.equal(stateIdForStateType("Not A Real State Type"), "");
  assert.equal(stateIdForStateType(null), "");
  assert.equal(stateIdForStateType(undefined), "");
});

console.log(`\n${checks} state-type checks passed`);
console.log("PASS - the friendly dropdown can never point at a state that does not exist.");
