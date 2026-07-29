"use client";

/**
 * Homework help - the assignment's Help Path, ONE STEP AT A TIME.
 *
 * Reached from the Stuck button on the student homepage. This is the surface for
 * a student who was ABSENT or who is doing homework - no live session, no join,
 * 8pm at a kitchen table. It reads the lesson's existing `Help Path` property
 * through the public /api/today, so a new assignment needs zero new authoring.
 *
 * Steele's constraint, stated directly: sixth graders ignore a wall of
 * supports, and a list is a wall. So this is one step per screen and one
 * button, never a list, and there is deliberately NO "I am stuck, skip it"
 * exit - an escape hatch cheaper than the work gets used instead of the work.
 * Every step is a concrete action; none asks a tired student to assess their
 * own understanding.
 *
 * When the lesson's tool is the Distributive Area Method AND the authored help
 * path is the six-step shape that method has, the SAME authored steps are handed
 * to DistributiveWalkthrough, which draws the method as the student advances.
 * The words are still Notion's; the animation is what this page adds. Anything
 * else - a different tool, a path of another length - renders as the plain
 * one-step-per-screen list below, because the stage draws six specific things
 * and illustrating some other routine with a distributive picture would be
 * worse than not animating at all.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import DistributiveWalkthrough from "@/components/DistributiveWalkthrough";
import { liveAssignedToolRoute } from "@/lib/liveFlowContract";
import {
  DEFAULT_WALKTHROUGH,
  parseHelpPath,
  walkthroughStepsFromHelpPath,
} from "@/lib/distributiveWalkthrough";

type TodayLesson = {
  id?: string;
  title?: string;
  lessonCode?: string;
  helpPath?: string;
  tools?: string;
};

/**
 * Does tonight's lesson use the tool this walkthrough animates? Read off the
 * lesson's authored `Tools` list through the shared resolver, so "Distributive
 * Area", "Distributive Area Method" and "... - optional support" all count.
 */
function usesDistributiveTool(tools: string | undefined): boolean {
  return (tools || "")
    .split(/\r?\n/)
    .some((line) => liveAssignedToolRoute(line.trim()) === "/distributive-area");
}

type LoadState = "loading" | "ready" | "empty" | "error";

function progressKey(lessonId: string) {
  return `bdm-help-path:${lessonId}`;
}

