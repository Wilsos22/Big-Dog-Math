// Place a folder of downloaded sound clips into public/sounds/ under the names the bank actually
// reads.
//
// WHY THIS EXISTS. `soundCueFileUrl` builds `/sounds/<id>.mp3`, so THE CUE ID IS THE FILENAME - and
// the files as downloaded are named things like "Jeopardy Theme Song copy 2.mp3" or
// "bruh-sound-effect-_1_.mp3". Renaming twenty-five of those by hand is exactly the kind of task
// that ends with one clip silently on the wrong button. `matchSoundCueFile` already knows how to
// read past capitals, spaces, " copy" and a download site's random suffix, and it is the SAME
// matcher /control uses for a drag-and-drop load - so the button a file lands on here is the button
// it would land on there.
//
// DRY RUN BY DEFAULT. Pass --write to actually copy. Read the mapping first: these files go into a
// git repository, and a wrong guess is a commit, not a mistake you can quietly undo.
//
// Run: npm run sounds:name -- ~/Downloads
//      npm run sounds:name -- ~/Downloads --write

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { readdirSync, statSync, copyFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const require = createRequire(import.meta.url);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const bank = require(path.join(root, ".tmp-mastery", "soundBank.js"));

const args = process.argv.slice(2);
const write = args.includes("--write");
const sourceArg = args.find((a) => !a.startsWith("--")) || path.join(os.homedir(), "Downloads");
const source = sourceArg.startsWith("~") ? path.join(os.homedir(), sourceArg.slice(1)) : sourceArg;
const destination = path.join(root, "public", "sounds");

const AUDIO = /\.(mp3|m4a|wav|aac|ogg|aiff?)$/i;

if (!existsSync(source) || !statSync(source).isDirectory()) {
  console.error(`Not a folder: ${source}`);
  process.exit(1);
}

const files = readdirSync(source).filter((name) => AUDIO.test(name) && !name.startsWith("."));
if (!files.length) {
  console.error(`No audio files in ${source}`);
  process.exit(1);
}

// A file nothing claims is REPORTED, never placed arbitrarily - a clip on the wrong button is worse
// than a clip on no button, because the teacher finds out about it in front of the room.
//
// EXACT BEATS PARTIAL, the same precedence the matcher itself uses. Pointed at a real Stream Deck
// sound board - a hundred-odd clips, not a tidy folder of twenty-five - the partial rule is loose:
// five different files contain "you". So `you.mp3`, whose slug IS the cue id, wins outright and the
// four that merely contain it are not even reported as a conflict.
const hintsFor = (cue) => [cue.id, ...(cue.match ?? [])];
const exactHint = new Map();
for (const cue of bank.SOUND_CUES) for (const hint of hintsFor(cue)) exactHint.set(hint, cue.id);

const claimed = new Map();
const unmatched = [];
const notMp3 = [];

for (const name of files) {
  const id = bank.matchSoundCueFile(name);
  if (!id) {
    unmatched.push(name);
    continue;
  }
  if (!/\.mp3$/i.test(name)) notMp3.push(name);
  if (!claimed.has(id)) claimed.set(id, []);
  const slug = bank.slugFileName(name);
  claimed.get(id).push({
    name,
    slug,
    exact: exactHint.get(slug) === id,
    isCopy: /\bcopy\b|\(\d+\)/i.test(name),
  });
}

// Collapse each cue's candidates down to a single winner where the answer is unambiguous. Three
// tiebreakers, in order, each mirroring how the matcher itself decides:
//   1. An exact slug beats a partial one.
//   2. A slug equal to the CUE ID beats one equal to a `match` alias - the same order
//      matchSoundCueFile checks its hints in.
//   3. The original beats its own " copy" / "(1)" duplicate.
// Anything still tied is a real ambiguity and gets reported rather than guessed at.
for (const [id, candidates] of claimed) {
  let pool = candidates;
  const exact = pool.filter((c) => c.exact);
  if (exact.length) pool = exact;
  const byId = pool.filter((c) => c.slug === id);
  if (byId.length) pool = byId;
  const originals = pool.filter((c) => !c.isCopy);
  if (originals.length) pool = originals;
  claimed.set(id, pool);
}

console.log(`\nSource:      ${source}`);
console.log(`Destination: ${destination}`);
console.log(write ? "Mode:        WRITE\n" : "Mode:        dry run - pass --write to copy\n");

const collisions = [];
let copied = 0;

for (const cue of bank.SOUND_CUES) {
  const matches = claimed.get(cue.id);
  if (!matches) continue;
  if (matches.length > 1) {
    collisions.push({ id: cue.id, matches: matches.map((m) => m.name) });
    console.log(`  ??  ${cue.id.padEnd(22)} ${matches.length} files claim this cue - skipped`);
    continue;
  }
  const from = matches[0].name;
  console.log(`  ${matches[0].exact ? "ok" : "~ "}  ${cue.id.padEnd(22)} ${from}`);
  if (write && /\.mp3$/i.test(from)) {
    mkdirSync(destination, { recursive: true });
    copyFileSync(path.join(source, from), path.join(destination, `${cue.id}.mp3`));
    copied += 1;
  }
}

const missing = bank.SOUND_CUES.filter((cue) => !claimed.has(cue.id)).map((cue) => cue.id);

if (unmatched.length) {
  // Pointed at a whole sound board most files are simply not bank cues, so this list is noise
  // rather than a problem. Count it; only name them when there are few enough to act on.
  console.log(`\nNo cue claimed ${unmatched.length} file${unmatched.length === 1 ? "" : "s"}.`);
  if (unmatched.length <= 12) {
    for (const name of unmatched) console.log(`  --  ${name}`);
    console.log("  Rename toward the cue id, or add a `match` hint in src/lib/soundBank.ts.");
  }
}

if (collisions.length) {
  console.log("\nMore than one file claims the same cue. Remove the duplicate and re-run:");
  for (const { id, matches } of collisions) console.log(`  ${id}: ${matches.join(" | ")}`);
}

if (notMp3.length) {
  // soundCueFileUrl is hardcoded to .mp3 - a .wav sitting in the folder is a button that stays
  // synthesized and gives no clue why.
  console.log(`\nNot mp3, so the bank will never read them (${notMp3.length}). Convert first:`);
  for (const name of notMp3) {
    const id = bank.matchSoundCueFile(name);
    console.log(`  ffmpeg -i "${path.join(source, name)}" "${path.join(destination, `${id}.mp3`)}"`);
  }
}

if (missing.length) {
  console.log(`\nStill has no clip (${missing.length}) - these stay synthesized, which is fine:`);
  console.log(`  ${missing.join(", ")}`);
}

console.log(
  write
    ? `\n${copied} copied. Commit public/sounds, push, and reload the classroom displays.`
    : "\nNothing written. Re-run with --write once the mapping above reads right.",
);
