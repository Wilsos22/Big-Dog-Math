// Contract for the division house's geometry.
//
// TWO HALVES, AND THEY ARE IN DIFFERENT STATES. Read this before adding to it.
//
// The LAYOUT checks are live: the non-uniform grid (the gutter is half a cell)
// is what every column position on the board is computed from, and a stray
// `col * cellPx` anywhere is right on the divisor side and half a cell wrong on
// the house side.
//
// The ARC checks guard a PARKED capability. `buildArc` is no longer called by
// anything - Steele took the connectors off the board on 2026-08-04 ("no arrows
// or lines") - and the first check below is what pins that. The routing is kept
// because this decision has already flipped twice in two days and the collision
// search took a review cycle to get right: it was written after the first review
// found four kinds of collision on the DEFAULT problem set, with `npm run
// typecheck` plus twenty engine checks passing straight over every one. If the
// arcs stay gone for good, this half and `buildArc` can go together.
//
// It walks the real prompts through the real layout and the real arc builder,
// and then looks at the resulting curves.
//
// Run: npm run test:division-house-arcs

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildHouseTrace, DEFAULT_HOUSE_SET, parseHouseSet } from "../.tmp-mastery/divisionHouse.js";
import {
  DIGIT_CLEARANCE,
  GUTTER_RATIO,
  NEIGHBOUR_CLEARANCE,
  NEIGHBOUR_REACH,
  OVERSHOOT,
  arcSamples,
  buildArc,
  houseLayout,
  houseWidthUnits,
} from "../.tmp-mastery/divisionHouseArcs.js";

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  console.log(`  ok  ${name}`);
}

/** The sizes the board really runs at: the floor, the default, and a projector. */
const CELL_SIZES = [58, 104, 168];
const ROW_FOR = (cell) => Math.round(cell * (96 / 104));

/** Two rounds, three rounds, a zero quotient, a two-digit divisor, four rounds. */
const SHAPES = [[96, 4], [738, 6], [618, 6], [875, 4], [144, 12], [9876, 4], [1000, 8]];

/**
 * Replay a problem the way a student does, yielding the board state at every
 * step: which digits are showing, and every arc drawn so far.
 */
function* replay(dividend, divisor, cellPx) {
  const t = buildHouseTrace(dividend, divisor);
  const rowPx = ROW_FOR(cellPx);
  const layout = houseLayout(t, cellPx, rowPx);
  const filled = new Set();
  for (let step = 0; step <= t.prompts.length; step += 1) {
    const shown = t.slots.filter((s) => s.given || filled.has(s.id));
    const board = {
      cellPx,
      rowPx,
      boardW: layout.boardW,
      boardH: layout.boardH,
      gutterX: layout.gutterX,
      houseLeft: layout.houseLeft,
      digits: shown.map((s) => ({ x: layout.colMid(s.col), y: (s.rowIndex + 0.5) * rowPx })),
    };
    const arcs = t.prompts
      .slice(0, step)
      .filter((p) => p.visual)
      .map((p) => {
        const from = layout.centre(p.visual.from);
        const to = layout.centre(p.visual.to);
        if (!from || !to) return null;
        return buildArc({ key: p.id, round: p.round, sign: p.visual.sign, from, to }, board);
      })
      .filter(Boolean);
    yield { t, step, layout, board, arcs, shown, rowPx };
    const p = t.prompts[step];
    if (p) p.fill.forEach((id) => filled.add(id));
  }
}

console.log("division-house arcs contract");

check("the gutter is half a cell, and every column lands where the grid says", () => {
  for (const [dividend, divisor] of SHAPES) {
    const t = buildHouseTrace(dividend, divisor);
    for (const cellPx of CELL_SIZES) {
      const rowPx = ROW_FOR(cellPx);
      const L = houseLayout(t, cellPx, rowPx);
      const where = `${dividend}/${divisor} @${cellPx}`;
      assert.equal(L.colW(0), cellPx, `${where}: the divisor column is a full cell`);
      assert.equal(L.colW(t.divisorWidth), Math.round(cellPx * GUTTER_RATIO), `${where}: the gutter is half`);
      assert.equal(L.colW(t.houseCol), cellPx, `${where}: the house columns are full cells`);
      // The declared width and the walked width must agree, or the board is
      // measured to one size and drawn at another.
      const widths = L.gridColumns.split(" ").map((s) => Number(s.replace("px", "")));
      assert.equal(widths.length, t.columns, where);
      assert.ok(
        Math.abs(L.boardW - houseWidthUnits(t) * cellPx) <= t.columns,
        `${where}: houseWidthUnits must predict boardW, or the fit maths sizes the wrong board`,
      );
      // The divisor really does sit closer to the bracket than a full column.
      assert.ok(L.houseLeft - L.colX(t.divisorWidth) < cellPx, `${where}: the gutter narrowed`);
    }
  }
});

