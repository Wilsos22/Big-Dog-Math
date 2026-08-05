// The connector arcs on the long-division house: where each one bows, where its
// sign sits, and which digits it must not be drawn through.
//
// Pure, no React, and DELIBERATELY SEPARATE FROM THE COMPONENT so a contract can
// check the picture. This geometry used to live inside DivisionHouseBoard.tsx,
// where nothing could reach it - and the first review of the arcs found four
// collisions on the DEFAULT problem set that a typecheck and twenty engine
// checks had all passed straight over. `npm run test:division-house-arcs`
// exercises the real function against the real trace.
//
// Steele's ask, 2026-08-03: "make all the dotted lines arched and have them
// appear like starting at the back where it starts from and make it slowly
// appear moving toward the end of the arrow. each round should keep the arched
// arrow lines, but the new round should be a different color. I want students to
// see the pathway the numbers take every time."

export interface ArcPoint {
  x: number;
  y: number;
}

/**
 * The gutter column is HALF a cell (Steele: the divisor "is way too far over to
 * the left"). It cannot go to zero - the divide and multiply signs live in it.
 */
export const GUTTER_RATIO = 0.5;

export interface HouseLayoutInput {
  columns: number;
  rows: number;
  divisorWidth: number;
  houseCol: number;
  slots: { id: string; col: number; rowIndex: number }[];
}

export interface HouseLayout {
  colW: (col: number) => number;
  colX: (col: number) => number;
  colMid: (col: number) => number;
  centre: (id: string) => ArcPoint | null;
  boardW: number;
  boardH: number;
  gutterX: number;
  houseLeft: number;
  gridColumns: string;
}

/**
 * The board's width in CELL units, with the gutter counted at half.
 *
 * Needed BEFORE a cell size exists, which is why it is not on the layout.
 */
export function houseWidthUnits(t: { columns: number; houseCol: number; divisorWidth: number }): number {
  return t.columns - (t.houseCol - t.divisorWidth) * (1 - GUTTER_RATIO);
}

/**
 * Where every column and cell of the house sits.
 *
 * THE GRID IS NOT UNIFORM, and this function exists so that fact lives in one
 * place. A stray `col * cellPx` anywhere else is right on the divisor side of
 * the board and half a cell wrong on the house side - the hardest kind of wrong
 * to catch in a screenshot, and impossible to catch in a test while this
 * arithmetic was inlined in the component.
 */
export function houseLayout(t: HouseLayoutInput, cellPx: number, rowPx: number): HouseLayout {
  const gutterPx = Math.round(cellPx * GUTTER_RATIO);
  const colW = (col: number) => (col >= t.divisorWidth && col < t.houseCol ? gutterPx : cellPx);
  const colX = (col: number) => {
    let x = 0;
    for (let c = 0; c < col; c += 1) x += colW(c);
    return x;
  };
  const colMid = (col: number) => colX(col) + colW(col) / 2;
  const centre = (id: string) => {
    const s = t.slots.find((x) => x.id === id);
    if (!s) return null;
    return { x: colMid(s.col), y: (s.rowIndex + 0.5) * rowPx };
  };
  return {
    colW,
    colX,
    colMid,
    centre,
    boardW: colX(t.columns),
    boardH: t.rows * rowPx,
    gutterX: colMid(t.divisorWidth),
    houseLeft: colX(t.houseCol),
    gridColumns: Array.from({ length: t.columns }, (_, c) => `${colW(c)}px`).join(" "),
  };
}

export interface ArcInput {
  /** Stable per prompt, so React never re-animates an arc already on the board. */
  key: string;
  round: number;
  sign: string;
  from: ArcPoint;
  to: ArcPoint;
}

export interface ArcBoard {
  cellPx: number;
  rowPx: number;
  boardW: number;
  boardH: number;
  /** The middle of the clear column between the divisor and the bracket. */
  gutterX: number;
  /** The bracket's left wall - the minus sign's halo must not notch it. */
  houseLeft: number;
  /**
   * The centre of every cell that currently SHOWS a digit - given or filled.
   *
   * An arc may not be drawn through any of these. The arcs paint above the
   * cells, so a line crossing a printed digit strikes it out; the worst case is
   * the "the answer goes up here" arc drawn straight through the answers
   * already up there.
   */
  digits: ArcPoint[];
}

export interface ArcGeometry {
  key: string;
  round: number;
  /** An SVG quadratic path. */
  d: string;
  /** Drawn as its own triangle so it can wait for the line to arrive. */
  head: { x: number; y: number; angle: number };
  /** "" means the arrow alone - no glyph. */
  sign: string;
  signAt: ArcPoint;
  /** True when the bow had to be widened or flipped to clear a digit. */
  rerouted: boolean;
  /** Digits still struck through after every candidate was tried. */
  collisions: number;
}

