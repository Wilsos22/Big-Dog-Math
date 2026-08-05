// Contract for the blank long-division house (/division-house).
//
// This tool teaches the CHOREOGRAPHY, not the arithmetic - the numbers are
// worked out for the student and what they supply is which spot and which
// operation. So the thing worth pinning is Steele's sequence, in his order:
//
//   the number we are dividing -> divide -> the number we divide BY ->
//   where the answer goes -> multiply -> by which spot -> where that goes ->
//   subtract -> where that goes -> bring down -> which digit -> where it goes
//
// and then it resets for the next round. A change that collapses two of those
// into one step has removed a decision the student is meant to make.
//
// Run: npm run test:division-house

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEFAULT_HOUSE_SET,
  HOUSE_CYCLE,
  HOUSE_OPS,
  buildHouseTrace,
  houseRailState,
  normalizeHouseSet,
  parseHouseSet,
} from "../.tmp-mastery/divisionHouse.js";

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  console.log(`  ok  ${name}`);
}

const shape = (t) => t.prompts.map((p) => (p.kind === "operation" ? p.op : p.id.replace(/-\d+$/, "")));

/** Steele's twelve, in his order. A round that is not the last runs all of it. */
const ROUND = [
  "pick-partial",
  "divide",
  "pick-divisor",
  "place-quotient",
  "multiply",
  "pick-mult",
  "place-product",
  "subtract",
  "place-rest",
  "bringdown",
  "pick-bring",
  "place-bring",
];
/** The last round has nothing left to bring down. */
const LAST_ROUND = ROUND.slice(0, 9);
const roundCount = (t) => new Set(t.prompts.map((p) => p.round)).size;

/** Six shapes: two rounds, a zero quotient, a short quotient, a two-digit divisor, three rounds. */
const SHAPES = [[96, 4], [618, 6], [138, 6], [84, 9], [144, 12], [1000, 8]];

console.log("division-house contract");

check("every round of every shape is Steele's sequence, in his order", () => {
  // This used to check twelve steps of ONE round of ONE problem, so a
  // regression that dropped pick-divisor from round two, or reordered a
  // zero-quotient round, passed the whole suite green.
  for (const [dividend, divisor] of SHAPES) {
    const t = buildHouseTrace(dividend, divisor);
    const s = shape(t);
    const rounds = roundCount(t);
    for (let r = 0; r < rounds - 1; r += 1) {
      assert.deepEqual(s.slice(r * 12, r * 12 + 12), ROUND, `${dividend}/${divisor} round ${r}`);
    }
    assert.deepEqual(s.slice((rounds - 1) * 12), LAST_ROUND, `${dividend}/${divisor} last round`);
    assert.equal(t.prompts.length, (rounds - 1) * 12 + 9, `${dividend}/${divisor} prompt count`);
    // Every prompt is stamped with the round it belongs to, in order.
    t.prompts.forEach((p, i) => assert.equal(p.round, Math.floor(i / 12), `${dividend}/${divisor} ${p.id}`));
  }
});

check("and then it resets", () => {
  // Steele: "then it resets". The second round opens on the same first move.
  const t = buildHouseTrace(96, 4);
  assert.equal(shape(t)[12], "pick-partial");
  assert.equal(t.prompts[12].round, 1);
  // The last round has no bring-down - there is nothing left to bring.
  assert.ok(!shape(t).slice(12).includes("bringdown"));
});

check("the first move points inside the house, the divisor move outside it", () => {
  const t = buildHouseTrace(96, 4);
  assert.match(t.prompts[0].ask, /first number inside the house/i);
  assert.deepEqual(t.prompts[0].slots, ["dv-0"]);
  const divisorPrompt = t.prompts.find((p) => p.id === "pick-divisor-0");
  // "dividing by not with" (Steele, 2026-08-03). You divide BY a number, and
  // the sentence under this ask has always said "Dividing by 4" - the tool was
  // teaching both at once.
  assert.match(divisorPrompt.ask, /dividing BY/);
  assert.ok(!/dividing WITH/i.test(divisorPrompt.ask));
  assert.deepEqual(divisorPrompt.slots, ["ds-0"]);
  // The divisor really is outside: left of where the house starts.
  const ds = t.slots.find((s) => s.id === "ds-0");
  assert.ok(ds.col < t.divisorWidth);
});

