"use client";

// Is this browser the teacher's?
//
// The answer comes from the httpOnly bdm_teacher cookie by way of
// /api/device-role, so a student device cannot claim it by flipping a switch or
// writing localStorage. It is NOT authorization - nothing student-owned is
// behind it - it is what decides whether a public tool shows its teacher-only
// affordances (answer reveals, projector sizing).
//
// One request per page load, shared by every caller: the promise is cached at
// module scope, so five mounted tools ask once.

import { useEffect, useState } from "react";

let pending: Promise<boolean> | null = null;

export function isTeacherDevice(): Promise<boolean> {
  if (!pending) {
    pending = fetch("/api/device-role", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { teacher: false }))
      .then((j) => Boolean(j?.teacher))
      // A failed probe means "not the teacher" - the safe direction, because
      // the thing behind it is an answer key.
      .catch(() => false);
  }
  return pending;
}

export function useTeacherDevice(): boolean {
  const [teacher, setTeacher] = useState(false);
  useEffect(() => {
    let live = true;
    isTeacherDevice().then((yes) => { if (live) setTeacher(yes); });
    return () => { live = false; };
  }, []);
  return teacher;
}
