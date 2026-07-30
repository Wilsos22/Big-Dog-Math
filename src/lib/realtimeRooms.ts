"use client";

// One shared, reference-counted Supabase Realtime broadcast room per topic.
//
// THIS MODULE EXISTS BECAUSE supabase-js DEDUPES CHANNELS BY TOPIC.
// `supabase.channel("x")` returns the EXISTING channel object if one is already
// open, `subscribe()` on an already-joined channel is a silent no-op (so the
// second holder never hears SUBSCRIBED and queues everything it sends forever),
// and `removeChannel()` tears the channel down for EVERY holder -
// asynchronously, so a mount arriving in the same React commit adopts the
// channel that is already on its way out.
//
// Code that opened and closed a channel per CALL therefore had two holders of
// one topic silently destroying each other. That is what killed the iPad pen
// surface on 2026-07-30: /ipad joins <room>__over twice and /teacher/present
// alternates two InkBoards on <room>, so one surface switch was enough to
// silence the other for the rest of the lesson.
//
// Here, joins SHARE one channel: every holder gets its own message and status
// callbacks, they share one send queue, and the channel is removed only when the
// LAST holder closes - after a grace window that absorbs React remounts and
// surface switches. A join that lands mid-teardown waits for it and opens a
// fresh channel rather than adopting the corpse.
//
// `npm run test:ink-sync` drives this against a fake client that reproduces the
// dedupe, and it fails on a per-call implementation.

import { getSupabase } from "./supabase";

export type RealtimeRoomStatus = "connecting" | "connected" | "disconnected";

export interface RealtimeRoom<M> {
  send: (message: M) => void;
  close: () => void;
}

type Subscriber<M> = {
  onMessage: (message: M) => void;
  onStatus?: (status: RealtimeRoomStatus) => void;
};

type RoomEntry<M> = {
  subs: Set<Subscriber<M>>;
  status: RealtimeRoomStatus;
  ready: boolean;
  queue: M[];
  send: (message: M) => void;
  teardown: () => void;
  closeTimer: number | null;
};

// Long enough to absorb a React remount, a Board <-> Write-on-screen switch, and
// the board-scene/work-space handoff on the projector; short enough that a room
// genuinely left behind does not hold a subscription for a whole lesson.
const CLOSE_GRACE_MS = 4000;
// A room that never connects must not grow an unbounded backlog. The cap is far
// above one lesson's worth of in-flight messages, and dropping says so - a
// silent drop on a classroom surface is an outage nobody can see.
const MAX_QUEUED = 1000;
// Every room in this app is a plain broadcast room on one event name.
const EVENT = "msg";

const rooms = new Map<string, RoomEntry<unknown>>();
// Teardown is async. A join that arrives while a room is still being removed
// must wait it out, or supabase-js hands it the channel that is on its way out.
const pendingRemoval = new Map<string, Promise<unknown>>();

type RealtimeSupabaseClient = NonNullable<ReturnType<typeof getSupabase>>;
type RealtimeSupabaseChannel = ReturnType<RealtimeSupabaseClient["channel"]>;

