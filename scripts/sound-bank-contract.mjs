// Contract: the classroom sound bank is ONE list, and the three places that
// have to agree about it cannot drift apart.
//
// WHY THIS EXISTS. The bank spans three files by necessity - the cues and their
// synthesis in src/lib/soundBank.ts, the iPad deck keys in src/lib/remoteDeck.ts,
// and the wire vocabulary in TEACHER_REMOTE_ACTIONS - and every way that drifts
// fails SILENTLY in front of a class.
//
// 1. A deck key whose action is not in TEACHER_REMOTE_ACTIONS is rejected by
//    /api/control-remote. The teacher taps it, nothing happens, and nothing says
//    why. This is the exact defect /api/teacher/poll shipped with a hand-copied
//    list of poll kinds, so the deck is DERIVED here and the derivation is
//    asserted rather than trusted.
// 2. A cue id that is not file-safe silently breaks the mp3 override: the id IS
//    the /sounds/<id>.mp3 filename, so an uppercase letter or a space means
//    Steele drops in a real clip and nothing changes.
// 3. A cue with no synthesis function is a dead button, because public/sounds/ is
//    empty by design - the synthesized version is the only version that exists
//    until he records one.
//
// Run: npm run test:sound-bank

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  SOUND_CUES,
  SOUND_CUE_IDS,
  SOUND_CUE_ACTION_PREFIX,
  soundCue,
  soundCueAction,
  soundCueIdForAction,
  soundCueFileUrl,
} from "../.tmp-mastery/soundBank.js";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const liveClassFlow = read("src/lib/liveClassFlow.ts");
const remoteDeck = read("src/lib/remoteDeck.ts");
const control = read("src/app/control/page.tsx");
const remotePage = read("src/app/teacher/remote/page.tsx");

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  console.log(`  ok  ${name}`);
}

