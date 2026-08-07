// Contract: a Gallery Walk rotation runs the configured number of stations, at
// the configured length, beeps only in the last window of EACH station (never
// the closing seats-check), and never silently invents its own clock.
//
// WHY THIS EXISTS. Steele's Feature Tracker spec names two different chunk
// counts in the same sentence - "8 chunks" and "same process 4 times" - and he
// settled it (2026-08-06) by making it AUTHORABLE PER LESSON: the shipped
// `GalleryWalkRoutineConfig` (stationCount, rotationMinutes) is the source of
// truth, and `galleryWalkPhasesFromRoutine` is the only entry point the render
// surfaces use. Ways that could go wrong quietly if this contract did not pin it:
// 1. A bad chunkCount silently clamping instead of refusing - the room would
//    run a DIFFERENT rotation than configured, with nobody told.
// 2. The beep window bleeding into the final "eyes up" phase - Steele asked
//    for beeps on the station countdown, not the seat-check timer.
// 3. The phase math drifting from discussionPhases.ts's proven shape, since
//    this module exists specifically to mirror it so the surfaces reuse the
//    same call pattern.
// 4. THE UNITS. The config counts in MINUTES (0.5-60), the engine counts in
//    SECONDS. A wrong conversion is a rotation that is 60x too long or 60x too
//    short on a projector in front of thirty kids, and nothing would say so.
//
// Run: npm run test:gallery-walk-timer

import assert from "node:assert/strict";
import {
  DEFAULT_GALLERY_STATION_SECONDS,
  DEFAULT_GALLERY_BEEP_WINDOW_SECONDS,
  DEFAULT_GALLERY_FINAL_SECONDS,
  DEFAULT_GALLERY_CHUNK_COUNT,
  MIN_GALLERY_CHUNKS,
  MAX_GALLERY_CHUNKS,
  buildGalleryWalkPhases,
  galleryWalkPhasesFromRoutine,
  galleryWalkMinutes,
  activeGalleryWalkPhase,
  galleryWalkStageCountdown,
} from "../.tmp-mastery/galleryWalkTimer.js";

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  console.log(`  ok  ${name}`);
}

console.log("gallery walk timer contract");

check("Steele's stated defaults are exactly 30s station / 10s beep / 15s final", () => {
  assert.equal(DEFAULT_GALLERY_STATION_SECONDS, 30);
  assert.equal(DEFAULT_GALLERY_BEEP_WINDOW_SECONDS, 10);
  assert.equal(DEFAULT_GALLERY_FINAL_SECONDS, 15);
});

check("the AUTHORED config drives the rotation - stations from stationCount, length from rotationMinutes", () => {
  // The shipped defaults of GalleryWalkRoutineConfig: 4 stations, 3 minutes.
  const built = galleryWalkPhasesFromRoutine({ stationCount: 4, rotationMinutes: 3 });
  assert.equal(built.ok, true);
  assert.equal(built.chunkCount, 4, "stations come from stationCount, not from any constant in this module");
  assert.equal(built.phases.filter((p) => p.kind === "station").length, 4);
  assert.ok(built.phases.slice(0, 4).every((p) => p.seconds === 180), "3 minutes is 180 seconds");
  assert.equal(built.totalSeconds, 4 * 180 + 15);
  // The two numbers that are NOT room layout stay at Steele's stated defaults.
  assert.equal(built.beepWindowSeconds, DEFAULT_GALLERY_BEEP_WINDOW_SECONDS);
  assert.equal(built.phases[4].seconds, DEFAULT_GALLERY_FINAL_SECONDS);
});

check("rotationMinutes 0.5 IS Steele's 30 seconds - the existing field already expresses the spec", () => {
  const built = galleryWalkPhasesFromRoutine({ stationCount: 8, rotationMinutes: 0.5 });
  assert.equal(built.ok, true);
  assert.equal(built.chunkCount, 8);
  assert.ok(
    built.phases.filter((p) => p.kind === "station").every((p) => p.seconds === DEFAULT_GALLERY_STATION_SECONDS),
    "0.5 minutes must convert to exactly 30 seconds - no second competing rotationSeconds field",
  );
  // The whole spec, expressed entirely in already-shipped authored fields:
  // 8 stations x 30s, beeps in the last 10 of each, then 15s eyes up.
  assert.equal(built.totalSeconds, 8 * 30 + 15);
  const { phases, totalSeconds, beepWindowSeconds } = built;
  const lastTen = galleryWalkStageCountdown(phases, totalSeconds, totalSeconds - 25, beepWindowSeconds);
  assert.equal(lastTen.secondsLeft, 5);
  assert.equal(lastTen.beeping, true);
});

check("the minute -> second conversion holds across the authored range, and never off by 60x", () => {
  assert.equal(galleryWalkPhasesFromRoutine({ stationCount: 1, rotationMinutes: 1 }).phases[0].seconds, 60);
  assert.equal(galleryWalkPhasesFromRoutine({ stationCount: 1, rotationMinutes: 2.5 }).phases[0].seconds, 150);
  assert.equal(galleryWalkPhasesFromRoutine({ stationCount: 1, rotationMinutes: 60 }).phases[0].seconds, 3600);
  // A fractional minute that is not a whole second rounds, never truncates to 0.
  assert.equal(galleryWalkPhasesFromRoutine({ stationCount: 1, rotationMinutes: 0.51 }).phases[0].seconds, 31);
});

