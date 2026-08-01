import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { recordSecurityEvent } from "@/lib/securityAudit";
import { canonicalGoogleFormResource, currentWarmupResourceKey } from "@/lib/warmupResource";
import { isEmailHmac, looksIdentified } from "@/lib/pseudonym";
import type { LiveClassFlowSnapshot } from "@/lib/liveClassFlow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The ONE seam where a warm-up submission becomes a site identity. Apps Script
// verifies the district Google sign-in inside Workspace, then posts the HMAC
// of the respondent email - never the email itself. The HMAC key lives only in
// Script Properties, so this route (and everything behind it) can match roster
// rows without ever being able to name a student. See src/lib/pseudonym.ts.

function validUuid(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request: Request) {
  const key = process.env.EVIDENCE_INGEST_KEY;
  if (!key || request.headers.get("x-bdm-key") !== key) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Database not configured." }, { status: 503 });

  const body = await request.json().catch(() => ({})) as {
    emailHmac?: unknown;
    email?: unknown;
    warmupToken?: unknown;
    authUserId?: unknown;
    formUrl?: unknown;
  };
  // A raw email here means the Apps Script side is running a pre-FERPA build.
  // Refuse loudly instead of matching - the boundary must not accept identity.
  if (looksIdentified(typeof body.email === "string" ? body.email : "")
    || looksIdentified(typeof body.emailHmac === "string" ? body.emailHmac : "")) {
    return Response.json(
      { error: "Raw emails are not accepted. Update warmup-evidence.gs to send the email HMAC.", code: "raw_email_rejected" },
      { status: 422 },
    );
  }
  const emailHmac = typeof body.emailHmac === "string" ? body.emailHmac.trim().toLowerCase() : "";
  const resourceKey = canonicalGoogleFormResource(body.formUrl);
  // The legacy Apps Script property name is accepted during the rollout, but
  // the value is now an opaque, session-scoped receipt token rather than a
  // persistent auth user ID.
  const warmupToken = body.warmupToken ?? body.authUserId;
  if (!isEmailHmac(emailHmac) || !resourceKey || !validUuid(warmupToken)) {
    return Response.json(
      { error: "A verified email HMAC and valid Big Dog warm-up connection are required." },
      { status: 400 },
    );
  }

  const { data: receipt, error: receiptError } = await db
    .from("student_warmup_sessions")
    .select("auth_user_id,session_id,completed_at,warmup_resource_key")
    .eq("verification_token", warmupToken)
    .maybeSingle();
  if (receiptError) {
    return Response.json({ error: "Warm-up connection lookup failed.", code: "receipt_lookup_failed" }, { status: 500 });
  }
  if (!receipt) {
    return Response.json({ error: "This warm-up connection is no longer valid.", code: "receipt_not_found" }, { status: 404 });
  }
  if (receipt.completed_at) {
    return Response.json(
      { error: "This warm-up connection has already been used.", code: "receipt_already_completed" },
      { status: 409 },
    );
  }
  if (!receipt.warmup_resource_key || receipt.warmup_resource_key !== resourceKey) {
    return Response.json(
      { error: "This is not the warm-up currently assigned to the class.", code: "warmup_resource_mismatch" },
      { status: 409 },
    );
  }

  const authUserId = receipt.auth_user_id as string;
  const sessionId = receipt.session_id as string;
  const { data: session, error: sessionError } = await db
    .from("sessions")
    .select("id,period_id,status,live_flow")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionError) {
    return Response.json({ error: "Class session lookup failed.", code: "session_lookup_failed" }, { status: 500 });
  }
  if (!session || session.status !== "open") {
    return Response.json({ error: "This class session is no longer open.", code: "session_not_open" }, { status: 404 });
  }
  if (currentWarmupResourceKey(session.live_flow as LiveClassFlowSnapshot | null) !== resourceKey) {
    return Response.json(
      { error: "This is not the warm-up currently assigned to the class.", code: "warmup_resource_mismatch" },
      { status: 409 },
    );
  }

  const { data: authData, error: authError } = await db.auth.admin.getUserById(authUserId);
  if (authError || !authData.user) {
    return Response.json(
      { error: "The Big Dog session could not be verified.", code: "invalid_auth_user" },
      { status: 403 },
    );
  }
  // Only anonymous device sessions exist under the pseudonymous model - a
  // provider-linked auth user would mean an identified sign-in reached the site.
  if (!authData.user.is_anonymous) {
    return Response.json(
      { error: "This Big Dog session uses a retired sign-in method. Rejoin with the class code.", code: "identified_signin_retired" },
      { status: 403 },
    );
  }

  const { data: existingLink, error: existingLinkError } = await db
    .from("students")
    .select("id,email_hmac,period_id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (existingLinkError) {
    return Response.json(
      { error: "Student identity lookup failed.", code: "linked_lookup_failed" },
      { status: 500 },
    );
  }
  if (existingLink && existingLink.email_hmac !== emailHmac) {
    return Response.json(
      { error: "This browser session is already linked to another roster account.", code: "identity_link_conflict" },
      { status: 409 },
    );
  }

  const { data: periodRoster, error: rosterError } = await db
    .from("students")
    .select("id,email_hmac,period_id,auth_user_id")
    .eq("period_id", session.period_id);
  if (rosterError) {
    return Response.json({ error: "Roster lookup failed.", code: "roster_lookup_failed" }, { status: 500 });
  }
  const rosterMatches = (periodRoster ?? []).filter((student) => student.email_hmac === emailHmac);
  if (rosterMatches.length !== 1) {
    return Response.json(
      { matched: false, code: rosterMatches.length ? "duplicate_roster_email" : "not_on_roster" },
      { status: rosterMatches.length ? 409 : 404 },
    );
  }
  const rosterMatch = rosterMatches[0];

  if (rosterMatch.auth_user_id && rosterMatch.auth_user_id !== authUserId) {
    const { data: previousAuth, error: previousAuthError } = await db.auth.admin.getUserById(rosterMatch.auth_user_id);
    if (previousAuthError) {
      return Response.json(
        { error: "Existing student identity could not be verified.", code: "existing_identity_lookup_failed" },
        { status: 500 },
      );
    }
    if (previousAuth.user && !previousAuth.user.is_anonymous) {
      return Response.json(
        { error: "This roster account is protected by a permanent sign-in.", code: "roster_already_claimed" },
        { status: 409 },
      );
    }
  }

  const completionResult = await db.rpc("bdm_complete_warmup_identity", {
    p_verification_token: warmupToken,
    p_session_id: sessionId,
    p_warmup_resource_key: resourceKey,
    p_student_id: rosterMatch.id,
    p_student_email_hmac: emailHmac,
    p_auth_user_id: authUserId,
    p_expected_student_auth_user_id: rosterMatch.auth_user_id,
  });
  if (completionResult.error) {
    return Response.json(
      { error: "Warm-up completion could not be saved.", code: "receipt_update_failed" },
      { status: 500 },
    );
  }
  const completionOutcome = typeof completionResult.data === "string"
    ? completionResult.data
    : Array.isArray(completionResult.data)
      ? completionResult.data[0]
      : null;
  if (completionOutcome !== "completed") {
    void recordSecurityEvent({
      eventType: "warmup_identity_linked",
      outcome: "conflict",
      authUserId,
      studentId: rosterMatch.id,
      sessionId,
    });
    return Response.json(
      {
        error: completionOutcome === "receipt_already_completed"
          ? "This warm-up connection has already been used."
          : completionOutcome === "warmup_resource_mismatch"
            ? "This is not the warm-up currently assigned to the class."
            : "The class or roster changed while the warm-up was being verified.",
        code: completionOutcome || "claim_conflict",
      },
      { status: 409 },
    );
  }

  void recordSecurityEvent({
    eventType: "warmup_identity_linked",
    outcome: "allowed",
    authUserId,
    studentId: rosterMatch.id,
    sessionId,
  });

  return Response.json({ matched: true, warmupCompleted: true, sessionId });
}
