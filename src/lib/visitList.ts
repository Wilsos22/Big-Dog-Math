/**
 * The ranked visit list - who the teacher walks to, in order, during the
 * release block.
 *
 * This replaced named work stations with staged movement. Nobody moves; the
 * list lives on the teacher iPad and CLEARS as each student is checked in, so
 * what is left on screen is always who has not been reached yet.
 *
 * The single most valuable output is not the ranking. It is that at minute 46
 * the teacher knows WHO THEY NEVER REACHED, which no seating chart can tell
 * them.
 *
 * Three rules here are not obvious and are the whole point:
 *
 *  1. Tier 2 groups BY THE ERROR, not by student. Nine students with the same
 *     misconception is one stop with one sentence, not nine visits.
 *  2. When one error holds more than RETEACH_SHARE of the class, the list says
 *     STOP AND RETEACH instead of handing over sixteen names. Routing is
 *     sometimes the wrong answer and the list has to be willing to say so.
 *  3. Splitting the harder factor is CORRECT, just slower. 8 x 12 cut as
 *     (4 + 4) x 12 = 48 + 48 = 96 is a student who understands the property
 *     completely, and they must never appear as tier 1. The move is "that
 *     works, now find the faster route" - which is tier 4, leave alone.
 *
 * PRIVACY: nothing in here may reach a student device or a public projector.
 * No student ever sees their own tier, another student's status, a group name,
 * or a count. This module is consumed only by teacher-gated surfaces; do not
 * widen studentSafeLiveFlow to carry any of it.
 *
 * No imports on purpose - compiled in isolation by
 * `npm run test:visit-list`, like mastery.ts and grouping.ts.
 */

export type VisitTier = 1 | 2 | 3 | 4;

export type VisitCheckInStatus = "got-it" | "partly" | "still-stuck";

export const VISIT_TIER_LABELS: Record<VisitTier, string> = {
  1: "Call",
  2: "Visit",
  3: "Check",
  4: "None",
};

/** Above this share of the class sharing one error, reteach beats routing. */
export const RETEACH_SHARE = 0.4;

export type VisitStudent = {
  studentKey: string;
  name: string;
  /** One entry per readiness check: true correct, false wrong, null no answer. */
  correct: (boolean | null)[];
  /** Private Fist-to-Five 0-5, or null when not submitted. */
  fist: number | null;
  /**
   * The named error, when one was diagnosed - the structured-numeric phrase or
   * a misconception tag. Null means wrong but unnamed.
   */
  error?: string | null;
  /**
   * True when the student reached a correct answer by a slower-but-valid
   * route, e.g. splitting the harder factor. Never a call: they understand it.
   */
  slowerButCorrect?: boolean;
  /**
   * True when EVERY miss was arithmetic - the decomposition was right and only
   * the total was off. The concept is intact, so this can never be a tier 1
   * call however many questions it touched. This is the distinction multiple
   * choice could not make, and the reason the response kind changed.
   */
  conceptIntact?: boolean;
  /** Latest check-in, when the teacher has already reached them. */
  checkIn?: { status: VisitCheckInStatus; at: string } | null;
};

export type VisitRow = {
  /** Stable id: the error for a grouped row, else the student key. */
  id: string;
  tier: VisitTier;
  tierLabel: string;
  /** What the teacher reads while walking. */
  headline: string;
  /** The opening sentence for this stop, when the error is named. */
  error: string | null;
  students: { studentKey: string; name: string }[];
  /** True when several students collapsed into this one stop. */
  grouped: boolean;
};

export type VisitList = {
  /** Not yet checked in, most urgent first. This is the walking order. */
  rows: VisitRow[];
  /** Already reached, so the teacher can see what is done. */
  cleared: { studentKey: string; name: string; status: VisitCheckInStatus; at: string }[];
  /** Nobody needs a visit: correct and confident. */
  leaveAlone: { studentKey: string; name: string }[];
  /** How many students still have not been reached at all. */
  unreached: number;
  /**
   * Set when one error holds more than RETEACH_SHARE of the class. The list
   * should show this INSTEAD of a walking order.
   */
  reteach: { error: string; count: number; total: number } | null;
};

