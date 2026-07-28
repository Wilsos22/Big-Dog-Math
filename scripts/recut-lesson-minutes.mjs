#!/usr/bin/env node
/**
 * recut-lesson-minutes.mjs
 *
 * Bulk maintenance for Big Dog Math lesson timings.
 *
 * Reads every lesson in a date range, reads its Lesson Steps, applies any
 * duration overrides you specify, recomputes every Start Minute from scratch
 * as a running total, and refuses to write unless the lesson lands exactly on
 * the target period length with no gaps or overlaps.
 *
 * You decide the durations. The script does the arithmetic and guarantees
 * contiguity. That split is the whole point - deciding which five minutes to
 * cut is judgment, summing them is not.
 *
 * It also prints each lesson's Publish Workflow value, because it queries by
 * DATE (not publish status) - so a lesson that mysteriously is not showing on
 * the site gets its status printed here in plain text.
 *
 * USAGE (from the repo root)
 *   node scripts/recut-lesson-minutes.mjs                 # dry run, prints the plan
 *   node scripts/recut-lesson-minutes.mjs --write         # applies it
 *   node scripts/recut-lesson-minutes.mjs --verify-only   # just report what does not add up
 *
 * TOKEN
 *   Put NOTION_TOKEN=... in .env.local at the repo root (gitignored) - the
 *   script loads it on its own. Exported NOTION_TOKEN / NOTION_API_KEY /
 *   NOTION_SECRET also work. Never commit or paste the token anywhere.
 *
 * Implementation notes vs the original draft:
 *   - Steps are read by following each lesson page's "Lesson Steps" relation,
 *     exactly like src/lib/notionLessons.ts does, instead of querying the
 *     steps database by a relation filter - no dependence on the steps-side
 *     relation property name.
 *   - SKIP entries match by prefix, so "M1.T1.L3" also covers "M1.T1.L3-D1".
 *   - The lessons data source id matches the site's DATA_SOURCE_IDS (the one
 *     real source; the other two ids that used to be listed were ghosts).
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// ---------------------------------------------------------------- CONFIG

const TARGET_MINUTES = 50;

const DATE_FROM = "2026-08-10";
const DATE_TO   = "2026-08-21";

/** Lessons to leave completely alone (prefix match on Lesson Code). */
const SKIP = [
  "M1.T1.L3",      // Needs Mapping - recut as part of the rebuild, not twice
  "M1.T1.C4",      // library logistics unresolved
];

/**
 * Duration overrides, per lesson code.
 * Key is the step Order. Value is the new Duration in minutes.
 * Everything not listed keeps its current duration.
 *
 * Leave a lesson out entirely and the script will try AUTO mode on it
 * (see RELEASE_STATES below).
 */
const OVERRIDES = {
  "M1.T1.L1-D1": { 13: 9 },   // individual work stations 14 -> 9
};

/**
 * AUTO mode: for a lesson with no explicit overrides, take the whole
 * difference out of the longest step whose State ID is one of these.
 * If that step cannot absorb it without dropping below MIN_RELEASE, the
 * script reports the lesson and skips it rather than guessing.
 */
const RELEASE_STATES = new Set(["small-group", "independent"]);
const MIN_RELEASE = 5;

// ---------------------------------------------------------------- SETUP

// The Math 6 Lessons database's one real data source (matches
// src/lib/notionLessons.ts DATA_SOURCE_IDS - keep in lockstep).
const LESSONS_DS = "e367e541-c0c7-4613-8066-d2e61b6fee64";

