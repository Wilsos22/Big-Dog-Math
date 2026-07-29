// Contract for the /weekly-display board logic.
//
// Written because a real published lesson put "I am learning to we are learning
// how splitting one side of a rectangle helps us write equivalent expressions"
// on the live board: the restemmer only knew "are learning to" and fell through
// on "are learning how". Wrong renders on a classroom screen, so the phrasings
// Notion actually holds are now pinned here.

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const board = require(path.join(root, ".tmp-mastery", "weeklyDisplayBoard.js"));

let checks = 0;
const ok = (label, actual, expected) => {
  assert.deepEqual(actual, expected, `${label}: got ${JSON.stringify(actual)}`);
  checks += 1;
  console.log(`  ok  ${label}`);
};

console.log("learning intention stems");
for (const [input, expected] of [
  // The live failure, and its whole family: "learning how/why/about" keeps the
  // clause and drops the "to", because "learning to how ..." is not English.
  ["We are learning how splitting one side of a rectangle helps us write equivalent expressions.",
    "I am learning how splitting one side of a rectangle helps us write equivalent expressions."],
  ["Learning why the distributive property works.", "I am learning why the distributive property works."],
  ["We are learning about ratio reasoning.", "I am learning about ratio reasoning."],
  ["Today we are learning how to split a rectangle.", "I am learning how to split a rectangle."],
  // Every voice Notion is actually authored in.
  ["I can use the greatest common factor to rewrite a sum as a product.",
    "I am learning to use the greatest common factor to rewrite a sum as a product."],
  ["Students will be able to find equivalent ratios.", "I am learning to find equivalent ratios."],
  ["We are learning to model ratios on a double number line.",
    "I am learning to model ratios on a double number line."],
  ["I will explain what a unit rate means.", "I am learning to explain what a unit rate means."],
  ["Today: I can find a GCF.", "I am learning to find a GCF."],
  // Already correct, and a bare imperative that opens on an action verb.
  ["I am learning to divide fractions.", "I am learning to divide fractions."],
  ["Use ratio tables to find a missing value.", "I am learning to use ratio tables to find a missing value."],
  // No stem to strip and not verb-led: left exactly as written. A noun phrase
  // under the eyebrow reads fine; a forced stem would not.
  ["Equivalent expressions and the distributive property.", "Equivalent expressions and the distributive property."],
  ["GCF and LCM.", "GCF and LCM."],
  ["", ""],
]) ok(JSON.stringify(input).slice(0, 56), board.learningIntentionStatement(input), expected);

console.log("vocabulary: term, definition, and the figure line");
{
  const bare = board.readBoardVocabulary("factor; factor pair; multiple; greatest common factor");
  ok("a bare term list yields no definitions", bare.entries.map((e) => e.definition), ["", "", "", ""]);
  ok("and no figure", bare.figure, null);

  const rich = board.readBoardVocabulary([
    "Ratio table - A table of equivalent ratios. Multiply both rows by the same number.",
    "unit rate",
    "table: Cups = 3, 6, 9 | Scoops = 2, 4, *6",
  ].join("\n"));
  ok("a dash splits term from definition", rich.entries[0], {
    term: "Ratio table",
    definition: "A table of equivalent ratios. Multiply both rows by the same number.",
  });
  ok("commas inside a definition are not split points", rich.entries.length, 2);
  ok("the figure line is not a vocabulary term", rich.figure.kind, "table");
  ok("a starred cell is the marked answer", rich.figure.rows[1].highlight, 2);
  ok("an unstarred row marks its last cell", rich.figure.rows[0].highlight, 2);
}

console.log("figure grammar fails safe");
ok("lines", board.readBoardVocabulary("lines: Miles = 0, 4, 8, 12 | Hours = 0, 1, 2, 3").figure.lines.length, 2);
ok("grid", board.readBoardVocabulary("grid: 45 | 45 of 100 = 0.45").figure, { kind: "grid", shaded: 45, caption: "45 of 100 = 0.45" });
ok("rate", board.readBoardVocabulary("rate: $4.50 for 3 lb -> $1.50 per 1 lb").figure.blocks.length, 2);
ok("steps", board.readBoardVocabulary("steps: Name it | Show it | Check it").figure.steps.length, 3);
ok("example", board.readBoardVocabulary("example: Estimate first.").figure, { kind: "text", text: "Estimate first." });
ok("an unparseable line is a term, never a broken figure", board.readBoardVocabulary("grid: not a number").figure, null);
ok("prose is left as a term", board.readBoardVocabulary("just a plain term").figure, null);

console.log("the key term the reveal lifts out");
{
  const entries = [{ term: "line", definition: "d" }, { term: "double number line", definition: "d" }];
  ok("longest match wins", board.selectKeyTerm(entries, "model this on a double number line").term, "double number line");
  ok("a plural in the sentence matches a singular term",
    Boolean(board.findPhrase("use ratio tables to find a value", "Ratio table")), true);
  ok("and the other way round",
    Boolean(board.findPhrase("draw a double number line", "double number lines")), true);
  ok("a stem is never matched as a different word", board.findPhrase("the rat ran", "rate"), null);
  ok("an absent term does not match", board.findPhrase("find the product", "unit rate"), null);
  const tokens = board.tokenizeIntention(
    "I am learning to use the greatest common factor",
    board.findPhrase("I am learning to use the greatest common factor", "greatest common factor"),
  );
  ok("the key term stays one token", tokens.filter((t) => t.hit).map((t) => t.text), ["greatest common factor"]);
  ok("action verbs are tagged", tokens.filter((t) => t.verb).map((t) => t.text), ["use"]);
}

console.log("rotation clock");
ok("the learning screen outlasts its own reveal", board.dwellSeconds("learning", 9, true), 16);
ok("and holds the base dwell with nothing to reveal", board.dwellSeconds("learning", 9, false), 9);
ok("other screens hold the base dwell", board.dwellSeconds("week", 9, false), 9);
ok("a longer base still clears the reveal", board.dwellSeconds("learning", 20, true), 26);

console.log("the single criterion always clears room legibility");
// 55-inch panel, ~85px of type readable from the far side of a classroom.
for (const text of ["I can find a GCF.", "x".repeat(90), "x".repeat(200)]) {
  ok(`successSize(${text.length} chars) >= 88`, board.successSize(text) >= 88, true);
}

console.log(`\nPASS - ${checks} weekly-display board checks passed.`);
