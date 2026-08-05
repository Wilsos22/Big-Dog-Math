import { after } from "next/server";
import { recordSecurityEvent } from "@/lib/securityAudit";
import { closeOtherOpenSessions, sweepStaleSessions } from "@/lib/sessionLifecycle";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { broadcastLiveFlowChange } from "@/lib/liveFlowBroadcast";
import { liveFlowScreensChanged } from "@/lib/liveFlowScreens";
import { recomputePeriod } from "@/lib/recompute";
import {
  GRADED_POLL_KINDS,
  pollEvidenceRows,
  type PollEvidenceAnswer,
  type PollEvidencePoll,
  type SeededStandard,
} from "@/lib/pollEvidence";
import type { LiveClassFlowSnapshot } from "@/lib/liveClassFlow";

export const dynamic = "force-dynamic";

type Db = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

type SessionAction =
  | { action: "start"; periodId?: unknown; joinCode?: unknown; assignmentId?: unknown }
  | { action: "update"; sessionId?: unknown; broadcast?: unknown; liveFlow?: unknown; expectedLiveFlowUpdatedAt?: unknown; remoteCommand?: unknown; expectedRemoteCommandNonce?: unknown }
  | { action: "admit"; sessionId?: unknown; requestCode?: unknown; studentId?: unknown }
  | { action: "close"; sessionId?: unknown };

type AdmissionResolution = {
  outcome: string;
  join_id: string | null;
  resolved_student_id: string | null;
  resolved_display_name: string | null;
  resolved_joined_at: string | null;
};

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/**
 * Promote this session's graded poll answers into `responses`, then recompute.
 *
 * THE BRIDGE EXISTED AND NOTHING CALLED IT. src/lib/pollEvidence.ts and
 * POST /api/teacher/poll-evidence have turned poll answers into mastery
 * evidence since 2026-08-04, but no code path ever invoked either, so
 * `responses` held zero rows with source "poll" and the day's learning checks
 * and exit ticket moved no bar at all. Ending the session is the moment that
 * evidence is complete, so this is where it runs.
 *
 * NON-FATAL BY CONSTRUCTION. The class is already over; a bridge failure must
 * never keep a session open. Every path logs and returns, and every row is
 * idempotent by dedupe_key, so POST /api/teacher/poll-evidence recovers the
 * same session later and writes exactly the same rows.
 */
