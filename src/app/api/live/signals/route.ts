// Teacher-only (middleware): live student self-signals for a session.
//
// GET  /api/live/signals?sessionId=...
//   -> { enabled, controls, signalsOff, signals: [...] }
//   `controls` is false until student-signal-controls.sql has been run; the
//   mute buttons and the on/off toggle hide themselves while it is.
//   Muted students' rows are excluded from `signals`.
// POST /api/live/signals { sessionId, action, studentId? }
//   action: "mute" | "unmute" (per student) | "signals-off" | "signals-on"
//   (whole session). Returns 409 with a plain message when the controls
//   migration has not been run.
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SignalRow {
  student_id: string | null;
  display_name: string | null;
  signal: string;
  step_index: number | null;
  updated_at: string;
  muted?: boolean;
}

const CONTROLS_HINT = "Run supabase/student-signal-controls.sql to enable mute and the on/off switch.";

export async function GET(req: Request) {
  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Database not configured." }, { status: 503 });

  const sessionId = new URL(req.url).searchParams.get("sessionId");
  if (!sessionId) return Response.json({ error: "sessionId required" }, { status: 400 });

  // Try the controls-aware shape first; fall back to the base columns while
  // the controls migration has not been run.
  let rows: SignalRow[] | null = null;
  let controls = true;
  const withMuted = await db
    .from("student_signals")
    .select("student_id,display_name,signal,step_index,updated_at,muted")
    .eq("session_id", sessionId)
    .order("updated_at", { ascending: false });
  if (withMuted.error) {
    controls = false;
    const base = await db
      .from("student_signals")
      .select("student_id,display_name,signal,step_index,updated_at")
      .eq("session_id", sessionId)
      .order("updated_at", { ascending: false });
    if (base.error) {
      // Most likely the signals table itself is missing.
      return Response.json({ enabled: false, controls: false, signalsOff: false, signals: [] }, { headers: { "cache-control": "no-store" } });
    }
    rows = base.data as SignalRow[];
  } else {
    rows = (withMuted.data as SignalRow[]).filter((row) => !row.muted);
  }

  let signalsOff = false;
  if (controls) {
    const { data } = await db.from("sessions").select("signals_off").eq("id", sessionId).maybeSingle();
    signalsOff = Boolean((data as { signals_off?: boolean } | null)?.signals_off);
  }

  return Response.json(
    { enabled: true, controls, signalsOff, signals: rows ?? [] },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(req: Request) {
  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Database not configured." }, { status: 503 });

  const body = await req.json().catch(() => ({})) as { sessionId?: unknown; action?: unknown; studentId?: unknown };
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  const action = typeof body.action === "string" ? body.action : "";
  const studentId = typeof body.studentId === "string" ? body.studentId : "";
  if (!sessionId) return Response.json({ error: "sessionId required" }, { status: 400 });

  if (action === "mute" || action === "unmute") {
    if (!studentId) return Response.json({ error: "studentId required" }, { status: 400 });
    const { error } = await db
      .from("student_signals")
      .update({ muted: action === "mute" })
      .eq("session_id", sessionId)
      .eq("student_id", studentId);
    if (error) return Response.json({ error: CONTROLS_HINT }, { status: 409 });
    return Response.json({ ok: true });
  }

  if (action === "signals-off" || action === "signals-on") {
    const { error } = await db
      .from("sessions")
      .update({ signals_off: action === "signals-off" })
      .eq("id", sessionId);
    if (error) return Response.json({ error: CONTROLS_HINT }, { status: 409 });
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Unknown action." }, { status: 400 });
}
