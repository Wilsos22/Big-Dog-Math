// Shared client-safe contracts for the teacher control runtime and student live flow.

import type { ClassroomStageId } from "@/lib/classroomPilot";
import type { LivePollKind } from "@/lib/liveFlowContract";
import type { PublicLessonRoutineConfig } from "@/lib/lessonRoutineConfig";
import type { PublicSurfaceMode } from "@/lib/lessonStepMetadata";
import type { DiscussionPhaseSnapshot } from "@/lib/discussionProtocol";
import type { ClassroomStateStrip, ClassroomStateStripOverride } from "@/lib/classroomStateStrip";

export {
  FIST_TO_FIVE_DEFAULT_QUESTION,
  LIVE_POLL_KINDS,
  LIVE_RESPONSE_MODES,
  canRevealM2T1L1FinalScore,
  isChoicePollKind,
  isLivePollKind,
  liveAssignedToolRoute,
  liveIndependentSupportItems,
  liveResponseModePollKind,
  liveStepPollQuestion,
  pickRemoteSharerName,
  resolveLiveStepPollKind,
  resolveRemoteNextBehavior,
  shouldRunFlowNavigationDestination,
  shouldRunNavigationDestination,
  splitLiveFlowLines,
  splitLiveFlowVocabulary,
} from "@/lib/liveFlowContract";
export type { LivePollKind, LiveResponseMode } from "@/lib/liveFlowContract";
export type { DiscussionPhaseId, DiscussionPhaseSnapshot } from "@/lib/discussionProtocol";

export const LIVE_FLOW_MODE = "live-flow";
export const LIVE_FLOW_ROUTE = "/live-flow";
export const STUDENT_SESSION_KEY = "bdm-student-session";
export const TEACHER_SESSION_KEY = "bdm-teacher-session";
export const CLASS_MODE_EXIT_KEY = "bdm-class-mode-exited";
export const REMOTE_COMMAND_STALE_MS = 15_000;
export const MAX_LIVE_STATE_SECONDS = 120 * 60;

export const DISCUSSION_REMOTE_ACTIONS = [
  "discussion-think",
  "discussion-write",
  "discussion-discuss",
  "discussion-revise",
  "discussion-share",
  "discussion-pick-sharer",
  "discussion-previous",
  "discussion-next",
  "discussion-restart",
  "discussion-toggle",
] as const;
export type DiscussionRemoteAction = (typeof DISCUSSION_REMOTE_ACTIONS)[number];
export const TEACHER_REMOTE_ACTIONS = [
  "next",
  "previous",
  "toggle-timer",
  "add-30",
  "subtract-30",
  "reset-timer",
  "show-board",
  "hide-board",
  "set-behavior",
  "clear-behavior",
  "spin-spinner",
  ...DISCUSSION_REMOTE_ACTIONS,
  "reveal-results",
  "reveal-final-score",
  "transition-now",
  "play-warning",
  "play-countdown",
  "play-times-up",
  // The sound bank. One flat action per cue, named `play-<id>` after the cue
  // ids in src/lib/soundBank.ts - that file owns the labels, the synthesis and
  // the filename matching, and npm run test:sound-bank asserts this list matches
  // it exactly. Steele's own Stream Deck clips, so most of them only make their
  // real sound once he loads the file on /control.
  "play-air-horn",
  "play-applause",
  "play-cheering",
  "play-crickets",
  "play-drum-roll",
  "play-dun-dun-dun",
  "play-jeopardy",
  "play-locked-in",
  "play-stank-face",
  "play-true",
  "play-a-few-moments-later",
  "play-another-one",
  "play-bingo",
  "play-bruh",
  "play-directed-by-robert",
  "play-never-know",
  "play-law-and-order",
  "play-what",
  "play-metro",
  "play-money",
  "play-record-scratch",
  "play-straight-up",
  "play-omg",
  "play-be-right-back",
  "play-you",
] as const;
export type TeacherRemoteAction = (typeof TEACHER_REMOTE_ACTIONS)[number];

