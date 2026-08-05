// Contract: the poll -> responses bridge writes rows the mastery engine can
// actually read, and never writes a row it cannot.
//
// WHY THIS EXISTS. Three separate failures in this codebase have the same
// shape - evidence that lands in a table, passes every type check, and moves
// nothing: the hyphenated AreaExplorer misconception tags, `boxmethod` failing
// to resolve to a tool route, and every `poll_answers` row ever written. Each
// was silent. This bridge is one careless edit away from joining them, and the
// two edits that would do it are:
//
//   - attaching the resolved standard to the BAR row (recompute filters bar
//     events to `!standardId`, so the bar would stop moving), and
//   - writing a row whose standard did not resolve (recompute drops a
//     domainless row with a bare `continue`).
//
// Both are asserted below, in the direction that fails.
//
// The normalizer cases are not invented - they are the six distinct authored
// values measured on the live `polls` table on 2026-08-04, where only ONE of
// the six matched the seeded `standards` id format.
//
// Run: npm run test:poll-evidence

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const {
  normalizeStandardId,
  gradePollAnswer,
  pollEvidenceRows,
  isGradedPollKind,
  answerKeyIsTappable,
  GRADED_POLL_KINDS,
  PAIRS_INVENTED_MISCONCEPTION,
  PAIRS_INCOMPLETE_MISCONCEPTION,
  POLL_EVIDENCE_SOURCE,
  MAX_INCORRECT_SCORE,
} = require(path.join(root, ".tmp-mastery", "pollEvidence.js"));

let checks = 0;
const check = (label, fn) => {
  try {
    fn();
  } catch (err) {
    console.error(`FAIL: ${label}`);
    throw err;
  }
  checks += 1;
};

// The real seed, from supabase/proficiency.sql.
const STANDARDS = [
  { id: "6.EE.A.3", domain: "Algebra and Algebraic Thinking" },
  { id: "6.EE.A.1", domain: "Algebra and Algebraic Thinking" },
  { id: "6.NS.B.4", domain: "Number and Operations" },
  { id: "5.NF.B.4", domain: "Number and Operations" },
  { id: "6.NS.A.1", domain: "Number and Operations" },
  { id: "6.G.A.1", domain: "Geometry" },
  { id: "6.G.A.2", domain: "Geometry" },
  { id: "6.G.A.3", domain: "Geometry" },
  { id: "6.G.A.4", domain: "Geometry" },
  { id: "5.NBT.A.3b", domain: "Number and Operations" },
  { id: "6.NS.B.3", domain: "Number and Operations" },
  { id: "6.RP.A.1", domain: "Number and Operations" },
  { id: "6.RP.A.3", domain: "Number and Operations" },
  { id: "6.RP.A.3a", domain: "Number and Operations" },
  { id: "6.RP.A.3b", domain: "Number and Operations" },
  { id: "6.RP.A.2", domain: "Number and Operations" },
  { id: "6.RP.A.3c", domain: "Number and Operations" },
  { id: "6.RP.A.3d", domain: "Number and Operations" },
];
const IDS = STANDARDS.map((s) => s.id);

// ---------------------------------------------------------------------------
// 1. The normalizer, against every value actually authored in Notion.
// ---------------------------------------------------------------------------

check("exact seeded id passes through", () => {
  assert.equal(normalizeStandardId("6.NS.B.4", IDS), "6.NS.B.4");
});

check("cluster letter is inserted when the match is unique", () => {
  assert.equal(normalizeStandardId("6.NS.4", IDS), "6.NS.B.4");
  assert.equal(normalizeStandardId("6.EE.3", IDS), "6.EE.A.3");
  assert.equal(normalizeStandardId("6.RP.1", IDS), "6.RP.A.1");
});

check("a semicolon list takes the first RESOLVABLE code, not the first code", () => {
  // 6.EE.2b is not seeded at all; taking the first token blindly would throw
  // away the perfectly good 6.EE.3 sitting right behind it.
  assert.equal(normalizeStandardId("6.EE.2b; 6.EE.3", IDS), "6.EE.A.3");
  assert.equal(normalizeStandardId("6.NS.4; 6.EE.1", IDS), "6.NS.B.4");
});

