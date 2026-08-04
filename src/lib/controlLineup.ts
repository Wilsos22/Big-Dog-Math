// The single mapping between /control's editable LINEUP and the published
// live_flow SEQUENCE, in both directions.
//
// WHY THIS FILE EXISTS. Control's snapshot is a FULL REPLACE, republished about
// once a second while a timer runs. Every field the publish mapper forgets is
// DELETED from the room's snapshot; every field the rehydrate mapper forgets is
// dropped the next time Control reconnects or a remote command rehydrates it.
// Those two mappers used to be four hand-maintained object literals inside
// src/app/control/page.tsx - two at 8-space indent, one at 10, one at 14 - and
// they had already drifted:
//
//   - the remote-command rehydrate dropped eyes / voice / supplies / body, so a
//     Control reconnect mid-lesson silently killed the classroom state strip on
//     both projectors for the rest of the period;
//   - the publish mapper dropped `discussionPhases`, which /api/control-remote
//     reads back off sequence.steps on every advance - so the first Remote-driven
//     Next deleted the discussion timeline on both projectors and every
//     Chromebook, and rehydrate then wrote that loss into Control's own lineup,
//     making it permanent for the period.
//
// Neither failure showed up anywhere. The lesson kept running with the strip
// gone, which reads as "the strip is not authored on this lesson" rather than
// as a bug. Adding a field to LiveFlowSequenceStep now means editing ONE object
// literal per direction in this file, and scripts/control-lineup-contract.mjs
// fails if the round trip stops being lossless.
//
// IMPORTS ARE TYPE-ONLY BY DESIGN. Every runtime helper arrives through
// `FlowStepDeps` instead of being imported, so this module emits zero `require`
// calls and the contract can load the compiled file on its own. Note the guard
// is NOT the compiler: the contract builds through
// scripts/tsconfig.control-lineup-contract.json, which extends the root config
// and therefore RESOLVES `@/` happily - so a runtime import would type-check
// clean and then fail at require() time with "Cannot find module", an error
// that looks nothing like its cause. Keep every import here `import type`.

import type { LiveFlowSequenceStep, LivePollKind } from "./liveClassFlow";
import type { PublicSurfaceMode } from "./lessonStepMetadata";
import type { PublicLessonRoutineConfig } from "./lessonRoutineConfig";

/** One editable row of /control's lineup. */
export interface LineupItem {
  uid: string;
  stateId: string;
  minutes?: number;
  title?: string;
  studentDirections?: string;
  question?: string;
  pollKind?: LivePollKind | "";
  choices?: string[];
  correctAnswer?: string;
  standard?: string;
  notionStepId?: string;
  notionLessonId?: string;
  lessonCode?: string;
  linkUrl?: string;
  paperTask?: string;
  advance?: string;
  mainDisplay?: string;
  paceDirections?: string;
  studentAction?: string;
  remoteActions?: string;
  // Carried through the published sequence so a Control reconnect cannot wipe
  // the slide overlays the lesson authored.
  slideOverlay?: string;
  slideUrl?: string;
  slideMirror?: boolean;
  discussionStems?: string;
  vocabulary?: string;
  discussionPhases?: string;
  responseMode?: string;
  workSpaceAvailable?: boolean;
  publicSurfaceMode?: PublicSurfaceMode;
  routineConfig?: PublicLessonRoutineConfig | null;
  // The authored classroom state strip, carried through the published sequence
  // and back out of it on reconnect for the same reason slideOverlay is.
  eyes?: string;
  voice?: string;
  supplies?: string;
  body?: string;
}

/** The subset of a bank state the mappers read. */
export interface LineupBankState {
  id: string;
  label?: string;
  desc?: string;
  color?: string;
  paceAction?: string;
  studentAction?: string;
}

/** The subset of the active lesson context the publish mapper reads. */
export interface LineupLessonContext {
  code?: string;
  discussionStems?: string;
  discussionVocabulary?: string;
}

export interface DiscussionSupports {
  sentenceStems: string[];
  keyVocabulary: string[];
}

/**
 * Runtime helpers, injected rather than imported (see the header note).
 * These are the same functions /control already imports; page.tsx builds one
 * frozen deps object and hands it to both call sites.
 */
