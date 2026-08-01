import { getRecentWarmupForms } from "@/lib/notionWarmupSummaries";

export const runtime = "nodejs";
// Cache the response for ~5 min; the data layer also caches per warm instance.
export const revalidate = 300;

// FERPA boundary: the per-student weekly summaries used to come from a Notion
// database carrying names and district emails. Student data may not live in
// Notion, so that read is retired - the weekly triage lives in the Workspace
// response spreadsheet now. Only the form links (no student data) remain.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const daysRaw = Number(searchParams.get("days"));
  const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.min(daysRaw, 120) : 14;

  try {
    const forms = await getRecentWarmupForms(days);
    return Response.json({ forms, days });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
