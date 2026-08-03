// Table captains and the closeout supply check - shared vocabulary.
//
// The room has a fixed set of tables. Each table gets one captain for the week,
// spun on Monday, and that captain is the single person who reports at closeout
// whether the table has everything it left with. The teacher taps the table
// green or red on the iPad; the streak of reds is what decides whether a table
// keeps its website privilege.
//
// STEELE'S RULE, and the reason `standingFromStreak` is here rather than
// scattered through the UI: CONSECUTIVE misses. Two reds in a row flags a
// table. Any green wipes the streak entirely. One bad day is a bad day; two in
// a row is a pattern, and a pattern is the thing worth acting on.
//
// FERPA: a captain is stored and transmitted as an ALIAS, exactly like the
// reader spinner. First names are resolved at render only, in the browser that
// holds the teacher name key (see src/lib/teacherNameKey.ts). Nothing in this
// module may resolve a name, and nothing under src/app/api may import
// teacherNameKey.

/** Tables in the room. Seating from the roster Sheet can raise this. */
export const DEFAULT_TABLE_COUNT = 10;

/** Reds in a row before a table is flagged for the privilege conversation. */
export const RED_STREAK_LIMIT = 2;

export type SupplyStatus = "green" | "red";

export type TableStanding = "clear" | "warning" | "flagged";

export interface TableCaptain {
  tableNumber: number;
  studentId: string | null;
  /** Pseudonymous. Never a real name - see the module note. */
  alias: string;
}

export interface SupplyCheckEntry {
  tableNumber: number;
  status: SupplyStatus | null;
  missing?: string | null;
}

export interface TableStreak {
  tableNumber: number;
  redStreak: number;
  redTotal: number;
  checksTotal: number;
  lastChecked: string | null;
}

/**
 * Clear until a table misses, warning on the first miss, flagged on the second
 * consecutive miss. The warning tier exists so the captain hears "one more and
 * your table is off the site" BEFORE it happens rather than after.
 */
export function standingFromStreak(redStreak: number): TableStanding {
  if (redStreak >= RED_STREAK_LIMIT) return "flagged";
  if (redStreak > 0) return "warning";
  return "clear";
}

export const STANDING_LABELS: Record<TableStanding, string> = {
  clear: "Clear",
  warning: "One away",
  flagged: "Privilege paused",
};

const SCHOOL_TIME_ZONE = "America/Los_Angeles";

/**
 * The teaching day as YYYY-MM-DD in the school's timezone. Everything about
 * this feature is keyed to the school day, never to UTC - a 4pm PT closeout tap
 * is already tomorrow in UTC and would silently break every streak.
 */
export function schoolDateKey(value: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SCHOOL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const lookup = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${lookup("year")}-${lookup("month")}-${lookup("day")}`;
}

/**
 * The Monday of the week containing `dateKey`. A captaincy covers a week, so a
 * Thursday re-spin has to land on the same row Monday's spin created rather
 * than opening a second week.
 */
export function weekStartKey(dateKey: string = schoolDateKey()): string {
  const [year, month, day] = dateKey.split("-").map((part) => Number.parseInt(part, 10));
  if (!year || !month || !day) return dateKey;
  // Noon UTC keeps the arithmetic clear of every DST edge.
  const anchor = new Date(Date.UTC(year, month - 1, day, 12));
  const weekday = anchor.getUTCDay();
  const backToMonday = weekday === 0 ? 6 : weekday - 1;
  anchor.setUTCDate(anchor.getUTCDate() - backToMonday);
  return anchor.toISOString().slice(0, 10);
}

/** True when the school day is a Monday - when the captain spin is due. */
export function isCaptainSpinDay(dateKey: string = schoolDateKey()): boolean {
  return weekStartKey(dateKey) === dateKey;
}

export function tableLabel(tableNumber: number): string {
  return `Table ${tableNumber}`;
}

/** Normalise a table number off the wire. Returns 0 when it is not usable. */
export function tableNumberOf(value: unknown, tableCount = DEFAULT_TABLE_COUNT): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return 0;
  const rounded = Math.trunc(parsed);
  return rounded >= 1 && rounded <= Math.max(tableCount, DEFAULT_TABLE_COUNT) ? rounded : 0;
}

export function isSupplyStatus(value: unknown): value is SupplyStatus {
  return value === "green" || value === "red";
}
