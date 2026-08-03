// The closeout supply check.
//
// At closeout each table captain says whether their table has everything. The
// teacher taps the table green or red on the iPad; this route records the tap
// and hands back the table's current consecutive-red streak so the grid can
// show, in the moment, which table just crossed the line.
//
// One row per (session, table) - the LATEST tap wins. A table that finds the
// missing marker before the bell should end the day green, and a mis-tap should
// be fixable by tapping again, so this upserts rather than appending.
//
// The streak rule lives in supply_check_streaks (see the migration) and in
// standingFromStreak: two reds in a row flags a table, any green wipes it.
//
// FERPA: there is no student reference anywhere in this route. A table is
// furniture. The captain's alias comes along only for display, read from
// table_captains, and never a name.

import { getSupabaseAdmin } from "@/lib/supabaseServer";
import {
  DEFAULT_TABLE_COUNT,
  isSupplyStatus,
  schoolDateKey,
  standingFromStreak,
  tableNumberOf,
  weekStartKey,
  type SupplyStatus,
  type TableStreak,
} from "@/lib/tableCaptains";

export const dynamic = "force-dynamic";

type SessionRow = { id: string; period_id: string; started_at: string | null };
type CheckRow = { table_number: number; status: SupplyStatus; missing: string | null };
type StreakRow = {
  table_number: number;
  red_streak: number;
  red_total: number;
  checks_total: number;
  last_checked: string | null;
};

function uuid(value: unknown): string {
  const id = typeof value === "string" ? value.trim() : "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : "";
}

async function loadSession(
  db: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  sessionId: string,
): Promise<SessionRow | null> {
  const { data } = await db
    .from("sessions")
    .select("id,period_id,started_at")
    .eq("id", sessionId)
    .maybeSingle();
  return (data as SessionRow) ?? null;
}

async function streaksFor(
  db: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  periodId: string,
): Promise<TableStreak[]> {
  const { data } = await db
    .from("supply_check_streaks")
    .select("table_number,red_streak,red_total,checks_total,last_checked")
    .eq("period_id", periodId);
  return ((data ?? []) as StreakRow[]).map((row) => ({
    tableNumber: row.table_number,
    redStreak: row.red_streak ?? 0,
    redTotal: row.red_total ?? 0,
    checksTotal: row.checks_total ?? 0,
    lastChecked: row.last_checked,
  }));
}

export async function GET(request: Request) {
  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Database not configured." }, { status: 503 });

  const searchParams = new URL(request.url).searchParams;
  const sessionId = uuid(searchParams.get("sessionId"));
  if (!sessionId) return Response.json({ error: "An active session is required." }, { status: 400 });

  const session = await loadSession(db, sessionId);
  if (!session) return Response.json({ error: "That class session was not found." }, { status: 404 });
  const periodId = session.period_id;
  const classDate = schoolDateKey(session.started_at ? new Date(session.started_at) : new Date());
  const weekStart = weekStartKey(classDate);

  const [checksResult, captainsResult, streaks] = await Promise.all([
    db.from("supply_checks").select("table_number,status,missing").eq("session_id", sessionId),
    db
      .from("table_captains")
      .select("table_number,alias")
      .eq("period_id", periodId)
      .eq("week_start", weekStart),
    streaksFor(db, periodId),
  ]);

  if (checksResult.error) return Response.json({ error: checksResult.error.message }, { status: 500 });

  const checks = new Map(((checksResult.data ?? []) as CheckRow[]).map((row) => [row.table_number, row]));
  const captains = new Map(
    ((captainsResult.data ?? []) as { table_number: number; alias: string }[]).map((row) => [row.table_number, row.alias]),
  );
  const streakBy = new Map(streaks.map((row) => [row.tableNumber, row]));

  const highestKnown = Math.max(
    DEFAULT_TABLE_COUNT,
    ...[...checks.keys(), ...captains.keys(), ...streakBy.keys(), 0],
  );

  const tables = Array.from({ length: highestKnown }, (_, index) => {
    const tableNumber = index + 1;
    const check = checks.get(tableNumber);
    const streak = streakBy.get(tableNumber);
    // Today's own tap is already inside the streak view, so a table tapped red
    // a moment ago reads its new standing without a refetch race.
    const redStreak = streak?.redStreak ?? 0;
    return {
      tableNumber,
      status: check?.status ?? null,
      missing: check?.missing ?? null,
      captainAlias: captains.get(tableNumber) ?? null,
      redStreak,
      redTotal: streak?.redTotal ?? 0,
      checksTotal: streak?.checksTotal ?? 0,
      lastChecked: streak?.lastChecked ?? null,
      standing: standingFromStreak(redStreak),
    };
  });

  return Response.json(
    { sessionId, periodId, classDate, weekStart, tables },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Database not configured." }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as {
    sessionId?: unknown;
    tableNumber?: unknown;
    status?: unknown;
    missing?: unknown;
  };

  const sessionId = uuid(body.sessionId);
  if (!sessionId) return Response.json({ error: "An active session is required." }, { status: 400 });

  const tableNumber = tableNumberOf(body.tableNumber, 32);
  if (!tableNumber) return Response.json({ error: "A valid table number is required." }, { status: 400 });

  if (!isSupplyStatus(body.status)) {
    return Response.json({ error: "Status must be green or red." }, { status: 400 });
  }
  const status: SupplyStatus = body.status;

  const missingRaw = typeof body.missing === "string" ? body.missing.trim().slice(0, 200) : "";
  const missing = status === "red" && missingRaw ? missingRaw : null;

  const session = await loadSession(db, sessionId);
  if (!session) return Response.json({ error: "That class session was not found." }, { status: 404 });
  const periodId = session.period_id;
  const classDate = schoolDateKey(session.started_at ? new Date(session.started_at) : new Date());

  const { error } = await db.from("supply_checks").upsert(
    {
      session_id: sessionId,
      period_id: periodId,
      class_date: classDate,
      table_number: tableNumber,
      status,
      missing,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "session_id,table_number" },
  );
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const streaks = await streaksFor(db, periodId);
  const streak = streaks.find((row) => row.tableNumber === tableNumber);
  const redStreak = streak?.redStreak ?? (status === "red" ? 1 : 0);

  return Response.json(
    {
      tableNumber,
      status,
      missing,
      classDate,
      redStreak,
      redTotal: streak?.redTotal ?? 0,
      checksTotal: streak?.checksTotal ?? 0,
      standing: standingFromStreak(redStreak),
    },
    { status: 201 },
  );
}
