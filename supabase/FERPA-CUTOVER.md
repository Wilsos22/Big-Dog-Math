# FERPA cutover runbook

Steele's directive (2026-07-31): the website's data routing must follow FERPA.
Student data cannot go to Notion, and identities must be disguised for
everything the website collects, with real names living only in the district
Google Workspace.

## STATUS - server side EXECUTED 2026-08-01 (on Steele's go)

Done, in order, and verified against the live database and site:
- `ferpa-pseudonym-schema.sql` applied (alias + email_hmac, RPCs on the HMAC).
- The FERPA branch merged to `main` and deployed (build `c1d9c6d`); the daily
  Notion roster cron is gone with it.
- `end-of-year-student-wipe.sql` run: the 174 real-name rows (zero evidence
  attached - verified first) and all test data deleted.
- `ferpa-pii-scrub.sql` run: `students` now carries ONLY
  `id, period_id, created_at, auth_user_id, auth_claimed_at, alias,
  email_hmac`; `abbie_questions` and `sessions.abbie` are gone. The live DB
  also had a generated `email_normalized` column - dropped (the scrub file
  now includes it).
- Mock class reseeded pseudonymously (Amber Fox and friends, 11 students,
  i-Ready baselines + six warm-up days). The mock LIVE session seed was
  deliberately not run - run `mock-live-session-seed.sql` when you want a
  visit-list practice session.

REMAINING - the Workspace side (steps 1, 2, 5, 6, 8 below): the roster Sheet
+ `BDM_ROSTER_HMAC_KEY` + `BDM_CRON_SECRET`, the `.gs` paste-ins, the roster
push, a real warm-up verification, and hand-archiving the Notion student
databases. Until step 2 lands, a warm-up submission posts a raw email and the
site REFUSES it (by design) - so do steps 1-2 before the first class day.

## The model after cutover

- **Google Workspace (district)** is the ONLY identified zone: the roster
  Sheet (Name | Email | Period | Alias), the warm-up Forms and their export
  sheets, and the Apps Script that bridges to the site.
- **The site (Vercel + Supabase)** knows each student as an `alias`
  ("Amber Fox") plus an `email_hmac` - HMAC-SHA256 of the district email,
  computed in Apps Script with a key (`BDM_ROSTER_HMAC_KEY`) that exists ONLY
  in Script Properties. The site stores the hashes and can neither reverse
  nor recompute them. Ingest routes REFUSE identified payloads
  (`npm run test:ferpa-boundary` pins this).
- **Notion** holds zero student data: lesson content only.
- **The teacher's browser** is the one convenience exception: paste the
  Alias/Name/Email columns from the roster Sheet into the Name key panel on
  /roster and teacher surfaces (visit list, /session, admission dropdowns,
  checkpoint upload translation) resolve names locally. The key lives in
  localStorage on that device and is never sent anywhere.

Students see aliases ("Hey Swift Otter!") on their own screens. One deliberate
exception: the classroom SPINNER shows first names (resolved at render from
the browser-local name key, so the wire still carries aliases) - kids disown
an alias on the wall, and the teacher says the first name aloud anyway.

## Cutover steps, in order (do this out of class time)

READ THE STATUS BLOCK ABOVE FIRST. Steps 3, 4, 7 and 9 are marked **[DONE -
DO NOT RE-RUN]** below because they were executed on 2026-08-01. Re-running
the SQL ones now FAILS (they reference `full_name`, which the scrub dropped)
- harmless, since each file is wrapped in a transaction and rolls back, but
it costs you a confusing error. Only the steps marked **[TODO]** remain.

1. **[TODO] Create the roster Sheet in your district Workspace.** A spreadsheet with
   a tab named `Roster`, header row `Name | Email | Period | Alias`, one row
   per student for the new year. Open its Apps Script editor and paste in
   `warmup-roster-push.gs`. In Project Settings > Script Properties set:
   - `BDM_ROSTER_HMAC_KEY` - a long random string you generate once (a
     password-manager 40+ character password is perfect). This is the
     re-identification key: it must NEVER go into Vercel, Supabase, Notion,
     or this repo.
   - `BDM_CRON_SECRET` - the same value as `CRON_SECRET` in Vercel.
   Run `generateAliases()` once to fill the Alias column.
