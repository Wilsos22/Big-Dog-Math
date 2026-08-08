import { getSupabaseAdmin } from "@/lib/supabaseServer";
import {
  requireVerifiedStudent,
  StudentIdentityError,
  studentIdentityResponse,
} from "@/lib/studentIdentity";
import type { LiveClassFlowSnapshot } from "@/lib/liveClassFlow";
import { studentSafeLiveFlow } from "@/lib/liveFlowPrivacy";

export const dynamic = "force-dynamic";
const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Db = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

const SESSION_COLUMNS = "id,period_id,status,broadcast,live_flow";
const SESSION_COLUMNS_WITH_CHECKIN = `${SESSION_COLUMNS},checkin_active,checkin_round`;

// Reads the session row, preferring the check-in columns so checkin_active/
// checkin_round ride along on the same poll /live-flow already makes (no new
// request, and the existing push-ping wakes it up fast). Falls back to the
// base columns when student-checkin.sql has not been run yet - a missing
// check-in nudge is fine, a broken session read for every student on a
// staged migration is not. `applyFilters` narrows beyond `id` (the verified
// path also filters on period_id).
async function readSessionRow(db: Db, sessionId: string, applyFilters?: (query: any) => any) {
  const build = (columns: string) => {
    const base = db.from("sessions").select(columns).eq("id", sessionId);
    return applyFilters ? applyFilters(base) : base;
  };
  const first = await build(SESSION_COLUMNS_WITH_CHECKIN).maybeSingle();
  if (!first.error) return first;
  return build(SESSION_COLUMNS).maybeSingle();
}

// The minimal class projection any code-holding device may read: exactly what
// transitional mode serves, which is exactly what the public /live-flow room
// display shows. studentSafeLiveFlow keeps answers and teacher notes out.
async function publicProjection(db: Db, sessionId: string) {
  const { data: session, error } = await readSessionRow(db, sessionId);
  if (error) throw new StudentIdentityError("The class session could not be loaded.", 500, "session_lookup_failed");
  if (!session) throw new StudentIdentityError("This class session is not open.", 404, "session_not_found");
  return Response.json(
    {
      session: {
        ...session,
        live_flow: studentSafeLiveFlow(session.live_flow as LiveClassFlowSnapshot | null),
      },
      poll: null,
    },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function GET(request: Request) {
  try {
    const sessionId = new URL(request.url).searchParams.get("sessionId") || "";
    if (!SESSION_ID_PATTERN.test(sessionId)) {
      throw new StudentIdentityError("The class session is missing.", 400, "session_id_missing");
    }

    const db = getSupabaseAdmin();
    if (!db) throw new StudentIdentityError("Live sessions are not configured.", 503, "sessions_not_configured");

    // Transitional mode still reads through this server boundary. It does not
    // require the anonymous identity rollout, but it never returns the full
    // teacher flow or future lesson sequence to the browser.
    if (process.env.NEXT_PUBLIC_SECURE_STUDENT_DATA !== "true") {
      const { data: session, error: sessionError } = await readSessionRow(db, sessionId);
      if (sessionError) throw new StudentIdentityError("The class session could not be loaded.", 500, "session_lookup_failed");
      if (!session) throw new StudentIdentityError("This class session is not open.", 404, "session_not_found");
      return Response.json(
        {
          session: {
            ...session,
            live_flow: studentSafeLiveFlow(session.live_flow as LiveClassFlowSnapshot | null),
          },
          poll: null,
        },
        { headers: { "cache-control": "no-store" } },
      );
    }

    // READ relaxation (2026-07-26, "screens push with me"): a device whose
    // identity or join is not verified yet still receives the same MINIMAL
    // public projection transitional mode serves - the studentSafeLiveFlow
    // snapshot is the projector-public class screen (/live-flow is a public
    // room surface), so a code-entered-but-unverified Chromebook can follow
    // the lesson when the teacher advances. Every WRITE (poll answers,
    // signals, tool evidence) still requires the verified join.
    let student: Awaited<ReturnType<typeof requireVerifiedStudent>>;
    try {
      student = await requireVerifiedStudent(request);
    } catch {
      return await publicProjection(db, sessionId);
    }

    const { data: join, error: joinError } = await db
      .from("session_joins")
      .select("id")
      .eq("session_id", sessionId)
      .eq("student_id", student.id)
      .maybeSingle();
    if (joinError) throw new StudentIdentityError("Your class join could not be checked.", 500, "join_lookup_failed");
    if (!join) return await publicProjection(db, sessionId);

    const { data: session, error: sessionError } = await readSessionRow(db, sessionId, (q) => q.eq("period_id", student.periodId));
    if (sessionError) throw new StudentIdentityError("The class session could not be loaded.", 500, "session_lookup_failed");
    if (!session) throw new StudentIdentityError("This session belongs to a different class.", 403, "wrong_period");

    const { data: poll, error: pollError } = await db
      .from("polls")
      .select("id,question,choices,kind,status,created_at")
      .eq("session_id", sessionId)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pollError) throw new StudentIdentityError("The live question could not be loaded.", 500, "poll_lookup_failed");

    const safeSession = {
      ...session,
      live_flow: studentSafeLiveFlow(session.live_flow as LiveClassFlowSnapshot | null),
    };

    return Response.json(
      { session: safeSession, poll: poll ?? null },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return studentIdentityResponse(error);
  }
}
