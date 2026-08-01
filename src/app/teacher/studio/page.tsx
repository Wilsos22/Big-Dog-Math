"use client";

// Lesson Screen Studio - the authoring surface for a lesson's live classroom screens. Every screen
// is composed automatically from a Math 6 Lesson Step, and the teacher can rearrange, add, delete,
// and override individual frames without touching the locked chrome (state word, accent band, step
// dots, clock) that stays true to the Notion row. Layout persists as a [BDM_SCREEN_LAYOUT:...]
// marker inside the step's AI Context (see lessonScreenLayout.ts / lessonStepMetadata.ts); this
// surface writes nothing else to Notion. The old lesson-content editor lives on at /teacher/studio/edit.

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import LessonScreen, { type BlockAction } from "@/components/screen/LessonScreen";
import { TeacherApiError, teacherApiRequest } from "@/lib/teacherApi";
import { decodeScreenLayout, encodeScreenLayout } from "@/lib/lessonScreenLayout";
import {
  SCREEN_FIELD_SPECS,
  SCREEN_PALETTE,
  SCREEN_KEYS,
  autoScreenValue,
  defaultZones,
  paletteDropZone,
  paletteForScreen,
  persistableLayout,
  stepScreenData,
  type ManipState,
  type ScreenBlock,
  type ScreenComponentType,
  type ScreenKey,
  type ScreenZones,
} from "@/lib/lessonScreenModel";

interface LessonSummary {
  id: string;
  lessonCode: string;
  title: string;
  date: string;
}

interface StudioStep {
  id: string;
  order: number;
  duration: number;
  title: string;
  stateId: string;
  mainDisplay: string;
  paceDirections: string;
  studentDirections: string;
  vocabulary: string;
  question: string;
  responseMode: string;
}

interface StudioLessonFull {
  id: string;
  lessonCode: string;
  title: string;
  steps: StudioStep[];
}

interface StepRecord {
  id: string;
  lastEditedTime: string;
  screenLayout: string;
}

const SCREEN_TABS: { key: ScreenKey; label: string }[] = [
  { key: "main", label: "Main projector" },
  { key: "pace", label: "Pace + Support" },
  { key: "student", label: "Student" },
];

type SaveState = "idle" | "editing" | "saving" | "saved" | "error";

function pickStep(raw: Record<string, unknown>): StudioStep {
  return {
    id: String(raw.id ?? ""),
    order: Number(raw.order ?? 0),
    duration: Number(raw.duration ?? 0),
    title: String(raw.title ?? ""),
    stateId: String(raw.stateId ?? ""),
    mainDisplay: String(raw.mainDisplay ?? ""),
    paceDirections: String(raw.paceDirections ?? ""),
    studentDirections: String(raw.studentDirections ?? ""),
    vocabulary: String(raw.vocabulary ?? ""),
    question: String(raw.question ?? ""),
    responseMode: String(raw.responseMode ?? ""),
  };
}