check("every operation step draws its own sign between two real spots", () => {
  // "theres an animation and visual X between multiplying or a division sign
  // between dividing and an arrow during bring down"
  const t = buildHouseTrace(96, 4);
  const ids = new Set(t.slots.map((s) => s.id));
  const signs = {};
  for (const p of t.prompts) {
    if (!p.visual) continue;
    signs[p.visual.sign] = (signs[p.visual.sign] ?? 0) + 1;
    assert.ok(ids.has(p.visual.from), `${p.id} points from a spot that is not on the board`);
    assert.ok(ids.has(p.visual.to), `${p.id} points to a spot that is not on the board`);
  }
  assert.ok(signs["÷"] >= 1, "dividing needs its sign");
  assert.ok(signs["x"] >= 1, "multiplying needs its sign");
  assert.ok(signs["−"] >= 1, "subtracting needs its sign");
  assert.ok(signs["↓"] >= 1, "bringing down needs its arrow");
});

check("every round traces Steele's six moves, in his order and his directions", () => {
  // "to the left, up, diagonal left, diagnal right, down ,down" - the pathway
  // the numbers take, which the board now keeps on screen for the whole
  // problem. Three of these six were missing entirely until 2026-08-03: the
  // board drew the question (9 ÷ 4) and never drew any answer arriving.
  const EXPECT = [
    ["op-divide", "÷"],       // left:            what we divide -> the divisor
    ["place-quotient", "="],  // up:              the divisor    -> the quotient
    ["pick-mult", "x"],       // diagonal left:   the quotient   -> the divisor
    ["place-product", "="],   // diagonal right:  the divisor    -> the product
    ["op-subtract", "−"],     // down:            what we divide -> the product
    ["place-rest", ""],       // down:            the product    -> the difference
  ];
  for (const [dividend, divisor] of SHAPES) {
    const t = buildHouseTrace(dividend, divisor);
    const slotOf = (id) => t.slots.find((s) => s.id === id);
    const rounds = roundCount(t);
    for (let r = 0; r < rounds; r += 1) {
      const drawn = t.prompts.filter((p) => p.round === r && p.visual);
      const six = drawn.slice(0, 6);
      const where = `${dividend}/${divisor} round ${r}`;
      assert.deepEqual(
        six.map((p) => [p.id.replace(/-\d+$/, ""), p.visual.sign]),
        EXPECT,
        where,
      );
      const [divide, upEq, mult, downEq, minus, drop] = six;
      // Four of the six touch the divisor, which never moves. That is what
      // makes it the hub of the picture, and what a colour per round is for.
      assert.equal(divide.visual.to, "ds-0", `${where} divide points at the divisor`);
      assert.equal(upEq.visual.from, "ds-0", `${where} the answer comes off the divisor`);
      assert.equal(mult.visual.to, "ds-0", `${where} multiply points at the divisor`);
      assert.equal(downEq.visual.from, "ds-0", `${where} the product comes off the divisor`);
      // Up really is up, and the two downs really do land below.
      assert.equal(slotOf(upEq.visual.to).row, "quotient", `${where} up lands above the bracket`);
      assert.ok(slotOf(minus.visual.to).row.startsWith("work"), `${where} subtract lands on the product`);
      assert.ok(slotOf(drop.visual.to).row.startsWith("rest"), `${where} the difference lands below`);
      // THE LAST MOVE IS A TRUE VERTICAL DROP. The product and the difference
      // are both right-aligned under the number being divided, so it has to be
      // anchored on the LAST digit of each - first-to-first slants whenever the
      // two are different widths, which is most of the time.
      assert.equal(
        slotOf(drop.visual.from).col,
        slotOf(drop.visual.to).col,
        `${where}: the difference arrow must fall straight down`,
      );
      // The seventh, on every round but the last, is the bring-down arrow.
      if (r < rounds - 1) {
        assert.equal(drawn.length, 7, `${where} also brings a digit down`);
        assert.equal(drawn[6].visual.sign, "↓", where);
      } else {
        assert.equal(drawn.length, 6, `${where} is the last round and draws six`);
      }
    }
  }
});

check("the four operation buttons are the four steps of the cycle", () => {
  assert.deepEqual(HOUSE_OPS.map((o) => o.op), ["divide", "multiply", "subtract", "bringdown"]);
  for (const o of HOUSE_OPS) assert.ok(o.sign.trim() && o.label.trim());
});

