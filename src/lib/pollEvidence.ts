// Bridge: a graded poll answer becomes a `responses` row, so the learning
// checks, the readiness questions and the exit ticket finally move a bar.
//
// WHY THIS EXISTS. `poll_answers` stores NO correctness and NO standard. Both
// live on the `polls` row (`correct_answer`, `standard_id`), and grading has
// only ever happened at READ time, in readinessEvidence, for the visit list.
// So the day's designed assessment landed in a table `recompute` does not read
// - and the `mastery` table has been empty since the project started. This
// module re-grades from (poll, answer) and emits the rows recompute understands.
//
// THREE THINGS ARE LOAD-BEARING AND ALL THREE INVERT THE OBVIOUS INTUITION:
//
// 1. THE BAR ROW MUST CARRY `standard_id: null`. recompute.ts filters
//    `barEvents = domainEvents.filter((e) => !e.standardId)` - a row WITH a
//    standard is deliberately EXCLUDED from the bars, because it feeds the
//    per-standard stage gate instead and would otherwise double-count. So
//    "attach the standard we worked so hard to resolve" is precisely the
//    change that stops the bar moving. That is why there are two row shapes:
//    a per-question STANDARD row for the stage gate, and one aggregate BAR row
//    per student per lesson per domain (see `buckets` for why aggregate).
//
// 2. THE DOMAIN MUST BE WRITTEN EXPLICITLY on the bar row. A standard-less row
//    has nothing left to derive a domain from, and resolving the domain is the
//    ONLY job the standard does there.
//
// 3. NO DOMAIN MEANS NO ROW AT ALL. recompute drops a domainless row with a
//    bare `continue`, and an unseeded standard is dropped from the stage gate
//    the same way. Writing either produces evidence that sits in the table and
//    influences nothing - the exact failure this bridge exists to end - so an
//    unresolvable standard is REPORTED, never written.
//
// A ceiling worth knowing before anyone reads the bars: `deriveStage` needs a
// `tier2` event to reach `mastered`, and a `responses` row can only ever
// produce `warmup` or `tool`. So poll evidence can carry a standard to
// `approaching` and no further. That is the proficiency spine working as
// designed, not a bug in this file.
//
// Kept import-light on purpose: `structuredNumeric` is self-contained, so this
// module compiles in isolation under `tsc --ignoreConfig` for its contract.
// Do NOT add an `@/` import or a Supabase client here - the caller injects the
// seeded standards and does all the I/O.

import {
  diagnoseStructuredNumeric,
  parseStructuredNumericSpec,
  type StructuredNumericDiagnosis,
} from "./structuredNumeric";

/**
 * The kinds that become mastery evidence (Steele's call, 2026-08-04).
 *
 * Deliberately excluded, each for its own reason:
 * - `short-answer` is judged only by bare string equality, which marks a right
 *   answer wrong over a stray space. Confidently wrong evidence is worse than
 *   none. Consequence to know: M1.T1.L5-D1's exit ticket is this kind, so that
 *   lesson's exit still contributes nothing.
 * - `multiple-choice-explain` grades identically to multiple choice on the
 *   choice half, but readinessEvidence cannot even see the kind today, and
 *   bridging it here would make the bars and the visit list disagree about the
 *   same student. Fix the reader first, then add it in one change.
 * - `fist-to-five` is a self-report of confidence, not an assessment. A student
 *   saying "I am at a 2" is information for the next teacher move, and it must
 *   never become a score against a standard.
 */
export const GRADED_POLL_KINDS = ["structured-numeric", "multiple-choice"] as const;
export type GradedPollKind = (typeof GRADED_POLL_KINDS)[number];

export function isGradedPollKind(kind: string | null | undefined): kind is GradedPollKind {
  return GRADED_POLL_KINDS.includes((kind || "") as GradedPollKind);
}

/** The two tags a wrong factor-pair build carries. Both seeded to 6.NS.B.4. */
export const PAIRS_INVENTED_MISCONCEPTION = "lists a non-factor pair";
export const PAIRS_INCOMPLETE_MISCONCEPTION = "stops before all pairs are found";

/** `graded_by` on every row this module produces, so the source is greppable. */
export const POLL_EVIDENCE_GRADED_BY = "poll";

