"use client";

// The public mock run-through: the room, running. Every pane below is a REAL
// classroom surface (the same components the projectors, Chromebooks, and
// back-of-room TVs render) embedded in a scaled iframe and driven through a
// scripted, fully fictional lesson via the studio-preview bridge. No auth, no
// database - the surfaces fetch nothing in preview mode.

import { useCallback, useEffect, useRef, useState } from "react";
import { DEMO_SCENES, DEMO_WEEK, type DemoPollAnswer } from "@/lib/demoLesson";
import { STUDIO_PREVIEW_MESSAGE } from "@/lib/studioPreviewFlow";

const REPO_URL = "https://github.com/Wilsos22/Big-Dog-Math";

interface FramePayload {
  snapshot?: object;
  pollAnswers?: DemoPollAnswer[];
  weeklyDisplay?: object;
}

function DemoFrame({ src, payload, baseW, baseH, title }: {
  src: string;
  payload: FramePayload;
  baseW: number;
  baseH: number;
  title: string;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const readyRef = useRef(false);
  const [scale, setScale] = useState(0.3);

  useEffect(() => {
    const measure = () => {
      const w = boxRef.current?.clientWidth;
      if (w) setScale(w / baseW);
    };
    measure();
    const retry = window.setInterval(measure, 400);
    const stop = window.setTimeout(() => window.clearInterval(retry), 5000);
    window.addEventListener("resize", measure);
    return () => {
      window.clearInterval(retry);
      window.clearTimeout(stop);
      window.removeEventListener("resize", measure);
    };
  }, [baseW]);

  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  const post = useCallback(() => {
    if (!readyRef.current) return;
    frameRef.current?.contentWindow?.postMessage({ type: STUDIO_PREVIEW_MESSAGE, ...payload }, "*");
  }, [payload]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      if ((event.data as { type?: string })?.type === `${STUDIO_PREVIEW_MESSAGE}-ready`) {
        readyRef.current = true;
        post();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [post]);

  useEffect(() => { post(); }, [post]);

  // A frame that finished loading before this component mounted has already
  // sent its one-shot ready and will never announce again - so also deliver
  // on a steady drip that does not depend on the handshake. Repeat snapshots
  // are harmless to the surfaces.
  useEffect(() => {
    const drip = window.setInterval(() => {
      frameRef.current?.contentWindow?.postMessage(
        { type: STUDIO_PREVIEW_MESSAGE, ...payloadRef.current },
        "*",
      );
    }, 700);
    return () => window.clearInterval(drip);
  }, []);

  return (
    <div ref={boxRef} className="dm-frame-box" style={{ aspectRatio: `${baseW} / ${baseH}` }} aria-label={title}>
      <iframe
        ref={frameRef}
        className="dm-frame"
        src={src}
        title={title}
        style={{ width: baseW, height: baseH, transform: `scale(${scale})` }}
      />
    </div>
  );
}

export default function DemoClient() {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [finished, setFinished] = useState(false);
  const [mockAnswers, setMockAnswers] = useState<DemoPollAnswer[]>([]);
  const trickleTimers = useRef<number[]>([]);
  const scene = DEMO_SCENES[sceneIndex];

  const clearTrickle = () => {
    for (const t of trickleTimers.current) window.clearTimeout(t);
    trickleTimers.current = [];
  };

  // Each scene: trickle the fictional class's answers in on the scripted
  // clock so the wall fills while the visitor watches. A scene that shares
  // its poll with the previous scene (the results flip) KEEPS the answers -
  // clearing there would show an empty tally.
  const prevPollId = useRef<string | null>(null);
  useEffect(() => {
    clearTrickle();
    const pollId = scene.snapshot.poll?.id ?? null;
    const samePoll = pollId !== null && pollId === prevPollId.current;
    prevPollId.current = pollId;
    if (scene.answerScript) {
      setMockAnswers([]);
      scene.answerScript.forEach((entry, i) => {
        trickleTimers.current.push(window.setTimeout(() => {
          setMockAnswers((prev) => [...prev, { id: `demo-answer-${sceneIndex}-${i}`, answer: entry.answer }]);
        }, entry.atMs));
      });
    } else if (!samePoll) {
      setMockAnswers([]);
    }
    return clearTrickle;
  }, [sceneIndex, scene]);

  // Autoplay.
  useEffect(() => {
    if (!playing || finished) return;
    const t = window.setTimeout(() => {
      if (sceneIndex < DEMO_SCENES.length - 1) setSceneIndex((i) => i + 1);
      else {
        setFinished(true);
        setPlaying(false);
      }
    }, scene.durationMs);
    return () => window.clearTimeout(t);
  }, [playing, finished, sceneIndex, scene]);

  function next() {
    if (sceneIndex < DEMO_SCENES.length - 1) setSceneIndex((i) => i + 1);
    else { setFinished(true); setPlaying(false); }
  }
  function back() {
    setFinished(false);
    setSceneIndex((i) => Math.max(0, i - 1));
  }
  function restart() {
    setFinished(false);
    setSceneIndex(0);
    setPlaying(true);
  }

  const lessonPayload: FramePayload = { snapshot: scene.snapshot, pollAnswers: mockAnswers };
  const studentPayload: FramePayload = { snapshot: scene.snapshot };
  const weekPayload: FramePayload = { weeklyDisplay: DEMO_WEEK };

  return (
    <main className="dm-page" data-scene={sceneIndex} data-answers={mockAnswers.length}>
      <style>{`
        .dm-page { min-height:100vh; background:var(--bdb-ground); background-image:radial-gradient(rgba(103,74,64,0.16) 1.1px, transparent 1.1px); background-size:26px 26px; font-family:var(--bdb-font); color:var(--bdb-ink); padding:0 clamp(14px,3vw,40px) 60px; }
        .dm-head { display:flex; align-items:center; gap:14px; flex-wrap:wrap; padding:22px 0 6px; }
        .dm-logo { width:44px; height:44px; object-fit:contain; }
        .dm-head h1 { margin:0; font-size:clamp(1.2rem,2.6vw,1.8rem); font-weight:800; letter-spacing:-0.02em; }
        .dm-head-sub { margin:2px 0 0; color:var(--bdb-ink-soft); font-size:0.95rem; max-width:760px; }
        .dm-links { margin-left:auto; display:flex; gap:8px; flex-wrap:wrap; }
        .dm-link { text-decoration:none; color:var(--bdb-ink); background:#fff; border:1px solid var(--bdb-line); border-radius:999px; padding:9px 16px; font-weight:700; font-size:0.85rem; }
        .dm-link:hover { border-color:var(--bdb-amber); }
        .dm-controls { position:sticky; top:0; z-index:20; display:flex; align-items:center; gap:10px; flex-wrap:wrap; padding:12px 14px; margin:12px 0 16px; background:rgba(255,255,255,0.9); backdrop-filter:blur(10px); border:1px solid var(--bdb-line); border-radius:16px; box-shadow:0 10px 30px rgba(40,32,20,0.08); }
        .dm-dots { display:flex; gap:6px; }
        .dm-dot { width:26px; height:10px; border-radius:999px; border:1px solid rgba(32,30,26,0.25); background:transparent; cursor:pointer; padding:0; }
        .dm-dot.on { border-color:transparent; }
        .dm-btn { font:inherit; font-weight:800; font-size:0.88rem; min-height:42px; padding:0 16px; border-radius:999px; border:1px solid var(--bdb-line); background:#fff; color:var(--bdb-ink); cursor:pointer; }
        .dm-btn.primary { background:var(--bdb-amber); border-color:var(--bdb-amber); }
        .dm-btn:disabled { opacity:0.4; cursor:default; }
        .dm-remote-hint { color:var(--bdb-ink-faint); font-size:0.78rem; font-weight:700; }
        .dm-caption { flex-basis:100%; margin:2px 2px 0; font-size:clamp(0.95rem,1.6vw,1.08rem); color:var(--bdb-ink); }
        .dm-caption b { color:var(--bdb-coral-deep, #c93818); }
        .dm-stage { display:grid; grid-template-columns:minmax(0,1.85fr) minmax(0,1fr); gap:16px; }
        .dm-pane { background:#fff; border:1px solid var(--bdb-line); border-radius:16px; padding:10px 10px 8px; box-shadow:0 14px 34px rgba(40,32,20,0.10); }
        .dm-pane-label { display:flex; align-items:baseline; gap:8px; margin:2px 4px 8px; }
        .dm-pane-label h2 { margin:0; font-size:0.72rem; font-weight:850; letter-spacing:0.12em; text-transform:uppercase; color:var(--bdb-ink-soft); }
        .dm-pane-label span { color:var(--bdb-ink-faint); font-size:0.72rem; font-weight:600; }
        .dm-frame-box { position:relative; width:100%; overflow:hidden; border-radius:10px; background:#f3f0e7; }
        .dm-frame { position:absolute; top:0; left:0; border:0; transform-origin:top left; background:#f3f0e7; }
        .dm-side { display:flex; flex-direction:column; gap:16px; }
        .dm-student-row { margin-top:16px; display:grid; grid-template-columns:minmax(0,1.4fr) minmax(0,1fr); gap:16px; align-items:start; }
        .dm-end { position:fixed; inset:0; z-index:40; display:grid; place-items:center; background:rgba(32,30,26,0.55); padding:20px; }
        .dm-end-card { max-width:560px; background:var(--bdb-ground); border-radius:20px; padding:30px 34px; box-shadow:0 30px 80px rgba(0,0,0,0.35); }
        .dm-end-card h2 { margin:0 0 10px; font-size:1.5rem; font-weight:800; letter-spacing:-0.02em; }
        .dm-end-card p { margin:0 0 14px; color:var(--bdb-ink-soft); line-height:1.55; }
        .dm-end-actions { display:flex; gap:10px; flex-wrap:wrap; margin-top:6px; }
        @media (max-width: 980px) {
          .dm-stage, .dm-student-row { grid-template-columns:1fr; }
          .dm-links { margin-left:0; }
        }
      `}</style>

      <header className="dm-head">
        <img className="dm-logo" src="/big-dog-mark.png" alt="" />
        <div>
          <h1>Watch a class period run</h1>
          <p className="dm-head-sub">
            These are the real classroom surfaces - the same components on the projectors,
            Chromebooks, and back-of-room TVs - driven by a scripted mock lesson. Fictional
            class, live software, no login.
          </p>
        </div>
        <nav className="dm-links">
          <a className="dm-link" href="/explore">Try the tools</a>
          <a className="dm-link" href="/">The site</a>
          <a className="dm-link" href={REPO_URL} target="_blank" rel="noreferrer">The code</a>
        </nav>
      </header>

      <div className="dm-controls">
        <div className="dm-dots" role="tablist" aria-label="Lesson states">
          {DEMO_SCENES.map((s, i) => (
            <button
              key={s.id}
              className={`dm-dot${i === sceneIndex ? " on" : ""}`}
              style={i <= sceneIndex ? { background: s.snapshot.state?.color || "#999" } : undefined}
              aria-label={s.title}
              onClick={() => { setFinished(false); setSceneIndex(i); }}
            />
          ))}
        </div>
        <button className="dm-btn" onClick={back} disabled={sceneIndex === 0}>Back</button>
        <button className="dm-btn" onClick={() => setPlaying((p) => !p)}>{playing ? "Pause" : "Play"}</button>
        <button className="dm-btn primary" onClick={next}>Next - advance the room</button>
        <span className="dm-remote-hint">You are holding the teacher&apos;s remote. Step {sceneIndex + 1} of {DEMO_SCENES.length}: {scene.title}.</span>
        <p className="dm-caption">{scene.caption}</p>
      </div>

      <div className="dm-stage">
        <section className="dm-pane">
          <div className="dm-pane-label"><h2>Main projector</h2><span>the front wall</span></div>
          <DemoFrame src="/demo/present?studioPreview=1&embed=1" payload={lessonPayload} baseW={1280} baseH={720} title="Main projector" />
        </section>
        <div className="dm-side">
          <section className="dm-pane">
            <div className="dm-pane-label"><h2>Support projector</h2><span>pacing the room</span></div>
            <DemoFrame src="/demo/pace?studioPreview=1&embed=1" payload={studentPayload} baseW={1280} baseH={720} title="Support projector" />
          </section>
          <section className="dm-pane">
            <div className="dm-pane-label"><h2>All-day boards</h2><span>two TVs in the back, rotating all day</span></div>
            <DemoFrame src="/weekly-display?studioPreview=1" payload={weekPayload} baseW={1280} baseH={720} title="All-day boards" />
          </section>
        </div>
      </div>

      <div className="dm-student-row">
        <section className="dm-pane">
          <div className="dm-pane-label"><h2>A student Chromebook</h2><span>live - try answering the quick check yourself</span></div>
          <DemoFrame src="/live-flow?studioPreview=1" payload={studentPayload} baseW={1000} baseH={700} title="Student Chromebook" />
        </section>
        <section className="dm-pane" style={{ alignSelf: "start" }}>
          <div className="dm-pane-label"><h2>What you are seeing</h2></div>
          <div style={{ padding: "2px 6px 10px", color: "var(--bdb-ink-soft)", fontSize: "0.92rem", lineHeight: 1.6 }}>
            <p style={{ margin: "0 0 10px" }}>
              One live lesson state machine drives five screens at once. The teacher advances
              it from an iPad or phone; in this demo, the Next button is you.
            </p>
            <p style={{ margin: "0 0 10px" }}>
              The student pane receives a redacted snapshot through the same privacy module as
              production - correct answers and teacher notes physically cannot reach it, and
              your demo answer joins no tally.
            </p>
            <p style={{ margin: 0 }}>
              In the real room, every response you see landing becomes evidence: mastery bars,
              misconception clusters, and live grouping the teacher acts on mid-lesson.
            </p>
          </div>
        </section>
      </div>

      {finished && (
        <div className="dm-end" role="dialog" aria-label="Demo finished">
          <div className="dm-end-card">
            <h2>That was one period.</h2>
            <p>
              Five surfaces, one state machine, every response stored as evidence - designed,
              built, and run daily by one classroom teacher. The manipulatives are public,
              the code is open, and the room does this five periods a day.
            </p>
            <div className="dm-end-actions">
              <button className="dm-btn primary" onClick={restart}>Watch it again</button>
              <a className="dm-link" href="/explore">Try the tools</a>
              <a className="dm-link" href={REPO_URL} target="_blank" rel="noreferrer">Read the code</a>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
