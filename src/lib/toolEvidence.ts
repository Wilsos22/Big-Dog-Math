// Manipulative-tool evidence emitter — the tools call reportToolResult() once
// per completed problem, and the day's work flows into the proficiency spine:
//   · ONE aggregate row per (student × tool × day), upserted as they work —
//     score 0-5 accuracy plus the day's most-frequent misconception tag moves
//     the domain mastery bar at warm-up weight and feeds archetype grouping.
//   - A per-problem row when the tool maps to a seeded standard (GEMS to
//     6.EE.A.1, Combine Like Terms to 6.EE.A.3) feeds the per-standard stage
//     gates (excluded from the bars, so no double-counting).
// Only fires when this device has JOINED A LIVE SESSION (localStorage
// bdm-student-session) — free play doesn't write evidence. Fire-and-forget:
// never blocks or breaks the tool.
import { getSupabase } from "@/lib/supabase";
import { SECURE_STUDENT_DATA, studentApiRequest } from "@/lib/studentApi";

export type EvidenceTool = "equation-builder" | "gems" | "combine-like-terms" | "balance-beam" | "area-model" | "distributive-area" | "area-explorer";

const TOOL_DOMAIN: Record<EvidenceTool, string> = {
  "equation-builder": "Algebra and Algebraic Thinking",
  "gems": "Algebra and Algebraic Thinking",
  "combine-like-terms": "Algebra and Algebraic Thinking",
  "balance-beam": "Algebra and Algebraic Thinking",
  "area-model": "Algebra and Algebraic Thinking",
  "distributive-area": "Algebra and Algebraic Thinking",
  "area-explorer": "Geometry",
};

export interface ToolResult {
  tool: EvidenceTool;
  correct: boolean; // solved with zero wrong steps
  standardId?: string; // seeded CCSS code, when the tool maps to one
  misconception?: string | null; // vocabulary tag for the wrong-step pattern
  problemId?: string; // stable id/text of the problem (dedupes re-fires)
}

interface Tally { a: number; c: number; tags: Record<string, number> }

function readSession(): { sessionId: string; studentId: string } | null {
  try {
    const raw = localStorage.getItem("bdm-student-session");
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s && s.sessionId && s.studentId ? s : null;
  } catch { return null; }
}

/**
 * The session as stored, verified or not. A PROVISIONAL session - class code
 * entered, warm-up not yet submitted - has an empty studentId. That state is
 * common, not exceptional: a late arrival, a student who opens the Google Form
 * and never presses submit, an Apps Script hiccup. Their work still has to be
 * captured, so it buffers here and lands the moment they verify.
 */
function readAnySession(): { sessionId: string; studentId: string } | null {
  try {
    const raw = localStorage.getItem("bdm-student-session");
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s && s.sessionId ? { sessionId: s.sessionId, studentId: s.studentId || "" } : null;
  } catch { return null; }
}

type PendingToolResult = ToolResult & { sessionId: string; at: string };

function pendingKey(sessionId: string) {
  return `bdm-tool-pending:${sessionId}`;
}