const DISCUSSION_REMOTE_ACTION_SET = new Set<string>(DISCUSSION_REMOTE_ACTIONS);

export function isDiscussionRemoteAction(action: TeacherRemoteAction): action is DiscussionRemoteAction {
  return DISCUSSION_REMOTE_ACTION_SET.has(action);
}
export type LiveToolRoute =
  | "/whiteboard"
  | "/number-line-plus"
  | "/percent-bar"
  | "/equation-builder"
  | "/balance-beam"
  | "/distributive-area"
  | "/divisibility"
  | "/area-explorer"
  | "/order-of-operations"
  | "/fraction-bars"
  | "/algebra-tiles"
  | "/area-model"
  | "/multiplication-fluency"
  | "/combine-like-terms"
  | "/ladder-method"
  | "/group-bars"
  | "/proportions"
  | "/coordinate-grid"
  | "/term-identifier"
  | "/challenge"
  | "/exit-ticket"
  | "/checkpoint";

export type LiveToolConfig =
  | {
      id: string;
      route:
        | "/whiteboard"
        | "/balance-beam"
        | "/divisibility"
        | "/area-explorer"
        | "/fraction-bars"
        | "/area-model"
        | "/multiplication-fluency"
        | "/combine-like-terms"
        | "/group-bars"
        | "/proportions"
        | "/coordinate-grid"
        | "/term-identifier"
        | "/challenge"
        | "/exit-ticket"
        | "/checkpoint";
      label: string;
      prompt: string;
      config: Record<string, never>;
    }
  | {
      id: string;
      route: "/number-line-plus";
      label: string;
      prompt: string;
      config: { start: number; change: number };
    }
  | {
      id: string;
      route: "/percent-bar";
      label: string;
      prompt: string;
      config: { whole: number; percent: number; part: number; unknown: "part" | "whole" | "percent" };
    }
  | {
      id: string;
      route: "/equation-builder";
      label: string;
      prompt: string;
      config: { coefficient: number; constant: number; solution: number };
    }
  | {
      id: string;
      route: "/order-of-operations" | "/algebra-tiles";
      label: string;
      prompt: string;
      config: { expression: string };
    }
  | {
      id: string;
      // `set` is the shared "24x7,16x8" problem-set string (see
      // lib/distributiveProblems). Empty means free play — students pick their
      // own numbers, same as visiting the tool directly.
      route: "/distributive-area";
      label: string;
      prompt: string;
      config: { set: string };
    }
  | {
      id: string;
      // `set` is a "24,36,60" number sequence for the Factor Trees mode (see
      // lib/factorTreeSet). Empty means free play - the tool's built-in
      // sequence, same as visiting the route directly.
      //
      // `bothModes` is the teacher override for the mode lock. Publishing a
      // sequence puts the tool in Factor Trees mode and HIDES the mode toggle:
      // on prime-factorization day the Ladder is the next day's method, and a
      // student-reachable toggle hands it to the whole room. Set this when the
      // lesson genuinely wants both side by side. Optional, so snapshots
      // written before it existed still parse.
      route: "/ladder-method";
      label: string;
      prompt: string;
      config: { set: string; bothModes?: boolean };
    };

export interface LiveFlowSequenceStep {
  stateId: string;
  label: string;
  description: string;
  color: string;
  semantic: ClassroomStageId;
  durationSeconds: number;
  question: string;
  pollKind: LivePollKind | null;
  choices: string[];
  correctAnswer: string;
  standard: string;
  resourceUrl: string;
  paperTask: string;
  notionStepId: string | null;
  notionLessonId: string | null;
  lessonCode: string;
  mainDisplay?: string;
  paceDirections?: string;
  studentAction?: string;
  remoteActions?: string;
  discussionStems?: string[];
  vocabulary?: string[];
  // Raw authored `Discussion Phases` text (one beat per line). Parsed by the
  // surfaces with parseDiscussionPhases; drives the self-running timeline.
  discussionPhases?: string;
  responseMode?: string;
  workSpaceAvailable?: boolean;
  publicSurfaceMode?: PublicSurfaceMode;
  routineConfig?: PublicLessonRoutineConfig | null;
  slideOverlay?: string;
  // The authored classroom state strip. Raw select values, resolved by
  // lib/classroomStateStrip - all four or the step shows no strip at all.
  eyes?: string;
  voice?: string;
  supplies?: string;
  body?: string;
}

