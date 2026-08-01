"use client";

// Big Dog Math — STUDENT landing. Join is the main event: enter the class code to
// link to the teacher's live session. A quiet secondary option ("Absent or just
// exploring") drops into the full site (/explore) for own-time browsing.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import {
  clearClassModeExitMarker,
  clearStoredStudentSession,
  getStoredStudentSession,
  markStudentTab,
  saveProvisionalStudentSession,
} from "@/lib/liveClassFlow";
import {
  ensureAnonymousStudentSession,
  personalizeWarmupLink,
  SECURE_STUDENT_DATA,
  StudentApiError,
  studentApiRequest,
} from "@/lib/studentApi";
import { STUDENT_SESSION_READY_EVENT } from "@/components/ClassSync";

type WarmupSessionLesson = { code: string; title: string };

// Students never sign in to the SITE with Google - that would put district
// emails into Supabase Auth, which the FERPA boundary forbids. Identity comes
// only from the warm-up receipt chain (the Google sign-in happens on the Form,
// inside the district Workspace), and the site knows students by alias.
const WARMUP_IDENTITY = process.env.NEXT_PUBLIC_WARMUP_IDENTITY_ENABLED === "true";

// The home-base destinations. Never locked: warm-up verification runs
// globally (WarmupJoinSync in the root layout), so navigating away no longer
// strands the receipt chain the way it did when the polling lived only here.
const HOME_LINKS = [
  { href: "/lesson", title: "Today's lesson", desc: "The plan, goals, and what you need" },
  { href: "/practice", title: "Challenge games", desc: "Pick a game and beat your score" },
  { href: "/explore", title: "Explore the tools", desc: "Every math tool, free to try" },
];

