"use client";

// Real-time ink transport for the iPad → board annotation feature.
//
// Strokes are sent as NORMALISED coordinates (0..1) so the writing surface (iPad)
// and the display (board / panel) can be different sizes and still line up.
//
// Transport: Supabase Realtime *broadcast* (ephemeral, low-latency — no DB writes).
// When Supabase isn't configured (local dev with no keys), it falls back to a
// BroadcastChannel so two tabs/windows in the same browser still sync.
//
// ONE SUBSCRIPTION PER TOPIC PER PAGE, REFERENCE COUNTED. supabase-js dedupes by
// topic: `supabase.channel("ink-main")` returns the EXISTING channel if one is
// already open, `subscribe()` on it is then a no-op (so the second holder never
// hears SUBSCRIBED and every send it makes queues forever), and
// `removeChannel()` tears the channel down for EVERY holder. That is not
// theoretical - it is what killed the pen surface (found 2026-07-30):
//   - /ipad joins <room>__over twice (the glass-sheet InkBoard plus the page's
//     aspect-ratio listener), so one Board <-> Write-on-screen round trip
//     removed the glass sheet's own channel and every later stroke queued with
//     nothing left to flush it.
//   - /teacher/present alternates two InkBoards on <room> (the board scene and
//     the work-space panel). They never coexist, but the handoff unmounts one
//     and mounts the other in the SAME commit, and removeChannel is async - so
//     the incoming mount adopted the dying channel and the projector's board
//     went permanently blank.
// The registry below makes both safe: joins share one live channel, it is
// removed only when the last holder leaves (after a grace window that absorbs
// remounts), and a join that lands during a teardown waits for it and opens a
// fresh channel instead of adopting the corpse.

import { getSupabase } from "./supabase";

export interface InkPoint {
  x: number; // 0..1 across the writing surface
  y: number; // 0..1 down the writing surface
  p?: number; // Apple Pencil pressure 0..1 (absent for mouse)
}

export interface InkStroke {
  id: string;
  color: string;
  erase: boolean;
  m?: "p" | "h"; // pen (default) or highlighter; erase wins over m
  widthFrac: number; // line width as a fraction of surface width
  points: InkPoint[];
}

export type InkMessage =
  | { t: "seg"; id: string; color: string; erase: boolean; m?: "p" | "h"; widthFrac: number; pts: InkPoint[]; start?: boolean; end?: boolean }
  | { t: "clear" }
  | { t: "bg"; url: string | null }
  | { t: "problem"; text: string | null } // problem(s) to show with space to solve
  | { t: "scratch"; open: boolean } // open/close the scratch overlay on the board
  | { t: "pageflip"; index: number; count: number } // the pen surface changed pages; displays follow
  | { t: "attention" } // the class attention call: displays play the room sound + Eyes-up pulse
  | { t: "view"; ar: number } // the display announces its stage aspect ratio so the pen surface can letterbox to match
  | { t: "remove"; ids: string[] } // undo / stroke-eraser: these strokes vanish
  | { t: "restore"; stroke: InkStroke } // redo / undo-of-erase: put a stroke back
  | { t: "replace"; stroke: InkStroke } // hold-to-straighten: swap a stroke's points for the fitted shape
  | { t: "laser"; id: string; pts: InkPoint[]; end?: boolean } // pointer trail - drawn fading, never stored
  | { t: "hello" } // a display just opened — please resend current state
  | { t: "state"; strokes: InkStroke[]; bg: string | null; problem: string | null };

export interface InkChannel {
  send: (m: InkMessage) => void;
  close: () => void;
}

export type InkConnectionStatus = "connecting" | "connected" | "disconnected";

type InkSubscriber = {
  onMessage: (m: InkMessage) => void;
  onStatus?: (status: InkConnectionStatus) => void;
};

type InkRoomEntry = {
  subs: Set<InkSubscriber>;
  status: InkConnectionStatus;
  ready: boolean;
  queue: InkMessage[];
  send: (m: InkMessage) => void;
  teardown: () => void;
  closeTimer: number | null;
};

// Long enough to absorb a React remount, a Board <-> Write-on-screen switch, and
// the board-scene/work-space handoff on the projector; short enough that a room
// genuinely left behind does not hold a subscription for a whole lesson.
const CLOSE_GRACE_MS = 4000;
// A channel that never connects must not grow an unbounded stroke backlog. The
// cap is far above one lesson's worth of in-flight segments, and dropping says
// so - a silent drop on a classroom surface is an outage nobody can see.
const MAX_QUEUED = 1000;

