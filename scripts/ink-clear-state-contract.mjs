// Ink clear/stroke-state contract.
//
// clearLocal() wipes strokesRef/byIdRef/activeRef - the maps a stroke's data
// lives in - but until this fix it left drawingRef/activeIdRef pointing at
// whatever stroke was in flight untouched. A pointer still down when Clear
// fires (its own pen lifting late, or a remote clear arriving mid-stroke from
// another connected surface) kept reporting drawingRef.current === true, so
// onMove kept passing its "am I drawing" gate, looked its id up in the now-
// empty byIdRef, found nothing, and silently returned - for as long as that
// pointer stayed down. That is "the pointer moves but marks do not appear."
// A second, related gap: the resize effect's cleanup cancels a pending wet-
// layer animation frame but never reset frameRef back to null, so
// scheduleWet()'s own guard ("a frame is already pending, do nothing") saw a
// stale non-null value forever after and stopped scheduling repaints.
//
// InkBoard.tsx is a React component (hooks, JSX, local imports), so it can't
// be compiled in isolation and driven like inkGeometry.ts/inkSync.ts. This
// contract checks the source text directly instead - the same technique
// ink-sync-contract.mjs already uses for "nothing may reach for a raw ink
// channel outside this module." It is a structural check, not a behavioral
// one: it proves the reset statements are present in the right function
// bodies, not that a browser actually drops no ink. Verify the behavior
// itself on a live /ipad session; this is what keeps the fix from silently
// regressing afterward.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const filePath = path.join(root, "src", "components", "InkBoard.tsx");
const source = fs.readFileSync(filePath, "utf8");

let checks = 0;
function ok(label, condition) {
  checks += 1;
  if (!condition) throw new Error(`FAIL - ${label}`);
  console.log(`  ok  ${label}`);
}

// Extract a `{ ... }` block by brace-depth counting from the first `{` after
// an anchor string. Good enough here: neither target block contains a string
// or template literal holding a brace character.
function extractBraceBlock(text, anchor, label) {
  const start = text.indexOf(anchor);
  if (start === -1) throw new Error(`anchor not found for ${label}: ${JSON.stringify(anchor)}`);
  const braceStart = text.indexOf("{", start);
  if (braceStart === -1) throw new Error(`no opening brace after anchor for ${label}`);
  let depth = 0;
  for (let i = braceStart; i < text.length; i += 1) {
    if (text[i] === "{") depth += 1;
    else if (text[i] === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(braceStart, i + 1);
    }
  }
  throw new Error(`unbalanced braces extracting ${label}`);
}

console.log("ink clear/stroke-state contract");

// ── clearLocal must end any stroke it just wiped the data for ──────────────
const clearLocalBody = extractBraceBlock(source, "const clearLocal = useCallback(() => {", "clearLocal");

ok("clearLocal still wipes the stroke maps (the part that already worked)",
  /strokesRef\.current\s*=\s*\[\]/.test(clearLocalBody)
  && /byIdRef\.current\.clear\(\)/.test(clearLocalBody)
  && /activeRef\.current\.clear\(\)/.test(clearLocalBody));

ok("clearLocal ends any stroke in flight (drawingRef)",
  /drawingRef\.current\s*=\s*false/.test(clearLocalBody));

ok("clearLocal drops the dangling active-stroke id (activeIdRef)",
  /activeIdRef\.current\s*=\s*null/.test(clearLocalBody));

ok("clearLocal drops a dangling laser trail id (laserIdRef) - the same gap, one tool over",
  /laserIdRef\.current\s*=\s*null/.test(clearLocalBody));

ok("clearLocal cancels a pending hold-to-straighten timer instead of leaving it armed against wiped data",
  /snapTimerRef\.current\s*!==\s*null/.test(clearLocalBody)
  && /window\.clearTimeout\(snapTimerRef\.current\)/.test(clearLocalBody)
  && /snapTimerRef\.current\s*=\s*null/.test(clearLocalBody));

ok("clearLocal drops any queued-but-unsent network segment rather than flushing it for a stroke that no longer exists",
  /queuedSegmentRef\.current\s*=\s*null/.test(clearLocalBody)
  && /sendFrameRef\.current\s*!==\s*null/.test(clearLocalBody)
  && /window\.cancelAnimationFrame\(sendFrameRef\.current\)/.test(clearLocalBody));

ok("clearLocal cancels a pending bounce-merge finalize rather than letting it fire against wiped data",
  /bounceTimerRef\.current\s*!==\s*null/.test(clearLocalBody)
  && /window\.clearTimeout\(bounceTimerRef\.current\)/.test(clearLocalBody)
  && /bounceTimerRef\.current\s*=\s*null/.test(clearLocalBody)
  && /pendingFinalizeRef\.current\s*=\s*null/.test(clearLocalBody));

// clearLocal must not depend on clearSnapTimer/flushQueuedSegment by name -
// both are declared LATER in this file, so referencing them here (rather than
// the raw refs) would be a temporal-dead-zone bug the moment this function
// is invoked before those useCallbacks are reachable by any code path that
// assumes declaration order matters. This also guards against a "cleanup" of
// this fix that swaps the inline ref-resets for the named helpers.
const clearLocalDeclOffset = source.indexOf("const clearLocal = useCallback(() => {");
const clearSnapTimerDeclOffset = source.indexOf("const clearSnapTimer = useCallback(");
const flushQueuedSegmentDeclOffset = source.indexOf("const flushQueuedSegment = useCallback(");
ok("clearSnapTimer is declared after clearLocal (context for the check above)", clearSnapTimerDeclOffset > clearLocalDeclOffset);
ok("flushQueuedSegment is declared after clearLocal (context for the check above)", flushQueuedSegmentDeclOffset > clearLocalDeclOffset);
ok("clearLocal's body does not call the not-yet-declared clearSnapTimer()",
  !/[^.]\bclearSnapTimer\(\)/.test(clearLocalBody));
ok("clearLocal's body does not call the not-yet-declared flushQueuedSegment()",
  !/\bflushQueuedSegment\(\)/.test(clearLocalBody));

// ── The resize-effect cleanup must null frameRef, not just cancel it ───────
const cleanupAnchorIdx = source.indexOf("ro?.disconnect();");
if (cleanupAnchorIdx === -1) throw new Error("could not find the resize-effect cleanup (anchor ro?.disconnect() missing)");
const cleanupWindow = source.slice(cleanupAnchorIdx, cleanupAnchorIdx + 700);

ok("the resize-effect cleanup still cancels a pending wet-layer frame (the part that already worked)",
  /window\.cancelAnimationFrame\(frameRef\.current\)/.test(cleanupWindow));

ok("the resize-effect cleanup resets frameRef to null after cancelling it - or scheduleWet's own guard stays stuck forever",
  /window\.cancelAnimationFrame\(frameRef\.current\);\s*frameRef\.current\s*=\s*null;/.test(cleanupWindow));

console.log(`\n${checks} ink clear/stroke-state checks passed`);
console.log("PASS - a stroke in flight when Clear fires can no longer strand the pointer that was drawing it, and a cancelled wet-layer frame can no longer strand scheduleWet's own guard.");
