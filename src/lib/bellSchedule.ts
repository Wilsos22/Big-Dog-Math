// The bell schedule for the all-day boards (/weekly-display).
//
// These rows came in with the Claude Design "Weekly Display" board and match
// the 7:30 AM start and 1:41 PM end the surface already carried. The period
// LABELS are the part to check against the real master schedule before the
// boards go up in front of a room - a wrong period name on a TV that runs all
// day is worse than no bell screen at all.
//
// Times are stored as minutes since midnight so nothing has to parse a clock
// string twice, and so "what is happening right now" is plain arithmetic.

export type BellKind = "Class" | "Break" | "Prep";

export interface BellPeriod {
  label: string;
  startMinute: number;
  endMinute: number;
  kind: BellKind;
}

function at(hour: number, minute: number): number {
  return hour * 60 + minute;
}

export const BELL_SCHEDULE: BellPeriod[] = [
  { label: "Math 6 - Core", startMinute: at(7, 30), endMinute: at(8, 22), kind: "Class" },
  { label: "Math 6 - Core", startMinute: at(8, 26), endMinute: at(9, 18), kind: "Class" },
  { label: "Math 6 - Support", startMinute: at(9, 22), endMinute: at(10, 14), kind: "Class" },
  { label: "Lunch", startMinute: at(10, 14), endMinute: at(10, 44), kind: "Break" },
  { label: "Planning", startMinute: at(10, 48), endMinute: at(11, 40), kind: "Prep" },
  { label: "Math 6 - Core", startMinute: at(11, 44), endMinute: at(12, 36), kind: "Class" },
  { label: "Math 6 - Honors", startMinute: at(12, 40), endMinute: at(13, 41), kind: "Class" },
];

export interface BellRowState {
  label: string;
  kind: BellKind;
  /** Sequential period number over the teaching blocks only; "" for a break or prep. */
  periodLabel: string;
  timeLabel: string;
  minutesLabel: string;
  now: boolean;
  past: boolean;
  /** 0 to 1. A finished block reads full, a block still ahead reads empty. */
  progress: number;
}

/** 450 -> "7:30", 760 -> "12:40", 821 -> "1:41". No meridiem: the board shows a range. */
export function formatBellClock(minute: number): string {
  const hour24 = Math.floor(minute / 60) % 24;
  const hour = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour}:${String(minute % 60).padStart(2, "0")}`;
}

export function bellRowStates(nowMinute: number | null, periods: BellPeriod[] = BELL_SCHEDULE): BellRowState[] {
  let teachingBlock = 0;
  return periods.map((period) => {
    const span = Math.max(1, period.endMinute - period.startMinute);
    if (period.kind === "Class") teachingBlock += 1;
    const isNow = nowMinute !== null && nowMinute >= period.startMinute && nowMinute < period.endMinute;
    const isPast = nowMinute !== null && nowMinute >= period.endMinute;
    return {
      label: period.label,
      kind: period.kind,
      periodLabel: period.kind === "Class" ? String(teachingBlock).padStart(2, "0") : "",
      timeLabel: `${formatBellClock(period.startMinute)} - ${formatBellClock(period.endMinute)}`,
      minutesLabel: `${period.endMinute - period.startMinute} min`,
      now: isNow,
      past: isPast,
      progress: isNow ? Math.min(1, Math.max(0, (nowMinute - period.startMinute) / span)) : isPast ? 1 : 0,
    };
  });
}

/**
 * Minutes since midnight in a named zone. The boards hang in one room, so the
 * browser clock is normally right - but reading the zone explicitly keeps the
 * "Now" row honest on a laptop that has travelled, the same reason
 * /api/weekly-display resolves today in America/Los_Angeles rather than UTC.
 */
export function minutesInZone(date: Date, timeZone: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const hour = Number(values.hour);
    const minute = Number(values.minute);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    return (hour % 24) * 60 + minute;
  } catch {
    return null;
  }
}
