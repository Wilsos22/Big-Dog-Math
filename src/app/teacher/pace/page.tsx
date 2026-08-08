"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useLiveFlowPing } from "@/lib/liveFlowPing";
import ClassroomSpinner from "@/components/ClassroomSpinner";
import FullscreenButton from "@/components/FullscreenButton";
import ScreenInkOverlay from "@/components/ScreenInkOverlay";
import SlideFrameScene from "@/components/SlideFrameScene";
import StageControlToolbar from "@/components/StageControlToolbar";
import { ClassroomStateStrip } from "@/components/ClassroomStateStrip";
import { applyStripOverride, overrideIsLive } from "@/lib/classroomStateStrip";
import { TIMER_URGENCY_CSS, timerUrgency, timerUrgencyClass } from "@/lib/timerUrgency";
import { CLOSEOUT_DIRECTIONS, universalStateTitle } from "@/lib/classStates";
import { CLASSROOM_STAGE_THEMES, classroomStageTheme, discussionSupportsForLesson, usesDiscussionProtocol } from "@/lib/classroomPilot";
import { normalizeDiscussionPhaseSnapshot } from "@/lib/discussionProtocol";
import { parseDiscussionPhases, discussionStageCountdown, discussionPhaseLabel } from "@/lib/discussionPhases";
import { galleryWalkPhasesFromRoutine, galleryWalkStageCountdown } from "@/lib/galleryWalkTimer";
import { publicSuccessCriterion } from "@/lib/successCriterion";
import { teacherApiRequest } from "@/lib/teacherApi";
import { LIVE_FLOW_MODE, getStoredTeacherSessionId, liveTimerSeconds, type LiveClassFlowSnapshot } from "@/lib/liveClassFlow";
import { WARM_ACCENTS } from "@/lib/warmNotebook";
import { studioPreviewSession, useStudioPreviewSnapshot } from "@/lib/studioPreviewFlow";

// ?preview=<stage id> renders the shell with sample content and no session.
const PREVIEW_SAMPLES: Record<string, { label: string; action: string; steps: string[]; anchor?: string }> = {
  evergreen: {
    label: "Warm-up",
    action: "Screens up. Open the warm-up.",
    steps: ["Work silently", "Five questions plus the bonus", "Submit when finished"],
    anchor: "A concert venue is splitting its floor into a standing area and a VIP section. The floor is 6 rows by 28 squares. Where would you put the dividing line - and how could you prove the two sections still add up to the whole floor?",
  },
  scenario: { label: "Launch", action: "Screens low - not closed.", steps: ["Think silently for 10 seconds", "Tell your partner one sum", "What changed? What stayed the same?"] },
  concrete: { label: "Concrete", action: "Build it with counters.", steps: ["Trackpads parked", "Predict", "Build", "Freeze"] },
  discussion: { label: "Discussion", action: "Talk in rounds.", steps: ["Think first", "Use a stem", "Revise your answer"] },
  independent: { label: "Independent", action: "Paper first.", steps: ["Attempt the problem", "Need help? Open the Area Tool", "Return to paper"] },
};

function previewStageParam() {
  try {
    return new URLSearchParams(window.location.search).get("preview")?.trim() || null;
  } catch {
    return null;
  }
}

// Vocabulary entries are authored as "term - definition" (em dash in Notion).
function splitVocab(entry: string): { term: string; def: string } {
  const match = entry.match(/^(.{1,40}?)\s+[-–—]\s+(.+)$/);
  return match ? { term: match[1], def: match[2] } : { term: entry, def: "" };
}

interface PaceSession {
  id: string;
  period_id?: string;
  status: string;
  join_code: string | null;
  broadcast: string | null;
  live_flow: LiveClassFlowSnapshot | null;
}

interface PollAnswer {
  id: string;
  answer: string | null;
}

// An untimed state shows a dash, not a zeroed clock - a 0:00 on a projector reads as "you are out
// of time", which is exactly the pressure an untimed state exists to remove.
const UNTIMED_CLOCK = "\u2013";