/**
 * `responses.source`. NOT one of the two values `/api/evidence` accepts - this
 * path writes through the service role directly, so it is not bound by that
 * route's allowlist, and keeping a distinct value preserves provenance.
 *
 * Checked before choosing it: recompute coerces anything that is not the
 * literal "tool" to "warmup" (alpha 0.30, the daily weight - correct for a
 * learning check), and the only two `source` filters in the codebase
 * (readinessEvidence's tool tie-breaker and /api/submissions) both test
 * `= "tool"`, so neither is polluted. /api/live/groups does NOT filter on
 * source, so these rows DO join misconception clustering - which is the point.
 */
export const POLL_EVIDENCE_SOURCE = "poll";

/** The `polls` row, narrowed to what grading needs. */
export interface PollEvidencePoll {
  id: string;
  kind: string | null;
  sessionId: string | null;
  correctAnswer: string | null;
  standardId: string | null;
  /**
   * The tappable choices. Carried ONLY so an ungradable multiple choice can be
   * caught before it marks a whole class wrong - see `answerKeyIsTappable`.
   */
  choices?: readonly string[] | null;
}

/**
 * Can a student actually submit the answer key?
 *
 * FOUND ON LIVE DATA, 2026-08-04: 3 of the 29 multiple-choice polls have a
 * `correct_answer` that appears in no choice, because `splitList`
 * (notionLessons.ts:453) splits the Notion `Choices` property on commas while
 * `Correct Answer` is read whole. One authored choice was
 * "6 x 6 = 36, so every later pair would repeat one she already recorded" -
 * the comma shattered it into two choices, and the key matches neither.
 *
 * Bare equality against an untappable key marks EVERY student wrong, and this
 * bridge would then write that as durable evidence and replay it into the bars
 * forever. Confidently wrong is worse than blank - so an unreachable key makes
 * the poll ungradable and gets reported, exactly like an unresolvable standard.
 *
 * Only refuses when the mismatch is PROVABLE. A poll carrying no choices at all
 * cannot be checked this way and is left alone rather than assumed broken.
 */
export function answerKeyIsTappable(poll: PollEvidencePoll): boolean {
  if (poll.kind !== "multiple-choice") return true;
  const choices = poll.choices;
  if (!Array.isArray(choices) || choices.length === 0) return true;
  return choices.some((choice) => choice === poll.correctAnswer);
}

/** One `poll_answers` row. `values` is the raw jsonb column. */
export interface PollEvidenceAnswer {
  pollId: string;
  studentId: string | null;
  answer: string | null;
  values?: unknown;
  createdAt?: string | null;
}

/** A row of the seeded `standards` table. */
export interface SeededStandard {
  id: string;
  domain: string;
}

export interface PollGrade {
  correct: boolean;
  /** 0-5, the scale `responses.score` is on and `warmupScoreToPct` divides by. */
  score0to5: number;
  /** Exact-match tag from the seeded vocabulary, or null. */
  misconception: string | null;
  /** The teacher-facing sentence, mirrored from the structured-numeric tally. */
  phrase: string;
}

/** A `responses` insert, in database column names so the caller cannot re-map it wrong. */
export interface PollEvidenceRow {
  student_id: string;
  problem_id: null;
  session_id: string | null;
  source: string;
  domain: string | null;
  standard_id: string | null;
  item_ref: string;
  dedupe_key: string;
  score: number | null;
  is_correct: boolean | null;
  misconception: string | null;
  graded_by: string;
  submitted_at: string;
}

export type PollEvidenceSkipReason =
  | "ungraded_kind"
  | "no_correct_answer"
  | "no_student"
  | "no_answer"
  | "unparsable_spec"
  | "answer_key_not_in_choices"
  | "no_standard_authored"
  | "unresolvable_standard";

export interface PollEvidenceReport {
  rows: PollEvidenceRow[];
  skipped: { pollId: string; studentId: string | null; reason: PollEvidenceSkipReason }[];
  /**
   * Authored standard codes that resolved to nothing, deduplicated. This is the
   * list that tells you which lesson to fix - it is the whole reason an
   * unresolvable code is reported instead of guessed.
   */
  unresolvedStandards: string[];
}

const clamp0to5 = (n: number): number => Math.max(0, Math.min(5, n));
const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * The most frequent tag, ties broken by first appearance so the result is
 * deterministic - a backfill re-run must not rewrite a student's row with a
 * different tag just because two errors happened equally often.
 */