check("all six authored values resolve - none is silently dropped", () => {
  const authored = ["6.NS.B.4", "6.NS.4", "6.EE.3", "6.RP.1", "6.EE.2b; 6.EE.3", "6.NS.4; 6.EE.1"];
  for (const value of authored) {
    assert.ok(normalizeStandardId(value, IDS), `authored code did not resolve: ${value}`);
  }
});

check("an ambiguous insertion REFUSES rather than guessing", () => {
  // Two seeded standards would satisfy "7.XX.9". Attaching real student
  // evidence to a coin-flip standard is worse than attaching it to none.
  const ambiguous = [
    { id: "7.XX.A.9", domain: "Geometry" },
    { id: "7.XX.B.9", domain: "Geometry" },
  ].map((s) => s.id);
  assert.equal(normalizeStandardId("7.XX.9", ambiguous), null);
});

check("unknown, empty and nullish codes resolve to null", () => {
  assert.equal(normalizeStandardId("6.ZZ.9", IDS), null);
  assert.equal(normalizeStandardId("", IDS), null);
  assert.equal(normalizeStandardId(null, IDS), null);
  assert.equal(normalizeStandardId(undefined, IDS), null);
});

// ---------------------------------------------------------------------------
// 2. Which kinds count. Steele's call, 2026-08-04.
// ---------------------------------------------------------------------------

check("exactly two kinds are graded", () => {
  assert.deepEqual([...GRADED_POLL_KINDS].sort(), ["multiple-choice", "structured-numeric"]);
});

check("a fist to five is never assessment evidence", () => {
  // It is a self-report of confidence. A student saying "I am at a 2" must
  // never become a score against a standard.
  assert.equal(isGradedPollKind("fist-to-five"), false);
  assert.equal(
    gradePollAnswer(
      { id: "p", kind: "fist-to-five", sessionId: "s", correctAnswer: "3", standardId: "6.NS.B.4" },
      { pollId: "p", studentId: "kid", answer: "3" },
    ),
    null,
  );
});

check("short answer and multiple-choice-explain are not graded here", () => {
  assert.equal(isGradedPollKind("short-answer"), false);
  assert.equal(isGradedPollKind("multiple-choice-explain"), false);
});

// ---------------------------------------------------------------------------
// 3. Grading.
// ---------------------------------------------------------------------------

const mcPoll = {
  id: "mc", kind: "multiple-choice", sessionId: "s",
  correctAnswer: "12", standardId: "6.NS.B.4",
};

check("multiple choice scores 5 or 0, with no misconception available", () => {
  const right = gradePollAnswer(mcPoll, { pollId: "mc", studentId: "a", answer: "12" });
  assert.equal(right.correct, true);
  assert.equal(right.score0to5, 5);
  assert.equal(right.misconception, null);
  const wrong = gradePollAnswer(mcPoll, { pollId: "mc", studentId: "b", answer: "8" });
  assert.equal(wrong.correct, false);
  assert.equal(wrong.score0to5, 0);
});

check("multiple choice uses BARE equality, matching readinessEvidence", () => {
  // Being more lenient here would let the bar call a student right while the
  // visit list calls the same answer wrong. Fix both graders or neither.
  assert.equal(gradePollAnswer(mcPoll, { pollId: "mc", studentId: "a", answer: " 12" }).correct, false);
});

check("an unanswered poll grades to null, not to zero", () => {
  // A student who never answered has not got it wrong.
  assert.equal(gradePollAnswer(mcPoll, { pollId: "mc", studentId: "a", answer: "" }), null);
  assert.equal(gradePollAnswer(mcPoll, { pollId: "mc", studentId: "a", answer: null }), null);
});

const pairsPoll = {
  id: "pr", kind: "structured-numeric", sessionId: "s",
  correctAnswer: "pairs(24)\nbank: 24", standardId: "6.NS.4",
};
const pairValues = (pairs) => pairs.flat();