check("every spot a prompt names exists, and every blank one gets filled", () => {
  for (const [dividend, divisor] of [[96, 4], [738, 6], [618, 6], [875, 4], [84, 4]]) {
    const t = buildHouseTrace(dividend, divisor);
    const ids = new Set(t.slots.map((s) => s.id));
    for (const p of t.prompts) {
      if (p.kind === "slot") {
        assert.ok(p.slots?.length, `${dividend}/${divisor} ${p.id} names no spot`);
        for (const sl of p.slots) assert.ok(ids.has(sl), `${dividend}/${divisor} ${p.id} -> ${sl}`);
      }
      for (const f of p.fill) assert.ok(ids.has(f), `${dividend}/${divisor} ${p.id} fills ${f}`);
      assert.ok(p.hint.trim(), `${p.id} has no nudge`);
      assert.ok(p.say.trim(), `${p.id} says nothing`);
    }
    // A blank rectangle nobody ever fills is a spot the student can never reach.
    const filled = new Set(t.prompts.flatMap((p) => p.fill));
    for (const s of t.slots) {
      if (!s.given) assert.ok(filled.has(s.id), `${dividend}/${divisor} leaves ${s.id} blank forever`);
    }
  }
});

check("a multi-digit number is pointed at as ONE number", () => {
  // Steele: "when you ask what are we dividing, make sure to highlight both
  // place values together". The leftover plus the digit brought down beside it
  // IS one number; lighting half of it teaches the wrong thing, and clicking
  // either half has to count.
  const t = buildHouseTrace(96, 4);
  const second = t.prompts.find((p) => p.id === "pick-partial-1");
  assert.equal(second.slots.length, 2, "16 is two cells");
  assert.ok(second.slots.includes("r0-0"));
  assert.ok(second.slots.includes("bd0"));
  // Same on round one when the divisor needs two digits to get going.
  const wide = buildHouseTrace(84, 9);
  assert.deepEqual(wide.prompts[0].slots, ["dv-0", "dv-1"]);
  // And a two-digit product is a single number too.
  const prod = t.prompts.find((p) => p.id === "place-product-1");
  assert.equal(prod.slots.length, 2);
});

check("a two-digit divisor is one number, and every digit of it counts", () => {
  // 144/12 used to name only ds-0, so a student who tapped the 2 of "12" - the
  // divisor - was told "It sits outside the house, on the left", and the pulse
  // lit the 1 alone as though 12 were two numbers.
  const t = buildHouseTrace(144, 12);
  assert.equal(t.divisorWidth, 2);
  for (const id of ["pick-divisor-0", "pick-mult-0", "pick-divisor-1", "pick-mult-1"]) {
    const p = t.prompts.find((x) => x.id === id);
    assert.ok(p, `${id} is missing`);
    assert.deepEqual(p.slots, ["ds-0", "ds-1"], `${id} must name the whole divisor`);
  }
  // And the sign still anchors on one end of it, not on a slot that is missing.
  const ids = new Set(t.slots.map((s) => s.id));
  for (const p of t.prompts) {
    if (p.visual) assert.ok(ids.has(p.visual.to) && ids.has(p.visual.from), p.id);
  }
});

check("a sentence never answers the question that comes after it", () => {
  // `.dh-say` shows the PREVIOUS prompt's sentence while the next one is asked,
  // so "We are dividing 13." sat directly above "What operation are we doing?"
  // on the first operation question of every round of every problem.
  const NAMES = { divide: /divid/i, multiply: /multipl/i, subtract: /subtract/i, bringdown: /bring/i };
  for (const [dividend, divisor] of SHAPES) {
    const t = buildHouseTrace(dividend, divisor);
    t.prompts.forEach((p, i) => {
      const next = t.prompts[i + 1];
      if (!next || next.kind !== "operation") return;
      assert.ok(
        !NAMES[next.op].test(p.say),
        `${dividend}/${divisor}: ${p.id} says "${p.say}" and ${next.id} then asks for ${next.op}`,
      );
    });
  }
});