check("no arc is ever drawn through a digit that is showing", () => {
  // THE BUG THIS PINS: the arcs paint above the cells, so a line crossing a
  // printed digit strikes it out. Measured before the fix, `place-quotient` ran
  // through the quotient digits already placed from round 1 onward on every
  // problem in the built-in set - the arc whose whole job is to say "the answer
  // goes up here", drawn through the answers already up there.
  for (const [dividend, divisor] of SHAPES) {
    for (const cellPx of CELL_SIZES) {
      for (const { t, step, arcs, board, layout } of replay(dividend, divisor, cellPx)) {
        for (const arc of arcs) {
          assert.equal(
            arc.collisions,
            0,
            `${dividend}/${divisor} @${cellPx} step ${step}: ${arc.key} reports ${arc.collisions} digit(s) struck through`,
          );
          // Re-measured from the EMITTED PATH rather than trusting the builder's
          // own count - the point of a contract is not to ask the code whether
          // it is happy with itself.
          const v = t.prompts.find((p) => p.id === arc.key).visual;
          const ends = [v.from, v.to].map((id) => layout.centre(id)).filter(Boolean);
          // Same rule the builder works to, written out independently: an arc
          // may brush the digit sitting beside its own endpoint in that row -
          // the quotient digits are shoulder to shoulder and there is no way in
          // otherwise - but it may not cross a row of them.
          const rowPx = ROW_FOR(cellPx);
          const rings = board.digits
            .filter((d) => !ends.some((e) => Math.hypot(d.x - e.x, d.y - e.y) <= 1))
            .map((d) => ({
              d,
              // A NEIGHBOUR GETS A SMALLER RING, NOT NONE. A blanket exemption
              // let arcs pass 0.03 cells from a quotient digit's centre when the
              // numeral's own ink is 0.09 - through the answer, not past it.
              r: ends.some((e) => (
                Math.abs(d.y - e.y) < rowPx * 0.5 && Math.abs(d.x - e.x) < cellPx * NEIGHBOUR_REACH
              ))
                ? cellPx * NEIGHBOUR_CLEARANCE
                : cellPx * DIGIT_CLEARANCE,
            }));
          for (const pt of arcSamples(arc)) {
            for (const { d, r } of rings) {
              const gap = Math.hypot(pt.x - d.x, pt.y - d.y);
              assert.ok(
                gap >= r,
                `${dividend}/${divisor} @${cellPx} step ${step}: ${arc.key} passes ${gap.toFixed(1)}px from the digit at ${d.x.toFixed(0)},${d.y.toFixed(0)} (needs ${r.toFixed(1)})`,
              );
            }
          }
        }
      }
    }
  }
});

check("no arc wanders off the board", () => {
  // `overflow:visible` means an arc that leaves the stage is drawn over
  // whatever the page put beside it, rather than being clipped away.
  for (const [dividend, divisor] of SHAPES) {
    for (const cellPx of CELL_SIZES) {
      const rowPx = ROW_FOR(cellPx);
      for (const { step, arcs, board } of replay(dividend, divisor, cellPx)) {
        for (const arc of arcs) {
          for (const pt of arcSamples(arc)) {
            assert.ok(Number.isFinite(pt.x) && Number.isFinite(pt.y), `${arc.key} produced a non-number`);
            assert.ok(
              pt.x >= -cellPx * (OVERSHOOT + 0.1)
              && pt.x <= board.boardW + cellPx * (OVERSHOOT + 0.1)
              && pt.y >= -rowPx * (OVERSHOOT + 0.1)
              && pt.y <= board.boardH + rowPx * (OVERSHOOT + 0.1),
              `${dividend}/${divisor} @${cellPx} step ${step}: ${arc.key} leaves the board at ${pt.x.toFixed(0)},${pt.y.toFixed(0)}`,
            );
          }
        }
      }
    }
  }
});