check("a complete correct pairs build scores 5", () => {
  const all = [[1, 24], [2, 12], [3, 8], [4, 6]];
  const g = gradePollAnswer(pairsPoll, { pollId: "pr", studentId: "a", values: pairValues(all) });
  assert.equal(g.correct, true);
  assert.equal(g.score0to5, 5);
  assert.equal(g.misconception, null);
});

check("partial credit: half the pairs of 24 is 2.5, not a red X", () => {
  const half = [[1, 24], [2, 12]];
  const g = gradePollAnswer(pairsPoll, { pollId: "pr", studentId: "a", values: pairValues(half) });
  assert.equal(g.correct, false);
  assert.equal(g.score0to5, 2.5);
  assert.equal(g.misconception, PAIRS_INCOMPLETE_MISCONCEPTION);
});

check("partial credit is the fraction FOUND, rounded to 2dp", () => {
  // 24 has four pairs within the bank; three of them is 3.75 of 5.
  const three = [[1, 24], [2, 12], [3, 8]];
  const g = gradePollAnswer(pairsPoll, { pollId: "pr", studentId: "a", values: pairValues(three) });
  assert.equal(g.score0to5, 3.75);
});

check("an invented pair is a DIFFERENT student from an incomplete one", () => {
  // Same wrong-answer count, different next move. They must never collapse.
  const invented = [[1, 24], [2, 12], [3, 8], [4, 6], [5, 5]];
  const g = gradePollAnswer(pairsPoll, { pollId: "pr", studentId: "a", values: pairValues(invented) });
  assert.equal(g.correct, false);
  assert.equal(g.misconception, PAIRS_INVENTED_MISCONCEPTION);
  assert.notEqual(PAIRS_INVENTED_MISCONCEPTION, PAIRS_INCOMPLETE_MISCONCEPTION);
});

check("inventing wins over incomplete, matching diagnosePairs' own order", () => {
  // So the tag always agrees with the phrase the /control tally groups on.
  const both = [[1, 24], [5, 5]];
  const g = gradePollAnswer(pairsPoll, { pollId: "pr", studentId: "a", values: pairValues(both) });
  assert.equal(g.misconception, PAIRS_INVENTED_MISCONCEPTION);
});

check("an unparsable spec grades to null rather than marking a class wrong", () => {
  const bad = { ...pairsPoll, correctAnswer: "whatever the teacher typed" };
  assert.equal(gradePollAnswer(bad, { pollId: "pr", studentId: "a", values: [1, 24] }), null);
});

// ---------------------------------------------------------------------------
// 4. The rows. This is the half that decides whether a bar moves.
// ---------------------------------------------------------------------------

const buildOne = (poll, answer) => pollEvidenceRows([poll], [answer], STANDARDS, "2026-08-04T17:00:00.000Z");

const barRows = (rows) => rows.filter((r) => r.standard_id === null);
const stdRows = (rows) => rows.filter((r) => r.standard_id !== null);

check("one graded answer produces one standard row and one bar row", () => {
  const { rows } = buildOne(mcPoll, { pollId: "mc", studentId: "kid", answer: "12" });
  assert.equal(rows.length, 2);
  assert.equal(stdRows(rows).length, 1);
  assert.equal(barRows(rows).length, 1);
});

check("THE BAR ROW CARRIES NO STANDARD - this is what makes the bar move", () => {
  // recompute.ts: `barEvents = domainEvents.filter((e) => !e.standardId)`.
  // Attaching the standard here excludes the row from the bars entirely.
  const { rows } = buildOne(mcPoll, { pollId: "mc", studentId: "kid", answer: "12" });
  const [bar] = barRows(rows);
  assert.equal(bar.standard_id, null);
  assert.equal(bar.domain, "Number and Operations");
  assert.equal(bar.score, 5);
  // null like toolEvidence's daily aggregate - the score is the signal.
  assert.equal(bar.is_correct, null);
});