const rooms = new Map<string, InkRoomEntry>();
// Teardown is async. A join that arrives while a room is still being removed
// must wait it out, or supabase-js hands it the channel that is on its way out.
const pendingRemoval = new Map<string, Promise<unknown>>();

type InkSupabaseClient = NonNullable<ReturnType<typeof getSupabase>>;
type InkSupabaseChannel = ReturnType<InkSupabaseClient["channel"]>;

function createRoomEntry(room: string): InkRoomEntry {
  const entry: InkRoomEntry = {
    subs: new Set(),
    status: "connecting",
    ready: false,
    queue: [],
    send: () => undefined,
    teardown: () => undefined,
    closeTimer: null,
  };

  const fanOut = (m: InkMessage) => {
    // Iterate a copy: a handler may close its own channel (a display that
    // adopts state and unmounts) while we are still delivering.
    for (const sub of [...entry.subs]) sub.onMessage(m);
  };
  const setStatus = (status: InkConnectionStatus) => {
    entry.status = status;
    for (const sub of [...entry.subs]) sub.onStatus?.(status);
  };
  const enqueue = (m: InkMessage) => {
    if (entry.queue.length >= MAX_QUEUED) {
      entry.queue.shift();
      console.warn(`inkSync: ink-${room} is not connected; dropping the oldest queued ink.`);
    }
    entry.queue.push(m);
  };

  const supabase = getSupabase();

  if (!supabase) {
    // Fallback: same-browser cross-tab sync (local dev / single machine).
    const bc =
      typeof window !== "undefined" && "BroadcastChannel" in window
        ? new BroadcastChannel(`ink-${room}`)
        : null;
    entry.status = bc ? "connected" : "disconnected";
    entry.ready = Boolean(bc);
    if (bc) bc.onmessage = (e) => fanOut(e.data as InkMessage);
    entry.send = (m) => bc?.postMessage(m);
    entry.teardown = () => bc?.close();
    return entry;
  }

  let channel: InkSupabaseChannel | null = null;
  let torndown = false;

  const open = () => {
    if (torndown) return;
    const ch = supabase.channel(`ink-${room}`, { config: { broadcast: { self: false } } });
    channel = ch;
    ch
      .on("broadcast", { event: "ink" }, (payload) => {
        fanOut(payload.payload as InkMessage);
      })
      .subscribe((status) => {
        if (channel !== ch) return; // a superseded channel must not move the room
        if (status === "SUBSCRIBED") {
          entry.ready = true;
          setStatus("connected");
          for (const m of entry.queue.splice(0)) {
            void ch.send({ type: "broadcast", event: "ink", payload: m });
          }
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          entry.ready = false;
          setStatus("disconnected");
        }
      });
  };

  const pending = pendingRemoval.get(room);
  if (pending) pending.then(open, open);
  else open();

  entry.send = (m) => {
    const ch = channel;
    if (entry.ready && ch) void ch.send({ type: "broadcast", event: "ink", payload: m });
    else enqueue(m);
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
        if (pendingRemoval.get(room) === removal) pendingRemoval.delete(room);
      });
    pendingRemoval.set(room, removal);
  };

  return entry;
}

function acquireRoom(room: string): InkRoomEntry {
  const existing = rooms.get(room);
  if (existing) {
    if (existing.closeTimer !== null) {
      window.clearTimeout(existing.closeTimer);
      existing.closeTimer = null;
    }
    return existing;
  }
  const entry = createRoomEntry(room);
  rooms.set(room, entry);
  return entry;
}

function releaseRoom(room: string, sub: InkSubscriber) {
  const entry = rooms.get(room);
  if (!entry) return;
  entry.subs.delete(sub);
  if (entry.subs.size > 0 || entry.closeTimer !== null) return;
  entry.closeTimer = window.setTimeout(() => {
    entry.closeTimer = null;
    if (entry.subs.size > 0) return; // someone re-joined inside the grace window
    if (rooms.get(room) === entry) rooms.delete(room);
    entry.teardown();
  }, CLOSE_GRACE_MS);
}

export function joinInkRoom(
  room: string,
  onMessage: (m: InkMessage) => void,
  onStatus?: (status: InkConnectionStatus) => void,
): InkChannel {
  const sub: InkSubscriber = { onMessage, onStatus };
  const entry = acquireRoom(room);
  entry.subs.add(sub);
  // A holder that joins an already-live room learns that immediately, instead of
  // sitting on "connecting" waiting for a status change that already happened.
  onStatus?.(entry.status);

  let closed = false;
  return {
    send: (m) => {
      if (closed) return;
      entry.send(m);
    },
    close: () => {
      if (closed) return;
      closed = true;
      releaseRoom(room, sub);
    },
  };
}
