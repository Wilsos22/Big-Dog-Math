import type { TeacherRemoteAction } from "@/lib/liveClassFlow";
import type { StateStripSlot } from "@/lib/classroomStateStrip";
import { SOUND_CUES, soundCueAction } from "@/lib/soundBank";

// Extra fields sent with the command body. Mostly flat (transition-now's
// vibe/seconds); `behavior` carries a classroom-state-strip override, which is a
// nested object because the server applies the named slots and leaves the rest
// of the authored strip alone.
export type RemoteDeckPayload = {
  [key: string]: string | number | Partial<Record<StateStripSlot, string>> | undefined;
};

export interface RemoteDeckButton {
  action: TeacherRemoteAction;
  label: string;
  detail: string;
  tone: string;
  payload?: RemoteDeckPayload;
}

/**
 * Live classroom-state overrides, for Settle 30s and the moments the plan did
 * not predict. Deliberately short: the voice level is what actually breaks
 * mid-class, and supplies is the other one worth a tap. Everything else stays
 * authored, because the strip working automatically is the whole point.
 *
 * Each override expires when the lesson advances, so none of these needs an
 * explicit undo - but Back to the plan is there for the teacher who wants it.
 */
export const BEHAVIOR_OVERRIDE_BUTTONS: readonly RemoteDeckButton[] = [
  { action: "set-behavior", label: "Voice 0", detail: "Silent, right now", tone: "orange", payload: { behavior: { voice: "0 silent" } } },
  { action: "set-behavior", label: "Voice 1", detail: "Partner only", tone: "teal", payload: { behavior: { voice: "1 partner" } } },
  { action: "set-behavior", label: "Voice 2", detail: "Table talk", tone: "teal", payload: { behavior: { voice: "2 table" } } },
  { action: "set-behavior", label: "Hands off", detail: "Supplies parked flat", tone: "orange", payload: { behavior: { supplies: "Parked flat" } } },
  { action: "clear-behavior", label: "Back to the plan", detail: "Drop the override", tone: "green" },
];

// Ad-hoc movement windows: music plays, the state clock pauses, and the room
// gets a short countdown before the lesson resumes where it was.
export const TRANSITION_NOW_BUTTONS: readonly RemoteDeckButton[] = [
  { action: "transition-now", label: "Hustle 15s", detail: "Quick move", tone: "orange", payload: { vibe: "hustle", seconds: 15 } },
  { action: "transition-now", label: "Hustle 30s", detail: "Task switch", tone: "orange", payload: { vibe: "hustle", seconds: 30 } },
  { action: "transition-now", label: "Settle 30s", detail: "Bring it down", tone: "teal", payload: { vibe: "settle", seconds: 30 } },
];

// On-demand cold-call. Persistent on the deck (unlike the readers/iPad-Kid Spin,
// which only appears on those slides): tap it in any state and the main projector
// spins to one student. Fair rotation and the FERPA first-name lookup live on the
// projector; this button is just the trigger.
export const SPEAKER_REMOTE_BUTTON: RemoteDeckButton = {
  action: "spin-speaker",
  label: "Pick a speaker",
  detail: "Random student to share",
  tone: "teal",
};

/**
 * The sound bank, which took the Abbie AI deck's place (Steele, 2026-07-29:
 * applause, and a sad trombone for the question that gets silence).
 *
 * DERIVED from SOUND_CUES rather than written out here. A second hand-kept list
 * of these ids is exactly how /api/teacher/poll silently stored every
 * multiple-choice-explain poll as a short answer, so the cue id, the label and
 * the sound all live in src/lib/soundBank.ts and this file only decides where
 * they sit on the deck. The action cast is the one seam: soundBank imports
 * nothing local (its contract compiles it in isolation), so it cannot name
 * TeacherRemoteAction itself - npm run test:sound-bank is what proves every
 * `play-<id>` here is really in the union.
 */
export const SOUND_BANK_REMOTE_BUTTONS: readonly RemoteDeckButton[] = SOUND_CUES.map((cue) => ({
  action: soundCueAction(cue.id) as TeacherRemoteAction,
  label: cue.label,
  detail: cue.detail,
  tone: cue.tone,
}));

// Control's own timer cue sounds - separate from the sound bank on purpose:
// these are the countdown cues every timer already uses, and Steele can upload
// his own file per cue on the /control sound panel.
export const SOUND_REMOTE_BUTTONS: readonly RemoteDeckButton[] = [
  {
    action: "play-warning",
    label: "30 second alert",
    detail: "Play the warning cue",
    tone: "gold",
  },
  {
    action: "play-countdown",
    label: "Countdown tick",
    detail: "Play one tick",
    tone: "blue",
  },
  {
    action: "play-times-up",
    label: "Time is up",
    detail: "Play the ending cue",
    tone: "red",
  },
];
