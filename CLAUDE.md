# Big Dog Math - project instructions

Standing instructions for any agent doing work in this repo. Read this before touching code.
Deeper, always-current context lives in the `abbies-classroom` plugin skills (`classroom-os-context`,
`lesson-database-builder`) and in `ROADMAP.md`. When something here conflicts with a stale comment or
an older doc, this file wins.

## What this is

Big Dog Math is a 6th-grade math classroom operating system - not just a homework site. It runs class
start to finish: guided manipulatives, a front-of-room control panel with timed states, a student
homepage and daily lesson page fed from Notion, live sessions (rosters, join-by-code, polls, class-mode
screen sync) on Supabase, and a proficiency spine (warm-up + tool + checkpoint evidence to EWMA mastery
bars and live misconception grouping).

- Stack: Next.js (App Router) + TypeScript, deployed on Vercel.
- Live: https://bigdogmath.com (also website-prototype-three.vercel.app).
- Repo: https://github.com/Wilsos22/Big-Dog-Math (default branch `main`; renamed from
  Website-prototype on 2026-07-27 - old URLs redirect, Vercel and CI followed automatically).
  **PRIVATE as of 2026-08-03** (Steele's call, so the sound-bank clips and exported slide images can
  be committed - see the sound bank section). Consequences to know: GitHub Actions minutes are no
  longer unlimited (private repos get a monthly free allowance, and CI runs typecheck plus the whole
  contract suite on every push, so watch it if pushes get frequent), and the repo is no longer a
  thing Steele can hand someone to look at - `/demo` on the live site is the portfolio front door
  instead, and it is unaffected.
  **DO NOT TRUST "Vercel builds from a private repo unchanged" - IT IS IN DOUBT AS OF 2026-08-04.**
  That is what this line used to say flatly. Observed instead: four commits pushed to `main` at
  06:38Z (confirmed on GitHub, `gh api repos/Wilsos22/Big-Dog-Math/commits/main` returned the new
  sha) produced NO Vercel deployment at all - not queued, not building, not failed, simply absent -
  and `list_deployments` showed zero deployments created in the preceding two hours. The last
  successful production deploy still records `githubRepoVisibility: "public"` in its metadata while
  the repo is now private, which points at the GitHub App losing repo access at the visibility flip.
  NOT PROVEN, and Steele can settle it in one click by redeploying from the Vercel dashboard.
  CONFIRMED SUSTAINED, NOT A BLIP (second session, independently, about 40 minutes later): the newest
  deployment of any kind is still the one carrying `265ea95`, while `main` has taken **21 further
  commits** - so every push since has produced no deployment at all, and the count is still climbing.
  `list_deployments` on project `prj_YY1p31W5veS0gNzft3EkFInjGWAZ` (team
  `team_83rmGiv2FDrY37oqcspUFhyP`) is the direct check and needs no dashboard. Until this is fixed,
  treat "pushed to main" and "live" as SEPARATE claims and say which one you have.
  WHY THIS MATTERS MORE THAN IT LOOKS: rule 3 says a push to `main` is what deploys, so an agent that
  pushes and reports "shipped" is now reporting something it has not checked. **VERIFY THE LIVE
  `/api/build-id` ACTUALLY CHANGES** before calling anything deployed - the id is the deployed commit
  sha, so it is a direct check - and if it does not move within a few minutes, say so plainly rather
  than assuming Vercel is slow. Classroom displays make this worse: `DeployRefresh` reloads them when
  the build id changes, so a build that never ships leaves every projector on the old code with
  nothing anywhere saying why.
- Local working folder: `/Users/steelewilson/Big Dog Math Site` (renamed by Steele 2026-07-27
  from "Website prototype"; an EMPTY decoy folder may exist at the old path - some agent
  sessions are anchored there and keep a launcher shim in its .claude/launch.json. Renaming
  the folder while a dev server runs in it presents as catastrophic module-not-found errors
  and an apparently emptied repo - check for a rename before declaring data loss. Original
  2026-07-21 rule stands: never put this repo inside a cloud-synced folder; Documents is
  Google Drive-synced and Drive corrupted `.git`/`.next`/`node_modules` six separate times).
