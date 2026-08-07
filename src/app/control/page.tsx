"use client";

// Teacher Classroom Control Panel — front-of-room display.
// Bank (bottom): pull states into the day's LINEUP (sequence) with a running
//   total vs. a 50-minute period.
// Each state loads an adjustable countdown. After Start, the timed sequence
// advances automatically until the teacher pauses or stops it.
// Ending sequence: 30-second alert, giant on-screen 10-to-1 countdown with ticks,
//   flash at zero.
// Upload your own sounds (warm-up music + cue sounds). They're remembered on
//   this computer (stored in the browser). No upload = simple built-in beep.

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import StudentSpinner from "@/components/StudentSpinner";
import DiscussionProtocol from "@/components/DiscussionProtocol";
import LessonVisual from "@/components/LessonVisual";
// GONE 2026-07-29: AbbieConsole mounted at the bottom of this page and was the
// ONLY subscriber to abbieBus, so the poll's "Have Abbie react" button and the
// six abbie-* deck keys had to go with it - a button firing into an empty bus is
// dead UI on the live engine. Both files are deleted as of 2026-07-30.
// The sound bank took the deck's place.
import { SOUND_CUES, clearUserClip, installUserClip, matchSoundCueFile, playSoundCue, soundCueIdForAction } from "@/lib/soundBank";
import { CLASSROOM_AUDIO_CHANNEL, announceClassroomAudioChange } from "@/lib/classroomAudio";
import {
  CUE_DUCK_FALLBACK_SECONDS,
  MUSIC_DUCK_VOLUME,
  MUSIC_FULL_VOLUME,
  TIMER_TONE_PATTERNS,
} from "@/lib/timerCues";
import { watchAudioHost } from "@/lib/audioHostChannel";
import { joinRealtimeRoom } from "@/lib/realtimeRooms";
import {
  REMOTE_COMMAND_PING_EVENT,
  isRemoteCommandPing,
  pingPlaysDirectly,
  remoteCommandTopic,
  type RemoteCommandPing,
} from "@/lib/remoteCommandPing";
import {
  MAX_SOUND_LABEL,
  SOUND_LABEL_ROOM,
  normalizeSoundLabel,
  readStoredSoundLabels,
  soundLabelFor,
  writeStoredSoundLabels,
  type SoundLabelMessage,
  type SoundLabels,
} from "@/lib/soundBankLabels";
import { discussionSupportsForLesson, inferClassroomStage, usesDiscussionProtocol } from "@/lib/classroomPilot";
import { missingStripSlots, stripFromStep } from "@/lib/classroomStateStrip";
import {
  flowSnapshotForStep,
  lineupFromSteps,
  type FlowStepDeps,
  type LineupItem,
} from "@/lib/controlLineup";
import {
  createDiscussionRoundSnapshot,
  normalizeDiscussionPhaseSnapshot,
} from "@/lib/discussionProtocol";
import { TeacherApiError, teacherApiRequest, teacherPost } from "@/lib/teacherApi";
import {
  isUntimedStep,
  FIST_TO_FIVE_DEFAULT_QUESTION,
  LIVE_FLOW_MODE,
  REMOTE_COMMAND_STALE_MS,
  canRevealM2T1L1FinalScore,
  clearStoredTeacherSession,
  getStoredTeacherSessionId,
  isChoicePollKind,
  isDiscussionRemoteAction,
  liveAssignedToolRoute,
  liveStepPollQuestion,
  resolveLiveStepPollKind,
  shouldRunNavigationDestination,
  liveTimerSeconds,
  splitLiveFlowLines,
  splitLiveFlowVocabulary,
  type DiscussionPhaseSnapshot,
  type LiveClassFlowSnapshot,
  type LivePollKind,
  type LiveToolConfig,
  type LiveToolRoute,
  type TeacherRemoteCommand,
} from "@/lib/liveClassFlow";
import {
  parseStructuredNumericSpec,
  structuredNumericPollFields,
  summarizeStructuredNumeric,
} from "@/lib/structuredNumeric";
import { normalizeDistributiveSet, parseDistributiveSet } from "@/lib/distributiveProblems";
import { normalizeFactorTreeSet, parseFactorTreeSet } from "@/lib/factorTreeSet";
import { normalizeFractionSet, parseFractionRounds } from "@/lib/fractionOrderSet";
import { normalizeDecimalSet, parseDecimalSet } from "@/lib/decimalSteps";
import { normalizeHouseSet, parseHouseSet } from "@/lib/divisionHouse";
import {
  listLessonPresets,
  getLessonPreset,
  saveLessonPreset,
  deleteLessonPreset,
  type LessonPreset,
} from "@/lib/lessonPresets";
import { SKILLS } from "@/lib/challengeSkills";
import { launchChallenge, endChallenge, fetchLeaderboard, type ChallengeRow, type LeaderRow } from "@/lib/challenges";
import { launchExitTicket, type ExitKind } from "@/lib/exitTickets";
import { SBAC_CHECKPOINTS, getCheckpoint } from "@/lib/sbacCheckpoints";
import { launchCheckpoint } from "@/lib/checkpoints";
import { resolveLessonVisual } from "@/lib/lessonVisuals";
import { TIMER_URGENCY_CSS, timerUrgency, timerUrgencyClass } from "@/lib/timerUrgency";
import type { PublicLessonRoutineConfig } from "@/lib/lessonRoutineConfig";
import { defaultPublicSurfaceModeForState, type PublicSurfaceMode } from "@/lib/lessonStepMetadata";
import {
  publicSuccessCriterion,
  selectedSuccessCriterionValidationMessage,
} from "@/lib/successCriterion";

import { CLOSEOUT_DIRECTIONS, DEFAULT_STATES, BANK_GROUPS, type ClassState } from "@/lib/classStates";

// LineupItem MOVED to src/lib/controlLineup.ts, together with the two mappers
// that translate it to and from the published sequence. It lives there because
// a contract can compile that module in isolation; it could never test an
// object literal buried in this client component.

interface TeacherSessionRow {
  id: string;
  status: string;
  period_id: string;
  join_code: string | null;
  broadcast: string | null;
  live_flow: LiveClassFlowSnapshot | null;
  remote_command: TeacherRemoteCommand | null;
}

interface AdmissionRequest {
  id: string;
  requestCode: string;
  requestedAt: string;
}

// Pseudonymous roster: the site knows students by alias only. The teacher can
// resolve real names via the device-local name key (loaded on /roster).
interface AdmissionRosterStudent {
  id: string;
  periodId: string;
  alias: string | null;
}

const TEACHER_SERVER_CLIENT = {} as never;

type InteractiveStateId = string;

const TOOL_STATE_INFO = {
  "tool-whiteboard": { route: "/whiteboard", label: "Whiteboard" },
  "tool-number-line": { route: "/number-line-plus", label: "Number Line" },
  "tool-percent-bar": { route: "/percent-bar", label: "Percent Bar" },
  "tool-equation-builder": { route: "/equation-builder", label: "Equation Builder" },
  "tool-balance-beam": { route: "/balance-beam", label: "Balance Beam" },
  "tool-gems": { route: "/order-of-operations", label: "GEMS" },
  "tool-fraction-bars": { route: "/fraction-bars", label: "Fraction Bars" },
  "tool-algebra-tiles": { route: "/algebra-tiles", label: "Algebra Tiles" },
  "tool-area-model": { route: "/area-model", label: "Box Method" },
  "tool-distributive-area": { route: "/distributive-area", label: "Distributive Area Method" },
  "tool-divisibility": { route: "/divisibility", label: "Divisibility Rules" },
  "tool-lcm-bouncer": { route: "/lcm-bouncer", label: "LCM Bouncer" },
  "tool-area-explorer": { route: "/area-explorer", label: "Area Explorer" },
  "tool-combine": { route: "/combine-like-terms", label: "Combine Like Terms" },
  "tool-ladder": { route: "/ladder-method", label: "Ladder Method" },
  "tool-proportions": { route: "/proportions", label: "Proportions" },
  "tool-group-bars": { route: "/group-bars", label: "Group Bars" },
  "tool-coordinate-grid": { route: "/coordinate-grid", label: "Coordinate Grid" },
  "tool-term-identifier": { route: "/term-identifier", label: "Identify Terms" },
  "tool-decimal-steps": { route: "/decimal-steps", label: "Decimals, step by step" },
  "tool-division-house": { route: "/division-house", label: "Division House" },
  "tool-multiplication": { route: "/multiplication-fluency", label: "Multiplication Facts" },
  "tool-game": { route: "/challenge", label: "Live Game" },
  "tool-exit-ticket": { route: "/exit-ticket", label: "Exit Ticket" },
  "tool-checkpoint": { route: "/checkpoint", label: "SBAC Checkpoint" },
} as const satisfies Record<string, { route: LiveToolRoute; label: string }>;

type ToolStateId = keyof typeof TOOL_STATE_INFO;

interface ToolSetupValues {
  prompt: string;
  numberLineStart: string;
  numberLineChange: string;
  numberLineFractionSet: string;
  percentWhole: string;
  percentValue: string;
  percentPart: string;
  percentUnknown: "part" | "whole" | "percent";
  equationCoefficient: string;
  equationConstant: string;
  equationSolution: string;
  gemsExpression: string;
  algebraExpression: string;
  distributiveSet: string;
  decimalSet: string;
  houseSet: string;
  ladderTreeSet: string;
  ladderBothModes: boolean;
  gameSkill: string;
  gameLevel: string;
  gameDuration: string;
  exitPrompt: string;
  exitKind: ExitKind;
  exitChoices: string;
  checkpointId: string;
  checkpointItem: string;
}

interface PublishedTool {
  stateId: ToolStateId;
  tool: LiveToolConfig;
}

interface ControlPoll {
  id: string;
  /**
   * WHICH STEP this poll belongs to, not just what kind of step it was. Control
   * used to decide "is this still the current question?" by comparing stateId
   * alone, and lessons here are authored with consecutive steps sharing one
   * state id - "Readiness Question 1" and "Readiness Question 2" are both
   * `question`, in lesson after lesson. Advancing between them left the first
   * poll open, republished its question (and its revealed bars) as the second
   * step's, and blocked the second from ever opening its own - so the pair that
   * exists to show whether the class moved could only ever show one answer.
   * The sequence index is the identity both paths already have: the server
   * hydration reads flow.sequence.currentIndex, and a Remote-driven Next
   * updates currentIndex here, which is what makes the stale poll fall away.
   */
  stepIndex: number | null;
  stateId: InteractiveStateId;
  kind: LivePollKind;
  question: string;
  choices: string[] | null;
  stage: "responding" | "results";
  awaitingTeacherAdvance?: boolean;
  /** Structured Numeric input count. The rules stay teacher-side; only this crosses. */
  boxes?: number;
  /** Structured Numeric PAIRS target and tap-bank size. Present instead of boxes. */
  pairs?: { target: number; bank: number };
}

interface ControlPollAnswer {
  id: string;
  display_name: string | null;
  answer: string | null;
  /** Structured Numeric boxes, null before poll-structured-numeric.sql is run. */
  values?: (number | null)[] | null;
}

interface PollLaunchConfig {
  stateId: InteractiveStateId;
  kind: LivePollKind;
  question: string;
  choices?: string[];
  correctAnswer?: string;
  standard?: string;
  notionStepId?: string;
  notionLessonId?: string;
  lessonCode?: string;
}

// DEFAULT_STATES + BANK_GROUPS now live in @/lib/classStates (shared with the
// standalone Sequence Builder so the catalog never drifts).

const LS_BANK = "bdm-control-bank-v2";
const LS_LINEUP = "bdm-control-lineup-v1";
// The lesson day is 50 minutes. This is the budget the teacher actually reads
// while building a lineup, so it has to be the real period - at 55 it called a
// 54-minute day fine. Not to be confused with MIN_SCHEDULED_MINUTES (55) in
// sessionLifecycle.ts, which is the stale-session auto-close floor and is
// deliberately LONGER than the period so a guardrail can never end a live class.
const PERIOD_MIN = 50;
const REMOTE_RECEIPT_RETRY_MS = 600;

const DEFAULT_TOOL_SETUP: ToolSetupValues = {
  prompt: "",
  numberLineStart: "-3",
  numberLineChange: "6",
  numberLineFractionSet: "",
  percentWhole: "80",
  percentValue: "25",
  percentPart: "20",
  percentUnknown: "part",
  equationCoefficient: "2",
  equationConstant: "3",
  equationSolution: "4",
  gemsExpression: "3 + 4 × 2",
  algebraExpression: "2x + 3 = 11",
  distributiveSet: "14x6, 18x5, 24x7",
  decimalSet: "",
  houseSet: "",
  ladderTreeSet: "24, 36, 60",
  ladderBothModes: false,
  gameSkill: SKILLS[0].key,
  gameLevel: "1",
  gameDuration: "180",
  exitPrompt: "",
  exitKind: "short-answer",
  exitChoices: "",
  checkpointId: SBAC_CHECKPOINTS[0].id,
  checkpointItem: String(Math.max(0, SBAC_CHECKPOINTS[0].items.findIndex((it) => it.digital))),
};

type CueKey = "music" | "warn30" | "tick" | "end";

// MUSIC_FULL_VOLUME / MUSIC_DUCK_VOLUME / CUE_DUCK_FALLBACK_SECONDS and the timer
// tone patterns moved to src/lib/timerCues.ts so /control (the backup audio host)
// and /teacher/present (the primary host) sound identical and cannot drift.
const CUE_LABELS: Record<CueKey, string> = {
  music: "Warm-up music (loops)",
  warn30: "30-second alert",
  tick: "Last-10 countdown tick",
  end: "Time's-up buzzer",
};

const MAX_STATE_MINUTES = 120;
const MAX_STATE_SECONDS = MAX_STATE_MINUTES * 60;

function safeStateMinutes(value: number, fallback = 1): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(MAX_STATE_MINUTES, Math.round(value)));
}

function safeTimerSeconds(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(MAX_STATE_SECONDS, Math.round(value)));
}

