// Notion lesson -> live-flow sequence. Extracted from
// src/app/api/control-remote/route.ts on 2026-08-03, unchanged, so that the
// rehearsal runner (/teacher/rehearse) builds its sequence with the SAME code
// the real lesson start uses.
//
// That sharing is the whole point. A preview built by a second, parallel
// implementation drifts from the runtime and then lies to the teacher about
// what the room will see - which is worse than having no preview, because a
// rehearsal that disagrees with the lesson is trusted right up until the moment
// it is wrong in front of thirty students.
//
// Both functions here are PURE: no Supabase, no fetch, no clock. The DB work in
// navigateFlow (opening the poll row) deliberately stayed behind in the route,
// because that is the part a rehearsal must NOT do.
//
// `LessonData` is imported as a TYPE ONLY. notionLessons.ts reads NOTION_TOKEN
// and must never reach a browser bundle; a type-only import is erased at
// compile time, so this module stays safe to pull into server code that already
// has the lesson in hand.

import { CLOSEOUT_DIRECTIONS, DEFAULT_STATES } from "@/lib/classStates";
import { discussionSupportsForLesson, inferClassroomStage, usesDiscussionProtocol } from "@/lib/classroomPilot";
import { publicSuccessCriterion } from "@/lib/successCriterion";
import type { LessonData } from "@/lib/notionLessons";
import {
  liveAssignedToolRoute,
  resolveLiveStepPollKind,
  splitLiveFlowLines,
  splitLiveFlowVocabulary,
  type LiveClassFlowSnapshot,
  type LiveFlowSequenceStep,
} from "@/lib/liveClassFlow";

export function stepsFromLesson(lesson: LessonData): LiveFlowSequenceStep[] {
  return lesson.steps.map((step) => {
    const state = DEFAULT_STATES.find((candidate) => candidate.id === step.stateId);
    const isDiscussion = usesDiscussionProtocol(step.stateId, step.title || state?.label || "");
    // A concrete-phase timeline step wants its authored stems + vocabulary too.
    const hasDiscussionPhases = Boolean(step.discussionPhases && step.discussionPhases.trim());
    const configuredDiscussionSupports = discussionSupportsForLesson(lesson.lessonCode);
    const resourceUrl = (step.responseMode.trim().toLowerCase() === "assigned tool" ? liveAssignedToolRoute(step.tool) : null)
      || step.linkUrl
      || (step.stateId === "warmup" ? lesson.warmUpLink : "")
      || (step.stateId === "exit" ? lesson.exitTicketLink : "")
      || "";
    return {
      stateId: step.stateId,
      label: step.title || state?.label || "Lesson state",
      description: step.studentDirections || state?.desc || "Wait for the teacher's directions.",
      color: state?.color || "#35785a",
      semantic: inferClassroomStage(step.stateId, step.title || state?.label || ""),
      durationSeconds: Math.max(60, step.duration * 60),
      question: step.question || "",
      pollKind: isDiscussion
        ? null
        : resolveLiveStepPollKind(step.responseMode, step.pollKind, step.stateId),
      choices: step.choices || [],
      correctAnswer: step.correctAnswer || "",
      standard: step.standard || "",
      resourceUrl,
      paperTask: step.paperTask || "",
      notionStepId: step.id || null,
      notionLessonId: lesson.id || null,
      lessonCode: lesson.lessonCode || "",
      mainDisplay: step.mainDisplay || "",
      paceDirections: step.stateId === "closeout"
        ? CLOSEOUT_DIRECTIONS
        : step.paceDirections || state?.paceAction || step.studentDirections || state?.desc || "",
      studentAction: step.stateId === "closeout"
        ? CLOSEOUT_DIRECTIONS
        : step.studentAction || state?.studentAction || step.studentDirections || state?.desc || "",
      discussionStems: isDiscussion
        ? splitLiveFlowLines(step.discussionStems || lesson.discussionStems)
          .concat(step.discussionStems || lesson.discussionStems ? [] : configuredDiscussionSupports.sentenceStems)
        : hasDiscussionPhases
          ? splitLiveFlowLines(step.discussionStems || lesson.discussionStems)
          : [],
      vocabulary: isDiscussion
        ? splitLiveFlowVocabulary(step.vocabulary || lesson.discussionVocabulary)
          .concat(step.vocabulary || lesson.discussionVocabulary ? [] : configuredDiscussionSupports.keyVocabulary)
        : hasDiscussionPhases
          ? splitLiveFlowVocabulary(step.vocabulary || lesson.discussionVocabulary)
          : [],
      discussionPhases: step.discussionPhases || undefined,
      responseMode: step.responseMode || "",
      workSpaceAvailable: step.workSpaceAvailable,
      slideOverlay: step.slideOverlay || undefined,
      slideUrl: step.slideUrl || undefined,
      slideMirror: step.slideMirror || undefined,
      slideFit: step.slideFit === "cover" ? "cover" : undefined,
      publicSurfaceMode: step.publicSurfaceMode,
      routineConfig: step.routineConfig,
      eyes: step.eyes || "",
      voice: step.voice || "",
      supplies: step.supplies || "",
      body: step.body || "",
    };
  });
}

export function lessonSnapshotFromNotion(lesson: LessonData): NonNullable<LiveClassFlowSnapshot["lesson"]> {
  const criterion = publicSuccessCriterion(lesson.selectedSuccessCriterion);
  return {
    id: lesson.id || null,
    code: lesson.lessonCode,
    title: lesson.title,
    learningIntention: lesson.learningIntention,
    successCriteria: criterion,
    selectedSuccessCriterion: criterion,
    classroomMode: lesson.classroomMode,
    discussionStems: splitLiveFlowLines(lesson.discussionStems),
    discussionVocabulary: splitLiveFlowVocabulary(lesson.discussionVocabulary),
    requiredPaperWork: lesson.requiredPaperWork,
    requiredDigitalWork: lesson.requiredDigitalWork,
    optionalSupport: lesson.optionalSupport,
    bigDogChallenge: lesson.bigDogChallenge,
    dueAndTurnIn: lesson.dueAndTurnIn,
    helpPath: lesson.helpPath,
    anchorProblem: lesson.anchorProblem,
    agenda: lesson.agenda,
    reminders: lesson.reminders,
  };
}
