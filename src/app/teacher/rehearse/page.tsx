"use client";

// Lesson rehearsal - browse every published lesson and run one start to finish
// on the REAL classroom surfaces, with no session and no students.
//
// Why this exists: the Date property decides which lesson goes up automatically,
// and there was previously no way to look at any OTHER lesson in motion without
// editing that date. Now the date governs only the automatic pick; anything in
// the archive can be watched on demand.
//
// WHAT THIS DOES NOT DO, and must never start doing: it opens no session, writes
// no poll row, records no evidence, and publishes nothing to a projector or a
// Chromebook. It is safe to open during another teacher's class. The three
// panes are the actual /teacher/present, /teacher/pace and /live-flow pages in
// studio-preview mode - not copies - so what you see here is what the room gets,
// and a surface redesign can never leave this page showing something stale.
//
// The sequence is built server-side by /api/teacher/rehearse using the SAME
// stepsFromLesson the live start uses (src/lib/lessonFlowBuild.ts). Per-step
// snapshots come from rehearsalFlow.ts, the DB-free twin of navigateFlow.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { STUDIO_PREVIEW_MESSAGE } from "@/lib/studioPreviewFlow";
import { rehearsalSnapshot, rehearsalTotalMinutes, type RehearsalLesson } from "@/lib/rehearsalFlow";
import { STATE_STRIP_SLOTS } from "@/lib/classroomStateStrip";
import { parseStructuredNumericSpec } from "@/lib/structuredNumeric";
import type { LiveClassFlowSnapshot, LiveFlowSequenceStep } from "@/lib/liveClassFlow";

interface ArchiveItem {
  id: string;
  lessonCode: string;
  title: string;
  date: string;
  topic: string;
  module: string;
  moduleTopic: string;
}

const SURFACES = [
  { key: "main", label: "Main projector", src: "/teacher/present?studioPreview=1&embed=1", w: 1600, h: 900 },
  { key: "pace", label: "Pace and support", src: "/teacher/pace?studioPreview=1&embed=1", w: 1600, h: 900 },
  { key: "student", label: "Student Chromebook", src: "/live-flow?studioPreview=1", w: 1280, h: 800 },
] as const;

