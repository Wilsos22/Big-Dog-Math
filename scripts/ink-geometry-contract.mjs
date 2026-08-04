// Ink stroke geometry contract.
//
// The pen is a CONSTANT-WIDTH MARKER (Steele, 2026-07-22 - he writes equations,
// not calligraphy), and the one thing a constant-width marker must never do is
// get thinner. Offsetting a centreline by moving each point along its own
// normal by exactly r does exactly that at a corner: the outer edge lands at
// r*cos(theta/2), so a 90-degree turn comes out about 30% pinched. Handwritten
// digits and operators are almost entirely corners, which is why that pinch
// reads as "jagged" (Steele, 2026-08-03) while a long smooth test scribble
// looks fine - the artifact hides exactly where nobody scribbles.
//
// So the load-bearing property here is geometric, not visual: THE FILLED
// POLYGON MUST CONTAIN A DISC OF THE NIB'S RADIUS AT EVERY POINT ALONG THE
// CENTRELINE IT WAS BUILT FROM. These checks measure that directly with
// point-in-polygon, which is why they fail on the un-mitered implementation
// and would fail again if someone "simplified" the joint back to a plain
// perpendicular offset.
//
// Note the centreline tested against is the SMOOTHED one, not the raw input -
// smoothing legitimately rounds a corner, and asserting against raw samples
// would just be asserting that smoothing is off.

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

const compiled = path.join(root, ".tmp-mastery", "inkGeometry.js");
if (!fs.existsSync(compiled)) throw new Error(`missing compiled module at ${compiled} - run the tsc step first`);
const geom = require(compiled);
const { strokeOutline, smoothCenterline, dejitter, thinPoints } = geom;

// ── helpers ────────────────────────────────────────────────────────────────

const pt = (x, y, p = 0.6) => ({ x, y, p });

// Point-in-polygon by WINDING NUMBER, on a flat [x0,y0,x1,y1,...] ring.
//
// It has to be the nonzero rule, because that is what ctx.fill() uses by
// default and therefore what the room actually sees. The distinction is not
// academic here: on the inside of any corner the two offset edges cross each
// other, and an even-odd test (plain ray casting) reads that overlap as a
// HOLE while the canvas fills it solid. Testing with even-odd reports a
// perfectly good corner as ~2% covered.
function isLeft(x0, y0, x1, y1, x, y) {
  return (x1 - x0) * (y - y0) - (x - x0) * (y1 - y0);
}
function inside(ring, x, y) {
  let wn = 0;
  const n = ring.length / 2;
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    const xi = ring[i * 2], yi = ring[i * 2 + 1];
    const xj = ring[j * 2], yj = ring[j * 2 + 1];
    if (yi <= y) {
      if (yj > y && isLeft(xi, yi, xj, yj, x, y) > 0) wn += 1;
    } else if (yj <= y && isLeft(xi, yi, xj, yj, x, y) < 0) wn -= 1;
  }
  return wn !== 0;
}

// The centreline strokeOutline actually builds from, so a test can measure the
// same path the renderer drew.
const centreline = (raw) => smoothCenterline(dejitter(thinPoints(raw)));

// Every point of a disc of radius r about c must be inside the ring. Ends are
// skipped: the round cap is a 7-step fan, so a full disc at the very tip pokes
// past the polygonal approximation by the chord error, which is not a pinch.
function discCovered(ring, c, r, samples = 24) {
  for (let k = 0; k < samples; k += 1) {
    const t = (k / samples) * Math.PI * 2;
    if (!inside(ring, c.x + Math.cos(t) * r, c.y + Math.sin(t) * r)) return false;
  }
  return true;
}

