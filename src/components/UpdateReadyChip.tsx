"use client";

// "It still doesn't work" - because the iPad was running yesterday's code.
//
// Every display route reloads itself on a new deploy (DeployRefresh). /ipad
// deliberately does NOT, and must not: it holds the authoritative ink state, so
// an automatic reload would wipe the room's boards mid-lesson. The cost of that
// correct decision is that the pen surface can sit on a build from days ago with
// NOTHING ON SCREEN SAYING SO - the pen still draws, the dot still reads
// connected, and the only symptom is that a fix you shipped is not there.
//
// That is the same class of failure as a silent catch in a polling loop: the
// broken state and the working state look identical. So the surface says it, and
// the teacher decides when. One tap, when the board is clear - never on its own.

import { useEffect, useState } from "react";

const POLL_MS = 2 * 60 * 1000;

export default function UpdateReadyChip() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let baseline: string | null = null;
    let stopped = false;
    const check = async () => {
      try {
        const r = await fetch("/api/build-id", { cache: "no-store" });
        if (!r.ok) return;
        const { id } = await r.json() as { id?: string };
        // "dev" is the local server, where every edit would otherwise nag.
        if (!id || id === "dev" || stopped) return;
        if (baseline === null) {
          baseline = id;
          return;
        }
        if (id !== baseline) setReady(true);
      } catch {
        // Offline moment. Try again next tick; never guess that a build shipped.
      }
    };
    void check();
    const interval = window.setInterval(check, POLL_MS);
    // Coming back to the iPad after a period is exactly when a deploy has
    // usually landed, so check on focus rather than waiting out the interval.
    const onVisible = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!ready) return null;
  return (
    <button
      onClick={() => window.location.reload()}
      style={{
        position: "fixed", right: 12, bottom: 12, zIndex: 40,
        minHeight: 44, padding: "0 18px", borderRadius: 999,
        border: "1px solid color-mix(in srgb, var(--bdb-amber) 60%, transparent)",
        background: "var(--bdb-amber)", color: "var(--bdb-ink)",
        fontFamily: "var(--bdb-font)", fontWeight: 800, fontSize: "0.85rem",
        boxShadow: "0 10px 26px rgba(40,32,20,0.28)", cursor: "pointer",
        touchAction: "manipulation",
      }}
    >
      New version ready - tap to reload
    </button>
  );
}
