// Contract: /control's lineup survives the publish -> rehydrate round trip.
//
// Control's live_flow snapshot is a FULL REPLACE, republished about once a
// second. A field the publish mapper forgets is deleted from the room's
// snapshot; a field the rehydrate mapper forgets is dropped on the next Control
// reconnect. Before src/lib/controlLineup.ts existed these were four hand-kept
// object literals in src/app/control/page.tsx and they HAD drifted - the
// remote-command rehydrate silently dropped eyes/voice/supplies/body, which
// killed the classroom state strip on both projectors for the rest of a period
// and looked exactly like "this lesson has no strip authored".
//
// This file fails if that can happen again.

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const { flowSnapshotForStep, lineupItemFromStep, lineupFromSteps } = require(
  path.join(root, ".tmp-mastery", "controlLineup.js"),
);

let checks = 0;
const check = (label, fn) => {
  fn();
  checks += 1;
  void label;
};

// --- stubs -------------------------------------------------------------
// Injected deps are identity-ish on purpose: this contract is about FIELD
// CARRY-THROUGH, not about the helpers, each of which has its own contract.
const uid = () => "regenerated";
const BANK = [
  {
    id: "we-do",
    label: "Bank label",
    desc: "Bank description",
    color: "#123456",
    paceAction: "Bank pace action",
    studentAction: "Bank student action",
  },
];
const LESSON = { code: "M1.T1.L1", discussionStems: "lesson stem", discussionVocabulary: "lesson word" };

const makeDeps = (isDiscussion) => ({
  inferClassroomStage: () => "scenario",
  usesDiscussionProtocol: () => isDiscussion,
  resolveLiveStepPollKind: (_responseMode, pollKind) => pollKind || null,
  splitLiveFlowLines: (value) => (value ? value.split("\n") : []),
  splitLiveFlowVocabulary: (value) => (value ? value.split("\n") : []),
  discussionSupportsForLesson: () => ({ sentenceStems: ["catalog stem"], keyVocabulary: ["catalog word"] }),
  defaultPublicSurfaceModeForState: () => "lesson",
  minutesForItem: (item) => item.minutes ?? 1,
});

// Every LineupItem field, each with a distinctive value so a swap is visible.
const FULL_ITEM = {
  uid: "original-uid",
  stateId: "we-do",
  minutes: 7,
  title: "Authored title",
  studentDirections: "Authored student directions",
  question: "Authored question",
  pollKind: "short-answer",
  choices: ["a", "b"],
  correctAnswer: "a",
  standard: "6.NS.B.4",
  notionStepId: "notion-step-1",
  notionLessonId: "notion-lesson-1",
  lessonCode: "M1.T1.L1",
  linkUrl: "/distributive-area",
  paperTask: "Authored paper task",
  advance: "manual",
  mainDisplay: "Authored main display",
  paceDirections: "Authored pace directions",
  studentAction: "Authored student action",
  remoteActions: "Authored remote actions",
  slideOverlay: "overlay-blob",
  slideUrl: "https://example.com/deck",
  slideMirror: true,
  slideFit: "cover",
  discussionStems: "stem one\nstem two",
  vocabulary: "word one\nword two",
  discussionPhases: "think 60 | Think about it",
  responseMode: "Short Answer",
  workSpaceAvailable: true,
  publicSurfaceMode: "lesson",
  routineConfig: { kind: "gallery-walk", stationCount: 4 },
  eyes: "The screen",
  voice: "1 partner",
  supplies: "Pencil and paper",
  body: "Seated",
};

// Fields that legitimately do NOT survive, each for a stated reason. Anything
// that stops surviving without being added here is a regression.
const DELIBERATELY_UNPUBLISHED = new Map([
  [
    "advance",
    "LiveFlowSequenceStep has no per-step advance field at all - pacing is the sequence-wide advanceMode - so this is not a drop, it is a field the published type never carried. Only the Notion importer sets it. Widening the published type needs Steele's word.",
  ],
]);
// Regenerated per row, never compared.
const NOT_CARRIED = new Set(["uid"]);
// Published only on a real discussion step (catalog copy may not reach a
// warm-up or a closeout projector).
const DISCUSSION_ONLY = new Set(["discussionStems", "vocabulary"]);

// --- 1. round trip on a NON-discussion step ----------------------------
check("non-discussion round trip is lossless", () => {
  const deps = makeDeps(false);
  const published = flowSnapshotForStep(FULL_ITEM, BANK, LESSON, deps);
  const back = lineupItemFromStep(published, uid);

  for (const key of Object.keys(FULL_ITEM)) {
    if (NOT_CARRIED.has(key) || DELIBERATELY_UNPUBLISHED.has(key) || DISCUSSION_ONLY.has(key)) continue;
    assert.deepEqual(
      back[key],
      FULL_ITEM[key],
      `LineupItem.${key} did not survive the publish -> rehydrate round trip. ` +
        `Either flowSnapshotForStep stopped publishing it or lineupItemFromStep stopped reading it back. ` +
        `A dropped field is invisible in class: the lesson keeps running without it.`,
    );
  }
});

