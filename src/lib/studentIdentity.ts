import type { User } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

// Student identity is PSEUDONYMOUS on the site (see src/lib/pseudonym.ts).
// A student row carries an alias and an email_hmac - never a name or email -
// and the ONLY way a device links to a roster row is the Google warm-up
// receipt chain: Apps Script verifies the district sign-in inside Workspace
// and posts the HMAC of the respondent email to /api/student/warmup-verify.
// The old direct Google OAuth sign-in path is deliberately gone: it put
// district emails into Supabase Auth, which the FERPA boundary forbids.

export type VerifiedStudent = {
  id: string;
  alias: string;
  periodId: string;
  emailHmac: string | null;
  authUserId: string;
  identityMethod: "verified-warmup";
};

export type VerifiedStudentSession = {
  id: string;
  periodId: string;
  status: string;
};

export type AnonymousStudentAuth = {
  authUserId: string;
};

export type StudentAuth = {
  authUserId: string;
  isAnonymous: boolean;
};

type StudentRow = {
  id: string;
  alias: string | null;
  period_id: string;
  email_hmac: string | null;
  auth_user_id: string | null;
};

export class StudentIdentityError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
  }
}

function bearerToken(request: Request): string {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) {
    throw new StudentIdentityError(
      "Your Big Dog session is missing. Rejoin the class.",
      401,
      "missing_bearer_token",
    );
  }
  return match[1];
}

async function authenticatedUser(request: Request): Promise<User> {
  const token = bearerToken(request);
  const db = getSupabaseAdmin();
  if (!db) throw new StudentIdentityError("Student sign-in is not configured.", 503, "identity_not_configured");

  const { data: authData, error: authError } = await db.auth.getUser(token);
  if (authError || !authData.user) {
    throw new StudentIdentityError("Your sign-in expired. Sign in again.", 401, "invalid_access_token");
  }
  return authData.user;
}

// Only anonymous Supabase Auth users exist under the pseudonymous model - a
// Google-provider user would carry a district email into Supabase Auth.
function assertAnonymousUser(user: User): void {
  if (!user.is_anonymous) {
    throw new StudentIdentityError(
      "This sign-in method is no longer used. Enter the class code to rejoin.",
      403,
      "identified_signin_retired",
    );
  }
}

async function linkedStudent(authUserId: string): Promise<StudentRow | null> {
  const db = getSupabaseAdmin();
  if (!db) throw new StudentIdentityError("Student sign-in is not configured.", 503, "identity_not_configured");

  const { data, error } = await db
    .from("students")
    .select("id,alias,period_id,email_hmac,auth_user_id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error) throw new StudentIdentityError("Student account lookup failed.", 500, "linked_lookup_failed");
  return data as StudentRow | null;
}

export async function requireVerifiedStudent(request: Request): Promise<VerifiedStudent> {
  const user = await authenticatedUser(request);
  assertAnonymousUser(user);
  const student = await linkedStudent(user.id);

  if (!student) {
    throw new StudentIdentityError(
      "Finish the Google warm-up so Big Dog can verify your school account.",
      428,
      "warmup_verification_required",
    );
  }
  if (!student.alias) {
    throw new StudentIdentityError(
      "Your roster record is missing its alias. Ask your teacher to re-run the roster push.",
      409,
      "roster_alias_missing",
    );
  }

  return {
    id: student.id,
    alias: student.alias,
    periodId: student.period_id,
    emailHmac: student.email_hmac,
    authUserId: user.id,
    identityMethod: "verified-warmup",
  };
}

export async function requireStudentAuth(request: Request): Promise<StudentAuth> {
  const user = await authenticatedUser(request);
  assertAnonymousUser(user);

  return {
    authUserId: user.id,
    isAnonymous: true,
  };
}

export async function requireAnonymousStudentAuth(request: Request): Promise<AnonymousStudentAuth> {
  const user = await authenticatedUser(request);
  assertAnonymousUser(user);
  return { authUserId: user.id };
}

export async function requireOpenJoinedSession(
  student: VerifiedStudent,
  sessionId: string,
): Promise<VerifiedStudentSession> {
  if (!sessionId) {
    throw new StudentIdentityError("The class session is missing.", 400, "session_id_missing");
  }

  const db = getSupabaseAdmin();
  if (!db) throw new StudentIdentityError("Live sessions are not configured.", 503, "sessions_not_configured");

  const { data: session, error: sessionError } = await db
    .from("sessions")
    .select("id,period_id,status")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionError) throw new StudentIdentityError("The class session could not be checked.", 500, "session_lookup_failed");
  if (!session || session.status !== "open") {
    throw new StudentIdentityError("This class session is no longer open.", 404, "session_not_open");
  }
  if (session.period_id !== student.periodId) {
    throw new StudentIdentityError("This session belongs to a different class.", 403, "wrong_period");
  }

  const { count, error: joinError } = await db
    .from("session_joins")
    .select("id", { count: "exact", head: true })
    .eq("session_id", session.id)
    .eq("student_id", student.id);
  if (joinError) throw new StudentIdentityError("Your class join could not be checked.", 500, "join_lookup_failed");
  if (!count) throw new StudentIdentityError("Join the class before continuing.", 403, "session_join_required");

  return { id: session.id, periodId: session.period_id, status: session.status };
}

export function studentIdentityResponse(error: unknown): Response {
  if (error instanceof StudentIdentityError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.status, headers: { "cache-control": "no-store" } },
    );
  }
  return Response.json(
    { error: "Student sign-in failed.", code: "identity_unknown_error" },
    { status: 500, headers: { "cache-control": "no-store" } },
  );
}
