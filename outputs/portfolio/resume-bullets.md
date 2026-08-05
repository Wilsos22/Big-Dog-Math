# Resume bullets - every number traceable

Delete the "source:" lines when pasting into a real resume. Voice: past
tense, verb-first, quantified. Pick 5-7 per application; do not use all ten.

1. Designed, built, and operate a classroom operating system (Next.js /
   TypeScript / Supabase / Vercel) used daily in my own 6th-grade math
   classroom: 87 routes, 67 API endpoints, and 24 no-login math
   manipulatives across ~70,000 lines of strict-mode TypeScript.
   source: code-shape agent measurement 2026-07-27 (70,778 LOC, 288 files,
   87 page.tsx, 67 route.ts); tool count from /explore grid + CLAUDE.md.

2. Shipped a four-surface realtime classroom: student Chromebooks, two
   projector displays, and a teacher iPad follow one live lesson state
   machine, with an iPad-to-projector ink protocol (14-message typed wire
   format, resolution-independent coordinates, automatic reconnect resync).
   source: src/lib/inkSync.ts (14-arm InkMessage union); liveClassFlow
   architecture per CLAUDE.md.

3. Cut per-device network load 5x for classroom scale by replacing four
   independent pollers with a single-flight read-through cache - measured
   1.5 to 0.27 requests/second per student device.
   source: ROADMAP.md launch-batch entry 7/27; measured live in-session.

4. Built a mastery engine (per-domain EWMA, per-standard stage gates,
   exact-match misconception clustering) and pinned the TypeScript port
   against a Python oracle with golden-file tests: 25 students x 1,441
   events x 4 domains verified to 1e-6.
   source: scripts/mastery-golden.mjs, scripts/grouping-golden.mjs (agent
   read 7/27); engine spec in CLAUDE.md proficiency spine.

5. Enforced a student privacy boundary in code: a dedicated redaction module
   with its own contract test guarantees correct answers and teacher notes
   can never reach a student device, even under feature-flag changes.
   source: src/lib/liveFlowPrivacy.ts + scripts/live-flow-privacy-contract.mjs.

6. Locked down production data access with Postgres row-level security:
   removed permissive prototype policies, moved every student read/write
   behind authenticated API routes, and verified the posture from outside
   (anonymous probes rejected on all protected tables).
   source: supabase/student-data-security.sql; live verification 2026-07-21
   recorded in CLAUDE.md.

7. Built an idempotent evidence-ingest pipeline (Google Forms -> Apps Script
   -> API -> Postgres) with dedupe keys and named drop reasons, feeding live
   misconception grouping the teacher uses mid-lesson.
   source: src/app/api/evidence/route.ts (dedupe_key upserts, dropped[]
   reasons); warm-up pipeline per CLAUDE.md.

8. Authored curriculum as data: lessons written in Notion render as the live
   class flow, student pages, and a public archive - one authoring surface,
   four render targets, resilient to CMS outages (timeouts + cached
   lookups + self-healing sessions).
   source: src/lib/notionLessons.ts, periodClassCodes healing (ROADMAP 7/27).

9. Kept classroom displays evergreen with zero-touch deploys: wall displays
   detect new builds and self-refresh, with a deliberate exclusion for the
   pen surface that holds authoritative ink state.
   source: src/components/DeployRefresh.tsx.

10. Sustained ~10 commits/day solo over 7 weeks (495 commits) while teaching
    full time, with 2 uses of `any` across 288 strict-mode files.
    source: git log measurement 2026-07-27 (495 commits, 2026-06-07 to
    2026-07-27); any-count from code-shape agent grep.
