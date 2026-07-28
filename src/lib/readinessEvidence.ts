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

import { diagnoseStructuredNumeric, parseStructuredNumericSpec } from "./structuredNumeric";
import type { ReadinessEvidence } from "./cityRoutes";

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
    db.from("polls").select("id,question,kind,created_at").eq("session_id", sessionId)
      .order("created_at", { ascending: true }),
    db.from("session_joins").select("student_id,display_name,joined_at").eq("session_id", sessionId)
      .order("joined_at", { ascending: true }),
  ]);

  // Latest poll per (kind, question) - a re-opened question supersedes.
  const pollByQuestion = new Map<string, string>();
  for (const poll of (polls || []) as { id: string; question: string; kind: string }[]) {
    pollByQuestion.set(`${poll.kind}|${poll.question}`, poll.id);
  }
  // A readiness question may be authored as either kind. Missing the
  // structured key means no poll is found and everyone reads as unanswered.
  const questionPollIds = questionSteps.map(
    (step) => pollByQuestion.get(`structured-numeric|${step.question}`)
      || pollByQuestion.get(`multiple-choice|${step.question}`)
      || null,
  );
  const fistPollId = fistStep ? pollByQuestion.get(`fist-to-five|${fistStep.question}`) || null : null;

  const pollIds = [...questionPollIds, fistPollId].filter((id): id is string => Boolean(id));
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
    const key = `${answer.poll_id}|${studentKeyOf(answer.student_id, answer.display_name)}`;
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

  const specs = questionSteps.map((step) => {
    const parsed = parseStructuredNumericSpec(step.correctAnswer);
    return parsed.ok ? parsed.spec : null;
  });

  const errors = new Map<string, string>();
  const arithmeticOnly = new Set<string>();
  const evidence: ReadinessEvidence[] = [...roster.entries()].map(([studentKey, name]) => {
    let sawNonArithmeticMiss = false;
    let sawArithmeticMiss = false;
    const correct = questionSteps.map((step, index) => {
      const pollId = questionPollIds[index];
      if (!pollId) return null;
      const answerKey = `${pollId}|${studentKey}`;
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
      return answer === step.correctAnswer;
    });
    if (sawArithmeticMiss && !sawNonArithmeticMiss) arithmeticOnly.add(studentKey);

    const fistRaw = fistPollId ? latestAnswer.get(`${fistPollId}|${studentKey}`) : undefined;
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

  return { lessonCode, questionSteps, hasFist: Boolean(fistPollId), evidence, errors, arithmeticOnly };
}
