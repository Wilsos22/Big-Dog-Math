/**
 * Authored discussion phases.
 *
 * WHY THIS EXISTS (Steele, 2026-07-29). Discussions are not one shape. An error
 * clinic, a respectful-difference round, a whiteboard consensus and a share-out
 * are different sequences, so the fixed three-round protocol in
 * `discussionProtocol.ts` - three rounds, 120 seconds each, fixed labels - is the
 * wrong abstraction to force on all of them.
 *
 * What IS invariant is the thing that makes a discussion work at all: every beat
 * has its OWN TIMER and ONE CLEAR DIRECTION. When to think, when to write, when
 * to talk, when to listen, in whatever order that discussion needs. So the
 * sequence is authored per step and the runtime just walks it.
 *
 * FORMAT - one phase per line in the Lesson Step's `Discussion Phases` text
 * property, same spirit as `Help Path` and the structured-numeric answer spec:
 *
 *     think 60 | Look at both boards. What is different about them?
 *     talk 120 | Explain your split to your partner.
 *     write 90 | Write the version you now believe, and why.
 *     listen 60 | Track whoever is sharing. Be ready to add on.
 *
 * `<mode> <duration> | <direction>`. Mode is one of think / write / talk /
 * listen. Duration is seconds (`90`), or `90s`, or `2m`. The direction after the
 * pipe is required, because the mode word alone does not tell a student what to
 * do about THIS problem - the mode drives the behaviour cue, the sentence
 * carries the task.
 *
 * A step with an empty property runs the legacy three-round protocol unchanged,
 * so nothing that exists today changes shape. A property that will not parse
 * FAILS LOUDLY in the /control load message rather than silently falling back,
 * because a discussion that quietly becomes a different discussion is worse than
 * one that refuses to start.
 *
 * `npm run test:discussion-phases` is the contract.
 */

// Relative, not "@/lib/...": the contract compiles this module in isolation with
// --ignoreConfig, which drops the path aliases. Same reason distributiveWalkthrough
// and liveFlowPrivacy import their neighbours this way.
import type { ClassroomStateStrip } from "./classroomStateStrip";

export const DISCUSSION_MODES = ["think", "write", "talk", "listen"] as const;
export type DiscussionMode = (typeof DISCUSSION_MODES)[number];

/** Longest a single beat may be. A ten-minute "beat" is a missing sequence. */
export const MAX_PHASE_SECONDS = 600;
/** Shortest useful beat. Below this nobody has done anything. */
export const MIN_PHASE_SECONDS = 15;
export const MAX_PHASES = 8;

export interface AuthoredDiscussionPhase {
  mode: DiscussionMode;
  seconds: number;
  direction: string;
}

export type DiscussionPhaseParse =
  | { ok: true; phases: AuthoredDiscussionPhase[]; totalSeconds: number }
  | { ok: false; errors: string[] };

/**
 * The behaviour cue each mode implies, as a partial state strip.
 *
 * A discussion beat and a state-strip entry are THE SAME PRIMITIVE - a beat is a
 * strip state plus a timer plus a direction - so the mode drives the strip
 * instead of the teacher authoring the two separately and them disagreeing.
 * Only `eyes` and `voice` are implied; `supplies` and `body` stay whatever the
 * step authored, because a discussion does not change what is in their hands.
 *
 * `talk` maps to table level rather than partner level because it is the general
 * "you are talking with people" state; a partner-only beat says so in its
 * direction, and the iPad override can drop the room to voice 1 or 0 live.
 */
export const DISCUSSION_MODE_STRIP: Record<DiscussionMode, Pick<ClassroomStateStrip, "eyes" | "voice">> = {
  think: { eyes: "Own paper", voice: "0 silent" },
  write: { eyes: "Own paper", voice: "0 silent" },
  talk: { eyes: "The speaker", voice: "2 table" },
  listen: { eyes: "The speaker", voice: "0 silent" },
};

/** The word shown as the beat's label. Fixed vocabulary - four words, always. */
export const DISCUSSION_MODE_LABEL: Record<DiscussionMode, string> = {
  think: "Think",
  write: "Write",
  talk: "Talk",
  listen: "Listen",
};

function parseDuration(raw: string): number | null {
  const match = /^(\d{1,4})(s|m)?$/i.exec(raw.trim());
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  return match[2]?.toLowerCase() === "m" ? value * 60 : value;
}

/**
 * Parse the authored property. Returns every problem it found rather than the
 * first, so a teacher fixing a lesson sees the whole list in one pass.
 */
