"use client";

// The glass sheet: the ink layer over the whole projector view. Whatever the
// main display is showing - the Warm Notebook lesson stage, poll results, a
// tool - the iPad's pen inks on top of it here. Never intercepts pointer
// events, so the machine driving the projector keeps working underneath. It
// announces its aspect ratio so the pen surface letterboxes to match, keeping
// every stroke exactly where the teacher put it.
//
// PAPER MIRRORS THE PEN SURFACE. /ipad has one board and one room; toggling
// Paper there makes it opaque - dotted paper instead of the slide behind the
// same ink - and announces it on <room>__ctrl. This follows, so the wall and
// the hand never disagree about what is behind the writing. It ASKS on mount,
// because a projector opened mid-lesson must not sit on the slide while the
// teacher is already writing on paper.
//
// Joining __ctrl here is safe alongside AttentionListener's own join on the
// same page: ink rooms are shared and reference counted (realtimeRooms.ts).

import { useEffect, useState } from "react";
import InkBoard from "./InkBoard";
import { joinInkRoom } from "@/lib/inkSync";

export default function ScreenInkOverlay({ room }: { room: string }) {
  const [paper, setPaper] = useState(false);

  useEffect(() => {
    const ctrl = joinInkRoom(`${room}__ctrl`, (m) => {
      if (m.t === "paper") setPaper(m.on);
    });
    ctrl.send({ t: "hello" });
    return () => ctrl.close();
  }, [room]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 40, pointerEvents: "none" }} aria-hidden>
      <InkBoard
        room={`${room}__over`}
        interactive={false}
        transparent={!paper}
        paper="dots"
        passThrough
        announceView
      />
    </div>
  );
}
