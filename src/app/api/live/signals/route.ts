// Teacher-only (middleware): live student self-signals for a session.
// GET /api/live/signals?sessionId=... -> { enabled, signals: [...] }
//
// Returns every student's LATEST signal with the step it was sent during;
// the teacher surface scopes counts to the current lesson step. Before the
// student-signals.sql migration has been run, enabled is false and the
// teacher UI hides the strip.
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Database not configured." }, { status: 503 });

  const sessionId = new URL(req.url).searchParams.get("sessionId");
  if (!sessionId) return Response.json({ error: "sessionId required" }, { status: 400 });

  const { data, error } = await db
    .from("student_signals")
    .select("student_id,display_name,signal,step_index,updated_at")
    .eq("session_id", sessionId)
    .order("updated_at", { ascending: false });
  if (error) {
    // Most likely the migration has not been run yet - report disabled
    // rather than erroring the session page.
    return Response.json({ enabled: false, signals: [] }, { headers: { "cache-control": "no-store" } });
  }

  return Response.json(
    { enabled: true, signals: data ?? [] },
    { headers: { "cache-control": "no-store" } },
  );
}
