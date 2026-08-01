// Contract: an authored discussion sequence is honoured exactly as written, or
// it refuses to run and says why.
//
// WHY THIS EXISTS. Discussions are not one shape (Steele, 2026-07-29), so the
// sequence is authored per step instead of being the fixed three rounds the old
// protocol hardcoded. Three ways that can fail quietly, all checked here.
//
// 1. A malformed line falling back to the default protocol. The class would run
//    a DIFFERENT discussion than the one authored, with nobody told. Every parse
//    failure must be loud and must name the line.
// 2. A mode silently coerced. "discuss" is not "talk"; guessing would put the
//    wrong behaviour cue on the projector, which is the same class of defect as
//    catalog copy reaching a classroom screen.
// 3. The beats outrunning the step. A discussion whose phases total more than
//    its Duration is how a 50-minute plan becomes a 55-minute plan, and nothing
//    in the codebase validates lesson arithmetic - so the minute total has to be
//    computable and exact.
//
// Run: npm run test:discussion-phases

import assert from "node:assert/strict";
import {
  DISCUSSION_MODES,
  DISCUSSION_MODE_STRIP,
  MAX_PHASES,
  MAX_PHASE_SECONDS,
  MIN_PHASE_SECONDS,
  parseDiscussionPhases,
  discussionPhaseMinutes,
  stripForPhase,
  activeDiscussionPhase,
} from "../.tmp-mastery/discussionPhases.js";

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  console.log(`  ok  ${name}`);
}

console.log("discussion phases contract");

check("the four modes are fixed vocabulary, in this order", () => {
  assert.deepEqual([...DISCUSSION_MODES], ["think", "write", "talk", "listen"]);
});

check("an empty property means the legacy protocol, not an error", () => {
  for (const empty of [null, undefined, "", "   \n  \n"]) {
    const parsed = parseDiscussionPhases(empty);
    assert.equal(parsed.ok, true, "an unauthored step must not fail");
    assert.deepEqual(parsed.phases, []);
    assert.equal(parsed.totalSeconds, 0);
  }
});

check("a full sequence parses in order, with its own timing per beat", () => {
  const parsed = parseDiscussionPhases([
    "think 60 | Look at both boards. What is different?",
    "talk 120 | Explain your split to your partner.",
    "write 90 | Write the version you now believe.",
    "listen 45 | Track whoever is sharing.",
  ].join("\n"));
  assert.equal(parsed.ok, true, parsed.ok ? "" : parsed.errors.join("; "));
  assert.deepEqual(parsed.phases.map((p) => p.mode), ["think", "talk", "write", "listen"]);
  assert.deepEqual(parsed.phases.map((p) => p.seconds), [60, 120, 90, 45]);
  assert.equal(parsed.phases[0].direction, "Look at both boards. What is different?");
  assert.equal(parsed.totalSeconds, 315);
});

check("ANY sequence is legal - the order is the author's, not the tool's", () => {
  // The old protocol forced think, then discuss, then share. A share-out that
  // opens by listening is a real discussion and must not be second-guessed.
  const parsed = parseDiscussionPhases([
    "listen 90 | Watch me work the first one. Say nothing yet.",
    "talk 60 | Tell your partner what I did in step two.",
    "think 30 | On your own: what would you have done differently?",
  ].join("\n"));
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.phases.map((p) => p.mode), ["listen", "talk", "think"]);
});

check("the same mode may repeat, and often should", () => {
  const parsed = parseDiscussionPhases("talk 60 | Round one.\ntalk 60 | Now swap who explains.");
  assert.equal(parsed.ok, true);
  assert.equal(parsed.phases.length, 2);
});

check("durations accept seconds, 90s, and 2m", () => {
  const parsed = parseDiscussionPhases("think 45 | a\ntalk 90s | b\nwrite 2m | c");
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.phases.map((p) => p.seconds), [45, 90, 120]);
});

check("a line with no direction FAILS - the mode word is not a task", () => {
  const parsed = parseDiscussionPhases("think 60 |   ");
  assert.equal(parsed.ok, false);
  assert.match(parsed.errors[0], /direction/i);
  assert.match(parsed.errors[0], /line 1/);
});

check("a missing pipe fails and says what to write instead", () => {
  const parsed = parseDiscussionPhases("think 60 look at the boards");
  assert.equal(parsed.ok, false);
  assert.match(parsed.errors[0], /"\|"/);
});

check("an unknown mode fails rather than snapping to a near match", () => {
  for (const bad of ["discuss", "share", "revise", "thinking"]) {
    const parsed = parseDiscussionPhases(`${bad} 60 | do the thing`);
    assert.equal(parsed.ok, false, `"${bad}" must not resolve`);
    assert.match(parsed.errors[0], /is not a mode/);
  }
});

check("case and padding are tolerated, because a teacher typed it", () => {
  const parsed = parseDiscussionPhases("  THINK   60 |  Look up.  ");
  assert.equal(parsed.ok, true);
  assert.equal(parsed.phases[0].mode, "think");
  assert.equal(parsed.phases[0].direction, "Look up.");
});