check("a lesson with NO authored config falls back to the documented defaults rather than crashing", () => {
  for (const missing of [null, undefined]) {
    const built = galleryWalkPhasesFromRoutine(missing);
    assert.equal(built.ok, true, "the engine stays total - a missing config must never throw at a render surface");
    assert.equal(built.chunkCount, DEFAULT_GALLERY_CHUNK_COUNT);
    assert.ok(built.phases.filter((p) => p.kind === "station").every((p) => p.seconds === DEFAULT_GALLERY_STATION_SECONDS));
    assert.equal(built.totalSeconds, DEFAULT_GALLERY_CHUNK_COUNT * DEFAULT_GALLERY_STATION_SECONDS + DEFAULT_GALLERY_FINAL_SECONDS);
  }
});

check("an authored stationCount outside 1-20 refuses to run - it does not fall back to the default", () => {
  assert.equal(galleryWalkPhasesFromRoutine({ stationCount: 0, rotationMinutes: 3 }).ok, false);
  assert.equal(galleryWalkPhasesFromRoutine({ stationCount: 21, rotationMinutes: 3 }).ok, false);
  const zeroLength = galleryWalkPhasesFromRoutine({ stationCount: 4, rotationMinutes: 0 });
  assert.equal(zeroLength.ok, false, "a zero-length rotation is not a rotation");
});

check("the beep window is CLAMPED to the station, so an authored config can never fail on it alone", () => {
  // Below the authored 0.5-minute floor, so only reachable from a malformed
  // snapshot - but a projector must render a rotation, not an error card.
  const built = galleryWalkPhasesFromRoutine({ stationCount: 2, rotationMinutes: 0.1 });
  assert.equal(built.ok, true);
  assert.equal(built.phases[0].seconds, 6);
  assert.equal(built.beepWindowSeconds, 6, "clamped to the station rather than refusing at 10 > 6");
});

check("the fallback chunk count is 8, and is never a magic literal at a call site", () => {
  assert.equal(DEFAULT_GALLERY_CHUNK_COUNT, 8);
  const built = buildGalleryWalkPhases({ chunkCount: DEFAULT_GALLERY_CHUNK_COUNT });
  assert.equal(built.ok, true);
  assert.equal(built.chunkCount, 8);
  // 8 stations * 30s + one 15s final phase.
  assert.equal(built.totalSeconds, 8 * 30 + 15);
  assert.equal(built.phases.length, 9);
  assert.equal(built.phases.filter((p) => p.kind === "station").length, 8);
  assert.equal(built.phases.filter((p) => p.kind === "final").length, 1);
});

check("chunkCount is configurable - the room using 4 stations changes ONE argument", () => {
  const built = buildGalleryWalkPhases({ chunkCount: 4 });
  assert.equal(built.ok, true);
  assert.equal(built.chunkCount, 4);
  assert.equal(built.phases.filter((p) => p.kind === "station").length, 4);
  assert.equal(built.totalSeconds, 4 * 30 + 15);
});

check("station and beep-window seconds are configurable too", () => {
  const built = buildGalleryWalkPhases({ chunkCount: 2, stationSeconds: 45, beepWindowSeconds: 12, finalSeconds: 20 });
  assert.equal(built.ok, true);
  assert.deepEqual(built.phases.map((p) => p.seconds), [45, 45, 20]);
});

check("finalSeconds of 0 omits the seats-check phase entirely", () => {
  const built = buildGalleryWalkPhases({ chunkCount: 3, finalSeconds: 0 });
  assert.equal(built.ok, true);
  assert.equal(built.phases.length, 3);
  assert.ok(built.phases.every((p) => p.kind === "station"));
});

check("a chunkCount outside 1-20 refuses to run rather than clamping silently", () => {
  assert.equal(buildGalleryWalkPhases({ chunkCount: 0 }).ok, false);
  assert.equal(buildGalleryWalkPhases({ chunkCount: MIN_GALLERY_CHUNKS - 1 }).ok, false);
  assert.equal(buildGalleryWalkPhases({ chunkCount: MAX_GALLERY_CHUNKS + 1 }).ok, false);
  assert.equal(buildGalleryWalkPhases({ chunkCount: Number.NaN }).ok, false);
  const atMax = buildGalleryWalkPhases({ chunkCount: MAX_GALLERY_CHUNKS });
  assert.equal(atMax.ok, true);
});

check("a beep window longer than the station it belongs to refuses to run", () => {
  const built = buildGalleryWalkPhases({ chunkCount: 4, stationSeconds: 30, beepWindowSeconds: 31 });
  assert.equal(built.ok, false);
  assert.match(built.error, /cannot be longer than/);
});

