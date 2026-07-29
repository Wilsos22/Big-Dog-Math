// Contract: the classroom state strip is all four slots or nothing, its
// vocabulary cannot drift from the Notion select options, and a live override
// cannot outlive the step it was issued at.
//
// WHY THIS EXISTS. The strip is a precorrection device: it names the expected
// state BEFORE the transition that breaks it. Three ways that fails silently,
// all of them checked here.
//
// 1. A part-filled step. If a missing slot rendered as blank, students would be
//    reading a strip that is sometimes empty - and a strip that is sometimes
//    empty stops being scanned at all, which is worse than no strip. So an
//    incomplete step must produce NO strip, and /control must name it.
// 2. A silently coerced value. A typo in Notion that got mapped to some nearby
//    option would put a WRONG state on a classroom screen, which is the failure
//    mode CLAUDE.md keeps warning about: empty renders as nothing, wrong renders
//    on a projector.
// 3. A stale override. "Voice 0" left over from the previous step is exactly how
//    a student ends up holding rods during the exit ticket. The override carries
//    the sequence index it was issued at and expires when that changes.
//
// Run: npm run test:state-strip

import assert from "node:assert/strict";
import {
  STATE_STRIP_SLOTS,
  EYES_VALUES,
  VOICE_VALUES,
  SUPPLIES_VALUES,
  BODY_VALUES,
  stripFromStep,
  missingStripSlots,
  applyStripOverride,
  overrideIsLive,
  voiceDigit,
  voiceWords,
} from "../.tmp-mastery/classroomStateStrip.js";

console.log("classroom state strip contract");

// 1. Slot order is part of the design, not an implementation detail. Position is
//    one of the three redundant cues, so it may never be reordered.
assert.deepEqual([...STATE_STRIP_SLOTS], ["eyes", "voice", "supplies", "body"],
  "Slot order is a fixed cue students read by position. Do not reorder it.");
console.log("  ok  the four slots are in the fixed order eyes, voice, supplies, body");

// 2. The authored vocabulary. These strings are the Notion select options; a
//    change here without a change there means a step can never resolve.
assert.deepEqual([...EYES_VALUES], ["Teacher", "Own paper", "Your build", "The speaker", "The screen"]);
assert.deepEqual([...VOICE_VALUES], ["0 silent", "1 partner", "2 table", "3 presenting"]);
assert.deepEqual([...SUPPLIES_VALUES], ["In the tray", "In your hands", "Parked flat"]);
assert.deepEqual([...BODY_VALUES], ["Seated", "Standing to talk", "Moving"]);
console.log("  ok  the vocabulary matches the Notion select options");

const full = { eyes: "Teacher", voice: "0 silent", supplies: "In the tray", body: "Seated" };

// 3. A complete step resolves.
assert.deepEqual(stripFromStep(full), full);
assert.deepEqual(missingStripSlots(full), []);
console.log("  ok  a step with all four values resolves to a strip");

// 4. ALL FOUR OR NOTHING. Any missing slot yields no strip - never a partial one.
for (const slot of STATE_STRIP_SLOTS) {
  const partial = { ...full, [slot]: "" };
  assert.equal(stripFromStep(partial), null,
    `a step missing ${slot} must render NO strip, not a partial one`);
  assert.deepEqual(missingStripSlots(partial), [slot]);
}
assert.equal(stripFromStep(null), null);
assert.equal(stripFromStep({}), null);
assert.deepEqual(missingStripSlots({}), ["eyes", "voice", "supplies", "body"]);
console.log("  ok  a part-filled step renders nothing, and names the slots it is missing");

// 5. A value outside the vocabulary is NOT coerced to a near match. It fails,
//    so the step is reported rather than putting a wrong state on a screen.
assert.equal(stripFromStep({ ...full, eyes: "the teacher's face" }), null);
assert.deepEqual(missingStripSlots({ ...full, body: "wandering" }), ["body"]);
console.log("  ok  an unrecognised value fails loudly instead of snapping to a near match");

// 6. Tolerant where it is safe to be: case, whitespace, and the bare voice digit
//    a teacher actually types.
assert.deepEqual(stripFromStep({ eyes: "  teacher ", voice: "2", supplies: "PARKED FLAT", body: "moving" }), {
  eyes: "Teacher", voice: "2 table", supplies: "Parked flat", body: "Moving",
});
console.log("  ok  case, padding, and a bare voice digit all resolve");

// 7. The voice digit survives the words coming off - it is the part of the label
//    that never leaves.
assert.equal(voiceDigit("0 silent"), "0");
assert.equal(voiceWords("1 partner"), "partner");
assert.equal(voiceDigit("3 presenting"), "3");
console.log("  ok  the voice digit and its words split cleanly");

// 8. An override applies only to the step it was stamped at, and only to the
//    slots it names.
const override = { voice: "0 silent", atIndex: 4 };
assert.deepEqual(applyStripOverride({ ...full, voice: "2 table" }, override, 4),
  { ...full, voice: "0 silent" },
  "an override at the current index applies to the slots it names");
assert.equal(overrideIsLive(override, 4), true);
console.log("  ok  an override applies to the step it was issued at");

// 9. THE STALE-OVERRIDE GUARD. One advance and it is gone, with no clearing code
//    anywhere in the path. This is the check that stops a student holding rods
//    through the exit ticket.
const authored = { ...full, voice: "2 table" };
assert.deepEqual(applyStripOverride(authored, override, 5), authored,
  "an override must expire the moment the lesson advances");
assert.equal(overrideIsLive(override, 5), false);
assert.deepEqual(applyStripOverride(authored, override, null), authored);
console.log("  ok  an override expires on the next step, with nothing having to clear it");

// 10. An override can never conjure a strip where the step authored none.
assert.equal(applyStripOverride(null, override, 4), null,
  "no authored strip means no strip, override or not");
assert.deepEqual(applyStripOverride(authored, null, 4), authored);
console.log("  ok  an override cannot invent a strip on a step that authored none");

console.log("\nPASS - all four or nothing, no silent coercion, and no override outlives its step.");
