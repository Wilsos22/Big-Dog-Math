// When a live_flow write is worth waking every screen for.
//
// Pure module: imported by API routes AND by browser surfaces, so it must not
// reach for Supabase, the DOM, or anything server-only.
//
// The classroom surfaces poll on a clock - the projectors every 1.5s, the
// Chromebooks every 2s behind a 2.8s shared cache - which puts the wall about a
// second behind the teacher's tap and the student screens two to three. Polling
// harder is the wrong lever on the student side: four consumers on their own
// clocks already caused a per-device request storm once (see
// studentSessionShared.ts), and cutting intervals multiplies by the whole class.
//
// So the server PINGS instead. Every surface keeps its poll as the safety net
// and additionally re-reads the moment a ping arrives, which turns a screen
// change from "up to 3 seconds" into "about 200ms". A dropped ping costs
// nothing: the next poll catches it, exactly as today.
//
// THE PING MUST BE RARE. /control republishes the snapshot about once a second
// while a timer runs, and a ping per write would have thirty Chromebooks
// re-fetching every second - the storm this is meant to avoid, arrived by
// another road. Only a change a screen would actually SHOW may ping, so the
// revision below deliberately ignores the two fields that tick.

// Deliberately structural, and deliberately NOT importing LiveClassFlowSnapshot
// from liveClassFlow: that module resolves its own imports through the "@/"
// alias, and this one is compiled in isolation by its contract test (the same
// constraint the mastery and grouping engines carry). The revision only reads
// keys generically, so a shape is all it needs.
// `object`, not Record<string, unknown>: LiveClassFlowSnapshot is an interface
// with no index signature, so a Record would reject the very type it is for.
type ScreenFlow = object;

/** The broadcast room a session's screens listen on. */
export function liveFlowChannelTopic(sessionId: string): string {
  return `flow-${sessionId}`;
}

/** The broadcast event name carried on that room. */
export const LIVE_FLOW_PING_EVENT = "flow";

// `updatedAt` is stamped on every write and `timer.secondsLeft` counts down once
// a second; every surface already derives its own countdown from `timer.endsAt`,
// so neither is a reason to wake the room. `transition` is the Remote's claim
// marker - it is set and cleared around a single action that pings on its own.
const IGNORED_TOP_LEVEL = new Set(["updatedAt", "transition"]);

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

/**
 * A stable fingerprint of everything about a lesson snapshot that a classroom
 * screen renders. Two snapshots with the same revision look identical on every
 * surface, so there is nothing to wake anyone up for.
 *
 * Sorted keys on purpose: /control and /api/control-remote build their snapshots
 * independently, and comparing raw JSON would call every handover a change.
 */
export function liveFlowScreenRevision(flow: ScreenFlow | null | undefined): string {
  if (!flow) return "";
  const projected: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flow)) {
    if (IGNORED_TOP_LEVEL.has(key)) continue;
    if (key === "timer" && value && typeof value === "object") {
      const { secondsLeft: _ticking, ...rest } = value as Record<string, unknown>;
      projected[key] = rest;
      continue;
    }
    projected[key] = value;
  }
  return stableStringify(projected);
}

/** Did this write change anything a projector or a Chromebook would show? */
export function liveFlowScreensChanged(
  previous: ScreenFlow | null | undefined,
  next: ScreenFlow | null | undefined,
): boolean {
  return liveFlowScreenRevision(previous) !== liveFlowScreenRevision(next);
}