check("two numerals never sit side by side with only a space between them", () => {
  // "4 goes into 9 2 times" reads as one number, and "3 goes into 1 0 times"
  // reads as ten. Every round of every problem said one of those.
  for (const [dividend, divisor] of [...SHAPES, [936, 4], [824, 4], [100, 99], [7, 7]]) {
    const t = buildHouseTrace(dividend, divisor);
    for (const p of t.prompts) {
      const fields = [["say", p.say], ["ask", p.ask], ["hint", p.hint]];
      // The work line is read the same way and is nothing BUT numerals, so it
      // is the likeliest place for this to come back.
      if (p.work) fields.push(["work", p.work.text]);
      for (const [field, text] of fields) {
        assert.ok(!/\d\s\d/.test(text), `${dividend}/${divisor} ${p.id}.${field}: ${text}`);
      }
    }
  }
});

check("the rail is five letters, and only four of them are pressable", () => {
  // Steele: "A Big D, M, S, B, R just like we did on the other tools like gems".
  // R is not an operation - nothing is asked for it - so it lives on the rail
  // and NOT in HOUSE_OPS, which is what the four buttons are built from.
  assert.deepEqual(HOUSE_CYCLE.map((c) => c.letter), ["D", "M", "S", "B", "R"]);
  assert.deepEqual(HOUSE_CYCLE.slice(0, 4).map((c) => c.key), HOUSE_OPS.map((o) => o.op));
  assert.equal(HOUSE_CYCLE[4].key, "repeat");
  assert.ok(!HOUSE_OPS.some((o) => o.op === "repeat"), "R must never become a fifth button");
  for (const c of HOUSE_CYCLE) assert.ok(c.label.trim());
});

check("every prompt says which letter of the rail it belongs to", () => {
  // Carried on the prompt rather than parsed out of its id: the rail is what a
  // student reads to work out where they are, and a regex over ids puts the
  // wrong tile under the highlight the first time one is renamed.
  const CYCLE = [
    "divide", "divide", "divide", "divide",
    "multiply", "multiply", "multiply",
    "subtract", "subtract",
    "bringdown", "bringdown", "bringdown",
  ];
  for (const [dividend, divisor] of SHAPES) {
    const t = buildHouseTrace(dividend, divisor);
    t.prompts.forEach((p, i) => {
      assert.equal(p.cycle, CYCLE[i % 12], `${dividend}/${divisor} ${p.id}`);
    });
    // The last round has no bring-down, which is what greys the B tile out -
    // and a tile that greys for the wrong reason is worse than no tile.
    const rounds = roundCount(t);
    const lastB = t.prompts.some((p) => p.round === rounds - 1 && p.cycle === "bringdown");
    assert.ok(!lastB, `${dividend}/${divisor}: the last round must have nothing to bring down`);
    for (let r = 0; r < rounds - 1; r += 1) {
      assert.ok(t.prompts.some((p) => p.round === r && p.cycle === "bringdown"), `${dividend}/${divisor} round ${r}`);
    }
  }
});

check("a work line only ever GROWS, so it cannot print an answer first", () => {
  // Steele: "show the math happening in numbers next to the step so show the 9
  // divide sign 4". The rail panel prints the latest state of each line, so the
  // ONE thing keeping "9 ÷ 4 = 2" off the screen while "where does that answer
  // go?" is still the question is that the pieces arrive in order and each is a
  // prefix of the next.
  for (const [dividend, divisor] of [...SHAPES, [936, 4], [1000, 8], [7, 7]]) {
    const t = buildHouseTrace(dividend, divisor);
    const lines = new Map();
    for (const p of t.prompts) {
      if (!p.work) continue;
      const prev = lines.get(p.work.key);
      if (prev !== undefined) {
        assert.ok(
          p.work.text.startsWith(prev) && p.work.text.length > prev.length,
          `${dividend}/${divisor} ${p.id}: "${prev}" -> "${p.work.text}" is not one piece longer`,
        );
        assert.ok(
          !prev.includes("="),
          `${dividend}/${divisor} ${p.id}: the line was already finished at "${prev}"`,
        );
      }
      lines.set(p.work.key, p.work.text);
      // A work line belongs to the round it is part of, or the panel prints
      // last round's arithmetic beside this round's words.
      assert.equal(p.work.key, `${p.work.key[0]}${p.round}`, `${p.id} keys the wrong round`);
    }
    // Three finished facts per round, and each says what actually happened.
    const slotText = (id) => t.slots.find((s) => s.id === id)?.text ?? "";
    const rounds = roundCount(t);
    for (let r = 0; r < rounds; r += 1) {
      const of = (id) => t.prompts.find((p) => p.id === `${id}-${r}`);
      // WRITTEN, THAT NUMBER CAN CARRY A LEADING ZERO and the number it names
      // does not. On 618/6 round one the board holds a leftover 0 with the 1
      // brought down beside it - "01" on paper, the number 1 in the sentence -
      // so the digits are read back as a number, exactly as the engine builds
      // them, or this check fails on the tool being right.
      const partial = String(Number(of("pick-partial").slots.map(slotText).join("")));
      const q = of("place-quotient").fill.map(slotText).join("");
      const product = of("place-product").fill.map(slotText).join("");
      const rest = of("place-rest").fill.map(slotText).join("");
      assert.equal(lines.get(`d${r}`), `${partial} ÷ ${divisor} = ${q}`, `${dividend}/${divisor} round ${r} divide`);
      assert.equal(lines.get(`m${r}`), `${q} x ${divisor} = ${product}`, `${dividend}/${divisor} round ${r} multiply`);
      assert.equal(lines.get(`s${r}`), `${partial} − ${product} = ${rest}`, `${dividend}/${divisor} round ${r} subtract`);
      // The bring-down deliberately has none - it is not a fact with an answer.
      assert.ok(
        !t.prompts.some((p) => p.round === r && p.cycle === "bringdown" && p.work),
        `${dividend}/${divisor} round ${r}: a bring-down must not invent a fourth equation`,
      );
    }
  }
});

