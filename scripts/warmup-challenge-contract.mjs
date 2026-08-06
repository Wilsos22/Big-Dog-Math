// Pins the warm-up -> challenge handoff.
//
// The failure this guards is the one this repo keeps re-learning: an authorable
// Notion property whose values the runtime silently ignores. A teacher picks
// "Divisibility Rules" in Notion, nothing resolves, and the student lands
// nowhere - with no error on any surface, because the fallback is deliberately
// to stay put. So the invariant is that EVERY option offered in Notion resolves
// to a real route, and the option list is derived rather than typed.

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, ".tmp-warmup-challenge");

let failures = 0;
function check(label, condition, detail = "") {
  if (condition) return;
  failures += 1;
  console.error(`FAIL  ${label}${detail ? ` - ${detail}` : ""}`);
}

// --ignoreConfig is required (tsconfig.json cannot be loaded alongside named
// files) and it DROPS the `@/` path aliases, so a compile straight from src/
// fails with "Cannot find module '@/lib/challengeSkills'" - a failure that
// looks nothing like its cause. Stage copies with a relative specifier instead
// of forcing the app source to avoid the alias every other file uses.
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
const staged = ["warmupChallenge", "challengeSkills"].map((name) => {
  const dest = path.join(outDir, `${name}.ts`);
  writeFileSync(
    dest,
    readFileSync(path.join(root, `src/lib/${name}.ts`), "utf8")
      // .js extension because the emitted output is run by Node's ESM loader,
      // which does not resolve extensionless specifiers.
      .replace(/from ["']@\/lib\/([A-Za-z0-9_]+)["']/g, 'from "./$1.js"'),
  );
  return dest;
});
execFileSync(
  "npx",
  [
    "tsc", ...staged,
    "--outDir", outDir,
    "--module", "es2022",
    "--target", "es2022",
    "--moduleResolution", "bundler",
    "--skipLibCheck",
    "--ignoreConfig",
  ],
  { cwd: root, stdio: "inherit" },
);

const {
  WARMUP_CHALLENGE_OPTIONS,
  WARMUP_CHALLENGE_DEFAULT_KEY,
  warmupChallengeHref,
  warmupChallengeLabel,
  warmupChallengeDestination,
} = await import(`file://${path.join(outDir, "warmupChallenge.js")}`);
const { SKILLS } = await import(`file://${path.join(outDir, "challengeSkills.js")}`);

// 1. Every drill the engine has is offerable, and nothing else is. A Notion
//    option naming a skill that does not exist is the dead-label failure.
check(
  "one option per skill",
  WARMUP_CHALLENGE_OPTIONS.length === SKILLS.length,
  `${WARMUP_CHALLENGE_OPTIONS.length} options vs ${SKILLS.length} skills`,
);
for (const skill of SKILLS) {
  check(`skill ${skill.key} is offerable`, WARMUP_CHALLENGE_OPTIONS.some((o) => o.key === skill.key));
}

// 2. EVERY option resolves to a non-empty route. This is the whole point.
for (const option of WARMUP_CHALLENGE_OPTIONS) {
  check(`${option.label} resolves`, Boolean(option.href), "empty href");
  check(`${option.label} is a site route`, option.href.startsWith("/"), option.href);
  check(
    `${option.label} round-trips from its Notion label`,
    warmupChallengeHref(option.label) === option.href,
    `got ${warmupChallengeHref(option.label)}`,
  );
}

// 3. Steele's first-few-weeks default goes to the multiplication TOOL, not the
//    generic drill player. If this flips, the default lesson changes silently.
check(
  "multiplication routes to its own tool",
  warmupChallengeHref("Multiplication Facts") === "/multiplication-fluency",
  warmupChallengeHref("Multiplication Facts"),
);

// 4. Matching is punctuation- and case-insensitive, the way propByName reads
//    Notion - a teacher typing the option inline must not miss by a hyphen.
check("case insensitive", warmupChallengeHref("multiplication facts") === "/multiplication-fluency");
check("key also accepted", warmupChallengeHref("multiplication") === "/multiplication-fluency");
check("punctuation ignored", warmupChallengeHref("GCF & LCM") === warmupChallengeHref("GCF and LCM"));
check("hyphen ignored", warmupChallengeHref("gcf-lcm") === warmupChallengeHref("GCF and LCM"));

// 5. The RESOLVER stays pure: anything it cannot match is "". Callers that want
//    a fallback ask for one (check 5b) rather than getting it silently here.
for (const bad of ["", "   ", "Some prose about factors", "???", null, undefined, 42]) {
  check(`unrecognised (${JSON.stringify(bad)}) yields no route`, warmupChallengeHref(bad) === "");
  check(`unrecognised (${JSON.stringify(bad)}) yields no label`, warmupChallengeLabel(bad) === "");
}

// 5b. The DESTINATION is what the landing calls, and it splits two cases the
//     resolver deliberately does not. UNSET means nobody picked - the common
//     case, and the whole reason the handoff sat dead while the Notion property
//     did not exist - so it takes the default. AUTHORED-BUT-UNRESOLVED means
//     somebody picked and it did not take, which is an authoring mistake;
//     defaulting that one would land the class somewhere plausible with nothing
//     anywhere saying the pick was ignored. Collapsing these is the regression.
check(
  "default key names a real option",
  WARMUP_CHALLENGE_OPTIONS.some((option) => option.key === WARMUP_CHALLENGE_DEFAULT_KEY),
  WARMUP_CHALLENGE_DEFAULT_KEY,
);
for (const unset of ["", "   ", null, undefined, 42]) {
  const destination = warmupChallengeDestination(unset);
  check(
    `unset (${JSON.stringify(unset)}) takes the default route`,
    destination.href === "/multiplication-fluency",
    destination.href,
  );
  check(
    `unset (${JSON.stringify(unset)}) takes the default label`,
    destination.label === "Multiplication Facts",
    destination.label,
  );
}
for (const bad of ["Some prose about factors", "???", "Fraction Practice"]) {
  check(
    `authored-but-unresolved (${JSON.stringify(bad)}) still parks the student`,
    warmupChallengeDestination(bad).href === "",
    warmupChallengeDestination(bad).href,
  );
}
check(
  "an authored pick beats the default",
  warmupChallengeDestination("Divisibility Rules").href === "/practice?skill=divisibility",
  warmupChallengeDestination("Divisibility Rules").href,
);

// 5c. Notion REFUSES a comma inside a select option name, and one engine label
//     ("Fraction, Decimal, Percent") has two. So the option as it exists in
//     Notion is not character-identical to the label here, and the only reason
//     that is safe is that normalize() strips punctuation. Pin it: if anyone
//     makes matching stricter, the Notion option silently stops resolving and
//     the class lands on the default with nothing saying the pick was dropped.
for (const option of WARMUP_CHALLENGE_OPTIONS) {
  const notionSafe = option.label.replace(/,/g, "");
  check(
    `${option.label} still resolves without commas (Notion option form)`,
    warmupChallengeHref(notionSafe) === option.href,
    `${notionSafe} -> ${warmupChallengeHref(notionSafe)}`,
  );
}

// 6. The non-tool options go to /practice with the skill named, and that param
//    is what src/app/practice/page.tsx reads. A rename on either side breaks
//    the handoff silently, so pin the shape.
const drill = WARMUP_CHALLENGE_OPTIONS.find((o) => o.key === "gcf-lcm");
check("drill options carry ?skill=", drill?.href === "/practice?skill=gcf-lcm", drill?.href);
const practiceSource = readFileSync(path.join(root, "src/app/practice/page.tsx"), "utf8");
check(
  "/practice reads the skill param",
  practiceSource.includes('.get("skill")'),
  "practice/page.tsx no longer reads ?skill=",
);

// 7. The Notion property is read through propByName, never an exact-string
//    lookup - an exact lookup fails silently and this name has a hyphen in it.
const notionSource = readFileSync(path.join(root, "src/lib/notionLessons.ts"), "utf8");
check(
  "warmupChallenge read via propByName",
  /warmupChallenge:\s*extractText\(propByName\(/.test(notionSource),
  "use propByName so a hyphen mismatch cannot silently return empty",
);

// 8. The value has to actually reach the student surface. /api/today is the
//    only public payload the landing reads.
const publicSource = readFileSync(path.join(root, "src/lib/publicLessonData.ts"), "utf8");
check(
  "warmupChallenge is public on /api/today",
  publicSource.includes('"warmupChallenge"'),
  "the landing cannot see the pick without this",
);

rmSync(outDir, { recursive: true, force: true });

if (failures) {
  console.error(`\nwarmup-challenge contract: ${failures} failure(s)`);
  process.exit(1);
}
console.log("warmup-challenge contract: all checks passed");
