"use client";

// Class Mode listener — mounted globally. If this device joined a session, it
// watches that session's "broadcast" field; when the teacher sends students to a
// view (e.g. /lesson or a tool), this navigates the screen to match. When the
// broadcast is empty/'free', students browse freely. Closing the session releases.

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { SECURE_STUDENT_DATA, studentApiRequest } from "@/lib/studentApi";
import { fetchSharedSessionState, invalidateSharedSessionState } from "@/lib/studentSessionShared";
import { joinLiveFlowPings } from "@/lib/liveFlowPing";
import {
  LIVE_FLOW_MODE,
  LIVE_FLOW_ROUTE,
  STUDENT_SESSION_READY_EVENT_NAME,
  getStoredStudentSessionId,
  getStoredTeacherSessionId,
  hasClassModeExitMarker,
  isStudentTab,
  leaveClassMode,
} from "@/lib/liveClassFlow";

// 5 ticks at 3s = about 15 seconds of silence before the student is told.
// Short enough to catch a broken session inside one transition, long enough
// that a Chromebook waking from sleep never flashes the notice.
const FAILURES_BEFORE_NOTICE = 5;
// Every prefix the proxy gates as a teacher surface. /ipad and /board belong here
// even though they do not look like teacher pages: an iPad that ever typed a class
// code and never held a teacher session satisfies neither guard in tick(), so class
// mode would navigate the pen surface away mid-stroke with the room's board still up.
const TEACHER_ROUTE_PREFIXES = ["/teacher", "/control", "/session", "/roster", "/ipad", "/board"];
const STUDENT_SWITCH_ROUTE_PREFIXES = ["/join"];
const CLASS_MODE_TARGETS = new Set([
  LIVE_FLOW_ROUTE,
  "/lesson",
  "/whiteboard",
  "/number-line-plus",
  "/percent-bar",
  "/equation-builder",
  // Present in LiveToolRoute but missing here, so a teacher broadcasting one of
  // these explicitly could not send students to it.
  "/distributive-area",
  "/area-explorer",
  "/balance-beam",
  "/order-of-operations",
  "/fraction-bars",
  "/divisibility",
  "/lcm-bouncer",
  "/algebra-tiles",
  "/challenge",
  "/area-model",
  "/multiplication-fluency",
  "/combine-like-terms",
  "/ladder-method",
  "/group-bars",
  "/proportions",
  "/coordinate-grid",
  "/term-identifier",
  "/decimal-steps",
  "/division-house",
  "/exit-ticket",
  "/checkpoint",
  "/bruh",
  "/grudge",
]);

type StudentSessionState = {
  broadcast: string | null;
  status: string;
  live_flow: {
    state?: { id?: string | null } | null;
    tool?: { route?: string } | null;
    resource?: { url?: string | null } | null;
  } | null;
};