function modalTag(tags: readonly string[]): string | null {
  if (!tags.length) return null;
  const counts = new Map<string, number>();
  for (const tag of tags) counts.set(tag, (counts.get(tag) || 0) + 1);
  let best = tags[0];
  for (const tag of tags) {
    if ((counts.get(tag) || 0) > (counts.get(best) || 0)) best = tag;
  }
  return best;
}

/**
 * Resolve an authored `Standard` value against the seeded `standards` table.
 *
 * Notion is authored in the CLUSTER-LETTER-OMITTED form ("6.NS.4") while the
 * seed uses the full dotted-letter form ("6.NS.B.4"), and some steps carry TWO
 * codes in one field ("6.EE.2b; 6.EE.3"). Measured on the live database
 * 2026-08-04: six distinct authored values across 80 polls, and only ONE of
 * them matched the seed. Every unmatched one silently produced a row that
 * influenced nothing.
 *
 * Two rules, both deliberate:
 *
 * - FIRST RESOLVABLE wins, not first listed. "6.EE.2b; 6.EE.3" leads with a
 *   code that is not seeded at all; taking the first token blindly would throw
 *   away the perfectly good second one.
 * - AN AMBIGUOUS INSERTION IS A REFUSAL. If "6.XX.3" could mean two different
 *   seeded standards, this returns null and lets the report name it. Guessing
 *   would attach real student evidence to the wrong standard, which is worse
 *   than attaching it to none.
 */
export function normalizeStandardId(
  authored: string | null | undefined,
  seeded: readonly string[],
): string | null {
  const raw = (authored || "").trim();
  if (!raw) return null;

  const seededIds = seeded.map((id) => id.trim()).filter(Boolean);
  const exact = new Map(seededIds.map((id) => [id.toUpperCase(), id]));

  for (const token of raw.split(/[;,]/)) {
    const candidate = token.trim();
    if (!candidate) continue;

    const direct = exact.get(candidate.toUpperCase());
    if (direct) return direct;

    // "6.NS.4" -> a seeded "6.<strand>.<letter>.4" with the same grade, strand
    // and trailing part. Only accepted when exactly one seeded id qualifies.
    const parts = candidate.toUpperCase().split(".");
    if (parts.length !== 3) continue;
    const [grade, strand, rest] = parts;
    const matches = seededIds.filter((id) => {
      const seg = id.toUpperCase().split(".");
      return seg.length === 4 && seg[0] === grade && seg[1] === strand && seg[3] === rest;
    });
    if (matches.length === 1) return matches[0];
  }

  return null;
}

/** The submitted boxes, coerced out of the `values` jsonb. */
export function pollAnswerValues(values: unknown): (number | null)[] {
  if (!Array.isArray(values)) return [];
  return values.map((v) => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  });
}

/**
 * Partial credit for a factor-pair build (Steele's call, 2026-08-04): four of
 * the six pairs of 24 is 3.33 of 5, not a red X. `reviewPairsSubmission`
 * already returns the arrays; nothing had ever computed the fraction.
 *
 * Invented pairs do NOT reduce the score - they set `correct: false` and carry
 * their own tag. The chosen rule was partial credit, not partial credit minus
 * a penalty, and a score a 6th grader cannot reconstruct is not feedback.
 *
 * The boxes shape gets no partial credit and cannot: `diagnoseStructuredNumeric`
 * short-circuits on the first failed rule, so "3 of 5 boxes right" is not
 * recoverable from the return value. That asymmetry is real; do not paper over
 * it by inventing a boxes fraction.
 */
function structuredScore(diagnosis: StructuredNumericDiagnosis): number {
  if (diagnosis.correct) return 5;
  const pairs = diagnosis.pairsResult;
  if (!pairs) return 0;
  const denominator = pairs.valid.length + pairs.missing.length;
  if (denominator <= 0) return 0;
  const earned = round2(clamp0to5((pairs.valid.length / denominator) * 5));
  // A build marked INCORRECT can never score full marks. Without this, a
  // student who found every real pair of 18 and also invented 4x4 scored 5 of
  // 5 - the bar rising 100% for a student the misconception tag had just
  // flagged, which is the bar disagreeing with the flag on the same answer.
  // The no-penalty rule still holds: they land at 4, not 3.75.
  return Math.min(earned, MAX_INCORRECT_SCORE);
}

/** Ceiling for an answer that was judged incorrect. See `structuredScore`. */
export const MAX_INCORRECT_SCORE = 4;

