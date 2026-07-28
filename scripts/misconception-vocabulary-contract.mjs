// Contract: the misconception vocabulary cannot drift, and no new emitter can
// ship a tag that clusters into nothing.
//
// WHY THIS EXISTS. Clustering is EXACT STRING MATCH against a finite seeded
// vocabulary. A tag with no matching row does not error anywhere - it silently
// loses its domain (i-Ready corroboration in /api/live/groups goes to zero) and
// any teacher move authored against it renders blank. The cluster still shows
// up, just uncorroborated and unplanned, so nothing ever reports the miss.
//
// The lesson's Notion Misconception Plans used five hyphenated tags
// (changes-the-whole, distributes-to-one-addend, ...) that matched nothing, and
// every prepared move rendered blank for weeks. This contract checks the half
// that is checkable offline - the tags written in src/. The Notion half needs a
// token and is NOT claimed here.
//
// Run: npm run test:misconceptions

import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SEED_FILE = "supabase/proficiency.sql";
const VOCAB_FILE = "src/lib/misconceptions.ts";

/**
 * Emitter tags that predate this contract and match nothing.
 *
 * Renaming them is a CURRICULUM VOCABULARY decision - these labels are the
 * words Steele groups students by - so they are named here rather than
 * invented. This list must only ever SHRINK: any NEW unseeded tag fails.
 *
 * `src/components/AreaExplorer.tsx` is the live one that matters. It is one of
 * the seven tools that actually emit evidence, and all five of its tags are
 * hyphenated, so every /area-explorer miss has been clustering into a
 * singleton with no domain and no teacher move.
 *
 * `src/lib/sbacCheckpoints.ts` is a different shape: its `misconception`
 * values read as free-text notes, matching the `responses.misconception`
 * column comment ("short note on the misunderstanding") rather than the finite
 * vocabulary. They still reach clustering through /api/student/checkpoint.
 */
const KNOWN_UNMATCHED = {
  "src/components/AreaExplorer.tsx": [
    "compute-error",
    "cubed-unit",
    "linear-unit",
    "slant-for-height",
    "swapped-dims",
  ],
};

/** Free-text checkpoint notes, deliberately outside the finite vocabulary. */
const PROSE_NOTE_FILES = new Set(["src/lib/sbacCheckpoints.ts"]);

function seededLabels() {
  const sql = readFileSync(SEED_FILE, "utf8");
  const start = sql.indexOf("insert into misconceptions");
  assert.ok(start >= 0, `${SEED_FILE} no longer seeds misconceptions - update this contract.`);
  const end = sql.indexOf("on conflict", start);
  assert.ok(end > start, "the misconceptions insert has no on conflict terminator.");
  return [...sql.slice(start, end).matchAll(/\(\s*'((?:[^']|'')+)'/g)]
    .map((match) => match[1].replace(/''/g, "'"));
}

function typedTags() {
  const source = readFileSync(VOCAB_FILE, "utf8");
  const start = source.indexOf("MISCONCEPTION_TAGS = [");
  assert.ok(start >= 0, `${VOCAB_FILE} no longer exports MISCONCEPTION_TAGS.`);
  const end = source.indexOf("] as const", start);
  return [...source.slice(start, end).matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

function sourceFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...sourceFiles(path));
    else if (/\.(ts|tsx)$/.test(entry)) found.push(path);
  }
  return found;
}

/**
 * Tags written anywhere in src/, by file.
 *
 * Covers both spellings an emitter uses: an object property
 * (`misconception: "..."`) and the tool helpers that take the tag positionally
 * (`flagWrong("...")`, `missTagRef.current = "..."`). Missing the second form
 * is how AreaExplorer's five stayed invisible.
 */
function referencedTags() {
  const byFile = new Map();
  const patterns = [
    /misconception:\s*"([^"]+)"/g,
    /flagWrong\(\s*"([^"]+)"/g,
    /missTagRef\.current\s*=\s*"([^"]+)"/g,
  ];
  for (const file of sourceFiles("src")) {
    if (file.split("/").pop() === "misconceptions.ts") continue;
    const source = readFileSync(file, "utf8");
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) {
        const key = file.replaceAll("\\", "/");
        if (!byFile.has(key)) byFile.set(key, new Set());
        byFile.get(key).add(match[1]);
      }
    }
  }
  return byFile;
}

console.log("misconception vocabulary contract");

// 1. The TypeScript vocabulary and the SQL seed must be the same list.
//    This is the drift guard that makes typing an emitter's tag meaningful.
const seeded = seededLabels();
const typed = typedTags();
assert.ok(seeded.length >= 14, `expected the seeded vocabulary, found ${seeded.length} labels.`);
assert.deepEqual(
  [...typed].sort(),
  [...seeded].sort(),
  `${VOCAB_FILE} and ${SEED_FILE} disagree. Adding a tag means editing BOTH, and running the SQL.`,
);
console.log(`  ok  the typed vocabulary matches the SQL seed exactly (${seeded.length} tags)`);

// 2. The tags the distributive diagnosis emits must exist, or the whole
//    structured-numeric teacher move renders blank.
const seededSet = new Set(seeded);
for (const required of ["changes the whole", "distributes to first term only"]) {
  assert.ok(seededSet.has(required), `"${required}" must be seeded - the distributive diagnosis emits it.`);
}
console.log("  ok  the distributive tags the diagnosis emits are seeded");

// 3. No NEW emitter may ship a tag that matches nothing.
const referenced = referencedTags();
assert.ok(referenced.size > 0, "found no misconception literals - the scanner is broken, not the code.");
const unexpected = [];
for (const [file, tags] of referenced) {
  if (PROSE_NOTE_FILES.has(file)) continue;
  const allowed = new Set(KNOWN_UNMATCHED[file] || []);
  for (const tag of tags) {
    if (!seededSet.has(tag) && !allowed.has(tag)) unexpected.push(`  "${tag}"  (${file})`);
  }
}
if (unexpected.length) {
  throw new Error(
    "These misconception tags match no seeded row, so they cluster into nothing "
    + "and no authored teacher move will ever find them:\n"
    + unexpected.join("\n")
    + `\n\nSeed the tag in ${SEED_FILE} AND ${VOCAB_FILE} in the same change, or use an existing label.`,
  );
}
console.log("  ok  no new emitter tag clusters into nothing");

// 4. The backlog must shrink, never rot. A stale entry would quietly re-open
//    the hole it documents.
const stale = [];
for (const [file, tags] of Object.entries(KNOWN_UNMATCHED)) {
  const present = referenced.get(file) || new Set();
  for (const tag of tags) {
    if (seededSet.has(tag) || !present.has(tag)) stale.push(`${tag} (${file})`);
  }
}
assert.equal(stale.length, 0, `KNOWN_UNMATCHED is stale - remove: ${stale.join(", ")}`);

const backlog = Object.values(KNOWN_UNMATCHED).reduce((count, tags) => count + tags.length, 0);
console.log(`  ok  the unmatched backlog is accurate (${backlog} awaiting a vocabulary decision)`);

console.log("\nPASS - the vocabulary cannot drift and no new tag can cluster into nothing.");