function tierFor(student: VisitStudent): VisitTier {
  const answered = student.correct.filter((value) => value !== null);
  const wrong = answered.filter((value) => value === false).length;

  // A correct answer reached the slow way is still a correct answer. This
  // student understands the property; do not put them at the top of the list.
  if (student.slowerButCorrect && wrong === 0) return 4;

  if (!answered.length) return 2;
  // Arithmetic slips never escalate to a call, no matter how many. Sending a
  // student who understands the property to the table teaches them nothing and
  // costs a seat someone else needed.
  if (wrong > 0 && student.conceptIntact) return 3;
  if (wrong >= 2) return 1;
  if (wrong === 1) return 2;
  // Both correct: the only question left is whether they believe it.
  return student.fist !== null && student.fist <= 2 ? 3 : 4;
}

function headlineFor(tier: VisitTier, error: string | null, count: number): string {
  if (tier === 1) {
    return error ? `Pull to the table - ${error}` : "Pull to the table - both checks wrong";
  }
  if (tier === 2) {
    const stop = error ? `One sentence: ${error}` : "One check wrong - name the step they skipped";
    return count > 1 ? `${stop} (${count} students, one stop)` : stop;
  }
  if (tier === 3) return "Correct but does not believe it - ask them to explain one line";
  return "Leave alone";
}

/**
 * Build the walking order.
 *
 * Students who have already been checked in drop out of `rows` entirely, so
 * the screen always answers "who have I not reached yet".
 */
export function buildVisitList(students: readonly VisitStudent[]): VisitList {
  const cleared: VisitList["cleared"] = [];
  const leaveAlone: VisitList["leaveAlone"] = [];
  const pending: { student: VisitStudent; tier: VisitTier }[] = [];

  for (const student of students) {
    if (student.checkIn) {
      cleared.push({
        studentKey: student.studentKey,
        name: student.name,
        status: student.checkIn.status,
        at: student.checkIn.at,
      });
      continue;
    }
    const tier = tierFor(student);
    if (tier === 4) {
      leaveAlone.push({ studentKey: student.studentKey, name: student.name });
      continue;
    }
    pending.push({ student, tier });
  }

  // Tier 2 collapses by error. Tier 1 and 3 stay per-student: a call is a
  // conversation with one student, and a confidence check is personal.
  const rows: VisitRow[] = [];
  const groupedTwo = new Map<string, VisitRow>();
  for (const { student, tier } of pending) {
    const error = student.error?.trim() || null;
    const entry = { studentKey: student.studentKey, name: student.name };
    if (tier === 2 && error) {
      const existing = groupedTwo.get(error);
      if (existing) {
        existing.students.push(entry);
        existing.grouped = true;
        continue;
      }
      const row: VisitRow = {
        id: `error:${error}`,
        tier,
        tierLabel: VISIT_TIER_LABELS[tier],
        headline: "",
        error,
        students: [entry],
        grouped: false,
      };
      groupedTwo.set(error, row);
      rows.push(row);
      continue;
    }
    rows.push({
      id: student.studentKey,
      tier,
      tierLabel: VISIT_TIER_LABELS[tier],
      headline: headlineFor(tier, error, 1),
      error,
      students: [entry],
      grouped: false,
    });
  }

  // Grouped rows only know their size once every student is placed.
  for (const row of groupedTwo.values()) {
    row.headline = headlineFor(row.tier, row.error, row.students.length);
  }

  // Most urgent first, then the biggest stop, then alphabetical so the order
  // is stable between polls and the teacher's place on screen does not jump.
  rows.sort((a, b) =>
    a.tier - b.tier
    || b.students.length - a.students.length
    || a.students[0].name.localeCompare(b.students[0].name));

  // Does one error hold enough of the class that walking it is the wrong move?
  const errorCounts = new Map<string, number>();
  for (const { student } of pending) {
    const error = student.error?.trim();
    if (error) errorCounts.set(error, (errorCounts.get(error) || 0) + 1);
  }
  let reteach: VisitList["reteach"] = null;
  const total = students.length;
  for (const [error, count] of errorCounts) {
    if (total && count / total > RETEACH_SHARE && (!reteach || count > reteach.count)) {
      reteach = { error, count, total };
    }
  }

  return {
    rows,
    cleared,
    leaveAlone,
    unreached: rows.reduce((count, row) => count + row.students.length, 0),
    reteach,
  };
}