export default function StudentLanding() {
  const router = useRouter();
  const supabase = getSupabase();
  const [code, setCode] = useState("");
  const [joinSess, setJoinSess] = useState<{ id: string; periodId: string; syncKey: string } | null>(null);
  const [roster, setRoster] = useState<{ id: string; alias: string | null }[]>([]);
  const [joinErr, setJoinErr] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [warmupHref, setWarmupHref] = useState<string | null>(null);
  const [warmupToken, setWarmupToken] = useState<string | null>(null);
  const [warmupOpenedFor, setWarmupOpenedFor] = useState<string | null>(null);
  const [todayCover, setTodayCover] = useState<{ url: string; lessonCode: string } | null>(null);
  const [sessionLesson, setSessionLesson] = useState<WarmupSessionLesson | null>(null);
  const [identityReady, setIdentityReady] = useState(false);
  const [helpRequestCode, setHelpRequestCode] = useState<string | null>(null);
  const [requestingHelp, setRequestingHelp] = useState(false);

  useEffect(() => {
    // No student name of any kind on student devices (Steele, 2026-08-01) -
    // no alias, no typed name, nothing to perform with. Purge the old
    // greeting key from devices that still carry one.
    try { localStorage.removeItem("bdm-student-name"); } catch { /* ignore */ }
    try { setWarmupOpenedFor(sessionStorage.getItem("bdm-warmup-opened")); } catch { /* ignore */ }
    if (SECURE_STUDENT_DATA) {
      void (async () => {
        try {
          const pending = sessionStorage.getItem("bdm-pending-class-code");
          if (pending) {
            await ensureAnonymousStudentSession();
            const link = await fetchWarmupLink(pending);
            setCode(pending);
            setPendingCode(pending);
            setWarmupToken(link.warmupToken);
            setSessionLesson(link.lesson);
            if (!link.open) {
              resetPendingSession("That session ended. Enter the new class code.");
              return;
            }
            // A reloaded tab keeps its verified state; an unverified one gets
            // (or keeps) the provisional session so the screen still follows.
            const stored = getStoredStudentSession();
            if (stored?.studentId && stored.sessionId === link.sessionId) {
              setIdentityReady(true);
            } else {
              setIdentityReady(false);
              saveProvisionalStudentSession(link.sessionId, "", pending);
            }
            setWarmupHref(link.href);
          }
        } catch (error) {
          if (error instanceof StudentApiError && error.code === "session_not_open") {
            resetPendingSession("That session ended. Enter the new class code.");
          } else {
            setJoinErr(error instanceof Error ? error.message : "Secure student sign-in is unavailable.");
          }
        }
      })();
    }
  }, []);

  async function fetchWarmupLink(classCode: string): Promise<{
    open: boolean;
    sessionId: string;
    href: string | null;
    warmupToken: string;
    lesson: WarmupSessionLesson | null;
  }> {
    const data = await studentApiRequest<{
      sessionId: string;
      warmupToken: string;
      warmUpLink: string | null;
      lesson: WarmupSessionLesson | null;
    }>("/api/student/warmup-start", {
      method: "POST",
      body: JSON.stringify({ code: classCode }),
    });
    // The server resolves the code: an open session's assigned lesson always
    // wins, and a period's permanent class code opens the day's session on
    // demand, seeded with today's published warm-up form - so students start
    // the moment they type their code (decided 2026-07-21, replacing the
    // earlier no-date-fallback rule). The same server call rotates the
    // one-time token if the teacher replaces the assigned Form, and the
    // polling below swaps in the teacher's form without a refresh.
    const link = data.warmUpLink || null;
    return {
      open: true,
      sessionId: data.sessionId,
      href: link ? personalizeWarmupLink(link, data.warmupToken) : null,
      warmupToken: data.warmupToken,
      lesson: data.lesson || null,
    };
  }

  // The Notion lesson cover dresses the lesson card. It rides /api/today on
  // every load because Notion-hosted covers use short-lived signed URLs -
  // never store this value.
  useEffect(() => {
    if (!pendingCode) { setTodayCover(null); return; }
    let cancelled = false;
    fetch("/api/today", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { lesson: { coverUrl?: string; lessonCode?: string } | null }) => {
        if (!cancelled && data.lesson?.coverUrl) {
          setTodayCover({ url: data.lesson.coverUrl, lessonCode: data.lesson.lessonCode || "" });
        }
      })
      .catch(() => { /* the card simply stays coverless */ });
    return () => { cancelled = true; };
  }, [pendingCode]);

  function resetPendingSession(message: string | null = null) {
    setPendingCode(null);
    setWarmupHref(null);
    setWarmupToken(null);
    setWarmupOpenedFor(null);
    setSessionLesson(null);
    setIdentityReady(false);
    setHelpRequestCode(null);
    clearStoredStudentSession();
    try {
      sessionStorage.removeItem("bdm-pending-class-code");
      sessionStorage.removeItem("bdm-warmup-opened");
    } catch { /* ignore */ }
    if (message) setJoinErr(message);
  }

  // The warm-up form opens in its own tab; recording which token it was opened
  // for lets this tab switch to the home-base view (and fall back to the big
  // warm-up button if the teacher later replaces the assigned form, which
  // rotates the token).
  function markWarmupOpened() {
    if (!warmupToken) return;
    try { sessionStorage.setItem("bdm-warmup-opened", warmupToken); } catch { /* ignore */ }
    setWarmupOpenedFor(warmupToken);
  }

  // The teacher may load the lesson after Chromebooks have already accepted
  // the class code. Keep checking that specific live session throughout Warm-Up
  // so a replaced Form link appears without a refresh. Never substitute a
  // date-based lesson.
  useEffect(() => {
    if (!SECURE_STUDENT_DATA || !pendingCode) return;
    let stopped = false;
    let checking = false;
    const refreshWarmup = async () => {
      if (checking || stopped) return;
      checking = true;
      try {
        const result = await fetchWarmupLink(pendingCode);
        if (stopped) return;
        if (!result.open) {
          resetPendingSession("That session ended. Enter the new class code.");
          return;
        }
        if (warmupToken && warmupToken !== result.warmupToken) {
          // The teacher replaced the assigned form: verification restarts, but
          // the screen keeps FOLLOWING via a provisional session instead of
          // being dropped from class mode entirely.
          clearStoredStudentSession();
          saveProvisionalStudentSession(result.sessionId, "", pendingCode);
          setIdentityReady(false);
          setHelpRequestCode(null);
        }
        setWarmupToken(result.warmupToken);
        setWarmupHref(result.href);
        setSessionLesson(result.lesson);
      } catch (error) {
        if (error instanceof StudentApiError && error.code === "session_not_open") {
          resetPendingSession("That session ended. Enter the new class code.");
        } else if (error instanceof StudentApiError && error.code === "warmup_form_not_connected") {
          setJoinErr(error.message);
        }
        // Other temporary lookup failures are retried while the code is pending.
      } finally {
        checking = false;
      }
    };
    void refreshWarmup();
    const interval = window.setInterval(refreshWarmup, 3000);
    window.addEventListener("focus", refreshWarmup);
    return () => {
      stopped = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshWarmup);
    };
    // fetchWarmupLink reads and binds only the session-scoped URL for pendingCode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCode, warmupToken]);

  // Verification itself now runs globally (WarmupJoinSync in the root layout),
  // so it survives the student navigating anywhere. This page only LISTENS:
  // when the join completes - here or on any other page in this tab - the
  // ready event flips the connected copy.
  useEffect(() => {
    const onReady = () => {
      const stored = getStoredStudentSession();
      if (stored?.studentId) setIdentityReady(true);
    };
    window.addEventListener(STUDENT_SESSION_READY_EVENT, onReady);
    return () => window.removeEventListener(STUDENT_SESSION_READY_EVENT, onReady);
  }, []);

  async function requestTeacherHelp() {
    if (!pendingCode || requestingHelp) return;
    setRequestingHelp(true);
    setJoinErr(null);
    try {
      const result = await studentApiRequest<{ request: { requestCode: string } }>(
        "/api/student/admission-request",
        { method: "POST", body: JSON.stringify({ code: pendingCode }) },
      );
      setHelpRequestCode(result.request.requestCode);
    } catch (error) {
      setJoinErr(error instanceof Error ? error.message : "Teacher help could not be requested.");
    } finally {
      setRequestingHelp(false);
    }
  }

  async function submitCode() {
    setJoinErr(null);
    const c = code.trim().toUpperCase();
    if (c.length < 2) return;
    if (!supabase) { setJoinErr("Live sessions aren't set up yet."); return; }
    if (SECURE_STUDENT_DATA) {
      setJoining(true);
      try {
        const codeResponse = await fetch("/api/student/session-code", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code: c }),
        });
        const codeResult = await codeResponse.json().catch(() => ({})) as { open?: boolean; error?: string };
        if (!codeResponse.ok || !codeResult.open) {
          setJoinErr(codeResult.error || "That code is not open right now. Check with your teacher.");
          return;
        }
        await ensureAnonymousStudentSession();
        const link = await fetchWarmupLink(c);
        sessionStorage.setItem("bdm-pending-class-code", c);
        setCode(c);
        setPendingCode(c);
        setIdentityReady(false);
        setWarmupToken(link.warmupToken);
        setSessionLesson(link.lesson);
        setHelpRequestCode(null);
        if (!link.open) {
          resetPendingSession("That session ended. Enter the new class code.");
          return;
        }
        // Provisional session: the screen follows the class from the moment
        // the code is accepted, even before the warm-up verifies. The global
        // WarmupJoinSync upgrades it to the verified identity.
        saveProvisionalStudentSession(link.sessionId, "", c);
        setWarmupHref(link.href);
      } catch (error) {
        sessionStorage.removeItem("bdm-pending-class-code");
        setPendingCode(null);
        setWarmupHref(null);
        setWarmupToken(null);
        setSessionLesson(null);
        setJoinErr(error instanceof Error ? error.message : "The class could not be joined.");
      } finally {
        setJoining(false);
      }
      return;
    }
    const { data: sess } = await supabase.from("sessions").select("id,period_id").eq("join_code", c).eq("status", "open").limit(1).maybeSingle();
    if (!sess) { setJoinErr("That code isn't open right now — check with your teacher."); return; }
    const s = sess as { id: string; period_id: string };
    const { data: studs } = await supabase.from("students").select("id,alias").eq("period_id", s.period_id).order("alias");
    setJoinSess({ id: s.id, periodId: s.period_id, syncKey: c });
    setRoster((studs as { id: string; alias: string | null }[]) || []);
  }

  async function pickName(s: { id: string; alias: string | null }) {
    const alias = s.alias || "Student";
    if (supabase && joinSess && !WARMUP_IDENTITY) {
      await supabase.from("session_joins").insert({ session_id: joinSess.id, student_id: s.id, display_name: alias });
    }
    try {
      clearClassModeExitMarker();
      if (joinSess) {
        localStorage.setItem("bdm-student-session", JSON.stringify({
          sessionId: joinSess.id,
          studentId: s.id,
          name: alias,
          syncKey: joinSess.syncKey,
        }));
        markStudentTab();
      }
    } catch { /* ignore */ }
    router.push("/lesson");
  }

  const moduleNumber = sessionLesson?.code.match(/^M(\d+)/i)?.[1] || "";
  const topicNumber = sessionLesson?.code.match(/\.T(\d+)/i)?.[1] || "";
  // Once opened for the current token, the warm-up button softens to
  // "Reopen" and the status line watches for the submission.
  const warmupOpened = Boolean(warmupToken && warmupOpenedFor === warmupToken);

  return (
    <main className="st-page">
      <style>{`
        /* Warm Notebook skin (Design canvas turn 12): the same dotted paper
           every classroom surface stands on. */
        .st-page { min-height:100vh;
          background-color:#F3F0E7;
          background-image:radial-gradient(circle,#CBC4B2 1px,transparent 1.3px);
          background-size:18px 18px;
          font-family:var(--bdb-font); color:var(--bdb-ink);
          padding:clamp(18px,4vw,44px) 16px; box-sizing:border-box; display:flex; flex-direction:column; align-items:center; }
        .st-banner { width:100%; max-width:min(320px, 74vw); margin-top:clamp(2px,1vw,8px); }
        .st-banner img { width:100%; height:auto; display:block; }
        .st-hello { margin:4px 0 2px; font-size:clamp(1.35rem,3vw,1.8rem); font-weight:800; letter-spacing:-0.02em; color:#2E4A54; text-align:center; }
        .st-hello-sub { margin:0 0 clamp(14px,2.4vw,20px); color:var(--bdb-ink-soft); font-weight:500; font-size:clamp(0.94rem,1.8vw,1.04rem); text-align:center; }

        .st-cards { width:100%; max-width:${pendingCode ? "680px" : "440px"}; display:grid; gap:16px; }
        /* Grid items may not exceed the track: the code input's intrinsic
           width (~284px) otherwise pushes the card past narrow viewports and
           the whole page scrolls sideways on phones. */
        .st-cards > * { min-width:0; }
        .st-join { border:1px solid #E3D9C2; border-radius:var(--bdb-r-lg); background:#fff; padding:22px 22px 24px;
          box-shadow:0 2px 10px rgba(40,32,20,0.06); }
        .st-join-h { margin:0 0 4px; font-size:1.25rem; font-weight:800; letter-spacing:-0.015em; color:#2E4A54; }
        .st-join-sub { margin:0 0 14px; font-size:0.92rem; font-weight:500; color:var(--bdb-ink-soft); }
        .st-codebox { display:flex; gap:8px; }
        .st-code-in { flex:1; width:0; min-width:0; border:2px solid var(--bdb-teal); border-radius:12px; padding:14px 16px;
          font-size:1.3rem; font-weight:800; letter-spacing:0.18em; text-transform:uppercase; color:#0f5e5f; background:#fff; }
        .st-code-in:focus { outline:none; box-shadow:0 0 0 4px color-mix(in srgb, var(--bdb-teal) 22%, transparent); }
        .st-code-btn { background:var(--bdb-teal-deep); color:#fff; border:none; border-radius:12px; padding:0 22px; font-weight:800; font-size:1.05rem; cursor:pointer; }
        .st-code-btn:hover { filter:brightness(1.04); }
        .st-joinerr { color:var(--bdb-coral); font-weight:600; font-size:0.9rem; margin-top:10px; }
        .st-warmup { display:grid; gap:10px; text-align:left; }
        .st-lesson-card { display:grid; gap:10px; border:1px solid #E3D9C2; border-left:5px solid var(--bdb-teal); border-radius:16px;
          background:#fff; padding:16px; box-shadow:0 2px 10px rgba(40,32,20,0.05); overflow:hidden; }
        .st-lesson-cover { width:calc(100% + 32px); height:clamp(96px,18vw,150px); margin:-16px -16px 2px; object-fit:cover; display:block; }
        .st-lesson-kicker { margin:0; color:#2A6162; font-size:0.7rem; font-weight:900; letter-spacing:0.1em; text-transform:uppercase; }
        .st-lesson-title { margin:0; color:#2E4A54; font-size:clamp(1.35rem,3vw,1.8rem); font-weight:800; line-height:1.12; }
        .st-lesson-meta { display:flex; flex-wrap:wrap; gap:7px; }
        .st-lesson-pill { border:1px solid #E3D9C2; border-radius:999px; background:#F6F3EC;
          color:var(--bdb-ink); padding:6px 10px; font-size:0.76rem; font-weight:800; }
        .st-warmup-label { margin:0; color:var(--bdb-teal); font-size:0.72rem; font-weight:850; letter-spacing:0.1em; text-transform:uppercase; }
        .st-warmup-copy { margin:0; color:var(--bdb-ink-soft); font-size:0.94rem; font-weight:600; line-height:1.45; }
        .st-warmup-wait { margin:2px 0 0; color:var(--bdb-ink-faint); font-size:0.86rem; font-weight:700; }
        .st-warmup-action { background:var(--bdb-amber); border-color:var(--bdb-amber); color:#3d2a12; font-weight:900;
          box-shadow:0 14px 28px -18px rgba(252,175,56,0.9); }
        .st-warmup-action:hover { border-color:var(--bdb-amber); color:#3d2a12; filter:brightness(1.03); }
        .st-home-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
        @media (max-width:560px) { .st-home-grid { grid-template-columns:1fr; } }
        .st-home-card { display:grid; gap:4px; align-content:start; text-decoration:none; border:1px solid #E3D9C2;
          border-radius:var(--bdb-r); background:#fff; padding:12px 14px; box-shadow:0 2px 10px rgba(40,32,20,0.05);
          transition:border-color 120ms; }
        .st-home-card b { color:var(--bdb-ink); font-weight:800; font-size:0.95rem; }
        .st-home-card span { color:var(--bdb-ink-soft); font-size:0.8rem; font-weight:600; line-height:1.35; }
        a.st-home-card:hover { border-color:var(--bdb-teal); }
        .st-warmup-tools { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
        .st-link-btn { border:0; background:transparent; color:var(--bdb-ink-soft); padding:4px 0; font:inherit;
          font-size:0.82rem; font-weight:750; text-decoration:underline; cursor:pointer; }
        .st-help-code { margin:0; border:1px solid color-mix(in srgb, var(--bdb-amber) 58%, white); border-radius:10px;
          background:color-mix(in srgb, var(--bdb-amber) 12%, white); color:var(--bdb-ink); padding:10px 12px;
          font-size:0.86rem; font-weight:700; line-height:1.4; }
        .st-help-code strong { letter-spacing:0.12em; font-size:1rem; }

        .st-namepick-label { font-size:0.78rem; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:var(--bdb-ink-faint); margin:0 0 10px; }
        .st-names { display:flex; flex-wrap:wrap; gap:8px; }
        .st-name { background:color-mix(in srgb, var(--bdb-teal) 14%, white); border:1px solid color-mix(in srgb, var(--bdb-teal) 35%, white);
          color:#0f5e5f; border-radius:999px; padding:10px 16px; font-weight:600; cursor:pointer; font-size:0.95rem; }
        .st-name:hover { border-color:var(--bdb-teal); }

        .st-explore { display:flex; align-items:center; justify-content:center; gap:8px; text-decoration:none;
          border:1px solid #E3D9C2; border-radius:var(--bdb-r); background:#fff; color:var(--bdb-ink-soft);
          padding:14px 16px; font-weight:600; font-size:0.95rem; box-shadow:0 2px 10px rgba(40,32,20,0.05);
          transition:border-color 120ms, color 120ms; }
        .st-explore:hover { border-color:var(--bdb-coral); color:var(--bdb-ink); }
        .st-explore b { color:var(--bdb-ink); font-weight:700; }

        .st-foot { margin-top:auto; padding-top:26px; }
        .st-teacher { display:inline-flex; align-items:center; min-height:44px; padding:0 10px; color:var(--bdb-ink-soft); font-size:0.78rem; font-weight:600; text-decoration:none; }
      `}</style>

      <div className="st-banner">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/big-dog-logo.svg" alt="Big Dog Math" />
      </div>
      <h1 className="st-hello">Welcome!</h1>
      <p className="st-hello-sub">
        {pendingCode
          ? "This is your home base. Start with the warm-up when it opens."
          : "Enter your class code to start today's lesson."}
      </p>

      <div className="st-cards">
        <div className="st-join">
          {pendingCode ? (
            <div className="st-warmup">
              <section className="st-lesson-card" aria-label="Today's lesson">
                {todayCover && (!sessionLesson?.code || sessionLesson.code === todayCover.lessonCode) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className="st-lesson-cover"
                    src={todayCover.url}
                    alt=""
                    onError={(event) => { event.currentTarget.style.display = "none"; }}
                  />
                )}
                <p className="st-lesson-kicker">Today&apos;s lesson</p>
                <h2 className="st-lesson-title">{sessionLesson?.title || "Your teacher is connecting today's lesson"}</h2>
                <div className="st-lesson-meta">
                  {moduleNumber ? <span className="st-lesson-pill">Module {moduleNumber}</span> : null}
                  {topicNumber ? <span className="st-lesson-pill">Topic {topicNumber}</span> : null}
                  {sessionLesson?.code ? <span className="st-lesson-pill">{sessionLesson.code}</span> : null}
                  <span className="st-lesson-pill">Class {pendingCode}</span>
                </div>
              </section>
              <p className="st-warmup-label">Warm-up</p>
              {warmupHref ? (
                <>
                  <h2 className="st-join-h">{identityReady ? "Warm-up connected" : warmupOpened ? "Warm-up open in your other tab" : "Start today's warm-up"}</h2>
                  <p className="st-warmup-copy">
                    {identityReady
                      ? "Nice work. Read the lesson or play a challenge while class gets ready."
                      : warmupOpened
                        ? "Finish all five questions there and press Submit. Big Dog connects your response on its own."
                        : "Complete all five Google Form questions, then come back here."}
                  </p>
                  <a
                    className={warmupOpened || identityReady ? "st-link-btn" : "st-explore st-warmup-action"}
                    href={warmupHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={markWarmupOpened}
                  >
                    {warmupOpened || identityReady ? "Reopen the warm-up" : "Open today's warm-up"}
                  </a>
                </>
              ) : (
                <>
                  <h2 className="st-join-h">No warm-up loaded yet</h2>
                  <p className="st-warmup-copy">That is fine - it appears here on its own the moment your teacher connects one.</p>
                </>
              )}
              {warmupHref && !identityReady && warmupOpened ? (
                <p className="st-warmup-wait" role="status" aria-live="polite">Watching for your warm-up submission.</p>
              ) : null}
              <div className="st-home-grid">
                {HOME_LINKS.map((link) => (
                  <a key={link.href} className="st-home-card" href={link.href}>
                    <b>{link.title}</b>
                    <span>{link.desc}</span>
                  </a>
                ))}
              </div>
              {joinErr && <div className="st-joinerr" role="alert">{joinErr}</div>}
              {helpRequestCode && (
                <p className="st-help-code" role="status">
                  Tell your teacher this help code: <strong>{helpRequestCode}</strong>
                </p>
              )}
              <div className="st-warmup-tools">
                {!identityReady && !helpRequestCode && (
                  // Always reachable before verification - on a no-form day
                  // the admission request is the ONLY way into the class, so
                  // it must not hide behind the warm-up link existing.
                  <button className="st-link-btn" type="button" onClick={requestTeacherHelp} disabled={requestingHelp}>
                    {requestingHelp ? "Requesting help" : warmupHref ? "Warm-up not connecting? Ask for help" : "Can't join? Ask for help"}
                  </button>
                )}
                <button className="st-link-btn" type="button" onClick={() => resetPendingSession()}>
                  Use a different code
                </button>
              </div>
            </div>
          ) : SECURE_STUDENT_DATA || !joinSess ? (
            <>
              <h2 className="st-join-h">Join your class</h2>
              <p className="st-join-sub">Your teacher will give you a code.</p>
              <div className="st-codebox">
                <input
                  className="st-code-in"
                  value={code}
                  placeholder="CODE"
                  maxLength={8}
                  autoFocus
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submitCode(); }}
                />
                <button className="st-code-btn" onClick={submitCode} disabled={joining}>{joining ? "Checking" : "Join"}</button>
              </div>
              {joinErr && <div className="st-joinerr">{joinErr}</div>}
            </>
          ) : (
            <>
              <p className="st-namepick-label">Tap your alias</p>
              <div className="st-names">
                {roster.length === 0
                  ? <span className="st-joinerr">No students in this class yet.</span>
                  : roster.map((s) => <button key={s.id} className="st-name" onClick={() => pickName(s)}>{s.alias || "Student"}</button>)}
              </div>
            </>
          )}
        </div>

        {!pendingCode && (
          <a className="st-explore" href="/explore">
            <span>Just looking around? <b>Explore the math tools</b></span>
          </a>
        )}
        {!pendingCode && (
          <a className="st-explore" href="/demo">
            <span>Curious what this is? <b>Watch a class period run</b></span>
          </a>
        )}
        {!pendingCode && (
          <a className="st-explore" href="/homework-help">
            <span>Stuck on the assignment? <b>Get unstuck</b></span>
          </a>
        )}
      </div>

      <div className="st-foot">
        <a className="st-teacher" href="/teacher">Teacher</a>
      </div>
    </main>
  );
}