/**
 * The tag for a wrong pairs build. Mirrors `diagnosePairs`' own ORDER -
 * invented is tested before missing - so the tag always agrees with the phrase
 * the /control tally is grouping on. A student who is both incomplete AND
 * inventing reads as inventing, in both places.
 */
function pairsMisconception(diagnosis: StructuredNumericDiagnosis): string | null {
  const pairs = diagnosis.pairsResult;
  if (!pairs) return diagnosis.misconception;
  if (pairs.invented.length > 0) return PAIRS_INVENTED_MISCONCEPTION;
  if (pairs.missing.length > 0) return PAIRS_INCOMPLETE_MISCONCEPTION;
  return null;
}

/**
 * Grade one answer. Returns null when the pair is not gradable at all, which
 * the caller turns into a reported skip rather than a silent drop.
 *
 * Multiple choice uses BARE string equality, with no trim and no case fold.
 * That is a deliberate match to readinessEvidence.ts:202 - being more lenient
 * here would let the mastery bar call a student right while the visit list
 * calls the same answer wrong, and two graders disagreeing about one answer is
 * a worse bug than the strictness. Fix them together or not at all.
 */
export function gradePollAnswer(
  poll: PollEvidencePoll,
  answer: PollEvidenceAnswer,
): PollGrade | null {
  if (!isGradedPollKind(poll.kind)) return null;
  if (!poll.correctAnswer) return null;
  if (!answerKeyIsTappable(poll)) return null;

  if (poll.kind === "multiple-choice") {
    const submitted = answer.answer;
    if (submitted === null || submitted === undefined || submitted === "") return null;
    const correct = submitted === poll.correctAnswer;
    return {
      correct,
      score0to5: correct ? 5 : 0,
      misconception: null,
      phrase: correct ? "Correct" : "Chose a different answer",
    };
  }

  const parsed = parseStructuredNumericSpec(poll.correctAnswer);
  if (!parsed.ok) return null;

  const values = pollAnswerValues(answer.values);
  if (values.length === 0) return null;

  const diagnosis = diagnoseStructuredNumeric(parsed.spec, values);
  return {
    correct: diagnosis.correct,
    score0to5: structuredScore(diagnosis),
    misconception: diagnosis.correct ? null : pairsMisconception(diagnosis),
    phrase: diagnosis.phrase,
  };
}

/**
 * Build every `responses` row for a set of polls and their answers.
 *
 * Pure: give it the rows and the seeded standards and it decides everything.
 * The caller does the I/O and the upsert.
 */
