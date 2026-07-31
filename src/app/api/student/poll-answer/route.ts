import { getSupabaseAdmin } from "@/lib/supabaseServer";
import {
  requireVerifiedStudent,
  StudentIdentityError,
  studentIdentityResponse,
} from "@/lib/studentIdentity";
import { MAX_STRUCTURED_NUMERIC_VALUES } from "@/lib/structuredNumeric";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const student = await requireVerifiedStudent(request);
    const body = await request.json().catch(() => ({})) as {
      pollId?: unknown; answer?: unknown; explanation?: unknown; values?: unknown;
    };
    const pollId = typeof body.pollId === "string" ? body.pollId : "";
    const answer = typeof body.answer === "string" ? body.answer.trim() : "";
    // Multiple Choice + Explain: the answer stays the bare choice (tallies and
    // correctness exact-match it); the explanation is stored beside it.
    const explanation = typeof body.explanation === "string" ? body.explanation.trim() : "";
    // Structured Numeric: the boxes (or the flat pairs list) travel in their
    // own column for the same reason - `answer` keeps the canonical summary so
    // City Routes and the readiness tallies keep exact-matching it. A blank box
    // stays null rather than collapsing to 0, which is a real answer. The cap
    // covers both shapes (boxes and 2-per-pair).
    const values = Array.isArray(body.values) && body.values.length <= MAX_STRUCTURED_NUMERIC_VALUES
      ? body.values.map((value) => (typeof value === "number" && Number.isFinite(value) ? value : null))
      : null;
    if (!pollId || !answer || answer.length > 2000 || explanation.length > 2000) {
      throw new StudentIdentityError("A valid question and answer are required.", 400, "invalid_poll_answer");
    }

    const db = getSupabaseAdmin();
    if (!db) throw new StudentIdentityError("Live questions are not configured.", 503, "polls_not_configured");
    const { data: poll, error: pollError } = await db
      .from("polls")
      .select("id,session_id,status")
      .eq("id", pollId)
      .maybeSingle();
    if (pollError) throw new StudentIdentityError("The live question could not be checked.", 500, "poll_lookup_failed");
    if (!poll || poll.status !== "open") {
      throw new StudentIdentityError("This live question is closed.", 409, "poll_closed");
    }

    const { data: session, error: sessionError } = await db
      .from("sessions")
      .select("id,period_id,status")
      .eq("id", poll.session_id)
      .maybeSingle();
    if (sessionError) throw new StudentIdentityError("The class session could not be checked.", 500, "session_lookup_failed");
    if (!session || session.status !== "open" || session.period_id !== student.periodId) {
      throw new StudentIdentityError("This question is not open for your class.", 403, "poll_wrong_class");
    }

    const { count: joined, error: joinError } = await db
      .from("session_joins")
      .select("id", { count: "exact", head: true })
      .eq("session_id", session.id)
      .eq("student_id", student.id);
    if (joinError) throw new StudentIdentityError("Your class join could not be checked.", 500, "join_lookup_failed");
    if (!joined) throw new StudentIdentityError("Join the class before answering.", 403, "session_join_required");

    const base = {
      poll_id: poll.id,
      student_id: student.id,
      display_name: student.fullName,
      answer,
      // Only sent when present so plain polls keep working before the
      // poll-explanations.sql / poll-structured-numeric.sql migrations have
      // been run.
      ...(explanation ? { explanation } : {}),
    };
    // Try WITH the structured boxes, then fall back to the answer alone.
    // The migrations here are HAND-RUN, and an upsert naming a column that
    // does not exist fails outright - which would mean a student's exit
    // ticket silently refusing to save on the one day it is the only
    // conceptual evidence of the lesson. Losing the boxes is recoverable;
    // losing the whole response is not.
    let answerError = values
      ? (await db.from("poll_answers").upsert({ ...base, values }, { onConflict: "poll_id,student_id" })).error
      : null;
    if (!values || answerError) {
      answerError = (await db.from("poll_answers").upsert(base, { onConflict: "poll_id,student_id" })).error;
    }
    if (answerError) throw new StudentIdentityError("Your answer could not be saved.", 500, "poll_answer_save_failed");

    return Response.json({ saved: true }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return studentIdentityResponse(error);
  }
}
