// Ink transport contract.
//
// The pen surface is the most important feature in the system after data
// collection, and on 2026-07-30 it was dead because of ONE library behaviour:
// supabase-js dedupes realtime channels BY TOPIC. Two joinInkRoom calls for the
// same room in one page got the same channel object, the second subscribe() was
// a no-op (so that holder never heard SUBSCRIBED and queued every stroke
// forever), and either holder's close() called removeChannel and killed the
// channel for BOTH. /ipad joins <room>__over twice; /teacher/present alternates
// two InkBoards on <room>. One Board <-> Write-on-screen switch was enough to
// silence the glass sheet for the rest of the lesson, with nothing on any
// surface saying so.
//
// These checks drive the real compiled joinInkRoom against a fake client that
// reproduces that dedupe, so the invariant is tested rather than remembered.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

let checks = 0;
function ok(label, condition) {
  checks += 1;
  if (!condition) throw new Error(`FAIL - ${label}`);
  console.log(`  ok  ${label}`);
}

// ── Deterministic timers ────────────────────────────────────────────────────
// inkSync schedules its close grace window on window.setTimeout, so stubbing
// window gives the test exact control instead of a four-second sleep.
let timerSeq = 0;
let timers = [];
globalThis.window = {
  setTimeout: (fn) => {
    timerSeq += 1;
    timers.push({ id: timerSeq, fn });
    return timerSeq;
  },
  clearTimeout: (id) => {
    timers = timers.filter((t) => t.id !== id);
  },
};
function runTimers() {
  const due = timers;
  timers = [];
  for (const t of due) t.fn();
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

// ── A fake Supabase client with the real dedupe-by-topic behaviour ──────────
function makeFakeSupabase() {
  const live = new Map(); // topic -> channel, exactly like RealtimeClient.channels
  const created = [];
  return {
    live,
    created,
    channel(topic) {
      // RealtimeClient.channel() returns the EXISTING channel for a topic. This
      // line is the whole reason this contract exists.
      const existing = live.get(topic);
      if (existing) return existing;
      const ch = {
        topic,
        handlers: [],
        sent: [],
        subscribeCalls: 0,
        joined: false,
        removed: false,
        on(_type, _filter, handler) {
          this.handlers.push(handler);
          return this;
        },
        subscribe(callback) {
          this.subscribeCalls += 1;
          // RealtimeChannel.subscribe() is a no-op once the channel has joined:
          // the callback never fires again, so a second holder waits forever.
          if (this.joined) return this;
          this.joined = true;
          callback("SUBSCRIBED");
          return this;
        },
        send(message) {
          if (this.removed) throw new Error(`send on a removed channel: ${topic}`);
          this.sent.push(message);
          return Promise.resolve("ok");
        },
        deliver(payload) {
          for (const handler of this.handlers) handler({ payload });
        },
      };
      live.set(topic, ch);
      created.push(ch);
      return ch;
    },
    // removeChannel is ASYNC in supabase-js: the channel stays in `channels`
    // until the unsubscribe settles, which is how an incoming mount used to
    // adopt a channel that was already on its way out.
    removeChannel(ch) {
      return Promise.resolve().then(() => {
        ch.removed = true;
        ch.joined = false;
        if (live.get(ch.topic) === ch) live.delete(ch.topic);
        return "ok";
      });
    },
  };
}

const fake = makeFakeSupabase();
let currentClient = fake;
const supabaseModule = path.join(root, ".tmp-mastery", "supabase.js");
require.cache[require.resolve(supabaseModule)] = {
  id: supabaseModule,
  filename: supabaseModule,
  loaded: true,
  exports: { getSupabase: () => currentClient },
};
const { joinInkRoom } = require(path.join(root, ".tmp-mastery", "inkSync.js"));

const seg = (id) => ({ t: "seg", id, color: "#111827", erase: false, widthFrac: 0.01, pts: [{ x: 0.5, y: 0.5 }] });

console.log("ink transport contract");

// ── One channel per topic, shared ───────────────────────────────────────────
const aMessages = [];
const bMessages = [];
const aStatus = [];
const bStatus = [];
const a = joinInkRoom("main__over", (m) => aMessages.push(m), (s) => aStatus.push(s));
const b = joinInkRoom("main__over", (m) => bMessages.push(m), (s) => bStatus.push(s));
const over = fake.live.get("ink-main__over");

ok("two joins of one room open ONE channel", fake.created.length === 1);
ok("and subscribe is called exactly once", over.subscribeCalls === 1);
ok("the first holder is told it is connected", aStatus.includes("connected"));
ok("so is a holder that joined after the channel was already live", bStatus.includes("connected"));

over.deliver(seg("s1"));
ok("an incoming message reaches every holder", aMessages.length === 1 && bMessages.length === 1);

a.send(seg("s2"));
b.send(seg("s3"));
ok("both holders can send", over.sent.length === 2);

// ── Closing one holder must not kill the other ──────────────────────────────
a.close();
runTimers();
await flush();
ok("closing one holder does not remove the shared channel", !over.removed && fake.live.get("ink-main__over") === over);
b.send(seg("s4"));
ok("the surviving holder still sends - this is the glass sheet that went dead", over.sent.length === 3);
over.deliver(seg("s5"));
ok("and still receives", bMessages.length === 2);
ok("the closed holder stops receiving", aMessages.length === 1);
a.send(seg("ignored"));
ok("a closed holder cannot send", over.sent.length === 3);

// ── The last holder out removes the channel ─────────────────────────────────
b.close();
ok("removal waits for the grace window, so a remount keeps the channel", !over.removed);
runTimers();
await flush();
ok("the last holder out removes the channel", over.removed && !fake.live.has("ink-main__over"));

// ── A remount inside the grace window keeps the live channel ────────────────
const c = joinInkRoom("main", (m) => m, () => undefined);
const board = fake.live.get("ink-main");
c.close();
const d = joinInkRoom("main", (m) => m, () => undefined);
runTimers();
await flush();
ok("a re-join inside the grace window cancels the removal", !board.removed && fake.live.get("ink-main") === board);
d.send(seg("s6"));
ok("and the re-joined holder sends on the same live channel", board.sent.length === 1);

// ── The scene / panel handoff: joining during a teardown ────────────────────
// /teacher/present unmounts one InkBoard and mounts the other in the SAME
// commit. The new holder must never end up on the dying channel.
d.close();
runTimers(); // starts the async removal
const e = joinInkRoom("main", (m) => m, () => undefined);
await flush();
await flush();
const replacement = fake.live.get("ink-main");
ok("the handoff gets a channel, not the corpse", Boolean(replacement) && replacement !== board);
ok("the outgoing channel really did go", board.removed);
e.send(seg("s7"));
ok("the incoming holder sends on the fresh channel", replacement.sent.length === 1);
e.close();
runTimers();
await flush();

// ── Queue before connect, flush on subscribe ────────────────────────────────
const pendingFake = makeFakeSupabase();
let heldCallback = null;
pendingFake.channel = ((original) => function channel(topic) {
  const ch = original.call(this, topic);
  ch.subscribe = function subscribe(callback) {
    this.subscribeCalls += 1;
    heldCallback = callback; // never connects until the test says so
    return this;
  };
  return ch;
})(pendingFake.channel);
currentClient = pendingFake;
const slow = joinInkRoom("slow", () => undefined, () => undefined);
slow.send(seg("q1"));
slow.send(seg("q2"));
const slowChannel = pendingFake.live.get("ink-slow");
ok("strokes sent before the channel connects are queued, not dropped", slowChannel.sent.length === 0);
heldCallback("SUBSCRIBED");
ok("and flush in order the moment it connects", slowChannel.sent.length === 2);

// ── Nothing may reach for a raw ink channel outside this module ─────────────
const inkFiles = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name)) inkFiles.push(full);
  }
})(path.join(root, "src"));
const strays = inkFiles.filter((file) => {
  if (file.endsWith(path.join("lib", "inkSync.ts"))) return false;
  return /channel\(\s*[`"']ink-/.test(fs.readFileSync(file, "utf8"));
});
ok("every ink surface joins through joinInkRoom", strays.length === 0);

console.log(`\n${checks} ink transport checks passed`);
console.log("PASS - ink rooms are shared and reference counted; one surface closing can no longer silence another.");
