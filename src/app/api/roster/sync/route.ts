// Roster sync: the district Google Workspace roster Sheet pushes PSEUDONYMOUS
// rows here via Apps Script (warmup-roster-push.gs). The site never sees a
// student name or district email - each row is { alias, emailHmac, period },
// with the HMAC computed in Apps Script from a key that never leaves Script
// Properties. See src/lib/pseudonym.ts for the boundary rules.
//
// Match key: alias first (the stable Workspace-owned pseudonym), then
// emailHmac. Period is created if missing. NEVER deletes site students -
// students missing from the Sheet are only reported, so evidence history and
// the mock fixtures can't be wiped by a roster change.
//
// Auth: teacher cookie / Basic via the proxy; Apps Script sends
// Authorization: Bearer <CRON_SECRET>. The old Notion pull (and the Vercel
// cron that drove it) is GONE - student data may not exist in Notion.
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { assertPseudonymousRoster, type PseudonymousRosterRow } from "@/lib/pseudonym";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function normalized(value: string): string {
  return value.trim().toLowerCase();
}

type SiteStudent = {
  id: string;
  period_id: string;
  alias: string | null;
  email_hmac: string | null;
  table_number: number | null;
};

export async function POST(request: Request) {
  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Database not configured." }, { status: 503 });

  let roster: PseudonymousRosterRow[];
  try {
    const body = await request.json().catch(() => ({}));
    roster = assertPseudonymousRoster((body as { students?: unknown }).students);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Roster payload rejected." },
      { status: 422 },
    );
  }

  const [{ data: pData, error: pErr }, { data: sData, error: sErr }] = await Promise.all([
    db.from("periods").select("id,name,sort_order"),
    db.from("students").select("id,period_id,alias,email_hmac,table_number"),
  ]);
  if (pErr || sErr) return Response.json({ error: (pErr || sErr)!.message }, { status: 500 });

  const periods = new Map<string, string>((pData || []).map((p) => [normalized(p.name), p.id]));
  const periodNames = new Map<string, string>((pData || []).map((p) => [p.id, p.name]));
  const maxSort = Math.max(0, ...((pData || []).map((p) => p.sort_order || 0)));

  // Create any periods the Sheet mentions that the site doesn't have yet.
  const wanted = [...new Set(roster.map((r) => r.period))];
  let periodsCreated = 0;
  for (const name of wanted) {
    if (periods.has(normalized(name))) continue;
    const numeric = name.match(/\d+/)?.[0];
    const { data, error } = await db.from("periods")
      .insert({ name, sort_order: numeric ? Number(numeric) : maxSort + 10 + periodsCreated })
      .select("id").single();
    if (error) return Response.json({ error: `Creating period "${name}": ${error.message}` }, { status: 500 });
    periods.set(normalized(name), (data as { id: string }).id);
    periodsCreated += 1;
  }

  const siteStudents = (sData || []) as SiteStudent[];
  const byAlias = new Map<string, SiteStudent>();
  const byHmac = new Map<string, SiteStudent>();
  for (const student of siteStudents) {
    if (student.alias) byAlias.set(normalized(student.alias), student);
    if (student.email_hmac) byHmac.set(student.email_hmac, student);
  }

  const matchedSiteStudentIds = new Set<string>();
  let created = 0, updated = 0, unchanged = 0;
  const skipped: { alias: string; reason: string }[] = [];
  for (const r of roster) {
    const periodId = periods.get(normalized(r.period))!;
    const aliasMatch = byAlias.get(normalized(r.alias));
    const hmacMatch = r.emailHmac ? byHmac.get(r.emailHmac) : undefined;

    if (aliasMatch && hmacMatch && aliasMatch.id !== hmacMatch.id) {
      skipped.push({ alias: r.alias, reason: "alias and emailHmac match different site students" });
      continue;
    }
    const existing = aliasMatch || hmacMatch;
    if (existing) {
      if (matchedSiteStudentIds.has(existing.id)) {
        skipped.push({ alias: r.alias, reason: "duplicate row for one site student" });
        continue;
      }
      matchedSiteStudentIds.add(existing.id);
      // A blank Table cell means "the Sheet is not tracking seating", not
      // "clear this student's table" - a half-filled column must not wipe the
      // seating the rest of the sheet just set.
      const next = {
        alias: r.alias,
        email_hmac: r.emailHmac ?? existing.email_hmac,
        period_id: periodId,
        table_number: r.table ?? existing.table_number,
      };
      if (existing.alias === next.alias && existing.email_hmac === next.email_hmac && existing.period_id === next.period_id && existing.table_number === next.table_number) {
        unchanged += 1;
        continue;
      }
      const { error } = await db.from("students").update(next).eq("id", existing.id);
      if (error) { skipped.push({ alias: r.alias, reason: error.message }); continue; }
      if (existing.alias) byAlias.delete(normalized(existing.alias));
      if (existing.email_hmac) byHmac.delete(existing.email_hmac);
      Object.assign(existing, next);
      byAlias.set(normalized(existing.alias!), existing);
      if (existing.email_hmac) byHmac.set(existing.email_hmac, existing);
      updated += 1;
      continue;
    }

    const { data, error } = await db.from("students")
      .insert({ period_id: periodId, alias: r.alias, email_hmac: r.emailHmac, table_number: r.table })
      .select("id,period_id,alias,email_hmac,table_number")
      .single();
    if (error) { skipped.push({ alias: r.alias, reason: error.message }); continue; }
    const inserted = data as SiteStudent;
    matchedSiteStudentIds.add(inserted.id);
    byAlias.set(normalized(inserted.alias!), inserted);
    if (inserted.email_hmac) byHmac.set(inserted.email_hmac, inserted);
    created += 1;
  }

  // Report-only reconciliation preview, by alias only. Nothing here is deleted.
  const sheetPeriods = new Set(roster.map((row) => normalized(row.period)));
  const siteOnlyStudents = siteStudents
    .filter((student) => !matchedSiteStudentIds.has(student.id))
    .map((student) => ({
      id: student.id,
      alias: student.alias,
      periodId: student.period_id,
      periodName: periodNames.get(student.period_id) || "Unknown class",
    }));
  const siteOnlyPeriods = (pData || [])
    .filter((period) => !sheetPeriods.has(normalized(period.name)))
    .map((period) => ({
      id: period.id,
      name: period.name,
      studentCount: siteStudents.filter((student) => student.period_id === period.id).length,
    }));

  return Response.json({
    sheetRows: roster.length, periodsCreated, created, updated, unchanged,
    skipped,
    siteOnlyStudents,
    siteOnlyPeriods,
    reconciliationMode: "report-only",
  });
}

// The daily Vercel cron used to pull the roster from Notion through this GET.
// That flow is retired: the roster is pushed from the district Workspace, and
// student data may not exist in Notion at all.
export async function GET() {
  return Response.json(
    { error: "Roster sync is push-only. Run pushRosterToSite() from the Workspace Apps Script." },
    { status: 410 },
  );
}