// Load .env.local from the repo root so the token "just works" locally.
try {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const env = readFileSync(join(root, ".env.local"), "utf8");
  for (const line of env.split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
} catch { /* no .env.local - exported env vars still work */ }

const TOKEN =
  process.env.NOTION_TOKEN ||
  process.env.NOTION_API_KEY ||
  process.env.NOTION_SECRET;

if (!TOKEN) {
  console.error(
    "No Notion token found.\n" +
    "Add a line to .env.local at the repo root:\n\n" +
    "  NOTION_TOKEN=secret_...\n\n" +
    "(.env.local is gitignored - the token never leaves this machine.)"
  );
  process.exit(1);
}

const WRITE = process.argv.includes("--write");
const VERIFY_ONLY = process.argv.includes("--verify-only");

const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  "Notion-Version": "2025-09-03",
  "Content-Type": "application/json",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function notion(path, options = {}) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`https://api.notion.com/v1${path}`, {
      ...options,
      headers: HEADERS,
    });
    if (res.status === 429 || res.status >= 500) {
      const wait = Number(res.headers.get("retry-after") || 2) * 1000;
      await sleep(wait);
      continue;
    }
    const body = await res.json();
    if (!res.ok) {
      throw new Error(`${res.status} ${path}: ${body.message || JSON.stringify(body)}`);
    }
    return body;
  }
  throw new Error(`Gave up after retries: ${path}`);
}

async function queryAll(dataSourceId, body) {
  const out = [];
  let cursor;
  do {
    const page = await notion(`/data_sources/${dataSourceId}/query`, {
      method: "POST",
      body: JSON.stringify({ ...body, page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }),
    });
    out.push(...page.results);
    cursor = page.has_more ? page.next_cursor : undefined;
    await sleep(300); // stay well under the rate limit
  } while (cursor);
  return out;
}

const num = (page, prop) => page.properties?.[prop]?.number ?? null;
const richText = (page, prop) =>
  (page.properties?.[prop]?.rich_text || []).map((t) => t.plain_text).join("");
const selectVal = (page, prop) => page.properties?.[prop]?.select?.name ?? null;
// The title property regardless of its name (lessons use "Lesson", steps use
// their own - this stays correct if either is ever renamed).
const anyTitle = (page) => {
  for (const prop of Object.values(page.properties || {})) {
    if (prop?.type === "title") return (prop.title || []).map((t) => t.plain_text).join("");
  }
  return "";
};

// ---------------------------------------------------------------- MAIN

