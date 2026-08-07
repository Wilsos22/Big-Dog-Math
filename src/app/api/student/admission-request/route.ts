import { recordSecurityEvent } from "@/lib/securityAudit";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import {
  requireAnonymousStudentAuth,
  StudentIdentityError,
  studentIdentityResponse,
} from "@/lib/studentIdentity";

export const dynamic = "force-dynamic";

const REQUEST_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function newRequestCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (byte) => REQUEST_CODE_ALPHABET[byte % REQUEST_CODE_ALPHABET.length]).join("");
}

type SessionJoinRow = {
  id: string;
  request_code: string | null;
  student_id: string | null;
};

function isMissingAdmissionSchema(code?: string): boolean {
  return code === "42703" || code === "42883" || code === "PGRST202" || code === "PGRST204";
}

// The teacher already admitted this device: bdm_admit_student_join_request
// sets student_id and clears request_code, so there is no pending request left
// to report. Answer success with a null requestCode - the landing simply stops
// showing a help code while WarmupJoinSync upgrades the stored session.
function admittedResponse(sessionId: string): Response {
  return Response.json(
    { request: { sessionId, requestCode: null, admitted: true } },
    { status: 200, headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: Request) {
  let authUserId: string | null = null;
  try {
    const identity = await requireAnonymousStudentAuth(request);
    authUserId = identity.authUserId;

    const body = await request.json().catch(() => ({})) as { code?: unknown };
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    if (!/^[A-Z0-9]{2,8}$/.test(code)) {
      throw new StudentIdentityError("Enter the class code from your teacher.", 400, "invalid_join_code");
    }

    const db = getSupabaseAdmin();
    if (!db) throw new StudentIdentityError("Live sessions are not configured.", 503, "sessions_not_configured");

    const { data: session, error: sessionError } = await db
      .from("sessions")
      .select("id")
      .eq("join_code", code)
      .eq("status", "open")
      .maybeSingle();
    if (sessionError) {
      throw new StudentIdentityError("The class session could not be checked.", 500, "session_lookup_failed");
    }
    if (!session) throw new StudentIdentityError("That code is not open right now.", 404, "session_not_open");

    // Any row for this device in this session, admitted or not. Restricting
    // this to student_id is null missed the row the teacher had just admitted,
    // so the insert below hit the (session_id, auth_user_id) unique index and
    // every press of Ask for help came back 409.
    const existingResult = await db
      .from("session_joins")
      .select("id,request_code,student_id")
      .eq("session_id", session.id)
      .eq("auth_user_id", authUserId)
      .maybeSingle();
    if (existingResult.error) {
      if (isMissingAdmissionSchema(existingResult.error.code)) {
        throw new StudentIdentityError(
          "Teacher admission is not configured yet.",
          503,
          "admission_schema_missing",
        );
      }
      throw new StudentIdentityError("The admission request could not be checked.", 500, "request_lookup_failed");
    }

    const existingRow = existingResult.data as SessionJoinRow | null;

    if (existingRow?.student_id) {
      await recordSecurityEvent({
        eventType: "student_admission_request",
        outcome: "allowed",
        authUserId,
        sessionId: session.id,
        studentId: existingRow.student_id,
        details: { state: "already_admitted" },
      });
      return admittedResponse(session.id);
    }

    if (existingRow?.request_code) {
      await recordSecurityEvent({
        eventType: "student_admission_request",
        outcome: "allowed",
        authUserId,
        sessionId: session.id,
        details: { state: "existing" },
      });
      return Response.json(
        {
          request: {
            sessionId: session.id,
            requestCode: existingRow.request_code,
          },
        },
        { status: 202, headers: { "cache-control": "no-store" } },
      );
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const requestCode = newRequestCode();
      const insertResult = await db
        .from("session_joins")
        .insert({
          session_id: session.id,
          student_id: null,
          auth_user_id: authUserId,
          display_name: null,
          request_code: requestCode,
        })
        .select("id,request_code")
        .single();

      if (!insertResult.error && insertResult.data) {
        await recordSecurityEvent({
          eventType: "student_admission_request",
          outcome: "allowed",
          authUserId,
          sessionId: session.id,
          details: { state: "created" },
        });
        return Response.json(
          { request: { sessionId: session.id, requestCode } },
          { status: 202, headers: { "cache-control": "no-store" } },
        );
      }

      if (isMissingAdmissionSchema(insertResult.error?.code)) {
        throw new StudentIdentityError(
          "Teacher admission is not configured yet.",
          503,
          "admission_schema_missing",
        );
      }
      if (insertResult.error?.code !== "23505") {
        throw new StudentIdentityError("The admission request could not be saved.", 500, "request_save_failed");
      }

      // Same widening as the lookup above: the teacher may have admitted this
      // device in the moment between that read and this insert, and filtering
      // on a null student_id here would miss the row and 500 instead.
      const raceResult = await db
        .from("session_joins")
        .select("id,request_code,student_id")
        .eq("session_id", session.id)
        .eq("auth_user_id", authUserId)
        .maybeSingle();
      const raceRow = raceResult.data as SessionJoinRow | null;
      if (raceRow?.student_id) {
        await recordSecurityEvent({
          eventType: "student_admission_request",
          outcome: "allowed",
          authUserId,
          sessionId: session.id,
          studentId: raceRow.student_id,
          details: { state: "already_admitted" },
        });
        return admittedResponse(session.id);
      }
      if (raceRow?.request_code) {
        await recordSecurityEvent({
          eventType: "student_admission_request",
          outcome: "allowed",
          authUserId,
          sessionId: session.id,
          details: { state: "race_resolved" },
        });
        return Response.json(
          {
            request: {
              sessionId: session.id,
              requestCode: raceRow.request_code,
            },
          },
          { status: 202, headers: { "cache-control": "no-store" } },
        );
      }
    }

    throw new StudentIdentityError(
      "A request code could not be reserved. Try again.",
      409,
      "request_code_conflict",
    );
  } catch (error) {
    if (error instanceof StudentIdentityError) {
      await recordSecurityEvent({
        eventType: "student_admission_request",
        outcome: error.status === 409 ? "conflict" : "denied",
        authUserId,
        details: { reason: error.code },
      });
    } else {
      await recordSecurityEvent({
        eventType: "student_admission_request",
        outcome: "error",
        authUserId,
        details: { reason: "unknown_error" },
      });
    }
    return studentIdentityResponse(error);
  }
}
