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

// The minimal class projection any code-holding device may read: exactly what
// transitional mode serves, which is exactly what the public /live-flow room
// display shows. studentSafeLiveFlow keeps answers and teacher notes out.
async function publicProjection(db: Db, sessionId: string) {
  const { data: session, error } = await db
    .from("sessions")
    .select("id,period_id,status,broadcast,live_flow")
    .eq("id", sessionId)
    .maybeSingle();
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
      const { data: session, error: sessionError } = await db
        .from("sessions")
        .select("id,period_id,status,broadcast,live_flow")
        .eq("id", sessionId)
        .maybeSingle();
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

    const { data: session, error: sessionError } = await db
      .from("sessions")
      .select("id,period_id,status,broadcast,live_flow")
      .eq("id", sessionId)
      .eq("period_id", student.periodId)
      .maybeSingle();
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
