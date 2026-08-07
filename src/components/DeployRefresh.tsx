"use client";

// Classroom display surfaces stay open for days, and a projector tab never
// reloads itself when Vercel ships a new build - which is how "the wall is
// missing the feature" happens. On display routes only, poll the deployed
// build id and reload when it changes. Deliberately NEVER active on /ipad:
// the pen surface holds the authoritative ink state, and reloading it would
// wipe the room's boards. Displays are safe to reload - they re-request ink
// state on mount (hello/state resync) and rejoin the session they follow.

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// /teacher/pace (the Support projector) and /weekly-display (the two all-day
// TVs in the back of the room) joined 2026-07-27 - they are the longest-open
// tabs in the building and were silently missing deploys. NEVER add /ipad.
// /teacher/scoreboard joined 2026-08-03: it is opened once on the room panel and
// left there for the period, and it holds no local state a reload could lose -
// every standing it draws is re-read from /api/teacher/scoreboard every 2s.
const DISPLAY_ROUTES = ["/board", "/teacher/present", "/teacher/pace", "/live-flow", "/weekly-display", "/teacher/scoreboard"];
const POLL_MS = 4 * 60 * 1000;

export default function DeployRefresh() {
  const pathname = usePathname();
  // usePathname() is typed string | null (it is null during some prerender
  // passes), so guard before calling startsWith or typecheck fails.
  const active = !!pathname && DISPLAY_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));

  useEffect(() => {
    if (!active) return;
    let baseline: string | null = null;
    let stopped = false;
    const check = async () => {
      try {
        const r = await fetch("/api/build-id", { cache: "no-store" });
        if (!r.ok) return;
        const { id } = await r.json() as { id?: string };
        if (!id || id === "dev" || stopped) return;
        if (baseline === null) {
          baseline = id;
          return;
        }
        if (id !== baseline) {
          // Small random delay so a room of displays does not reload in sync.
          window.setTimeout(() => { if (!stopped) window.location.reload(); }, 3000 + Math.random() * 12000);
        }
      } catch { /* offline moment - try again next tick */ }
    };
    void check();
    const interval = window.setInterval(check, POLL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [active]);

  return null;
}
