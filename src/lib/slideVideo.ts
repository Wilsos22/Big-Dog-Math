// The teacher's play / pause / restart taps for a video on the main projector.
//
// These are NOT flow actions. They change nothing about the lesson - no step advances, no timer
// moves, nothing is published - so they never touch `live_flow`. They ride the ordinary
// `sessions.remote_command` pass-through, exactly like `spin-speaker`, and the projector picks them
// up off the session row it already polls.
//
// Framework-free and import-free so both the server route and the client surfaces can take it.

export const SLIDE_VIDEO_ACTIONS = [
  "slide-video-play",
  "slide-video-pause",
  "slide-video-restart",
] as const;

export type SlideVideoAction = (typeof SLIDE_VIDEO_ACTIONS)[number];

export interface SlideVideoCommand {
  action: SlideVideoAction;
  // Every remote command carries one. It is the idempotency key: the projector re-reads the session
  // row about once a second and would otherwise replay the same tap on every tick.
  nonce: string;
}

export function isSlideVideoAction(action: string | null | undefined): action is SlideVideoAction {
  return SLIDE_VIDEO_ACTIONS.includes(String(action) as SlideVideoAction);
}

/**
 * Narrow a raw `sessions.remote_command` to a video command, or null.
 *
 * NOT NAMED `play-*` ON PURPOSE, and this is load-bearing twice over. `remoteCommandPing.ts`
 * lets a `play-` action fire straight off an unverified realtime broadcast - correct for a sound
 * cue, where a duplicate is harmless - and `sound-bank-contract.mjs` asserts every `play-` action
 * resolves to a real audio cue, which these never would. Verb last keeps both rules intact.
 */
export function slideVideoCommandFrom(raw: unknown): SlideVideoCommand | null {
  if (!raw || typeof raw !== "object") return null;
  const command = raw as { action?: unknown; nonce?: unknown };
  if (!isSlideVideoAction(typeof command.action === "string" ? command.action : null)) return null;
  const nonce = typeof command.nonce === "string" ? command.nonce : "";
  if (!nonce) return null;
  return { action: command.action as SlideVideoAction, nonce };
}
