// Teacher-only (middleware): live student self-signals for a session, plus
// teacher-triggered check-in rounds ("ask the class where they're at").
//
// GET  /api/live/signals?sessionId=...
//   -> { enabled, controls, checkinReady, signalsOff, checkinActive,
//        checkinRound, checkinStartedAt, signals: [...] }
//   `controls` is false until student-signal-controls.sql has been run; the
//   mute buttons and the on/off toggle hide themselves while it is.
//   `checkinReady` is false until student-checkin.sql has been run; the
//   "Ask the class" button and the round tally hide themselves while it is.
//   Muted students' rows are excluded from `signals`.
// POST /api/live/signals { sessionId, action, studentId? }
//   action: "mute" | "unmute" (per student) | "signals-off" | "signals-on"
//   (whole session) | "checkin-start" | "checkin-end". Returns 409 with a
//   plain message when the relevant migration has not been run.
import { after } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { broadcastLiveFlowChange } from "@/lib/liveFlowBroadcast";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SignalRow {
  student_id: string | null;
  display_name: string | null;
  signal: string;
  step_index: number | null;
  updated_at: string;
  muted?: boolean;
  checkin_round?: number | null;
}

const CONTROLS_HINT = "Run supabase/student-signal-controls.sql to enable mute and the on/off switch.";
const CHECKIN_HINT = "Run supabase/student-checkin.sql to enable check-in rounds.";

export async function GET(req: Request) {
  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Database not configured." }, { status: 503 });

  const sessionId = new URL(req.url).searchParams.get("sessionId");
  if (!sessionId) return Response.json({ error: "sessionId required" }, { status: 400 });

  // Try the checkin-aware shape first, then the controls-aware shape, then
  // the base columns - each is a real migration that may not have run yet.
  let rows: SignalRow[] | null = null;
  let controls = true;
  let checkinReady = true;
  const withCheckin = await db
    .from("student_signals")
    .select("student_id,display_name,signal,step_index,updated_at,muted,checkin_round")
    .eq("session_id", sessionId)
    .order("updated_at", { ascending: false });
  if (withCheckin.error) {
    checkinReady = false;
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
        return Response.json(
          { enabled: false, controls: false, checkinReady: false, signalsOff: false, checkinActive: false, checkinRound: 0, checkinStartedAt: null, signals: [] },
          { headers: { "cache-control": "no-store" } },
        );
      }
      rows = base.data as SignalRow[];
    } else {
      rows = (withMuted.data as SignalRow[]).filter((row) => !row.muted);
    }
  } else {
    rows = (withCheckin.data as SignalRow[]).filter((row) => !row.muted);
  }

  // Independent of `controls` above (that flag tracks student_signals.muted,
  // which is a different migration from the sessions.checkin_* columns) - so
  // this tries its own full select and falls back on its own, rather than
  // assuming the two migrations landed together.
  let signalsOff = false;
  let checkinActive = false;
  let checkinRound = 0;
  let checkinStartedAt: string | null = null;
  {
    const withCheckin = await db
      .from("sessions")
      .select("signals_off,checkin_active,checkin_round,checkin_started_at")
      .eq("id", sessionId)
      .maybeSingle();
    const { data } = withCheckin.error
      ? await db.from("sessions").select("signals_off").eq("id", sessionId).maybeSingle()
      : withCheckin;
    const row = data as { signals_off?: boolean; checkin_active?: boolean; checkin_round?: number; checkin_started_at?: string | null } | null;
    signalsOff = Boolean(row?.signals_off);
    checkinActive = Boolean(row?.checkin_active);
    checkinRound = typeof row?.checkin_round === "number" ? row.checkin_round : 0;
    checkinStartedAt = row?.checkin_started_at ?? null;
  }

  return Response.json(
    { enabled: true, controls, checkinReady, signalsOff, checkinActive, checkinRound, checkinStartedAt, signals: rows ?? [] },
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

  // "Ask the class where they're at": a manual, ad-hoc mini fist-to-five on
  // top of the ambient signals. Starting a round bumps checkin_round rather
  // than deleting any rows, so the new round's tally starts at zero (no
  // student has written to it yet) without disturbing history. Both actions
  // ping /live-flow so the nudge appears/clears in ~200ms instead of waiting
  // on the next poll (see broadcastLiveFlowChange).
  if (action === "checkin-start") {
    const { data: current, error: readError } = await db
      .from("sessions")
      .select("checkin_round")
      .eq("id", sessionId)
      .maybeSingle();
    if (readError) return Response.json({ error: CHECKIN_HINT }, { status: 409 });
    const currentRound = (current as { checkin_round?: number } | null)?.checkin_round;
    const nextRound = (typeof currentRound === "number" ? currentRound : 0) + 1;
    const { error } = await db
      .from("sessions")
      .update({ checkin_active: true, checkin_round: nextRound, checkin_started_at: new Date().toISOString() })
      .eq("id", sessionId);
    if (error) return Response.json({ error: CHECKIN_HINT }, { status: 409 });
    after(() => broadcastLiveFlowChange(sessionId));
    return Response.json({ ok: true, checkinRound: nextRound });
  }

  if (action === "checkin-end") {
    const { error } = await db
      .from("sessions")
      .update({ checkin_active: false })
      .eq("id", sessionId);
    if (error) return Response.json({ error: CHECKIN_HINT }, { status: 409 });
    after(() => broadcastLiveFlowChange(sessionId));
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Unknown action." }, { status: 400 });
}
