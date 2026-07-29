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
    // The classroom state strip and its live override deliberately DO cross this
    // boundary. They are not private data - "voice 0" is announced to the whole
    // room and painted on two projectors - and a head-down student needs the
    // same read of the expected state that the room gets, for the same reason
    // the timer warnings are shared. Nothing here is per-student. Note that this
    // is a DENY-list for presentation: a genuinely teacher-only field added
    // there has to be destructured out above, the way remoteActions is.
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