// --- 2. the field group that was actually broken -----------------------
check("classroom state strip survives", () => {
  const deps = makeDeps(false);
  const published = flowSnapshotForStep(FULL_ITEM, BANK, LESSON, deps);
  for (const slot of ["eyes", "voice", "supplies", "body"]) {
    assert.equal(published[slot], FULL_ITEM[slot], `published step lost strip slot ${slot}`);
  }
  const back = lineupItemFromStep(published, uid);
  for (const slot of ["eyes", "voice", "supplies", "body"]) {
    assert.equal(back[slot], FULL_ITEM[slot], `rehydrate lost strip slot ${slot} - this is the bug that shipped`);
  }
});

// --- 3. discussion-only fields -----------------------------------------
check("a discussion step carries authored stems and vocabulary", () => {
  const published = flowSnapshotForStep(FULL_ITEM, BANK, LESSON, makeDeps(true));
  assert.deepEqual(published.discussionStems, ["stem one", "stem two"]);
  assert.deepEqual(published.vocabulary, ["word one", "word two"]);
  assert.equal(published.pollKind, null, "a discussion step runs the protocol, never a poll");
  const back = lineupItemFromStep(published, uid);
  assert.equal(back.discussionStems, "stem one\nstem two");
  assert.equal(back.vocabulary, "word one\nword two");
});

check("a NON-discussion step publishes no stems or vocabulary", () => {
  const published = flowSnapshotForStep(FULL_ITEM, BANK, LESSON, makeDeps(false));
  assert.deepEqual(published.discussionStems, [], "catalog copy reached warm-up and closeout projectors once");
  assert.deepEqual(published.vocabulary, []);
});

check("an unauthored discussion step falls back to catalog supports", () => {
  const bare = { ...FULL_ITEM, discussionStems: undefined, vocabulary: undefined };
  const published = flowSnapshotForStep(bare, BANK, null, makeDeps(true));
  assert.deepEqual(published.discussionStems, ["catalog stem"]);
  assert.deepEqual(published.vocabulary, ["catalog word"]);
});

// --- 3b. discussionPhases is PUBLISHED -------------------------------
// It was not, until 2026-08-03, and that was a live bug rather than a
// deliberate hold: /api/control-remote re-derives presentation.discussionPhases
// from flow.sequence.steps[i] on every advance, so Control's ~1/second full
// replace deleted the server's copy and the first Remote-driven Next killed the
// discussion timeline on both projectors and every Chromebook for the period.
check("discussionPhases reaches the room and survives rehydrate", () => {
  const published = flowSnapshotForStep(FULL_ITEM, BANK, LESSON, makeDeps(true));
  assert.equal(
    published.discussionPhases,
    FULL_ITEM.discussionPhases,
    "Control stopped publishing discussionPhases. /api/control-remote reads it back off " +
      "sequence.steps, so dropping it here deletes the discussion timeline mid-lesson.",
  );
  assert.equal(lineupItemFromStep(published, uid).discussionPhases, FULL_ITEM.discussionPhases);
});

check("an unauthored discussionPhases stays undefined, not empty string", () => {
  const bare = { ...FULL_ITEM, discussionPhases: "" };
  const published = flowSnapshotForStep(bare, BANK, LESSON, makeDeps(true));
  assert.equal(published.discussionPhases, undefined, "matches stepsFromLesson's `|| undefined`");
});

// --- 4. the deliberate omissions stay deliberate -----------------------
check("deliberately unpublished fields are still unpublished", () => {
  const published = flowSnapshotForStep(FULL_ITEM, BANK, LESSON, makeDeps(false));
  for (const [key, reason] of DELIBERATELY_UNPUBLISHED) {
    assert.equal(
      published[key],
      undefined,
      `flowSnapshotForStep now publishes "${key}". If that is intended, remove it from ` +
        `DELIBERATELY_UNPUBLISHED here and finish the wiring. Reason it was held: ${reason}`,
    );
  }
});

// --- 5. bank and lesson fallbacks --------------------------------------
check("a bare item falls back to its bank state, not to nothing", () => {
  const bare = { uid: "u", stateId: "we-do" };
  const published = flowSnapshotForStep(bare, BANK, LESSON, makeDeps(false));
  assert.equal(published.label, "Bank label");
  assert.equal(published.description, "Bank description");
  assert.equal(published.color, "#123456");
  assert.equal(published.paceDirections, "Bank pace action");
  assert.equal(published.studentAction, "Bank student action");
  assert.equal(published.lessonCode, "M1.T1.L1", "falls back to the active lesson's code");
});