export interface FlowStepDeps {
  inferClassroomStage: (stateId: string, label: string) => LiveFlowSequenceStep["semantic"];
  usesDiscussionProtocol: (stateId: string, label: string) => boolean;
  resolveLiveStepPollKind: (
    responseMode: string | undefined,
    pollKind: LivePollKind | "" | undefined,
    stateId: string,
  ) => LivePollKind | null;
  splitLiveFlowLines: (value: string | undefined) => string[];
  splitLiveFlowVocabulary: (value: string | undefined) => string[];
  discussionSupportsForLesson: (lessonCode: string | undefined) => DiscussionSupports;
  defaultPublicSurfaceModeForState: (stateId: string) => PublicSurfaceMode;
  // The caller closes over its own bank rather than passing it through, so this
  // module never has to know the full ClassState shape.
  minutesForItem: (item: LineupItem) => number;
}

/** The default a step falls back to when neither the item nor its bank state names one. */
export const FALLBACK_STEP_COLOR = "#35785a";
export const FALLBACK_STEP_LABEL = "Lesson state";
export const FALLBACK_STEP_DESCRIPTION = "Wait for the teacher's directions.";

/**
 * LINEUP -> PUBLISHED STEP. The authoring direction: what the room receives.
 *
 * KNOWN DIVERGENCE FROM `stepsFromLesson` (lessonFlowBuild.ts:72-83), left in
 * place deliberately on 2026-08-03 rather than "fixed" by a refactor. The
 * server has a THIRD arm for authored stems and vocabulary: a step carrying
 * discussion phases keeps its authored stems even when it is not a `discussion`
 * state. Control has no such arm, so on that kind of step the server publishes
 * the stems and Control's next republish replaces them with []. Changing it
 * changes what students read on screen, which is Steele's call, not a
 * side effect of moving code. Do not close this gap without his word.
 */
export function flowSnapshotForStep(
  item: LineupItem,
  bank: LineupBankState[],
  lesson: LineupLessonContext | null,
  deps: FlowStepDeps,
): LiveFlowSequenceStep {
  const itemState = bank.find((candidate) => candidate.id === item.stateId);
  const label = item.title || itemState?.label || FALLBACK_STEP_LABEL;
  // NOT `label`. The published label falls back to "Lesson state", but the two
  // predicates below were always given "" when nothing was authored, and they
  // pattern-match on the label text - feeding them the fallback would let the
  // words "Lesson state" influence the inferred stage. Behaviour-preserving.
  const matchLabel = item.title || itemState?.label || "";
  const isDiscussion = deps.usesDiscussionProtocol(item.stateId, matchLabel);
  const authoredStems = item.discussionStems || lesson?.discussionStems;
  const authoredVocabulary = item.vocabulary || lesson?.discussionVocabulary;
  const lessonCode = item.lessonCode || lesson?.code;

  return {
    stateId: item.stateId,
    label,
    description: item.studentDirections || itemState?.desc || FALLBACK_STEP_DESCRIPTION,
    color: itemState?.color || FALLBACK_STEP_COLOR,
    semantic: deps.inferClassroomStage(item.stateId, matchLabel),
    durationSeconds: deps.minutesForItem(item) * 60,
    question: item.question || "",
    // A discussion step runs the protocol, never a poll.
    pollKind: isDiscussion
      ? null
      : deps.resolveLiveStepPollKind(item.responseMode, item.pollKind, item.stateId),
    choices: item.choices || [],
    correctAnswer: item.correctAnswer || "",
    standard: item.standard || "",
    resourceUrl: item.linkUrl || "",
    paperTask: item.paperTask || "",
    notionStepId: item.notionStepId || null,
    notionLessonId: item.notionLessonId || null,
    lessonCode: lessonCode || "",
    mainDisplay: item.mainDisplay || "",
    paceDirections:
      item.paceDirections || itemState?.paceAction || item.studentDirections || itemState?.desc || "",
    studentAction:
      item.studentAction || itemState?.studentAction || item.studentDirections || itemState?.desc || "",
    // Catalog copy may only stand in on a real discussion step - it reached
    // projectors on warm-ups and closeouts once, unchanged all period.
    discussionStems: isDiscussion
      ? deps
          .splitLiveFlowLines(authoredStems)
          .concat(authoredStems ? [] : deps.discussionSupportsForLesson(lessonCode).sentenceStems)
      : [],
    vocabulary: isDiscussion
      ? deps
          .splitLiveFlowVocabulary(authoredVocabulary)
          .concat(authoredVocabulary ? [] : deps.discussionSupportsForLesson(lessonCode).keyVocabulary)
      : [],
    responseMode: item.responseMode || "",
    workSpaceAvailable: item.workSpaceAvailable,
    publicSurfaceMode: item.publicSurfaceMode || deps.defaultPublicSurfaceModeForState(item.stateId),
    routineConfig: item.routineConfig || null,
    // All of these are READ BACK during rehydration. Omitting any of them meant
    // a Control reconnect - or a remote-driven rehydrate - silently wiped what
    // the lesson authored: the iPad's Remote Actions, every slide overlay, and
    // the classroom state strip on both projectors.
    remoteActions: item.remoteActions || "",
    // Publishing this is LOAD-BEARING, and it was missing until 2026-08-03.
    // /api/control-remote re-derives presentation.discussionPhases from
    // flow.sequence.steps[i] on every advance, so a Control republish that
    // dropped the field deleted the server's copy, and the first Remote-driven
    // Next killed the discussion timeline on both projectors and every
    // Chromebook for the rest of the period. Rehydrate then wrote the loss back
    // into Control's own lineup, making it permanent. Matches lessonFlowBuild.
    discussionPhases: item.discussionPhases || undefined,
    slideOverlay: item.slideOverlay || undefined,
    slideUrl: item.slideUrl || undefined,
    slideMirror: item.slideMirror || undefined,
    eyes: item.eyes || "",
    voice: item.voice || "",
    supplies: item.supplies || "",
    body: item.body || "",
  };
}