function fmt(totalSeconds: number): string {
  const s = safeTimerSeconds(totalSeconds);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

function isToolStateId(value: string | undefined): value is ToolStateId {
  return Boolean(value && value in TOOL_STATE_INFO);
}

function numericValue(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function buildLiveToolConfig(stateId: ToolStateId, values: ToolSetupValues): LiveToolConfig {
  const info = TOOL_STATE_INFO[stateId];
  const base = {
    id: `${stateId}-${Date.now()}-${uid()}`,
    label: info.label,
    prompt: values.prompt.trim(),
  };

  switch (stateId) {
    case "tool-whiteboard":
      return { ...base, route: "/whiteboard", config: {} };
    case "tool-fraction-bars":
      return { ...base, route: "/fraction-bars", config: {} };
    case "tool-number-line": {
      const start = Math.round(clamp(numericValue(values.numberLineStart, -3), -10, 10));
      const change = Math.round(clamp(numericValue(values.numberLineChange, 6), -10 - start, 10 - start));
      // Empty fraction set is meaningful: the tool runs the integer hop problem.
      return {
        ...base,
        route: "/number-line-plus",
        config: {
          start,
          change,
          fractionSet: normalizeFractionSet(values.numberLineFractionSet),
        },
      };
    }
    case "tool-percent-bar": {
      const unknown = values.percentUnknown;
      let whole = Math.max(0.01, numericValue(values.percentWhole, 80));
      let percent = Math.max(0.01, numericValue(values.percentValue, 25));
      let part = Math.max(0, numericValue(values.percentPart, 20));
      if (unknown === "part") part = (whole * percent) / 100;
      if (unknown === "whole") whole = (part * 100) / percent;
      if (unknown === "percent") percent = (part / whole) * 100;
      return { ...base, route: "/percent-bar", config: { whole, percent, part, unknown } };
    }
    case "tool-equation-builder":
      return {
        ...base,
        route: "/equation-builder",
        config: {
          coefficient: Math.max(1, Math.round(numericValue(values.equationCoefficient, 2))),
          constant: numericValue(values.equationConstant, 3),
          solution: Math.max(1, Math.round(numericValue(values.equationSolution, 4))),
        },
      };
    case "tool-balance-beam":
      return { ...base, route: "/balance-beam", config: {} };
    case "tool-gems":
      return { ...base, route: "/order-of-operations", config: { expression: values.gemsExpression.trim() } };
    case "tool-algebra-tiles":
      return { ...base, route: "/algebra-tiles", config: { expression: values.algebraExpression.trim() } };
    case "tool-area-model":
      return { ...base, route: "/area-model", config: {} };
    case "tool-distributive-area":
      // Empty set is meaningful: students pick their own numbers.
      return { ...base, route: "/distributive-area", config: { set: normalizeDistributiveSet(values.distributiveSet) } };
    case "tool-divisibility":
      return { ...base, route: "/divisibility", config: {} };
    case "tool-lcm-bouncer":
      // No published config yet - the strides are set on the board. A teacher
      // naming the pair in the prompt ("find where 4 and 6 land together") is
      // what steers the room; publishing them is an additive config arm later.
      return { ...base, route: "/lcm-bouncer", config: {} };
    case "tool-area-explorer":
      return { ...base, route: "/area-explorer", config: {} };
    case "tool-combine":
      return { ...base, route: "/combine-like-terms", config: {} };
    case "tool-ladder":
      // Empty set is meaningful: the tool runs its built-in tree sequence.
      return {
        ...base,
        route: "/ladder-method",
        config: { set: normalizeFactorTreeSet(values.ladderTreeSet), bothModes: values.ladderBothModes },
      };
    case "tool-proportions":
      return { ...base, route: "/proportions", config: {} };
    case "tool-group-bars":
      return { ...base, route: "/group-bars", config: {} };
    case "tool-coordinate-grid":
      return { ...base, route: "/coordinate-grid", config: {} };
    case "tool-term-identifier":
      return { ...base, route: "/term-identifier", config: {} };
    case "tool-decimal-steps":
      // Empty set is meaningful: the tool runs its built-in one-of-each series.
      return { ...base, route: "/decimal-steps", config: { set: normalizeDecimalSet(values.decimalSet) } };
    case "tool-division-house":
      // Empty set is meaningful: the tool runs its built-in ladder.
      return { ...base, route: "/division-house", config: { set: normalizeHouseSet(values.houseSet) } };
    case "tool-multiplication":
      return { ...base, route: "/multiplication-fluency", config: {} };
    case "tool-game":
      return { ...base, route: "/challenge", config: {} };
    case "tool-exit-ticket":
      return { ...base, route: "/exit-ticket", config: {} };
    case "tool-checkpoint":
      return { ...base, route: "/checkpoint", config: {} };
  }
}

function formatLiveFlowError(message: string): string {
  const lower = message.toLowerCase();
  if (message.includes("live_flow") || lower.includes("schema cache") || lower.includes("column")) {
    return "Live Flow database setup is missing. Run supabase/class-mode.sql.";
  }
  return `Live sync error: ${message}`;
}

// The sound bank's clips share this store with the timer cues and the per-state
// music - one upload mechanism on the machine that has the speakers, not two.
// `bank:` namespaces them so a cue id can never collide with a music key.
const bankClipKey = (cueId: string) => `bank:${cueId}`;

// ── IndexedDB (stores uploaded sound files so they persist on this computer) ──
function idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("bdm-control", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("sounds");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbPut(key: string, blob: Blob): Promise<void> {
  const db = await idbOpen();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("sounds", "readwrite");
    tx.objectStore("sounds").put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function idbGet(key: string): Promise<Blob | undefined> {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("sounds", "readonly");
    const r = tx.objectStore("sounds").get(key);
    r.onsuccess = () => resolve(r.result as Blob | undefined);
    r.onerror = () => reject(r.error);
  });
}
async function idbDel(key: string): Promise<void> {
  const db = await idbOpen();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("sounds", "readwrite");
    tx.objectStore("sounds").delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

  // Today's Notion lesson to Control lineup.
// The published lesson lists its tools as free text (e.g. "Number Line"). Map
// those names to bank state ids so the teacher can load and run the day's
// lesson as one sequence instead of rebuilding it by hand.
interface TodayLessonStep {
  id: string;
  slideOverlay?: string;
  slideUrl?: string;
  slideMirror?: boolean;
  slideFit?: "contain" | "cover";
  title: string;
  duration: number;
  stateId: string;
  studentDirections: string;
  teacherNotes: string;
  tool: string;
  question: string;
  pollKind: LivePollKind | "";
  choices: string[];
  correctAnswer: string;
  standard: string;
  linkUrl: string;
  paperTask: string;
  advance: string;
  mainDisplay: string;
  paceDirections: string;
  studentAction: string;
  remoteActions: string;
  discussionStems: string;
  vocabulary: string;
  discussionPhases: string;
  responseMode: string;
  workSpaceAvailable?: boolean;
  publicSurfaceMode?: PublicSurfaceMode;
  routineConfig?: PublicLessonRoutineConfig | null;
  eyes?: string;
  voice?: string;
  supplies?: string;
  body?: string;
}

type TodayLesson = {
  id: string;
  title?: string;
  lessonCode?: string;
  tools?: string | null;
  learningIntention?: string;
  successCriteria?: string;
  selectedSuccessCriterion?: string;
  classroomMode?: string;
  discussionStems?: string;
  discussionVocabulary?: string;
  requiredPaperWork?: string;
  requiredDigitalWork?: string;
  optionalSupport?: string;
  bigDogChallenge?: string;
  dueAndTurnIn?: string;
  helpPath?: string;
  anchorProblem?: string;
  agenda?: string;
  reminders?: string;
  warmUpLink?: string;
  exitTicketLink?: string;
  steps?: TodayLessonStep[];
};

type ActiveLessonContext = {
  id: string;
  code: string;
  title: string;
  learningIntention: string;
  successCriteria: string;
  selectedSuccessCriterion: string;
  classroomMode: string;
  discussionStems: string;
  discussionVocabulary: string;
  requiredPaperWork: string;
  requiredDigitalWork: string;
  optionalSupport: string;
  bigDogChallenge: string;
  dueAndTurnIn: string;
  helpPath: string;
  anchorProblem: string;
  agenda: string;
  reminders: string;
};

const LESSON_TOOL_ALIASES: Record<string, string> = {
  whiteboard: "tool-whiteboard",
  numberline: "tool-number-line",
  doublenumberline: "tool-number-line",
  numberlineplus: "tool-number-line",
  percentbar: "tool-percent-bar",
  percent: "tool-percent-bar",
  equationbuilder: "tool-equation-builder",
  equation: "tool-equation-builder",
  equations: "tool-equation-builder",
  gems: "tool-gems",
  orderofoperations: "tool-gems",
  fractionbars: "tool-fraction-bars",
  fractions: "tool-fraction-bars",
  algebratiles: "tool-algebra-tiles",
  areamodel: "tool-area-model",
  areaexplorer: "tool-area-explorer",
  areaofshapes: "tool-area-explorer",
  shapes: "tool-area-explorer",
  divisibility: "tool-divisibility",
  divisibilityrules: "tool-divisibility",
  decimals: "tool-decimal-steps",
  decimalsteps: "tool-decimal-steps",
  decimaloperations: "tool-decimal-steps",
  decimalsstepbystep: "tool-decimal-steps",
  divisionhouse: "tool-division-house",
  longdivisionhouse: "tool-division-house",
  combineliketerms: "tool-combine",
  combiningliketerms: "tool-combine",
  liketerms: "tool-combine",
  laddermethod: "tool-ladder",
  ladder: "tool-ladder",
  proportions: "tool-proportions",
  proportion: "tool-proportions",
  ratios: "tool-proportions",
  groupbars: "tool-group-bars",
  coordinategrid: "tool-coordinate-grid",
  coordinateplane: "tool-coordinate-grid",
  graphing: "tool-coordinate-grid",
  identifyterms: "tool-term-identifier",
  termidentifier: "tool-term-identifier",
  multiplicationfacts: "tool-multiplication",
  multiplicationfluency: "tool-multiplication",
  multiplication: "tool-multiplication",
};

function normalizeToolName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseLessonList(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
}

function lessonWorkSummary(lesson: ActiveLessonContext | null): string {
  if (!lesson) return "";
  const sections = [
    ["Required Paper Work", lesson.requiredPaperWork],
    ["Required Digital Work", lesson.requiredDigitalWork],
    ["Due and Turn In", lesson.dueAndTurnIn],
    ["Help Path", lesson.helpPath],
    ["Optional Support", lesson.optionalSupport],
    ["Challenge", lesson.bigDogChallenge],
  ];
  return sections
    .filter((entry) => entry[1]?.trim())
    .map(([label, body]) => `${label}: ${body}`)
    .join("\n\n");
}

function minutesForLineupItem(item: LineupItem | undefined, bank: ClassState[]): number {
  if (!item) return 0;
  const configured = item.minutes && item.minutes > 0
    ? item.minutes
    : bank.find((state) => state.id === item.stateId)?.minutes ?? 1;
  return safeStateMinutes(configured);
}

function matchLessonToolStateId(name: string): string | null {
  const norm = normalizeToolName(name);
  if (!norm) return null;
  if (LESSON_TOOL_ALIASES[norm]) return LESSON_TOOL_ALIASES[norm];
  const exact = DEFAULT_STATES.find((s) => normalizeToolName(s.label) === norm);
  if (exact) return exact.id;
  const loose = DEFAULT_STATES.find(
    (s) => s.id.startsWith("tool-")
      && (normalizeToolName(s.label).includes(norm) || norm.includes(normalizeToolName(s.label))),
  );
  return loose ? loose.id : null;
}

// A Notion Lesson Step can carry any State ID Steele types. Rather than drop it
// (which is what silently shortened lessons to the bank skeleton), mint a
// placeholder bank entry so every lookup downstream resolves and the step's
// authored Main Display / Pace Directions still reach the surfaces.
// desc stays EMPTY on purpose: a synthesized state must never supply copy of
// its own, because fabricated copy on a projector reads as authored content.
function synthesizeClassState(stateId: string): ClassState {
  const label = stateId
    .split(/[-_.\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  return { id: stateId, label: label || stateId, minutes: 1, color: "#7c7363", desc: "" };
}

export default function ControlPage() {
  const supabase = TEACHER_SERVER_CLIENT;
  const [storedBank, setBank] = useState<ClassState[]>(DEFAULT_STATES);
  const [lineup, setLineup] = useState<LineupItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  // Every state the running lineup references, whether or not it is a catalog
  // state. Unknown ids surface in the bank palette as ungrouped entries, so an
  // unmapped State ID is visible instead of silently missing from the lesson.
  const bank = useMemo<ClassState[]>(() => {
    const known = new Set(storedBank.map((state) => state.id));
    const extras: ClassState[] = [];
    for (const item of lineup) {
      if (!item.stateId || known.has(item.stateId)) continue;
      known.add(item.stateId);
      extras.push(synthesizeClassState(item.stateId));
    }
    return extras.length ? [...storedBank, ...extras] : storedBank;
  }, [storedBank, lineup]);

  const [secondsLeft, setSecondsLeft] = useState(0);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [warnFlash, setWarnFlash] = useState(false);

  const [editing, setEditing] = useState(false);
  // Steele authors lessons in Notion and Screen Studio, never here, so the bank,
  // the lineup editor and the sound uploads are pre-class surfaces (rule 6 scope
  // note, 2026-07-29). Once a step is loaded the page collapses to the running
  // view and this reopens the machinery in one tap when something fails.
  const [setupOpen, setSetupOpen] = useState(false);
  const [showSounds, setShowSounds] = useState(false);
  const [showSpinner, setShowSpinner] = useState(false);
  const [showLessons, setShowLessons] = useState(false);
  const [showAdmissions, setShowAdmissions] = useState(false);
  const [presets, setPresets] = useState<LessonPreset[]>([]);
  const [presetSearch, setPresetSearch] = useState("");
  // The Notion archive, browsable inside the Lesson Library. Before this the
  // overlay could only load a lesson whose CODE you already remembered, which
  // is fine the morning you authored it and useless a month later.
  const [notionArchive, setNotionArchive] = useState<{ id: string; lessonCode: string; title: string; date: string }[]>([]);
  const [notionArchiveError, setNotionArchiveError] = useState("");
  const [notionSearch, setNotionSearch] = useState("");
  const [saveCode, setSaveCode] = useState("");
  const [saveTitle, setSaveTitle] = useState("");
  const [lessonMsg, setLessonMsg] = useState<string | null>(null);
  const [todayMsg, setTodayMsg] = useState<string | null>(null);
  const [notionLessonCode, setNotionLessonCode] = useState("");
  const [showDiscussion, setShowDiscussion] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [previewSyncPaused, setPreviewSyncPaused] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const [scoreboardStage, setScoreboardStage] = useState<"halftime" | "final">("halftime");
  const [activeLessonContext, setActiveLessonContext] = useState<ActiveLessonContext | null>(null);
  const [soundUrls, setSoundUrls] = useState<Record<string, string>>({});
  const [soundBankError, setSoundBankError] = useState<string | null>(null);
  const findTeacherSessionRef = useRef<(() => Promise<void>) | null>(null);
  const playedCueNoncesRef = useRef<Set<string>>(new Set());
  const [soundLabels, setSoundLabels] = useState<SoundLabels>({});
  const soundLabelsRef = useRef<SoundLabels>({});
  const soundLabelRoomRef = useRef<{ send: (m: { t: "labels"; labels: SoundLabels }) => void } | null>(null);
  const [teacherSession, setTeacherSession] = useState<TeacherSessionRow | null>(null);
  const [teacherSessionReady, setTeacherSessionReady] = useState(false);
  const [notionLaunchRequest, setNotionLaunchRequest] = useState<{ id: string; code: string; run: boolean } | null>(null);
  const [presetLaunchRequest, setPresetLaunchRequest] = useState<{ id: string; run: boolean } | null>(null);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [endingSession, setEndingSession] = useState(false);
  const [admissionRequests, setAdmissionRequests] = useState<AdmissionRequest[]>([]);
  const [admissionRoster, setAdmissionRoster] = useState<AdmissionRosterStudent[]>([]);
  const [admissionJoinedStudentIds, setAdmissionJoinedStudentIds] = useState<string[]>([]);
  const [admissionSelections, setAdmissionSelections] = useState<Record<string, string>>({});
  const [admittingRequestCode, setAdmittingRequestCode] = useState<string | null>(null);
  const [admissionError, setAdmissionError] = useState<string | null>(null);
  const [discussionFlow, setDiscussionFlow] = useState<DiscussionPhaseSnapshot | null>(null);
  const [discussionRemoteCommand, setDiscussionRemoteCommand] = useState<TeacherRemoteCommand | null>(null);
  const [controlPoll, setControlPoll] = useState<ControlPoll | null>(null);
  const [pollKind, setPollKind] = useState<LivePollKind>("short-answer");
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollChoices, setPollChoices] = useState(["", "", "", ""]);
  const [pollAnswers, setPollAnswers] = useState<ControlPollAnswer[]>([]);
  const [pollError, setPollError] = useState<string | null>(null);
  const [flowSyncError, setFlowSyncError] = useState<string | null>(null);
  const [serverHydrationGeneration, setServerHydrationGeneration] = useState(0);
  const [toolSetup, setToolSetup] = useState<ToolSetupValues>(DEFAULT_TOOL_SETUP);
  const [publishedTool, setPublishedTool] = useState<PublishedTool | null>(null);
  const [toolError, setToolError] = useState<string | null>(null);
  const [liveChallenge, setLiveChallenge] = useState<ChallengeRow | null>(null);
  const [liveChallengeBoard, setLiveChallengeBoard] = useState<LeaderRow[]>([]);

  const secRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerEndsAtRef = useRef<number | null>(null);
  const timerStartSecondsRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  // The state whose music the speakers are supposed to be carrying right now. Written
  // synchronously by startMusicFor so a blob that finishes reading late can check whether it is
  // still wanted - by then the teacher may already be two states on.
  const wantedMusicStateRef = useRef<string | null>(null);
  // Mirror of soundUrls for the audio callbacks. Reading through a ref is what keeps
  // startMusicFor's identity stable, and that matters beyond tidiness: it sits in the
  // auto-advance effect's dependency list, where a new identity restarts the pending advance.
  const soundUrlsRef = useRef<Record<string, string>>({});
  // Chrome will not start audio until the document has been clicked. Control is opened on the
  // laptop and can restore a running session before anyone touches it, so a refused play has to
  // be visible and retryable instead of swallowed.
  const [audioBlocked, setAudioBlocked] = useState(false);
  // ONE AudioContext FOR THIS PAGE. An AudioBuffer only crosses contexts cleanly when their sample
  // rates agree, so a clip decoded on one and played on another can throw on `src.buffer = ...` and
  // the press is simply silent. Constructing here is safe before any gesture - a context starts
  // suspended, decodeAudioData still works, and the teacher's first click resumes it.
  const ensureAudioCtx = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    try {
      audioCtxRef.current = audioCtxRef.current
        ?? new (window.AudioContext
          || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      return audioCtxRef.current;
    } catch {
      return null;
    }
  }, []);
  // A clock the teacher armed mid-state from the Remote, on a step that authored no Duration.
  // Lives here because Control's snapshot is a FULL REPLACE - the server sets it, but Control
  // republishes every second and would erase it within a tick if it did not hold it too.
  const [onDemandSeconds, setOnDemandSeconds] = useState<number | null>(null);
  // The single cue channel and the duck-restore timer. See playCue.
  const cueRef = useRef<HTMLAudioElement | null>(null);
  const duckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Control is the BACKUP audio host as of 2026-08-07. When /teacher/present (the
  // foreground projector) is armed and playing, it heartbeats a claim and Control
  // falls silent so a cue never plays twice. When present is gone, this stays
  // false and Control plays exactly as before. latestFlowRef lets the un-suppress
  // path resume the current state's music without waiting for the next advance.
  const audioSuppressedRef = useRef(false);
  const latestFlowRef = useRef<LiveClassFlowSnapshot | null>(null);
  latestFlowRef.current = teacherSession?.live_flow ?? null;
  const previousScoreboardStageRef = useRef<"halftime" | "final" | null>(null);
  const autoOpenedStepRef = useRef<Set<string>>(new Set());
  const openingStepRef = useRef<string | null>(null);
  // Every poll id Control has ever held. The adopt-the-published-poll effect
  // below uses it to tell a NEW server-opened poll from the snapshot echo of one
  // Control already opened - without it, a session row read back a beat behind
  // Control's own publish would hand the stale id straight back.
  const heldPollIdsRef = useRef<Set<string>>(new Set());
  const lastRemoteCommandRef = useRef<string | null>(null);
  const pendingRemoteReceiptRef = useRef<{ sessionId: string; command: TeacherRemoteCommand } | null>(null);
  const remoteReceiptInFlightRef = useRef(false);
  const hydratedSessionRef = useRef<string | null>(null);
  const pendingLiveFlowSyncRef = useRef<{
    sessionId: string;
    snapshot: LiveClassFlowSnapshot;
    epoch: number;
    expectedRevision?: string | null;
  } | null>(null);
  const liveFlowSyncingRef = useRef(false);
  const liveFlowSyncEpochRef = useRef(0);
  const hydrationGenerationRef = useRef(0);
  const processedHydrationGenerationRef = useRef(0);
  const serverFlowSessionRef = useRef<string | null>(null);
  const serverFlowRevisionRef = useRef<string | null>(null);
  const handledNotionLaunchRef = useRef(false);
  const handledPresetLaunchRef = useRef(false);
  const autoOpenedDiscussionStepRef = useRef<string | null>(null);

  const markServerHydration = useCallback((flow: LiveClassFlowSnapshot) => {
    liveFlowSyncEpochRef.current += 1;
    pendingLiveFlowSyncRef.current = null;
    serverFlowRevisionRef.current = flow.updatedAt || null;
    hydrationGenerationRef.current += 1;
    setServerHydrationGeneration(hydrationGenerationRef.current);
  }, []);

  const flushRemoteReceipt = useCallback(async () => {
    const pending = pendingRemoteReceiptRef.current;
    if (!pending || remoteReceiptInFlightRef.current) return;
    const issuedAt = Date.parse(pending.command.issuedAt);
    if (Number.isFinite(issuedAt) && Date.now() - issuedAt >= REMOTE_COMMAND_STALE_MS) {
      pendingRemoteReceiptRef.current = null;
      return;
    }

    remoteReceiptInFlightRef.current = true;
    try {
      await teacherPost("/api/teacher/session", {
        action: "update",
        sessionId: pending.sessionId,
        remoteCommand: pending.command,
        expectedRemoteCommandNonce: pending.command.nonce,
      });
      if (pendingRemoteReceiptRef.current?.command.nonce === pending.command.nonce) {
        pendingRemoteReceiptRef.current = null;
      }
    } catch (error) {
      if (error instanceof TeacherApiError && error.status === 409) {
        if (pendingRemoteReceiptRef.current?.command.nonce === pending.command.nonce) {
          pendingRemoteReceiptRef.current = null;
        }
        return;
      }
      // Leave the receipt queued. The short retry loop below keeps a transient
      // classroom-network failure from permanently blocking the Remote.
    } finally {
      remoteReceiptInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => { void flushRemoteReceipt(); }, REMOTE_RECEIPT_RETRY_MS);
    return () => window.clearInterval(interval);
  }, [flushRemoteReceipt]);

  const armTimer = useCallback((seconds: number) => {
    const safeSeconds = safeTimerSeconds(seconds);
    timerStartSecondsRef.current = safeSeconds;
    timerEndsAtRef.current = safeSeconds > 0 ? Date.now() + safeSeconds * 1000 : null;
  }, []);

  const disarmTimer = useCallback(() => {
    timerEndsAtRef.current = null;
    timerStartSecondsRef.current = 0;
  }, []);

  useEffect(() => {
    if (!autoAdvance) return;
    type WakeLockHandle = { release: () => Promise<void> };
    const wakeLock = (navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<WakeLockHandle> };
    }).wakeLock;
    if (!wakeLock) return;
    let stopped = false;
    let handle: WakeLockHandle | null = null;
    const acquire = async () => {
      if (stopped || document.visibilityState !== "visible") return;
      try {
        handle = await wakeLock.request("screen");
      } catch {
        handle = null;
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") {
        if (handle) void handle.release();
        handle = null;
        return;
      }
      if (!handle) void acquire();
    };
    void acquire();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      if (handle) void handle.release();
      handle = null;
    };
  }, [autoAdvance]);

  // ── Load saved bank minutes + lineup + uploaded sounds ──────────────────
  useEffect(() => {
    try {
      let loadedBank = DEFAULT_STATES;
      const rawBank = localStorage.getItem(LS_BANK);
      if (rawBank) {
        const saved = JSON.parse(rawBank) as ClassState[];
        loadedBank = DEFAULT_STATES.map((d) => {
          const s = saved.find((x) => x.id === d.id);
          return s ? { ...d, minutes: safeStateMinutes(s.minutes, d.minutes) } : d;
        });
        setBank(loadedBank);
      }
      const rawLine = localStorage.getItem(LS_LINEUP);
      if (rawLine) {
        const savedLineup = JSON.parse(rawLine) as LineupItem[];
        setLineup(savedLineup);
        const firstState = savedLineup[0] ? loadedBank.find((state) => state.id === savedLineup[0].stateId) : undefined;
        if (firstState) {
          setCurrentIndex(0);
          secRef.current = safeTimerSeconds(firstState.minutes * 60);
          setSecondsLeft(secRef.current);
        }
      }
    } catch { /* ignore */ }

    (async () => {
      const keys: string[] = ["warn30", "tick", "end", ...DEFAULT_STATES.map((s) => `music:${s.id}`), ...SOUND_CUES.map((c) => bankClipKey(c.id))];
      const next: Record<string, string> = {};
      for (const k of keys) {
        try {
          const blob = await idbGet(k);
          if (blob) next[k] = URL.createObjectURL(blob);
        } catch { /* ignore */ }
      }
      // MERGE, do not replace. startMusicFor now reads a missing key straight out of the database
      // while this loop is still running, and a plain replace here would drop the URL it just
      // made - the running track would keep playing but the next start would go back to disk.
      const merged = { ...next, ...soundUrlsRef.current };
      soundUrlsRef.current = merged;
      setSoundUrls(merged);
      // Hand the bank its clips. Until this resolves a press still sounds -
      // it just plays the built-in cue, same as a machine with nothing loaded.
      // PASS THIS PAGE'S CONTEXT. The upload path already does; this restore path did not, so a
      // clip decoded on the bank's own shared context and then failed on `src.buffer = chosen`
      // when playSoundCue used Control's - a freshly uploaded clip sounded and the same clip went
      // silent after a reload. It matters more now that clips are committed to public/sounds:
      // `userBuffers` WINS over the committed file, so one broken restored buffer would shadow a
      // working file and the button would be silent with a good clip sitting right there.
      for (const cue of SOUND_CUES) {
        const blob = await idbGet(bankClipKey(cue.id)).catch(() => undefined);
        if (blob) void installUserClip(cue.id, await blob.arrayBuffer(), ensureAudioCtx());
      }
    })();
  }, [ensureAudioCtx]);

  // Recover the newest server-side open session. This keeps Control attached
  // even on a different teacher device or before Live Class Flow is selected.
  useEffect(() => {
    let stopped = false;
    let checking = false;
    const setCurrentTeacherSession = (next: TeacherSessionRow | null) => {
      if (serverFlowSessionRef.current !== next?.id) {
        serverFlowSessionRef.current = next?.id || null;
        serverFlowRevisionRef.current = next?.live_flow?.transition ? null : next?.live_flow?.updatedAt || null;
      }
      setJoinCode(next?.join_code || null);
      setTeacherSession((current) => (
        current?.id === next?.id
        && current?.status === next?.status
        && current?.join_code === next?.join_code
        && current?.broadcast === next?.broadcast
        && current?.live_flow?.updatedAt === next?.live_flow?.updatedAt
        && current?.remote_command?.nonce === next?.remote_command?.nonce
          ? current
          : next
      ));
    };

    const findTeacherSession = async () => {
      if (checking) return;
      checking = true;
      try {
        const storedSessionId = getStoredTeacherSessionId();
        // Stay pinned to the session THIS teacher started. latestOpen=1 returns
        // the newest open session across every period, so a student typing a
        // class code mid-period could spawn a newer row and silently drag
        // Control onto it - abandoning the session the class had joined and
        // re-hydrating the lineup from that row's seed flow. Only fall back to
        // the newest open session once the pinned one is genuinely closed.
        let openSession: TeacherSessionRow | null = null;
        if (storedSessionId) {
          const pinned = await teacherApiRequest<{ sessions: TeacherSessionRow[] }>(
            `/api/teacher/session?liveSessionId=${encodeURIComponent(storedSessionId)}`,
          );
          if (stopped) return;
          openSession = pinned.sessions.find((candidate) => candidate.status === "open") ?? null;
        }
        if (!openSession) {
          const result = await teacherApiRequest<{ sessions: TeacherSessionRow[] }>("/api/teacher/session?latestOpen=1");
          if (stopped) return;
          openSession = result.sessions.find((candidate) => candidate.status === "open") ?? null;
          if (storedSessionId && storedSessionId !== openSession?.id) clearStoredTeacherSession(storedSessionId);
        }
        setCurrentTeacherSession(openSession);
        setTeacherSessionReady(true);
      } catch {
        // Preserve the last confirmed session and retry. A temporary network or
        // auth failure must not be mistaken for a successful "no session" result.
      } finally {
        checking = false;
      }
    };

    void findTeacherSession();
    // 1.2s keeps the panel feeling live while quartering the full-snapshot
    // request volume (this endpoint returns the whole lesson flow). It stays the
    // floor; the Remote-command ping pulls a re-read forward through this ref.
    findTeacherSessionRef.current = findTeacherSession;
    const interval = window.setInterval(findTeacherSession, 1200);
    return () => {
      stopped = true;
      findTeacherSessionRef.current = null;
      window.clearInterval(interval);
    };
  }, [supabase]);

  // Keep the private iPad queue current without changing the classroom timer,
  // live-flow broadcast, or the student-facing display.
  useEffect(() => {
    const sessionId = teacherSession?.id;
    const periodId = teacherSession?.period_id;
    if (!sessionId || !periodId) {
      setAdmissionRequests([]);
      setAdmissionRoster([]);
      setAdmissionJoinedStudentIds([]);
      setAdmissionSelections({});
      setAdmissionError(null);
      setShowAdmissions(false);
      return;
    }

    let stopped = false;
    let checking = false;

    const loadAdmissionRequests = async () => {
      if (checking) return;
      checking = true;
      try {
        const result = await teacherApiRequest<{
          admissionRequests?: AdmissionRequest[];
          joins?: Array<{ student_id: string | null }>;
        }>(
          `/api/teacher/session?sessionId=${encodeURIComponent(sessionId)}`,
        );
        if (!stopped) {
          setAdmissionRequests(result.admissionRequests ?? []);
          setAdmissionJoinedStudentIds(
            (result.joins ?? []).flatMap((join) => join.student_id ? [join.student_id] : []),
          );
        }
      } catch (requestError) {
        if (!stopped) {
          setAdmissionError(requestError instanceof Error ? requestError.message : "Waiting students could not be refreshed.");
        }
      } finally {
        checking = false;
      }
    };

    const loadAdmissionRoster = async () => {
      try {
        const result = await teacherApiRequest<{ students: AdmissionRosterStudent[] }>("/api/teacher/roster");
        if (!stopped) setAdmissionRoster(result.students.filter((student) => student.periodId === periodId));
      } catch (rosterError) {
        if (!stopped) {
          setAdmissionError(rosterError instanceof Error ? rosterError.message : "The class roster could not be loaded.");
        }
      }
    };

    void loadAdmissionRoster();
    void loadAdmissionRequests();
    const interval = window.setInterval(loadAdmissionRequests, 3000);
    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, [teacherSession?.id, teacherSession?.period_id]);

  useEffect(() => {
    if (showAdmissions && admissionRequests.length === 0) setShowAdmissions(false);
  }, [admissionRequests.length, showAdmissions]);

  const persistBank = useCallback((next: ClassState[]) => {
    setBank(next);
    try { localStorage.setItem(LS_BANK, JSON.stringify(next)); } catch { /* ignore */ }
  }, []);
  const persistLineup = useCallback((next: LineupItem[]) => {
    setLineup(next);
    try { localStorage.setItem(LS_LINEUP, JSON.stringify(next)); } catch { /* ignore */ }
  }, []);

  // ── Sound playback ──────────────────────────────────────────────────────
  const genTone = useCallback((pattern: { f: number; t: number; d: number }[]) => {
    try {
      audioCtxRef.current = audioCtxRef.current
        ?? new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const ctx = audioCtxRef.current;
      pattern.forEach(({ f, t, d }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = f;
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + t);
        gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + d);
        osc.start(ctx.currentTime + t);
        osc.stop(ctx.currentTime + t + d + 0.02);
      });
    } catch { /* ignore */ }
  }, []);

  // Pull the state music down under a cue and let it back up when the cue ends. Without this the
  // warm-up song, the 30-second alert and the time-up sound all played at once and the room heard
  // mush - the alert has to be the thing you notice, which is the entire reason it exists.
  const duckMusic = useCallback((seconds: number) => {
    const music = musicRef.current;
    if (!music) return;
    if (duckTimerRef.current) clearTimeout(duckTimerRef.current);
    music.volume = MUSIC_DUCK_VOLUME;
    duckTimerRef.current = setTimeout(() => {
      // Re-read the ref: the music may have been swapped or stopped while ducked, and restoring
      // volume on a stale element would leave the NEW track quiet for the rest of the lesson.
      if (musicRef.current) musicRef.current.volume = MUSIC_FULL_VOLUME;
      duckTimerRef.current = null;
    }, Math.max(300, seconds * 1000));
  }, []);

  const playCue = useCallback((key: CueKey) => {
    if (audioSuppressedRef.current) return; // /present has the room
    const url = soundUrls[key];
    if (url) {
      // ONE cue channel. A cue is an interruption, so a new one replaces whatever is still
      // sounding rather than layering onto it.
      if (cueRef.current) {
        cueRef.current.pause();
        cueRef.current.currentTime = 0;
      }
      const a = new Audio(url);
      cueRef.current = a;
      a.addEventListener("ended", () => {
        if (cueRef.current === a) cueRef.current = null;
        if (duckTimerRef.current) clearTimeout(duckTimerRef.current);
        duckTimerRef.current = null;
        if (musicRef.current) musicRef.current.volume = MUSIC_FULL_VOLUME;
      });
      // Duck for the clip's real length once metadata says what that is, with a sane guess until
      // then - an unknown duration must not leave the music ducked forever.
      duckMusic(Number.isFinite(a.duration) && a.duration > 0 ? a.duration : CUE_DUCK_FALLBACK_SECONDS);
      a.addEventListener("loadedmetadata", () => {
        if (cueRef.current === a && Number.isFinite(a.duration) && a.duration > 0) duckMusic(a.duration);
      });
      a.play().catch(() => { /* ignore */ });
      return;
    }
    duckMusic(key === "tick" ? 0.4 : 1);
    if (key !== "music") genTone(TIMER_TONE_PATTERNS[key]);
  }, [soundUrls, genTone, duckMusic]);

  useEffect(() => {
    const previous = previousScoreboardStageRef.current;
    previousScoreboardStageRef.current = scoreboardStage;
    if (previous === "halftime" && scoreboardStage === "final") playCue("end");
  }, [playCue, scoreboardStage]);

  // Keep the ref honest. Every audio callback reads soundUrlsRef, never soundUrls directly.
  useEffect(() => {
    soundUrlsRef.current = soundUrls;
  }, [soundUrls]);

  const stopMusic = useCallback(() => {
    // Whatever was wanted is no longer wanted. A blob read still in flight checks this before it
    // attaches, so clearing it here is what stops a late arrival from singing over silence.
    wantedMusicStateRef.current = null;
    setAudioBlocked(false);
    if (duckTimerRef.current) {
      clearTimeout(duckTimerRef.current);
      duckTimerRef.current = null;
    }
    if (musicRef.current) {
      musicRef.current.pause();
      musicRef.current.currentTime = 0;
      musicRef.current = null;
    }
  }, []);

  // Attach a URL to the speakers, but only if the state that asked for it is still the state the
  // room is in - a blob read can land after the teacher has already moved on.
  const playMusicUrl = useCallback((url: string, stateId: string) => {
    if (wantedMusicStateRef.current !== stateId) return;
    const a = new Audio(url);
    a.loop = true;
    a.volume = MUSIC_FULL_VOLUME;
    musicRef.current = a;
    a.play()
      .then(() => setAudioBlocked(false))
      .catch(() => {
        // DO NOT SWALLOW THIS. From the front of the room a refused play is indistinguishable from
        // a missing file, and it is the only one of the two the teacher can fix in a second.
        if (wantedMusicStateRef.current === stateId) setAudioBlocked(true);
      });
  }, []);

  const startMusicFor = useCallback((stateId: string) => {
    // STOP FIRST, ALWAYS. This used to return early when the new state had no music of its own,
    // which skipped the stop entirely - so the warm-up song played straight on through the next
    // state, and the next, until something else happened to call stopMusic. Every caller treats
    // this as "the music for this state is now the only music", so it has to be true even when the
    // answer is silence.
    stopMusic();
    if (audioSuppressedRef.current) return; // /present has the room
    wantedMusicStateRef.current = stateId;
    const key = `music:${stateId}`;
    const cached = soundUrlsRef.current[key];
    if (cached) {
      playMusicUrl(cached, stateId);
      return;
    }
    // Not prefetched yet - READ IT NOW rather than going quiet. The mount-time prefetch is a
    // serial loop over every cue and every state, each one opening its own database connection,
    // and with multi-megabyte songs it can still be running a second or two in. A class started
    // inside that window used to get silence for that state, permanently, because nothing retried.
    void (async () => {
      const blob = await idbGet(key).catch(() => undefined);
      if (!blob) {
        // Genuinely no song for this state. Silence is the right answer, so drop any stale blocked
        // banner rather than leaving it up over a state that was never meant to sing.
        if (wantedMusicStateRef.current === stateId) setAudioBlocked(false);
        return;
      }
      const url = URL.createObjectURL(blob);
      const next = { ...soundUrlsRef.current, [key]: url };
      soundUrlsRef.current = next;
      setSoundUrls(next);
      playMusicUrl(url, stateId);
    })();
  }, [playMusicUrl, stopMusic]);

  // The first click anywhere on this document is Chrome's permission to make noise. Take it and
  // start the track that was refused, so the teacher never has to work out why the room is quiet.
  useEffect(() => {
    if (!audioBlocked) return;
    const retry = () => {
      const stateId = wantedMusicStateRef.current;
      if (stateId) startMusicFor(stateId);
      else setAudioBlocked(false);
    };
    window.addEventListener("pointerdown", retry);
    window.addEventListener("keydown", retry);
    return () => {
      window.removeEventListener("pointerdown", retry);
      window.removeEventListener("keydown", retry);
    };
  }, [audioBlocked, startMusicFor]);

  // /teacher/audio writes to this same store, but a Control tab already open read its blobs at
  // mount - which is why that page has to say "refresh the host". Listen instead, so a song
  // uploaded during a passing period reaches the speakers without a reload.
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    let channel: BroadcastChannel;
    try {
      channel = new BroadcastChannel(CLASSROOM_AUDIO_CHANNEL);
    } catch {
      return;
    }
    channel.onmessage = (event: MessageEvent) => {
      const key = (event.data as { key?: unknown } | null)?.key;
      if (typeof key !== "string") return;
      void (async () => {
        const blob = await idbGet(key).catch(() => undefined);
        const previousUrl = soundUrlsRef.current[key];
        const next = { ...soundUrlsRef.current };
        if (blob) next[key] = URL.createObjectURL(blob);
        else delete next[key];
        soundUrlsRef.current = next;
        setSoundUrls(next);
        // If the room is sitting on the state that just changed, swap to the new song now -
        // restarting from the top is the honest thing to do when the track itself changed.
        const stateId = wantedMusicStateRef.current;
        if (stateId && key === `music:${stateId}`) startMusicFor(stateId);
        if (previousUrl) URL.revokeObjectURL(previousUrl);
      })();
    };
    return () => channel.close();
  }, [startMusicFor]);

  // Control is the BACKUP audio host (2026-08-07). While /teacher/present (the
  // foreground projector) is armed and playing, it heartbeats a claim and Control
  // falls silent so no cue plays twice. When that claim goes stale - present
  // closed or crashed - Control resumes and restarts the current state's music
  // so a rush day, or a dead projector tab, is never left silent.
  useEffect(() => {
    const sessionId = teacherSession?.id;
    if (!sessionId) return;
    return watchAudioHost(sessionId, (suppressed) => {
      audioSuppressedRef.current = suppressed;
      if (suppressed) {
        stopMusic();
      } else {
        const flow = latestFlowRef.current;
        if (flow?.interlude) startMusicFor(flow.interlude.stateId);
        else if (flow?.timer?.running && flow.state) startMusicFor(flow.state.id);
      }
    });
  }, [teacherSession?.id, startMusicFor, stopMusic]);

  // Ad-hoc "Transition now" interludes (fired from the Remote or /session)
  // arrive through the synced session row. Play the vibe's track while the
  // interlude runs; when it clears, hand the speakers back to the resumed
  // state's music, or go quiet if its clock is paused.
  const interludeKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const flow = teacherSession?.live_flow;
    const interlude = flow?.interlude || null;
    const key = interlude ? `${interlude.stateId}:${interlude.endsAt}` : null;
    if (key === interludeKeyRef.current) return;
    const hadInterlude = Boolean(interludeKeyRef.current);
    interludeKeyRef.current = key;
    if (interlude) {
      startMusicFor(interlude.stateId);
    } else if (hadInterlude) {
      if (flow?.timer?.running && flow.state) startMusicFor(flow.state.id);
      else stopMusic();
    }
  }, [teacherSession, startMusicFor, stopMusic]);

  // Restore the active pacing state once when Control reconnects to an open
  // session. Subsequent live updates continue through the normal sync path.
  useEffect(() => {
    if (!teacherSession) {
      hydratedSessionRef.current = null;
      return;
    }
    const flow = teacherSession.live_flow;
    if (!flow?.sequence || hydratedSessionRef.current === teacherSession.id) return;
    hydratedSessionRef.current = teacherSession.id;
    markServerHydration(flow);

    if (flow.sequence.steps?.length) {
      persistLineup(lineupFromSteps(flow.sequence.steps, uid));
    }

    setCurrentIndex(flow.sequence.currentIndex);
    setAutoAdvance(flow.sequence.advanceMode === "automatic");
    if (flow.lesson) {
      setActiveLessonContext({
        id: flow.lesson.id || "",
        code: flow.lesson.code,
        title: flow.lesson.title,
        learningIntention: flow.lesson.learningIntention,
        successCriteria: publicSuccessCriterion(flow.lesson.selectedSuccessCriterion),
        selectedSuccessCriterion: publicSuccessCriterion(flow.lesson.selectedSuccessCriterion),
        classroomMode: flow.lesson.classroomMode || "",
        discussionStems: flow.lesson.discussionStems?.join("\n") || "",
        discussionVocabulary: flow.lesson.discussionVocabulary?.join("\n") || "",
        requiredPaperWork: flow.lesson.requiredPaperWork || "",
        requiredDigitalWork: flow.lesson.requiredDigitalWork || "",
        optionalSupport: flow.lesson.optionalSupport || "",
        bigDogChallenge: flow.lesson.bigDogChallenge || "",
        dueAndTurnIn: flow.lesson.dueAndTurnIn || "",
        anchorProblem: flow.lesson.anchorProblem || "",
        agenda: flow.lesson.agenda || "",
        reminders: flow.lesson.reminders || "",
        helpPath: flow.lesson.helpPath || "",
      });
    } else setActiveLessonContext(null);
    if (flow.timer) {
      const remaining = liveTimerSeconds(flow.timer);
      secRef.current = remaining;
      setSecondsLeft(remaining);
      const shouldRun = flow.timer.running && remaining > 0;
      if (shouldRun) armTimer(remaining);
      else disarmTimer();
      setRunning(shouldRun);
      setFinished(flow.timer.finished || (flow.timer.running && remaining <= 0));
      if (shouldRun && flow.state) startMusicFor(flow.state.id);
      else stopMusic();
      // The Remote arms an on-demand clock server-side; adopt its length so Control's own engine
      // runs it and the next republish carries it instead of erasing it.
      setOnDemandSeconds(flow.timer.totalSeconds > 0 ? flow.timer.totalSeconds : null);
    } else {
      secRef.current = 0;
      setSecondsLeft(0);
      disarmTimer();
      setRunning(false);
      setFinished(flow.poll?.stage === "results");
      stopMusic();
      setOnDemandSeconds(null);
    }
    setBoardOpen(Boolean(flow.presentation?.boardOpen));
    setScoreboardStage(flow.presentation?.scoreboardStage || "halftime");
    const normalizedDiscussionPhase = normalizeDiscussionPhaseSnapshot(flow.phase);
    if (normalizedDiscussionPhase && usesDiscussionProtocol(flow.state?.id, flow.state?.label || "")) {
      setDiscussionFlow(normalizedDiscussionPhase);
      setShowDiscussion(true);
    } else {
      setDiscussionFlow(null);
      setShowDiscussion(false);
    }
    const interactiveStateId = flow.poll && flow.state ? flow.state.id : null;
    setControlPoll(flow.poll && interactiveStateId
      ? {
          id: flow.poll.id,
          stepIndex: flow.sequence.currentIndex,
          stateId: interactiveStateId,
          kind: flow.poll.kind,
          question: flow.poll.question,
          choices: flow.poll.choices,
          stage: flow.poll.stage,
          awaitingTeacherAdvance: flow.poll.awaitingTeacherAdvance,
          boxes: flow.poll.boxes,
          pairs: flow.poll.pairs,
        }
      : null);
  }, [armTimer, disarmTimer, markServerHydration, persistLineup, startMusicFor, stopMusic, teacherSession]);

  // ── Countdown engine ────────────────────────────────────────────────────
  useEffect(() => {
    if (!running) {
      disarmTimer();
      return;
    }
    if (!timerEndsAtRef.current) armTimer(secRef.current);
    tickRef.current = setInterval(() => {
      const deadline = timerEndsAtRef.current;
      const previous = secRef.current;
      const next = deadline ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : 0;
      if (next === previous) return;
      secRef.current = next;
      setSecondsLeft(next);
      if (previous > 30 && next <= 30) { playCue("warn30"); setWarnFlash(true); setTimeout(() => setWarnFlash(false), 3000); }
      else if (next <= 10 && next >= 1) { playCue("tick"); }
      if (next <= 0) {
        if (tickRef.current) clearInterval(tickRef.current);
        disarmTimer();
        setRunning(false);
        setFinished(true);
        stopMusic();
        playCue("end");
      }
    }, 250);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [armTimer, disarmTimer, running, playCue, stopMusic]);

  // Automatically close a timed response check, briefly show results, and
  // advance while lesson pacing remains on.
  useEffect(() => {
    if (!finished || !autoAdvance || (controlPoll?.stage === "results" && controlPoll.awaitingTeacherAdvance)) return;
    // An armed clock running out on an untimed state is a moment ending, not the state ending -
    // advancing here would pull the room off a deck the teacher is still talking through.
    const runningItem = currentIndex >= 0 ? lineup[currentIndex] : undefined;
    if (isUntimedStep(minutesForLineupItem(runningItem, bank) * 60)) return;
    // A Hustle or Settle is fired at the END of a state, so `finished` is already
    // true when it starts. Without this guard the auto-advance fired 2.6s later
    // and skipped straight past the transition the room was still executing.
    if (teacherSession?.live_flow?.interlude) return;
    if (controlPoll?.stage === "responding") {
      setControlPoll((current) => current ? { ...current, stage: "results" } : null);
      void teacherPost("/api/teacher/poll", { action: "close", pollId: controlPoll.id });
      return;
    }
    const ni = currentIndex + 1;
    if (ni >= lineup.length) return;
    const t = setTimeout(() => {
      const item = lineup[ni];
      const st = item ? bank.find((s) => s.id === item.stateId) : undefined;
      if (!st) return;
      stopMusic();
      setCurrentIndex(ni);
      setOnDemandSeconds(null);
      const minutes = minutesForLineupItem(item, bank);
      secRef.current = minutes * 60;
      armTimer(secRef.current);
      setSecondsLeft(secRef.current);
      setFinished(false);
      setRunning(true);
      startMusicFor(st.id);
    }, controlPoll?.stage === "results" ? 6000 : 2600);
    return () => clearTimeout(t);
  }, [armTimer, finished, autoAdvance, bank, controlPoll, currentIndex, lineup, startMusicFor, stopMusic, teacherSession?.live_flow?.interlude]);

  const activeItem = currentIndex >= 0 ? lineup[currentIndex] : undefined;
  const filteredPresets = presets.filter((p) => {
    const t = presetSearch.trim().toLowerCase();
    return !t || p.code.toLowerCase().includes(t) || p.title.toLowerCase().includes(t);
  });
  const activeState = activeItem ? bank.find((s) => s.id === activeItem.stateId) : undefined;
  const activeLessonCriterionValidationMessage = activeLessonContext
    ? selectedSuccessCriterionValidationMessage(activeLessonContext.selectedSuccessCriterion)
    : null;
  const activeUsesDiscussionProtocol = usesDiscussionProtocol(
    activeState?.id,
    activeItem?.title || activeState?.label || "",
  );
  const activeMinutes = minutesForLineupItem(activeItem, bank);
  // A step with no authored Duration runs untimed: no clock on any screen, no cues, and never an
  // automatic advance - the teacher moves it on, or arms a timer over it from the Remote. Built
  // for a whole outside deck or a video as ONE state, where a countdown just fights the content.
  const stepIsUntimed = isUntimedStep(activeMinutes * 60);
  const effectiveTotalSeconds = onDemandSeconds ?? activeMinutes * 60;
  const activeLessonVisual = useMemo(() => {
    if (!activeItem || !activeState) return null;
    return resolveLessonVisual({
      lessonCode: activeItem.lessonCode || activeLessonContext?.code,
      stateId: activeState.id,
      text: activeItem.mainDisplay || activeItem.studentDirections || activeItem.question || activeState.desc,
      fallbackTexts: [activeItem.studentDirections || "", activeItem.question || "", activeItem.paperTask || ""],
      contextSteps: lineup.map((item) => ({
        stateId: item.stateId,
        text: item.mainDisplay || item.studentDirections || item.question || item.paperTask || "",
      })),
      currentStepIndex: currentIndex,
    });
  }, [activeItem, activeLessonContext?.code, activeState, currentIndex, lineup]);
  const totalMin = lineup.reduce((sum, item) => sum + minutesForLineupItem(item, bank), 0);
  const configuredResponseKind = activeUsesDiscussionProtocol
    ? null
    : resolveLiveStepPollKind(
        activeItem?.responseMode,
        activeItem?.pollKind,
        activeState?.id,
      );
  const activeInteractiveState: InteractiveStateId | null = activeState && configuredResponseKind
    ? activeState.id
    : null;
  const activeToolState: ToolStateId | null = isToolStateId(activeState?.id) ? activeState.id : null;

  // Structured Numeric diagnosis, grouped by error. The spec is read from the
  // lineup item and NEVER from the flow snapshot - the rules carry the answer,
  // so they must not travel to a student device.
  const structuredNumericSummary = (() => {
    if (controlPoll?.kind !== "structured-numeric") return null;
    const parsed = parseStructuredNumericSpec(activeItem?.correctAnswer);
    if (!parsed.ok) return null;
    return summarizeStructuredNumeric(
      parsed.spec,
      pollAnswers.map((answer) => ({
        id: answer.id,
        name: answer.display_name || "Student",
        values: Array.isArray(answer.values) ? answer.values : [],
      })),
    );
  })();

  useEffect(() => {
    if (!activeUsesDiscussionProtocol || !activeItem) {
      autoOpenedDiscussionStepRef.current = null;
      return;
    }
    if ((!running && !autoAdvance) || autoOpenedDiscussionStepRef.current === activeItem.uid) return;
    autoOpenedDiscussionStepRef.current = activeItem.uid;
    disarmTimer();
    setRunning(false);
    setFinished(false);
    setDiscussionFlow(createDiscussionRoundSnapshot("think", running));
    setShowDiscussion(true);
  }, [activeItem, activeUsesDiscussionProtocol, autoAdvance, disarmTimer, running]);

  useEffect(() => {
    if (configuredResponseKind) {
      setPollKind(configuredResponseKind);
    } else if (activeInteractiveState === "question") {
      setPollKind("short-answer");
    } else if (activeInteractiveState === "poll" || activeInteractiveState === "learning-check") {
      setPollKind("fist-to-five");
      setPollQuestion((current) => current || FIST_TO_FIVE_DEFAULT_QUESTION);
    }
  }, [activeInteractiveState, configuredResponseKind]);

  const closeActivePoll = useCallback(() => {
    if (!controlPoll || controlPoll.stage === "results") return;
    setControlPoll((current) => current ? { ...current, stage: "results" } : null);
    void teacherPost("/api/teacher/poll", { action: "close", pollId: controlPoll.id });
  }, [controlPoll, supabase]);

  useEffect(() => {
    // Keyed to the STEP. Two Readiness Questions in a row share a state id, so
    // the old stateId test called them the same question and never closed the
    // first. A poll whose step is gone is finished, whatever kind of step it was.
    if (!controlPoll || controlPoll.stepIndex === currentIndex) return;
    closeActivePoll();
    setControlPoll(null);
    setPollAnswers([]);
  }, [currentIndex, closeActivePoll, controlPoll]);

  useEffect(() => {
    if (publishedTool?.stateId !== activeToolState) {
      setPublishedTool(null);
    }
    if (!activeToolState) {
      setToolError(null);
    }
  }, [activeToolState, publishedTool?.stateId]);

  // When the lineup moves off the Live Game state, close out the running
  // challenge round so it doesn't linger open for the session.
  useEffect(() => {
    if (activeToolState === "tool-game") return;
    if (liveChallenge && supabase) {
      void endChallenge(supabase, liveChallenge.id);
      setLiveChallenge(null);
      setLiveChallengeBoard([]);
    }
  }, [activeToolState, liveChallenge, supabase]);

  useEffect(() => {
    if (!supabase || !liveChallenge) {
      setLiveChallengeBoard([]);
      return;
    }

    let stopped = false;
    const loadBoard = async () => {
      const rows = await fetchLeaderboard(supabase, liveChallenge.id);
      if (!stopped) setLiveChallengeBoard(rows);
    };

    void loadBoard();
    const interval = window.setInterval(loadBoard, 3000);
    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, [liveChallenge, supabase]);

  useEffect(() => {
    if (controlPoll) heldPollIdsRef.current.add(controlPoll.id);
  }, [controlPoll]);

  // The room answers live_flow.poll, so /control must never hold a different id.
  // /teacher/present re-derives the poll id from the published flow on every
  // tick and is always right; Control kept its own copy and only replaced it on
  // the once-per-session hydrate or a fresh remote_command receipt. A poll
  // opened server-side (the Remote's "start lesson") stamps neither, so Control
  // went on polling a dead pollId and drew empty bars while the class answered.
  const publishedPollId = teacherSession?.live_flow?.poll?.id ?? null;
  useEffect(() => {
    const flow = teacherSession?.live_flow;
    const published = flow?.poll;
    const publishedStateId = flow?.state?.id;
    if (!published || !publishedStateId) return;
    if (controlPoll?.id === published.id || heldPollIdsRef.current.has(published.id)) return;
    setControlPoll({
      id: published.id,
      stepIndex: flow?.sequence?.currentIndex ?? null,
      stateId: publishedStateId,
      kind: published.kind,
      question: published.question,
      choices: published.choices,
      stage: published.stage,
      awaitingTeacherAdvance: published.awaitingTeacherAdvance,
      boxes: published.boxes,
      pairs: published.pairs,
    });
    setPollAnswers([]);
  }, [controlPoll, publishedPollId, teacherSession]);

  useEffect(() => {
    if (!controlPoll) return;
    let stopped = false;
    const loadAnswers = async () => {
      const result = await teacherApiRequest<{ answers: ControlPollAnswer[] }>(
        `/api/teacher/poll?pollId=${encodeURIComponent(controlPoll.id)}`,
      ).catch(() => ({ answers: [] }));
      if (!stopped) setPollAnswers(result.answers);
    };
    void loadAnswers();
    const interval = window.setInterval(loadAnswers, 1000);
    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, [controlPoll, supabase]);

  async function openControlPoll(config?: PollLaunchConfig): Promise<boolean> {
    const stateId = config?.stateId ?? activeInteractiveState;
    if (!supabase || !teacherSession || !stateId) {
      setPollError("Start a session first, then open this question or poll.");
      return false;
    }
    const kind = config?.kind ?? pollKind;
    const configuredQuestion = config?.question.trim() ?? "";
    const question = liveStepPollQuestion(configuredQuestion || pollQuestion.trim(), kind);
    const choices = isChoicePollKind(kind)
      ? (config?.choices ?? pollChoices).map((choice) => choice.trim()).filter(Boolean)
      : kind === "fist-to-five"
        ? ["0", "1", "2", "3", "4", "5"]
        : null;
    if (!question) {
      setPollError("Add the question students should answer.");
      return false;
    }
    if (isChoicePollKind(kind) && (!choices || choices.length < 2)) {
      setPollError("Add at least two answer choices.");
      return false;
    }

    setPollError(null);
    let pollId: string;
    try {
      const result = await teacherPost<{ poll: { id: string } }>("/api/teacher/poll", {
        action: "create",
        sessionId: teacherSession.id,
        question,
        choices,
        kind,
        correctAnswer: config?.correctAnswer || null,
        lessonCode: config?.lessonCode || null,
        notionLessonId: config?.notionLessonId || null,
        notionStepId: config?.notionStepId || null,
        standardId: config?.standard || null,
      });
      pollId = result.poll.id;
    } catch (actionError) {
      setPollError(actionError instanceof Error ? actionError.message : "The poll could not be opened.");
      return false;
    }

    setControlPoll({
      id: pollId,
      stepIndex: currentIndex,
      stateId,
      kind,
      question,
      choices,
      stage: "responding",
      ...(kind === "structured-numeric" ? structuredNumericPollFields(config?.correctAnswer) : {}),
    });
    setPollAnswers([]);
    setFinished(false);
    if (secondsLeft <= 0 && activeState) {
      secRef.current = activeMinutes * 60;
      setSecondsLeft(secRef.current);
    }
    return true;
  }

  // A fist to five carries its own question, so this may not require an authored
  // one: with the old `!activeItem?.question` guard a Learning Check with an
  // empty Question never auto-opened here, /api/control-remote would not open it
  // either, and every student screen sat on "your response box is opening" for
  // the rest of the lesson.
  const autoOpenQuestion = liveStepPollQuestion(activeItem?.question, configuredResponseKind);
  useEffect(() => {
    if (!autoOpenQuestion || !activeItem || !activeInteractiveState || !configuredResponseKind || controlPoll) return;
    // uid is minted fresh on every rehydrate (lineupItemFromStep calls uid()),
    // so keying the already-opened memory on it forgot the poll this panel had
    // just opened and auto-opened a second one for the same step - which closed
    // the poll the room was already answering. Key on the Notion step instead.
    const openKey = `${currentIndex}:${activeItem.notionStepId || activeItem.uid}`;
    if (autoOpenedStepRef.current.has(openKey)) return;
    if (!teacherSession || openingStepRef.current === openKey) return;
    openingStepRef.current = openKey;
    void openControlPoll({
      stateId: activeInteractiveState,
      kind: configuredResponseKind,
      question: autoOpenQuestion,
      choices: activeItem.choices,
      correctAnswer: activeItem.correctAnswer,
      standard: activeItem.standard,
      notionStepId: activeItem.notionStepId,
      notionLessonId: activeItem.notionLessonId,
      lessonCode: activeItem.lessonCode,
    }).then((opened) => {
      if (opened) autoOpenedStepRef.current.add(openKey);
      openingStepRef.current = null;
    });
    // openControlPoll intentionally reads the latest teacher/session state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeInteractiveState, activeItem, configuredResponseKind, controlPoll, currentIndex, teacherSession]);

  function prepareAnotherPoll() {
    setControlPoll(null);
    setPollAnswers([]);
    setPollError(null);
    setPollChoices(["", "", "", ""]);
    setPollQuestion(activeInteractiveState === "poll" || activeInteractiveState === "learning-check" ? FIST_TO_FIVE_DEFAULT_QUESTION : "");
    setFinished(false);
  }

  // Keyed to the field's own type, not `string`. The old signature took a
  // string and cast the result, so a non-string field (the ladder mode
  // override is the first) would have accepted a string silently.
  function updateToolSetup<K extends keyof ToolSetupValues>(key: K, value: ToolSetupValues[K]) {
    setToolSetup((current) => ({ ...current, [key]: value }));
  }

  async function publishToolSetup() {
    if (!teacherSession || teacherSession.broadcast !== LIVE_FLOW_MODE || !activeToolState) {
      setToolError("Start a session, select Live Class Flow, then send this tool setup.");
      return;
    }

    // The Live Game state launches an actual auto-scored challenge round for the
    // session (its own Supabase row + leaderboard) and points students at the
    // /challenge surface, which plays whatever round is open for the session.
    if (activeToolState === "tool-game") {
      if (!supabase) { setToolError("Supabase isn't connected."); return; }
      const skill = SKILLS.find((s) => s.key === toolSetup.gameSkill) || SKILLS[0];
      const level = clamp(Math.round(numericValue(toolSetup.gameLevel, 1)), 1, skill.levels.length);
      const durationSeconds = Math.round(numericValue(toolSetup.gameDuration, 180));
      const title = `${skill.label} · ${skill.levels[level - 1] || `Level ${level}`}`;
      const { challenge, error } = await launchChallenge(supabase, {
        sessionId: teacherSession.id, skill: skill.key, title, level, durationSeconds,
      });
      if (error === "SETUP") {
        setToolError("One-time setup: run supabase/challenges.sql in Supabase, then try again.");
        return;
      }
      if (error || !challenge) {
        setToolError(error || "The game could not be launched.");
        return;
      }
      setLiveChallenge(challenge);
      setToolError(null);
      setPublishedTool({ stateId: "tool-game", tool: buildLiveToolConfig("tool-game", toolSetup) });
      return;
    }

    // The Exit Ticket state opens a saved exit-ticket question for the session and
    // sends students to /exit-ticket to answer; responses land in Supabase.
    if (activeToolState === "tool-exit-ticket") {
      if (!supabase) { setToolError("Supabase isn't connected."); return; }
      const prompt = toolSetup.exitPrompt.trim();
      if (!prompt) { setToolError("Type the exit-ticket question first."); return; }
      const kind = toolSetup.exitKind;
      const choices = kind === "multiple-choice"
        ? toolSetup.exitChoices.split(/[\n,]/).map((c) => c.trim()).filter(Boolean)
        : null;
      if (kind === "multiple-choice" && (!choices || choices.length < 2)) {
        setToolError("Add at least two answer choices (one per line)."); return;
      }
      const { ticket, error } = await launchExitTicket(supabase, {
        sessionId: teacherSession.id, periodId: null, lessonCode: null, prompt, kind, choices,
      });
      if (error === "SETUP") { setToolError("One-time setup: run supabase/formative.sql in Supabase, then try again."); return; }
      if (error || !ticket) { setToolError(error || "The exit ticket could not be sent."); return; }
      setToolError(null);
      setPublishedTool({ stateId: "tool-exit-ticket", tool: buildLiveToolConfig("tool-exit-ticket", toolSetup) });
      return;
    }

    // The SBAC Checkpoint state launches one bank item for the session; students
    // answer on /checkpoint and it's auto-graded against the answer key.
    if (activeToolState === "tool-checkpoint") {
      if (!supabase) { setToolError("Supabase isn't connected."); return; }
      const cp = getCheckpoint(toolSetup.checkpointId);
      if (!cp) { setToolError("Pick a checkpoint."); return; }
      const idx = clamp(Math.round(numericValue(toolSetup.checkpointItem, 0)), 0, cp.items.length - 1);
      const item = cp.items[idx];
      if (!item) { setToolError("Pick a checkpoint question."); return; }
      const { run, error } = await launchCheckpoint(supabase, {
        sessionId: teacherSession.id, periodId: null, lessonKey: cp.lessonKey,
        checkpointId: cp.id, itemIndex: idx, ccss: item.ccss,
        prompt: item.q, correctAnswer: item.a, misses: item.misses,
      });
      if (error === "SETUP") { setToolError("One-time setup: run supabase/checkpoints.sql in Supabase, then try again."); return; }
      if (error || !run) { setToolError(error || "The checkpoint could not be sent."); return; }
      setToolError(null);
      setPublishedTool({ stateId: "tool-checkpoint", tool: buildLiveToolConfig("tool-checkpoint", toolSetup) });
      return;
    }

    const tool = buildLiveToolConfig(activeToolState, toolSetup);
    if ((tool.route === "/order-of-operations" || tool.route === "/algebra-tiles") && !tool.config.expression) {
      setToolError("Add the expression students should build or solve.");
      return;
    }

    setToolError(null);
    setPublishedTool({ stateId: activeToolState, tool });
  }

  useEffect(() => {
    if (!activeUsesDiscussionProtocol && showDiscussion) {
      setShowDiscussion(false);
      setDiscussionFlow(null);
    }
  }, [activeUsesDiscussionProtocol, showDiscussion]);

  // Server-owned pacing fields. Control does not author these - /api/control-remote
  // does - but Control's snapshot is a full replace, so it has to hand them back
  // untouched or it deletes them.
  const serverInterlude = teacherSession?.live_flow?.interlude ?? null;
  const serverTransition = teacherSession?.live_flow?.transition ?? null;
  // Same class of field: the iPad's live classroom-state override is written by
  // /api/control-remote, so Control must hand it back or the strip snaps to the
  // authored values about a second after the teacher taps Settle.
  const serverBehaviorOverride = teacherSession?.live_flow?.behaviorOverride ?? null;

  const liveFlowSignature = useMemo(() => {
    const activeSemantic = activeState
      ? inferClassroomStage(activeState.id, activeItem?.title || activeState.label)
      : null;
    const activeIsIndependent = activeSemantic === "independent";
    const state = activeState
      ? {
          id: activeState.id,
          label: activeItem?.title || activeState.label,
          description: activeItem?.studentDirections || activeState.desc,
          color: activeState.color,
          semantic: activeSemantic,
        }
      : null;
    const phase = activeUsesDiscussionProtocol && showDiscussion
      ? normalizeDiscussionPhaseSnapshot(discussionFlow)
      : null;
    // Same step test as the clear effect above, plus the original guard that a
    // poll never rides a non-interactive state.
    const poll = controlPoll && controlPoll.stepIndex === currentIndex && activeInteractiveState
      ? {
          id: controlPoll.id,
          kind: controlPoll.kind,
          question: controlPoll.question,
          choices: controlPoll.choices,
          stage: controlPoll.stage,
          awaitingTeacherAdvance: controlPoll.awaitingTeacherAdvance,
          // Control's snapshot is a full REPLACE - a field omitted here is
          // deleted, and a deleted box count or pairs meta renders zero inputs.
          boxes: controlPoll.boxes,
          pairs: controlPoll.pairs,
        }
      : null;
    const tool = publishedTool?.stateId === activeToolState ? publishedTool.tool : null;
    const resource = activeItem?.linkUrl
      ? {
          label: activeState?.id === "exit"
            ? "Open Exit Ticket"
            : activeItem.responseMode?.trim().toLowerCase() === "assigned tool"
              ? "Open Assigned Tool"
              : "Open Lesson Resource",
          url: activeItem.linkUrl,
        }
      : null;
    const structuredWork = activeIsIndependent
      ? lessonWorkSummary(activeLessonContext)
      : "";
    const presentationBody = activeState?.id === "closeout"
      ? CLOSEOUT_DIRECTIONS
      : activeItem?.mainDisplay
      || (activeIsIndependent
        ? structuredWork || activeItem?.paperTask || activeItem?.question || activeItem?.studentDirections || activeState?.desc || ""
        : activeItem?.question || activeItem?.studentDirections || activeItem?.paperTask || activeState?.desc || "");
    const configuredDiscussionSupports = discussionSupportsForLesson(activeLessonContext?.code);
    // Publish AUTHORED stems and vocabulary on every state, not only discussion
    // ones. Gating them on the discussion protocol meant a lesson's real
    // vocabulary could never displace the hardcoded strategy/evidence/justify
    // table on the pace screen - that table sat there unchanged all period while
    // the lesson's own six terms were never sent. The configured fallback stays
    // discussion-only, and only when nothing is authored.
    const authoredStems = splitLiveFlowLines(activeItem?.discussionStems || activeLessonContext?.discussionStems);
    const authoredVocabulary = splitLiveFlowVocabulary(activeItem?.vocabulary || activeLessonContext?.discussionVocabulary);
    const discussionStems = authoredStems.length
      ? authoredStems
      : activeUsesDiscussionProtocol ? configuredDiscussionSupports.sentenceStems : [];
    const vocabulary = authoredVocabulary.length
      ? authoredVocabulary
      : activeUsesDiscussionProtocol ? configuredDiscussionSupports.keyVocabulary : [];
    const presentation = activeState
      ? {
          title: activeItem?.title || activeState.label,
          body: presentationBody,
          mainDisplay: activeItem?.mainDisplay || "",
          mode: resource
            ? "resource" as const
            : poll
              ? "poll" as const
              : tool
                ? "tool" as const
                // Board mode ONLY when the teacher actually opened the board.
                // Keying it to i-do / we-do / manip meant those states handed the
                // projector an unwritten ink canvas - a blank screen - and threw
                // away Main Display entirely, so the authored mathematics for
                // every direct-instruction and guided-practice step was never
                // shown to the room.
                : boardOpen
                  ? "board" as const
                  : "directions" as const,
          notionStepId: activeItem?.notionStepId || null,
          boardOpen,
          paceDirections: activeState.id === "closeout"
            ? CLOSEOUT_DIRECTIONS
            : activeItem?.paceDirections || activeState.paceAction || activeItem?.studentDirections || activeState.desc,
          studentAction: activeState.id === "closeout"
            ? CLOSEOUT_DIRECTIONS
            : activeItem?.studentAction || activeState.studentAction || activeItem?.studentDirections || activeState.desc,
          responseMode: activeItem?.responseMode || "",
          workSpaceAvailable: activeItem?.workSpaceAvailable,
          publicSurfaceMode: activeItem?.publicSurfaceMode || defaultPublicSurfaceModeForState(activeState.id),
          routineConfig: activeItem?.routineConfig || null,
          discussionStems,
          vocabulary,
          discussionPhases: activeItem?.discussionPhases || undefined,
          scoreboardStage: canRevealM2T1L1FinalScore(activeLessonContext?.code, activeState.id, state?.semantic)
            ? scoreboardStage
            : undefined,
          behaviorStrip: stripFromStep(activeItem),
        }
      : null;
    const timer = poll?.stage === "results"
      ? null
      : phase?.timed && phase.totalSeconds !== null && phase.secondsLeft !== null
      ? {
          totalSeconds: safeTimerSeconds(phase.totalSeconds),
          secondsLeft: safeTimerSeconds(phase.secondsLeft),
          running: phase.running,
          finished: phase.finished,
          // Without a deadline `liveTimerSeconds` takes its frozen-fallback
          // branch on every surface, so the four screens watching a discussion
          // each showed whatever number their own last fetch happened to carry.
          // The overlay arms this once per round and nulls it on a pause, which
          // is exactly the contract the lesson timer below already keeps.
          endsAt: phase.running && phase.endsAt ? phase.endsAt : null,
        }
      : activeState && !(stepIsUntimed && onDemandSeconds === null)
        ? {
            totalSeconds: safeTimerSeconds(effectiveTotalSeconds),
            secondsLeft: safeTimerSeconds(running ? timerStartSecondsRef.current || secondsLeft : secondsLeft),
            running,
            finished,
            endsAt: running && timerEndsAtRef.current ? new Date(timerEndsAtRef.current).toISOString() : null,
          }
        : null;

    const nextItem = currentIndex >= 0 ? lineup[currentIndex + 1] : undefined;
    const nextState = nextItem ? bank.find((candidate) => candidate.id === nextItem.stateId) : undefined;
    const publicCriterion = publicSuccessCriterion(activeLessonContext?.selectedSuccessCriterion);
    const lesson = activeLessonContext
      ? {
          id: activeLessonContext.id,
          code: activeLessonContext.code,
          title: activeLessonContext.title,
          learningIntention: activeLessonContext.learningIntention,
          successCriteria: publicCriterion,
          selectedSuccessCriterion: publicCriterion,
          classroomMode: activeLessonContext.classroomMode,
          discussionStems: splitLiveFlowLines(activeLessonContext.discussionStems),
          discussionVocabulary: splitLiveFlowVocabulary(activeLessonContext.discussionVocabulary),
          requiredPaperWork: activeLessonContext.requiredPaperWork,
          requiredDigitalWork: activeLessonContext.requiredDigitalWork,
          optionalSupport: activeLessonContext.optionalSupport,
          bigDogChallenge: activeLessonContext.bigDogChallenge,
          dueAndTurnIn: activeLessonContext.dueAndTurnIn,
          helpPath: activeLessonContext.helpPath,
          anchorProblem: activeLessonContext.anchorProblem,
          agenda: activeLessonContext.agenda,
          reminders: activeLessonContext.reminders,
        }
      : null;
    const sequence = activeState
      ? {
          currentIndex,
          totalSteps: lineup.length,
          nextLabel: nextItem?.title || nextState?.label || null,
          nextDirections: nextItem?.paceDirections || nextItem?.studentDirections || nextState?.desc || null,
          advanceMode: autoAdvance ? "automatic" as const : "manual" as const,
          // ONE mapper, shared with the two rehydrate sites and pinned by
          // scripts/control-lineup-contract.mjs. This snapshot is a FULL
          // REPLACE, so a field missing here is deleted from the room's
          // snapshot about a second later.
          steps: lineup.map((item) =>
            flowSnapshotForStep(item, bank, activeLessonContext ?? null, {
              inferClassroomStage,
              usesDiscussionProtocol,
              resolveLiveStepPollKind,
              splitLiveFlowLines,
              splitLiveFlowVocabulary,
              discussionSupportsForLesson,
              defaultPublicSurfaceModeForState,
              minutesForItem: (candidate) => minutesForLineupItem(candidate, bank),
            } satisfies FlowStepDeps),
          ),
        }
      : null;
    const activePaperTask = activeItem?.paperTask
      || (activeIsIndependent ? activeLessonContext?.requiredPaperWork : "")
      || "";
    const paper = activePaperTask ? { task: activePaperTask } : null;

    // CARRY the server's interlude and transition through. This snapshot is
    // written with a full replace, and Control republishes about once a second
    // while a timer runs - so omitting these keys ERASED a Hustle or Settle
    // roughly one second after it started. The room saw the transition flash up
    // and vanish, then the state auto-advanced out from under it.
    return JSON.stringify({
      version: 2, state, phase, timer, poll, resource, presentation, tool, lesson, sequence, paper,
      interlude: serverInterlude,
      transition: serverTransition,
      behaviorOverride: serverBehaviorOverride,
    });
  }, [activeInteractiveState, activeItem, activeLessonContext, activeMinutes, activeState, activeToolState, autoAdvance, bank, boardOpen, controlPoll, currentIndex, discussionFlow, effectiveTotalSeconds, finished, lineup, onDemandSeconds, publishedTool, running, scoreboardStage, secondsLeft, serverBehaviorOverride, serverInterlude, serverTransition, showDiscussion, stepIsUntimed]);

  const flushLiveFlowUpdates = useCallback(async () => {
    if (liveFlowSyncingRef.current) return;
    liveFlowSyncingRef.current = true;
    try {
      while (pendingLiveFlowSyncRef.current) {
        const pending = pendingLiveFlowSyncRef.current;
        pendingLiveFlowSyncRef.current = null;
        if (pending.epoch !== liveFlowSyncEpochRef.current) continue;
        const expectedRevision = pending.expectedRevision === undefined
          ? serverFlowRevisionRef.current
          : pending.expectedRevision;
        try {
          const result = await teacherPost<{ session: TeacherSessionRow }>("/api/teacher/session", {
            action: "update",
            sessionId: pending.sessionId,
            liveFlow: pending.snapshot,
            expectedLiveFlowUpdatedAt: expectedRevision,
          });
          if (pending.epoch !== liveFlowSyncEpochRef.current) continue;
          if (result.session.live_flow?.updatedAt) {
            serverFlowRevisionRef.current = result.session.live_flow.updatedAt;
          }
          setFlowSyncError(null);
        } catch (syncError) {
          if (pending.epoch !== liveFlowSyncEpochRef.current) continue;
          if (syncError instanceof TeacherApiError && syncError.status === 409) {
            liveFlowSyncEpochRef.current += 1;
            pendingLiveFlowSyncRef.current = null;
            hydratedSessionRef.current = null;
            const latest = await teacherApiRequest<{ sessions: TeacherSessionRow[] }>("/api/teacher/session")
              .catch(() => ({ sessions: [] }));
            const openSession = latest.sessions.find((candidate) => candidate.id === pending.sessionId) ?? null;
            if (openSession) setTeacherSession(openSession);
          }
          setFlowSyncError(syncError instanceof Error ? syncError.message : "Live flow could not be synchronized.");
        }
      }
    } finally {
      liveFlowSyncingRef.current = false;
    }
  }, []);

  // Keep student Chromebooks in sync with the existing /control state machine.
  // A selected lesson may stage its paused warm-up while the session remains
  // free, so entering the class code does not depend on Begin lesson or a timer.
  useEffect(() => {
    const canPublishLiveFlow = !previewSyncPaused && teacherSession?.broadcast === LIVE_FLOW_MODE;
    const canStageWarmup = teacherSession?.broadcast === "free"
      && Boolean(activeLessonContext)
      && lineup.some((item) => item.stateId === "warmup" && Boolean(item.linkUrl));
    // Do NOT gate this on the browser Supabase client. Every write below goes
    // through teacherPost("/api/teacher/session"); supabase is never used here.
    // When getSupabase() returned null in the deployed bundle, broadcast still
    // flipped to Live Class Flow (that path also uses teacherPost) but no
    // live_flow snapshot was ever written - so live_flow.state.id stayed null
    // and ClassSync held every student on the homepage for the whole period
    // while the teacher watched states advance normally.
    if (!canPublishLiveFlow && !canStageWarmup) {
      pendingLiveFlowSyncRef.current = null;
      return;
    }
    if (serverHydrationGeneration !== hydrationGenerationRef.current) {
      pendingLiveFlowSyncRef.current = null;
      return;
    }
    if (processedHydrationGenerationRef.current !== serverHydrationGeneration) {
      processedHydrationGenerationRef.current = serverHydrationGeneration;
      pendingLiveFlowSyncRef.current = null;
      return;
    }
    const snapshot = {
      ...(JSON.parse(liveFlowSignature) as Omit<LiveClassFlowSnapshot, "updatedAt">),
      updatedAt: new Date().toISOString(),
    };
    pendingLiveFlowSyncRef.current = {
      sessionId: teacherSession.id,
      snapshot,
      epoch: liveFlowSyncEpochRef.current,
      expectedRevision: liveFlowSyncingRef.current ? undefined : serverFlowRevisionRef.current,
    };
    void flushLiveFlowUpdates();
  }, [activeLessonContext, flushLiveFlowUpdates, lineup, liveFlowSignature, previewSyncPaused, serverHydrationGeneration, teacherSession?.broadcast, teacherSession?.id]);

  const handleDiscussionFlowChange = useCallback((snapshot: DiscussionPhaseSnapshot) => {
    setDiscussionFlow(normalizeDiscussionPhaseSnapshot(snapshot));
  }, []);

  const handleDiscussionRemoteCommand = useCallback((command: TeacherRemoteCommand) => {
    setDiscussionRemoteCommand((current) => current?.nonce === command.nonce ? null : current);
    if (!teacherSession) return;
    pendingRemoteReceiptRef.current = {
      sessionId: teacherSession.id,
      command: { ...command, receivedAt: new Date().toISOString() },
    };
    void flushRemoteReceipt();
  }, [flushRemoteReceipt, teacherSession]);

  const closeDiscussion = useCallback(() => {
    setShowDiscussion(false);
    setDiscussionFlow(null);
    setDiscussionRemoteCommand(null);
  }, []);

  // ── Lineup management ───────────────────────────────────────────────────
  function addToLineup(stateId: string) {
    const nextItem = { uid: uid(), stateId };
    const nextLineup = [...lineup, nextItem];
    persistLineup(nextLineup);
    if (currentIndex < 0) {
      const state = bank.find((item) => item.id === stateId);
      if (state) {
        setCurrentIndex(nextLineup.length - 1);
        secRef.current = state.minutes * 60;
        setSecondsLeft(secRef.current);
        setRunning(false);
        setFinished(false);
        stopMusic();
      }
    }
  }
  function removeFromLineup(u: string) {
    const idx = lineup.findIndex((l) => l.uid === u);
    const next = lineup.filter((l) => l.uid !== u);
    persistLineup(next);
    if (idx === currentIndex) { setCurrentIndex(-1); setRunning(false); setFinished(false); stopMusic(); }
  }
  function moveItem(u: string, dir: -1 | 1) {
    const i = lineup.findIndex((l) => l.uid === u);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= lineup.length) return;
    const next = [...lineup];
    [next[i], next[j]] = [next[j], next[i]];
    persistLineup(next);
  }
  function loadIndex(i: number, startImmediately = false) {
    const item = lineup[i];
    if (!item) return;
    const st = bank.find((s) => s.id === item.stateId);
    if (!st) return;
    setCurrentIndex(i);
    setOnDemandSeconds(null);
    const minutes = minutesForLineupItem(item, bank);
    secRef.current = minutes * 60;
    setSecondsLeft(minutes * 60);
    if (startImmediately && minutes > 0) armTimer(minutes * 60);
    else disarmTimer();
    setRunning(startImmediately && minutes > 0);
    setFinished(false);
    setBoardOpen(false);
    setScoreboardStage("halftime");
    stopMusic();
    if (startImmediately && minutes > 0) startMusicFor(st.id);
  }

  // ── Lesson presets (saved sequences) ────────────────────────────────────
  const refreshPresets = useCallback(async () => {
    setPresets(await listLessonPresets());
  }, []);

  function loadPreset(p: LessonPreset) {
    setPreviewSyncPaused(true);
    const newBank = DEFAULT_STATES.map((d) => ({
      ...d,
      minutes: typeof p.minutes[d.id] === "number" ? safeStateMinutes(p.minutes[d.id], d.minutes) : d.minutes,
    }));
    const newLineup = p.lineup.map((s) => ({ uid: uid(), stateId: s.stateId }));
    persistBank(newBank);
    persistLineup(newLineup);
    const first = newLineup[0] ? newBank.find((s) => s.id === newLineup[0].stateId) : undefined;
    setCurrentIndex(newLineup.length ? 0 : -1);
    if (first) { secRef.current = first.minutes * 60; setSecondsLeft(first.minutes * 60); }
    setAutoAdvance(false);
    setRunning(false);
    setFinished(false);
    setActiveLessonContext(null);
    stopMusic();
    setShowLessons(false);
    const previewMessage = `Previewed ${p.code || p.title || "saved sequence"}. This saved sequence stays private until you start it.`;
    setLessonMsg(previewMessage);
    setTodayMsg(previewMessage);
  }

  async function saveCurrentLesson() {
    const code = saveCode.trim();
    if (!code) { setLessonMsg("Add a code first (e.g. M1.T1.L1)."); return; }
    if (lineup.length === 0) { setLessonMsg("Build a lineup before saving."); return; }
    const minutes: Record<string, number> = {};
    storedBank.forEach((b) => { minutes[b.id] = b.minutes; });
    const res = await saveLessonPreset({
      code,
      title: saveTitle.trim(),
      lineup: lineup.map((l) => ({ stateId: l.stateId })),
      minutes,
    });
    if (!res.ok) { setLessonMsg(res.error || "Couldn't save."); return; }
    setLessonMsg("Saved");
    setSaveCode("");
    setSaveTitle("");
    refreshPresets();
  }

  async function removePreset(id: string) {
    await deleteLessonPreset(id);
    refreshPresets();
  }

  // Lesson Steps are the source of truth; the older tools-only path remains as
  // a fallback for pages that have not been converted yet.
  function applyNotionLesson(lesson: TodayLesson, confirmReplace = true): boolean {
    const mapped: string[] = [];
    const unmatched: string[] = [];
    for (const name of parseLessonList(lesson.tools)) {
      const id = matchLessonToolStateId(name);
      if (id) { if (!mapped.includes(id)) mapped.push(id); }
      else unmatched.push(name);
    }
    if (confirmReplace && lineup.length > 0 && !window.confirm(`Replace the current lineup with “${lesson.title || "this lesson"}”?`)) {
      setTodayMsg(null);
      return false;
    }
    setPreviewSyncPaused(true);
    // Never drop an authored step. Filtering to catalog states used to discard
    // roughly thirty real State IDs in the Notion database - and the server path
    // (api/control-remote) does NOT filter, so /control and the remote ran
    // different lessons. Unknown ids get a synthesized bank entry instead.
    const lessonSteps = (lesson.steps || []).filter((step) => step.stateId);
    const unknownStateIds = Array.from(new Set(
      lessonSteps.map((step) => step.stateId).filter((stateId) => !bank.some((state) => state.id === stateId)),
    ));
    // A Structured Numeric step whose Correct Answer does not parse must fail
    // LOUDLY here. Accepting it silently would render zero boxes and mark the
    // whole class wrong against rules nobody wrote - the exact class of defect
    // that let catalog copy reach a projector.
    const structuredNumericProblems = lessonSteps.flatMap((step) => {
      if (resolveLiveStepPollKind(step.responseMode, step.pollKind, step.stateId) !== "structured-numeric") return [];
      const parsed = parseStructuredNumericSpec(step.correctAnswer);
      return parsed.ok ? [] : [`${step.title || step.stateId}: ${parsed.errors[0]}`];
    });
    // Classroom state strip health. A step missing any of the four shows NO
    // strip rather than a partial one, because a strip that is sometimes empty
    // is a strip students stop scanning - so the incomplete steps have to be
    // named here or the strip just quietly is not there. Reported, not blocking:
    // the properties are new and no lesson is backfilled yet, and a check that
    // refuses to start a class is worse than a lesson without the strip.
    const stripGaps = lessonSteps.flatMap((step) => {
      const missing = missingStripSlots(step);
      if (!missing.length || missing.length === 4) return [];
      return [`${step.title || step.stateId} (${missing.join(", ")})`];
    });
    const stripCompleteCount = lessonSteps.filter((step) => stripFromStep(step)).length;
    const newLineup: LineupItem[] = lessonSteps.length
      ? lessonSteps.map((step) => ({
          uid: uid(),
          stateId: step.stateId,
          minutes: Math.max(1, step.duration || 1),
          title: step.title,
          studentDirections: step.studentDirections,
          question: step.question,
          pollKind: step.pollKind,
          choices: step.choices,
          correctAnswer: step.correctAnswer,
          standard: step.standard,
          notionStepId: step.id,
          notionLessonId: lesson.id,
          lessonCode: lesson.lessonCode,
          linkUrl: (step.responseMode.trim().toLowerCase() === "assigned tool" ? liveAssignedToolRoute(step.tool) : null)
            || step.linkUrl
            || (step.stateId === "warmup" ? lesson.warmUpLink : "")
            || (step.stateId === "exit" ? lesson.exitTicketLink : "")
            || "",
          paperTask: step.paperTask,
          advance: step.advance,
          mainDisplay: step.mainDisplay,
          paceDirections: step.paceDirections,
          studentAction: step.studentAction,
          remoteActions: step.remoteActions || step.teacherNotes,
          discussionStems: step.discussionStems,
          vocabulary: step.vocabulary,
          discussionPhases: step.discussionPhases,
          responseMode: step.responseMode,
          workSpaceAvailable: step.workSpaceAvailable,
          slideOverlay: step.slideOverlay || undefined,
          slideUrl: step.slideUrl || undefined,
          slideMirror: step.slideMirror || undefined,
          slideFit: step.slideFit === "cover" ? "cover" : undefined,
          publicSurfaceMode: step.publicSurfaceMode,
          routineConfig: step.routineConfig,
          eyes: step.eyes,
          voice: step.voice,
          supplies: step.supplies,
          body: step.body,
        }))
      : ["warmup", ...mapped, "exit"].map((stateId) => ({ uid: uid(), stateId }));
    autoOpenedStepRef.current.clear();
    setControlPoll(null);
    setPollAnswers([]);
    setActiveLessonContext({
      id: lesson.id,
      code: lesson.lessonCode || "",
      title: lesson.title || lesson.lessonCode || "Math 6 lesson",
      learningIntention: lesson.learningIntention || "",
      successCriteria: lesson.successCriteria || "",
      selectedSuccessCriterion: lesson.selectedSuccessCriterion || "",
      classroomMode: lesson.classroomMode || "",
      discussionStems: lesson.discussionStems || "",
      discussionVocabulary: lesson.discussionVocabulary || "",
      requiredPaperWork: lesson.requiredPaperWork || "",
      requiredDigitalWork: lesson.requiredDigitalWork || "",
      optionalSupport: lesson.optionalSupport || "",
      bigDogChallenge: lesson.bigDogChallenge || "",
      dueAndTurnIn: lesson.dueAndTurnIn || "",
      helpPath: lesson.helpPath || "",
      anchorProblem: lesson.anchorProblem || "",
      agenda: lesson.agenda || "",
      reminders: lesson.reminders || "",
    });
    persistLineup(newLineup);
    const first = newLineup[0];
    setCurrentIndex(0);
    if (first) {
      const minutes = minutesForLineupItem(first, bank);
      secRef.current = minutes * 60;
      setSecondsLeft(minutes * 60);
    }
    setAutoAdvance(false);
    setRunning(false);
    setFinished(false);
    stopMusic();
    setShowLessons(false);
    const parts = [
      `Previewed “${lesson.title || "today's lesson"}”`,
      lessonSteps.length ? `${lessonSteps.length} timed steps added` : `${mapped.length} tool${mapped.length === 1 ? "" : "s"} added`,
      "warm-up staged for the open session; instructional and projector screens unchanged until start",
    ];
    const criterionValidationMessage = selectedSuccessCriterionValidationMessage(lesson.selectedSuccessCriterion);
    if (criterionValidationMessage) parts.push(`start blocked: ${criterionValidationMessage}`);
    if (unmatched.length) parts.push(`couldn't match: ${unmatched.join(", ")}`);
    if (unknownStateIds.length) parts.push(`kept ${unknownStateIds.length} step${unknownStateIds.length === 1 ? "" : "s"} with an unmapped State ID: ${unknownStateIds.join(", ")}`);
    if (structuredNumericProblems.length) parts.push(`ANSWER SPEC WILL NOT PARSE - ${structuredNumericProblems.join("; ")}`);
    if (lessonSteps.length && stripCompleteCount) {
      parts.push(`classroom state strip on ${stripCompleteCount} of ${lessonSteps.length} steps`);
    }
    if (stripGaps.length) parts.push(`PART-FILLED STATE STRIP, so no strip shows - ${stripGaps.join("; ")}`);
    setTodayMsg(parts.join(" · "));
    // A broken answer spec, or a part-filled strip, has to stay on screen long
    // enough to read and fix.
    window.setTimeout(() => setTodayMsg(null), structuredNumericProblems.length || stripGaps.length ? 30000 : 8000);
    return true;
  }

  // Pull today's published Notion lesson and build the full timestamped lineup.
  async function loadTodayLesson() {
    setTodayMsg("Loading today's lesson from Notion…");
    try {
      const res = await fetch("/api/today", { cache: "no-store" });
      const data = (await res.json()) as { lesson?: Pick<TodayLesson, "id"> | null; error?: string };
      if (!res.ok || data.error) throw new Error(data.error || "Couldn't load today's lesson.");
      if (!data.lesson) {
        setTodayMsg("No lesson is published in Notion for today.");
        window.setTimeout(() => setTodayMsg(null), 6000);
        return;
      }
      const teacherLesson = await teacherApiRequest<{ lesson: TodayLesson }>(
        `/api/teacher/lesson?id=${encodeURIComponent(data.lesson.id)}`,
      );
      applyNotionLesson(teacherLesson.lesson);
    } catch (error) {
      setTodayMsg(error instanceof Error ? error.message : "Couldn't reach Notion — check the connection and try again.");
      window.setTimeout(() => setTodayMsg(null), 6000);
    }
  }

  async function loadNotionLesson(
    requestedCode: string,
    options: { lessonId?: string; confirmReplace?: boolean; run?: boolean } = {},
  ): Promise<boolean> {
    const code = requestedCode.trim();
    const lessonId = options.lessonId?.trim() || "";
    if (!code && !lessonId) {
      setLessonMsg("Enter a Notion lesson code first.");
      return false;
    }
    const displayCode = code || "the selected lesson";
    setLessonMsg(`Loading ${displayCode} from Notion…`);
    try {
      const lessonQuery = lessonId
        ? `id=${encodeURIComponent(lessonId)}`
        : `code=${encodeURIComponent(code)}`;
      const res = await fetch(`/api/teacher/lesson?${lessonQuery}`, { cache: "no-store" });
      const data = (await res.json()) as { lesson?: TodayLesson | null; error?: string };
      if (!res.ok || data.error) throw new Error(data.error || "Couldn't load the lesson.");
      if (!data.lesson) {
        setLessonMsg(code ? `No Notion lesson uses the code ${code}.` : "The selected Notion lesson could not be found.");
        return false;
      }
      if (applyNotionLesson(data.lesson, options.confirmReplace ?? true)) {
        setLessonMsg(`Previewed ${data.lesson.lessonCode || code} from Notion. Its warm-up is staged on the student home page now; instructional and projector screens stay unchanged until you start the lesson.`);
        setNotionLessonCode("");
        if (options.run) setPendingRun(true);
        return true;
      }
      return false;
    } catch (error) {
      setLessonMsg(error instanceof Error ? error.message : "Couldn't reach Notion.");
      return false;
    }
  }

  // Read the archive the first time the Lesson Library is opened, not on mount:
  // Control is the tab that must stay responsive all period, and most sessions
  // never open this overlay at all.
  useEffect(() => {
    if (!showLessons || notionArchive.length || notionArchiveError) return;
    let stop = false;
    (async () => {
      try {
        const res = await fetch("/api/teacher/lessons", { credentials: "same-origin", cache: "no-store" });
        const body = await res.json();
        if (stop) return;
        if (!res.ok) throw new Error(body?.error || "The lesson archive could not be read.");
        setNotionArchive((body.lessons ?? []).filter((item: { id?: string }) => item.id));
      } catch (error) {
        if (!stop) setNotionArchiveError(error instanceof Error ? error.message : "The lesson archive could not be read.");
      }
    })();
    return () => { stop = true; };
  }, [showLessons, notionArchive.length, notionArchiveError]);

  const filteredNotionArchive = useMemo(() => {
    const q = notionSearch.trim().toLowerCase();
    const items = q
      ? notionArchive.filter((item) => `${item.lessonCode} ${item.title} ${item.date}`.toLowerCase().includes(q))
      : notionArchive;
    return items.slice(0, 200);
  }, [notionArchive, notionSearch]);

  async function loadNotionLessonByCode() {
    await loadNotionLesson(notionLessonCode);
  }

  function consumeNotionLaunchQuery() {
    const url = new URL(window.location.href);
    url.searchParams.delete("notionLessonId");
    url.searchParams.delete("notionLessonCode");
    url.searchParams.delete("run");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function consumePresetLaunchQuery() {
    const url = new URL(window.location.href);
    url.searchParams.delete("lesson");
    url.searchParams.delete("run");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }

  async function switchSessionToLiveFlow(session: TeacherSessionRow): Promise<void> {
    if (session.broadcast === LIVE_FLOW_MODE) return;
    const result = await teacherPost<{ session: { broadcast: string | null } }>("/api/teacher/session", {
      action: "update",
      sessionId: session.id,
      broadcast: LIVE_FLOW_MODE,
    });
    setTeacherSession((current) => (
      current?.id === session.id
        ? { ...current, broadcast: result.session.broadcast || LIVE_FLOW_MODE }
        : current
    ));
  }

  // When launched from the Sequence Builder with ?run=1, auto-start the lineup
  // once it has loaded so the lesson runs straight through.
  const [pendingRun, setPendingRun] = useState(false);
  useEffect(() => {
    refreshPresets();
    try {
      const params = new URLSearchParams(window.location.search);
      const notionCode = params.get("notionLessonCode")?.trim() || "";
      const notionId = params.get("notionLessonId")?.trim() || "";
      if (notionCode || notionId) {
        setNotionLessonCode(notionCode);
        setNotionLaunchRequest({ id: notionId, code: notionCode, run: params.get("run") === "1" });
        return;
      }
      const lessonId = params.get("lesson")?.trim() || "";
      if (lessonId) setPresetLaunchRequest({ id: lessonId, run: params.get("run") === "1" });
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wait for the open server session to hydrate before replacing it with the
  // lesson deliberately chosen from Teacher Home. Otherwise the older live
  // flow can arrive a moment later and overwrite the teacher's selection.
  useEffect(() => {
    if (!teacherSessionReady || !notionLaunchRequest || handledNotionLaunchRef.current) return;
    const serverSessionHydrated = !teacherSession?.live_flow?.sequence
      || hydratedSessionRef.current === teacherSession.id;
    if (!serverSessionHydrated) return;
    handledNotionLaunchRef.current = true;
    void (async () => {
      const reviewOnly = !notionLaunchRequest.run;
      setPreviewSyncPaused(reviewOnly);
      const loaded = await loadNotionLesson(notionLaunchRequest.code, {
        lessonId: notionLaunchRequest.id,
        confirmReplace: false,
        run: false,
      });
      if (!loaded) {
        setPreviewSyncPaused(false);
        return;
      }

      let shouldRun = notionLaunchRequest.run;
      let blockedMessage: string | null = null;

      if (shouldRun) {
        if (!teacherSession || teacherSession.status !== "open") {
          shouldRun = false;
          blockedMessage = "Lesson loaded but not started. Start a live session, then choose Begin lesson again.";
        } else {
          try {
            // The session must be in Live Class Flow before the new lineup can
            // start or publish its first state to connected Chromebooks.
            await switchSessionToLiveFlow(teacherSession);
          } catch {
            shouldRun = false;
            blockedMessage = "Lesson loaded but not started. Control could not connect the open session to Live Class Flow. Open Session, select Live Class Flow, then choose Begin lesson again.";
          }
        }
      }

      consumeNotionLaunchQuery();
      setNotionLaunchRequest(null);
      if (shouldRun) {
        const startingMessage = "Lesson connected. Starting automatic pacing.";
        setLessonMsg(startingMessage);
        setTodayMsg(startingMessage);
        setPendingRun(true);
      } else if (blockedMessage) {
        setPreviewSyncPaused(true);
        setLessonMsg(blockedMessage);
        setTodayMsg(blockedMessage);
      } else {
        const previewMessage = "Preview loaded. Its warm-up is staged on the student home page now; instructional and projector screens stay unchanged until you start the lesson.";
        setLessonMsg(previewMessage);
        setTodayMsg(previewMessage);
      }
    })();
    // loadNotionLesson intentionally runs only for the URL request captured at
    // mount; Control's normal lesson controls handle later choices.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notionLaunchRequest, serverHydrationGeneration, teacherSession?.broadcast, teacherSession?.id, teacherSession?.status, teacherSessionReady]);

  // Saved Sequence Builder links need the same server-session guard as Notion
  // launches. Wait for any existing live flow to hydrate before replacing it,
  // then put the session in Live Class Flow before starting the new sequence.
  useEffect(() => {
    if (!teacherSessionReady || !presetLaunchRequest || handledPresetLaunchRef.current) return;
    const serverSessionHydrated = !teacherSession?.live_flow?.sequence
      || hydratedSessionRef.current === teacherSession.id;
    if (!serverSessionHydrated) return;
    handledPresetLaunchRef.current = true;
    void (async () => {
      const reviewOnly = !presetLaunchRequest.run;
      setPreviewSyncPaused(reviewOnly);
      setLessonMsg("Loading saved sequence…");
      const preset = await getLessonPreset(presetLaunchRequest.id);
      if (!preset) {
        setPreviewSyncPaused(false);
        setLessonMsg("The saved sequence could not be loaded. Refresh this page to try again.");
        return;
      }
      loadPreset(preset);

      let shouldRun = presetLaunchRequest.run;
      let blockedMessage: string | null = null;
      if (shouldRun && preset.lineup.length === 0) {
        shouldRun = false;
        blockedMessage = "Sequence loaded but not started because it has no steps. Add at least one step in Sequence Builder, then choose Run again.";
      } else if (shouldRun) {
        if (!teacherSession || teacherSession.status !== "open") {
          shouldRun = false;
          blockedMessage = "Sequence loaded but not started. Start a live session, then return to Sequence Builder and choose Run again.";
        } else {
          try {
            await switchSessionToLiveFlow(teacherSession);
          } catch {
            shouldRun = false;
            blockedMessage = "Sequence loaded but not started. Control could not connect the open session to Live Class Flow. Open Session, select Live Class Flow, then return to Sequence Builder and choose Run again.";
          }
        }
      }

      consumePresetLaunchQuery();
      setPresetLaunchRequest(null);
      if (shouldRun) {
        const startingMessage = "Sequence connected. Starting automatic pacing.";
        setLessonMsg(startingMessage);
        setTodayMsg(startingMessage);
        setPendingRun(true);
      } else if (blockedMessage) {
        setPreviewSyncPaused(true);
        setLessonMsg(blockedMessage);
        setTodayMsg(blockedMessage);
      } else {
        const previewMessage = `Previewed ${preset.code || preset.title || "saved sequence"}. This saved sequence stays private until you start it.`;
        setLessonMsg(previewMessage);
        setTodayMsg(previewMessage);
      }
    })();
    // Preset URL launches are one-shot requests captured at mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetLaunchRequest, serverHydrationGeneration, teacherSession?.broadcast, teacherSession?.id, teacherSession?.status, teacherSessionReady]);

  useEffect(() => {
    if (pendingRun && lineup.length > 0) {
      setPendingRun(false);
      void runSequence();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRun, lineup]);

  // ── Timer controls ──────────────────────────────────────────────────────
  function toggleRun() {
    if (!activeState) return;
    if (!running && activeLessonCriterionValidationMessage) {
      setLessonMsg(activeLessonCriterionValidationMessage);
      setTodayMsg(activeLessonCriterionValidationMessage);
      return;
    }
    setPreviewSyncPaused(false);
    if (secondsLeft <= 0) { secRef.current = activeMinutes * 60; setSecondsLeft(secRef.current); setFinished(false); }
    const willRun = !running;
    if (willRun) setAutoAdvance(true);
    if (willRun) armTimer(secRef.current);
    else disarmTimer();
    setRunning(willRun);
    if (willRun) startMusicFor(activeState.id);
    else if (musicRef.current) musicRef.current.pause();
  }
  async function runSequence() {
    if (lineup.length === 0) return;
    // With no lesson attached, every surface falls back to catalog copy and the
    // class runs the bank skeleton while looking normal - that is how a whole
    // period ran without the day's hook, Fist-to-Five or learning check. A
    // hand-built practice-day lineup is legitimate, so confirm rather than block.
    if (!activeLessonContext && !window.confirm(
      "No Notion lesson is attached. The projector and pace screens will show catalog defaults, not today's lesson. Start anyway?",
    )) {
      setPendingRun(false);
      const message = "Lesson not started. Load today's lesson from Notion first.";
      setLessonMsg(message);
      setTodayMsg(message);
      return;
    }
    if (activeLessonCriterionValidationMessage) {
      setPendingRun(false);
      setLessonMsg(activeLessonCriterionValidationMessage);
      setTodayMsg(activeLessonCriterionValidationMessage);
      return;
    }
    if (!teacherSession || teacherSession.status !== "open") {
      const message = "Start a live session before beginning lesson pacing.";
      setLessonMsg(message);
      setTodayMsg(message);
      return;
    }
    try {
      // Do not arm the classroom timer until the open session is connected to
      // Live Class Flow. This keeps Chromebooks and both projectors in lockstep
      // with the visible Start lesson control.
      await switchSessionToLiveFlow(teacherSession);
    } catch {
      const message = "Lesson not started. Control could not connect the open session to Live Class Flow.";
      setLessonMsg(message);
      setTodayMsg(message);
      return;
    }
    const nextIndex = currentIndex >= 0 ? currentIndex : 0;
    const item = lineup[nextIndex];
    const state = item ? bank.find((bankState) => bankState.id === item.stateId) : undefined;
    if (!state) return;
    setPreviewSyncPaused(false);
    setAutoAdvance(true);
    setCurrentIndex(nextIndex);
    secRef.current = secondsLeft > 0 && currentIndex === nextIndex ? secondsLeft : minutesForLineupItem(item, bank) * 60;
    armTimer(secRef.current);
    setSecondsLeft(secRef.current);
    setFinished(false);
    setRunning(true);
    stopMusic();
    startMusicFor(state.id);
  }
  function reset() {
    if (!activeState) return;
    secRef.current = activeMinutes * 60;
    setSecondsLeft(secRef.current);
    disarmTimer();
    setRunning(false);
    setFinished(false);
    stopMusic();
  }
  // Stop automatic pacing while leaving the current lesson state visible.
  function stopSequence() {
    setAutoAdvance(false);
    disarmTimer();
    setRunning(false);
    setFinished(false);
    stopMusic();
  }
  function adjust(deltaSeconds: number) {
    secRef.current = safeTimerSeconds(secRef.current + deltaSeconds);
    if (running) armTimer(secRef.current);
    setSecondsLeft(secRef.current);
    if (deltaSeconds > 0) setFinished(false);
  }
  async function next() {
    const startingFromPreview = Boolean(
      teacherSession
      && teacherSession.status === "open"
      && (previewSyncPaused || teacherSession.broadcast !== LIVE_FLOW_MODE),
    );
    if (startingFromPreview && teacherSession) {
      try {
        await switchSessionToLiveFlow(teacherSession);
        setPreviewSyncPaused(false);
        setAutoAdvance(true);
      } catch {
        const message = "Nothing advanced. Connect the open session to Live Class Flow and try again.";
        setLessonMsg(message);
        setTodayMsg(message);
        return;
      }
    }
    const keepRunning = startingFromPreview || shouldRunNavigationDestination(
      autoAdvance ? "automatic" : "manual",
      activeUsesDiscussionProtocol ? discussionFlow?.running : running,
      activeUsesDiscussionProtocol ? discussionFlow?.finished : finished,
      controlPoll?.stage,
    );
    setRunning(false);
    stopMusic();
    if (controlPoll?.stage === "responding") {
      setControlPoll((current) => current ? {
        ...current,
        stage: "results",
        awaitingTeacherAdvance: true,
      } : null);
      void teacherPost("/api/teacher/poll", { action: "close", pollId: controlPoll.id });
      setFinished(true);
      return;
    }
    if (controlPoll?.stage === "results") {
      setControlPoll(null);
      setPollAnswers([]);
    }
    if (currentIndex + 1 < lineup.length) loadIndex(currentIndex + 1, keepRunning);
    else { setAutoAdvance(false); setRunning(false); setFinished(false); setCurrentIndex(-1); }
  }
  function previous() {
    if (currentIndex <= 0) return;
    const keepRunning = shouldRunNavigationDestination(
      autoAdvance ? "automatic" : "manual",
      activeUsesDiscussionProtocol ? discussionFlow?.running : running,
      activeUsesDiscussionProtocol ? discussionFlow?.finished : finished,
      controlPoll?.stage,
    );
    if (controlPoll?.stage === "responding") closeActivePoll();
    setControlPoll(null);
    setPollAnswers([]);
    loadIndex(currentIndex - 1, keepRunning);
  }

  function completeDiscussion() {
    setShowDiscussion(false);
    setDiscussionFlow(null);
    setDiscussionRemoteCommand(null);
    if (currentIndex + 1 < lineup.length) {
      loadIndex(currentIndex + 1, autoAdvance);
      return;
    }
    setAutoAdvance(false);
    setRunning(false);
    setFinished(false);
    setCurrentIndex(-1);
  }

  useEffect(() => {
    const command = teacherSession?.remote_command;
    if (!command || command.nonce === lastRemoteCommandRef.current) return;
    lastRemoteCommandRef.current = command.nonce;
    if (command.action === "spin-spinner") return;
    if (isDiscussionRemoteAction(command.action) && !command.receivedAt) {
      if (!activeUsesDiscussionProtocol) return;
      if (!showDiscussion && teacherSession?.live_flow?.phase) {
        setDiscussionFlow(normalizeDiscussionPhaseSnapshot(teacherSession.live_flow.phase));
      }
      setShowDiscussion(true);
      setDiscussionRemoteCommand(command);
      return;
    }
    if (command.receivedAt && teacherSession?.live_flow) {
      const publishedFlow = teacherSession.live_flow;
      const publishedTimer = publishedFlow.timer;
      markServerHydration(publishedFlow);
      if (publishedFlow.sequence?.steps?.length) {
        // Was its own literal, and it had drifted: no eyes/voice/supplies/body,
        // so a remote-driven rehydrate mid-lesson silently killed the classroom
        // state strip on both projectors for the rest of the period.
        persistLineup(lineupFromSteps(publishedFlow.sequence.steps, uid));
      }
      if (publishedFlow.sequence) setCurrentIndex(publishedFlow.sequence.currentIndex);
      if (publishedFlow.sequence) setAutoAdvance(publishedFlow.sequence.advanceMode === "automatic");
      if (publishedFlow.lesson) {
        setActiveLessonContext({
          id: publishedFlow.lesson.id || "",
          code: publishedFlow.lesson.code,
          title: publishedFlow.lesson.title,
          learningIntention: publishedFlow.lesson.learningIntention,
          successCriteria: publicSuccessCriterion(publishedFlow.lesson.selectedSuccessCriterion),
          selectedSuccessCriterion: publicSuccessCriterion(publishedFlow.lesson.selectedSuccessCriterion),
          classroomMode: publishedFlow.lesson.classroomMode || "",
          discussionStems: publishedFlow.lesson.discussionStems?.join("\n") || "",
          discussionVocabulary: publishedFlow.lesson.discussionVocabulary?.join("\n") || "",
          requiredPaperWork: publishedFlow.lesson.requiredPaperWork || "",
          requiredDigitalWork: publishedFlow.lesson.requiredDigitalWork || "",
          optionalSupport: publishedFlow.lesson.optionalSupport || "",
          bigDogChallenge: publishedFlow.lesson.bigDogChallenge || "",
          dueAndTurnIn: publishedFlow.lesson.dueAndTurnIn || "",
          anchorProblem: publishedFlow.lesson.anchorProblem || "",
          agenda: publishedFlow.lesson.agenda || "",
          reminders: publishedFlow.lesson.reminders || "",
          helpPath: publishedFlow.lesson.helpPath || "",
        });
      } else setActiveLessonContext(null);
      if (publishedTimer) {
        const publishedSeconds = liveTimerSeconds(publishedTimer);
        secRef.current = publishedSeconds;
        setSecondsLeft(publishedSeconds);
        const shouldRun = publishedTimer.running && publishedSeconds > 0;
        if (shouldRun) armTimer(publishedSeconds);
        else disarmTimer();
        setRunning(shouldRun);
        setFinished(publishedTimer.finished || (publishedTimer.running && publishedSeconds <= 0));
      } else {
        secRef.current = 0;
        setSecondsLeft(0);
        disarmTimer();
        setRunning(false);
        setFinished(publishedFlow.poll?.stage === "results");
        stopMusic();
      }
      setBoardOpen(Boolean(publishedFlow.presentation?.boardOpen));
      setScoreboardStage(publishedFlow.presentation?.scoreboardStage || "halftime");
      const normalizedDiscussionPhase = normalizeDiscussionPhaseSnapshot(publishedFlow.phase);
      if (normalizedDiscussionPhase && usesDiscussionProtocol(publishedFlow.state?.id, publishedFlow.state?.label || "")) {
        setDiscussionFlow(normalizedDiscussionPhase);
        setShowDiscussion(true);
      } else {
        setDiscussionFlow(null);
        setShowDiscussion(false);
      }
      const publishedPoll = publishedFlow.poll;
      const publishedStateId = publishedFlow.state?.id;
      const interactiveStateId = publishedPoll && publishedStateId ? publishedStateId : null;
      setControlPoll(publishedPoll && interactiveStateId
        ? {
            id: publishedPoll.id,
            stepIndex: publishedFlow.sequence?.currentIndex ?? null,
            stateId: interactiveStateId,
            kind: publishedPoll.kind,
            question: publishedPoll.question,
            choices: publishedPoll.choices,
            stage: publishedPoll.stage,
            awaitingTeacherAdvance: publishedPoll.awaitingTeacherAdvance,
            // boxes/pairs were dropped here while the other rehydrate at the top
            // of the file carried them. Control republishes the poll from this
            // object about once a second, and its snapshot is a full replace, so
            // a Remote-driven Next into a Structured Numeric step blanked the
            // input count and students lost the boxes they answer in. Same class
            // as the state-strip and discussionPhases drift.
            boxes: publishedPoll.boxes,
            pairs: publishedPoll.pairs,
          }
        : null);
      setPollAnswers([]);
      return;
    }
    if (command.action === "next") void next();
    else if (command.action === "previous") previous();
    else if (command.action === "toggle-timer") toggleRun();
    else if (command.action === "add-30") adjust(30);
    else if (command.action === "subtract-30") adjust(-30);
    else if (command.action === "reset-timer") reset();
    else if (command.action === "show-board") setBoardOpen(true);
    else if (command.action === "hide-board") setBoardOpen(false);
    else if (command.action === "play-warning") playCue("warn30");
    else if (command.action === "play-countdown") playCue("tick");
    else if (command.action === "play-times-up") playCue("end");
    else {
      // The sound bank (applause, sad trombone, crickets ...). Same mechanism as
      // the three timer cues above: the iPad sends the key, the classroom
      // computer's speakers play it. Reuse this page's AudioContext when it
      // exists - the teacher's own clicks already unlocked it.
      playCueOnce(command.action, command.nonce);
    }
    if (teacherSession) {
      pendingRemoteReceiptRef.current = {
        sessionId: teacherSession.id,
        command: { ...command, receivedAt: new Date().toISOString() },
      };
      void flushRemoteReceipt();
    }
    // These controls intentionally operate on the current state-machine snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherSession?.remote_command?.nonce, flushRemoteReceipt]);
  function editMinutes(id: string, minutes: number) {
    const clamped = Math.max(1, Math.min(120, Math.round(minutes) || 1));
    persistBank(storedBank.map((s) => (s.id === id ? { ...s, minutes: clamped } : s)));
    if (activeState && id === activeState.id && !running) {
      secRef.current = clamped * 60; setSecondsLeft(clamped * 60);
    }
  }

  // One cue per command, whichever path gets there first. The ping usually wins
  // by about a second; the poll then delivers the same nonce and must not
  // replay it. Bounded so a long lesson cannot grow the set without limit.
  const playCueOnce = useCallback((action: string, nonce: string) => {
    const cue = soundCueIdForAction(action);
    if (!cue) return false;
    if (audioSuppressedRef.current) return true; // /present has the room; treat as handled
    const seen = playedCueNoncesRef.current;
    if (seen.has(nonce)) return true;
    seen.add(nonce);
    if (seen.size > 200) for (const old of [...seen].slice(0, 100)) seen.delete(old);
    playSoundCue(cue, audioCtxRef.current);
    return true;
  }, []);

  // A Remote command is announced the instant it is written, so a rimshot lands
  // on the beat instead of up to 1.2s later. A ping may PLAY a sound directly -
  // a duplicate clip is harmless - but nothing else acts on it: for anything
  // that moves the lesson the ping only pulls the authoritative re-read
  // forward, because a duplicated `next` would skip a step of a real class.
  useEffect(() => {
    const sessionId = teacherSession?.id;
    if (!sessionId) return;
    const room = joinRealtimeRoom<RemoteCommandPing>(
      remoteCommandTopic(sessionId),
      (ping) => {
        if (!isRemoteCommandPing(ping)) return;
        if (pingPlaysDirectly(ping.action) && playCueOnce(ping.action, ping.nonce)) return;
        void findTeacherSessionRef.current?.();
      },
      undefined,
      REMOTE_COMMAND_PING_EVENT,
    );
    return () => room.close();
  }, [teacherSession?.id, playCueOnce]);

  // ── Sound bank button names ─────────────────────────────────────────────
  // Control owns them; the iPad Remote asks for them on mount and caches what
  // it hears. Names live in localStorage here - a button name is not classroom
  // data and has no business in the session snapshot Control full-replaces
  // every second.
  useEffect(() => {
    const stored = readStoredSoundLabels();
    soundLabelsRef.current = stored;
    setSoundLabels(stored);
    const room = joinRealtimeRoom<SoundLabelMessage>(SOUND_LABEL_ROOM, (m) => {
      if (m.t === "hello") room.send({ t: "labels", labels: soundLabelsRef.current });
    });
    soundLabelRoomRef.current = room;
    // Announce once on join too, so a Remote already open picks the names up
    // without the teacher touching anything.
    room.send({ t: "labels", labels: stored });
    return () => room.close();
  }, []);

  function renameSoundCue(cueId: string, raw: string) {
    const label = normalizeSoundLabel(raw);
    const next = { ...soundLabelsRef.current };
    if (label) next[cueId] = label;
    else delete next[cueId];
    soundLabelsRef.current = next;
    setSoundLabels(next);
    writeStoredSoundLabels(next);
    soundLabelRoomRef.current?.send({ t: "labels", labels: next });
  }

  // ── Sound upload ────────────────────────────────────────────────────────
  async function uploadSound(key: string, file: File | undefined) {
    if (!file) return;
    await idbPut(key, file);
    const previousUrl = soundUrlsRef.current[key];
    const uploaded = { ...soundUrlsRef.current, [key]: URL.createObjectURL(file) };
    soundUrlsRef.current = uploaded;
    setSoundUrls(uploaded);
    if (previousUrl) URL.revokeObjectURL(previousUrl);
    // Tell every other open tab - /teacher/audio, a second Control - so none of them keeps
    // handing the speakers a file that has been replaced.
    announceClassroomAudioChange(key);
    // A bank clip has to reach the bank now, not on the next reload - the
    // teacher's next move is to press Test and hear whether it is right.
    if (key.startsWith("bank:")) {
      const cueId = key.slice(5);
      const ok = await installUserClip(cueId, await file.arrayBuffer(), audioCtxRef.current);
      setSoundBankError(ok ? null : `${file.name} would not decode. Try an MP3 or WAV.`);
    }
  }
  // Twenty-five clips placed by hand is twenty-five file pickers. Matching on
  // the filename puts each one on its own button in a single drop, and says
  // plainly which files nothing claimed rather than dropping them somewhere.
  async function loadSoundBankFolder(files: FileList | null) {
    if (!files?.length) return;
    const placed: string[] = [];
    const skipped: string[] = [];
    for (const file of Array.from(files)) {
      const cueId = matchSoundCueFile(file.name);
      if (!cueId) { skipped.push(file.name); continue; }
      await uploadSound(bankClipKey(cueId), file);
      placed.push(cueId);
    }
    setSoundBankError(
      skipped.length
        ? `Loaded ${placed.length}. No button matched: ${skipped.slice(0, 4).join(", ")}${skipped.length > 4 ? ` and ${skipped.length - 4} more` : ""}.`
        : placed.length ? `Loaded ${placed.length} clips.` : null,
    );
  }

  async function clearSound(key: string) {
    await idbDel(key);
    const previousUrl = soundUrlsRef.current[key];
    const cleared = { ...soundUrlsRef.current };
    delete cleared[key];
    soundUrlsRef.current = cleared;
    setSoundUrls(cleared);
    if (previousUrl) URL.revokeObjectURL(previousUrl);
    announceClassroomAudioChange(key);
    // Falls back to /sounds/<id>.mp3 if one is deployed, then to the synthesized
    // cue. A button in this bank is never silent.
    if (key.startsWith("bank:")) {
      clearUserClip(key.slice(5));
      setSoundBankError(null);
    }
  }

  async function admitWaitingStudent(request: AdmissionRequest) {
    const studentId = admissionSelections[request.id];
    if (!teacherSession || !studentId || admittingRequestCode) return;

    setAdmittingRequestCode(request.requestCode);
    setAdmissionError(null);
    try {
      const result = await teacherPost<{
        sessionJoin: { id: string; studentId: string; displayName: string; joinedAt: string };
      }>("/api/teacher/session", {
        action: "admit",
        sessionId: teacherSession.id,
        requestCode: request.requestCode,
        studentId,
      });
      setAdmissionRequests((current) => current.filter((candidate) => candidate.id !== request.id));
      setAdmissionJoinedStudentIds((current) => current.includes(result.sessionJoin.studentId)
        ? current
        : [...current, result.sessionJoin.studentId]);
      setAdmissionSelections((current) => {
        const next = { ...current };
        delete next[request.id];
        return next;
      });
    } catch (actionError) {
      setAdmissionError(actionError instanceof Error ? actionError.message : "The student could not be admitted.");
    } finally {
      setAdmittingRequestCode(null);
    }
  }

  async function endTeacherSession() {
    if (!teacherSession || endingSession) return;
    if (!window.confirm("End this session for every connected student?")) return;
    const sessionId = teacherSession.id;
    setEndingSession(true);
    setTodayMsg(null);
    try {
      await teacherPost("/api/teacher/session", { action: "close", sessionId });
      clearStoredTeacherSession(sessionId);
      pendingLiveFlowSyncRef.current = null;
      setTeacherSession(null);
      setJoinCode(null);
      setAdmissionRequests([]);
      setAdmissionRoster([]);
      setAdmissionJoinedStudentIds([]);
      setAdmissionSelections({});
      setAdmissionError(null);
      setShowAdmissions(false);
      setControlPoll(null);
      setPollAnswers([]);
      setLiveChallenge(null);
      setLiveChallengeBoard([]);
      setFlowSyncError(null);
      setTodayMsg("Session ended. Connected student screens have been released.");
    } catch (actionError) {
      setTodayMsg(actionError instanceof Error ? actionError.message : "The session could not be ended.");
    } finally {
      setEndingSession(false);
    }
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT" || target?.isContentEditable;
      if (isTyping || !activeState || editing || showSounds || showAdmissions) return;
      if (e.code === "Space") { e.preventDefault(); toggleRun(); }
      else if (e.code === "ArrowRight" || e.code === "PageDown") { e.preventDefault(); next(); }
      else if (e.code === "ArrowLeft" || e.code === "PageUp") { e.preventDefault(); previous(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeState, editing, showAdmissions, showSounds, secondsLeft, running]);

  const accent = activeState?.color ?? "#4e6ef2";
  const inFinal10 = running && secondsLeft <= 10 && secondsLeft > 0;
  // Same escalation the projectors and the student device show, so Control never
  // reads calm while the room is being warned.
  const clockUrgency = timerUrgency(secondsLeft, { running, finished });
  // With nothing loaded the setup machinery IS the view - there is no running
  // view to protect yet, and the idle copy points at the bank.
  const setupVisible = setupOpen || !activeState;
  const overBudget = totalMin > PERIOD_MIN;
  const denom = activeState ? activeMinutes * 60 : 1;
  const pct = activeState ? Math.max(0, Math.min(100, (secondsLeft / denom) * 100)) : 0;
  const hasNext = currentIndex + 1 < lineup.length;
  const nextState = hasNext ? bank.find((s) => s.id === lineup[currentIndex + 1].stateId) : undefined;
  const nextLabel = hasNext ? lineup[currentIndex + 1]?.title || nextState?.label : undefined;
  // Pace readout: what's left in the plan and the wall-clock finish if every
  // remaining state runs its planned length - the minute-30 "am I going to
  // make it" answer the panel never gave (outside critique).
  const paceSecondsLeft = currentIndex >= 0
    ? secondsLeft + lineup.slice(currentIndex + 1).reduce((sum, item) => sum + minutesForLineupItem(item, bank) * 60, 0)
    : 0;
  const paceFinishClock = currentIndex >= 0
    ? new Date(Date.now() + paceSecondsLeft * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : null;
  const liveFlowConnected = teacherSession?.status === "open" && teacherSession.broadcast === LIVE_FLOW_MODE;
  const liveFlowStatus = !supabase
    ? "Live sync unavailable"
    : flowSyncError
      ? formatLiveFlowError(flowSyncError)
      : liveFlowConnected
        ? "Live Class Flow connected"
        : teacherSession?.status === "open"
          ? `Session ${teacherSession.join_code || "open"} - select Live Class Flow`
          : "Start a session to connect students";
  const groupedBankSections = BANK_GROUPS.map((group) => ({
    ...group,
    states: bank.filter((state) => (group.stateIds as readonly string[]).includes(state.id)),
  })).filter((group) => group.states.length > 0);
  const groupedBankIds = new Set<string>(BANK_GROUPS.flatMap((group) => [...group.stateIds]));
  const ungroupedBankStates = bank.filter((state) => !groupedBankIds.has(state.id));
  const renderBankChip = (state: ClassState) => (
    <div key={state.id} className="cx-chip" onClick={() => !editing && addToLineup(state.id)} style={editing ? { cursor: "default" } : undefined}>
      <span className="dot" style={{ background: state.color }} />
      {state.label}
      {soundUrls[`music:${state.id}`] && <span className="cx-music-tag">audio</span>}
      {editing ? (
        <input className="cx-min-in" type="number" min={1} max={120} value={state.minutes}
          onClick={(e) => e.stopPropagation()} onChange={(e) => editMinutes(state.id, Number(e.target.value))} />
      ) : (
        <span className="m">{state.minutes}m</span>
      )}
    </div>
  );

  return (
    <>
      {audioBlocked ? (
        <button
          type="button"
          onClick={() => {
            const stateId = wantedMusicStateRef.current;
            if (stateId) startMusicFor(stateId);
            else setAudioBlocked(false);
          }}
          style={{
            position: "fixed",
            left: 16,
            bottom: 16,
            zIndex: 9999,
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #fcaf38",
            background: "#2a1f0c",
            color: "#fcaf38",
            font: "700 14px/1.2 var(--bdb-font, inherit)",
            cursor: "pointer",
          }}
        >
          Browser blocked the sound - click to start the music
        </button>
      ) : null}
      <style>{`
        /* Warm Notebook skin for the RUNNING view (rule 6, reversed 2026-07-29):
           Control lives on the laptop, the projectors are separate tabs, and the
           room never sees this screen - so it matches the wireframe language of
           /teacher/pace and /teacher/present instead of fighting a projector.
           Dark survives only where it is still the right answer: the setup drawer
           and the full-screen overlays, both scoped below. */
        .cx-root { min-height:100vh; font-family:var(--bdb-font); color:var(--bdb-ink);
          /* Dotted paper, same recipe as the pace projector so the two read as one system. */
          background-color:${finished
            ? "color-mix(in srgb, var(--bdb-coral) 9%, var(--bdb-ground))"
            : warnFlash
              ? "color-mix(in srgb, var(--bdb-amber) 15%, var(--bdb-ground))"
              : "var(--bdb-ground)"};
          background-image:radial-gradient(circle,#cbc4b2 1px,transparent 1.3px);
          background-size:18px 18px;
          display:grid; grid-template-rows:auto minmax(0,1fr) auto; transition:background-color 300ms ease;
          /* Three tiers of the per-state accent, because the catalog colours run
             from #35785a to #fcaf38 and the light ones fail AA both as text on
             cream and under white text. -text is the AA-safe small-caps tier,
             -deep is for large headings, -fill goes behind white button text. */
          --cx-acc:${accent};
          --cx-acc-deep:color-mix(in srgb, var(--cx-acc) 62%, var(--bdb-ink));
          --cx-acc-text:color-mix(in srgb, var(--cx-acc) 42%, var(--bdb-ink));
          --cx-acc-fill:color-mix(in srgb, var(--cx-acc) 48%, var(--bdb-ink));
          --cx-card-shadow:0 2px 10px rgba(40,32,20,0.06); }
        .cx-overlay { position:fixed; inset:0; z-index:50; overflow:auto; background:#14110c; color:#fff; }
        .cx-top { display:flex; align-items:center; justify-content:space-between; padding:12px 26px; border-bottom:1px solid var(--bdb-line); background:rgba(255,255,255,0.74); flex-wrap:wrap; gap:9px; }
        .cx-mark { margin:0; font-size:0.72rem; font-weight:800; letter-spacing:0.14em; text-transform:uppercase; color:var(--cx-acc-deep); transition:color 300ms ease; }
        .cx-live-status { margin:0 auto 0 0; border:1px solid ${liveFlowConnected && !flowSyncError ? "color-mix(in srgb, var(--bdb-green) 45%, var(--bdb-line))" : "color-mix(in srgb, var(--bdb-amber) 60%, var(--bdb-line))"}; background:${liveFlowConnected && !flowSyncError ? "color-mix(in srgb, var(--bdb-green) 10%, var(--bdb-card))" : "color-mix(in srgb, var(--bdb-amber) 20%, var(--bdb-card))"}; color:${liveFlowConnected && !flowSyncError ? "var(--bdb-green-deep)" : "var(--bdb-ink)"}; border-radius:999px; padding:6px 11px; font-size:0.7rem; font-weight:800; letter-spacing:0.07em; text-transform:uppercase; max-width:min(52vw,520px); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .cx-conductor-note { color:var(--bdb-ink-soft); font-size:0.7rem; font-weight:750; letter-spacing:0.04em; white-space:nowrap; }
        .cx-tbtns { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
        .cx-sbtn { font-size:0.74rem; font-weight:800; letter-spacing:0.05em; text-transform:uppercase; color:var(--bdb-ink-soft); background:var(--bdb-card); border:1px solid var(--bdb-line); border-radius:9px; padding:7px 12px; cursor:pointer; text-decoration:none; box-shadow:0 1px 2px rgba(40,32,20,0.05); transition:border-color 140ms ease, color 140ms ease, background 140ms ease; }
        .cx-sbtn:hover { border-color:var(--cx-acc); color:var(--bdb-ink); }
        .cx-sbtn.on { border-color:var(--cx-acc-fill); background:var(--cx-acc-fill); color:var(--bdb-card); }
        .cx-sbtn.cx-teal { border-color:color-mix(in srgb, var(--bdb-teal) 55%, var(--bdb-line)); color:var(--bdb-teal-deep); }
        .cx-sbtn.cx-teal:hover { border-color:var(--bdb-teal-deep); background:color-mix(in srgb, var(--bdb-teal) 10%, var(--bdb-card)); color:var(--bdb-teal-deep); }
        .cx-setup-toggle { display:inline-flex; align-items:center; gap:7px; }
        .cx-home { color:var(--bdb-ink); }
        .cx-admission-alert { border-color:color-mix(in srgb, var(--bdb-amber) 65%, var(--bdb-line)); background:color-mix(in srgb, var(--bdb-amber) 24%, var(--bdb-card)); color:var(--bdb-ink); }
        .cx-admission-alert:hover { border-color:var(--bdb-amber); background:color-mix(in srgb, var(--bdb-amber) 36%, var(--bdb-card)); color:var(--bdb-ink); }
        .cx-end-session { border-color:color-mix(in srgb, var(--bdb-coral) 45%, var(--bdb-line)); color:var(--bdb-coral-deep); }
        .cx-end-session:hover { border-color:var(--bdb-coral-deep); background:color-mix(in srgb, var(--bdb-coral) 11%, var(--bdb-card)); color:var(--bdb-coral-deep); }
        .cx-end-session:disabled { opacity:0.5; cursor:wait; }
        .cx-divider { width:1px; height:22px; background:var(--bdb-line); flex:none; margin:0 2px; }

        .cx-main { display:grid; align-content:center; justify-items:center; gap:16px; padding:24px 18px 30px; text-align:center; }
        .cx-main.cx-main-visual { align-content:start; gap:12px; padding:14px 18px 22px; }
        .cx-story-head { width:min(94vw,1180px); display:flex; align-items:end; justify-content:space-between; gap:20px; text-align:left; }
        .cx-story-head-copy { min-width:0; display:grid; gap:3px; }
        .cx-story-head .cx-pos { font-size:0.66rem; }
        .cx-story-head .cx-state { min-height:0; font-size:clamp(1.05rem,2.2vw,1.7rem); line-height:1.05; }
        .cx-story-time { flex:none; color:var(--bdb-ink); font-size:clamp(2.1rem,4.8vw,3.9rem); line-height:0.85; font-weight:800; font-variant-numeric:tabular-nums; letter-spacing:-0.045em; }
        /* LessonVisual is the SHARED projector slide component and paints white on
           transparent, so the stage stays an ink panel. It reads as a mirror of
           what the room is looking at rather than a cream card that lost its text. */
        .cx-story-stage { width:min(94vw,1180px); min-width:0; border:1px solid var(--bdb-line); border-radius:var(--bdb-r); background:var(--bdb-ink); padding:clamp(12px,2vw,20px); box-shadow:var(--cx-card-shadow); }
        .cx-main-visual .cx-progress { width:min(76vw,650px); height:10px; }
        .cx-main-visual .cx-note { min-height:0.8em; font-size:0.8rem; }
        .cx-hero { width:min(94vw,880px); display:grid; justify-items:center; gap:12px; border:1px solid var(--bdb-line); border-radius:var(--bdb-r-lg); background:var(--bdb-card); padding:clamp(20px,3vw,34px) clamp(18px,3vw,38px); box-shadow:var(--cx-card-shadow); }
        .cx-state { font-size:clamp(1.3rem,3.4vw,2.3rem); font-weight:800; line-height:1.1; letter-spacing:-0.01em; color:var(--cx-acc-deep); min-height:1.2em; transition:color 300ms ease; text-wrap:balance; }
        .cx-pos { font-size:0.72rem; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:var(--bdb-ink-faint); }
        .cx-clock { font-variant-numeric:tabular-nums; font-weight:800; line-height:0.9; letter-spacing:-0.03em; color:var(--bdb-ink);
          font-size:${inFinal10 ? "clamp(9rem,34vw,24rem)" : "clamp(4.5rem,17vw,12rem)"}; }
        ${TIMER_URGENCY_CSS}
        /* The shared warn amber is tuned for a projector at 25 feet; on a white
           card 18 inches away it measures under 2:1, so the clock takes a deeper
           mix of the SAME amber. Coral already passes at this size. */
        .cx-clock.bdb-urgency-warn, .cx-story-time.bdb-urgency-warn { color:color-mix(in srgb, var(--bdb-amber) 68%, var(--bdb-ink)); }
        .cx-note { font-size:0.92rem; font-weight:800; text-transform:uppercase; letter-spacing:0.1em; min-height:1.3em; color:var(--bdb-ink-soft); }
        .cx-warn { color:color-mix(in srgb, var(--bdb-amber) 68%, var(--bdb-ink)); }
        .cx-fin { color:var(--bdb-coral-deep); }
        .cx-idle { color:var(--bdb-ink-soft); font-size:1rem; font-weight:700; max-width:46ch; text-transform:none; letter-spacing:0; }
        .cx-desc { font-size:clamp(1rem,2vw,1.35rem); font-weight:700; color:var(--bdb-ink-soft); max-width:46ch; line-height:1.35; }
        .cx-join { display:inline-flex; align-items:center; gap:16px; padding:10px 22px; border-radius:var(--bdb-r); background:var(--bdb-card); border:1px solid var(--bdb-line); box-shadow:var(--cx-card-shadow); }
        .cx-join-label { font-size:0.7rem; font-weight:800; letter-spacing:0.14em; text-transform:uppercase; color:var(--bdb-teal-deep); }
        .cx-join-code { font-size:clamp(2rem,5vw,3.2rem); font-weight:800; letter-spacing:0.16em; color:var(--bdb-ink); line-height:1; font-variant-numeric:tabular-nums; }
        .cx-progress { width:min(82vw,700px); height:12px; border-radius:999px; background:var(--bdb-ground-2); overflow:hidden; border:1px solid var(--bdb-line); }
        .cx-progress-fill { height:100%; border-radius:999px; transition:width 1s linear, background 300ms ease; }
        .cx-upnext { font-size:0.78rem; font-weight:800; color:var(--bdb-ink-faint); text-transform:uppercase; letter-spacing:0.08em; }
        .cx-pace { font-size:0.82rem; font-weight:700; color:var(--bdb-ink-soft); }
        .cx-pace strong { color:var(--bdb-ink); }
        .cx-upnext strong { color:var(--bdb-ink-soft); }

        .cx-actions { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; align-items:center; }
        /* The transport is the one thing he touches every ninety seconds, so it
           gets its own card and the fine adjustments sit back as quiet chips. */
        .cx-transport { border:1px solid var(--bdb-line); border-radius:var(--bdb-r-lg); background:var(--bdb-card); padding:12px 14px; box-shadow:var(--cx-card-shadow); }
        .cx-actions-sep { width:1px; align-self:stretch; min-height:22px; background:var(--bdb-line); margin:0 5px; }
        .cx-btn { font-size:0.95rem; font-weight:800; border-radius:11px; padding:12px 21px; cursor:pointer; border:1px solid var(--bdb-line); background:var(--bdb-card); color:var(--bdb-ink); box-shadow:0 1px 2px rgba(40,32,20,0.05); transition:transform 120ms ease, border-color 140ms ease, filter 140ms; }
        .cx-btn:hover { transform:translateY(-1px); border-color:var(--cx-acc); }
        .cx-btn.pri { background:var(--cx-acc-fill); border-color:var(--cx-acc-fill); color:var(--bdb-card); } .cx-btn.pri:hover { filter:brightness(1.1); }
        .cx-btn.next { background:var(--bdb-green-deep); border-color:var(--bdb-green-deep); color:var(--bdb-card); }
        .cx-btn.cx-amber { background:var(--bdb-amber); border-color:var(--bdb-amber); color:var(--bdb-ink); }
        .cx-btn.cx-teal { background:var(--bdb-teal-deep); border-color:var(--bdb-teal-deep); color:var(--bdb-card); }
        .cx-btn.quiet { background:transparent; border-color:var(--bdb-line); color:var(--bdb-ink-soft); padding:9px 13px; font-size:0.8rem; box-shadow:none; }
        .cx-btn.quiet:hover { color:var(--bdb-ink); }
        .cx-btn:disabled { opacity:0.35; cursor:not-allowed; transform:none; }
        .cx-poll { width:min(94vw,760px); display:grid; gap:12px; padding:16px 18px; border:1px solid var(--bdb-line); border-left:6px solid var(--cx-acc); border-radius:var(--bdb-r); background:var(--bdb-card); box-shadow:var(--cx-card-shadow); text-align:left; }
        .cx-poll-head { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
        .cx-poll-title { margin:0; color:var(--cx-acc-text); font-size:0.72rem; font-weight:900; letter-spacing:0.13em; text-transform:uppercase; }
        .cx-poll-note { color:var(--bdb-ink-soft); font-size:0.84rem; font-weight:700; line-height:1.4; }
        .cx-poll-grid { display:grid; grid-template-columns:180px minmax(0,1fr); gap:10px; align-items:center; }
        .cx-poll-label { color:var(--bdb-ink-faint); font-size:0.74rem; font-weight:800; letter-spacing:0.06em; text-transform:uppercase; }
        .cx-poll-input, .cx-poll-select { width:100%; border:1px solid var(--bdb-line); border-radius:9px; box-sizing:border-box; background:var(--bdb-ground); color:var(--bdb-ink); padding:10px 12px; font:inherit; font-size:0.95rem; font-weight:700; }
        .cx-poll-input { min-height:44px; }
        .cx-poll-input:focus, .cx-poll-select:focus, .cx-tool-input:focus, .cx-tool-select:focus { outline:2px solid var(--cx-acc-fill); outline-offset:1px; }
        .cx-poll-choices { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
        .cx-poll-error { color:var(--bdb-coral-deep); font-size:0.84rem; font-weight:800; }
        .cx-poll-summary { color:var(--bdb-ink); font-size:0.92rem; font-weight:800; }
        .cx-poll-results { display:grid; gap:8px; }
        .cx-poll-result { display:grid; grid-template-columns:minmax(110px,1fr) minmax(80px,2fr) auto; gap:10px; align-items:center; color:var(--bdb-ink); font-size:0.9rem; font-weight:750; }
        .cx-poll-bar { height:10px; overflow:hidden; border-radius:999px; background:var(--bdb-ground-2); }
        .cx-poll-fill { height:100%; border-radius:inherit; background:var(--cx-acc); transition:width 220ms ease; }
        .cx-poll-answers { display:flex; flex-wrap:wrap; gap:7px; }
        .cx-poll-answer { border:1px solid var(--bdb-line); border-radius:999px; padding:6px 11px; background:var(--bdb-ground); color:var(--bdb-ink); font-size:0.78rem; font-weight:700; }
        .cx-tool { width:min(94vw,760px); display:grid; gap:12px; padding:16px 18px; border:1px solid var(--bdb-line); border-left:6px solid var(--bdb-teal); border-radius:var(--bdb-r); background:var(--bdb-card); box-shadow:var(--cx-card-shadow); text-align:left; }
        .cx-tool-head { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
        .cx-tool-title { margin:0; color:var(--bdb-teal-deep); font-size:0.72rem; font-weight:900; letter-spacing:0.13em; text-transform:uppercase; }
        .cx-tool-note { color:var(--bdb-ink-soft); font-size:0.84rem; font-weight:700; line-height:1.4; }
        .cx-tool-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }
        /* No text-transform on the field label: it wraps its own input, and an
           inherited uppercase would rewrite what the teacher typed. */
        .cx-tool-field { display:grid; gap:5px; color:var(--bdb-ink-faint); font-size:0.78rem; font-weight:800; }
        .cx-tool-field.wide { grid-column:1 / -1; }
        .cx-tool-hint { color:var(--bdb-ink-soft); font-size:0.76rem; font-weight:650; line-height:1.4; letter-spacing:0; }
        .cx-tool-check { display:flex; align-items:center; gap:8px; min-height:42px; color:var(--bdb-ink); font-size:0.8rem; font-weight:800; cursor:pointer; }
        .cx-tool-check input { width:20px; height:20px; accent-color:var(--bdb-teal-deep); cursor:pointer; }
        .cx-tool-input, .cx-tool-select { width:100%; min-height:42px; box-sizing:border-box; border:1px solid var(--bdb-line); border-radius:9px; background:var(--bdb-ground); color:var(--bdb-ink); padding:9px 11px; font:inherit; font-weight:700; }
        .cx-tool-status { color:var(--bdb-green-deep); font-size:0.84rem; font-weight:800; }
        .cx-tool-key { grid-column:1 / -1; color:var(--bdb-ink-faint); font-size:0.82rem; font-weight:700; }
        .cx-leader { display:grid; gap:8px; border:1px solid var(--bdb-line); border-radius:12px; background:var(--bdb-ground); padding:12px; }
        .cx-leader-title { color:var(--bdb-teal-deep); font-size:0.72rem; font-weight:900; letter-spacing:0.12em; text-transform:uppercase; }
        .cx-leader-row { display:grid; grid-template-columns:auto minmax(0,1fr) auto auto; gap:10px; align-items:center; border:1px solid var(--bdb-line); border-radius:9px; background:var(--bdb-card); padding:9px 10px; color:var(--bdb-ink); font-size:0.86rem; font-weight:750; }
        .cx-leader-rank { display:grid; width:28px; height:28px; place-items:center; border-radius:7px; background:var(--cx-acc-fill); color:var(--bdb-card); font-weight:800; }
        .cx-leader-name { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .cx-leader-acc { color:var(--bdb-ink-soft); font-size:0.78rem; }
        .cx-leader-points { color:var(--bdb-green-deep); font-weight:800; }
        @media (max-width:640px) { .cx-poll-grid { grid-template-columns:1fr; } .cx-poll-choices { grid-template-columns:1fr; } }
        @media (max-width:640px) { .cx-tool-grid { grid-template-columns:1fr; } }

        /* The setup drawer keeps its dark styling (out of scope for the 07-29
           restyle), so the boundary has to look chosen: a brown seam, its own
           header and label, and a hard cap on height so it can never push the
           running view off the laptop screen. */
        .cx-setup { border-top:3px solid var(--bdb-brown); background:#14110c; color:#fff; max-height:56vh; overflow:auto; display:grid; align-content:start; }
        .cx-setup-head { position:sticky; top:0; z-index:1; display:flex; align-items:baseline; gap:12px; flex-wrap:wrap; padding:12px 20px; border-bottom:1px solid #2a241a; background:#14110c; }
        .cx-setup-title { margin:0; color:#efe9df; font-size:0.76rem; font-weight:900; letter-spacing:0.12em; text-transform:uppercase; }
        .cx-setup-hint { color:#a39a88; font-size:0.78rem; font-weight:700; }
        .cx-setup-tools { display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-left:auto; }
        .cx-setup .cx-sbtn, .cx-overlay .cx-sbtn { color:#a39a88; background:transparent; border-color:#2a241a; box-shadow:none; }
        .cx-setup .cx-sbtn:hover, .cx-overlay .cx-sbtn:hover { border-color:#5a5142; color:#fff; }
        .cx-setup .cx-sbtn.on { border-color:#5a5142; background:rgba(255,255,255,0.08); color:#fff; }
        .cx-overlay .cx-btn { background:#1d1810; border-color:#34301f; color:#fff; box-shadow:none; }
        .cx-overlay .cx-btn.pri { background:${accent}; border-color:${accent}; }
        .cx-overlay .cx-btn.next { background:#2f9e6f; border-color:#2f9e6f; }

        .cx-lineup { border-top:1px solid #2a241a; padding:12px 20px; display:flex; gap:8px; align-items:center; overflow-x:auto; }
        .cx-lineup-title { font-size:0.72rem; font-weight:900; letter-spacing:0.1em; text-transform:uppercase; color:#7c7363; flex:none; margin-right:4px; }
        .cx-budget { flex:none; font-size:0.78rem; font-weight:900; padding:4px 10px; border-radius:999px; margin-left:auto; background:${overBudget ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.12)"}; color:${overBudget ? "#fca5a5" : "#86efac"}; border:1px solid ${overBudget ? "rgba(239,68,68,0.4)" : "rgba(34,197,94,0.3)"}; }
        .cx-litem { flex:none; display:flex; align-items:center; gap:7px; background:#1a160f; border:1px solid #2a241a; border-radius:10px; padding:7px 10px; cursor:pointer; }
        .cx-litem.cur { border-color:#fff; background:rgba(255,255,255,0.05); }
        .cx-litem .dot { width:9px; height:9px; border-radius:50%; flex:none; }
        .cx-litem .lbl { font-size:0.82rem; font-weight:800; color:#d8d2c5; white-space:nowrap; }
        .cx-litem .mins { font-size:0.72rem; font-weight:800; color:#7c7363; }
        .cx-ibtn { background:#14110c; border:1px solid #34301f; color:#a39a88; border-radius:6px; width:22px; height:22px; cursor:pointer; font-weight:900; line-height:1; }
        .cx-ibtn:hover { color:#fff; }
        .cx-empty-line { color:#5a5142; font-size:0.86rem; font-weight:700; }

        .cx-bank { border-top:1px solid #2a241a; padding:12px 20px 22px; display:grid; gap:12px; }
        .cx-bank-title { width:100%; font-size:0.72rem; font-weight:900; letter-spacing:0.1em; text-transform:uppercase; color:#7c7363; margin:0 0 2px; }
        .cx-bank-groups { display:grid; gap:12px; }
        .cx-bank-group { display:grid; gap:8px; padding:10px 12px 12px; border:1px solid #261f15; border-radius:12px; background:#16120c; }
        .cx-bank-group-head { display:flex; align-items:baseline; gap:10px; flex-wrap:wrap; }
        .cx-bank-group-title { margin:0; font-size:0.76rem; font-weight:900; letter-spacing:0.1em; text-transform:uppercase; color:#efe9df; }
        .cx-bank-group-hint { color:#7c7363; font-size:0.78rem; font-weight:750; }
        .cx-bank-chip-row { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
        .cx-chip { display:inline-flex; align-items:center; gap:9px; background:#1a160f; border:1px solid #2a241a; border-radius:999px; padding:8px 14px; cursor:pointer; font-weight:800; font-size:0.9rem; color:#d8d2c5; transition:border-color 140ms ease; }
        .cx-chip:hover { border-color:#5a5142; }
        .cx-chip .dot { width:11px; height:11px; border-radius:50%; flex:none; }
        .cx-chip .m { font-size:0.74rem; font-weight:800; color:#7c7363; background:#14110c; border-radius:6px; padding:2px 6px; }
        .cx-min-in { width:44px; background:#14110c; border:1px solid #34301f; color:#fff; border-radius:6px; padding:3px 5px; font-weight:800; font-size:0.8rem; text-align:center; }
        .cx-music-tag { font-size:0.66rem; font-weight:900; color:#fcaf38; }

        .cx-sounds { border-top:1px solid #2a241a; padding:16px 22px 22px; display:grid; gap:12px; background:#15110b; }
        .cx-sounds h3 { margin:0; font-size:0.8rem; font-weight:900; letter-spacing:0.08em; text-transform:uppercase; color:#a39a88; }
        .cx-srow { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
        .cx-slabel { font-size:0.9rem; font-weight:800; color:#d8d2c5; min-width:220px; }
        .cx-supload { font-size:0.8rem; font-weight:800; color:#8ba0f8; background:rgba(78,110,242,0.1); border:1px solid rgba(78,110,242,0.3); border-radius:8px; padding:7px 12px; cursor:pointer; }
        .cx-sset { font-size:0.78rem; font-weight:800; color:#86efac; }
        .cx-sbank { max-height:38vh; overflow-y:auto; display:grid; gap:2px; padding-right:6px; }
        .cx-sname { min-width:220px; font-size:0.9rem; font-weight:800; color:#d8d2c5; background:#0d0b07; border:1px solid #2a241a; border-radius:8px; padding:7px 10px; font-family:inherit; }
        .cx-sname::placeholder { color:#6f6656; font-weight:700; }
        .cx-sname:focus { outline:none; border-color:#8ba0f8; }
        .cx-stest { font-size:0.74rem; font-weight:800; color:#d8d2c5; background:transparent; border:1px solid #3a3226; border-radius:6px; padding:5px 9px; cursor:pointer; }
        .cx-stest:hover { border-color:#5a5040; }
        .cx-sclear { font-size:0.74rem; font-weight:800; color:#fca5a5; background:transparent; border:1px solid rgba(239,68,68,0.3); border-radius:6px; padding:5px 9px; cursor:pointer; }
        .cx-hint { color:#7c7363; font-size:0.82rem; font-weight:600; }

        .cx-lessons-head { display:flex; align-items:center; justify-content:space-between; padding:16px 24px; border-bottom:1px solid #2a241a; position:sticky; top:0; background:#14110c; z-index:2; }
        .cx-lessons-title { margin:0; font-size:1rem; font-weight:900; color:#fff; }
        .cx-lessons-body { max-width:760px; margin:0 auto; padding:20px; display:grid; gap:16px; }
        .cx-lessons-save { border:1px solid #2a241a; border-radius:12px; background:#18140d; padding:14px; display:grid; gap:10px; }
        .cx-lessons-sub { margin:0; font-size:0.74rem; font-weight:900; letter-spacing:0.08em; text-transform:uppercase; color:#a39a88; }
        .cx-lessons-saverow { display:flex; gap:8px; flex-wrap:wrap; }
        .cx-lessons-in { flex:1; min-width:150px; background:#14110c; border:1px solid #34301f; color:#fff; border-radius:8px; padding:10px 12px; font:inherit; font-weight:700; }
        .cx-lessons-msg { margin:0; font-size:0.84rem; font-weight:800; color:#86efac; }
        .cx-lessons-search { width:100%; box-sizing:border-box; background:#14110c; border:1px solid #34301f; color:#fff; border-radius:10px; padding:11px 14px; font:inherit; font-weight:700; }
        .cx-lessons-list { display:grid; gap:10px; }
        .cx-lesson-card { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; border:1px solid #2a241a; border-radius:12px; background:#1a160f; padding:12px 14px; }
        .cx-lesson-meta { display:flex; align-items:baseline; gap:10px; flex-wrap:wrap; }
        .cx-lesson-code { font-weight:900; color:#fff; font-size:1rem; }
        .cx-lesson-name { color:#d8d2c5; font-weight:700; font-size:0.9rem; }
        .cx-lesson-stats { color:#7c7363; font-weight:800; font-size:0.78rem; }
        .cx-lesson-actions { display:flex; gap:8px; align-items:center; }
        .cx-admissions .cx-lessons-body { max-width:860px; }
        .cx-admission-intro { margin:0; color:#b9b09f; font-size:0.92rem; font-weight:700; line-height:1.5; }
        .cx-admission-list { display:grid; gap:10px; }
        .cx-admission-row { display:grid; grid-template-columns:minmax(110px,auto) minmax(230px,1fr) auto; gap:12px; align-items:end; border:1px solid #3a3020; border-radius:12px; background:#1a160f; padding:14px; }
        .cx-admission-code-wrap, .cx-admission-field { display:grid; gap:5px; }
        .cx-admission-label { color:#a39a88; font-size:0.7rem; font-weight:900; letter-spacing:0.09em; text-transform:uppercase; }
        .cx-admission-code { color:#ffd28a; font-size:1.65rem; font-weight:900; letter-spacing:0.13em; line-height:1; font-variant-numeric:tabular-nums; }
        .cx-admission-select { width:100%; min-height:44px; box-sizing:border-box; border:1px solid #4a3d28; border-radius:9px; background:#100d09; color:#fff; padding:10px 12px; font:inherit; font-size:0.9rem; font-weight:800; }
        .cx-admission-select:focus { outline:2px solid #fcaf38; outline-offset:2px; }
        .cx-btn.cx-admission-submit { background:#fcaf38; border-color:#fcaf38; color:#201e1a; }
        .cx-btn.cx-admission-submit:hover { border-color:#ffd28a; filter:brightness(1.04); }
        .cx-admission-error { margin:0; border:1px solid rgba(249,83,53,0.45); border-radius:9px; background:rgba(249,83,53,0.1); color:#fca5a5; padding:10px 12px; font-size:0.84rem; font-weight:800; }
        @media (max-width:640px) { .cx-admission-row { grid-template-columns:1fr; align-items:stretch; } .cx-admission-row .cx-btn { width:100%; } }
      `}</style>

      <div className="cx-root">
        <header className="cx-top">
          <p className="cx-mark">Big Dog Math — Classroom</p>
          <p className="cx-live-status">{liveFlowStatus}</p>
          {autoAdvance ? <span className="cx-conductor-note">Keep this Control window open during automatic pacing.</span> : null}
          {/* Only what he touches while the lesson runs. Everything else moved
              into the setup drawer below - see the Set up toggle. */}
          <div className="cx-tbtns">
            <a className="cx-sbtn cx-home" href="/teacher">Home</a>
            <a className="cx-sbtn" href={teacherSession ? `/session?sessionId=${encodeURIComponent(teacherSession.id)}` : "/session"}>{teacherSession ? "Session" : "Start session"}</a>
            {admissionRequests.length > 0 && (
              <button
                className="cx-sbtn cx-admission-alert"
                onClick={() => setShowAdmissions(true)}
                aria-live="polite"
              >
                {admissionRequests.length} waiting
              </button>
            )}
            {teacherSession && (
              <button className="cx-sbtn cx-end-session" onClick={endTeacherSession} disabled={endingSession}>
                {endingSession ? "Ending session" : "End session"}
              </button>
            )}
            <span className="cx-divider" />
            <button className="cx-sbtn cx-teal" onClick={loadTodayLesson}>Today&apos;s lesson</button>
            <button className={`cx-sbtn${autoAdvance ? " on" : ""}`} onClick={() => setAutoAdvance((v) => !v)}>Pacing {autoAdvance ? "on" : "off"}</button>
            {activeState ? (
              <button
                className={`cx-sbtn cx-setup-toggle${setupVisible ? " on" : ""}`}
                onClick={() => setSetupOpen((value) => !value)}
                aria-expanded={setupVisible}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
                  <path d="M3.5 7.5h9" />
                  <path d="M18.5 7.5h2" />
                  <circle cx="15.5" cy="7.5" r="2.4" />
                  <path d="M3.5 16.5h4" />
                  <path d="M13 16.5h7.5" />
                  <circle cx="10" cy="16.5" r="2.4" />
                </svg>
                {setupVisible ? "Hide set up" : "Set up"}
              </button>
            ) : null}
            <button className="cx-sbtn" onClick={toggleFullscreen}>Full screen</button>
          </div>
        </header>

        {todayMsg && (
          <div
            role="status"
            style={{
              position: "fixed", left: "50%", bottom: "18px", transform: "translateX(-50%)",
              zIndex: 60, maxWidth: "min(720px, 92vw)", background: "var(--bdb-card)", color: "var(--bdb-ink)",
              border: "1px solid var(--bdb-line)", borderLeft: "5px solid var(--bdb-teal-deep)", borderRadius: "12px",
              padding: "12px 16px", fontSize: "0.9rem", fontWeight: 700,
              boxShadow: "0 14px 34px rgba(40,32,20,0.16)",
            }}
          >
            {todayMsg}
          </div>
        )}

        <main className={`cx-main${activeLessonVisual ? " cx-main-visual" : ""}`}>
          {joinCode && (currentIndex === -1 || activeState?.id === "warmup") && (
            <div className="cx-join">
              <span className="cx-join-label">Join code</span>
              <span className="cx-join-code">{joinCode}</span>
            </div>
          )}
          {activeState ? (
            <>
              {activeLessonVisual ? (
                <>
                  <div className="cx-story-head">
                    <div className="cx-story-head-copy">
                      <div className="cx-pos">Step {currentIndex + 1} of {lineup.length}</div>
                      <div className="cx-state">{activeItem?.title || activeState.label}</div>
                    </div>
                    <div className={`cx-story-time ${timerUrgencyClass(clockUrgency)}`}>
                      {inFinal10 ? secondsLeft : fmt(secondsLeft)}
                    </div>
                  </div>
                  <section className="cx-story-stage" aria-label={`${activeItem?.title || activeState.label} story slide`}>
                    <LessonVisual visual={activeLessonVisual} variant="control" accent={accent} />
                  </section>
                </>
              ) : (
                <div className="cx-hero">
                  <div className="cx-pos">Step {currentIndex + 1} of {lineup.length}</div>
                  <div className="cx-state">{activeItem?.title || activeState.label}</div>
                  <div className="cx-desc">{activeItem?.studentDirections || activeState.desc}</div>
                  <div className={`cx-clock ${timerUrgencyClass(clockUrgency)}`}>{inFinal10 ? secondsLeft : fmt(secondsLeft)}</div>
                </div>
              )}
              <div className="cx-progress">
                <div className="cx-progress-fill" style={{ width: `${pct}%`, background: finished ? "var(--bdb-coral)" : inFinal10 ? "var(--bdb-amber)" : accent }} />
              </div>
              <div className={`cx-note ${finished ? "cx-fin" : warnFlash ? "cx-warn" : ""}`}>
                {finished
                  ? (autoAdvance && hasNext ? "Time's up — moving on…" : hasNext ? "Time's up — tap Next" : "Lesson complete!")
                  : warnFlash ? "30 seconds!" : ""}
              </div>
              {activeInteractiveState && (
                <section className="cx-poll" aria-label={`${activeState.label} setup`}>
                  {!controlPoll ? (
                    <>
                      <div className="cx-poll-head">
                        <h2 className="cx-poll-title">{activeInteractiveState === "question" ? "Question setup" : "Live poll setup"}</h2>
                        <span className="cx-poll-note">The timer chimes at 0:00. Tap Show results when the room is ready.</span>
                      </div>
                      <div className="cx-poll-grid">
                        <label className="cx-poll-label" htmlFor="control-poll-kind">Response type</label>
                        <select
                          id="control-poll-kind"
                          className="cx-poll-select"
                          value={pollKind}
                          onChange={(event) => setPollKind(event.target.value as LivePollKind)}
                        >
                          {activeInteractiveState === "question" ? (
                            <>
                              <option value="short-answer">Short answer</option>
                              <option value="multiple-choice">Multiple choice</option>
                              <option value="multiple-choice-explain">Multiple choice + explain</option>
                            </>
                          ) : (
                            <>
                              <option value="fist-to-five">Fist to 5 slider</option>
                              <option value="multiple-choice">Multiple choice</option>
                              <option value="multiple-choice-explain">Multiple choice + explain</option>
                            </>
                          )}
                        </select>
                        <label className="cx-poll-label" htmlFor="control-poll-question">Question</label>
                        <input
                          id="control-poll-question"
                          className="cx-poll-input"
                          value={pollQuestion}
                          onChange={(event) => setPollQuestion(event.target.value)}
                          placeholder={pollKind === "fist-to-five" ? FIST_TO_FIVE_DEFAULT_QUESTION : "Type the question students should answer"}
                        />
                      </div>
                      {isChoicePollKind(pollKind) && (
                        <div className="cx-poll-choices">
                          {pollChoices.map((choice, index) => (
                            <input
                              key={index}
                              className="cx-poll-input"
                              value={choice}
                              onChange={(event) => setPollChoices((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))}
                              placeholder={`Choice ${index + 1}`}
                            />
                          ))}
                        </div>
                      )}
                      {pollError && <div className="cx-poll-error">{pollError}</div>}
                      <div className="cx-actions" style={{ justifyContent: "flex-start" }}>
                        <button className="cx-btn pri" onClick={() => { void openControlPoll(); }}>Open to students</button>
                      </div>
                    </>
                  ) : controlPoll.stage === "responding" ? (
                    <>
                      <div className="cx-poll-head">
                        <h2 className="cx-poll-title">Responses open</h2>
                        <span className="cx-poll-summary">{pollAnswers.length} response{pollAnswers.length === 1 ? "" : "s"}</span>
                      </div>
                      <div className="cx-poll-note">{controlPoll.question}</div>
                      <div className="cx-poll-note">Students see results when the timer ends. Use “Show results” to end early.</div>
                    </>
                  ) : (
                    <>
                      <div className="cx-poll-head">
                        <h2 className="cx-poll-title">Results</h2>
                        <span className="cx-poll-summary">{pollAnswers.length} response{pollAnswers.length === 1 ? "" : "s"}</span>
                      </div>
                      <div className="cx-poll-note">{controlPoll.question}</div>
                      {controlPoll.kind === "structured-numeric" ? (
                        /* A choice tally would render an EMPTY box here: a
                           structured step has no authored choices. The teacher
                           gets the diagnosis grouped by error instead. */
                        structuredNumericSummary ? (
                          <div className="cx-poll-answers">
                            <span className="cx-poll-note">
                              {structuredNumericSummary.correct} of {structuredNumericSummary.total} correct
                            </span>
                            {structuredNumericSummary.reteachPhrase ? (
                              <span className="cx-poll-answer">
                                Stop and reteach - most of the class shows &ldquo;{structuredNumericSummary.reteachPhrase}&rdquo;
                              </span>
                            ) : null}
                            {structuredNumericSummary.groups.map((group) => (
                              <span className="cx-poll-answer" key={group.phrase}>
                                {group.tierLabel} · {group.phrase} ({group.students.length}):{" "}
                                {group.students.map((student) => student.name).join(", ")}
                              </span>
                            ))}
                            {structuredNumericSummary.splits.share > 0.8 && structuredNumericSummary.splits.total > 2 ? (
                              <span className="cx-poll-note">
                                Nearly every student split {structuredNumericSummary.splits.topKey} - flexibility has not landed yet.
                              </span>
                            ) : null}
                            {structuredNumericSummary.total === 0 ? <span className="cx-poll-note">No responses yet.</span> : null}
                          </div>
                        ) : (
                          <div className="cx-poll-note">
                            This step&rsquo;s answer spec will not parse, so responses cannot be diagnosed. Fix Correct Answer in Notion.
                          </div>
                        )
                      ) : controlPoll.kind === "short-answer" ? (
                        <div className="cx-poll-answers">
                          {pollAnswers.length === 0
                            ? <span className="cx-poll-note">No responses yet.</span>
                            : pollAnswers.map((answer) => <span className="cx-poll-answer" key={answer.id}>{answer.display_name || "Student"}: {answer.answer || "—"}</span>)}
                        </div>
                      ) : (
                        <div className="cx-poll-results">
                          {(controlPoll.choices || []).map((choice) => {
                            const count = pollAnswers.filter((answer) => answer.answer === choice).length;
                            const percent = pollAnswers.length ? Math.round((count / pollAnswers.length) * 100) : 0;
                            return (
                              <div className="cx-poll-result" key={choice}>
                                <span>{controlPoll.kind === "fist-to-five" ? `${choice} / 5` : choice}</span>
                                <div className="cx-poll-bar"><div className="cx-poll-fill" style={{ width: `${percent}%` }} /></div>
                                <span>{count}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <div className="cx-actions" style={{ justifyContent: "flex-start" }}>
                        <button className="cx-btn" onClick={prepareAnotherPoll}>New {activeInteractiveState === "question" ? "question" : "poll"}</button>
                      </div>
                    </>
                  )}
                </section>
              )}
              {activeToolState && (
                <section className="cx-tool" aria-label={`${activeState.label} student setup`}>
                  <div className="cx-tool-head">
                    <h2 className="cx-tool-title">{TOOL_STATE_INFO[activeToolState].label} setup</h2>
                    <span className="cx-tool-note">This publishes the problem to the current Live Class Flow session and sends Chromebooks to the tool.</span>
                  </div>
                  <div className="cx-tool-grid">
                    <label className="cx-tool-field wide" htmlFor="tool-prompt">
                      Student directions or problem
                      <input
                        id="tool-prompt"
                        className="cx-tool-input"
                        value={toolSetup.prompt}
                        onChange={(event) => updateToolSetup("prompt", event.target.value)}
                        placeholder="What should students model, solve, or explain?"
                      />
                    </label>

                    {activeToolState === "tool-number-line" && (
                      <>
                        <label className="cx-tool-field" htmlFor="number-line-start">Start at
                          <input id="number-line-start" className="cx-tool-input" inputMode="decimal" value={toolSetup.numberLineStart} onChange={(event) => updateToolSetup("numberLineStart", event.target.value)} />
                        </label>
                        <label className="cx-tool-field" htmlFor="number-line-change">Change by
                          <input id="number-line-change" className="cx-tool-input" inputMode="decimal" value={toolSetup.numberLineChange} onChange={(event) => updateToolSetup("numberLineChange", event.target.value)} />
                        </label>
                        <label className="cx-tool-field wide" htmlFor="number-line-fractions">
                          Fractions to order on a 0 to 5 line (semicolon starts another round)
                          <input id="number-line-fractions" className="cx-tool-input" value={toolSetup.numberLineFractionSet} onChange={(event) => updateToolSetup("numberLineFractionSet", event.target.value)} placeholder="1/2, 7/3, 2 1/4, 3" />
                          <span className="cx-tool-hint">
                            {(() => {
                              const rounds = parseFractionRounds(toolSetup.numberLineFractionSet);
                              if (!rounds.length) return "Leave blank for the hop problem above. Cards may be fractions, mixed numbers, decimals, or percents.";
                              return `${rounds.length} round${rounds.length === 1 ? "" : "s"}: ${rounds.map((r) => r.map((c) => c.text).join(" ")).join(" | ")}`;
                            })()}
                          </span>
                        </label>
                      </>
                    )}

                    {activeToolState === "tool-percent-bar" && (
                      <>
                        <label className="cx-tool-field" htmlFor="percent-whole">Whole
                          <input id="percent-whole" className="cx-tool-input" inputMode="decimal" value={toolSetup.percentWhole} onChange={(event) => updateToolSetup("percentWhole", event.target.value)} />
                        </label>
                        <label className="cx-tool-field" htmlFor="percent-value">Percent
                          <input id="percent-value" className="cx-tool-input" inputMode="decimal" value={toolSetup.percentValue} onChange={(event) => updateToolSetup("percentValue", event.target.value)} />
                        </label>
                        <label className="cx-tool-field" htmlFor="percent-part">Part
                          <input id="percent-part" className="cx-tool-input" inputMode="decimal" value={toolSetup.percentPart} onChange={(event) => updateToolSetup("percentPart", event.target.value)} />
                        </label>
                        <label className="cx-tool-field" htmlFor="percent-unknown">Students solve for
                          <select id="percent-unknown" className="cx-tool-select" value={toolSetup.percentUnknown} onChange={(event) => updateToolSetup("percentUnknown", event.target.value as ToolSetupValues["percentUnknown"])}>
                            <option value="part">the part</option>
                            <option value="whole">the whole</option>
                            <option value="percent">the percent</option>
                          </select>
                        </label>
                      </>
                    )}

                    {activeToolState === "tool-equation-builder" && (
                      <>
                        <label className="cx-tool-field" htmlFor="equation-coefficient">x coefficient
                          <input id="equation-coefficient" className="cx-tool-input" inputMode="decimal" value={toolSetup.equationCoefficient} onChange={(event) => updateToolSetup("equationCoefficient", event.target.value)} />
                        </label>
                        <label className="cx-tool-field" htmlFor="equation-constant">Constant
                          <input id="equation-constant" className="cx-tool-input" inputMode="decimal" value={toolSetup.equationConstant} onChange={(event) => updateToolSetup("equationConstant", event.target.value)} />
                        </label>
                        <label className="cx-tool-field" htmlFor="equation-solution">Solution for x
                          <input id="equation-solution" className="cx-tool-input" inputMode="decimal" value={toolSetup.equationSolution} onChange={(event) => updateToolSetup("equationSolution", event.target.value)} />
                        </label>
                      </>
                    )}

                    {activeToolState === "tool-gems" && (
                      <label className="cx-tool-field wide" htmlFor="gems-expression">
                        Expression (use +, -, ×, ÷, ^, and parentheses)
                        <input id="gems-expression" className="cx-tool-input" value={toolSetup.gemsExpression} onChange={(event) => updateToolSetup("gemsExpression", event.target.value)} placeholder="4 × (2 + 3) − 6" />
                      </label>
                    )}

                    {activeToolState === "tool-algebra-tiles" && (
                      <label className="cx-tool-field wide" htmlFor="algebra-expression">
                        Expression or equation
                        <input id="algebra-expression" className="cx-tool-input" value={toolSetup.algebraExpression} onChange={(event) => updateToolSetup("algebraExpression", event.target.value)} placeholder="2x + 3 = 11" />
                      </label>
                    )}

                    {activeToolState === "tool-distributive-area" && (
                      <label className="cx-tool-field wide" htmlFor="distributive-set">
                        Problem series (first number is the one they split)
                        <input id="distributive-set" className="cx-tool-input" value={toolSetup.distributiveSet} onChange={(event) => updateToolSetup("distributiveSet", event.target.value)} placeholder="14x6, 18x5, 24x7" />
                        <span className="cx-tool-hint">
                          {(() => {
                            const set = parseDistributiveSet(toolSetup.distributiveSet);
                            if (!set.length) return "Leave blank to let students pick their own numbers.";
                            return `${set.length} problem${set.length === 1 ? "" : "s"}: ${set.map((p) => `${p.top} x ${p.side} = ${p.top * p.side}`).join(", ")}`;
                          })()}
                        </span>
                      </label>
                    )}

                    {activeToolState === "tool-decimal-steps" && (
                      <label className="cx-tool-field wide" htmlFor="decimal-set">
                        Decimal problems, any of the four operations
                        <input id="decimal-set" className="cx-tool-input" value={toolSetup.decimalSet} onChange={(event) => updateToolSetup("decimalSet", event.target.value)} placeholder="12.4 + 3.75, 8.3 - 4.68, 6.2 x 0.4, 9.6 / 0.4" />
                        <span className="cx-tool-hint">
                          {(() => {
                            const { problems, rejected } = parseDecimalSet(toolSetup.decimalSet);
                            const bad = rejected.length ? ` Skipped: ${rejected.map((r) => `${r.text} (${r.reason})`).join("; ")}.` : "";
                            if (!problems.length) return `Leave blank for one of each operation.${bad}`;
                            return `${problems.length} problem${problems.length === 1 ? "" : "s"}.${bad}`;
                          })()}
                        </span>
                      </label>
                    )}

                    {activeToolState === "tool-division-house" && (
                      <label className="cx-tool-field wide" htmlFor="house-set">
                        Division problems, whole numbers
                        <input id="house-set" className="cx-tool-input" value={toolSetup.houseSet} onChange={(event) => updateToolSetup("houseSet", event.target.value)} placeholder="96/4, 738/6, 875/4" />
                        <span className="cx-tool-hint">
                          {(() => {
                            const { problems, rejected } = parseHouseSet(toolSetup.houseSet);
                            const bad = rejected.length ? ` Skipped: ${rejected.map((r) => `${r.text} (${r.reason})`).join("; ")}.` : "";
                            if (!problems.length) return `Leave blank for the built-in four.${bad}`;
                            return `${problems.length} problem${problems.length === 1 ? "" : "s"}.${bad}`;
                          })()}
                        </span>
                      </label>
                    )}

                    {activeToolState === "tool-ladder" && (
                      <label className="cx-tool-field wide" htmlFor="ladder-tree-set">
                        Factor Trees number sequence (students get them one at a time)
                        <input id="ladder-tree-set" className="cx-tool-input" value={toolSetup.ladderTreeSet} onChange={(event) => updateToolSetup("ladderTreeSet", event.target.value)} placeholder="24, 36, 60" />
                        <span className="cx-tool-hint">
                          {(() => {
                            const seq = parseFactorTreeSet(toolSetup.ladderTreeSet);
                            if (!seq.length) return "Leave blank for the tool's built-in sequence. Publishing a sequence opens the tool in Factor Trees mode.";
                            return `${seq.length} number${seq.length === 1 ? "" : "s"}: ${seq.join(", ")}`;
                          })()}
                        </span>
                        <label className="cx-tool-check" htmlFor="ladder-both-modes">
                          <input
                            id="ladder-both-modes"
                            type="checkbox"
                            checked={toolSetup.ladderBothModes}
                            onChange={(event) => updateToolSetup("ladderBothModes", event.target.checked)}
                          />
                          Let students switch to the Ladder
                        </label>
                        <span className="cx-tool-hint">
                          {toolSetup.ladderBothModes
                            ? "Both modes stay tappable. Use this on the day the Ladder is the point, or to demo the two side by side."
                            : "Off: publishing a sequence locks the tool to Factor Trees and hides the mode toggle, so the Ladder is not one tap away on prime-factorization day."}
                        </span>
                      </label>
                    )}

                    {activeToolState === "tool-game" && (
                      <>
                        <label className="cx-tool-field" htmlFor="game-skill">Game
                          <select id="game-skill" className="cx-tool-select" value={toolSetup.gameSkill} onChange={(event) => { updateToolSetup("gameSkill", event.target.value); updateToolSetup("gameLevel", "1"); }}>
                            {SKILLS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                          </select>
                        </label>
                        <label className="cx-tool-field" htmlFor="game-level">Level
                          <select id="game-level" className="cx-tool-select" value={toolSetup.gameLevel} onChange={(event) => updateToolSetup("gameLevel", event.target.value)}>
                            {(SKILLS.find((s) => s.key === toolSetup.gameSkill) || SKILLS[0]).levels.map((lvl, i) => (
                              <option key={i} value={String(i + 1)}>{i + 1}. {lvl}</option>
                            ))}
                          </select>
                        </label>
                        <label className="cx-tool-field" htmlFor="game-duration">Length
                          <select id="game-duration" className="cx-tool-select" value={toolSetup.gameDuration} onChange={(event) => updateToolSetup("gameDuration", event.target.value)}>
                            <option value="120">2 min</option>
                            <option value="180">3 min</option>
                            <option value="300">5 min</option>
                          </select>
                        </label>
                      </>
                    )}

                    {activeToolState === "tool-exit-ticket" && (
                      <>
                        <label className="cx-tool-field wide" htmlFor="exit-prompt">Exit-ticket question
                          <input id="exit-prompt" className="cx-tool-input" value={toolSetup.exitPrompt} onChange={(event) => updateToolSetup("exitPrompt", event.target.value)} placeholder="Solve 3x + 4 = 19, then explain your first step." />
                        </label>
                        <label className="cx-tool-field" htmlFor="exit-kind">Answer type
                          <select id="exit-kind" className="cx-tool-select" value={toolSetup.exitKind} onChange={(event) => updateToolSetup("exitKind", event.target.value as ExitKind)}>
                            <option value="short-answer">Short answer</option>
                            <option value="multiple-choice">Multiple choice</option>
                            <option value="fist-to-five">Fist to five (0–5)</option>
                          </select>
                        </label>
                        {toolSetup.exitKind === "multiple-choice" && (
                          <label className="cx-tool-field wide" htmlFor="exit-choices">Choices (comma-separated)
                            <input id="exit-choices" className="cx-tool-input" value={toolSetup.exitChoices} onChange={(event) => updateToolSetup("exitChoices", event.target.value)} placeholder="Yes, No, Not sure" />
                          </label>
                        )}
                      </>
                    )}

                    {activeToolState === "tool-checkpoint" && (() => {
                      const cp = getCheckpoint(toolSetup.checkpointId) || SBAC_CHECKPOINTS[0];
                      const items = cp.items.map((it, i) => ({ it, i }));
                      const digital = items.filter((x) => x.it.digital);
                      const choices = digital.length ? digital : items;
                      const idx = Math.max(0, Math.min(cp.items.length - 1, Math.round(Number(toolSetup.checkpointItem) || 0)));
                      const sel = cp.items[idx];
                      return (
                        <>
                          <label className="cx-tool-field wide" htmlFor="cp-pick">Checkpoint (standard set)
                            <select id="cp-pick" className="cx-tool-select" value={toolSetup.checkpointId} onChange={(event) => {
                              updateToolSetup("checkpointId", event.target.value);
                              const ncp = getCheckpoint(event.target.value);
                              const first = ncp ? ncp.items.findIndex((it) => it.digital) : 0;
                              updateToolSetup("checkpointItem", String(first < 0 ? 0 : first));
                            }}>
                              {SBAC_CHECKPOINTS.map((c) => <option key={c.id} value={c.id}>{c.id} · {c.covers}</option>)}
                            </select>
                          </label>
                          <label className="cx-tool-field wide" htmlFor="cp-item">Question (auto-graded)
                            <select id="cp-item" className="cx-tool-select" value={toolSetup.checkpointItem} onChange={(event) => updateToolSetup("checkpointItem", event.target.value)}>
                              {choices.map(({ it, i }) => <option key={i} value={String(i)}>{it.ccss} — {it.q.length > 64 ? it.q.slice(0, 64) + "…" : it.q}</option>)}
                            </select>
                          </label>
                          {sel && <div className="cx-tool-key">Answer key: {sel.a}{sel.digital ? "" : "  ·  (paper item — grade by eye)"}</div>}
                        </>
                      );
                    })()}
                  </div>
                  {toolError && <div className="cx-poll-error">{toolError}</div>}
                  {publishedTool?.stateId === activeToolState && (
                    <div className="cx-tool-status">
                      {activeToolState === "tool-game"
                        ? "The live game is running — leaderboard is below."
                        : activeToolState === "tool-exit-ticket"
                          ? "Exit ticket sent - responses are saving. Review them under Practice, then Exit tickets."
                          : activeToolState === "tool-checkpoint"
                            ? "Checkpoint sent — auto-graded answers are saving. Review under Checkpoints."
                            : "Student screens are on this configured tool."}
                    </div>
                  )}
                  {activeToolState === "tool-game" && publishedTool?.stateId === activeToolState && (
                    <div className="cx-leader" aria-label="Live game leaderboard">
                      <span className="cx-leader-title">Live Leaderboard</span>
                      {liveChallengeBoard.length === 0 ? (
                        <span className="cx-tool-note">Waiting for scored answers.</span>
                      ) : (
                        liveChallengeBoard.slice(0, 8).map((row, index) => (
                          <div className="cx-leader-row" key={row.key}>
                            <span className="cx-leader-rank">{index + 1}</span>
                            <span className="cx-leader-name">{row.name}</span>
                            <span className="cx-leader-acc">{row.correct}/{row.total}</span>
                            <span className="cx-leader-points">{row.points}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                  <div className="cx-actions" style={{ justifyContent: "flex-start" }}>
                    <button className="cx-btn pri" onClick={publishToolSetup}>
                      {activeToolState === "tool-game"
                        ? (publishedTool?.stateId === activeToolState ? "Relaunch game" : "Launch game")
                        : activeToolState === "tool-exit-ticket"
                          ? (publishedTool?.stateId === activeToolState ? "Re-send exit ticket" : "Send exit ticket")
                          : activeToolState === "tool-checkpoint"
                            ? (publishedTool?.stateId === activeToolState ? "Re-send checkpoint" : "Send checkpoint")
                            : (publishedTool?.stateId === activeToolState ? "Update student screens" : "Send tool setup to students")}
                    </button>
                  </div>
                </section>
              )}
              {/* Transport. The three moves he makes constantly stay full weight;
                  the clock adjustments and Stop pacing drop back to quiet chips
                  so the row reads as one decision instead of eight. */}
              <div className="cx-actions cx-transport">
                <button
                  className="cx-btn pri"
                  onClick={running ? toggleRun : runSequence}
                  disabled={!running && Boolean(activeLessonCriterionValidationMessage)}
                  title={!running ? activeLessonCriterionValidationMessage || undefined : undefined}
                >
                  {running ? "Pause" : activeLessonCriterionValidationMessage ? "Fix success criterion" : autoAdvance ? "Resume" : "Start lesson"}
                </button>
                <button className="cx-btn" onClick={previous} disabled={currentIndex <= 0}>Back</button>
                <button className="cx-btn next" onClick={() => { void next(); }} disabled={controlPoll?.stage !== "responding" && currentIndex + 1 >= lineup.length}>{controlPoll?.stage === "responding" ? "Show results" : "Next state"}</button>
                {finished && activeState.id === "warmup" && (
                  <button className="cx-btn cx-amber" onClick={() => setShowSpinner(true)}>Pick readers</button>
                )}
                {activeUsesDiscussionProtocol && (
                  <button className="cx-btn cx-teal" onClick={() => setShowDiscussion(true)}>Run discussion</button>
                )}
                <span className="cx-actions-sep" />
                <button className="cx-btn quiet" onClick={stopSequence}>Stop pacing</button>
                <button className="cx-btn quiet" onClick={reset}>Reset state</button>
                <button className="cx-btn quiet" onClick={() => adjust(60)}>+1 min</button>
                <button className="cx-btn quiet" onClick={() => adjust(-60)} disabled={secondsLeft < 60}>−1 min</button>
                <button className="cx-btn quiet" onClick={() => adjust(30)}>+30s</button>
              </div>
              {hasNext
                ? <div className="cx-upnext">Up next: <strong>{nextLabel}</strong></div>
                : <div className="cx-upnext">Last step of the lesson</div>}
              {paceFinishClock ? (
                <div className="cx-pace">
                  Plan left: <strong>{Math.max(1, Math.round(paceSecondsLeft / 60))} min</strong>
                  {" · "}finish about <strong>{paceFinishClock}</strong> at planned pace
                </div>
              ) : null}
            </>
          ) : (
            <div style={{ display: "grid", justifyItems: "center", gap: 14 }}>
              <p className="cx-note cx-idle">
                Build today&apos;s lineup: tap states in the bank below to add them, then run the sequence.
                Hit “Sounds” to upload your warm-up music and cue sounds.
              </p>
              {lineup.length > 0 && <button className="cx-btn pri" onClick={runSequence}>Start sequence</button>}
            </div>
          )}
        </main>

        {/* Setup drawer: everything that belongs to building a day rather than
            running one. Page state lives in the component, not the JSX, so
            unmounting these panels cannot lose toolSetup, showSounds or a
            half-typed lesson code. */}
        {setupVisible && (
          <section className="cx-setup" aria-label="Lesson setup">
          <div className="cx-setup-head">
            <h2 className="cx-setup-title">Set up</h2>
            <span className="cx-setup-hint">Lineup, cue sounds and the state bank. Nothing here is needed once the lesson is running.</span>
            <div className="cx-setup-tools">
              {teacherSession ? <a className="cx-sbtn" href={`/session?sessionId=${encodeURIComponent(teacherSession.id)}#classroom-screens-title`}>Set up screens</a> : null}
              <button className="cx-sbtn" onClick={() => { setShowLessons(true); setLessonMsg(null); }}>Lessons</button>
              <button className="cx-sbtn" onClick={() => setShowSpinner(true)}>Spinner</button>
              <a className="cx-sbtn" href="/session#challenge">Games</a>
              <a className="cx-sbtn" href="/roster">Rosters</a>
              <button className={`cx-sbtn${showSounds ? " on" : ""}`} onClick={() => setShowSounds((v) => !v)}>Sounds</button>
              <button className={`cx-sbtn${editing ? " on" : ""}`} onClick={() => setEditing((v) => !v)}>{editing ? "Done" : "Edit times"}</button>
              {activeState ? <button className="cx-sbtn" onClick={() => setSetupOpen(false)}>Close</button> : null}
            </div>
          </div>

          {/* Lineup */}
          <section className="cx-lineup">
            <span className="cx-lineup-title">Today</span>
            {lineup.length === 0 && <span className="cx-empty-line">empty - add states from the bank below</span>}
            {lineup.map((it, i) => {
              const st = bank.find((s) => s.id === it.stateId);
              if (!st) return null;
              return (
                <div key={it.uid} className={`cx-litem${i === currentIndex ? " cur" : ""}`} onClick={() => loadIndex(i)}>
                  <span className="dot" style={{ background: st.color }} />
                  <span className="lbl">{it.title || st.label}</span>
                  <span className="mins">{minutesForLineupItem(it, bank)}m</span>
                  <button className="cx-ibtn" onClick={(e) => { e.stopPropagation(); moveItem(it.uid, -1); }} title="Move left">‹</button>
                  <button className="cx-ibtn" onClick={(e) => { e.stopPropagation(); moveItem(it.uid, 1); }} title="Move right">›</button>
                  <button className="cx-ibtn" onClick={(e) => { e.stopPropagation(); removeFromLineup(it.uid); }} title="Remove">×</button>
                </div>
              );
            })}
            <span className="cx-budget">{totalMin} / {PERIOD_MIN} min{overBudget ? " over" : ""}</span>
          </section>

          {/* Sound setup */}
          {showSounds && (
            <section className="cx-sounds">
              <h3>Cue sounds — used by every timer (remembered on this computer)</h3>
              {(["warn30", "tick", "end"] as CueKey[]).map((key) => {
                const has = !!soundUrls[key];
                return (
                  <div className="cx-srow" key={key}>
                    <span className="cx-slabel">{CUE_LABELS[key]}</span>
                    <label className="cx-supload">
                      {has ? "Replace file" : "Upload file"}
                      <input type="file" accept="audio/*" style={{ display: "none" }}
                        onChange={(e) => uploadSound(key, e.target.files?.[0])} />
                    </label>
                    {has && <span className="cx-sset">loaded</span>}
                    {has && <button className="cx-sclear" onClick={() => clearSound(key)}>Remove</button>}
                    {!has && <span className="cx-hint">no file — uses built-in beep</span>}
                  </div>
                );
              })}

              <h3 style={{ marginTop: 6 }}>Music per state — loops while that state runs, stops at zero</h3>
              {bank.map((s) => {
                const storageKey = `music:${s.id}`;
                const has = !!soundUrls[storageKey];
                return (
                  <div className="cx-srow" key={s.id}>
                    <span className="cx-slabel">
                      <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: s.color, marginRight: 8 }} />
                      {s.label}
                    </span>
                    <label className="cx-supload">
                      {has ? "Replace music" : "Upload music"}
                      <input type="file" accept="audio/*" style={{ display: "none" }}
                        onChange={(e) => uploadSound(storageKey, e.target.files?.[0])} />
                    </label>
                    {has && <span className="cx-sset">loaded</span>}
                    {has && <button className="cx-sclear" onClick={() => clearSound(storageKey)}>Remove</button>}
                    {!has && <span className="cx-hint">no music</span>}
                  </div>
                );
              })}
              <h3 style={{ marginTop: 6 }}>Sound bank — the buttons on the iPad Remote</h3>
              <p className="cx-hint">
                Load your own clip onto any button. It plays from this computer&apos;s speakers when
                you tap the button on the iPad. Rename a button and the iPad shows the new name.
                With nothing loaded each button still works — it uses
                the built-in effect, so a button is never silent.
              </p>
              <div className="cx-srow">
                <label className="cx-supload">
                  Load a whole folder at once
                  <input type="file" accept="audio/*" multiple style={{ display: "none" }}
                    onChange={(e) => loadSoundBankFolder(e.target.files)} />
                </label>
                <span className="cx-hint">Each file goes to the button its name matches.</span>
              </div>
              {soundBankError && <p className="cx-hint" style={{ color: "#f9a58f" }}>{soundBankError}</p>}
              <div className="cx-sbank">
              {SOUND_CUES.map((cue) => {
                const storageKey = bankClipKey(cue.id);
                const has = !!soundUrls[storageKey];
                return (
                  <div className="cx-srow" key={cue.id}>
                    {/* The name travels to the iPad, where the button actually
                        gets pressed. Blank it to go back to the built-in name. */}
                    <input
                      className="cx-sname"
                      value={soundLabelFor(cue.id, "", soundLabels)}
                      placeholder={cue.label}
                      maxLength={MAX_SOUND_LABEL}
                      aria-label={`Name for the ${cue.label} button`}
                      onChange={(e) => renameSoundCue(cue.id, e.target.value)}
                    />
                    <label className="cx-supload">
                      {has ? "Replace clip" : "Load clip"}
                      <input type="file" accept="audio/*" style={{ display: "none" }}
                        onChange={(e) => uploadSound(storageKey, e.target.files?.[0])} />
                    </label>
                    <button className="cx-stest" onClick={() => playSoundCue(cue.id, audioCtxRef.current)}>Test</button>
                    {has && <span className="cx-sset">your clip</span>}
                    {has && <button className="cx-sclear" onClick={() => clearSound(storageKey)}>Remove</button>}
                    {!has && <span className="cx-hint">{cue.detail}</span>}
                  </div>
                );
              })}
              </div>

              <p className="cx-hint">Tip: your Stream Deck still works alongside this — use either.</p>
            </section>
          )}

          {/* Bank */}
          <section className="cx-bank">
            <p className="cx-bank-title">Bank — tap to add to today&apos;s lineup{editing ? " · set default minutes" : ""}</p>
            <div className="cx-bank-groups">
              {groupedBankSections.map((group) => (
                <div className="cx-bank-group" key={group.id}>
                  <div className="cx-bank-group-head">
                    <h2 className="cx-bank-group-title">{group.label}</h2>
                    <span className="cx-bank-group-hint">{group.hint}</span>
                  </div>
                  <div className="cx-bank-chip-row">
                    {group.states.map(renderBankChip)}
                  </div>
                </div>
              ))}
              {ungroupedBankStates.length > 0 && (
                <div className="cx-bank-group">
                  <div className="cx-bank-group-head">
                    <h2 className="cx-bank-group-title">Other</h2>
                    <span className="cx-bank-group-hint">Additional saved states</span>
                  </div>
                  <div className="cx-bank-chip-row">
                    {ungroupedBankStates.map(renderBankChip)}
                  </div>
                </div>
              )}
            </div>
          </section>
          </section>
        )}

        {showAdmissions && (
          <div
            className="cx-overlay cx-admissions"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cx-admissions-title"
          >
            <div className="cx-lessons-head">
              <h2 className="cx-lessons-title" id="cx-admissions-title">Students waiting</h2>
              <button className="cx-sbtn" onClick={() => setShowAdmissions(false)}>Close</button>
            </div>
            <div className="cx-lessons-body">
              <p className="cx-admission-intro">Match the code on the Chromebook, choose the student, then admit them.</p>
              {admissionError && <p className="cx-admission-error" role="alert">{admissionError}</p>}
              <div className="cx-admission-list">
                {admissionRequests.map((request) => {
                  const availableRoster = admissionRoster.filter((student) =>
                    !admissionJoinedStudentIds.includes(student.id),
                  );
                  const isAdmitting = admittingRequestCode === request.requestCode;
                  return (
                    <div className="cx-admission-row" key={request.id}>
                      <div className="cx-admission-code-wrap">
                        <span className="cx-admission-label">Chromebook code</span>
                        <strong className="cx-admission-code">{request.requestCode}</strong>
                      </div>
                      <label className="cx-admission-field">
                        <span className="cx-admission-label">Student</span>
                        <select
                          className="cx-admission-select"
                          value={admissionSelections[request.id] || ""}
                          onChange={(event) => setAdmissionSelections((current) => ({
                            ...current,
                            [request.id]: event.target.value,
                          }))}
                          disabled={availableRoster.length === 0 || Boolean(admittingRequestCode)}
                        >
                          <option value="">{availableRoster.length ? "Choose a student" : "No unjoined students available"}</option>
                          {availableRoster.map((student) => (
                            <option value={student.id} key={student.id}>
                              {student.alias || "Unnamed student"}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="cx-btn cx-admission-submit"
                        onClick={() => { void admitWaitingStudent(request); }}
                        disabled={!admissionSelections[request.id] || Boolean(admittingRequestCode)}
                      >
                        {isAdmitting ? "Admitting" : "Admit"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {showLessons && (
          <div className="cx-overlay cx-lessons">
            <div className="cx-lessons-head">
              <h2 className="cx-lessons-title">Lesson Library</h2>
              <button className="cx-sbtn" onClick={() => setShowLessons(false)}>Close</button>
            </div>
            <div className="cx-lessons-body">
              <div className="cx-lessons-save">
                <p className="cx-lessons-sub">Load any Notion lesson by code</p>
                <div className="cx-lessons-saverow">
                  <input
                    className="cx-lessons-in"
                    placeholder="Lesson code (e.g. M2.T1.L1-D1)"
                    value={notionLessonCode}
                    onChange={(event) => setNotionLessonCode(event.target.value)}
                    onKeyDown={(event) => { if (event.key === "Enter") void loadNotionLessonByCode(); }}
                  />
                  <button className="cx-btn pri" onClick={() => { void loadNotionLessonByCode(); }}>Load from Notion</button>
                </div>
                <p className="cx-hint">Loads a published Notion lesson and stages its warm-up for the open session. Instructional and projector screens do not change until you start it.</p>
                {lessonMsg && <p className="cx-lessons-msg">{lessonMsg}</p>}
              </div>

              <div className="cx-lessons-save">
                <p className="cx-lessons-sub">Or pick one from Notion</p>
                <input
                  className="cx-lessons-search"
                  placeholder="Search every published lesson by code, title, or date…"
                  value={notionSearch}
                  onChange={(event) => setNotionSearch(event.target.value)}
                />
                <p className="cx-hint">Any published lesson loads here, on any date. The Date property still decides which lesson opens automatically.</p>
                {notionArchiveError && <p className="cx-lessons-msg">{notionArchiveError}</p>}
                <div className="cx-lessons-list">
                  {!notionArchive.length && !notionArchiveError ? (
                    <p className="cx-hint">Reading the lesson archive…</p>
                  ) : filteredNotionArchive.length === 0 ? (
                    <p className="cx-hint">No published lesson matches that search.</p>
                  ) : (
                    filteredNotionArchive.map((item) => (
                      <div className="cx-lesson-card" key={item.id}>
                        <div className="cx-lesson-meta">
                          <span className="cx-lesson-code">{item.lessonCode || "No code"}</span>
                          {item.title && <span className="cx-lesson-name">{item.title}</span>}
                          {item.date && <span className="cx-lesson-stats">{item.date.slice(0, 10)}</span>}
                        </div>
                        <div className="cx-lesson-actions">
                          <button
                            className="cx-btn next"
                            onClick={() => { void loadNotionLesson(item.lessonCode, { lessonId: item.id }); }}
                          >
                            Load
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="cx-lessons-save">
                <p className="cx-lessons-sub">Save the current sequence as a lesson</p>
                <div className="cx-lessons-saverow">
                  <input className="cx-lessons-in" placeholder="Code (e.g. M1.T1.L1)" value={saveCode} onChange={(e) => setSaveCode(e.target.value)} />
                  <input className="cx-lessons-in" placeholder="Title (optional)" value={saveTitle} onChange={(e) => setSaveTitle(e.target.value)} />
                  <button className="cx-btn pri" onClick={saveCurrentLesson}>Save</button>
                </div>
              </div>

              <input className="cx-lessons-search" placeholder="Search by code or title…" value={presetSearch} onChange={(e) => setPresetSearch(e.target.value)} />

              <div className="cx-lessons-list">
                {filteredPresets.length === 0 ? (
                  <p className="cx-hint">No saved lessons yet. Build a sequence in the bank below, then save it above.</p>
                ) : (
                  filteredPresets.map((p) => {
                    const total = p.lineup.reduce((sum, s) => sum + (typeof p.minutes[s.stateId] === "number" ? p.minutes[s.stateId] : 0), 0);
                    return (
                      <div className="cx-lesson-card" key={p.id}>
                        <div className="cx-lesson-meta">
                          <span className="cx-lesson-code">{p.code || "Untitled"}</span>
                          {p.title && <span className="cx-lesson-name">{p.title}</span>}
                          <span className="cx-lesson-stats">{p.lineup.length} steps · {total} min</span>
                        </div>
                        <div className="cx-lesson-actions">
                          <button className="cx-btn next" onClick={() => loadPreset(p)}>Load</button>
                          <button className="cx-sclear" onClick={() => removePreset(p.id)}>Delete</button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {showSpinner && (
          <div className="cx-overlay"><StudentSpinner onClose={() => setShowSpinner(false)} /></div>
        )}
        {showDiscussion && (
          <div className="cx-overlay">
            <DiscussionProtocol
              onClose={closeDiscussion}
              onFlowChange={handleDiscussionFlowChange}
              onComplete={completeDiscussion}
              automaticPacing={autoAdvance}
              initialFlow={discussionFlow}
              remoteCommand={discussionRemoteCommand}
              onRemoteCommandHandled={handleDiscussionRemoteCommand}
              onPreviousState={() => { closeDiscussion(); previous(); }}
            />
          </div>
        )}
      </div>
    </>
  );
}
