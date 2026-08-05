/**
 * The ranked visit list and its check-in taps.
 *
 * GET  ?sessionId=... - the walking order, most urgent first, with everyone
 *      the teacher has already reached removed from it.
 * POST { sessionId, studentKey, status, promoted? } - record a tap.
 *
 * Teacher-only. /api/live is in PROTECTED_PREFIXES, so the proxy gate handles
 * auth before this route runs. Nothing here may ever reach a student device or
 * a public projector: a student must never see their own tier, another
 * student's status, a group name, or a count.
 */

import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { loadReadinessEvidence } from "@/lib/readinessEvidence";
import { buildVisitList, type VisitCheckInStatus, type VisitStudent } from "@/lib/visitList";
import { looksIdentified } from "@/lib/pseudonym";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES: VisitCheckInStatus[] = ["got-it", "partly", "still-stuck"];

type CheckInRow = {
  student_key: string;
  status: VisitCheckInStatus;
  updated_at: string | null;
  created_at: string;
};

/**
 * Read the taps for this session.
 *
 * Returns null (not an empty map) when the table does not exist yet, so the
 * list still renders before visit-check-ins.sql has been hand-run - it just
 * cannot clear rows, and the caller says so instead of silently showing a list
 * that never shortens.
 */
async function loadCheckIns(
  db: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  sessionId: string,
): Promise<Map<string, { status: VisitCheckInStatus; at: string }> | null> {
  const { data, error } = await db
    .from("visit_check_ins")
    .select("student_key,status,updated_at,created_at")
    .eq("session_id", sessionId);
  if (error) return null;
  const byStudent = new Map<string, { status: VisitCheckInStatus; at: string }>();
  for (const row of (data || []) as CheckInRow[]) {
    byStudent.set(row.student_key, { status: row.status, at: row.updated_at || row.created_at });
  }
  return byStudent;
}

export async function GET(request: Request) {
  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Database not configured." }, { status: 503 });
  const sessionId = new URL(request.url).searchParams.get("sessionId") || "";
  if (!sessionId) return Response.json({ error: "sessionId is required." }, { status: 400 });

  try {
    const [readiness, checkIns] = await Promise.all([
      loadReadinessEvidence(db, sessionId),
      loadCheckIns(db, sessionId),
    ]);

    const students: VisitStudent[] = readiness.evidence.map((entry) => ({
      studentKey: entry.studentKey,
      name: entry.name,
      correct: entry.correct,
      fist: entry.fist,
      error: readiness.errors.get(entry.studentKey) || null,
      // A student whose only wrong box was the final total understands the
      // property; the arithmetic is the visit, not the concept.
      conceptIntact: readiness.arithmeticOnly.has(entry.studentKey),
      // This session's manipulative work, the boundary tie-breaker inherited
      // from the retired City Routes routing.
      toolScore: entry.toolScore,
      checkIn: checkIns?.get(entry.studentKey) || null,
    }));

    return Response.json({
      sessionId,
      lessonCode: readiness.lessonCode,
      questionCount: readiness.questionSteps.length,
      // The teacher needs to know the taps are not being saved, rather than
      // watch a list that refuses to shorten.
      checkInsAvailable: checkIns !== null,
      ...buildVisitList(students),
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "The visit list could not be built." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Database not configured." }, { status: 503 });
  const body = await request.json().catch(() => ({})) as {
    sessionId?: unknown; studentKey?: unknown; displayName?: unknown;
    status?: unknown; promoted?: unknown;
  };
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  const studentKey = typeof body.studentKey === "string" ? body.studentKey.slice(0, 200) : "";
  const status = STATUSES.find((value) => value === body.status) || null;
  if (!sessionId || !studentKey || !status) {
    return Response.json({ error: "sessionId, studentKey and a valid status are required." }, { status: 400 });
  }

  // FERPA boundary: a visit tap carries the ALIAS, never a resolved name -
  // VisitListPanel reads the name key in the browser and deliberately posts
  // student.name (the alias) back. This route is the only identity-bearing
  // ingest that had no refusal, so an identified value is rejected here the
  // way evidence, warmup-verify, roster sync and checkpoint upload reject one.
  const displayName = typeof body.displayName === "string" ? body.displayName.slice(0, 200) : null;
  if (looksIdentified(studentKey) || (displayName && looksIdentified(displayName))) {
    return Response.json(
      { error: "identified_visit_rejected", detail: "Visit check-ins carry the alias, never a name or email." },
      { status: 400 },
    );
  }

  const { error } = await db.from("visit_check_ins").upsert(
    {
      session_id: sessionId,
      student_key: studentKey,
      display_name: displayName,
      status,
      promoted: typeof body.promoted === "string" ? body.promoted.slice(0, 80) : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "session_id,student_key" },
  );
  // The latest tap wins: a student visited twice shows their current state,
  // not a history the teacher has to read mid-walk.
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ saved: true });
}
