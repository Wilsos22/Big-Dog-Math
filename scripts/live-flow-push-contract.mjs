// Screen-ping contract.
//
// The ping exists to cut classroom lag: surfaces poll on a clock (projectors
// 1.5s, Chromebooks 2s behind a 2.8s shared cache) and additionally re-read the
// instant the lesson changes, which turns a screen change from up to three
// seconds into about two hundred milliseconds.
//
// THE DANGEROUS FAILURE IS PINGING TOO OFTEN, NOT TOO RARELY. /control
// republishes its snapshot about once a second while a timer runs. A ping per
// write would put thirty Chromebooks on a one-second re-fetch cycle - the exact
// per-device request storm studentSessionShared.ts was written to end, arriving
// by another road, and it would present as "the sync broke" rather than as
// anything obviously caused by this feature. So the revision below MUST ignore
// the fields that tick, and every writer MUST gate on it.
//
// Pinging too rarely is safe by construction: the polls never went away, so a
// missed ping costs one tick of latency and nothing else.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const screens = require(path.join(root, ".tmp-mastery", "liveFlowScreens.js"));

let checks = 0;
function ok(label, condition) {
  checks += 1;
  if (!condition) throw new Error(`FAIL - ${label}`);
  console.log(`  ok  ${label}`);
}

const baseFlow = () => ({
  version: 2,
  updatedAt: "2026-07-30T18:00:00.000Z",
  state: { id: "we-do", label: "Guided practice", color: "#35785a", semantic: "guided" },
  timer: { totalSeconds: 480, secondsLeft: 480, running: true, finished: false, endsAt: "2026-07-30T18:08:00.000Z" },
  poll: null,
  resource: null,
  presentation: { title: "Guided practice", body: "24 x 7", mode: "directions", boardOpen: false },
  sequence: { currentIndex: 3, totalSteps: 11, advanceMode: "automatic", nextLabel: "Learning check", steps: [] },
  lesson: { id: "abc", code: "M1.T1.L1-D1" },
});

console.log("screen ping contract");

// ── The per-second churn must never ping ────────────────────────────────────
{
  const before = baseFlow();
  const after = baseFlow();
  after.updatedAt = "2026-07-30T18:00:01.000Z";
  after.timer.secondsLeft = 479;
  ok("a timer tick is not a screen change", !screens.liveFlowScreensChanged(before, after));
}
{
  const before = baseFlow();
  const after = baseFlow();
  after.updatedAt = "2026-07-30T18:00:30.000Z";
  after.timer.secondsLeft = 450;
  ok("thirty seconds of ticking is still not a screen change", !screens.liveFlowScreensChanged(before, after));
}
{
  // The Remote's claim marker is set and cleared around a single action that
  // pings on its own; counting it would double every remote tap.
  const before = baseFlow();
  const after = baseFlow();
  after.transition = { token: "t1", startedAt: "2026-07-30T18:00:01.000Z" };
  ok("a Remote claim marker is not a screen change", !screens.liveFlowScreensChanged(before, after));
}
{
  const before = baseFlow();
  const after = JSON.parse(JSON.stringify(before));
  ok("an identical republish is not a screen change", !screens.liveFlowScreensChanged(before, after));
}

// ── Everything the room can see must ping ───────────────────────────────────
const mustPing = [
  ["advancing a step", (f) => { f.sequence.currentIndex = 4; }],
  ["changing state", (f) => { f.state.id = "learning-check"; f.state.label = "Learning check"; }],
  ["opening a poll", (f) => { f.poll = { id: "p1", kind: "fist-to-five", stage: "responding", question: "?" }; }],
  ["revealing results", (f) => { f.poll = { id: "p1", kind: "fist-to-five", stage: "results", question: "?" }; }],
  ["opening the work space", (f) => { f.presentation.boardOpen = true; }],
  ["switching presentation mode", (f) => { f.presentation.mode = "board"; }],
  ["editing the main display", (f) => { f.presentation.body = "24 x 8"; }],
  ["pausing the timer", (f) => { f.timer.running = false; f.timer.endsAt = null; }],
  ["adding time (endsAt moves)", (f) => { f.timer.endsAt = "2026-07-30T18:09:00.000Z"; f.timer.totalSeconds = 510; }],
  ["starting an interlude", (f) => { f.interlude = { stateId: "transition-hustle", endsAt: "2026-07-30T18:01:00.000Z" }; }],
  ["a classroom state override", (f) => { f.behaviorOverride = { voice: "0 silent", atIndex: 3 }; }],
  ["publishing a tool", (f) => { f.tool = { route: "/distributive-area", label: "Area model" }; }],
  ["a discussion phase", (f) => { f.phase = { id: "think", running: true, totalSeconds: 120 }; }],
  ["switching to manual pacing", (f) => { f.sequence.advanceMode = "manual"; }],
];
for (const [label, mutate] of mustPing) {
  const before = baseFlow();
  const after = baseFlow();
  after.updatedAt = "2026-07-30T18:00:05.000Z";
  after.timer.secondsLeft = 475; // the tick rides along with every real change
  mutate(after);
  ok(`${label} pings`, screens.liveFlowScreensChanged(before, after));
}

