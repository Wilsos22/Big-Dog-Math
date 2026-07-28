"use client";

// Global warm-up verification poller - mounted in the root layout.
//
// The warmup-status -> join chain used to live only on the student landing,
// which is why the home-base links had to stay LOCKED until verification: a
// student who navigated away stopped the polling and was stranded outside
// the live-flow join and receipt chain. Moving the poller here frees the
// landing to be a normal homepage - verification now completes wherever the
// student happens to be in this tab.
//
// Scope: secure student mode only, and only while this tab carries a pending
// class code (sessionStorage) without a verified student session for it.
// Quiet by design - it either completes the join or keeps waiting.

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { SECURE_STUDENT_DATA, StudentApiError, studentApiRequest } from "@/lib/studentApi";
import { flushPendingToolResults } from "@/lib/toolEvidence";
import {
  getStoredStudentSession,
  saveVerifiedStudentJoin,
  type StoredStudentSession,
} from "@/lib/liveClassFlow";

const TEACHER_ROUTE_PREFIXES = ["/teacher", "/control", "/session", "/roster", "/board", "/ipad"];

function pendingClassCode(): string | null {
  try { return sessionStorage.getItem("bdm-pending-class-code"); } catch { return null; }
}

export default function WarmupJoinSync() {
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    if (!SECURE_STUDENT_DATA) return;
    let stopped = false;
    let checking = false;
    const check = async () => {
      if (stopped || checking) return;
      const currentPath = pathRef.current || "";
      if (TEACHER_ROUTE_PREFIXES.some((route) => currentPath === route || currentPath.startsWith(`${route}/`))) return;
      const code = pendingClassCode();
      if (!code) return;
      const stored = getStoredStudentSession();
      // A verified session (studentId present) means the chain is complete. Still
      // retry the buffer flush: a verification that landed while the network was
      // down would otherwise strand that student's tool work until tomorrow.
      if (stored?.studentId) { void flushPendingToolResults(); return; }
      checking = true;
      try {
        const status = await studentApiRequest<{ sessionId: string; complete: boolean }>(
          "/api/student/warmup-status",
          { method: "POST", body: JSON.stringify({ code }) },
        );
        if (!status.complete || stopped) return;
        const result = await studentApiRequest<{ session: StoredStudentSession }>(
          "/api/student/join",
          { method: "POST", body: JSON.stringify({ code }) },
        );
        if (!stopped && result.session.sessionId === status.sessionId) {
          saveVerifiedStudentJoin(result.session);
          // File everything this device buffered while it was unverified. A
          // student who submits the warm-up late still gets the whole period's
          // tool work attributed instead of losing it.
          void flushPendingToolResults();
        }
      } catch (error) {
        // Waiting states are normal; a closed session ends the pending code so
        // this poller goes quiet (the landing handles the messaging).
        if (error instanceof StudentApiError && error.code === "session_not_open") {
          try { sessionStorage.removeItem("bdm-pending-class-code"); } catch { /* ignore */ }
        }
      } finally {
        checking = false;
      }
    };
    void check();
    const interval = window.setInterval(check, 3000);
    window.addEventListener("focus", check);
    return () => {
      stopped = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", check);
    };
  }, []);

  return null;
}
