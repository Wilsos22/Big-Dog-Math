// Bridge poll answers into `responses`, then move the bars.
//
// Teacher-gated by src/proxy.ts (`/api/teacher` is already a PROTECTED_PREFIX
// with a matcher entry - no proxy change was needed for this route).
//
// IDEMPOTENT BY DESIGN, so it is safe to run repeatedly and safe to run late.
// Every row carries a dedupe_key of `poll:<pollId>:<studentId>:<bar|std>` and
// upserts on it WITHOUT ignoreDuplicates, so a student who corrects an answer
// gets their evidence corrected too. That is the deliberate difference from
// toolEvidence's per-problem row, which is first-write-wins.
//
// IT ENDS BY CALLING recompute, and that is not a convenience. Nothing else in
// the codebase triggers it - not /api/evidence, not either tool path - which is
// why the `mastery` table sat empty with 216 perfectly valid rows waiting in
// `responses`. A bridge that writes rows nobody recomputes would repeat the
// exact pattern this was built to end.
//
// GET is a DRY RUN: same work, no writes, so you can see what a run would do
// (and read the unresolved-standard report) before touching the table.

import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { recomputePeriod } from "@/lib/recompute";
import {
  GRADED_POLL_KINDS,
  pollEvidenceRows,
  type PollEvidenceAnswer,
  type PollEvidencePoll,
  type SeededStandard,
} from "@/lib/pollEvidence";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Read caps. A silently truncated read is this repo's signature failure - it
 * loses student evidence and reports success - so hitting either cap is
 * REPORTED in `truncated`, never swallowed. Do not raise a cap without keeping
 * the report.
 */
const POLL_LIMIT = 5000;
const ANSWER_LIMIT = 50000;

type Db = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

interface BuildResult {
  polls: number;
  answers: number;
  rows: ReturnType<typeof pollEvidenceRows>["rows"];
  skipped: ReturnType<typeof pollEvidenceRows>["skipped"];
  unresolvedStandards: string[];
  periodIds: string[];
  /** Non-empty means a read hit its cap and evidence is missing from this run. */
  truncated: string[];
}

async function build(db: Db, sessionId: string, periodId: string): Promise<BuildResult | { error: string; status: number }> {
  // Sessions in scope. Poll rows carry a session, not a period, so a period
  // filter has to resolve through `sessions` first.
  let sessionIds: string[] | null = null;
  if (sessionId) {
    sessionIds = [sessionId];
  } else if (periodId) {
    const { data, error } = await db.from("sessions").select("id").eq("period_id", periodId);
    if (error) return { error: error.message, status: 500 };
    sessionIds = (data || []).map((s) => s.id as string);
    if (!sessionIds.length) return { error: "No sessions for that period.", status: 404 };
  }

  let pollQuery = db
    .from("polls")
    .select("id,kind,session_id,correct_answer,standard_id,choices")
    .in("kind", [...GRADED_POLL_KINDS])
    .limit(POLL_LIMIT);
  if (sessionIds) pollQuery = pollQuery.in("session_id", sessionIds);
  const { data: pollRows, error: pollErr } = await pollQuery;
  if (pollErr) return { error: pollErr.message, status: 500 };

  const polls: PollEvidencePoll[] = (pollRows || []).map((p) => ({
    id: p.id as string,
    kind: (p.kind as string) ?? null,
    sessionId: (p.session_id as string) ?? null,
    correctAnswer: (p.correct_answer as string) ?? null,
    standardId: (p.standard_id as string) ?? null,
    choices: Array.isArray(p.choices) ? (p.choices as unknown[]).filter((c): c is string => typeof c === "string") : null,
  }));
  if (!polls.length) {
    return {
      polls: 0, answers: 0, rows: [], skipped: [],
      unresolvedStandards: [], periodIds: [], truncated: [],
    };
  }

  // `poll_answers.values` arrives from a hand-run migration
  // (supabase/poll-structured-numeric.sql). Both other readers of this table
  // carry a fallback ladder for exactly that reason; without one, a fresh
  // environment 500s with a raw PostgREST column error.
  const pollIds = polls.map((p) => p.id);
  let answerRows: Record<string, unknown>[] | null = null;
  const withValues = await db
    .from("poll_answers")
    .select("poll_id,student_id,answer,values,created_at")
    .in("poll_id", pollIds)
    .limit(ANSWER_LIMIT);
  if (withValues.error) {
    const withoutValues = await db
      .from("poll_answers")
      .select("poll_id,student_id,answer,created_at")
      .in("poll_id", pollIds)
      .limit(ANSWER_LIMIT);
    if (withoutValues.error) return { error: withoutValues.error.message, status: 500 };
    answerRows = withoutValues.data as Record<string, unknown>[] | null;
  } else {
    answerRows = withValues.data as Record<string, unknown>[] | null;
  }

  const answers: PollEvidenceAnswer[] = (answerRows || []).map((a) => ({
    pollId: a.poll_id as string,
    studentId: (a.student_id as string) ?? null,
    answer: (a.answer as string) ?? null,
    values: a.values,
    createdAt: (a.created_at as string) ?? null,
  }));

  const { data: stdRows, error: stdErr } = await db.from("standards").select("id,domain");
  if (stdErr) return { error: stdErr.message, status: 500 };
  const standards: SeededStandard[] = (stdRows || []).map((s) => ({
    id: s.id as string,
    domain: s.domain as string,
  }));

  const report = pollEvidenceRows(polls, answers, standards);

  // The periods whose bars this run could change - derived from the students
  // actually written, so a run that graded nothing recomputes nothing.
  const studentIds = [...new Set(report.rows.map((r) => r.student_id))];
  let periodIds: string[] = [];
  if (studentIds.length) {
    const { data: studentRows } = await db
      .from("students").select("period_id").in("id", studentIds);
    periodIds = [...new Set((studentRows || []).map((s) => s.period_id as string).filter(Boolean))];
  }

  const truncated: string[] = [];
  if (polls.length >= POLL_LIMIT) truncated.push(`polls hit the ${POLL_LIMIT} cap`);
  if (answers.length >= ANSWER_LIMIT) truncated.push(`poll_answers hit the ${ANSWER_LIMIT} cap`);

  return {
    polls: polls.length,
    answers: answers.length,
    rows: report.rows,
    skipped: report.skipped,
    unresolvedStandards: report.unresolvedStandards,
    periodIds,
    truncated,
  };
}

