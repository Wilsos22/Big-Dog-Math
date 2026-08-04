// Stroke geometry for the iPad ink engine.
//
// A stroke is rendered as ONE filled polygon with round caps. Width is
// CONSTANT - Steele's call (2026-07-22) after writing real math on it:
// pressure-driven thick/thin reads as calligraphy, but he is writing
// equations, so a marker line is right. Pressure is still captured, smoothed,
// and carried on the wire (every point has p), so pressure feel can return
// later by changing radiusFor alone.
//
// Inputs are surface pixels; callers convert from the normalised 0..1 wire
// format first.

export interface InkRenderPoint {
  x: number;
  y: number;
  p: number; // 0..1, captured and carried but not currently rendered
}

function radiusFor(baseWidth: number, _p: number): number {
  return Math.max(0.5, baseWidth / 2);
}

// End taper: the first/last few points shrink toward a point. OFF by default
// since the constant-width change - marker lines end in round caps, not tips.
const TAPER_POINTS = 5;
function taperScale(i: number, count: number): number {
  const fromStart = (i + 1) / Math.min(TAPER_POINTS, count);
  const fromEnd = (count - i) / Math.min(TAPER_POINTS, count);
  return Math.min(1, fromStart, fromEnd);
}

// Drop points that are too close to matter - they only add joint noise.
export function thinPoints(pts: InkRenderPoint[], minDist = 0.75): InkRenderPoint[] {
  if (pts.length <= 2) return pts;
  const out: InkRenderPoint[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i += 1) {
    const prev = out[out.length - 1];
    const dx = pts[i].x - prev.x, dy = pts[i].y - prev.y;
    if (dx * dx + dy * dy >= minDist * minDist) out.push(pts[i]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

// THERE IS NO SEPARATE DE-JITTER PASS, AND THAT IS A MEASURED DECISION, NOT AN
// OVERSIGHT (2026-08-03). A binomial pre-filter over the control points was
// built to take the hand's micro-wobble out before the curve is fitted, then
// removed once measured against smoothCenterline alone on a slowly drawn line
// sampled every 1.1px:
//
//   perfectly alternating chatter  0.320px raw -> 0.000px WITHOUT the filter
//   white noise                    0.201px raw -> 0.133px without, 0.100px with
//   correlated hand tremor         0.084px raw -> 0.080px without, 0.076px with
//
// The midpoint quadratic below already averages each pair of samples, which is
// itself a low-pass, and it annihilates alternating noise outright. A second
// pass bought 0.03px on white noise and 0.004px on realistic tremor - both far
// under one pixel of a 6px nib, i.e. invisible - while costing two hypots per
// point on EVERY frame of every in-flight stroke. It was also impossible to
// write a contract check that failed without it, which is the same fact from
// the other side: it changed nothing anyone could see.
//
// What actually cleaned up the "jagged" line was the miter joint (a stroke
// wobbling slightly puts a run of small turns through the joint, and an
// un-mitered joint pinches at every one of them, which is what made a straight
// rule look frayed) and the round caps. If you are here to add smoothing,
// measure against those first.

// Smooth the centreline so a stroke FLOWS as a curve instead of showing the
// straight segments between raw pointer samples - the thing that reads as
// "rudimentary" ink, worst on fast strokes where the samples are far apart.
// Midpoint-quadratic (the standard notes-app smoother): each quadratic runs
// from the midpoint of one pair to the midpoint of the next, bending around the
// sample between them. It passes through every midpoint and only ever bends
// TOWARD a sample, so it can never overshoot or loop the way a Catmull-Rom
// spline can on a sharp corner. Path shape only - width stays constant and
// pressure is carried through untouched.
const SMOOTH_SPACING = 2.4; // px between resampled points on a gentle curve
const SMOOTH_TIGHT_SPACING = 1.0; // floor, so a hairpin cannot demand endless points
const SMOOTH_SAGITTA = 0.12; // px a chord may bulge off the true curve before it reads as a facet
const SMOOTH_MAX_STEPS = 24; // cap per segment so one long fast flick cannot explode the point count

export function smoothCenterline(pts: InkRenderPoint[]): InkRenderPoint[] {
  const n = pts.length;
  if (n < 3) return pts;
  const mid = (a: InkRenderPoint, b: InkRenderPoint): InkRenderPoint => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, p: (a.p + b.p) / 2 });
  const out: InkRenderPoint[] = [pts[0]];
  for (let i = 1; i < n - 1; i += 1) {
    // First segment starts at the real start; every later one starts where the
    // previous ended (the shared midpoint), so the path stays continuous.
    const start = i === 1 ? pts[0] : mid(pts[i - 1], pts[i]);
    const ctrl = pts[i];
    const end = mid(pts[i], pts[i + 1]);
    const d1x = ctrl.x - start.x, d1y = ctrl.y - start.y;
    const d2x = end.x - ctrl.x, d2y = end.y - ctrl.y;
    const l1 = Math.hypot(d1x, d1y), l2 = Math.hypot(d2x, d2y);
    const approx = l1 + l2;
    // Resample finer only where a chord would actually show. A chord of length
    // c across a curve of radius R bulges away from it by about c*c/(8R), so
    // the fixed spacing is already invisible on anything gently curved - at
    // 2.4px it is 0.02px out at R=30 - and only starts to read as a flat facet
    // below about R=6, which is a loop no bigger than the nib itself. Solving
    // that for c gives the spacing a tight bend needs, and it self-limits:
    // everywhere else this returns SMOOTH_SPACING and costs nothing.
    //
    // (Scale is not a factor. Strokes travel NORMALISED and every surface
    // re-fits the curve in its OWN pixels, so the projector's chords are the
    // same 2.4px across a proportionally larger stroke, not magnified ones.)
    let spacing = SMOOTH_SPACING;
    if (l1 > 1e-6 && l2 > 1e-6) {
      const cos = Math.max(-1, Math.min(1, (d1x * d2x + d1y * d2y) / (l1 * l2)));
      const turn = Math.acos(cos);
      if (turn > 1e-4) {
        const radius = approx / 2 / turn;
        const chord = Math.sqrt(8 * radius * SMOOTH_SAGITTA);
        spacing = Math.max(SMOOTH_TIGHT_SPACING, Math.min(SMOOTH_SPACING, chord));
      }
    }
    const steps = Math.max(1, Math.min(SMOOTH_MAX_STEPS, Math.round(approx / spacing)));
    for (let s = 1; s <= steps; s += 1) {
      const t = s / steps, u = 1 - t;
      out.push({
        x: u * u * start.x + 2 * u * t * ctrl.x + t * t * end.x,
        y: u * u * start.y + 2 * u * t * ctrl.y + t * t * end.y,
        p: u * u * start.p + 2 * u * t * ctrl.p + t * t * end.p,
      });
    }
  }
  out.push(pts[n - 1]);
  return out;
}

// A corner is where a constant-width offset goes wrong, and handwriting is
// almost entirely corners. Offsetting each point along its own normal by
// exactly r leaves the OUTER edge of a turn at r*cos(theta/2) instead of r,
// so every corner comes out chamfered and pinched - the flat-cut notch that
// reads as "jagged" on a digit or an operator. Scaling the offset by
// 1/cos(theta/2) puts that corner back where a real nib would leave it. The
// limit caps the spike a near-reversal would otherwise throw (retracing a
// stroke back over itself approaches theta = 180, where the miter is
// unbounded); past it the corner bevels instead, which is what every 2D
// renderer does with miterLimit.
const MITER_LIMIT = 2.5;

// Build the outline polygon: left edge out, right edge back, with round caps.
// Returns a flat [x0,y0, x1,y1, ...] ring, or null for a dot (use fillDot).
export function strokeOutline(raw: InkRenderPoint[], baseWidth: number, taper = false): number[] | null {
  const pts = smoothCenterline(thinPoints(raw));
  if (pts.length < 2) return null;

  const left: number[] = [];
  const right: number[] = [];
  const n = pts.length;

  // Unit tangent per SEGMENT, computed once. Every interior point needs the
  // tangent either side of it, and the tangent out of point i is the tangent
  // into point i+1 - computing them per point normalises each segment twice,
  // and this runs on the whole in-flight stroke every frame.
  const segX = new Array<number>(n - 1);
  const segY = new Array<number>(n - 1);
  for (let i = 0; i < n - 1; i += 1) {
    const dx = pts[i + 1].x - pts[i].x, dy = pts[i + 1].y - pts[i].y;
    const l = Math.hypot(dx, dy) || 1;
    segX[i] = dx / l; segY[i] = dy / l;
  }

  for (let i = 0; i < n; i += 1) {
    const cur = pts[i];
    // The unit tangents INTO and OUT OF this point. At either end there is
    // only one, so the joint degenerates to a plain perpendicular offset and
    // the caps below still read the edge point they expect.
    const inX = i > 0 ? segX[i - 1] : segX[0];
    const inY = i > 0 ? segY[i - 1] : segY[0];
    const outX = i < n - 1 ? segX[i] : segX[n - 2];
    const outY = i < n - 1 ? segY[i] : segY[n - 2];

    // Left normal of each segment, then the bisector between them.
    const n1x = -inY, n1y = inX;
    const n2x = -outY, n2y = outX;
    let mx = n1x + n2x, my = n1y + n2y;
    const mlen = Math.hypot(mx, my);
    let miter = 1;
    if (mlen < 1e-6) {
      // A true 180-degree reversal has no bisector to build on - fall back to
      // the outgoing normal and let the round cap logic carry the tip.
      mx = n2x; my = n2y;
    } else {
      mx /= mlen; my /= mlen;
      const cosHalf = mx * n1x + my * n1y; // = cos(theta/2)
      miter = Math.min(MITER_LIMIT, 1 / Math.max(cosHalf, 1e-3));
    }
    const r = radiusFor(baseWidth, cur.p) * (taper ? taperScale(i, n) : 1) * miter;
    left.push(cur.x + mx * r, cur.y + my * r);
    right.push(cur.x - mx * r, cur.y - my * r);
  }

  // Round caps: a small fan of points around each end, oriented by the local
  // direction so the cap wraps the tip.
  //
  // THE SWEEP RUNS BACKWARDS, and that sign is the whole cap. Each cap joins
  // one edge to the other across the tip, and there are two ways round: one
  // passes outside the end (the round nib), the other folds back through the
  // stroke body. Sweeping FORWARDS took the second one, so from the day this
  // engine was written no stroke had a cap at all - the fan cut a notch into
  // the last few px instead, blunting the end of every letter and digit. It
  // was invisible on a long scribble and about 6px of every short stroke.
  // Pinned by `npm run test:ink-geometry`.
  const cap = (cx: number, cy: number, fromAngle: number, r: number): number[] => {
    const out: number[] = [];
    // Segment count follows the radius: a fixed 7 is a smooth half-circle on a
    // 3px nib and a visible heptagon on the 12px pen or the highlighter, which
    // is 3x the dialled width.
    const steps = Math.max(7, Math.min(24, Math.round(r * 1.6)));
    for (let k = 1; k < steps; k += 1) {
      const t = fromAngle - (Math.PI * k) / steps;
      out.push(cx + Math.cos(t) * r, cy + Math.sin(t) * r);
    }
    return out;
  };

  const startR = radiusFor(baseWidth, pts[0].p) * (taper ? taperScale(0, n) : 1);
  const endR = radiusFor(baseWidth, pts[n - 1].p) * (taper ? taperScale(n - 1, n) : 1);
  const startAngle = Math.atan2(left[1] - pts[0].y, left[0] - pts[0].x);
  const endAngle = Math.atan2(right[right.length - 1] - pts[n - 1].y, right[right.length - 2] - pts[n - 1].x);

  // Built with plain pushes, never `push(...arr)`: a long unbroken stroke (an
  // underline held across the board) resamples into tens of thousands of
  // numbers, and spreading that many arguments blows the call-argument limit -
  // the pen would simply die mid-stroke with a RangeError.
  const ring: number[] = [];
  for (let i = 0; i < left.length; i += 1) ring.push(left[i]);
  const endCap = cap(pts[n - 1].x, pts[n - 1].y, endAngle + Math.PI, endR);
  for (let i = 0; i < endCap.length; i += 1) ring.push(endCap[i]);
  for (let i = n - 1; i >= 0; i -= 1) ring.push(right[i * 2], right[i * 2 + 1]);
  const startCap = cap(pts[0].x, pts[0].y, startAngle + Math.PI, startR);
  for (let i = 0; i < startCap.length; i += 1) ring.push(startCap[i]);
  return ring;
}

export function fillOutline(ctx: CanvasRenderingContext2D, ring: number[]): void {
  ctx.beginPath();
  ctx.moveTo(ring[0], ring[1]);
  for (let i = 2; i < ring.length; i += 2) ctx.lineTo(ring[i], ring[i + 1]);
  ctx.closePath();
  ctx.fill();
}

export function fillDot(ctx: CanvasRenderingContext2D, pt: InkRenderPoint, baseWidth: number): void {
  ctx.beginPath();
  ctx.arc(pt.x, pt.y, radiusFor(baseWidth, pt.p), 0, Math.PI * 2);
  ctx.fill();
}

// Highlighter geometry: constant width (pressure ignored), no taper, so it
// reads as a marker band rather than pen ink.
export function highlightOutline(raw: InkRenderPoint[], width: number): number[] | null {
  const flat = raw.map((p) => ({ ...p, p: 0.58 })); // 0.45 + 0.95*0.58 = ~1.0 => width as dialled
  return strokeOutline(flat, width, false);
}

// ── Hold-to-straighten shape fitting ────────────────────────────────────────
//
// Finish a stroke and hold the pen still: the scribble snaps to the clean
// shape it was trying to be. Open paths become straight lines (with the angle
// snapped to 0/45/90 when close); closed paths become a circle when the
// radius is steady, otherwise an axis-aligned rectangle. The result is
// returned as ORDINARY STROKE POINTS sampled along the ideal path, so the
// wire format, history, and every renderer treat a snapped shape exactly like
// any other stroke.

export type SnapKind = "line" | "circle" | "rect";
export interface SnapResult { kind: SnapKind; points: InkRenderPoint[] }

const SNAP_PRESSURE = 0.6;

function pathLength(pts: InkRenderPoint[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i += 1) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return len;
}

export function sampleLine(a: { x: number; y: number }, b: { x: number; y: number }, n = 24): InkRenderPoint[] {
  const out: InkRenderPoint[] = [];
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, p: SNAP_PRESSURE });
  }
  return out;
}