function clockText(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// One preview pane. Handshakes with the frame, then re-posts on every snapshot
// change plus a slow drip - a frame that finishes loading after the parent has
// already sent its one-shot message would otherwise sit blank forever, which is
// the bug /demo's 700ms drip exists to solve.
function SurfaceFrame({
  src, title, w, h, snapshot,
}: { src: string; title: string; w: number; h: number; snapshot: LiveClassFlowSnapshot | null }) {
  const ref = useRef<HTMLIFrameElement | null>(null);
  const [box, setBox] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const post = useCallback(() => {
    if (!snapshot) return;
    try {
      ref.current?.contentWindow?.postMessage({ type: STUDIO_PREVIEW_MESSAGE, snapshot }, "*");
    } catch { /* the frame is not ready yet; the drip will retry */ }
  }, [snapshot]);

  useEffect(() => {
    const onReady = (event: MessageEvent) => {
      const data = event.data as { type?: string } | null;
      if (data?.type === `${STUDIO_PREVIEW_MESSAGE}-ready`) post();
    };
    window.addEventListener("message", onReady);
    return () => window.removeEventListener("message", onReady);
  }, [post]);

  useEffect(() => { post(); }, [post]);
  useEffect(() => {
    const id = window.setInterval(post, 900);
    return () => window.clearInterval(id);
  }, [post]);

  // Measure the container rather than reading window.innerWidth - inside the
  // in-app browser pane innerWidth reports the frame, not the viewport.
  useEffect(() => {
    const measure = () => setBox(wrapRef.current?.clientWidth ?? 0);
    measure();
    const observer = new ResizeObserver(measure);
    if (wrapRef.current) observer.observe(wrapRef.current);
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, []);

  const scale = box > 0 ? box / w : 0;
  return (
    <div className="rh-surface">
      <div className="rh-surface-label">{title}</div>
      <div className="rh-frame-wrap" ref={wrapRef} style={{ height: scale ? h * scale : undefined }}>
        <iframe
          ref={ref}
          src={src}
          title={title}
          className="rh-frame"
          style={{ width: w, height: h, transform: `scale(${scale || 0.01})` }}
        />
      </div>
    </div>
  );
}

export default function RehearsePage() {
  const [archive, setArchive] = useState<ArchiveItem[]>([]);
  const [archiveError, setArchiveError] = useState("");
  const [query, setQuery] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [data, setData] = useState<RehearsalLesson | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(false);

  const [index, setIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(false);

  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        const res = await fetch("/api/teacher/lessons", { credentials: "same-origin", cache: "no-store" });
        const body = await res.json();
        if (stop) return;
        if (!res.ok) throw new Error(body?.error || "The lesson archive could not be read.");
        setArchive((body.lessons ?? []).filter((item: ArchiveItem) => item.id && (item.lessonCode || item.title)));
      } catch (error) {
        if (!stop) setArchiveError(error instanceof Error ? error.message : "The lesson archive could not be read.");
      }
    })();
    return () => { stop = true; };
  }, []);

  const loadLesson = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    setLoadError("");
    setPlaying(false);
    try {
      const res = await fetch(`/api/teacher/rehearse?id=${encodeURIComponent(id)}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || "That lesson could not be loaded.");
      setData({ lesson: body.lesson, steps: body.steps as LiveFlowSequenceStep[] });
      setIndex(0);
      setSecondsLeft((body.steps as LiveFlowSequenceStep[])[0]?.durationSeconds ?? 0);
    } catch (error) {
      setData(null);
      setLoadError(error instanceof Error ? error.message : "That lesson could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (lessonId) void loadLesson(lessonId); }, [lessonId, loadLesson]);

  // ?lessonId= lets Teacher Home hand a specific lesson straight to the runner,
  // so "Rehearse" beside a lesson opens that lesson rather than an empty picker.
  useEffect(() => {
    try {
      const wanted = new URLSearchParams(window.location.search).get("lessonId");
      if (wanted) setLessonId(wanted);
    } catch { /* no param, the picker starts empty */ }
  }, []);

  const steps = data?.steps ?? [];
  const step: LiveFlowSequenceStep | null = steps[index] ?? null;

  const goTo = useCallback((next: number) => {
    if (!steps.length) return;
    const clamped = Math.max(0, Math.min(steps.length - 1, next));
    setIndex(clamped);
    setSecondsLeft(steps[clamped]?.durationSeconds ?? 0);
  }, [steps]);

  // The local clock drives the readout and the optional auto-advance only. The
  // snapshot carries endsAt, so each surface counts itself down; re-posting a
  // snapshot every second would be three postMessages a second for nothing.
  useEffect(() => {
    if (!playing) return undefined;
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev > 1) return prev - 1;
        if (autoAdvance && index < steps.length - 1) {
          window.setTimeout(() => goTo(index + 1), 0);
          return 0;
        }
        window.setTimeout(() => setPlaying(false), 0);
        return 0;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [playing, autoAdvance, index, steps.length, goTo]);

  const snapshot = useMemo(() => {
    if (!data) return null;
    return rehearsalSnapshot(data, index, { running: playing, secondsLeft });
    // secondsLeft is deliberately NOT a dependency: including it would rebuild
    // and re-post the snapshot every tick. Play/pause and step changes are the
    // only moments the surfaces need a fresh one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, index, playing]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items = q
      ? archive.filter((item) => `${item.lessonCode} ${item.title} ${item.topic} ${item.date}`.toLowerCase().includes(q))
      : archive;
    const groups = new Map<string, ArchiveItem[]>();
    for (const item of items) {
      const key = item.moduleTopic || item.module || item.topic || "Other";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    for (const list of groups.values()) {
      list.sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999") || a.lessonCode.localeCompare(b.lessonCode));
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [archive, query]);

  const totalMinutes = useMemo(() => (steps.length ? rehearsalTotalMinutes(steps) : 0), [steps]);

  // Problems worth knowing about BEFORE the lesson is in front of students.
  // A rehearsal is exactly where these should surface, so unlike the live start
  // they are reported rather than thrown.
  const stepWarnings = useMemo(() => {
    if (!step) return [] as string[];
    const notes: string[] = [];
    if (step.pollKind === "structured-numeric") {
      const parsed = parseStructuredNumericSpec(step.correctAnswer);
      if (!parsed.ok) notes.push(`The Structured Numeric answer spec will not parse. ${parsed.errors[0]} Starting this lesson for real would fail here.`);
    }
    const filledSlots = STATE_STRIP_SLOTS.filter((slot) => String(step[slot] || "").trim());
    if (filledSlots.length && filledSlots.length < STATE_STRIP_SLOTS.length) {
      notes.push(`The classroom state strip is part-filled (${filledSlots.join(", ")}), so no strip renders at all. Fill all four or clear them.`);
    }
    if (step.pollKind && !step.question.trim() && step.pollKind !== "fist-to-five") {
      notes.push("This step opens a response box with no authored Question.");
    }
    return notes;
  }, [step]);

  return (
    <div className="rh-root">
      <style>{`
        .rh-root { font-family: var(--bdb-font); color: var(--bdb-ink); background: var(--bdb-ground); min-height: 100vh; padding: 14px clamp(12px,2vw,24px) 40px; }
        .rh-top { max-width: 1700px; margin: 0 auto 14px; display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; }
        .rh-title { font-size: clamp(1.1rem,2vw,1.5rem); font-weight: 800; margin: 0; letter-spacing: -0.02em; }
        .rh-sub { margin: 3px 0 0; font-size: 0.85rem; font-weight: 600; color: var(--bdb-ink-soft); }
        .rh-safe { display:inline-block; margin-left:8px; padding:2px 9px; border-radius:999px; font-size:0.7rem; font-weight:800;
                   letter-spacing:0.06em; text-transform:uppercase; background:#e7f4ee; color:#1f7a52; border:1px solid #b9e0cd; }
        .rh-grid { max-width: 1700px; margin: 0 auto; display: grid; gap: 14px;
                   grid-template-columns: minmax(240px,290px) minmax(0,1fr) minmax(230px,280px); align-items: start; }
        @media (max-width: 1280px) { .rh-grid { grid-template-columns: 1fr; } }
        .rh-card { background: var(--bdb-card); border: 1px solid var(--bdb-line); border-radius: var(--bdb-r-sm);
                   box-shadow: var(--bdb-shadow-sm); padding: 12px; }
        .rh-card + .rh-card { margin-top: 12px; }
        .rh-eyebrow { font-size: 0.68rem; letter-spacing: 0.09em; text-transform: uppercase; font-weight: 800;
                      color: var(--bdb-ink-soft); margin: 0 0 8px; }
        .rh-input, .rh-select { font-family: inherit; font-weight: 700; font-size: 0.9rem; width: 100%; min-height: 44px;
                    padding: 0 10px; border-radius: var(--bdb-r-sm); border: 1px solid var(--bdb-line);
                    background: #fff; color: var(--bdb-ink); }
        .rh-steps { list-style: none; margin: 8px 0 0; padding: 0; max-height: 60vh; overflow: auto; }
        .rh-step { display: flex; gap: 8px; align-items: center; width: 100%; text-align: left; cursor: pointer;
                   font-family: inherit; border: 1px solid transparent; background: none; border-radius: 8px;
                   padding: 7px 8px; min-height: 44px; }
        .rh-step:hover { background: color-mix(in srgb, var(--bdb-amber) 14%, transparent); }
        .rh-step.on { background: var(--bdb-ink); }
        .rh-step.on .rh-step-name, .rh-step.on .rh-step-min { color: #fff; }
        .rh-swatch { width: 6px; align-self: stretch; border-radius: 999px; flex: none; }
        .rh-step-n { font-size: 0.72rem; font-weight: 800; color: var(--bdb-ink-faint); width: 1.6ch; flex: none; }
        .rh-step.on .rh-step-n { color: #bdb3a2; }
        .rh-step-name { font-size: 0.82rem; font-weight: 700; line-height: 1.25; flex: 1 1 auto; }
        .rh-step-min { font-size: 0.72rem; font-weight: 800; color: var(--bdb-ink-soft); flex: none; }
        .rh-surface + .rh-surface { margin-top: 12px; }
        .rh-surface-label { font-size: 0.68rem; letter-spacing: 0.09em; text-transform: uppercase; font-weight: 800;
                            color: var(--bdb-ink-soft); margin-bottom: 5px; }
        .rh-frame-wrap { position: relative; overflow: hidden; border: 1px solid var(--bdb-line);
                         border-radius: var(--bdb-r-sm); background: #fff; box-shadow: var(--bdb-shadow-sm); }
        .rh-frame { border: 0; display: block; transform-origin: top left; }
        .rh-transport { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 12px 0;
                        background: var(--bdb-card); border: 1px solid var(--bdb-line); border-radius: var(--bdb-r-sm);
                        box-shadow: var(--bdb-shadow-sm); padding: 10px 12px; }
        .rh-btn { font-family: inherit; font-weight: 700; cursor: pointer; border-radius: 999px;
                  border: 1px solid var(--bdb-line); background: #fff; color: var(--bdb-ink); min-height: 44px;
                  padding: 0 15px; font-size: 0.86rem; }
        .rh-btn:hover:not(:disabled) { background: color-mix(in srgb, var(--bdb-amber) 18%, transparent); }
        .rh-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .rh-btn.solid { background: var(--bdb-ink); color: #fff; border-color: var(--bdb-ink); }
        .rh-clock { font-size: 1.7rem; font-weight: 800; letter-spacing: -0.02em; font-variant-numeric: tabular-nums;
                    min-width: 3.6ch; }
        .rh-pos { font-size: 0.8rem; font-weight: 700; color: var(--bdb-ink-soft); }
        .rh-spacer { flex: 1 1 auto; }
        .rh-toggle { display: inline-flex; align-items: center; gap: 7px; font-size: 0.82rem; font-weight: 700;
                     cursor: pointer; min-height: 44px; }
        .rh-meta { font-size: 0.8rem; font-weight: 600; line-height: 1.5; }
        .rh-meta b { display: block; font-size: 0.66rem; letter-spacing: 0.08em; text-transform: uppercase;
                     color: var(--bdb-ink-soft); font-weight: 800; margin-top: 9px; }
        .rh-warn { border: 1px solid #f0cfa4; border-left: 4px solid var(--bdb-amber); background: #fffaf0;
                   border-radius: var(--bdb-r-sm); padding: 9px 11px; font-size: 0.8rem; font-weight: 700;
                   line-height: 1.45; margin-top: 8px; }
        .rh-err { border: 1px solid #f3bfb2; border-left: 4px solid var(--bdb-coral); background: #fff5f2;
                  border-radius: var(--bdb-r-sm); padding: 9px 11px; font-size: 0.82rem; font-weight: 700; }
        .rh-empty { font-size: 0.86rem; font-weight: 600; color: var(--bdb-ink-soft); line-height: 1.55; }
      `}</style>

      <div className="rh-top">
        <div>
          <h1 className="rh-title">
            Lesson rehearsal
            <span className="rh-safe">No session</span>
          </h1>
          <p className="rh-sub">
            Run any published lesson on the real screens. Nothing here reaches a projector, a Chromebook, or the gradebook, and no date changes.
          </p>
        </div>
      </div>

      <div className="rh-grid">
        <div>
          <div className="rh-card">
            <p className="rh-eyebrow">Every published lesson</p>
            <input
              className="rh-input"
              placeholder="Search code, title, topic, date"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select
              className="rh-select"
              style={{ marginTop: 8 }}
              value={lessonId}
              onChange={(event) => setLessonId(event.target.value)}
            >
              <option value="">
                {archive.length ? `Choose one of ${archive.length} lessons` : "Loading lessons"}
              </option>
              {filtered.map(([group, items]) => (
                <optgroup key={group} label={group}>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {[item.lessonCode, item.title].filter(Boolean).join(" ")}{item.date ? ` (${item.date})` : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {archiveError && <div className="rh-err" style={{ marginTop: 8 }}>{archiveError}</div>}
            {loadError && <div className="rh-err" style={{ marginTop: 8 }}>{loadError}</div>}
          </div>

          {steps.length > 0 && (
            <div className="rh-card">
              <p className="rh-eyebrow">
                The lineup - {steps.length} states, {totalMinutes} min
              </p>
              <ul className="rh-steps">
                {steps.map((item, i) => (
                  <li key={`${item.notionStepId || item.label}-${i}`}>
                    <button
                      type="button"
                      className={`rh-step${i === index ? " on" : ""}`}
                      onClick={() => { setPlaying(false); goTo(i); }}
                    >
                      <span className="rh-swatch" style={{ background: item.color }} />
                      <span className="rh-step-n">{i + 1}</span>
                      <span className="rh-step-name">{item.label}</span>
                      <span className="rh-step-min">{Math.round(item.durationSeconds / 60)}m</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div>
          <div className="rh-transport">
            <button type="button" className="rh-btn" onClick={() => { setPlaying(false); goTo(0); }} disabled={!steps.length}>
              Restart
            </button>
            <button type="button" className="rh-btn" onClick={() => { setPlaying(false); goTo(index - 1); }} disabled={!steps.length || index === 0}>
              Back
            </button>
            <button
              type="button"
              className="rh-btn solid"
              onClick={() => setPlaying((was) => !was)}
              disabled={!steps.length}
            >
              {playing ? "Pause" : "Play"}
            </button>
            <button type="button" className="rh-btn" onClick={() => { setPlaying(false); goTo(index + 1); }} disabled={!steps.length || index >= steps.length - 1}>
              Next
            </button>
            <span className="rh-clock">{clockText(secondsLeft)}</span>
            <span className="rh-pos">{steps.length ? `State ${index + 1} of ${steps.length}` : "No lesson loaded"}</span>
            <span className="rh-spacer" />
            <label className="rh-toggle">
              <input type="checkbox" checked={autoAdvance} onChange={(event) => setAutoAdvance(event.target.checked)} />
              Auto-advance
            </label>
          </div>

          {loading && <div className="rh-card rh-empty">Reading the lesson from Notion.</div>}
          {!loading && !steps.length && (
            <div className="rh-card rh-empty">
              Pick a lesson to watch it run. The date in Notion still decides which lesson goes up on its own - this only lets you look at any of them, any time.
            </div>
          )}

          {steps.length > 0 && SURFACES.map((surface) => (
            <SurfaceFrame
              key={surface.key}
              src={surface.src}
              title={surface.label}
              w={surface.w}
              h={surface.h}
              snapshot={snapshot}
            />
          ))}
        </div>

        <div>
          {step && (
            <div className="rh-card">
              <p className="rh-eyebrow">This state</p>
              <div className="rh-meta">
                <b>State id</b>{step.stateId}
                <b>Response mode</b>{step.responseMode || "None"}
                {step.pollKind && (<><b>Opens</b>{step.pollKind}</>)}
                {step.standard && (<><b>Standard</b>{step.standard}</>)}
                {step.resourceUrl && (<><b>Resource</b>{step.resourceUrl}</>)}
                {step.paperTask && (<><b>Paper task</b>{step.paperTask}</>)}
                {step.question && (<><b>Question</b>{step.question}</>)}
              </div>
              {stepWarnings.map((note) => (
                <div key={note} className="rh-warn">{note}</div>
              ))}
            </div>
          )}
          {data?.lesson && (
            <div className="rh-card">
              <p className="rh-eyebrow">Lesson</p>
              <div className="rh-meta">
                <b>Code</b>{data.lesson.code || "None"}
                <b>Learning intention</b>{data.lesson.learningIntention || "Not set"}
                <b>Success criterion</b>{data.lesson.selectedSuccessCriterion || "Not set"}
                {data.lesson.anchorProblem && (<><b>Anchor problem</b>{data.lesson.anchorProblem}</>)}
              </div>
              {totalMinutes > 50 && (
                <div className="rh-warn">
                  This lineup adds up to {totalMinutes} minutes. The period is 50.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
