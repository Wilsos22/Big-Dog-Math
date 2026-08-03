// Pure, framework-free sizing + formatting for the Direction Screen - the native auto-default
// "do this now / today's plan" projector frame composed from a Notion Lesson Step. No React or DOM
// here on purpose, so the numbers are unit-testable and a contract test can pin them; the renderer
// lives in components/screen/DirectionScreen.tsx and the live values (clock, urgency, accent) come
// from the running flow, never from this file.
//
// Source of truth for the two hand-picked headline sizes is the Claude Design "Direction Screen"
// export: a ~6-word direction at 112px, a ~20-word direction at 92px. The floor (72px) is the
// back-of-room legibility line the weekly-display board is built on - roughly D/200 cap height at
// ~25ft. The renderer may shrink from the BASE size below to fit the box, but never below the floor.

export const DIRECTION_FONT_MAX = 112;
export const DIRECTION_FONT_FLOOR = 72;

/**
 * Deterministic base font size (px) for the direction headline, chosen by character length. The
 * renderer starts here and can shrink to fit the fixed stage; this guarantees a legible size with
 * no measurement, so it is correct under SSR and in a throttled preview pane.
 */
export function directionFontSize(text: string): number {
  const len = String(text || "").trim().length;
  if (len <= 40) return 112; // ~6 words: "Solve problems 1-4 on your own." (design: 112)
  if (len <= 70) return 100;
  if (len <= 110) return 92; // ~20 words (design: 92)
  if (len <= 160) return 82;
  return DIRECTION_FONT_FLOOR; // 72 - legibility floor; the renderer wraps/clamps beyond this
}

/**
 * Numbered "Today's plan" steps are fewer and larger than a paragraph. Size by count so three steps
 * read big and a fuller plan still clears the fixed 1080 stage.
 */
export function planStepFontSize(count: number): number {
  const n = Math.max(1, Math.floor(Number(count) || 1));
  if (n <= 3) return 72;
  if (n === 4) return 60;
  if (n === 5) return 52;
  return 46;
}

/** Seconds -> "m:ss". Negative / NaN clamp to "0:00". */
export function formatClock(secondsLeft: number | null | undefined): string {
  const total = Math.max(0, Math.floor(Number(secondsLeft) || 0));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * "Part N of M" for the step counter. N is 1-based (a live caller passes currentIndex + 1). Returns
 * "" when there is no honest position to show, so the counter simply drops rather than reading
 * "Part 0 of 0".
 */
export function stepLabel(part: number | null | undefined, total: number | null | undefined): string {
  const n = Number(part);
  const m = Number(total);
  if (!Number.isFinite(n) || !Number.isFinite(m) || m <= 0 || n <= 0) return "";
  return `Part ${Math.min(n, m)} of ${m}`;
}

/** Split an authored plan blob (one step per line) into trimmed, non-empty steps. */
export function planSteps(raw: string): string[] {
  return String(raw || "")
    .split("\n")
    .map((line) => line.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean);
}
