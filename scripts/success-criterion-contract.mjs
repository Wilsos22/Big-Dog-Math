import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const criterion = require(path.join(root, ".tmp-mastery", "successCriterion.js"));

assert.deepEqual(criterion.inspectSelectedSuccessCriterion(""), {
  criterion: "",
  issue: "missing",
  message: "Choose one Selected Success Criterion in Notion before saving or starting this lesson.",
});

assert.deepEqual(criterion.inspectSelectedSuccessCriterion("I can explain a ratio in context."), {
  criterion: "I can explain a ratio in context.",
  issue: null,
  message: null,
});

assert.equal(
  criterion.selectedSuccessCriterion("  - i can compare two ratios.  "),
  "I can compare two ratios.",
  "A single selected statement should be normalized without changing its meaning.",
);

for (const multiple of [
  "I can model a ratio.\nI can explain a ratio.",
  "I can model a ratio; I can explain a ratio.",
]) {
  const inspected = criterion.inspectSelectedSuccessCriterion(multiple);
  assert.equal(inspected.issue, "multiple");
  assert.equal(inspected.criterion, "");
  assert.equal(
    criterion.publicSuccessCriterion(multiple),
    criterion.SUCCESS_CRITERION_SETUP_PLACEHOLDER,
    "Public surfaces must show setup guidance instead of a list of criteria.",
  );
}

const legacyOptions = "Explain the ratio\nModel the ratio\nCompare the ratio";
assert.equal(
  criterion.publicSuccessCriterion(undefined, legacyOptions),
  criterion.SUCCESS_CRITERION_SETUP_PLACEHOLDER,
  "The public resolver must not accept a legacy Success Criteria fallback argument.",
);

assert.equal(
  criterion.inspectSelectedSuccessCriterion("Explain the ratio in context.").issue,
  "not-i-can",
);

// successCriteriaList is the PLURAL read, for display surfaces that show the
// whole menu. It must stem every line "I can" and must never print the setup
// placeholder, which is a prompt to the teacher and not classroom copy.
assert.deepEqual(
  criterion.successCriteriaList("I can model a ratio.\n- i can explain a ratio.\n2) Compare two ratios."),
  ["I can model a ratio.", "I can explain a ratio.", "I can compare two ratios."],
  "Every line comes back as a normalized I can statement, list markers stripped.",
);
assert.deepEqual(criterion.successCriteriaList(""), []);
assert.deepEqual(criterion.successCriteriaList(null), []);
assert.deepEqual(
  criterion.successCriteriaList(`I can find a GCF.\n${criterion.SUCCESS_CRITERION_SETUP_PLACEHOLDER}`),
  ["I can find a GCF."],
  "The setup placeholder is a teacher prompt and must never reach a display surface.",
);
assert.deepEqual(
  criterion.successCriteriaList("   \n\n  "),
  [],
  "Whitespace-only criteria are empty, not a blank statement.",
);

const warmupSource = readFileSync(path.join(root, "src", "app", "warmup", "page.tsx"), "utf8");
assert.doesNotMatch(
  warmupSource,
  /lesson\?\.(?:learningIntention|successCriteria)/,
  "The warm-up projector must not reveal lesson targets before their lesson state.",
);
assert.doesNotMatch(
  warmupSource,
  />\s*(?:Learning intention|Success criteria)\s*</i,
  "Learning intention and success criterion labels belong on their later lesson state, not the warm-up.",
);

console.log("PASS - exactly one selected I can statement is required on every public lesson surface.");
