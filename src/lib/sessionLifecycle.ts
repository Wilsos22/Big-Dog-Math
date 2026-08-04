// Session lifecycle guardrails.
//
// Two invariants, both learned from the 2026-07-28 live test where a forgotten
// open session from the morning was still sitting on `closeout` hours later and
// a second session split the class in two:
//
// 1. ONE OPEN SESSION AT A TIME. Steele teaches one period at a time, so a
//    second open row is always a mistake - either a stale session nobody closed
//    or a duplicate spawned by a code lookup. Starting a new period closes the
//    previous one instead of racing it.
// 2. A SESSION THAT OUTLIVED ITS CLASS CLOSES ITSELF. A session left open
//    overnight keeps holding its join code, keeps answering student polls, and
//    keeps `latestOpen` pointing at yesterday.
//
// The stale cutoff is deliberately derived, never a flat clock: it is the
// session's OWN planned length (summed from its lineup) with a floor, plus a
// grace window. A guardrail that can end a class still in progress is worse
// than no guardrail, so the arithmetic only ever errs long.

import type { LiveClassFlowSnapshot } from "@/lib/liveClassFlow";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

/**
 * Floor for a session's planned length. NOT the period - the lesson day is 50
 * minutes. This is deliberately LONGER, because it only feeds the stale-session
 * auto-close: a guardrail that can end a class still in progress is worse than
 * no guardrail, so its arithmetic errs long on purpose. Do not "correct" it to
 * 50 to match the day. The teacher-facing budgets (PERIOD_MIN on /control, the
 * studio total, /teacher/rehearse) are the ones that must read 50.
 */
export const MIN_SCHEDULED_MINUTES = 55;
/** How far past the planned end a session may run before it closes itself. */
export const STALE_GRACE_MINUTES = 15;
/** Never trust a lineup that claims an implausible day. */
const MAX_SCHEDULED_MINUTES = 180;
/** Per-instance throttle so a 1.2s control poll cannot sweep every tick. */
const SWEEP_INTERVAL_MS = 60_000;

type Db = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

type OpenSessionRow = {
  id: string;
  period_id: string | null;
  started_at: string | null;
  live_flow: LiveClassFlowSnapshot | null;
};

let lastSweepAt = 0;

/**
 * The session's own planned length in minutes, summed from its published
 * lineup. Falls back to the spine floor when a session has no lineup yet -
 * which is exactly the case for a session auto-created by a student's code
 * entry before the teacher has loaded anything.
 */
export function plannedSessionMinutes(flow: LiveClassFlowSnapshot | null): number {
  const steps = flow?.sequence?.steps;
  if (!Array.isArray(steps) || steps.length === 0) return MIN_SCHEDULED_MINUTES;
  let seconds = 0;
  for (const step of steps) {
    const duration = Number(step?.durationSeconds);
    if (Number.isFinite(duration) && duration > 0) seconds += duration;
  }
  if (seconds <= 0) return MIN_SCHEDULED_MINUTES;
  return Math.min(MAX_SCHEDULED_MINUTES, Math.max(MIN_SCHEDULED_MINUTES, Math.round(seconds / 60)));
}

/** The moment a session becomes stale, in ms since epoch. */
export function staleCutoffMs(row: Pick<OpenSessionRow, "started_at" | "live_flow">): number {
  const startedAt = row.started_at ? Date.parse(row.started_at) : NaN;
  if (!Number.isFinite(startedAt)) return Number.POSITIVE_INFINITY;
  const minutes = plannedSessionMinutes(row.live_flow) + STALE_GRACE_MINUTES;
  return startedAt + minutes * 60_000;
}

/**
 * Close the given sessions and any polls still open inside them. Mirrors the
 * teacher-initiated close in /api/teacher/session so an auto-closed session is
 * indistinguishable from one Steele ended himself - same cleared fields, so no
 * projector or Chromebook is left pointing at a dead flow.
 */
export async function closeSessions(db: Db, sessionIds: string[]): Promise<string[]> {
  if (!sessionIds.length) return [];
  const now = new Date().toISOString();
  const [, sessionResult] = await Promise.all([
    db.from("polls").update({ status: "closed" }).in("session_id", sessionIds).eq("status", "open"),
    db.from("sessions")
      .update({ status: "closed", ended_at: now, broadcast: null, live_flow: null, remote_command: null })
      .in("id", sessionIds)
      .eq("status", "open")
      .select("id"),
  ]);
  if (sessionResult.error) return [];
  return (sessionResult.data ?? []).map((row) => (row as { id: string }).id);
}

async function readOpenSessions(db: Db): Promise<OpenSessionRow[]> {
  const { data, error } = await db
    .from("sessions")
    .select("id,period_id,started_at,live_flow")
    .eq("status", "open")
    .order("started_at", { ascending: false })
    .limit(50);
  if (error) return [];
  return (data ?? []) as OpenSessionRow[];
}

/**
 * Close every open session that has outlived its planned length plus grace.
 * Cheap and idempotent, so it is safe to call on any session-touching request.
 * Throttled per server instance unless `force` is set.
 */
export async function sweepStaleSessions(db: Db, force = false): Promise<string[]> {
  const now = Date.now();
  if (!force && now - lastSweepAt < SWEEP_INTERVAL_MS) return [];
  lastSweepAt = now;
  const open = await readOpenSessions(db);
  const stale = open.filter((row) => now > staleCutoffMs(row)).map((row) => row.id);
  if (!stale.length) return [];
  return closeSessions(db, stale);
}

/**
 * Enforce one open session at a time. Closes every open session except
 * `keepSessionId`. Called when a session is started or adopted, so moving from
 * period 2 to period 3 ends period 2 rather than leaving both live and letting
 * `latestOpen` pick the wrong one.
 */
export async function closeOtherOpenSessions(db: Db, keepSessionId: string): Promise<string[]> {
  const open = await readOpenSessions(db);
  const others = open.filter((row) => row.id !== keepSessionId).map((row) => row.id);
  if (!others.length) return [];
  return closeSessions(db, others);
}
