// This week's table captains.
//
// GET returns everything the Monday spinner needs in one call: the candidate
// pool per table, whatever captains are already saved for the week, and whether
// the roster actually knows where anybody sits. POST saves a completed spin.
//
// SEATING IS OPTIONAL BY DESIGN. Until the Workspace roster Sheet grows a Table
// column, students.table_number is null for everyone and every table's
// candidate pool is the whole period - the spinner then picks ten DISTINCT
// students, which is the correct behaviour for a room whose seating the site
// does not know. The moment the Sheet carries tables, each pool narrows to the
// students who actually sit there and nothing else about the flow changes.
//
// FERPA: aliases only, in and out. The projector resolves first names in the
// browser through the teacher name key; this route never sees one and refuses
// a payload that looks identified.

import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { isStudentAlias, looksIdentified } from "@/lib/pseudonym";
import {
  DEFAULT_TABLE_COUNT,
  schoolDateKey,
  tableNumberOf,
  weekStartKey,
  type TableCaptain,
} from "@/lib/tableCaptains";

export const dynamic = "force-dynamic";

type RosterRow = { id: string; alias: string | null; table_number: number | null };
type CaptainRow = { table_number: number; student_id: string | null; alias: string };

function uuid(value: unknown): string {
  const id = typeof value === "string" ? value.trim() : "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : "";
}

function dateKey(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
}

async function periodForSession(
  db: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  sessionId: string,
): Promise<{ periodId: string } | { error: string; status: number }> {
  const { data, error } = await db
    .from("sessions")
    .select("id,period_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) return { error: error.message, status: 500 };
  if (!data) return { error: "That class session was not found.", status: 404 };
  return { periodId: data.period_id as string };
}

export async function GET(request: Request) {
  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Database not configured." }, { status: 503 });

  const searchParams = new URL(request.url).searchParams;
  const sessionId = uuid(searchParams.get("sessionId"));
  let periodId = uuid(searchParams.get("periodId"));
  if (!sessionId && !periodId) {
    return Response.json({ error: "An active session or class period is required." }, { status: 400 });
  }
  if (sessionId) {
    const resolved = await periodForSession(db, sessionId);
    if ("error" in resolved) return Response.json({ error: resolved.error }, { status: resolved.status });
    if (periodId && periodId !== resolved.periodId) {
      return Response.json({ error: "The session does not belong to this class period." }, { status: 409 });
    }
    periodId = resolved.periodId;
  }

  const weekStart = dateKey(searchParams.get("weekStart")) || weekStartKey(schoolDateKey());

  const { data: roster, error: rosterError } = await db
    .from("students")
    .select("id,alias,table_number")
    .eq("period_id", periodId)
    .order("alias");
  if (rosterError) return Response.json({ error: rosterError.message }, { status: 500 });

  const rows = (roster ?? []) as RosterRow[];
  const seated = rows.filter((row) => tableNumberOf(row.table_number) > 0);
  const seatingKnown = seated.length > 0;
  const tableCount = seatingKnown
    ? Math.max(DEFAULT_TABLE_COUNT, ...seated.map((row) => tableNumberOf(row.table_number)))
    : DEFAULT_TABLE_COUNT;

  const tables = Array.from({ length: tableCount }, (_, index) => {
    const tableNumber = index + 1;
    // No seating chart yet means every table draws from the whole period, and
    // the spinner is responsible for keeping the ten picks distinct.
    const pool = seatingKnown
      ? rows.filter((row) => tableNumberOf(row.table_number) === tableNumber)
      : rows;
    return {
      tableNumber,
      candidates: pool.map((row) => ({ id: row.id, alias: row.alias || "Unnamed student" })),
    };
  });

  const { data: saved, error: savedError } = await db
    .from("table_captains")
    .select("table_number,student_id,alias")
    .eq("period_id", periodId)
    .eq("week_start", weekStart)
    .order("table_number");
  if (savedError) return Response.json({ error: savedError.message }, { status: 500 });

  const captains: TableCaptain[] = ((saved ?? []) as CaptainRow[]).map((row) => ({
    tableNumber: row.table_number,
    studentId: row.student_id,
    alias: row.alias,
  }));

  return Response.json(
    { periodId, weekStart, tableCount, seatingKnown, tables, captains },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Database not configured." }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as {
    sessionId?: unknown;
    periodId?: unknown;
    weekStart?: unknown;
    captains?: unknown;
  };

  const sessionId = uuid(body.sessionId);
  let periodId = uuid(body.periodId);
  if (sessionId) {
    const resolved = await periodForSession(db, sessionId);
    if ("error" in resolved) return Response.json({ error: resolved.error }, { status: resolved.status });
    periodId = resolved.periodId;
  }
  if (!periodId) {
    return Response.json({ error: "An active session or class period is required." }, { status: 400 });
  }

  const weekStart = dateKey(body.weekStart) || weekStartKey(schoolDateKey());
  if (!Array.isArray(body.captains) || !body.captains.length) {
    return Response.json({ error: "A captains array is required." }, { status: 400 });
  }
  if (body.captains.length > 32) {
    return Response.json({ error: "That is more tables than any classroom has." }, { status: 400 });
  }

  const seen = new Set<number>();
  const rows: { period_id: string; week_start: string; table_number: number; student_id: string | null; alias: string; updated_at: string }[] = [];
  for (const raw of body.captains) {
    const entry = (raw ?? {}) as { tableNumber?: unknown; studentId?: unknown; alias?: unknown };
    const tableNumber = tableNumberOf(entry.tableNumber, 32);
    if (!tableNumber) return Response.json({ error: "Each captain needs a valid table number." }, { status: 400 });
    if (seen.has(tableNumber)) {
      return Response.json({ error: `Table ${tableNumber} was sent twice.` }, { status: 400 });
    }
    seen.add(tableNumber);
    const alias = typeof entry.alias === "string" ? entry.alias.trim() : "";
    if (looksIdentified(alias)) {
      return Response.json(
        { error: "A captain payload carried a real identity. Only Workspace aliases may reach the site." },
        { status: 400 },
      );
    }
    if (!isStudentAlias(alias)) {
      return Response.json({ error: `Table ${tableNumber}: captain alias is missing or not a valid pseudonym.` }, { status: 400 });
    }
    rows.push({
      period_id: periodId,
      week_start: weekStart,
      table_number: tableNumber,
      student_id: uuid(entry.studentId) || null,
      alias,
      updated_at: new Date().toISOString(),
    });
  }

  const { data, error } = await db
    .from("table_captains")
    .upsert(rows, { onConflict: "period_id,week_start,table_number" })
    .select("table_number,student_id,alias");
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const captains: TableCaptain[] = ((data ?? []) as CaptainRow[])
    .map((row) => ({ tableNumber: row.table_number, studentId: row.student_id, alias: row.alias }))
    .sort((a, b) => a.tableNumber - b.tableNumber);

  return Response.json({ periodId, weekStart, captains }, { status: 201 });
}
