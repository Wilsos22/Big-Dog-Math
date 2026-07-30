"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import ClassroomSpinner from "@/components/ClassroomSpinner";
import { getSupabase } from "@/lib/supabase";
import { SECURE_STUDENT_DATA, StudentApiError, studentApiRequest } from "@/lib/studentApi";
import { fetchSharedSessionState } from "@/lib/studentSessionShared";
import { studentSafeLiveFlow } from "@/lib/liveFlowPrivacy";
import { useStudioPreviewSnapshot } from "@/lib/studioPreviewFlow";
import { CLOSEOUT_DIRECTIONS } from "@/lib/classStates";
import { classroomStageTheme, usesDiscussionProtocol } from "@/lib/classroomPilot";
import { normalizeDiscussionPhaseSnapshot } from "@/lib/discussionProtocol";
import { WARM_ACCENTS } from "@/lib/warmNotebook";
import { TIMER_URGENCY_CSS, TIMER_URGENT_SECONDS, timerUrgency, timerUrgencyClass } from "@/lib/timerUrgency";
import {
  canonicalStructuredNumericAnswer,
  structuredNumericBlankCount,
  structuredNumericSegments,
} from "@/lib/structuredNumeric";
import {
  publicSuccessCriterion,
  selectedSuccessCriterion,
  SUCCESS_CRITERION_SETUP_PLACEHOLDER,
} from "@/lib/successCriterion";
import {
  LIVE_FLOW_MODE,
  MAX_LIVE_STATE_SECONDS,
  STUDENT_SESSION_KEY,
  getStoredStudentSession,
  getStoredStudentSessionId,
  leaveClassMode,
  liveIndependentSupportItems,
  liveTimerSeconds,
  resolveLiveStepPollKind,
  type DiscussionPhaseId,
  type LiveClassFlowSnapshot,
  type StoredStudentSession,
} from "@/lib/liveClassFlow";

const WARMUP_IDENTITY = process.env.NEXT_PUBLIC_WARMUP_IDENTITY_ENABLED === "true";
const WARMUP_IDENTITY_PLACEHOLDER = "BDM_AUTH_USER_ID";

type SessionRow = {
  status: string;
  broadcast: string | null;
  live_flow: LiveClassFlowSnapshot | null;
};

type ConnectionState = "connecting" | "connected" | "reconnecting";
type PollSaveState = "idle" | "editing" | "saved" | "saving" | "error" | "submitted";

type StoredPollDraft = {
  answer: string;
  fistRating: number;
  /** Structured Numeric boxes, kept as typed text so a half-filled row survives a reload. */
  boxes?: string[];
};

function pollDraftKey(sessionId: string, responseKey: string) {
  return `bdm-live-draft:${sessionId}:${responseKey}`;
}

function submittedPollsKey(sessionId: string) {
  return `bdm-live-submitted:${sessionId}`;
}

type DiscussionContent = {
  title: string;
  subtitle: string;
  directions?: string[];
  sentenceStems?: string[];
  keyVocabulary?: string[];
};

const DISCUSSION_CONTENT: Record<DiscussionPhaseId, DiscussionContent> = {
  think: {
    title: "Round 1 of 3: Think + Write",
    subtitle: "Think quietly, then write your first idea.",
    directions: ["Think on your own first.", "Write one idea or strategy.", "Mistakes are allowed; blank work is not."],
  },
  marker: {
    title: "Commit Your Thinking",
    subtitle: "Write your first answer.",
    directions: ["No group talk yet.", "Mistakes are allowed.", "Blank boards are not."],
  },
  table: {
    title: "Round 2 of 3: Discuss + Revise",
    subtitle: "Talk it through, then strengthen your response.",
    sentenceStems: [
      "I started by…",
      "I noticed…",
      "I disagree because…",
      "Can you explain why…?",
      "I want to revise because…",
    ],
    keyVocabulary: [
      "strategy",
      "evidence",
      "justify",
      "represent",
      "revise",
    ],
  },
  revise: {
    title: "Revise Your Answer",
    subtitle: "Update your thinking.",
    directions: ["Add, change, or correct something based on your discussion."],
  },
  share: {
    title: "Round 3 of 3: Share",
    subtitle: "Use the spinner, then listen and respond.",
    directions: [
      "Listen for strategy.",
      "Listen for mistakes.",
      "Listen for revisions.",
      "Be ready to agree, disagree, or build.",
    ],
  },
};