function createRoomEntry<M>(topic: string, legacyEvent: string): RoomEntry<M> {
  const entry: RoomEntry<M> = {
    subs: new Set(),
    status: "connecting",
    ready: false,
    queue: [],
    send: () => undefined,
    teardown: () => undefined,
    closeTimer: null,
  };

  const fanOut = (message: M) => {
    // Iterate a copy: a handler may close its own room (a display that adopts
    // state and unmounts) while we are still delivering.
    for (const sub of [...entry.subs]) sub.onMessage(message);
  };
  const setStatus = (status: RealtimeRoomStatus) => {
    entry.status = status;
    for (const sub of [...entry.subs]) sub.onStatus?.(status);
  };
  const enqueue = (message: M) => {
    if (entry.queue.length >= MAX_QUEUED) {
      entry.queue.shift();
      console.warn(`realtimeRooms: ${topic} is not connected; dropping the oldest queued message.`);
    }
    entry.queue.push(message);
  };

  const supabase = getSupabase();

  if (!supabase) {
    // Fallback: same-browser cross-tab sync (local dev with no Supabase keys).
    const bc =
      typeof window !== "undefined" && "BroadcastChannel" in window
        ? new BroadcastChannel(topic)
        : null;
    entry.status = bc ? "connected" : "disconnected";
    entry.ready = Boolean(bc);
    if (bc) bc.onmessage = (e) => fanOut(e.data as M);
    entry.send = (message) => bc?.postMessage(message);
    entry.teardown = () => bc?.close();
    return entry;
  }

  let channel: RealtimeSupabaseChannel | null = null;
  let torndown = false;

  const open = () => {
    if (torndown) return;
    const ch = supabase.channel(topic, { config: { broadcast: { self: false } } });
    channel = ch;
    ch
      .on("broadcast", { event: legacyEvent }, (payload) => {
        fanOut(payload.payload as M);
      })
      .subscribe((status) => {
        if (channel !== ch) return; // a superseded channel must not move the room
        if (status === "SUBSCRIBED") {
          entry.ready = true;
          setStatus("connected");
          for (const message of entry.queue.splice(0)) {
            void ch.send({ type: "broadcast", event: legacyEvent, payload: message });
          }
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          entry.ready = false;
          setStatus("disconnected");
        }
      });
  };

  const pending = pendingRemoval.get(topic);
  if (pending) pending.then(open, open);
  else open();

  entry.send = (message) => {
    const ch = channel;
    if (entry.ready && ch) void ch.send({ type: "broadcast", event: legacyEvent, payload: message });
    else enqueue(message);
  };

  entry.teardown = () => {
    torndown = true;
    const ch = channel;
    channel = null;
    entry.ready = false;
    if (!ch) return;
    const removal = supabase
      .removeChannel(ch)
      .catch(() => undefined)
      .finally(() => {
        if (pendingRemoval.get(topic) === removal) pendingRemoval.delete(topic);
      });
    pendingRemoval.set(topic, removal);
  };

  return entry;
}

function acquireRoom<M>(topic: string, legacyEvent: string): RoomEntry<M> {
  const existing = rooms.get(topic) as RoomEntry<M> | undefined;
  if (existing) {
    if (existing.closeTimer !== null) {
      window.clearTimeout(existing.closeTimer);
      existing.closeTimer = null;
    }
    return existing;
  }
  const entry = createRoomEntry<M>(topic, legacyEvent);
  rooms.set(topic, entry as RoomEntry<unknown>);
  return entry;
}

function releaseRoom<M>(topic: string, sub: Subscriber<M>) {
  const entry = rooms.get(topic) as RoomEntry<M> | undefined;
  if (!entry) return;
  entry.subs.delete(sub);
  if (entry.subs.size > 0 || entry.closeTimer !== null) return;
  entry.closeTimer = window.setTimeout(() => {
    entry.closeTimer = null;
    if (entry.subs.size > 0) return; // someone re-joined inside the grace window
    if (rooms.get(topic) === (entry as RoomEntry<unknown>)) rooms.delete(topic);
    entry.teardown();
  }, CLOSE_GRACE_MS);
}

/**
 * Join a shared broadcast room. Safe to call any number of times for one topic
 * from one page - that is the whole point of this module.
 *
 * `legacyEvent` names the broadcast event on the wire. It exists only because
 * the ink rooms shipped on the event name "ink" and every display already in a
 * classroom is listening for it; new rooms should take the default.
 */
export function joinRealtimeRoom<M>(
  topic: string,
  onMessage: (message: M) => void,
  onStatus?: (status: RealtimeRoomStatus) => void,
  legacyEvent: string = EVENT,
): RealtimeRoom<M> {
  const sub: Subscriber<M> = { onMessage, onStatus };
  const entry = acquireRoom<M>(topic, legacyEvent);
  entry.subs.add(sub);
  // A holder that joins an already-live room learns that immediately, instead of
  // sitting on "connecting" waiting for a status change that already happened.
  onStatus?.(entry.status);

  let closed = false;
  return {
    send: (message) => {
      if (closed) return;
      entry.send(message);
    },
    close: () => {
      if (closed) return;
      closed = true;
      releaseRoom(topic, sub);
    },
  };
}