// A step with Response Mode "Assigned Tool" surfaces the tool as a RESOURCE link
// (live_flow.resource.url), not a published live tool (live_flow.tool.route). So
// tool.route is null and, without this, the next tick pushed the student off the
// tool back to /live-flow - the refresh loop that made "Open Assigned Tool"
// unreachable. Recognise the resource URL as an in-app tool route so class mode
// lets the student open it and STAY. Normalises an absolute same-app URL and
// strips any query/hash before matching the known class-mode targets.
function assignedToolRoute(resourceUrl: string | null | undefined): string | null {
  if (!resourceUrl) return null;
  let path = resourceUrl;
  if (!path.startsWith("/")) {
    try {
      path = new URL(resourceUrl).pathname;
    } catch {
      return null;
    }
  }
  path = path.split(/[?#]/)[0];
  return CLASS_MODE_TARGETS.has(path) ? path : null;
}

export const STUDENT_SESSION_READY_EVENT = STUDENT_SESSION_READY_EVENT_NAME;

function isTeacherRoute(pathname: string) {
  return TEACHER_ROUTE_PREFIXES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function isStudentSwitchRoute(pathname: string) {
  return STUDENT_SWITCH_ROUTE_PREFIXES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function shouldLeaveClassMode() {
  return typeof window !== "undefined"
    && new URLSearchParams(window.location.search).has("leaveClass");
}

function isTeacherPreview() {
  return typeof window !== "undefined"
    && (window.self !== window.top || new URLSearchParams(window.location.search).has("teacherPreview"));
}

export default function ClassSync() {
  const supabase = getSupabase();
  const router = useRouter();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  // A dead session used to be indistinguishable from a working one that simply
  // had not advanced: every read error returned silently. After FAILURES_BEFORE_NOTICE
  // consecutive failures the student sees that the device is not connected,
  // instead of sitting on a frozen screen for a whole period.
  const failureCountRef = useRef(0);
  const loggedFailureRef = useRef(false);
  const [reconnecting, setReconnecting] = useState(false);
  // Distinct from `reconnecting`: that one is a transient read failure and DOES
  // catch up on its own, so its copy says to keep working. This one never
  // recovers by itself - the tab has to be re-armed - so it must say what to do.
  const [notFollowing, setNotFollowing] = useState(false);

  useEffect(() => {
    if (!supabase && !SECURE_STUDENT_DATA) return;
    if (isTeacherPreview()) return;
    if (shouldLeaveClassMode()) {
      leaveClassMode();
      const currentPath = pathRef.current || "/";
      router.replace(currentPath === LIVE_FLOW_ROUTE ? "/" : currentPath);
      return;
    }
    let stop = false;
    const tick = async () => {
      // Re-read browser state on every tick. A Chromebook can become verified
      // after this component mounts, when the warm-up response links it to the
      // roster and the student homepage stores the joined session.
      const currentPath = pathRef.current || "";
      // This guard is CORRECT and stays: a device that has ever held a teacher
      // session must not be dragged around by class mode. What it must not do
      // is fail in silence. A held device looks exactly like a lesson that has
      // not advanced - no log, no state, nothing on screen - and the marker
      // dies on tab close and on tab restore, so a student who was following
      // ten minutes ago simply stops. That has now cost two debugging sessions
      // (2026-07-22, 2026-08-06), the second one presenting as "it went to the
      // multiplication tool but then did not follow the lesson".
      //
      // Only speak when there is a stored student session to hold (otherwise a
      // teacher browsing the site would see it), and NEVER on a teacher surface:
      // the isTeacherRoute check below runs after this one, and /control and
      // /teacher/present are on the projector. A notice on the wall is worse
      // than the silence it replaces.
      if (getStoredTeacherSessionId() && !isStudentTab()) {
        const heldWithSession = Boolean(getStoredStudentSessionId())
          && !isTeacherRoute(currentPath)
          && !isStudentSwitchRoute(currentPath);
        setNotFollowing(heldWithSession);
        return;
      }
      setNotFollowing(false);
      if (hasClassModeExitMarker()) return;
      const sessionId = getStoredStudentSessionId();
      if (!sessionId) return;
      if (isStudentSwitchRoute(currentPath)) return;
      if (isTeacherRoute(currentPath)) return;
      let data: StudentSessionState | null = null;
      let error: unknown = null;
      if (SECURE_STUDENT_DATA) {
        try {
          const result = await fetchSharedSessionState<{ session: StudentSessionState | null }>(sessionId);
          data = result.session;
        } catch (requestError) {
          error = requestError;
        }
      } else if (supabase) {
        const liveFlowQuery = await supabase
          .from("sessions")
          .select("broadcast,status,live_flow")
          .eq("id", sessionId)
          .maybeSingle();
        const fallbackQuery = liveFlowQuery.error
          ? await supabase.from("sessions").select("broadcast,status").eq("id", sessionId).maybeSingle()
          : null;
        data = (liveFlowQuery.data ?? fallbackQuery?.data) as StudentSessionState | null;
        error = liveFlowQuery.error && fallbackQuery?.error ? fallbackQuery.error : null;
      }
      if (stop) return;
      if (error || !data) {
        // Transient read error or a momentary empty result — keep the student in
        // the session and retry on the next tick instead of kicking them out
        // (that was what made students get asked to re-join mid-class).
        failureCountRef.current += 1;
        if (failureCountRef.current >= FAILURES_BEFORE_NOTICE) {
          setReconnecting(true);
          if (!loggedFailureRef.current) {
            loggedFailureRef.current = true;
            console.warn("ClassSync: session state unreadable", { sessionId, error });
          }
        }
        return;
      }
      failureCountRef.current = 0;
      loggedFailureRef.current = false;
      setReconnecting(false);
      const d = data;
      if (d.status === "closed") {
        leaveClassMode();
        return;
      }
      // Decide where this joined student should be. While the session is open
      // they're held in class — they can only roam when the teacher explicitly
      // sets "Free (browse)". Ending the session (status closed, above) is the
      // only thing that fully releases them.
      let target: string | null;
      if (d.broadcast === LIVE_FLOW_MODE) {
        // Warm-up stays on the student homepage. The assigned Google Form opens
        // in a second tab, and verified students may use solo challenge games
        // until the teacher advances into the instructional lesson flow.
        const liveStateId = d.live_flow?.state?.id || null;
        if (!liveStateId) {
          // A MISSING state is not the same as the warm-up state, and treating
          // the two alike is what bounced students. "warmup" is a real, authored
          // destination; a missing one is just a gap - a reconnect, a Control
          // republish between steps, a snapshot that has not landed yet - and it
          // resolves in about a second. The old branch pushed a student who was
          // watching the lesson to "/" and then straight back to /live-flow the
          // moment state returned - the "bounced out and back" report. Note the
          // signal chips on /live-flow are themselves gated on `flow?.state`, so
          // the same missing state that caused the bounce also takes the stuck
          // chip off the screen; they are one fault, not two. Hold everyone
          // exactly where they are: target equals the current path, so the
          // dispatch below finds nothing to do.
          target = currentPath;
        } else if (liveStateId === "warmup") {
          target = currentPath === LIVE_FLOW_ROUTE ? "/" : null;
        } else {
          // A published live tool moves the whole class to it. An assigned-tool
          // resource is opened per student, so only keep them there once they
          // are on it - never yank them off it back to /live-flow.
          const toolRoute = assignedToolRoute(d.live_flow?.resource?.url);
          target = d.live_flow?.tool?.route
            || (toolRoute && currentPath === toolRoute ? toolRoute : LIVE_FLOW_ROUTE);
        }
      } else if (d.broadcast === "free") {
        target = null; // teacher released students to browse on their own
      } else if (d.broadcast && CLASS_MODE_TARGETS.has(d.broadcast)) {
        target = d.broadcast; // explicit destination (lesson or a tool)
      } else {
        target = "/lesson"; // joined but no destination yet, so hold on the lesson
      }
      if (target && currentPath !== target) {
        router.push(target);
      } else if (!target && currentPath === LIVE_FLOW_ROUTE) {
        router.push("/lesson");
      }
    };
    const handleStudentSessionReady = () => { void tick(); };
    void tick();
    const id = setInterval(tick, 3000);
    window.addEventListener(STUDENT_SESSION_READY_EVENT, handleStudentSessionReady);

    // The 3s tick is the floor. A screen ping means the lesson just moved, so
    // drop the shared cache (otherwise this read is served a value from up to
    // FRESH_MS ago) and follow immediately - class mode used to take up to
    // three seconds to send a student to the next surface.
    // Skipped on the teacher surfaces for the same reason tick() returns early
    // there: the pen surface has no business holding a class-mode subscription.
    const sessionId = getStoredStudentSessionId();
    const pings = sessionId && !isTeacherRoute(pathRef.current || "")
      ? joinLiveFlowPings(sessionId, () => {
          invalidateSharedSessionState(sessionId);
          void tick();
        })
      : null;

    return () => {
      stop = true;
      clearInterval(id);
      pings?.close();
      window.removeEventListener(STUDENT_SESSION_READY_EVENT, handleStudentSessionReady);
    };
  }, [supabase, router, pathname]);

  if (!reconnecting && !notFollowing) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        left: "50%",
        bottom: 16,
        transform: "translateX(-50%)",
        zIndex: 60,
        maxWidth: "min(92vw, 30rem)",
        padding: "10px 16px",
        borderRadius: 12,
        border: "1px solid #674a40",
        background: "#fcaf38",
        color: "#201e1a",
        font: "700 0.9rem/1.35 var(--bdb-font, system-ui, sans-serif)",
        textAlign: "center",
        boxShadow: "0 6px 20px rgba(32,30,26,0.22)",
      }}
    >
      {notFollowing
        // This one never heals by itself, so it must not say "keep working" -
        // that is the copy for a transient read failure, and telling a student
        // to sit tight is exactly what turns this into a lost period.
        ? "This tab is not following class. Enter the class code again to reconnect."
        : "Not connected to class right now. Keep working - this screen will catch up on its own."}
    </div>
  );
}
