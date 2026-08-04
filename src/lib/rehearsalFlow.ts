// Rehearsal snapshots: a real Notion lesson rendered on the real surfaces with
// no session, no database, and nothing published to a projector or a Chromebook.
//
// This is the DB-free twin of navigateFlow (src/app/api/control-remote/route.ts).
// It builds the same LiveClassFlowSnapshot the live runtime builds - same mode
// selection, same body fallback chain, same resource label, same state strip -
// but it never inserts a poll row, which is the one thing navigateFlow does that
// a rehearsal must not.
//
// It deliberately does NOT reuse buildStudioPreviewSnapshot. That builder pads
// `sequence.steps` with `placeholder-<n>` clones because Screen Studio only ever
// shows one step; a run-through needs the REAL sequence so "next up", the step
// counter, and the progress strip tell the truth.
//
// Client-safe by construction: every import below is a pure lib. notionLessons
// is not reachable from here - the sequence arrives already built, from
// /api/teacher/rehearse.

import { CLOSEOUT_DIRECTIONS } from "@/lib/classStates";
import { usesDiscussionProtocol } from "@/lib/classroomPilot";
import { stripFromStep } from "@/lib/classroomStateStrip";
import { defaultPublicSurfaceModeForState } from "@/lib/lessonStepMetadata";
import { structuredNumericPollFields } from "@/lib/structuredNumeric";
import {
  canRevealM2T1L1FinalScore,
  liveStepPollQuestion,
  resolveLiveStepPollKind,
  type LiveClassFlowSnapshot,
  type LiveFlowSequenceStep,
} from "@/lib/liveClassFlow";

export interface RehearsalLesson {
  lesson: NonNullable<LiveClassFlowSnapshot["lesson"]>;
  steps: LiveFlowSequenceStep[];
}

export interface RehearsalClock {
  /** Seconds remaining on the step. Defaults to the step's full duration. */
  secondsLeft?: number;
  /** A running clock carries an endsAt so the surfaces tick it down themselves. */
  running: boolean;
}

// A rehearsal poll id is a stable, obviously-fake string. It never reaches the
// database, and /live-flow's preview submit is a local echo, so nothing is
// written anywhere. The prefix is deliberately readable in a console.
export const REHEARSAL_POLL_PREFIX = "rehearsal-poll-";

export function rehearsalSnapshot(
  data: RehearsalLesson,
  index: number,
  clock: RehearsalClock = { running: false },
): LiveClassFlowSnapshot | null {
  const steps = data.steps;
  const step = steps[index];
  if (!step) return null;

  const isDiscussion = usesDiscussionProtocol(step.stateId, step.label);
  const pollKind = isDiscussion
    ? null
    : resolveLiveStepPollKind(step.responseMode, step.pollKind || undefined, step.stateId);
  const pollQuestion = liveStepPollQuestion(step.question, pollKind);

  let poll: LiveClassFlowSnapshot["poll"] = null;
  if (pollQuestion && pollKind) {
    const choices = pollKind === "fist-to-five" ? ["0", "1", "2", "3", "4", "5"] : step.choices;
    poll = {
      id: `${REHEARSAL_POLL_PREFIX}${index}`,
      kind: pollKind,
      question: pollQuestion,
      choices: choices.length ? choices : null,
      stage: "responding",
      // Unlike navigateFlow this does NOT throw on a structured-numeric spec
      // that will not parse. A rehearsal is where you go to FIND that, so the
      // caller surfaces it as a warning beside the step instead of refusing to
      // open the lesson.
      ...(pollKind === "structured-numeric" ? structuredNumericPollFields(step.correctAnswer) : {}),
    };
  }

  const resource = step.resourceUrl
    ? {
        label: step.stateId === "exit"
          ? "Open Exit Ticket"
          : step.responseMode?.trim().toLowerCase() === "assigned tool"
            ? "Open Assigned Tool"
            : "Open Lesson Resource",
        url: step.resourceUrl,
      }
    : null;

  const body = step.stateId === "closeout"
    ? CLOSEOUT_DIRECTIONS
    : step.mainDisplay || (step.stateId === "independent"
      ? step.paperTask || step.question || step.description
      : step.question || step.description || step.paperTask);

  const nextStep = steps[index + 1] || null;
  const mode = resource
    ? "resource" as const
    : poll
      ? "poll" as const
      : step.stateId === "i-do" || step.stateId === "manip" || step.stateId === "we-do"
        ? "board" as const
        : "directions" as const;

  const total = step.durationSeconds;
  const secondsLeft = Math.max(0, Math.min(total, Math.round(clock.secondsLeft ?? total)));
  const running = clock.running && secondsLeft > 0;
  const now = Date.now();

  return {
    version: 2,
    updatedAt: new Date(now).toISOString(),
    interlude: null,
    behaviorOverride: null,
    lesson: data.lesson,
    state: {
      id: step.stateId,
      label: step.label,
      description: step.description,
      color: step.color,
      semantic: step.semantic,
    },
    phase: null,
    timer: {
      totalSeconds: total,
      secondsLeft,
      running,
      finished: secondsLeft <= 0,
      endsAt: running ? new Date(now + secondsLeft * 1000).toISOString() : null,
    },
    poll,
    resource,
    presentation: {
      title: step.label,
      body,
      mainDisplay: step.mainDisplay || "",
      mode,
      notionStepId: step.notionStepId,
      boardOpen: false,
      paceDirections: step.paceDirections || step.description,
      studentAction: step.studentAction || step.description,
      responseMode: step.responseMode || "",
      workSpaceAvailable: step.workSpaceAvailable,
      publicSurfaceMode: step.publicSurfaceMode || defaultPublicSurfaceModeForState(step.stateId),
      routineConfig: step.routineConfig || null,
      discussionStems: step.discussionStems || [],
      vocabulary: step.vocabulary || [],
      discussionPhases: step.discussionPhases || undefined,
      scoreboardStage: canRevealM2T1L1FinalScore(step.lessonCode, step.stateId, step.semantic)
        ? "halftime"
        : undefined,
      behaviorStrip: stripFromStep(step),
    },
    tool: null,
    sequence: {
      currentIndex: index,
      totalSteps: steps.length,
      nextLabel: nextStep?.label || null,
      nextDirections: nextStep?.paceDirections || nextStep?.description || null,
      // Manual on purpose. A rehearsal that advances itself is a rehearsal you
      // cannot stop and look at, and the runner has its own auto-advance toggle
      // that drives the index rather than mutating the published pacing mode.
      advanceMode: "manual",
      steps: steps.map(({ remoteActions: _privateRemoteActions, ...publicStep }) => publicStep),
    },
    paper: step.paperTask ? { task: step.paperTask } : null,
  };
}

/** Total planned minutes for a lesson, the number the 50-minute contract is checked against. */
export function rehearsalTotalMinutes(steps: LiveFlowSequenceStep[]): number {
  return Math.round(steps.reduce((sum, step) => sum + step.durationSeconds, 0) / 60);
}
