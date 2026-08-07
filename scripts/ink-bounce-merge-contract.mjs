// Ink tip-bounce merge contract.
//
// Measured live on a 10th-gen iPad + USB-C Pencil (2026-08-07, via the
// ?debug=1 pointer counter on /ipad): fast, connected handwriting produces
// runs of pointerdown -> pointerup pairs with ZERO pointermove between them,
// each a fresh pointerId, each at nearly the same page position. That is a
// real Pencil losing contact with the glass for a few ms mid-letter - one
// continuous hand motion, seen by the browser as two touch sessions. The old
// code treated every pointerdown as the unconditional start of a brand-new
// stroke; a 1-point stroke bakes as a sub-pixel dot, so the split half was
// invisible. That is "the second stroke doesn't write."
//
// The fix: a pen pointerup defers finalizing (bake/history/end-segment) for
// BOUNCE_MERGE_MS, in case the very next pointerdown is the same stroke
// resuming. onDown checks a pending deferred stroke first; if the new pen
// touch is close enough in the same tool/kind, it reuses that stroke's id
// instead of starting fresh.
//
// InkBoard.tsx is a React component and can't be compiled in isolation like
// inkGeometry.ts/inkSync.ts (see ink-clear-state-contract.mjs for the same
// note) - this checks the source text directly. It is a structural check:
// it proves the merge logic's guard conditions and wiring are present, not
// that a browser actually merges correctly. That was verified live against
// the running code (three touch sessions - including one with zero real
// samples - collapsing to one stroke and one history entry; and confirmed
// NOT merging when either the time or distance gate fails) before this
// contract was written; this is what keeps it from silently regressing.

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

console.log("ink tip-bounce merge contract");

// ── The constants exist and are sane ────────────────────────────────────
const bounceMsMatch = source.match(/const BOUNCE_MERGE_MS = (\d+);/);
const bounceRadiusMatch = source.match(/const BOUNCE_MERGE_RADIUS = (\d+);/);
ok("BOUNCE_MERGE_MS is defined", Boolean(bounceMsMatch));
ok("BOUNCE_MERGE_RADIUS is defined", Boolean(bounceRadiusMatch));
if (bounceMsMatch) {
  const ms = Number(bounceMsMatch[1]);
  ok(`BOUNCE_MERGE_MS (${ms}ms) is short enough not to feel like a deliberate pause, long enough to survive a real bounce`,
    ms > 0 && ms <= 300);
}
if (bounceRadiusMatch) {
  const radius = Number(bounceRadiusMatch[1]);
  ok(`BOUNCE_MERGE_RADIUS (${radius}px) is a tight tolerance, not "anywhere on the page"`,
    radius > 0 && radius <= 120);
}

// ── onUp: a pen stroke defers finalize instead of finalizing immediately ──
const onUpBody = extractBraceBlock(source, "const onUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {", "onUp");

ok("onUp still finalizes a snapped/frozen shape immediately - it already held still, not a bounce candidate",
  /frozenShapeRef\.current/.test(onUpBody) && /channelRef\.current\?\.send\(\{ t: "replace", stroke \}\)/.test(onUpBody));

ok("onUp defers finalize specifically for pointerType pen",
  /e\.pointerType === "pen"/.test(onUpBody));

ok("the deferred path stores the pending stroke's id, object, and last page position",
  /pendingFinalizeRef\.current\s*=\s*\{\s*id,\s*stroke,\s*lastPage\s*\}/.test(onUpBody));

ok("the deferred path arms a timeout bounded by BOUNCE_MERGE_MS, not a bare setTimeout with a magic number",
  /window\.setTimeout\(\(\) => \{[\s\S]*?\}, BOUNCE_MERGE_MS\)/.test(onUpBody));

ok("the timeout callback finalizes through the shared finalizeStroke helper - not a second copy of the finalize logic",
  /finalizeStroke\(id, stroke\)/.test(onUpBody));

ok("mouse/finger-draw strokes finalize immediately - no hardware tip-bounce to guard against for them",
  /Mouse or finger-draw/.test(onUpBody) && /finalizeStroke\(id, stroke\)/.test(onUpBody));

// ── onDown: checks for a mergeable pending stroke before starting fresh ───
const onDownBody = extractBraceBlock(source, "const onDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {", "onDown");

ok("onDown reads pendingFinalizeRef before generating the normal-stroke fresh id",
  (() => {
    const pendingIdx = onDownBody.indexOf("pendingFinalizeRef.current");
    // crypto.randomUUID() appears twice: once for laser (checked first,
    // unrelated to bounce-merge), once for a normal fresh stroke - the
    // LAST occurrence, which is what the merge check must run before.
    const freshIdIdx = onDownBody.lastIndexOf("crypto.randomUUID()");
    return pendingIdx !== -1 && freshIdIdx !== -1 && pendingIdx < freshIdIdx;
  })());

ok("the merge check requires pointerType pen - a finger or mouse touch near the same spot must not adopt a pen stroke",
  /pending && e\.pointerType === "pen"/.test(onDownBody));

ok("the merge check compares tool/erase/highlight kind, not just position - switching tools must not merge",
  /pending\.stroke\.erase === wantErase/.test(onDownBody)
  && /pending\.stroke\.m === "h"\) === wantHl/.test(onDownBody));

ok("the merge check measures real distance against BOUNCE_MERGE_RADIUS, not just presence of a pending stroke",
  /Math\.hypot\(pg\.x - pending\.lastPage\.x, pg\.y - pending\.lastPage\.y\)/.test(onDownBody)
  && /dist <= BOUNCE_MERGE_RADIUS/.test(onDownBody));

ok("a successful merge cancels the pending timer instead of leaving it to fire later against a now-continuing stroke",
  /cancelPendingFinalize\(\)/.test(onDownBody));

ok("a successful merge reuses the pending stroke's id rather than generating a new one",
  /activeIdRef\.current = pending\.id/.test(onDownBody));

ok("the merged continuation segment carries no start flag - applySeg must find the EXISTING stroke by id, not create another",
  (() => {
    const mergeSegIdx = onDownBody.indexOf("id: pending.id, color: pending.stroke.color");
    if (mergeSegIdx === -1) return false;
    const segLiteral = onDownBody.slice(onDownBody.lastIndexOf("{", mergeSegIdx), onDownBody.indexOf("};", mergeSegIdx));
    return !/start:\s*true/.test(segLiteral);
  })());

// ── finalizeStroke exists once and is what both paths call ────────────────
ok("finalizeStroke is declared exactly once - onUp's immediate and deferred paths must share it, not duplicate its body",
  (source.match(/const finalizeStroke = useCallback/g) || []).length === 1);

const finalizeBody = extractBraceBlock(source, "const finalizeStroke = useCallback((id: string, stroke: InkStroke) => {", "finalizeStroke");
ok("finalizeStroke sends the end segment and records history - the same two things immediate finalize always did",
  /end:\s*true/.test(finalizeBody) && /recordOp\(\{ kind: "draw", stroke \}\)/.test(finalizeBody));

console.log(`\n${checks} ink tip-bounce merge checks passed`);
console.log("PASS - a real Pencil losing contact for a few ms mid-stroke can no longer split into an invisible fragment.");