function minNibCoverage(raw, baseWidth) {
  const ring = strokeOutline(raw, baseWidth);
  const line = centreline(raw);
  const r = baseWidth / 2;
  // Walk the interior; report the largest fraction of the nib that is covered
  // everywhere, by bisecting on the coverage radius.
  let worst = 1;
  for (let i = 2; i < line.length - 2; i += 1) {
    if (discCovered(ring, line[i], r * 0.97)) continue;
    let lo = 0, hi = 0.97;
    for (let it = 0; it < 12; it += 1) {
      const mid = (lo + hi) / 2;
      if (discCovered(ring, line[i], r * mid)) lo = mid; else hi = mid;
    }
    worst = Math.min(worst, lo);
  }
  return worst;
}

// A polyline sampled densely enough to look like real pen input.
function samplePath(corners, step = 2) {
  const out = [];
  for (let i = 0; i < corners.length - 1; i += 1) {
    const a = corners[i], b = corners[i + 1];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.round(d / step));
    for (let k = 0; k < n; k += 1) {
      const t = k / n;
      out.push(pt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t));
    }
  }
  out.push(pt(corners[corners.length - 1].x, corners[corners.length - 1].y));
  return out;
}

// An arc sampled the same way - the bowl of a 6, an 8, a c.
function arcPath(cx, cy, r, a0, a1, step = 2) {
  const out = [];
  const n = Math.max(2, Math.round((Math.abs(a1 - a0) * r) / step));
  for (let k = 0; k <= n; k += 1) {
    const t = a0 + ((a1 - a0) * k) / n;
    out.push(pt(cx + Math.cos(t) * r, cy + Math.sin(t) * r));
  }
  return out;
}

console.log("Ink stroke geometry contract");

// ── the corner pinch ───────────────────────────────────────────────────────

const W = 6; // the middle of the three pen widths offered on /ipad

{
  // A right angle - the corner of a 4, a 7, an L, a fraction bar meeting a rule.
  const raw = samplePath([pt(20, 20), pt(120, 20), pt(120, 120)]);
  const cover = minNibCoverage(raw, W);
  ok(`90-degree corner keeps the nib width (covered ${(cover * 100).toFixed(0)}% >= 90%)`, cover >= 0.9);
}

{
  // A sharper turn than a right angle - the point of a checkmark or a V.
  const raw = samplePath([pt(20, 120), pt(80, 20), pt(140, 120)]);
  const cover = minNibCoverage(raw, W);
  ok(`acute corner keeps the nib width (covered ${(cover * 100).toFixed(0)}% >= 85%)`, cover >= 0.85);
}

{
  // Several corners in a row, as in a hand-drawn zig-zag or a written "w".
  const raw = samplePath([pt(20, 100), pt(50, 40), pt(80, 100), pt(110, 40), pt(140, 100)]);
  const cover = minNibCoverage(raw, W);
  ok(`repeated corners keep the nib width (covered ${(cover * 100).toFixed(0)}% >= 85%)`, cover >= 0.85);
}

{
  // The straight case must not regress: a plain rule is exactly one nib wide.
  const raw = samplePath([pt(20, 60), pt(220, 60)]);
  const ring = strokeOutline(raw, W);
  let minY = Infinity, maxY = -Infinity;
  for (let i = 1; i < ring.length; i += 2) { minY = Math.min(minY, ring[i]); maxY = Math.max(maxY, ring[i]); }
  const thickness = maxY - minY;
  ok(`straight stroke is one nib thick (${thickness.toFixed(2)}px vs ${W}px)`, Math.abs(thickness - W) < 0.35);
  ok("straight stroke is not inflated by the miter", thickness <= W + 0.35);
}

// ── round caps ─────────────────────────────────────────────────────────────
//
// Each cap joins one edge to the other across the tip, and there are two ways
// round: outside the end (the nib) or back through the stroke body. The
// original swept the wrong way, so no stroke had ever had a cap - the fan cut
// a notch into the last few px instead. Harmless-looking on a long scribble,
// and about 6px off the end of every short one, which is most of a digit.

