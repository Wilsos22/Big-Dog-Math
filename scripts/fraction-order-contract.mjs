// Contract for ordering fractions on the number line (/number-line-plus).
//
// The two rules Steele set are the ones that matter in the room: the line is
// 0 to 5, positive only, with a tick every half; and a student is judged on
// ORDER, having only to land each card within half a unit of where it truly
// sits. Everything here protects those, plus the set format the teacher types
// once and three surfaces read.
//
// Run: npm run test:fraction-order

import assert from "node:assert/strict";
import {
  DEFAULT_FRACTION_SET,
  FRACTION_LINE_MAX,
  FRACTION_LINE_MIN,
  FRACTION_LINE_TICK,
  MAX_CARDS_PER_ROUND,
  PLACEMENT_TOLERANCE,
  checkOrder,
  normalizeFractionSet,
  parseFractionCard,
  parseFractionRounds,
  serializeFractionRounds,
} from "../.tmp-mastery/fractionOrderSet.js";

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  console.log(`  ok  ${name}`);
}

console.log("fraction-order contract");

check("the line is 0 to 5 with a tick every half", () => {
  assert.equal(FRACTION_LINE_MIN, 0);
  assert.equal(FRACTION_LINE_MAX, 5);
  assert.equal(FRACTION_LINE_TICK, 0.5);
  // The tolerance is the tick spacing. Tightening it is a deliberate change to
  // what counts as placed, not a tidy-up.
  assert.equal(PLACEMENT_TOLERANCE, 0.5);
});

check("all five authored forms parse to the right spot", () => {
  assert.equal(parseFractionCard("3").value, 3);
  assert.equal(parseFractionCard("7/3").value, 7 / 3);
  assert.equal(parseFractionCard("2 1/4").value, 2.25);
  assert.equal(parseFractionCard("2_1/4").value, 2.25);
  assert.equal(parseFractionCard("0.75").value, 0.75);
  assert.equal(parseFractionCard("250%").value, 2.5);
  assert.deepEqual(
    ["3", "7/3", "2 1/4", "0.75", "250%"].map((t) => parseFractionCard(t).kind),
    ["whole", "fraction", "mixed", "decimal", "percent"],
  );
});

check("improper fractions and mixed numbers keep their parts for the card face", () => {
  const improper = parseFractionCard("7/3");
  assert.equal(improper.num, 7);
  assert.equal(improper.den, 3);
  const mixed = parseFractionCard("4 1/3");
  assert.equal(mixed.whole, 4);
  assert.equal(mixed.num, 1);
  assert.equal(mixed.den, 3);
});

check("positive only, and nothing past the end of the line", () => {
  assert.equal(parseFractionCard("-1/2"), null);
  assert.equal(parseFractionCard("-3"), null);
  // A hyphen never reads as a mixed-number separator - "2-1/4" is subtraction
  // to half the room, and this line has no negatives to subtract into.
  assert.equal(parseFractionCard("2-1/4"), null);
  assert.equal(parseFractionCard("11/2"), null); // 5.5 is off the line
  assert.equal(parseFractionCard("6"), null);
  assert.equal(parseFractionCard("600%"), null);
  assert.equal(parseFractionCard("1/0"), null);
  assert.equal(parseFractionCard("x"), null);
  assert.equal(parseFractionCard("5").value, 5); // the right end is on the line
});

check("a semicolon or newline starts a round, a comma separates cards", () => {
  const rounds = parseFractionRounds("1/2, 3/2, 2; 7/3, 4\n1/4, 5/4");
  assert.equal(rounds.length, 3);
  assert.deepEqual(rounds[0].map((c) => c.text), ["1/2", "3/2", "2"]);
  assert.deepEqual(rounds[1].map((c) => c.text), ["7/3", "4"]);
  assert.deepEqual(rounds[2].map((c) => c.text), ["1/4", "5/4"]);
});

check("one card is not a round, and an unreadable card is skipped not fatal", () => {
  assert.deepEqual(parseFractionRounds("3"), []);
  const rounds = parseFractionRounds("1/2, banana, 3/2");
  assert.equal(rounds.length, 1);
  assert.deepEqual(rounds[0].map((c) => c.text), ["1/2", "3/2"]);
});

check("duplicate text is dropped, but two names for the same value are kept", () => {
  const [dupText] = parseFractionRounds("1/2, 1/2, 3");
  assert.deepEqual(dupText.map((c) => c.text), ["1/2", "3"]);
  // 3/2 beside 6/4 is the point of a set, not a mistake to clean up.
  const [equivalents] = parseFractionRounds("3/2, 6/4, 3");
  assert.equal(equivalents.length, 3);
  assert.equal(equivalents[0].value, equivalents[1].value);
});