check("the round-zero ask says WHY the first digit is not enough", () => {
  // 6 does not go into 1, so we take 13 - the single most important idea in
  // this case, and the ask used to say "the first number" while the hint said
  // "the first digit" and two cells pulsed.
  for (const [dividend, divisor] of [[138, 6], [84, 9], [100, 99], [144, 12]]) {
    const t = buildHouseTrace(dividend, divisor);
    const first = t.prompts[0];
    assert.ok(first.slots.length > 1, `${dividend}/${divisor} takes more than one digit`);
    assert.match(first.ask, /does not fit into the first digit/i, `${dividend}/${divisor}`);
    assert.match(first.hint, /bigger than/i, `${dividend}/${divisor}`);
  }
  // And the ordinary case keeps its ordinary wording.
  assert.match(buildHouseTrace(96, 4).prompts[0].ask, /first number inside the house/i);
});

check("the four operation buttons are seated, and hold all four operations", () => {
  // In fixed cycle order, "tap the leftmost chip that is not lit yet" answered
  // every operation question without reading it.
  const slotsById = new Map();
  for (const [dividend, divisor] of [...SHAPES, [936, 4], [824, 4], [7, 7], [9999, 3]]) {
    const t = buildHouseTrace(dividend, divisor);
    for (const p of t.prompts) {
      if (p.kind !== "operation") continue;
      assert.ok(p.options, `${p.id} has no seated order`);
      assert.deepEqual([...p.options].sort(), HOUSE_OPS.map((o) => o.op).sort(), `${p.id} must offer all four`);
      const key = p.id.replace(/-\d+$/, "");
      if (!slotsById.has(key)) slotsById.set(key, []);
      slotsById.get(key).push(p.options.indexOf(p.op));
    }
  }
  for (const [key, seats] of slotsById) {
    assert.ok(seats.length >= 4, `${key} needs a real sample`);
    assert.ok(new Set(seats).size > 1, `${key} seats the answer in slot ${seats[0]} every time`);
  }
  // Deterministic, so this is a fact about the build and not a flake.
  const a = buildHouseTrace(96, 4).prompts.find((p) => p.id === "op-divide-0");
  const b = buildHouseTrace(96, 4).prompts.find((p) => p.id === "op-divide-0");
  assert.deepEqual(a.options, b.options);
});

check("the arithmetic behind the board is right", () => {
  for (const [dividend, divisor] of [[96, 4], [738, 6], [618, 6], [875, 4], [84, 4], [7, 7]]) {
    const t = buildHouseTrace(dividend, divisor);
    assert.equal(t.quotient * divisor + t.remainder, dividend, `${dividend}/${divisor}`);
    assert.ok(t.remainder >= 0 && t.remainder < divisor);
  }
});