// ── Writers build snapshots independently; key order must not matter ────────
{
  const before = baseFlow();
  const reordered = {};
  for (const key of Object.keys(before).reverse()) reordered[key] = before[key];
  reordered.presentation = { boardOpen: false, mode: "directions", body: "24 x 7", title: "Guided practice" };
  ok(
    "the same lesson built key-for-key differently is not a change",
    !screens.liveFlowScreensChanged(before, reordered),
  );
}

// ── Null handling: a session with no lesson yet ─────────────────────────────
ok("null to null is not a change", !screens.liveFlowScreensChanged(null, null));
ok("starting a lesson from nothing pings", screens.liveFlowScreensChanged(null, baseFlow()));
ok("the topic is per session", screens.liveFlowChannelTopic("abc") === "flow-abc");

// ── Every writer gates on it, and the payload stays empty ───────────────────
const teacherSession = fs.readFileSync(path.join(root, "src/app/api/teacher/session/route.ts"), "utf8");
const controlRemote = fs.readFileSync(path.join(root, "src/app/api/control-remote/route.ts"), "utf8");
const broadcast = fs.readFileSync(path.join(root, "src/lib/liveFlowBroadcast.ts"), "utf8");

ok(
  "/api/teacher/session gates its ping on a real screen change",
  teacherSession.includes("liveFlowScreensChanged") && teacherSession.includes("broadcastLiveFlowChange"),
);
ok(
  "/api/control-remote gates its ping on a real screen change",
  controlRemote.includes("liveFlowScreensChanged") && controlRemote.includes("broadcastLiveFlowChange"),
);
ok(
  "neither writer blocks its response on the ping",
  teacherSession.includes("after(() => broadcastLiveFlowChange")
    && controlRemote.includes("after(() => broadcastLiveFlowChange"),
);
// The ping is an optimisation on top of polling. If it ever threw, a teacher
// tap would fail instead of a screen being slow - strictly worse than no ping.
ok("a failed ping can never break a write", broadcast.includes("catch") && !broadcast.includes("throw"));
// The whole privacy argument rests on this: the ping says "re-read", and each
// surface then goes through the gated endpoint it already used.
for (const term of ["live_flow", "liveFlow", "presentation", "poll", "student", "name"]) {
  ok(`the ping payload carries no ${term}`, !new RegExp(`payload: \\{[^}]*${term}`).test(broadcast));
}

// ── The student surfaces must drop the shared cache before re-reading ───────
const liveFlowPage = fs.readFileSync(path.join(root, "src/app/live-flow/page.tsx"), "utf8");
const classSync = fs.readFileSync(path.join(root, "src/components/ClassSync.tsx"), "utf8");
for (const [label, source] of [["/live-flow", liveFlowPage], ["ClassSync", classSync]]) {
  ok(
    `${label} invalidates the shared cache before re-reading, or the ping does nothing`,
    source.includes("invalidateSharedSessionState"),
  );
}

// ── The polls must survive as the safety net ───────────────────────────────
const present = fs.readFileSync(path.join(root, "src/app/teacher/present/page.tsx"), "utf8");
const pace = fs.readFileSync(path.join(root, "src/app/teacher/pace/page.tsx"), "utf8");
for (const [label, source] of [
  ["/teacher/present", present],
  ["/teacher/pace", pace],
  ["/live-flow", liveFlowPage],
  ["ClassSync", classSync],
]) {
  ok(`${label} still polls, so a dropped ping only costs one tick`, /setInterval\(/.test(source));
  ok(`${label} listens for the ping`, /useLiveFlowPing|joinLiveFlowPings/.test(source));
}

console.log(`\n${checks} screen ping checks passed`);
console.log("PASS - screens re-read the moment the lesson changes, and a timer tick never wakes the class.");
