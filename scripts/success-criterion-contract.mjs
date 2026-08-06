import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
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

// The /warmup PAGE route was retired 2026-08-05 - a standalone drifting clock
// nothing linked to, duplicating the warmup class state the projectors already
// render off the shared endsAt clock. This used to assert that page never
// revealed a lesson target before its own state; the guarantee is structural
// now, so what is pinned is the retirement. If a warm-up projector is ever
// rebuilt, restore the two doesNotMatch checks with it.
// NOTE: /api/warmup is a DIFFERENT and still live route (the warm-up engine
// endpoint the Apps Script calls) and is deliberately not named here.
assert.ok(
  !existsSync(path.join(root, "src", "app", "warmup", "page.tsx")),
  "The /warmup page route is retired - do not restore it without restoring its lesson-target checks too.",
);

// The all-day boards show ONE criterion a day, from the chosen Notion property.
// Reading the Success Criteria menu there would put a whole menu on a classroom
// TV, so the payload must not even carry it.
const boardApi = readFileSync(path.join(root, "src", "app", "api", "weekly-display", "route.ts"), "utf8");
assert.doesNotMatch(
  boardApi,
  /successCriteria:\s*lesson\.successCriteria/,
  "The weekly display payload must carry the selected criterion, never the Success Criteria menu.",
);
const boardSource = readFileSync(path.join(root, "src", "app", "weekly-display", "page.tsx"), "utf8");
assert.doesNotMatch(
  boardSource,
  /successCriteriaList/,
  "The weekly display shows one chosen criterion a day, not a list.",
);
assert.match(
  boardSource,
  /selectedSuccessCriterion/,
  "The weekly display must read the chosen criterion property.",
);

console.log("PASS - exactly one selected I can statement is required on every public lesson surface.");