export interface LiveClassFlowSnapshot {
  version: 2;
  updatedAt: string;
  transition?: {
    token: string;
    startedAt: string;
  };
  state: {
    id: string;
    label: string;
    description: string;
    color: string;
    semantic?: ClassroomStageId;
  } | null;
  phase: DiscussionPhaseSnapshot | null;
  timer: {
    totalSeconds: number;
    secondsLeft: number;
    running: boolean;
    finished: boolean;
    endsAt?: string | null;
  } | null;
  poll: {
    id: string;
    kind: LivePollKind;
    question: string;
    choices: string[] | null;
    stage: "responding" | "results";
    awaitingTeacherAdvance?: boolean;
    /**
     * How many numeric inputs a structured-numeric step renders.
     *
     * The COUNT only. The rest of the answer spec stays teacher-side, because
     * the rules literally carry the answer - `5=168` is the product - and this
     * field crosses studentSafeLiveFlow to a Chromebook.
     */
    boxes?: number;
    /**
     * A structured-numeric PAIRS step: the product to factor and the tap-bank
     * size (1..bank). Present instead of `boxes` when the step is a pairs
     * builder. Safe to cross studentSafeLiveFlow - the target and bank ARE the
     * problem statement, and the factors are derivable from the target anyway;
     * no rule spec travels with it.
     */
    pairs?: { target: number; bank: number };
  } | null;
  resource: {
    label: string;
    url: string;
  } | null;
  presentation: {
    title: string;
    body: string;
    mainDisplay?: string;
    mode: "board" | "directions" | "resource" | "poll" | "tool";
    notionStepId: string | null;
    boardOpen?: boolean;
    paceDirections?: string;
    studentAction?: string;
    remoteActions?: string;
    responseMode?: string;
    workSpaceAvailable?: boolean;
    publicSurfaceMode?: PublicSurfaceMode;
    routineConfig?: PublicLessonRoutineConfig | null;
    discussionStems?: string[];
    vocabulary?: string[];
    // Raw authored discussion phases, public (students walk the timeline too).
    discussionPhases?: string;
    scoreboardStage?: "halftime" | "final";
    // The active step's authored strip, so a projector never has to reach into
    // sequence.steps for it (students do not receive that array at all).
    behaviorStrip?: ClassroomStateStrip | null;
  } | null;
  tool: LiveToolConfig | null;
  lesson?: {
    id: string | null;
    code: string;
    title: string;
    learningIntention: string;
    successCriteria: string;
    selectedSuccessCriterion?: string;
    classroomMode?: string;
    discussionStems?: string[];
    discussionVocabulary?: string[];
    requiredPaperWork?: string;
    requiredDigitalWork?: string;
    optionalSupport?: string;
    bigDogChallenge?: string;
    dueAndTurnIn?: string;
    helpPath?: string;
    anchorProblem?: string;
    agenda?: string;
    reminders?: string;
  } | null;
  sequence?: {
    currentIndex: number;
    totalSteps: number;
    nextLabel: string | null;
    nextDirections: string | null;
    advanceMode: "manual" | "automatic";
    steps?: LiveFlowSequenceStep[];
  } | null;
  // An ad-hoc "Transition now" moment: the room moves while the state clock
  // pauses. Cleared by the lazy pacing check when endsAt passes (the paused
  // clock resumes), or by any Next/Back navigation.
  interlude?: {
    stateId: string;
    label: string;
    color: string;
    directions: string;
    totalSeconds: number;
    endsAt: string;
    resumeRunning: boolean;
  } | null;
  paper?: {
    task: string;
  } | null;
  // A live classroom-state override from the iPad, for Settle 30s and the
  // moments the plan did not predict. SERVER-AUTHORED and therefore in the same
  // class as `interlude` and `transition`: /control rebuilds `presentation`
  // from the step every tick, so an override living in there would be erased
  // about a second after the teacher tapped it. It must be carried through the
  // liveFlowSignature snapshot untouched. It is stamped with the sequence index
  // it was issued at and expires the moment the lesson advances, so nothing has
  // to remember to clear it.
  behaviorOverride?: ClassroomStateStripOverride | null;
}

