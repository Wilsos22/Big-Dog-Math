// CCSD data-privacy verification: re-states four existing contracts in the
// district's policy vocabulary so the answer to "is this safe for my students"
// is one command.
//
// SCOPE, stated honestly: this checks the CODE. It cannot speak to whether a
// teacher-operated Supabase and Vercel instance holding real names and district
// emails is permitted by CCSD in the first place - that is a district
// determination (a DPA, or naming the vendor a school official in the annual
// FERPA notification), not something a script can assert. Do not read 4/4 as an
// answer to that question.

import { execSync } from 'child_process';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

// Every external AI endpoint this project has ever spoken to. Matched against
// the SOURCE. The original check read process.env.ANTHROPIC_API_KEY, which is
// unset on any laptop and set on Vercel - so it passed on the machine where it
// could not matter and was never evaluated where it could. A check that cannot
// go red is not a check.
const AI_ENDPOINTS = ['api.anthropic.com', 'api.elevenlabs.io', 'api.openai.com'];

// The one reviewed caller. /api/live/next-move sends studentCount and archetype
// labels only - never a name, never student work. Adding a path here is a
// privacy decision that needs a human, not a maintenance chore.
const REVIEWED_AI_CALLERS = ['src/app/api/live/next-move/route.ts'];

// Fields that would carry a real student into an outbound request.
const PII_FIELDS = ['display_name', 'full_name', 'work_snapshot', 'explanation'];

function sourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (/\.(ts|tsx|js|mjs)$/.test(entry)) out.push(path);
  }
  return out;
}

const requirements = [
  {
    code: 'CCSD-AUP-01',
    name: 'No student PII reaches an external AI service',
    check: () => {
      const callers = sourceFiles('src')
        .filter((file) => {
          const source = readFileSync(file, 'utf8');
          return AI_ENDPOINTS.some((host) => source.includes(host));
        })
        .sort();

      const unreviewed = callers.filter((file) => !REVIEWED_AI_CALLERS.includes(file));
      if (unreviewed.length) {
        throw new Error(`unreviewed outbound AI call in ${unreviewed.join(', ')}`);
      }

      for (const caller of callers) {
        const source = readFileSync(caller, 'utf8');
        const leaked = PII_FIELDS.filter((field) => source.includes(field));
        if (leaked.length) {
          throw new Error(`${caller} references ${leaked.join(', ')}`);
        }
      }
      return true;
    },
  },
  {
    code: 'CCSD-P5125-01',
    name: 'Live Flow Payload Isolation (No Teacher Notes/Answers sent to Students)',
    check: () => {
      execSync('node scripts/live-flow-privacy-contract.mjs');
      return true;
    },
  },
  {
    code: 'CCSD-P5125-02',
    name: 'Exact Student Email Matching (No Wildcard Roster Enumeration)',
    check: () => {
      execSync('node scripts/student-warmup-home-contract.mjs');
      return true;
    },
  },
  {
    code: 'CCSD-R5125.1-01',
    name: 'Routine Config Isolation (Teacher Pull Lists Pruned from Public Views)',
    check: () => {
      execSync('node scripts/lesson-routine-config-contract.mjs');
      return true;
    },
  },
];

console.log('\n======================================================');
console.log('   CCSD DATA PRIVACY & COMPLIANCE VERIFICATION');
console.log('======================================================\n');

let totalPassed = 0;

for (const req of requirements) {
  let passed = false;
  let detail = '';
  try {
    passed = req.check();
  } catch (err) {
    passed = false;
    // Say WHY. A bare [NO] on a privacy check sends you reading four contracts
    // to find out which one moved.
    detail = err && err.message ? `\n        ${err.message.split('\n')[0]}` : '';
  }

  const status = passed ? '\x1b[32m[YES]\x1b[0m' : '\x1b[31m[NO]\x1b[0m ';
  console.log(`${status} ${req.code}: ${req.name}${detail}`);
  if (passed) totalPassed++;
}

console.log('\n------------------------------------------------------');
console.log(` Compliance Status: ${totalPassed}/${requirements.length} Requirements Satisfied`);
console.log(' Code only. Says nothing about whether CCSD permits student');
console.log(' names and district emails in a teacher-run Supabase project.');
console.log('======================================================\n');

if (totalPassed !== requirements.length) {
  process.exit(1);
}
