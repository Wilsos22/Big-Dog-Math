"use client";

// Joins the pen surface's control channel purely to receive the class
// attention call. Used by displays that do not already hold a __ctrl join
// (/teacher/present); /board extends its existing handler instead - a page
// must never join the same ink room twice.

import { useEffect, useState } from "react";
import { joinInkRoom } from "@/lib/inkSync";
import AttentionPulse from "./AttentionPulse";

export default function AttentionListener({ room, visualOnly }: { room: string; visualOnly?: boolean }) {
  const [signal, setSignal] = useState(0);
  useEffect(() => {
    const ch = joinInkRoom(`${room}__ctrl`, (m) => {
      if (m.t === "attention") setSignal((n) => n + 1);
    });
    return () => ch.close();
  }, [room]);
  return <AttentionPulse signal={signal} visualOnly={visualOnly} />;
}
