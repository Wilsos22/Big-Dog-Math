"use client";

// Studio preview bridge. Screen Studio embeds the REAL /teacher/present and
// /teacher/pace pages in iframes and posts a draft snapshot to them, so the
// previews are the live surfaces rather than a second hand-built copy that
// drifts. This module defines the message contract and the client-side
// draft-to-snapshot builder, plus a hook the surfaces use to render from a
// posted snapshot instead of a live session.

import { useEffect, useState } from "react";
import type { ClassroomStageId } from "@/lib/classroomPilot";
import { LIVE_FLOW_MODE, type LiveClassFlowSnapshot } from "@/lib/liveClassFlow";
import { stripFromStep } from "@/lib/classroomStateStrip";

export const STUDIO_PREVIEW_MESSAGE = "bdm-studio-preview";

export interface StudioPreviewInput {
  stateId: string;
  label: string;
  semantic: ClassroomStageId;
  color: string;
  durationSeconds: number;
  mainDisplay: string;
  paceDirections: string;
  studentAction: string;
  responseMode: string;
  publicSurfaceMode?: string;
  notionStepId: string | null;
  slideOverlay?: string;
  discussionStems: string[];
  vocabulary: string[];
  // The authored classroom state strip. All four or the preview shows no strip,
  // exactly as the projector will.
  eyes?: string;
  voice?: string;
  supplies?: string;
  body?: string;
  totalSteps: number;
  currentIndex: number;
  lesson: {
    id: string | null;
    code: string;
    title: string;
    learningIntention: string;
    successCriteria: string;
    selectedSuccessCriterion?: string;
    anchorProblem?: string;
    requiredPaperWork?: string;
    requiredDigitalWork?: string;
    dueAndTurnIn?: string;
    helpPath?: string;
    optionalSupport?: string;
    bigDogChallenge?: string;
  };
}

const BOARD_STATES = new Set(["i-do", "we-do", "manip"]);

// Build the same flow snapshot shape the live surfaces render, from the draft
// the teacher is editing. Timer is shown paused at full duration; there is no
// poll (learning-check renders its target view without one).
export function buildStudioPreviewSnapshot(input: StudioPreviewInput): LiveClassFlowSnapshot {
  const mode: NonNullable<LiveClassFlowSnapshot["presentation"]>["mode"] = BOARD_STATES.has(input.stateId)
    ? "board"
    : "directions";
  const total = Math.max(1, Math.round(input.durationSeconds));
  const step = {
    stateId: input.stateId,
    label: input.label,
    description: input.paceDirections || input.mainDisplay,
    color: input.color,
    semantic: input.semantic,
    durationSeconds: total,
    question: "",
    pollKind: null,
    choices: [],
    correctAnswer: "",
    standard: "",
    resourceUrl: "",
    paperTask: input.lesson.requiredPaperWork || "",
    notionStepId: input.notionStepId,
    notionLessonId: input.lesson.id,
    lessonCode: input.lesson.code,
    mainDisplay: input.mainDisplay,
    paceDirections: input.paceDirections,
    studentAction: input.studentAction,
    responseMode: input.responseMode,
    publicSurfaceMode: input.publicSurfaceMode as never,
    discussionStems: input.discussionStems,
    vocabulary: input.vocabulary,
    slideOverlay: input.slideOverlay,
    eyes: input.eyes,
    voice: input.voice,
    supplies: input.supplies,
    body: input.body,
  };
  return {
    version: 2,
    updatedAt: new Date().toISOString(),
    state: {
      id: input.stateId,
      label: input.label,
      description: input.paceDirections || input.mainDisplay,
      color: input.color,
      semantic: input.semantic,
    },
    phase: null,
    timer: { totalSeconds: total, secondsLeft: total, running: false, finished: false, endsAt: null },
    poll: null,
    resource: null,
    presentation: {
      title: input.label,
      body: input.mainDisplay,
      mainDisplay: input.mainDisplay,
      mode,
      notionStepId: input.notionStepId,
      boardOpen: false,
      paceDirections: input.paceDirections,
      studentAction: input.studentAction,
      responseMode: input.responseMode,
      publicSurfaceMode: input.publicSurfaceMode as never,
      discussionStems: input.discussionStems,
      vocabulary: input.vocabulary,
      // Studio and /demo show the REAL surfaces, so the state strip has to
      // travel with the previewed step or the preview quietly lies about what
      // the projector will show.
      behaviorStrip: stripFromStep(step),
    },
    tool: null,
    lesson: {
      id: input.lesson.id,
      code: input.lesson.code,
      title: input.lesson.title,
      learningIntention: input.lesson.learningIntention,
      successCriteria: input.lesson.successCriteria,
      selectedSuccessCriterion: input.lesson.selectedSuccessCriterion,
      discussionStems: input.discussionStems,
      discussionVocabulary: input.vocabulary,
      requiredPaperWork: input.lesson.requiredPaperWork,
      requiredDigitalWork: input.lesson.requiredDigitalWork,
      optionalSupport: input.lesson.optionalSupport,
      bigDogChallenge: input.lesson.bigDogChallenge,
      dueAndTurnIn: input.lesson.dueAndTurnIn,
      helpPath: input.lesson.helpPath,
      anchorProblem: input.lesson.anchorProblem,
    },
    sequence: {
      currentIndex: input.currentIndex,
      totalSteps: input.totalSteps,
      nextLabel: null,
      nextDirections: null,
      advanceMode: "manual",
      steps: Array.from({ length: input.totalSteps }, (_, index) => (index === input.currentIndex ? step : {
        ...step,
        stateId: `placeholder-${index}`,
        slideOverlay: undefined,
      })),
    },
    paper: input.lesson.requiredPaperWork ? { task: input.lesson.requiredPaperWork } : null,
  };
}

