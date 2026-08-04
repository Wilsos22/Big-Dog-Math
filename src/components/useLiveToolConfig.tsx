"use client";

import { type CSSProperties, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { SECURE_STUDENT_DATA, studentApiRequest } from "@/lib/studentApi";
import { fetchSharedSessionState } from "@/lib/studentSessionShared";
import {
  LIVE_FLOW_MODE,
  getStoredStudentSessionId,
  type LiveClassFlowSnapshot,
  type LiveToolConfig,
  type LiveToolRoute,
} from "@/lib/liveClassFlow";

type SessionRow = {
  status: string;
  broadcast: string | null;
  live_flow: LiveClassFlowSnapshot | null;
};

// Consecutive unreadable ticks before we say so in the console. At a 1s poll
// this is about five seconds of silence - long enough that a single blip stays
// quiet, short enough to be in the log when a room reports a problem.
const FAILURES_BEFORE_WARNING = 5;

/**
 * A read that FAILED is not the same as "nothing is published", and the
 * difference is what a student is looking at.
 *
 * This hook polls once a second. Every failure path used to call
 * applySession(null) - a rejected fetch, a Supabase error, a momentarily
 * missing row - which CLEARED the published task. LiveToolBanner renders
 * nothing without a prompt, so the student's "Today's task" vanished mid-work,
 * and the sequence tools (/decimal-steps, /division-house, /distributive-area,
 * /ladder-method, /number-line-plus) additionally fell back to their built-in
 * default problems because their config went undefined. The Supabase error
 * branch was the worst of them: it forced `live_flow: null` on a row it had
 * just failed to read, so a healthy session with a published tool got wiped.
 * One blip was enough, and fetchSharedSessionState negative-caches a rejection
 * for 1.5s, so a single wire failure produced roughly two consecutive clears.
 *
 * ClassSync fixed exactly this for navigation and left the reasoning in place:
 * "keep the student in the session and retry on the next tick instead of
 * kicking them out". Same rule here - only an ANSWER from the server may
 * change what the student sees.
 *
 * Deliberately SILENT to the student. A tool surface is where they are
 * working; a reconnect notice there costs more attention than the stale prompt
 * it would explain, and the prompt is almost certainly still correct. The
 * console warning is for us.
 */
export function useLiveToolConfig(route: LiveToolRoute): LiveToolConfig | null {
  const supabase = getSupabase();
  const [tool, setTool] = useState<LiveToolConfig | null>(null);

  useEffect(() => {
    const sessionId = getStoredStudentSessionId();
    if ((!supabase && !SECURE_STUDENT_DATA) || !sessionId) {
      setTool(null);
      return;
    }

    let stopped = false;
    let failures = 0;
    let loggedFailure = false;

    // The server answered. This IS what is published, so it may clear the tool.
    const applySession = (row: SessionRow) => {
      if (stopped) return;
      failures = 0;
      loggedFailure = false;
      const nextTool = row.status === "open" && row.broadcast === LIVE_FLOW_MODE
        ? row.live_flow?.tool ?? null
        : null;
      setTool(nextTool?.route === route ? nextTool : null);
    };

    // The server did not answer, or answered without the field we need. Keep
    // whatever the student already has and try again on the next tick.
    const retain = (reason: string, detail?: unknown) => {
      if (stopped) return;
      failures += 1;
      if (failures >= FAILURES_BEFORE_WARNING && !loggedFailure) {
        loggedFailure = true;
        console.warn("useLiveToolConfig: session state unreadable, keeping the last published task", {
          route,
          reason,
          detail,
        });
      }
    };

    const readSession = async () => {
      if (SECURE_STUDENT_DATA) {
        try {
          const result = await fetchSharedSessionState<{ session: SessionRow | null }>(sessionId);
          if (result.session) applySession(result.session);
          else retain("no session row in shared state");
        } catch (requestError) {
          retain("shared session fetch rejected", requestError);
        }
        return;
      }
      if (!supabase) return;
      const { data, error } = await supabase
        .from("sessions")
        .select("status,broadcast,live_flow")
        .eq("id", sessionId)
        .maybeSingle();
      if (error) {
        // live_flow itself is unreadable. The lighter select can still settle
        // the two things that authoritatively END a published task: the session
        // closing, or the teacher releasing the class to Free (browse). Any
        // other outcome means we merely could not SEE the tool - so keep it,
        // rather than forcing live_flow to null the way this branch used to.
        const fallback = await supabase
          .from("sessions")
          .select("status,broadcast")
          .eq("id", sessionId)
          .maybeSingle();
        const row = fallback.data as Omit<SessionRow, "live_flow"> | null;
        if (fallback.error || !row) retain("sessions select failed", fallback.error ?? error);
        else if (row.status !== "open" || row.broadcast !== LIVE_FLOW_MODE) applySession({ ...row, live_flow: null });
        else retain("live_flow column unreadable", error);
        return;
      }
      if (data) applySession(data as SessionRow);
      else retain("session row missing");
    };

    void readSession();
    const interval = window.setInterval(readSession, 1000);
    const channel = SECURE_STUDENT_DATA || !supabase ? null : supabase
      .channel(`live-tool-${route}-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${sessionId}` },
        (payload) => applySession(payload.new as SessionRow),
      )
      .subscribe();

    return () => {
      stopped = true;
      window.clearInterval(interval);
      if (channel && supabase) void supabase.removeChannel(channel);
    };
  }, [route, supabase]);

  return tool;
}

// `style` lets a host nudge placement only — e.g. spanning a multi-column grid.
// It merges last, so a caller can override, but the token colors are the default.
export function LiveToolBanner({ tool, style }: { tool: LiveToolConfig | null; style?: CSSProperties }) {
  if (!tool?.prompt.trim()) return null;

  // Every tool that renders this banner is a light surface — cream (--bdb-ground)
  // everywhere except /multiplication-fluency, which is white — so it is styled
  // from the design tokens: white card, ink text, amber accent rail. On the white
  // page the amber rail and hairline border are what separate it from the ground.
  return (
    <div
      style={{
        margin: "0 auto 14px",
        width: "100%",
        maxWidth: "min(92vw, 960px)",
        border: "1px solid var(--bdb-line)",
        borderLeft: "4px solid var(--bdb-amber)",
        borderRadius: "var(--bdb-r-sm)",
        background: "var(--bdb-card)",
        boxShadow: "var(--bdb-shadow-sm)",
        color: "var(--bdb-ink)",
        padding: "10px 14px",
        fontWeight: 800,
        lineHeight: 1.4,
        textAlign: "left",
        ...style,
      }}
    >
      <span style={{ color: "var(--bdb-ink-soft)", fontWeight: 700, fontSize: "0.72rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>Today&apos;s task</span>
      <div>{tool.prompt}</div>
    </div>
  );
}