function formatTime(totalSeconds: number) {
  const seconds = Number.isFinite(totalSeconds)
    ? Math.max(0, Math.min(MAX_LIVE_STATE_SECONDS, Math.round(totalSeconds)))
    : 0;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function LiveFlowPage() {
  const router = useRouter();
  const supabase = getSupabase();
  const [flow, setFlow] = useState<LiveClassFlowSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [emptyMessage, setEmptyMessage] = useState("Waiting for the teacher.");
  const [holding, setHolding] = useState(false);
  const [pollAnswer, setPollAnswer] = useState("");
  const [selectedChoice, setSelectedChoice] = useState("");
  const [numericBoxes, setNumericBoxes] = useState<string[]>([]);
  const [fistRating, setFistRating] = useState(3);
  const [submittedPollIds, setSubmittedPollIds] = useState<string[]>([]);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [identityConfirmed, setIdentityConfirmed] = useState(false);
  const [pollSubmitError, setPollSubmitError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [pollSaveState, setPollSaveState] = useState<PollSaveState>("idle");
  const loadedDraftKeyRef = useRef<string | null>(null);
  // Student self-signal ("I'm stuck" / "say that again" / "I've got this").
  // Probed per lesson step: the chips stay hidden until the student-signals
  // migration has been run, and hide again when the teacher flips the
  // session's signals off (the switch bites at the next step advance).
  const [signalsEnabled, setSignalsEnabled] = useState(false);
  const [mySignal, setMySignal] = useState<string | null>(null);
  const [signalBusy, setSignalBusy] = useState(false);
  const [signalCooldown, setSignalCooldown] = useState(false);
  // Rendered beside the chips, because that is where the student is looking
  // when a tap fails to send.
  const [signalError, setSignalError] = useState<string | null>(null);
  const signalStepRef = useRef<number>(-1);
  // Answer writes require the verified join. When one fails because this
  // device never verified (a skipped warm-up, a no-form day), surface the
  // admission request RIGHT HERE instead of stranding the student with a
  // failed submit and no path forward.
  const [joinHelpNeeded, setJoinHelpNeeded] = useState(false);
  const [joinHelpCode, setJoinHelpCode] = useState<string | null>(null);
  const [joinHelpBusy, setJoinHelpBusy] = useState(false);

  async function requestAdmissionHelp() {
    const stored = getStoredStudentSession();
    const code = stored?.syncKey || "";
    if (!code || joinHelpBusy) return;
    setJoinHelpBusy(true);
    try {
      const result = await studentApiRequest<{ request: { requestCode: string } }>(
        "/api/student/admission-request",
        { method: "POST", body: JSON.stringify({ code }) },
      );
      setJoinHelpCode(result.request.requestCode);
    } catch { /* the button stays for another try */ }
    finally { setJoinHelpBusy(false); }
  }
  const signalProbeStep = flow?.sequence?.currentIndex ?? -1;

  useEffect(() => {
    let stopped = false;
    // A short retry ladder: the availability answer can lag right at page
    // load, and a student surface that quietly never shows the chips is
    // indistinguishable from the feature not existing.
    void (async () => {
      for (let attempt = 0; attempt < 3 && !stopped; attempt += 1) {
        try {
          const sessionId = getStoredStudentSessionId() || "";
          const response = await fetch(
            `/api/student/signal?sessionId=${encodeURIComponent(sessionId)}`,
            { cache: "no-store" },
          );
          const result = await response.json().catch(() => ({})) as { enabled?: boolean };
          if (!stopped) setSignalsEnabled(Boolean(result.enabled));
          if (result.enabled !== undefined) return;
        } catch { /* fall through to retry */ }
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    })();
    return () => { stopped = true; };
  }, [signalProbeStep]);

  // Preview mode (the public /demo run-through, same bridge Screen Studio
  // uses): render from a posted snapshot instead of a session. The privacy
  // boundary stays INSIDE this surface - whatever the parent posts goes
  // through studentSafeLiveFlow before it renders, exactly like production.
  const { active: isStudioPreviewMode, snapshot: studioPreviewSnapshot } = useStudioPreviewSnapshot();
  useEffect(() => {
    if (!isStudioPreviewMode) return;
    setConnectionState("connected");
    setHolding(true);
    if (studioPreviewSnapshot) {
      setFlow(studentSafeLiveFlow(studioPreviewSnapshot));
      setLoading(false);
    }
  }, [isStudioPreviewMode, studioPreviewSnapshot]);

  useEffect(() => {
    if (isStudioPreviewMode) return;
    const sessionId = getStoredStudentSessionId();
    if (!supabase || !sessionId) {
      setEmptyMessage(!supabase ? "Live sync is not set up." : "Join the class first.");
      setConnectionState("reconnecting");
      setLoading(false);
      return;
    }

    let stopped = false;
    const connectionFallback = window.setTimeout(() => {
      if (!stopped) {
        setConnectionState("reconnecting");
        setLoading(false);
      }
    }, 3500);
    const applySession = (row: SessionRow | null) => {
      if (stopped) return;
      window.clearTimeout(connectionFallback);
      setConnectionState("connected");
      const isLiveFlow = row?.status === "open" && row.broadcast === LIVE_FLOW_MODE;
      if (!row) {
        setEmptyMessage("This class session is not open.");
      } else if (row.status !== "open") {
        setEmptyMessage("This class session has ended.");
      } else if (row.broadcast !== LIVE_FLOW_MODE) {
        setEmptyMessage("Waiting for Live Class Flow.");
      } else {
        setEmptyMessage("Waiting for the teacher.");
      }
      // While the session is open, hold students on a calm "get ready" screen
      // instead of a bare waiting message — even before the pacer sets a state.
      setHolding(row?.status === "open");
      setFlow(isLiveFlow ? row.live_flow : null);
      setLoading(false);
    };
    const readSession = async () => {
      try {
        if (SECURE_STUDENT_DATA) {
          // Shared read-through cache: one wire request per device per ~3s
          // no matter how many components poll (see studentSessionShared).
          const result = await fetchSharedSessionState<{ session: SessionRow }>(sessionId);
          applySession(result.session);
          return;
        }
        const response = await fetch(
          `/api/student/session-state?sessionId=${encodeURIComponent(sessionId)}`,
          { cache: "no-store", credentials: "same-origin" },
        );
        const result = await response.json().catch(() => ({})) as { session?: SessionRow; error?: string };
        if (!response.ok || !result.session) throw new Error(result.error || "Live Flow could not load.");
        applySession(result.session);
      } catch (error) {
        setEmptyMessage(error instanceof Error ? error.message : "Live Flow could not load.");
        setConnectionState("reconnecting");
        setLoading(false);
      }
    };

    void readSession();
    const poll = window.setInterval(readSession, SECURE_STUDENT_DATA ? 2000 : 1000);

    return () => {
      stopped = true;
      window.clearTimeout(connectionFallback);
      window.clearInterval(poll);
    };
  }, [supabase, isStudioPreviewMode]);

  useEffect(() => {
    if (!WARMUP_IDENTITY || !supabase) return;
    let stopped = false;
    const loadAuthUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (!stopped) setAuthUserId(data.session?.user.id ?? null);
    };
    void loadAuthUser();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!stopped) setAuthUserId(session?.user.id ?? null);
    });
    return () => {
      stopped = true;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!WARMUP_IDENTITY || !supabase || identityConfirmed) return;
    const stored = getStoredStudentSession();
    if (!stored?.sessionId) return;

    let stopped = false;
    const confirm = async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token || stopped) return;
      const response = await fetch("/api/student/confirm-session", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionId: stored.sessionId }),
      });
      if (!response.ok || stopped) return;
      const result = await response.json().catch(() => ({})) as {
        session?: StoredStudentSession;
      };
      if (!result.session) return;
      try {
        localStorage.setItem(STUDENT_SESSION_KEY, JSON.stringify(result.session));
        localStorage.setItem("bdm-student-name", result.session.name);
      } catch { /* ignore */ }
      setIdentityConfirmed(true);
    };
    void confirm();
    const interval = window.setInterval(confirm, 1800);
    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, [identityConfirmed, supabase]);

  const activePoll = flow?.poll ?? null;
  const activePollId = activePoll?.id ?? null;
  const activeResponseKey = activePoll
    ? flow?.presentation?.notionStepId || activePoll.id
    : null;

  useEffect(() => {
    const sessionId = getStoredStudentSessionId();
    if (!sessionId) return;
    try {
      const stored = JSON.parse(localStorage.getItem(submittedPollsKey(sessionId)) || "[]") as unknown;
      if (Array.isArray(stored)) {
        setSubmittedPollIds(stored.filter((value): value is string => typeof value === "string"));
      }
    } catch {
      setSubmittedPollIds([]);
    }
  }, []);

  useEffect(() => {
    setPollSubmitError(null);
    if (!activePoll || !activeResponseKey) {
      loadedDraftKeyRef.current = null;
      setPollSaveState("idle");
      return;
    }
    const sessionId = getStoredStudentSessionId();
    const key = sessionId ? pollDraftKey(sessionId, activeResponseKey) : null;
    let draft: StoredPollDraft | null = null;
    if (key) {
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || "null") as Partial<StoredPollDraft> | null;
        if (parsed && typeof parsed.answer === "string" && typeof parsed.fistRating === "number") {
          draft = {
            answer: parsed.answer,
            fistRating: Math.max(0, Math.min(5, parsed.fistRating)),
            boxes: Array.isArray(parsed.boxes)
              ? parsed.boxes.filter((value): value is string => typeof value === "string")
              : undefined,
          };
        }
      } catch {
        draft = null;
      }
    }
    setPollAnswer(draft?.answer || "");
    setSelectedChoice("");
    setFistRating(draft?.fistRating ?? 3);
    // Size from the poll's own box count so a restored draft from a different
    // step can never leave a short or long row of inputs.
    const boxCount = Math.max(0, activePoll.boxes || 0);
    setNumericBoxes(Array.from({ length: boxCount }, (_, index) => draft?.boxes?.[index] || ""));
    loadedDraftKeyRef.current = key;
    setPollSaveState(submittedPollIds.includes(activePoll.id) ? "submitted" : draft ? "saved" : "idle");
  }, [activePollId, activeResponseKey, submittedPollIds]);

  useEffect(() => {
    if (!activePoll || !activeResponseKey || submittedPollIds.includes(activePoll.id)) return;
    const sessionId = getStoredStudentSessionId();
    const key = sessionId ? pollDraftKey(sessionId, activeResponseKey) : null;
    if (!key || loadedDraftKeyRef.current !== key) return;
    setPollSaveState("editing");
    try {
      localStorage.setItem(
        key,
        JSON.stringify({ answer: pollAnswer, fistRating, boxes: numericBoxes } satisfies StoredPollDraft),
      );
      setPollSaveState("saved");
    } catch {
      setPollSaveState("error");
    }
  }, [activePollId, activeResponseKey, fistRating, numericBoxes, pollAnswer, submittedPollIds]);

  async function submitPollAnswer(answer: string, explanation?: string, values?: (number | null)[]) {
    // Preview mode: the visitor can answer, and it succeeds locally - no
    // network write exists to make. Their answer never joins the mock tally,
    // which is itself a small honest demo of the privacy boundary.
    if (isStudioPreviewMode) {
      if (!activePoll || !answer.trim() || submittedPollIds.includes(activePoll.id)) return;
      setSubmittedPollIds((ids) => [...new Set([...ids, activePoll.id])]);
      setPollAnswer("");
      setPollSubmitError(null);
      setPollSaveState("submitted");
      return;
    }
    const student = getStoredStudentSession();
    if (!supabase || !activePoll || !student || !answer.trim() || submittedPollIds.includes(activePoll.id)) return;
    // The answer column stays the bare choice so tallies and correctness
    // checks keep exact-matching; the explanation travels beside it.
    const trimmedExplanation = explanation?.trim() || "";
    setPollSubmitError(null);
    setPollSaveState("saving");
    try {
      if (SECURE_STUDENT_DATA) {
        await studentApiRequest("/api/student/poll-answer", {
          method: "POST",
          body: JSON.stringify({
            pollId: activePoll.id,
            answer: answer.trim(),
            ...(trimmedExplanation ? { explanation: trimmedExplanation } : {}),
            ...(values ? { values } : {}),
          }),
        });
      } else {
        const base = {
          poll_id: activePoll.id,
          ...(student.studentId ? { student_id: student.studentId } : {}),
          display_name: student.name,
          answer: answer.trim(),
          ...(trimmedExplanation ? { explanation: trimmedExplanation } : {}),
        };
        // Same fallback as the secure route: poll-structured-numeric.sql is
        // hand-run, and an insert naming a missing column fails outright.
        // Losing the boxes is recoverable; losing the response is not.
        let result = values
          ? await supabase.from("poll_answers").insert({ ...base, values })
          : { error: null };
        if (!values || result.error) result = await supabase.from("poll_answers").insert(base);
        if (result.error) throw result.error;
      }
      const nextSubmitted = [...new Set([...submittedPollIds, activePoll.id])];
      setSubmittedPollIds(nextSubmitted);
      try {
        localStorage.setItem(submittedPollsKey(student.sessionId), JSON.stringify(nextSubmitted));
        if (activeResponseKey) localStorage.removeItem(pollDraftKey(student.sessionId, activeResponseKey));
      } catch { /* ignore */ }
      setPollAnswer("");
      setPollSaveState("submitted");
    } catch (error) {
      // ANY identity failure gets the Ask-for-help escape hatch, not just a
      // missing join. The day-one reality is 428 warmup_verification_required
      // (absent, late, or a broken Form) - without this branch that student
      // reads "finish the warm-up" for a warm-up that closed 20 minutes ago,
      // with no button and no way out.
      const identityCodes = new Set(["session_join_required", "warmup_verification_required", "not_on_roster"]);
      if (error instanceof StudentApiError && identityCodes.has(error.code)) {
        setJoinHelpNeeded(true);
        setPollSubmitError("Your answer could not be saved because your teacher has not let you in yet. Tap Ask for help and your teacher can admit you.");
      } else {
        setPollSubmitError(error instanceof Error ? error.message : "Your answer could not be saved. Try again.");
      }
      setPollSaveState("error");
    }
  }

  function exitLiveFlow() {
    leaveClassMode();
    router.replace("/");
  }

  const phase = normalizeDiscussionPhaseSnapshot(flow?.phase);
  const activeSequenceStep = flow?.sequence?.steps?.[flow.sequence.currentIndex] || null;
  const expectedPollKind = flow?.state?.semantic === "discussion"
    ? null
    : resolveLiveStepPollKind(
        flow?.presentation?.responseMode,
        activeSequenceStep?.pollKind || undefined,
        flow?.state?.id,
      );
  const waitingForPoll = Boolean(flow?.state && expectedPollKind && !activePoll);
  const isCloseout = flow?.state?.id === "closeout";
  const publicSurfacesLinked = flow?.presentation?.publicSurfaceMode === "linked";
  const linkedMainFocus = flow?.presentation?.mainDisplay || flow?.presentation?.body || flow?.state?.description || "";
  const routineConfig = flow?.presentation?.routineConfig || null;
  const studentSurfaceAction = publicSurfacesLinked
    ? linkedMainFocus
    : routineConfig?.kind === "gallery-walk"
      ? routineConfig.recordPrompt
      : routineConfig?.kind === "small-group"
        ? routineConfig.publicTask
        : flow?.presentation?.studentAction;
  const discussion = phase ? DISCUSSION_CONTENT[phase.id] : null;
  const title = waitingForPoll
    ? "Get ready to respond"
    : phase?.label ?? discussion?.title ?? flow?.state?.label ?? "Waiting for the teacher.";
  const subtitle = isCloseout
    ? CLOSEOUT_DIRECTIONS
    : waitingForPoll
    ? "Wait for your teacher. Your response box is opening."
    : phase?.subtitle
      ?? discussion?.subtitle
      ?? studentSurfaceAction
      ?? flow?.state?.description
      ?? "";
  const phaseMedia = phase?.media ?? null;
  const timer = flow?.timer ?? null;
  const showTimer = Boolean(timer && timer.totalSeconds > 0 && (!phase || phase.timed));
  // Warm Notebook accent (turn 12e): the Chromebook must agree with both
  // projectors about what color each state is, so the shared map wins over
  // the state's stored color.
  const stageThemeId = classroomStageTheme(flow?.state?.id, flow?.state?.label).id;
  const accent = WARM_ACCENTS[stageThemeId] ?? flow?.state?.color ?? "#50A3A4";
  const activeTimerSeconds = phase?.timed && typeof phase.secondsLeft === "number"
    ? phase.secondsLeft
    : liveTimerSeconds(timer);
  // Progress strip: position, what's next, and today's target - so the screen
  // changing reads as "we're in part 3 of 4", not "an adult moved my screen".
  const progressIndex = flow?.sequence?.currentIndex ?? -1;
  const progressTotal = flow?.sequence?.totalSteps ?? 0;
  const progressNext = flow?.sequence?.nextLabel || "";
  // selectedSuccessCriterion, not publicSuccessCriterion: the public variant
  // falls back to the teacher setup placeholder, which must never show on a
  // student screen as "the target". (successCriteria can carry the same
  // placeholder through the snapshot, so filter it there too.)
  const rawProgressTarget = selectedSuccessCriterion(flow?.lesson?.selectedSuccessCriterion)
    || flow?.lesson?.successCriteria || "";
  const progressTarget = rawProgressTarget === SUCCESS_CRITERION_SETUP_PLACEHOLDER ? "" : rawProgressTarget;
  // Visual mirror of the audio cues (a deaf or headphone-wearing student gets
  // no chime): the shell edge glows inside 30 seconds, the timer itself goes
  // red and announces inside 10.
  const timerTicking = Boolean(showTimer && timer && (timer.running || (phase?.timed && typeof phase.secondsLeft === "number")));
  const timeWarning = timerTicking && activeTimerSeconds <= 30 && activeTimerSeconds > 0;
  // 10s was too late to be a warning - by then the sound is the only thing a
  // student reacts to. Match the projectors: amber at 30, coral and pulsing at
  // 15, so a head-down student on a Chromebook gets the same runway the room
  // gets (Steele, 2026-07-28).
  const studentTimerUrgency = timerUrgency(activeTimerSeconds, { running: timerTicking });
  const timeCritical = timerTicking && activeTimerSeconds <= TIMER_URGENT_SECONDS && activeTimerSeconds > 0;
  // A new lesson step clears the local signal highlight - "stuck" on the last
  // step is not "stuck" on this one. The server row keeps its step tag and the
  // teacher view scopes to the current step on its own.
  useEffect(() => {
    if (signalStepRef.current !== progressIndex) {
      signalStepRef.current = progressIndex;
      setMySignal(null);
      setSignalError(null);
    }
  }, [progressIndex]);

  async function sendSignal(signal: "stuck" | "again" | "got-it") {
    if (!liveSessionId || signalBusy || signalCooldown) return;
    setSignalBusy(true);
    setSignalError(null);
    const previous = mySignal;
    setMySignal(signal);
    try {
      await studentApiRequest("/api/student/signal", {
        method: "POST",
        body: JSON.stringify({ sessionId: liveSessionId, signal, stepIndex: progressIndex }),
      });
      // Client-side mirror of the server's 10-second cooldown, so mashing a
      // chip mostly never reaches the 429.
      setSignalCooldown(true);
      window.setTimeout(() => setSignalCooldown(false), 10_000);
    } catch (error) {
      setMySignal(previous);
      // A silent snap-back is worse than no button: the kid who most needs
      // help taps it, watches it un-click, and concludes the teacher ignored
      // them. Cooldown 429s stay quiet (the chip still reads as set); every
      // identity failure surfaces the same admit path the polls use.
      //
      // The message has to land NEXT TO THE CHIPS. It used to go only to
      // setPollSubmitError, and every render site of that - like the admission
      // help block - lives inside `activePoll`. The chips are always up and a
      // poll usually is not, so the common case set an explanation nobody could
      // see and the snap-back this comment forbids is exactly what happened.
      const identityCodes = new Set(["session_join_required", "warmup_verification_required", "not_on_roster"]);
      const code = error instanceof StudentApiError ? error.code : null;
      if (code && identityCodes.has(code)) {
        setJoinHelpNeeded(true);
        setPollSubmitError("Your help signal did not reach your teacher because you are not let in yet. Tap Ask for help and your teacher can admit you.");
        setSignalError("That did not send - your teacher has not let you in yet.");
      } else if (code !== "signal_cooldown") {
        setSignalError("That did not send. Try again in a moment.");
      }
    } finally {
      setSignalBusy(false);
    }
  }
  const pollSubmitted = activePoll ? submittedPollIds.includes(activePoll.id) : false;
  const isStructuredNumeric = activePoll?.kind === "structured-numeric" && numericBoxes.length > 0;
  const numericValues = numericBoxes.map((raw) => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  });
  // Every box must be filled before Send. A blank box is not a wrong answer,
  // and diagnosing one as a misconception would send the teacher to the wrong
  // student.
  const numericComplete = isStructuredNumeric && numericValues.every((value) => value !== null);
  const numericSegments = structuredNumericSegments(activePoll?.question);
  // Lay the boxes into the equation itself when the authored question marks
  // them with `[ ]`. Brackets, never underscores - Notion silently eats `___`
  // in a text property. When the counts disagree, fall back to numbered boxes
  // rather than rendering a mangled equation on a student's screen.
  const numericInline = isStructuredNumeric
    && structuredNumericBlankCount(activePoll?.question) === numericBoxes.length;

  function setNumericBoxAt(index: number, raw: string) {
    // Digits and a leading minus only: a stray letter would silently become a
    // blank box at submit time.
    const cleaned = raw.replace(/[^0-9-]/g, "").replace(/(?!^)-/g, "").slice(0, 7);
    setNumericBoxes((boxes) => boxes.map((value, position) => (position === index ? cleaned : value)));
  }

  function submitNumericBoxes() {
    if (!numericComplete) return;
    void submitPollAnswer(canonicalStructuredNumericAnswer(numericValues), undefined, numericValues);
  }

  function renderNumericBox(index: number) {
    return (
      <input
        className="lf-numeric-box"
        key={index}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={`Box ${index + 1} of ${numericBoxes.length}`}
        value={numericBoxes[index] ?? ""}
        disabled={pollSubmitted}
        onChange={(event) => setNumericBoxAt(index, event.target.value)}
      />
    );
  }
  const pollSaveLabel = connectionState === "reconnecting"
    ? "Reconnecting"
    : pollSubmitted || pollSaveState === "submitted"
      ? "Submitted"
      : pollSaveState === "saving"
        ? "Saving"
        : pollSaveState === "error"
          ? "Could not save"
          : pollSaveState === "saved"
            ? "Saved on this Chromebook"
            : pollSaveState === "editing"
              ? "Editing"
              : "Ready";
  const sentenceStems = (flow?.presentation?.discussionStems?.length
    ? flow.presentation.discussionStems
    : phase?.sentenceStems?.length
      ? phase.sentenceStems
      : discussion?.sentenceStems ?? [])
    .map((stem) => stem.trim())
    .filter(Boolean);
  const keyVocabulary = (flow?.presentation?.vocabulary?.length
    ? flow.presentation.vocabulary
    : phase?.keyVocabulary?.length
      ? phase.keyVocabulary
      : discussion?.keyVocabulary ?? [])
    .map((word) => word.trim())
    .filter(Boolean);
  // Gated on the step actually running a discussion, not just on having stems
  // to show. /control publishes the lesson-level Discussion Stems on EVERY
  // state deliberately, so an ungated check put the stems-and-vocabulary panel
  // on every Chromebook for every non-poll state from warm-up to closeout.
  const runsDiscussionProtocol = Boolean(phase) || usesDiscussionProtocol(flow?.state?.id, flow?.state?.label);
  const showDiscussionSupports = !activePoll
    && runsDiscussionProtocol
    && (sentenceStems.length > 0 || keyVocabulary.length > 0);
  const resource = flow?.resource ?? null;
  const linkedSpinnerMode = !activePoll && !resource && publicSurfacesLinked && flow?.state?.id === "learning-target-readers"
    ? "readers"
    : !activePoll && !resource && publicSurfacesLinked && flow?.state?.id === "ipad-kid"
      ? "ipad"
      : null;
  const liveSessionId = getStoredStudentSessionId();
  const spinnerSyncKey = getStoredStudentSession()?.syncKey || null;
  const spinnerSyncScope = `${flow?.sequence?.currentIndex ?? -1}:${flow?.presentation?.notionStepId || flow?.state?.id || "spinner"}`;
  const independentSupports = liveIndependentSupportItems(flow?.state?.id, flow?.lesson);
  const routineSupports = !publicSurfacesLinked && routineConfig?.kind === "gallery-walk"
    ? [
        { label: "Notice", body: routineConfig.observationPrompt },
        { label: "Move", body: routineConfig.movementDirections },
        { label: "Share", body: routineConfig.sharePrompt },
      ]
    : !publicSurfacesLinked && routineConfig?.kind === "small-group"
      ? [{ label: "Rotation", body: `${routineConfig.rotationMinutes} minutes with this group.` }]
      : [];
  const actionBody = flow?.state?.id === "independent" && flow?.paper?.task
    ? flow.paper.task
    : flow?.presentation?.studentAction || "";
  const showActionBody = Boolean(
    !publicSurfacesLinked
    && !waitingForPoll
    && !activePoll
    && !resource
    && actionBody
    && actionBody.trim() !== subtitle.trim(),
  );
  const resourceNeedsIdentity = Boolean(resource?.url.includes(WARMUP_IDENTITY_PLACEHOLDER));
  const resolvedResourceUrl = resource?.url && (!resourceNeedsIdentity || authUserId)
    ? resource.url
      .replaceAll(WARMUP_IDENTITY_PLACEHOLDER, encodeURIComponent(authUserId || ""))
      .replaceAll(encodeURIComponent(WARMUP_IDENTITY_PLACEHOLDER), encodeURIComponent(authUserId || ""))
    : null;
  const embeddedResourceUrl = resolvedResourceUrl?.includes("docs.google.com/forms")
    ? `${resolvedResourceUrl}${resolvedResourceUrl.includes("?") ? "&" : "?"}embedded=true`
    : null;
  const hasStudentSession = isStudioPreviewMode || Boolean(getStoredStudentSessionId());
  const studentName = isStudioPreviewMode ? "Abbie (demo)" : (getStoredStudentSession()?.name || "Student");

  return (
    <main className="lf-page" style={{ "--lf-accent": accent } as CSSProperties}>
      <style>{`
        /* Warm Notebook skin (Design canvas turn 12c): the same dotted paper
           stage as both projectors, one semantic accent per state. */
        .lf-page { position:fixed; inset:0; box-sizing:border-box; overflow:hidden;
          --lf-head:#2E4A54; --lf-hair:#E3D9C2;
          background-color:#F3F0E7;
          background-image:radial-gradient(circle,#CBC4B2 1px,transparent 1.3px);
          background-size:18px 18px;
          color:var(--bdb-ink); font-family:var(--bdb-font); }
        .lf-exit { min-height:34px; border:1px solid var(--bdb-line); border-radius:9px; background:#fff; color:var(--bdb-ink-soft); padding:0 11px; font:inherit; font-size:0.66rem; font-weight:900; letter-spacing:0.06em; text-transform:uppercase; cursor:pointer; }
        .lf-exit:hover, .lf-exit:focus-visible { border-color:var(--lf-accent); outline:none; }
        .lf-shell { position:relative; z-index:1; width:100%; height:100%; text-align:center; display:grid; grid-template-rows:auto minmax(0,1fr); }
        .lf-chrome { width:100%; }
        .lf-topbar { width:100%; box-sizing:border-box; min-height:52px; display:flex; align-items:center; gap:10px; border-bottom:1px solid rgba(120,110,90,0.18); background:rgba(243,240,231,0.88); padding:0 18px; }
        .lf-progress { width:100%; box-sizing:border-box; display:flex; flex-wrap:wrap; align-items:center; gap:4px 16px; padding:6px 18px; border-bottom:1px solid rgba(120,110,90,0.14); background:rgba(255,255,255,0.6); font-size:0.82rem; font-weight:700; color:var(--bdb-ink-soft); text-align:left; }
        .lf-progress-pos { color:var(--bdb-ink); font-weight:900; white-space:nowrap; }
        .lf-progress-next { white-space:nowrap; }
        .lf-progress-target { margin-left:auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:58%; }
        .lf-shell.warn30 { box-shadow:inset 0 0 0 4px color-mix(in srgb, var(--lf-accent) 60%, transparent); animation:lfEdgePulse 2s ease-in-out infinite; }
        .lf-timer.low { border-color:#ef4444; animation:lfTimerLow 1s ease-in-out infinite; }
        .lf-timer.low::before { background:#ef4444; }
        .lf-timer.low .lf-time { color:#b91c1c; font-weight:900; }
        ${TIMER_URGENCY_CSS}
        .lf-time-left { color:#b91c1c; font-size:0.72rem; font-weight:900; text-transform:uppercase; letter-spacing:0.08em; }
        @media (max-width:640px) { .lf-time-left { display:none; } }
        /* Student self-signals: persistent, low-stakes, bottom of the screen. */
        .lf-signals { position:absolute; z-index:5; left:50%; bottom:14px; transform:translateX(-50%); display:flex; align-items:center; gap:8px; flex-wrap:wrap; justify-content:center; max-width:calc(100% - 24px); }
        .lf-signal { min-height:44px; padding:8px 18px; border-radius:999px; border:1.5px solid var(--bdb-line); background:rgba(255,255,255,0.92); color:var(--bdb-ink); font:inherit; font-size:0.92rem; font-weight:800; cursor:pointer; box-shadow:var(--bdb-shadow-sm); }
        .lf-signal:hover:not(:disabled) { border-color:var(--bdb-ink-soft); }
        .lf-signal.stuck.on { background:var(--bdb-coral-deep); border-color:var(--bdb-coral-deep); color:#fff; }
        .lf-signal.again.on { background:var(--bdb-ink); border-color:var(--bdb-ink); color:#fff; }
        .lf-signal.gotit.on { background:var(--bdb-green-deep); border-color:var(--bdb-green-deep); color:#fff; }
        .lf-signal:disabled { opacity:0.7; }
        .lf-signal-note { flex-basis:100%; text-align:center; color:var(--bdb-ink-soft); font-size:0.78rem; font-weight:700; }
        .lf-signal-note.failed { display:flex; flex-wrap:wrap; align-items:center; justify-content:center; gap:8px; color:var(--bdb-coral-deep); }
        .lf-signal-help { min-height:36px; padding:5px 14px; border-radius:999px; border:1.5px solid var(--bdb-coral-deep); background:#fff; color:var(--bdb-coral-deep); font:inherit; font-size:0.78rem; font-weight:800; cursor:pointer; }
        .lf-signal-help:disabled { opacity:0.7; cursor:default; }
        @keyframes lfEdgePulse { 0%, 100% { box-shadow:inset 0 0 0 4px color-mix(in srgb, var(--lf-accent) 60%, transparent); } 50% { box-shadow:inset 0 0 0 4px color-mix(in srgb, var(--lf-accent) 18%, transparent); } }
        @keyframes lfTimerLow { 0%, 100% { box-shadow:0 0 0 0 rgba(239,68,68,0.45); } 50% { box-shadow:0 0 0 7px rgba(239,68,68,0); } }
        @media (prefers-reduced-motion:reduce) { .lf-shell.warn30, .lf-timer.low { animation:none; } }
        .lf-mark { display:none; }
        .lf-phase-dot { width:11px; height:11px; flex:none; border-radius:3px; background:var(--lf-accent); }
        .lf-phase { margin:0; flex:none; border-radius:6px; background:var(--lf-accent); color:#fff; padding:4px 10px; font-size:0.64rem; font-weight:800; letter-spacing:0.09em; text-transform:uppercase; }
        .lf-sync { margin-left:auto; display:inline-flex; align-items:center; gap:7px; min-height:24px; border:1px solid var(--lf-hair); border-radius:999px; background:#fff; color:var(--lf-head); padding:0 11px; font-size:0.66rem; font-weight:800; }
        .lf-sync::before { content:""; width:7px; height:7px; border-radius:50%; background:#2f9e6f; }
        .lf-who { color:var(--bdb-ink-soft); font-size:0.75rem; font-weight:800; }
        .lf-body { min-height:0; overflow:auto; display:grid; align-content:safe center; justify-items:center; gap:clamp(13px,2vw,22px); padding:clamp(18px,3.2vw,34px); }
        .lf-spinner-shell { position:relative; width:min(100%,960px); height:min(72vh,620px); overflow:hidden; border:1px solid var(--bdb-line); border-radius:16px; background:#fff; box-shadow:var(--bdb-shadow); }
        .lf-spinner-shell .classroom-spinner { background:radial-gradient(circle at 50% 42%,color-mix(in srgb,var(--lf-accent) 12%,transparent),transparent 58%),var(--bdb-ground); }
        .lf-spinner-shell .classroom-spinner-card { border-color:var(--bdb-line); border-top-color:var(--lf-accent); background:#fff; box-shadow:var(--bdb-shadow-sm); }
        .lf-spinner-shell .classroom-spinner-label { color:var(--lf-accent); }
        .lf-spinner-shell .classroom-spinner-target, .lf-spinner-shell .classroom-spinner-name { color:var(--bdb-ink); }
        .lf-spinner-shell .classroom-spinner-window { border-color:var(--bdb-line); background:var(--bdb-ground); color:var(--bdb-ink); }
        .lf-spinner-shell .classroom-spinner-window.landed { border-color:var(--lf-accent); box-shadow:0 0 0 3px color-mix(in srgb,var(--lf-accent) 24%,transparent) inset; }
        .lf-spinner-shell .classroom-spinner-status { color:var(--bdb-ink-soft); }
        .lf-title { margin:0; max-width:31ch; color:var(--lf-head); font-size:clamp(1.45rem,2.8vw,2.2rem); line-height:1.14; font-weight:800; letter-spacing:-0.015em; }
        .lf-subtitle { margin:0; max-width:54ch; color:var(--bdb-ink-soft); font-size:clamp(0.88rem,1.45vw,1.02rem); line-height:1.48; font-weight:700; }
        .lf-share { width:min(100%,620px); display:grid; gap:6px; border:1px solid var(--bdb-line); border-left:6px solid var(--lf-accent); border-radius:12px; background:#fff; padding:16px 20px; text-align:left; box-shadow:var(--bdb-shadow-sm); }
        .lf-share span { color:var(--lf-accent); font-size:0.72rem; font-weight:900; letter-spacing:0.12em; text-transform:uppercase; }
        .lf-share strong { color:var(--bdb-ink); font-size:clamp(1.8rem,4.8vw,3.2rem); line-height:1; font-weight:950; }
        .lf-media-wrap { width:min(100%,760px); display:grid; place-items:center; }
        .lf-media { width:min(100%,720px); max-height:38vh; border:1px solid var(--bdb-line); border-radius:12px; background:#fff; object-fit:contain; box-shadow:var(--bdb-shadow); }
        .lf-media.embed { aspect-ratio:16 / 9; height:auto; }
        .lf-timer { display:inline-flex; align-items:center; gap:8px; white-space:nowrap; border:1.2px solid var(--lf-hair); border-radius:999px; background:#fff; padding:4px 12px; box-shadow:0 2px 10px rgba(40,32,20,0.06); }
        .lf-timer::before { content:""; width:7px; height:7px; border-radius:999px; background:var(--lf-accent); }
        .lf-time { color:var(--lf-head); font-size:1rem; font-variant-numeric:tabular-nums; font-weight:800; line-height:1; letter-spacing:0; }
        .lf-directions { width:min(100%,720px); display:grid; gap:10px; margin:0; padding:0; list-style:none; }
        .lf-direction { border:1px solid var(--bdb-line); border-left:5px solid var(--lf-accent); background:#fff; color:var(--bdb-ink); padding:clamp(13px,2vw,18px) clamp(17px,3vw,26px); text-align:left; font-size:clamp(1rem,1.8vw,1.22rem); font-weight:800; line-height:1.4; box-shadow:var(--bdb-shadow-sm); }
        .lf-supports { width:min(100%,1000px); display:grid; grid-template-columns:minmax(0,1.35fr) minmax(230px,0.75fr); gap:14px; text-align:left; }
        .lf-support-panel { min-width:0; display:grid; align-content:start; gap:13px; border:1px solid var(--bdb-line); border-top:5px solid var(--lf-accent); border-radius:12px; background:#fff; padding:clamp(16px,2.5vw,24px); box-shadow:var(--bdb-shadow-sm); }
        .lf-support-title { margin:0; color:var(--lf-accent); font-size:clamp(0.78rem,1.6vw,0.98rem); font-weight:900; letter-spacing:0.12em; text-transform:uppercase; }
        .lf-stem-list { display:grid; gap:9px; margin:0; padding:0; list-style:none; }
        .lf-stem { display:flex; align-items:center; min-height:58px; border-left:4px solid var(--lf-accent); background:var(--bdb-ground); color:var(--bdb-ink); padding:10px 14px; font-size:clamp(1rem,2vw,1.22rem); font-weight:850; line-height:1.28; }
        .lf-vocab-list { display:flex; flex-wrap:wrap; gap:9px; margin:0; padding:0; list-style:none; }
        .lf-vocab { background:var(--bdb-ground); border:1px solid var(--bdb-line); border-radius:999px; color:var(--bdb-ink); padding:9px 12px; font-size:clamp(0.95rem,1.9vw,1.16rem); font-weight:900; line-height:1.1; }
        .lf-poll { width:min(100%,760px); display:grid; gap:18px; justify-items:center; }
        .lf-poll-question { margin:0; max-width:34ch; color:var(--lf-head); font-size:clamp(1.45rem,3.4vw,2.6rem); font-weight:800; line-height:1.18; }
        .lf-poll-help { margin:0; color:var(--bdb-ink-soft); font-size:clamp(1rem,2.2vw,1.3rem); font-weight:700; }
        .lf-join-help { display:flex; flex-wrap:wrap; align-items:center; justify-content:center; gap:10px; border:1px solid color-mix(in srgb, var(--bdb-amber) 58%, white); border-radius:12px; background:color-mix(in srgb, var(--bdb-amber) 14%, #fff); padding:10px 16px; }
        .lf-join-help-copy { margin:0; color:var(--bdb-ink); font-size:0.95rem; font-weight:700; }
        .lf-join-help-copy strong { letter-spacing:0.1em; }
        .lf-join-help-btn { min-height:44px; padding:8px 18px; border-radius:999px; border:1.5px solid var(--bdb-ink); background:var(--bdb-ink); color:#fff; font:inherit; font-size:0.92rem; font-weight:800; cursor:pointer; }
        .lf-join-help-btn:disabled { opacity:0.7; }
        .lf-poll-choices { width:min(100%,620px); display:grid; gap:10px; }
        .lf-poll-choice, .lf-poll-send { width:100%; min-height:62px; border:2px solid var(--bdb-line); border-radius:10px; background:#fff; color:var(--bdb-ink); padding:14px 18px; font:inherit; font-size:clamp(1rem,2.4vw,1.3rem); font-weight:900; cursor:pointer; box-shadow:var(--bdb-shadow-sm); }
        .lf-poll-choice:hover, .lf-poll-choice:focus-visible, .lf-poll-send:hover, .lf-poll-send:focus-visible { border-color:var(--lf-accent); outline:none; }
        .lf-poll-choice.selected { border-color:var(--lf-accent); background:color-mix(in srgb, var(--lf-accent) 12%, #fff); }
        .lf-poll-entry { width:min(100%,620px); display:grid; gap:10px; }
        .lf-poll-text { width:100%; min-height:130px; box-sizing:border-box; border:2px solid var(--bdb-line); border-radius:10px; background:#fff; color:var(--bdb-ink); padding:14px 16px; font:inherit; font-size:1.1rem; font-weight:700; resize:vertical; box-shadow:var(--bdb-shadow-sm); }
        .lf-poll-text:focus { border-color:var(--lf-accent); outline:none; }
        .lf-poll-send { border-color:var(--lf-accent); background:var(--lf-accent); color:#fff; }
        .lf-numeric { width:min(100%,760px); display:grid; gap:14px; justify-items:start; }
        .lf-numeric-equation { display:flex; flex-wrap:wrap; align-items:center; gap:8px 10px; margin:0; color:var(--lf-head); font-size:clamp(1.3rem,3vw,2.2rem); font-weight:800; line-height:1.25; }
        .lf-numeric-part { white-space:pre-wrap; }
        .lf-numeric-box { width:4.4ch; min-height:58px; box-sizing:content-box; border:2px solid var(--bdb-line); border-radius:10px; background:#fff; color:var(--bdb-ink); padding:6px 10px; font:inherit; font-size:clamp(1.2rem,2.8vw,1.9rem); font-weight:900; text-align:center; box-shadow:var(--bdb-shadow-sm); }
        .lf-numeric-box:focus { border-color:var(--lf-accent); outline:none; }
        .lf-numeric-box:disabled { cursor:not-allowed; opacity:0.72; }
        .lf-numeric-stack { display:grid; grid-template-columns:repeat(auto-fit,minmax(104px,1fr)); gap:12px; width:100%; }
        .lf-numeric-cell { display:grid; gap:6px; justify-items:center; }
        .lf-numeric-label { color:var(--bdb-ink-soft); font-size:0.72rem; font-weight:900; text-transform:uppercase; letter-spacing:0.04em; }
        .lf-numeric-send { justify-self:stretch; }
        .lf-fist { width:min(100%,700px); display:grid; gap:14px; }
        .lf-fist-options { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:10px; }
        .lf-fist-option { min-height:72px; border:2px solid var(--bdb-line); border-radius:12px; background:#fff; color:var(--bdb-ink); font:inherit; font-size:clamp(1.35rem,3vw,2.15rem); font-weight:950; cursor:pointer; box-shadow:var(--bdb-shadow-sm); }
        .lf-fist-option:hover, .lf-fist-option:focus-visible, .lf-fist-option.selected { border-color:var(--lf-accent); background:color-mix(in srgb,var(--lf-accent) 10%,#fff); outline:none; }
        .lf-fist-option:disabled { cursor:not-allowed; opacity:0.72; }
        .lf-fist-labels { display:flex; justify-content:space-between; gap:6px; color:var(--bdb-ink-soft); font-size:0.76rem; font-weight:900; text-transform:uppercase; }
        .lf-poll-sent { color:#287652; font-size:clamp(1.1rem,2.5vw,1.5rem); font-weight:900; }
        .lf-poll-save-state { margin:0; color:var(--bdb-ink-soft); font-size:0.78rem; font-weight:900; letter-spacing:0.1em; text-transform:uppercase; }
        .lf-results { width:min(100%,760px); display:grid; gap:10px; }
        .lf-result { display:grid; grid-template-columns:minmax(70px,1fr) minmax(100px,3fr) auto; gap:10px; align-items:center; color:var(--bdb-ink); font-size:clamp(0.95rem,2vw,1.18rem); font-weight:800; }
        .lf-result-bar { height:13px; overflow:hidden; border-radius:999px; background:var(--bdb-line); }
        .lf-result-fill { height:100%; border-radius:inherit; background:var(--lf-accent); transition:width 220ms ease; }
        .lf-wait { color:var(--lf-head); font-size:clamp(1.7rem,4vw,3rem); font-weight:800; line-height:1.14; }
        .lf-ready { display:inline-flex; align-items:center; gap:9px; color:var(--bdb-ink-soft); font-size:0.95rem; font-weight:800; letter-spacing:0.04em; text-transform:uppercase; }
        .lf-ready-dot { width:11px; height:11px; border-radius:50%; background:var(--lf-accent); animation:lfPulse 1.8s ease-out infinite; }
        @keyframes lfPulse { 0% { box-shadow:0 0 0 0 rgba(20,184,166,0.5); } 70% { box-shadow:0 0 0 12px rgba(20,184,166,0); } 100% { box-shadow:0 0 0 0 rgba(20,184,166,0); } }
        @media (prefers-reduced-motion: reduce) { .lf-ready-dot { animation:none; } }
        .lf-switches { display:flex; flex-wrap:wrap; justify-content:center; gap:10px; }
        .lf-switch { display:inline-flex; align-items:center; justify-content:center; min-height:48px; border:1px solid var(--bdb-line); border-radius:10px; background:#fff; color:var(--bdb-ink); padding:0 18px; text-decoration:none; font-size:0.9rem; font-weight:900; letter-spacing:0.08em; text-transform:uppercase; }
        .lf-switch:hover, .lf-switch:focus-visible { border-color:var(--lf-accent); outline:none; }
        .lf-resource { width:min(100%,900px); display:grid; gap:12px; justify-items:center; }
        .lf-resource-frame { width:100%; height:min(62vh,720px); border:1px solid var(--bdb-line); border-radius:12px; background:#fff; box-shadow:var(--bdb-shadow); }
        .lf-resource-link { display:inline-flex; min-height:58px; align-items:center; justify-content:center; border:2px solid var(--lf-accent); border-radius:10px; background:var(--lf-accent); color:#fff; padding:0 24px; text-decoration:none; font-size:1.05rem; font-weight:900; }
        .lf-action { width:min(100%,720px); border:1px solid var(--bdb-line); border-left:6px solid var(--lf-accent); border-radius:12px; background:#fff; padding:clamp(18px,3vw,28px); color:var(--bdb-ink); text-align:left; white-space:pre-wrap; font-size:clamp(1rem,1.8vw,1.2rem); line-height:1.5; font-weight:760; box-shadow:var(--bdb-shadow); }
        .lf-independent-supports { width:min(100%,820px); display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; text-align:left; }
        .lf-independent-card { border:1px solid var(--bdb-line); border-top:4px solid var(--lf-accent); border-radius:10px; background:#fff; padding:14px 16px; box-shadow:var(--bdb-shadow-sm); }
        .lf-independent-label { margin:0 0 6px; color:var(--lf-accent); font-size:0.7rem; font-weight:900; letter-spacing:0.1em; text-transform:uppercase; }
        .lf-independent-body { margin:0; color:var(--bdb-ink); font-size:0.95rem; font-weight:760; line-height:1.4; white-space:pre-wrap; }
        .lf-connection { position:fixed; left:50%; top:62px; z-index:6; transform:translateX(-50%); border:1px solid #c78b24; border-radius:999px; background:#fff4d8; color:#694716; padding:8px 13px; font-size:0.7rem; font-weight:900; letter-spacing:0.08em; text-transform:uppercase; box-shadow:var(--bdb-shadow-sm); }
        .lf-loading { color:var(--bdb-ink-soft); font-weight:800; }
        @media (max-width:760px) { .lf-supports, .lf-independent-supports { grid-template-columns:1fr; } }
        @media (max-width:600px) {
          .lf-topbar { gap:10px; }
          .lf-phase { max-width:130px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
          .lf-who { display:none; }
          .lf-connection { top:60px; left:18px; right:18px; transform:none; box-sizing:border-box; text-align:center; }
        }
      `}</style>

      {connectionState === "reconnecting" && hasStudentSession ? <div className="lf-connection" role="status">Reconnecting. Your draft is safe.</div> : null}

      <section className={`lf-shell${timeWarning ? " warn30" : ""}`} aria-live="polite">
        <div className="lf-chrome">
        <header className="lf-topbar">
          <span className="lf-mark" aria-hidden="true">÷</span>
          <span className="lf-phase-dot" aria-hidden="true" />
          <p className="lf-phase">{flow?.state?.label || "Today"}</p>
          <span className="lf-sync">{!hasStudentSession ? "Not joined" : connectionState === "connected" ? "Synced" : "Connecting"}</span>
          {showTimer && timer ? (
            <div className={`lf-timer${timeCritical ? " low" : ""}`} aria-label="Current lesson timer" role={timeCritical ? "status" : undefined}>
              <div className={`lf-time ${timerUrgencyClass(studentTimerUrgency)}`}>{formatTime(activeTimerSeconds)}</div>
              {timeCritical ? <span className="lf-time-left">left</span> : null}
            </div>
          ) : null}
          <span className="lf-who">{studentName}</span>
          <button className="lf-exit" type="button" onClick={exitLiveFlow}>Leave class</button>
        </header>
        {progressTotal > 0 || progressTarget ? (
          <div className="lf-progress" aria-label="Where the lesson is">
            {progressTotal > 0 ? (
              <span className="lf-progress-pos">Step {progressIndex + 1} of {progressTotal}</span>
            ) : null}
            {progressNext ? <span className="lf-progress-next">Next: {progressNext}</span> : null}
            {progressTarget ? <span className="lf-progress-target">Target: {progressTarget}</span> : null}
          </div>
        ) : null}
        </div>
        <div className="lf-body">
          {loading ? (
            <p className="lf-loading">Connecting to class…</p>
          ) : !flow?.state ? (
            holding ? (
              <>
                <h1 className="lf-title">Class is starting</h1>
                <p className="lf-subtitle">Get ready. Your screen updates the moment the lesson begins.</p>
                <div className="lf-ready"><span className="lf-ready-dot" />You&apos;re connected</div>
              </>
            ) : (
              <>
                <h1 className="lf-wait">{emptyMessage}</h1>
                <div className="lf-switches">
                  <a className="lf-switch" href="/?leaveClass=1">Return to website</a>
                  <a className="lf-switch" href="/join?leaveClass=1">Join a different session</a>
                </div>
              </>
            )
          ) : linkedSpinnerMode && liveSessionId ? (
            <section className="lf-spinner-shell" aria-label="Classroom spinner synced with the main display">
              <ClassroomSpinner
                key={`${liveSessionId}:${spinnerSyncScope}:mirror`}
                mode={linkedSpinnerMode}
                sessionId={liveSessionId}
                syncKey={spinnerSyncKey}
                periodId={null}
                stateId={flow.state.id}
                syncScope={spinnerSyncScope}
                role="mirror"
                learningIntention={flow.lesson?.learningIntention}
                successCriterion={publicSuccessCriterion(flow.lesson?.selectedSuccessCriterion)}
              />
            </section>
          ) : (
            <>
            {!activePoll && <h1 className="lf-title">{title}</h1>}
            {!activePoll && subtitle && <p className="lf-subtitle">{subtitle}</p>}
            {!activePoll && phase?.id === "share" && phase.selectedSharer ? (
              <div className="lf-share"><span>Ready to share</span><strong>{phase.selectedSharer}</strong></div>
            ) : null}
            {!activePoll && phaseMedia && (
              <div className="lf-media-wrap">
                {phaseMedia.type === "video" ? (
                  <video className="lf-media" src={phaseMedia.url} autoPlay muted loop playsInline />
                ) : phaseMedia.type === "embed" ? (
                  <iframe
                    className="lf-media embed"
                    src={phaseMedia.url}
                    title={`${title} media`}
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <img className="lf-media" src={phaseMedia.url} alt="" />
                )}
              </div>
            )}
            {!activePoll && resource && (
              <section className="lf-resource" aria-label={resource.label}>
                {resourceNeedsIdentity && !resolvedResourceUrl ? (
                  <p className="lf-poll-help">Preparing your verified warm-up.</p>
                ) : embeddedResourceUrl ? (
                  <iframe className="lf-resource-frame" src={embeddedResourceUrl} title={resource.label} />
                ) : (
                  <a className="lf-resource-link" href={resolvedResourceUrl || resource.url} target="_blank" rel="noreferrer">{resource.label}</a>
                )}
              </section>
            )}
            {showActionBody ? <section className="lf-action" aria-label="Current action">{actionBody}</section> : null}
            {!activePoll && independentSupports.length > 0 ? (
              <section className="lf-independent-supports" aria-label="Independent work supports">
                {independentSupports.map((item) => (
                  <article className="lf-independent-card" key={item.label}>
                    <p className="lf-independent-label">{item.label}</p>
                    <p className="lf-independent-body">{item.body}</p>
                  </article>
                ))}
              </section>
            ) : null}
            {!activePoll && routineSupports.length > 0 ? (
              <section className="lf-independent-supports" aria-label="Current routine supports">
                {routineSupports.map((item) => (
                  <article className="lf-independent-card" key={item.label}>
                    <p className="lf-independent-label">{item.label}</p>
                    <p className="lf-independent-body">{item.body}</p>
                  </article>
                ))}
              </section>
            ) : null}
            {activePoll ? activePoll.stage === "responding" ? (
              <section className="lf-poll">
                {/* An inline structured-numeric step renders the equation WITH
                    its boxes below, so repeating the raw question here would
                    show the bracket placeholders twice. */}
                {numericInline ? null : <h1 className="lf-poll-question">{activePoll.question}</h1>}
                {joinHelpNeeded ? (
                  <div className="lf-join-help" role="status">
                    {joinHelpCode ? (
                      <p className="lf-join-help-copy">Tell your teacher this help code: <strong>{joinHelpCode}</strong>. Answer again once you are let in.</p>
                    ) : (
                      <>
                        <p className="lf-join-help-copy">Your teacher needs to let you in before answers save.</p>
                        <button className="lf-join-help-btn" type="button" disabled={joinHelpBusy} onClick={() => void requestAdmissionHelp()}>
                          {joinHelpBusy ? "Requesting" : "Ask for help"}
                        </button>
                      </>
                    )}
                  </div>
                ) : null}
                {activePoll.kind === "fist-to-five" ? (
                  <>
                    <p className="lf-poll-help">Choose the number that best shows where you are right now.</p>
                    <div className="lf-fist">
                      <div className="lf-fist-options" aria-label="Understanding from 0 to 5">
                        {[0, 1, 2, 3, 4, 5].map((value) => (
                          <button
                            className={`lf-fist-option${fistRating === value ? " selected" : ""}`}
                            type="button"
                            key={value}
                            aria-pressed={fistRating === value}
                            disabled={pollSubmitted || pollSaveState === "saving"}
                            onClick={() => {
                              setFistRating(value);
                              void submitPollAnswer(String(value));
                            }}
                          >
                            {value}
                          </button>
                        ))}
                      </div>
                      <div className="lf-fist-labels"><span>0 · Not yet</span><span>5 · Can explain</span></div>
                    </div>
                    {pollSubmitted ? <p className="lf-poll-sent">Check-in submitted.</p> : <p className="lf-poll-help">Tap one number to submit.</p>}
                    <p className="lf-poll-help">Only your teacher sees your number.</p>
                    {pollSubmitError && <p className="lf-poll-help">{pollSubmitError}</p>}
                  </>
                ) : activePoll.kind === "multiple-choice" ? (
                  <div className="lf-poll-choices">
                    {/* A multiple-choice step with no authored choices rendered an
                        empty box - indistinguishable from a frozen screen, and a
                        student has no way to tell the difference or report it. */}
                    {activePoll.choices?.length ? activePoll.choices.map((choice) => (
                      <button className="lf-poll-choice" key={choice} disabled={pollSubmitted || pollSaveState === "saving"} onClick={() => submitPollAnswer(choice)}>{choice}</button>
                    )) : <p className="lf-poll-help">This question has no answer choices yet. Tell your teacher.</p>}
                    {pollSubmitted && <p className="lf-poll-sent">Answer submitted.</p>}
                    {pollSubmitError && <p className="lf-poll-help">{pollSubmitError}</p>}
                  </div>
                ) : activePoll.kind === "multiple-choice-explain" ? (
                  <div className="lf-poll-choices">
                    {activePoll.choices?.map((choice) => (
                      <button
                        className={`lf-poll-choice${selectedChoice === choice ? " selected" : ""}`}
                        key={choice}
                        disabled={pollSubmitted || pollSaveState === "saving"}
                        onClick={() => setSelectedChoice(choice)}
                      >
                        {choice}
                      </button>
                    ))}
                    <textarea
                      className="lf-poll-text"
                      value={pollAnswer}
                      disabled={pollSubmitted}
                      onChange={(event) => setPollAnswer(event.target.value)}
                      placeholder="Explain your choice - name the method and what the answer means"
                    />
                    {pollSubmitted ? (
                      <p className="lf-poll-sent">Answer submitted.</p>
                    ) : (
                      <button
                        className="lf-poll-send"
                        disabled={pollSaveState === "saving" || !selectedChoice || !pollAnswer.trim()}
                        onClick={() => submitPollAnswer(selectedChoice, pollAnswer)}
                      >
                        Send answer
                      </button>
                    )}
                    {!pollSubmitted && (!selectedChoice || !pollAnswer.trim()) ? (
                      <p className="lf-poll-help">Pick one answer and write your explanation, then send.</p>
                    ) : null}
                    {pollSubmitError && <p className="lf-poll-help">{pollSubmitError}</p>}
                  </div>
                ) : isStructuredNumeric ? (
                  <div className="lf-numeric">
                    {numericInline ? (
                      <p className="lf-numeric-equation">
                        {numericSegments.map((segment, index) => (
                          <span className="lf-numeric-part" key={`segment-${index}`}>
                            {segment}
                            {index < numericBoxes.length ? renderNumericBox(index) : null}
                          </span>
                        ))}
                      </p>
                    ) : (
                      <div className="lf-numeric-stack">
                        {numericBoxes.map((_, index) => (
                          <span className="lf-numeric-cell" key={index}>
                            <span className="lf-numeric-label">Box {index + 1}</span>
                            {renderNumericBox(index)}
                          </span>
                        ))}
                      </div>
                    )}
                    {pollSubmitted ? (
                      <p className="lf-poll-sent">Answer submitted.</p>
                    ) : (
                      <button
                        className="lf-poll-send lf-numeric-send"
                        disabled={pollSaveState === "saving" || !numericComplete}
                        onClick={submitNumericBoxes}
                      >
                        Send answer
                      </button>
                    )}
                    {!pollSubmitted && !numericComplete ? (
                      <p className="lf-poll-help">Fill in every box, then send.</p>
                    ) : null}
                    {pollSubmitError && <p className="lf-poll-help">{pollSubmitError}</p>}
                  </div>
                ) : (
                  <div className="lf-poll-entry">
                    <textarea className="lf-poll-text" value={pollAnswer} disabled={pollSubmitted} onChange={(event) => setPollAnswer(event.target.value)} placeholder="Type your answer" />
                    {pollSubmitted ? <p className="lf-poll-sent">Answer submitted.</p> : <button className="lf-poll-send" disabled={pollSaveState === "saving"} onClick={() => submitPollAnswer(pollAnswer)}>Send answer</button>}
                    {pollSubmitError && <p className="lf-poll-help">{pollSubmitError}</p>}
                  </div>
                )}
                <p className="lf-poll-save-state" role="status">{pollSaveLabel}</p>
              </section>
            ) : (
              <section className="lf-poll">
                {/* Honest copy either way: a student who never answered must
                    not be told their response was received. */}
                <h1 className="lf-poll-question">{pollSubmitted ? "Response received" : "Eyes up"}</h1>
                <p className="lf-poll-help">{pollSubmitted ? "Look at the Pace + Support screen for the class view." : "Your class is reviewing this question on the board."}</p>
              </section>
            ) : null}
            {!activePoll && discussion?.directions && (
              <ul className="lf-directions">
                {discussion.directions.map((direction) => <li className="lf-direction" key={direction}>{direction}</li>)}
              </ul>
            )}
            {showDiscussionSupports && (
              <section className="lf-supports" aria-label="Discussion supports">
                {sentenceStems.length > 0 && (
                  <div className="lf-support-panel">
                    <h2 className="lf-support-title">Sentence Stems</h2>
                    <ul className="lf-stem-list">
                      {sentenceStems.map((stem) => <li className="lf-stem" key={stem}>{stem}</li>)}
                    </ul>
                  </div>
                )}
                {keyVocabulary.length > 0 && (
                  <div className="lf-support-panel">
                    <h2 className="lf-support-title">Key Vocabulary</h2>
                    <ul className="lf-vocab-list">
                      {keyVocabulary.map((word) => <li className="lf-vocab" key={word}>{word}</li>)}
                    </ul>
                  </div>
                )}
              </section>
            )}
            </>
          )}
        </div>
        {signalsEnabled && hasStudentSession && flow?.state ? (
          <div className="lf-signals" aria-label="Tell your teacher how it is going">
            <button
              type="button"
              className={`lf-signal stuck${mySignal === "stuck" ? " on" : ""}`}
              aria-pressed={mySignal === "stuck"}
              disabled={signalBusy || signalCooldown}
              onClick={() => void sendSignal("stuck")}
            >
              I&apos;m stuck
            </button>
            <button
              type="button"
              className={`lf-signal again${mySignal === "again" ? " on" : ""}`}
              aria-pressed={mySignal === "again"}
              disabled={signalBusy || signalCooldown}
              onClick={() => void sendSignal("again")}
            >
              Say that again
            </button>
            <button
              type="button"
              className={`lf-signal gotit${mySignal === "got-it" ? " on" : ""}`}
              aria-pressed={mySignal === "got-it"}
              disabled={signalBusy || signalCooldown}
              onClick={() => void sendSignal("got-it")}
            >
              I&apos;ve got this
            </button>
            {signalError ? (
              <span className="lf-signal-note failed" role="status">
                {signalError}
                {joinHelpCode ? (
                  <> Help code: <strong>{joinHelpCode}</strong>.</>
                ) : joinHelpNeeded ? (
                  <button className="lf-signal-help" type="button" disabled={joinHelpBusy} onClick={() => void requestAdmissionHelp()}>
                    {joinHelpBusy ? "Requesting" : "Ask for help"}
                  </button>
                ) : null}
              </span>
            ) : mySignal ? <span className="lf-signal-note" role="status">Only your teacher sees this.</span> : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}
