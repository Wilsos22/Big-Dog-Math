/**
 * Gallery Walk rotation timer — config-driven, not authored text.
 *
 * WHY THIS EXISTS (Steele, Feature Tracker "New State for State bank-Gallery
 * walk", Priority Now, Status "Needs revision", 2026-08-05 verbatim spec):
 * "make a classroom state option for gallery walks which is divided up into
 * 8 chunks. make it default 30 seconds with a countdown for the last 10 with
 * beeps so they know they need to write their thoughts on the gallery work,
 * then move to the next one, same process 4 times. then make the final timer
 * 15 seconds for them to be in their seats eyes up."
 *
 * THE AMBIGUITY IS SETTLED — IT IS AUTHORABLE PER LESSON (Steele, 2026-08-06).
 * The spec names two chunk counts in one breath ("8 chunks", "same process 4
 * times") because neither is a property of gallery walks in general: it is a
 * property of the ROOM Steele set up that day. So the count is not a constant
 * this file gets to pick. `GalleryWalkRoutineConfig.stationCount` — already
 * shipped, already authored in the Studio editor, already validated 1-20, and
 * already published to every surface — IS the source of truth, and
 * `galleryWalkPhasesFromRoutine` below is the only entry point the surfaces use.
 *
 * UNITS. The authored config carries `rotationMinutes` (0.5-60); this engine
 * counts in `stationSeconds`. There is no mismatch to legislate around:
 * 0.5 minutes IS 30 seconds, so the field Steele already has expresses his
 * stated default exactly. `stationSeconds = round(rotationMinutes * 60)`. No
 * second competing "rotationSeconds" field is added, because an existing field
 * already says the thing.
 *
 * WHAT STAYS A DEFAULT. The two numbers in the spec that are NOT room layout —
 * a 10-second beep window at the end of each station, and a 15-second closing
 * "in your seats, eyes up" — stay as defaults here, overridable per call.
 *
 * DEFAULT_GALLERY_CHUNK_COUNT / DEFAULT_GALLERY_STATION_SECONDS are now ONLY a
 * fallback for the case where no config was authored at all (a `gallery-walk`
 * step whose snapshot carries no routineConfig). They are not a source of truth
 * and no render surface reaches them: the surfaces render the timeline only when
 * an authored gallery-walk config is present, so an unauthored step keeps
 * today's static text rather than silently running a guessed clock.
 *
 * PATTERN: copies discussionPhases.ts on purpose. A pure function of the
 * STATE's own elapsed/remaining seconds (liveTimerSeconds) — no independent
 * `endsAt`, no new Supabase column, no new sync channel. `galleryWalkStageCountdown`
 * mirrors `discussionStageCountdown` field-for-field so a wiring pass drops it
 * in next to the existing discussion branch on every surface instead of
 * inventing a new one.
 */

export const DEFAULT_GALLERY_STATION_SECONDS = 30;
export const DEFAULT_GALLERY_BEEP_WINDOW_SECONDS = 10;
export const DEFAULT_GALLERY_FINAL_SECONDS = 15;
/** FALLBACK ONLY — see the file header. The authored `stationCount` is the
 * source of truth; this is what an unauthored step would get, and no render
 * surface reaches it. Never hardcode it at a call site. */
export const DEFAULT_GALLERY_CHUNK_COUNT = 8;
export const MIN_GALLERY_CHUNKS = 1;
/** Matches lessonRoutineConfig.ts's MAX_STATIONS so the two systems can converge later without a range mismatch. */
export const MAX_GALLERY_CHUNKS = 20;

/** Configurable inputs. Only `chunkCount` is required — everything else falls
 * back to Steele's stated defaults (30s station, 10s beep window, 15s final). */
export interface GalleryWalkTimerConfig {
  chunkCount: number;
  stationSeconds?: number;
  beepWindowSeconds?: number;
  finalSeconds?: number;
}

export type GalleryWalkPhaseKind = "station" | "final";

export interface GalleryWalkPhase {
  kind: GalleryWalkPhaseKind;
  /** 0-based station index; equals chunkCount for the trailing final phase. */
  index: number;
  seconds: number;
  label: string;
  direction: string;
}

