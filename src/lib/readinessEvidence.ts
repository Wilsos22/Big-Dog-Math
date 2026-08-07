/**
 * Readiness evidence for one live session - the shared read behind City Routes
 * and the ranked visit list.
 *
 * BOTH surfaces must agree about who answered what. Two engines computing the
 * same thing from the same tables is exactly how /control and
 * /api/control-remote ended up running different lessons from one Notion page,
 * so this is the single place that assembles it.
 *
 * Server-only: it takes the service-role client. Never import this into a
 * client component.
 */

import { LIVE_POLL_KINDS, isChoicePollKind, isLivePollKind } from "./liveFlowContract";
import { diagnoseStructuredNumeric, parseStructuredNumericSpec } from "./structuredNumeric";

/**
 * Every kind a `question` step can actually open, straight from
 * resolveLiveStepPollKind: the authored Response Mode, the legacy Poll Kind,
 * or the `short-answer` fallback a blank Response Mode lands on. Looking up
 * only two of them was how a step authored as Multiple Choice + Explain - or
 * with a blank Response Mode - opened a poll this reader could never find, so
 * every answer came back null and the whole class ranked as needing a visit.
 *
 * fist-to-five is deliberately absent: it is a confidence self-report, never a
 * readiness question, and it is looked up on its own below.
 */
const QUESTION_POLL_KINDS: readonly string[] = LIVE_POLL_KINDS.filter(
  (kind) => kind !== "fist-to-five",
);

export interface ReadinessEvidence {
  studentKey: string;
  name: string;
  /** One entry per readiness question, in lesson order. null = no answer. */
  correct: (boolean | null)[];
  /** Private Fist-to-Five rating 0-5, or null if not submitted. */
  fist: number | null;
  /**
   * Average manipulative-tool evidence score for THIS session (the 0-5
   * aggregate rows the tools write), or null when the student produced no
   * tool work. Constructed evidence that was being collected and ignored.
   */
  toolScore?: number | null;
}

export interface ReadinessStepLite {
  stateId?: string;
  question?: string;
  correctAnswer?: string;
  pollKind?: string | null;
  lessonCode?: string;
}

type Db = {
  from: (table: string) => {
    select: (columns: string, options?: unknown) => never;
  };
};

/** Roster key: the student id, or their display name when off-roster. */
export function studentKeyOf(studentId: string | null, displayName: string | null): string {
  return studentId || `name:${displayName || "student"}`;
}

export type ReadinessRead = {
  lessonCode: string;
  questionSteps: ReadinessStepLite[];
  /** Whether a Fist-to-Five poll was actually opened this session. */
  hasFist: boolean;
  evidence: ReadinessEvidence[];
  /**
   * Named error per student, from the structured-numeric diagnosis: the phrase
   * the teacher reads while walking. Only structured steps produce one - a
   * multiple-choice miss has no diagnosis attached.
   */
  errors: Map<string, string>;
  /** True when every wrong box a student had was only the final total. */
  arithmeticOnly: Set<string>;
};

type AnswerRow = {
  poll_id: string;
  student_id: string | null;
  display_name: string | null;
  answer: string | null;
  values?: (number | null)[] | null;
};

/** One `polls` row, narrowed to what finding and grading a step needs. */
type PollRow = {
  id: string;
  question: string | null;
  kind: string;
  correct_answer?: string | null;
  choices?: unknown;
};

/**
 * Judge one submitted answer against the POLL ROW, not against the step.
 *
 * The poll is the durable copy of the key the class actually saw, and it
 * outlives the lesson; the step's copy arrives from Notion UNTRIMMED while
 * every submitted answer is trimmed, so a single trailing space on a Notion
 * property marked the entire class wrong. Both sides are trimmed here for
 * exactly that reason.
 *
 * Returns null - UNGRADABLE, not wrong - when a choice poll's key appears in
 * none of its choices. That mirrors `answerKeyIsTappable` in pollEvidence.ts,
 * which refuses the same rows: nobody could have tapped a key that is not on
 * screen, so equality would fail everyone, and the mastery bridge and the
 * visit list must never disagree about one student's answer.
 */