export function liveTimerSeconds(
  timer: LiveClassFlowSnapshot["timer"],
  now = Date.now(),
): number {
  if (!timer) return 0;
  const fallback = Number.isFinite(timer.secondsLeft)
    ? Math.max(0, Math.min(MAX_LIVE_STATE_SECONDS, Math.round(timer.secondsLeft)))
    : 0;
  if (!timer.running || !timer.endsAt) return fallback;
  const end = Date.parse(timer.endsAt);
  if (!Number.isFinite(end)) return fallback;
  return Math.max(0, Math.min(MAX_LIVE_STATE_SECONDS, Math.ceil((end - now) / 1000)));
}

export interface TeacherRemoteCommand {
  nonce: string;
  action: TeacherRemoteAction;
  issuedAt: string;
  receivedAt?: string;
  stateId?: string;
}

export interface StoredStudentSession {
  sessionId: string;
  studentId: string;
  name: string;
  syncKey?: string;
}

export function getStoredStudentSession(): StoredStudentSession | null {
  try {
    const stored = localStorage.getItem(STUDENT_SESSION_KEY);
    if (!stored) return null;
    const session = JSON.parse(stored) as Partial<StoredStudentSession>;
    return typeof session.sessionId === "string"
      && typeof session.studentId === "string"
      && typeof session.name === "string"
      ? {
          sessionId: session.sessionId,
          studentId: session.studentId,
          name: session.name,
          ...(typeof session.syncKey === "string" && session.syncKey.trim()
            ? { syncKey: session.syncKey.trim() }
            : {}),
        }
      : null;
  } catch {
    return null;
  }
}

export function getStoredStudentSessionId(): string | null {
  return getStoredStudentSession()?.sessionId ?? null;
}

// Fired whenever a student session lands in storage so ClassSync ticks
// immediately instead of waiting out its interval. (ClassSync re-exports this
// name for existing importers.)
export const STUDENT_SESSION_READY_EVENT_NAME = "bdm-student-session-ready";

/**
 * Persist a verified student join. One writer for the whole app: the landing
 * page and the global WarmupJoinSync both complete joins through this, so the
 * receipt chain behaves identically wherever the verification finishes.
 */
export function saveVerifiedStudentJoin(session: StoredStudentSession): void {
  clearClassModeExitMarker();
  try {
    localStorage.setItem("bdm-student-name", session.name);
    localStorage.setItem(STUDENT_SESSION_KEY, JSON.stringify(session));
    if (session.syncKey) sessionStorage.setItem("bdm-pending-class-code", session.syncKey);
  } catch { /* storage unavailable - the polling surfaces will retry */ }
  markStudentTab();
  try { window.dispatchEvent(new Event(STUDENT_SESSION_READY_EVENT_NAME)); } catch { /* ignore */ }
}

/**
 * Store a PROVISIONAL student session the moment a class code is accepted -
 * before the warm-up verifies. studentId stays empty until the verified join
 * replaces it. This is what lets ClassSync move the screen with the class
 * even for a student who never finished (or opened) the warm-up: the teacher
 * advancing past warm-up pushes every device that typed the code.
 */