check("THE BOARD DRAWS NO CONNECTORS, and marks no spot until a miss", () => {
  // Three comments in a row on 2026-08-04, all pointing the same way: "maybe no
  // arrows. Just use the higlighting pulse to show what is happening", then "no
  // arrows or lines", then "the animation is clunky".
  //
  // So the entire connector layer came off: the arched line that drew itself
  // over 520ms, the arrowhead that faded in behind it, the sign glyph that burst
  // in at 1.5x and rotated, and the plaque's two arrows down to the divisor and
  // in through the door. What the move IS gets said by the two cells it runs
  // between lighting up, plus the arithmetic written out in the rail.
  //
  // Same batch: "get rid of the circle ... if they get it wrong then have it
  // pulse", so the amber pulse is what a miss buys rather than what the question
  // opens with.
  //
  // The render lives in JSX, so these are source assertions, the same tool
  // `classroom-surface-contract.mjs` uses on the classroom surfaces.
  const src = readFileSync(new URL("../src/components/DivisionHouseBoard.tsx", import.meta.url), "utf8");
  for (const gone of ["dh-arcs", "dh-arrowhead", "dh-sign", "dh-pop", "dh-ring", "dh-plaque-arrow", "buildArc"]) {
    assert.ok(
      !new RegExp(`className="[^"]*${gone}|<${gone}|\\b${gone}\\(`).test(src),
      `${gone} is drawn again - Steele asked twice for no arrows or lines`,
    );
  }
  // What says it instead: the two numbers the move runs between, weighted so
  // the board says WHICH WAY - a hairline on the source, a solid ring on the
  // destination. Identical rings say only "these two", which is not the move.
  assert.ok(/\.dh-slot\.act-from \{[^}]*box-shadow/.test(src), "the source needs its hairline");
  assert.ok(/\.dh-slot\.act-to \{[^}]*box-shadow/.test(src), "the destination needs its solid ring");
  assert.ok(
    /actFrom\.has\(slot\.id\) \? "act act-from"/.test(src) && /actTo\.has\(slot\.id\) \? "act act-to"/.test(src),
    "the highlight must come from the move's own two numbers, not from a guess",
  );
  assert.ok(
    /fromSlots \?\? \[\]/.test(src) && /toSlots \?\? \[\]/.test(src),
    "it must light WHOLE numbers - anchors alone lit the 1 of 14 and the 1 of 12 on 144/12",
  );
  assert.ok(
    /isTarget && revealTarget \? "target"/.test(src),
    "the pulse must be gated on a miss, or the board answers the question it just asked",
  );
  assert.ok(/const revealTarget = Boolean\(missed\)/.test(src), "a miss is what reveals the spot");
  // The set-up travel is a straight line between two measured points. A motion
  // path would be a curve traced along an arrow that no longer exists.
  assert.ok(!/offset-path/.test(src), "no path-following - the arrows it followed are gone");
  assert.ok(
    /\.dh-fly\.go \{ transform:translate\(-50%,-50%\) translate\(var\(--dx\), var\(--dy\)\)/.test(src),
    "the number must travel straight from where it was to where it is going",
  );
});

check("signs would collide if they were all drawn - which is why only one is", () => {
  // Keeping a glyph per round was the builder's addition, not Steele's - he
  // asked for the LINES to persist. It did not survive the geometry: four signs
  // a round all anchor in a gutter half a cell wide, and on 96/4 - the FIRST
  // problem in the built-in set - that put thirteen overlapping pairs on the
  // board, the worst thirteen pixels apart under fifty-one pixel discs.
  //
  // The component now renders the newest arc's sign and no others. This check
  // pins the reason: were they all drawn, they would collide.
  for (const [dividend, divisor] of [[96, 4], [738, 6], [9876, 4]]) {
    const cellPx = 104;
    let worst = Infinity;
    for (const { arcs } of replay(dividend, divisor, cellPx)) {
      const signed = arcs.filter((a) => a.sign);
      for (let i = 0; i < signed.length; i += 1) {
        for (let j = i + 1; j < signed.length; j += 1) {
          worst = Math.min(
            worst,
            Math.hypot(signed[i].signAt.x - signed[j].signAt.x, signed[i].signAt.y - signed[j].signAt.y),
          );
        }
      }
    }
    assert.ok(
      worst < cellPx * 0.5,
      `${dividend}/${divisor}: signs are far enough apart to all be shown - if that is now true, revisit the one-glyph rule`,
    );
  }
});

check("a sign that crosses the gutter is anchored in the gutter", () => {
  // The apex walks a column right every round, so by round three a multiply
  // sign sat inside the house on top of the bracket.
  for (const [dividend, divisor] of SHAPES) {
    const cellPx = 104;
    for (const { t, arcs, layout } of replay(dividend, divisor, cellPx)) {
      for (const arc of arcs) {
        if (!arc.sign || arc.sign === "−") continue;
        const v = t.prompts.find((p) => p.id === arc.key).visual;
        const a = layout.centre(v.from);
        const b = layout.centre(v.to);
        if ((a.x - layout.gutterX) * (b.x - layout.gutterX) >= 0) continue;
        assert.ok(
          Math.abs(arc.signAt.x - layout.gutterX) < cellPx * 0.22,
          `${dividend}/${divisor}: ${arc.key} put its ${arc.sign} at x=${arc.signAt.x.toFixed(0)}, gutter is ${layout.gutterX.toFixed(0)}`,
        );
      }
    }
  }
});

check("every problem in the built-in set draws cleanly at every board size", () => {
  const { problems } = parseHouseSet(DEFAULT_HOUSE_SET);
  assert.ok(problems.length >= 4);
  for (const { dividend, divisor } of problems) {
    for (const cellPx of CELL_SIZES) {
      let drew = 0;
      for (const { arcs } of replay(dividend, divisor, cellPx)) {
        for (const arc of arcs) {
          assert.equal(arc.collisions, 0, `${dividend}/${divisor} @${cellPx}: ${arc.key}`);
          drew += 1;
        }
      }
      assert.ok(drew > 0, `${dividend}/${divisor} @${cellPx} drew nothing`);
    }
  }
});

check("a WIDE sweep of teacher-set problems draws cleanly, not just the built-in four", () => {
  // THE BUILT-IN SET IS NOT A SAMPLE. It happens to be clean, which is exactly
  // why a whole class of collision went unseen: with the neighbour exempted
  // outright, sixty per cent of three-digit problems had an arc through the ink
  // of a quotient digit, and none of them were 96/4, 738/6, 618/6 or 875/4.
  // A teacher pastes whatever the lesson needs.
  let arcsChecked = 0;
  for (let dividend = 100; dividend <= 999; dividend += 7) {
    for (const divisor of [3, 4, 6, 7, 9, 11, 12]) {
      if (divisor > dividend) continue;
      for (const { step, arcs } of replay(dividend, divisor, 104)) {
        for (const arc of arcs) {
          arcsChecked += 1;
          assert.equal(
            arc.collisions,
            0,
            `${dividend}/${divisor} step ${step}: ${arc.key} could not be routed clear (${arc.collisions} samples inside a digit)`,
          );
        }
      }
    }
  }
  assert.ok(arcsChecked > 50000, `only ${arcsChecked} arcs swept - the sweep is not sweeping`);
});

check("the arrowhead points along the curve it ends", () => {
  for (const [dividend, divisor] of SHAPES) {
    for (const { arcs } of replay(dividend, divisor, 104)) {
      for (const arc of arcs) {
        const pts = arcSamples(arc, 40);
        const last = pts[pts.length - 1];
        const prev = pts[pts.length - 3];
        const want = (Math.atan2(last.y - prev.y, last.x - prev.x) * 180) / Math.PI;
        // Wrapped into [-180, 180) and taken absolute - the smallest angle
        // between the two headings, so -179 and 179 read as two degrees apart.
        const diff = Math.abs(((arc.head.angle - want + 540) % 360) - 180);
        assert.ok(
          diff < 12,
          `${dividend}/${divisor}: ${arc.key} head points ${arc.head.angle.toFixed(0)} but the curve arrives at ${want.toFixed(0)}`,
        );
        assert.ok(
          Math.hypot(arc.head.x - last.x, arc.head.y - last.y) < 1,
          `${arc.key}: the head is not where the line ends`,
        );
      }
    }
  }
});

console.log(`\n${checks} checks passed`);