check("station labels count up and every phase carries a real direction", () => {
  const built = buildGalleryWalkPhases({ chunkCount: 3 });
  assert.equal(built.ok, true);
  assert.deepEqual(built.phases.slice(0, 3).map((p) => p.label), [
    "Station 1 of 3", "Station 2 of 3", "Station 3 of 3",
  ]);
  assert.ok(built.phases.every((p) => p.direction.length > 0));
  assert.equal(built.phases[3].direction, "Back in your seats, eyes up.");
});

check("galleryWalkMinutes rounds up, for the same step-Duration check discussionPhaseMinutes serves", () => {
  assert.equal(galleryWalkMinutes(255), 5);
  assert.equal(galleryWalkMinutes(180), 3);
  assert.equal(galleryWalkMinutes(181), 4);
});

check("activeGalleryWalkPhase walks the built sequence on elapsed seconds", () => {
  // 2 stations of 30s + a 15s final -> boundaries at 30, 60, 75.
  const { phases } = buildGalleryWalkPhases({ chunkCount: 2 });
  const start = activeGalleryWalkPhase(phases, 0);
  assert.equal(start.index, 0);
  assert.equal(start.phaseFraction, 0);
  assert.equal(start.done, false);
  const mid = activeGalleryWalkPhase(phases, 45); // 15s into station 2
  assert.equal(mid.index, 1);
  assert.ok(Math.abs(mid.phaseFraction - 0.5) < 1e-9);
  assert.equal(activeGalleryWalkPhase(phases, 30).index, 1, "exactly on a boundary rolls forward");
  assert.equal(activeGalleryWalkPhase(phases, 60).index, 2, "rolls into the final seats-check phase");
  const over = activeGalleryWalkPhase(phases, 500);
  assert.equal(over.done, true);
  assert.equal(over.index, phases.length);
  assert.equal(activeGalleryWalkPhase(phases, -10).index, 0, "negative elapsed clamps to the start");
});

check("galleryWalkStageCountdown counts down the ACTIVE phase off the state clock", () => {
  const { phases, totalSeconds } = buildGalleryWalkPhases({ chunkCount: 2 }); // 30+30+15 = 75
  const start = galleryWalkStageCountdown(phases, totalSeconds, totalSeconds);
  assert.equal(start.index, 0);
  assert.equal(start.secondsLeft, 30);
  assert.equal(start.done, false);
  // 45s elapsed (30 left in state) -> 15s into station 2 -> 15s left in IT, not 30.
  const mid = galleryWalkStageCountdown(phases, totalSeconds, 30);
  assert.equal(mid.index, 1);
  assert.equal(mid.phase.kind, "station");
  assert.equal(mid.secondsLeft, 15);
  const done = galleryWalkStageCountdown(phases, totalSeconds, 0);
  assert.equal(done.done, true);
  assert.equal(done.phase, null);
  assert.equal(galleryWalkStageCountdown([], totalSeconds, 30), null, "no phases falls back to the state timer");
});

check("beeping is true only in the last window of a STATION, never in the final seats-check phase", () => {
  const { phases, totalSeconds } = buildGalleryWalkPhases({ chunkCount: 1 }); // 30s station + 15s final = 45
  // 21s elapsed in the station -> 9s left -> inside the default 10s beep window.
  const beepingLate = galleryWalkStageCountdown(phases, totalSeconds, totalSeconds - 21);
  assert.equal(beepingLate.phase.kind, "station");
  assert.equal(beepingLate.secondsLeft, 9);
  assert.equal(beepingLate.beeping, true);
  // 10s elapsed in the station -> 20s left -> outside the beep window.
  const quietEarly = galleryWalkStageCountdown(phases, totalSeconds, totalSeconds - 10);
  assert.equal(quietEarly.phase.kind, "station");
  assert.equal(quietEarly.secondsLeft, 20);
  assert.equal(quietEarly.beeping, false);
  // Deep into the final phase (5s left of the 15s seats-check) - never beeps,
  // even though 5 <= the default beep window, because the spec asked for
  // beeps on the station countdown, not the seat-check timer.
  const finalPhase = galleryWalkStageCountdown(phases, totalSeconds, 5);
  assert.equal(finalPhase.phase.kind, "final");
  assert.equal(finalPhase.secondsLeft, 5);
  assert.equal(finalPhase.beeping, false);
});

check("a custom beepWindowSeconds is honoured by the countdown, not just the builder", () => {
  const { phases, totalSeconds } = buildGalleryWalkPhases({ chunkCount: 1, beepWindowSeconds: 3 });
  const insideDefaultWindowButOutsideCustom = galleryWalkStageCountdown(phases, totalSeconds, totalSeconds - 21, 3);
  assert.equal(insideDefaultWindowButOutsideCustom.secondsLeft, 9);
  assert.equal(insideDefaultWindowButOutsideCustom.beeping, false, "9s left is outside a 3s beep window");
  const insideCustomWindow = galleryWalkStageCountdown(phases, totalSeconds, totalSeconds - 28, 3);
  assert.equal(insideCustomWindow.secondsLeft, 2);
  assert.equal(insideCustomWindow.beeping, true);
});

console.log(`\n${checks} gallery walk timer checks passed`);
console.log("PASS - the rotation runs the configured stations, at the configured length, and beeps only where asked.");