export default function HomeworkHelpPage() {
  const [state, setState] = useState<LoadState>("loading");
  const [lesson, setLesson] = useState<TodayLesson | null>(null);
  const [steps, setSteps] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/today", { cache: "no-store" });
        if (!response.ok) throw new Error("today unavailable");
        const result = await response.json() as { lesson?: TodayLesson | null };
        if (cancelled) return;
        const parsed = parseHelpPath(result.lesson?.helpPath);
        setLesson(result.lesson || null);
        setSteps(parsed);
        setState(parsed.length ? "ready" : "empty");
        // Pick up where they left off, so closing the tab to go get a pencil
        // does not cost them the walk back through every step.
        const lessonId = result.lesson?.id;
        if (lessonId) {
          try {
            const stored = Number(localStorage.getItem(progressKey(lessonId)));
            if (Number.isFinite(stored) && stored > 0 && stored < parsed.length) setIndex(stored);
          } catch { /* ignore */ }
        }
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Record how far into the sequence the student actually got. Device-local:
  // this route has no join and no identity by design, so nothing here is tied
  // to a student, and nothing leaves the device.
  const remember = useCallback((next: number) => {
    if (!lesson?.id) return;
    try {
      const previous = Number(localStorage.getItem(progressKey(lesson.id))) || 0;
      if (next > previous) localStorage.setItem(progressKey(lesson.id), String(next));
    } catch { /* ignore */ }
  }, [lesson?.id]);

  // The authored steps, animated - null whenever this lesson is not the one the
  // stage can draw, which is the signal to fall through to the plain list.
  const animated = useMemo(() => {
    if (state !== "ready" || !usesDistributiveTool(lesson?.tools)) return null;
    return walkthroughStepsFromHelpPath(DEFAULT_WALKTHROUGH, lesson?.helpPath);
  }, [state, lesson?.tools, lesson?.helpPath]);

  if (animated) {
    return (
      <DistributiveWalkthrough
        problem={DEFAULT_WALKTHROUGH}
        steps={animated}
        closeLabel="Home"
        onClose={() => { window.location.href = "/"; }}
        onComplete={() => remember(steps.length)}
      />
    );
  }

  function goNext() {
    if (index + 1 >= steps.length) {
      remember(steps.length);
      setFinished(true);
      return;
    }
    const next = index + 1;
    setIndex(next);
    remember(next);
  }

  const stepText = steps[index] || "";

  return (
    <main className="hh-root">
      <style>{`
        .hh-root { min-height:100dvh; box-sizing:border-box; display:flex; flex-direction:column;
          background:var(--bdb-ground); color:var(--bdb-ink); font-family:var(--bdb-font);
          padding:24px 20px 32px; }
        .hh-top { display:flex; align-items:center; justify-content:space-between; gap:12px; }
        .hh-eyebrow { margin:0; color:var(--bdb-ink-soft); font-size:0.78rem; font-weight:900;
          text-transform:uppercase; letter-spacing:0.08em; }
        .hh-home { color:var(--bdb-ink-soft); font-size:0.82rem; font-weight:700; text-decoration:none;
          min-height:44px; display:inline-flex; align-items:center; }
        .hh-home:hover { color:var(--bdb-ink); }
        .hh-stage { flex:1; display:flex; flex-direction:column; align-items:center;
          justify-content:center; gap:26px; width:min(100%,720px); margin:0 auto; text-align:center; }
        .hh-count { margin:0; color:var(--bdb-ink-soft); font-size:0.82rem; font-weight:900;
          text-transform:uppercase; letter-spacing:0.06em; }
        .hh-step { margin:0; color:var(--bdb-ink); font-size:clamp(1.5rem,4.6vw,2.5rem);
          font-weight:800; line-height:1.3; }
        .hh-next { width:min(100%,420px); min-height:66px; border:0; border-radius:var(--bdb-r);
          background:var(--bdb-coral-deep); color:#fff; font:inherit; font-size:1.15rem; font-weight:800;
          cursor:pointer; box-shadow:0 3px 14px rgba(40,32,20,0.12); }
        .hh-next:hover, .hh-next:focus-visible { background:var(--bdb-coral); outline:none; }
        .hh-back { border:0; background:transparent; color:var(--bdb-ink-soft); font:inherit;
          font-size:0.86rem; font-weight:700; text-decoration:underline; cursor:pointer; min-height:44px; }
        .hh-back:hover { color:var(--bdb-ink); }
        .hh-track { display:flex; gap:6px; justify-content:center; }
        .hh-pip { width:9px; height:9px; border-radius:50%; background:var(--bdb-line); }
        .hh-pip.done { background:var(--bdb-amber); }
        .hh-pip.here { background:var(--bdb-coral-deep); }
        .hh-note { margin:0; color:var(--bdb-ink-soft); font-size:1rem; font-weight:600; line-height:1.5; }
        .hh-title { margin:0; color:var(--bdb-ink-soft); font-size:0.9rem; font-weight:700; }
      `}</style>

      <div className="hh-top">
        <p className="hh-eyebrow">Homework help</p>
        <a className="hh-home" href="/">Home</a>
      </div>

      <div className="hh-stage">
        {state === "loading" ? (
          <p className="hh-note">Getting tonight&rsquo;s steps.</p>
        ) : state === "error" ? (
          <p className="hh-note">Tonight&rsquo;s steps could not load. Check your connection and try again.</p>
        ) : state === "empty" ? (
          /* Empty renders as nothing honest, never as invented advice: a made-up
             help path would send a student down a route their teacher did not
             write. */
          <p className="hh-note">There are no help steps posted for tonight.</p>
        ) : finished ? (
          <>
            <p className="hh-count">That&rsquo;s the whole routine</p>
            <p className="hh-step">You have everything you need. Go finish it.</p>
            <button className="hh-back" type="button" onClick={() => { setFinished(false); setIndex(0); }}>
              Walk through it again
            </button>
          </>
        ) : (
          <>
            {lesson?.title ? <p className="hh-title">{lesson.title}</p> : null}
            <p className="hh-count">Step {index + 1} of {steps.length}</p>
            <p className="hh-step">{stepText}</p>
            {/* ONE button. The step is the only thing on the screen. */}
            <button className="hh-next" type="button" onClick={goNext}>
              {index + 1 >= steps.length ? "I did that" : "I did that - what's next"}
            </button>
            {/* Back re-reads the step just done. It is not an escape hatch:
                it costs more than doing the work, not less. */}
            {index > 0 ? (
              <button className="hh-back" type="button" onClick={() => setIndex(index - 1)}>
                Show the step before
              </button>
            ) : null}
            <div className="hh-track" aria-hidden="true">
              {steps.map((step, pip) => (
                <span
                  className={`hh-pip${pip < index ? " done" : pip === index ? " here" : ""}`}
                  key={step + pip}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
