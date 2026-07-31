"use client";

// Real-time ink transport for the iPad → board annotation feature.
//
// Strokes are sent as NORMALISED coordinates (0..1) so the writing surface (iPad)
// and the display (board / panel) can be different sizes and still line up.
//
// Transport: Supabase Realtime *broadcast* (ephemeral, low-latency — no DB
// writes), through the shared reference-counted room registry in
// realtimeRooms.ts. THAT SHARING IS LOAD-BEARING: supabase-js dedupes channels
// by topic, so two joins of one ink room from one page used to destroy each
// other - see the comment at the top of realtimeRooms.ts for what that did to
// the pen surface. /ipad joins <room>__over twice and /teacher/present
// alternates two InkBoards on <room>; both are safe now, and nothing here needs
// to hunt for duplicate call sites.
//
// The wire event stays "ink" because classroom displays that have been open
// since before this refactor are still listening for it.

import { joinRealtimeRoom, type RealtimeRoomStatus } from "./realtimeRooms";

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
  | { t: "paper"; on: boolean } // the pen surface went to plain paper; displays cover the slide to match
  | { t: "whiteboard"; on: boolean } // the pen surface split in a white work area on the left; displays show the matching panel and shift the slide to the right
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

export type InkConnectionStatus = RealtimeRoomStatus;

export function joinInkRoom(
  room: string,
  onMessage: (m: InkMessage) => void,
  onStatus?: (status: InkConnectionStatus) => void,
): InkChannel {
  return joinRealtimeRoom<InkMessage>(`ink-${room}`, onMessage, onStatus, "ink");
}