function StudioInner() {
  const search = useSearchParams();
  const requestedLessonId = search?.get("lessonId") || "";

  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [lessonsError, setLessonsError] = useState("");
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [lesson, setLesson] = useState<StudioLessonFull | null>(null);
  const [lessonError, setLessonError] = useState("");
  const [lessonLoading, setLessonLoading] = useState(false);

  const [stepIndex, setStepIndex] = useState(0);
  const [screen, setScreen] = useState<ScreenKey>("main");
  const [layouts, setLayouts] = useState<Record<string, ScreenZones>>({});
  // Live demo-object state, keyed by block id. Ephemeral - never saved, never sent to Notion.
  const [manip, setManip] = useState<Record<string, ManipState>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [scale, setScale] = useState(1);

  const onManipChange = useCallback((id: string, patch: ManipState) => {
    setManip((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);

  const [record, setRecord] = useState<StepRecord | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState("");

  const frameHost = useRef<HTMLDivElement | null>(null);
  const layoutsRef = useRef(layouts);
  layoutsRef.current = layouts;
  const recordRef = useRef(record);
  recordRef.current = record;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const steps = useMemo(
    () => (lesson?.steps ?? []).slice().sort((a, b) => a.order - b.order),
    [lesson],
  );
  const currentStep = steps[stepIndex] ?? null;
  const data = useMemo(() => (currentStep ? stepScreenData(currentStep) : null), [currentStep]);
  const totalSteps = steps.length || 1;

  const key = currentStep ? `${currentStep.id}:${screen}` : "";
  // Stable default zones (ids fixed) until the step/screen/content changes, so selecting a frame on
  // an un-customized screen does not lose its selection to a fresh id on the next render.
  const memoDefault = useMemo(
    () => (data ? defaultZones(data, screen) : []),
    [data, screen],
  );
  const currentZones: ScreenZones = (key && layouts[key]) ? layouts[key] : memoDefault;

  // ---- data loading ----------------------------------------------------------------------------

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const result = await teacherApiRequest<{ lessons: LessonSummary[] }>("/api/teacher/lessons");
        if (!active) return;
        const usable = (result.lessons ?? []).filter((item) => item.id);
        setLessons(usable);
        // Default to TODAY's lesson - the exact one /api/today serves - not the
        // first row in the archive. Several lessons can share a date, so match
        // its id, never usable[0]. This is why the studio was opening on a
        // different lesson than the teacher was teaching.
        let todayId = "";
        try {
          const today = await fetch("/api/today", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null));
          if (active) todayId = today?.lesson?.id || "";
        } catch { /* fall back to the archive order */ }
        if (!active) return;
        const initial = usable.find((item) => item.id === requestedLessonId)?.id
          || usable.find((item) => item.id === todayId)?.id
          || usable[0]?.id
          || "";
        setSelectedLessonId(initial);
      } catch (error) {
        if (active) setLessonsError(error instanceof TeacherApiError ? error.message : "Could not load lessons.");
      }
    })();
    return () => { active = false; };
  }, [requestedLessonId]);

  useEffect(() => {
    if (!selectedLessonId) { setLesson(null); return; }
    let active = true;
    setLessonLoading(true);
    setLessonError("");
    (async () => {
      try {
        const result = await teacherApiRequest<{ lesson: { id: string; lessonCode: string; title: string; steps: Record<string, unknown>[] } | null }>(
          `/api/teacher/lesson?id=${encodeURIComponent(selectedLessonId)}`,
        );
        if (!active) return;
        if (!result.lesson) { setLesson(null); setLessonError("This lesson could not be loaded."); return; }
        setLesson({
          id: result.lesson.id,
          lessonCode: result.lesson.lessonCode,
          title: result.lesson.title,
          steps: (result.lesson.steps ?? []).map(pickStep).filter((step) => step.id),
        });
        setStepIndex(0);
        setScreen("main");
        setLayouts({});
        setManip({});
        setSelected(null);
        setRecord(null);
        setSaveState("idle");
        setSaveError("");
      } catch (error) {
        if (active) setLessonError(error instanceof TeacherApiError ? error.message : "Could not load the lesson.");
      } finally {
        if (active) setLessonLoading(false);
      }
    })();
    return () => { active = false; };
  }, [selectedLessonId]);

  // Load the selected step's saved layout + revision marker, then hydrate its screens.
  useEffect(() => {
    if (!lesson || !currentStep) return;
    let active = true;
    const stepId = currentStep.id;
    (async () => {
      try {
        const result = await teacherApiRequest<{ step: StepRecord }>(
          `/api/teacher/lesson-step?lessonId=${encodeURIComponent(lesson.id)}&stepId=${encodeURIComponent(stepId)}`,
        );
        if (!active) return;
        setRecord({ id: result.step.id, lastEditedTime: result.step.lastEditedTime, screenLayout: result.step.screenLayout });
        const decoded = decodeScreenLayout(result.step.screenLayout);
        setLayouts((prev) => {
          const next = { ...prev };
          for (const s of SCREEN_KEYS) {
            const zones = decoded[s];
            if (zones) next[`${stepId}:${s}`] = zones;
          }
          return next;
        });
      } catch (error) {
        if (active) setSaveError(error instanceof TeacherApiError ? error.message : "Could not load this step.");
      }
    })();
    return () => { active = false; };
  }, [lesson, currentStep]);

  // ---- preview scale ---------------------------------------------------------------------------

  useEffect(() => {
    const host = frameHost.current;
    if (!host) return;
    const measure = () => {
      const width = host.clientWidth;
      if (width) setScale(width / 1920);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  // ---- persistence -----------------------------------------------------------------------------

  const doSave = useCallback(async () => {
    const step = currentStep;
    const activeRecord = recordRef.current;
    if (!lesson || !step || !activeRecord || !data) return;
    const materialized: Partial<Record<ScreenKey, ScreenZones>> = {};
    for (const s of SCREEN_KEYS) {
      const zones = layoutsRef.current[`${step.id}:${s}`];
      if (zones) materialized[s] = zones;
    }
    const encoded = encodeScreenLayout(persistableLayout(data, materialized));
    setSaveState("saving");
    setSaveError("");
    try {
      const result = await teacherApiRequest<{ step: StepRecord }>("/api/teacher/lesson-step", {
        method: "PATCH",
        body: JSON.stringify({
          lessonId: lesson.id,
          stepId: step.id,
          expectedLastEditedTime: activeRecord.lastEditedTime,
          changes: { screenLayout: encoded },
        }),
      });
      setRecord({ id: result.step.id, lastEditedTime: result.step.lastEditedTime, screenLayout: result.step.screenLayout });
      setSaveState("saved");
    } catch (error) {
      const message = error instanceof TeacherApiError ? error.message : "Save failed.";
      setSaveState("error");
      setSaveError(message);
      // On a revision conflict, refresh the marker so the next save can proceed, keeping local edits.
      if (error instanceof TeacherApiError && error.status === 409) {
        try {
          const fresh = await teacherApiRequest<{ step: StepRecord }>(
            `/api/teacher/lesson-step?lessonId=${encodeURIComponent(lesson.id)}&stepId=${encodeURIComponent(step.id)}`,
          );
          setRecord((prev) => (prev && prev.id === fresh.step.id
            ? { ...prev, lastEditedTime: fresh.step.lastEditedTime }
            : prev));
        } catch {
          // leave the error visible; the teacher can retry
        }
      }
    }
  }, [lesson, currentStep, data]);

  const scheduleSave = useCallback(() => {
    setSaveState("editing");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void doSave(); }, 900);
  }, [doSave]);

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  // ---- layout mutation -------------------------------------------------------------------------

  const commitZones = useCallback((zones: ScreenZones) => {
    if (!key) return;
    setLayouts((prev) => ({ ...prev, [key]: zones }));
    scheduleSave();
  }, [key, scheduleSave]);

  const findBlock = useCallback((id: string) => {
    for (let z = 0; z < currentZones.length; z += 1) {
      const index = currentZones[z].findIndex((block) => block.id === id);
      if (index !== -1) return { zone: z, index, block: currentZones[z][index] };
    }
    return null;
  }, [currentZones]);

  const addBlock = useCallback((type: ScreenComponentType) => {
    const zoneIndex = paletteDropZone(type);
    const id = `add-${type}-${Date.now().toString(36)}`;
    const next = currentZones.map((zone) => zone.slice());
    while (next.length <= zoneIndex) next.push([]);
    next[zoneIndex] = next[zoneIndex].concat([{ id, type, ov: {} }]);
    commitZones(next);
    setSelected(id);
  }, [currentZones, commitZones]);

  const blockAction = useCallback((id: string, action: BlockAction) => {
    const hit = findBlock(id);
    if (!hit) return;
    const next = currentZones.map((zone) => zone.slice());
    if (action === "del") {
      next[hit.zone].splice(hit.index, 1);
      commitZones(next);
      setSelected(null);
      return;
    }
    if (action === "zone") {
      next[hit.zone].splice(hit.index, 1);
      const to = hit.zone === 0 ? 1 : 0;
      while (next.length <= to) next.push([]);
      next[to] = next[to].concat([hit.block]);
      commitZones(next);
      return;
    }
    const swapWith = action === "up" ? hit.index - 1 : hit.index + 1;
    if (swapWith < 0 || swapWith >= next[hit.zone].length) return;
    const zone = next[hit.zone];
    [zone[swapWith], zone[hit.index]] = [zone[hit.index], zone[swapWith]];
    commitZones(next);
  }, [currentZones, findBlock, commitZones]);

  const editField = useCallback((fieldKey: string, value: string) => {
    const hit = selected ? findBlock(selected) : null;
    if (!hit) return;
    const next = currentZones.map((zone) => zone.map((block) => {
      if (block.id !== hit.block.id) return block;
      const ov = { ...block.ov };
      if (value === "") delete ov[fieldKey]; else ov[fieldKey] = value;
      return { ...block, ov };
    }));
    commitZones(next);
  }, [selected, findBlock, currentZones, commitZones]);

  const revertBlock = useCallback(() => {
    const hit = selected ? findBlock(selected) : null;
    if (!hit) return;
    const next = currentZones.map((zone) => zone.map((block) =>
      block.id === hit.block.id ? { ...block, ov: {} } : block));
    commitZones(next);
  }, [selected, findBlock, currentZones, commitZones]);

  const deleteSelected = useCallback(() => {
    if (selected) blockAction(selected, "del");
  }, [selected, blockAction]);

  const resetScreen = useCallback(() => {
    if (!key) return;
    setLayouts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setSelected(null);
    scheduleSave();
  }, [key, scheduleSave]);

  // ---- derived view ----------------------------------------------------------------------------

  const selectedHit = selected ? findBlock(selected) : null;
  const selectedBlock: ScreenBlock | null = selectedHit ? selectedHit.block : null;
  const selectedPalette = selectedBlock ? SCREEN_PALETTE.find((entry) => entry.type === selectedBlock.type) : null;
  const nextTitle = steps[stepIndex + 1]
    ? steps[stepIndex + 1].title.replace(/^\d+\.\s*/, "")
    : "end of lesson";

  const saveLabel = saveState === "saving" ? "Saving..."
    : saveState === "saved" ? "Saved"
    : saveState === "editing" ? "Editing"
    : saveState === "error" ? "Save failed"
    : record ? "Saved" : "";

  const dims = screen === "student"
    ? "1366 x 768 on device - authored at 1920 x 1080"
    : "1920 x 1080";

  return (
    <div className="lss-root">
      <style>{STUDIO_CSS}</style>

      <header className="lss-topbar">
        <div className="lss-brand">Lesson Screen Studio</div>
        <label className="lss-lesson-pick">
          <span className="lss-eyebrow">Lesson</span>
          <select
            value={selectedLessonId}
            onChange={(event) => setSelectedLessonId(event.target.value)}
            disabled={!lessons.length}
          >
            {lessons.length ? lessons.map((item) => (
              <option key={item.id} value={item.id}>
                {item.lessonCode ? `${item.lessonCode} - ` : ""}{item.title || "Untitled lesson"}
              </option>
            )) : <option value="">No published lessons</option>}
          </select>
        </label>
        <div className="lss-topbar-right">
          <span className={`lss-save lss-save-${saveState}`}>{saveLabel}</span>
          <Link className="lss-link" href="/teacher/studio/edit">Edit lesson content</Link>
        </div>
      </header>

      {lessonsError ? <p className="lss-alert">{lessonsError}</p> : null}
      {lessonError ? <p className="lss-alert">{lessonError}</p> : null}

      <div className="lss-controlbar">
        <div className="lss-steps-group">
          <span className="lss-eyebrow">Lesson step - from Notion relation</span>
          <div className="lss-steps">
            {steps.length ? steps.map((step, index) => (
              <button
                key={step.id}
                type="button"
                className={`lss-chip ${index === stepIndex ? "is-active" : ""}`}
                onClick={() => { setStepIndex(index); setSelected(null); }}
                title={step.title}
              >
                {step.order || index + 1}
              </button>
            )) : <span className="lss-muted">{lessonLoading ? "Loading steps..." : "No steps"}</span>}
          </div>
        </div>
        <div className="lss-screen-group">
          <span className="lss-eyebrow">Screen</span>
          <div className="lss-screens">
            {SCREEN_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`lss-screen-btn ${tab.key === screen ? "is-active" : ""}`}
                onClick={() => { setScreen(tab.key); setSelected(null); }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="lss-controlbar-right">
          <span className="lss-status">
            {currentStep
              ? `${currentStep.title} - ${currentStep.responseMode || "no digital response"} - ${currentStep.duration} min from Duration`
              : "Select a lesson to begin"}
          </span>
          <button type="button" className="lss-ghost" onClick={resetScreen} disabled={!currentStep}>Reset this screen</button>
        </div>
      </div>

      <div className="lss-body">
        <aside className="lss-panel lss-palette">
          <span className="lss-eyebrow">Frames</span>
          <p className="lss-help">Click to add. Each frame fills itself from the lesson field named under it.</p>
          <div className="lss-palette-list">
            {paletteForScreen(screen).map((entry) => (
              <button
                key={entry.type}
                type="button"
                className={`lss-palette-btn${entry.mainOnly ? " lss-palette-demo" : ""}`}
                onClick={() => addBlock(entry.type)}
                disabled={!currentStep}
              >
                <span className="lss-palette-label">{entry.label}</span>
                <span className="lss-palette-field">{entry.field}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="lss-preview">
          <div className="lss-preview-caption">
            <span className="lss-caption-strong">
              {(SCREEN_TABS.find((tab) => tab.key === screen)?.label || "")}{currentStep ? ` - ${currentStep.title}` : ""}
            </span>
            <span className="lss-caption-dim">{dims}</span>
          </div>
          <div ref={frameHost} className="lss-frame">
            {data ? (
              <div className="lss-frame-scale" style={{ transform: `scale(${scale})` }}>
                <LessonScreen
                  data={data}
                  screen={screen}
                  zones={currentZones}
                  totalSteps={totalSteps}
                  nextTitle={nextTitle}
                  editing
                  dotScale={scale}
                  selectedId={selected}
                  manip={manip}
                  onManipChange={onManipChange}
                  onSelectBlock={setSelected}
                  onSelectZone={() => setSelected(null)}
                  onBlockAction={blockAction}
                />
              </div>
            ) : (
              <div className="lss-frame-empty">{lessonLoading ? "Loading lesson..." : "Choose a lesson and step"}</div>
            )}
          </div>
        </section>

        <aside className="lss-panel lss-inspector">
          <div className="lss-inspector-head">
            <span className="lss-eyebrow lss-teal">
              {selectedBlock ? `${selectedPalette?.label || selectedBlock.type} - editable` : "Nothing selected"}
            </span>
            <span className="lss-help">
              {selectedBlock
                ? `Bound to ${selectedPalette?.field || "-"}. Leave a field blank to keep the Notion value.`
                : "Click a frame on the screen to edit it. The band, state name, step position and clock are locked to the Notion row."}
            </span>
          </div>

          {selectedBlock && data ? (
            <div className="lss-fields">
              {(SCREEN_FIELD_SPECS[selectedBlock.type] || []).map((field) => {
                const auto = autoScreenValue(data, field.key) || "-";
                const value = selectedBlock.ov[field.key] ?? "";
                const multiline = field.key === "mainDisplay" || field.key === "screenNotes"
                  || field.key === "paceDirections" || field.key === "vocabulary" || field.key === "studentDirections";
                return (
                  <label key={field.key} className="lss-field">
                    <span className="lss-field-label">{field.label}</span>
                    {multiline ? (
                      <textarea
                        rows={3}
                        value={value}
                        placeholder={auto}
                        onChange={(event) => editField(field.key, event.target.value)}
                      />
                    ) : (
                      <input
                        value={value}
                        placeholder={auto}
                        onChange={(event) => editField(field.key, event.target.value)}
                      />
                    )}
                  </label>
                );
              })}
            </div>
          ) : null}

          {selectedBlock ? (
            <div className="lss-inspector-actions">
              <button type="button" className="lss-ghost" onClick={revertBlock}>Revert to Notion</button>
              <button type="button" className="lss-danger" onClick={deleteSelected}>Delete frame</button>
            </div>
          ) : null}

          {saveError ? <p className="lss-alert lss-alert-inline">{saveError}</p> : null}

          <div className="lss-locked-note">
            <span className="lss-eyebrow">Locked to the lesson</span>
            <span className="lss-help">State name, color band, step position and clock come from the Notion row. Rearranging frames never changes them.</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function LessonScreenStudioPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, fontFamily: "var(--bdb-font, 'Albert Sans', sans-serif)" }}>Loading studio...</div>}>
      <StudioInner />
    </Suspense>
  );
}

const STUDIO_CSS = `
.lss-root { min-height:100vh; padding:16px 22px 30px; display:flex; flex-direction:column; gap:14px;
  background-color:#ECE8E0; background-image:radial-gradient(circle,#C9C1B0 1px,transparent 1.3px);
  background-size:18px 18px; font-family:var(--bdb-font,'Albert Sans',system-ui,sans-serif); color:#201E1A; }
.lss-eyebrow { font-size:11px; font-weight:900; letter-spacing:.14em; text-transform:uppercase; color:#8A8378; }
.lss-teal { color:#3D8586; }
.lss-muted { font-size:13px; font-weight:750; color:#8A8378; }
.lss-help { margin:0; font-size:12px; font-weight:750; line-height:1.45; color:#8A8378; }
.lss-alert { margin:0; border:1px solid #F0B7AB; background:#FCEDE9; color:#C43418; border-radius:12px;
  padding:9px 13px; font-size:13px; font-weight:750; }
.lss-alert-inline { border-radius:12px; }

.lss-topbar { display:flex; align-items:center; gap:16px; flex-wrap:wrap; border:1px solid #DBD5C9;
  border-radius:20px; background:#fff; padding:12px 18px; box-shadow:0 6px 18px rgba(40,32,20,.07); }
.lss-brand { font-size:17px; font-weight:900; letter-spacing:-.01em; color:#201E1A; }
.lss-lesson-pick { display:grid; gap:4px; }
.lss-lesson-pick select { border:2px solid #DBD5C9; border-radius:12px; background:#F6F3EC; color:#201E1A;
  padding:8px 12px; font-size:14px; font-weight:800; max-width:52ch; }
.lss-topbar-right { margin-left:auto; display:flex; align-items:center; gap:14px; }
.lss-save { font-size:12px; font-weight:850; letter-spacing:.02em; padding:5px 12px; border-radius:999px; }
.lss-save-saved { background:#DAEEDF; color:#155A33; }
.lss-save-saving { background:#FCE6CC; color:#8F4A07; }
.lss-save-editing { background:#EEF3F3; color:#2E4A54; }
.lss-save-error { background:#FCEDE9; color:#C43418; }
.lss-save-idle { color:#8A8378; }
.lss-link { font-size:13px; font-weight:850; color:#3D8586; text-decoration:none; border-bottom:1px solid rgba(61,133,134,.35); }
.lss-link:hover { color:#2E4A54; }

.lss-controlbar { display:flex; flex-wrap:wrap; gap:12px 24px; align-items:flex-end; border:1px solid #DBD5C9;
  border-radius:20px; background:#fff; padding:14px 18px; box-shadow:0 6px 18px rgba(40,32,20,.07); }
.lss-steps-group, .lss-screen-group { display:grid; gap:6px; min-width:0; }
.lss-steps { display:flex; gap:5px; flex-wrap:wrap; }
.lss-chip { min-width:38px; border:2px solid #DBD5C9; border-radius:11px; background:#F6F3EC; color:#4A453E;
  padding:8px 9px; font-size:14px; font-weight:900; cursor:pointer; }
.lss-chip.is-active { background:#201E1A; color:#fff; border-color:#201E1A; }
.lss-screens { display:flex; gap:7px; }
.lss-screen-btn { border:2px solid #DBD5C9; border-radius:12px; background:#F6F3EC; color:#4A453E;
  padding:9px 14px; font-size:14px; font-weight:850; cursor:pointer; }
.lss-screen-btn.is-active { background:#201E1A; color:#fff; border-color:#201E1A; }
.lss-controlbar-right { margin-left:auto; display:flex; align-items:center; gap:12px; }
.lss-status { max-width:40ch; font-size:12px; font-weight:750; line-height:1.4; color:#8A8378; text-align:right; }
.lss-ghost { border:2px solid #DBD5C9; border-radius:12px; background:#F6F3EC; color:#4A453E; padding:9px 14px;
  font-size:13px; font-weight:850; cursor:pointer; }
.lss-ghost:disabled { opacity:.5; cursor:default; }
.lss-danger { border:2px solid #F95335; border-radius:12px; background:#fff; color:#C43418; padding:9px 13px;
  font-size:13px; font-weight:850; cursor:pointer; }

.lss-body { display:grid; grid-template-columns:232px minmax(0,1fr) 300px; gap:14px; align-items:start; }
@media (max-width:1180px) { .lss-body { grid-template-columns:1fr; } }
.lss-panel { border:1px solid #DBD5C9; border-radius:20px; background:#fff; padding:15px;
  box-shadow:0 6px 18px rgba(40,32,20,.07); display:grid; gap:9px; }
.lss-palette-list { display:grid; gap:7px; }
.lss-palette-btn { display:grid; gap:2px; text-align:left; border:2px solid #DBD5C9; border-radius:14px;
  background:#F6F3EC; padding:10px 12px; cursor:pointer; }
.lss-palette-btn:hover { border-color:#50A3A4; background:#fff; }
.lss-palette-btn:disabled { opacity:.5; cursor:default; }
.lss-palette-label { font-size:14px; font-weight:900; color:#201E1A; }
.lss-palette-field { font-size:10px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; color:#8A8378; }
.lss-palette-demo { border-style:dashed; }
.lss-palette-demo:hover { border-color:#F2820C; }

.lss-preview { display:grid; gap:9px; min-width:0; }
.lss-preview-caption { display:flex; align-items:baseline; gap:12px; flex-wrap:wrap; }
.lss-caption-strong { font-size:12px; font-weight:900; letter-spacing:.14em; text-transform:uppercase; color:#8A8378; }
.lss-caption-dim { font-size:12px; font-weight:750; color:#A79E90; }
.lss-frame { position:relative; width:100%; aspect-ratio:16 / 9; overflow:hidden; border-radius:16px;
  box-shadow:0 22px 54px -26px rgba(103,74,64,.62); background:#F3F0E7; }
.lss-frame-scale { position:absolute; top:0; left:0; width:1920px; height:1080px; transform-origin:top left; }
.lss-frame-empty { position:absolute; inset:0; display:grid; place-items:center; color:#A79E90; font-size:18px; font-weight:800; }

.lss-inspector { border-top:6px solid #50A3A4; gap:12px; }
.lss-inspector-head { display:grid; gap:3px; }
.lss-fields { display:grid; gap:11px; }
.lss-field { display:grid; gap:5px; }
.lss-field-label { font-size:10px; font-weight:900; letter-spacing:.13em; text-transform:uppercase; color:#8A8378; }
.lss-field input, .lss-field textarea { border:2px solid #DBD5C9; border-radius:12px; background:#F6F3EC;
  color:#201E1A; padding:10px 12px; font-size:14px; font-weight:750; line-height:1.4; resize:vertical;
  font-family:inherit; }
.lss-inspector-actions { display:flex; gap:8px; flex-wrap:wrap; border-top:1px solid #DBD5C9; padding-top:11px; }
.lss-locked-note { display:grid; gap:6px; border-top:1px solid #DBD5C9; padding-top:11px; }
`;
