// FERPA boundary contract.
//
// The rule under test (src/lib/pseudonym.ts): student names, district emails,
// and every piece of re-identification key material exist ONLY in the district
// Google Workspace and the teacher's own browser. The site's data layer holds
// aliases and one-way email HMACs, and its ingest routes REFUSE identified
// payloads. This contract pins both halves: the validation behavior (compiled
// from the real pseudonym.ts) and the code-shape rules that keep identity from
// creeping back into src/ or the Apps Script bridge.
//
// Run: npm run test:ferpa-boundary (compiles src/lib/pseudonym.ts first).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const {
  isEmailHmac,
  isStudentAlias,
  looksIdentified,
  assertPseudonymousRoster,
} = require(path.join(root, ".tmp-mastery/pseudonym.js"));

let checks = 0;
function ok(condition, message) {
  checks += 1;
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

// --- 1. Validation behavior -------------------------------------------------

ok(isEmailHmac("a".repeat(64).replace(/a/g, "0") /* 64 zeros */), "64-hex hmac accepted");
ok(isEmailHmac("0123456789abcdef".repeat(4)), "lowercase hex hmac accepted");
ok(!isEmailHmac("0123456789ABCDEF".repeat(4)), "uppercase hex rejected (canonical form is lowercase)");
ok(!isEmailHmac("kid@school.example"), "email rejected as hmac");
ok(!isEmailHmac("0".repeat(63)), "63-char hex rejected");

ok(isStudentAlias("Amber Fox"), "two-word alias accepted");
ok(isStudentAlias("Steady Otter 2"), "collision-suffixed alias accepted");
ok(!isStudentAlias("kid@school.example"), "email rejected as alias");
ok(!isStudentAlias("Last, First"), "comma name format rejected as alias");
ok(!isStudentAlias("A".repeat(41)), "over-length alias rejected");
ok(!isStudentAlias(""), "empty alias rejected");

ok(looksIdentified("kid@school.example"), "email flagged as identified");
ok(!looksIdentified("Amber Fox"), "alias not flagged as identified");
ok(!looksIdentified("0123456789abcdef".repeat(4)), "hmac not flagged as identified");

const goodRoster = [{ alias: "Amber Fox", emailHmac: "ab".repeat(32), period: "Period 1" }];
ok(assertPseudonymousRoster(goodRoster).length === 1, "valid pseudonymous roster accepted");

function rejects(payload, needle, label) {
  checks += 1;
  try {
    assertPseudonymousRoster(payload);
  } catch (error) {
    if (String(error.message).toLowerCase().includes(needle)) return;
    console.error(`FAIL: ${label} - threw but without "${needle}": ${error.message}`);
    process.exit(1);
  }
  console.error(`FAIL: ${label} - identified payload was accepted`);
  process.exit(1);
}

rejects([{ alias: "Amber Fox", emailHmac: "kid@school.example", period: "P1" }], "hmac", "raw email in emailHmac rejected");
rejects([{ alias: "kid@school.example", emailHmac: null, period: "P1" }], "identity", "email-shaped alias rejected");
rejects([{ alias: "Amber Fox", emailHmac: "ab".repeat(32), period: "kid@school.example" }], "email", "email-shaped period rejected");
rejects([], "non-empty", "empty payload rejected");

// --- 2. Code-shape rules ----------------------------------------------------

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const srcFiles = walk(path.join(root, "src"));
const offenders = (pattern, allow = () => false) =>
  srcFiles.filter((file) => pattern.test(fs.readFileSync(file, "utf8")) && !allow(file));

// The students table has no name column; no code may reference one.
ok(offenders(/full_name/).length === 0,
  `"full_name" must not appear in src/ (found in: ${offenders(/full_name/).map((f) => path.relative(root, f)).join(", ")})`);

// The Notion student-data modules are deleted; nothing may resurrect them.
ok(offenders(/notionRoster|notionIReady|notionSubmissions|notionOutreach|fetchNotionRoster|getWeeklySummaries/).length === 0,
  "deleted Notion student-data modules must not be referenced in src/");

// Students never sign in to the site with a provider - that would put
// district emails into Supabase Auth.
ok(offenders(/signInWithOAuth/).length === 0, "signInWithOAuth must not appear in src/");

// The teacher name key is browser-only; no server route may import it.
ok(offenders(/teacherNameKey/, (file) => !file.includes(`${path.sep}api${path.sep}`)).length === 0
  || offenders(/teacherNameKey/).every((file) => !file.includes(`${path.sep}api${path.sep}`)),
  "src/app/api must never import teacherNameKey (names stay in the browser)");

// Ingest routes must carry their raw-identity refusal.
const evidence = fs.readFileSync(path.join(root, "src/app/api/evidence/route.ts"), "utf8");
ok(evidence.includes("raw_email_rejected") && evidence.includes("email_hmac"),
  "evidence route must refuse raw emails and resolve by email_hmac");
const verify = fs.readFileSync(path.join(root, "src/app/api/student/warmup-verify/route.ts"), "utf8");
ok(verify.includes("raw_email_rejected") && verify.includes("email_hmac"),
  "warmup-verify must refuse raw emails and match by email_hmac");
const rosterSync = fs.readFileSync(path.join(root, "src/app/api/roster/sync/route.ts"), "utf8");
ok(rosterSync.includes("assertPseudonymousRoster") && !/notion/i.test(rosterSync.replace(/Notion pull \(and the Vercel|student data may not exist in Notion|from Notion through this GET/g, "")),
  "roster sync must validate pseudonymous pushes and carry no Notion read");
const checkpointUpload = fs.readFileSync(path.join(root, "src/app/api/checkpoints/upload/route.ts"), "utf8");
ok(checkpointUpload.includes("identified_csv_rejected"), "checkpoint upload must refuse email-bearing CSVs");

// The Apps Script bridge sends HMACs, never the email.
const evidenceGs = fs.readFileSync(path.join(root, "warmup-evidence.gs"), "utf8");
ok(evidenceGs.includes("bdmEmailHmac_") && evidenceGs.includes("studentEmailHmac"),
  "warmup-evidence.gs must compute and send the email HMAC");
ok(!/payload: JSON\.stringify\(\{ email:/.test(evidenceGs) && !/studentEmail: email/.test(evidenceGs),
  "warmup-evidence.gs must not put raw emails on the wire");
const rosterGs = fs.readFileSync(path.join(root, "warmup-roster-push.gs"), "utf8");
ok(rosterGs.includes("emailHmac") && rosterGs.includes("BDM_ROSTER_HMAC_KEY"),
  "warmup-roster-push.gs must push HMACs keyed by BDM_ROSTER_HMAC_KEY");

// The HMAC key exists only in Workspace Script Properties - never in Vercel
// env reads, so the site can never learn to compute the hashes.
ok(offenders(/ROSTER_HMAC_KEY/).length === 0,
  "the HMAC key name must not appear in src/ (the site must be unable to compute hashes)");

// The Vercel cron that pulled the Notion roster is gone.
const vercelJson = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
ok(!(vercelJson.crons || []).some((cron) => cron.path === "/api/roster/sync"),
  "vercel.json must not cron the roster sync (roster is pushed from Workspace)");

console.log(`PASS - ${checks} FERPA boundary checks: the site holds aliases and one-way hashes only, refuses identified payloads, and cannot compute or reverse the hashes.`);