function gradeAgainstPoll(
  poll: PollRow | null,
  step: ReadinessStepLite,
  submitted: string,
): boolean | null {
  // The step's key is the fallback only, for a poll row that stored none.
  const key = (poll?.correct_answer ?? "").trim() || (step.correctAnswer ?? "").trim();
  if (!key) return null;
  if (poll && isChoicePollKind(poll.kind)) {
    const choices = Array.isArray(poll.choices)
      ? poll.choices.filter((choice): choice is string => typeof choice === "string")
      : [];
    if (choices.length && !choices.includes(key)) return null;
  }
  return submitted.trim() === key;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyDb = any;

/**
 * Read one session's readiness evidence.
 *
 * `db` is the service-role client. Structured Numeric steps are judged by
 * their RULES, never by string equality: `answer` is the final box and
 * `correctAnswer` is four lines of rules, so exact-matching would read every
 * student as wrong and route the whole class to the teacher table.
 */
export async function loadReadinessEvidence(db: AnyDb, sessionId: string): Promise<ReadinessRead> {
  const { data: session, error: sessionError } = await db
    .from("sessions")
    .select("id, live_flow")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionError) throw new Error(sessionError.message);
  if (!session) throw new Error("Session not found.");

  const steps: ReadinessStepLite[] = session.live_flow?.sequence?.steps || [];
  const lessonCode = steps.find((step) => step.lessonCode)?.lessonCode || "";
  const questionSteps = steps.filter(
    (step) => step.stateId === "question" && step.question && step.correctAnswer,
  );
  const fistStep = [...steps].reverse().find((step) => step.pollKind === "fist-to-five" && step.question) || null;

  const [{ data: polls }, { data: joins }] = await Promise.all([
    // correct_answer and choices ride along because the POLL ROW is the answer
    // key now, not the step - see gradeAgainstPoll for why.
    db.from("polls").select("id,question,kind,correct_answer,choices,created_at").eq("session_id", sessionId)
      .order("created_at", { ascending: true }),
    db.from("session_joins").select("student_id,display_name,joined_at").eq("session_id", sessionId)
      .order("joined_at", { ascending: true }),
  ]);

  // Every poll per (kind, question), oldest first. A re-opened question still
  // supersedes for GRADING - the newest row holds the current key - but the
  // earlier openings keep their ANSWERS. Keeping only the newest poll id meant
  // a student who answered the first opening and never saw the second read as
  // unanswered, which visitList scores as tier 2 "Visit" for a right answer.
  //
  // The question is trimmed on BOTH sides of this key: a Notion question with
  // a trailing space otherwise matches no poll at all.
  const pollsByQuestion = new Map<string, PollRow[]>();
  for (const poll of (polls || []) as PollRow[]) {
    const key = `${poll.kind}|${(poll.question || "").trim()}`;
    const bucket = pollsByQuestion.get(key);
    if (bucket) bucket.push(poll);
    else pollsByQuestion.set(key, [poll]);
  }
  const pollsForStep = (step: ReadinessStepLite): PollRow[] => {
    const question = (step.question || "").trim();
    // The snapshot carries the kind the step RESOLVED to, so try that first,
    // then every other kind a question step can open.
    const authoredKind = step.pollKind || "";
    const kinds = isLivePollKind(authoredKind)
      ? [authoredKind, ...QUESTION_POLL_KINDS]
      : QUESTION_POLL_KINDS;
    for (const kind of kinds) {
      const found = pollsByQuestion.get(`${kind}|${question}`);
      if (found && found.length) return found;
    }
    return [];
  };
  const questionPolls = questionSteps.map(pollsForStep);
  const fistPolls = fistStep
    ? pollsByQuestion.get(`fist-to-five|${(fistStep.question || "").trim()}`) || []
    : [];

  // Answers collapse to a SLOT - one per readiness question, plus the fist -
  // rather than to a poll id, so duplicate polls for one step merge instead of
  // the newest empty one hiding answers the class already gave.
  const slotByPollId = new Map<string, string>();
  questionPolls.forEach((list, index) => {
    for (const poll of list) slotByPollId.set(poll.id, `q${index}`);
  });
  for (const poll of fistPolls) slotByPollId.set(poll.id, "fist");
  const pollIds = [...slotByPollId.keys()];
  // Structured boxes live in `values`; fall back to the narrow select so
  // readiness keeps working before poll-structured-numeric.sql is run.
  let answers: AnswerRow[] = [];
  if (pollIds.length) {
    for (const columns of [
      "poll_id,student_id,display_name,answer,values,created_at",
      "poll_id,student_id,display_name,answer,created_at",
    ]) {
      const attempt = await db.from("poll_answers").select(columns)
        .in("poll_id", pollIds).order("created_at", { ascending: true });
      if (!attempt.error) {
        answers = (attempt.data || []) as AnswerRow[];
        break;
      }
    }
  }

  const latestAnswer = new Map<string, string>();
  const latestValues = new Map<string, (number | null)[]>();
  for (const answer of answers) {
    const slot = slotByPollId.get(answer.poll_id);
    if (!slot) continue;
    const key = `${slot}|${studentKeyOf(answer.student_id, answer.display_name)}`;
    if (answer.answer != null) latestAnswer.set(key, answer.answer);
    if (Array.isArray(answer.values)) latestValues.set(key, answer.values);
  }

  const roster = new Map<string, string>();
  for (const join of (joins || []) as { student_id: string | null; display_name: string | null }[]) {
    roster.set(studentKeyOf(join.student_id, join.display_name), join.display_name || "Student");
  }

  // This session's constructed tool work: the 0-5 aggregate rows the
  // manipulatives write. Averaged per student, it is the routing tie-breaker.
  const { data: toolRows } = await db
    .from("responses")
    .select("student_id,score")
    .eq("session_id", sessionId)
    .eq("source", "tool")
    .is("standard_id", null)
    .not("score", "is", null);
  const toolTotals = new Map<string, { sum: number; count: number }>();
  for (const row of (toolRows || []) as { student_id: string | null; score: number | string }[]) {
    if (!row.student_id) continue;
    const score = Number(row.score);
    if (!Number.isFinite(score)) continue;
    const tally = toolTotals.get(row.student_id) || { sum: 0, count: 0 };
    tally.sum += score;
    tally.count += 1;
    toolTotals.set(row.student_id, tally);
  }

  // Same precedence as gradeAgainstPoll: the durable poll key first, the
  // step's Notion copy only as a fallback, so both paths judge one answer
  // against one key.
  const gradingPolls = questionPolls.map((list) => (list.length ? list[list.length - 1] : null));
  const specs = questionSteps.map((step, index) => {
    const key = (gradingPolls[index]?.correct_answer ?? "").trim() || step.correctAnswer;
    const parsed = parseStructuredNumericSpec(key);
    return parsed.ok ? parsed.spec : null;
  });

  const errors = new Map<string, string>();
  const arithmeticOnly = new Set<string>();
  const evidence: ReadinessEvidence[] = [...roster.entries()].map(([studentKey, name]) => {
    let sawNonArithmeticMiss = false;
    let sawArithmeticMiss = false;
    const correct = questionSteps.map((step, index) => {
      if (!questionPolls[index].length) return null;
      const answerKey = `q${index}|${studentKey}`;
      const spec = specs[index];
      if (spec) {
        const values = latestValues.get(answerKey);
        if (!values) return null;
        const diagnosis = diagnoseStructuredNumeric(spec, values);
        if (!diagnosis.correct) {
          // First named error wins, so the teacher gets one sentence.
          if (!errors.has(studentKey)) errors.set(studentKey, diagnosis.phrase);
          if (diagnosis.tier === 3) sawArithmeticMiss = true;
          else sawNonArithmeticMiss = true;
        }
        return diagnosis.correct;
      }
      const answer = latestAnswer.get(answerKey);
      if (answer === undefined) return null;
      return gradeAgainstPoll(gradingPolls[index], step, answer);
    });
    if (sawArithmeticMiss && !sawNonArithmeticMiss) arithmeticOnly.add(studentKey);

    const fistRaw = fistPolls.length ? latestAnswer.get(`fist|${studentKey}`) : undefined;
    const fistParsed = fistRaw !== undefined ? Number.parseInt(fistRaw, 10) : Number.NaN;
    const fist = Number.isInteger(fistParsed) && fistParsed >= 0 && fistParsed <= 5 ? fistParsed : null;
    const tally = toolTotals.get(studentKey);
    return {
      studentKey,
      name,
      correct,
      fist,
      toolScore: tally && tally.count ? tally.sum / tally.count : null,
    };
  });

  return { lessonCode, questionSteps, hasFist: fistPolls.length > 0, evidence, errors, arithmeticOnly };
}