check("a nonsense duration fails and names the offending text", () => {
  const parsed = parseDiscussionPhases("think abit | Look up.");
  assert.equal(parsed.ok, false);
  assert.match(parsed.errors[0], /not a duration/);
  assert.match(parsed.errors[0], /abit/, "the teacher needs to see what they typed");
});

check("a spelled-out duration fails on the SHAPE, and shows the whole head", () => {
  // "think two minutes" is three words before the pipe, so it cannot even be
  // read as mode-plus-duration. Different message, deliberately: the fix is
  // different too.
  const parsed = parseDiscussionPhases("think two minutes | Look up.");
  assert.equal(parsed.ok, false);
  assert.match(parsed.errors[0], /expected a mode and a duration/);
  assert.match(parsed.errors[0], /think two minutes/);
});

check("beats outside the sane range fail", () => {
  const tooShort = parseDiscussionPhases(`think ${MIN_PHASE_SECONDS - 1} | Look up.`);
  assert.equal(tooShort.ok, false);
  const tooLong = parseDiscussionPhases(`think ${MAX_PHASE_SECONDS + 1} | Look up.`);
  assert.equal(tooLong.ok, false, "a beat longer than the cap is a missing sequence, not a beat");
});

check("every problem is reported at once, not just the first", () => {
  const parsed = parseDiscussionPhases("nope 60 | a\nthink zz | b\nwrite 90 | c");
  assert.equal(parsed.ok, false);
  assert.equal(parsed.errors.length, 2, "both bad lines must be named so one pass fixes the lesson");
});

check("too many phases fails", () => {
  const many = Array.from({ length: MAX_PHASES + 1 }, () => "think 30 | Think.").join("\n");
  assert.equal(parseDiscussionPhases(many).ok, false);
});

check("the minute total is exact and rounds up, for the step Duration check", () => {
  assert.equal(discussionPhaseMinutes(315), 6);
  assert.equal(discussionPhaseMinutes(180), 3);
  assert.equal(discussionPhaseMinutes(181), 4);
});

check("a beat drives the behaviour cue, and leaves the rest of the strip alone", () => {
  const authored = { eyes: "The screen", voice: "2 table", supplies: "Parked flat", body: "Standing to talk" };
  const thinking = stripForPhase(authored, { mode: "think", seconds: 60, direction: "x" });
  assert.equal(thinking.voice, "0 silent", "thinking is silent");
  assert.equal(thinking.eyes, "Own paper");
  assert.equal(thinking.supplies, "Parked flat", "a discussion does not change what is in their hands");
  assert.equal(thinking.body, "Standing to talk");
  const talking = stripForPhase(authored, { mode: "talk", seconds: 60, direction: "x" });
  assert.equal(talking.voice, "2 table");
  assert.equal(stripForPhase(authored, null).voice, "2 table", "no beat leaves the strip authored");
  assert.equal(stripForPhase(null, { mode: "talk", seconds: 60, direction: "x" }), null,
    "no authored strip means no strip, beat or not");
});

check("every mode maps to a cue, and all four are silent-or-not deliberately", () => {
  for (const mode of DISCUSSION_MODES) {
    const cue = DISCUSSION_MODE_STRIP[mode];
    assert.ok(cue && cue.eyes && cue.voice, `${mode} has no behaviour cue`);
  }
  assert.equal(DISCUSSION_MODE_STRIP.listen.voice, "0 silent", "listening is silent by definition");
  assert.equal(DISCUSSION_MODE_STRIP.write.voice, "0 silent");
  assert.notEqual(DISCUSSION_MODE_STRIP.talk.voice, "0 silent", "talking cannot be silent");
});

check("activeDiscussionPhase walks the self-running timeline on elapsed seconds", () => {
  // think 30, write 90, talk 60 -> boundaries at 30, 120, 180.
  const phases = parseDiscussionPhases("think 30 | a\nwrite 90 | b\ntalk 60 | c").phases;
  // Start: first beat, nothing elapsed.
  const start = activeDiscussionPhase(phases, 0);
  assert.equal(start.index, 0);
  assert.equal(start.phaseFraction, 0);
  assert.equal(start.done, false);
  // Halfway through the write beat (30 + 45 = 75s in).
  const mid = activeDiscussionPhase(phases, 75);
  assert.equal(mid.index, 1);
  assert.ok(Math.abs(mid.phaseFraction - 0.5) < 1e-9, "45s into a 90s beat is half full");
  // Exactly on a boundary rolls to the next beat, never sticks on the old one.
  assert.equal(activeDiscussionPhase(phases, 30).index, 1);
  assert.equal(activeDiscussionPhase(phases, 120).index, 2);
  // Past the end: done, and the index points past the last beat.
  const over = activeDiscussionPhase(phases, 500);
  assert.equal(over.done, true);
  assert.equal(over.index, phases.length);
  assert.equal(over.phaseFraction, 1);
  // Negative or NaN-ish elapsed clamps to the start rather than throwing.
  assert.equal(activeDiscussionPhase(phases, -10).index, 0);
});

console.log(`\n${checks} discussion phase checks passed`);
console.log("PASS - any sequence is honoured, and a bad one refuses to run and says why.");
