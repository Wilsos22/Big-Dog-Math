// Telling Control a Remote command is waiting, without making it wait a tick.
//
// The iPad sends `play-<id>`; the server writes it to sessions.remote_command;
// Control notices on its next 1.2s poll and plays the clip through the
// classroom speakers. Averaged over a press that is about 600ms of lag and
// worst-cases at 1.2s - fine for applause, wrong for a rimshot, which only
// works if it lands on the beat (Steele, 2026-07-30: "it needs less lag").
//
// So the write also pings this room and Control reacts immediately.
//
// TWO KINDS OF ACTION, AND THEY ARE NOT TREATED ALIKE. A ping is an unverified
// message on a broadcast channel: it can arrive twice, out of order, or from a
// stale sender. For a SOUND that is harmless - the worst case is a clip that
// plays a beat early or twice, and the nonce guard on the Control side stops
// even that. For anything that moves the lesson it is not: a duplicated `next`
// skips a step of a real class. So a ping may PLAY a sound directly, and for
// everything else it may only prompt Control to re-read the authoritative
// session row a second sooner. The server stays the only thing that decides
// what the lesson is doing.
//
// SEPARATE FROM THE SCREEN PING (liveFlowScreens.ts) on purpose. That one wakes
// every projector and Chromebook in the room; a sound cue changes nothing any
// student screen shows, and pinging thirty devices on every rimshot is the
// request storm this codebase keeps almost causing.
//
// PURE - no transport import, so its contract can compile it in isolation.

/** The room a session's Remote commands are announced on. */
export function remoteCommandTopic(sessionId: string): string {
  return `remote-${sessionId}`;
}

export const REMOTE_COMMAND_PING_EVENT = "cmd";

export type RemoteCommandPing = {
  action: string;
  nonce: string;
};

/**
 * May this action be acted on straight off the ping, or only re-read?
 *
 * Sound cues only. `play-warning`, `play-countdown` and `play-times-up` are
 * Control's timer cues and are equally harmless, so they qualify too - they make
 * a noise and change nothing else.
 */
export function pingPlaysDirectly(action: string): boolean {
  return action.startsWith("play-");
}

export function isRemoteCommandPing(value: unknown): value is RemoteCommandPing {
  if (!value || typeof value !== "object") return false;
  const ping = value as Partial<RemoteCommandPing>;
  return typeof ping.action === "string" && typeof ping.nonce === "string"
    && ping.action.length > 0 && ping.nonce.length > 0;
}