export function saveProvisionalStudentSession(sessionId: string, name: string, syncKey: string): void {
  // Match saveVerifiedStudentJoin: a device that was in a session which later
  // closed carries an exit marker, and ClassSync returns on every tick while it
  // is set. Without this clear, every Chromebook after period 1 - and every
  // device on day 2 - re-enters the class code, looks joined, and never moves
  // again. Nothing in the UI reveals it.
  clearClassModeExitMarker();
  const existing = getStoredStudentSession();
  // Never downgrade a verified session for the same live session.
  if (existing && existing.sessionId === sessionId && existing.studentId) return;
  try {
    localStorage.setItem(STUDENT_SESSION_KEY, JSON.stringify({
      sessionId,
      studentId: "",
      name: name || "Student",
      syncKey,
    } satisfies StoredStudentSession));
  } catch { /* ignore */ }
  markStudentTab();
  try { window.dispatchEvent(new Event(STUDENT_SESSION_READY_EVENT_NAME)); } catch { /* ignore */ }
}

export function clearStoredStudentSession(sessionId?: string): void {
  try {
    if (sessionId) {
      const stored = getStoredStudentSessionId();
      if (stored && stored !== sessionId) return;
    }
    localStorage.removeItem(STUDENT_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function markClassModeExited(): void {
  try {
    localStorage.setItem(CLASS_MODE_EXIT_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function clearClassModeExitMarker(): void {
  try {
    localStorage.removeItem(CLASS_MODE_EXIT_KEY);
  } catch {
    /* ignore */
  }
}

export function hasClassModeExitMarker(): boolean {
  try {
    return localStorage.getItem(CLASS_MODE_EXIT_KEY) === "1";
  } catch {
    return false;
  }
}

export function leaveClassMode(): void {
  clearStoredStudentSession();
  markClassModeExited();
}

// Per-TAB marker (sessionStorage is not shared across tabs/windows). Set when a
// device joins as a student, so a single browser can run a teacher tab AND a
// student tab at once for testing: the joined tab follows class mode even though
// the browser also has a teacher session stored.
export const STUDENT_TAB_KEY = "bdm-student-tab";

export function markStudentTab(): void {
  try {
    sessionStorage.setItem(STUDENT_TAB_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function isStudentTab(): boolean {
  try {
    return sessionStorage.getItem(STUDENT_TAB_KEY) === "1";
  } catch {
    return false;
  }
}

export function getStoredTeacherSessionId(): string | null {
  try {
    const stored = localStorage.getItem(TEACHER_SESSION_KEY);
    if (!stored) return null;
    const session = JSON.parse(stored) as { sessionId?: unknown };
    return typeof session.sessionId === "string" && session.sessionId ? session.sessionId : null;
  } catch {
    return null;
  }
}

export function getStoredTeacherSession(): { sessionId: string; code: string; periodName: string } | null {
  try {
    const stored = localStorage.getItem(TEACHER_SESSION_KEY);
    if (!stored) return null;
    const s = JSON.parse(stored) as { sessionId?: unknown; code?: unknown; periodName?: unknown };
    if (typeof s.sessionId !== "string" || !s.sessionId) return null;
    return {
      sessionId: s.sessionId,
      code: typeof s.code === "string" ? s.code : "",
      periodName: typeof s.periodName === "string" ? s.periodName : "",
    };
  } catch {
    return null;
  }
}

export function saveTeacherSession(sessionId: string, code: string, periodName: string): void {
  try {
    localStorage.setItem(TEACHER_SESSION_KEY, JSON.stringify({ sessionId, code, periodName }));
  } catch {
    /* ignore */
  }
}

export function clearStoredTeacherSession(sessionId?: string): void {
  try {
    if (sessionId) {
      const stored = getStoredTeacherSessionId();
      if (stored && stored !== sessionId) return;
    }
    localStorage.removeItem(TEACHER_SESSION_KEY);
  } catch {
    /* ignore */
  }
}
