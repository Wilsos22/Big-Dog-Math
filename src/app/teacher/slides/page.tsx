"use client";

// Slide extras editor - the Canva-lite layer over the auto-generated slides.
// Pick a lesson and a step, place text, math-font equations, shapes, and
// images over a stage that stands in for the auto slide, and save the layout
// to the step's Slide Overlay property in Notion. The projector renders the
// same layout above the real slide through the live-flow snapshot.

import { useEffect, useMemo, useState } from "react";
import SiteNav from "@/components/SiteNav";
import SlideExtrasEditor from "@/components/SlideExtrasEditor";
import { teacherApiRequest } from "@/lib/teacherApi";
import {
  parseSlideOverlay,
  serializeSlideOverlay,
  type SlideOverlayElement,
} from "@/lib/slideOverlay";

interface LessonListItem { id: string; lessonCode: string; title: string }
interface LessonStepItem {
  id: string;
  title: string;
  stateId: string;
  mainDisplay?: string;
  studentDirections?: string;
  slideOverlay?: string;
}
interface EditableStepResponse {
  step: { id: string; lastEditedTime: string; slideOverlay?: string };
}

export default function SlideExtrasPage() {
  const [lessons, setLessons] = useState<LessonListItem[]>([]);
  const [lessonId, setLessonId] = useState("");
  const [steps, setSteps] = useState<LessonStepItem[]>([]);
  const [stepId, setStepId] = useState("");
  const [elements, setElements] = useState<SlideOverlayElement[]>([]);
  const [editToken, setEditToken] = useState("");
  const [status, setStatus] = useState("Pick a lesson to decorate its slides.");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const step = steps.find((candidate) => candidate.id === stepId) || null;

  // The stage, toolbar, and format panel live in SlideExtrasEditor so this page
  // and Screen Studio share one implementation. This page keeps the lesson and
  // step pickers plus the save; Studio mounts the same editor beside Main
  // Display so the slide text and its component formats are edited together.
  function handleElementsChange(next: SlideOverlayElement[]) {
    setElements(next);
    setDirty(true);
  }

  useEffect(() => {
    void (async () => {
      try {
        const result = await teacherApiRequest<{ lessons: LessonListItem[] }>("/api/teacher/lessons");
        setLessons(result.lessons.filter((lesson) => lesson.lessonCode));
        const requested = new URLSearchParams(window.location.search).get("lessonId")?.trim();
        if (requested) setLessonId(requested);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Published lessons could not be loaded.");
      }
    })();
  }, []);

  useEffect(() => {
    if (!lessonId) { setSteps([]); setStepId(""); return; }
    let cancelled = false;
    setStatus("Loading lesson steps.");
    void (async () => {
      try {
        const result = await teacherApiRequest<{ lesson: { steps: LessonStepItem[] } | null }>(
          `/api/teacher/lesson?id=${encodeURIComponent(lessonId)}`,
        );
        if (cancelled) return;
        const loaded = result.lesson?.steps || [];
        setSteps(loaded);
        setStepId((current) => (current && loaded.some((candidate) => candidate.id === current) ? current : loaded[0]?.id || ""));
        setStatus(loaded.length ? "Choose a step, then add extras." : "This lesson has no steps yet.");
      } catch (error) {
        if (!cancelled) setStatus(error instanceof Error ? error.message : "The lesson could not be loaded.");
      }
    })();
    return () => { cancelled = true; };
  }, [lessonId]);

  // Selecting a step loads its saved overlay and the edit token that guards
  // the save against a concurrent Notion edit.
  useEffect(() => {
    if (!lessonId || !stepId) { setElements([]); setEditToken(""); return; }
    let cancelled = false;
    void (async () => {
      try {
        const result = await teacherApiRequest<EditableStepResponse>(
          `/api/teacher/lesson-step?lessonId=${encodeURIComponent(lessonId)}&stepId=${encodeURIComponent(stepId)}`,
        );
        if (cancelled) return;
        setEditToken(result.step.lastEditedTime);
        setElements(parseSlideOverlay(result.step.slideOverlay)?.elements || []);
        setDirty(false);
        setStatus("Add extras, drag them into place, then save.");
      } catch (error) {
        if (!cancelled) setStatus(error instanceof Error ? error.message : "The step could not be loaded.");
      }
    })();
    return () => { cancelled = true; };
  }, [lessonId, stepId]);

  async function save() {
    if (!lessonId || !stepId || saving) return;
    setSaving(true);
    setStatus("Saving to Notion.");
    try {
      const result = await teacherApiRequest<EditableStepResponse>("/api/teacher/lesson-step", {
        method: "PATCH",
        body: JSON.stringify({
          lessonId,
          stepId,
          expectedLastEditedTime: editToken,
          changes: { slideOverlay: serializeSlideOverlay({ v: 1, elements }) },
        }),
      });
      setEditToken(result.step.lastEditedTime);
      setDirty(false);
      setStatus("Saved. The projector shows these extras the next time this step runs.");
    } catch (error) {
      setStatus(error instanceof Error ? `${error.message} Reload the step to pick up the latest version.` : "The overlay could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  const backgroundText = useMemo(() => (step?.mainDisplay || step?.studentDirections || "").trim(), [step]);

  return (
    <main className="sx-page">
      <style>{`
        .sx-page { min-height:100vh; background:var(--bdb-ground); color:var(--bdb-ink); font-family:var(--bdb-font); padding-bottom:44px; }
        .sx-wrap { max-width:1240px; margin:0 auto; padding:14px clamp(12px,3vw,28px); display:grid; gap:14px; }
        .sx-head { display:flex; flex-wrap:wrap; gap:10px; align-items:center; }
        .sx-head h1 { margin:0 8px 0 0; font-size:clamp(1.3rem,2.6vw,1.8rem); font-weight:800; letter-spacing:-0.02em; }
        .sx-sel { border:2px solid var(--bdb-line); border-radius:11px; background:var(--bdb-card); color:var(--bdb-ink); padding:10px 12px; font:inherit; font-weight:700; max-width:340px; }
        .sx-status { margin:0; color:var(--bdb-ink-soft); font-size:0.9rem; font-weight:650; }
        .sx-save { border:0; border-radius:12px; background:var(--bdb-ink); color:#fff; padding:13px 20px; font:inherit; font-weight:900; font-size:1rem; cursor:pointer; }
        .sx-save:disabled { opacity:0.45; cursor:default; }
        .sx-hint { margin:0; color:var(--bdb-ink-faint); font-size:0.78rem; font-weight:650; line-height:1.4; }
        .sx-steps { display:flex; gap:7px; overflow-x:auto; padding-bottom:2px; }
        .sx-step { flex:none; border:1px solid var(--bdb-line); border-radius:999px; background:var(--bdb-card); color:var(--bdb-ink-soft); padding:8px 13px; font:inherit; font-size:0.82rem; font-weight:800; cursor:pointer; white-space:nowrap; }
        .sx-step.on { background:var(--bdb-ink); border-color:var(--bdb-ink); color:#fff; }
        .sx-step small { opacity:0.7; font-weight:700; }
      `}</style>

      <SiteNav variant="teacher" />
      <div className="sx-wrap">
        <div className="sx-head">
          <h1>Slide extras</h1>
          <select className="sx-sel" value={lessonId} onChange={(event) => setLessonId(event.target.value)}>
            <option value="">Choose a published lesson</option>
            {lessons.map((lesson) => (
              <option key={lesson.id} value={lesson.id}>{lesson.lessonCode} - {lesson.title}</option>
            ))}
          </select>
          <button className="sx-save" onClick={save} disabled={!dirty || saving || !stepId}>
            {saving ? "Saving" : dirty ? "Save to Notion" : "Saved"}
          </button>
        </div>
        <p className="sx-status" role="status">{status}</p>

        {steps.length > 0 && (
          <div className="sx-steps">
            {steps.map((candidate, index) => (
              <button
                key={candidate.id}
                className={`sx-step${candidate.id === stepId ? " on" : ""}`}
                onClick={() => setStepId(candidate.id)}
              >
                {index + 1}. {candidate.title || candidate.stateId} <small>{candidate.stateId}</small>
              </button>
            ))}
          </div>
        )}

        {stepId && (
          <SlideExtrasEditor
            elements={elements}
            onChange={handleElementsChange}
            backgroundText={backgroundText}
            disabled={saving}
          />
        )}
      </div>
    </main>
  );
}