export function isStudioPreviewMode(): boolean {
  try {
    return new URLSearchParams(window.location.search).get("studioPreview") === "1";
  } catch {
    return false;
  }
}

// The surfaces call this once. In studio-preview mode it returns the snapshot
// posted by the parent frame (and null until the first message); otherwise it
// stays inert and the surface uses its normal session fetch. The optional
// pollAnswers ride the same message so the /demo run-through can trickle a
// fictional class's responses onto the teacher surfaces; Studio never sends
// them and the surfaces treat them as absent.
export function useStudioPreviewSnapshot(): {
  active: boolean;
  snapshot: LiveClassFlowSnapshot | null;
  pollAnswers: { id: string; answer: string | null }[] | null;
} {
  const [active] = useState(isStudioPreviewMode);
  const [snapshot, setSnapshot] = useState<LiveClassFlowSnapshot | null>(null);
  const [pollAnswers, setPollAnswers] = useState<{ id: string; answer: string | null }[] | null>(null);
  useEffect(() => {
    if (!active) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as {
        type?: string;
        snapshot?: LiveClassFlowSnapshot;
        pollAnswers?: { id: string; answer: string | null }[];
      } | null;
      if (!data || data.type !== STUDIO_PREVIEW_MESSAGE || !data.snapshot) return;
      setSnapshot(data.snapshot);
      setPollAnswers(Array.isArray(data.pollAnswers) ? data.pollAnswers : null);
    };
    window.addEventListener("message", onMessage);
    // Tell the parent this frame is ready to receive the first snapshot.
    try { window.parent?.postMessage({ type: `${STUDIO_PREVIEW_MESSAGE}-ready` }, "*"); } catch { /* ignore */ }
    return () => window.removeEventListener("message", onMessage);
  }, [active]);
  return { active, snapshot, pollAnswers };
}

// A synthetic StageSession the surfaces can drop into their existing session
// state so every downstream read works unchanged.
export function studioPreviewSession(snapshot: LiveClassFlowSnapshot) {
  return {
    id: "studio-preview",
    period_id: "studio-preview",
    status: "open",
    join_code: null,
    started_at: new Date().toISOString(),
    broadcast: LIVE_FLOW_MODE,
    live_flow: snapshot,
    remote_command: null,
    abbie: null,
  };
}