export function pollEvidenceRows(
  polls: readonly PollEvidencePoll[],
  answers: readonly PollEvidenceAnswer[],
  standards: readonly SeededStandard[],
  now: string = new Date().toISOString(),
): PollEvidenceReport {
  const rows: PollEvidenceRow[] = [];
  const skipped: PollEvidenceReport["skipped"] = [];
  const unresolved = new Set<string>();
  // One bar row per student per lesson per domain, NOT one per question.
  //
  // WHY, measured: the bars are an EWMA at alpha 0.30 per event. One row per
  // question means a lesson with four graded checks applies four consecutive
  // steps - four wrong answers take a domain bar 60 -> 42 -> 29 -> 21 -> 14 in
  // a single 50-minute period, and the last question of the day dominates the
  // visible number. Every other writer aggregates first: the warm-up posts one
  // row per DAY, toolEvidence one per (student x tool x day). This matches
  // them, so a lesson moves a bar exactly as hard as a warm-up does.
  //
  // Keyed by DOMAIN as well as session, because a bar is per-domain and a
  // lesson touching two domains must not average them into one number.
  const buckets = new Map<string, {
    studentId: string;
    sessionId: string | null;
    domain: string;
    scores: number[];
    tags: string[];
    latestAt: string;
  }>();

  const seededIds = standards.map((s) => s.id);
  const domainById = new Map(standards.map((s) => [s.id, s.domain]));
  const answersByPoll = new Map<string, PollEvidenceAnswer[]>();
  for (const a of answers) {
    const list = answersByPoll.get(a.pollId);
    if (list) list.push(a);
    else answersByPoll.set(a.pollId, [a]);
  }

  for (const poll of polls) {
    const pollAnswers = answersByPoll.get(poll.id) || [];
    if (pollAnswers.length === 0) continue;

    if (!isGradedPollKind(poll.kind)) {
      skipped.push({ pollId: poll.id, studentId: null, reason: "ungraded_kind" });
      continue;
    }
    if (!poll.correctAnswer) {
      skipped.push({ pollId: poll.id, studentId: null, reason: "no_correct_answer" });
      continue;
    }
    if (poll.kind === "structured-numeric" && !parseStructuredNumericSpec(poll.correctAnswer).ok) {
      skipped.push({ pollId: poll.id, studentId: null, reason: "unparsable_spec" });
      continue;
    }
    if (!answerKeyIsTappable(poll)) {
      // The key is not one of the choices, so nobody could have submitted it.
      // Grading would mark the entire class wrong and make that permanent.
      skipped.push({ pollId: poll.id, studentId: null, reason: "answer_key_not_in_choices" });
      continue;
    }
    if (!poll.standardId) {
      // No standard means no domain, and rule 3 in this file's header: a
      // domainless row is evidence that influences nothing.
      skipped.push({ pollId: poll.id, studentId: null, reason: "no_standard_authored" });
      continue;
    }

    const standardId = normalizeStandardId(poll.standardId, seededIds);
    if (!standardId) {
      unresolved.add(poll.standardId.trim());
      skipped.push({ pollId: poll.id, studentId: null, reason: "unresolvable_standard" });
      continue;
    }
    const domain = domainById.get(standardId) || null;
    if (!domain) {
      unresolved.add(poll.standardId.trim());
      skipped.push({ pollId: poll.id, studentId: null, reason: "unresolvable_standard" });
      continue;
    }

    for (const answer of pollAnswers) {
      if (!answer.studentId) {
        skipped.push({ pollId: poll.id, studentId: null, reason: "no_student" });
        continue;
      }
      const grade = gradePollAnswer(poll, answer);
      if (!grade) {
        skipped.push({ pollId: poll.id, studentId: answer.studentId, reason: "no_answer" });
        continue;
      }

      const submittedAt = answer.createdAt || now;

      // The STANDARD row, per question, feeding the per-standard stage gate
      // only. score null so recompute reads it through `is_correct` at 100/0,
      // matching how toolEvidence writes its per-problem row.
      rows.push({
        student_id: answer.studentId,
        problem_id: null,
        session_id: poll.sessionId,
        source: POLL_EVIDENCE_SOURCE,
        domain,
        standard_id: standardId,
        item_ref: `poll:${poll.id}`,
        dedupe_key: `poll:${poll.id}:${answer.studentId}:std`,
        score: null,
        is_correct: grade.correct,
        misconception: grade.misconception,
        graded_by: POLL_EVIDENCE_GRADED_BY,
        submitted_at: submittedAt,
      });

      // ...and accumulate toward ONE bar row for the whole lesson.
      const key = `${poll.sessionId || "no-session"}|${answer.studentId}|${domain}`;
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.scores.push(grade.score0to5);
        if (grade.misconception) bucket.tags.push(grade.misconception);
        if (submittedAt > bucket.latestAt) bucket.latestAt = submittedAt;
      } else {
        buckets.set(key, {
          studentId: answer.studentId,
          sessionId: poll.sessionId,
          domain,
          scores: [grade.score0to5],
          tags: grade.misconception ? [grade.misconception] : [],
          latestAt: submittedAt,
        });
      }
    }
  }

  for (const [key, bucket] of buckets) {
    const mean = bucket.scores.reduce((a, b) => a + b, 0) / bucket.scores.length;
    rows.push({
      student_id: bucket.studentId,
      problem_id: null,
      session_id: bucket.sessionId,
      source: POLL_EVIDENCE_SOURCE,
      domain: bucket.domain,
      // standard_id null on purpose - rule 1 in the header. This is the row
      // that moves the bar, and a standard on it would exclude it.
      standard_id: null,
      item_ref: `poll-lesson:${bucket.sessionId || "no-session"}`,
      dedupe_key: `poll:agg:${key}`,
      score: round2(clamp0to5(mean)),
      // null like toolEvidence's daily aggregate: the score is the signal, and
      // "was the lesson correct" is not a question with an answer.
      is_correct: null,
      misconception: modalTag(bucket.tags),
      graded_by: POLL_EVIDENCE_GRADED_BY,
      submitted_at: bucket.latestAt,
    });
  }

  return { rows, skipped, unresolvedStandards: [...unresolved].sort() };
}