check("nothing is written above the bracket until the divisor fits", () => {
  // 6 does not go into 6... it does. 738/6 starts on the 7; 618/6 starts on the
  // 6. But 84/9 has no quotient digit over the 8.
  const t = buildHouseTrace(84, 9);
  const quotientCols = t.slots.filter((s) => s.row === "quotient").map((s) => s.col);
  const firstDividendCol = t.slots.find((s) => s.id === "dv-0").col;
  assert.ok(!quotientCols.includes(firstDividendCol), "9 does not go into 8, so nothing sits over the 8");
  assert.equal(t.quotient, 9);
  assert.equal(t.remainder, 3);
});

check("two grid cells never land on top of each other", () => {
  for (const [dividend, divisor] of [[96, 4], [738, 6], [875, 4], [1000, 8]]) {
    const t = buildHouseTrace(dividend, divisor);
    const seen = new Map();
    for (const s of t.slots) {
      const key = `${s.rowIndex}:${s.col}`;
      assert.ok(!seen.has(key), `${dividend}/${divisor}: ${seen.get(key)} and ${s.id} share ${key}`);
      seen.set(key, s.id);
    }
    for (const s of t.slots) {
      assert.ok(s.col >= 0 && s.col < t.columns, `${s.id} is off the grid`);
      assert.ok(s.rowIndex >= 0 && s.rowIndex < t.rows, `${s.id} is off the grid`);
    }
  }
});

check("a problem the house cannot draw is refused out loud", () => {
  const { problems, rejected } = parseHouseSet("96/4, 4/96, 12/0, banana, 99999/3");
  assert.equal(problems.length, 1);
  const reasons = Object.fromEntries(rejected.map((r) => [r.text, r.reason]));
  assert.match(reasons["4/96"], /bigger than the dividend/);
  assert.match(reasons["banana"], /not a problem/);
  // Dividing by zero was answered with a message about the size ceiling that
  // never mentioned zero.
  assert.match(reasons["12/0"], /zero/i);
  assert.ok(reasons["99999/3"]);
  assert.equal(buildHouseTrace(96, 0), null);
  assert.equal(buildHouseTrace(0, 4), null);
  assert.equal(buildHouseTrace(9.5, 4), null);
});

check("problems past the ceiling are reported, not silently dropped", () => {
  // The module promises the opposite of a silent drop, and a teacher who pastes
  // fifteen and reads "12 problems." has no way to know which three vanished.
  const raw = Array.from({ length: 15 }, (_, i) => `${100 + i}/4`).join(", ");
  const { problems, rejected } = parseHouseSet(raw);
  assert.equal(problems.length, 12);
  assert.equal(rejected.length, 3);
  for (const r of rejected) assert.match(r.reason, /only the first 12/i);
});

check("the set round-trips", () => {
  assert.equal(normalizeHouseSet("96 / 4 ; 738÷6"), "96/4, 738/6");
  assert.equal(normalizeHouseSet(normalizeHouseSet("96/4")), "96/4");
  assert.equal(normalizeHouseSet(""), "");
  assert.equal(normalizeHouseSet(null), "");
});

check("a move lights WHOLE numbers, and says which way it runs", () => {
  // The board shows the current move by ringing the two numbers it runs
  // between - a hairline on the source, a solid ring on the destination, so it
  // says direction and not just "these two". Both ends must therefore be the
  // COMPLETE number: anchored on one cell each, it lit the "1" of 14 and the
  // "1" of 12 on 144/12 and left the other halves dark, which is precisely what
  // `slots: string[]` exists to stop one prompt earlier.
  for (const [dividend, divisor] of [...SHAPES, [9876, 4], [1000, 8]]) {
    const t = buildHouseTrace(dividend, divisor);
    const ids = new Set(t.slots.map((s) => s.id));
    const rowOf = (id) => t.slots.find((s) => s.id === id).rowIndex;
    for (const p of t.prompts) {
      if (!p.visual) continue;
      const v = p.visual;
      const where = `${dividend}/${divisor} ${p.id}`;
      for (const [side, set, anchor] of [["from", v.fromSlots, v.from], ["to", v.toSlots, v.to]]) {
        assert.ok(set?.length, `${where}: ${side} names no number`);
        for (const id of set) assert.ok(ids.has(id), `${where}: ${side} -> ${id} is not on the board`);
        assert.ok(set.includes(anchor), `${where}: the ${side} anchor is not part of its own number`);
        // One number sits on one row, in adjacent columns.
        const rows = new Set(set.map(rowOf));
        assert.equal(rows.size, 1, `${where}: ${side} spans ${rows.size} rows, so it is not one number`);
        const cols = set.map((id) => t.slots.find((s) => s.id === id).col).sort((a, b) => a - b);
        for (let i = 1; i < cols.length; i += 1) {
          assert.equal(cols[i], cols[i - 1] + 1, `${where}: ${side} has a gap, so it is not one number`);
        }
      }
      // The two ends are different numbers, or there is no move to show.
      assert.notDeepEqual(v.fromSlots, v.toSlots, `${where}: a move onto itself`);
    }
    // And the ends really are the numbers the prompts name.
    const rounds = new Set(t.prompts.map((p) => p.round)).size;
    for (let r = 0; r < rounds; r += 1) {
      const partial = t.prompts.find((p) => p.id === `pick-partial-${r}`).slots;
      const divisorSlots = t.prompts.find((p) => p.id === `pick-divisor-${r}`).slots;
      assert.deepEqual(t.prompts.find((p) => p.id === `op-divide-${r}`).visual.fromSlots, partial, `${dividend}/${divisor} r${r}`);
      assert.deepEqual(t.prompts.find((p) => p.id === `op-divide-${r}`).visual.toSlots, divisorSlots, `${dividend}/${divisor} r${r}`);
      assert.deepEqual(t.prompts.find((p) => p.id === `op-subtract-${r}`).visual.fromSlots, partial, `${dividend}/${divisor} r${r}`);
    }
  }
});