export type GalleryWalkPhasesResult =
  | {
      ok: true;
      phases: GalleryWalkPhase[];
      totalSeconds: number;
      chunkCount: number;
      /** The window this sequence was built with. Carried on the result so a
       * caller passes the SAME number into `galleryWalkStageCountdown` instead
       * of re-deriving it and quietly beeping on a different schedule. */
      beepWindowSeconds: number;
    }
  | { ok: false; error: string };

/**
 * Build the station-by-station sequence: `chunkCount` stations of
 * `stationSeconds` each, then one trailing "back in your seats" phase of
 * `finalSeconds` (omitted if `finalSeconds` is 0). Every problem is reported
 * with its offending value, same spirit as `parseDiscussionPhases` — a
 * misconfigured gallery walk must refuse to run rather than run wrong.
 */
export function buildGalleryWalkPhases(config: GalleryWalkTimerConfig): GalleryWalkPhasesResult {
  const chunkCount = Math.round(config.chunkCount);
  if (!Number.isFinite(chunkCount) || chunkCount < MIN_GALLERY_CHUNKS || chunkCount > MAX_GALLERY_CHUNKS) {
    return { ok: false, error: `chunkCount must be a whole number from ${MIN_GALLERY_CHUNKS} to ${MAX_GALLERY_CHUNKS}.` };
  }
  const stationSeconds = config.stationSeconds ?? DEFAULT_GALLERY_STATION_SECONDS;
  const beepWindowSeconds = config.beepWindowSeconds ?? DEFAULT_GALLERY_BEEP_WINDOW_SECONDS;
  const finalSeconds = config.finalSeconds ?? DEFAULT_GALLERY_FINAL_SECONDS;
  if (!Number.isFinite(stationSeconds) || stationSeconds <= 0) {
    return { ok: false, error: "stationSeconds must be greater than 0." };
  }
  if (!Number.isFinite(beepWindowSeconds) || beepWindowSeconds < 0) {
    return { ok: false, error: "beepWindowSeconds must be 0 or greater." };
  }
  if (beepWindowSeconds > stationSeconds) {
    return { ok: false, error: "beepWindowSeconds cannot be longer than stationSeconds - the beep window has to fit inside the station." };
  }
  if (!Number.isFinite(finalSeconds) || finalSeconds < 0) {
    return { ok: false, error: "finalSeconds must be 0 or greater." };
  }

  const phases: GalleryWalkPhase[] = [];
  for (let index = 0; index < chunkCount; index += 1) {
    phases.push({
      kind: "station",
      index,
      seconds: stationSeconds,
      label: `Station ${index + 1} of ${chunkCount}`,
      direction: index === chunkCount - 1
        ? "Write your thoughts on the gallery work."
        : "Write your thoughts on the gallery work, then move to the next one.",
    });
  }
  if (finalSeconds > 0) {
    phases.push({
      kind: "final",
      index: chunkCount,
      seconds: finalSeconds,
      label: "Back in your seats",
      direction: "Back in your seats, eyes up.",
    });
  }
  const totalSeconds = phases.reduce((sum, phase) => sum + phase.seconds, 0);
  return { ok: true, phases, totalSeconds, chunkCount, beepWindowSeconds };
}

/**
 * The authored shape this engine reads, declared structurally rather than
 * imported. `GalleryWalkRoutineConfig` from lessonRoutineConfig.ts satisfies it
 * as-is, but keeping the dependency one-way means the contract can still
 * compile this module on its own — the same reason discussionPhases.ts imports
 * only a type from its neighbour.
 */
export interface GalleryWalkRoutineSource {
  stationCount: number;
  rotationMinutes: number;
}

/**
 * THE ENTRY POINT EVERY SURFACE USES. Stations and station length come from the
 * lesson's authored Gallery Walk config; the beep window and the closing
 * seats-check stay at Steele's stated defaults unless a caller says otherwise.
 *
 * `rotationMinutes` -> `stationSeconds` is a plain x60 (0.5 minutes = his 30
 * seconds). The beep window is CLAMPED to the station rather than rejected: the
 * authored range already floors a rotation at 0.5 minutes, so the clamp can only
 * ever fire on a malformed snapshot, and a gallery walk that beeps a little
 * early is a better failure than a projector that renders an error card.
 *
 * A null/absent config falls back to the header's documented defaults. That
 * path exists so the engine is total, NOT so a surface can lean on it — see the
 * header.
 */