function readPending(sessionId: string): PendingToolResult[] {
  try {
    const raw = localStorage.getItem(pendingKey(sessionId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed as PendingToolResult[] : [];
  } catch { return []; }
}

// Bounded so a runaway tool cannot fill a Chromebook's storage quota. A single
// student cannot legitimately produce this many results in one period.
const MAX_PENDING = 300;

function bufferPending(sessionId: string, r: ToolResult): void {
  try {
    const queue = readPending(sessionId);
    queue.push({ ...r, sessionId, at: new Date().toISOString() });
    localStorage.setItem(pendingKey(sessionId), JSON.stringify(queue.slice(-MAX_PENDING)));
  } catch { /* storage full or private mode - the tally still holds the counts */ }
}

/**
 * Post everything this device buffered while it was unverified, then clear it.
 * Called the instant `saveVerifiedStudentJoin` completes, so a student who
 * submits the warm-up at minute 40 still gets the whole period's tool work
 * filed against them. Nothing unattributed is ever written: if they never
 * verify, the buffer simply stays on the device.
 */
export async function flushPendingToolResults(): Promise<number> {
  if (!SECURE_STUDENT_DATA) return 0;
  const session = readSession();
  if (!session) return 0;
  const queue = readPending(session.sessionId);
  if (!queue.length) return 0;
  const date = new Date().toISOString().slice(0, 10);
  let sent = 0;
  for (const entry of queue) {
    const tally = readTally(session.sessionId, entry.tool, date);
    try {
      await studentApiRequest("/api/student/tool-evidence", {
        method: "POST",
        body: JSON.stringify({
          sessionId: session.sessionId,
          tool: entry.tool,
          correct: entry.correct,
          standardId: entry.standardId,
          misconception: entry.misconception,
          problemId: entry.problemId,
          dayAttempts: tally.a,
          dayCorrect: tally.c,
          dayTopMisconception: topMisconception(tally),
        }),
      });
      sent += 1;
    } catch {
      // Keep whatever did not send; the next verification or reload retries.
      const remaining = queue.slice(queue.indexOf(entry));
      try { localStorage.setItem(pendingKey(session.sessionId), JSON.stringify(remaining)); } catch { /* ignore */ }
      return sent;
    }
  }
  try { localStorage.removeItem(pendingKey(session.sessionId)); } catch { /* ignore */ }
  return sent;
}

// Tally is keyed by SESSION, not student. Keying it by studentId meant a student
// who verified mid-lesson started a brand new tally and silently discarded every
// attempt they had made before submitting the warm-up.
function tallyKeyFor(sessionId: string, tool: string, date: string) {
  return `bdm-tooltally:${tool}:${sessionId}:${date}`;
}

function readTally(sessionId: string, tool: string, date: string): Tally {
  try {
    return JSON.parse(localStorage.getItem(tallyKeyFor(sessionId, tool, date)) || "") || { a: 0, c: 0, tags: {} };
  } catch { return { a: 0, c: 0, tags: {} }; }
}

function topMisconception(tally: Tally): string | null {
  return Object.keys(tally.tags).sort((a, b) => tally.tags[b] - tally.tags[a])[0] || null;
}

export function reportToolResult(r: ToolResult): void {
  try {
    const session = readAnySession();
    const supabase = getSupabase();
    if (!session) return;
    // Do NOT require the browser Supabase client on the secure path - it posts
    // through /api/student/tool-evidence and never touches `supabase`. Gating on
    // it meant a deployment where getSupabase() returns null silently recorded
    // ZERO tool evidence: students used the manipulative for a whole lesson and
    // nothing reached the proficiency spine. Same defect shape as the live_flow
    // publish guard in /control.
    if (!SECURE_STUDENT_DATA && !supabase) return;

    // The running day tally lives on the device in BOTH modes - it is what
    // turns per-problem results into the ONE aggregate row per (student x
    // tool x day) that actually moves the mastery bar and feeds the City
    // Routes tie-breaker.
    const date = new Date().toISOString().slice(0, 10);
    const tallyKey = tallyKeyFor(session.sessionId, r.tool, date);
    const tally: Tally = readTally(session.sessionId, r.tool, date);
    tally.a += 1;
    if (r.correct) tally.c += 1;
    if (r.misconception) tally.tags[r.misconception] = (tally.tags[r.misconception] || 0) + 1;
    try { localStorage.setItem(tallyKey, JSON.stringify(tally)); } catch { /* ignore */ }

    const topTag = topMisconception(tally);
    const now = new Date().toISOString();

    // Unverified device: the tally above already counted this attempt, so the
    // work is not lost - buffer the payload and let verification file it.
    if (!session.studentId) {
      bufferPending(session.sessionId, r);
      return;
    }

    if (SECURE_STUDENT_DATA) {
      void studentApiRequest("/api/student/tool-evidence", {
        method: "POST",
        body: JSON.stringify({
          sessionId: session.sessionId,
          tool: r.tool,
          correct: r.correct,
          standardId: r.standardId,
          misconception: r.misconception,
          problemId: r.problemId,
          // Day-tally for the server-side aggregate row (launch-audit fix:
          // without it the secure path wrote only score-null rows, the
          // tie-breaker never fired, and bars mis-weighted tool work).
          dayAttempts: tally.a,
          dayCorrect: tally.c,
          dayTopMisconception: topTag,
        }),
      }).catch(() => undefined);
      return;
    }

    // Legacy direct-write path. Unreachable when SECURE_STUDENT_DATA is on, and
    // the guard above already returned if the client is missing.
    if (!supabase) return;
    // Aggregate row (updates in place all period long).
    void supabase.from("responses").upsert({
      student_id: session.studentId,
      session_id: session.sessionId,
      problem_id: null,
      source: "tool",
      domain: TOOL_DOMAIN[r.tool],
      standard_id: null,
      score: Math.round((5 * tally.c / tally.a) * 100) / 100,
      is_correct: null,
      misconception: topTag,
      item_ref: r.tool,
      dedupe_key: `tool:${r.tool}:agg:${session.studentId}:${date}`,
      graded_by: "tool",
      submitted_at: now,
    }, { onConflict: "dedupe_key" }).then(({ error }) => {
      if (error) console.debug("tool evidence (agg):", error.message);
    });

    // Per-problem stage evidence, only when a seeded standard applies.
    if (r.standardId) {
      const pid = r.problemId || `${Date.now()}`;
      void supabase.from("responses").upsert({
        student_id: session.studentId,
        session_id: session.sessionId,
        problem_id: null,
        source: "tool",
        domain: TOOL_DOMAIN[r.tool],
        standard_id: r.standardId,
        score: null,
        is_correct: r.correct,
        misconception: r.misconception || null,
        item_ref: `${r.tool}:${pid}`,
        dedupe_key: `tool:${r.tool}:q:${session.studentId}:${date}:${pid}`,
        graded_by: "tool",
        submitted_at: now,
      }, { onConflict: "dedupe_key", ignoreDuplicates: true }).then(({ error }) => {
        if (error) console.debug("tool evidence (q):", error.message);
      });
    }
  } catch { /* evidence must never break the tool */ }
}
