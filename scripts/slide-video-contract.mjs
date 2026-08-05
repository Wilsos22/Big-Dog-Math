// Contract: the teacher's play / pause / restart taps for a video on the main projector.
//
// WHY THIS EXISTS. The whole feature is three string literals and a nonce, and every way it can
// break is silent:
//   1. THE NAME. If these are ever renamed to `play-video`, two unrelated systems change behaviour
//      without a compile error. `remoteCommandPing.pingPlaysDirectly` lets any `play-` action fire
//      straight off an UNVERIFIED realtime broadcast - correct for a sound cue, where a duplicate
//      is harmless, and wrong for something that moves what the room is watching. And
//      sound-bank-contract asserts every `play-` action resolves to a real audio cue, so a
//      `play-video` would fail a test whose message says nothing about video.
//   2. THE NONCE. The projector re-reads the session row about once a second and re-delivers the
//      same command every tick. A command accepted without a nonce replays forever - a video that
//      restarts every second, in front of the class.
//   3. A malformed row silently matching. `remote_command` is jsonb written by another surface; a
//      parser that is loose about shape turns a sound cue into a video command.
//
// Run: npm run test:slide-video

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SLIDE_VIDEO_ACTIONS,
  isSlideVideoAction,
  slideVideoCommandFrom,
} from "../.tmp-mastery/slideVideo.js";

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  console.log(`  ok  ${name}`);
}

console.log("slide video contract");

check("the three actions exist and are exactly the three", () => {
  assert.deepEqual([...SLIDE_VIDEO_ACTIONS], [
    "slide-video-play",
    "slide-video-pause",
    "slide-video-restart",
  ]);
});

check("NO action is `play-` prefixed - this is load-bearing in two other files", () => {
  for (const action of SLIDE_VIDEO_ACTIONS) {
    assert.ok(
      !action.startsWith("play-"),
      `${action} would be fired directly off an unverified broadcast ping AND would fail the ` +
        "sound-bank contract's orphan-cue check. Put the verb last.",
    );
  }
});

check("every action is a member of the teacher remote union", () => {
  // The union is the wire format. An action the Remote can render but the server rejects is a
  // dead key, and the failure surfaces as a tap that does nothing.
  const src = readFileSync(new URL("../src/lib/liveClassFlow.ts", import.meta.url), "utf8");
  const start = src.indexOf("export const TEACHER_REMOTE_ACTIONS = [");
  assert.notEqual(start, -1, "TEACHER_REMOTE_ACTIONS moved - this contract needs updating");
  const union = src.slice(start, src.indexOf("] as const;", start));
  for (const action of SLIDE_VIDEO_ACTIONS) {
    assert.ok(union.includes(`"${action}"`), `${action} is missing from TEACHER_REMOTE_ACTIONS`);
  }
});

check("the deck offers all three, and every deck action is a real action", () => {
  const src = readFileSync(new URL("../src/lib/remoteDeck.ts", import.meta.url), "utf8");
  const start = src.indexOf("export const SLIDE_VIDEO_REMOTE_BUTTONS");
  assert.notEqual(start, -1, "SLIDE_VIDEO_REMOTE_BUTTONS is gone - the keys cannot be tapped");
  const block = src.slice(start, src.indexOf("];", start));
  for (const action of SLIDE_VIDEO_ACTIONS) {
    assert.ok(block.includes(`"${action}"`), `${action} has no deck key`);
  }
});

check("a well-formed command parses", () => {
  const parsed = slideVideoCommandFrom({ action: "slide-video-play", nonce: "abc", issuedAt: "x" });
  assert.deepEqual(parsed, { action: "slide-video-play", nonce: "abc" });
});

check("A COMMAND WITHOUT A NONCE IS REFUSED", () => {
  // Without this the projector replays the same tap on every poll tick, and a restart command
  // would rewind the video every second while the class watches.
  assert.equal(slideVideoCommandFrom({ action: "slide-video-play" }), null);
  assert.equal(slideVideoCommandFrom({ action: "slide-video-play", nonce: "" }), null);
  assert.equal(slideVideoCommandFrom({ action: "slide-video-play", nonce: 7 }), null);
});

check("another surface's remote command never parses as a video command", () => {
  for (const other of ["next", "spin-speaker", "play-applause", "toggle-timer", "transition-now"]) {
    assert.equal(slideVideoCommandFrom({ action: other, nonce: "abc" }), null, other);
  }
});

check("junk in, null out - never a throw", () => {
  for (const junk of [null, undefined, 0, "", "slide-video-play", [], { nonce: "abc" }, { action: 5, nonce: "a" }]) {
    assert.equal(slideVideoCommandFrom(junk), null, JSON.stringify(junk));
  }
});

check("isSlideVideoAction is honest about non-members", () => {
  assert.equal(isSlideVideoAction("slide-video-play"), true);
  assert.equal(isSlideVideoAction("play-slide-video"), false);
  assert.equal(isSlideVideoAction(null), false);
  assert.equal(isSlideVideoAction(undefined), false);
});

check("the module stays import-free so it can compile in isolation", () => {
  // Same constraint soundBank.ts and controlLineup.ts live under: this contract compiles the file
  // with `tsc --ignoreConfig`, which DROPS the `@/` path aliases, so any local import fails CI
  // with "Cannot find module" and the failure looks nothing like its cause.
  const src = readFileSync(new URL("../src/lib/slideVideo.ts", import.meta.url), "utf8");
  assert.ok(!/^\s*import\s/m.test(src), "slideVideo.ts must not import anything");
});

check("the projector reads the command; pace deliberately does not", () => {
  // Only the main projector drives playback. If pace ever started sending play/pause too, the two
  // screens would fight over one timeline and neither would match the room.
  const present = readFileSync(new URL("../src/app/teacher/present/page.tsx", import.meta.url), "utf8");
  assert.ok(present.includes("slideVideoCommandFrom"), "present must dispatch video commands");
  const pace = readFileSync(new URL("../src/app/teacher/pace/page.tsx", import.meta.url), "utf8");
  assert.ok(!pace.includes("slideVideoCommandFrom"), "pace must NOT drive video playback");
});

check("the video never autoplays and never loops", () => {
  // Autoplay with sound is blocked until the page is tapped, so an autoplaying narrated video opens
  // SILENT on a projector nobody has touched since the last deploy - indistinguishable from a
  // broken file. And a loop restarts under the teacher mid-sentence.
  const src = readFileSync(new URL("../src/components/SlideFrameScene.tsx", import.meta.url), "utf8");
  const start = src.indexOf('source.kind === "video"');
  assert.notEqual(start, -1, "the video branch is gone");
  // STRIP COMMENTS FIRST. The prose explaining why there is no loop contains the word "loop", so a
  // bare word match fails on a correct file - which is how a contract ends up being "fixed" by
  // weakening it. Read the code, not the reasoning. (Same lesson as the division-house CSS check.)
  const branch = src
    .slice(start, start + 1600)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
  // JSX boolean attributes, so they appear bare on their own line or before a `/>`.
  assert.ok(!/^\s*autoPlay\s*$/m.test(branch), "the projector video must not autoplay");
  assert.ok(!/^\s*loop\s*$/m.test(branch), "the projector video must not loop - it holds the last frame");
  assert.ok(/^\s*playsInline\s*$/m.test(branch), "playsInline or iOS takes the video fullscreen");
  assert.ok(/onError=/.test(branch), "a missing file must fall back in words, not a black rectangle");
});

console.log(`\n${checks} checks passed.`);