{
  const raw = [];
  for (let i = 0; i <= 50; i += 1) raw.push(pt(20 + i * 2, 60));
  const ring = strokeOutline(raw, W);
  let minX = Infinity, maxX = -Infinity;
  for (let i = 0; i < ring.length; i += 2) { minX = Math.min(minX, ring[i]); maxX = Math.max(maxX, ring[i]); }
  ok(`start cap rounds past the tip (reaches x=${minX.toFixed(2)}, tip at 20)`, minX <= 20 - W / 2 + 0.25);
  ok(`end cap rounds past the tip (reaches x=${maxX.toFixed(2)}, tip at 120)`, maxX >= 120 + W / 2 - 0.25);
  ok("ink exists just beyond the start tip", inside(ring, 20 - W / 4, 60));
  ok("ink exists just beyond the end tip", inside(ring, 120 + W / 4, 60));
  // The notch the inward fan used to cut: the last px of the stroke body.
  ok("the stroke body is solid right up to the end", inside(ring, 119, 60) && inside(ring, 119, 60 + W / 3));
}

{
  // A short stroke is where a missing cap costs the most - the minus sign in
  // an equation, or the bar of a 7.
  const raw = samplePath([pt(40, 40), pt(64, 40)], 2);
  const ring = strokeOutline(raw, W);
  const line = centreline(raw);
  ok("a short stroke keeps its nib at both ends", discCovered(ring, line[0], W * 0.4) && discCovered(ring, line[line.length - 1], W * 0.4));
}

// ── the miter limit ────────────────────────────────────────────────────────

{
  // A hairpin: retracing a stroke back over itself. Without a limit the miter
  // is unbounded and throws a long spike off the fold.
  const raw = samplePath([pt(20, 60), pt(160, 60), pt(160, 63), pt(20, 63)]);
  const ring = strokeOutline(raw, W);
  const line = centreline(raw);
  let maxReach = 0;
  for (let i = 0; i < ring.length; i += 2) {
    let best = Infinity;
    for (const c of line) best = Math.min(best, Math.hypot(ring[i] - c.x, ring[i + 1] - c.y));
    maxReach = Math.max(maxReach, best);
  }
  // MITER_LIMIT is 2.5, so no vertex may sit further than 2.5 nib radii out.
  ok(`hairpin fold throws no spike (furthest vertex ${maxReach.toFixed(2)}px <= ${(2.5 * W) / 2}px)`, maxReach <= (2.5 * W) / 2 + 0.01);
}

// ── dejitter ───────────────────────────────────────────────────────────────

const swing = (pts) => {
  let s = 0;
  for (let i = 1; i < pts.length - 1; i += 1) s += Math.abs(pts[i].y - (pts[i - 1].y + pts[i + 1].y) / 2);
  return s;
};

{
  // Tremor: dense samples (a slowly drawn line) wobbling either side of true.
  // Samples arrive at a fixed rate, so bunched samples mean a barely-moving
  // hand, and sub-pixel movement between them cannot be intent.
  const raw = [];
  for (let i = 0; i <= 60; i += 1) raw.push(pt(i * 1.1, (i % 2 ? 0.45 : -0.45)));
  const out = dejitter(raw);
  ok("dejitter keeps the point count", out.length === raw.length);
  ok("dejitter pins the first point", out[0].x === raw[0].x && out[0].y === raw[0].y);
  // The pen tip must never be dragged backwards - that is what feels laggy.
  ok("dejitter pins the last point (the live pen tip)", out[out.length - 1].x === raw[raw.length - 1].x && out[out.length - 1].y === raw[raw.length - 1].y);
  ok(`dense tremor is filtered hard (${swing(out).toFixed(2)} vs ${swing(raw).toFixed(2)})`, swing(out) < swing(raw) * 0.55);
}

