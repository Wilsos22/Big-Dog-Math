import type { TeacherRemoteAction } from "@/lib/liveClassFlow";
import type { StateStripSlot } from "@/lib/classroomStateStrip";

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

export interface AbbieRemoteDeckButton extends RemoteDeckButton {
  direction: string;
}

export const ABBIE_REMOTE_BUTTONS: readonly AbbieRemoteDeckButton[] = [
  {
    action: "abbie-hype",
    label: "Hype us up",
    detail: "Start with energy",
    tone: "orange",
    direction: "Pump up the class. We are about to get into it. Bring real energy and keep it short.",
  },
  {
    action: "abbie-goal",
    label: "Today's goal",
    detail: "Explain the purpose",
    tone: "teal",
    direction: "Tell the class what we are working on today and why it is worth their time. Use the learning intention and make it land.",
  },
  {
    action: "abbie-move",
    label: "Move us on",
    detail: "Transition the room",
    tone: "blue",
    direction: "Wrap up what we are doing and push the class to the next thing. Keep it moving.",
  },
  {
    action: "abbie-settle",
    label: "Settle the room",
    detail: "Refocus students",
    tone: "gold",
    direction: "The room is getting loud. Pull them back and refocus them. Be deadpan, not a nag.",
  },
  {
    action: "abbie-roast",
    label: "Roast dad",
    detail: "One clean joke",
    tone: "purple",
    direction: "Roast dad for the class about something true, such as the Red Bulls, dancing, slang, or his knees. One clean burn.",
  },
  {
    action: "abbie-stuck",
    label: "We are stuck",
    detail: "Encourage persistence",
    tone: "green",
    direction: "The class is stuck and getting frustrated. Remind them that being confused is step one and nudge them to try something.",
  },
];

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

export function abbieDirectionForRemoteAction(action: TeacherRemoteAction): string | null {
  return ABBIE_REMOTE_BUTTONS.find((button) => button.action === action)?.direction ?? null;
}