export function parseDiscussionPhases(raw: string | null | undefined): DiscussionPhaseParse {
  const lines = (raw || "")
    .split(/\r?\n/)
    // Notion ESCAPES the pipe to "\|" in a text property (it reads "|" as a
    // markdown table delimiter). The app's plain_text can carry that backslash
    // through, which would split the head into three tokens and fail every
    // authored beat. Strip it here, the way parseHelpPath strips "\[".
    .map((line) => line.trim().replace(/\\\|/g, "|"))
    .filter(Boolean);
  if (!lines.length) return { ok: true, phases: [], totalSeconds: 0 };

  const errors: string[] = [];
  const phases: AuthoredDiscussionPhase[] = [];

  if (lines.length > MAX_PHASES) {
    errors.push(`${lines.length} phases authored; the most a discussion may have is ${MAX_PHASES}.`);
  }

  lines.forEach((line, index) => {
    const where = `line ${index + 1}`;
    const pipe = line.indexOf("|");
    if (pipe < 0) {
      errors.push(`${where}: no "|" found. Write "<mode> <seconds> | <what students do>".`);
      return;
    }
    const head = line.slice(0, pipe).trim().split(/\s+/);
    const direction = line.slice(pipe + 1).trim();
    if (head.length !== 2) {
      errors.push(`${where}: expected a mode and a duration before the "|", found "${line.slice(0, pipe).trim()}".`);
      return;
    }
    const [modeRaw, durationRaw] = head;
    const mode = DISCUSSION_MODES.find((candidate) => candidate === modeRaw.toLowerCase());
    if (!mode) {
      errors.push(`${where}: "${modeRaw}" is not a mode. Use one of ${DISCUSSION_MODES.join(", ")}.`);
      return;
    }
    const seconds = parseDuration(durationRaw);
    if (seconds === null) {
      errors.push(`${where}: "${durationRaw}" is not a duration. Use seconds (90), or 90s, or 2m.`);
      return;
    }
    if (seconds < MIN_PHASE_SECONDS || seconds > MAX_PHASE_SECONDS) {
      errors.push(`${where}: ${seconds}s is outside ${MIN_PHASE_SECONDS}-${MAX_PHASE_SECONDS}s.`);
      return;
    }
    if (!direction) {
      errors.push(`${where}: every phase needs a direction after the "|" - the mode word alone does not tell a student what to do.`);
      return;
    }
    phases.push({ mode, seconds, direction });
  });

  if (errors.length) return { ok: false, errors };
  return { ok: true, phases, totalSeconds: phases.reduce((sum, phase) => sum + phase.seconds, 0) };
}

/**
 * Minutes the authored sequence needs, rounded up. Compared against the step's
 * own Duration by the /control load message: a discussion whose phases outrun
 * its step is how a 50-minute plan becomes a 55-minute plan.
 */
export function discussionPhaseMinutes(totalSeconds: number): number {
  return Math.ceil(totalSeconds / 60);
}

export interface DiscussionPhaseProgress {
  /** Active phase index, or phases.length once the whole sequence is done. */
  index: number;
  /** Seconds into the active phase (0 when done). */
  phaseElapsed: number;
  /** 0-1 fill of the active phase (1 when done). */
  phaseFraction: number;
  /** Every phase is complete. */
  done: boolean;
}

/**
 * Map elapsed seconds onto the authored sequence: which phase is live, and how
 * far into it. This is the whole engine behind the self-running timeline - one
 * screen of bars that walks itself, driven by the step's shared clock so every
 * device agrees. Pure, so the contract can pin it.
 */
export function activeDiscussionPhase(
  phases: readonly AuthoredDiscussionPhase[],
  elapsedSeconds: number,
): DiscussionPhaseProgress {
  const elapsed = Math.max(0, elapsedSeconds);
  let acc = 0;
  for (let index = 0; index < phases.length; index += 1) {
    const seconds = phases[index].seconds;
    if (elapsed < acc + seconds) {
      const phaseElapsed = elapsed - acc;
      return { index, phaseElapsed, phaseFraction: seconds > 0 ? phaseElapsed / seconds : 1, done: false };
    }
    acc += seconds;
  }
  return { index: phases.length, phaseElapsed: 0, phaseFraction: 1, done: true };
}

/** The strip for a beat: the step's authored strip with the mode's cue applied. */
export function stripForPhase(
  strip: ClassroomStateStrip | null,
  phase: AuthoredDiscussionPhase | null | undefined,
): ClassroomStateStrip | null {
  if (!strip) return null;
  if (!phase) return strip;
  return { ...strip, ...DISCUSSION_MODE_STRIP[phase.mode] };
}