check("a round is capped so the cards still fit on the line", () => {
  const [round] = parseFractionRounds("1/4, 1/2, 3/4, 1, 5/4, 3/2, 7/4, 2, 9/4, 5/2");
  assert.equal(round.length, MAX_CARDS_PER_ROUND);
});

check("the set round-trips through the form stored on the session", () => {
  const normalized = normalizeFractionSet("1/2 , 7/3 ,2 1/4;  3/4, 3");
  assert.equal(normalized, "1/2, 7/3, 2 1/4; 3/4, 3");
  assert.equal(normalizeFractionSet(normalized), normalized);
  assert.equal(normalizeFractionSet(""), "");
  assert.equal(normalizeFractionSet(null), "");
});

check("ascending left to right is correct; a swap is not", () => {
  const cards = [
    { id: "1/2", value: 0.5, position: 0.5 },
    { id: "3/2", value: 1.5, position: 1.5 },
    { id: "7/3", value: 7 / 3, position: 2.5 },
  ];
  assert.equal(checkOrder(cards).correct, true);
  const swapped = [
    { id: "1/2", value: 0.5, position: 1.5 },
    { id: "3/2", value: 1.5, position: 0.5 },
  ];
  assert.equal(checkOrder(swapped).ordered, false);
});

check("equivalent cards are a tie and pass in either order", () => {
  const a = [
    { id: "3/2", value: 1.5, position: 1.4 },
    { id: "6/4", value: 1.5, position: 1.6 },
  ];
  const b = [
    { id: "6/4", value: 1.5, position: 1.4 },
    { id: "3/2", value: 1.5, position: 1.6 },
  ];
  assert.equal(checkOrder(a).ordered, true);
  assert.equal(checkOrder(b).ordered, true);
});

check("one card in the wrong place blames one card, not everything after it", () => {
  // 4 dropped at the front. Moving that single card fixes the board, so it is
  // the only thing the student should be told to move.
  const result = checkOrder([
    { id: "4", value: 4, position: 0.2 },
    { id: "1/2", value: 0.5, position: 1 },
    { id: "3/2", value: 1.5, position: 2 },
    { id: "5/2", value: 2.5, position: 3 },
  ]);
  assert.equal(result.ordered, false);
  assert.deepEqual(result.outOfPlace, ["4"]);
});

check("placement only has to land within half a unit", () => {
  // 7/3 is 2.33; anywhere from 1.83 to 2.83 counts as placed.
  const inside = checkOrder([
    { id: "7/3", value: 7 / 3, position: 7 / 3 + PLACEMENT_TOLERANCE },
    { id: "5", value: 5, position: 5 },
  ]);
  assert.deepEqual(inside.farOff, []);
  const outside = checkOrder([
    { id: "7/3", value: 7 / 3, position: 7 / 3 + PLACEMENT_TOLERANCE + 0.01 },
    { id: "5", value: 5, position: 5 },
  ]);
  assert.deepEqual(outside.farOff, ["7/3"]);
});

check("a lucky sequence of far-off cards is ordered but not correct", () => {
  // Every card in the right ORDER, every card nowhere near its value.
  const result = checkOrder([
    { id: "1/2", value: 0.5, position: 3.5 },
    { id: "3/2", value: 1.5, position: 4 },
    { id: "5/2", value: 2.5, position: 4.5 },
  ]);
  assert.equal(result.ordered, true);
  assert.equal(result.correct, false);
  assert.deepEqual(result.farOff, ["1/2", "3/2", "5/2"]);
});

check("the built-in rounds are playable: on the line, and every round orderable", () => {
  const rounds = parseFractionRounds(DEFAULT_FRACTION_SET);
  assert.ok(rounds.length >= 4);
  for (const round of rounds) {
    assert.ok(round.length >= 2 && round.length <= MAX_CARDS_PER_ROUND);
    for (const card of round) {
      assert.ok(card.value >= FRACTION_LINE_MIN && card.value <= FRACTION_LINE_MAX, `${card.text} is off the line`);
    }
  }
  // Mixed numbers and improper fractions both appear - the pair Steele asked for.
  const kinds = new Set(rounds.flat().map((c) => c.kind));
  assert.ok(kinds.has("mixed"));
  assert.ok(kinds.has("fraction"));
  // Placing every card exactly where it lands is a correct board.
  for (const round of rounds) {
    const result = checkOrder(round.map((c) => ({ id: c.id, value: c.value, position: c.value })));
    assert.equal(result.correct, true, `${serializeFractionRounds([round])} should check out`);
  }
});

console.log(`\n${checks} checks passed`);
