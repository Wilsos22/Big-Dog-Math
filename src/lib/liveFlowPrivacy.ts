import type { LiveClassFlowSnapshot } from "./liveClassFlow";
import { normalizePublicLessonRoutineConfig } from "./lessonRoutineConfig";
import { publicSuccessCriterion } from "./successCriterion";

type LiveLessonSnapshot = NonNullable<LiveClassFlowSnapshot["lesson"]>;

export function publicLiveLessonSnapshot(
  lesson: LiveClassFlowSnapshot["lesson"],
): LiveClassFlowSnapshot["lesson"] {
  if (!lesson) return null;
  const criterion = publicSuccessCriterion(lesson.selectedSuccessCriterion);
  return {
    ...lesson,
    successCriteria: criterion,
    selectedSuccessCriterion: criterion,
  } satisfies LiveLessonSnapshot;
}

/**
 * Remove teacher-only and future-step data before a live session reaches a
 * Chromebook. This boundary is used for both secure and transitional student
 * access modes, so the rollout flag cannot expose the full teacher snapshot.
 */
export function studentSafeLiveFlow(
  flow: LiveClassFlowSnapshot | null,
): LiveClassFlowSnapshot | null {
  if (!flow) return null;
  const presentation = flow.presentation
    ? (({ remoteActions: _privateRemoteActions, routineConfig, ...publicPresentation }) => ({
        ...publicPresentation,
        routineConfig: normalizePublicLessonRoutineConfig(routineConfig),
      }))(flow.presentation)
    : null;
  const { transition: _privateTransition, ...publicFlow } = flow;
  return {
    ...publicFlow,
    lesson: publicLiveLessonSnapshot(flow.lesson),
    presentation,
    // Students see where the lesson IS - position, total, and the name of
    // what's next (the progress strip: position is regulation for an
    // 11-year-old). The steps array itself stays teacher-only: steps carry
    // correct answers and private notes.
    sequence: flow.sequence
      ? {
          currentIndex: flow.sequence.currentIndex,
          totalSteps: flow.sequence.totalSteps,
          nextLabel: flow.sequence.nextLabel,
          nextDirections: flow.sequence.nextDirections,
          advanceMode: flow.sequence.advanceMode,
        }
      : null,
  };
}