2. **[TODO] Update the warm-up Apps Script project** (the response spreadsheet's
   script): paste the updated `warmup-evidence.gs`, `warmup-notion-sync.gs`,
   and `warmup-sidebar-functions.gs`, and add `BDM_ROSTER_HMAC_KEY` to ITS
   Script Properties with the SAME value as step 1. From this moment the
   warm-up bridge sends HMACs, never emails, and no student row goes to
   Notion.
3. **[DONE - DO NOT RE-RUN] `supabase/ferpa-pseudonym-schema.sql`** (applied
   2026-08-01: alias + email_hmac columns, every identity RPC re-pointed at
   the HMAC).
4. **[DONE - DO NOT RE-RUN] Merge and deploy the FERPA branch.** Shipped
   2026-08-01 as build `c1d9c6d`; the Notion roster pull and its daily Vercel
   cron are gone, and the identified-payload refusals are live.
5. **[TODO] Push the roster:** run `pushRosterToSite()` in the roster Sheet's Apps
   Script. Check the log: created/updated counts, no skipped rows. Optional:
   add a daily time trigger on it.
6. **[TODO] Verify after pushing:**
   - `/roster` shows aliases; paste the name key and names resolve.
   - Complete one warm-up with a test district account; the device verifies
     and joins (the whole receipt chain now rides the HMAC).
   - `select count(*) from students where alias is null` is 0 for current
     students.
7. **[DONE - DO NOT RE-RUN] `supabase/ferpa-pii-scrub.sql`** (run 2026-08-01,
   after the student wipe). Dropped `students.full_name`, `students.email`
   and the generated `email_normalized`, rewrote stored display_names to the
   alias, scrubbed emails out of old dedupe keys, and dropped the
   `abbie_questions` table plus the dormant `sessions.abbie` column.
8. **[TODO] Clean up Notion by hand** (the site cannot do this for you): archive or
   delete the "All Contact Information" roster database, the "Warm up
   Submissions" database, the "Warm-Up Weekly Summaries" database, the
   i-Ready Evaluations database, and any student-profile pages. Lesson
   content stays.
9. **[DONE] Mock class re-seeded** 2026-08-01 from `mock-classroom-seed.sql`
   (Amber Fox and friends, pseudonymous). `mock-live-session-seed.sql` was
   deliberately NOT run - it opens a live session; run it only when you want
   a visit-list practice session.

## What changed on the site (summary)

- Roster: pushed from the Workspace Sheet (`POST /api/roster/sync`, Bearer
  CRON_SECRET). Notion pull, `notionRoster.ts`, and the Vercel cron are gone.
- Identity: one path - the warm-up receipt chain, matched by `email_hmac`.
  The Google OAuth student sign-in is removed (it put district emails into
  Supabase Auth; it had never been used - all 42 auth users were anonymous).
- Retired Notion student-data flows: per-student warm-up submissions sync,
  i-Ready evaluations sync (`/api/iready/sync-notion`), the day-review
  push-to-Notion, the parent-outreach feature (rebuild it Workspace-side
  when wanted - the roster Sheet can hold parent contacts), and the
  per-student weekly summaries on /teacher/analytics (the form links stay).
- Checkpoint upload: the CSV's emails are translated to aliases IN THE
  BROWSER using the name key; the server refuses any CSV still carrying an
  email.
- Everything keyed by `student_id` (mastery, responses, signals, visit
  check-ins, attempts) is untouched - it simply no longer joins to a name
  anywhere outside Workspace.

## What this does NOT do

- It does not make the data anonymous - it is pseudonymized, and you hold
  the key (in Workspace and optionally in your browser). That is the
  standard posture for keeping a third-party processor outside the
  identified zone, but confirm the final arrangement against CCSD's
  requirements - this runbook is engineering, not legal advice.
- Supabase still holds work product and scores keyed to aliases. If CCSD
  requires even pseudonymous records to stay in-district, that is a bigger
  conversation.
- `sessions`/`session_joins` keep `auth_user_id` values (opaque Supabase
  anonymous-user ids, no identity attached).