- Teacher/owner: Steele Wilson. Mascot: Abbie (Steele's dog).
- Priority signal (Steele, 2026-07-21): the iPad ink surface - /ipad, /board, and the glass sheet
  over /teacher/present - is the most important feature of the whole system after data collection
  (the proficiency spine). Treat ink regressions as urgent and protect its in-class reliability.
  The planned buildout is COMPLETE as of 2026-07-22 (Phase 1 strokes/glass sheet, Phase 2
  undo/gestures/stroke-eraser/shape-snap/laser, Phase 3 zoom/pages/dotted paper all shipped);
  Steele is deliberately living with it as-is to let real classroom use surface any gaps, and
  declined glass-sheet export. Do NOT queue or propose new ink features without his word - the
  standing priority is reliability, and the open loop is his Pencil feel test (tuning constants in
  InkBoard.tsx/inkGeometry.ts are the dials). Feel verdict 2026-07-22: the pen is a CONSTANT-WIDTH
  marker (radiusFor ignores pressure, taper off) - he writes equations, not calligraphy. Pressure
  is still captured and carried on the wire, so do not remove it; restoring WIDTH feel is a radiusFor
  change only. Do not "fix" the flat line back to pressure ink.
  FLUIDITY IS A SEPARATE DIAL FROM WIDTH (2026-07-31, Steele: "the pen writing is still very
  rudimentary and not fluid"). The engine never smoothed the stroke PATH - it drew straight polygon
  segments between raw pointer samples, so a fast stroke read as angles. `smoothCenterline`
  (inkGeometry) now runs every stroke through a midpoint-quadratic before the outline is built;
  `SMOOTH_SPACING` is the knob. It is self-adaptive by sample spacing - fast, sparse strokes round
  into a curve, dense/careful strokes are barely touched, so a number's corners survive - and it is
  path shape only, so the constant-width marker is intact. That is why "rudimentary" and the width
  decision are NOT in conflict: one is the line's smoothness, the other its thickness.
  A THIRD DIAL EXISTS AND IT IS NOT IN `inkGeometry` AT ALL (2026-08-03): what the canvas is
  COMPOSITED AGAINST. See the pen-feel bullets under "Live sessions" - the caps and miter fixes
  and their contract, the React re-render that stalled back-to-back strokes, the backdrop-filter
  over the writing surface, and the `Paper` A/B that separates compositing cost from stroke
  geometry. Reach for that A/B BEFORE tuning constants again. And note that the two fixes that
  actually changed the picture were both GEOMETRY BUGS, not tuning: every dial in that file was
  already set sensibly.

## Hard rules (non-negotiable)

1. NO EMOJIS ANYWHERE. Not in UI copy, component text, button labels, nav labels, headings, console
   logs, code comments, commit messages, docs, Notion property values, or the Apps Script files. Use
   plain words or, where a glyph is truly needed, a clean text/SVG affordance - not a pictograph,
   dingbat, or emoji checkmark or arrow. The legacy emoji debt was PURGED 2026-07-27 (68 pictographs
   across 17 src/ files went to zero; plain check/x glyphs and typographic arrows deliberately
   remain). Keep it at zero - the aggregate test suite and this rule are now in agreement with the
   code.
   ICONS ARE NOT EMOJI (clarified 2026-07-29, Steele). This rule does NOT restrict icons, glyphs, or
   pictograms. The rule is about TONE, not about symbols: if it renders in colour from an emoji font
   and carries a face or a mood, it is out; if it is a monochrome stroke glyph carrying information,
   it is in. The classroom state strip (eyes / voice / supplies / body) is a deliberate glyph system
   and is in scope for that reason. The Tabler outline set is the DECLARED house icon library - it is
   Steele's choice of vocabulary, not yet a dependency (nothing in package.json or src/ imports it as
   of this writing), so a first use means adding it deliberately rather than assuming it is present.
   Read as "no icons", this rule would block work Steele has explicitly asked for; that misreading is
   why this paragraph exists.
2. Never `git add .` or `git add -A`. A Google AI Studio agent and cloud Claude sessions commit to this
   same repo concurrently - stage only the explicit paths you changed. Always `git fetch` and merge (or
   fast-forward) before pushing; local `main` goes stale fast. Corollary: when a brief cites a commit as
   already done, confirm it is actually in YOUR history (`git merge-base --is-ancestor <sha> HEAD`)
   before building on it - it may still be sitting on another agent's unmerged branch, and
   `git branch -a --contains <sha>` finds it. On 2026-07-21 the live tool banner's cream-surface
   restyle was one such commit; wiring eleven more cream pages to the un-restyled banner would have
   shipped pale-on-pale text no student could read.
   NEVER `--abort` A STUCK GIT OPERATION HERE - USE `--quit` (2026-08-03). `git am --abort`,
   `git rebase --abort` and `git merge --abort` all HARD-RESET the working tree to the pre-operation
   commit, and because concurrent sessions leave this repo's tree essentially never clean, that
   discards THEIR uncommitted work along with yours. Found live: the repo sat mid-`git am` on a stale
   patch, and git's own status message recommends `--abort` - taking it would have reset to `4371be7`,
   dropping a commit already merged and pushed to `main` plus about 516 uncommitted lines of another
   session's in-flight work (decimalSteps, divisionHouse, embedUrl, notionLessons, DecimalStepsBoard).
   `git am --quit` removes `.git/rebase-apply` and leaves HEAD and the working tree exactly as they
   are. Diagnose before clearing: `git apply --check .git/rebase-apply/0001` usually reports "patch
   does not apply" because the patch's content ALREADY landed by another route - grep its symbols in
   `src/` and the session is simply litter. A spurious `.git/index.lock` is often the first symptom.
   THE INVERSE HAZARD IS REAL TOO: YOUR UNCOMMITTED WORK CAN BE SWEPT INTO SOMEONE ELSE'S COMMIT
   (2026-08-03). This rule tells you to stage only your own paths; it did not say that the files you
   are still editing, sitting modified in the shared working tree, are equally reachable by every
   other session's `git add`. Found live during the division-tools audit: a concurrent session
   committed and PUSHED eleven of this session's files while four more edits were still to come, so
   the work landed on `main` one edit early and needed a follow-up commit to correct. Two defences,
   both cheap. Commit early to a branch rather than holding a large change in the working tree. And
   when you find your own files already on `origin/main`, diff branch against remote per path
   (`git diff --quiet origin/main <branch> -- <file>`) to find exactly which ones went out stale,
   rather than assuming the whole change did or did not land.
3. Verified work ships without waiting for Steele (his standing request, 2026-07-21 - routing
   merges through him twice stranded finished work). A push to `main` is what deploys - Vercel
   auto-builds it. Flow: push the feature branch first (a local-only branch is invisible to
   Steele's github.com flow - never hand him a merge as an action item), then fetch, merge into
   `main` in a clean worktree, resolve conflicts, typecheck AND build the MERGED tree, push, and
   verify the live route actually changed. Still ask him first: curriculum/Notion content,
   classroom-orchestration core, locked designs, schema/RLS migrations, anything destructive, and
   anything you could not verify.
4. Never import `src/lib/supabaseServer.ts` (the service-role client / `SUPABASE_SERVICE_ROLE_KEY`) into
   a client component or any browser-reachable code. Server-only tables are touched only through
   `src/app/api/*` route handlers.
5. Secrets live in Vercel env vars only - never paste a key into chat, code, or a commit. Do not commit
   `.env*.local`, `.next`, `.data`, `.tmp-mastery/`, or anything under `aistudio_*`.
6. REVERSED 2026-07-29 BY STEELE: **the control panel's DURING-SESSION view goes CREAM**, matching the
   rest of the site's wireframes. The old rule ("`/control` stays DARK for projector contrast, do not
   carry the cream theme onto it") assumed Control might be seen by the room. It is not: Control lives
   on his laptop, both projectors are separate browser tabs, and the room never sees it. His ask is
   that the during-session flow controller match the Screen Studio wireframe language.
   The iPad Remote STAYS DARK (Turn 12d) - he holds it in a dim room facing the class, which is where
   the contrast rationale actually applies. So the split is now BY DEVICE, not by privacy: laptop
   surfaces read up close are cream, the handheld is dark.
   Scope note: this is the RUNNING view. The bank, lineup editor, tool forms, games and rosters are
   setup surfaces he does not open mid-lesson, and restyling them is not part of this.
   AS BUILT: `src/app/control/page.tsx` now has ONE stylesheet with a cream BASE and dark scoped
   under `.cx-setup` (the setup drawer) and `.cx-overlay` (lessons / admissions / spinner /
   discussion). Adding a rule for a dark panel means scoping it, not flipping the base back.
   Per-state accent colours are NOT usable raw on cream - the catalog runs from `#35785a` to
   `#fcaf38` - so `.cx-root` derives `--cx-acc-text` (42% ink, AA small caps), `--cx-acc-deep` (62%,
   large headings) and `--cx-acc-fill` (48%, behind white button text) by `color-mix`, the same
   trick `/teacher/pace` uses. THE BANK AND THE LINEUP RAIL ARE DELIBERATELY HIDDEN once a step is
   loaded (`setupOpen` state plus the "Set up" toggle in the top bar; with nothing loaded they show
   unconditionally, because the idle copy points at the bank). A report that "the bank disappeared
   from /control" is that toggle, not a regression - do not restore them unconditionally. And note
   `.cx-tool-field` is a `<label>` that WRAPS its own input, so `text-transform` on it rewrites what
   the teacher typed; the poll labels are separate elements and can carry it.
   Related decision (same conversation): Control STAYS OPEN as the engine - he is not removing it, he
   just should not need to GO there during a lesson unless something fails. Because Control publishes
   its snapshot about once a second and Chrome throttles hidden tabs hard after roughly five minutes, it
   has to stay FOREGROUNDED - which is why the during-lesson student-data view belongs INSIDE Control
   rather than on its own route. The chosen data view is LIVE MISCONCEPTION CLUSTERS (what
   `/teacher/rightnow` renders from `/api/live/groups`), because it is the highest-value thing not
   already on the iPad and it is what changes the next teacher move.
7. Verify the build before reporting "done" (`npm run typecheck` at minimum, `npm run build` for
   anything non-trivial). Do not rely on file edits alone.
8. **THE FERPA BOUNDARY** (Steele's answer arrived 2026-07-31, replacing the 2026-07-29 hold:
   "It cant go to notion. It needs to follow ferpa. I need to create a way to disguise their
   identities for anything collected from the website until it gets to the google workplace app").
   Student names, district emails, and every piece of re-identification key material live ONLY in
   the district Google Workspace (roster Sheet + Apps Script + Form exports) and, for live-teaching
   convenience, the teacher's own browser. The SITE knows each student as an `alias` ("Amber Fox")
   plus an `email_hmac` (HMAC-SHA256 of the district email, computed in Apps Script with
   `BDM_ROSTER_HMAC_KEY`, which exists ONLY in Script Properties - never in Vercel, so the site
   cannot compute, reverse, or enumerate the hashes). NOTION HOLDS ZERO STUDENT DATA - lesson
   content only. Standing rules for any new code: no name or email column or payload field
   server-side; ingest routes REFUSE identified payloads (see `src/lib/pseudonym.ts` -
   `assertPseudonymousRoster`, `looksIdentified`; `npm run test:ferpa-boundary` pins the boundary);
   teacher-side re-identification happens only through `src/lib/teacherNameKey.ts`
   (browser localStorage, loaded by pasting from the roster Sheet on /roster) and that module may
   NEVER be imported by anything under `src/app/api`; anything a teacher tap or write sends back to
   the server carries the ALIAS, never a resolved name (VisitListPanel is the pattern).
   ONE deliberate room-facing exception (Steele, 2026-07-31): the classroom SPINNER shows FIRST
   names on the wall - kids disown an alias and derail the spin, and the teacher says the first
   name aloud anyway. `ClassroomSpinner` resolves via `firstNameLabelMap` at render only; the
   roster fetch, fair rotation, and spinner-sync snapshots still carry aliases, so the wire and
   server never see a name. The projector tab needs the name key loaded in ITS browser (present
   runs on the classroom laptop, so one paste on /roster covers it); without the key the spinner
   falls back to aliases. SAME EXCEPTION, SECOND SURFACE (2026-08-02): `SpeakerSpinner` is the
   on-demand cold-call - the iPad's persistent `Pick a speaker` deck button sends the `spin-speaker`
   remote action (any state, unlike `spin-spinner` which is scoped to the readers/iPad-Kid slides),
   and the overlay on `/teacher/present` ONLY (never a student device) spins to one first name. Fair
   rotation lives in the projector's localStorage (`bdm-speaker-spinner-fair-v1`) and the remaining
   count is deliberately never shown; the alias is what rides the wire, first name only at render.
   STUDENT DEVICES RENDER NO STUDENT NAME OR ALIAS AT ALL (Steele, 2026-08-01: "they never have
   their names on their device" - a name on a kid's own screen is disruption material, same as on
   the board; an alias doubly so). Identity is NOT anonymous - the alias still rides every join,
   answer, and evidence row, and the teacher still resolves names via the key - it just never
   RENDERS on a student screen. The landing and /lesson greetings are name-free, the landing
   PURGES the dead `bdm-student-name` greeting key on every visit (so /assignment stores its
   at-home attribution alias under `bdm-assignment-alias` instead), and the boundary contract
   pins all of it. The legacy /join typed-name flow (JoinQuestion + /api/session/responses,
   superseded by live-flow polls) is deliberately left as-is. Mock/test
   identities stay fully fictional AND pseudonymous-shaped (the mock class is Amber Fox and
   friends). Built 2026-07-31; SERVER SIDE CUT OVER 2026-08-01 on Steele's go: schema migration
   applied, branch merged and deployed (the Notion roster cron is gone), all real-name rows wiped
   (they held zero evidence), `ferpa-pii-scrub.sql` run - the live `students` table now carries
   ONLY id/period_id/created_at/auth_user_id/auth_claimed_at/alias/email_hmac - and the mock class
   reseeded pseudonymously. REMAINING is the Workspace side, Steele's hands only, per
   `supabase/FERPA-CUTOVER.md`, and it is now just TWO steps: **step 2** (paste the updated `.gs`
   files into the WARM-UP Apps Script project and give it a `BDM_ROSTER_HMAC_KEY` identical to the
   roster project's) and **step 6** (one real warm-up on a district account - the only thing that
   writes `auth_user_id`). The roster Sheet and the roster push are DONE: 167 students carry an
   alias and an `email_hmac`. Until those paste-ins land, warm-up
   identity posts carry a raw email and the site REFUSES them by design - do them before the first
   class day. The old hold on new student-data plumbing is LIFTED; build against the pseudonymous
   model.
   **THE NOTION HALF (step 8) RAN 2026-08-05 AND IT WAS TWICE THE SIZE OF THE LIST.** Ten live
   databases went to the trash, including the `Rosters` / All Contact Information source of truth
   (174 rows, 157 real `@nv.ccsd.net` emails, 168 student numbers, guardian emails and phones in
   the page bodies), a SECOND `Warm Up Submissions`, `Parent INfo` (guardian names + phone
   numbers), `Student Emails`, and four MAP/SBAC score tables carrying student names. Six others
   were already archived, which is exactly why nobody noticed: **a partly-run cleanup looks like a
   finished one.** The runbook named five databases and five more existed. Never clean this from a
   remembered list - enumerate every data source
   (`POST /v1/search {"filter":{"value":"data_source","property":"object"}}`) and test each.
   FOUR THINGS THAT COST TIME OR WOULD HAVE PRODUCED A WRONG ANSWER. (1) **The Notion MCP has no
   archive or delete tool at all** - use the raw API with the `NOTION_TOKEN` already in
   `.env.local`: `PATCH /v1/databases/<id>` `{"in_trash": true}`, `Notion-Version: 2025-09-03`.
   (2) **Notion search reports a data source as `archived: false` while its PARENT DATABASE sits in
   the trash**, so a scan that trusts that flag reports PII that is already gone; check
   `GET /v1/databases/<parent>`. (3) **A bare `@nv.ccsd.net` grep flags STEELE'S OWN account**
   (`wilsos13@`, plus `googledrive-wilsos13@` from the Drive connector) across Document Hub, Assets
   Library and People - none of it student data, none of it to be touched. Student addresses have
   the shape `Firstname.1234567@nv.ccsd.net`; match `[A-Za-z]+\.\d{5,}@nv\.ccsd\.net`.
   (4) **The API refuses workspace-level pages** ("Archiving workspace level pages via API not
   supported") - one 1-row database needs a hand click. And ARCHIVING IS NOT DELETING: the data is
   in Notion's trash until Steele empties it, so the exposure is reduced, not removed.
   ONE ROUTE WAS STILL SERVING DISTRICT EMAILS OUT OF NOTION and no contract covered it:
   `/api/form-responses` + `src/lib/notionFormAnalytics.ts` returned per-student warm-up rows
   including the raw `Email Address`, flatly contradicting "Notion holds zero student data". It had
   ZERO callers in `src/`. Both are DELETED (2026-08-05) and `npm run test:ferpa-boundary` now pins
   the deletion, the `warmup-notion-sync.gs` retirement stub, and a new `looksIdentified` refusal on
   `/api/live/visit-list` - which was the one identity-bearing ingest with no boundary check. Its
   proxy entries in `src/proxy.ts` are deliberately LEFT in place: a prefix guarding a route that
   does not exist costs nothing and fails safe if one ever returns.
   Pseudonymized is not anonymized - Steele holds the key, and the posture still needs CCSD's
   sign-off; if CCSD requires even pseudonymous records in-district, that is a new project.
9. KEEP THIS FILE TRUE, IMMEDIATELY. The moment you discover something that would have prevented a bug
   - a stale reference, a silent failure mode, an undocumented constraint - correct this file in the
   same turn you discovered it, as its own small commit, and get that commit onto `main` without
   waiting for the feature you were working on. This file is the shared brain: `AGENTS.md` points Codex
   here, Claude Code loads it automatically, and the Claude Project reads it from `main`. A correction
   parked on a feature branch is a correction nobody has. Two real bugs in July 2026 came from stale
   lines here - a `middleware.ts` reference that had moved to `src/proxy.ts`, which sent an agent to
   build a student endpoint in a teacher-gated namespace. Corollary: anything another agent would need
   goes HERE, not in a Claude-only memory note, because Codex cannot read those.
   Two mechanisms back this rule up; do not rebuild them. `.claude/hooks/brain-sync-check.sh` runs on
   Claude Code's Stop event and prints one advisory per session when a branch changed files under
   `src/` and never touched this file - it never blocks, and silence means the check passed. `/sync`
   (`.claude/commands/sync.md`) is the manual pass: read the diff, sort each finding into this file,
   `ROADMAP.md`, auto-memory, or nothing, then land the `CLAUDE.md` edit on its own path to `main`.

## How to work with Steele (standing, 2026-08-03)

Four working rules he gave directly. They are here rather than in a Claude-only memory note because
Codex and cloud sessions need them too (rule 9).

1. **DELEGATE MULTI-FILE READING TO A SUBAGENT.** Any task that means reading and reviewing several
   files goes to a subagent (Explore for read-only sweeps), not into the main conversation. File dumps
   clog context and degrade the session, and his sessions are long and span code, Notion and lesson
   design in one thread. Give the agent a precise brief and ask for file:line references plus quoted
   conditions; keep the conclusion, not the files. Read directly only when you already know the exact
   file and need one spot. This is not just hygiene - the lesson-picker sweep on 2026-08-03 replaced
   about a dozen reads AND found that "browse all lessons and run one on demand" already existed, which
   a file-by-file crawl would have taken far longer to notice.
2. **INTERVIEW BEFORE BUILDING any design, UX, or backend change.** Cover every aspect of the feature
   first; do not infer a spec from a one-line request. His asks carry unstated classroom context and
   the cost of guessing is a rebuild. "2 balls bouncing across a row of squares" contained four real
   forks (where it lives, pacing control, behaviour after the first match, the colour scheme), and
   asking is what surfaced that shared landings needed their own third colour. Ask about the axes that
   change the build: where it lives, who operates it and on what device, what it WRITES (evidence,
   Notion, session state), the edges, and how it fails. Research the repo first - asking him something
   the code already answers wastes his time.
3. **A SECOND AGENT CHECKS EVERY FINISHED FEATURE, TOOL, OR LESSON PLAN.** The builder does not grade
   its own work; it knows what it meant and reads intent into the code. Run the review after
   verification passes and BEFORE reporting done. Hand the reviewer the real quality bar, not "look it
   over" - for a tool that is the design rules in this file (reference in a left rail, never reveal an
   answer the student has not earned, tactile drag over clicking, fill the screen, no emoji, AA
   contrast); for a lesson it is the CRA spine, the 50-minute sum, student talk, and whether every
   field the surfaces read is actually authored. Rank findings by whether they would hurt in a live
   class, fix what is clearly right, and bring judgment calls to him.
4. **TELL HIM WHEN TO CLEAR CONTEXT.** He will not track it and does not want to find out through
   degraded output. Say so at a seam - a verified deploy, a finished task list, a topic change - and
   name what should carry over. Anything durable belongs in this file or in memory, never in the
   transcript.

## Repo layout

- `src/app/**` - App Router pages and API routes (one folder per route, direct `page.tsx`/`route.ts`;
  no route groups, no per-segment layouts except the root `layout.tsx`).
- `src/components/**` - shared React components (SiteNav, ToolNav, AbbieTalk, the manipulatives, etc.).
  THE LIVE TOOL IS USUALLY THE `*Board.tsx` FILE. A pre-redesign generation of dark-themed
  (slate-900, Tailwind, placekitten fallbacks) prototypes still sits beside the real components
  under a name one suffix away - `FractionBars.tsx` beside `FractionBarsBoard.tsx` (deleted
  2026-07-29, nothing imported it), `AlgebraTiles.tsx` beside the live `AlgebraTilesBoard.tsx` -
  so an edit aimed at a tool can land in a file nothing imports, typecheck clean, build clean,
  and change nothing on screen. Read what the route's `page.tsx` imports before editing a
  component. Still unimported as of 2026-07-29: `AlgebraTiles.tsx`, `ClassroomTools.tsx`,
  `DoubleNumberLine.tsx`, `GemsFunnel.tsx` (plus `TeacherGate.tsx`, already documented as legacy
  under Auth) - deleting those needs Steele's word, not a silent sweep. Inverse trap, and the
  reason that list is short: to prove a component is dead, grep the BARE NAME, never
  `@/components/<name>`. Components import each other RELATIVELY (`from "./ToolHeader"`), so a
  path-shaped grep reports `ToolHeader.tsx` (5 importers) and `useLiveToolConfig.tsx` (19) as
  dead code.
- `src/lib/**` - non-UI logic: `supabase.ts`, `supabaseServer.ts`, `notionLessons.ts`, `mastery.ts`,
  `grouping.ts`, `toolEvidence.ts`, `teacherToken.ts`, `classStates.ts`, `liveClassFlow.ts`.
- `src/proxy.ts` - the real access-control gate (see Auth).
- `supabase/*.sql` - hand-run, idempotent migrations (no migration runner; run them in the Supabase SQL
  Editor). `supabase/SETUP.md` documents env setup.
- `warmup-*.gs` (repo root) - Google Apps Script warm-up pipeline (generator, Notion sync, evidence
  poster, week builder, pools). Steele pastes these into the Apps Script editor.
  THREE APPS SCRIPT PROJECTS, NOT TWO, and pasting a file - or a Script Property - into the wrong
  one breaks things silently. This line said TWO until 2026-08-04, and the missing third one cost
  Steele an entire evening.
  (1) The LIVE WARM-UP project, bound to the warm-up response spreadsheet, id
  `1YQAN1GU8JL6skLkCv4zFH_UDKzolwQRRSBOg0HONyGfZO9kRhG0kZrpB`. Holds `warmup-evidence.gs`,
  `warmup-notion-sync.gs`, `warmup-sidebar-functions.gs`, `notion-warmup-requests.gs`,
  `warmup-engine.gs`, the generators and the week builder. THIS is the project the Notion
  Create Warm-up button's work actually runs in.
  (2) A STALE SECOND PROJECT BOUND TO THE SAME SPREADSHEET - one spreadsheet can carry more than
  one Apps Script project, and this one shows in the editor as "Untitled project". Tell it apart by
  what is in it: the OLD OpenAI path (`warmup-ai-generator.gs`, an `OPENAI_API_KEY` property). The
  live project builds through the parametric engine and needs no AI key at all, so AI CALLS IN THE
  FILE LIST MEANS YOU ARE IN THE WRONG PROJECT. Observed open at
  `1NVBcSo_H2xAl_MsndDpxqEHLwsaGnC1LFJANNSNsPQeP3a677uQuxHvX` during the 8/4 failure; do not treat
  that id as authoritative, treat the file list as the test.
  (3) The ROSTER spreadsheet ("26-27 Rosters"), holding `warmup-roster-push.gs` and
  `warmup-student-profile.gs`.
  Projects (1) and (3) both need `BDM_ROSTER_HMAC_KEY` set to the IDENTICAL value - a mismatch is
  invisible until a real warm-up returns "not on roster". Note both `warmup-sidebar-functions.gs`
  and `warmup-student-profile.gs` define `onOpen()`, which is only safe because they live in
  different projects.
  **THE CRON SECRET LIVES IN THREE PLACES AND ALL THREE MUST MATCH EXACTLY** (2026-08-04): Vercel
  env `CRON_SECRET`, warm-up project (1) Script Property `WARMUP_ENGINE_KEY`, and roster project (3)
  Script Property `BDM_CRON_SECRET`. `warmup-engine.gs` sends it as `Authorization: Bearer <value>`
  to `https://bigdogmath.com/api/warmup`, which the proxy gates because that endpoint returns the
  ANSWER KEY (`/api/warmup` is in `SECURE_ROLLOUT_PREFIXES`, live because production has
  `NEXT_PUBLIC_SECURE_STUDENT_DATA=true`). Do NOT "fix" a 401 by ungating the route.
  FOUR THINGS THAT MAKE THIS FAIL QUIETLY, all four hit in one evening. **Vercel never re-reveals an
  existing secret**, so you cannot copy `CRON_SECRET` to match it - ROTATE to a value you choose and
  write it into all three places, rather than trying to retype what is already there. **An env change
  does not reach the running deployment until you REDEPLOY.** **A value pasted from a `.env` line
  arrives as `CRON_SECRET=<value>`** and the whole string is compared, so the `=` and everything left
  of it must be stripped. And **the roster push is the one that fails silently if you miss it** -
  rotating the other two leaves it 401ing with no error surfaced anywhere, students simply stop
  syncing.
  THE SYMPTOM IS ROOM-FACING AND NAMES THE WRONG CAUSE: the Notion `Warm-Up Build Note` reads
  `Warm-up engine 401: {"error":"Teacher login required."}`, which reads as a login problem with the
  site and is actually a secret mismatch. Diagnose from INSIDE project (1), not by editing and
  re-pressing - a scratch function that logs `key.length`, whether it starts with `CRON_`, whether it
  contains `=`, whether it differs from its own `trim()`, and then the response code of a real
  `UrlFetchApp.fetch` to the endpoint, settles it in one run without printing the secret. A
  well-formed value is 43 chars (base64url of 32 bytes, no padding); 43 chars AND a 401 means the
  mismatch is on the Vercel side or you are in the wrong project.
  **THE WEEKDAY CHECK IS ON THE LESSON'S `Date`, NOT ON THE DAY YOU PRESS THE BUTTON.**
  `getWarmupRequestDateInfo_` refuses Sat/Sun because `dayIndex` indexes a five-day week, so
  weekend-BUILDING has always worked and only a weekend-DATED lesson is refused. Steele read
  "Warm-ups can only be created for Monday through Friday" as a lock on his own Saturday prep and
  asked for it to be removed; it was left in place 2026-08-04 once that was clear. Note the
  `Warm-Up Build Note` PERSISTS until the next attempt, so a stale weekend error can sit on a lesson
  whose date has since moved to a weekday - re-press before believing it.
  NOTHING ABOUT THE QUESTIONS REACHES NOTION. A successful build writes only POINTERS to the
  `Warm up Links` data source (`collection://3142eba1-de37-8024-b6cc-000b38db5d17`): Name, Key (form
  id), Lesson Code, Topic, Week, Day, Date, Synced At, Source, Form Link, Edit Link, Response Sheet,
  Response Tab, plus the relation back to the lesson. That schema has NO question fields, and
  `upsertWarmupLinkPage_` writes none - the six questions exist only in the Google Form and its
  response tab, so reviewing a warm-up means opening `Edit Link`. The one direction that DOES flow
  through Notion is the lesson's `Retention Q4` / `Retention Q5`, which are authored in Notion and
  feed INTO the build.
  `warmup-student-profile.gs` is the WORKSPACE-SIDE student profile workbook (2026-08-01): a
  Profile tab with a student dropdown joining Contacts / Testing / Behavior / ContactLog (all keyed
  on EMAIL) plus `SiteData` pulled from the site's gated `/api/teacher/roster` + `/api/mastery` and
  joined on ALIAS. It exists because the site is pseudonymous - Workspace is the only zone where an
  alias may become a name, so named analytics belong there, not on the site. It is NOT a
  replacement for Infinite Campus: IC stays the system of record and cannot be auto-synced by a
  teacher (its OneRoster API needs an administrator to register the app with the district's IC
  rep), so IC data arrives by CSV export.
  `warmup-canvas-sync.gs` mirrors Notion lessons into Canvas (2026-08-01) as TWO DISTINCT THINGS,
  and conflating them is the mistake to avoid. `syncLessonPageToCanvas()` posts an UNGRADED page
  for EVERY published teaching day, so the course is visible to students and parents in Canvas.
  `syncAssignmentToCanvas()` creates a GRADED assignment ONLY for turn-in work. `syncTodayToCanvas()`
  runs both and is what belongs on the morning trigger.
  THE GRADEBOOK SCOPE IS A POLICY RULE, NOT A TECHNICAL ONE (Steele: "only assignments that
  students must turn in even if they were absent... the in lesson work isnt that"): warm-ups, tool
  work, exit tickets, learning checks and discussion are formative, cannot be made up by an absent
  student, and MUST NOT become Canvas assignments - though they may be DESCRIBED on the lesson
  page, which is information rather than a grade. A lesson is treated as having a turn-in
  assignment when Notion gives it an `Assignment Link` or a `Due and Turn In` value. It reads only
  the PUBLIC `/api/today` payload, so this integration carries zero student data. Canvas is reached
  with a teacher-minted personal access token in Script Properties, which needs no district
  approval; grade passback Canvas -> Infinite Campus is ON for Steele's courses, so THE GRADE PATH
  IS site -> Workspace Sheet -> Canvas -> IC and the site never talks to Canvas or IC directly.
  The script creates the gradebook COLUMN only - posting scores is a deliberate separate step,
  because it needs the alias -> email -> Canvas-student join that only the roster spreadsheet can
  do, and a broken grade push must never damage the assignment absent students rely on.
- `scripts/` - golden-file tests + fixtures for the mastery/grouping engines.
- `public/` - assets. Inline square mark: `big-dog-mark.png`; wordmark/banner: `big-dog-logo.svg` /
  `big-dog-logo.png`.
- `ROADMAP.md` - mirror of the Notion "Big Dog Math - Feature Tracker"; update BOTH when a feature ships.
  **THE TRACKER'S DONE-NESS IS A CHECKBOX, NOT THE `Status` SELECT** (found 2026-08-04, data
  source `56ee55bb-c067-4613-8f3b-6d5810a82ced`). `Status` runs Live / Planned / Parked / Needs
  revision / In progress and HAS NO `Done` VALUE, so the natural-looking filter "Status is not
  Done" matches EVERY row. Done-ness lives in a separate `Done` checkbox (`__YES__` / `__NO__`).
  Measured that day: `Priority = Now` returns 18 rows and NINE of them are already complete, so
  the wrong filter reports shipped features as outstanding work - the exact failure a status
  read exists to prevent. Correct filter is `Priority = "Now"` AND `Done = "__NO__"`.
  `.claude/commands/class-audit.md` (curriculum scope) still carries the wrong wording.

## Routes (as of this writing)

- Student / public flow: `/` (landing, join-by-code), `/join`, `/explore`, `/lesson`, `/today`,
  `/lessons`, `/practice`, `/challenge`, `/checkpoint`, `/exit-ticket`, `/assignment/[id]`, `/spinner`,
  `/homework-help`.
- `/homework-help` (added 2026-07-28) renders the lesson's existing `Help Path` property ONE STEP PER
  SCREEN with one button, reading the public `/api/today` - zero new authoring, works every night for
  whatever the assignment is, with no live session and no join (it runs at 8pm from a kitchen table).
  Steele's constraint: sixth graders ignore a wall of supports and A LIST IS A WALL. Never turn it
  into a list, and never add an "I am stuck, skip it" exit - an escape hatch cheaper than the work
  gets used instead of the work. REACHED FROM TWO ENTRIES ON THE LANDING (moved 2026-08-01, Steele:
  "the stuck? button should be on the students homepage not on the log in page"): the `Stuck on the
  assignment?` chip is on the POST-code home base (the in-class student's homepage), and the
  PRE-code code-entry screen carries an `Absent or doing homework?` chip pointing at the SAME route.
  Both are `.st-explore` buttons. The pre-code one is deliberately NOT removed and NOT a "Stuck?"
  label: an absent kid at 8pm has no live class code and can never open one (the period-code
  fallback is gated on school hours AND a district account), so the code-entry screen is their ONLY
  path to this route - stripping it there to honour "not on the log in page" literally would break
  the documented absent flow, so it was RELABELLED to serve them instead.
  THE STUCK BUTTON IS THIS ROUTE AND ONLY THIS ROUTE (Steele, 2026-07-29): the walkthrough belongs
  behind the landing chips, NOT on a lesson or tool surface. A `Stuck?`
  chip was briefly added to `/distributive-area` and removed the same day - "not part of the lesson.
  its for absent kids and kids doing homework."
- `/homework-help` ANIMATES the Help Path when it can (2026-07-29, from the Claude Design handoff
  "Distributive Walkthrough", project c5b70077). When the lesson's `Tools` resolve to
  `/distributive-area` AND the authored path parses to exactly six steps, the SAME authored steps go
  to `DistributiveWalkthrough`, which draws `a x b = a ( p + q )` on one 980x560 stage as the student
  advances - earlier steps dimming to 0.34 so the whole chain of reasoning stays visible. Anything
  else falls back to the plain list. **NOTION OWNS THE WORDS**: `walkthroughStepsFromHelpPath` puts
  each authored line in as the sentence and supplies only the rail label, the heading, and a spoken
  description of the picture, so editing `Help Path` changes what the student reads and no code moves.
  It returns null on any path that is not six steps, and that null is load-bearing - the stage draws
  six specific things in a fixed order, so animating a seven-step fraction routine with a
  distributive picture would be worse than not animating. M1.T1.L1's authored path happens to be
  exactly the six steps the stage draws; that is why this lesson animates and others do not (yet).
  Step 3 ("which factor is easier for me to work with?") is the lesson's only DECISION rather than a
  move; its built-in title stays a question. `parseHelpPath` lives in
  `src/lib/distributiveWalkthrough.ts` and is shared with the plain view - one parser, and it strips
  Notion's markdown escaping (`\[` arrives from some read paths and the student would otherwise read
  the backslashes).
  THE PLAN IS ONE ANIMATION PER LESSON (Steele, 2026-07-29 - "I will eventually create animation for
  each lesson, this is just a test run"). So the `usesDistributiveTool` branch in
  `src/app/homework-help/page.tsx` is the EXTENSION POINT, not a special case: a second animation adds
  its own component plus one more arm there, and the plain list stays the terminal fallback for every
  lesson without one. Deliberately NOT generalised yet - each animation will have its own step count
  and its own stage, so `WALKTHROUGH_STEP_COUNT` is per-animation and the shared part is only
  `parseHelpPath` plus the "authored steps in, picture out" contract. Do not build a registry until
  there are two real animations to read the shape off.
- Manipulative tools (public, no session): `/whiteboard`, `/number-line-plus`, `/number-line`,
  `/fraction-bars`, `/group-bars`, `/percent-bar`, `/algebra-tiles`, `/equation-builder`,
  `/order-of-operations` (GEMS), `/combine-like-terms`, `/proportions`, `/area-model`,
  `/coordinate-grid`, `/ladder-method`, `/multiplication-fluency`, `/term-identifier`,
  `/divisibility`, `/distributive-area`, `/area-explorer`, `/balance-beam`, `/long-division`,
  `/place-value`, `/place-value-mirror`, `/timer`, `/decimal-steps`, `/lcm-bouncer`.
- `/lcm-bouncer` (added 2026-08-03, Steele's idea) is the CONCRETE partner to `/ladder-method`'s
  abstract GCF/LCM procedure: two balls arc across the same numbered track, Ball A touching down
  every `stepA` squares and Ball B every `stepB`. Teal marks Ball A's own landings, coral Ball B's,
  amber a square BOTH landed on - and the first amber column is the LCM.
  THE TWO BALLS SHARE A HORIZONTAL SPEED, NOT A TEMPO, and that is the load-bearing decision. One
  hop per beat would put Ball A on 12 at beat 3 and Ball B on 12 at beat 2 - same square, different
  moments, and the "they landed together" event never happens on screen. Sharing the speed puts the
  meeting in a single frame and leaves the BOUNCE COUNTS different, which is the quantity the lesson
  is actually about. Do not "fix" it to one hop per beat. One clock (`progress`, in column units)
  drives both arcs: each ball's height is a parabola over `(progress mod step) / step`.
  The board KEEPS GOING past the first meeting on purpose, so the amber columns repeat at a fixed
  interval and the room can see that every common multiple is a multiple of the least one. Track
  length is DERIVED from the pair (`trackLengthFor`), never hand-set, so the LCM is always reachable
  - a coprime pair just gets a long track, and "9 and 10 take ninety squares to meet" is a true and
  useful thing to watch. Numbers hide on untouched squares once the track is long, but a landed-on
  square always shows its number.
  Wired in the simple `LiveToolConfig` arm (`config: Record<string, never>`) - the strides are set on
  the board and a teacher steers the room through the PROMPT ("find where 4 and 6 land together").
  Publishing the pair is an additive config arm plus two `/control` form fields, not a rewrite.
  It emits NO evidence - `reportToolResult` is not wired here, so it moves no mastery bar.
- `/division-house` IS THE THIRD DIVISION TOOL AND THEY ARE ALL DIFFERENT (2026-08-03, Steele).
  `/long-division` is a whole-number choreographed DEMO with no scoring; `/decimal-steps` does the
  ARITHMETIC; `/division-house` (`DivisionHouseBoard` + `src/lib/divisionHouse.ts`) drills the
  CHOREOGRAPHY - the numbers are worked out for the student and what they supply is which spot and
  which operation, in his sequence: the number we are dividing -> divide -> the number we divide BY
  -> where the answer goes -> multiply -> by which spot -> where that goes -> subtract -> where that
  goes -> bring down -> which digit -> where it goes, and then it resets. `npm run
  test:division-house` pins that order; collapsing two of those into one step removes a decision.
  IT IS REPS, NOT A TEST (Steele: "its not testing as much as just getting reps following the
  numbers" / "I just want them to start to remember what the sequence is"). That is why a placed
  number STAYS GREEN and why the D-M-S-B-R rail fills in as they name each step. What the rail must
  NOT do is light a step BEFORE it is named, or the question answers itself.
  Four layout rules that were notes first. Only the inside of the house is clickable - there is no
  such thing as a number above or below the divisor, so those cells are not drawn ("this isnt
  needed"). A multi-digit number is ONE number: the leftover plus the digit brought down highlight
  together and clicking either counts, which is why a prompt carries `slots: string[]` and not a
  single id. There is a CLEAR GUTTER COLUMN between the divisor and the bracket. And the rule under
  a subtraction spans the number being taken away FROM as well as the product, with the difference
  below it, the way it is written by hand.
  **REBUILT TWICE IN TWO DAYS, AND THE SECOND REBUILD DELETED MOST OF THE FIRST. READ THIS BEFORE
  BUILDING ANYTHING BACK.** On 2026-08-03 nine toolbar comments produced a board that traced six
  arched connectors per round and kept every round on screen in its own colour. Steele ran that
  board on 2026-08-04 and said, in three messages: "maybe no arrows. Just use the higlighting pulse
  to show what is happening", then "no arrows or lines", then "the animation is clunky". So:
  (1) **THERE ARE NO CONNECTORS ON THE BOARD. NONE.** The arched line that drew itself over 520ms,
  the arrowhead that faded in behind it, the sign glyph that burst in at 1.5x and rotated, and the
  plaque's two arrows down to the divisor and in through the door are ALL GONE. What is happening is
  said by the two NUMBERS the move runs between, ringed in the round's colour - a RING so it
  composes with the green of a placed digit instead of fighting it - plus the arithmetic written out
  in the right rail. The engine still traces the same six moves per round; they are READ rather than
  DRAWN. `npm run test:division-house-arcs` pins the absence.
  TWO THINGS ABOUT THAT HIGHLIGHT ARE LOAD-BEARING AND BOTH WERE WRONG FIRST. It lights WHOLE
  NUMBERS - `visual.fromSlots` / `visual.toSlots`, not the single `from`/`to` anchors, which lit the
  "1" of 14 and the "1" of 12 on 144/12 and left the other halves dark, the exact thing
  `slots: string[]` exists to stop one prompt earlier. And THE TWO ENDS ARE WEIGHTED DIFFERENTLY -
  a 2px hairline on the source, a 4px solid ring on the destination - because two identically-lit
  cells say WHICH PAIR and nothing about which way or in what order, and "the 2 came from the 9 and
  the 4 and goes UP" is the content of the move for a student two years behind. Do not equalise them
  and do not merge the two sets.
  (2) **THE PULSE IS WHAT A MISS BUYS, NOT WHAT THE QUESTION OPENS WITH** ("get rid of the circle.
  have it say to select the number closest to the door inside the house and if they get it wrong
  then have it pulse"). The drawn ring is gone and `.dh-slot.target` is applied only once `missed`
  is set. This REVERSES the 2026-08-03 note that the always-on pulse was "the design, not a giveaway
  to be tightened up later" - he tightened it.
  (3) **THE MNEMONIC RAIL IS D-M-S-B-R, ON THE LEFT, BUILT LIKE GEMS'** ("just like we did on the
  other tools like gems"). Five tiles, one colour each on `--c`, four states. R is NOT a fifth
  operation - `HOUSE_OPS` stays four, because nothing is pressed for R - and its word changes:
  "Repeat" while digits are still waiting, "Remainder" on the last round, which is where "No
  remainder. All done. Nice!" gets said. B shows as SKIPPED on the last round; that grey tile is not
  a gap, it is the reason the problem is ending. DO NOT put a strikethrough through the letters: a
  struck-through capital D is a different letter, on a rail whose entire job is those five.
  (3b) **THE RIGHT COLUMN CARRIES THE COUNT AND THE CONTROLS, AND NO TRAIL OF PAST SENTENCES.**
  Both from the same review. The "Problem 1 of 4 / Start over / Next problem" row used to be a
  full-width band above the board; height is the binding constraint here (`cellPx` is
  `min(byWidth, byHeight)`), so on a 1366x768 Chromebook a four-round problem sat at the `CELL_MIN`
  floor with the board 84px below the fold while that column had room to spare - moving it plus
  cutting `PLAQUE_GAP` from 46 to 30 (it was sized for the plaque arrows, which are gone) got that
  to 10px. And the four past `say` sentences that used to stack under the question repeated in prose
  exactly what the work lines say in numbers, in the same green left-bar as the live confirmation:
  ten blocks of text made the RIGHT RAIL the centre of attention on a board whose centre is the
  house. The board is the record - that is what a placed spot staying green is for.
  (4) **THE NUMBERS RIDE ALONGSIDE THE WORDS** ("show the math happening in numbers next to the step
  so show the 9 divide sign 4"). Each prompt carries `work: {key, text}` - the line as it reads AFTER
  that prompt is answered - and a line only ever GROWS by one piece. That growth is the whole safety
  property: "9 ÷ 4 = 2" cannot appear while "where does that answer go?" is still on screen. The
  contract asserts each piece is a prefix of the next and that only the last one contains an `=`.
  The bring-down deliberately has NO work line; it is not a fact with an answer.
  (5) **EVERY PROBLEM OPENS WITH THE STUDENT SETTING UP THE HOUSE** ("have students drag the divisor
  to the outside and dividend inside... they click the spot and it slowly moves to it... or they
  have to actually click and drag it"). The board starts BLANK - neither given digit is printed
  until it is put there - and the two numbers sit as chips in the plaque equation. Drag, or tap to
  pick up and tap a zone to place; a sub-`TAP_SLOP` press is a TAP, tested BEFORE the zone, which is
  the trap Fraction Bars found. The travel is a straight transform between two MEASURED viewport
  points over `FLY_MS`, not a path being traced - the arrows it used to follow are gone. This
  REPLACED the "Get started" pop-out.
  **NEVER PUT A BACKTICK INSIDE A PER-PAGE `<style>` BLOCK, AND NEVER LEAVE A COMMENT UNBALANCED IN
  ONE.** Both cost real time on 2026-08-04 and the second one SHIPPED. Every page in this repo styles
  itself with an inline `<style>{\`...\`}</style>` template literal, so a backtick in a CSS comment
  ends the literal and TypeScript reports a JSX brace error dozens of lines away from the cause -
  three times in one session. Worse: a stray `*/` makes the CSS parser read the prose after it plus
  the selector under it as one invalid selector and DROP THAT RULE, silently. That is how
  `.dh-slot.act` - the entire replacement for the arcs - shipped rendering nothing, past typecheck,
  past 39 contract suites, and past a browser check that confirmed the CLASS was applied without ever
  asking whether the RULE resolved. `npm run test:division-house` now strips balanced comments from
  the block and fails on any leftover `/*` or `*/`, plus unbalanced braces, plus a list of rules the
  board cannot do without. Copy that check when a new tool's styling carries something load-bearing.
  THE GENERAL LESSON, and it is the third time this file has had to write a version of it: asserting
  that a class is in `className` is not asserting that anything is on screen. Read the computed
  value - and in the preview pane finish the transition first (`el.getAnimations().forEach(a =>
  a.finish())`), because a frozen 180ms transition reports the OLD value and reads as a bug that is
  not there.
  **THE RAIL MAY NOT LIGHT A LETTER IT IS ASKING FOR.** `houseRailState` lives in
  `src/lib/divisionHouse.ts`, not in the component, because the inline version got this wrong and
  nothing could see it: a tile lit as soon as the current prompt belonged to it, so on "What
  operation are we doing here?" the D tile was the most saturated thing on the page and a student
  could clear every operation step by pressing the button whose word was glowing. That is exactly the
  shortcut `seatOps` exists to close, arriving by another road. A letter lights when it has been
  NAMED. R is never active - it is where the cycle goes next, not a step you stand in - and giving it
  one put two solid tiles on the rail on the last round of every problem.
  THE GRID IS NOT UNIFORM. The gutter is HALF a cell (`GUTTER_RATIO`), so NOTHING may compute an x
  from a column by hand - `houseLayout()` in `src/lib/divisionHouseArcs.ts` owns
  `colX`/`colW`/`colMid`/`centre`, and a stray `col * cellPx` is right on the divisor side and half
  a cell wrong on the house side, which is the hardest kind of wrong to see in a screenshot.
  `buildArc` IS PARKED, NOT DELETED, and its half of the arcs contract guards a capability nothing
  calls. It is kept because this decision has now flipped twice and the collision routing took a
  review cycle to get right; if the arcs stay gone, it and those checks go together.
  THREE THINGS THAT BIT AND WILL BIT AGAIN. **The set-up act is gated on `presentation`/`embed`**,
  read through the derived `setupPhase` and NEVER off `phase` directly - `/teacher/present` embeds
  this tool in an iframe nobody touches, so a phase waiting to be dragged through would park an
  empty house and two hovering numbers on the wall for the whole state. That skip cannot live in
  `reset`: the layout effect that discovers `?embed=1` lands AFTER the first render's `reset`, so a
  reset consulting `presentation` reads false and puts the projector back into setup. The plaque is
  INSIDE the measured stage, so its height comes off the board's height budget - spending all of it
  on the board put the last round below the fold on a 1366x768 Chromebook. And the plaque equation
  is `white-space:nowrap`: with the two numbers as chips it wrapped the divisor onto its own line on
  a two-column house, which is the one arrangement that makes a division problem unreadable.
- `/decimal-steps` IS ITS OWN TOOL, NOT PART OF `/long-division` (Steele, 2026-08-02, unprompted:
  "this is its own tool from long division"). `/long-division` (`LongDivisionHouse`) is a
  WHOLE-NUMBER choreographed demo with no scoring, built for M1.T3.L4; `/decimal-steps`
  (`DecimalStepsBoard` + `src/lib/decimalSteps.ts`) is a guided DECIMAL tool covering all four
  operations where every step is a multiple-choice decision. They both draw a long-division house
  and that is the only thing they share - do not merge them, and do not "fix" one by pointing it at
  the other.
  V2 (2026-08-03) REBUILT IT FROM TWENTY VERCEL TOOLBAR COMMENTS, and the shape change is the
  thing to keep: **A STEP IS NOT ALWAYS A MULTIPLE CHOICE.** `DecStep.kind` is `choice` | `input` |
  `move`. Students TYPE the arithmetic (every column, product, difference, quotient digit) and only
  CHOOSE on the decisions, because picking "9 + 7 = 16" off a list is recognition, not computation.
  Do not "simplify" an input step back into choices. Also from that pass, each load-bearing:
  every walk opens by naming the operation and then typing a whole-number ESTIMATE (judged by
  NEARNESS, never equality - a student who rounds sensibly a different way must pass); a CARRY is a
  decision plus a physical act (the box stands open and pulsing, then solidifies when the digit is
  typed); MULTIPLICATION IS DIGIT BY DIGIT with its own carries ("we can only multiple 2 numbers at
  once. So we strt with the 4 and the 2") - a step that multiplies a whole row is the answer
  appearing; the student CLICKS THE DECIMAL to move it and each hop leaves a big dashed arc UNDER
  the number from the old spot to the new; and the long-division house is a real L (vertical only
  down the dividend, bar across its top, quotient ABOVE the bar).
  THE CHOICES ARE SEATED, NOT WRITTEN IN ORDER. `seatChoices` shuffles by a hash of the step id,
  because every builder writes the correct answer first and a student could beat the tool by always
  tapping the top button. It is deterministic on purpose - a re-render must not reshuffle under a
  student mid-question - so do not swap it for `Math.random`, and do not add a builder that assumes
  `choices[0]` is the answer.
  THE SET-UP QUESTION IS THE WHOLE POINT AND ITS ANSWER CHANGES WITH THE OPERATION: `+`/`-` line up
  the decimal points, `x` lines up the RIGHT EDGES and ignores the decimals until you count places
  at the end, `/` moves the decimal until the divisor is whole. A student who answers "line up the
  decimals" for all four has exactly the misconception this tool exists to catch, so the adding rule
  is deliberately OFFERED as a wrong choice on the multiply board. `npm run test:decimal-steps` pins
  all four, and a change making one answer serve every operation has broken the tool's reason to
  exist. COUNTING PLACES IS A TYPED INPUT, NOT A CHOICE (corrected 2026-08-03; this paragraph
  described an offered "whichever number has more" trap and an equal-counts drop-out, and the v2
  rewrite had already made `count` an input - `decimalSteps.ts` - so there are no choices there at
  all). The student types the total; the HINT carries the rule ("6.2 has 1, and 3 has 0. Add them,
  do not take the bigger one"), which is the only place the trap survives, and it reads oddly when
  both readings give the same number.
  THE DIRECTION STEP ARGUES FROM PLACE VALUE, NEVER FROM SIZE (fixed 2026-08-03). It used to
  confirm a correct "Left" with "counting in from the right end makes the answer smaller, which is
  what multiplying by a piece of a number does" - unconditionally, so `6.2 x 3 = 18.6` told a
  student that three is a piece of a number and that 18.6 is smaller than 6.2, at the moment the
  rule is forming. The size argument only holds when both factors are under one; the contract now
  refuses any `why` on that step that mentions size.
  DIVISION MAKES THEM ACTUALLY MOVE THE DECIMAL. Naming the number of places is a separate step from
  doing it: after answering "how many places", the student hops the divisor's decimal that many
  times, then answers what happens to the dividend and hops it too (moving only the divisor is the
  error being caught). Each hop draws the caret arc you would draw on the board. Then divide /
  multiply / subtract / bring down run with the equations down the LEFT rail.
  Two layout rules that were bugs first. The product and the difference are SEPARATE rows
  (`work<i>` and `rest<i>`) - one row put them in the same grid columns and the product silently
  vanished under the difference. And nothing is written above the bracket until the divisor actually
  fits, so `7.35 / 2.1` reads `3.5`, not `03.5`. Arithmetic is integer-scaled, never float, so
  `0.1 + 0.2` is `0.3`. A problem the board cannot walk - a repeating quotient, a negative
  difference, divide by zero - is REFUSED with a reason the `/control` field prints, never silently
  dropped.
- `/number-line-plus` HAS THREE MODES, and the third is a different kind of tool. Integers and Parts
  of a whole are one draggable dot on a readout; **Order fractions** (added 2026-08-01 on Steele's
  ask) is a board where students drag a SET of cards onto a 0-to-5 line with a tick every half.
  `FractionOrderLine.tsx` renders it, `src/lib/fractionOrderSet.ts` owns the format and the judging,
  `npm run test:fraction-order` pins both. The rules are Steele's and are load-bearing:
  POSITIVE NUMBERS ONLY, 0 to 5, ticks every half; cards may be whole numbers, proper or improper
  fractions, mixed numbers, decimals or percents; a card is judged placed if it lands within
  `PLACEMENT_TOLERANCE` (0.5, the tick spacing) of where it truly sits, and the REAL verdict is that
  the cards read in ascending order left to right ("they just need to make sure they are ordered").
  Two things follow that look like bugs and are not. Cards do NOT snap to the half ticks - snapping
  would drop 7/3 and 5/2 onto the same mark and make ordering unexpressible, so placement is
  continuous and the tolerance does the forgiving. And EQUIVALENT cards are a tie: 3/2 beside 6/4
  passes in either order, which is the reason to put both in a set. Crowded cards stack into lanes
  above the line, each keeping a stem to its exact point. Nothing reveals a true position while a
  board is wrong - a check that answers itself gets used instead of the thinking - so a failed check
  only names how many cards to move (the smallest set that fixes it, not everything after the first
  mistake). DECIMALS AND PERCENTS ALREADY WORK: the compare-the-forms lesson Steele wants "later"
  needs no code, only a set like `0.75, 1/2, 60%, 1 1/4, 250%`.
- Room/display surfaces: `/warmup` and `/live-flow` are public; `/board` + `/ipad` (pen-to-board)
  are TEACHER-GATED by the proxy (they are in PROTECTED_PREFIXES - an anonymous fetch redirects to
  /teacher-login, so curl probes of them return no page markup).
- Attention call (2026-07-27, Steele's ask): the Bark pill on /ipad (always visible beside the
  Tools handle, 4s cooldown) sends `{t:"attention"}` on the `ink-<room>__ctrl` channel. /board
  handles it in its EXISTING ctrl handler; /teacher/present mounts `AttentionListener` (its first
  __ctrl join); both play the class sound (`src/lib/attentionCall.ts` - a synthesized bing-bong doorbell third,
  E5 then C5 a 0.66s quarter-note apart per Steele's timing, until `public/sounds/attention-call.mp3`
  exists - drop any clip there, Abbie's bark or his Stream Deck sound, and it replaces the chime) plus the
  two-beat Eyes-up pulse (`AttentionPulse`). `StudentAttentionSync` (root layout) gives every
  device holding `bdm-student-session` the pulse VISUAL-ONLY - sound is room-speakers-only by
  design, and its EXCLUDED_PREFIXES (/board, /ipad, /teacher) exist because joining the same ink
  room twice from one page context is never safe (supabase-js can throw on a duplicate topic
  subscribe). Autoplay: a display sounds nothing until ONE real tap after each page load (deploys
  reload displays via DeployRefresh, so re-arm after every deploy); the arming chip shows for 90s
  at load and again whenever a call arrives silent, and tapping it plays the call as a speaker
  check. The pulse fires armed or not.
- **THE ABBIE AI FEATURE IS DELETED** (unmounted 2026-07-29, files removed 2026-07-30 on Steele's
  word: "take the abbie communication files and remove them from the repo"). What follows is the
  history of how it came off; the components, the relay, abbieBus/abbieQuestions, both question
  endpoints and the `/api/abbie` proxy gate are GONE, so re-enabling is a rebuild, not a remount.
  ELEVENLABS WENT WITH IT - it lived only in `/api/abbie/voice`, and no reference to it remains
  anywhere in the repo. THE MASCOT STAYS: the art, the "Abbie Says" hints, the warmup wordmark and
  the ratio problems about her treats are not the AI feature. STILL IN THE DATABASE and needing a
  destructive migration nobody has run: the `sessions.abbie` column (no longer read or written) and
  the `abbie_questions` table, which holds student-submitted free text from when the feature was
  live - dropping it is a real privacy improvement and needs Steele's word.
  Original note follows. (Steele, 2026-07-29: "lets get rid
  of the abbie feature for now. leave it in the repo but lets take it off the site. it doesnt
  contribute to the learning"). UNMOUNTED, not deleted - re-enabling is re-adding a mount, not a
  restore from git. `AbbieTalk.tsx`, `AbbieConsole.tsx`, `AbbieStudentBubble.tsx`,
  `AbbieStudentAsk.tsx`, `src/lib/abbieBus.ts`, `abbieQuestions.ts`, the `AbbieBroadcast` type, the
  `sessions.abbie` column and the `abbie_questions` table ALL REMAIN. What came off: the two
  `<AbbieStudentBubble />` / `<AbbieStudentAsk />` mounts in the root layout (they were on EVERY page,
  student surfaces included), the `AbbieConsole` mount on `/control`, the `stage-abbie` broadcast
  bubble on `/teacher/present`, the "Abbie AI" deck section on `/teacher/remote`, the six `abbie-*`
  entries in `TEACHER_REMOTE_ACTIONS`, and the whole `/abbie` ROUTE (`src/app/abbie/` deleted -
  nothing linked to it, and `AbbieTalk.tsx` is what actually held the feature).
  TWO CONSEQUENCES THAT ARE NOT OBVIOUS. (1) `AbbieConsole` was the ONLY subscriber to `abbieBus`, so
  unmounting it made `requestAbbieLine` a no-op everywhere - `/control`'s "Have Abbie react" poll
  button and `StudentSpinner`'s "Have Abbie announce it" both had to go too, or they would render and
  do nothing. `abbieBus.ts` still exports both functions with zero callers; that is deliberate.
  (2) `scripts/classroom-surface-contract.mjs` asserted `session?.abbie?.text` on Main, so removing
  the bubble broke the suite - the anchor was replaced with `<ClassroomStateStrip`, and the same file
  now asserts the ABSENCE of any `<Abbie*` mount so the feature cannot quietly come back.
- **THE SOUND BANK REPLACED THE ABBIE DECK** (same conversation: "id rather have other sound clips
  attached to a button bank like that so i can have an applause sound and a sad trombone when i ask a
  question and i get silence or i embarrass myself"). `src/lib/soundBank.ts` is the SINGLE source of
  truth - seven cues (`applause`, `sad-trombone`, `crickets`, `drumroll`, `rimshot`, `ding`,
  `buzzer`), each with a label, a deck tone and a Web Audio synthesis function.
  THE CUE ID IS THE FILENAME. Every cue synthesizes from nothing so the bank works with zero assets
  committed, AND prefers `public/sounds/<id>.mp3` the moment that file exists - same trick as
  `attentionCall.ts`. That is why ids are lowercase-hyphenated: drop `applause.mp3` in and the
  synthesized clap is replaced with no code change. `public/sounds/` does not exist yet; do not commit
  binary audio.
  IT IS THE SAME MECHANISM AS THE TIMER CUES, NOT A SECOND AUDIO PATH. The iPad deck sends
  `play-<id>` (one flat entry per cue in `TEACHER_REMOTE_ACTIONS`, no typed payload), and `/control`
  answers it in the SAME remote-command handler that already answers
  `play-warning`/`play-countdown`/`play-times-up`, playing through the laptop's speakers. Those three
  are Control's own uploadable timer cues and are deliberately NOT bank cues -
  `soundCueIdForAction` returns null for them.
  IT IS STEELE'S OWN STREAM DECK SOUND BOARD AS OF 2026-07-30 ("these are the soundbites i would
  like mapped") - twenty-five cues, not the original seven: air horn, applause, cheering, crickets,
  drum roll, dun dun dun, Jeopardy, locked in, stank face, true, a few moments later, another one,
  bingo, bruh, directed by Robert B, we will never know, law and order, what, Metro, money, record
  scratch, straight up, OMG, be right back, you.
  THE CLIPS MAY NOW LIVE IN THE REPO (reversed 2026-08-03 by Steele: "sound clips and slide images
  can go into the repo"). The old rule here said they MUST NOT BE, for two reasons - 14MB of binary,
  and half being copyrighted recordings in a PUBLIC repository. He settled the size, and settled the
  copyright by MAKING THE REPO PRIVATE the same day (github.com/Wilsos22/Big-Dog-Math, flipped with
  zero forks and zero stars, so nothing was mirrored first). Commit them to `public/sounds/<id>.mp3`
  - see that folder's README. `npm run sounds:name -- ~/Downloads` maps a folder of download-named
  clips onto their cue ids using the SAME `matchSoundCueFile` the drag-and-drop loader uses, dry-run
  by default.
  TWO THINGS THE PRIVATE REPO DOES NOT DO, and both matter. (1) It does not make the files private:
  `public/` is served by Vercel, so `bigdogmath.com/sounds/jeopardy.mp3` is fetchable by anyone who
  guesses the URL. Private only stops repo browsing, cloning and code search - it is a real
  reduction in exposure, not a wall. Gating audio behind a teacher route is possible (only teacher
  surfaces ever play a cue; the student attention pulse is visual-only by design) and is NOT built.
  (2) Git keeps history, so removing a clip later needs a history rewrite, not a delete - which is
  why the repo must not go public again without pulling these first.
  The per-device IndexedDB loader is UNCHANGED and still first in the source order, so a clip can
  still be tried on one laptop without a commit.
  `matchSoundCueFile` places a dropped file on the right button by filename, normalizing past
  capitals, spaces, " copy" and the random suffix a download site appends, so one multi-file load
  fills the bank; a file nothing claims is reported back, never placed arbitrarily. Most cues are
  voice clips that cannot be synthesized and carry a short neutral blip until the file is loaded -
  a key pressed early must make SOME sound, because silence is indistinguishable from a broken
  button. `npm run test:sound-bank` drives the matcher with his exact twenty-five filenames.
  BUTTON NAMES ARE EDITABLE and travel to the iPad on the `soundbank` broadcast room - Control owns
  them and answers `hello` with the set, the Remote asks on mount and caches to localStorage so the
  deck reads right on reload and when Control is closed. Blanking a name restores the built-in one.
  NO SERVER STATE for any of this: a button name is a device preference and has no business in the
  live_flow snapshot Control full-replaces every second and student screens read.
  USER-LOADABLE AS OF 2026-07-30 (Steele: "a user loadable sound bank that I can assign sound
  effects to the button to trigger the clip"). THREE SOURCES, IN ORDER: a clip loaded in
  `/control`'s Sounds panel, then `public/sounds/<id>.mp3`, then the synthesized cue - so a
  button is never silent and removing a clip falls back rather than breaking. The clips live in
  the IndexedDB store `/control` ALREADY used for timer cues and per-state music, under a
  `bank:<cueId>` key - one upload mechanism on the machine with the speakers, not a second one.
  Nothing goes to Supabase: no bucket, no table, no migration. `soundBank.ts` still imports
  nothing local (its contract compiles it in isolation with the `@/` aliases dropped), so the
  store does NOT reach into it - Control reads IndexedDB and pushes decoded audio down through
  `installUserClip`, which returns false on undecodable bytes so a broken file is reported
  instead of silently ignored. Clips are per-device: loading them on a different laptop is a
  fresh load, which is the correct behaviour for a machine-local speaker cue.
  `SOUND_BANK_REMOTE_BUTTONS` in `remoteDeck.ts` is DERIVED from `SOUND_CUES`, so a new cue appears on
  the iPad with no edit there; `npm run test:sound-bank` asserts the three lists (cues, deck, action
  union) cannot drift and that no cue is missing a label or a synth. Adding a cue = one entry in
  `SOUND_CUES` plus one `"play-<id>"` in `TEACHER_REMOTE_ACTIONS`. Nothing else.
- /weekly-display is the FIFTH room surface: two all-day TVs in the back rotating
  learning intention / success criteria / week schedule / bells, fed by public
  /api/weekly-display (params ?screen= pins one view and pauses rotation, ?day=, ?track=acc,
  ?seconds=, ?course=). Public route, in DeployRefresh. REDESIGNED 2026-07-29 from the Claude
  Design "Weekly Display" board (Turn 4), and the shape of it is now load-bearing:
  - THE TARGET HARDWARE IS 55-INCH TVs AND ONLY THAT (Steele, 2026-07-29). It is a FIXED
    1920x1080 stage scaled to fit, like the `public/screens/` kit - not a fluid clamp layout.
    That is deliberate twice over: the key-term reveal MEASURES DOM positions to compute where
    the term travels, so stage pixels make it identical on every panel, and the aspect is always
    16:9 so nothing letterboxes. Do not convert it back to vw/vh. The size arithmetic that
    follows from the hardware: 1080 stage rows span about 27in of screen, so one stage pixel is
    ~0.025in, and reading at distance D wants a cap height near D/200 - which puts legibility
    from the far side of a classroom (~25ft) at roughly 85px of font size. Use that number before
    shrinking anything a student must read - it is why `successSize` floors the criterion at 88px,
    and it is the second reason only one criterion is shown: a list of them cannot clear it.
  - THE TWO STEMS ARE FIXED AND THEY ARE DIFFERENT (Steele, 2026-07-29). The learning intention
    reads "I am learning to ..." (`learningIntentionStatement` restems whatever Notion holds,
    which is normally "I can ..."). The success criteria read "I can ...". Never phrase them
    alike: the intention names what we are working toward, the criteria are what a student checks
    finished work against, and identical stems make the second screen look like a restatement of
    the first. The board's eyebrows are therefore plain labels ("Today", "You've got it when"),
    not sentence stems - if you reinstate a stem in an eyebrow it will collide with the statement.
    RESTEMMING IS THE RISKY PART AND IT SHIPPED BROKEN ONCE. Notion is authored in every voice
    ("I can ...", "We are learning how ...", "Students will be able to ...", a bare imperative), and
    a version that only knew "are learning to" put "I am learning to we are learning how splitting
    one side of a rectangle helps us write equivalent expressions" on the live board. Two rules came
    out of it: "learning how/why/what/that/about" keeps its clause and the stem drops its "to"
    ("I am learning how splitting ... helps us"), and a sentence with NO recognizable stem that does
    not open on an action verb is left exactly as the teacher wrote it, because a noun phrase under
    the eyebrow reads fine and a forced stem does not. Every phrasing is pinned in
    `npm run test:weekly-display-board` - add a case there before touching the regexes.
  - ONE SUCCESS CRITERION A DAY, FROM `Selected Success Criterion` (Steele, 2026-07-29, correcting
    a plural build the same day). That Notion property already exists and already means exactly
    this: `inspectSelectedSuccessCriterion` enforces one complete "I can" statement on one line.
    The legacy `Success Criteria` MENU must never reach this surface - `/api/weekly-display` does
    not even put it in the payload, and `scripts/success-criterion-contract.mjs` asserts both the
    route and the page stay that way, so the board and the live-lesson surfaces now agree. Read it
    with `selectedSuccessCriterion()`, NOT `publicSuccessCriterion()`: the latter falls back to
    SUCCESS_CRITERION_SETUP_PLACEHOLDER, and "Choose one I can statement in Notion." is a prompt
    to the teacher that must never appear on a classroom TV. Empty renders as
    "No success criterion chosen for today."
  - THE VOCABULARY REVEAL IS ALL-OR-NOTHING AND ITS ONLY INPUT IS A KEY TERM (the whole second act
    - the highlighter sweep, the sentence dropping away, the term flying up, the definition rising
    under it - is gated on `hasReveal`, which needs a vocabulary term that ALSO appears in the
    learning intention). With no term the board still slides in, types the sentence and pulses the
    verbs, so it does not look broken; it looks like the animation was removed. That is exactly how
    it was reported on 2026-08-03 ("it lost all of its animation and it no longer grabs the vocab
    word"), and NOTHING had changed in the code - `/weekly-display` was byte-identical to `main`.
    Diagnose it by counting animations on the live board, not by reading the source:
    `document.getAnimations()` - three (`wldSlideIn`, `wldType`, `wldPulse`) means no key term,
    twenty means the reveal is running.
  - THE CAUSE WAS TWO NOTION FIELDS WITH NEAR-IDENTICAL NAMES, and this is the third instance of
    that trap in this file. The board reads the LESSON-level `Discussion Vocabulary`; a lesson's
    terms are just as often authored on each Lesson STEP, in its own `Vocabulary` property.
    M1.T1.L2-D1 went Published with the lesson property EMPTY and five defined terms on its steps,
    so the board found nothing and the reveal switched itself off silently. FIXED 2026-08-03:
    `/api/weekly-display` now backfills a blank `discussionVocabulary` from that lesson's steps
    (`getStepVocabularyForLessons` + `mergeVocabularyBlocks`), so a lesson authored either way
    reveals. The lesson-level property still WINS when set - about 25 lessons carry a deliberately
    curated one and those are not to be overridden.
    Two rules inside the merge, both load-bearing. A DEFINED term beats a bare repeat however late
    it arrives, because a warm-up step lists bare terms ("factor", "factor pair", "divisible") and a
    later step is where they get defined - first-mention-wins would keep the bare copy and leave the
    reveal with nothing to say, which is the exact failure being fixed. Otherwise first mention
    wins, so terms stay in the order the lesson teaches them. Pinned in
    `npm run test:weekly-display-board`.
    The backfill swallows its own failures and never overrides a set property, so the worst case is
    the board it already had. Do NOT make it override, and do not make a Notion failure here able to
    500 the route - a classroom TV showing an error is worse than one showing no reveal.
  - The ground CUTS between screens instead of crossfading. The design had a .45s
    background-color transition, but every header/footer colour switches instantly, which left
    ~450ms of dark text on a lightening ground every nine seconds.
  - The bell schedule lives in `src/lib/bellSchedule.ts` as minutes since midnight, and "Now"
    plus the progress bars are derived from the classroom clock - there is no hardcoded current
    period. THE TIMES ARE REAL as of 2026-07-29, read off the district roster export (its `Period`
    column carries them, e.g. "01 07:30AM-08:23AM(1, I)") and confirmed by Steele: periods 1-5 with
    lunch 11:17-11:54 between 4 and 5, period 6 is his prep, and the day ends 1:41. PERIOD 4 IS `Math Acc 6`, which is what the
    board's `?track=acc` param is for. Pinned in `npm run test:weekly-display-board`.
    The board renders the REGULAR day ONLY. The district data also holds exam-week blocks (the
    E1/E2/E3 variants, ~105 minutes) and an alternate "I" bell where period 4 ends 11:10 and period
    5 runs 11:10-12:44 with lunch inside it - on those days the Now row is wrong, and fixing it
    needs a way to tell the board which bell is running, not a second hardcoded table.
    THAT ROSTER EXPORT IS FULL OF REAL STUDENT PII (names, DOB, student numbers, health conditions,
    IEP/PLP flags, guardian contacts and addresses). Read the schedule columns and nothing else, and
    never copy a row of it into this repo - see rule 8.
- /demo is the PUBLIC mock run-through (portfolio front door, built 2026-07-27): the REAL
  surfaces embedded in scaled iframes and driven through a scripted fictional GCF lesson
  (src/lib/demoLesson.ts) via the studio-preview bridge. /demo/present and /demo/pace are
  thin PUBLIC wrappers that re-export the gated page components - NOT an auth hole: in
  studioPreview mode the surfaces fetch nothing and render only posted data, and every data
  API stays gated (do not add fetching to the wrappers). /live-flow gained the same preview
  mode and applies studentSafeLiveFlow INTERNALLY to whatever is posted, so even the demo
  honors the privacy boundary; its preview submit is a local echo. The parent delivers
  snapshots on a 700ms drip because a fast-loading iframe's one-shot ready handshake can
  fire before the parent listener mounts. Poll answers ride the same message (Studio never
  sends them). Present/pace theme lookups now fall back through the inferrer on unknown
  semantics, and present's 1s poll-answer fetcher is preview-gated - it used to overwrite
  posted answers with its catch-to-empty every tick.
- Teacher (gated): `/teacher` and `/teacher/*` (analytics, assignments, challenges, checkpoint-upload,
  checkpoints, exit-tickets, mastery, rehearse, rightnow), `/control`, `/session`, `/roster`, `/start-question`.
- **`/teacher/rehearse` RUNS ANY PUBLISHED LESSON WITH NO SESSION** (added 2026-08-03, Steele: "I want
  to be able to view a lesson in action without changing the date"). Pick any lesson from the archive,
  step it with Restart / Back / Play / Next and a live clock, and watch it on the REAL
  `/teacher/present`, `/teacher/pace` and `/live-flow` in `?studioPreview=1` iframes. THE DATE PROPERTY
  IS UNTOUCHED and still governs the automatic pick; this only removes the need to edit a date to look
  at a lesson.
  IT OPENS NO SESSION, WRITES NO POLL ROW, RECORDS NO EVIDENCE AND PUBLISHES TO NOTHING - safe to open
  mid-period while another class runs. That is the whole reason it is a separate route rather than a
  mode on `/control`: Control's snapshot is a full-replace publish, so a "preview" living there would
  be one bug away from overwriting a running lesson (see the second-Control-tab hazard above).
  THREE PIECES, and the split is the point. (1) `src/lib/lessonFlowBuild.ts` holds `stepsFromLesson` +
  `lessonSnapshotFromNotion`, EXTRACTED VERBATIM from `/api/control-remote` so the rehearsal builds its
  sequence with the same code the real start uses - a preview built by a parallel implementation drifts
  and then lies about what the room will see, which is worse than no preview. (2) `src/lib/rehearsalFlow.ts`
  is the DB-free twin of `navigateFlow`: same mode selection, same body fallback chain, same resource
  label, same state strip, but it synthesizes the poll (`rehearsal-poll-<n>`) instead of inserting one.
  It does NOT reuse `buildStudioPreviewSnapshot`, which pads `sequence.steps` with `placeholder-<n>`
  clones because Screen Studio only ever shows one step - a run-through needs the real sequence or the
  step counter and progress strip lie. (3) `GET /api/teacher/rehearse?id=|code=` returns the built
  sequence; one Notion read, no writes.
  Unlike the live start it REPORTS rather than throws on a structured-numeric spec that will not parse,
  a part-filled state strip, and a poll step with no authored Question - a rehearsal is exactly where
  those should surface, and it also flags a lineup summing past 50 minutes.
- BROWSING ALL PUBLISHED LESSONS (same change). `/api/teacher/lessons` always returned every published
  lesson with no date filter; the UIs were what hid them. `/teacher`'s finder showed only
  yesterday/today/tomorrow until you typed a query and then capped at SIX with a "refine the search"
  line that assumed you already knew what you wanted - it now has a "Show every published lesson"
  button and a 200-row cap that exists only to bound the DOM. `/control`'s Lesson Library could load a
  lesson only by a code you remembered; it now carries a searchable Notion list beside the code box,
  fetched lazily the first time the overlay opens (Control must stay responsive all period, and most
  sessions never open it). Every row offers Edit screens / Rehearse / Begin.
- **`getPublishedLessonArchive` NOW HONOURS `Skip`** (fixed same day). It ignored the property while
  `getPublishedLessonById` rejects on it, so a skipped lesson listed in EVERY picker and then failed to
  load when clicked - the worst shape of bug, because the teacher sees the lesson is "there" and
  concludes the site is broken. `/teacher` papered over it with a keyword regex over the title, which
  never caught a lesson whose title says nothing about being skipped.
  THE PREDICATE IS DELIBERATELY DUPLICATED, not imported. `scripts/notion-lesson-archive-contract.mjs`
  compiles `notionLessonArchive.ts` with `tsc --ignoreConfig`, which DROPS the `@/` path aliases - so
  any local import in that file fails CI with "Cannot find module", and the failure looks nothing like
  its cause. Same constraint `soundBank.ts` lives under. Keep that file import-free.
  `/teacher/growth` redirects to `/teacher/rightnow`. Note: `/builder` is teacher-ish but NOT gated
  (`/abbie` was the other one; that route is DELETED - see the Abbie section below).
  The lesson flow does NOT require `/control` to run: `/api/control-remote` executes
  everything server-side - POST `start-lesson` (sessionId + notionLessonId, lessonCode as fallback -
  the by-code Notion lookup returned empty on the first live run, so prefer the page id) builds the
  flow from Notion and
  enters step 0 through the same navigateFlow as Next, POST next/previous/toggle-timer drive it,
  POST `transition-now` (vibe + seconds) opens an ad-hoc interlude that pauses the state clock while
  both projectors count it down (flow.interlude - an overlay, never a sequence mutation), and
  GET applies the lazy automatic-pacing transition (which also expires interludes and resumes the
  paused clock), so pacing advances as long as ANY surface (Remote,
  /session's toolbar) is polling. `/control` remains the full host; `/session` carries a minimal
  Start / Back / Pause / Next toolbar for rush days.
- API: gated - `/api/mastery` (+`/history`,`/recompute`), `/api/live/*`,
  `/api/roster/sync`, `/api/checkpoints/upload`, `/api/abbie` (+`/voice`). Public - `/api/today`,
  `/api/lessons`, `/api/warmup-summaries`, `/api/session/*`, `/api/auth/login`,
  `/api/evidence` (authed separately by header, see Notion pipeline).
  `/api/abbie` WAS PUBLIC and was gated 2026-07-29: it forwards whatever text it is handed straight
  to api.anthropic.com on the server's key, so an ungated prefix was an open relay anyone could
  spend on and put arbitrary text through. It is in `PROTECTED_PREFIXES` now. Do not move it back.
  `/api/form-responses` was DELETED 2026-08-05 (it returned raw district emails out of Notion - see
  rule 8). Its `PROTECTED_PREFIXES` and matcher entries in `src/proxy.ts` were deliberately KEPT:
  a prefix guarding a route that does not exist costs nothing and fails safe if one ever returns,
  and removing it would be the one edit that could let a rebuilt route come back ungated. It is
  also load-bearing for CI in a way that reads as a bug if you meet it cold:
  `scripts/proxy-gate-contract.mjs` throws when the prefix list drops below SIXTEEN, and there are
  exactly sixteen - so "tidying up" this entry fails the suite with a parse-error message that
  says nothing about why.

Slide overlays: `/teacher/slides` is the Canva-lite editor writing the Lesson Step's `Slide Overlay`
Notion property (percent-based element JSON via `src/lib/slideOverlay.ts`; rich_text values chunk at
1900 chars in `notionLessonStepWrites`). The overlay rides `LiveFlowSequenceStep.slideOverlay`
through every flow builder and `SlideOverlayLayer` renders it on `/teacher/present` above the auto
slide (below ink on board states). A step with an empty property renders exactly as before.

TWO STUDIOS AS OF 2026-07-31, and they are different tools that share a name prefix. `/teacher/studio`
is now the **Lesson Screen Studio** (the "Lesson visual design direction" handoff): it COMPOSES each
lesson's Main/Pace/Student screen from a Notion Lesson Step with a frame palette, two snapping zones,
and per-component overrides, previewed at a literal 1920x1080 scaled by a CSS transform. The prior
lesson-content EDITOR (edits Main Display, Pace Directions, routine config, slide overlays, adds
steps, and carries the iframe previews below) MOVED to `/teacher/studio/edit` - "replace" did not mean
delete it. `scripts/live-flow-contract.mjs` reads the editor at its new path.
- The Lesson Screen Studio's ONLY Notion write is a fourth `AI Context` marker,
  `[BDM_SCREEN_LAYOUT:<base64url>]` (parsed/serialized in `lessonStepMetadata.ts`, threaded through
  `notionLessonStepWrites.ts`, blob shape in `src/lib/lessonScreenLayout.ts`). Frame edits are
  additive overrides inside that blob, never content-property writes, so everything is reversible and
  a screen absent from the blob renders its derived default. `src/lib/lessonScreenModel.ts` holds the
  phase-accent tokens (keyed to CANONICAL classStates ids), palette, and default-zone derivation;
  `src/components/screen/LessonScreen.tsx` is the shared renderer.
- THE `slide` FRAME (added 2026-08-02, main projector only) puts an OUTSIDE visual inside the lesson
  chrome: an exported slide image, a live Lucid / Figma / Canva / Google Slides board, or a plain
  website. It is a persisted component type like any other, so the band, state word, step counter and
  clock are drawn around it unchanged and nothing about `/control` or the step model moves. One
  outside visual is ONE Lesson Step with its own clock - a board is its own state, never bolted onto a
  text step. `src/lib/embedUrl.ts` classifies and rewrites the pasted URL (share URL in, embed URL
  out) and is framework-free so the server may import it; the named hosts there must stay in sync with
  `images.remotePatterns` and the `frame-src` CSP in `next.config.ts`. Authoring is the block override
  `ov.slideUrl` in the layout blob, with an optional Notion `Slide URL` / `Slide Image` property as
  the auto value - so no Notion schema change is required to use it. A step whose Notion `Slide URL`
  is set derives `[["slide"], []]` as its main default. Sites that send `X-Frame-Options: DENY` cannot
  be framed and there is no way to detect that ahead of time; the renderer falls back to a worded card
  after 4 seconds rather than leaving a white void on a projector.
  THE EMBED IS SHIELDED BY DEFAULT and that is what makes ink work over it. An iframe swallows
  pointer events, so `SlideFrame` lays a transparent div over it unless `LessonScreen` is passed
  `boardInteractive` - always, in the studio, or a click meant to select the frame vanishes into the
  embed. On the pen path nothing more is needed: `/ipad` mounts its interactive `InkBoard` canvas at
  `.ip-ink-layer` z-index 6, ABOVE the whole `/teacher/present` iframe, so a stroke lands on the ink
  canvas no matter what is nested inside - the shield only stops the board fighting back on the
  laptop driving the projector.
  IT RENDERS ON THE REAL PROJECTOR AS OF 2026-08-02, and NOT by way of `LessonScreen` - present and
  pace still draw their own fluid stages (the fluid->fixed rewrite is still open). `SlideFrameScene`
  is the surface-side renderer: `/teacher/present` puts it in the scene chain AFTER poll, resource
  and published tool but BEFORE the board scene, so a poll or a tool being up means the slide is no
  longer what the step is about, while the whiteboard split shifts it to the right 58% through the
  same `board-open` rule `.stage-tool` uses. `/teacher/pace` renders it ONLY when the step sets
  `slideMirror` - the support screen's job is directions, and mirroring by default would cost the
  room its second channel. The toggle is per step, in the studio inspector on a selected slide frame.
  THE URL REACHES THE RUNTIME FROM TWO PLACES AND THE BLOB WINS: `slideFrameFromLayout` in
  notionLessons.ts decodes the saved screen layout and reads the main screen's slide block
  (`ov.slideUrl` / `ov.slideMirror` / `ov.slideFit`), falling back to the Notion `Slide URL` /
  `Slide Image` property for the URL. So authoring in the studio needs no Notion property, and a
  property set in Notion is the readable copy. `slideUrl`, `slideMirror` and `slideFit` are
  server-authored fields on `LiveFlowSequenceStep`, which puts them in the `interlude` /
  `transition` class - CONTROL'S SNAPSHOT IS A FULL REPLACE, so all four of its mapping sites carry
  them or a reconnect erases the slide mid-lesson (`lessonFlowBuild.ts` is the fifth site;
  `/api/control-remote` and `rehearsalFlow.ts` spread the step and inherit the field). Watch the
  indentation trap when adding the next such field: the 8-space and 10-space mapping lines are
  substrings of each other, so a naive replace double-applies - anchor on a leading newline.
  MIRROR AND FIT ARE READ INDEPENDENTLY OF THE URL, and the reason is a silent failure fixed
  2026-08-03: the function used to return as soon as it found a slide block carrying a url, so a
  teacher who left the studio's url field blank (letting the Notion property supply it - the
  documented readable-copy path) and flipped the mirror toggle got a toggle that saved correctly,
  read back correctly, and never reached a projector. A block naming its own url is still the
  authoritative one and its settings go with it; a bare block now lends its settings to the
  property-supplied url. `slideFit` is a free-text inspector field, so it is trimmed and lowercased
  before it decides anything - "Cover" is a teacher answering correctly. Pinned in
  `npm run test:notion-lesson-contract`.
  `slideFit` publishes ONLY when "cover" - every surface defaults to "contain", so publishing the
  default would add a constant string to a snapshot Control full-replaces about once a second.
  THE STUDIO AND DEMO PREVIEWS CANNOT SHOW A SLIDE FRAME, and it is not a bug in the frame.
  `studioPreviewFlow.ts` carries `slideOverlay` but has never carried `slideUrl` / `slideMirror` /
  `slideFit`, so the `?studioPreview=1` iframes on `/teacher/studio/edit` and `/demo` render the
  step as though no slide were authored. Verify a slide on `/teacher/rehearse` instead, which builds
  through the real `stepsFromLesson`. Closing the gap is three fields in that file's step mapping.
  THE NOTION PROPERTY IS `Slide Url`, NOT `Slide URL`, AND IT IS A FILE PROPERTY. Read it through
  `propByName` (notionLessons.ts), which normalizes case and punctuation - an exact-string property
  lookup fails SILENTLY, the site reads "" and the screen renders as though nothing was authored.
  That is the whole class of bug: verified live 2026-08-02, the property Steele created was `Slide
  Url` and the exact-match read would have found nothing with no error anywhere. Prefer `propByName`
  for any new property.
  THE NOTION-UPLOAD TRAP, AND THE ANSWER TO IT (2026-08-03). A Notion-UPLOADED file resolves to a
  short-lived SIGNED S3 url (about an hour), and Control builds its lineup ONCE at load and then
  republishes that frozen url every second - so a lesson opened at 7:30 has a dead image url by
  period 4 and the projector shows the four-second fallback card. NEVER put a classroom-critical
  slide behind a Notion upload. An EXTERNAL link pasted into the property has no expiry and is safe.
  THE PREFERRED SOURCE IS NOW A SAME-ORIGIN IMAGE: `resolveSlideSource` accepts a root-relative path
  (`/slides/m1t1l1-d1-3.webp`) for an exported slide committed to `public/slides/`, served by the
  same CDN that just delivered the page - if the page loaded, the slide loaded. No expiry, no third
  party, nothing to re-fetch, and it is why the proxy-route idea this paragraph used to call for was
  not built. Steele's standing ask when he chose it: most reliable and least likely to fail mid
  lesson. `public/slides/README.md` carries the naming, format and FERPA rules. THE REPO BEING
  PRIVATE DOES NOT MAKE THE FOLDER PRIVATE - everything under `public/` is served by Vercel to
  anyone with the URL - so no student name, district email, named student work or roster screenshot
  ever goes in it. Reserve a LIVE EMBED for a board being actively
  edited during class (a Lucid or Figma canvas the room watches change) - that is the one case where
  the live fetch is the point.
  THE GUARD IS `/^\/[/\\]/`, NOT `startsWith("//")`. The URL spec treats `\` as `/` for http(s), so
  `/\evil.com/x.png` resolves to https://evil.com/x.png and a `//`-only check let it through as
  same-origin. `npm run test:embed-url` pins it along with the four product rewrites.
  AN IMAGE GETS THE SAME WORDED FALLBACK AS AN EMBED (`SlideFrameScene`, `onError`). A bare `<img>`
  answers a mistyped or never-committed filename with the browser's broken-image glyph, which at 25
  feet is indistinguishable from a broken lesson - and "the file was never deployed" is the most
  likely failure on the path this now recommends.
- THREE DEMONSTRATION OBJECTS (`manipSplit` / `manipSnap` / `manipFree`) are a SEPARATE, EPHEMERAL
  palette (main projector only) the teacher drags live during class. Their type union is distinct from
  the 10 persisted component types, their live position lives in the studio's in-memory `manip` map
  keyed by block id, and `wireFromZones` STRIPS them so they can NEVER reach the layout blob or Notion
  (`persistableLayout` strips them before the default-compare too, so adding one never dirties a save).
  Anything that must animate on its own or react to students does NOT belong here - the latter has to
  flow through `liveClassFlow.ts`. `npm run test:lesson-screen-layout` asserts the strip.
- Design-canvas CHROME guidance (a v2 README "Design system" section) names `Panel`/`Button`/`Field`
  from `DesignSystem_901ffe` + `_ds_bundle.js`. Those are Claude Design CANVAS primitives, NOT repo
  dependencies - the studio chrome uses the repo's per-page `<style>` + `--bdb-*` convention instead,
  per the handoff's own "do not add a new styling system." Do not pull the canvas bundle into the app.
- **DIRECTION (Steele, 2026-08-03): FRAME + IMPORTED SLIDES FOR INFORMATION; NATIVE ONLY FOR THE LIVE
  LAYER. DO NOT build a native slide-composition editor** (the drag-resize grid of text/model/prompt
  components was scoped and SHELVED here - it is a worse Canva). The moat is the FRAME (state band,
  state word, step counter, shared clock, ink layer, split-whiteboard, attention pulse, class-sync)
  and the INTERACTIVE layer (tools/manipulatives, Fist-to-5, polls, checkpoints, discussion beat-timers,
  the proficiency spine) - none of which a slide app does. Anything that just SHOWS INFORMATION (direct
  instruction, worked examples, "here's the plan") is authored in Canva / Figma / Google Slides and
  imported through the `slide` frame, which the app wraps in the state chrome. Keep ONE dumb auto-default
  so the nightly grind stays zero-effort: the app composes a plain on-brand info screen from the Notion
  step, and the teacher drops in a `slide` frame only when a screen is worth designing. PREFER A PUBLISHED
  LINK (Canva/Slides share url) OVER A NOTION UPLOAD - the upload's signed url dies in ~1h (the open
  `Slide Url` expiry trap above); a published link does not. So the investment is the imported-slide path
  (stable urls, good fit/framing, wiring present/pace to render the frame), NOT the native grid.
  THE MODEL RESTS ON TWO LEGS, AND A WEAK ONE SINKS IT: (a) the frame must wrap an imported slide so it
  reads NATIVE - one designed surface, not a Canva slide with chrome bolted around it; and (b) the native
  auto-compose must be genuinely good, because killing the nightly slideshow-making was the WHOLE POINT -
  a mediocre auto-default sends the teacher into Canva every night and makes prep worse, not better.
  FOUR REFINEMENTS (honest review, 2026-08-03): (1) THE CUT IS TEMPLATED vs BESPOKE, not info vs
  interactive. Data-driven info (today's problem, warm-up, anchor, "the plan") stays NATIVE and
  auto-composed from Notion so the daily grind stays free; only BESPOKE visual info (diagrams, worked
  examples, hooks, culture-day slides) goes to Canva. Drawing the line at "all info -> Canva" turns the
  cheap daily stuff into manual design work. (2) THE AUTO-DEFAULT IS THE PRIMARY PATH, NOT A FALLBACK -
  guard it; it must be good enough that most days the teacher never opens Canva. (3) RELIABILITY: prefer
  an EXPORTED IMAGE on stable hosting (cached, no live fetch) over a live embed for classroom-critical
  info slides - school wifi flakes and a live iframe can blank mid-lesson (the 4s fallback card is a bad
  look on a projector). Reserve live embeds for boards being actively edited (Lucid/Figma). Tradeoff:
  images do not auto-update. (4) A locked "Big Dog Math" Canva BRAND TEMPLATE keeps imported slides
  on-brand - the frame holds the chrome, but the content inside drifts over a year without one.
- **PACE + STUDENT MIRROR MAIN UNLESS THEY SERVE A SECOND PURPOSE (Steele, 2026-08-03).** Under the
  direction above the default for `/teacher/pace` and `/live-flow` is to show the SAME thing as the
  main projector; they diverge only for an enumerable set of real second purposes. Today those are:
  (1) DISCUSSION - main runs the beat TIMELINE, pace + student show the sentence STEMS + VOCABULARY and
  the current beat's clock (the language support); (2) a STUDENT INTERACTIVE step - `activePoll` /
  published tool / checkpoint - where `/live-flow` shows the INPUT surface (answer boxes, choices, the
  manipulative) the student acts on, and pace shows the question + response count; (3) STUDENT-ONLY
  chrome that OVERLAYS rather than replaces - the progress strip ("part 3 of 4") and the I'm-stuck
  signal chips; (4) the speaker/readers/iPad SPINNER (a mirror, not a difference). Everything else pace
  currently shows (pace-directions + timer instead of the main content) is a HOLDOVER, not a second
  purpose - as the frame+imported-slide model lands, those surfaces should mirror the main slide and
  keep only the timer + a one-line "do this now" as an overlay. When you add a pace/student scene, ask
  first "is this a real second purpose, or should it just mirror main?"
- **REVERSED 2026-08-04. THERE IS ONE PROJECTOR DESIGN AND IT IS THE SURFACES' OWN WARM NOTEBOOK
  FRAME.** From 2026-08-03 to 2026-08-04 present and pace ALSO carried a `LessonSlideStage` overlay
  that drew the studio's `LessonScreen` (left colour band, state word set vertically in it, clock at
  the band's foot) over their own frame for "plain worded" states. Steele ran it and asked for it
  gone: "the design consistency is still not there for the slides. Some of them have the old view
  with the dots and some have the new view with the color bar. Its easier to just go back to the old
  system. with a colored pill in the top left, the timer top right with the icons for what students
  should be doing currently." So the ONE language, on both projectors, on every state, is: warm
  dotted paper, the accent state pill TOP LEFT, the clock TOP RIGHT, the classroom state strip under
  the clock. `src/components/screen/LessonSlideStage.tsx` is DELETED (restore from `8d805eb` if this
  ever flips back); both `showLessonSlide` gates and pace's four exclusion-only predicates
  (`isTransition`, `isExitState`, `hasLiveTool`, `hasAssignedResource`) went with them, and each
  surface's `<ClassroomStateStrip>` is now mounted unconditionally because nothing can double it.
  `LessonScreen.tsx` and `lessonScreenModel.ts` STAY - `/teacher/studio` and `/direction-preview`
  render them, and this removed a consumer, not the component.
  **WHY IT FAILED IS THE PART TO KEEP: A GATE MADE OF EXCLUSIONS DRIFTS, AND ON A PROJECTOR THAT
  DRIFT IS TWO DESIGNS IN ONE LESSON.** `showLessonSlide` was a pile of `!this && !that` written
  per-surface from that surface's own scene list, so which language the room got depended on which
  clause happened to match. It was reported as flipping between states; measured on `/demo`
  2026-08-04 it was worse than that - on `launch` PRESENT showed dotted paper (it has a
  `lessonVisual` clause) while PACE showed the colour band (it has no such clause), so the two
  projectors were in different design languages at the same instant. The 2026-08-03 fix had already
  been one round of hand-syncing those two lists, with a comment telling the next person to keep
  them together. If a future design lands on some states and not others, do not gate it by
  exclusion; give it a positive test both surfaces read from ONE place.
  THE OVERLAY WAS PURELY ADDITIVE, WHICH IS WHY REMOVING IT COULD NOT BLANK A ROOM: it was
  `position:fixed; inset:0; z-index:12` painted OVER a frame each surface had already rendered in
  full. Verified 2026-08-04 across 15 states per surface on `/demo` - zero full-viewport overlays,
  present's pill fixed at 31,89 and its clock 32px off the right edge on every one; pace's chip at
  54,20 and its clock 30px off the right edge on every one.
  STILL TRUE, AND NOW THE OPEN LOOP: the studio's SAVED layout blob (`BDM_SCREEN_LAYOUT`) was never
  threaded through the live flow, so the overlay only ever showed `defaultZones` derived from the
  Notion step. With it gone, **`/teacher/studio` composes screens that reach no projector at all** -
  it is an editor with no output path. That is a known consequence of this reversal, not a bug to
  "fix" by remounting the overlay. The DIRECTION above is unchanged and is the answer: the frame
  wraps an IMPORTED slide, so the route to the wall is the `slide` frame, not a native zone grid.
  THE DIAGNOSTIC SURVIVES, WITH ITS EXPECTED ANSWER FLIPPED: in a surface's document, find every
  element with `position:fixed` and `z-index >= 10` filling the viewport. The correct count is now
  **zero on both projectors, on every state**. One unnamed full-viewport div means something is
  covering the frame again. That check separated "pace is broken" from "pace is covered" in about a
  minute on 2026-08-03, and it is what proved the removal on 2026-08-04.

The lesson-content editor's previews are the REAL surfaces, not copies: `/teacher/studio/edit` embeds
`/teacher/present?studioPreview=1` and `/teacher/pace?studioPreview=1` in scaled iframes and posts
the draft as a `LiveClassFlowSnapshot` (built by `src/lib/studioPreviewFlow.ts`) over
`postMessage`. The surfaces detect `?studioPreview=1`, skip the session fetch, and adopt the posted
snapshot as a synthetic session so every downstream render is unchanged. This is why redesigning a
surface never needs a matching editor change again - do NOT rebuild hand-copied studio previews.
`/demo` and `/live-flow` also depend on `studioPreviewFlow.ts` / `?studioPreview=1`, so it must not be
removed. (The Student and Remote studio previews are still hand-built; embed them the same way when
they drift.)

Main projector warm-up screen: when the warm-up state has no anchor "Puzzle of the day" posed, the
Main (`/teacher/present`) fills its empty real estate with a big animated "steps of learning"
culture list (`WarmupLearningSteps` in `src/app/teacher/present/page.tsx`; edit the `LEARNING_STEPS`
constant to change the words). It is deliberately state-scoped to `warmup` and yields to the anchor
puzzle when one is set - so the warm-up Main is never blank, and this is expected, not a stray view.

Adding a tool: also add a lowercase entry to `TOOL_ROUTES` in `src/app/lesson/page.tsx` or the Notion
`Tool:` name renders as a dead pill. SiteNav link sets are hardcoded arrays - add nav entries manually.

Same trap on the live-session side: listing a route in `LiveToolRoute` (`src/lib/liveClassFlow.ts`)
only lets the teacher PUBLISH a task to it. The tool component must also call
`useLiveToolConfig("/route")` and render `<LiveToolBanner tool={...} />`, or the published directions
are silently dropped and students see nothing. All 20 tool routes are wired as of 2026-08-02
(/divisibility joined the union that day, end to end: ASSIGNED_TOOL_ROUTES so Notion "Tool:
Divisibility Rules" resolves, ClassSync target, tool-divisibility bank state, control map, and the
banner on DivisibilityRules) - a NEW
route is the case to watch, so wire the component in the same change that extends `LiveToolRoute`.
Where a route's `LiveToolConfig` arm carries a typed payload (`/number-line-plus`, `/percent-bar`,
`/equation-builder`, `/order-of-operations`, `/algebra-tiles`, plus THREE teacher-set sequence arms:
`/distributive-area` `{ set }` - "24x7,16x8" via `src/lib/distributiveProblems.ts`,
`/ladder-method` `{ set }` - "24,36,60" for Factor Trees via `src/lib/factorTreeSet.ts` - and
`/number-line-plus` `{ start, change, fractionSet? }` - "1/2, 7/3, 2 1/4" via
`src/lib/fractionOrderSet.ts`, where a `;` or newline starts another round) the tool
also applies `tool.config` to its own state - always in an effect keyed on `tool.id`, never on the
tool object (`useLiveToolConfig` re-reads every second, so object identity churns and an
object-keyed effect restarts the student's problem mid-answer; `PercentBar` is the pattern). All
three sequence tools also take the same string as a `?set=` URL param, resume progress per device
from localStorage, and treat an empty set as free play. The remaining arms are
`Record<string, never>`, where the prompt is all there is - do not invent config behavior for them.
`/number-line-plus` is the one arm carrying TWO independent configs: a non-empty `fractionSet` wins
and opens the ordering board, an empty one leaves the integer hop problem exactly as it was, so the
field is optional and pre-existing snapshots still parse. A FOURTH sequence arm joined 2026-08-02:
`/decimal-steps` `{ set }` - "12.4 + 3.75, 9.6 / 0.4" via `src/lib/decimalSteps.ts`, any of the four
operations in one string.

Counting those arms, `LiveToolRoute` has 23, not 20: `/challenge`, `/exit-ticket` and `/checkpoint`
ride the same union so `/control` can publish them, but they deliberately do NOT call
`useLiveToolConfig` - do not "fix" them by wiring the banner. Each has its own launch path
(`launchChallenge`, `launchExitTicket`, `launchCheckpoint`) writing the real content to `challenges` /
`exit_tickets` / `checkpoint_runs`, and the student surface polls that table instead (`/exit-ticket`
reads `getOpenExitTicket`). Their `buildLiveToolConfig` result is only a marker for the control
panel's own published-state UI, and the teacher's question comes from a dedicated field
(`toolSetup.exitPrompt`), not the generic tool prompt - so nothing is dropped.

`LiveToolBanner` styles itself from `--bdb-*` tokens; it is shared, so do not hardcode a hex into it.
Every tool page it renders on is a light surface - cream (`--bdb-ground`) except
`/multiplication-fluency`, which is white, where the amber rail and hairline border carry the
separation. Its optional `style` prop is for PLACEMENT only (it merges last): `/area-model` and
`/coordinate-grid` pass `gridColumn: "1 / -1"` because their main container is a two-column grid.
Watch for a root with a fixed `grid-template-rows` - adding the banner as a new direct child shifts
every row (`.mf-root` on `/multiplication-fluency` is why the banner shares a wrapper with the mode
tabs there).

## Auth

The only enforced gate is `src/proxy.ts` (formerly `middleware.ts` at the repo root - update stale
references on sight). Without `TEACHER_PASSWORD` set, protected APIs return 503 and protected pages
redirect to `/teacher-login?error=configuration`. It gates a request when the path matches
`PROTECTED_PREFIXES` (`/teacher`, `/control`, `/session`, `/roster`, `/ipad`, `/board`,
`/start-question`, `/api/form-responses`, `/api/mastery`, `/api/live`, `/api/roster`,
`/api/checkpoints`, `/api/submissions`, `/api/teacher`, `/api/control-remote`,
`/api/warmup-summaries` - `/api/iready` and `/api/outreach` left the list 2026-07-31 when their
Notion-backed routes were deleted in the FERPA cutover) - plus, when `NEXT_PUBLIC_SECURE_STUDENT_DATA=true`
(production has this ON), `SECURE_ROLLOUT_PREFIXES` `/api/session` and `/api/warmup`. Student-facing
endpoints therefore live under `/api/student/*` (never gated here) and are dual-mode: secure rollout
authenticates via `requireVerifiedStudent()` in `src/lib/studentIdentity.ts`; transitional mode
accepts the claimed id at the server boundary. Copy `/api/student/session-state` when adding one.
It authorizes via,
in order: (1) the `bdm_teacher` device cookie (value = lowercase SHA-256 of `bdm-teacher-cookie-v1|<TEACHER_PASSWORD>`,
`teacherToken()` in `src/lib/teacherToken.ts`, ~6-month expiry); (2) `Authorization: Bearer <CRON_SECRET>`
(Vercel cron); (3) HTTP Basic (user `TEACHER_USERNAME` or `teacher`, pass `TEACHER_PASSWORD`, which also
sets the cookie). Unauth: `/api/*` gets JSON 401; pages redirect to `/teacher-login?next=...`.

- Adding a protected route requires editing BOTH the `PROTECTED_PREFIXES` array AND the `config.matcher`
  in `src/proxy.ts` (Next.js needs static-analyzable literals). Keep them in sync.
- A shell `curl` that returns 401 on `/api/live/*` or `/teacher/*` is EXPECTED, not a bug - those need
  the cookie, Basic auth, or a Bearer cron token. In-browser fetches from a logged-in teacher tab carry
  the cookie automatically.
- `src/lib/teacherAuth.ts` / `NEXT_PUBLIC_TEACHER_PIN` / `TeacherGate.tsx` is LEGACY client-only soft
  auth, not wired into any page. Do not confuse it with the real gate.
- Student "session" is unauthenticated trust: `localStorage['bdm-student-session'] = {sessionId,
  studentId, name}` written client-side. Never rely on it for authorization.
- `studentSafeLiveFlow` (`src/lib/liveFlowPrivacy.ts`) is the student privacy boundary: it passes a
  MINIMAL public sequence (currentIndex, totalSteps, nextLabel, nextDirections, advanceMode - the
  student progress strip needs position) but NEVER `sequence.steps`, because steps carry correct
  answers and teacher notes. Related trap: `publicSuccessCriterion()` falls back to the teacher
  setup placeholder ("Choose one I can statement in Notion.") - fine on teacher/projector
  surfaces, WRONG on student screens; student-facing code uses `selectedSuccessCriterion()` and
  filters `SUCCESS_CRITERION_SETUP_PLACEHOLDER` (the snapshot's `successCriteria` can carry the
  placeholder too).
- Student session-state reads go through `fetchSharedSessionState` (`src/lib/studentSessionShared.ts`)
  in secure mode - a single-flight ~3s cache shared by ClassSync, /live-flow and useLiveToolConfig
  (AbbieStudentBubble was the fourth consumer until it was unmounted 2026-07-29; the 0.27 req/s per
  device measured then, down from ~1.5, is now a ceiling). A NEW consumer that calls
  `studentApiRequest` for session-state directly reintroduces the per-device request storm - go
  through the shared fetcher.
- Class-mode following is `ClassSync` in the root layout: every student device polls
  `/api/student/session-state` every 3s and navigates by `sessions.broadcast` ("free" releases,
  an explicit route sends, "live-flow" follows the lesson state - students are deliberately HELD
  on the student homepage during the warmup state and only start moving on the first advance past
  it). Every start path flips broadcast to live-flow (`/api/control-remote start-lesson` does it
  atomically; /control's four launch paths call `switchSessionToLiveFlow`). TESTING TRAP (cost a
  live debugging session 2026-07-22): on a device that has ever held a TEACHER session, a tab only
  follows if it carries the per-tab student marker (`sessionStorage['bdm-student-tab']`, set when
  the verified join completes, DIES on tab close and on Safari tab restore) - a reopened student
  tab on the teacher's own browser silently stops following forever; re-entering the class code
  re-arms it. Real student Chromebooks (no teacher session) never hit the guard. Also know:
  ClassSync treats every session-state failure (wrong period, missing session_joins row, expired
  anon auth) as transient and retries silently, so ALL of them present identically as "the student
  screen just stays put" - check the class-mode selector on /session and the joins list before
  suspecting the follower itself.
  **`TEACHER_ROUTE_PREFIXES` MUST MATCH THE PROXY'S TEACHER SURFACES.** `/ipad` and `/board` were
  missing from it until 2026-07-30 (noticed while fixing the ink channel bug, fixed with Steele's
  word the same day; never seen in class). Two guards normally kept it inert there - a stored teacher
  session on the device, or no stored student session at all - but an iPad that ever typed a class
  code and never held a teacher session satisfied neither, and `router.push(target)` would have
  navigated it OFF the pen surface mid-lesson, mid-stroke, with the room's board still up. The list is
  now `["/teacher", "/control", "/session", "/roster", "/ipad", "/board"]`. A route the proxy gates as
  a teacher surface goes in BOTH places; nothing tests that pairing, so check it by hand when adding
  one. Note this list is about class-mode NAVIGATION, not access - `/join` has its own
  `STUDENT_SWITCH_ROUTE_PREFIXES` escape and is deliberately not a teacher route.
## Data layer (Supabase)

- TABLE CAPTAINS AND THE CLOSEOUT SUPPLY CHECK (built 2026-08-03, migration
  `supabase/table-captains-and-supply-checks.sql` - Steele runs it by hand like every other file in
  that folder; the feature is DARK until he does, and the `table_number` select in
  `/api/roster/sync` is the first thing that 500s if he has not). Three pieces. `students.table_number`
  is nullable physical seating pushed from the Workspace roster Sheet's optional Table column - a
  BLANK cell means "the Sheet is not tracking seating", never "clear this student's table", so a
  half-filled column cannot wipe what the rest of it just set. `table_captains` is one row per
  (period, week_start, table); `week_start` is the MONDAY in America/Los_Angeles, so a Wednesday
  re-spin overwrites Monday rather than opening a second week. `supply_checks` is one row per
  (session, table) and the LATEST tap wins - a table that finds the missing marker before the bell
  ends the day green, and a mis-tap is fixed by tapping again.
  THE RULE IS CONSECUTIVE MISSES, and it lives in exactly two places: the `supply_check_streaks`
  view and `standingFromStreak` in `src/lib/tableCaptains.ts`. Two reds in a row flags a table; ANY
  green wipes the streak. Do not re-derive it in a component.
  The captain spinner works with NO seating chart, and that is deliberate, not a stopgap:
  `/api/teacher/table-captains` returns a candidate pool per table, which is the whole period until
  the Sheet has tables, and `pickCaptains` in `TableCaptainSpinner.tsx` keeps the picks distinct.
  It draws SMALLEST POOL FIRST so constrained tables commit while the field is still open. When the
  Sheet grows the column, each pool narrows and nothing else changes.
  The captain's alias renders as a first name on the projector through the browser-local name key -
  the SAME deliberate room-facing FERPA exception the reader and speaker spinners carry (rule 8),
  for the same reason. Nothing in this feature writes or transmits a name; `supply_checks` has no
  student reference at all, because a table is furniture.
  **THE PROJECTOR'S COPY HAS NO BUTTONS ON PURPOSE - THE TAPS ARE ON THE REMOTE.**
  `SupplyCheckBoard` takes `mode`, and `mode === "board"` returns EARLY with a read-only card grid
  ("Captains, answer for your table"); only `mode === "remote"` renders the tap rows, and the
  Remote gates them to `SUPPLY_CHECK_STATE_IDS` (closeout plus the three supplies-away states).
  Steele reported "the captain supplies check at the end doesnt have clickable buttons" on
  2026-08-03 and the answer was that he was looking at the display. Do NOT "fix" this by adding
  buttons to the board branch - an agent (this one) started exactly that patch before TypeScript
  refused it, because `mode` is already narrowed past the early return.

- Browser client: `getSupabase()` in `src/lib/supabase.ts` (`NEXT_PUBLIC_SUPABASE_URL` +
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Server client: `getSupabaseAdmin()` in `src/lib/supabaseServer.ts`
  (`+ SUPABASE_SERVICE_ROLE_KEY`). Both return `null` when env is missing - null-check every call.
- RLS posture: PRODUCTION IS LOCKED DOWN (verified live 2026-07-21 - anon gets 401/permission-denied
  on `periods`, `students`, `sessions`, `responses`, `practice_assignments`, and the rest of the old
  permissive group). `supabase/student-data-security.sql` removed the `prototype_all` policies, so
  every student read/write goes through an authenticated `/api/*` route (`requireVerifiedStudent`
  for `/api/student/*`, teacher gate for the rest); browser-side `getSupabase()` calls against those
  tables silently fail in production and survive only in un-hardened dev environments.
  `supabase/student-data-security-rollback.sql` restores the old posture if ever needed. Still true:
  server-only spine tables (`mastery`, `mastery_history`, `recommendations`, `iready_scores`) are
  service-role only, and the read-only reference group (`standards`, `standard_prereqs`,
  `misconceptions`) allows anon SELECT. `mastery_config` was listed here too and does NOT: it
  returns 42501 to anon like the spine tables (re-probed live 2026-07-30). Locked tighter than
  documented, so nothing to fix - but do not plan a browser read against it.
  RE-VERIFIED LIVE 2026-07-30, against a Gemini audit that reported the opposite. Every one of
  `students`, `periods`, `sessions`, `session_joins`, `polls`, `poll_answers`, `responses`,
  `challenge_attempts`, `practice_assignment_attempts`, `exit_ticket_responses`,
  `checkpoint_results`, `mastery`, `mastery_history`, `recommendations` and `iready_scores` returns
  **401 / Postgres 42501 "permission denied for table"** to the public anon key, for SELECT AND
  INSERT - the GRANT is revoked at the role level, so no policy is even evaluated. The reference
  group returning 200 in the same sweep is the control that proves the probe was live. If an audit
  claims `prototype_all` is still open, it is reading a pre-hardening snapshot: re-run the sweep
  before believing it. THE AUDIT WAS RIGHT ABOUT ONE THING - `students.full_name` / `email` were
  real names and district emails; that project is now BUILT (rule 8, 2026-07-31): the FERPA branch
  replaces them with `alias` + `email_hmac`, and `ferpa-pii-scrub.sql` drops both columns at
  cutover.
- `supabase/audit-exposure.sql` IS THE SELF-AUDIT - run it in the SQL Editor instead of trusting
  anyone's summary. Read-only: anon and authenticated grants with policy counts, policies that
  filter by nothing, every column whose name suggests an identifier, row counts, and a direct
  impersonated read wrapped in `begin`/`rollback`. Section 7 lists the checks SQL cannot make.
  It was an untracked file for a day and TWO outside audits read it as implemented logging the
  project does not have - the real audit trail is `src/lib/securityAudit.ts`
  (`recordSecurityEvent`), used by the join, admission, warmup-verify, roster and session routes.
- Migrations are idempotent and hand-run; each schema-changing file ends with
  `notify pgrst, 'reload schema';`. Adding a table means writing a new `.sql`, choosing its RLS group
  deliberately, and running it in the SQL Editor. Order matters: `schema.sql` -> `proficiency.sql` ->
  `evidence.sql` (which makes `responses.problem_id` nullable and adds `source/domain/standard_id/
  item_ref/dedupe_key`).
- Roster sync is a PSEUDONYMOUS PUSH from the Workspace roster Sheet (rule 8, 2026-07-31):
  `warmup-roster-push.gs` POSTs `{alias, emailHmac, period}` rows to `/api/roster/sync` with Bearer
  CRON_SECRET, and the route REFUSES anything identified. It is still an UPSERT that NEVER deletes
  (missing rows are reported by alias). The Notion pull, `notionRoster.ts`, and the daily Vercel
  cron are GONE - `vercel.json` has no crons, and a GET on the route returns 410. PRE-CUTOVER TRAP:
  until the FERPA deploy ships, production still runs the old Notion cron at 13:00 UTC, so wiping
  `students` still undoes itself unless Notion is cleared first; after the deploy that hazard is
  dead. `supabase/end-of-year-student-wipe.sql` still deletes child rows explicitly (several FKs
  are ON DELETE SET NULL and would otherwise strand rows still carrying `display_name`).
- Student PII never leaves district systems. `/api/live/next-move` used to send student NAMES to the
  Anthropic API with their misconception; it now sends `studentCount` only (2026-07-22). Any new
  outbound call must pass counts/archetypes, never names or student work.
- Two distinct "assignment" concepts: `assignments` (manipulative) vs `practice_assignments` (targeted
  practice) - do not conflate. `practice_assignments` is the ONLY assignable homework that exists:
  created at `/teacher/assignments` (a `challengeSkills` key + level 1-3 + round count + one period or
  all), discoverable by students only on `/explore` or a hand-pasted `/assignment/<id>` link, and it
  works from home with no live session. `assignments` / `assignment_problems` / `problems` have full RLS
  policies in `student-data-security.sql` but ZERO application code - schema without a UI, so assigning
  a manipulative is not a capability yet.
  **BRIDGED 2026-08-04 - READ THIS BEFORE THE PARAGRAPH BELOW, WHICH IS NOW HISTORY.**
  `src/lib/pollEvidence.ts` + `POST /api/teacher/poll-evidence` turn graded poll answers into
  `responses` rows and then call `recomputePeriod`, so the learning checks and the exit ticket do
  now move a bar. What it grades is DELIBERATELY NARROW (Steele, 2026-08-04): `structured-numeric`
  and `multiple-choice` only. NOT `short-answer` (bare string equality marks a right answer wrong
  over a stray space - and note M1.T1.L5-D1's exit ticket is that kind, so that lesson's exit still
  contributes nothing), NOT `multiple-choice-explain` (readinessEvidence cannot see the kind at
  all, so bridging it would make the bars and the visit list disagree about one student - fix the
  reader first), and NOT `fist-to-five` (a confidence self-report must never score a standard).
  FOUR THINGS THAT WILL BITE WHOEVER TOUCHES IT. (1) **The bar row carries `standard_id: null` and
  that is not a mistake** - `recompute.ts:133` filters bar events to `!standardId`, so attaching
  the resolved standard is exactly the edit that stops the bar moving. There are two row shapes: a
  per-question STANDARD row for the stage gate, and one aggregate BAR row. (2) **The bar row is one
  per student per lesson per domain, not one per question.** The bars are an EWMA at alpha 0.30 per
  event, so a row per question would take a domain bar 60 -> 42 -> 29 -> 21 -> 14 on four wrong
  answers in one period, where a whole warm-up day is a single step. Every other writer aggregates
  first; this matches them. (3) **Notion's `Standard` property does not match the seeded
  `standards` ids** - measured on the live `polls` table, five of the six distinct authored values
  were unseeded (`6.NS.4` omits the cluster letter, and some carry two codes as `6.EE.2b; 6.EE.3`).
  `normalizeStandardId` inserts the cluster letter when exactly one seeded id qualifies and takes
  the first RESOLVABLE code of a list; anything left over is REPORTED, never guessed, and a poll
  with no resolvable standard writes nothing at all (a domainless row is dropped by recompute with
  a bare `continue`). (4) **A multiple-choice key that is in none of the choices makes the poll
  ungradable, not the class wrong** - see the `splitList` trap below. `npm run test:poll-evidence`
  pins all four, and each was verified by reverting the fix and watching the suite go red.
  STILL TRUE and still the gap: `practice_assignment_attempts` and 16 of 23 tools reach nothing,
  and nothing calls the bridge automatically yet - it is a route you POST, and `GET` on it is a dry
  run. Also NOT verified end to end, because `poll_answers` has zero rows lifetime until the FERPA
  Workspace half lands.
  **A MULTIPLE-CHOICE ANSWER KEY CAN BE UNTAPPABLE** (found 2026-08-04, PARSER FIXED THE SAME DAY -
  this paragraph used to end "the AUTHORING bug is unfixed", which is no longer true). `splitList`
  splits on `[\n,]`, and `Choices` used to be read through it while `Correct Answer` is read whole,
  so an authored choice containing a comma was shattered and the key matched none of the fragments.
  `Choices` now goes through `splitChoices` (newline only); `splitList` KEEPS its commas for
  `Supplies` and `Tools`, which really are authored inline. `npm run test:notion-lesson-contract`
  pins BOTH directions, so the tempting unification - make `splitList` newline-only and delete
  `splitChoices` - goes red on the supplies assertion.
  THE CAUSE WAS NOT MAINLY PROSE, WHICH IS WHY IT SURVIVED SO LONG. Measured on the live Lesson
  Steps data source: 121 steps carry authored choices, 14 have a comma INSIDE a choice, and ZERO
  author their choices comma-separated on one line - comma splitting never once did anything useful
  on that property. The commonest shape is a THOUSANDS SEPARATOR: `2 / 20 / 200 / 2,000` became
  `2, 20, 200, 2, 000`, inventing a fifth choice and putting "2" in twice (two identical entries
  also collide as a React key - `key={c}` at `lesson/page.tsx`, and six other surfaces share it).
  A factor-pair list, `1, 2, 3, 6` against `1, 2, 3, 4, 6`, became 17 fragments and was then
  silently TRUNCATED by the 12-choice cap in `/api/teacher/poll`. The worst cases were the ones
  whose key happened to match a surviving fragment: those passed `answerKeyIsTappable` and GRADED
  NORMALLY off a choice list the room could see was wrong. Four steps go from untappable to
  gradable with this fix.
  `answerKeyIsTappable` STAYS, and its reason is unchanged - a teacher can still type a key that
  matches no choice for ordinary reasons, and three live steps do exactly that (two with a prose
  sentence as the key, one with an EMPTY `Correct Answer` on a 4-choice step). Nothing names them at
  lesson load, so they contribute no evidence until someone edits them. That is AUTHORING.
  TWO "CHOICES" INPUTS EXIST AND THEY HAVE OPPOSITE RULES. `/control`'s own exit-ticket field is
  labelled "Choices (comma-separated)" with the placeholder "Yes, No, Not sure" and still splits on
  `[\n,]` - correct for a field a teacher types into directly. The Notion property is one per line.
  Nothing in Notion says so, so the habit can cross over, and the failure is silent and room-facing:
  one button reading "Yes, No, Not sure" on thirty Chromebooks. Do not "unify" these two.
  THE 3 SHATTERED `polls` ROWS IN THE DATABASE ARE NOT REPAIRED, and the reason is narrower than it
  looks. `/api/student/session-state` DOES read a stored open poll's `choices` and `/lesson` renders
  them verbatim, so a reader-side fix is invisible on a poll left open - this is safe ONLY because
  `poll_answers` is 0 rows lifetime and ZERO polls sit on an open session (all 80 rows are dead
  rehearsal artifacts). If a shattered poll is ever found open, fix the ROW, not the parser.
  THE ORIGINAL NOTE (found 2026-07-29), kept because its reasoning is still the reason the bridge
  looks the way it does: **`poll_answers` NEVER REACHES `responses`, SO THE EXIT TICKET MOVES
  NO MASTERY BAR.** Steele moved the exit ticket on-site specifically for data retention and mid-lesson
  deployment - no Google Form to click into - and the rows do persist. But every exit step in the
  deployable lessons carries a `Response Mode` + `Question`, so `navigateFlow` creates a POLL and the
  answer lands in `poll_answers`. There are exactly TWO writers into `responses`: `/api/evidence` (the
  warm-up and Apps Script ingest) and `/api/student/tool-evidence` (+`toolEvidence.ts`). Nothing copies
  a poll answer across. `recompute.ts` reads only `iready_scores`, `responses`, and
  `checkpoint_results`, so the day's ONLY conceptual evidence contributes nothing to the EWMA bars, no
  per-standard stage gate, and nothing to the misconception clustering in `/api/live/groups`. It is not
  wasted - `readinessEvidence.ts` reads it for the visit list and the readiness tallies, and
  `/api/submissions` and `/api/teacher/poll` show it live - but it stops at the session. This is the
  THIRD instance of the same gap (see `practice_assignment_attempts` below and the tool-evidence
  limits), and it is the most consequential, because the exit ticket is the evidence the day is
  designed around. Bridging it means writing a `responses` row per graded poll answer with a real
  `standard_id` and a seeded misconception tag; do not claim the spine sees exit tickets until that
  exists.
  TRAP (verified 2026-07-26): assignment attempts write ONLY to `practice_assignment_attempts` and
  NEVER to `responses`, so they move no mastery bar, no per-standard stage gate, and no archetype
  grouping - nothing on `/teacher/mastery` or `/teacher/rightnow` sees them. `formative.sql`'s header
  comment ("each attempt is logged exactly like a game attempt so it feeds the same mastery read") and
  its `skill` column comment ("for easy mastery rollups") both describe intent that was never wired.
  Do not repeat them as fact. `recompute.ts` reads only `iready_scores`, `responses`, and
  `checkpoint_results`, and coerces source to `'warmup' | 'tool'`. Same shape on the tool side:
  `reportToolResult` fires only when the device has JOINED a live session, and only 7 tools emit at all
  (equation-builder, gems, combine-like-terms, balance-beam, area-model, distributive-area,
  area-explorer) - so at-home tool practice records nothing either.
- `src/lib/challengeSkills.ts` (15 skills as of 2026-07-26) is the shared problem bank for `/challenge`
  AND `practice_assignments`; adding one entry there is all a new drill needs, no UI change. `emoji` is
  optional (new skills omit it per rule 1). `standardId` carries the dotted-letter CCSS as seeded in
  `standards`; `Problem.misses` maps a wrong choice to a canonical `misconceptions` label so drill
  evidence can feed grouping once attempts reach `responses`.
- MISCONCEPTION TAGS ARE EXACT-MATCH BUT **NOT** FOREIGN-KEYED (corrected 2026-07-28; the old line
  here said "exact-match and foreign-keyed", which is wrong and made the failure sound loud).
  `responses.misconception` is plain `text` (schema.sql:83) - only `recommendations.misconception`
  has the FK. So an unseeded tag NEVER errors. It writes fine, it still clusters, and it silently
  loses its domain (i-Ready corroboration in `/api/live/groups` goes to zero) while any teacher move
  authored against it renders blank. The cluster still appears, just uncorroborated and unplanned.
  `src/lib/misconceptions.ts` now holds the vocabulary in TypeScript - type a new emitter's tag as
  `MisconceptionTag` and a bad label is a compile error at the call site - and
  `npm run test:misconceptions` asserts it matches the `supabase/proficiency.sql` seed in BOTH
  directions, so adding a tag means editing both files and running the SQL. Two known divergences are
  recorded as a backlog the contract forces to shrink: `AreaExplorer.tsx` emits five HYPHENATED tags
  (`slant-for-height`, `swapped-dims`, `compute-error`, `linear-unit`, `cubed-unit`) that match
  nothing - it is one of the seven tools that actually emit evidence, so every `/area-explorer` miss
  has been clustering into a domainless singleton - and `sbacCheckpoints.ts` uses ~39 free-text prose
  notes instead of the vocabulary. Both need Steele's vocabulary call, not an invented relabel.
- Student signals (the "I'm stuck" tap): fully live as of 2026-07-26 - Steele ran BOTH
  `supabase/student-signals.sql` (chips on /live-flow, counts on /session + /teacher/remote)
  and `supabase/student-signal-controls.sql` (per-student mute + the sessions.signals_off
  switch). The ships-dark probe pattern remains load-bearing for future environments: student
  chips probe `/api/student/signal?sessionId=` per lesson step (so the off switch bites at the
  next advance), teacher surfaces read `enabled`/`controls` from `/api/live/signals` - do not
  "fix" hidden chips/buttons by removing the probes. Design is click-only BY DECISION (Steele,
  2026-07-26): no free-text student input - fixed chips are the spam filter; plus a 10s server
  cooldown on writes, signals never render on public surfaces, and mute gives the student no
  feedback (their chip keeps working, it just goes nowhere).
  **A MOCK RUN CANNOT SEND A SIGNAL, AND THAT IS THE FEATURE WORKING** (2026-07-30). As of that
  date `student_signals` has ZERO rows lifetime - not a bug, and not evidence of one: no real
  student has used the site yet, and a mock device cannot write. The POST needs BOTH
  `requireVerifiedStudent` (an anon auth user LINKED to a roster student, which only completing
  the Google warm-up creates) and a `session_joins` row carrying that `student_id`. A device
  typing a class code gets a PROVISIONAL session with an empty studentId, so it fails the first
  gate with 428 `warmup_verification_required`. Steele hit exactly this and read it as a dead
  button. Before debugging signals, check `select count(*) from session_joins where student_id is
  not null` - if it is zero, nothing is broken and nothing can be proven either. THE WHOLE CHAIN
  IS STILL UNPROVEN END TO END; the first real verified student to tap a chip is the test.
  **IT IS NOT JUST SIGNALS - THE SAME GATE STOPS EVERY STUDENT WRITE, AND THEY ALL PRESENT AS A
  DEAD BUTTON** (2026-08-03, live). Steele reported the fist-to-5 "lets the student click it but it
  doesnt register on the board" and the stuck chip saying "wait for the teacher to let you in", and
  both are this one gate: `/api/student/poll-answer`, `/api/student/signal` and
  `/api/student/tool-evidence` all call `requireVerifiedStudent`. Measured that day on the live DB:
  `students` 167 rows, students with `auth_user_id` **0**, `session_joins` on the open session
  **0**, `student_signals` lifetime **0**, poll answers on the running session **0** against 6
  polls created. So no student write can succeed AT ALL until the Workspace half of the FERPA
  cutover lands (rule 8; `supabase/FERPA-CUTOVER.md` steps 1, 2, 5, 6, 8 - the roster Sheet, the
  HMAC key, the Apps Script paste-ins, the roster push, one real warm-up). THE ONE QUERY that
  settles it before debugging any student-facing write:
  `select count(*) from students where auth_user_id is not null;` - zero means the surface is
  behaving correctly and no amount of front-end work will change it.
  HOW TO TEST THE HALF THAT CAN BE TESTED (2026-07-30): the WRITE needs a district Google account and
  cannot be faked - seeding a roster row does NOT help, because the gate is `linkedStudent(auth.uid)`
  at the auth layer, not a `students` row. Everything downstream - the `/api/live/signals` read, the
  step filter, the strip, the pulse - is provable by INSERTING a `student_signals` row directly, using
  a student from the fictional `BDM Mock Class` (`supabase/mock-classroom-seed.sql`) so no real name
  ever carries a fake signal. Read `step_index` from the session row in the same statement
  (`(live_flow->'sequence'->>'currentIndex')::int`) or the teacher advances past it before you look.
  It requires an OPEN session: the Remote renders the strip only when one exists, and
  `sessionLifecycle` closes sessions on its own, so check `status` first rather than wondering why the
  insert matched no rows.
  THE BUG THAT WAS REAL, and its general form: the failure was INVISIBLE. `sendSignal` reported
  identity failures only through `setPollSubmitError` / `joinHelpNeeded`, and EVERY render site of
  both lives inside `{activePoll ? ...}`. The chips are always up and a poll usually is not, so the
  common case set an explanation nothing rendered - the silent snap-back the code's own comment
  forbids. Fixed by rendering a `signalError` beside the chips with the Ask-for-help button.
  Generalise it: setting an error state is not surfacing an error. Check the CONTAINER its render
  site sits in, because a message parked in a conditional branch is a message nobody reads.
  The Remote's strip PULSES on a new current-step signal (Steele's ask, 2026-07-30: "I just want a
  quick alert. I dont even need to know what student it came from"). A count going 0 to 1 in a thin
  bar on a handheld is not an alert. Colour survives `prefers-reduced-motion`, motion does not -
  the same line `timerUrgency` holds. Step scoping is DELIBERATE and he confirmed it: a tap vanishes
  when you advance. Names stay in the strip because /session shows them too; he does not need them,
  which is not the same as wanting them gone.
- Mock data for practice runs (added 2026-07-25, after the end-of-year wipe): `supabase/mock-classroom-seed.sql`
  creates the fictional `BDM Mock Class` (period code MOCK, 11 invented students on the reserved
  `mock.bigdogmath.example` domain) plus i-Ready Fall baselines and six warm-up days of `responses`
  tuned to fill the mastery bars and form four misconception clusters - run it, then Recompute on
  `/teacher/mastery`. `supabase/mock-live-session-seed.sql` (run second) stands up an OPEN live-flow
  session (join code MOCKLV, live_flow type-checked against `LiveClassFlowSnapshot` v2) with the roster
  joined and readiness answers set so the VISIT LIST fills on `/teacher/remote`.
  Both idempotent and scoped to the mock period; wipe lines at each file's bottom. KEY DISTINCTION that
  shaped the split: the visit list computes from the CURRENT session's `poll_answers` +
  `session_joins` - plus the session's OWN `source='tool'` aggregate `responses`
  as a boundary tie-breaker (strong >=4 eases a tier one step, weak <2.5 escalates one step, tier 4
  is never lowered; no tool work means the old behavior exactly - the 2026-07-27
  launch audit found the secure `/api/student/tool-evidence` path had dropped the daily 0-5
  aggregate row, so the tie-breaker never fired; FIXED same day: the device's day tally rides the
  report body and the route upserts the legacy-keyed aggregate, with per-problem rows written only
  when a seeded standard applies) - but NEVER the `responses`
  warm-up history, so it only populates inside a live session, while `/teacher/mastery` and
  `/teacher/rightnow` (`/api/live/groups`) replay `responses`. Seeding warm-up `responses` alone
  can never make the visit list light up (roster and readiness still come from joins + polls). Any new mock roster MUST stay fully fictional
  (see the July 2026 real-names-in-a-public-repo incident) and have Steele eyeball the names first.

## Live sessions - the failure modes that cost a class period

Learned the hard way on 2026-07-28: a full period ran the `DEFAULT_STATES` bank skeleton while every
student screen stayed frozen, and nothing on any surface said so. All of the following are fixed, but
the invariants they protect are easy to break again.

- **ONE OPEN SESSION PER PERIOD, KEYED TO THE PERMANENT CLASS CODE.** `periods.class_code` (`DOG<n>`,
  `supabase/period-class-codes.sql`) is the only code students ever type. `/api/teacher/session`
  `action:"start"` now prefers it over the client's `makeCode()` and adopts the period's existing open
  session instead of inserting a second row. Never reintroduce a random per-session join code: it can
  never equal `DOG<n>`, so the direct `join_code` lookup in `/api/student/warmup-start` misses and
  students fall through to `sessionFromPeriodCode`, which is gated on `withinSchoolHours()` AND a
  district account. When either gate closes it opens a DIFFERENT row - `broadcast:"free"`,
  `live_flow` null - and `ClassSync` holds those students on `/` forever.
  **A NULL `class_code` SILENTLY REINTRODUCES THE RANDOM CODE.** Preferring `periods.class_code`
  only helps when the period HAS one, and nothing warns when it does not - the start path just
  falls back to `makeCode()` and the session opens on something like `DOGPSM`. Found live
  2026-07-30: Period 1's `class_code` was null while every other period had DOG2/3/4/5/7, so its
  session took a random code and no surface said a word. Set to `DOG1` the same day with Steele's
  word. The check is one query, and it belongs in any session-start debugging:
  `select name, class_code from periods order by name` - a null on a real period is the bug, and
  it is invisible from `/control`, `/session` and the Remote alike. Note `periods` outlives the
  student wipes (the roster cron only touches `students`), so a code lost to a migration or a
  hand-edit stays lost until someone looks.
- **NEVER OPEN A SECOND `/control` TAB ON A RUNNING SESSION.** (Found 2026-07-29 while verifying a
  live CC.3 run - a second tab was opened to observe, and it was one poll away from destroying the
  lesson.) Control's snapshot is a FULL REPLACE published about once a second while a timer runs, and
  the lineup it publishes is that tab's own LOCAL React state. A freshly opened `/control` has no
  `bdm-teacher-session` in localStorage, so it falls back to `latestOpen` and adopts the running
  session while still holding the `DEFAULT_STATES` skeleton it booted with - the right session, the
  WRONG lineup. The moment it sees `broadcast === "live-flow"` it will publish that skeleton over the
  real lesson: eleven authored CC.3 steps replaced by seven catalog states, mid-period, with nothing on
  any surface saying so. The pin added in `24d66e1` fixes session IDENTITY, not lineup divergence, so
  this is still live. To watch a running lesson, use a DISPLAY route (`/teacher/present`,
  `/teacher/pace`) or read `/api/teacher/session` - never a second Control.
- **A LESSON THAT DOES NOT PUBLISH LOOKS EXACTLY LIKE ONE THAT DOES.** Same run: the session sat at
  `broadcast: "free"` with `live_flow: null` while the teacher advanced states and watched the
  discussion overlay run on `/control`. Everything looked correct on the operator's screen; the
  projector and every Chromebook would have shown nothing. Advancing states and opening the discussion
  overlay do NOT publish - only `Start lesson` (which calls `switchSessionToLiveFlow`) does. `/control`
  does say so, in the amber `Session <CODE> - select Live Class Flow` banner, and that banner is the
  only warning there is. When a room reports "nothing is on the screens", read `broadcast` and
  `live_flow` from the session row FIRST.
- **`latestOpen=1` IS NOT SESSION IDENTITY.** It returns the newest open session across every period.
  `/control` now pins to `getStoredTeacherSessionId()` via `?liveSessionId=` and only falls back once
  that session is closed. Without the pin, a student typing a class code mid-period spawns a newer row
  and silently drags Control onto it, re-hydrating the lineup from that row's seed flow.
- **NEVER GATE A `teacherPost` PATH ON `getSupabase()`.** Control's live_flow publish effect did, and
  `supabase` is unused in it. With a null browser client, `broadcast` still flipped to Live Class Flow
  but no `live_flow` snapshot was ever written, so `live_flow.state.id` stayed null and every student
  sat on the homepage while the teacher watched states advance normally.
- **`saveProvisionalStudentSession` must clear the class-mode exit marker**, exactly as
  `saveVerifiedStudentJoin` does. `leaveClassMode()` sets that marker whenever a session closes, and
  `ClassSync` returns on every tick while it is set - so every Chromebook after period 1, and every
  device on day 2, looked joined and never moved. Nothing in the UI revealed it.
- **A SILENT CATCH IN A POLLING LOOP IS A CLASSROOM OUTAGE.** `ClassSync` swallowed every read error
  with no state and no log, which made a dead session indistinguishable from a working one that had
  not advanced. It now counts consecutive failures and tells the student after about 15 seconds. Hold
  this line in every classroom poller.
- **CATALOG COPY MUST NEVER STAND IN FOR AUTHORED CONTENT.** `DEFAULT_STATES[].desc` and
  `DEFAULT_DISCUSSION_SUPPORTS` (`src/lib/classroomPilot.ts`) both reached projector screens as
  terminal fallbacks - "Watch and take notes. I'll model each step." and the strategy / evidence /
  justify cards, the latter unchanged from warm-up to closeout. `discussionSupportsForLesson` is now
  discussion-only on both `/teacher/present` and `/teacher/pace`. Empty renders as nothing; wrong
  renders on a classroom screen.
  CORRECTED 2026-07-29: "discussion-only" was keyed on `theme.id`, which is NOT the same test.
  `inferClassroomStage` maps any step whose title contains "partner" or "group" to the `discussion`
  theme, so those steps still summoned the catalog cards locally even though `/control` deliberately
  publishes empty arrays for them. Both surfaces now gate the FALLBACK on
  `usesDiscussionProtocol(state.id, state.label)` while the theme keeps gating the LAYOUT - a partner
  step legitimately wants the discussion scene, it just may not invent supports. `/live-flow` had no
  gate at all: authored stems publish on EVERY state by design, so any lesson carrying
  `Discussion Stems` put the stems-and-vocabulary panel on every Chromebook from warm-up to closeout.
  When you add a surface that reads `presentation.discussionStems`, gate it on the protocol, never on
  "are there stems".
- **THE `discussion` STATE IS WIRED, AND THE LESSONS THAT ACTUALLY RUN DO NOT USE IT.** (Settled
  2026-07-29 after two wrong versions of this line. Steele's own statement - "none of our lessons up
  to that point had used it" - is CORRECT about the lessons he teaches from: `M1.T1.L1-D1` (the only
  Published one), `M1.T1.L2-D1`, and `M1.T1.L2-D2` each have NO discussion step. The database-wide
  count of 34 discussion steps is real but lives in the older stubs and sketches, the CC culture
  lessons, and the M1.T2/M1.T3 shapes - none of which run. `M1.T1-P1`, the BRUH deck, does have one
  ("5. BRUH Error-Repair Discussion", 3 min), and `M1.T1.L3` has "9. What the Wall Says" (8 min), but
  both sit at `Ready for Review` and `/api/today` serves only `Published` pages dated today. So when
  auditing this, count the DEPLOYABLE lessons, not the whole database - the raw count says the
  opposite of the truth.) It is a real `DEFAULT_STATES` entry (so both
  engines build a real bank entry, not the empty synthesized one), it has its own scene on present,
  pace, and `/live-flow`, it forces `pollKind` to null, and `/control` reveals a "Run discussion"
  button driving the three-round protocol in `src/lib/discussionProtocol.ts` (Think + Write, Discuss +
  Revise, Share with the spinner - note the CATALOG COPY promises five phases, "Think, write, discuss,
  revise, then share", while `DISCUSSION_ROUNDS` has three; the rounds are the truth).
  THE PROTOCOL IS NOT UNIVERSAL AND MUST NOT BE FORCED TO BE (Steele, 2026-07-29). Different
  discussions are genuinely different shapes - error analysis, respectful difference, whiteboard
  consensus, share-out - so a single fixed sequence is the wrong abstraction. What is invariant is
  that EVERY phase has its own timer and its own single clear direction: when to think, when to write,
  when to talk, when to listen, in whatever order that discussion needs. The current code is the
  opposite of that - `DISCUSSION_ROUNDS` hardcodes three 120-second rounds with fixed labels, so the
  sequence cannot vary and the durations cannot either.
  **STALE AS OF 2026-08-03 - THE RUNTIME DOES HONOUR IT NOW, AND THIS LINE COST A REAL BUG.** The
  paragraph below (and the "DO NOT ADD THE `Discussion Phases` NOTION PROPERTY" block after it) says
  the wiring is outstanding. It landed: `notionLessons.ts:588` reads the property,
  `lessonFlowBuild.ts:84` and `/api/control-remote:345` publish it onto `presentation`, and
  `/teacher/present:466`, `/teacher/pace:257` and `/live-flow:596` all parse it into
  `DiscussionTimeline`. Read the rest of this section as history, not as a plan.
  WHAT IT COST: trusting this line, an agent wrote a contract asserting Control must NOT publish
  `discussionPhases` - pinning a live bug in place. Control's full-replace republish was stripping
  the field from `sequence.steps`, and `/api/control-remote` re-derives `presentation` FROM those
  steps, so the first Remote-driven Next deleted the discussion timeline on both projectors and
  every Chromebook, and the next rehydrate wrote the loss into Control's own lineup for good. Fixed
  in `flowSnapshotForStep`; `npm run test:control-lineup` now asserts the field REACHES the room.
  This is the second time a stale line here has produced a bug (see rule 9) - when a note says
  "not wired yet", grep for the consumer before believing it.

  THE AUTHORING FORMAT IS DECIDED AND TESTED. (Historic heading: "the runtime does not honour it yet".)
  `src/lib/discussionPhases.ts` + `npm run test:discussion-phases` (18 checks) own it. One beat per
  line, `<mode> <duration> | <direction>`, mode one of think / write / talk / listen, duration in
  seconds or `90s` or `2m`, and the direction after the pipe is REQUIRED because the mode word alone
  does not tell a student what to do about this problem. Any order, any count up to 8, repeats allowed.
  A beat drives the state strip's `eyes` and `voice` only (think and write are silent on your own
  paper, talk is voice 2, listen is silent on the speaker) and leaves `supplies`/`body` as the step
  authored them - a discussion does not change what is in their hands. A phase IS a strip entry plus a
  timer plus a direction, which is why `stripForPhase` lives in that module and the two must not be
  built twice.
  **DO NOT ADD THE `Discussion Phases` NOTION PROPERTY UNTIL THE OVERLAY READS IT.** An authorable
  property the runtime ignores is this repo's most repeated failure - see the `Discussion Prompt` trap,
  the hyphenated misconception tags, and the missing `Structured Numeric` option. The remaining wiring,
  in order: widen `DiscussionPhaseSnapshot` off `roundNumber?: 1|2|3` / `roundCount?: 3`; replace the
  four files' direct `DISCUSSION_ROUNDS` imports with a `discussionRoundsFor(authoredPhases)` that
  falls back to the constant (`DiscussionProtocol.tsx` ~12 sites, `teacher/remote` 3,
  `teacher/studio` 3); give N phases a generic advance action, since `discussionRoundForAction` maps
  only the three fixed `discussion-think`/`-discuss`/`-share`; carry the phases on
  `LiveFlowSequenceStep` through BOTH engines and Control's three mapping sites; validate in the
  `/control` load message against the step's `Duration`; then add the Notion property last. Verifying
  the overlay needs a teacher session with an open live session and a discussion step - it is not
  reachable from `/demo`, which is why this was not finished blind.
  Steele made student talk a STANDING requirement 2026-07-28 (see the `lesson-deployment-builder`
  skill). Two traps when authoring:
  `Discussion Prompt` reaches only `/lesson` and never the flow snapshot, so the projector headline
  must be authored in `Main Display`; and the step-level property is `Vocabulary` while the
  lesson-level one is `Discussion Vocabulary`.
- **DO NOT FILTER NOTION LESSON STEPS BY THE STATE CATALOG.** `/control` dropped every step whose
  `State ID` was not in `DEFAULT_STATES` (about thirty real ids in the database) while
  `/api/control-remote` did not filter at all - so the two engines ran different lessons from the same
  Notion page. Unknown ids now get a synthesized bank entry with an EMPTY `desc` and are named in the
  load message. When adding a second consumer of `lesson.steps`, make it agree with `stepsFromLesson`.
- **A STEP'S KIND CAN BE SET FROM THE FRIENDLY `State Type` SELECT, WHICH WINS OVER `State ID`**
  (added 2026-08-02, Steele: "a notion property that tells me what kind of slide it is... it should
  be a select"). The Lesson Steps data source (`collection://8e467c1b-8937-4902-811e-ca0a2e15af4d`)
  now has a `State Type` SELECT with plain-English options (Warm-Up, Direct Instruction (I Do),
  Discussion, Learning Check, Question, Exit Ticket, ...). `notionLessons.ts` resolves
  `stateId = stateIdForStateType(State Type) || State ID`, so a step that sets State Type is driven
  by it and a step that leaves it empty is UNCHANGED (falls back to the raw `State ID`) - a teacher
  migrates one step at a time. The label->id map is `STATE_TYPE_OPTIONS` / `stateIdForStateType` in
  `src/lib/classStates.ts`; the Notion option NAMES must equal those labels exactly, and
  `npm run test:state-type` pins that every option maps to a real DEFAULT_STATES id (the wiring is
  what stops it becoming a dead label that drifts from what runs - the failure mode the Response Mode
  / Poll Kind traps below warn about). DELIBERATELY NO generic "Tool" option: a step's specific tool
  state (e.g. `tool-divisibility`) comes from `State ID` + the `Tool` property, and a coarse
  "Manipulative / Tool" -> `manip` would override that and drop the tool embed. M1.T1.L2-LAUNCH's
  steps were backfilled from their State ID (the two tool steps left empty on purpose); other lessons
  are empty until set, and the fallback covers them.
  RENAMED 2026-08-02 FROM `Slide Type` (Steele: "make the other notion select be state type and this
  one is slide type"), and the rename is DONE in Notion - verified live against the data source, the
  old name no longer exists, so nothing reads it as a fallback. The property shipped as `Slide Type`
  the same day the `slide` FRAME landed, and two unrelated things called "slide" in one system is how
  vocabulary drifts. `slide` now means ONLY the outside-visual frame, whose URL is the SEPARATE
  `Slide Url` file property. Never point `State Type` back at it.
- **`Anchor Problem` IS THE HOOK.** There is no `Hook` property in the lessons database.
- **`liveAssignedToolRoute` MATCHES BY PREFIX, and drops a trailing dash qualifier.** A Lesson Step
  names a tool the way a teacher writes it - `Distributive Area Method`, `... - teacher display`,
  `... - equation phase`, `... - optional support` - and exact-match-only resolved NONE of them
  against the `distributivearea` key. Every Area Tool step in M1.T1.L1-D1 silently failed to embed
  on any surface for the whole lesson. Keep the longest-key-wins rule; it is what stops `numberline`
  stealing `numberlineplus`.
- **BOARD MODE FOLLOWS `boardOpen`, NEVER A STATE ID.** Keying it to `i-do`/`we-do`/`manip` handed
  those states an unwritten ink canvas - a blank projector - and discarded `Main Display` entirely.
  The board also renders `mainDisplay || body`, so the mathematics stays visible behind the ink.
- **EVERY INK SURFACE USES THE `?room=` PARAM, DEFAULT `"main"`.** `/teacher/present` used
  `session.id` for its two `InkBoard` mounts while `/ipad` and `/board` broadcast on `ink-main`, so
  the projector board was permanently blank. `ScreenInkOverlay` is now mounted on `/teacher/pace`
  too - it was on `/present` only, so the support projector could never be annotated.
- **INK ROOMS ARE SHARED AND REFERENCE COUNTED - `joinInkRoom` OWNS THAT NOW** (rewritten
  2026-07-30, and it is what "the iPad writing tool doesn't work at all" turned out to be).
  supabase-js dedupes realtime channels BY TOPIC: `supabase.channel("ink-main")` returns the
  EXISTING channel object, `subscribe()` on an already-joined channel is a NO-OP (so that holder
  never hears SUBSCRIBED and queues every stroke forever), and `removeChannel()` tears the channel
  down for EVERY holder - asynchronously, so a mount arriving in the same commit adopts the channel
  that is on its way out. The old `joinInkRoom` created and removed a channel per CALL, so two joins
  of one room in one page silently destroyed each other. Two places do exactly that, and both were
  broken in class: `/ipad` joins `<room>__over` twice (the glass-sheet `InkBoard` plus the page's
  aspect-ratio listener), so ONE Board <-> Write-on-screen round trip silenced the glass sheet for
  the rest of the lesson; and `/teacher/present` alternates two `InkBoard`s on `<room>` (the board
  scene and the work-space panel - mutually exclusive, but the handoff is one commit), so the
  projector's work space went permanently blank after the first scene change. Reproduced and fixed
  live, before/after, on 2026-07-30. `joinInkRoom` now keeps one channel per topic with a subscriber
  set, fans messages out to every holder, shares one send queue, and removes the channel only when
  the LAST holder closes - after a 4s grace window that absorbs React remounts and surface switches
  - with a join that lands mid-teardown waiting for it and opening a fresh channel. `npm run
  test:ink-sync` drives the real compiled `joinInkRoom` against a fake client that reproduces the
  dedupe, and it FAILS on the old implementation. Duplicate joins are now safe, so do not "fix" one
  by hunting call sites. The registry itself now lives in `src/lib/realtimeRooms.ts`
  (`joinRealtimeRoom`) and `joinInkRoom` is a thin wrapper that keeps the wire event `"ink"`,
  because classroom displays open since before the refactor are still listening for it. The
  rule to keep is that a shared broadcast room is opened ONLY through that registry - the
  contract asserts `inkSync.ts` never calls `supabase.channel` itself. NOT yet converted, and
  carrying the same latent hazard: `useLiveToolConfig.tsx` (`live-tool-<route>-<session>`) and
  `classroomSpinnerSync.ts` (`classroom-spinner-<room>`) still open and remove channels per
  call. Their topics happen to be unique per page today, which is the only reason they work.
- **ONE PEN SURFACE, ONE ROOM** (2026-07-30, Steele: "we can even simplify it"). `/ipad` writes to
  `<room>__over` and nothing else, and every display renders that room UNCONDITIONALLY -
  `/teacher/present` and `/teacher/pace` via `ScreenInkOverlay`, `/board` directly. No mode, no live
  session, nothing to open first: what the hand writes is on the wall.
  THIS REPLACED THE TWO-SURFACE DESIGN THAT CAUSED EVERY INK REPORT IN THIS FILE. "Board" annotated
  the screen; "Whiteboard" was a 42% panel on a SECOND room the projector only showed when a session
  was running with the work space open. Two buttons that looked alike, behaved differently, and
  reached the wall on different conditions - so "it doesn't show up on the projector" was true half
  the time and indistinguishable from a bug. Do not reintroduce a second writing room.
  PAPER IS A BACKGROUND, NOT A SURFACE. The toggle makes the one board opaque (dotted paper instead
  of the live slide behind the same ink) and announces `{t:"paper"}` on `<room>__ctrl`; displays
  mirror it and ASK on mount, so a projector switched on mid-lesson never sits on the slide while the
  teacher is already on paper. Same room, same strokes, same undo history.
  DELETED with the modes: the eight `__p` pages, the `__scratch` overlay, templates, imported
  backgrounds, problem cards, the `pageflip`/`scratch` messages, `boardTemplates.ts`, and the
  work-space panel on `/teacher/present` (which could only render blank afterwards) plus the layout
  shift that reserved room for it. The board SCENE on present KEEPS its board - that one is the paper
  carrying `Main Display`, with the writing arriving on the sheet above it.
  `boardOpen` now changes nothing on the projector; whether "Open work space" stays on the Remote is
  Steele's call.
  Still true and still load-bearing: `.ip-ink-layer` carries `pointer-events:none` so the wrapper div
  cannot swallow a stroke before it reaches the canvas (a plain div defaults to `auto`; that cost a
  whole debugging round when the sheet sat over the old whiteboard panel).
  **AND `.ip-screen-frame` - THE EMBEDDED `/teacher/present` IFRAME - IS ALSO `pointer-events:none`,
  SO NOTHING INSIDE IT CAN EVER BE TAPPED FROM THE PEN SURFACE.** That is correct for ink (the whole
  point is that a stroke lands on the canvas no matter what is nested underneath), and it is the
  reason a control only ever belongs on `/teacher/remote`, never on `/teacher/present`. Anything
  interactive placed on the main projector is decoration from the iPad's side. Check this before
  concluding a button on a present-hosted panel is broken.
- **THE PEN SURFACE SAYS WHEN A NEW BUILD IS WAITING** (2026-07-30). `/ipad` is deliberately absent
  from `DeployRefresh` - it holds the authoritative ink, so an automatic reload would wipe the room's
  boards mid-lesson - and the cost of that correct decision is that it can sit on a build from days
  ago with NOTHING saying so: the pen still draws, the dot still reads connected, and the only
  symptom is that a shipped fix is not there. `UpdateReadyChip` polls `/api/build-id` and offers a
  tap-to-reload chip. It must NEVER reload on its own. When a fix is reported as not working, check
  what build the iPad is actually running before re-debugging the fix.
- **PEN FEEL: THE GEOMETRY FIXES, AND WHY "JAGGED" WAS FOUR SEPARATE THINGS** (2026-08-03, from
  Steele: "too jagged and doesnt respond well to writing. especially back to back strokes", then
  "a few weeks ago it was running fantastic"). `npm run test:ink-geometry` (35 checks) pins all of
  it; the contract measures the polygon with point-in-polygon rather than eyeballing a screenshot.
  EVERY CASE WAS VERIFIED BY REVERTING ITS FIX AND CONFIRMING THE SUITE GOES RED - do that when
  adding one, because the first version of this contract was GREEN with four of the fixes reverted
  (the "A CONTRACT CAN PASS ON THE WRONG ELEMENT" trap below, arrived at from a new direction).
  Three ways a case looked decisive and was not, all worth stealing: a CLEAN synthetic corner is
  rescued by the resampler alone, so only densely sampled input with tremor on it separates
  miter from no-miter; an EXACTLY retraced stroke takes the degenerate `mlen < 1e-6` branch and so
  cannot test the miter clamp, while a retrace a hair off zero drives it; and a long GENTLE stroke
  resamples about 1:1 and never reaches the argument-count cliff, while a long FAST one expands
  (sparse samples subdivide) and does.
  (1) **THE ROUND CAPS SWEPT THE WRONG WAY AND NEVER ONCE CAPPED A STROKE.** A cap joins one edge
  to the other across the tip and there are two ways round; the fan swept the way that folds back
  THROUGH the stroke body, so instead of a nib it cut a notch into the last few px. Every stroke
  had blunt, forked ends from the day the engine was written - invisible on a long scribble,
  about half the ink of a short one, and short strokes are what an equation is made of. The fix is
  the sign of one term (`fromAngle - k*PI/steps`). Its symptom is a bbox: a horizontal stroke's
  ring should reach half a nib PAST each tip, and it stopped exactly at them.
  (2) **A CONSTANT-WIDTH MARKER MUST NOT THIN AT A CORNER.** Offsetting each point along its own
  normal by exactly r leaves the outer edge of a turn at r*cos(theta/2) - about 30% pinched at a
  right angle - and handwriting is almost entirely corners. `strokeOutline` now scales the offset
  by 1/cos(theta/2) with `MITER_LIMIT` 2.5 so a retraced stroke cannot throw a spike. Measured
  nib width kept at the corner: 94% -> 100% (right angle), 80% -> 100% (zig-zag).
  (3) **THERE IS NO SEPARATE DE-JITTER PASS, AND THAT IS MEASURED, NOT AN OVERSIGHT.** One was
  built (a binomial pre-filter over the control points) and then removed, because
  `smoothCenterline`'s midpoint quadratic already averages each pair of samples and that is itself
  a low-pass. On a line drawn slowly at 1.1px sampling: perfectly alternating chatter 0.320px raw
  goes to 0.000px WITHOUT the filter; white noise 0.133px without vs 0.100px with; correlated hand
  tremor 0.080px vs 0.076px. So it bought 0.03px and 0.004px - invisible on a 6px nib - while
  costing two hypots per point on every frame of every stroke, and no contract check could be made
  to fail without it, which is the same fact from the other side. What actually cleaned the line up
  was the miter joint: a slightly wobbling stroke puts a run of small turns through the joint, and
  an un-mitered joint pinches at every one of them, which is what made a plain rule look frayed.
  If you are here to add smoothing, measure against the miter and the caps first.
  (4) Resampling refines by the sagitta `c*c/(8R)`, so it only bites below about R=6 and costs
  nothing elsewhere. Scale is NOT a reason to refine: strokes travel NORMALISED and each surface
  re-fits the curve in its own pixels, so the projector's chords are the same 2.4px across a
  proportionally larger stroke, not magnified ones.
- **THE BACK-TO-BACK STROKE STALL WAS A REACT RE-RENDER, NOT THE INK** (2026-08-03). `InkBoard`
  called `onHistoryChange` on every `recordOp`, and every consumer writes it into state
  (`/ipad`: `setHistory({ undo, redo })` - a fresh object, so React never bails by value). So each
  pen LIFT re-rendered the whole page. `notifyHistory` now fires only when the pair actually
  CHANGES - after stroke one it is (true,false) and stays there - so later lifts notify nothing.
  `clearLocal` must go through `notifyHistory` too, or the last-notified pair goes stale and
  swallows the next real change.
  THE COST IS SYNCHRONOUS RECONCILIATION INSIDE THE POINTERUP HANDLER, NOT A LAYOUT FLUSH, and the
  distinction is worth keeping straight because the wrong version sounds better. A re-render whose
  output is identical mutates no DOM, so there is nothing for `measure()`'s
  `getBoundingClientRect()` to reflow - only stroke one actually changes anything (undo false ->
  true flips `disabled`). What it does cost is React running start to finish inside the event
  handler, which is on the critical path exactly when a pen lift and the next pen down fall in the
  same frame. (An earlier version of this note claimed the forced-reflow mechanism; a review
  measured it and it is wrong.)
- **BACKDROP-FILTER OVER THE INK CANVAS IS A PER-FRAME COST** (2026-08-03). `.ip-palette` is 620px
  wide, fixed over the writing stage, and open by default; `backdrop-filter: blur(16px)` makes the
  browser re-sample and re-blur its backdrop every time that backdrop changes - and its backdrop is
  the canvas, which repaints on every frame of every stroke. It is opaque now. The small
  `.ip-handle` keeps its blur (a corner chip, not a sheet over the page). **"Hide tools" is the
  one-gesture A/B** whenever the pen feels heavy: if hiding the palette sharpens it, an overlay is
  the cause, not the geometry.
  THE OPAQUE LOOK IS CONFIRMED, NOT PROVISIONAL (Steele was offered the blur back on 2026-08-03 and
  kept it opaque). Do not restore `backdrop-filter` on `.ip-palette` as a polish pass - it is a
  per-stroke-frame cost on the one surface whose responsiveness is the priority.
- **THE PEN-SURFACE GESTURES: ONE FINGER TWICE = UNDO, AND THE TWO TOLERANCES THAT MADE THE OLD ONES
  UNREACHABLE** (2026-08-03, from Steele: "previously the ipad writing component had the hold for a
  straight line ... and it had the double tap to undo"). Nothing had been deleted - `git log -L` on
  both blocks returns only the Phase 2 commit that shipped them - so this was never a regression in
  the code. It was that ONE of them was never wired the way he reaches for it, and the OTHER was
  tuned past what a hand can do.
  UNDO WAS TWO FINGERS AT ONCE, NEVER ONE FINGER TAPPED TWICE. A single-finger double-tap matched
  nothing, so the motion he was making did nothing and read as "it used to work". It is wired now and
  is the primary gesture; two-finger undo and three-finger redo stay, because they are the iPad idiom
  and cost nothing. A LONE single tap must keep doing nothing - on /ipad it is also how the tool
  palette is dismissed.
  THE DOUBLE-TAP WINDOW IS MEASURED GAP-STYLE AND IS DELIBERATELY GENEROUS (`DOUBLE_TAP_MS` 450,
  lift-of-the-first to touch-of-the-second, so a slow second press does not spend the budget on
  itself). The reason is specific and was caught by instrumenting, not by reading: the FIRST tap of
  the pair also fires /ipad's `closeTools()`, and that React re-render delays delivery of the second
  tap - measured at 316ms to 1000ms in the preview pane. At the original 350ms up-to-up budget the
  gesture failed exactly when the palette was open, which is the normal state. A budget that a single
  re-render can exhaust is a gesture that works on the bench and not in the room.
  `HOLD_SNAP_RADIUS` WENT 8px -> 18px because any move past it RE-ARMS the 600ms timer from zero, so
  a resting Pencil's own tremor kept resetting the clock and hold-to-straighten was close to
  untriggerable by hand. 18px is about 3mm - wider than tremor, far tighter than a deliberate slow
  stroke, which would have to crawl under 30px/sec to sit inside it for the full 600ms.
  TAP VALIDITY IS NO LONGER THE PINCH THRESHOLD. `moved` (14px) still arms pinch/pan and must stay
  where it is; killing the tap at that same 14px meant a two-finger tap on glass usually died as a
  "pinch" that never actually zoomed. Taps now use their own `TAP_SLOP` (26px) plus a direct check
  that the view scale really changed - ask whether it zoomed, do not infer it from drift.
  HOW TO VERIFY ANY OF THIS IN THE PREVIEW PANE, because two obvious observables LIE. (1) CANVAS
  PIXELS ARE NOT A VALID OBSERVABLE - `scheduleRedraw` goes through `requestAnimationFrame`, the pane
  throttles it, and the ink count sat frozen at its old value even while undo/redo were provably
  working from the buttons. (2) THE UNDO/REDO BUTTONS VANISH WHEN YOU TOUCH THE CANVAS, because the
  touch closes the palette that contains them - a read straight after a gesture finds no button and
  looks like "nothing happened". Reopen the palette, then read `disabled`. The honest observable is
  that pair. And note an end state of undo-empty/redo-full is reached by SEVERAL different gesture
  sequences, so it does not by itself prove which gesture fired - instrument, or drive one gesture at
  a time from a known state. Verified live 2026-08-03: a 90px-bulge arc snapped to ink 6px tall (the
  nib), and the double-tap undid with the palette open.
- **THE /ipad AUTO-CLEAR POLL NEVER RAN, AND STILL COST A PARSE EVERY 2 SECONDS** (turned off
  2026-08-03). It asked `GET /api/control-remote` with NO sessionId, and that route returns
  `session: null` unless one is passed - so the step index was never a number and the board never
  cleared on a lesson advance, from the day it shipped. Meanwhile it fetched and parsed
  `sessions.map(serializeSession)` - every open session with its whole liveFlow snapshot - on the
  pen surface's main thread every 2s, at moments it cannot choose. Deliberately NOT re-wired:
  passing a session id switches on a DESTRUCTIVE auto-clear the board has never actually had, and
  the first time Steele saw it would be his board wiping itself mid-lesson.
  **ASKED AND DECLINED (Steele, 2026-08-03): IT STAYS OFF.** He clears the board by hand. Do not
  re-raise it or wire it as a convenience - the decision is made, and the 2s fetch stays off the
  pen surface's main thread. AND IT IS NOT THE ONE-LINE CHANGE THIS NOTE USED TO CALL IT: passing
  the session id is one line, but `clearLocal` (InkBoard.tsx) resets `historyRef` and `redoRef` to
  empty on purpose - "Clear is deliberate and destructive - history does not survive it" - so an
  auto-clear firing mid-explanation is UNRECOVERABLE, not one undo tap away. Anyone turning it on
  in future should first make clear record an erase op of every stroke instead of resetting
  history, which is what makes the surprise survivable.
- **THE "FANTASTIC" PEN CONFIGURATION WAS STRUCTURALLY DIFFERENT, AND `Paper` IS THE A/B** (noted
  2026-08-03). Before the 2026-07-30 one-surface rebuild, the surface the teacher wrote on was an
  OPAQUE dotted `InkBoard` with no iframe mounted at all. Today it is `transparent={!paper}` - a
  transparent canvas stacked on a permanently live `/teacher/present` iframe - so the compositor
  blends three canvases against an independently rendering same-origin app on every frame, and the
  `desynchronized: true` low-latency path Safari grants the wet canvas is exactly what that
  arrangement can cost you. THIS IS UNMEASURED from code and needs a Safari layer trace on the
  device. **Turning `Paper` ON makes the canvas opaque and is a free A/B a teacher can run in one
  tap**: if the pen feels great on Paper and poor on Screen, the remaining problem is compositing,
  not stroke geometry - do not go back to tuning `inkGeometry`.
- **THE PROJECTOR IS A DISPLAY ON THE INK ROOM, NEVER A WRITER** (2026-07-30). `/teacher/present`'s
  board-scene `InkBoard` was mounted `interactive`, which made the projector the SECOND author on
  the shared room: `InkBoard`'s interactive-only effects broadcast `{t:"bg", url:null}` (wiping the
  grid template the iPad had set on every display), pushed the slide's `Main Display` over the wire
  as the room's `problem`, and answered a display's `hello` with the projector's own copy of the
  board, racing the iPad's. It is `interactive={false}` now, which also means it ASKS for state on
  mount - so opening the board scene mid-lesson fills in everything already written instead of
  starting blank. The pen is the iPad; nobody touches the projector.
- **THE SPLIT WHITEBOARD IS A BACKGROUND, NOT A MODE OR A SECOND ROOM** (rebuilt 2026-07-30, Steele:
  "the split whiteboard button that splits the screen between the slide and a white area to write in
  ... the writing feature doesnt change with the whiteboard move, it just creates a white background
  section to write on"). The one-surface simplification had dropped the old two-mode whiteboard; this
  put a whiteboard back WITHOUT reintroducing the two-surface design that caused every ink report in
  this file. AN EARLIER, NOW-DELETED VERSION of this note described a `"annotate" | "whiteboard"`
  surface union with a real `InkBoard`-in-the-panel on a second `<room>` and `show-board`/`hide-board`
  through `/api/control-remote` - that design is GONE; do not resurrect it, and read any pre-rebuild
  note that mentions it as history.
  THE PEN NEVER CHANGES. It is still one interactive `InkBoard` on `<room>__over`, transparent,
  covering the whole screen, writing EVERYWHERE - over the slide and over the white area alike.
  Turning **Whiteboard** on (the toolbar toggle beside Screen/Paper) ONLY ADDS a clean white panel on
  the LEFT 42% to write on; it does not move the pen, shrink it, or fence it in. `.ip-wb-panel` on
  /ipad is a PLAIN WHITE DIV (no ink room of its own) at z-index 5, UNDER the ink layer's z-index 6,
  so the panel can never take a stroke.
  IT RIDES THE INK CONTROL CHANNEL, exactly like Paper: `{ t: "whiteboard"; on }` on `<room>__ctrl`
  (`InkMessage` in `inkSync.ts`), broadcast by /ipad on toggle and re-sent in the `hello` handshake so
  a display opened mid-lesson is never left un-split. NO live session, no control-remote, no server
  state - it works standing alone, which is the whole point of the one-surface design.
  THE PROJECTOR MIRRORS IT by RE-ENABLING the board-open machinery the simplification left in the CSS
  but unwired. `/teacher/present` listens on `<room>__ctrl`, sets `boardOpen`, adds `board-open` to
  `.stage-work` (which shifts every lesson scene to `left:42%`/`width:58%` - `.stage-tool`,
  `.stage-resource`, `.classroom-spinner`, `.stage-success`, the state strip and the rest - so the
  slide content moves to the right 58% and nothing hides behind the panel) and renders the white
  `.stage-board-panel` on the left 42%; `ScreenInkOverlay` at z-index 40 paints the writing on top.
  THE PRESENT LISTENER RUNS EMBEDDED TOO: the present inside /ipad's own iframe must shift its scenes
  the same way or the teacher's slide view would not match the wall - but it does NOT draw
  `.stage-board-panel` (gated on `!inkOverlay.embed`), because /ipad draws its own `.ip-wb-panel` over
  the iframe and two panels would double the amber edge. `/board` draws a matching white panel BEHIND
  its ink (earlier in the DOM, no z-index, so the transparent ink canvases show it through).
  THE 42% IS A MIRROR on every surface - `.ip-wb-panel`, `.stage-board-panel`, and /board's panel must
  hold the same side and width or the hand stops matching the wall (Steele is left-handed; the panel
  is on the LEFT). Move one, move all three.
  NOT DONE: `/teacher/pace` (the support projector) shows the writing through `ScreenInkOverlay` but
  has no `board-open`/`.stage-board-panel` structure, so it does not split. If the support screen
  should split too, that is fresh work on pace's stage.
  Verified locally 2026-07-30 (dev server, synthetic pen): the toggle splits both /ipad and
  /teacher/present, the pen writes across the divider onto the white area unchanged, and toggling off
  reverts both. NOT yet verified on a real iPad + projector.
- **SCREENS ARE PUSHED, NOT JUST POLLED** (added 2026-07-30, Steele: "is there a way to have the
  screens polled more frequently to reduce the lag in screen changes?"). Measured first: the
  projectors were about 1-1.8s behind the teacher's tap (1500ms poll) and the Chromebooks 2-3s
  (2000ms poll behind `studentSessionShared`'s 2800ms cache). Polling harder was the WRONG lever on
  the student side - that multiplies by the whole class, and the per-device request storm it would
  recreate is the exact thing `studentSessionShared.ts` was written to end.
  So `/api/teacher/session` and `/api/control-remote` now BROADCAST a contentless "re-read" ping on
  `flow-<sessionId>` after a write, and `/teacher/present`, `/teacher/pace`, `/live-flow` and
  `ClassSync` re-read on it. Measured live: about 200ms end to end, down from 1-3s.
  FOUR THINGS HOLD THIS UP AND NONE ARE OPTIONAL. (1) **Every poll stays.** The ping is an
  optimisation on top of polling, so a dropped ping costs one tick and nothing else; never delete an
  interval because "the ping handles it". (2) **The ping must stay RARE.** `/control` republishes
  about once a second while a timer runs, so both writers gate on
  `liveFlowScreensChanged` (`src/lib/liveFlowScreens.ts`), which ignores `updatedAt`,
  `timer.secondsLeft` and the Remote's `transition` claim marker. Ping every write and thirty
  Chromebooks re-fetch every second - the storm, arrived by another road, and it would present as
  "the sync broke". (3) **The student surfaces must call `invalidateSharedSessionState` BEFORE
  re-reading**, or the shared cache serves a value up to 2.8s old and the ping looks like it did
  nothing. (4) **The payload carries nothing.** It says "something changed"; each surface then
  re-reads through the gated endpoint it already used, so `studentSafeLiveFlow`, the teacher gate and
  `requireVerifiedStudent` are all exactly where they were - which is also why this does not run
  into the hold on new student-data plumbing (no new table, no new column, no PII on the wire).
  `broadcastLiveFlowChange` is SERVER-ONLY (service-role key) and can never throw into a write:
  if realtime is down the room just feels like it did before. Sent over the REST endpoint
  `POST /realtime/v1/api/broadcast` rather than a socket, because a route handler has no connection
  to keep - verified against the live project, 202 and delivery in about 200ms. `npm run
  test:live-flow-push` pins all four rules.
- **A REMOTE COMMAND PINGS CONTROL, AND A PING MAY ONLY PLAY A SOUND** (2026-07-30, Steele: "it
  needs less lag"). Control learns about `remote_command` on a 1.2s poll - ~600ms average, 1.2s
  worst - which is fine for applause and wrong for a rimshot. `/api/control-remote` now also
  broadcasts `{action, nonce}` on `remote-<sessionId>` (`src/lib/remoteCommandPing.ts`) and Control
  reacts at once. Measured live: 62ms average, 105ms worst.
  THE RULE THAT MATTERS IS WHAT A PING MAY DO. It is an unverified broadcast that can arrive twice,
  out of order, or from a stale sender. `pingPlaysDirectly` allows ONLY `play-*`: a duplicate clip
  is harmless, a duplicated `next` skips a step of a real class. Everything else may only pull the
  authoritative re-read forward. Do not widen that function without a very good reason.
  It is a SEPARATE room from the screen ping on purpose - a sound cue changes nothing a projector or
  a Chromebook shows, and waking thirty student devices on every rimshot is the storm to avoid. Both
  the ping and the poll play through Control's one `playCueOnce` guard, keyed on the command nonce,
  so whichever arrives first wins and the other is a no-op. The 1.2s poll stays as the floor.
- **CONTROL'S SNAPSHOT IS A FULL REPLACE.** Any field Control does not carry through is DELETED.
  `interlude` and `transition` are owned by `/api/control-remote`, and omitting them erased a Hustle
  or Settle about one second after it started, then auto-advanced past it. Same class of bug wiped
  `remoteActions` and `slideOverlay` on any reconnect. When adding a server-authored `live_flow`
  field, add it to the `liveFlowSignature` snapshot in the same commit.
  **THE STEP MAPPING NOW LIVES IN `src/lib/controlLineup.ts`, NOT IN `/control`** (extracted
  2026-08-03). It was four hand-kept object literals in `page.tsx` at three different indents - two
  rehydrate, one publish, one Notion-import - and the substring overlap between the 8-space and
  10-space copies is exactly why a naive edit double-applied. They had ALREADY drifted, silently:
  the remote-command rehydrate carried no `eyes`/`voice`/`supplies`/`body`, so a Control reconnect
  or any remote-driven rehydrate mid-lesson KILLED THE CLASSROOM STATE STRIP on both projectors for
  the rest of the period, and the server-hydration rehydrate dropped `advance`. Neither failed
  loudly; a lesson with no strip reads as a lesson that never authored one. `flowSnapshotForStep`
  (lineup -> published step) and `lineupItemFromStep` / `lineupFromSteps` (back again) are now the
  only mapping, and `npm run test:control-lineup` fails if the round trip stops being lossless.
  Adding a `LiveFlowSequenceStep` field means editing ONE literal per direction in that file.
  TWO THINGS ABOUT THAT MODULE ARE LOAD-BEARING. Its imports are TYPE-ONLY and every runtime helper
  arrives through the injected `FlowStepDeps`; that is what lets the contract compile it in
  isolation, and a single runtime import breaks the build with a "Cannot find module" that looks
  nothing like its cause (`liveClassFlow.ts` reaches for `@/lib/...`, which does not resolve under
  the contract's tsconfig). And `matchLabel` is deliberately NOT `label`: the published label falls
  back to "Lesson state", but `inferClassroomStage` and `usesDiscussionProtocol` were always handed
  `""` when nothing was authored, and they pattern-match the label text - passing them the fallback
  would let the words "Lesson state" steer the inferred stage.
  The Notion-import mapper (`newLineup`) is deliberately still inline: its input is a Notion lesson
  step, not a published step, so it is a different function with a different source shape, and it
  cannot drop a field on reconnect - only on lesson load. Its one real risk is the inverse: a new
  `LineupItem` field added to both shared mappers passes the contract while the importer forgets it,
  and since Notion import is the PRIMARY path the field would be absent on first load and never
  appear. Add to all three.
  ONE KNOWN, DELIBERATE DIVERGENCE FROM `stepsFromLesson` (Steele's call, 2026-08-03: leave it and
  document it). `lessonFlowBuild.ts:72-83` has a THIRD arm for stems and vocabulary - a step
  carrying discussion phases keeps its AUTHORED stems even when it is not a `discussion` state.
  Control has no such arm, so on that kind of step the server publishes the stems and Control's next
  republish replaces them with `[]`. The contract pins Control's current behaviour, so closing the
  gap means changing that assertion too. It is a real divergence and it changes what students read
  on screen, which is why a refactor did not get to decide it.
- **A LIVE POLL BELONGS TO A STEP, NOT TO A KIND OF STEP** (fixed 2026-08-04; it was the "first ready
  check shows the previous state's directions" report). `/control` decided whether the question on
  screen was still current by comparing the STATE ID, and the lessons here are authored with
  consecutive interactive steps sharing one - "Readiness Question 1" and "Readiness Question 2" are
  both `question`, lesson after lesson, and Steele's shape is always a fist-to-five poll followed by
  TWO ready checks. Advancing between two such steps made all three of these happen at once: the
  clear effect returned early so the first poll was never closed, the publish republished its
  question AND its revealed bars as the second step's, and the auto-open guard (`|| controlPoll`)
  stopped the second step from ever opening its own poll. So the pair that exists to show whether the
  class moved could only ever show one answer, twice, and nothing a student did on the second check
  could register. `ControlPoll.stepIndex` is the key now - the sequence index, because it is the
  identity BOTH paths already have (server hydration reads `flow.sequence.currentIndex`, and a
  Remote-driven Next updates `currentIndex`, which is what makes the stale poll fall away). Every
  other lifecycle marker in that file was already per-step (`autoOpenedStepRef`, `openingStepRef`,
  `autoOpenedDiscussionStepRef` all key on `activeItem.uid`); these two were the outliers.
  `npm run test:control-lineup` pins it, mutation-tested both ways. CONFIRMED WORKING IN A REAL
  RUN by Steele 2026-08-04 - it could not be browser-verified (a live session with students is the
  only way to drive it), so his run is the verification, not the contract.
  MAKE THE FIELD REQUIRED, NOT OPTIONAL. Typing `stepIndex` as required is what surfaced the THIRD
  construction site - the remote-command rehydrate at the bottom of the file, which is the path the
  iPad actually drives and the one no reading of the top of the file would have found.
  FOUND IN THE SAME LINES: that rehydrate also DROPPED `boxes` and `pairs` while the server hydration
  carried them. Control republishes the poll from its own object about once a second and its snapshot
  is a full replace, so a Remote-driven Next into a `Structured Numeric` step blanked the input count
  and students lost the boxes they answer in. Same class as the state-strip and `discussionPhases`
  drift - and note this one hid in a poll field rather than a step field, so the `controlLineup.ts`
  extraction did not cover it. The contract now pins both rehydrates.
- **THE DISCUSSION OVERLAY COVERS `/control` AT z-index 50.** Any control the teacher needs mid-
  discussion must be reachable from inside `DiscussionProtocol`; Control's own Back is invisible.
- **`resolveLessonVisual` TAKES TWO ID NAMESPACES.** `stateId` is the `ClassroomStageId` (warmup maps
  to `evergreen`, launch to `scenario`); `rawStateId` is the class-state id. Skip lists written in
  raw ids must be checked against `rawStateId` or they never fire.
- **THE CLASSROOM STATE STRIP IS ALL FOUR SLOTS OR NOTHING** (added 2026-07-29, Steele's ask). Four
  authored select properties per Lesson Step - `Eyes`, `Voice`, `Supplies`, `Body` - render as a
  VERTICAL group pinned top right of the stage on `/teacher/pace` and `/teacher/present`, modelled on
  a garment care label (it was a full-width bottom rail for about an hour; Steele moved it). The
  mechanism is PRECORRECTION: naming the state before the transition that breaks it. Slot ORDER is a
  cue students read by position and may never be reordered; the other two cues changed in the
  State Strip Icons v3 handoff (2026-07-29): the GLYPH is now one per VALUE, not one per slot, and
  COLOUR is a single teal ramp (`#10312c` to `#14b8a6`) encoding room-activity intensity, not a
  per-slot hue. THREE VALUES PER SLOT (Steele: "no 3 for all") - Eyes is `Own paper` / `The speaker`
  / `The screen` (dropped `Teacher` and `Your build`), Voice is `0 silent` / `1 partner` / `2 table`
  (dropped `3 presenting`), Supplies and Body unchanged. So the Notion `Eyes` and `Voice` select
  options must be reduced to these three when backfilling - a step authored with a dropped value now
  fails to resolve and renders no strip. `stripGlyphId`/`stripIntensity` in the lib map each value to
  its glyph id and ramp step; the twelve SVG paths live in `ClassroomStateStrip.tsx` as true knockouts
  (the glyph is a hole, so the ground reads through it). It
  mounts as the LAST child of the work stage so it paints over the `inset:0` scenes, and it stays in
  its top-right home under `board-open`. It used to HOP LEFT there, because the work space owned the
  right 42%; the work space moved to the LEFT 42% on 2026-07-30 (Steele is left-handed), so the hop
  was deleted rather than mirrored. The invariant is the thing to keep, not the direction: never let
  the group cover what the teacher is writing on. If the panel ever moves back to the right, the hop
  comes back with it. `src/lib/classroomStateStrip.ts` owns the vocabulary and `npm run test:state-strip` guards it.
  A step missing ANY slot renders NO strip - a strip that is sometimes empty stops being scanned, and
  a stale slot is how a student ends up holding rods during the exit ticket - and `/control` names the
  part-filled steps in its load message. An unrecognised value fails rather than snapping to a near
  match. Reported, NOT blocking: the properties are new and no lesson is backfilled, and a check that
  refuses to start a class is worse than a lesson with no strip. Backfilling the existing steps is
  AUTHORING and needs Steele - reading the values off `Pace Directions` prose is inference, not
  transcription. The live override (`behaviorOverride`, iPad deck) is SERVER-AUTHORED, so it is in the
  `interlude`/`transition` class and Control must carry it through its full-replace snapshot; it is
  stamped with the sequence index it was issued at and expires on the next advance with no clearing
  code anywhere. The strip DOES cross `studentSafeLiveFlow` on purpose - "voice 0" is announced to the
  room and painted on two projectors, and a head-down student needs the same read the room gets.
- **FIXED 2026-08-03: A TEACHER-LOADED BANK CLIP WAS DECODED ON ONE AudioContext AND PLAYED ON
  ANOTHER.** Symptom Steele reported: cues he uploaded a clip for made no sound from the Stream
  Deck, while cues with no upload still fired their synthesized version. The two `installUserClip`
  call sites in `/control` disagreed - the UPLOAD path passed `audioCtxRef.current`, the page-load
  RESTORE path (the `idbGet(bankClipKey(...))` loop) passed nothing and fell back to
  `sharedContext()`, the bank's own second context. `playSoundCue` always plays through
  `audioCtxRef.current`, and an AudioBuffer only crosses contexts cleanly when their sample rates
  match; when they do not, `src.buffer = chosen` throws and the press is silent. Synthesis never
  reads `userBuffers`, which is why the un-uploaded cues were unaffected.
  THE HALF-FIX THAT LOOKS RIGHT AND IS NOT: passing `audioCtxRef.current` at the restore site
  changes nothing, because that ref is null until `genTone` lazily constructs it on the first cue -
  and the restore loop runs at MOUNT. It would still fall through to `sharedContext()`. The fix is
  `ensureAudioCtx()`, which constructs the page's one context on demand; a context may be built
  before any gesture (it starts suspended, `decodeAudioData` still works, the first click resumes
  it). The COMMITTED-file path was never affected - `primeCueFiles` is called from inside
  `playSoundCue` with the same context it is about to play on.
  This got more urgent when the clips were committed to `public/sounds/`, because `userBuffers`
  WINS over `fileBuffers` - one broken restored buffer would shadow a perfectly good committed file
  and the button would be silent with the right clip sitting right there.
- **STATE MUSIC IS STOP-FIRST, AND CUES DUCK IT RATHER THAN STACK ON IT** (both found live
  2026-08-02, Steele: "a song that plays the whole time and then a sound when the first time alert
  and then another when time is up and they all played on top of eachother and the song continued
  into the next state"). Two independent bugs in `/control`'s audio, both fixed.
  (1) `startMusicFor` returned EARLY when the new state had no music of its own - BEFORE its
  `stopMusic()` call - so the warm-up song played straight on through every later state until
  something else happened to stop it. Two callers relied on that swap and inherited the leak: the
  server-hydration effect and the interlude effect both read
  `if (running && flow.state) startMusicFor(...) else stopMusic()`, and a running state with no
  music of its own took the early return. It stops FIRST now, unconditionally: every caller means
  "the music for this state is the only music", and that has to hold when the answer is silence.
  (2) There was no cue channel and no ducking - `playCue` made a fresh `new Audio()` per call and
  nothing lowered the music - so the 30-second alert, the last-ten ticks and the time-up sound all
  sounded over the song and over each other. Now ONE `cueRef` (a new cue stops the one still
  sounding, because a cue is an interruption) and `duckMusic` pulls the song to `MUSIC_DUCK_VOLUME`
  0.18 for the clip's real duration, read off `loadedmetadata` with a 3s fallback so a clip that
  never loads cannot leave the music quiet for the rest of the period. The duck-restore re-reads
  `musicRef` rather than closing over the element, or restoring volume on a swapped-out track would
  leave the NEW one quiet. Time-up is deliberately still `stopMusic()` then `playCue("end")` - the
  song ends, the cue plays alone.
- **AN UNTIMED STATE PUBLISHES NO TIMER, AND THE REMOTE ARMS ONE ON DEMAND** (added 2026-08-02,
  Steele: "during the times i need to upload a full outside deck or video or something i dont want
  to fight the progression of the slides with a timer"). A Lesson Step with a blank or zero
  `Duration` runs UNTIMED: `isUntimedStep` (liveClassFlow.ts) is the one test, Control publishes
  `timer: null` for it, `/teacher/present` and `/teacher/pace` render `UNTIMED_CLOCK` (an en dash,
  never `0:00` - a zeroed clock on a projector reads as "you are out of time", which is the exact
  pressure the state exists to remove), no warning or time-up cue fires because nothing is running,
  and the auto-advance effect RETURNS EARLY so an armed clock expiring can never pull the room off
  a deck mid-explanation.
  The teacher arms one from the Remote's preset row (`ON_DEMAND_TIMER_SECONDS`, derived into
  `ON_DEMAND_TIMER_BUTTONS` so the deck and the server cannot drift). `arm-timer` / `clear-timer`
  are deliberately NOT in `DIRECT_TIMER_ACTIONS`: every action in that set throws when
  `flow.timer` is null, and working on a state that has no timer is the entire point.
  THE FULL-REPLACE TRAP BITES HERE TOO, and differently from `interlude`. The server sets the
  armed timer, but Control republishes from its OWN local state about once a second and would
  erase it within a tick - so Control holds `onDemandSeconds`, adopts it in the hydration effect
  (`setOnDemandSeconds(flow.timer.totalSeconds)`), publishes `effectiveTotalSeconds` instead of
  `activeMinutes * 60`, and clears it on every step change so a new state never inherits the last
  one's ad-hoc clock. An untimed state also breaks the 50-minute sum contract by construction -
  it cannot be added up - which is the deliberate trade and a reason not to reach for it on a work
  block.
- **EVERY CLASSROOM TOGGLE NEEDS ITS OFF SWITCH IN THE UI.** `hide-board` was wired end to end -
  action type, `/api/control-remote` handler, `/control` listener - but the iPad Remote only ever
  rendered "Open work space". Once the writing surface was up there was no way to put it away, and
  it covered the slide for the rest of the lesson. The deck key is now a toggle driven by
  `flow.presentation.boardOpen`.
  SAME FAMILY, FOUND LIVE 2026-08-03: **A LESSON HAD NO END.** `navigateFlow` THROWS "This is the last
  lesson state." on a Next past the final step, and `/api/control-remote` returns it as a 409 - but the
  Remote's `showCommandStatus` decided whether to render the status line by PATTERN-MATCHING the string
  for "Disconnected" / "did not confirm" / "failed", and that message contains none of them, so the tap
  was a silent no-op. `/control` knew about the last step (`hasNext`, a disabled Next, "Lesson
  complete!"); the iPad in his hand did not, and offered a green "Next state" forever. Now the Remote
  derives `isLastStep`, disables Next, drops the "Next: Lesson closeout" line that named a step which
  does not exist, and shows an End lesson key IN ITS OWN ROW - never in the slot Next just occupied,
  because a destructive control inheriting the position a thumb has tapped all period is a mis-tap
  waiting to happen. THE SERVER SIDE ALREADY EXISTED and still does: ending a session is
  `POST /api/teacher/session {action:"close"}` (not `"end"`), and `endSession` on the Remote carries its
  own `window.confirm`. There is deliberately NO `end-lesson` member in `TEACHER_REMOTE_ACTIONS` -
  adding one would also mean touching the sound-bank contract, which asserts that union.
  THE GENERAL RULE, and it is the third time this file has had to write it: **inferring an error from
  the wording of a status string is not error handling.** Set an explicit flag at the point of failure.
  A message parked behind a condition that cannot see it is a message nobody reads - the same fault as
  the signal chips' `setPollSubmitError` above.
- **`/teacher` CAN START THE LESSON.** The live-session card has a Start lesson button that POSTs
  `start-lesson` to `/api/control-remote` - the complete server-side start (seeds the sequence,
  flips broadcast, arms step zero) that needs no `/control` tab anywhere. `/control?...&run=1` is
  still the other path, but it hard-blocks when no session is open and only says so in a status line.
- **`/exit-ticket` BACKS DRAFTS TO `localStorage`**, keyed `bdm-exit-draft-<ticketId>` and cleared on
  submit. Answers previously lived in React state alone, so a discarded tab lost a half-written exit
  ticket silently. This matters more now that the exit ticket IS the day's evidence - it carries the
  hook problem, not a procedure question (Steele's decision, 2026-07-28).
- **THE NOTION SELECT OPTIONS AND `LIVE_RESPONSE_MODES` HAVE DRIFTED** (found 2026-07-29). The code
  knows TEN response modes; the `Math 6 Lesson Steps` data source offers NINE - `Structured Numeric`
  is missing, and `Poll Kind` is missing `structured-numeric` too. So the response kind the exit
  ticket and both learning checks depend on CANNOT BE PICKED from the property, even though the whole
  code path shipped in `f729ff6`. A teacher can still type the option name inline while authoring,
  and Notion creates it - but it must be typed EXACTLY `Structured Numeric`, because
  `liveResponseModePollKind` matches the lowercased string "structured numeric" and anything else
  falls through to `Poll Kind`, then to the state-id default, and `exit` HAS NO DEFAULT. Adding the
  option through the API means re-declaring every option on the select (the DDL has no ADD OPTION),
  which risks orphaning the values on every existing step, so it is a UI change and Steele's call.
  Nothing in code can catch this class of drift: the vocabulary contracts deliberately do not claim
  the Notion half, because it needs a token.
- **A RESPONSE KIND WITH NO QUESTION IS A STALLED ROOM - `liveStepPollQuestion` IS THE ONE ANSWER**
  (found 2026-07-30, from Steele: "the lesson screens go off track once we get to the fist to 5").
  `resolveLiveStepPollKind` calls a `learning-check` or `poll` step a **fist to five even with an
  empty `Question`** - that fallback is deliberate. `/live-flow` believes it: `expectedPollKind`
  without an `activePoll` sets `waitingForPoll`, and the Chromebook reads "Get ready to respond -
  your response box is opening." But THREE independent places demanded an authored Question before
  opening anything: `navigateFlow`'s `if (step.question && pollKind)`, `/control`'s auto-open guard
  `if (!activeItem?.question ...)`, and `openControlPoll`. So a Learning Check with a blank Question
  opened NO poll on either engine, the projector fell to `mode: "directions"`, and every student
  screen sat on "your response box is opening" for the rest of the period. Only Control's manual
  "Open to students" knew the default question, as a hardcoded copy of the string. A fist to five
  never needs an authored question - the 0-to-5 scale IS the question - so
  `liveStepPollQuestion(question, kind)` in `src/lib/liveFlowContract.ts` now supplies
  `FIST_TO_FIVE_DEFAULT_QUESTION` for that kind and an empty string for every other (a short answer
  with nothing to answer is a blank box, not a check). All three sites read it, `npm run
  test:live-flow-contract` pins the behaviour AND asserts neither engine hardcodes the string again.
  Explicit opt-out is unchanged: `Response Mode: None` or `Paper` still resolves to no kind at all.
  NOT VERIFIED IN A LIVE SESSION - the teacher write path needs `SUPABASE_SERVICE_ROLE_KEY`, so this
  was fixed from the code path, not from a running lesson. Watch it on the next real fist to five.
- **A STRUCTURED-NUMERIC STEP CAN NEVER BE JUDGED BY STRING EQUALITY** (added 2026-07-28).
  Learning checks and the exit ticket moved from multiple choice to N numeric boxes
  (`Response Mode: Structured Numeric`), because multiple choice cannot separate a student who
  misunderstands the distributive property from one who understands it and cannot multiply - and
  those need different teacher moves. `Correct Answer` on such a step is no longer an answer, it is a
  rule spec parsed by `src/lib/structuredNumeric.ts`. FIVE forms in TWO mutually exclusive shapes,
  discriminated on `spec.mode`: the BOXES shape (`boxes: N`, `sum(a,b)=N`, `a=K*b`, `a=N`) where ANY
  valid split passes so there is no single correct string; and the PAIRS shape (`pairs(N)` plus an
  optional `bank: M`, added 2026-07-31) where the student builds every two-factor pair of N from a tap
  bank of 1..M. For pairs, COMPLETENESS is scored separately from CORRECTNESS: an invented pair (4x4
  for 18, tier 2 "Listed a pair that is not a factor pair") and a merely missing pair (tier 3 "Missing
  a factor pair") are different students and land in different tally rows - never collapse them. Both
  shapes write the flat `values` column; `poll_answers.answer` keeps a canonical summary (the final
  box for boxes, "1x18, 2x9, 3x6" for pairs) because `answer` is exact-matched by the readiness
  tallies. THE TRAP (found while City Routes still existed): its readiness lookup keyed on the
  `multiple-choice` key only and compared `answer === correctAnswer` - against a structured step that
  finds no poll at all, or compares "168" to four lines of rules, marking EVERY student incorrect and
  routing the whole class to the teacher table. Confidently wrong is worse than blank. Both City
  Routes and the visit list now read through one shared `src/lib/readinessEvidence.ts`; keep it that
  way. Only the public poll fields cross `studentSafeLiveFlow` - the BOX COUNT for boxes, or the
  `{target, bank}` for pairs (the factors are derivable from the target anyway) - via
  `structuredNumericPollFields`; the rules themselves carry the answer (`5=168` IS the product) and
  never travel. A spec that will not parse fails LOUDLY in the /control load message and blocks the
  server-side start rather than opening a step with zero inputs. Pairs is still NOT in the Notion
  `Response Mode` select (same drift as Structured Numeric below) - a teacher types `Structured
  Numeric` and authors `pairs(18)` / `bank: 20` in `Correct Answer`.
- **THE RELEASE BLOCK IS A RANKED VISIT LIST, NOT WORK STATIONS** (Steele 2026-07-28). Nobody moves.
  `src/lib/visitList.ts` + `/api/live/visit-list` + `VisitListPanel` on `/teacher/remote`: four tiers,
  tier 2 grouped BY THE ERROR (nine students with one misconception is one stop, not nine visits),
  a stop-and-reteach banner when one error holds >40% of the class, and Got it / Partly / Still stuck
  taps that clear the row so what remains is WHO HAS NOT BEEN REACHED. Two students who must never be
  tier 1: one who split the harder factor (correct, just slower) and one whose only wrong box was the
  final total (arithmetic, concept intact) - that distinction is the entire reason the response kind
  changed. The taps are the ONLY path by which the teacher's read of a student's PAPER work enters
  the system; the assignment can go home unfinished, so it is never exit evidence. Requires
  `supabase/visit-check-ins.sql` (RLS on, NO policies - teacher routes only). Nothing here may reach
  a student device or a public projector; do not widen `studentSafeLiveFlow` to carry any of it.
  THE TAPS ARE STEELE'S OWN RECORD (clarified 2026-07-28): who he got time with and whether it felt
  productive. They are NOT a mechanism that acts on students - do NOT wire "promote on Got it"
  (release the Big Dog Challenge, bump a drill level). The `promoted` column exists and the POST
  accepts it, but nothing sends it and nothing should without his word.
- **CITY ROUTES IS DELETED** (Steele, 2026-07-28): "moot now that we aren't moving around." Nobody
  moves, so three named work stations with staged movement had no job left, and the visit list
  replaced it. Removed: `src/lib/cityRoutes.ts`, `CityRoutesPanel.tsx`, `CityRouteCard.tsx` (the
  student-facing city card on /live-flow), `/api/live/city-routes`, `/api/student/city-route`. DO NOT
  REBUILD ANY OF IT. What deliberately SURVIVED the cut, because it was the genuinely useful part:
  `src/lib/readinessEvidence.ts` (the shared per-student readiness read) and the tool-evidence
  tie-breaker, which now moves a VISIT TIER one step at the boundary instead of a route
  (`TOOL_STRONG`/`TOOL_WEAK` in `src/lib/visitList.ts`; a moved tier renders its reason so it is
  never a mystery mid-walk). `supabase/city-routes.sql` and the `city_route_runs` /
  `city_route_assignments` tables were left in place ON PURPOSE - dropping them is destructive and
  needs Steele's word, and leaving them costs nothing.
- **`/api/teacher/poll` VALIDATED KINDS AGAINST A HAND-COPIED ARRAY** that omitted
  `multiple-choice-explain`, so every one of those polls was stored as `short-answer` (the student
  surface still rendered right from the flow snapshot, so nothing surfaced it). It now reads the
  shared `LIVE_POLL_KINDS` union. Never re-introduce a local literal list of poll kinds.
- **TIMER WARNINGS ARE SHARED** (`src/lib/timerUrgency.ts`, Steele 2026-07-28): amber at 30s, coral
  and pulsing at 15s, faster at 5s, on the projector, the pace screen AND the student device - a
  head-down student needs the same runway the room gets. Colour and opacity only, never layout, and
  the colour survives `prefers-reduced-motion`. The sound must never be the first signal.
- **SESSIONS CLOSE THEMSELVES** (`src/lib/sessionLifecycle.ts`, Steele's ask 2026-07-28). One open
  session at a time: starting or adopting a session closes every other open row, so moving from
  period 2 to period 3 ends period 2 rather than racing it. A session also auto-closes once it
  outlives its own planned length plus `STALE_GRACE_MINUTES` (15). The cutoff is DERIVED from that
  session's lineup (`sequence.steps[].durationSeconds`) with a `MIN_SCHEDULED_MINUTES` floor of 55,
  never a flat clock - a guardrail that can end a class still in progress is worse than none, so the
  arithmetic only ever errs long. `sweepStaleSessions` is throttled to one real query per minute per
  instance and is called from the teacher session GET, session start, and `/api/student/warmup-start`.
  There is no cron: the sweep is lazy and idempotent, so it heals on the next request either surface
  makes.

## Notion + warm-up pipeline

- `src/lib/notionLessons.ts` reads the "Math 6 Lessons" DB via the Notion data_sources API
  (`NOTION_VERSION = 2025-09-03`, `POST /v1/data_sources/{id}/query`), auth
  `NOTION_TOKEN` (server-side; the literal `const NOTION_TOKEN = "secret"` on line ~13 is dead code -
  ignore it, never put a real token there). `DATA_SOURCE_IDS` NOW HOLDS EXACTLY ONE ID
  (`e367e541-...`) - CORRECTED 2026-08-03, this section said "three" and told you to keep every query
  iterating a three-source list, which is now the opposite of the truth and would send you to
  "restore" two ids that break things. The other two were a schemaless sibling and one that was never
  a data source of this database; every query against them FAILED, and under `requireComplete` that
  sank whole lookups - the documented "by-code Notion lookup returned empty" symptom. The 2026-07-26
  `notionLessonArchive.ts` fix (/api/lessons and /api/teacher/lessons missing two published
  launch-week lessons /api/today could see) is still real history: the rule it earned is that every
  lesson query iterates the SAME `DATA_SOURCE_IDS` list, whatever is in it - not that the number is
  three.
- THE LESSON STEPS DATA SOURCE IS QUERYABLE DIRECTLY, and that is the cheap way to read step fields
  in bulk. `LESSON_STEP_DATA_SOURCE_ID` (`8e467c1b-...`, the same id `notionLessonStepWrites.ts`
  writes through) carries a `Lesson` RELATION back to the lessons source, so one
  `POST /v1/data_sources/{id}/query` with an `or` of `{ property: "Lesson", relation: { contains } }`
  gets every step of several lessons at once. `mapPage`'s normal path does the opposite - a
  `GET /v1/pages/{id}` PER STEP, about twelve a lesson - which is why
  `getPublishedLessonsForDateRange` passes `includeRelations: false` and why /weekly-display (polled
  by two TVs every 60s) could not simply turn it on.
- `/api/today` returns the lesson whose `Publish Workflow` select equals `Published` AND `Date` equals
  today in `America/Los_Angeles` (not UTC). Renaming those properties or assuming UTC silently returns
  nothing.
- Warm-up shape: 5 multiple-choice (exactly 4 choices, one correct, no duplicate choice values) + 1
  short-answer bonus. Q1 fluency, Q2-Q3 spiral review, Q4-Q5 the focus topic. Q4/Q5 are RETENTION - they
  check the PREVIOUS taught day's lesson, drawn from the lesson's `Retention Q4`/`Retention Q5` fields
  (teacher text wins) else the curated pool, pulling BACKWARD only (never un-taught material).
- Entering an agreed lesson into Notion is TRANSCRIPTION, not authoring. Enter only what was
  agreed; a field the agreement does not dictate stays EMPTY - never fill it from an earlier
  draft or with plausible content, because empty renders as nothing but wrong renders on a
  classroom screen. In July 2026 the L2-D1 build (agreed state by state with Steele) was entered
  with Day-2 GCF/LCM material in four steps' support fields - teacher notes, vocabulary, stems,
  and the base64 BDM_ROUTINE_CONFIG - that was in nobody's agreement. The transcription miss hid
  in exactly the fields no one re-read. After any lesson entry, audit every step text field
  against the lesson page's scope contract ("Held for Day 2: ...") with a case-SENSITIVE sweep
  (SQLite GLOB, not LIKE - base64 blobs false-positive case-insensitive matches).
- NOTION EATS MARKDOWN IN TEXT PROPERTIES. Writing `___` into any Lesson Step or lesson text
  property (Main Display, Question, Pace Directions, Help Path, Live Questions) SILENTLY DELETES it -
  the parser reads triple underscores as formatting. On 2026-07-28 this landed
  `5 x 27 = 5 x ( 20 + 7 ) = + = ` on three Main Displays, which is a broken equation pointed at a
  projector. Use `[   ]` brackets for fill-in blanks instead, and ALWAYS re-read a text property
  after writing it - the write returns success either way. Same hazard class as
  "empty renders as nothing, wrong renders on a classroom screen".
- One page per teaching day (locked convention) - never a Notion Date range. Ranges are only a
  fallback; single dates are what make `/api/today` and the day-to-day retention chain work.
- THE LESSON DAY IS 50 MINUTES, not 55 (Steele, 2026-07-28; he had to say it again 2026-08-04,
  which is what turned up the reason it kept slipping). THE THREE BUDGETS A TEACHER ACTUALLY READS
  WHILE BUILDING A LINEUP ALL SAID 55 - `PERIOD_MIN` on `/control` (printed as the literal readout
  `{total} / 55 min`), the studio editor's over-budget flag, and `/builder`'s "over a 55-min period"
  - so all three called a 54-minute day fine, and the one surface telling the truth was
  `/teacher/rehearse`. Fixed 2026-08-04 and now pinned in `npm run test:classroom-surfaces`, in BOTH
  directions, because the tempting "fix" is to make all four numbers agree. Read the paragraph below
  on `MIN_SCHEDULED_MINUTES` before touching the fourth one.
  The rest of this bullet is still true: NOTHING IN CODE ENFORCES THE SUM -
  no check exists in `scripts/` or `src/lib/liveClassFlow.ts`, and `/control` will happily
  run a 70-minute lineup into a 50-minute period. The ONE place it is even mentioned is
  `/teacher/rehearse`, which WARNS (never blocks) when a lineup totals over 50, and does not warn at
  all when a lineup comes in short - see the same claim at the `/teacher/rehearse` bullet above.
  It is an AUTHORING contract, so the only thing
  protecting it is whoever enters the steps: add the `Duration` values up before publishing. The
  `abbies-classroom` plugin skills (`classroom-os-context` "50-minute spine",
  `lesson-database-builder`, `lesson-deployment-builder`) carry the canonical breakdown - build days
  from those, not from an older 55-minute plan. Related trap: an undesigned transition is where a
  50-minute plan becomes a 55-minute plan, so budget configuration changes explicitly.
  DO NOT "fix" `MIN_SCHEDULED_MINUTES` (55) in `src/lib/sessionLifecycle.ts` to match. That floor is
  the stale-session auto-close guardrail and is deliberately LONGER than the real period: a guardrail
  that can end a class still in progress is worse than none, so its arithmetic only ever errs long.
- Evidence ingest: `POST /api/evidence` is the single write path for warm-up + tool events (rows into
  `responses`; follow with `POST /api/mastery/recompute`). It auths on the `x-bdm-key` header:
  Vercel env `EVIDENCE_INGEST_KEY` must equal the Apps Script Script Property `BDM_EVIDENCE_KEY` (same
  value, two names) or it 401s.
- Apps Script: exactly ONE spreadsheet-level `onFormSubmit` trigger (per-form triggers double-fire and
  hit Google's 20-trigger cap). Run `repairAllWarmupTriggers()` once to clean up.
- Instant warm-up access (2026-07-21): `periods.class_code` is a permanent per-period student code
  (`supabase/period-class-codes.sql`, defaults DOG1..DOGn). In `/api/student/warmup-start`, a code
  that matches no open session falls back to the period: it reuses the period's open session or
  AUTO-CREATES the day's session (join_code = class code, broadcast "free") seeded with a minimal
  live_flow whose warmup step carries today's published lesson's form URL - the shape
  `bdm_complete_warmup_identity` verifies against, so the receipt chain is unchanged. The teacher's
  `/session` page finds and inherits that open session. A teacher-assigned lesson always wins once
  loaded (the landing page polls and swaps forms without refresh). `sessions.join_code` uniqueness
  is now a partial index over OPEN sessions only, so codes are reusable across days. REDESIGNED
  2026-07-26 (Steele's call): after the code is accepted the landing is the HOME BASE, full stop -
  lesson card, warm-up card, and /lesson, /practice, /explore links that are NEVER locked. No
  gate view, no "keep this page open". The warm-up card shows Open today's warm-up when a form
  exists (tracked per token in `sessionStorage['bdm-warmup-opened']`, softening to Reopen) and a
  calm "No warm-up loaded yet" when none does. Three mechanisms replaced the old load-bearing
  lock: (1) code entry stores a PROVISIONAL student session (`saveProvisionalStudentSession` in
  liveClassFlow - sessionId with empty studentId) so ClassSync follows the class immediately,
  meaning the teacher advancing past warm-up pushes EVERY device that typed the code, verified
  or not; (2) the warmup-status -> join verification polling moved to the global
  `WarmupJoinSync` (root layout) keyed on `sessionStorage['bdm-pending-class-code']`, so it
  survives navigation anywhere in the tab and upgrades the provisional session to the verified
  identity wherever the student is (the landing only listens for the ready event); (3)
  `/api/student/session-state` READS relaxed in secure mode - an unverified device gets the same
  minimal `studentSafeLiveFlow` projection transitional mode serves (it is the projector-public
  class screen), while every WRITE (poll answers, signals, tool evidence) still requires the
  verified join.

## Proficiency spine

Design is locked (Steele's "Independent Proficiency System") - build it, do not redesign it.
- Mastery = per-domain EWMA bars (Number and Operations, Algebra and Algebraic Thinking, Measurement and
  Data, Geometry): `m = (1-alpha)*m + alpha*score%`, alpha 0.40 Tier-2 checkpoint / 0.20 Tier-1 / 0.30
  warm-up; init from i-Ready Fall `clamp((scale-480)/180*100, 5, 98)`. Weights/cuts live in the
  `mastery_config` table, not as magic numbers. Engine: `src/lib/mastery.ts`.
- Stage gates per standard: accuracy-only caps at `approaching`; a Tier-2 checkpoint >=80% (produced
  work) reaches `mastered`; two such checkpoints >=3 weeks apart plus the SBAC-modeled item reach
  `complete`; a later <50% regresses.
- Misconceptions are a FINITE exact-match vocabulary (13 tags, no NLP); clustering keys on exact string
  match. Unmatched wrong choices map to `other`. Engine: `src/lib/grouping.ts`; archetype-templated next
  moves, optionally Claude-sharpened via `/api/live/next-move`.

## Design system

- Classroom-surface look (DECIDED 2026-07-20): the WARM NOTEBOOK temperature from the Claude Design
  "Lesson Frame Wireframes" canvas. Turn 11 made the choice; TURN 12 is canonical - it standardizes
  the look across all four surfaces (12a main, 12b support, 12c Chromebook, 12d Remote) and all
  eleven lesson states (12e). Warm dotted paper, system-font content, handwritten voice for teacher
  asides ONLY - anything a student must read uses the system font. The Remote (12d) is dark, and STAYS
  dark - it is held in a dim room facing the class, which is where the contrast rationale applies. It
  is no longer "consistent with the dark `/control` rule", because that rule was reversed on
  2026-07-29: Control's during-session view is CREAM (see rule 6). The split is now by DEVICE - laptop
  surfaces read up close are cream, the handheld is dark. The Blueprint temperature
  was rejected: fine graph grids moire on a projector at room distance, and its navy/orange chrome
  collides with the semantic per-state accent colors students learn. Source of truth lives in-repo:
  `Claude Design Wireframe/Lesson Frame Wireframes.dc.html` plus the `_ds` token set (cream/ink
  "warm edition" - hexes match `--bdb-*`); `scripts/extract-lesson-frames.mjs` regenerates
  `public/frame-preview.html` (`?solo=<id>` shows one frame full-page for the projector).
- Screen kit (`public/screens/`): one projector-ready HTML file per lesson state in the Warm
  Notebook look, plus `_blank.html` and a rich exemplar. OWNERSHIP CONTRACT: the `*.html` screens
  are HAND-OWNED - Steele edits them directly; no script may regenerate or overwrite them.
  `_system/frame.css` is GENERATED (`node scripts/build-screen-kit.mjs`) from the canvas +
  `_ds` tokens - never hand-edit it. `_system/frame.js` scales the fixed 1440x810 stage to any
  display. Slot contract: `data-slot="..."` text is fillable from Notion Lesson Step fields
  (the same fields `/teacher/studio/edit` edits); deleting the attribute locks hand-written content.
  Two rules hold on every screen regardless of author: student-required text uses the system
  font (`.nbaside` handwriting is teacher-asides only), and no student names or results appear.
- Font: `--bdb-font` = Albert Sans (Google Fonts, weights 400-800), NOT Georgia. Headings are weight
  700 in the sans font. Georgia only survives on ~7 legacy teacher/admin pages (roster, session,
  builder, teacher-login, teacher/mastery, teacher/rightnow, teacher/checkpoint-upload) - treat as
  legacy, do not spread it. `--bdb-font-body` = Geist (added 2026-07-29, Steele's call) is the design
  system's stated body/UI pairing and the only face here with real tabular numerals. It rides the ONE
  `@import` at the top of `globals.css` alongside Albert Sans and Caveat - never add a second font
  request, and never move that import off line 1, because CSS requires @import first. Only
  /weekly-display uses the body face so far; Albert Sans is still the default and the display face
  everywhere, including on that board's headings and numerals.
- Palette: CSS variables `--bdb-*` in `src/app/globals.css` `:root`. Canonical tokens: ground (page)
  `#faf6ee`, ground-2 `#f3ecdd`, card `#ffffff`, ink `#201e1a`, ink-soft `#6f675c`, ink-faint `#7a7061`
  (darkened 2026-07-26 from `#a59c8d`, which read at 2.5:1 as text - keep it AA),
  line `#ece4d4`, amber `#fcaf38`, teal `#50a3a4`, brown `#674a40`, coral `#f95335`, green `#2f9e6f`.
  Prefer `var(--bdb-ground)`; a legacy hardcoded cream `#fbf7ef` exists on the older pages - do not
  introduce a third. CONTRAST RULE (2026-07-26 accessibility pass): white text FAILS AA on teal
  (2.95:1), coral (3.32:1), and green (3.36:1) - filled controls under white text use the deep
  companions `--bdb-teal-deep #3c7d7e`, `--bdb-coral-deep #c93818`, `--bdb-green-deep #1f7a52`
  (also used when teal/coral serve AS text on cream). The bright originals stay for decorative
  fills, borders, and large graphics. GEMS tiles keep the bright fills with INK labels instead
  (ink passes on coral/amber/teal; only the purple S tile keeps white). Same trap on the design
  system's ORANGE `#f2820c` (`--orange-500` in the Claude Design `_ds` tokens, no `--bdb-*` token
  yet): white on it is 2.6:1 and it is only 2.6:1 as text on white, so the walkthrough fills
  with `#f2820c` and switches to `#c4660a` (`--orange-600`, 4.0:1) for the one numeral a student reads.
  Design handoffs from the `_ds` bundle carry `#8A8378` (3.75:1) and `#A99F91` (2.5:1) as body and
  faint text - both FAIL AA; map them to `--bdb-ink-soft` and `--bdb-ink-faint` on the way in.
- Handwriting: `--bdb-font-hand` (Caveat, loaded in the same `globals.css` @import as Albert Sans, so
  it costs no extra request and only downloads on pages that use it). Annotations and teacher asides
  ONLY - anything a student must read stays in `--bdb-font`. Claude Design handoffs specify Geist as
  the body font. The general rule still holds for the LESSON surfaces - use the site's real
  equivalents and let the handoff settle only what the system does not specify - but it is not
  absolute. Steele's reasoning, 2026-07-29: the all-day boards "are kind of a separate display
  system so its fine". So Geist is right on /weekly-display and `--bdb-font-body` exists for it.
  The test is whether the surface is part of the lesson system or a standalone display; on the
  lesson surfaces Albert Sans still wins. Do not spread Geist beyond a surface he has named.
- Pages self-style with a per-page inline `<style>` block using a unique class prefix (`.ls-` lesson,
  `.cx-` control, `.rs-` roster, `.se-` session, `.bx-` builder) reading `var(--bdb-*)`. Follow that
  pattern; there is no shared CSS module beyond `globals.css`.
- `SiteNav` has `teacher` and `student` variants (hardcoded link arrays). Per-class-state accent colors
  live in `src/lib/classStates.ts`.
- Manipulative layout convention: when a tool pairs a reference set (rules, steps, vocabulary) with a
  workspace, put the reference in a LARGE LEFT RAIL, the thing being acted on in the center, and the
  product the student is building on the right. Never stack reference material under the workspace or
  pile it into the middle - repeated classroom feedback is "too much stuff in the center, I don't know
  where to look." `/ladder-method` is now the reference implementation of the three-COLUMN form (rule
  rail + Ladder/Factor Trees modes, 2026-07-21); `/area-model` is still queued.
  `/divisibility` MOVED OFF the three-column form 2026-07-31 (Steele's annotations) to a full-screen
  single TABLE - one row per divisor, columns rule | number | factor - keeping the same left-to-right
  order (reference, the number under test, the product) but as rows so the factor family builds itself
  down the third column. Same conversation set three design directions that generalise to any
  manipulative: NO WHITE CARD BOXES (`.dv-ask`/`.dv-fam` question and family cards were the complaint -
  interactions live flat on the cream ground, only the flat amber stop-note and the deep Yes button
  keep a fill); the ACTIVE step PULSES (movement reads as "you are here" better than a static
  highlight); and the content FILLS THE SCREEN height and width (`max-width:min(1500px,96vw)`, rows
  `flex:1 1 0` to a `min-height:calc(100vh-210px)`, compacting once the run is done so a closing stage
  gets the room). Do not "restore" the 3-column /divisibility.
- TACTILE DRAG BEATS CLICKING on any manipulative where a piece goes into a slot (Steele, 2026-07-31:
  "students need to see the process of pulling the part, just like they would in person. just clicking
  it doesnt create the same sense of movement and engagement"). `FractionBarsBoard` has the reusable
  engine: one pointer-events drag (mouse AND Chromebook finger), a `data-drop="<zone>"` id per target,
  a ghost that rides the pointer, the target highlights, a tap still adds one. Explore drags a palette
  chip onto a row; How-many-fit drags a `1/d` piece into the total bar and a group tile under it. When
  a new tool places pieces, reuse this pattern, not a click-to-add button. `FractionOrderLine` is the
  second user of it (2026-08-01) and found the one trap the pattern has: **test the TAP before the
  drop zones.** Its tray is itself a `data-drop` target (drag a placed card back down to take it off),
  so a zone-first drop handler read every tap on a tray card as "dropped on the tray" and silently
  swallowed it - the tap-to-place path never armed, on exactly the touch devices that need it most.
  Fraction Bars is not affected only because its sources sit outside their targets. Order the drop
  handler `if (!moved) ... else if (zone === ...)`, and note the fault was invisible: the card stayed
  put, which is also what a normal missed drop looks like.
- PRINTED WORKSHEETS MUST LEAVE ROOM TO DO THE WORK (Steele, 2026-07-29, on three sheets in a row:
  "a consistent issue with bunching up all the problems toward the top and not using the space and
  not leaving room to actually do the work"). The `output/worksheets/*.html` sheets put four problems
  in a `.set` 2x2 grid on an 11in page, and `.p-body` is a plain top-stacking flex column - so
  content piles at the top of a tall cell and the bottom third is wasted. Every new sheet needs:
  `.p-body{justify-content:space-between}` and a distributing `.work`, a label STACKED ABOVE its rule
  with a writing band (about 34px) rather than sitting beside it, ruled rows at handwriting height
  not text height, and open work boxes that flex into the slack. Two counter-rules learned the same
  day: a read-and-pick problem (lists printed for the student, or a finished ladder to read) must NOT
  distribute - spreading it just orphans the printed lists from each other, so tag it and keep it
  compact; and a hard `min-height` on a work box will push a page past 11in (four L3 word problems
  hit 13.9in and silently spilled), so let flex-grow do it and measure. VERIFY BY MEASURING, not by
  eye: the check that catches this is dead space between a cell's last content and its bottom edge
  (should be single digits of px) plus every student page at or under 11in. Four word problems with
  real work space need TWO pages, not one.
- Copy tone: friendly, playful, second person ("Hey {firstName}!", "Today's plan", "Start the warm-up").
  Teach how to think, not what to think. Still: no emojis.

## Build, deploy, test

- `npm run dev` (webpack), `npm run build`, `npm run typecheck` (`tsc --noEmit`), and since
  2026-07-27 `npm test` - the aggregate of every golden/contract suite, run with typecheck by
  GitHub Actions CI (`.github/workflows/ci.yml`) on every push and PR. DO NOT WRITE THE COUNT
  DOWN (corrected 2026-08-04: this line said 31 while package.json chained 38, and a new
  `/status` command written the same day picked up a third number). It is
  `&&`-CHAINED AND ABORTS ON FIRST FAILURE, so there is no n-of-n tally to report either - a
  green run means every suite passed and a red one means "failed at test:<name>, the rest never
  ran". Anything claiming "38/38 green" is inferring from an exit code. The suites rotted for
  weeks when nothing ran them (four had stale assertions by 7/27); if a contract fails after a
  deliberate design change, update the CONTRACT to the new approved truth in the same commit.
  A CONTRACT CAN PASS ON THE WRONG ELEMENT (found 2026-07-29). `classroom-surface-contract.mjs`
  required `src="/big-dog-mark.png"` on `/teacher/present` as proof of the approved frame, but the
  Warm Notebook redesign (`3d6eb9a`, 2026-07-20) set `.stage-mark { display:none }` and stopped
  rendering the topbar img - so for nine days the anchor was satisfied ONLY by the tiny mark inside
  the Abbie broadcast bubble, itself invisible unless Abbie was speaking. The check was green and
  testing nothing the room could see. When a string anchor survives a redesign, confirm WHICH
  occurrence is matching before trusting it, and never re-add UI to a classroom surface just to make
  an anchor pass. (Main renders no logo by design; putting it back is Steele's call.)
  Dependencies are pinned EXACT in package.json (they were "latest" until 7/27 - never revert
  that; an unreviewed Next/React major landing on a school-morning deploy is the failure mode).
  `scripts/proxy-gate-contract.mjs` asserts every PROTECTED_PREFIX has its `/:path*` matcher
  entry in src/proxy.ts - the two lists can no longer drift fail-open.
- AN APP ROUTER `page.tsx` MAY ONLY EXPORT the default component plus the fixed config exports
  (`dynamic`, `runtime`, `metadata`, ...). Exporting a helper for testing fails the BUILD with a
  `OmitWithTag ... not assignable to type 'never'` error pointing at `.next/dev/types`, and
  `npm run typecheck` can PASS beforehand because those route types are only regenerated when the dev
  server sees the new file - so a clean typecheck is not proof here. Put shared helpers in `src/lib/`.
  Same story in reverse: after deleting a route, a stale `.next/dev/types/app/<route>/` makes
  typecheck fail on a file that no longer exists - delete the folder (`.next` is gitignored).
- Scratch worktrees: `npm run build` (Turbopack) panics if the `node_modules` symlink points outside
  what it takes as the project root - "Symlink [project]/node_modules is invalid". Put worktrees that
  need a BUILD under `.claude/worktrees/` inside the repo; a tmp-dir worktree with the symlink is
  fine for `typecheck` only.
- Golden tests: `npm run test:mastery` and `npm run test:grouping` compile `src/lib/mastery.ts` /
  `grouping.ts` in isolation (`tsc --ignoreConfig`) against Python-prototype fixtures - so do NOT add
  tsconfig path aliases or new imports to those two files, and regenerate `scripts/fixtures/*.json` if
  you change algorithm behavior.
- Deploy: edit -> commit (explicit paths) -> Steele pushes -> Vercel builds `main`. Env-var changes need
  a redeploy to take effect. `vercel.json` has NO crons since the FERPA cutover (the daily
  `/api/roster/sync` Notion pull is gone; the roster pushes from Workspace Apps Script instead).
- Classroom DISPLAY tabs stay open across deploys and never pick up new builds on their own - that
  is how "the wall is missing the feature" happens (cost a live confusion 2026-07-22: the
  projector's present tab predated the glass sheet entirely). `DeployRefresh` (root layout) polls
  the public `/api/build-id` on display routes (/board, /teacher/present, /teacher/pace,
  /live-flow, /warmup, /weekly-display - the pace projector and the all-day TVs joined
  2026-07-27; they are the longest-open tabs in the building and were silently missing
  deploys - and /teacher/scoreboard joined 2026-08-03 when it became a first-class
  second-screen card on the teacher home; it holds no local state a reload could lose,
  since every standing is re-read from /api/teacher/scoreboard every 2s) and reloads them
  when a new deploy ships. STILL MISSING and worth Steele's word: `/teacher/bruh/board`,
  the BRUH projector, has the same profile and the same gap. NEVER add /ipad to its DISPLAY_ROUTES - the pen surface
  holds the authoritative ink state and an auto-reload would wipe the room's boards. Displays are
  safe to reload; ink resyncs via hello/state on mount.
- **A COWORK SANDBOX SESSION CANNOT DELETE FILES IN THIS REPO, SO IT CANNOT BUILD OR COMMIT**
  (found 2026-08-03). Claude Cowork reaches the folder through a FUSE mount that permits create and
  write but returns `EPERM ... unlink` on every delete. Two consequences, and neither error names its
  real cause. `npm run build` dies on `EPERM: operation not permitted, unlink '.next/BUILD_ID'` -
  Next clears `.next` before writing, and `rm -rf .next` fails the same way, so there is no cleanup
  that fixes it. And ANY git command that takes the index lock (`add`, `commit`, `checkout -b`) can
  leave a `.git/index.lock` behind that the sandbox then cannot remove, which makes every later git
  call in that folder fail with "Another git process seems to be running" until someone deletes the
  lock from a REAL terminal. What DOES work from the sandbox: `npm run typecheck`, `npm test` (all 31
  suites), and every read. So a Cowork session should verify with typecheck + the contract suites,
  and hand the `npm run build`, the commit and the push to Steele rather than half-finishing them.
  Claude Code in a normal terminal is unaffected - this is the mount, not the repo.
  **NEVER RUN `git worktree add` FROM THE SANDBOX** (learned 2026-08-03). The worktree is created
  successfully and then is unusable from macOS: its `.git` file records the gitdir as the SANDBOX
  path (`/sessions/<id>/mnt/Big Dog Math Site/.git/worktrees/<name>`), so every git command run
  against it from a real terminal or from Desktop Commander answers `fatal: not a git repository`.
  Worse, `git worktree add` and `git worktree prune` both take and then fail to release locks,
  which is how `.git/index.lock` appears in the MAIN repo and blocks Steele's next commit while
  looking exactly like repo corruption.
  THE ESCAPE HATCH IS DESKTOP COMMANDER, which runs a real macOS shell outside the mount and has
  full unlink permission. Create worktrees, commit, merge and push through it; use the sandbox for
  reads, `npm run typecheck` and `npm test`. Read-only sandbox git is still worth guarding with
  `git --no-optional-locks`, because a plain `git status` can refresh and relock the index.
  TWO RECOVERY NOTES. Remove a stale lock only after `ps aux | grep "[g]it "` shows no live git
  process - concurrent sessions are normal in this repo and deleting a live lock is worse than
  leaving it. And an EMPTY (zero-byte) ref file under `.git/refs/heads/` breaks `git fetch`
  REPO-WIDE with `fatal: bad object refs/heads/<name>` plus a misleading "did not send all
  necessary objects" that reads as a remote problem; `git update-ref -d` cannot remove it either
  ("reference broken"), so delete the file directly. `find .git/refs -size 0` finds them.
  FOUR MORE FROM 2026-08-03, the session that ran the whole flow from the sandbox anyway and paid
  for it. (1) IT IS NOT ONLY `index.lock`. `HEAD.lock`, `ORIG_HEAD.lock` and
  `refs/heads/<branch>.lock` strand identically, and the ref lock is the confusing one - the command
  fails naming a file you were not thinking about. `find .git -name "*.lock"` lists the lot; hand
  Steele that list, because he can `rm` them and the sandbox cannot.
  (2) A STRANDED LOCK CANNOT BE `rm`ed FROM THE SANDBOX BUT CAN BE `mv`ed. Rename inside the same
  directory succeeds where unlink returns EPERM, so `mv .git/index.lock .git/stale-index.lock`
  unblocks the next command. It is for finishing a diagnosis, not a licence to keep writing - every
  later write strands another one, and the renamed files are litter Steele then has to clear.
  (3) A PRIVATE INDEX COMMITS WITHOUT TOUCHING THE SHARED ONE, which is the answer when another
  session is mid-merge and the shared index is unmergeable: `GIT_INDEX_FILE=/tmp/i git read-tree
  <base>`, then `git add <paths>`, `git write-tree`, `git commit-tree`, `git update-ref`. It takes no
  index lock and cannot disturb another session's staging. Only `update-ref` takes a lock, so it
  costs one, not five. `git merge-tree --write-tree` is NOT available as a treeless merge - this
  repo's git is 2.34 and that wants 2.38+.
  (4) THE BUILD CAN BE VERIFIED WITHOUT DESKTOP COMMANDER: `git archive <commit> | tar -x -C
  /tmp/verify`, COPY node_modules in (about 750MB, a minute over the mount), and `npx next build`
  there. It must be a real copy - Turbopack refuses a symlink that leaves the project root with
  "Symlink [project]/node_modules is invalid, it points out of the filesystem root", which is the
  same warning this file already gives about scratch worktrees. This is how the audit fixes were
  build-verified on the exact shipping commit while the main tree was mid-merge and `.next` was
  EPERM-locked.
- **TWO WAYS A VERIFICATION RUN LIES IN THIS SETUP, AND BOTH PRESENT AS THE OPPOSITE OF THE TRUTH**
  (found 2026-08-04, one after the other, while verifying the Choices parser fix).
  (1) A BACKGROUND PROCESS DOES NOT SURVIVE THE END OF A SANDBOX `bash` CALL. `npm test` launched
  with `nohup ... &` was KILLED at suite 37 of 39 when the call returned - but the wrapper had
  already written a nonzero status line, and the log's last line was a suite PASSING. So the exit
  code said failure, the log said success, and neither was the answer: two suites simply never ran.
  Run a long chain in slices that finish inside one call, and confirm the LAST entry of
  `package.json`'s `test` chain actually appears in the log rather than trusting a status file.
  (2) DESKTOP COMMANDER'S SHELL IS ZSH, NOT BASH. `${PIPESTATUS[0]}` is a bash-ism and expands to
  EMPTY there (`$pipestatus[1]` is the zsh spelling), so `npm run build | tail; echo
  "EXIT=${PIPESTATUS[0]}"` prints a bare `EXIT=` while the process still reports exit 0, because the
  final `echo` succeeded. Verify a Next build by `.next/BUILD_ID` EXISTING after `rm -rf .next` -
  that is an artifact, not an inference. Both of these are the same failure this file already warns
  about under `npm test`: an exit code is not evidence.
- **`mcp__workspace__web_fetch` CACHES BY URL, SO A PLAIN FETCH OF `/api/build-id` CAN REPORT A
  STALLED PIPELINE THAT IS NOT STALLED** (found 2026-08-04, during a `/status` pass, and it very
  nearly shipped as a tier 1 finding). The route is CORRECT - `src/app/api/build-id/route.ts` sets
  `export const dynamic = "force-dynamic"` and returns `cache-control: no-store`, and
  `DeployRefresh.tsx:35` fetches it with `cache: "no-store"` - so classroom displays are unaffected
  and there is nothing to fix in the product. The stale value is the AGENT'S OWN fetch tool
  replaying a response cached under that exact URL, which the previous day's status pass had
  populated with the genuinely-stranded `265ea95`. Measured back to back: the plain URL returned
  `265ea95` (42 commits and a day behind) while `?cachebust=<anything>` returned `bbf45a0`, which
  was `origin/main` HEAD and had deployed 3.7 seconds after the push.
  ALWAYS FETCH IT WITH A CACHE-BUSTING QUERY PARAM. This trap is nastier than it looks because the
  false reading is INDISTINGUISHABLE from the real 2026-08-03 stall - same route, same symptom, same
  sha - and this file already instructs an agent to treat exactly that reading as the leading tier 1
  finding. Corroborate with Vercel `list_deployments` before calling a pipeline stalled: a genuine
  stall shows NO deployment created for the newest commits, whereas here the newest commit had a
  READY production deployment all along. Same family as the two lies above - a value you did not
  observe this run is not evidence.
- `.next` `ENOTEMPTY` build errors are a Google Drive cloud-sync artifact (`rm -rf .next` and rebuild),
  not a code bug. Ignore `aistudio_*` and ` 2`-suffixed sync duplicates; never stage them. The same
  sync artifact also lands INSIDE `.git` and `.next/types`: duplicated files like
  `refs/remotes/origin/HEAD 2`, `index 2`, or `routes.d 3.ts` cause
  `fatal: bad object refs/remotes/origin/HEAD 2` on fetch and duplicate-identifier typecheck errors.
  Fix: delete the ` 2`/` 3`-suffixed files (`find .git .next -name "* 2" -o -name "* 3"`), then retry.
  A `node_modules 2` duplicate makes `npm run build` fail on a spurious type error deep in a
  third-party `.d.ts` (a webauthn package, nothing you touched) - same artifact, same fix: delete
  the duplicate and rebuild. Drive also re-applies DELETES late: a file git just restored can
  vanish seconds afterward because your earlier `rm` only now synced - if a freshly checked-out
  file is missing, `git checkout -- <path>` again and re-verify before concluding anything.
- A PANE SCREENSHOT CAN DISAGREE WITH THE LAYOUT. Against a REMOTE origin the capture is composited independently of the live tree: /weekly-display screenshotted as a board filling only the top-left ~60% of the frame while `getBoundingClientRect()` said it filled the viewport exactly. Do not chase a scaling bug off a screenshot - settle it with geometry (`elementFromPoint` at all four viewport corners is decisive, and cheap). The same capture was correct against localhost minutes earlier, so distrust it specifically on remote origins.
- **`/demo` IS THE PROJECTOR TEST HARNESS, NOT JUST THE PORTFOLIO FRONT DOOR** (2026-08-03, how four
  of the six live surface bugs were reproduced without a teacher cookie, a session, Supabase or
  Notion). It is PUBLIC, and its `/demo/present` + `/demo/pace` wrappers re-export the REAL gated page
  components, with `/live-flow?studioPreview=1` as the student pane - so `npm run dev` plus one
  navigation puts all three classroom surfaces on screen, driven step by step, in a same-origin page
  whose iframes you can read straight out of `contentDocument`. Pause its auto-advance and use the dot
  buttons to pin one state (note the dots are NOT 1:1 with steps - a poll contributes a second dot for
  its results beat).
  FOR A STATE THE DEMO LESSON DOES NOT CONTAIN, POST YOUR OWN SNAPSHOT. Open
  `/demo/present?studioPreview=1&embed=1` directly and `window.postMessage({type:"bdm-studio-preview",
  snapshot}, "*")` from the page itself - a window posts to its own listeners, so no parent frame is
  needed - and the surface renders it through the ordinary path. That is how the blank You Do was
  reproduced and both its branches (empty vs authored work fields) checked in about a minute.
  TWO LIMITS. `?studioPreview=1` cannot show a `slide` frame (`studioPreviewFlow.ts` never carries
  `slideUrl`), so verify those on `/teacher/rehearse`. And the FIRST navigation to a route the dev
  server has not compiled can Fast-Refresh the PARENT page and silently reset its React state
  mid-verification - curl each route once to pre-compile before driving it, and re-establish any
  helper you defined on `window`.
- Verifying in the in-app Browser pane: the preview throttles rendering, so CSS animations sit at
  their first frame and screenshots wait for motion to settle - prove motion with
  `el.getAnimations()` or keyed-remount node identity instead of watching. TRANSITIONS freeze the
  same way, so a `getComputedStyle` opacity read mid-transition returns the OLD value and reads as a
  bug that is not there - `el.getAnimations().forEach(a => a.finish())` over the animated nodes
  (transitions are in that list too) jumps everything to its final state, which both fixes the read
  and gives you a screenshot of the real settled frame. When asserting on computed values, note that
  `getComputedStyle(el).strokeDashoffset` is `"0px"`, not `"0"` - `Number()` gives NaN and every
  drawn path looks undrawn; use `parseFloat`. `ResizeObserver`
  callbacks may never fire there (dispatch a synthetic window `resize` after resizing), and
  synthetic `dispatchEvent` clicks BATCH under React 18 - one state-advancing synthetic click per
  `javascript_tool` call is the reliable rhythm. `window.innerWidth` can report the pane frame
  rather than the emulated viewport (and misreports under real browser zoom), so in tool code size
  from the measured container (`clientWidth` on a ref), not `window.innerWidth`. Non-fronted pane
  tabs are fully hidden at 0x0 - `tabs_select` alone does not give a tab a viewport (a screenshot
  against that tabId does), `position:fixed` elements measure zero there, and canvases sized from
  such a rect stay 1x1 - so verify cross-tab sync SEQUENTIALLY, fronting one tab at a time, and
  guard app code against zero-rect measurements (a mount-time retry interval that keeps re-measuring
  until the rect is real recovers automatically, and is what saves the projector-behind-/control
  case in production too). BroadcastChannel DID span pane tabs on 2026-07-22 (live ink sync
  ipad-tab -> board-tab worked), where 2026-07-21 testing found it did not - treat cross-tab BC as
  unreliable-but-possible: try the direct cross-tab path first, fall back to posting into the
  target tab's own context. On the webpack dev server, an IFRAME of a same-app route that has not
  been compiled yet (e.g. /ipad embedding /teacher/present) can trigger "Fast Refresh had to
  perform a full reload" of the PARENT page, silently resetting its React state mid-verification -
  curl the route once to pre-compile it before driving iframes. Route changes in
  the pane are FULL document loads even through next/link and `window.next.router.push`, and
  parent-page intervals are throttled - so a `window.fetch` override cannot survive navigation and
  loses the race against mount effects. To exercise a data-backed page without Supabase/Notion env,
  register a temporary same-origin Service Worker that answers the `/api/*` calls (write it under
  `public/`, register from `javascript_tool`, reload; unregister and DELETE the file before
  committing - it survives page loads because it intercepts at the network layer, and the real
  page logic runs untouched). Caveat: the pane's loader sometimes fails SW-controlled NAVIGATIONS
  outright ("This page couldn't load" while curl serves the route in milliseconds) - if that hits,
  unregister the SW, verify what you can through `?preview=` params plus `getAnimations()`, and
  treat the SW technique as page-load-dependent, not guaranteed. To test SUPABASE-TRANSPORT
  behavior locally (realtime ink sync, anon auth), copy the PUBLIC `NEXT_PUBLIC_SUPABASE_URL` +
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` out of the deployed bundle (curl a chunk from bigdogmath.com -
  they are the same values every student browser receives) into the worktree's gitignored
  `.env.local`; without them `getSupabase()` is null and the BroadcastChannel fallback silently
  masks transport differences - ink realtime broadcast was first proven live this way 2026-07-22.
- Student digital responses: Response Mode on a Lesson Step drives the Chromebook input.
  "Multiple Choice + Explain" (added 2026-07-21) shows tappable choices plus a required written
  explanation; the choice stays in `poll_answers.answer` (tallies, correctness, and readiness
  exact-match it) and the explanation lives in `poll_answers.explanation`
  (`supabase/poll-explanations.sql`). An unknown/blank Response Mode falls back to `Poll Kind`, then
  to state-id defaults (`question` short-answer, `learning-check` fist-to-five); `exit` has NO
  fallback, so exit steps must always carry an explicit Response Mode.
