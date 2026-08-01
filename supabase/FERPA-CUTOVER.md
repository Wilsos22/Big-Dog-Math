# FERPA cutover runbook

Steele's directive (2026-07-31): the website's data routing must follow FERPA.
Student data cannot go to Notion, and identities must be disguised for
everything the website collects, with real names living only in the district
Google Workspace.

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

Everything below is inert until you do it. As of the build date the DB still
holds 170 real names and district emails, re-synced daily at 13:00 UTC from
the Notion roster - step 4 is what ends that.

1. **Create the roster Sheet in your district Workspace.** A spreadsheet with
   a tab named `Roster`, header row `Name | Email | Period | Alias`, one row
   per student for the new year. Open its Apps Script editor and paste in
   `warmup-roster-push.gs`. In Project Settings > Script Properties set:
   - `BDM_ROSTER_HMAC_KEY` - a long random string you generate once (a
     password-manager 40+ character password is perfect). This is the
     re-identification key: it must NEVER go into Vercel, Supabase, Notion,
     or this repo.
   - `BDM_CRON_SECRET` - the same value as `CRON_SECRET` in Vercel.
   Run `generateAliases()` once to fill the Alias column.
2. **Update the warm-up Apps Script project** (the response spreadsheet's
   script): paste the updated `warmup-evidence.gs`, `warmup-notion-sync.gs`,
   and `warmup-sidebar-functions.gs`, and add `BDM_ROSTER_HMAC_KEY` to ITS
   Script Properties with the SAME value as step 1. From this moment the
   warm-up bridge sends HMACs, never emails, and no student row goes to
   Notion.
3. **Run `supabase/ferpa-pseudonym-schema.sql`** in the Supabase SQL Editor
   (additive: alias + email_hmac columns, and every identity RPC re-pointed
   at the HMAC).
4. **Merge and deploy the FERPA branch.** This ships the alias-based code,
   removes the Notion roster pull AND the daily Vercel cron that drove it,
   and turns on the identified-payload refusals. (Old code cannot call the
   new RPCs and vice versa, which is why steps 3 and 4 happen in one sitting,
   out of class time.)
5. **Push the roster:** run `pushRosterToSite()` in the roster Sheet's Apps
   Script. Check the log: created/updated counts, no skipped rows. Optional:
   add a daily time trigger on it.
6. **Verify before scrubbing:**
   - `/roster` shows aliases; paste the name key and names resolve.
   - Complete one warm-up with a test district account; the device verifies
     and joins (the whole receipt chain now rides the HMAC).
   - `select count(*) from students where alias is null` is 0 for current
     students.
7. **Run `supabase/ferpa-pii-scrub.sql`** (DESTRUCTIVE - read its header).
   Drops `students.full_name` and `students.email`, rewrites every stored
   display_name to the alias, scrubs emails out of old dedupe keys, and drops
   the `abbie_questions` table plus the dormant `sessions.abbie` column.
8. **Clean up Notion by hand** (the site cannot do this for you): archive or
   delete the "All Contact Information" roster database, the "Warm up
   Submissions" database, the "Warm-Up Weekly Summaries" database, the
   i-Ready Evaluations database, and any student-profile pages. Lesson
   content stays.
9. **Re-seed the mock class if you want practice data:** the updated
   `mock-classroom-seed.sql` and `mock-live-session-seed.sql` are already
   pseudonymous (Amber Fox and friends).

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
