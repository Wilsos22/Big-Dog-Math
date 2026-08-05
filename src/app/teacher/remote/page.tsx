"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import VisitListPanel from "@/components/VisitListPanel";
import LiveScreenPreview from "@/components/LiveScreenPreview";
import SupplyCheckBoard from "@/components/SupplyCheckBoard";
import {
  REMOTE_COMMAND_STALE_MS,
  canRevealM2T1L1FinalScore,
  liveTimerSeconds,
  resolveRemoteNextBehavior,
  shouldRunFlowNavigationDestination,
  type LiveClassFlowSnapshot,
  type LiveFlowSequenceStep,
  type TeacherRemoteAction,
  type TeacherRemoteCommand,
} from "@/lib/liveClassFlow";
import { CLASSROOM_STAGE_THEMES, classroomStageTheme, usesDiscussionProtocol } from "@/lib/classroomPilot";
import {
  DISCUSSION_ROUNDS,
  discussionRoundForPhase,
  discussionRoundIndex,
  normalizeDiscussionPhaseSnapshot,
} from "@/lib/discussionProtocol";
import type { LessonRoutineConfig } from "@/lib/lessonRoutineConfig";
import { defaultPublicSurfaceModeForState } from "@/lib/lessonStepMetadata";
import type { LessonStepData } from "@/lib/notionLessons";
import { BEHAVIOR_OVERRIDE_BUTTONS, CLEAR_ON_DEMAND_TIMER_BUTTON, ON_DEMAND_TIMER_BUTTONS, SOUND_BANK_REMOTE_BUTTONS, SOUND_REMOTE_BUTTONS, SPEAKER_REMOTE_BUTTON, TRANSITION_NOW_BUTTONS, type RemoteDeckButton } from "@/lib/remoteDeck";
import { joinRealtimeRoom } from "@/lib/realtimeRooms";
import {
  SOUND_LABEL_ROOM,
  normalizeSoundLabels,
  readStoredSoundLabels,
  soundLabelFor,
  writeStoredSoundLabels,
  type SoundLabelMessage,
  type SoundLabels,
} from "@/lib/soundBankLabels";
import { overrideIsLive, stripFromStep } from "@/lib/classroomStateStrip";
import { speakerNoteItems } from "@/lib/speakerNotes";

const REMOTE_SESSION_KEY = "bdm-remote-session";
const SPINNER_STATE_IDS = ["learning-target-readers", "ipad-kid", "table-captains"] as const;
type SpinnerStateId = (typeof SPINNER_STATE_IDS)[number];

// What the one Spin button on the deck says it will do, per slide it appears on.
const SPINNER_BUTTON_DETAIL: Record<SpinnerStateId, string> = {
  "learning-target-readers": "Choose today's two readers",
  "ipad-kid": "Choose this week's iPad Kid",
  "table-captains": "Choose this week's captain for every table",
};
const SPINNER_BUTTON_TONE: Record<SpinnerStateId, string> = {
  "learning-target-readers": "purple",
  "ipad-kid": "green",
  "table-captains": "teal",
};

// Where the captain report belongs: closeout, and the away half of any supply
// transition. Those are the moments a count is actually being taken.
const SUPPLY_CHECK_STATE_IDS = new Set([
  "closeout",
  "supplies-boards-away",
  "supplies-calculators-away",
  "supplies-bins-away",
]);

function isSpinnerStateId(value: unknown): value is SpinnerStateId {
  return typeof value === "string" && SPINNER_STATE_IDS.some((stateId) => stateId === value);
}

const STAGE_BUTTONS: readonly RemoteDeckButton[] = [
  { action: "previous", label: "Back", detail: "Previous stage", tone: "neutral" },
  { action: "toggle-timer", label: "Pause or resume", detail: "Control automatic pacing", tone: "timer" },
  { action: "next", label: "Next state", detail: "Advance the lesson", tone: "next" },
];

const TIMER_BUTTONS: readonly RemoteDeckButton[] = [
  { action: "add-30", label: "+30 seconds", detail: "Add time", tone: "neutral" },
  { action: "subtract-30", label: "-30 seconds", detail: "Remove time", tone: "neutral" },
  { action: "reset-timer", label: "Reset timer", detail: "Restart this stage", tone: "neutral" },
];

const DISCUSSION_PHASE_BUTTONS: readonly RemoteDeckButton[] = DISCUSSION_ROUNDS.map((round) => ({
  action: round.remoteAction,
  label: round.buttonLabel,
  detail: round.subtitle,
  tone: "orange",
}));

interface RemoteSession {
  id: string;
  joinCode: string | null;
  startedAt: string;
  remoteCommand: TeacherRemoteCommand | null;
  liveFlow: LiveClassFlowSnapshot | null;
}

interface PollAnswer {
  id: string;
  display_name: string | null;
  answer: string | null;
}

interface PrivateLessonStepDetails {
  id: string;
  routineConfig: LessonRoutineConfig | null;
}

interface DeckKeyProps {
  button: RemoteDeckButton;
  busy: TeacherRemoteAction | null;
  disabled: boolean;
  onSend: (button: RemoteDeckButton) => void;
  active?: boolean;
}

interface SurfaceMirrorProps {
  label: string;
  src: string;
  meta: string;
}