export function galleryWalkPhasesFromRoutine(
  routine: GalleryWalkRoutineSource | null | undefined,
  overrides: { beepWindowSeconds?: number; finalSeconds?: number } = {},
): GalleryWalkPhasesResult {
  const chunkCount = routine ? routine.stationCount : DEFAULT_GALLERY_CHUNK_COUNT;
  const stationSeconds = routine
    ? Math.round(routine.rotationMinutes * 60)
    : DEFAULT_GALLERY_STATION_SECONDS;
  const requestedBeepWindow = overrides.beepWindowSeconds ?? DEFAULT_GALLERY_BEEP_WINDOW_SECONDS;
  const beepWindowSeconds = Number.isFinite(stationSeconds) && stationSeconds > 0
    ? Math.min(requestedBeepWindow, stationSeconds)
    : requestedBeepWindow;
  return buildGalleryWalkPhases({
    chunkCount,
    stationSeconds,
    beepWindowSeconds,
    finalSeconds: overrides.finalSeconds ?? DEFAULT_GALLERY_FINAL_SECONDS,
  });
}

/** Minutes the built sequence needs, rounded up — mirrors discussionPhaseMinutes. */
export function galleryWalkMinutes(totalSeconds: number): number {
  return Math.ceil(totalSeconds / 60);
}

export interface GalleryWalkProgress {
  /** Active phase index, or phases.length once every phase is done. */
  index: number;
  /** Seconds into the active phase (0 when done). */
  phaseElapsed: number;
  /** 0-1 fill of the active phase (1 when done). */
  phaseFraction: number;
  /** Every phase is complete. */
  done: boolean;
}

/**
 * Map elapsed seconds onto the built sequence: which phase is live, and how
 * far into it. Pure, mirrors `activeDiscussionPhase` exactly, so it is pinned
 * the same way by a contract test.
 */
export function activeGalleryWalkPhase(
  phases: readonly GalleryWalkPhase[],
  elapsedSeconds: number,
): GalleryWalkProgress {
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

export interface GalleryWalkStageCountdown {
  /** Active phase index, or phases.length once every phase is done. */
  index: number;
  /** The active phase, or null when the whole sequence is done. */
  phase: GalleryWalkPhase | null;
  /** Whole seconds left IN THE ACTIVE PHASE (not the whole state), floored at 0. */
  secondsLeft: number;
  /** 0-1 fill of the active phase. */
  fraction: number;
  /** True inside a station's final `beepWindowSeconds` - drives the once-per-
   * second beep. Never true during the trailing "eyes up" final phase - the
   * spec asks for beeps on the station countdown, not the seat-check timer. */
  beeping: boolean;
  /** Every phase is complete. */
  done: boolean;
}

/**
 * The current phase's REMAINING seconds, derived from the STATE's own clock -
 * the same primitive as `discussionStageCountdown`: elapsed = the state's
 * total minus its seconds left, mapped into the built phases. No independent
 * deadline. Returns null when there are no phases, so a caller falls back to
 * the plain state timer.
 */
export function galleryWalkStageCountdown(
  phases: readonly GalleryWalkPhase[],
  totalSeconds: number,
  stateSecondsLeft: number,
  beepWindowSeconds: number = DEFAULT_GALLERY_BEEP_WINDOW_SECONDS,
): GalleryWalkStageCountdown | null {
  if (!phases.length) return null;
  const elapsed = Math.max(0, totalSeconds - Math.max(0, stateSecondsLeft));
  const progress = activeGalleryWalkPhase(phases, elapsed);
  if (progress.done) {
    return { index: phases.length, phase: null, secondsLeft: 0, fraction: 1, beeping: false, done: true };
  }
  const phase = phases[progress.index] ?? null;
  const secondsLeft = phase ? Math.max(0, Math.ceil(phase.seconds - progress.phaseElapsed)) : 0;
  const beeping = Boolean(phase) && phase.kind === "station" && secondsLeft > 0 && secondsLeft <= beepWindowSeconds;
  return { index: progress.index, phase, secondsLeft, fraction: progress.phaseFraction, beeping, done: false };
}