check("each destination is asked for in its own words", () => {
  // The three "where does the answer go" steps point at three different ROWS -
  // above the bracket, under the dividend, under the rule - and used to share
  // one byte-identical sentence. That was fine while the target pulsed. It does
  // not pulse until a miss now, so a student who does not know is given nothing
  // until they guess wrong, which is not "reps following the numbers".
  const PLACERS = ["place-quotient", "place-product", "place-rest", "place-bring"];
  for (const [dividend, divisor] of SHAPES) {
    const t = buildHouseTrace(dividend, divisor);
    const asks = PLACERS
      .map((id) => t.prompts.find((p) => p.id === `${id}-0`))
      .filter(Boolean)
      .map((p) => p.ask);
    assert.equal(new Set(asks).size, asks.length, `${dividend}/${divisor}: two destinations share an ask`);
    // And each one says WHERE, not just "somewhere".
    for (const a of asks) {
      assert.match(a, /bracket|underneath|under the line|straight down/i, `"${a}" names no place`);
    }
  }
});

check("the rail never answers the question the room is being asked", () => {
  // THE BUG THIS PINS, found by review after it shipped: a tile lit as soon as
  // the current prompt belonged to it, so on "What operation are we doing
  // here?" the D tile was the most saturated thing on the page. A student could
  // clear every operation step in the drill by pressing the button whose word
  // was glowing - which is the exact shortcut `seatOps` exists to close, and it
  // deletes the one step where the sequence has to be recalled.
  const OPS = ["divide", "multiply", "subtract", "bringdown"];
  for (const [dividend, divisor] of [...SHAPES, [9876, 4], [1000, 8], [84, 9]]) {
    const t = buildHouseTrace(dividend, divisor);
    for (let step = 0; step <= t.prompts.length; step += 1) {
      const rail = houseRailState(t, step);
      const where = `${dividend}/${divisor} step ${step}`;
      assert.equal(rail.length, 5, where);
      const p = t.prompts[step];
      if (p && p.kind === "operation") {
        const tile = rail.find((x) => x.key === p.op);
        assert.notEqual(tile.state, "active", `${where}: the rail lights ${p.op} while asking for it`);
        assert.notEqual(tile.state, "done", `${where}: the rail says ${p.op} is finished before it is named`);
      }
      // A student stands in ONE place. Two solid tiles says otherwise, and the
      // last round of every problem used to show subtract and repeat together.
      assert.ok(
        rail.filter((x) => x.state === "active").length <= 1,
        `${where}: ${rail.filter((x) => x.state === "active").map((x) => x.key).join(" + ")} are both active`,
      );
      // R is where the cycle GOES, never a step you are standing in.
      assert.notEqual(rail.find((x) => x.key === "repeat").state, "active", where);
      // B greys out only where there is genuinely nothing left to bring down.
      const round = p ? p.round : t.prompts[t.prompts.length - 1].round;
      const hasBring = t.prompts.some((x) => x.round === round && x.cycle === "bringdown");
      assert.equal(
        rail.find((x) => x.key === "bringdown").state === "skipped",
        !hasBring,
        `${where}: B skipped=${!hasBring ? "expected" : "wrong"}`,
      );
      for (const k of OPS) assert.ok(["upcoming", "active", "done", "skipped"].includes(rail.find((x) => x.key === k).state));
    }
    // Named, and only then lit: the tile turns active on the step AFTER its
    // operation is answered, which is what makes it a reward and not a cue.
    const firstDivide = t.prompts.findIndex((p) => p.id === "op-divide-0");
    assert.equal(houseRailState(t, firstDivide).find((x) => x.key === "divide").state, "upcoming");
    assert.equal(houseRailState(t, firstDivide + 1).find((x) => x.key === "divide").state, "active");
    // And the word only becomes Remainder once the leftover is actually down.
    assert.equal(houseRailState(t, t.prompts.length - 1).find((x) => x.key === "repeat").label, "Repeat");
    assert.equal(houseRailState(t, t.prompts.length).find((x) => x.key === "repeat").label, "Remainder");
  }
});

