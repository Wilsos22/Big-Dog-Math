// The bell schedule for the all-day boards (/weekly-display).
//
// These are Steele's REAL 2026-27 times, read off the district roster export
// (the `Period` column carries them, e.g. "01 07:30AM-08:23AM(1, I)") and
// confirmed by him on 2026-07-29: lunch sits between period 4 and period 5, and
// he does not teach a period 6. The day ends at 1:41.
//
// Two things the district data also contains that this deliberately does NOT
// model: the exam-week blocks (the E1/E2/E3 variants, ~105-minute periods) and
// the alternate "I" bell (period 4 ends 11:10 and period 5 runs 11:10-12:44
// with lunch inside it). The board renders the REGULAR day only, so on a finals
// day or an alternate bell the Now row will be wrong - it is a display, not the
// master schedule, and a second variant needs a way to say which day it is.
//
// Times are stored as minutes since midnight so nothing has to parse a clock
// string twice, and so "what is happening right now" is plain arithmetic.

export type BellKind = "Class" | "Break" | "Prep";

export interface BellPeriod {
  label: string;
  startMinute: number;
  endMinute: number;
  kind: BellKind;
  /** The school's own period number. Absent for lunch. */
  period?: number;
}

function at(hour: number, minute: number): number {
  return hour * 60 + minute;
}

export const BELL_SCHEDULE: BellPeriod[] = [
  { period: 1, label: "Math 6", startMinute: at(7, 30), endMinute: at(8, 23), kind: "Class" },
  { period: 2, label: "Math 6", startMinute: at(8, 27), endMinute: at(9, 17), kind: "Class" },
  { period: 3, label: "Math 6", startMinute: at(9, 21), endMinute: at(10, 11), kind: "Class" },
  { period: 4, label: "Math Acc 6", startMinute: at(10, 15), endMinute: at(11, 17), kind: "Class" },
  { label: "Lunch", startMinute: at(11, 17), endMinute: at(11, 54), kind: "Break" },
  { period: 5, label: "Math 6", startMinute: at(11, 54), endMinute: at(12, 44), kind: "Class" },
  // Steele does not teach period 6. It stays on the board because the board runs
  // all day and the school day does not end at 12:44 - a schedule that stopped
  // there would read as broken.
  { period: 6, label: "Prep", startMinute: at(12, 48), endMinute: at(13, 41), kind: "Prep" },
];

export interface BellRowState {
  label: string;
  kind: BellKind;
  /** The school's period number, zero-padded; "" for lunch. */
  periodLabel: string;
  timeLabel: string;
  minutesLabel: string;
  now: boolean;
  past: boolean;
  /** 0 to 1. A finished block reads full, a block still ahead reads empty. */
  progress: number;
}

/** 450 -> "7:30", 764 -> "12:44", 821 -> "1:41". No meridiem: the board shows a range. */
export function formatBellClock(minute: number): string {
  const hour24 = Math.floor(minute / 60) % 24;
  const hour = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour}:${String(minute % 60).padStart(2, "0")}`;
}

export function bellRowStates(nowMinute: number | null, periods: BellPeriod[] = BELL_SCHEDULE): BellRowState[] {
  return periods.map((period) => {
    const span = Math.max(1, period.endMinute - period.startMinute);
    const isNow = nowMinute !== null && nowMinute >= period.startMinute && nowMinute < period.endMinute;
    const isPast = nowMinute !== null && nowMinute >= period.endMinute;
    return {
      label: period.label,
      kind: period.kind,
      periodLabel: period.period === undefined ? "" : String(period.period).padStart(2, "0"),
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
