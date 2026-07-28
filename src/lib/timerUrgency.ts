// Visual countdown warning.
//
// Steele, 2026-07-28: students were startled every time a state ended, because
// the sound was the FIRST signal anything was about to change. They need time to
// anticipate. So the screens escalate before the clock runs out.
//
// The escalation is gradual on purpose. A hard flash appearing out of nowhere at
// 0:30 is the same startle problem wearing a different hat - it has to read as
// "wrap up", then "finish the sentence", then "now".
//
//   > 30s  calm    normal ink, no motion
//   <= 30s warn    amber, still no motion - the "start wrapping up" beat
//   <= 15s urgent  coral, slow pulse
//   <= 5s  final   coral, pulse on the digit change
//
// Two hard constraints, both classroom-driven: the animation touches opacity and
// color ONLY, never layout, because a projector that reflows mid-class pulls
// thirty pairs of eyes off the mathematics; and it must read at 25 feet.

export type TimerUrgency = "calm" | "warn" | "urgent" | "final";

export const TIMER_WARN_SECONDS = 30;
export const TIMER_URGENT_SECONDS = 15;
export const TIMER_FINAL_SECONDS = 5;

export function timerUrgency(
  secondsLeft: number | null | undefined,
  options?: { running?: boolean; finished?: boolean },
): TimerUrgency {
  if (options?.finished) return "final";
  if (options?.running === false) return "calm";
  const seconds = Number(secondsLeft);
  if (!Number.isFinite(seconds) || seconds <= 0) return "calm";
  if (seconds <= TIMER_FINAL_SECONDS) return "final";
  if (seconds <= TIMER_URGENT_SECONDS) return "urgent";
  if (seconds <= TIMER_WARN_SECONDS) return "warn";
  return "calm";
}

/** Class suffix for styling, e.g. `bdb-urgency-warn`. */
export function timerUrgencyClass(urgency: TimerUrgency): string {
  return `bdb-urgency-${urgency}`;
}

/**
 * One shared stylesheet for every surface that shows a class clock. Injected as
 * a plain string so each page keeps its own inline <style> convention and its
 * own class prefix, per the Warm Notebook page-styling rule.
 *
 * `prefers-reduced-motion` drops the pulse but KEEPS the colour shift - the
 * warning must survive for a student who has motion reduced.
 */
export const TIMER_URGENCY_CSS = `
.bdb-urgency-warn { color: var(--bdb-amber, #fcaf38); }
.bdb-urgency-urgent,
.bdb-urgency-final { color: var(--bdb-coral, #f95335); }
.bdb-urgency-urgent { animation: bdb-timer-pulse 1s ease-in-out infinite; }
.bdb-urgency-final { animation: bdb-timer-pulse 0.5s ease-in-out infinite; }
@keyframes bdb-timer-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}
@media (prefers-reduced-motion: reduce) {
  .bdb-urgency-urgent,
  .bdb-urgency-final { animation: none; }
}
`;
