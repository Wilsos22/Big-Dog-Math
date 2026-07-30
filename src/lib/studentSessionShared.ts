// One wire request per device for the student session state.
//
// Four components poll /api/student/session-state on their own clocks -
// ClassSync (3s), the /live-flow page (2s), AbbieStudentBubble (1.5s), and
// useLiveToolConfig (1s). Individually reasonable, together that is about
// 1.5 requests per second PER CHROMEBOOK, and each request costs an auth
// lookup plus several Postgres queries server-side. A full class multiplies
// that into platform throttling that presents as "the sync broke."
//
// This module is a read-through cache with single-flight: callers keep their
// own cadences and error handling, but the NETWORK sees at most one request
// per FRESH_MS per device. A rejected fetch is negative-cached briefly so
// four consumers cannot turn one outage into an error storm.

import { studentApiRequest } from "./studentApi";

const FRESH_MS = 2800; // just under ClassSync's 3s tick, so every tick is fresh enough
const ERROR_HOLD_MS = 1500;

let cache: { sessionId: string; at: number; data: unknown } | null = null;
let failure: { sessionId: string; at: number; error: unknown } | null = null;
let inflight: { sessionId: string; promise: Promise<unknown> } | null = null;

/**
 * Drop the cached read so the next call goes to the wire.
 *
 * The screen ping (liveFlowPing.ts) tells a device the lesson just changed, but
 * a re-read straight afterwards would be served this cache and hand back the
 * state from up to FRESH_MS ago - the ping would look like it did nothing.
 * Invalidate first, then re-read.
 */
export function invalidateSharedSessionState(sessionId?: string) {
  if (!sessionId || (cache && cache.sessionId === sessionId)) cache = null;
  if (!sessionId || (failure && failure.sessionId === sessionId)) failure = null;
}

export function fetchSharedSessionState<T>(sessionId: string): Promise<T> {
  const now = Date.now();
  if (cache && cache.sessionId === sessionId && now - cache.at < FRESH_MS) {
    return Promise.resolve(cache.data as T);
  }
  if (failure && failure.sessionId === sessionId && now - failure.at < ERROR_HOLD_MS) {
    return Promise.reject(failure.error);
  }
  if (inflight && inflight.sessionId === sessionId) {
    return inflight.promise as Promise<T>;
  }
  const promise = studentApiRequest<T>(
    `/api/student/session-state?sessionId=${encodeURIComponent(sessionId)}`,
  ).then(
    (data) => {
      cache = { sessionId, at: Date.now(), data };
      failure = null;
      return data;
    },
    (error) => {
      failure = { sessionId, at: Date.now(), error };
      throw error;
    },
  ).finally(() => {
    if (inflight && inflight.promise === promise) inflight = null;
  });
  inflight = { sessionId, promise: promise as Promise<unknown> };
  return promise;
}
