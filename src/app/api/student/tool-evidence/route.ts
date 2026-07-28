import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import {
  requireOpenJoinedSession,
  requireVerifiedStudent,
  StudentIdentityError,
  studentIdentityResponse,
} from "@/lib/studentIdentity";

export const dynamic = "force-dynamic";

const TOOL_DOMAIN = {
  "equation-builder": "Algebra and Algebraic Thinking",
  gems: "Algebra and Algebraic Thinking",
  "combine-like-terms": "Algebra and Algebraic Thinking",
  "balance-beam": "Algebra and Algebraic Thinking",
  "area-model": "Algebra and Algebraic Thinking",
  "distributive-area": "Algebra and Algebraic Thinking",
  "area-explorer": "Geometry",
} as const;

type EvidenceTool = keyof typeof TOOL_DOMAIN;

export async function POST(request: Request) {
  try {
    const student = await requireVerifiedStudent(request);
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
    const tool = typeof body.tool === "string" && body.tool in TOOL_DOMAIN
      ? body.tool as EvidenceTool
      : null;
    const correct = body.correct === true;
    const standardId = typeof body.standardId === "string" ? body.standardId.trim().slice(0, 80) : null;
    const misconception = typeof body.misconception === "string" ? body.misconception.trim().slice(0, 160) : null;
    const problemId = typeof body.problemId === "string" && body.problemId.trim()
      ? body.problemId.trim().slice(0, 180)
      : randomUUID();
    if (!tool) throw new StudentIdentityError("This learning tool is not recognized.", 400, "invalid_tool");
    // The device's running day tally, for the ONE aggregate row per
    // (student x tool x day). Clamped server-side; same trust level as the
    // per-problem report itself (a verified student describing their own
    // practice), and the shape the mastery bars and the City Routes
    // tie-breaker were designed around.
    const dayAttempts = Math.min(500, Math.max(1, Math.round(Number(body.dayAttempts)) || 1));
    const dayCorrect = Math.min(dayAttempts, Math.max(0, Math.round(Number(body.dayCorrect)) || 0));
    const dayTopMisconception = typeof body.dayTopMisconception === "string"
      ? body.dayTopMisconception.trim().slice(0, 160) || null
      : null;
    // What the student DID on this attempt - which split they chose, how many
    // distinct splits they tried, each partial and whether it was right.
    // Bounded so a malformed client cannot push an unbounded blob into the row.
    const detail = body.detail && typeof body.detail === "object" && !Array.isArray(body.detail)
      && JSON.stringify(body.detail).length <= 4000
      ? body.detail
      : null;
    await requireOpenJoinedSession(student, sessionId);

    const db = getSupabaseAdmin();
    if (!db) throw new StudentIdentityError("Learning evidence is not configured.", 503, "evidence_not_configured");
    const date = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();

    // Per-problem row ONLY when a seeded standard applies - it feeds the
    // per-standard stage gates and is excluded from the bars. Writing one for
    // every attempt (the old behavior) made each miss a full-weight bar hit.
    if (standardId) {
      const row = {
        student_id: student.id,
        session_id: sessionId,
        problem_id: null,
        source: "tool",
        domain: TOOL_DOMAIN[tool],
        standard_id: standardId,
        score: null,
        is_correct: correct,
        misconception,
        item_ref: `${tool}:${problemId}`,
        dedupe_key: `tool:${tool}:${student.id}:${date}:${problemId}`,
        graded_by: "tool",
        confirmed: false,
        submitted_at: now,
      };
      // Try WITH detail, then without: tool-evidence-detail.sql is hand-run,
      // and losing a whole attempt because the column is not there yet would
      // be a far worse trade than losing the detail on it.
      let error = detail
        ? (await db.from("responses").upsert({ ...row, detail }, { onConflict: "dedupe_key", ignoreDuplicates: true })).error
        : null;
      if (!detail || error) {
        error = (await db.from("responses").upsert(row, { onConflict: "dedupe_key", ignoreDuplicates: true })).error;
      }
      if (error) throw new StudentIdentityError("Your learning evidence could not be saved.", 500, "evidence_save_failed");
    }

    // The daily aggregate (score 0-5, standard-less) - the row recompute's
    // bars and city-routes' tool tie-breaker actually read. Updates in place
    // all period long, exactly like the legacy client wrote it.
    const { error: aggError } = await db.from("responses").upsert(
      {
        student_id: student.id,
        session_id: sessionId,
        problem_id: null,
        source: "tool",
        domain: TOOL_DOMAIN[tool],
        standard_id: null,
        score: Math.round((5 * dayCorrect / dayAttempts) * 100) / 100,
        is_correct: null,
        misconception: dayTopMisconception,
        item_ref: tool,
        dedupe_key: `tool:${tool}:agg:${student.id}:${date}`,
        graded_by: "tool",
        confirmed: false,
        submitted_at: now,
      },
      { onConflict: "dedupe_key" },
    );
    if (aggError) throw new StudentIdentityError("Your learning evidence could not be saved.", 500, "evidence_save_failed");

    return Response.json({ saved: true }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return studentIdentityResponse(error);
  }
}