check("the board's stylesheet parses - no rule swallowed by a comment", () => {
  // THE BUG THIS PINS, and it is the worst kind: it shipped, typecheck passed,
  // 39 contract suites passed, and I verified the class was APPLIED in a live
  // browser without ever checking that the rule RENDERED anything.
  //
  // An edit left a stray `*/` in the middle of a comment block, so the prose
  // after it plus the selector under it were read as one invalid selector and
  // the whole `.dh-slot.act` rule was dropped. That rule is the entire
  // replacement for the arcs - the board said nothing at all on a correct run.
  //
  // Nothing in this repo parses that stylesheet, because it is an inline
  // template literal inside JSX. So: strip balanced comments, and anything
  // comment-shaped left over means a rule is being eaten.
  const src = readFileSync(new URL("../src/components/DivisionHouseBoard.tsx", import.meta.url), "utf8");
  const open = src.indexOf("<style>{`");
  const close = src.indexOf("`}</style>");
  assert.ok(open > 0 && close > open, "the inline stylesheet moved - update this check");
  const css = src.slice(open + "<style>{`".length, close);

  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(!stripped.includes("*/"), "an orphan */ is left over - a comment closes twice and eats the rule under it");
  assert.ok(!stripped.includes("/*"), "an unclosed /* swallows everything after it");
  const braces = [...stripped].reduce((n, ch) => n + (ch === "{" ? 1 : ch === "}" ? -1 : 0), 0);
  assert.equal(braces, 0, "unbalanced braces in the stylesheet");

  // And the rules the board cannot do without are really declared. Checked
  // against the COMMENT-STRIPPED text, so a rule that only exists inside a
  // comment does not count as present.
  const required = [
    [/\.dh-slot\.act\s*\{[^}]*box-shadow/, "the current move must ring its two cells"],
    [/\.dh-slot\.target\s*\{[^}]*border-color/, "the after-a-miss mark must have a border"],
    [/\.dh-tile\.active\s*\{[^}]*background/, "the rail's live tile must fill"],
    [/\.dh-tile\.done\s*\{[^}]*background/, "a named step must read as named"],
    [/\.dh-fly\.go\s*\{[^}]*transform/, "the set-up number must travel"],
    [/\.dh-zone\s*\{[^}]*position:absolute/, "the drop zones must be placed on the board"],
    [/\.dh-chip\s*\{[^}]*touch-action:none/, "without this a drag scrolls the page instead"],
  ];
  for (const [re, why] of required) assert.match(stripped, re, why);
});

check("the built-in set climbs, and every problem runs", () => {
  const { problems, rejected } = parseHouseSet(DEFAULT_HOUSE_SET);
  assert.deepEqual(rejected, []);
  assert.ok(problems.length >= 4);
  const traces = problems.map((p) => buildHouseTrace(p.dividend, p.divisor));
  for (const t of traces) assert.ok(t);
  // One round, then more than one.
  assert.ok(traces[0].prompts.filter((p) => p.id.startsWith("pick-partial")).length >= 2);
  // A zero in the quotient, and a remainder, both appear in the ladder.
  assert.ok(traces.some((t) => t.slots.some((s) => s.row === "quotient" && s.text === "0")));
  assert.ok(traces.some((t) => t.remainder > 0));
});

console.log(`\n${checks} checks passed`);
