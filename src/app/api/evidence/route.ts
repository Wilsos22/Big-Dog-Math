// Evidence ingestion — the ONE write path for warm-up Form submissions and
// manipulative-tool events. Rows land in `responses` (raw log); call
// POST /api/mastery/recompute afterwards to refresh the bars.
//
// Auth: server-to-server key (the Apps Script warm-up sync sends it). Set
// EVIDENCE_INGEST_KEY in Vercel and send it as the `x-bdm-key` header.
//
// FERPA boundary: identity arrives as studentId or studentEmailHmac - the
// HMAC of the district email computed in Apps Script (see warmup-evidence.gs
// and src/lib/pseudonym.ts). Raw emails are refused, and dedupe keys must not
// embed them either.
//
// POST body: { events: [{
//   studentId? | studentEmailHmac?,      // one required; hmac → students.email_hmac
//   source: 'warmup' | 'tool',
//   domain?, standardId?, misconception?,
//   score0to5?, isCorrect?,              // warm-ups send 0–5; tools send correct/incorrect
//   itemRef?, sessionId?, at?, dedupeKey?
// }] } → { inserted, skipped, unmatched: [hmacs] }
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { isEmailHmac, looksIdentified } from "@/lib/pseudonym";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface EvidenceIn {
  studentId?: string;
  studentEmailHmac?: string;
  studentEmail?: string; // rejected - present only to catch pre-FERPA senders
  source?: string;
  domain?: string;
  standardId?: string;
  misconception?: string;
  score0to5?: number;
  isCorrect?: boolean;
  itemRef?: string;
  sessionId?: string;
  at?: string;
  dedupeKey?: string;
}

export async function POST(req: Request) {
  const key = process.env.EVIDENCE_INGEST_KEY;
  if (!key || req.headers.get("x-bdm-key") !== key) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Database not configured." }, { status: 503 });

  let body: { events?: EvidenceIn[] };
  try { body = await req.json(); } catch { return Response.json({ error: "Bad JSON." }, { status: 400 }); }
  const events = Array.isArray(body.events) ? body.events.slice(0, 500) : [];
  if (!events.length) return Response.json({ error: "No events." }, { status: 400 });

  // A raw email anywhere in the payload means a pre-FERPA Apps Script build is
  // still running. Refuse the whole batch loudly instead of storing identity.
  if (events.some((e) => e.studentEmail
    || looksIdentified(e.studentEmailHmac ?? "")
    || looksIdentified(e.dedupeKey ?? ""))) {
    return Response.json(
      { error: "Raw emails are not accepted. Update warmup-evidence.gs to send studentEmailHmac.", code: "raw_email_rejected" },
      { status: 422 },
    );
  }

  // Resolve email HMACs → student ids in one query.
  const hmacs = [...new Set(
    events.map((e) => (typeof e.studentEmailHmac === "string" ? e.studentEmailHmac.trim().toLowerCase() : ""))
      .filter((value) => isEmailHmac(value)),
  )];
  const hmacToId = new Map<string, string>();
  if (hmacs.length) {
    const { data } = await db.from("students").select("id,email_hmac").in("email_hmac", hmacs);
    for (const s of data || []) if (s.email_hmac) hmacToId.set(String(s.email_hmac), s.id);
  }

  const rows = [];
  const unmatched: string[] = [];
  // Every dropped event gets a named reason - a renamed sheet column or an
  // Apps Script drift used to vanish a week of evidence while the script log
  // said success. warmup-evidence.gs can now surface these.
  const dropped: { itemRef: string | null; reason: string }[] = [];
  for (const e of events) {
    const hmac = typeof e.studentEmailHmac === "string" ? e.studentEmailHmac.trim().toLowerCase() : "";
    const studentId = e.studentId || (hmac ? hmacToId.get(hmac) : undefined);
    if (!studentId) {
      if (hmac) unmatched.push(hmac);
      dropped.push({ itemRef: e.itemRef || null, reason: hmac ? "hmac_not_on_roster" : "no_student_identity" });
      continue;
    }
    if (e.source !== "warmup" && e.source !== "tool") {
      dropped.push({ itemRef: e.itemRef || null, reason: `unknown_source:${String(e.source).slice(0, 40)}` });
      continue;
    }
    rows.push({
      student_id: studentId,
      problem_id: null,
      session_id: e.sessionId || null,
      source: e.source,
      domain: e.domain || null,
      standard_id: e.standardId || null,
      item_ref: e.itemRef || null,
      dedupe_key: e.dedupeKey || null,
      score: typeof e.score0to5 === "number" ? Math.max(0, Math.min(5, e.score0to5)) : null,
      is_correct: typeof e.isCorrect === "boolean" ? e.isCorrect : null,
      misconception: e.misconception || null,
      graded_by: "pipeline",
      submitted_at: e.at || new Date().toISOString(),
    });
  }
  if (!rows.length) return Response.json({ inserted: 0, skipped: events.length, unmatched, dropped });

  // upsert on dedupe_key where present; plain insert otherwise
  const keyed = rows.filter((r) => r.dedupe_key);
  const unkeyed = rows.filter((r) => !r.dedupe_key);
  let inserted = 0;
  if (keyed.length) {
    const { error, count } = await db.from("responses")
      .upsert(keyed, { onConflict: "dedupe_key", ignoreDuplicates: true, count: "exact" });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    inserted += count ?? keyed.length;
  }
  if (unkeyed.length) {
    const { error } = await db.from("responses").insert(unkeyed);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    inserted += unkeyed.length;
  }
  return Response.json({ inserted, skipped: events.length - rows.length, unmatched, dropped });
}
