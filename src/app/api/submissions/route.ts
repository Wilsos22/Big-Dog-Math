// Teacher-only roll-up of today's digital checks: tool summaries, live
// questions, Fist to Five, and exit-ticket responses, by student ALIAS.
// The old POST that pushed this into a Notion "Student Submissions" database
// is deleted - student work may not leave the site for Notion (FERPA
// boundary). Grade-book export happens in the district Google Workspace.
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TOOL_LABEL: Record<string, string> = {
  "equation-builder": "Equation Builder", "gems": "GEMS", "combine-like-terms": "Combine Like Terms",
  "balance-beam": "Balance Beam", "area-model": "Area Model",
};

function classroomDate(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function periodTag(name: string): string | null {
  const match = (name || "").match(/([1-7])/);
  return match ? `P${match[1]}` : null;
}

function normalized(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

type EvidenceType = "Live Question" | "Fist to Five" | "Exit Ticket" | "Tool";

interface Activity {
  studentId: string | null;
  student: string;
  period: string | null;
  evidenceType: EvidenceType;
  label: string;
  response: string;
  responseValue: string;
  misconception: string | null;
  responseKey: string;
  prompt: string;
  correct: boolean | null;
  standard: string;
  lessonCode: string;
  sessionId: string;
}

async function collect(): Promise<{ today: string; activities: Activity[] } | { error: string }> {
  const db = getSupabaseAdmin();
  if (!db) return { error: "Database not configured." };
  const today = classroomDate();
  try {
    const [{ data: students }, { data: periods }] = await Promise.all([
      db.from("students").select("id,alias,period_id"),
      db.from("periods").select("id,name"),
    ]);
    const periodName = new Map(((periods || []) as { id: string; name: string }[]).map((period) => [period.id, period.name]));
    const studentInfo = new Map(((students || []) as { id: string; alias: string | null; period_id: string }[]).map((student) => [
      student.id,
      { name: student.alias || "Unnamed student", period: periodTag(periodName.get(student.period_id) || "") },
    ]));
    const since = new Date(Date.now() - 18 * 3600 * 1000).toISOString();
    const activities: Activity[] = [];

    const { data: toolRows } = await db
      .from("responses")
      .select("student_id,score,misconception,item_ref,submitted_at")
      .eq("source", "tool")
      .is("standard_id", null)
      .gte("submitted_at", since)
      .limit(20000);
    const latestTools = new Map<string, Activity>();
    for (const row of (toolRows || []) as { student_id: string; score: number | null; misconception: string | null; item_ref: string | null }[]) {
      const who = studentInfo.get(row.student_id);
      const tool = row.item_ref || "";
      if (!who || !tool) continue;
      const score = row.score != null ? Math.round(Number(row.score) * 10) / 10 : 0;
      const label = TOOL_LABEL[tool] || tool;
      latestTools.set(`${row.student_id}:${tool}`, {
        studentId: row.student_id,
        student: who.name,
        period: who.period,
        evidenceType: "Tool",
        label,
        response: `${label}: scored ${score}/5 across today's problems${row.misconception ? ` — watch: ${row.misconception}` : ""}`,
        responseValue: String(score),
        misconception: row.misconception || null,
        responseKey: `tool:${today}:${row.student_id}:${tool}`,
        prompt: label,
        correct: null,
        standard: "",
        lessonCode: "",
        sessionId: "",
      });
    }
    activities.push(...latestTools.values());

    const { data: polls } = await db
      .from("polls")
      .select("id,session_id,question,kind,lesson_code,standard_id,correct_answer")
      .gte("created_at", since)
      .limit(2000);
    const pollRows = (polls || []) as {
      id: string; session_id: string; question: string; kind: string | null; lesson_code: string | null;
      standard_id: string | null; correct_answer: string | null;
    }[];
    if (pollRows.length) {
      const pollById = new Map(pollRows.map((poll) => [poll.id, poll]));
      const { data: answers } = await db
        .from("poll_answers")
        .select("id,poll_id,student_id,display_name,answer")
        .in("poll_id", pollRows.map((poll) => poll.id))
        .limit(20000);
      for (const answer of (answers || []) as { id: string; poll_id: string; student_id: string | null; display_name: string | null; answer: string | null }[]) {
        const poll = pollById.get(answer.poll_id);
        if (!poll) continue;
        const who = answer.student_id ? studentInfo.get(answer.student_id) : undefined;
        const student = who?.name || answer.display_name?.trim() || "Unknown student";
        const value = answer.answer?.trim() || "No response";
        const correct = poll.correct_answer?.trim()
          ? normalized(value) === normalized(poll.correct_answer)
          : null;
        const evidenceType: EvidenceType = poll.kind === "fist-to-five" ? "Fist to Five" : "Live Question";
        activities.push({
          studentId: answer.student_id,
          student,
          period: who?.period || null,
          evidenceType,
          label: evidenceType,
          response: `${poll.question} — ${value}`,
          responseValue: value,
          misconception: correct === false ? "Incorrect live response" : null,
          responseKey: `poll:${answer.id}`,
          prompt: poll.question,
          correct,
          standard: poll.standard_id || "",
          lessonCode: poll.lesson_code || "",
          sessionId: poll.session_id,
        });
      }
    }

    const { data: tickets } = await db
      .from("exit_tickets")
      .select("id,session_id,lesson_code,prompt")
      .gte("created_at", since)
      .limit(1000);
    const ticketRows = (tickets || []) as { id: string; session_id: string | null; lesson_code: string | null; prompt: string }[];
    if (ticketRows.length) {
      const ticketById = new Map(ticketRows.map((ticket) => [ticket.id, ticket]));
      const { data: answers } = await db
        .from("exit_ticket_responses")
        .select("id,exit_ticket_id,session_id,student_id,display_name,response")
        .in("exit_ticket_id", ticketRows.map((ticket) => ticket.id))
        .limit(20000);
      for (const answer of (answers || []) as { id: string; exit_ticket_id: string; session_id: string | null; student_id: string | null; display_name: string | null; response: string | null }[]) {
        const ticket = ticketById.get(answer.exit_ticket_id);
        if (!ticket) continue;
        const who = answer.student_id ? studentInfo.get(answer.student_id) : undefined;
        const student = who?.name || answer.display_name?.trim() || "Unknown student";
        const value = answer.response?.trim() || "No response";
        activities.push({
          studentId: answer.student_id,
          student,
          period: who?.period || null,
          evidenceType: "Exit Ticket",
          label: "Exit Ticket",
          response: `${ticket.prompt} — ${value}`,
          responseValue: value,
          misconception: null,
          responseKey: `exit:${answer.id}`,
          prompt: ticket.prompt,
          correct: null,
          standard: "",
          lessonCode: ticket.lesson_code || "",
          sessionId: answer.session_id || ticket.session_id || "",
        });
      }
    }

    return { today, activities: activities.sort((a, b) => a.student.localeCompare(b.student) || a.label.localeCompare(b.label)) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Couldn't read today's work." };
  }
}

export async function GET() {
  const result = await collect();
  if ("error" in result) return Response.json({ activities: [], error: result.error });
  return Response.json({ connected: true, today: result.today, activities: result.activities });
}

// The POST that pushed today's student work into Notion is intentionally gone.
export async function POST() {
  return Response.json(
    { error: "Student work may not be pushed to Notion. Export happens in the district Google Workspace." },
    { status: 410 },
  );
}