check("an unknown state id still produces a usable step", () => {
  const orphan = { uid: "u", stateId: "not-in-the-bank" };
  const published = flowSnapshotForStep(orphan, [], null, makeDeps(false));
  assert.equal(published.label, "Lesson state");
  assert.equal(published.color, "#35785a");
  assert.ok(published.description.length > 0, "empty renders as nothing, wrong renders on a classroom screen");
  assert.equal(published.lessonCode, "");
});

// --- 6. lineupFromSteps regenerates uids -------------------------------
check("lineupFromSteps gives every row a fresh uid", () => {
  let n = 0;
  const published = [FULL_ITEM, FULL_ITEM].map((item) =>
    flowSnapshotForStep(item, BANK, LESSON, makeDeps(false)),
  );
  const rows = lineupFromSteps(published, () => `uid-${(n += 1)}`);
  assert.deepEqual(rows.map((r) => r.uid), ["uid-1", "uid-2"]);
});

// --- 6b. the label the PREDICATES see is not the published label -------
// The published label falls back to "Lesson state"; inferClassroomStage and
// usesDiscussionProtocol were always handed "" when nothing was authored, and
// both pattern-match the label text. Feeding them the fallback would let the
// words "Lesson state" steer the inferred stage. This drift is invisible unless
// the stubs record what they were given.
check("a bare item gives the label predicates an empty string, not the fallback", () => {
  const seen = { stage: null, protocol: null };
  const deps = {
    ...makeDeps(false),
    inferClassroomStage: (_stateId, label) => {
      seen.stage = label;
      return "scenario";
    },
    usesDiscussionProtocol: (_stateId, label) => {
      seen.protocol = label;
      return false;
    },
  };
  const published = flowSnapshotForStep({ uid: "u", stateId: "orphan" }, [], null, deps);
  assert.equal(published.label, "Lesson state", "the PUBLISHED label still falls back");
  assert.equal(seen.stage, "", "inferClassroomStage must not receive the fallback label");
  assert.equal(seen.protocol, "", "usesDiscussionProtocol must not receive the fallback label");
});

check("an authored title reaches both the published label and the predicates", () => {
  const seen = {};
  const deps = {
    ...makeDeps(false),
    inferClassroomStage: (_s, label) => {
      seen.stage = label;
      return "scenario";
    },
  };
  const published = flowSnapshotForStep({ uid: "u", stateId: "we-do", title: "Partner Talk" }, BANK, null, deps);
  assert.equal(published.label, "Partner Talk");
  assert.equal(seen.stage, "Partner Talk");
});

// --- 6c. the fixture must keep up with the type ------------------------
// Object.keys(FULL_ITEM) drives check #1, so a LineupItem field added to both
// mappers but not to the fixture would be silently untested - which is exactly
// how eyes/voice/supplies/body went unnoticed in the first place.
check("FULL_ITEM covers every LineupItem field", () => {
  const source = fs.readFileSync(path.join(root, "src", "lib", "controlLineup.ts"), "utf8");
  const block = source.match(/export interface LineupItem \{([\s\S]*?)\n\}/);
  assert.ok(block, "could not find the LineupItem interface to check the fixture against");
  const declared = [...block[1].matchAll(/^\s{2}(\w+)\??:/gm)].map((m) => m[1]);
  assert.ok(declared.length > 20, `parsed only ${declared.length} LineupItem fields - the regex has drifted`);
  const missing = declared.filter((key) => !(key in FULL_ITEM));
  assert.deepEqual(
    missing,
    [],
    `FULL_ITEM is missing ${missing.join(", ")}. Add each with a distinctive value, or the round-trip ` +
      `check silently stops covering it.`,
  );
});

// --- 7. /control must not reintroduce an inline mapper -----------------
check("control/page.tsx maps through the shared helpers only", () => {
  const page = fs.readFileSync(path.join(root, "src", "app", "control", "page.tsx"), "utf8");

  assert.ok(
    page.includes("flowSnapshotForStep("),
    "control/page.tsx no longer publishes through flowSnapshotForStep",
  );
  assert.ok(
    page.includes("lineupFromSteps("),
    "control/page.tsx no longer rehydrates through lineupFromSteps",
  );

  // Signatures unique to the old inline literals. They are what drifted.
  for (const inlineSignature of ["studentDirections: step.description", "description: item.studentDirections"]) {
    assert.ok(
      !page.includes(inlineSignature),
      `control/page.tsx has an inline step mapper again ("${inlineSignature}"). ` +
        `Four hand-kept copies is what dropped the state strip; map through src/lib/controlLineup.ts instead.`,
    );
  }

  const rehydrateCalls = page.match(/lineupFromSteps\(/g) || [];
  assert.ok(
    rehydrateCalls.length >= 2,
    `expected both rehydrate sites (server hydration and remote-command) to call lineupFromSteps, found ${rehydrateCalls.length}`,
  );
});

console.log(`control-lineup contract: ${checks} checks passed`);