// TEACHER_REMOTE_ACTIONS read as text, the same way the proxy gate contract reads
// its two lists: the union lives in a file full of "@/" imports, so it cannot be
// compiled in isolation alongside the bank.
function remoteActions() {
  const start = liveClassFlow.indexOf("export const TEACHER_REMOTE_ACTIONS = [");
  assert.notEqual(start, -1, "TEACHER_REMOTE_ACTIONS moved - this contract needs updating");
  const end = liveClassFlow.indexOf("] as const;", start);
  return [...liveClassFlow.slice(start, end).matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

const actions = remoteActions();

// Control's own timer cue sounds. They share the play- prefix and predate the
// bank; they are NOT cues and must not resolve to one.
const TIMER_CUE_ACTIONS = ["play-warning", "play-countdown", "play-times-up"];

console.log("sound bank contract");

check("Steele's ask is covered, plus the classroom companions", () => {
  // applause and the sad trombone are his words (2026-07-29); crickets is the
  // silence joke the trombone pairs with, and the rest are the obvious set.
  for (const required of ["applause", "sad-trombone", "crickets", "drumroll", "ding", "buzzer"]) {
    assert.ok(soundCue(required), `the bank is missing the ${required} cue`);
  }
});

check("ids are unique", () => {
  assert.equal(new Set(SOUND_CUE_IDS).size, SOUND_CUE_IDS.length, "a duplicate id would shadow a cue");
  const fromCues = SOUND_CUES.map((cue) => cue.id);
  assert.deepEqual(fromCues, [...SOUND_CUE_IDS], "SOUND_CUES and SOUND_CUE_IDS must be the same list, in the same order");
});

check("ids are file-safe, because the id is the filename", () => {
  for (const cue of SOUND_CUES) {
    assert.match(cue.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `"${cue.id}" cannot be a /sounds/<id>.mp3 filename`);
    assert.equal(soundCueFileUrl(cue.id), `/sounds/${cue.id}.mp3`);
  }
});

check("every cue has a label, a detail, a tone, and a synthesis function", () => {
  for (const cue of SOUND_CUES) {
    assert.equal(typeof cue.label, "string");
    assert.ok(cue.label.trim().length > 0, `${cue.id} has no label`);
    assert.ok(cue.detail.trim().length > 0, `${cue.id} has no deck detail`);
    assert.equal(typeof cue.render, "function", `${cue.id} has no synthesized sound, so it is a dead button`);
    assert.ok(cue.render.length >= 3, `${cue.id}'s renderer must take (context, out, time)`);
  }
});

check("labels stay plain text - no emoji anywhere (hard rule 1)", () => {
  for (const cue of SOUND_CUES) {
    for (const text of [cue.label, cue.detail]) {
      assert.match(text, /^[\x20-\x7e]+$/, `"${text}" is not plain ASCII copy`);
    }
  }
});

check("every cue's action is in TEACHER_REMOTE_ACTIONS", () => {
  for (const cue of SOUND_CUES) {
    const action = soundCueAction(cue.id);
    assert.equal(action, `${SOUND_CUE_ACTION_PREFIX}${cue.id}`);
    assert.ok(
      actions.includes(action),
      `"${action}" is missing from TEACHER_REMOTE_ACTIONS in src/lib/liveClassFlow.ts - /api/control-remote would reject the tap and say nothing`,
    );
  }
});

check("no orphan play- action: every one resolves to a cue or a timer cue", () => {
  for (const action of actions.filter((a) => a.startsWith(SOUND_CUE_ACTION_PREFIX))) {
    if (TIMER_CUE_ACTIONS.includes(action)) {
      assert.equal(soundCueIdForAction(action), null, `${action} is a Control timer cue, not a bank cue`);
      continue;
    }
    assert.ok(soundCueIdForAction(action), `"${action}" is in the action union but maps to no cue in the bank`);
  }
});

check("a non-cue action never resolves to a cue", () => {
  for (const action of ["next", "previous", "transition-now", "play-", "play-nope", "spin-spinner"]) {
    assert.equal(soundCueIdForAction(action), null, `${action} must not resolve to a cue`);
  }
});

check("the iPad deck is DERIVED from the bank, not a second hand-kept list", () => {
  const start = remoteDeck.indexOf("export const SOUND_BANK_REMOTE_BUTTONS");
  assert.notEqual(start, -1, "remoteDeck.ts has no SOUND_BANK_REMOTE_BUTTONS export");
  const block = remoteDeck.slice(start, remoteDeck.indexOf("));", start));
  assert.ok(block.includes("SOUND_CUES.map("), "the deck must map SOUND_CUES; a literal list here is how it drifts");
  for (const cue of SOUND_CUES) {
    assert.ok(
      !remoteDeck.includes(`"${soundCueAction(cue.id)}"`),
      `remoteDeck.ts hardcodes "${soundCueAction(cue.id)}" - derive it from SOUND_CUES instead`,
    );
  }
});

check("every deck tone is a tone the Remote's stylesheet actually styles", () => {
  for (const cue of SOUND_CUES) {
    assert.ok(
      cue.tone === "neutral" || remotePage.includes(`.deck-key.${cue.tone} {`),
      `tone "${cue.tone}" on ${cue.id} has no .deck-key rule, so the key renders unstyled`,
    );
  }
});

check("the Remote renders the derived deck, and the Abbie deck is gone", () => {
  assert.ok(remotePage.includes("SOUND_BANK_REMOTE_BUTTONS.map("), "the sound bank section is not on the Remote");
  assert.ok(!remotePage.includes("ABBIE_REMOTE_BUTTONS"), "the Abbie AI deck came off the site on 2026-07-29");
});

check("Control plays the bank through the same remote-command handler as the timer cues", () => {
  for (const timerAction of TIMER_CUE_ACTIONS) {
    assert.ok(control.includes(`command.action === "${timerAction}"`), `Control stopped handling ${timerAction}`);
  }
  assert.ok(control.includes("soundCueIdForAction(command.action)"), "Control does not resolve sound-bank commands");
  assert.ok(control.includes("playSoundCue("), "Control does not play sound-bank cues");
});

console.log(`\n${checks} sound bank checks passed`);
console.log(`PASS - ${SOUND_CUES.length} cues, each synthesized, each file-overridable, and the deck cannot drift from the union.`);