check("A WHOLE LESSON MOVES THE BAR ONCE, NOT ONCE PER QUESTION", () => {
  // One row per question is an EWMA step per question: four wrong answers
  // would take a domain bar 60 -> 42 -> 29 -> 21 -> 14 inside one period,
  // where a whole warm-up day moves it a single step. Every other evidence
  // writer in the system aggregates first; so does this.
  const polls = [1, 2, 3, 4].map((n) => ({ ...mcPoll, id: `q${n}` }));
  const answers = polls.map((p) => ({ pollId: p.id, studentId: "kid", answer: "nope" }));
  const { rows } = pollEvidenceRows(polls, answers, STANDARDS, "2026-08-04T17:00:00.000Z");
  assert.equal(barRows(rows).length, 1, "four questions must produce ONE bar row");
  assert.equal(stdRows(rows).length, 4, "but still one standard row per question");
});

check("the aggregate score is the mean across the lesson", () => {
  const polls = [
    { ...mcPoll, id: "q1" },
    { ...mcPoll, id: "q2" },
  ];
  const answers = [
    { pollId: "q1", studentId: "kid", answer: "12" },   // 5
    { pollId: "q2", studentId: "kid", answer: "wrong" }, // 0
  ];
  const { rows } = pollEvidenceRows(polls, answers, STANDARDS);
  assert.equal(barRows(rows)[0].score, 2.5);
});

check("two students in one lesson get one bar row each", () => {
  const answers = [
    { pollId: "mc", studentId: "a", answer: "12" },
    { pollId: "mc", studentId: "b", answer: "12" },
  ];
  const { rows } = pollEvidenceRows([mcPoll], answers, STANDARDS);
  assert.equal(barRows(rows).length, 2);
  assert.equal(new Set(barRows(rows).map((r) => r.student_id)).size, 2);
});

check("two domains in one lesson do NOT average into one number", () => {
  // A bar is per-domain. Collapsing them would put geometry evidence into the
  // number-and-operations bar.
  const geo = { ...mcPoll, id: "g", standardId: "6.G.A.1" };
  const answers = [
    { pollId: "mc", studentId: "kid", answer: "12" },
    { pollId: "g", studentId: "kid", answer: "12" },
  ];
  const { rows } = pollEvidenceRows([mcPoll, geo], answers, STANDARDS);
  const bars = barRows(rows);
  assert.equal(bars.length, 2);
  assert.deepEqual(bars.map((r) => r.domain).sort(), ["Geometry", "Number and Operations"]);
});

check("the aggregate carries the student's most frequent misconception", () => {
  const p = (n) => ({ ...pairsPoll, id: `p${n}` });
  const polls = [p(1), p(2), p(3)];
  const answers = [
    // two incomplete, one invented - incomplete should win
    { pollId: "p1", studentId: "kid", values: [1, 24] },
    { pollId: "p2", studentId: "kid", values: [1, 24] },
    { pollId: "p3", studentId: "kid", values: [1, 24, 2, 12, 3, 8, 4, 6, 5, 5] },
  ];
  const { rows } = pollEvidenceRows(polls, answers, STANDARDS);
  assert.equal(barRows(rows)[0].misconception, PAIRS_INCOMPLETE_MISCONCEPTION);
});

check("the aggregate is stamped with the LATEST answer in the lesson", () => {
  const polls = [{ ...mcPoll, id: "q1" }, { ...mcPoll, id: "q2" }];
  const answers = [
    { pollId: "q1", studentId: "kid", answer: "12", createdAt: "2026-08-01T09:00:00.000Z" },
    { pollId: "q2", studentId: "kid", answer: "12", createdAt: "2026-08-01T09:40:00.000Z" },
  ];
  const { rows } = pollEvidenceRows(polls, answers, STANDARDS);
  assert.equal(barRows(rows)[0].submitted_at, "2026-08-01T09:40:00.000Z");
});

check("AN INCORRECT BUILD NEVER SCORES FULL MARKS", () => {
  // Found all three real pairs of 18 AND invented 4x4. Without the cap this
  // scored 5 of 5 - the bar rising 100% for the student the misconception tag
  // had just flagged, on the same answer.
  const p18 = { ...pairsPoll, id: "p18", correctAnswer: "pairs(18)\nbank: 20" };
  const g = gradePollAnswer(p18, { pollId: "p18", studentId: "kid", values: [1, 18, 2, 9, 3, 6, 4, 4] });
  assert.equal(g.correct, false);
  assert.equal(g.misconception, PAIRS_INVENTED_MISCONCEPTION);
  assert.ok(g.score0to5 < 5, "an incorrect build must not score 5");
  assert.equal(g.score0to5, MAX_INCORRECT_SCORE);
});

