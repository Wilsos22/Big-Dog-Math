// Student self-signal: the low-stakes "I'm stuck" / "say that again" /
// "I've got this" tap on the live student surface. One LATEST signal per
// student per session (upsert), tagged with the lesson step it was sent
// during so the teacher view can scope to the current step.
//
// GET  /api/student/signal?sessionId=...  -> { enabled } probe: the student
//   chips stay hidden until supabase/student-signals.sql has been run, and
//   for sessions where the teacher flipped signals off (the student surface
//   re-probes on every lesson-step change, so the switch bites at the next
//   advance).
// POST /api/student/signal { sessionId, signal, stepIndex } -> { ok }
//   A 10-second server-side cooldown per student absorbs chip-mashing: the
//   write is simply refused (429) until the last one is 10 seconds old.
//
// Auth matches every /api/student/* route: requireVerifiedStudent covers the
// secure rollout and the transitional claimed-id mode in one call.
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import {
  requireVerifiedStudent,
  StudentIdentityError,
  studentIdentityResponse,
} from "@/lib/studentIdentity";

export const dynamic = "force-dynamic";

const SIGNALS = ["stuck", "again", "got-it"] as const;
type Signal = (typeof SIGNALS)[number];
const COOLDOWN_MS = 10_000;

type Db = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

// True when the teacher flipped signals off for this session. Tolerates the
// signals_off column not existing yet (student-signal-controls.sql staged).
async function sessionSignalsOff(db: Db, sessionId: string): Promise<boolean> {
  const { data, error } = await db
    .from("sessions")
    .select("signals_off")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) return false;
  return Boolean((data as { signals_off?: boolean } | null)?.signals_off);
}

export async function GET(request: Request) {
  const db = getSupabaseAdmin();
  if (!db) return Response.json({ enabled: false }, { headers: { "cache-control": "no-store" } });
  // Probe: any error (most likely "table missing" before the migration runs)
  // reports disabled, and the student surface hides the chips entirely.
  const { error } = await db.from("student_signals").select("id", { head: true, count: "exact" }).limit(1);
  if (error) return Response.json({ enabled: false }, { headers: { "cache-control": "no-store" } });

  const sessionId = new URL(request.url).searchParams.get("sessionId") || "";
  const off = sessionId ? await sessionSignalsOff(db, sessionId) : false;
  return Response.json({ enabled: !off }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  try {
    const student = await requireVerifiedStudent(request);
    const body = await request.json().catch(() => ({})) as { sessionId?: unknown; signal?: unknown; stepIndex?: unknown };
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
    const signal = typeof body.signal === "string" && (SIGNALS as readonly string[]).includes(body.signal)
      ? body.signal as Signal
      : null;
    const stepIndex = typeof body.stepIndex === "number" && Number.isInteger(body.stepIndex)
      ? body.stepIndex
      : null;
    if (!sessionId || !signal) {
      throw new StudentIdentityError("A valid session and signal are required.", 400, "invalid_signal");
    }

    const db = getSupabaseAdmin();
    if (!db) throw new StudentIdentityError("Signals are not configured.", 503, "signals_not_configured");

    const { data: session, error: sessionError } = await db
      .from("sessions")
      .select("id,period_id,status")
      .eq("id", sessionId)
      .maybeSingle();
    if (sessionError) throw new StudentIdentityError("The class session could not be checked.", 500, "session_lookup_failed");
    if (!session || session.status !== "open" || session.period_id !== student.periodId) {
      throw new StudentIdentityError("This session is not open for your class.", 403, "signal_wrong_class");
    }
    if (await sessionSignalsOff(db, session.id)) {
      throw new StudentIdentityError("Signals are turned off for this session.", 409, "signals_off");
    }

    const { count: joined, error: joinError } = await db
      .from("session_joins")
      .select("id", { count: "exact", head: true })
      .eq("session_id", session.id)
      .eq("student_id", student.id);
    if (joinError) throw new StudentIdentityError("Your class join could not be checked.", 500, "join_lookup_failed");
    if (!joined) throw new StudentIdentityError("Join the class before sending a signal.", 403, "session_join_required");

    // Cooldown: refuse writes until the student's last signal is 10s old.
    const { data: existing } = await db
      .from("student_signals")
      .select("updated_at")
      .eq("session_id", session.id)
      .eq("student_id", student.id)
      .maybeSingle();
    if (existing?.updated_at && Date.now() - Date.parse(existing.updated_at) < COOLDOWN_MS) {
      throw new StudentIdentityError("Give it a few seconds before signaling again.", 429, "signal_cooldown");
    }

    // Upsert touches only these columns - a teacher mute (muted flag from
    // student-signal-controls.sql) survives the student's own writes.
    const { error: writeError } = await db.from("student_signals").upsert(
      {
        session_id: session.id,
        student_id: student.id,
        display_name: student.alias,
        signal,
        step_index: stepIndex,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "session_id,student_id" },
    );
    if (writeError) throw new StudentIdentityError("Your signal could not be sent.", 503, "signal_write_failed");

    return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return studentIdentityResponse(error);
  }
}
