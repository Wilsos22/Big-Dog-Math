// Server half of the screen ping: tell a session's surfaces to re-read NOW.
//
// SERVER ONLY - it carries the service-role key. Never import this into a client
// component (rule 4); browser surfaces listen through liveFlowPing.ts.
//
// Sent over Supabase Realtime's REST broadcast endpoint rather than a socket,
// because a route handler is short-lived and has no connection to keep. Verified
// against the live project 2026-07-30: POST returns 202 and an anon subscriber
// receives the message in about 200ms.
//
// THE PAYLOAD IS DELIBERATELY EMPTY of lesson content. It says "something
// changed", and each surface then re-reads through the endpoint it already uses,
// so every privacy boundary (studentSafeLiveFlow, the teacher gate,
// requireVerifiedStudent) stays exactly where it was. This is also why the ping
// does not run into the hold on new student-data plumbing: no new table, no new
// column, and no student data on the wire.
//
// It must never break a write. The ping is an optimisation on top of polling; if
// realtime is down or misconfigured, screens fall back to their existing clocks
// and the lesson runs exactly as it did before.

import { LIVE_FLOW_PING_EVENT, liveFlowChannelTopic } from "./liveFlowScreens";

const BROADCAST_TIMEOUT_MS = 2500;

let warnedOnce = false;

export async function broadcastLiveFlowChange(sessionId: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !sessionId) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BROADCAST_TIMEOUT_MS);
  try {
    const response = await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [{
          topic: liveFlowChannelTopic(sessionId),
          event: LIVE_FLOW_PING_EVENT,
          payload: { at: new Date().toISOString() },
          private: false,
        }],
      }),
      signal: controller.signal,
    });
    // Say it once per instance rather than never: a permanently failing ping is
    // invisible from the classroom - the screens just feel slow again - and
    // "it silently went back to polling" is exactly the failure mode this
    // codebase keeps getting bitten by.
    if (!response.ok && !warnedOnce) {
      warnedOnce = true;
      console.warn(`liveFlowBroadcast: screen ping rejected (${response.status}); surfaces fall back to polling.`);
    }
  } catch (error) {
    if (!warnedOnce) {
      warnedOnce = true;
      console.warn("liveFlowBroadcast: screen ping failed; surfaces fall back to polling.", error);
    }
  } finally {
    clearTimeout(timeout);
  }
}