{
  // A fast stroke's samples are far apart, so its shape is travel, not tremor.
  // Filtering it would be filtering the handwriting itself; smoothCenterline
  // is what serves those, by fitting a curve rather than averaging points.
  const raw = [pt(0, 0), pt(10, 4), pt(20, -4), pt(30, 4), pt(40, -4), pt(50, 0)];
  const out = dejitter(raw);
  let moved = 0;
  for (let i = 0; i < raw.length; i += 1) moved = Math.max(moved, Math.hypot(out[i].x - raw[i].x, out[i].y - raw[i].y));
  ok(`widely spaced samples pass through untouched (max move ${moved.toFixed(3)}px)`, moved < 1e-9);
}

{
  const short = [pt(0, 0), pt(5, 5)];
  ok("dejitter leaves a 2-point stroke alone", dejitter(short) === short);
}

{
  // The filter does not try to detect corners, so what protects the corner of
  // a 4 is that the pass is gentle in absolute terms: no sample moves by a
  // meaningful fraction of the nib, and the corner still measures a full nib
  // wide afterwards (checked at the top of this file). Both numbers are the
  // reason a turn-angle term is not needed - and that term actively misfired,
  // because alternating tremor reads as a corner point-to-point.
  const raw = samplePath([pt(0, 0), pt(60, 0), pt(60, 60)], 2);
  const out = dejitter(raw);
  let corner = -1;
  for (let i = 0; i < raw.length; i += 1) if (raw[i].x === 60 && raw[i].y === 0) corner = i;
  ok("the corner sample is found", corner > 0);
  const cornerMove = Math.hypot(out[corner].x - raw[corner].x, out[corner].y - raw[corner].y);
  ok(`a sharp corner moves under a quarter nib (${cornerMove.toFixed(2)}px < ${(W / 4).toFixed(2)}px)`, cornerMove < W / 4);
  let far = 0;
  for (let i = 0; i < raw.length; i += 1) far = Math.max(far, Math.hypot(out[i].x - raw[i].x, out[i].y - raw[i].y));
  ok(`dejitter moves no point more than half a nib (${far.toFixed(2)}px)`, far <= W / 2);
}

// ── curve and cap resolution ───────────────────────────────────────────────

{
  // Resampling refines by how far a chord would bulge off the true curve, so
  // it must bite on a TIGHT loop and do nothing at all on a gentle one - a
  // refinement that fired everywhere would just be a cost with no picture.
  const chord = (pts) => {
    const line = centreline(pts);
    let total = 0;
    for (let i = 1; i < line.length; i += 1) total += Math.hypot(line[i].x - line[i - 1].x, line[i].y - line[i - 1].y);
    return total / Math.max(1, line.length - 1);
  };
  const straight = chord(samplePath([pt(0, 0), pt(200, 0)], 6));
  const gentle = chord(arcPath(100, 100, 30, 0, Math.PI, 6));
  const tight = chord(arcPath(100, 100, 4, 0, Math.PI * 1.6, 2));
  // Compared by whether refinement fired at all, not by equal chord lengths -
  // `steps` is an integer, so a segment splits 2 or 3 ways and the resulting
  // chord jumps around well inside the spacing it was derived from.
  ok(`a straight run is not refined (${straight.toFixed(2)}px, spacing 2.4)`, straight >= 1.9);
  ok(`a gentle curve is not refined either (${gentle.toFixed(2)}px, spacing 2.4)`, gentle >= 1.9);
  ok(`a tight loop resamples finer (${tight.toFixed(2)}px < ${gentle.toFixed(2)}px)`, tight < gentle * 0.8);
  ok(`refinement respects its floor (${tight.toFixed(2)}px >= 1.0px)`, tight >= 1.0 - 0.01);

  // How far the drawn path departs from the true circle it was sampled from.
  // This is NOT just the chord facet - it also carries the midpoint quadratic's
  // inherent pull toward the inside of a bend, which dominates here because a
  // 4px radius sampled every 2px turns nearly 30 degrees per sample. A real pen
  // samples a loop that small far more densely. Half a pixel on a 6px nib is
  // the bound worth holding: it keeps the whole pipeline honest end to end.
  const line = centreline(arcPath(100, 100, 4, 0, Math.PI * 1.6, 2));
  let worstBulge = 0;
  for (let i = 1; i < line.length; i += 1) {
    const mx = (line[i].x + line[i - 1].x) / 2, my = (line[i].y + line[i - 1].y) / 2;
    worstBulge = Math.max(worstBulge, Math.abs(Math.hypot(mx - 100, my - 100) - 4));
  }
  ok(`the drawn path tracks a tight loop within half a px (${worstBulge.toFixed(3)}px)`, worstBulge < 0.5);
}