export function fitSnapShape(raw: InkRenderPoint[]): SnapResult | null {
  const pts = thinPoints(raw, 1.5);
  if (pts.length < 6) return null;
  const len = pathLength(pts);
  if (len < 36) return null; // a dot or a tap - leave it alone

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, cx = 0, cy = 0;
  for (const p of pts) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    cx += p.x; cy += p.y;
  }
  cx /= pts.length; cy /= pts.length;
  const bw = maxX - minX, bh = maxY - minY;
  const diag = Math.hypot(bw, bh) || 1;
  const endGap = Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y);

  // Closed-ish path: the ends nearly meet and the path wraps most of the way
  // around its own bounding box.
  if (endGap < diag * 0.28 && len > diag * 2.2 && bw > 22 && bh > 22) {
    const radii = pts.map((p) => Math.hypot(p.x - cx, p.y - cy));
    const mean = radii.reduce((a, b) => a + b, 0) / radii.length;
    const dev = Math.sqrt(radii.reduce((a, r) => a + (r - mean) * (r - mean), 0) / radii.length);
    if (dev / mean < 0.22) {
      const n = 40;
      const out: InkRenderPoint[] = [];
      for (let i = 0; i <= n; i += 1) {
        const t = (i / n) * Math.PI * 2;
        out.push({ x: cx + Math.cos(t) * mean, y: cy + Math.sin(t) * mean, p: SNAP_PRESSURE });
      }
      return { kind: "circle", points: out };
    }
    const corners = [
      { x: minX, y: minY }, { x: maxX, y: minY }, { x: maxX, y: maxY }, { x: minX, y: maxY }, { x: minX, y: minY },
    ];
    const out: InkRenderPoint[] = [];
    for (let i = 0; i < corners.length - 1; i += 1) out.push(...sampleLine(corners[i], corners[i + 1], 10));
    return { kind: "rect", points: out };
  }

  // Open path: a straight line between the endpoints, angle-snapped when the
  // hand was clearly going for flat, upright, or diagonal.
  const a = pts[0];
  let b = { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y };
  // Only straighten when the scribble roughly follows its own chord -
  // a big loop that happens to end far away should not become a line.
  if (len > Math.hypot(b.x - a.x, b.y - a.y) * 1.6) return null;
  return { kind: "line", points: snapLinePoints(a, b) };
}

// A straight line from a to b, with the angle pulled onto 0/45/90 when the
// hand was clearly going for flat, upright, or diagonal. Also used while
// ADJUSTING a snapped line: keep the pen down after the snap and the far end
// follows it.
export function snapLinePoints(a: { x: number; y: number }, b: { x: number; y: number }): InkRenderPoint[] {
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  const step = Math.PI / 4;
  const snapped = Math.round(angle / step) * step;
  let end = b;
  if (Math.abs(angle - snapped) < (8 * Math.PI) / 180) {
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    end = { x: a.x + Math.cos(snapped) * d, y: a.y + Math.sin(snapped) * d };
  }
  return sampleLine(a, end);
}
