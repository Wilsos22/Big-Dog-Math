"use client";

// Browser half of the screen ping. A surface calls this and re-reads whatever it
// already reads whenever the ping fires; its existing poll stays exactly as it
// was and remains the safety net, so a dropped ping just means the screen
// catches up on its next tick.
//
// The ping carries no lesson content - see liveFlowBroadcast.ts - so subscribing
// leaks nothing to a student device. It is the same transport, and the same
// shared reference-counted room registry, that already reaches every Chromebook
// in the room for the attention call.

import { useEffect, useRef } from "react";
import { joinRealtimeRoom } from "./realtimeRooms";
import { LIVE_FLOW_PING_EVENT, liveFlowChannelTopic } from "./liveFlowScreens";

type LiveFlowPing = { at?: string };

export function joinLiveFlowPings(sessionId: string, onPing: () => void) {
  return joinRealtimeRoom<LiveFlowPing>(
    liveFlowChannelTopic(sessionId),
    () => onPing(),
    undefined,
    LIVE_FLOW_PING_EVENT,
  );
}

/**
 * Re-read as soon as the lesson changes, instead of on the next poll tick.
 *
 * The handler is held in a ref so a surface can pass an inline closure without
 * the subscription tearing down and rebuilding on every render - the room
 * registry would absorb that, but it would still churn a channel per keystroke.
 */
export function useLiveFlowPing(sessionId: string | null | undefined, onPing: () => void) {
  const handlerRef = useRef(onPing);
  useEffect(() => { handlerRef.current = onPing; }, [onPing]);

  useEffect(() => {
    if (!sessionId) return;
    const room = joinLiveFlowPings(sessionId, () => handlerRef.current());
    return () => room.close();
  }, [sessionId]);
}