function scope(request: Request) {
  const params = new URL(request.url).searchParams;
  return {
    sessionId: (params.get("sessionId") || "").trim(),
    periodId: (params.get("periodId") || "").trim(),
  };
}

export async function GET(request: Request) {
  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Database not configured." }, { status: 503 });
  const { sessionId, periodId } = scope(request);
  const result = await build(db, sessionId, periodId);
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
  return Response.json(
    {
      dryRun: true,
      pollsConsidered: result.polls,
      answersConsidered: result.answers,
      rowsThatWouldBeWritten: result.rows.length,
      skipped: result.skipped,
      unresolvedStandards: result.unresolvedStandards,
      truncated: result.truncated,
      periodsThatWouldRecompute: result.periodIds.length,
    },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Database not configured." }, { status: 503 });

  let body: { sessionId?: unknown; periodId?: unknown; recompute?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  const periodId = typeof body.periodId === "string" ? body.periodId.trim() : "";
  const shouldRecompute = body.recompute !== false;

  const result = await build(db, sessionId, periodId);
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });

  let written = 0;
  if (result.rows.length) {
    // Chunked because a whole period of exit tickets is ~30 students x 2 rows
    // per graded step, and the payload grows with the lineup, not the class.
    for (let i = 0; i < result.rows.length; i += 500) {
      const chunk = result.rows.slice(i, i + 500);
      const { error } = await db.from("responses").upsert(chunk, { onConflict: "dedupe_key" });
      if (error) {
        return Response.json(
          { error: error.message, written, stage: "upsert" },
          { status: 500 },
        );
      }
      written += chunk.length;
    }
  }

  // Recompute is reported, never fatal - the evidence is already durable at
  // this point, and a 500 here would look like the bridge lost what it wrote.
  //
  // BUT KNOW WHAT A FAILURE ACTUALLY LEAVES BEHIND. `recomputePeriod` is
  // destructive-then-rebuild: recompute.ts:162-173 DELETEs `mastery_history`
  // and `mastery` for the period's students BEFORE inserting. So a failure -
  // or a maxDuration timeout part-way through this loop - leaves that period
  // with ZERO mastery rows, not stale ones, and /teacher/mastery reads empty.
  // Every successful run has a brief empty window for the same reason.
  // Re-running fixes it; reading `recomputed[].ok` is how you know to.
  const recomputed: { periodId: string; ok: boolean; detail: string }[] = [];
  if (shouldRecompute) {
    for (const pid of result.periodIds) {
      const summary = await recomputePeriod(db, pid);
      const failed = summary && typeof summary === "object" && "error" in summary;
      recomputed.push({
        periodId: pid,
        ok: !failed,
        detail: failed
          ? (summary as { error: string }).error
          : `${(summary as { masteryRows: number }).masteryRows} mastery rows`,
      });
    }
  }

  return Response.json(
    {
      pollsConsidered: result.polls,
      answersConsidered: result.answers,
      written,
      skipped: result.skipped,
      unresolvedStandards: result.unresolvedStandards,
      truncated: result.truncated,
      recomputed,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