/** How close a stroke may come to the centre of a printed digit, in cells. */
export const DIGIT_CLEARANCE = 0.3;
/** How far outside the board an arc may bow, in cells. */
export const OVERSHOOT = 0.55;
/** How far along its own row a digit counts as sitting BESIDE an endpoint. */
export const NEIGHBOUR_REACH = 1.25;
/**
 * The clearance a digit BESIDE an endpoint still gets. Reduced, NOT zero.
 *
 * Exempting the neighbour outright was too generous by an order of magnitude: a
 * numeral's ink is about 0.09 cells either side of its centre, and a blanket
 * exemption let arcs pass within 0.03 cells of one. Measured over two million
 * arcs, 60% of three-digit problems had an arc through the ink of a quotient
 * digit - almost always a quotient digit, which is the number the student
 * earned and which the board keeps green on purpose. The built-in set happens
 * to be clean, which is exactly why it went unseen; it bites on teacher sets.
 */
export const NEIGHBOUR_CLEARANCE = 0.16;
/** The search demands this much more room than the rule, so a check agrees. */
const SEARCH_MARGIN = 1.06;

const bezier = (a: ArcPoint, c: ArcPoint, b: ArcPoint, t: number): ArcPoint => ({
  x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x,
  y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y,
});

/**
 * Build one arc, bowing it wider (and then the other way) until it stops being
 * drawn through a digit.
 *
 * A FIXED BOW IS NOT ENOUGH, and that is the whole reason this function is
 * shaped like a search. The four moves that touch the divisor get longer and
 * steeper every round while the divisor stays put, so by round two the "="
 * running up to the quotient passes straight over the quotient digits already
 * placed, and by round three the multiply arc crosses the dividend. Both were
 * measured on the default set.
 */