{
  // The cap fan is a half circle; a fixed step count is smooth at 3px and a
  // visible polygon at highlighter width (3x the dialled pen).
  const raw = samplePath([pt(40, 40), pt(160, 40)], 2);
  const capSegments = (w) => {
    const ring = strokeOutline(raw, w);
    // Vertices beyond the straight body's extent belong to the two caps.
    let n = 0;
    for (let i = 0; i < ring.length; i += 2) if (ring[i] < 40 - 0.01 || ring[i] > 160 + 0.01) n += 1;
    return n;
  };
  const thin = capSegments(6), thick = capSegments(24);
  ok(`cap resolution follows the nib (${thin} segments at 6px, ${thick} at 24px)`, thick > thin);
}

// ── no argument-limit cliff ────────────────────────────────────────────────

{
  // A long unbroken stroke - an underline held right across the board. The ring
  // is built with plain pushes; `ring.push(...arr)` used to spread tens of
  // thousands of arguments and would take the pen out mid-stroke.
  const raw = [];
  for (let i = 0; i < 9000; i += 1) raw.push(pt(i * 0.9, 60 + Math.sin(i / 9) * 18));
  let ring = null;
  let threw = null;
  try { ring = strokeOutline(raw, W); } catch (err) { threw = err; }
  ok(`a 9000-point stroke does not throw (${threw ? threw.constructor.name : "ok"})`, threw === null);
  ok("a 9000-point stroke still produces a ring", Array.isArray(ring) && ring.length > 1000);
}

// ── degenerate input ───────────────────────────────────────────────────────

{
  // A pen that has all but stopped still emits samples, and thinPoints keeps
  // the last one unconditionally - so a near-duplicate pair arrives at the tip
  // of the in-flight stroke on almost every frame. The joint normals must stay
  // bounded through it. (The old central-difference tangent read pts[i-1] to
  // pts[i+1], which straddles such a pair and amplifies pure noise into the
  // offset direction; taking consecutive tangents for the miter removed that.)
  const raw = [];
  for (let i = 0; i < 40; i += 1) raw.push(pt(20 + i * 1.4, 60));
  raw.push(pt(20 + 39 * 1.4 + 0.004, 60));
  const ring = strokeOutline(raw, W);
  const line = centreline(raw);
  let maxOff = 0;
  for (let i = 0; i < ring.length; i += 2) {
    let best = Infinity;
    for (const c of line) best = Math.min(best, Math.hypot(ring[i] - c.x, ring[i + 1] - c.y));
    maxOff = Math.max(maxOff, best);
  }
  ok(`a near-stationary final sample throws no spike (${maxOff.toFixed(3)}px)`, maxOff <= (2.5 * W) / 2 + 0.01);
  ok("a near-stationary final sample stays finite", ring.every((v) => Number.isFinite(v)));
}

{
  ok("a single point makes no ring (the caller fills a dot)", strokeOutline([pt(10, 10)], W) === null);
  const stack = [pt(10, 10), pt(10, 10), pt(10, 10)];
  let threw = null;
  try { strokeOutline(stack, W); } catch (err) { threw = err; }
  ok("repeated identical samples do not throw", threw === null);
  const ring = strokeOutline(stack, W);
  if (ring) {
    ok("repeated identical samples produce finite geometry", ring.every((v) => Number.isFinite(v)));
  } else {
    ok("repeated identical samples collapse to a dot", true);
  }
}

console.log(`\n${checks} checks passed`);
