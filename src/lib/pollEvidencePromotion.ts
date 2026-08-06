// Bridge caller: a closing session's graded poll answers become `responses`
// rows, then the affected periods recompute.
//
// THE BRIDGE EXISTED AND NOTHING CALLED IT. src/lib/pollEvidence.ts and
// POST /api/teacher/poll-evidence have turned poll answers into mastery
// evidence since 2026-08-04, but no code path ever invoked either, so
// `responses` held zero rows with source "poll" and the day's learning checks
// and exit ticket moved no bar at all. Ending the session is the moment that
// evidence is complete, so this is where it runs.
//
// IT LIVES IN ITS OWN MODULE BECAUSE A SESSION CLOSES THREE WAYS, NOT ONE.
// This was inline in the teacher's manual Close branch of
// /api/teacher/session - which is the path a real five-period day uses LEAST.
// Starting or adopting the next period closes the previous one
// (closeOtherOpenSessions) and a forgotten session closes itself
// (sweepStaleSessions), and neither promoted anything, so a day kept only the
// evidence of whichever session was closed by hand. All three funnel through
// closeSessions in sessionLifecycle.ts, so that is the one caller that covers
// them.
//
// NON-FATAL BY CONSTRUCTION. The class is already over; a bridge failure must
// never keep a session open. Every path logs and returns, and every row is
// idempotent by dedupe_key, so POST /api/teacher/poll-evidence recovers the
// same session later and writes exactly the same rows.

import { after } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { recomputePeriod } from "@/lib/recompute";
import {
  GRADED_POLL_KINDS,
  pollEvidenceRows,
  type PollEvidenceAnswer,
  type PollEvidencePoll,
  type SeededStandard,
} from "@/lib/pollEvidence";

type Db = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

/** Promote this session's graded poll answers into `responses`, then recompute. */
export async function promotePollEvidenceForSession(db: Db, sessionId: string): Promise<void> {
  try {
    const { data: pollRows, error: pollError } = await db
      .from("polls")
      .select("id,kind,session_id,correct_answer,standard_id,choices")
      .eq("session_id", sessionId)
      .in("kind", [...GRADED_POLL_KINDS]);
    if (pollError) throw new Error(pollError.message);
    const polls: PollEvidencePoll[] = (pollRows || []).map((poll) => ({
      id: poll.id as string,
      kind: (poll.kind as string) ?? null,
      sessionId: (poll.session_id as string) ?? null,
      correctAnswer: (poll.correct_answer as string) ?? null,
      standardId: (poll.standard_id as string) ?? null,
      choices: Array.isArray(poll.choices)
        ? (poll.choices as unknown[]).filter((choice): choice is string => typeof choice === "string")
        : null,
    }));
    if (!polls.length) return;

    // `poll_answers.values` arrives from a hand-run migration
    // (supabase/poll-structured-numeric.sql), so every reader of this table
    // carries the same fallback ladder rather than 500ing on a fresh database.
    const pollIds = polls.map((poll) => poll.id);
    const withValues = await db
      .from("poll_answers")
      .select("poll_id,student_id,answer,values,created_at")
      .in("poll_id", pollIds);
    let answerRows: Record<string, unknown>[] = [];
    if (withValues.error) {
      const withoutValues = await db
        .from("poll_answers")
        .select("poll_id,student_id,answer,created_at")
        .in("poll_id", pollIds);
      if (withoutValues.error) throw new Error(withoutValues.error.message);
      answerRows = (withoutValues.data || []) as Record<string, unknown>[];
    } else {
      answerRows = (withValues.data || []) as Record<string, unknown>[];
    }
    if (!answerRows.length) return;

    const answers: PollEvidenceAnswer[] = answerRows.map((row) => ({
      pollId: row.poll_id as string,
      studentId: (row.student_id as string) ?? null,
      answer: (row.answer as string) ?? null,
      values: row.values,
      createdAt: (row.created_at as string) ?? null,
    }));

    const { data: standardRows, error: standardError } = await db.from("standards").select("id,domain");
    if (standardError) throw new Error(standardError.message);
    const standards: SeededStandard[] = (standardRows || []).map((row) => ({
      id: row.id as string,
      domain: row.domain as string,
    }));

    const { rows } = pollEvidenceRows(polls, answers, standards);
    if (!rows.length) return;

    // Chunked for the same reason the route chunks: the payload grows with the
    // lineup, not the class.
    for (let index = 0; index < rows.length; index += 500) {
      const { error } = await db
        .from("responses")
        .upsert(rows.slice(index, index + 500), { onConflict: "dedupe_key" });
      if (error) throw new Error(error.message);
    }

    // Nothing else in the codebase triggers a recompute, and rows nobody
    // recomputes are exactly the failure this bridge exists to end. It runs in
    // after() so the teacher's Close is not held behind it, and it is
    // destructive-then-rebuild (recompute deletes a period's mastery before
    // inserting), so a failure leaves that period empty until the next run
    // rather than stale - re-running fixes it.
    const studentIds = [...new Set(rows.map((row) => row.student_id))];
    const { data: studentRows } = await db.from("students").select("period_id").in("id", studentIds);
    const periodIds = [...new Set((studentRows || [])
      .map((row) => row.period_id as string)
      .filter(Boolean))];
    if (!periodIds.length) return;
    after(async () => {
      for (const periodId of periodIds) {
        try {
          const summary = await recomputePeriod(db, periodId);
          if (summary && typeof summary === "object" && "error" in summary) {
            console.warn("session close: recompute reported an error", { sessionId, periodId, error: summary.error });
          }
        } catch (error) {
          console.warn("session close: recompute failed", { sessionId, periodId, error });
        }
      }
    });
  } catch (error) {
    console.warn("session close: poll evidence promotion failed", { sessionId, error });
  }
}