function formatTime(totalSeconds: number) {
  const seconds = Math.max(0, totalSeconds);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function requestedSessionId() {
  try {
    return new URLSearchParams(window.location.search).get("session")?.trim()
      || getStoredTeacherSessionId()
      || null;
  } catch {
    return null;
  }
}

export default function PaceSupportPage() {
  const [session, setSession] = useState<PaceSession | null>(null);
  const reloadRef = useRef<(() => void) | null>(null);
  // A 1s heartbeat so the beat countdown re-renders every second, independent of
  // the ~1.2s session poll - otherwise a big clock skips seconds.
  const [, setClockTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setClockTick((t) => (t + 1) % 3600), 1000);
    return () => window.clearInterval(id);
  }, []);
  const [loading, setLoading] = useState(true);
  const [sessionMessage, setSessionMessage] = useState("Connecting to the confirmed class session.");
  const [pollAnswers, setPollAnswers] = useState<PollAnswer[]>([]);
  const [previewStage, setPreviewStage] = useState<string | null>(null);
  // Room-tunable text size, persisted per device (same control as present).
  const [textScale, setTextScale] = useState(1);

  // Studio preview: render from the snapshot Screen Studio posts, not a
  // live session, so the Pace preview is the real surface.
  const { active: isStudioPreviewMode, snapshot: studioPreviewSnapshot } = useStudioPreviewSnapshot();
  useEffect(() => {
    if (!isStudioPreviewMode) return;
    setLoading(false);
    setSession(studioPreviewSnapshot ? (studioPreviewSession(studioPreviewSnapshot) as PaceSession) : null);
    setSessionMessage(studioPreviewSnapshot ? "Studio preview." : "Waiting for the Studio draft.");
  }, [isStudioPreviewMode, studioPreviewSnapshot]);

  useEffect(() => {
    setPreviewStage(previewStageParam());
    try {
      const stored = Number(localStorage.getItem("bdm-pace-textscale"));
      if (stored >= 1 && stored <= 2.5) setTextScale(stored);
    } catch { /* ignore */ }
  }, []);

  const adjustTextScale = (delta: number) => {
    setTextScale((current) => {
      const next = Math.min(2.5, Math.max(1, Math.round((current + delta) * 1000) / 1000));
      try { localStorage.setItem("bdm-pace-textscale", String(next)); } catch { /* ignore */ }
      return next;
    });
  };

  useEffect(() => {
    if (isStudioPreviewMode) return;
    let stopped = false;
    let checking = false;
    const requested = requestedSessionId();
    const load = async () => {
      if (checking) return;
      checking = true;
      try {
        const endpoint = requested
          ? `/api/teacher/session?liveSessionId=${encodeURIComponent(requested)}`
          : "/api/teacher/session";
        const result = await teacherApiRequest<{ sessions: PaceSession[] }>(endpoint)
          .catch(() => ({ sessions: [] }));
        const liveSessions = result.sessions.filter((candidate) => candidate.status === "open" && candidate.broadcast === LIVE_FLOW_MODE);
        const selected = requested
          ? liveSessions.find((candidate) => candidate.id === requested) ?? null
          : liveSessions.length === 1 ? liveSessions[0] : null;
        if (!stopped) {
          setSession(selected);
          setSessionMessage(selected
            ? "Connected to the confirmed class session."
            : liveSessions.length > 1
              ? "Choose the intended session from the private teacher Remote."
              : "Start Live Class Flow or open this projector from the private teacher Remote.");
          setLoading(false);
        }
      } finally {
        checking = false;
      }
    };
    void load();
    // The poll is the floor, not the mechanism: reloadRef lets the screen ping
    // pull the change through immediately instead of waiting out the interval.
    reloadRef.current = () => { void load(); };
    const interval = window.setInterval(load, requested ? 1000 : 1500);
    return () => {
      stopped = true;
      reloadRef.current = null;
      window.clearInterval(interval);
    };
  }, []);

  // Re-read the moment the lesson changes. Without this the wall sits up to
  // 1.5s behind the teacher's tap; with it, about 200ms.
  // Skipped in Studio preview and on /demo: those adopt a posted snapshot and
  // fetch nothing, so a subscription there would be a channel with nothing to
  // pull through.
  useLiveFlowPing(isStudioPreviewMode ? null : session?.id, () => reloadRef.current?.());

  const flow = session?.live_flow ?? null;
  const pollId = flow?.poll?.id ?? null;
  useEffect(() => {
    if (!pollId) {
      setPollAnswers([]);
      return;
    }
    let stopped = false;
    const load = async () => {
      const result = await teacherApiRequest<{ answers: PollAnswer[] }>(
        `/api/teacher/poll?pollId=${encodeURIComponent(pollId)}`,
      ).catch(() => ({ answers: [] }));
      if (!stopped) setPollAnswers(result.answers);
    };
    void load();
    const interval = window.setInterval(load, 1_200);
    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, [pollId]);

  const [inkOverlay, setInkOverlay] = useState<{ room: string; embed: boolean } | null>(null);
  // Words under the state-strip glyphs, on for the first weeks and off with
  // ?words=off once the room reads the strip cold. Default on.
  const [stripWords, setStripWords] = useState(true);
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      setInkOverlay({ room: p.get("room")?.trim() || "main", embed: p.get("embed") === "1" });
      setStripWords(p.get("words") !== "off");
    } catch {
      setInkOverlay({ room: "main", embed: false });
    }
  }, []);

  const state = flow?.state ?? null;
  const timer = flow?.timer ?? null;
  const timerSeconds = liveTimerSeconds(timer);
  const timerFinished = Boolean(timer?.finished || (timer?.running && timerSeconds <= 0));
  // Escalating visual warning ahead of every state change (Steele, 2026-07-28).
  const currentTimerUrgency = timerUrgency(timerSeconds, {
    running: Boolean(timer?.running),
    finished: timerFinished,
  });
  // Fallback through the inferrer if the semantic is unknown - a stray value
  // in a snapshot must never crash a projector (see the same guard on Main).
  const theme = (state?.semantic ? CLASSROOM_STAGE_THEMES[state.semantic] : undefined)
    ?? classroomStageTheme(state?.id, state?.label);
  const publicSurfacesLinked = flow?.presentation?.publicSurfaceMode === "linked";
  const linkedSpinnerMode = publicSurfacesLinked && state?.id === "learning-target-readers"
    ? "readers"
    : publicSurfacesLinked && state?.id === "ipad-kid"
      ? "ipad"
      : null;
  // The support projector mirrors the main slide ONLY when the step asks it to. Off by default:
  // this screen's job is directions, and duplicating the visual costs the room its second channel.
  const mirroredSlideStep = flow?.sequence?.steps?.[flow.sequence.currentIndex] || null;
  const mirroredSlideUrl = mirroredSlideStep?.slideMirror
    ? String(mirroredSlideStep.slideUrl || "").trim()
    : "";
  const mirroredSlideFit = mirroredSlideStep?.slideFit === "cover" ? "cover" : "contain";
  const spinnerSyncScope = `${flow?.sequence?.currentIndex ?? -1}:${flow?.presentation?.notionStepId || state?.id || "spinner"}`;
  const routineConfig = flow?.presentation?.routineConfig || null;
  // The Gallery Walk rotation, computed from the SAME authored config and the
  // SAME state clock the projector uses, so the two screens never disagree about
  // which station the room is on. Silent here - see the branch below.
  const galleryWalkBuild = routineConfig?.kind === "gallery-walk"
    ? galleryWalkPhasesFromRoutine(routineConfig)
    : null;
  const galleryWalkTimeline = galleryWalkBuild?.ok && (timer?.totalSeconds ?? 0) > 0
    ? galleryWalkBuild
    : null;
  const galleryWalkStage = galleryWalkTimeline
    ? galleryWalkStageCountdown(
        galleryWalkTimeline.phases,
        timer?.totalSeconds ?? 0,
        timerSeconds,
        galleryWalkTimeline.beepWindowSeconds,
      )
    : null;
  // The classroom state strip. The authored values come with the step; the
  // override is server-authored and expires on the next advance. Words under the
  // glyphs come off with ?words=off once the room reads the strip cold - the
  // voice digit stays either way.
  const behaviorStrip = applyStripOverride(
    flow?.presentation?.behaviorStrip ?? null,
    flow?.behaviorOverride ?? null,
    flow?.sequence?.currentIndex,
  );
  const behaviorOverridden = overrideIsLive(flow?.behaviorOverride ?? null, flow?.sequence?.currentIndex);
  const poll = flow?.poll ?? null;
  const phase = normalizeDiscussionPhaseSnapshot(flow?.phase);
  // A concrete-phase timeline step is a discussion too: it wants the support
  // screen's stems + vocabulary layout, so the room has the language for its
  // Talk beats. phase stays null, so the phase-specific bits fall back cleanly.
  const timelinePhases = (() => {
    const parsed = parseDiscussionPhases(flow?.presentation?.discussionPhases);
    return parsed.ok ? parsed.phases : [];
  })();
  // Position-independent discussion overlay (2026-08-08): fired from any
  // state, so it takes priority over a step's own authored timeline when both
  // happen to be present - it reflects what the teacher just asked for.
  const discussionRun = flow?.discussionRun || null;
  const runPhases = discussionRun ? discussionRun.phases : timelinePhases;
  const hasDiscussionTimeline = runPhases.length > 0;
  // During a self-running timeline, the number the room works against is the
  // CURRENT beat's remaining time (think 30, write 90, ...), not the whole-state
  // clock - and the red-at-15 warning keys off that beat too. discussionRun has
  // its own independent startedAt clock rather than the step's shared timer, so
  // its "state seconds left" is derived rather than read.
  const discussionStage = discussionRun
    ? discussionStageCountdown(
        discussionRun.phases,
        discussionRun.totalSeconds,
        Math.max(0, discussionRun.totalSeconds - Math.round((Date.now() - Date.parse(discussionRun.startedAt)) / 1000)),
      )
    : hasDiscussionTimeline
      ? discussionStageCountdown(timelinePhases, timer?.totalSeconds ?? 0, timerSeconds)
      : null;
  const stageSeconds = discussionStage && !discussionStage.done ? discussionStage.secondsLeft : timerSeconds;
  const stageUrgency = hasDiscussionTimeline
    ? timerUrgency(stageSeconds, { running: Boolean(timer?.running), finished: timerFinished })
    : currentTimerUrgency;
  const isDiscussion = theme.id === "discussion" || Boolean(phase);
  // The theme gates the LAYOUT; it must not gate the catalog fallback.
  // inferClassroomStage sends any "partner" or "group" step to the discussion
  // theme, and /control deliberately publishes empty arrays for those - so the
  // theme-gated fallback filled them in locally with catalog copy.
  const runsDiscussionProtocol = Boolean(phase) || Boolean(discussionRun) || usesDiscussionProtocol(state?.id, state?.label);
  const configuredDiscussionSupports = discussionSupportsForLesson(flow?.lesson?.code);
  const discussionStems = flow?.presentation?.discussionStems?.filter(Boolean).length
    ? flow.presentation.discussionStems
    : phase?.sentenceStems?.filter(Boolean).length
      ? phase.sentenceStems
      : flow?.lesson?.discussionStems?.filter(Boolean).length
        ? flow.lesson.discussionStems
        : runsDiscussionProtocol ? configuredDiscussionSupports.sentenceStems : [];
  // The configured supports are a DISCUSSION fallback, never a general one.
  // As a terminal fallback they rendered the hardcoded strategy / evidence /
  // justify table on the support screen for the entire lesson, unchanged from
  // warm-up to closeout, and it read as authored lesson content.
  const discussionVocabulary = flow?.presentation?.vocabulary?.filter(Boolean).length
    ? flow.presentation.vocabulary
    : phase?.keyVocabulary?.filter(Boolean).length
      ? phase.keyVocabulary
      : flow?.lesson?.discussionVocabulary?.filter(Boolean).length
        ? flow.lesson.discussionVocabulary
        : runsDiscussionProtocol ? configuredDiscussionSupports.keyVocabulary : [];
  const paceDirections = state?.id === "closeout"
    ? CLOSEOUT_DIRECTIONS
    : publicSurfacesLinked
      ? flow?.presentation?.mainDisplay || flow?.presentation?.body || state?.description
      : routineConfig?.kind === "gallery-walk"
        ? routineConfig.movementDirections
        : routineConfig?.kind === "small-group"
          ? `${routineConfig.publicTask} Rotate every ${routineConfig.rotationMinutes} minutes.`
      : flow?.presentation?.paceDirections || state?.description;
  const connected = Boolean(!loading && session && flow && state);
  const previewSample = !connected && !loading && previewStage
    ? PREVIEW_SAMPLES[previewStage] || PREVIEW_SAMPLES[classroomStageTheme(previewStage).id] || null
    : null;
  const previewTheme = previewStage ? classroomStageTheme(previewStage) : null;
  const activeThemeId = previewSample && previewTheme ? previewTheme.id : theme.id;
  // Warm Notebook stage (turn 12b): paper ground, one semantic accent.
  // Ad-hoc "Transition now": mirrors the Main projector while the room moves.
  const interlude = connected ? flow?.interlude || null : null;
  const interludeSeconds = interlude
    ? Math.max(0, Math.round((Date.parse(interlude.endsAt) - Date.now()) / 1000))
    : 0;
  const accent = interlude ? interlude.color : WARM_ACCENTS[activeThemeId] || theme.accent;
  const style = {
    "--acc": accent,
  } as CSSProperties;

  // The wireframe's pace body is an action headline plus numbered steps:
  // line one of the authored Pace Directions is the action, remaining lines
  // become the steps. A single-line direction renders as the action alone.
  const directionLines = (paceDirections || "").split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const paceAction = directionLines[0] || "";
  const paceSteps = directionLines.slice(1, 7);

  // Both caps are real: .pw-cols is inset-0 with no overflow, so anything past
  // the column height is clipped with nothing on screen to say so. Six covers
  // every authored stem set today (the default has four, the ratio lesson six);
  // vocabulary cards carry a definition each, so three is what fits the column.
  const vocabCards = discussionVocabulary.slice(0, 3).map(splitVocab);

  // The hook question shows on BOTH projector panels during warm-up. Here it
  // takes the stage and the big clock card stands down - the small topbar
  // timer pill carries the time.
  const anchorText = flow?.lesson?.anchorProblem?.trim() || "";
  const anchorPose = Boolean(connected && anchorText && state?.id === "warmup");
  // During warm-up the support screen runs today's agenda so the class can
  // see the plan animate in while the Main projector holds the hook.
  const agendaItems = (flow?.lesson?.agenda || "")
    .split("\n").map((line) => line.replace(/^[-*]\s*/, "").trim()).filter(Boolean).slice(0, 10);
  const warmupAgenda = Boolean(connected && state?.id === "warmup" && agendaItems.length);


  // Mirror of the Main projector's scene keying: every state change re-enters
  // as a scene with the incoming accent sweeping across the top.
  const sceneKey = interlude
    ? `interlude:${interlude.endsAt}`
    : previewSample
      ? `preview:${previewStage}`
      : !connected || !state
        ? "idle"
        : `${state.id}:${flow?.sequence?.currentIndex ?? -1}`;

  // A `lessonSlideData` / `showLessonSlide` block stood here and fed the
  // LessonSlideStage overlay, along with the FIVE predicates that existed only to
  // exclude states from it (isTransition, isExitState, hasLiveTool,
  // hasAssignedResource, isLearningCheck). All gone 2026-08-04 with the overlay
  // itself - see the note at its old mount point below. Pace draws its own frame
  // on every state again.

  return (
    <main className="pace-page" style={style}>
      <style>{`
        /* Warm Notebook skin (Design canvas turn 12b): warm dotted paper, ink
           text, one semantic accent per state via --acc. The support screen's
           job is one instruction, the words they'll need, and the shared
           clock - never competing with the main board. */
        .pace-page { position:fixed; inset:0; box-sizing:border-box; overflow:hidden;
          --ink:#201E1A; --head:#2E4A54; --soft:#5C6E75; --faint:#8A9299; --hair:#E3D9C2; --card:#fff;
          --acc-deep:color-mix(in srgb, var(--acc) 62%, #201E1A);
          background-color:#F3F0E7;
          background-image:radial-gradient(circle,#CBC4B2 1px,transparent 1.3px);
          background-size:18px 18px;
          color:var(--ink); font-family:var(--bdb-font); display:grid; grid-template-rows:64px minmax(0,1fr);
          --stage-ease:cubic-bezier(0.2,0.7,0.2,1); }
        /* Scene change, mirroring the Main projector: content re-enters with a
           rise-and-fade and the incoming state's accent sweeps the top. */
        .pw-scene { position:absolute; inset:0; animation:pwSceneEnter 520ms var(--stage-ease) both; }
        .pw-sweep { position:absolute; z-index:7; inset:0 0 auto 0; height:5px; background:var(--acc); transform-origin:left; pointer-events:none;
          animation:pwSceneSweep 760ms var(--stage-ease) both; }
        @keyframes pwSceneEnter { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:none; } }
        @keyframes pwSceneSweep { 0% { transform:scaleX(0); opacity:1; } 62% { transform:scaleX(1); opacity:1; } 100% { transform:scaleX(1); opacity:0; } }
        .pw-chip, .pw-dot { transition:background-color 420ms ease; }
        .pw-timer::before { transition:background-color 420ms ease; }
        .pw-hook-inner { display:grid; gap:20px; justify-items:center; }
        .pw-agenda { position:absolute; inset:0; display:grid; align-content:center; gap:clamp(10px,1.6vw,20px); padding:clamp(30px,5vw,84px); }
        .pw-agenda-kicker { margin:0; color:var(--acc-deep); font-size:clamp(0.82rem,1.4vw,1.1rem); font-weight:900; letter-spacing:0.15em; text-transform:uppercase; }
        .pw-agenda-list { margin:0; padding:0; list-style:none; display:grid; gap:clamp(9px,1.3vw,16px); }
        .pw-agenda-list li { display:flex; align-items:center; gap:clamp(12px,1.6vw,20px); color:var(--ink); font-size:clamp(1.1rem,2.2vw,1.9rem); font-weight:750; line-height:1.2; animation:agendaSlide 520ms var(--stage-ease) both; }
        .pw-agenda-n { flex:none; display:grid; place-items:center; width:clamp(30px,3.4vw,48px); height:clamp(30px,3.4vw,48px); border-radius:12px; background:var(--acc); color:#fff; font-size:clamp(0.9rem,1.5vw,1.3rem); font-weight:900; }
        @keyframes agendaSlide { from { opacity:0; transform:translateX(-22px); } to { opacity:1; transform:none; } }
        @media (prefers-reduced-motion:reduce) { .pw-agenda-list li { animation:none; } }
        .pw-interlude-clock { color:var(--acc-deep); font-size:clamp(3.4rem,9vw,7rem); line-height:0.9; font-weight:800; font-variant-numeric:tabular-nums; letter-spacing:-0.04em; }
        .pw-hook-kicker { margin:0; color:var(--acc-deep); font-size:clamp(0.78rem,1.3vw,1rem); font-weight:900; letter-spacing:0.16em; text-transform:uppercase;
          animation:pwHookRise 560ms 180ms var(--stage-ease) both; }
        .pw-hook-rule { width:clamp(64px,7vw,110px); height:6px; border-radius:999px; background:var(--acc); transform-origin:center;
          animation:pwHookRule 640ms 480ms var(--stage-ease) both, pwHookBreathe 4.6s 2.2s ease-in-out infinite; }
        .pw-hook-text { margin:0; max-width:30ch; color:var(--head); text-align:center; white-space:pre-wrap; text-wrap:balance;
          font-size:clamp(1.9rem,3.6vw,3.8rem); line-height:1.16; font-weight:800; letter-spacing:-0.02em;
          animation:pwHookRise 680ms 640ms var(--stage-ease) both; }
        .pw-hook-text.long { font-size:clamp(1.5rem,2.6vw,2.7rem); max-width:44ch; }
        .pw-hook-direction { margin:0; color:var(--soft); font-size:clamp(0.95rem,1.7vw,1.3rem); font-weight:700;
          animation:pwHookRise 560ms 1150ms var(--stage-ease) both; }
        @keyframes pwHookRise { from { opacity:0; transform:translateY(22px); } to { opacity:1; transform:none; } }
        @keyframes pwHookRule { from { transform:scaleX(0); } to { transform:scaleX(1); } }
        @keyframes pwHookBreathe { 0%, 100% { opacity:1; } 50% { opacity:0.55; } }
        @media (prefers-reduced-motion:reduce) {
          .pw-scene, .pw-sweep, .pw-hook-kicker, .pw-hook-rule, .pw-hook-text, .pw-hook-direction { animation:none !important; }
        }
        .pw-top { display:flex; align-items:center; gap:12px; padding:0 30px; border-bottom:1px solid rgba(120,110,90,0.18); background:rgba(243,240,231,0.86); }
        .pw-dot { width:12px; height:12px; flex:none; border-radius:3px; background:var(--acc); }
        .pw-chip { flex:none; border-radius:6px; background:var(--acc); color:#fff; padding:5px 11px; font-size:0.66rem; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; }
        .pw-title { margin:0; overflow:hidden; color:var(--head); text-overflow:ellipsis; white-space:nowrap; font-size:16px; font-weight:800; }
        .pw-lesson { margin:0; overflow:hidden; color:var(--faint); text-overflow:ellipsis; white-space:nowrap; font-size:13px; font-weight:650; }
        .pw-timer { min-width:120px; flex:none; display:inline-flex; align-items:center; justify-content:center; gap:10px; margin-left:auto; border:1.2px solid var(--hair); border-radius:999px; background:var(--card); padding:7px 16px; color:var(--head); font-size:23px; line-height:0.9; font-weight:800; font-variant-numeric:tabular-nums; box-shadow:0 2px 10px rgba(40,32,20,0.06); }
        .pw-timer::before { content:""; width:8px; height:8px; border-radius:999px; background:var(--acc); }
        .pw-timer.finished { color:#A82C15; }
        .pw-timer.finished::before { background:#F95335; }
        ${TIMER_URGENCY_CSS}
        .pw-textbtns { display:inline-flex; gap:6px; margin-left:auto; }
        .pw-textbtns + .pw-timer { margin-left:12px; }
        .pw-textbtn { min-width:40px; min-height:30px; border:1.2px solid var(--hair); border-radius:8px; background:var(--card); color:var(--head); font:inherit; font-size:0.78rem; font-weight:800; cursor:pointer; }
        .pw-textbtn:hover:not(:disabled) { border-color:var(--acc); }
        .pw-textbtn:disabled { opacity:0.4; cursor:default; }
        /* --css-strip-top: see the matching note on .stage-work in
           /teacher/present. .pw-body starts exactly at the 64px topbar's
           bottom edge, itself below the vertically-centered clock, so 20px
           from here is a real floor under the clock's bottom edge - not the
           vh clamp ClassroomStateStrip.tsx falls back to when this is unset. */
        .pw-body { position:relative; min-height:0; overflow:hidden; --css-strip-top:20px; }
        .pw-cols { position:absolute; inset:0; display:grid; grid-template-columns:minmax(0,1.35fr) minmax(280px,0.65fr); gap:clamp(18px,3vw,40px); padding:clamp(24px,3.6vw,52px); }
        .pw-left { min-width:0; display:flex; flex-direction:column; gap:clamp(14px,2.2vh,22px); }
        .pw-action { margin:0; color:var(--head); font-size:clamp(1.8rem,3.4vw,3.3rem); line-height:1.06; font-weight:800; letter-spacing:-0.02em; text-wrap:balance; }
        .pw-callout { max-width:640px; border:1px solid var(--hair); border-left:6px solid var(--acc); border-radius:16px; background:var(--card); padding:16px 20px; box-shadow:0 2px 10px rgba(40,32,20,0.06); }
        .pw-callout-label { margin:0 0 8px; color:var(--acc-deep); font-size:0.68rem; font-weight:900; letter-spacing:0.13em; text-transform:uppercase; }
        .pw-steps { display:grid; gap:9px; margin:0; padding:0; list-style:none; }
        .pw-steps li { display:flex; gap:11px; align-items:baseline; color:var(--ink); font-size:clamp(1rem,1.6vw,1.35rem); line-height:1.3; font-weight:700; }
        .pw-stepn { flex:none; min-width:1.5ch; color:var(--acc-deep); font-weight:800; font-variant-numeric:tabular-nums; }
        .pw-pace { margin-top:auto; display:inline-flex; align-items:center; gap:18px; width:fit-content; border:1px solid var(--hair); border-radius:16px; background:var(--card); padding:14px 22px; box-shadow:0 2px 10px rgba(40,32,20,0.06); }
        .pw-bigtimer { color:var(--head); font-size:clamp(2.6rem,5vw,4.4rem); line-height:0.9; font-weight:800; font-variant-numeric:tabular-nums; letter-spacing:-0.03em; }
        /* The discussion-beat clock is the one the room paces against, so it
           reads bigger than the ordinary shared-clock chip. */
        .pw-bigtimer-stage { font-size:clamp(3.6rem,8vw,7rem); }
        .pw-bigtimer.finished { color:#A82C15; }
        .pw-pace-copy { display:grid; gap:3px; }
        .pw-pace-copy b { color:var(--ink); font-size:clamp(0.95rem,1.4vw,1.2rem); }
        .pw-pace-copy span { color:var(--soft); font-size:clamp(0.82rem,1.15vw,1rem); font-weight:650; }
        .pw-right { min-width:0; display:grid; align-content:center; gap:14px; }
        .pw-vocab { position:relative; border:1px solid var(--hair); border-radius:14px; background:var(--card); padding:16px 18px 14px; box-shadow:0 2px 10px rgba(40,32,20,0.06); }
        .pw-tape { position:absolute; top:-8px; left:22px; width:56px; height:16px; border-radius:3px; background:rgba(252,175,56,0.35); transform:rotate(-2deg); }
        .pw-term { display:flex; align-items:center; gap:9px; color:var(--head); font-size:clamp(1rem,1.5vw,1.3rem); font-weight:800; }
        .pw-term-dot { width:10px; height:10px; border-radius:3px; background:var(--acc); flex:none; }
        .pw-def { margin:6px 0 0; padding-top:6px; border-top:1px solid #F0D9D3; color:var(--soft); font-size:clamp(0.85rem,1.2vw,1.05rem); line-height:1.35; font-weight:650; }
        .pw-slide { position:absolute; inset:0; width:100%; height:100%; border:0; background:var(--ground); overflow:hidden; }
        .stage-slide-fallback { position:absolute; inset:0; display:grid; align-content:center; justify-items:center; gap:12px; background:var(--ground); text-align:center; padding:6vw; }
        .stage-slide-fallback p { margin:0; color:var(--ink); font-size:clamp(1.6rem,3.4vw,2.8rem); font-weight:800; }
        .stage-slide-fallback span { color:var(--soft); font-size:clamp(0.95rem,1.8vw,1.4rem); font-weight:700; }
        .pw-center { position:absolute; inset:0; display:grid; place-items:center; padding:clamp(28px,5vw,72px); text-align:center; }
        .pw-center h2 { margin:0; max-width:24ch; color:var(--head); font-size:clamp(2rem,4.6vw,4.4rem); line-height:1.05; font-weight:800; letter-spacing:-0.02em; }
        .pw-center p { margin:12px 0 0; color:var(--soft); font-size:clamp(0.95rem,1.7vw,1.3rem); font-weight:700; }
        .pw-spinner { position:absolute; inset:0; overflow:hidden; }
        .pw-check { width:min(100%,1120px); display:grid; align-content:center; gap:20px; }
        .pw-check-title { margin:0; color:var(--acc-deep); font-size:clamp(0.78rem,1.4vw,1rem); font-weight:900; letter-spacing:0.14em; text-transform:uppercase; }
        .pw-check-prompt { margin:0; color:var(--head); font-size:clamp(2rem,4.6vw,4.6rem); line-height:1.05; font-weight:800; text-wrap:balance; }
        .pw-check-count { margin:0; color:var(--soft); font-size:clamp(1rem,1.8vw,1.35rem); font-weight:700; }
        .pw-bars { height:min(42vh,330px); display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); align-items:end; gap:clamp(10px,1.8vw,22px); padding-top:20px; }
        .pw-bar-column { height:100%; display:grid; grid-template-rows:minmax(0,1fr) auto; gap:9px; align-items:end; }
        .pw-bar-track { height:100%; display:flex; align-items:flex-end; overflow:hidden; border:1px solid var(--hair); border-radius:12px 12px 6px 6px; background:#ECE7DD; }
        .pw-bar-fill { width:100%; min-height:4px; border-radius:10px 10px 4px 4px; background:var(--acc); transition:height 240ms ease; }
        .pw-bar-label { color:var(--ink); text-align:center; font-size:clamp(1rem,2vw,1.5rem); font-weight:800; }
        .pw-share { display:grid; gap:5px; border:1px solid var(--hair); border-left:6px solid var(--acc); border-radius:14px; background:var(--card); padding:13px 16px; box-shadow:0 2px 10px rgba(40,32,20,0.06); }
        .pw-share span { color:var(--acc-deep); font-size:0.68rem; font-weight:900; letter-spacing:0.12em; text-transform:uppercase; }
        .pw-share strong { color:var(--head); font-size:clamp(1.8rem,4vw,3.6rem); line-height:1; font-weight:800; }
        .pw-stems { display:grid; gap:7px; margin:0; padding-left:1.1rem; color:var(--ink); font-size:clamp(0.92rem,1.5vw,1.15rem); line-height:1.3; font-weight:700; }
        .pw-stems-lg { gap:16px; padding-left:1.3rem; font-size:clamp(1.5rem,3vw,2.6rem); line-height:1.2; font-weight:800; }
        @media (max-width:820px) { .pw-cols { grid-template-columns:1fr; overflow:auto; } .pw-lesson { display:none; } }
        @media (max-height:640px) { .pace-page { grid-template-rows:52px minmax(0,1fr); } .pw-cols { padding:18px 26px; } }
      `}</style>

      <header className="pw-top">
        <span className="pw-dot" aria-hidden="true" />
        <span className="pw-chip">{interlude ? `Transition - ${interlude.label}` : previewSample ? previewSample.label : universalStateTitle(state?.id, state?.label) || "Big Dog Math"}</span>
        <h1 className="pw-title">{previewSample ? "Preview" : flow?.presentation?.title || state?.label || "Waiting for the lesson"}</h1>
        {flow?.lesson?.title ? <p className="pw-lesson">{flow.lesson.title}</p> : null}
        <span className="pw-textbtns" aria-label="Text size">
          <button className="pw-textbtn" type="button" onClick={() => adjustTextScale(-0.25)} disabled={textScale <= 1} aria-label="Smaller text">A-</button>
          <button className="pw-textbtn" type="button" onClick={() => adjustTextScale(0.25)} disabled={textScale >= 2.5} aria-label="Bigger text">A+</button>
          <FullscreenButton className="pw-textbtn" />
        </span>
        <span className={`pw-timer${timerFinished ? " finished" : ""} ${timerUrgencyClass(currentTimerUrgency)}`} aria-label="Class timer">
          {previewSample ? "5:00" : timer ? formatTime(timerSeconds) : "--:--"}
        </span>
      </header>

      <section className="pw-body" aria-label="Pace and support" style={{ zoom: textScale }}>
        <div className="pw-sweep" key={`sweep:${sceneKey}`} aria-hidden="true" />
        <div className="pw-scene" key={sceneKey}>
        {!connected || !session || !flow || !state ? (
          previewSample?.anchor ? (
            <div className="pw-center">
              <div className="pw-hook-inner">
                <p className="pw-hook-kicker">Puzzle of the day</p>
                <span className="pw-hook-rule" aria-hidden="true" />
                <h2 className={`pw-hook-text${previewSample.anchor.length > 150 ? " long" : ""}`}>{previewSample.anchor}</h2>
                <p className="pw-hook-direction">{previewSample.action}</p>
              </div>
            </div>
          ) : previewSample ? (
            <div className="pw-cols">
              <div className="pw-left">
                <h2 className="pw-action">{previewSample.action}</h2>
                <div className="pw-callout">
                  <p className="pw-callout-label">Do this</p>
                  <ul className="pw-steps">
                    {previewSample.steps.map((step, index) => (
                      <li key={step}><span className="pw-stepn">{index + 1}</span>{step}</li>
                    ))}
                  </ul>
                </div>
                <div className="pw-pace">
                  <span className="pw-bigtimer">5:00</span>
                  <span className="pw-pace-copy"><b>{previewSample.label}</b><span>Preview - no live session</span></span>
                </div>
              </div>
              <div className="pw-right">
                {[{ term: "Vocabulary", def: "Fills from the lesson step during class." }].map((card) => (
                  <div className="pw-vocab" key={card.term}>
                    <span className="pw-tape" aria-hidden="true" />
                    <div className="pw-term"><span className="pw-term-dot" />{card.term}</div>
                    <p className="pw-def">{card.def}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="pw-center">
              <div>
                <h2>{loading ? "Connecting to class" : "Ready for class"}</h2>
                <p>{sessionMessage}</p>
              </div>
            </div>
          )
        ) : interlude ? (
          <div className="pw-center">
            <div className="pw-hook-inner">
              <p className="pw-hook-kicker">Transition</p>
              <h2 className="pw-hook-text">{interlude.label}</h2>
              <p className="pw-hook-direction">{interlude.directions}</p>
              <span className="pw-interlude-clock">{formatTime(interludeSeconds)}</span>
            </div>
          </div>
        ) : mirroredSlideUrl ? (
          <SlideFrameScene url={mirroredSlideUrl} fit={mirroredSlideFit} className="pw-slide" />
        ) : warmupAgenda ? (
          <div className="pw-agenda" aria-label="Today's agenda">
            <p className="pw-agenda-kicker">Today&apos;s plan</p>
            <ol className="pw-agenda-list">
              {agendaItems.map((item, index) => (
                <li key={item} style={{ animationDelay: `${0.2 + index * 0.28}s` }}>
                  <span className="pw-agenda-n">{index + 1}</span>
                  <span className="pw-agenda-text">{item}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : anchorPose ? (
          <div className="pw-center">
            <div className="pw-hook-inner">
              <p className="pw-hook-kicker">Puzzle of the day</p>
              <span className="pw-hook-rule" aria-hidden="true" />
              <h2 className={`pw-hook-text${anchorText.length > 150 ? " long" : ""}`}>{anchorText}</h2>
              {paceAction ? <p className="pw-hook-direction">{paceAction}</p> : null}
            </div>
          </div>
        ) : linkedSpinnerMode ? (
          <div className="pw-spinner">
            <ClassroomSpinner
              key={`${session.id}:${spinnerSyncScope}:mirror`}
              mode={linkedSpinnerMode}
              sessionId={session.id}
              syncKey={session.join_code}
              periodId={session.period_id || null}
              stateId={state.id}
              syncScope={spinnerSyncScope}
              role="mirror"
              learningIntention={flow.lesson?.learningIntention}
              successCriterion={publicSuccessCriterion(flow.lesson?.selectedSuccessCriterion)}
            />
          </div>
        ) : poll ? (
          // Gate on the PRESENCE of a poll, never on its kind. The kind-only
          // gate that used to live here ("poll.kind === 'fist-to-five'") was
          // half right: it correctly stopped a fist-to-five histogram being
          // drawn for a multiple-choice poll that never ran one, but it did it
          // by dropping the whole scene - so a multiple-choice, short-answer or
          // structured-numeric check fell through to the plain directions
          // column, and the support screen said nothing at the one moment the
          // room was answering. Reported live 2026-08-03 as "the first ready
          // check shows the previous state's directions": those directions were
          // the fallback, still on screen because nothing replaced them.
          // THE TWIN ON present IS NOT IDENTICAL, AND DO NOT ASSUME IT IS.
          // present's showPollPanel is presence AND a three-way condition
          // (learning-check theme, or results stage, or no Main Display), so a
          // still-responding short-answer step that HAS a Main Display shows
          // that display on the main projector while this screen shows the
          // check. That is the mirror rule working - main carries the content,
          // the support screen carries the question and the count - so the two
          // gates are deliberately different and neither is a copy of the
          // other. What IS shared: both branch on kind INSIDE the panel rather
          // than gating on it, and that part must stay in step.
          <div className="pw-center">
            <div className="pw-check">
              {poll.kind !== "fist-to-five" ? (
                // Per the pace/student mirror rule: a student-interactive step
                // is a real second purpose, and what this screen owes the room
                // is the question plus how many have answered. It cannot leak
                // an answer - the published poll carries no answer key at all
                // (LiveFlowPoll has no correctAnswer field) and choices are
                // never read here.
                // THE QUESTION STAYS UP IN BOTH STAGES. An earlier draft swapped
                // it for "Class results" at results stage, which put a heading
                // promising results above no results - this screen draws no
                // tally for these kinds - and removed the question the class is
                // right then discussing. present keeps the question up through
                // results for the same reason.
                <>
                  <p className="pw-check-title">Check open</p>
                  <h2 className="pw-check-prompt">{poll.question}</h2>
                  {poll.kind === "structured-numeric" ? null : (
                    // structured-numeric is PROMPT ONLY in every stage - no
                    // reveal and no response count. That is a deliberate
                    // decision on present, not an oversight there, and the two
                    // surfaces must agree on it.
                    <p className="pw-check-count">
                      {pollAnswers.length} response{pollAnswers.length === 1 ? "" : "s"}
                      {poll.stage === "results" ? " in." : " received. Names stay private."}
                    </p>
                  )}
                </>
              ) : (
              <>
              <p className="pw-check-title">Fist to five</p>
              {/* No class histogram on the support projector (Steele, 2026-08-06:
                 the fist-to-five distribution is for the teacher on the iPad, not
                 the room). The support screen shows the question and the count in
                 every stage, matching the other kinds above; the anonymous
                 "Where we are as a class" bars that used to draw at results stage
                 are gone. The teacher reads the distribution on /teacher/remote. */}
              <h2 className="pw-check-prompt">Answer on your Chromebook</h2>
              <p className="pw-check-count">{pollAnswers.length} response{pollAnswers.length === 1 ? "" : "s"} received. Names stay private.</p>
              </>
              )}
            </div>
          </div>
        ) : galleryWalkTimeline && routineConfig?.kind === "gallery-walk" ? (
          /* Gallery Walk, running. Same division of labour as the discussion
             timeline: the SEQUENCE of stations lives on the main projector; this
             screen carries the one number the room is working against - time
             left AT THIS STATION - and the authored prompts as the language.
             SILENT ON PURPOSE. This screen has no audio-arming affordance (no
             AttentionPulse is mounted here), so a beep from it could be blocked
             with nothing on screen to say so. The red pulsing number inside the
             beep window is this screen's copy of the cue, and it keys off the
             same engine flag the projector's beep does. */
          <div className="pw-cols">
            <div className="pw-left">
              <p className="pw-callout-label">
                Gallery Walk - {routineConfig.stationCount} station{routineConfig.stationCount === 1 ? "" : "s"}
              </p>
              <h2 className="pw-action">
                {galleryWalkStage && !galleryWalkStage.done && galleryWalkStage.phase
                  ? galleryWalkStage.phase.direction
                  : routineConfig.recordPrompt}
              </h2>
              <div className="pw-callout">
                <p className="pw-callout-label">Notice</p>
                <ul className="pw-stems"><li>{routineConfig.observationPrompt}</li></ul>
                <p className="pw-callout-label">Move</p>
                <ul className="pw-stems"><li>{routineConfig.movementDirections}</li></ul>
              </div>
              {timer ? (
                <div className="pw-pace">
                  <span
                    className={`pw-bigtimer pw-bigtimer-stage${timerFinished ? " finished" : ""} ${timerUrgencyClass(
                      timerUrgency(
                        galleryWalkStage && !galleryWalkStage.done ? galleryWalkStage.secondsLeft : timerSeconds,
                        { running: Boolean(timer?.running), finished: timerFinished },
                      ),
                    )}`}
                  >
                    {formatTime(galleryWalkStage && !galleryWalkStage.done ? galleryWalkStage.secondsLeft : timerSeconds)}
                  </span>
                  <span className="pw-pace-copy">
                    <b>{galleryWalkStage?.phase?.label || state.label}</b>
                    <span>
                      {galleryWalkStage && !galleryWalkStage.done
                        ? "Left at this station"
                        : "Shared class clock"}
                    </span>
                  </span>
                </div>
              ) : null}
            </div>
            <div className="pw-right">
              <div className="pw-vocab">
                <span className="pw-tape" aria-hidden="true" />
                <div className="pw-term"><span className="pw-term-dot" />Share</div>
                <p className="pw-def">{routineConfig.sharePrompt}</p>
              </div>
            </div>
          </div>
        ) : hasDiscussionTimeline ? (
          /* Concrete-phase timeline step: the SEQUENCE lives only on the main
             projector. The support screen carries the language - big sentence
             stems and the vocabulary - not the pacing directions dump. */
          <div className="pw-cols">
            <div className="pw-left">
              <p className="pw-callout-label">Sentence stems</p>
              <ul className="pw-stems pw-stems-lg">
                {discussionStems.slice(0, 6).map((stem) => <li key={stem}>{stem}</li>)}
              </ul>
              {timer ? (
                <div className="pw-pace">
                  <span className={`pw-bigtimer pw-bigtimer-stage${timerFinished ? " finished" : ""} ${timerUrgencyClass(stageUrgency)}`}>{formatTime(stageSeconds)}</span>
                  <span className="pw-pace-copy">
                    <b>{discussionStage?.phase ? discussionPhaseLabel(discussionStage.phase) : (flow.presentation?.title || state.label)}</b>
                    <span>{discussionStage && !discussionStage.done ? "Left in this beat" : "Shared class clock"}</span>
                  </span>
                </div>
              ) : null}
            </div>
            <div className="pw-right">
              {vocabCards.map((card) => (
                <div className="pw-vocab" key={card.term}>
                  <span className="pw-tape" aria-hidden="true" />
                  <div className="pw-term"><span className="pw-term-dot" />{card.term}</div>
                  {card.def ? <p className="pw-def">{card.def}</p> : null}
                </div>
              ))}
            </div>
          </div>
        ) : isDiscussion ? (
          <div className="pw-cols">
            <div className="pw-left">
              <p className="pw-callout-label">{phase?.label || "Discussion"}</p>
              <h2 className="pw-action">{phase?.subtitle || paceDirections}</h2>
              {phase?.id === "share" && phase.selectedSharer ? (
                <div className="pw-share"><span>Ready to share</span><strong>{phase.selectedSharer}</strong></div>
              ) : null}
              {discussionStems.length ? (
                <div className="pw-callout">
                  <p className="pw-callout-label">Sentence stems</p>
                  <ul className="pw-stems">{discussionStems.slice(0, 6).map((stem) => <li key={stem}>{stem}</li>)}</ul>
                </div>
              ) : null}
              {timer ? (
                <div className="pw-pace">
                  <span className={`pw-bigtimer${timerFinished ? " finished" : ""} ${timerUrgencyClass(currentTimerUrgency)}`}>{formatTime(timerSeconds)}</span>
                  <span className="pw-pace-copy"><b>{flow.presentation?.title || state.label}</b><span>Shared class clock</span></span>
                </div>
              ) : null}
            </div>
            <div className="pw-right">
              {vocabCards.map((card) => (
                <div className="pw-vocab" key={card.term}>
                  <span className="pw-tape" aria-hidden="true" />
                  <div className="pw-term"><span className="pw-term-dot" />{card.term}</div>
                  {card.def ? <p className="pw-def">{card.def}</p> : null}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="pw-cols">
            <div className="pw-left">
              <h2 className="pw-action">{paceAction}</h2>
              {paceSteps.length ? (
                <div className="pw-callout">
                  <p className="pw-callout-label">Do this</p>
                  <ul className="pw-steps">
                    {paceSteps.map((step, index) => (
                      <li key={step}><span className="pw-stepn">{index + 1}</span>{step}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {timer ? (
                <div className="pw-pace">
                  <span className={`pw-bigtimer${timerFinished ? " finished" : ""} ${timerUrgencyClass(currentTimerUrgency)}`}>{formatTime(timerSeconds)}</span>
                  <span className="pw-pace-copy"><b>{flow.presentation?.title || state.label}</b><span>Shared class clock</span></span>
                </div>
              ) : null}
            </div>
            <div className="pw-right">
              {vocabCards.map((card) => (
                <div className="pw-vocab" key={card.term}>
                  <span className="pw-tape" aria-hidden="true" />
                  <div className="pw-term"><span className="pw-term-dot" />{card.term}</div>
                  {card.def ? <p className="pw-def">{card.def}</p> : null}
                </div>
              ))}
            </div>
          </div>
        )}
        </div>
        {/* Last child of the body stage, so it paints over the inset-0 scene.
            Pinned top right INSIDE the stage rather than in the topbar, where the
            clock already lives. */}
        <ClassroomStateStrip strip={behaviorStrip} showWords={stripWords} overridden={behaviorOverridden} />
      </section>
      {/* The LessonSlideStage overlay used to sit here, passing screen="main" so
          the support projector drew the MAIN screen's zones. It is gone
          (2026-08-04, Steele): two visual languages inside one lesson, because
          the gate was a per-surface list of EXCLUSIONS and this surface's copy
          never matched present's. `88a0a84` had already hand-synced the tool and
          You Do clauses; the one still diverging when the overlay came out was
          `launch`, where present has a `!lessonVisual` clause and pace has none -
          measured on /demo, present kept its own frame while pace showed the
          colour band, at the same instant. Pace draws its own frame on every
          state now, which is also the end of the "keep the two clause lists
          together" hazard. */}
      {/* Write-on-screen was mounted only on /teacher/present, so the support
          projector could never be annotated - the teacher circled something on
          the iPad and half the room's screen never changed. */}
      {inkOverlay && !inkOverlay.embed ? <ScreenInkOverlay room={inkOverlay.room} /> : null}
      {/* Reach controls: the teacher can be at this panel with the iPad Remote left
          elsewhere, and this is one of the two screens they might be standing in
          front of. See CLAUDE.md rule 6 / "no swipe or press next anywhere on the
          screen". Real projector only, same gate as present's ClassroomAudioHost. */}
      <StageControlToolbar
        sessionId={
          inkOverlay && !inkOverlay.embed && !isStudioPreviewMode && !previewStage && session?.id
            ? session.id
            : null
        }
        timerRunning={Boolean(timer?.running)}
        timerActive={Boolean(timer) || Boolean(flow?.poll?.stage === "results" && flow?.sequence)}
        canGoBack={Boolean(flow?.sequence && flow.sequence.currentIndex > 0)}
        canGoForward={Boolean(
          flow?.sequence
          && (!flow.sequence.totalSteps || flow.sequence.currentIndex + 1 < flow.sequence.totalSteps),
        )}
      />
    </main>
  );
}