async function main() {
  console.log(
    `\nTarget ${TARGET_MINUTES} minutes | ${DATE_FROM} to ${DATE_TO} | ` +
      (VERIFY_ONLY ? "VERIFY ONLY" : WRITE ? "WRITE" : "DRY RUN") +
      "\n"
  );

  const lessons = await queryAll(LESSONS_DS, {
    filter: {
      and: [
        { property: "Date", date: { on_or_after: DATE_FROM } },
        { property: "Date", date: { on_or_before: DATE_TO } },
      ],
    },
    sorts: [{ property: "Date", direction: "ascending" }],
  });

  let clean = 0;
  const problems = [];
  const pending = [];
  const unpublished = [];

  for (const lesson of lessons) {
    if (lesson.archived || lesson.in_trash) continue;
    const code = richText(lesson, "Lesson Code") || anyTitle(lesson);
    const date = lesson.properties?.["Date"]?.date?.start || "?";
    const workflow = selectVal(lesson, "Publish Workflow") || "(no value)";
    if (workflow !== "Published") unpublished.push(`${date}  ${code}  Publish Workflow = ${workflow}`);

    if (SKIP.some((prefix) => code.startsWith(prefix))) {
      console.log(`SKIP  ${code}  (in SKIP list)`);
      continue;
    }

    // Steps via the lesson page's own relation - the same path the site reads.
    const stepRelation = lesson.properties?.["Lesson Steps"]?.relation ?? [];
    if (!stepRelation.length) {
      problems.push(`${code}: no Lesson Steps relation entries`);
      continue;
    }
    const steps = [];
    for (const { id } of stepRelation) {
      steps.push(await notion(`/pages/${encodeURIComponent(id)}`));
      await sleep(250);
    }

    const rows = steps
      .map((s) => ({
        id: s.id,
        order: num(s, "Order"),
        startWas: num(s, "Start Minute"),
        durWas: num(s, "Duration") ?? 0,
        state: richText(s, "State ID") || selectVal(s, "State ID"),
        name: anyTitle(s),
      }))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const currentTotal = rows.reduce((a, r) => a + r.durWas, 0);

    // --- decide new durations
    const overrides = OVERRIDES[code];
    const newDur = new Map(rows.map((r) => [r.order, r.durWas]));

    if (overrides) {
      for (const [order, d] of Object.entries(overrides)) {
        newDur.set(Number(order), Number(d));
      }
    } else if (currentTotal !== TARGET_MINUTES) {
      // AUTO: take the whole difference from the longest release-type step
      const diff = currentTotal - TARGET_MINUTES;
      const candidates = rows
        .filter((r) => RELEASE_STATES.has(r.state))
        .sort((a, b) => b.durWas - a.durWas);
      const target = candidates[0];
      if (!target || target.durWas - diff < MIN_RELEASE) {
        problems.push(
          `${code}: sums to ${currentTotal}, needs ${diff > 0 ? "-" : "+"}${Math.abs(diff)}, ` +
            `no release step can absorb it. Add an entry to OVERRIDES.`
        );
        continue;
      }
      newDur.set(target.order, target.durWas - diff);
    }

    // --- recompute every start minute from zero
    let cursor = 0;
    const plan = rows.map((r) => {
      const d = newDur.get(r.order);
      const row = { ...r, startNew: cursor, durNew: d };
      cursor += d;
      return row;
    });
    const newTotal = cursor;

    if (newTotal !== TARGET_MINUTES) {
      problems.push(
        `${code}: plan sums to ${newTotal}, not ${TARGET_MINUTES}. Not written.`
      );
      continue;
    }

    const changed = plan.filter(
      (r) => r.startNew !== r.startWas || r.durNew !== r.durWas
    );

    if (!changed.length) {
      console.log(`OK    ${code}  already ${TARGET_MINUTES}, nothing to change`);
      clean++;
      continue;
    }

    console.log(`\n${code}  ${currentTotal} -> ${newTotal}   (${changed.length} steps change)`);
    for (const r of changed) {
      const durNote = r.durNew !== r.durWas ? `  dur ${r.durWas} -> ${r.durNew}` : "";
      console.log(
        `   ${String(r.order).padStart(2)}. ${r.name.slice(0, 46).padEnd(46)} ` +
          `start ${String(r.startWas ?? "?").padStart(2)} -> ${String(r.startNew).padStart(2)}${durNote}`
      );
    }

    pending.push({ code, changed });
  }

  // --- write
  if (WRITE && !VERIFY_ONLY) {
    console.log("\nWriting...");
    for (const { code, changed } of pending) {
      for (const r of changed) {
        await notion(`/pages/${r.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            properties: {
              "Start Minute": { number: r.startNew },
              Duration: { number: r.durNew },
            },
          }),
        });
        await sleep(300);
      }
      console.log(`  wrote ${code} (${changed.length} steps)`);
    }
  }

  // --- report
  console.log("\n" + "-".repeat(60));
  console.log(`${clean} lesson(s) already correct`);
  console.log(`${pending.length} lesson(s) ${WRITE && !VERIFY_ONLY ? "written" : "would change"}`);
  if (unpublished.length) {
    console.log(`\n${unpublished.length} lesson(s) in the date range are NOT marked Published`);
    console.log(`(this is why a lesson can look fine in Notion but skip the site):`);
    for (const u of unpublished) console.log(`  - ${u}`);
  }
  if (problems.length) {
    console.log(`\n${problems.length} need a decision from you:`);
    for (const p of problems) console.log(`  - ${p}`);
  }
  if (!WRITE && !VERIFY_ONLY && pending.length) {
    console.log("\nDry run. Re-run with --write to apply.");
  }
  console.log("");
}

main().catch((e) => {
  console.error("\nFailed:", e.message);
  process.exit(1);
});
