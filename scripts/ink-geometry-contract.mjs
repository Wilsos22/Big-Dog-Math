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
const { strokeOutline, smoothCenterline, thinPoints } = geom;

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
const centreline = (raw) => smoothCenterline(thinPoints(raw));

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

{
  // THE CASE THAT ACTUALLY SEPARATES MITER FROM NO-MITER. The clean synthetic
  // corners above do NOT: the adaptive resampler alone rescues them, so with
  // the miter reverted they still measure 88-100% and this suite stays green
  // while the pen goes back to pinching. Real input is densely sampled with
  // tremor on it, which puts a spread of small turns through the joint instead
  // of one clean one. Measured on this figure: 79% without the miter, 100%
  // with. Keep a case of this shape here or the suite is decorative.
  let n = 0;
  const noisy = (ax, ay, bx, by) => {
    const out = [];
    const d = Math.hypot(bx - ax, by - ay);
    const steps = Math.max(2, Math.round(d / 1.0));
    for (let k = 0; k < steps; k += 1) {
      const t = k / steps;
      n = (n * 1664525 + 1013904223) >>> 0;
      const j1 = (n / 4294967296 - 0.5) * 0.5;
      n = (n * 1664525 + 1013904223) >>> 0;
      const j2 = (n / 4294967296 - 0.5) * 0.5;
      out.push(pt(ax + (bx - ax) * t + j1, ay + (by - ay) * t + j2));
    }
    return out;
  };
  // The diagonal-and-bar of a hand-drawn 4.
  const raw = [...noisy(108, 0, 72, 56), ...noisy(72, 56, 124, 56)];
  raw.push(pt(124, 56));
  const cover = minNibCoverage(raw, W);
  ok(`a hand-drawn 4 keeps the nib through its corner (covered ${(cover * 100).toFixed(0)}% >= 95%)`, cover >= 0.95);
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

const furthestVertexFromPath = (raw, w) => {
  const ring = strokeOutline(raw, w);
  const line = centreline(raw);
  let maxReach = 0;
  for (let i = 0; i < ring.length; i += 2) {
    let best = Infinity;
    for (const c of line) best = Math.min(best, Math.hypot(ring[i] - c.x, ring[i + 1] - c.y));
    maxReach = Math.max(maxReach, best);
  }
  return maxReach;
};

// PAST THE MITER LIMIT THE JOINT BEVELS, so no vertex anywhere may sit further
// off the centreline than the nib radius plus a little resampling slack. This
// bound is the whole point of these three checks and it must stay TIGHT.
//
// It used to be `2.5 * W / 2` - the clamp ceiling itself - which asserted only
// that a spike was BOUNDED, never that it was absent. A clamped miter still
// pushes one vertex a full 2.5 nib radii along the bisector, so a 2.5x barb sat
// on every hairpin and passed this suite for as long as it existed. Steele shot
// the handwriting on 2026-08-04: the barbs are plainly visible on the top of
// every l, b and th, which is exactly where cursive puts its near-reversals.
// Measured on the near-retrace below: 7.50px clamped, 3.00px bevelled, on a
// 3px nib. Loosening this constant back toward 7.5 un-tests the bevel.
const BEVELLED_REACH = 1.25 * (W / 2);

{
  // A near-hairpin: out and back with a small gap. Note this one does NOT bind
  // the limit - it is here as the ordinary case, and on its own it cannot tell
  // a clamped miter from an unclamped one.
  const raw = samplePath([pt(20, 60), pt(160, 60), pt(160, 63), pt(20, 63)]);
  const reach = furthestVertexFromPath(raw, W);
  ok(`hairpin fold throws no spike (furthest vertex ${reach.toFixed(2)}px <= ${BEVELLED_REACH}px)`, reach <= BEVELLED_REACH + 0.01);
}

{
  // THE CASE THAT BINDS THE LIMIT: an EXACT retrace, gap zero - a teacher
  // scribbling out a wrong answer by dragging back along the line just drawn.
  // As the turn approaches 180 degrees the miter 1/cos(theta/2) runs away;
  // measured with the clamp removed this vertex lands about 3000px off the
  // stroke, which on a projector is a black wedge across the slide. The
  // near-hairpin above measures the same with and without the clamp, so
  // WITHOUT this case the clamp is untested.
  // THE GAP MATTERS. At gap EXACTLY zero the bisector vanishes and the
  // `mlen < 1e-6` branch takes over, which is bounded on its own - so that
  // case, useful as it is, cannot test the joint. A hair off zero is what
  // drives 1/cos(theta/2) up, and THIS is the case that separates a bevel from
  // a clamped spike: measured on a 3px nib, 7.50px clamped (a barb sticking
  // 3.5px clear of the stroke edge) against 3.00px bevelled. Removing the
  // limit altogether sends the same vertex about 3000px off the stroke - a
  // black wedge across the projector - which is why the limit exists at all.
  // This is the assertion to run first when the pen looks barbed again.
  const near = [];
  for (let i = 0; i <= 70; i += 1) near.push(pt(20 + i * 2, 60));
  for (let i = 70; i >= 0; i -= 1) near.push(pt(20 + i * 2, 60.01));
  const nearReach = furthestVertexFromPath(near, W);
  ok(`a near-retrace bevels rather than spiking (${nearReach.toFixed(2)}px <= ${BEVELLED_REACH}px)`, nearReach <= BEVELLED_REACH + 0.01);

  const out = [];
  for (let i = 0; i <= 70; i += 1) out.push(pt(20 + i * 2, 60));
  for (let i = 70; i >= 0; i -= 1) out.push(pt(20 + i * 2, 60));
  const reach = furthestVertexFromPath(out, W);
  ok(`an exact retrace stays bounded too (${reach.toFixed(2)}px <= ${BEVELLED_REACH}px)`, reach <= BEVELLED_REACH + 0.01);
  ok("an exact retrace stays finite", strokeOutline(out, W).every((v) => Number.isFinite(v)));
}

{
  // Read through the OUTLINE, not the helpers. Checks that call the geometry
  // functions directly keep agreeing with themselves even if strokeOutline
  // stops calling them, so at least one check has to measure what actually
  // gets filled: a densely sampled straight line carrying sub-pixel chatter
  // must come out with a smooth edge.
  const raw = [];
  for (let i = 0; i <= 80; i += 1) raw.push(pt(20 + i * 1.1, 60 + (i % 2 ? 0.32 : -0.32)));
  const ring = strokeOutline(raw, W);
  let minEdge = Infinity, maxEdge = -Infinity;
  for (let i = 0; i < ring.length; i += 2) {
    if (ring[i] < 40 || ring[i] > 90) continue; // mid-run only, clear of the caps
    if (ring[i + 1] < 60) { minEdge = Math.min(minEdge, ring[i + 1]); maxEdge = Math.max(maxEdge, ring[i + 1]); }
  }
  const wobble = maxEdge - minEdge;
  ok(`chatter is filtered before the outline is built (edge wobble ${wobble.toFixed(2)}px < 0.35px)`, wobble < 0.35);
}

// ── what the smoother owes the line ─────────────────────────────────
//
// There is no separate de-jitter pass. One was built and then removed once
// measured: smoothCenterline's midpoint quadratic already averages each pair
// of samples, which annihilates alternating chatter outright and leaves a
// second pass worth 0.03px on white noise and 0.004px on realistic tremor -
// invisible on a 6px nib, and costing two hypots per point every frame. These
// checks pin what the remaining smoother must still do.

{
  // The pen tip must never be dragged backwards - a filtered live tip is
  // exactly what an ink engine feeling laggy is made of. The smoother emits
  // the true first and last samples unchanged.
  const raw = samplePath([pt(0, 0), pt(60, 0), pt(60, 60)], 2);
  const line = smoothCenterline(raw);
  ok("the smoother pins the first point", line[0].x === raw[0].x && line[0].y === raw[0].y);
  ok("the smoother pins the last point (the live pen tip)",
    line[line.length - 1].x === raw[raw.length - 1].x && line[line.length - 1].y === raw[raw.length - 1].y);
}

{
  // A deliberate corner may round, never collapse: the drawn path must still
  // pass within half a nib of where the hand actually turned.
  const raw = samplePath([pt(0, 0), pt(60, 0), pt(60, 60)], 2);
  const line = centreline(raw);
  let nearest = Infinity;
  for (const p of line) nearest = Math.min(nearest, Math.hypot(p.x - 60, p.y - 0));
  ok(`the drawn path holds the corner (${nearest.toFixed(2)}px from it, under ${(W / 2).toFixed(1)}px)`, nearest <= W / 2);
}

{
  // Sub-pixel chatter on a slowly drawn line must not survive into the shape.
  const raw = [];
  for (let i = 0; i <= 120; i += 1) raw.push(pt(20 + i * 1.1, 60 + (i % 2 ? 0.32 : -0.32)));
  const line = centreline(raw);
  let worst = 0;
  for (const p of line) if (p.x > 40 && p.x < 140) worst = Math.max(worst, Math.abs(p.y - 60));
  ok(`chatter does not survive into the drawn path (${worst.toFixed(3)}px < 0.1px)`, worst < 0.1);
}

{
  // A short stroke has nothing to smooth and must come through untouched.
  const short = [pt(0, 0), pt(5, 5)];
  ok("a 2-point stroke is left alone", smoothCenterline(short) === short);
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
  // samples a loop that small far more densely.
  //
  // The bound is set where it SEPARATES: measured 0.247px with sagitta
  // refinement and 0.339px on fixed spacing, so 0.30 is what makes reverting
  // the refinement fail here. A looser bound passes either way and pins
  // nothing.
  const line = centreline(arcPath(100, 100, 4, 0, Math.PI * 1.6, 2));
  let worstBulge = 0;
  for (let i = 1; i < line.length; i += 1) {
    const mx = (line[i].x + line[i - 1].x) / 2, my = (line[i].y + line[i - 1].y) / 2;
    worstBulge = Math.max(worstBulge, Math.abs(Math.hypot(mx - 100, my - 100) - 4));
  }
  ok(`the drawn path tracks a tight loop to 0.30px (${worstBulge.toFixed(3)}px)`, worstBulge < 0.30);
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
  // A long unbroken stroke. The ring is built with plain pushes;
  // `ring.push(...arr)` spreads one argument PER NUMBER and blows the
  // call-argument limit.
  //
  // THE STROKE SHAPE IS THE WHOLE TEST, and it is not the obvious one. A
  // gentle, densely sampled 9000-point curve resamples roughly 1:1 - about
  // 18k arguments, under the limit, so it passes WITH the spread and proves
  // nothing. Nor does a tight scribble: dense samples get thinned, and a
  // 9000-sample spiral came out at only 3.4k centreline points.
  //
  // What reaches the cliff is a long FAST stroke. Fast means widely spaced
  // samples, and the resampler subdivides each gap by up to SMOOTH_MAX_STEPS,
  // so sparse input EXPANDS - here 6000 samples become ~75k centreline points
  // and a 300k-number ring. Measured on this engine the spread dies at ~86k
  // arguments, so this input is comfortably past it and the gentle cases are
  // comfortably short of it.
  let seed = 1;
  const raw = [];
  let x = 0, y = 0, ang = 0;
  for (let i = 0; i < 6000; i += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    ang += (seed / 4294967296 - 0.5) * 1.2;
    x += Math.cos(ang) * 30; y += Math.sin(ang) * 30;
    raw.push(pt(x, y));
  }
  let ring = null;
  let threw = null;
  try { ring = strokeOutline(raw, W); } catch (err) { threw = err; }
  ok(`a long fast stroke does not throw (${threw ? threw.constructor.name : "ok"})`, threw === null);
  ok(`and its ring is past any spread limit (${ring ? ring.length : 0} numbers > 120000)`, Array.isArray(ring) && ring.length > 120000);
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