/**
 * PUBLISHED STEP -> LINEUP. The rehydrate direction, used by BOTH the initial
 * server hydration and the remote-command rehydrate. Those two were separate
 * literals and had already diverged; keeping one function is the point.
 *
 * `uid` is injected because it is the only impure thing either mapper does.
 */
export function lineupItemFromStep(step: LiveFlowSequenceStep, uid: () => string): LineupItem {
  return {
    uid: uid(),
    stateId: step.stateId,
    minutes: Math.max(1, Math.round(step.durationSeconds / 60)),
    title: step.label,
    studentDirections: step.description,
    question: step.question,
    pollKind: step.pollKind || "",
    choices: step.choices,
    correctAnswer: step.correctAnswer,
    standard: step.standard,
    notionStepId: step.notionStepId || undefined,
    notionLessonId: step.notionLessonId || undefined,
    lessonCode: step.lessonCode,
    linkUrl: step.resourceUrl,
    paperTask: step.paperTask,
    mainDisplay: step.mainDisplay,
    paceDirections: step.paceDirections,
    studentAction: step.studentAction,
    remoteActions: step.remoteActions,
    discussionStems: step.discussionStems?.join("\n"),
    vocabulary: step.vocabulary?.join("\n"),
    // Undefined today - the publish mapper deliberately does not carry it (see
    // flowSnapshotForStep). Reading it here is the correct inverse and becomes
    // live the moment the discussion-phase wiring lands, with no edit here.
    discussionPhases: step.discussionPhases,
    responseMode: step.responseMode,
    workSpaceAvailable: step.workSpaceAvailable,
    slideOverlay: step.slideOverlay || undefined,
    slideUrl: step.slideUrl || undefined,
    slideMirror: step.slideMirror || undefined,
    publicSurfaceMode: step.publicSurfaceMode,
    routineConfig: step.routineConfig,
    eyes: step.eyes,
    voice: step.voice,
    supplies: step.supplies,
    body: step.body,
  };
}

/** Convenience for the two rehydrate sites. */
export function lineupFromSteps(steps: LiveFlowSequenceStep[], uid: () => string): LineupItem[] {
  return steps.map((step) => lineupItemFromStep(step, uid));
}