function formatTime(totalSeconds: number) {
  const seconds = Math.max(0, totalSeconds);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function formatStartedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Start time unavailable"
    : `Started ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

function optimisticTimer(
  flow: LiveClassFlowSnapshot,
  action: TeacherRemoteAction,
  now: number,
): LiveClassFlowSnapshot {
  if (!flow.timer) return flow;
  const totalSeconds = Math.max(0, flow.timer.totalSeconds);
  let secondsLeft = liveTimerSeconds(flow.timer, now);
  let running = flow.timer.running;
  let finished = flow.timer.finished;
  let endsAt: string | null = flow.timer.endsAt || null;

  if (action === "toggle-timer") {
    if (running) {
      running = false;
      finished = secondsLeft <= 0;
      endsAt = null;
    } else {
      if (secondsLeft <= 0) secondsLeft = totalSeconds;
      running = secondsLeft > 0;
      finished = false;
      endsAt = running ? new Date(now + secondsLeft * 1000).toISOString() : null;
    }
  } else if (action === "reset-timer") {
    secondsLeft = totalSeconds;
    running = false;
    finished = false;
    endsAt = null;
  } else {
    secondsLeft = Math.max(0, secondsLeft + (action === "add-30" ? 30 : -30));
    finished = secondsLeft <= 0;
    if (finished) running = false;
    endsAt = running ? new Date(now + secondsLeft * 1000).toISOString() : null;
  }

  return {
    ...flow,
    updatedAt: new Date(now).toISOString(),
    timer: { totalSeconds, secondsLeft, running, finished, endsAt },
    sequence: flow.sequence && action === "toggle-timer" && running
      ? { ...flow.sequence, advanceMode: "automatic" }
      : flow.sequence,
  };
}

function optimisticNavigation(
  flow: LiveClassFlowSnapshot,
  direction: 1 | -1,
  now: number,
): LiveClassFlowSnapshot {
  const sequence = flow.sequence;
  const steps = sequence?.steps;
  if (!sequence || !steps?.length) return flow;
  const targetIndex = sequence.currentIndex + direction;
  const step: LiveFlowSequenceStep | undefined = steps[targetIndex];
  if (!step) return flow;
  const nextStep = steps[targetIndex + 1] || null;
  const keepRunning = shouldRunFlowNavigationDestination(
    sequence.advanceMode,
    flow,
    flow.poll?.stage,
  );
  const totalSeconds = Math.max(0, step.durationSeconds);

  return {
    ...flow,
    updatedAt: new Date(now).toISOString(),
    state: {
      id: step.stateId,
      label: step.label,
      description: step.description,
      color: step.color,
      semantic: step.semantic,
    },
    phase: null,
    timer: {
      totalSeconds,
      secondsLeft: totalSeconds,
      running: keepRunning,
      finished: false,
      endsAt: keepRunning ? new Date(now + totalSeconds * 1000).toISOString() : null,
    },
    poll: null,
    resource: step.resourceUrl ? { label: "Open Lesson Resource", url: step.resourceUrl } : null,
    presentation: {
      title: step.label,
      body: step.mainDisplay || step.question || step.description || step.paperTask,
      mainDisplay: step.mainDisplay || "",
      mode: step.resourceUrl ? "resource" : "directions",
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
      scoreboardStage: canRevealM2T1L1FinalScore(step.lessonCode, step.stateId, step.semantic)
        ? "halftime"
        : undefined,
      behaviorStrip: stripFromStep(step),
    },
    tool: null,
    // The override belonged to the step we just left. Dropping it here matches
    // what the server does on advance, so the iPad does not show a stale
    // override for the half second before the receipt lands.
    behaviorOverride: null,
    sequence: {
      ...sequence,
      currentIndex: targetIndex,
      nextLabel: nextStep?.label || null,
      nextDirections: nextStep?.paceDirections || nextStep?.description || null,
    },
    paper: step.paperTask ? { task: step.paperTask } : null,
  };
}

function optimisticRemoteFlow(
  flow: LiveClassFlowSnapshot,
  action: TeacherRemoteAction,
): LiveClassFlowSnapshot {
  const now = Date.now();
  if (["toggle-timer", "add-30", "subtract-30", "reset-timer"].includes(action)) {
    return optimisticTimer(flow, action, now);
  }
  if (
    (action === "reveal-results" || action === "next")
    && flow.poll
    && resolveRemoteNextBehavior(flow.state?.id, flow.state?.semantic, flow.poll.stage) === "reveal-results"
  ) {
    return {
      ...flow,
      updatedAt: new Date(now).toISOString(),
      timer: null,
      poll: { ...flow.poll, stage: "results", awaitingTeacherAdvance: true },
    };
  }
  if (action === "reveal-final-score" && flow.presentation) {
    return {
      ...flow,
      updatedAt: new Date(now).toISOString(),
      presentation: { ...flow.presentation, scoreboardStage: "final" },
    };
  }
  if (action === "next" || action === "previous") {
    return optimisticNavigation(flow, action === "next" ? 1 : -1, now);
  }
  if ((action === "show-board" || action === "hide-board") && flow.presentation) {
    return {
      ...flow,
      updatedAt: new Date(now).toISOString(),
      presentation: { ...flow.presentation, boardOpen: action === "show-board" },
    };
  }
  return flow;
}

function DeckKey({ button, busy, disabled, onSend, active = false }: DeckKeyProps) {
  return (
    <button
      className={`deck-key ${button.tone}${active ? " active" : ""}`}
      disabled={disabled}
      aria-busy={busy === button.action}
      onClick={() => onSend(button)}
    >
      <span className="deck-key-label">{busy === button.action ? "Sending" : button.label}</span>
      <span className="deck-key-detail">{button.detail}</span>
    </button>
  );
}

function SurfaceMirror({ label, src, meta }: SurfaceMirrorProps) {
  return (
    <article className="surface-mirror" aria-label={`${label} live preview`}>
      <header className="surface-mirror-head">
        <span className="surface-mirror-dot" aria-hidden="true" />
        <strong>{label}</strong>
        <span>{meta}</span>
      </header>
      <div className="surface-mirror-live">
        <LiveScreenPreview src={src} title={`${label} live preview`} />
      </div>
    </article>
  );
}

// An unresolved "I'm stuck" outlives the step it was raised on. The pacing
// timer advances the lineup while the hand is still up, and scoping the strip
// to the current step alone made the alert vanish with no teacher action.
const STUCK_CARRY_MS = 5 * 60_000;

function stuckStillFresh(updatedAt: string | null | undefined, now: number) {
  if (!updatedAt) return false;
  const raisedAt = Date.parse(updatedAt);
  return Number.isFinite(raisedAt) && now - raisedAt < STUCK_CARRY_MS;
}

export default function TeacherRemotePage() {
  // A 1s heartbeat so the Remote's clock re-renders every second, independent
  // of the 0.5-1.2s refresh poll. timerSeconds is derived from the timer's
  // deadline in the render body, so without a tick of its own the handheld
  // clock only moves when a fetch returns and the teacher watches it stutter.
  const [, setClockTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setClockTick((t) => (t + 1) % 3600), 1000);
    return () => window.clearInterval(id);
  }, []);
  const [sessions, setSessions] = useState<RemoteSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<RemoteSession | null>(null);
  const [status, setStatus] = useState("Choose the class session this Remote should control.");
  const [busy, setBusy] = useState<TeacherRemoteAction | null>(null);
  const [soundLabels, setSoundLabels] = useState<SoundLabels>({});
  // Student self-signals ("I'm stuck") - the Remote is the surface in hand
  // while teaching, so the live counts belong here too. null until the
  // student-signals migration has been run.
  const [signalState, setSignalState] = useState<{
    controls: boolean;
    signalsOff: boolean;
    signals: Array<{ student_id: string | null; display_name: string | null; signal: string; step_index: number | null; updated_at: string | null }>;
  } | null>(null);
  const [signalBusy, setSignalBusy] = useState(false);
  const [pendingCommand, setPendingCommand] = useState<{
    nonce: string;
    label: string;
    action: TeacherRemoteAction;
    spinnerStateKey: string | null;
  } | null>(null);
  const [lastReceipt, setLastReceipt] = useState<string | null>(null);
  // showCommandStatus used to infer "something went wrong" by pattern-matching
  // the status string for "Disconnected" / "did not confirm" / "failed". A
  // server refusal that says neither - "This is the last lesson state." is the
  // one that bit - set the status and then rendered nowhere, so the tap was a
  // silent no-op. An explicit flag cannot drift from the wording.
  const [commandError, setCommandError] = useState(false);
  const [completedSpinnerStateKey, setCompletedSpinnerStateKey] = useState<string | null>(null);
  const [pollAnswers, setPollAnswers] = useState<PollAnswer[]>([]);
  const [privateLessonSteps, setPrivateLessonSteps] = useState<LessonStepData[]>([]);
  const [privateLessonStepDetails, setPrivateLessonStepDetails] = useState<PrivateLessonStepDetails | null>(null);
  const [boardPanelOpen, setBoardPanelOpen] = useState(false);
  const [endingSession, setEndingSession] = useState(false);
  const commandInFlightRef = useRef(false);
  const refreshInFlightRef = useRef(false);
  const refreshEpochRef = useRef(0);
  const utilitiesRef = useRef<HTMLDetailsElement | null>(null);

  // The sound bank's button names are owned by /control, where the clips are
  // loaded - this is where they are pressed. Start from the cached copy so the
  // deck reads right immediately (and still reads right if Control is not open
  // yet), then ask for the current set.
  useEffect(() => {
    setSoundLabels(readStoredSoundLabels());
    const room = joinRealtimeRoom<SoundLabelMessage>(SOUND_LABEL_ROOM, (m) => {
      if (m.t !== "labels") return;
      const next = normalizeSoundLabels(m.labels);
      setSoundLabels(next);
      writeStoredSoundLabels(next);
    });
    room.send({ t: "hello" });
    return () => room.close();
  }, []);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const requestedSessionId = params.get("session")?.trim();
      const storedSessionId = localStorage.getItem(REMOTE_SESSION_KEY)?.trim();
      refreshEpochRef.current += 1;
      setSelectedSessionId(requestedSessionId || storedSessionId || null);
    } catch {
      refreshEpochRef.current += 1;
      setSelectedSessionId(null);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (commandInFlightRef.current || refreshInFlightRef.current) return;
    const requestEpoch = refreshEpochRef.current;
    refreshInFlightRef.current = true;
    try {
      const query = selectedSessionId ? `?sessionId=${encodeURIComponent(selectedSessionId)}` : "";
      const response = await fetch(`/api/control-remote${query}`, { cache: "no-store" });
      const data = await response.json() as { sessions?: RemoteSession[]; session?: RemoteSession | null; error?: string };
      if (requestEpoch !== refreshEpochRef.current) return;
      if (!response.ok || data.error) {
        setSession(null);
        setStatus(data.error || "Remote is unavailable.");
        return;
      }
      const availableSessions = data.sessions || [];
      setSessions(availableSessions);
      if (!selectedSessionId) {
        setSession(null);
        setStatus(availableSessions.length
          ? "Choose the class session this Remote should control."
          : "Open Live Class Flow on the classroom computer.");
        return;
      }
      if (!data.session) {
        setSession(null);
        setSelectedSessionId(null);
        try { localStorage.removeItem(REMOTE_SESSION_KEY); } catch { /* ignore */ }
        setStatus("The previously selected session is no longer open. Choose another session.");
        return;
      }
      setSession(data.session);
      if (pendingCommand) {
        const remoteCommand = data.session.remoteCommand;
        if (remoteCommand?.nonce !== pendingCommand.nonce) {
          setPendingCommand(null);
          setStatus(`The classroom did not confirm ${pendingCommand.label}. Tap it again.`);
        } else if (remoteCommand.receivedAt) {
          if (pendingCommand.action === "spin-spinner" && pendingCommand.spinnerStateKey) {
            setCompletedSpinnerStateKey(pendingCommand.spinnerStateKey);
          }
          setLastReceipt(pendingCommand.label);
          setPendingCommand(null);
          setStatus(`Received by classroom: ${pendingCommand.label}`);
        } else {
          const issuedAt = Date.parse(remoteCommand.issuedAt);
          const stale = !Number.isFinite(issuedAt) || Date.now() - issuedAt >= REMOTE_COMMAND_STALE_MS;
          if (stale) {
            setPendingCommand(null);
            setStatus(`The classroom did not confirm ${pendingCommand.label}. Tap it again.`);
          } else {
            setStatus(`Sent to classroom: ${pendingCommand.label}. Waiting for receipt.`);
          }
        }
      } else if (!pendingCommand) {
        setStatus(lastReceipt
          ? `Received by classroom: ${lastReceipt}`
          : "Connected to the confirmed Live Class Flow session.");
      }
    } catch {
      if (requestEpoch === refreshEpochRef.current) {
        setStatus("Disconnected. Trying to reach the classroom controller again.");
      }
    } finally {
      refreshInFlightRef.current = false;
    }
  }, [lastReceipt, pendingCommand, selectedSessionId]);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(refresh, selectedSessionId ? 500 : 1200);
    return () => window.clearInterval(interval);
  }, [refresh, selectedSessionId]);

  useEffect(() => {
    if (!lastReceipt) return;
    const timeout = window.setTimeout(() => setLastReceipt(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [lastReceipt]);

  const pollId = session?.liveFlow?.poll?.id ?? null;
  useEffect(() => {
    if (!pollId) {
      setPollAnswers([]);
      return;
    }
    let stopped = false;
    const load = async () => {
      try {
        const response = await fetch(`/api/teacher/poll?pollId=${encodeURIComponent(pollId)}`, { cache: "no-store" });
        const data = await response.json() as { answers?: PollAnswer[] };
        if (!stopped && response.ok) setPollAnswers(data.answers || []);
      } catch {
        if (!stopped) setPollAnswers([]);
      }
    };
    void load();
    const interval = window.setInterval(load, 1200);
    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, [pollId]);

  const privateLessonId = session?.liveFlow?.lesson?.id?.trim() || "";
  const privateLessonCode = session?.liveFlow?.lesson?.code?.trim() || "";
  const privateNotionStepId = session?.liveFlow?.presentation?.notionStepId?.trim() || "";
  useEffect(() => {
    if (!privateLessonId && !privateLessonCode) {
      setPrivateLessonSteps([]);
      return;
    }
    let stopped = false;
    setPrivateLessonSteps([]);
    const params = privateLessonId
      ? `id=${encodeURIComponent(privateLessonId)}`
      : `code=${encodeURIComponent(privateLessonCode)}`;
    void (async () => {
      try {
        const response = await fetch(`/api/teacher/lesson?${params}`, { cache: "no-store" });
        const data = await response.json() as { lesson?: { steps?: LessonStepData[] }; error?: string };
        if (!stopped) setPrivateLessonSteps(response.ok ? data.lesson?.steps || [] : []);
      } catch {
        if (!stopped) setPrivateLessonSteps([]);
      }
    })();
    return () => { stopped = true; };
  }, [privateLessonCode, privateLessonId]);

  useEffect(() => {
    if (!privateLessonId || !privateNotionStepId) {
      setPrivateLessonStepDetails(null);
      return;
    }
    let stopped = false;
    setPrivateLessonStepDetails(null);
    void (async () => {
      try {
        const params = new URLSearchParams({ lessonId: privateLessonId, stepId: privateNotionStepId });
        const response = await fetch(`/api/teacher/lesson-step?${params.toString()}`, { cache: "no-store" });
        const data = await response.json() as { step?: PrivateLessonStepDetails; error?: string };
        if (!stopped) {
          setPrivateLessonStepDetails(
            response.ok && data.step?.id === privateNotionStepId ? data.step : null,
          );
        }
      } catch {
        if (!stopped) setPrivateLessonStepDetails(null);
      }
    })();
    return () => { stopped = true; };
  }, [privateLessonId, privateNotionStepId]);

  const chooseSession = useCallback((sessionId: string) => {
    refreshEpochRef.current += 1;
    setSelectedSessionId(sessionId);
    setSession(null);
    setPendingCommand(null);
    setLastReceipt(null);
    setBoardPanelOpen(false);
    setStatus("Confirming the selected classroom session.");
    try { localStorage.setItem(REMOTE_SESSION_KEY, sessionId); } catch { /* ignore */ }
  }, []);

  const changeSession = useCallback(() => {
    refreshEpochRef.current += 1;
    setSelectedSessionId(null);
    setSession(null);
    setPendingCommand(null);
    setLastReceipt(null);
    setBoardPanelOpen(false);
    setStatus("Choose the class session this Remote should control.");
    try { localStorage.removeItem(REMOTE_SESSION_KEY); } catch { /* ignore */ }
  }, []);

  const endSession = useCallback(async () => {
    if (!session || endingSession) return;
    if (!window.confirm("End this session for every connected student?")) return;
    refreshEpochRef.current += 1;
    setEndingSession(true);
    setStatus("Ending the confirmed class session.");
    try {
      const response = await fetch("/api/teacher/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close", sessionId: session.id }),
      });
      const data = await response.json() as { closed?: boolean; error?: string };
      if (!response.ok || !data.closed) throw new Error(data.error || "The session could not be ended.");
      try { localStorage.removeItem(REMOTE_SESSION_KEY); } catch { /* ignore */ }
      setSession(null);
      setSelectedSessionId(null);
      setPendingCommand(null);
      setLastReceipt(null);
      setBoardPanelOpen(false);
      setStatus("Session ended. Connected student screens have been released.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The session could not be ended.");
    } finally {
      setEndingSession(false);
    }
  }, [endingSession, session]);

  const send = useCallback(async (button: RemoteDeckButton) => {
    if (!session || busy || pendingCommand || commandInFlightRef.current) return;
    const confirmedSession = session;
    const expectedStateId = button.action === "spin-spinner" && isSpinnerStateId(session.liveFlow?.state?.id)
      ? session.liveFlow.state.id
      : null;
    const spinnerStateKey = expectedStateId
      ? `${session.id}:${expectedStateId}:${session.liveFlow?.sequence?.currentIndex ?? -1}`
      : null;
    refreshEpochRef.current += 1;
    commandInFlightRef.current = true;
    setBusy(button.action);
    setLastReceipt(null);
    setCommandError(false);
    setStatus(`Sending to classroom: ${button.label}`);
    setSession((current) => current?.liveFlow
      ? { ...current, liveFlow: optimisticRemoteFlow(current.liveFlow, button.action) }
      : current);
    try {
      const response = await fetch("/api/control-remote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: button.action,
          sessionId: session.id,
          ...(button.payload || {}),
          ...(expectedStateId ? {
            expectedStateId,
            expectedSequenceIndex: session.liveFlow?.sequence?.currentIndex,
          } : {}),
        }),
      });
      const data = await response.json() as { command?: TeacherRemoteCommand; liveFlow?: LiveClassFlowSnapshot; error?: string };
      if (!response.ok || !data.command) {
        setSession(confirmedSession);
        setCommandError(true);
        setStatus(data.error || "Command failed.");
      } else if (data.command.receivedAt) {
        if (data.liveFlow) setSession((current) => current ? { ...current, liveFlow: data.liveFlow || null, remoteCommand: data.command || null } : current);
        if (button.action === "spin-spinner" && spinnerStateKey) {
          setCompletedSpinnerStateKey(spinnerStateKey);
        }
        setPendingCommand(null);
        setLastReceipt(button.label);
        setStatus(`Received by classroom: ${button.label}`);
      } else {
        setPendingCommand({
          nonce: data.command.nonce,
          label: button.label,
          action: button.action,
          spinnerStateKey,
        });
        setStatus(`Sent to classroom: ${button.label}. Waiting for receipt.`);
      }
    } catch {
      setSession(confirmedSession);
      setStatus("Command failed. Check the classroom connection.");
    } finally {
      commandInFlightRef.current = false;
      setBusy(null);
    }
  }, [busy, pendingCommand, session]);

  const setWritingMode = useCallback(async (open: boolean) => {
    // LEAVING is never blocked. Closing the work space is how the teacher gets
    // back to the deck, and gating it on `pendingCommand` meant one unreceipted
    // command - which is any command at all when /control is not open to
    // acknowledge it - left the pen surface covering the whole screen with no
    // way out but a new browser tab. hide-board is handled directly by
    // /api/control-remote and needs nothing from Control, so there was never a
    // reason for it to wait behind another command's receipt.
    if (!session) return;
    if (open && (busy || pendingCommand || commandInFlightRef.current)) return;
    const confirmedSession = session;
    refreshEpochRef.current += 1;
    const action: TeacherRemoteAction = open ? "show-board" : "hide-board";
    const label = open ? "Open work space" : "Close work space";
    commandInFlightRef.current = true;
    setBusy(action);
    setLastReceipt(null);
    setStatus(`Sending to classroom: ${label}`);
    setSession((current) => current?.liveFlow
      ? { ...current, liveFlow: optimisticRemoteFlow(current.liveFlow, action) }
      : current);
    try {
      const response = await fetch("/api/control-remote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, sessionId: session.id }),
      });
      const data = await response.json() as { command?: TeacherRemoteCommand; liveFlow?: LiveClassFlowSnapshot; error?: string };
      if (!response.ok || !data.command) {
        setSession(confirmedSession);
        setCommandError(true);
        setStatus(data.error || "Command failed.");
      } else if (data.command.receivedAt) {
        if (data.liveFlow) setSession((current) => current ? { ...current, liveFlow: data.liveFlow || null, remoteCommand: data.command || null } : current);
        setPendingCommand(null);
        setLastReceipt(label);
        setStatus(`Received by classroom: ${label}`);
        setBoardPanelOpen(open);
      } else {
        setPendingCommand({ nonce: data.command.nonce, label, action, spinnerStateKey: null });
        setStatus(`Sent to classroom: ${label}. Waiting for receipt.`);
        setBoardPanelOpen(open);
      }
    } catch {
      setSession(confirmedSession);
      setStatus("Command failed. Check the classroom connection.");
    } finally {
      commandInFlightRef.current = false;
      setBusy(null);
    }
  }, [busy, pendingCommand, session]);

  useEffect(() => {
    setBoardPanelOpen(Boolean(session?.liveFlow?.presentation?.boardOpen));
  }, [session?.liveFlow?.presentation?.boardOpen]);

  const signalSessionId = session?.id ?? null;
  useEffect(() => {
    if (!signalSessionId) { setSignalState(null); return; }
    let stopped = false;
    const load = async () => {
      try {
        const response = await fetch(`/api/live/signals?sessionId=${encodeURIComponent(signalSessionId)}`, { cache: "no-store" });
        const data = await response.json().catch(() => ({})) as { enabled?: boolean; controls?: boolean; signalsOff?: boolean; signals?: Array<{ student_id: string | null; display_name: string | null; signal: string; step_index: number | null; updated_at: string | null }> };
        if (stopped) return;
        setSignalState(response.ok && data.enabled
          ? { controls: Boolean(data.controls), signalsOff: Boolean(data.signalsOff), signals: data.signals || [] }
          : null);
      } catch {
        if (!stopped) setSignalState(null);
      }
    };
    void load();
    const interval = window.setInterval(load, 3000);
    return () => { stopped = true; window.clearInterval(interval); };
  }, [signalSessionId]);

  const sendSignalAction = useCallback(async (action: string, studentId?: string) => {
    if (!signalSessionId || signalBusy) return;
    setSignalBusy(true);
    try {
      await fetch("/api/live/signals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: signalSessionId, action, studentId }),
      });
    } catch { /* next poll restores truth */ }
    finally { setSignalBusy(false); }
  }, [signalSessionId, signalBusy]);

  // The signals showing RIGHT NOW. Lifted out of the render so the pulse below
  // and the strip itself cannot disagree about which step is current.
  const signalStepIndex = session?.liveFlow?.sequence?.currentIndex ?? null;
  const currentSignals = useMemo(() => {
    if (!signalState || signalState.signalsOff) return [];
    const now = Date.now();
    return signalState.signals.filter((s) => (
      signalStepIndex === null
      || s.step_index === signalStepIndex
      || (s.signal === "stuck" && stuckStillFresh(s.updated_at, now))
    ));
  }, [signalState, signalStepIndex]);

  // A count going 0 to 1 in a thin bar is not an alert. This is a handheld held
  // at your side in a busy room, so a new signal flashes the strip and then
  // settles. Motion only - the colour change survives prefers-reduced-motion,
  // the same line timerUrgency holds.
  const [signalPulse, setSignalPulse] = useState(false);
  const seenSignalsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const keys = new Set(currentSignals.map((s) => `${s.student_id || s.display_name}:${s.signal}`));
    let fresh = false;
    for (const key of keys) {
      if (!seenSignalsRef.current.has(key)) { fresh = true; break; }
    }
    seenSignalsRef.current = keys;
    if (!fresh) return;
    setSignalPulse(true);
    const timer = window.setTimeout(() => setSignalPulse(false), 2400);
    return () => window.clearTimeout(timer);
  }, [currentSignals]);

  const flow = session?.liveFlow ?? null;
  const timer = flow?.timer ?? null;
  const timerSeconds = liveTimerSeconds(timer);
  const timerFinished = Boolean(timer?.finished || (timer?.running && timerSeconds <= 0));
  const sequence = flow?.sequence ?? null;
  const lesson = flow?.lesson ?? null;
  const privateLessonStep = useMemo(() => {
    if (!privateLessonSteps.length) return null;
    const notionStepId = flow?.presentation?.notionStepId || "";
    if (notionStepId) {
      const matchingStep = privateLessonSteps.find((step) => step.id === notionStepId);
      if (matchingStep) return matchingStep;
    }
    if (sequence && privateLessonSteps[sequence.currentIndex]) return privateLessonSteps[sequence.currentIndex];
    return privateLessonSteps.find((step) => step.stateId === flow?.state?.id) || null;
  }, [flow?.presentation?.notionStepId, flow?.state?.id, privateLessonSteps, sequence]);
  const currentSpeakerNotes = speakerNoteItems(
    privateLessonStep?.remoteActions
      || privateLessonStep?.teacherNotes
      || privateLessonStep?.paceDirections
      || privateLessonStep?.studentDirections
      || flow?.presentation?.remoteActions
      || flow?.presentation?.paceDirections
      || flow?.state?.description
      || "The classroom computer has not published directions yet.",
  );
  const privateSmallGroupPlan = privateLessonStepDetails?.routineConfig?.kind === "small-group"
    ? privateLessonStepDetails.routineConfig.teacherPlan
    : null;
  const controlsDisabled = !session || Boolean(busy) || Boolean(pendingCommand);
  const boardIsOpen = Boolean(flow?.presentation?.boardOpen);
  const behaviorOverridden = overrideIsLive(flow?.behaviorOverride ?? null, flow?.sequence?.currentIndex);
  const isDiscussionState = Boolean(
    flow?.state
    && (
      flow.state.semantic === "discussion"
      || usesDiscussionProtocol(flow.state.id, flow.state.label)
    )
  );
  const discussionPhase = isDiscussionState ? normalizeDiscussionPhaseSnapshot(flow?.phase) : null;
  const learningCheckAwaitingReveal = Boolean(
    flow?.poll
    && resolveRemoteNextBehavior(flow.state?.id, flow.state?.semantic, flow.poll.stage) === "reveal-results",
  );
  // The Remote had no idea a lesson could run out of states. navigateFlow throws
  // "This is the last lesson state." and the 409 never reaches the status line,
  // so the last step offered a green "Next state" forever that did nothing at
  // all - which is what "there is no way to close out at the bell" was.
  const isLastStep = Boolean(
    sequence && sequence.totalSteps > 0 && sequence.currentIndex + 1 >= sequence.totalSteps,
  );
  const stageControlButtons: readonly RemoteDeckButton[] = STAGE_BUTTONS.map((button) => {
    if (button.action !== "next") return button;
    if (learningCheckAwaitingReveal) {
      return {
        action: "reveal-results",
        label: "Reveal anonymous bars",
        detail: "Stay on this Learning Check",
        tone: "purple",
      };
    }
    // Reveal still wins on the final step: a Learning Check has results to show
    // before the lesson can be finished.
    if (isLastStep) {
      return { action: "next", label: "Last state", detail: "No more states in this lesson", tone: "neutral" };
    }
    return button;
  });
  const launchScoreboardAvailable = Boolean(
    flow && canRevealM2T1L1FinalScore(flow.lesson?.code, flow.state?.id, flow.state?.semantic),
  );
  const finalScoreShowing = flow?.presentation?.scoreboardStage === "final";
  const scoreboardButton: RemoteDeckButton | null = launchScoreboardAvailable
    ? {
        action: "reveal-final-score",
        label: finalScoreShowing ? "Final score shown" : "Reveal final score",
        detail: finalScoreShowing ? "The projector shows 60 to 40" : "Change 30 to 20 into 60 to 40",
        tone: "gold",
      }
    : null;
  const discussionPhaseIndex = discussionPhase ? discussionRoundIndex(discussionPhase.id) : -1;
  const activeDiscussionAction = discussionPhase ? discussionRoundForPhase(discussionPhase.id).remoteAction : null;
  const discussionControlButtons: Array<{ button: RemoteDeckButton; disabled: boolean }> = [
    {
      button: { action: "discussion-previous", label: "Previous round", detail: "Go back one round", tone: "neutral" },
      disabled: discussionPhaseIndex <= 0,
    },
    {
      button: {
        action: "discussion-toggle",
        label: discussionPhase?.running ? "Pause round" : "Start or resume",
        detail: "Control this round timer",
        tone: "timer",
      },
      disabled: !discussionPhase?.timed,
    },
    {
      button: { action: "discussion-restart", label: "Restart round", detail: "Reset this round timer", tone: "gold" },
      disabled: !discussionPhase?.timed,
    },
    {
      button: { action: "discussion-next", label: "Next round", detail: "Move to the next round", tone: "next" },
      disabled: discussionPhaseIndex < 0 || discussionPhaseIndex >= DISCUSSION_ROUNDS.length - 1,
    },
  ];
  const isSupplyCheckState = SUPPLY_CHECK_STATE_IDS.has(flow?.state?.id ?? "");
  const spinnerStateId = isSpinnerStateId(flow?.state?.id) ? flow.state.id : null;
  const spinnerStateKey = session && spinnerStateId
    ? `${session.id}:${spinnerStateId}:${sequence?.currentIndex ?? -1}`
    : null;
  useEffect(() => {
    const command = session?.remoteCommand;
    if (
      spinnerStateKey
      && spinnerStateId
      && command?.action === "spin-spinner"
      && command.stateId === spinnerStateId
      && command.receivedAt
    ) {
      setCompletedSpinnerStateKey(spinnerStateKey);
    }
  }, [session?.remoteCommand, spinnerStateId, spinnerStateKey]);
  const spinnerButton: RemoteDeckButton | null = spinnerStateId && spinnerStateKey
    ? {
        action: "spin-spinner",
        label: completedSpinnerStateKey === spinnerStateKey ? "Re-spin" : "Spin",
        detail: SPINNER_BUTTON_DETAIL[spinnerStateId],
        tone: SPINNER_BUTTON_TONE[spinnerStateId],
      }
    : null;
  const stageLinks = useMemo(() => {
    const query = session ? `?session=${encodeURIComponent(session.id)}` : "";
    return {
      present: `/teacher/present${query}`,
      pace: `/teacher/pace${query}`,
    };
  }, [session]);
  const remoteTheme = flow?.state?.semantic
    ? CLASSROOM_STAGE_THEMES[flow.state.semantic]
    : classroomStageTheme(flow?.state?.id, flow?.state?.label);
  const remoteStyle = {
    "--remote-accent": flow?.state?.color || remoteTheme.accent,
    "--remote-base": remoteTheme.projectorBase,
    "--remote-panel": remoteTheme.projectorPanel,
  } as CSSProperties;
  const publicSurfacesLinked = flow?.presentation?.publicSurfaceMode === "linked";
  const isLearningCheckState = flow?.state?.id === "learning-check"
    || flow?.state?.semantic === "learning-check";
  // The mirrors show the real screens now; the student surface follows the
  // published tool route when one is live, else the default lesson view.
  const studentPreviewRoute = flow?.tool?.route || "/lesson";
  const currentPhaseLabel = discussionPhase
    ? `${flow?.state?.label || "Discussion"}: ${discussionPhase.label}`
    : flow?.state?.label || "Lesson ready";
  const connectionNeedsAttention = status.startsWith("Disconnected")
    || status.includes("did not confirm")
    || status.includes("failed");
  const connectionInFlight = Boolean(busy || pendingCommand);
  const connectionLabel = connectionNeedsAttention
    ? "Reconnecting"
    : connectionInFlight
      ? "Syncing"
      : "Classroom connected";
  const mirrorMeta = timer ? formatTime(timerSeconds) : "Ready";
  const showCommandStatus = !session || connectionNeedsAttention || connectionInFlight || commandError || Boolean(lastReceipt);

  if (boardPanelOpen && session) {
    return (
      <main className="remote-write-page" style={remoteStyle}>
        <style>{`
          .remote-write-page { position:fixed; inset:0; display:grid; grid-template-rows:auto minmax(0,1fr); background:#0d0b08; color:#EFE8D8; font-family:var(--bdb-font); }
          .remote-write-bar { display:flex; align-items:center; justify-content:space-between; gap:14px; border-bottom:1px solid rgba(255,255,255,0.09); background:#fff; padding:10px 14px; box-shadow:0 6px 20px rgba(62,50,35,0.08); }
          .remote-write-copy { min-width:0; }
          .remote-write-copy strong { display:block; color:#EFE8D8; font-size:1rem; }
          .remote-write-copy span { display:block; margin-top:2px; color:#B8AE99; font-size:0.76rem; font-weight:700; }
          .remote-write-back { min-height:48px; border:1px solid color-mix(in srgb,var(--remote-accent) 70%,#7f776c); border-radius:11px; background:color-mix(in srgb,var(--remote-accent) 15%,#fff); color:color-mix(in srgb,var(--remote-accent) 60%,#28241e); padding:0 16px; font:inherit; font-weight:900; cursor:pointer; }
          .remote-write-back:disabled { opacity:0.5; cursor:not-allowed; }
          .remote-write-actions { display:flex; align-items:center; gap:9px; }
          .remote-write-time { min-width:76px; color:#EFE8D8; font-size:1.45rem; font-weight:900; font-variant-numeric:tabular-nums; text-align:center; }
          .remote-write-pause { min-height:48px; border:1px solid #c89c35; border-radius:11px; background:#fff5d8; color:#6e5211; padding:0 14px; font:inherit; font-weight:900; cursor:pointer; }
          .remote-write-pause:disabled { opacity:0.5; cursor:not-allowed; }
          /* An anchor, so it needs inline-flex to centre inside min-height the
             way the buttons beside it do. */
          .remote-write-tab { display:inline-flex; align-items:center; min-height:48px; border:1px solid rgba(62,50,35,0.28); border-radius:11px; background:#fff; color:#3E3223; padding:0 14px; font:inherit; font-weight:900; text-decoration:none; }
          .remote-write-tab:focus-visible { outline:3px solid var(--remote-accent); outline-offset:2px; }
          .remote-write-back:focus-visible, .remote-write-pause:focus-visible { outline:3px solid var(--remote-accent); outline-offset:2px; }
          .remote-write-frame { width:100%; height:100%; border:0; background:#fff; }
          @media (max-width:720px) {
            .remote-write-bar { align-items:flex-start; flex-direction:column; }
            .remote-write-actions { width:100%; }
            .remote-write-back, .remote-write-pause { flex:1; }
          }
        `}</style>
        <header className="remote-write-bar">
          <div className="remote-write-copy">
            <strong>Writing on the main projector</strong>
            <span>The current problem stays visible beside this work space.</span>
          </div>
          <div className="remote-write-actions">
            <span className="remote-write-time">{timer ? formatTime(timerSeconds) : "--:--"}</span>
            <button className="remote-write-pause" type="button" disabled={controlsDisabled} onClick={() => { void send(STAGE_BUTTONS[1]); }}>
              {timer?.running ? "Pause" : "Resume"}
            </button>
            {/* Standalone pen surface. Embedded, /ipad lays out against the
                iframe's viewport rather than the iPad's, which is the leading
                suspect for the stage rendering too large to fit or pinch. A
                real tab renders at the device viewport, so this is also the
                A/B test for that. */}
            <a className="remote-write-tab" href="/ipad" target="_blank" rel="noopener noreferrer">Open in tab</a>
            {/* Never disabled, and it closes the panel LOCALLY first. The
                server round trip can fail or sit unreceipted; getting back to
                the deck must not depend on it. */}
            <button className="remote-write-back" type="button" onClick={() => { setBoardPanelOpen(false); void setWritingMode(false); }}>Back to Remote</button>
          </div>
        </header>
        {/* NO ?room= - the default "main" is the only room the displays listen
            on. This embedded the pen on `ink-<session-uuid>__over` while
            /teacher/present and /board (both opened with a bare URL) render
            `ink-main__over`, so every stroke went into a room nothing displays
            and the wall stayed empty through a whole lesson. Same bug CLAUDE.md
            already records from the other direction, when present keyed its own
            InkBoards to session.id. A per-session room is never right here:
            there is one teacher, one pen and one wall, and the projector has no
            way to learn a session id. */}
        <iframe className="remote-write-frame" src="/ipad" title="iPad writing work space" />
      </main>
    );
  }

  return (
    <main className="remote-page" style={remoteStyle}>
      <style>{`
        .remote-page { min-height:100dvh; box-sizing:border-box; display:grid; place-items:center; overflow:hidden; background:radial-gradient(circle at 18% 12%,color-mix(in srgb,var(--remote-accent) 16%,transparent),transparent 34%),#0d0b08; color:#EFE8D8; font-family:var(--bdb-font); padding:8px; }
        .remote-shell { width:min(100%,1194px); height:min(834px,calc(100dvh - 16px)); min-height:0; display:flex; flex-direction:column; overflow:hidden; border:1px solid rgba(255,255,255,0.08); border-radius:26px; background:#211D17; box-shadow:0 24px 58px rgba(0,0,0,0.55); }
        .remote-head { min-height:58px; box-sizing:border-box; flex:none; display:flex; align-items:center; gap:12px; border-bottom:1px solid rgba(255,255,255,0.08); background:#26211A; padding:0 22px; }
        .remote-brand { min-width:0; display:flex; align-items:center; gap:11px; }
        .remote-mark { width:30px; height:30px; flex:none; display:grid; place-items:center; border-radius:9px; background:rgba(255,255,255,0.12); color:#fff; font-size:0.95rem; font-weight:950; }
        .remote-brand-copy { min-width:0; }
        .remote-title { margin:0; color:#EFE8D8; font-size:16px; line-height:1; font-weight:900; }
        .remote-phase-chip { min-width:0; max-width:350px; min-height:28px; box-sizing:border-box; display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:8px; margin-left:0; border:1px solid color-mix(in srgb,var(--remote-accent) 46%,transparent); border-radius:999px; background:rgba(255,255,255,0.06); padding:0 13px; }
        .remote-phase-dot { width:9px; height:9px; border-radius:3px; background:var(--remote-accent); }
        .remote-phase-chip strong { overflow:hidden; color:#EFE8D8; text-overflow:ellipsis; white-space:nowrap; font-size:0.74rem; font-weight:900; }
        .remote-phase-time { color:#EFE8D8; font-size:0.78rem; font-weight:950; font-variant-numeric:tabular-nums; letter-spacing:-0.02em; }
        .remote-phase-time.finished { color:#f2a3ac; }
        .remote-phase-time.finished { color:#f2a3ac; }
        .remote-connection { min-height:28px; display:grid; grid-template-columns:auto auto; align-items:center; gap:1px 7px; border-radius:999px; background:#e8f5ed; color:#255e41; padding:0 12px; }
        .remote-connection.attention { background:#fff0d7; color:#78531b; }
        .remote-connection-dot { grid-row:1 / 3; width:8px; height:8px; border-radius:50%; background:#2f9e6f; }
        .remote-connection.attention .remote-connection-dot { background:#c78b24; }
        .remote-connection strong { font-size:0.68rem; font-weight:900; line-height:1.1; }
        .remote-connection span { color:currentColor; opacity:0.72; font-size:0.57rem; font-weight:800; line-height:1.1; }
        .remote-status { flex:none; min-height:30px; margin:0; border-bottom:1px solid rgba(255,255,255,0.08); border-left:4px solid var(--remote-accent); background:#26211A; color:#B8AE99; padding:6px 14px; font-size:0.7rem; line-height:1.25; font-weight:780; }
        .remote-signals { flex:none; display:flex; flex-wrap:wrap; align-items:center; gap:5px 12px; margin:0; border-bottom:1px solid rgba(255,255,255,0.08); border-left:4px solid #E4694A; background:#26211A; color:#E8E2D4; padding:7px 14px; font-size:0.74rem; font-weight:800; }
        .remote-signals.off { border-left-color:rgba(255,255,255,0.18); color:#B8AE99; }
        .remote-signals.pulse { animation:remote-signal-pulse 1.2s ease-out 2; }
        @keyframes remote-signal-pulse {
          0% { background:#26211A; border-left-color:#E4694A; }
          16% { background:#4C2A1E; border-left-color:#F0876B; }
          100% { background:#26211A; border-left-color:#E4694A; }
        }
        .remote-signal-count.stuck { color:#F0876B; }
        .remote-signal-count.gotit { color:#7FC7A0; }
        .remote-signal-name { display:inline-flex; align-items:center; gap:5px; color:#D9D2C2; font-weight:750; }
        .remote-signal-btn { border:1px solid rgba(255,255,255,0.22); border-radius:999px; background:transparent; color:#B8AE99; font:inherit; font-size:0.66rem; font-weight:800; padding:2px 10px; min-height:26px; cursor:pointer; }
        .remote-signal-btn:hover:not(:disabled) { border-color:#E4694A; color:#F0876B; }
        .remote-signal-btn.off-btn { margin-left:auto; }
        .remote-workspace { flex:1; min-height:0; display:grid; grid-template-columns:314px minmax(0,1fr); }
        .remote-mirrors { min-height:0; display:grid; grid-template-rows:auto repeat(3,minmax(0,1fr)); gap:12px; overflow:hidden; border-right:1px solid rgba(255,255,255,0.08); background:#1C1812; padding:16px; }
        .mirror-rail-label { margin:0; color:#8C8069; font-size:0.62rem; font-weight:900; letter-spacing:0.12em; text-transform:uppercase; }
        .surface-mirror { min-height:0; display:flex; flex-direction:column; overflow:hidden; border:1px solid rgba(255,255,255,0.09); border-radius:12px; background:#fff; box-shadow:0 7px 18px rgba(0,0,0,0.21); }
        .surface-mirror-head { min-height:29px; flex:none; display:flex; align-items:center; gap:7px; border-bottom:1px solid rgba(255,255,255,0.09); background:#26211A; padding:5px 9px; }
        .surface-mirror-dot { width:8px; height:8px; flex:none; border-radius:2px; background:var(--remote-accent); }
        .surface-mirror-head strong { color:#B8AE99; font-size:0.64rem; font-weight:900; }
        .surface-mirror-head span:last-child { margin-left:auto; color:#8C8069; font-size:0.58rem; font-weight:850; font-variant-numeric:tabular-nums; }
        .surface-mirror-live { flex:1; min-height:0; }
        .remote-controls { min-height:0; display:grid; align-content:start; gap:12px; overflow-x:hidden; overflow-y:auto; -webkit-overflow-scrolling:touch; overscroll-behavior:contain;
          background:#2A241B; padding:16px 18px calc(24px + env(safe-area-inset-bottom)); scroll-padding-bottom:calc(24px + env(safe-area-inset-bottom)); scrollbar-color:#8C8069 transparent; }
        .remote-primary-stack { display:grid; gap:12px; }
        .remote-secondary { display:grid; grid-template-columns:minmax(0,1.15fr) minmax(230px,0.85fr); gap:12px; align-items:start; }
        .remote-shell > .deck-section { margin:18px; overflow:auto; }
        .session-list { display:grid; gap:10px; }
        .session-choice { width:100%; min-height:72px; display:grid; grid-template-columns:minmax(0,1fr) auto; gap:12px; align-items:center; border:1px solid rgba(255,255,255,0.09); border-radius:13px; background:#2A241B; color:#EFE8D8; padding:14px 16px; font:inherit; text-align:left; cursor:pointer; box-shadow:0 7px 18px rgba(0,0,0,0.21); }
        .session-choice:hover, .session-choice:focus-visible { border-color:var(--remote-accent); outline:3px solid color-mix(in srgb,var(--remote-accent) 24%,transparent); outline-offset:2px; }
        .session-choice strong { display:block; color:#EFE8D8; font-size:1rem; }
        .session-choice span { display:block; margin-top:3px; color:#B8AE99; font-size:0.78rem; font-weight:700; }
        .session-use { color:color-mix(in srgb,var(--remote-accent) 68%,#28241e) !important; font-size:0.72rem !important; font-weight:900 !important; letter-spacing:0.08em; text-transform:uppercase; }
        .current-card { min-width:0; border:1px solid rgba(255,255,255,0.09); border-top:5px solid var(--remote-accent); border-radius:15px; background:#26211A; padding:14px; box-shadow:0 8px 22px rgba(0,0,0,0.24); }
        .current-label { margin:0 0 5px; color:color-mix(in srgb,var(--remote-accent) 66%,#28241e); font-size:0.64rem; font-weight:900; letter-spacing:0.11em; text-transform:uppercase; }
        .current-title { margin:0; color:#EFE8D8; font-size:clamp(1rem,1.7vw,1.2rem); line-height:1.08; font-weight:900; }
        .current-notes-label { margin:11px 0 0; color:#B8AE99; font-size:0.62rem; font-weight:900; letter-spacing:0.1em; text-transform:uppercase; }
        .current-directions { display:grid; gap:5px; margin:6px 0 0; padding-left:1.05rem; color:#B8AE99; font-size:0.79rem; line-height:1.36; font-weight:720; }
        .current-directions li { padding-left:2px; }
        .current-directions li::marker { color:var(--remote-accent); }
        .current-next { margin:12px 0 0; color:#B8AE99; font-size:0.78rem; line-height:1.35; font-weight:740; }
        .current-live-note { display:inline-flex; margin:10px 0 0; border:1px solid #ddbd76; border-radius:999px; background:#fff4d7; color:#674b0f; padding:7px 10px; font-size:0.7rem; font-weight:900; }
        .private-plan { display:grid; gap:10px; border:1px solid #bfcfe3; border-left:5px solid #4d8df6; border-radius:15px; background:#f4f8ff; padding:13px; }
        .private-plan-head { display:grid; gap:3px; }
        .private-plan-title { margin:0; color:#355f9e; font-size:0.7rem; font-weight:900; letter-spacing:0.11em; text-transform:uppercase; }
        .private-plan-note { margin:0; color:#6f7c8e; font-size:0.68rem; font-weight:730; }
        .private-plan-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
        .private-plan-card { border:1px solid #d3deec; border-radius:10px; background:#fff; padding:10px 11px; }
        .private-plan-label { margin:0 0 5px; color:#466eaa; font-size:0.62rem; font-weight:900; letter-spacing:0.1em; text-transform:uppercase; }
        .private-plan-body { margin:0; color:#374457; font-size:0.79rem; font-weight:720; line-height:1.38; white-space:pre-wrap; }
        .private-plan-materials { margin:0; padding-left:1.1rem; color:#445267; font-size:0.78rem; line-height:1.4; }
        .deck-section { display:grid; gap:10px; border:1px solid rgba(255,255,255,0.09); border-radius:15px; background:#26211A; padding:13px; box-shadow:0 7px 18px rgba(0,0,0,0.18); }
        .remote-primary-stack > .deck-section { border:0; border-radius:0; background:transparent; padding:0; box-shadow:none; }
        .deck-section.compact-private { box-shadow:none; }
        .deck-section-head { display:flex; justify-content:space-between; align-items:baseline; gap:12px; }
        .deck-section-title { margin:0; color:#EFE8D8; font-size:0.7rem; font-weight:900; letter-spacing:0.11em; text-transform:uppercase; }
        .deck-section-note { margin:0; color:#B8AE99; font-size:0.7rem; font-weight:700; text-align:right; }
        .remote-primary-stack .deck-section-note { display:none; }
        .deck-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; }
        .deck-grid.stages { grid-template-columns:repeat(3,minmax(0,1fr)); }
        .deck-grid.discussion-phases { grid-template-columns:repeat(3,minmax(0,1fr)); }
        .deck-grid.discussion-controls { grid-template-columns:repeat(4,minmax(0,1fr)); }
        .deck-grid.spinner-control { grid-template-columns:1fr; }
        .deck-grid.sound-bank { max-height:46vh; overflow-y:auto; -webkit-overflow-scrolling:touch; padding-right:4px; overscroll-behavior:contain; }
        .remote-control-block { display:grid; gap:8px; }
        .discussion-selection { display:grid; gap:5px; border:1px solid #bba9dd; border-left:5px solid #8b5cf6; border-radius:12px; background:#f5efff; padding:11px 13px; }
        .discussion-selection span { color:#6d4aa7; font-size:0.62rem; font-weight:900; letter-spacing:0.1em; text-transform:uppercase; }
        .discussion-selection strong { color:#322544; font-size:clamp(1.2rem,2.6vw,1.7rem); line-height:1; }
        .deck-key { min-height:44px; display:grid; place-items:center; border:1px solid rgba(255,255,255,0.09); border-radius:12px; background:rgba(255,255,255,0.08); color:#EFE8D8; padding:7px 11px; font:inherit; text-align:center; cursor:pointer; touch-action:manipulation; box-shadow:0 5px 12px rgba(0,0,0,0.24); transition:transform 100ms ease,box-shadow 100ms ease,border-color 100ms ease; }
        .deck-key:hover:not(:disabled) { border-color:color-mix(in srgb,var(--remote-accent) 62%,#9c9387); box-shadow:0 7px 16px rgba(0,0,0,0.36); }
        .deck-key:focus-visible { outline:3px solid color-mix(in srgb,var(--remote-accent) 42%,transparent); outline-offset:2px; }
        .deck-key:active:not(:disabled) { transform:translateY(1px); box-shadow:0 2px 6px rgba(0,0,0,0.30); }
        .deck-key.active { outline:3px solid color-mix(in srgb,var(--remote-accent) 58%,#fff); outline-offset:2px; }
        .deck-key:disabled { opacity:0.46; cursor:not-allowed; }
        .deck-key-label { font-size:clamp(0.78rem,1.2vw,0.9rem); font-weight:900; line-height:1.08; }
        .deck-key-detail { display:none; }
        .deck-key.timer { border-color:#d4ad55; background:#fff5d8; color:#6e5211; }
        .deck-key.next, .deck-key.teal { border-color:#65ad99; background:#eaf8f3; color:#155f4c; }
        .deck-key.orange { border-color:#dd8a69; background:#fff0e8; color:#8b3f24; }
        .deck-key.blue { border-color:#87aee7; background:#edf4ff; color:#315f9d; }
        .deck-key.gold { border-color:#d4ad55; background:#fff5d8; color:#6e5211; }
        .deck-key.purple { border-color:#a995d2; background:#f4efff; color:#65459a; }
        .deck-key.green { border-color:#76b494; background:#edf8f1; color:#216947; }
        /* The label used to be #f2a3ac on #fff0f1 - about 1.9:1, unreadable in a
           dim room, and the odd one out: every sibling tone above sets a dark
           ink. #93323c is the same hue family at about 7:1. */
        .deck-key.red { border-color:#d88d94; background:#fff0f1; color:#93323c; }
        .response-list { display:grid; gap:8px; margin:0; padding:0; list-style:none; }
        .response-row { display:grid; grid-template-columns:minmax(92px,0.8fr) minmax(0,1.8fr); gap:9px; border-top:1px solid rgba(255,255,255,0.09); padding-top:8px; color:#EFE8D8; font-size:0.8rem; }
        .response-name { font-weight:900; }
        .response-answer { color:#B8AE99; overflow-wrap:anywhere; }
        .response-empty { margin:0; color:#B8AE99; font-size:0.8rem; font-weight:700; }
        .remote-links { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
        .remote-link, .remote-change, .remote-end { display:flex; min-height:44px; align-items:center; justify-content:center; border:1px solid rgba(255,255,255,0.09); border-radius:11px; background:rgba(255,255,255,0.08); color:#EFE8D8; padding:0 11px; text-align:center; text-decoration:none; font:inherit; font-size:0.78rem; font-weight:850; cursor:pointer; }
        .remote-link:hover, .remote-change:hover { border-color:var(--remote-accent); }
        .remote-link:focus-visible, .remote-change:focus-visible, .remote-end:focus-visible { outline:3px solid color-mix(in srgb,var(--remote-accent) 36%,transparent); outline-offset:2px; }
        .remote-change { color:#6e5211; }
        .remote-end { flex:none; min-width:104px; min-height:36px; margin-left:auto; border-color:rgba(216,141,148,0.55); background:rgba(216,141,148,0.12); color:#f2a3ac; }
        .remote-end:disabled { opacity:0.5; cursor:not-allowed; }
        .remote-utilities { min-width:0; border:1px solid rgba(255,255,255,0.09); border-radius:15px; background:#26211A; box-shadow:0 7px 18px rgba(0,0,0,0.18); }
        .remote-utilities > summary { min-height:56px; box-sizing:border-box; display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:12px; padding:10px 13px; color:#EFE8D8; cursor:pointer; list-style:none; font-size:0.76rem; font-weight:900; }
        .remote-utilities > summary::-webkit-details-marker { display:none; }
        .remote-utilities > summary::after { content:"Open"; border:1px solid rgba(255,255,255,0.09); border-radius:999px; background:#2A241B; padding:5px 9px; color:#B8AE99; font-size:0.62rem; letter-spacing:0.08em; text-transform:uppercase; }
        .remote-utilities[open] > summary::after { content:"Close"; }
        .remote-utilities > summary:focus-visible { outline:3px solid color-mix(in srgb,var(--remote-accent) 36%,transparent); outline-offset:-3px; }
        .remote-utilities-copy { min-width:0; display:grid; gap:2px; }
        .remote-utilities-copy strong { color:#EFE8D8; font-size:0.72rem; letter-spacing:0.11em; text-transform:uppercase; }
        .remote-utilities-copy span { color:#B8AE99; font-size:0.68rem; font-weight:720; }
        .remote-utilities-body { display:grid; grid-template-columns:1fr 1fr; gap:12px; border-top:1px solid rgba(255,255,255,0.09); padding:12px; background:#2A241B; }
        .remote-utilities-body > * { min-width:0; }
        .remote-utilities-body .deck-section { box-shadow:none; }
        .remote-utilities-body .remote-links { grid-column:1 / -1; }
        @media (max-width:1100px) {
          .remote-utilities-body { grid-template-columns:1fr; }
          .remote-utilities-body .remote-links { grid-column:auto; }
        }
        @media (max-width:920px) {
          .remote-page { place-items:start center; }
          .remote-shell { height:calc(100dvh - 16px); }
          .remote-head { min-height:58px; }
          .remote-workspace { grid-template-columns:1fr; grid-template-rows:auto minmax(0,1fr); }
          .remote-mirrors { grid-template-columns:repeat(3,minmax(0,1fr)); grid-template-rows:auto minmax(76px,94px); gap:8px; border-right:0; border-bottom:1px solid rgba(255,255,255,0.09); padding:9px 12px 10px; }
          .mirror-rail-label { grid-column:1 / -1; }
          .surface-mirror-head { min-height:25px; padding:4px 7px; }
          .surface-mirror-head span:last-child { display:none; }
          .remote-controls { overflow:auto; padding:12px; }
          .remote-secondary { grid-template-columns:1fr 1fr; }
        }
        @media (max-width:680px) {
          .remote-page { padding:0; }
          .remote-shell { width:100%; height:100dvh; min-height:100dvh; border:0; border-radius:0; }
          .remote-head { align-items:center; flex-wrap:wrap; padding:8px 10px; }
          .remote-brand { flex:1 1 180px; }
          .remote-subtitle { display:none; }
          .remote-phase-chip { order:4; width:100%; max-width:none; box-sizing:border-box; margin-left:0; }
          .remote-connection { display:none; }
          .remote-end { min-width:100px; min-height:48px; }
          .remote-status { min-height:28px; padding:6px 10px; }
          .remote-mirrors { grid-template-rows:auto minmax(66px,78px); padding:8px; }
          .surface-mirror-head { min-height:22px; }
          .surface-mirror-head strong { font-size:0.58rem; }
          .remote-controls { padding:10px; }
          .deck-grid, .deck-grid.stages { grid-template-columns:repeat(2,minmax(0,1fr)); }
          .deck-grid.discussion-phases, .deck-grid.discussion-controls { grid-template-columns:repeat(2,minmax(0,1fr)); }
          .deck-grid.discussion-phases .deck-key:last-child { grid-column:1 / -1; }
          .deck-grid.stages .deck-key.timer { grid-column:1 / -1; grid-row:1; }
          .remote-secondary, .remote-utilities-body { grid-template-columns:1fr; }
          .remote-utilities-body .remote-links { grid-column:auto; }
          .remote-links { grid-template-columns:1fr; }
          .deck-section-head { display:block; }
          .deck-section-note { margin-top:4px; text-align:left; }
          .private-plan-grid { grid-template-columns:1fr; }
        }
        @media (prefers-reduced-motion:reduce) {
          .deck-key { transition:none; }
          /* The alert still has to read as an alert without the flash. */
          .remote-signals.pulse { animation:none; background:#4C2A1E; border-left-color:#F0876B; }
        }
      `}</style>
      <section className="remote-shell">
        <header className="remote-head">
          <div className="remote-brand">
            <span className="remote-mark" aria-hidden="true">÷</span>
            <div className="remote-brand-copy">
              <h1 className="remote-title">Lesson Remote</h1>
            </div>
          </div>
          {session ? (
            <div className="remote-phase-chip" aria-label={`Current state: ${currentPhaseLabel}. ${mirrorMeta} remaining.`}>
              <span className="remote-phase-dot" aria-hidden="true" />
              <strong>{currentPhaseLabel}</strong>
              <span className={`remote-phase-time${timerFinished ? " finished" : ""}`}>{mirrorMeta}</span>
            </div>
          ) : null}
          {session ? (
            <div className={`remote-connection${connectionNeedsAttention ? " attention" : ""}`} role="status" aria-label={`${connectionLabel}. Confirmed class ${session.joinCode || "without a join code"}.`}>
              <span className="remote-connection-dot" aria-hidden="true" />
              <strong>{connectionLabel}</strong>
              <span>Class {session.joinCode || "confirmed"}</span>
            </div>
          ) : null}
          {session ? (
            <button className="remote-end" type="button" disabled={endingSession} onClick={() => { void endSession(); }}>
              {endingSession ? "Ending session" : "End session"}
            </button>
          ) : null}
        </header>

        {showCommandStatus ? <p className="remote-status" role="status">{status}</p> : null}
        {session && signalState ? (() => {
          if (signalState.signalsOff) {
            return (
              <div className="remote-signals off" role="status">
                <span>Signals off</span>
                <button className="remote-signal-btn" disabled={signalBusy} onClick={() => void sendSignalAction("signals-on")}>Turn on</button>
              </div>
            );
          }
          const current = currentSignals;
          const stuck = current.filter((s) => s.signal === "stuck");
          const again = current.filter((s) => s.signal === "again");
          const gotIt = current.filter((s) => s.signal === "got-it");
          // Keep the strip up at zero whenever the teacher has the controls, the
          // way /session already does. Hiding it on an empty current step made
          // the Remote look like signals were not wired at all: the step scoping
          // below is deliberate, so a tap vanishes the moment you advance, and
          // on the surface in your hand that reads as a dead feature rather than
          // as "nobody is stuck on this step".
          if (!current.length && !signalState.controls) return null;
          return (
            <div className={`remote-signals${signalPulse ? " pulse" : ""}`} role="status" aria-label="Student self-signals">
              <span className="remote-signal-count stuck">Stuck {stuck.length}</span>
              <span className="remote-signal-count">Again {again.length}</span>
              <span className="remote-signal-count gotit">Got it {gotIt.length}</span>
              {[...stuck, ...again].map((s) => (
                <span className="remote-signal-name" key={`${s.student_id || s.display_name}:${s.signal}`}>
                  {s.display_name || "Student"}
                  {signalState.controls && s.student_id ? (
                    <button className="remote-signal-btn" disabled={signalBusy} title="Hide this student's signals this session" onClick={() => void sendSignalAction("mute", s.student_id || undefined)}>Mute</button>
                  ) : null}
                </span>
              ))}
              {signalState.controls ? (
                <button className="remote-signal-btn off-btn" disabled={signalBusy} title="Hides the chips for every student at the next step change" onClick={() => void sendSignalAction("signals-off")}>Signals off</button>
              ) : null}
            </div>
          );
        })() : null}

        {!session ? (
          <section className="deck-section" aria-labelledby="session-picker-title">
            <div className="deck-section-head">
              <h2 className="deck-section-title" id="session-picker-title">Open Live Class Flow sessions</h2>
              <p className="deck-section-note">Choose by join code and start time.</p>
            </div>
            <div className="session-list">
              {sessions.length ? sessions.map((candidate) => (
                <button className="session-choice" key={candidate.id} onClick={() => chooseSession(candidate.id)}>
                  <span>
                    <strong>Join code {candidate.joinCode || "not set"}</strong>
                    <span>{formatStartedAt(candidate.startedAt)}. {candidate.liveFlow?.lesson?.code || "Lesson not loaded"}</span>
                  </span>
                  <span className="session-use">Use this session</span>
                </button>
              )) : <p className="response-empty">No open Live Class Flow session is available.</p>}
            </div>
          </section>
        ) : (
          <>
            <div className="remote-workspace">
              <aside className="remote-mirrors" aria-label="Public screen mirrors">
                <p className="mirror-rail-label">Public screen mirrors</p>
                <SurfaceMirror label="Main" src={`/teacher/present?session=${encodeURIComponent(session.id)}`} meta={mirrorMeta} />
                <SurfaceMirror label="Pace" src={`/teacher/pace?session=${encodeURIComponent(session.id)}`} meta={mirrorMeta} />
                <SurfaceMirror label="Student" src={`${studentPreviewRoute}?teacherPreview=1`} meta="Synced" />
              </aside>

              <section className="remote-controls" aria-label="Classroom controls">
                <div className="remote-primary-stack">
                  <section className="deck-section" aria-labelledby="stage-controls-title">
                    <div className="deck-section-head">
                      <h2 className="deck-section-title" id="stage-controls-title">Pacing</h2>
                      <p className="deck-section-note">
                        {isDiscussionState
                          ? "Use the routine controls below for each round. Next state ends the discussion."
                          : flow?.poll?.stage === "results" && flow.poll.awaitingTeacherAdvance
                            ? "Results are showing. Tap Next state when ready."
                            : flow?.poll?.stage === "results" && sequence?.advanceMode === "automatic"
                              ? "Results are showing. The next stage will advance automatically."
                              : timer?.running
                                ? "Automatic pacing is running. Pause the timer to hold this stage."
                                : sequence?.advanceMode === "automatic"
                                  ? "Pacing is paused. Resume when the room is ready."
                                  : "Automatic pacing is off. Start when the room is ready."}
                      </p>
                    </div>
                    <div className="deck-grid stages">
                      {stageControlButtons.filter((button) => !(isDiscussionState && button.action === "toggle-timer")).map((button) => (
                        <DeckKey
                          key={button.action}
                          button={button}
                          busy={busy}
                          disabled={controlsDisabled || (button.action === "next" && isLastStep)}
                          onSend={send}
                        />
                      ))}
                    </div>
                    {/* The close-out lives in its OWN row, never in the slot Next
                        just occupied - a destructive key inheriting the position
                        the teacher's thumb has tapped all period is a mis-tap
                        waiting to happen. endSession carries its own confirm. */}
                    {isLastStep ? (
                      <div className="deck-grid spinner-control">
                        <button
                          className="deck-key red"
                          type="button"
                          disabled={endingSession || !session}
                          onClick={() => { void endSession(); }}
                        >
                          <span className="deck-key-label">{endingSession ? "Ending lesson" : "End lesson"}</span>
                          <span className="deck-key-detail">Close the session and release every screen</span>
                        </button>
                      </div>
                    ) : null}
                    {/* Persistent cold-call: spins one student on the projector,
                        any state. The state-scoped readers/iPad Spin is separate,
                        below. */}
                    <div className="deck-grid spinner-control">
                      <DeckKey button={SPEAKER_REMOTE_BUTTON} busy={busy} disabled={controlsDisabled} onSend={send} />
                    </div>
                    {spinnerButton ? (
                      <div className="deck-grid spinner-control">
                        <DeckKey button={spinnerButton} busy={busy} disabled={controlsDisabled} onSend={send} />
                      </div>
                    ) : null}
                    {scoreboardButton ? (
                      <div className="deck-grid spinner-control">
                        <DeckKey
                          button={scoreboardButton}
                          busy={busy}
                          disabled={controlsDisabled || finalScoreShowing}
                          onSend={send}
                        />
                      </div>
                    ) : null}
                    {!isDiscussionState ? (
                      <div className="remote-control-block">
                        <h3 className="deck-section-title">Timer · {mirrorMeta}</h3>
                        <div className="deck-grid">
                          {TIMER_BUTTONS.map((button) => (
                            <DeckKey key={button.action} button={button} busy={busy} disabled={controlsDisabled} onSend={send} />
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {/* An untimed state gets the arming row; a timed one gets the clear button only
                        while an on-demand clock is actually up, so the deck never offers to remove
                        a duration the lesson authored. */}
                    <div className="remote-control-block">
                      <h3 className="deck-section-title">{flow?.timer ? "Timer" : "Start a timer"}</h3>
                      <div className="deck-grid">
                        {flow?.timer ? (
                          <DeckKey
                            button={CLEAR_ON_DEMAND_TIMER_BUTTON}
                            busy={busy}
                            disabled={controlsDisabled}
                            onSend={send}
                          />
                        ) : ON_DEMAND_TIMER_BUTTONS.map((button) => (
                          <DeckKey key={button.label} button={button} busy={busy} disabled={controlsDisabled} onSend={send} />
                        ))}
                      </div>
                    </div>
                    <div className="remote-control-block">
                      <h3 className="deck-section-title">Transition now</h3>
                      <div className="deck-grid">
                        {TRANSITION_NOW_BUTTONS.map((button) => (
                          <DeckKey key={button.label} button={button} busy={busy} disabled={controlsDisabled} onSend={send} />
                        ))}
                      </div>
                    </div>
                    <div className="remote-control-block">
                      <h3 className="deck-section-title">This slide</h3>
                      <div className="deck-grid spinner-control">
                        {/* A TOGGLE. This was open-only: hide-board was wired end
                            to end but no control ever sent it, so once the work
                            space was up there was no way to put it away and it
                            sat over the slide for the rest of the lesson. */}
                        <DeckKey
                          button={boardIsOpen
                            ? { action: "hide-board", label: "Close work space", detail: "Put the writing surface away", tone: "orange" }
                            : { action: "show-board", label: "Open work space", detail: "Write beside the current problem", tone: "green" }}
                          busy={busy}
                          disabled={controlsDisabled || !flow?.presentation}
                          onSend={() => { void setWritingMode(!boardIsOpen); }}
                        />
                      </div>
                    </div>
                    {/* Only when the step actually authored a strip. The server
                        refuses an override with nothing to override, and an
                        override alone would be a partial strip by another name. */}
                    {flow?.presentation?.behaviorStrip ? (
                      <div className="remote-control-block">
                        <h3 className="deck-section-title">
                          Classroom state{behaviorOverridden ? " - overridden until the next step" : ""}
                        </h3>
                        <div className="deck-grid">
                          {BEHAVIOR_OVERRIDE_BUTTONS.map((button) => (
                            <DeckKey
                              key={button.label}
                              button={button}
                              busy={busy}
                              disabled={controlsDisabled || (button.action === "clear-behavior" && !behaviorOverridden)}
                              onSend={() => { void send(button); }}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </section>

                  {isDiscussionState ? (
                    <section className="deck-section" aria-labelledby="discussion-controls-title">
                      <div className="deck-section-head">
                        <h2 className="deck-section-title" id="discussion-controls-title">Discussion routine</h2>
                        <p className="deck-section-note">
                          {discussionPhase
                            ? `${discussionPhase.label}. ${discussionPhase.running ? "Timer running." : discussionPhase.finished ? "Time is up." : "Ready or paused."}`
                            : "Choose Round 1 to open the three-round routine."}
                        </p>
                      </div>
                      <div className="deck-grid discussion-phases">
                        {DISCUSSION_PHASE_BUTTONS.map((button) => (
                          <DeckKey
                            key={button.action}
                            button={button}
                            busy={busy}
                            disabled={controlsDisabled}
                            active={button.action === activeDiscussionAction}
                            onSend={send}
                          />
                        ))}
                      </div>
                      <div className="deck-grid discussion-controls">
                        {discussionControlButtons.map(({ button, disabled }) => (
                          <DeckKey
                            key={button.action}
                            button={button}
                            busy={busy}
                            disabled={controlsDisabled || disabled}
                            onSend={send}
                          />
                        ))}
                      </div>
                      {discussionPhase?.id === "share" ? (
                        <>
                          {discussionPhase.selectedSharer ? (
                            <div className="discussion-selection"><span>Ready to share</span><strong>{discussionPhase.selectedSharer}</strong></div>
                          ) : null}
                          <div className="deck-grid spinner-control">
                            <DeckKey
                              button={{
                                action: "discussion-pick-sharer",
                                label: discussionPhase.selectedSharer ? "Choose another sharer" : "Choose sharer",
                                detail: "Choose from joined students first",
                                tone: "purple",
                              }}
                              busy={busy}
                              disabled={controlsDisabled}
                              onSend={send}
                            />
                          </div>
                        </>
                      ) : null}
                    </section>
                  ) : null}
                </div>

                <div className="remote-secondary" aria-label="Private lesson context">
                  <section className="current-card" aria-label="Speaker notes">
                    <p className="current-label">{lesson?.code || "Live lesson"} · {sequence ? `Step ${sequence.currentIndex + 1} of ${sequence.totalSteps}` : "Current step"}</p>
                    <h2 className="current-title">{flow?.state?.label || "Waiting for a lesson step"}</h2>
                    <p className="current-notes-label">Speaker notes</p>
                    <ul className="current-directions" aria-label="Private speaker notes">
                      {currentSpeakerNotes.map((note, index) => <li key={`${index}-${note}`}>{note}</li>)}
                    </ul>
                    {launchScoreboardAvailable ? (
                      <p className="current-live-note">{finalScoreShowing ? "Final score 60 to 40 is showing" : "Halftime score 30 to 20 is showing"}</p>
                    ) : null}
                    {/* nextLabel is null on the final step, and the old fallback
                        read "Next: Lesson closeout" - naming a step that does not
                        exist, on the one screen the teacher trusts for what is
                        coming. */}
                    <p className="current-next">
                      {isLastStep
                        ? <><strong>Last state.</strong> End the lesson when the room is done.</>
                        : <><strong>Next:</strong> {sequence?.nextLabel || "Lesson closeout"}{sequence?.nextDirections ? ` - ${sequence.nextDirections}` : ""}</>}
                    </p>
                  </section>

                  <section className="deck-section compact-private" aria-labelledby="response-title">
                    <div className="deck-section-head">
                      <h2 className="deck-section-title" id="response-title">Private response data</h2>
                      <p className="deck-section-note">{flow?.poll ? `${pollAnswers.length} response${pollAnswers.length === 1 ? "" : "s"}` : "No live response is open"}</p>
                    </div>
                    {flow?.poll ? (
                      pollAnswers.length ? (
                        <ul className="response-list">
                          {pollAnswers.map((answer) => (
                            <li className="response-row" key={answer.id}>
                              <span className="response-name">{answer.display_name || "Student"}</span>
                              <span className="response-answer">{answer.answer || "No answer"}</span>
                            </li>
                          ))}
                        </ul>
                      ) : <p className="response-empty">Waiting for responses.</p>
                    ) : <p className="response-empty">Student names and individual answers stay on this private screen.</p>}
                  </section>
                </div>

                {privateSmallGroupPlan ? (
                  <section className="private-plan" aria-labelledby="private-small-group-title">
                    <div className="private-plan-head">
                      <h2 className="private-plan-title" id="private-small-group-title">Private small-group plan</h2>
                      <p className="private-plan-note">Only this teacher Remote receives these notes.</p>
                    </div>
                    <div className="private-plan-grid">
                      {[
                        ["Pull", privateSmallGroupPlan.pull],
                        ["Focus", privateSmallGroupPlan.focus],
                        ["Activity", privateSmallGroupPlan.activity],
                        ["Check", privateSmallGroupPlan.check],
                      ].map(([label, body]) => (
                        <article className="private-plan-card" key={label}>
                          <p className="private-plan-label">{label}</p>
                          <p className="private-plan-body">{body}</p>
                        </article>
                      ))}
                    </div>
                    {privateSmallGroupPlan.materials.length ? (
                      <article className="private-plan-card">
                        <p className="private-plan-label">Materials</p>
                        <ul className="private-plan-materials">
                          {privateSmallGroupPlan.materials.map((item) => <li key={item}>{item}</li>)}
                        </ul>
                      </article>
                    ) : null}
                  </section>
                ) : null}

                {/* The captain report. Only on the states where supplies are
                    actually moving back, so it is not one more thing on the
                    deck for the other fifty minutes. */}
                {isSupplyCheckState ? <SupplyCheckBoard mode="remote" sessionId={session.id} /> : null}

                <VisitListPanel sessionId={session.id} />

                <details
                  className="remote-utilities"
                  ref={utilitiesRef}
                  onToggle={(event) => {
                    if (!event.currentTarget.open) return;
                    window.requestAnimationFrame(() => utilitiesRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
                  }}
                >
                  <summary>
                    <span className="remote-utilities-copy">
                      <strong>Utilities</strong>
                      <span>Sound bank, timer cues, projector links, and session switching</span>
                    </span>
                  </summary>
                  <div className="remote-utilities-body">
                    {/* Where the Abbie AI deck used to be (Steele, 2026-07-29).
                        Buttons are derived from SOUND_CUES, so a new cue in
                        src/lib/soundBank.ts appears here with no edit. */}
                    <section className="deck-section" aria-labelledby="sound-bank-title">
                      <div className="deck-section-head">
                        <h2 className="deck-section-title" id="sound-bank-title">Sound bank</h2>
                        <p className="deck-section-note">Plays from the classroom computer. Scroll for the rest.</p>
                      </div>
                      {/* Twenty-five keys is taller than the iPad, and the deck
                          below it (timer cues, projector links) still has to be
                          reachable - so the bank scrolls inside itself rather
                          than pushing everything else off the screen. */}
                      <div className="deck-grid sound-bank">
                        {SOUND_BANK_REMOTE_BUTTONS.map((button) => {
                          const cueId = button.action.replace(/^play-/, "");
                          const named = soundLabelFor(cueId, "", soundLabels);
                          const shown = named
                            ? { ...button, label: named, detail: "Your sound" }
                            : button;
                          return <DeckKey key={button.action} button={shown} busy={busy} disabled={controlsDisabled} onSend={send} />;
                        })}
                      </div>
                    </section>

                    <section className="deck-section" aria-labelledby="sound-controls-title">
                      <div className="deck-section-head">
                        <h2 className="deck-section-title" id="sound-controls-title">Timer cues</h2>
                        <p className="deck-section-note">The countdown sounds, uploaded or built in.</p>
                      </div>
                      <div className="deck-grid">
                        {SOUND_REMOTE_BUTTONS.map((button) => <DeckKey key={button.action} button={button} busy={busy} disabled={controlsDisabled} onSend={send} />)}
                      </div>
                    </section>

                    <div className="remote-links">
                      <a className="remote-link" href={stageLinks.present} target="_blank" rel="noreferrer">Open main projector</a>
                      <a className="remote-link" href={stageLinks.pace} target="_blank" rel="noreferrer">Open Pace + Support</a>
                      <button className="remote-change" type="button" onClick={changeSession}>Change session</button>
                    </div>
                  </div>
                </details>
              </section>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
