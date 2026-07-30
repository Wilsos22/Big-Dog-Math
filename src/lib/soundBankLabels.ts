"use client";

// What the sound bank buttons are called, and how that name reaches the iPad.
//
// THE PROBLEM THIS SOLVES. Clips are loaded on /control, because that is the
// machine with the speakers - but the buttons are pressed on /teacher/remote,
// on the iPad. Renaming "Buzzer" to "Airhorn" on the laptop is useless if the
// iPad still says Buzzer, and asking Steele to type the name twice is worse.
//
// So the labels ride the same reference-counted broadcast room the ink surface
// uses (realtimeRooms.ts). Control owns them and answers `hello` with the whole
// set; the Remote asks on mount and caches what it hears in localStorage, so the
// deck reads correctly on the next load even before Control replies - or if
// Control is not open yet.
//
// NO SERVER STATE. No table, no column, no migration, nothing to gate. A button
// name is not classroom data and does not belong in the session snapshot, which
// Control full-replaces about once a second.
//
// A cue with no custom name falls back to its built-in label, so the deck is
// never blank and nothing here is required for the bank to work.
//
// PURE ON PURPOSE - no transport import. Its contract compiles this file in
// isolation (tsc --ignoreConfig drops the "@/" aliases), so the room NAME lives
// here as data and the two callers do the joining with joinRealtimeRoom.

// One teacher, one bank: the room is not per session, because the names outlive
// any single class and the Remote may open before a session exists.
export const SOUND_LABEL_ROOM = "soundbank";
const STORAGE_KEY = "bdm-sound-labels";

// Long enough for "Sad trombone" and short enough that a renamed key still fits
// the deck without reflowing it.
export const MAX_SOUND_LABEL = 22;

export type SoundLabelMessage =
  | { t: "hello" }
  | { t: "labels"; labels: Record<string, string> };

export type SoundLabels = Record<string, string>;

/** Trim, collapse whitespace, cap length. An empty result means "no custom name". */
export function normalizeSoundLabel(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_SOUND_LABEL);
}

export function normalizeSoundLabels(input: unknown): SoundLabels {
  if (!input || typeof input !== "object") return {};
  const out: SoundLabels = {};
  for (const [id, value] of Object.entries(input as Record<string, unknown>)) {
    if (typeof value !== "string") continue;
    const label = normalizeSoundLabel(value);
    if (label) out[id] = label;
  }
  return out;
}

export function readStoredSoundLabels(): SoundLabels {
  if (typeof localStorage === "undefined") return {};
  try {
    return normalizeSoundLabels(JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"));
  } catch {
    return {};
  }
}

export function writeStoredSoundLabels(labels: SoundLabels): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(labels));
  } catch {
    // A full or blocked store just means the name does not survive a reload.
  }
}

/** The name to show for a cue: the teacher's, or the cue's own. */
export function soundLabelFor(cueId: string, builtIn: string, labels: SoundLabels): string {
  return labels[cueId] || builtIn;
}
