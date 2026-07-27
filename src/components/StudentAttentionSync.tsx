"use client";

// Student-screen half of the attention call: when this device holds a student
// session, follow the classroom's pen-surface control channel and flash the
// Eyes-up pulse wherever the student is - lesson page, a tool, the homepage.
// The eyes-down kid staring at their Chromebook is exactly who the redirect
// is for (Steele, 2026-07-27). VISUAL ONLY: the room speakers carry the
// sound; thirty unsynced Chromebook speakers would be chaos, so student
// devices never play audio.
//
// Mounted in the root layout; skips the surfaces that already hold their own
// __ctrl join (/ipad, /board, /teacher/present) - joining the same ink room
// twice from one page context is never safe.

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import AttentionListener from "./AttentionListener";

// The pen surface's default pairing room. Multi-room setups pair displays by
// ?room= param; student devices follow the default room.
const INK_ROOM = "main";
const EXCLUDED_PREFIXES = ["/board", "/ipad", "/teacher"];

export default function StudentAttentionSync() {
  const pathname = usePathname() || "/";
  const [hasStudent, setHasStudent] = useState(false);

  useEffect(() => {
    const check = () => {
      try {
        setHasStudent(!!localStorage.getItem("bdm-student-session"));
      } catch {
        setHasStudent(false);
      }
    };
    check();
    const t = window.setInterval(check, 10_000);
    return () => window.clearInterval(t);
  }, []);

  if (!hasStudent || EXCLUDED_PREFIXES.some((p) => pathname.startsWith(p))) return null;
  return <AttentionListener room={INK_ROOM} visualOnly />;
}
