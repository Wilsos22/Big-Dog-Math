import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The auth gate (src/proxy.ts) has two hand-maintained lists that MUST agree:
// PROTECTED_PREFIXES decides policy, config.matcher decides whether the
// middleware even runs. A prefix present in policy but absent from the
// matcher is silently UNAUTHENTICATED - fail-open. Next's ":path*" matches
// zero or more segments (verified against production 2026-07-27: bare
// /api/form-responses 401s with only its "/:path*" entry), so one
// "<prefix>/:path*" entry per prefix is full coverage.

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = fs.readFileSync(path.join(root, "src/proxy.ts"), "utf8");

function extractStrings(anchor) {
  const start = src.indexOf(anchor);
  if (start < 0) throw new Error(`proxy.ts anchor missing: ${anchor}`);
  const end = src.indexOf("]", start);
  const slice = src.slice(start, end);
  return [...slice.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

const prefixes = extractStrings("const PROTECTED_PREFIXES = [");
const rollout = extractStrings("const SECURE_ROLLOUT_PREFIXES = [");
const matcher = extractStrings("matcher: [");

if (prefixes.length < 18 || rollout.length < 2 || matcher.length < prefixes.length) {
  throw new Error("proxy.ts parse looks wrong - the gate contract itself needs updating.");
}

for (const prefix of [...prefixes, ...rollout]) {
  if (!matcher.includes(`${prefix}/:path*`)) {
    throw new Error(
      `FAIL-OPEN: "${prefix}" is in the policy list but has no "${prefix}/:path*" matcher entry - the middleware will never run for it. Add it to config.matcher in src/proxy.ts.`,
    );
  }
}

console.log(`PASS - all ${prefixes.length + rollout.length} protected prefixes have matcher coverage; the auth gate cannot drift fail-open.`);