check("the bar row always carries a domain recompute recognises", () => {
  const DOMAINS = [
    "Number and Operations", "Algebra and Algebraic Thinking",
    "Measurement and Data", "Geometry",
  ];
  const { rows } = buildOne(mcPoll, { pollId: "mc", studentId: "kid", answer: "12" });
  for (const row of rows) assert.ok(DOMAINS.includes(row.domain), `unknown domain: ${row.domain}`);
});

check("the standard row carries the RESOLVED code and no score", () => {
  // score null so recompute reads it through is_correct at 100/0, exactly how
  // toolEvidence writes its per-problem row.
  const { rows } = buildOne(pairsPoll, { pollId: "pr", studentId: "kid", values: [1, 24] });
  const std = rows.find((r) => r.dedupe_key.endsWith(":std"));
  assert.equal(std.standard_id, "6.NS.B.4"); // authored "6.NS.4"
  assert.equal(std.score, null);
  assert.equal(typeof std.is_correct, "boolean");
});

check("NO ROW IS EVER WRITTEN WITHOUT A RESOLVABLE STANDARD", () => {
  // recompute drops a domainless row with a bare `continue`. Writing one
  // produces evidence that exists and influences nothing.
  const orphan = { ...mcPoll, id: "orph", standardId: "6.ZZ.9" };
  const out = buildOne(orphan, { pollId: "orph", studentId: "kid", answer: "12" });
  assert.equal(out.rows.length, 0);
  assert.deepEqual(out.unresolvedStandards, ["6.ZZ.9"]);
  assert.equal(out.skipped[0].reason, "unresolvable_standard");
});

check("a poll with no authored standard is reported, not written", () => {
  const none = { ...mcPoll, id: "nostd", standardId: null };
  const out = buildOne(none, { pollId: "nostd", studentId: "kid", answer: "12" });
  assert.equal(out.rows.length, 0);
  assert.equal(out.skipped[0].reason, "no_standard_authored");
});

check("an unattributable answer is skipped, never guessed", () => {
  const out = buildOne(mcPoll, { pollId: "mc", studentId: null, answer: "12" });
  assert.equal(out.rows.length, 0);
  assert.equal(out.skipped[0].reason, "no_student");
});

check("dedupe keys are distinct and free of identifying material", () => {
  const { rows } = buildOne(mcPoll, { pollId: "mc", studentId: "kid", answer: "12" });
  const keys = rows.map((r) => r.dedupe_key);
  assert.equal(new Set(keys).size, 2);
  assert.ok(keys.includes("poll:mc:kid:std"));
  assert.ok(keys.some((k) => k.startsWith("poll:agg:")));
  for (const key of keys) assert.ok(!key.includes("@"), "dedupe key must never carry an email");
});

check("no two rows in one run collide on dedupe_key", () => {
  // A duplicate key inside a single upsert chunk is a Postgres 21000 error and
  // fails the whole batch, so this is a hard requirement, not tidiness.
  const polls = [{ ...mcPoll, id: "q1" }, { ...mcPoll, id: "q2" }];
  const answers = [
    { pollId: "q1", studentId: "a", answer: "12" }, { pollId: "q1", studentId: "b", answer: "12" },
    { pollId: "q2", studentId: "a", answer: "12" }, { pollId: "q2", studentId: "b", answer: "12" },
  ];
  const { rows } = pollEvidenceRows(polls, answers, STANDARDS);
  assert.equal(new Set(rows.map((r) => r.dedupe_key)).size, rows.length);
});

check("re-running produces identical keys, so the upsert is a no-op", () => {
  const a = buildOne(mcPoll, { pollId: "mc", studentId: "kid", answer: "12" }).rows.map((r) => r.dedupe_key);
  const b = buildOne(mcPoll, { pollId: "mc", studentId: "kid", answer: "12" }).rows.map((r) => r.dedupe_key);
  assert.deepEqual(a, b);
});