async function promotePollEvidence(db: Db, sessionId: string): Promise<void> {
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

function isMissingAdmissionSchema(code?: string): boolean {
  return code === "42703" || code === "42883" || code === "PGRST202" || code === "PGRST204";
}

async function admissionFailure(input: {
  status: number;
  message: string;
  reason: string;
  outcome: "denied" | "conflict" | "error";
  sessionId?: string | null;
  studentId?: string | null;
  authUserId?: string | null;
}): Promise<Response> {
  await recordSecurityEvent({
    eventType: "teacher_student_admit",
    outcome: input.outcome,
    sessionId: input.sessionId,
    studentId: input.studentId,
    authUserId: input.authUserId,
    details: { reason: input.reason },
  });
  return Response.json(
    { error: input.message, code: input.reason },
    { status: input.status, headers: { "cache-control": "no-store" } },
  );
}

export async function GET(request: Request) {
  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Database not configured." }, { status: 503 });
  const searchParams = new URL(request.url).searchParams;
  const sessionId = searchParams.get("sessionId") || "";
  const liveSessionId = searchParams.get("liveSessionId") || "";
  const latestOpen = searchParams.get("latestOpen") === "1";

  // Retire sessions that outlived their class before anything reads them, so a
  // forgotten session cannot keep answering as "the open one". Throttled to one
  // real query per minute per instance, which /control's 1.2s poll relies on.
  await sweepStaleSessions(db);

  // Projectors and the live host only need the current session row. Keep this
  // path intentionally small because those classroom surfaces poll frequently.
  if (liveSessionId || latestOpen) {
    let query = db
      .from("sessions")
      .select("id,period_id,assignment_id,join_code,status,started_at,ended_at,broadcast,live_flow,remote_command")
      .eq("status", "open");
    query = liveSessionId
      ? query.eq("id", liveSessionId)
      : query.order("started_at", { ascending: false }).limit(1);
    const { data, error } = await query;
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ sessions: data ?? [] }, { headers: { "cache-control": "no-store" } });
  }

  if (!sessionId) {
    const { data, error } = await db
      .from("sessions")
      .select("id,period_id,assignment_id,join_code,status,started_at,ended_at,broadcast,live_flow,remote_command")
      .order("started_at", { ascending: false })
      .limit(50);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ sessions: data ?? [] }, { headers: { "cache-control": "no-store" } });
  }

  const [sessionResult, joinResult, admissionResult, pollResult] = await Promise.all([
    db.from("sessions")
      .select("id,period_id,assignment_id,join_code,status,started_at,ended_at,broadcast,live_flow,remote_command")
      .eq("id", sessionId)
      .maybeSingle(),
    db.from("session_joins")
      .select("id,student_id,display_name,joined_at")
      .eq("session_id", sessionId)
      .order("joined_at"),
    db.from("session_joins")
      .select("id,request_code,joined_at")
      .eq("session_id", sessionId)
      .is("student_id", null)
      .not("auth_user_id", "is", null)
      .not("request_code", "is", null)
      .order("joined_at"),
    db.from("polls")
      .select("id,question,choices,kind,status,correct_answer,created_at,lesson_code,notion_step_id,standard_id")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false }),
  ]);
  if (sessionResult.error) return Response.json({ error: sessionResult.error.message }, { status: 500 });
  if (!sessionResult.data) return Response.json({ error: "Session not found." }, { status: 404 });
  if (joinResult.error) return Response.json({ error: joinResult.error.message }, { status: 500 });
  if (admissionResult.error && !isMissingAdmissionSchema(admissionResult.error.code)) {
    return Response.json({ error: admissionResult.error.message }, { status: 500 });
  }
  if (pollResult.error) return Response.json({ error: pollResult.error.message }, { status: 500 });

  const pollIds = (pollResult.data ?? []).map((poll) => poll.id);
  const answerResult = pollIds.length
    ? await db.from("poll_answers")
      .select("id,poll_id,student_id,display_name,answer,created_at")
      .in("poll_id", pollIds)
      .order("created_at")
    : { data: [], error: null };
  if (answerResult.error) return Response.json({ error: answerResult.error.message }, { status: 500 });

  const admissionRows = admissionResult.error ? [] : (admissionResult.data ?? []);
  const admissionIds = new Set(admissionRows.map((row) => row.id));

  return Response.json(
    {
      session: sessionResult.data,
      joins: (joinResult.data ?? []).filter((row) => !admissionIds.has(row.id)),
      admissionRequests: admissionRows.map((row) => ({
        id: row.id,
        requestCode: row.request_code,
        requestedAt: row.joined_at,
      })),
      polls: pollResult.data ?? [],
      pollAnswers: answerResult.data ?? [],
    },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Database not configured." }, { status: 503 });
  const body = await request.json().catch(() => ({})) as SessionAction;

  if (body.action === "admit") {
    const sessionId = text(body.sessionId, 80);
    const requestCode = text(body.requestCode, 6).toUpperCase();
    // Admission is keyed by roster student id - the site has no student emails
    // to match against (pseudonymous roster; see src/lib/pseudonym.ts).
    const studentId = text(body.studentId, 80);
    if (!sessionId || !/^[A-HJ-NP-Z2-9]{6}$/.test(requestCode) || !studentId) {
      return admissionFailure({
        status: 400,
        message: "A session, request code, and roster student are required.",
        reason: "invalid_admission_request",
        outcome: "denied",
        sessionId: sessionId || null,
      });
    }

    const { data: session, error: sessionError } = await db
      .from("sessions")
      .select("id,period_id,status")
      .eq("id", sessionId)
      .maybeSingle();
    if (sessionError) {
      return admissionFailure({
        status: 500,
        message: "The class session could not be checked.",
        reason: "session_lookup_failed",
        outcome: "error",
        sessionId,
      });
    }
    if (!session || session.status !== "open") {
      return admissionFailure({
        status: 404,
        message: "This class session is no longer open.",
        reason: "session_not_open",
        outcome: "denied",
        sessionId,
      });
    }

    const { data: student, error: studentError } = await db
      .from("students")
      .select("id,period_id,alias,email_hmac,auth_user_id")
      .eq("id", studentId)
      .maybeSingle();
    if (studentError) {
      return admissionFailure({
        status: 500,
        message: "The roster could not be checked.",
        reason: "roster_lookup_failed",
        outcome: "error",
        sessionId,
      });
    }
    if (!student || student.period_id !== session.period_id) {
      return admissionFailure({
        status: 403,
        message: "Choose a student from this session's roster.",
        reason: "roster_period_mismatch",
        outcome: "denied",
        sessionId,
        studentId: student?.id ?? null,
      });
    }

    const { data: pending, error: pendingError } = await db
      .from("session_joins")
      .select("id,auth_user_id,request_code")
      .eq("session_id", sessionId)
      .eq("request_code", requestCode)
      .is("student_id", null)
      .maybeSingle();
    if (pendingError) {
      if (isMissingAdmissionSchema(pendingError.code)) {
        return admissionFailure({
          status: 503,
          message: "Teacher admission is not configured yet.",
          reason: "admission_schema_missing",
          outcome: "error",
          sessionId,
          studentId: student.id,
        });
      }
      return admissionFailure({
        status: 500,
        message: "The Chromebook request could not be checked.",
        reason: "request_lookup_failed",
        outcome: "error",
        sessionId,
        studentId: student.id,
      });
    }
    if (!pending?.auth_user_id) {
      return admissionFailure({
        status: 404,
        message: "That Chromebook request is no longer waiting.",
        reason: "request_not_found",
        outcome: "denied",
        sessionId,
        studentId: student.id,
      });
    }

    const { data: existingStudentJoin, error: existingStudentJoinError } = await db
      .from("session_joins")
      .select("id")
      .eq("session_id", sessionId)
      .eq("student_id", student.id)
      .maybeSingle();
    if (existingStudentJoinError) {
      return admissionFailure({
        status: 500,
        message: "The student's current session join could not be checked.",
        reason: "existing_join_lookup_failed",
        outcome: "error",
        sessionId,
        studentId: student.id,
        authUserId: pending.auth_user_id,
      });
    }
    if (existingStudentJoin) {
      return admissionFailure({
        status: 409,
        message: "This student is already joined on another Chromebook.",
        reason: "student_already_joined",
        outcome: "conflict",
        sessionId,
        studentId: student.id,
        authUserId: pending.auth_user_id,
      });
    }

    const { data: requestAuth, error: requestAuthError } = await db.auth.admin.getUserById(pending.auth_user_id);
    if (requestAuthError || !requestAuth.user) {
      return admissionFailure({
        status: 409,
        message: "That Chromebook sign-in is no longer available.",
        reason: "request_identity_missing",
        outcome: "conflict",
        sessionId,
        studentId: student.id,
        authUserId: pending.auth_user_id,
      });
    }
    if (!requestAuth.user.is_anonymous) {
      return admissionFailure({
        status: 409,
        message: "That Chromebook now has a verified sign-in and should join directly.",
        reason: "request_identity_not_anonymous",
        outcome: "conflict",
        sessionId,
        studentId: student.id,
        authUserId: pending.auth_user_id,
      });
    }

    if (student.auth_user_id && student.auth_user_id !== pending.auth_user_id) {
      const { data: currentAuth, error: currentAuthError } = await db.auth.admin.getUserById(student.auth_user_id);
      if (currentAuthError || !currentAuth.user) {
        return admissionFailure({
          status: 409,
          message: "The student's current sign-in could not be safely replaced.",
          reason: "current_identity_missing",
          outcome: "conflict",
          sessionId,
          studentId: student.id,
          authUserId: pending.auth_user_id,
        });
      }
      if (!currentAuth.user.is_anonymous) {
        return admissionFailure({
          status: 409,
          message: "This roster student already has a permanent sign-in.",
          reason: "permanent_identity_conflict",
          outcome: "conflict",
          sessionId,
          studentId: student.id,
          authUserId: pending.auth_user_id,
        });
      }
    }

    const resolutionResult = await db.rpc("bdm_admit_student_join_request_with_warmup", {
      p_session_id: sessionId,
      p_request_code: requestCode,
      p_student_id: student.id,
      p_student_email_hmac: student.email_hmac,
      p_auth_user_id: pending.auth_user_id,
      p_expected_student_auth_user_id: student.auth_user_id,
      p_display_name: student.alias || "Student",
    });
    if (resolutionResult.error) {
      if (isMissingAdmissionSchema(resolutionResult.error.code)) {
        return admissionFailure({
          status: 503,
          message: "Teacher admission is not configured yet.",
          reason: "admission_schema_missing",
          outcome: "error",
          sessionId,
          studentId: student.id,
          authUserId: pending.auth_user_id,
        });
      }
      return admissionFailure({
        status: 500,
        message: "The student could not be admitted.",
        reason: "admission_save_failed",
        outcome: "error",
        sessionId,
        studentId: student.id,
        authUserId: pending.auth_user_id,
      });
    }

    const resolution = ((resolutionResult.data as AdmissionResolution[] | null) ?? [])[0];
    if (!resolution || resolution.outcome !== "admitted" || !resolution.join_id || !resolution.resolved_student_id) {
      const reason = resolution?.outcome || "admission_conflict";
      const denied = reason === "session_not_open" || reason === "request_not_found" || reason === "roster_mismatch";
      return admissionFailure({
        status: reason === "session_not_open" || reason === "request_not_found" ? 404 : 409,
        message: reason === "student_already_joined"
          ? "This student is already joined on another Chromebook."
          : denied
            ? "The session or Chromebook request changed. Refresh and try again."
            : "The student sign-in changed. Refresh before admitting this Chromebook.",
        reason,
        outcome: denied ? "denied" : "conflict",
        sessionId,
        studentId: student.id,
        authUserId: pending.auth_user_id,
      });
    }

    await recordSecurityEvent({
      eventType: "teacher_student_admit",
      outcome: "allowed",
      sessionId,
      studentId: resolution.resolved_student_id,
      authUserId: pending.auth_user_id,
      details: { action: "admit" },
    });
    return Response.json(
      {
        sessionJoin: {
          id: resolution.join_id,
          studentId: resolution.resolved_student_id,
          displayName: resolution.resolved_display_name || student.alias || "Student",
          joinedAt: resolution.resolved_joined_at,
        },
      },
      { headers: { "cache-control": "no-store" } },
    );
  }

  if (body.action === "start") {
    const periodId = text(body.periodId, 80);
    const requestedCode = text(body.joinCode, 8).toUpperCase();
    const assignmentId = text(body.assignmentId, 80) || null;
    if (!periodId || !/^[A-Z0-9]{2,8}$/.test(requestedCode)) {
      return Response.json({ error: "A valid period and join code are required." }, { status: 400 });
    }

    // The period's PERMANENT class code wins over whatever the client generated.
    // Students type the permanent code (DOG2); a random per-session code can
    // never equal it, so the direct join_code lookup in /api/student/warmup-start
    // misses and the student is pushed onto the period-code fallback, which is
    // gated on school hours AND a district account. When either gate closes, the
    // student silently lands on a DIFFERENT open session row than the teacher is
    // running - broadcast "free", live_flow null - and freezes there all period.
    // Selecting class_code tolerates period-class-codes.sql not having run.
    const periodResult = await db.from("periods").select("id,class_code").eq("id", periodId).maybeSingle();
    if (periodResult.error && !/class_code/i.test(periodResult.error.message)) {
      return Response.json({ error: periodResult.error.message }, { status: 500 });
    }
    let period = periodResult.data as { id: string; class_code?: string | null } | null;
    if (!period) {
      const fallback = await db.from("periods").select("id").eq("id", periodId).maybeSingle();
      if (fallback.error) return Response.json({ error: fallback.error.message }, { status: 500 });
      period = fallback.data as { id: string } | null;
    }
    if (!period) return Response.json({ error: "Period not found." }, { status: 404 });
    const permanentCode = text(period.class_code ?? "", 8).toUpperCase();
    const joinCode = /^[A-Z0-9]{2,8}$/.test(permanentCode) ? permanentCode : requestedCode;

    // Retire anything left over from an earlier class before looking for a
    // session to adopt, so a forgotten morning session is never inherited as
    // "today's". force=true: starting a class is exactly when this must run.
    await sweepStaleSessions(db, true);

    // One open session per period, always. A second row is what split the class
    // in two: the teacher advanced states on one, the students polled the other.
    const existing = await db
      .from("sessions")
      .select("id,period_id,assignment_id,join_code,status,started_at,broadcast")
      .eq("period_id", periodId)
      .eq("status", "open")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing.data) {
      const adoptedId = (existing.data as { id: string }).id;
      // Moving from period 2 to period 3 ends period 2. One class at a time.
      const alsoClosed = await closeOtherOpenSessions(db, adoptedId);
      const adopted = existing.data as { join_code: string | null };
      if (adopted.join_code !== joinCode) {
        const recoded = await db
          .from("sessions")
          .update({ join_code: joinCode })
          .eq("id", adoptedId)
          .select("id,period_id,assignment_id,join_code,status,started_at,broadcast")
          .maybeSingle();
        if (recoded.data) return Response.json({ session: recoded.data, adopted: true, closedStale: alsoClosed.length });
      }
      return Response.json({ session: existing.data, adopted: true, closedStale: alsoClosed.length });
    }

    const { data, error: insertError } = await db
      .from("sessions")
      .insert({ period_id: periodId, assignment_id: assignmentId, join_code: joinCode, status: "open", broadcast: "free" })
      .select("id,period_id,assignment_id,join_code,status,started_at,broadcast")
      .single();
    if (insertError) return Response.json({ error: insertError.message }, { status: 500 });
    const alsoClosed = await closeOtherOpenSessions(db, data.id);
    void recordSecurityEvent({
      eventType: "teacher_session_change",
      outcome: "allowed",
      sessionId: data.id,
      details: { action: body.action, closedStale: alsoClosed.length },
    });
    return Response.json({ session: data, closedStale: alsoClosed.length }, { status: 201 });
  }

  if (body.action === "update") {
    const sessionId = text(body.sessionId, 80);
    if (!sessionId) return Response.json({ error: "Session is required." }, { status: 400 });
    const patch: Record<string, unknown> = {};
    if ("broadcast" in body) patch.broadcast = typeof body.broadcast === "string" ? text(body.broadcast, 300) : null;
    if ("liveFlow" in body) patch.live_flow = body.liveFlow ?? null;
    if ("remoteCommand" in body) patch.remote_command = body.remoteCommand ?? null;
    if (!Object.keys(patch).length) return Response.json({ error: "No session fields were supplied." }, { status: 400 });

    // Read the snapshot this write replaces, so the screen ping below fires on
    // real changes only. /control republishes about once a second while a timer
    // runs; pinging every write would have the whole class re-fetching every
    // second, which is the request storm this feature exists to avoid.
    // One indexed single-column read against 30 devices polling - it is cheap.
    let previousFlow: LiveClassFlowSnapshot | null = null;
    if ("liveFlow" in body) {
      const { data: before } = await db
        .from("sessions")
        .select("live_flow")
        .eq("id", sessionId)
        .maybeSingle();
      previousFlow = (before?.live_flow ?? null) as LiveClassFlowSnapshot | null;
    }

    let update = db
      .from("sessions")
      .update(patch)
      .eq("id", sessionId)
      .eq("status", "open");
    const checksLiveFlowRevision = "liveFlow" in body && "expectedLiveFlowUpdatedAt" in body;
    if (checksLiveFlowRevision) {
      const expectedRevision = text(body.expectedLiveFlowUpdatedAt, 80);
      update = expectedRevision
        ? update.filter("live_flow->>updatedAt", "eq", expectedRevision)
        : update.is("live_flow", null);
    }
    const checksRemoteCommandNonce = "remoteCommand" in body && "expectedRemoteCommandNonce" in body;
    if (checksRemoteCommandNonce) {
      const expectedNonce = text(body.expectedRemoteCommandNonce, 80);
      update = expectedNonce
        ? update.filter("remote_command->>nonce", "eq", expectedNonce)
        : update.is("remote_command", null);
    }
    const { data, error: updateError } = await update
      .select("id,status,broadcast,live_flow,remote_command")
      .maybeSingle();
    if (updateError) return Response.json({ error: updateError.message }, { status: 500 });
    if (!data && checksLiveFlowRevision) {
      return Response.json({ error: "The live lesson changed on another teacher device. Control is reconnecting to the newer state." }, { status: 409 });
    }
    if (!data && checksRemoteCommandNonce) {
      return Response.json({ error: "A newer classroom command replaced this receipt." }, { status: 409 });
    }
    if (!data) return Response.json({ error: "Open session not found." }, { status: 404 });
    // after() so the ping never sits between the teacher's tap and Control's
    // response - the screens are what we are trying to make faster, not slower.
    if ("liveFlow" in body
      && liveFlowScreensChanged(previousFlow, data.live_flow as LiveClassFlowSnapshot | null)) {
      after(() => broadcastLiveFlowChange(sessionId));
    }
    return Response.json({ session: data });
  }

  if (body.action === "close") {
    const sessionId = text(body.sessionId, 80);
    if (!sessionId) return Response.json({ error: "Session is required." }, { status: 400 });
    // Bridge the day's graded answers into `responses` BEFORE anything about
    // the session changes, so the evidence is durable no matter what the close
    // does next. Non-fatal: a failure logs and the session still closes.
    await promotePollEvidence(db, sessionId);
    const now = new Date().toISOString();
    const [pollResult, sessionResult] = await Promise.all([
      db.from("polls").update({ status: "closed" }).eq("session_id", sessionId).eq("status", "open"),
      // live_flow IS DELIBERATELY RETAINED - same reason as closeSessions in
      // sessionLifecycle.ts. It is the only record of the questions the class
      // was asked, and readinessEvidence reads the question set out of it after
      // the bell; nulling it made every closed session report zero readiness
      // questions, which ranked every student as needing a teacher visit.
      db.from("sessions")
        .update({ status: "closed", ended_at: now, broadcast: null, remote_command: null })
        .eq("id", sessionId)
        .select("id")
        .maybeSingle(),
    ]);
    if (pollResult.error) return Response.json({ error: pollResult.error.message }, { status: 500 });
    if (sessionResult.error) return Response.json({ error: sessionResult.error.message }, { status: 500 });
    if (!sessionResult.data) return Response.json({ error: "Session not found." }, { status: 404 });
    void recordSecurityEvent({
      eventType: "teacher_session_change",
      outcome: "allowed",
      sessionId,
      details: { action: body.action },
    });
    return Response.json({ closed: true });
  }

  return Response.json({ error: "Unknown session action." }, { status: 400 });
}
