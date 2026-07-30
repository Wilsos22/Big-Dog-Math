"use client";

// Board display — runs on the computer driving the interactive panel.
// Shows whatever the paired iPad (same room) writes, live. Read-only.
//
// ONE LAYER, because the pen surface is one surface (2026-07-30). Everything
// the teacher writes is on <room>__over; the paper behind it is a property of
// that same board, mirrored off <room>__ctrl exactly as ScreenInkOverlay does
// it. The old stack - <room> plus __p1..__p7 pages plus a __scratch overlay
// plus the glass sheet - is gone with the modes that fed it.

import { useEffect, useState } from "react";
import AttentionPulse from "@/components/AttentionPulse";
import InkBoard from "@/components/InkBoard";
import { joinInkRoom } from "@/lib/inkSync";

export default function BoardPage() {
  const [room, setRoom] = useState("main");
  const [attnSignal, setAttnSignal] = useState(0);
  const [paper, setPaper] = useState(false);

  useEffect(() => {
    try {
      const r = new URLSearchParams(window.location.search).get("room");
      if (r) setRoom(r.trim());
    } catch { /* ignore */ }
  }, []);

  // The attention call, and the paper background the pen surface is on. Ask on
  // join so a panel switched on mid-lesson matches the hand immediately.
  useEffect(() => {
    const ctrl = joinInkRoom(`${room}__ctrl`, (m) => {
      if (m.t === "attention") setAttnSignal((n) => n + 1);
      else if (m.t === "paper") setPaper(m.on);
    });
    ctrl.send({ t: "hello" });
    return () => ctrl.close();
  }, [room]);

  return (
    <main style={{ position: "fixed", inset: 0, background: "#faf6ee" }}>
      <InkBoard room={`${room}__over`} interactive={false} transparent={!paper} paper="dots" />
      <div
        style={{
          position: "absolute", top: 10, right: 12, zIndex: 2,
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "6px 12px", borderRadius: 999, background: "rgba(20,184,166,0.12)",
          color: "#0f6e56", fontWeight: 700, fontSize: "0.8rem", fontFamily: "var(--bdb-font)",
          border: "1px solid rgba(20,184,166,0.4)", pointerEvents: "none",
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#14b8a6", display: "inline-block" }} />
        Board · {room}
      </div>
      <AttentionPulse signal={attnSignal} />
    </main>
  );
}