export function buildArc(input: ArcInput, board: ArcBoard): ArcGeometry | null {
  const { cellPx, rowPx, gutterX, boardW, boardH } = board;
  const a = input.from;
  const b = input.to;
  if (![a.x, a.y, b.x, b.y].every(Number.isFinite)) return null;

  // The minus keeps its hand-written home to the LEFT of the number being taken
  // away. An empty sign, and the bring-down arrow, are the arrow ALONE - a glyph
  // there is a second mark saying what the arrow already says.
  const stacked = input.sign === "−";
  const glyphless = !input.sign.trim() || input.sign === "↓";

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  // Stop clear of both END cells so a solid line never runs under the digits it
  // is joining. This says nothing about the cells in between - that is what the
  // reroute below is for.
  const lead = Math.min(cellPx * 0.36, len * 0.32);
  const s = { x: a.x + ux * lead, y: a.y + uy * lead };
  const e = { x: b.x - ux * (lead + 6), y: b.y - uy * (lead + 6) };
  const sx = e.x - s.x;
  const sy = e.y - s.y;
  const slen = Math.hypot(sx, sy) || 1;
  const nx = sy / slen;
  const ny = -sx / slen;

  const clear = cellPx * DIGIT_CLEARANCE;
  /**
   * What the arc must avoid: the digits in BETWEEN.
   *
   * Its own endpoints are obviously exempt. So is a digit sitting in the SAME
   * ROW right beside an endpoint, and that exemption is load-bearing rather
   * than a fudge: the quotient digits are shoulder to shoulder, so an arrow
   * arriving at `q-2` from anywhere to its left must pass the outer edge of
   * `q-1` on the way in. No bow avoids that - it is what an arrow pointing at
   * the third digit of a number looks like when drawn by hand. What the rule
   * still forbids, and what the review actually caught, is an arc drawn ACROSS
   * a row of digits: on 9876/4 the `=` to `q-3` used to cross q-0, q-1 and q-2,
   * striking out three answers the student had earned.
   */
  const beside = (p: ArcPoint, end: ArcPoint) =>
    Math.abs(p.y - end.y) < rowPx * 0.5 && Math.abs(p.x - end.x) < cellPx * NEIGHBOUR_REACH;
  const others = board.digits
    .filter((p) => Math.hypot(p.x - a.x, p.y - a.y) > 1 && Math.hypot(p.x - b.x, p.y - b.y) > 1)
    .map((p) => ({
      p,
      // A neighbour gets a smaller ring, not none: close enough to arrive past,
      // never close enough to draw through the numeral.
      r: beside(p, a) || beside(p, b) ? cellPx * NEIGHBOUR_CLEARANCE : clear,
    }));

  const score = (bow: number) => {
    const c = { x: (s.x + e.x) / 2 + nx * bow, y: (s.y + e.y) / 2 + ny * bow };
    let hits = 0;
    let outside = 0;
    // FINER THAN ANYTHING THAT CHECKS THIS, AND WITH A MARGIN. Searching at the
    // same resolution as the contract meant the search could declare a curve
    // clear that a differently-spaced sample found 0.4px inside a digit - a
    // true result from an under-resolved measurement. Sample twice as densely
    // and demand a few per cent more room than the rule actually requires.
    for (let t = 0; t <= 1.0001; t += 0.01) {
      const pt = bezier(s, c, e, t);
      for (const o of others) {
        if (Math.hypot(pt.x - o.p.x, pt.y - o.p.y) < o.r * SEARCH_MARGIN) { hits += 1; break; }
      }
      // Bowing off the board is its own kind of wrong - an arc that leaves the
      // stage is drawn over whatever the page puts beside it.
      if (
        pt.x < -cellPx * OVERSHOOT || pt.x > boardW + cellPx * OVERSHOOT
        || pt.y < -rowPx * OVERSHOOT || pt.y > boardH + rowPx * OVERSHOOT
      ) outside += 1;
    }
    return { c, hits, outside };
  };

  // Widen in the natural direction first, then try the other hand. Bowing by the
  // same normal every time is what makes a round read as one loop, so flipping
  // is a last resort rather than the first thing tried.
  const base = Math.min(slen * 0.22, cellPx * 1.05);
  const candidates: number[] = [];
  for (const dir of [1, -1]) {
    for (const mult of [1, 1.35, 1.75, 2.2, 2.8, 3.5]) candidates.push(base * mult * dir);
  }

  let best = score(candidates[0]);
  let bestBow = candidates[0];
  for (const bow of candidates) {
    const got = score(bow);
    // Clearing the digits comes first; staying on the board breaks the tie.
    if (got.hits < best.hits || (got.hits === best.hits && got.outside < best.outside)) {
      best = got;
      bestBow = bow;
    }
    if (best.hits === 0 && best.outside === 0) break;
  }

  const c = best.c;
  const at = (t: number) => bezier(s, c, e, t);

  // THE SIGN STILL LIVES IN THE GUTTER WHEN THE ARC CROSSES IT. The apex walks a
  // column right every round, so by round three a multiply sign sat inside the
  // house on top of the bracket - the same trap the straight-line version hit,
  // arrived at from a curve. Sampled rather than solved: forty points is cheaper
  // than a quadratic root and can never pick a point off the curve.
  // THE MINUS MUST NOT NOTCH THE BRACKET. It sits to the LEFT of the number
  // being taken away, the way it is written by hand - and when that number is
  // in the first column of the house, the cream halo behind the glyph lands
  // squarely on the bracket's left wall and bites a hole in it. That is the
  // round-0 subtract of every problem in the built-in set. Nudged into the
  // gutter, which is where the other signs live anyway.
  const haloR = cellPx * 0.26;
  let minusX = b.x - cellPx * 0.62;
  if (Math.abs(minusX - board.houseLeft) < haloR) minusX = board.houseLeft - haloR - cellPx * 0.05;

  const crosses = (a.x - gutterX) * (b.x - gutterX) < 0;
  let anchor = at(0.5);
  if (crosses) {
    let bestD = Infinity;
    for (let t = 0; t <= 1.0001; t += 0.025) {
      const pt = at(t);
      const d = Math.abs(pt.x - gutterX);
      if (d < bestD) { bestD = d; anchor = pt; }
    }
  }

  return {
    key: input.key,
    round: input.round,
    d: `M ${s.x.toFixed(1)} ${s.y.toFixed(1)} Q ${c.x.toFixed(1)} ${c.y.toFixed(1)} ${e.x.toFixed(1)} ${e.y.toFixed(1)}`,
    head: { x: e.x, y: e.y, angle: (Math.atan2(e.y - c.y, e.x - c.x) * 180) / Math.PI },
    sign: glyphless ? "" : input.sign,
    signAt: stacked ? { x: minusX, y: b.y } : anchor,
    rerouted: Math.abs(bestBow - base) > 0.01,
    collisions: best.hits,
  };
}

/** Sample points along a built arc - the contract's way of looking at the line. */
export function arcSamples(geom: ArcGeometry, steps = 60): ArcPoint[] {
  const m = geom.d.match(
    /^M ([-\d.]+) ([-\d.]+) Q ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)$/,
  );
  if (!m) return [];
  const [, x1, y1, cx, cy, x2, y2] = m.map(Number) as unknown as number[];
  const s = { x: x1, y: y1 };
  const c = { x: cx, y: cy };
  const e = { x: x2, y: y2 };
  const out: ArcPoint[] = [];
  for (let i = 0; i <= steps; i += 1) out.push(bezier(s, c, e, i / steps));
  return out;
}