check("source is not 'tool', so the visit-list tie-breaker is not polluted", () => {
  // readinessEvidence and /api/submissions both filter `.eq("source","tool")`.
  const { rows } = buildOne(mcPoll, { pollId: "mc", studentId: "kid", answer: "12" });
  for (const row of rows) {
    assert.equal(row.source, POLL_EVIDENCE_SOURCE);
    assert.notEqual(row.source, "tool");
  }
});

check("the answer's own timestamp is preserved, not the run time", () => {
  // Recompute replays evidence in submitted_at order, so stamping a backfill
  // with 'now' would reorder a whole period's history.
  const { rows } = pollEvidenceRows(
    [mcPoll],
    [{ pollId: "mc", studentId: "kid", answer: "12", createdAt: "2026-08-01T09:15:00.000Z" }],
    STANDARDS,
    "2026-08-04T17:00:00.000Z",
  );
  for (const row of rows) assert.equal(row.submitted_at, "2026-08-01T09:15:00.000Z");
});

check("AN UNTAPPABLE ANSWER KEY MAKES THE POLL UNGRADABLE, NOT THE CLASS WRONG", () => {
  // Measured live 2026-08-04: 3 of 29 multiple-choice polls have a
  // correct_answer that is in none of the choices, because splitList shatters
  // a choice on its commas while Correct Answer is read whole. Bare equality
  // would mark every student wrong and write that as permanent evidence.
  const shattered = {
    id: "sh", kind: "multiple-choice", sessionId: "s", standardId: "6.NS.B.4",
    correctAnswer: "6 x 6 = 36, so every later pair would repeat one she already recorded",
    choices: ["6 x 6 = 36", "so every later pair would repeat one she already recorded", "12 x 3 = 36"],
  };
  assert.equal(gradePollAnswer(shattered, { pollId: "sh", studentId: "kid", answer: "6 x 6 = 36" }), null);
  const out = buildOne(shattered, { pollId: "sh", studentId: "kid", answer: "6 x 6 = 36" });
  assert.equal(out.rows.length, 0);
  assert.equal(out.skipped[0].reason, "answer_key_not_in_choices");
});

check("a tappable key still grades normally", () => {
  const fine = { ...mcPoll, choices: ["12", "8", "6", "24"] };
  const out = buildOne(fine, { pollId: "mc", studentId: "kid", answer: "12" });
  assert.equal(out.rows.length, 2);
});

check("a poll with no choices recorded is graded, not assumed broken", () => {
  // Only a PROVABLE mismatch refuses. Refusing on absent data would silently
  // discard every legitimately authored poll that stores choices elsewhere.
  assert.equal(answerKeyIsTappable({ ...mcPoll, choices: null }), true);
  assert.equal(answerKeyIsTappable({ ...mcPoll, choices: [] }), true);
});

check("a structured-numeric poll is never judged against choices", () => {
  assert.equal(answerKeyIsTappable({ ...pairsPoll, choices: ["nonsense"] }), true);
});

check("an ungraded kind never reaches the table", () => {
  const fist = { id: "f", kind: "fist-to-five", sessionId: "s", correctAnswer: "3", standardId: "6.NS.B.4" };
  const out = buildOne(fist, { pollId: "f", studentId: "kid", answer: "3" });
  assert.equal(out.rows.length, 0);
  assert.equal(out.skipped[0].reason, "ungraded_kind");
});

check("a poll nobody answered produces nothing and reports nothing", () => {
  const out = pollEvidenceRows([mcPoll], [], STANDARDS);
  assert.equal(out.rows.length, 0);
  assert.equal(out.skipped.length, 0);
});

// ---------------------------------------------------------------------------
// 5. The vocabulary the tags depend on.
// ---------------------------------------------------------------------------

check("both pairs tags are in the seeded vocabulary", () => {
  const vocab = require(path.join(root, ".tmp-mastery", "misconceptions.js"));
  assert.ok(vocab.isMisconceptionTag(PAIRS_INVENTED_MISCONCEPTION));
  assert.ok(vocab.isMisconceptionTag(PAIRS_INCOMPLETE_MISCONCEPTION));
});

console.log(`poll-evidence contract: ${checks} checks passed`);
