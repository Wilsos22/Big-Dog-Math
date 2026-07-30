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
  matchSoundCueFile,
  slugFileName,
} from "../.tmp-mastery/soundBank.js";
import {
  MAX_SOUND_LABEL,
  normalizeSoundLabel,
  normalizeSoundLabels,
  soundLabelFor,
} from "../.tmp-mastery/soundBankLabels.js";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const liveClassFlow = read("src/lib/liveClassFlow.ts");
const remoteDeck = read("src/lib/remoteDeck.ts");
const control = read("src/app/control/page.tsx");
const remotePage = read("src/app/teacher/remote/page.tsx");
const soundBankSource = read("src/lib/soundBank.ts");
const soundLabelsSource = read("src/lib/soundBankLabels.ts");

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

// The bank IS Steele's Stream Deck sound board (2026-07-30: "these are the
// soundbites i would like mapped"). These are the exact files he sent, so this
// list is the specification - if a cue disappears from the bank, a button he
// reaches for mid-lesson is gone.
const STEELE_FILES = [
  "Air Horn.mp3", "Applause.mp3", "cheering.mp3", "crickets.mp3", "Drum roll.mp3",
  "dun-dun-dun-sound-effect-brass_8nFBccR.mp3", "Jeopardy-theme-song.mp3", "locked-in.mp3",
  "sponge-stank-noise copy.mp3", "2-chainz-says-true.mp3",
  "a-few-moments-later-sponge-bob-sfx-fun.mp3", "another-one_dPvHt2Z.mp3", "bingo_sdTuErT.mp3",
  "bruh-sound-effect_WstdzdM.mp3", "directed-by-robert-b_voI2Z4T.mp3",
  "i-guess-well-never-know-kanye.mp3", "law and order.mp3", "lil-jon-what.mp3", "metroooo.mp3",
  "money-soundfx.mp3", "record-scratch-2.mp3", "straight-up-travis-scott.mp3",
  "travisscott-omg.mp3", "well be right back.mp3", "you.mp3",
];

check("every clip Steele asked for has a button", () => {
  assert.equal(SOUND_CUES.length, STEELE_FILES.length, "the bank and his sound board have drifted apart");
});

check("each of his files lands on its own button, so one bulk load fills the bank", () => {
  const placed = new Map();
  for (const file of STEELE_FILES) {
    const id = matchSoundCueFile(file);
    assert.ok(id, `nothing claims "${file}" - it would land on no button`);
    assert.ok(!placed.has(id), `"${file}" and "${placed.get(id)}" both claim ${id}`);
    placed.set(id, file);
  }
  assert.equal(placed.size, SOUND_CUES.length, "some button would be left with no clip");
});

check("a file nobody asked for is reported, not dropped on a random button", () => {
  assert.equal(matchSoundCueFile("Water Park_.mp3"), null);
  assert.equal(matchSoundCueFile("10-seconds-count-down.mp3"), null);
  assert.equal(matchSoundCueFile(""), null);
});

check("filenames normalize past capitals, spaces, copies and download suffixes", () => {
  assert.equal(slugFileName("Drum roll.mp3"), "drum-roll");
  assert.equal(slugFileName("bruh-sound-effect_WstdzdM.mp3"), "bruh-sound-effect");
  assert.equal(slugFileName("sponge-stank-noise copy.mp3"), "sponge-stank-noise");
  assert.equal(slugFileName("back-to-work (1).mp3"), "back-to-work");
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


// ── Loadable clips and editable names ───────────────────────────────────────
// Three sources in a fixed order - a clip the teacher loaded on the classroom
// laptop, then a committed public/sounds/<id>.mp3, then synthesis - so a deck
// key can never be silent. And because clips are loaded on /control while the
// buttons are pressed on the iPad, a renamed button has to actually reach the
// Remote or the teacher is reading the wrong name mid-lesson.

check("a loaded clip wins, then the committed file, then synthesis", () => {
  assert.ok(soundBankSource.includes("installUserClip"), "no way to install a teacher's clip");
  assert.ok(soundBankSource.includes("clearUserClip"), "no way to take one back off");
  const play = soundBankSource.slice(soundBankSource.indexOf("export function playSoundCue"));
  assert.ok(
    play.includes("userBuffers.get(id) ?? fileBuffers.get(id)"),
    "playback must prefer the teacher's clip over the committed file",
  );
  assert.ok(play.includes("cue.render("), "synthesis must stay the last resort, so no key is ever silent");
});

check("bytes that will not decode are reported, not silently ignored", () => {
  const install = soundBankSource.slice(soundBankSource.indexOf("export async function installUserClip"));
  assert.ok(/catch\s*\{[^}]*return false;/.test(install), "a broken file must report failure");
});

check("Control owns both the clips and the names", () => {
  assert.ok(control.includes("bank:"), "bank clips must be namespaced in the shared sound store");
  assert.ok(control.includes("installUserClip("), "Control does not hand loaded clips to the bank");
  assert.ok(control.includes("renameSoundCue"), "Control has no way to rename a button");
  assert.ok(control.includes("SOUND_LABEL_ROOM"), "Control does not publish names to the iPad");
  assert.ok(control.includes('t: "labels"'), "Control never answers with the name set");
});

check("the Remote asks for the names and puts them on the keys", () => {
  assert.ok(remotePage.includes("SOUND_LABEL_ROOM"), "the Remote does not subscribe to button names");
  assert.ok(remotePage.includes('t: "hello"'), "the Remote must ask on mount, not wait for an edit");
  assert.ok(remotePage.includes("soundLabelFor("), "the deck keys do not apply the teacher's names");
  assert.ok(remotePage.includes("writeStoredSoundLabels"), "the Remote must cache names to read right on reload");
});

check("a cue with no custom name keeps its built-in one", () => {
  assert.equal(soundLabelFor("buzzer", "Buzzer", {}), "Buzzer");
  assert.equal(soundLabelFor("buzzer", "Buzzer", { buzzer: "Airhorn" }), "Airhorn");
  assert.equal(soundLabelFor("buzzer", "Buzzer", { buzzer: "" }), "Buzzer");
});

check("names are trimmed, collapsed and capped, and blanking one restores the default", () => {
  assert.equal(normalizeSoundLabel("  Air   horn  "), "Air horn");
  assert.equal(normalizeSoundLabel("   "), "");
  assert.equal(normalizeSoundLabel("x".repeat(200)).length, MAX_SOUND_LABEL);
  assert.deepEqual(normalizeSoundLabels({ buzzer: "  ", ding: "Bell", bad: 7 }), { ding: "Bell" });
  assert.deepEqual(normalizeSoundLabels(null), {});
});

check("a button name is a device preference, never classroom data", () => {
  // /control full-replaces its live_flow snapshot about once a second and that
  // snapshot reaches student screens. A button name has no business in it, and
  // needs no server state at all.
  const withoutComments = soundLabelsSource.replace(/\/\/.*$/gm, "");
  assert.ok(!/supabase|live_flow/i.test(withoutComments), "names must need no server state");
});

console.log(`\n${checks} sound bank checks passed`);
console.log(`PASS - ${SOUND_CUES.length} cues, each synthesized, each file-overridable, and the deck cannot drift from the union.`);
