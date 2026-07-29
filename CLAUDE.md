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
  is still captured and carried on the wire, so do not remove it; restoring feel is a radiusFor
  change only. Do not "fix" the flat line back to pressure ink.

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
6. The control panel (`/control`) stays DARK for projector contrast. Do not carry the cream theme onto
   it.
7. Verify the build before reporting "done" (`npm run typecheck` at minimum, `npm run build` for
   anything non-trivial). Do not rely on file edits alone.
8. Do not store real student PII until RLS is tightened. Mock/test identities must be fully fictional.
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

## Repo layout

- `src/app/**` - App Router pages and API routes (one folder per route, direct `page.tsx`/`route.ts`;
  no route groups, no per-segment layouts except the root `layout.tsx`).
- `src/components/**` - shared React components (SiteNav, ToolNav, AbbieTalk, the manipulatives, etc.).
- `src/lib/**` - non-UI logic: `supabase.ts`, `supabaseServer.ts`, `notionLessons.ts`, `mastery.ts`,
  `grouping.ts`, `toolEvidence.ts`, `teacherToken.ts`, `classStates.ts`, `liveClassFlow.ts`.
- `src/proxy.ts` - the real access-control gate (see Auth).
- `supabase/*.sql` - hand-run, idempotent migrations (no migration runner; run them in the Supabase SQL
  Editor). `supabase/SETUP.md` documents env setup.
- `warmup-*.gs` (repo root) - Google Apps Script warm-up pipeline (generator, Notion sync, evidence
  poster, week builder, pools). Steele pastes these into the Apps Script editor.
- `scripts/` - golden-file tests + fixtures for the mastery/grouping engines.
- `public/` - assets. Inline square mark: `big-dog-mark.png`; wordmark/banner: `big-dog-logo.svg` /
  `big-dog-logo.png`.
- `ROADMAP.md` - mirror of the Notion "Big Dog Math - Feature Tracker"; update BOTH when a feature ships.

## Routes (as of this writing)

- Student / public flow: `/` (landing, join-by-code), `/join`, `/explore`, `/lesson`, `/today`,
  `/lessons`, `/practice`, `/challenge`, `/checkpoint`, `/exit-ticket`, `/assignment/[id]`, `/spinner`,
  `/homework-help`.
- `/homework-help` (added 2026-07-28) renders the lesson's existing `Help Path` property ONE STEP PER
  SCREEN with one button, reading the public `/api/today` - zero new authoring, works every night for
  whatever the assignment is, with no live session and no join (it runs at 8pm from a kitchen table).
  Steele's constraint: sixth graders ignore a wall of supports and A LIST IS A WALL. Never turn it
  into a list, and never add an "I am stuck, skip it" exit - an escape hatch cheaper than the work
  gets used instead of the work. Reached from the third `.st-explore` button on the landing page.
- Manipulative tools (public, no session): `/whiteboard`, `/number-line-plus`, `/number-line`,
  `/fraction-bars`, `/group-bars`, `/percent-bar`, `/algebra-tiles`, `/equation-builder`,
  `/order-of-operations` (GEMS), `/combine-like-terms`, `/proportions`, `/area-model`,
  `/coordinate-grid`, `/ladder-method`, `/multiplication-fluency`, `/term-identifier`,
  `/divisibility`, `/distributive-area`, `/area-explorer`, `/balance-beam`, `/long-division`,
  `/place-value`, `/place-value-mirror`, `/timer`.
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
- /weekly-display is the FIFTH room surface: two all-day TVs in the back rotating
  learning intention / success criteria / week schedule / bells every 20s, fed by public
  /api/weekly-display (params ?screen= pins one view, ?day=, ?track=acc). Public route,
  in DeployRefresh.
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
  checkpoints, exit-tickets, mastery, rightnow), `/control`, `/session`, `/roster`, `/start-question`.
  `/teacher/growth` redirects to `/teacher/rightnow`. Note: `/builder` and `/abbie` are teacher-ish but
  NOT gated. The lesson flow does NOT require `/control` to run: `/api/control-remote` executes
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
- API: gated - `/api/form-responses`, `/api/mastery` (+`/history`,`/recompute`), `/api/live/*`,
  `/api/roster/sync`, `/api/checkpoints/upload`. Public - `/api/today`, `/api/lessons`,
  `/api/warmup-summaries`, `/api/abbie` (+`/voice`), `/api/session/*`, `/api/auth/login`,
  `/api/evidence` (authed separately by header, see Notion pipeline).

Slide overlays: `/teacher/slides` is the Canva-lite editor writing the Lesson Step's `Slide Overlay`
Notion property (percent-based element JSON via `src/lib/slideOverlay.ts`; rich_text values chunk at
1900 chars in `notionLessonStepWrites`). The overlay rides `LiveFlowSequenceStep.slideOverlay`
through every flow builder and `SlideOverlayLayer` renders it on `/teacher/present` above the auto
slide (below ink on board states). A step with an empty property renders exactly as before.

Screen Studio previews are the REAL surfaces, not copies: `/teacher/studio` embeds
`/teacher/present?studioPreview=1` and `/teacher/pace?studioPreview=1` in scaled iframes and posts
the draft as a `LiveClassFlowSnapshot` (built by `src/lib/studioPreviewFlow.ts`) over
`postMessage`. The surfaces detect `?studioPreview=1`, skip the session fetch, and adopt the posted
snapshot as a synthetic session so every downstream render is unchanged. This is why redesigning a
surface never needs a matching Studio change again - do NOT rebuild hand-copied studio previews.
(The Student and Remote studio previews are still hand-built; embed them the same way when they
drift.)

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
are silently dropped and students see nothing. All 19 tool routes are wired as of 2026-07-26
(/divisibility joined the union that day, end to end: ASSIGNED_TOOL_ROUTES so Notion "Tool:
Divisibility Rules" resolves, ClassSync target, tool-divisibility bank state, control map, and the
banner on DivisibilityRules) - a NEW
route is the case to watch, so wire the component in the same change that extends `LiveToolRoute`.
Where a route's `LiveToolConfig` arm carries a typed payload (`/number-line-plus`, `/percent-bar`,
`/equation-builder`, `/order-of-operations`, `/algebra-tiles`, plus two teacher-set sequence arms:
`/distributive-area` `{ set }` - "24x7,16x8" via `src/lib/distributiveProblems.ts` - and
`/ladder-method` `{ set }` - "24,36,60" for Factor Trees via `src/lib/factorTreeSet.ts`) the tool
also applies `tool.config` to its own state - always in an effect keyed on `tool.id`, never on the
tool object (`useLiveToolConfig` re-reads every second, so object identity churns and an
object-keyed effect restarts the student's problem mid-answer; `PercentBar` is the pattern). Both
sequence tools also take the same string as a `?set=` URL param, resume progress per device from
localStorage, and treat an empty set as free play. The remaining arms are `Record<string, never>`,
where the prompt is all there is - do not invent config behavior for them.

Counting those arms, `LiveToolRoute` has 22, not 19: `/challenge`, `/exit-ticket` and `/checkpoint`
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
`/api/checkpoints`, `/api/outreach`, `/api/submissions`, `/api/teacher`, `/api/control-remote`,
`/api/iready`, `/api/warmup-summaries`) - plus, when `NEXT_PUBLIC_SECURE_STUDENT_DATA=true`
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
  in secure mode - a single-flight ~3s cache shared by ClassSync, /live-flow, AbbieStudentBubble,
  and useLiveToolConfig (measured 0.27 req/s per device, was ~1.5). A NEW consumer that calls
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

## Data layer (Supabase)

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
  `misconceptions`, `mastery_config`) allows anon SELECT.
- Migrations are idempotent and hand-run; each schema-changing file ends with
  `notify pgrst, 'reload schema';`. Adding a table means writing a new `.sql`, choosing its RLS group
  deliberately, and running it in the SQL Editor. Order matters: `schema.sql` -> `proficiency.sql` ->
  `evidence.sql` (which makes `responses.problem_id` nullable and adds `source/domain/standard_id/
  item_ref/dedupe_key`).
- Roster sync is an UPSERT that NEVER deletes (`/api/roster/sync`, Vercel cron daily 13:00 UTC).
  Students missing from Notion are reported, not removed. Consequence: wiping `students` in Supabase
  without first clearing the Notion roster database silently undoes itself the next morning - the
  cron recreates every student, name and district email included. Clear Notion first, then run
  `supabase/end-of-year-student-wipe.sql` (which also deletes child rows explicitly, because several
  FKs are ON DELETE SET NULL and would otherwise strand rows still carrying `display_name`).
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
- **DO NOT FILTER NOTION LESSON STEPS BY THE STATE CATALOG.** `/control` dropped every step whose
  `State ID` was not in `DEFAULT_STATES` (about thirty real ids in the database) while
  `/api/control-remote` did not filter at all - so the two engines ran different lessons from the same
  Notion page. Unknown ids now get a synthesized bank entry with an EMPTY `desc` and are named in the
  load message. When adding a second consumer of `lesson.steps`, make it agree with `stepsFromLesson`.
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
- **CONTROL'S SNAPSHOT IS A FULL REPLACE.** Any field Control does not carry through is DELETED.
  `interlude` and `transition` are owned by `/api/control-remote`, and omitting them erased a Hustle
  or Settle about one second after it started, then auto-advanced past it. Same class of bug wiped
  `remoteActions` and `slideOverlay` on any reconnect. When adding a server-authored `live_flow`
  field, add it to the `liveFlowSignature` snapshot in the same commit.
- **THE DISCUSSION OVERLAY COVERS `/control` AT z-index 50.** Any control the teacher needs mid-
  discussion must be reachable from inside `DiscussionProtocol`; Control's own Back is invisible.
- **`resolveLessonVisual` TAKES TWO ID NAMESPACES.** `stateId` is the `ClassroomStageId` (warmup maps
  to `evergreen`, launch to `scenario`); `rawStateId` is the class-state id. Skip lists written in
  raw ids must be checked against `rawStateId` or they never fire.
- **EVERY CLASSROOM TOGGLE NEEDS ITS OFF SWITCH IN THE UI.** `hide-board` was wired end to end -
  action type, `/api/control-remote` handler, `/control` listener - but the iPad Remote only ever
  rendered "Open work space". Once the writing surface was up there was no way to put it away, and
  it covered the slide for the rest of the lesson. The deck key is now a toggle driven by
  `flow.presentation.boardOpen`.
- **`/teacher` CAN START THE LESSON.** The live-session card has a Start lesson button that POSTs
  `start-lesson` to `/api/control-remote` - the complete server-side start (seeds the sequence,
  flips broadcast, arms step zero) that needs no `/control` tab anywhere. `/control?...&run=1` is
  still the other path, but it hard-blocks when no session is open and only says so in a status line.
- **`/exit-ticket` BACKS DRAFTS TO `localStorage`**, keyed `bdm-exit-draft-<ticketId>` and cleared on
  submit. Answers previously lived in React state alone, so a discarded tab lost a half-written exit
  ticket silently. This matters more now that the exit ticket IS the day's evidence - it carries the
  hook problem, not a procedure question (Steele's decision, 2026-07-28).
- **A STRUCTURED-NUMERIC STEP CAN NEVER BE JUDGED BY STRING EQUALITY** (added 2026-07-28).
  Learning checks and the exit ticket moved from multiple choice to N numeric boxes
  (`Response Mode: Structured Numeric`), because multiple choice cannot separate a student who
  misunderstands the distributive property from one who understands it and cannot multiply - and
  those need different teacher moves. `Correct Answer` on such a step is no longer an answer, it is a
  four-form rule spec parsed by `src/lib/structuredNumeric.ts` (`boxes: N`, `sum(a,b)=N`, `a=K*b`,
  `a=N`); ANY valid split passes, so there is no single correct string. `poll_answers.answer` keeps
  the final box and the boxes go in the new `values` column, because `answer` is exact-matched by
  the readiness tallies. THE TRAP (found while City Routes still existed): its readiness lookup keyed on the
  `multiple-choice` key only and compared `answer === correctAnswer` - against a structured step that
  finds no poll at all, or compares "168" to four lines of rules, marking EVERY student incorrect and
  routing the whole class to the teacher table. Confidently wrong is worse than blank. Both City
  Routes and the visit list now read through one shared `src/lib/readinessEvidence.ts`; keep it that
  way. Only the BOX COUNT crosses `studentSafeLiveFlow` - the rules carry the answer (`5=168` IS the
  product). A spec that will not parse fails LOUDLY in the /control load message and blocks the
  server-side start rather than opening a step with zero inputs.
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
  (`NOTION_VERSION = 2025-09-03`, `POST /v1/data_sources/{id}/query`, three `DATA_SOURCE_IDS`), auth
  `NOTION_TOKEN` (server-side; the literal `const NOTION_TOKEN = "secret"` on line ~13 is dead code -
  ignore it, never put a real token there). THE DATABASE HAS THREE DATA SOURCES and published pages
  really do live across them - any query that hits only one source is silently blind to the rest.
  That bug shipped in `notionLessonArchive.ts` (fixed 2026-07-26): /api/lessons and
  /api/teacher/lessons (the Studio + Slide-extras lesson pickers) missed two published launch-week
  lessons that /api/today could see. Keep every lesson query iterating the SAME three-source list.
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
- THE LESSON DAY IS 50 MINUTES, not 55 (Steele, 2026-07-28). NOTHING IN CODE VALIDATES THE SUM -
  verified: no check exists in `scripts/` or `src/lib/liveClassFlow.ts`, and `/control` will happily
  run a 70-minute lineup into a 50-minute period. It is an AUTHORING contract, so the only thing
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
  asides ONLY - anything a student must read uses the system font. The Remote (12d) is dark - it is
  the private teacher surface, consistent with the dark `/control` rule. The Blueprint temperature
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
  (the same fields `/teacher/studio` edits); deleting the attribute locks hand-written content.
  Two rules hold on every screen regardless of author: student-required text uses the system
  font (`.nbaside` handwriting is teacher-asides only), and no student names or results appear.
- Font: `--bdb-font` = Albert Sans (Google Fonts, weights 400-800), NOT Georgia. Headings are weight
  700 in the sans font. Georgia only survives on ~7 legacy teacher/admin pages (roster, session,
  builder, teacher-login, teacher/mastery, teacher/rightnow, teacher/checkpoint-upload) - treat as
  legacy, do not spread it.
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
  (ink passes on coral/amber/teal; only the purple S tile keeps white).
- Pages self-style with a per-page inline `<style>` block using a unique class prefix (`.ls-` lesson,
  `.cx-` control, `.rs-` roster, `.se-` session, `.bx-` builder) reading `var(--bdb-*)`. Follow that
  pattern; there is no shared CSS module beyond `globals.css`.
- `SiteNav` has `teacher` and `student` variants (hardcoded link arrays). Per-class-state accent colors
  live in `src/lib/classStates.ts`.
- Manipulative layout convention: when a tool pairs a reference set (rules, steps, vocabulary) with a
  workspace, put the reference in a LARGE LEFT RAIL, the thing being acted on in the center, and the
  product the student is building on the right. Never stack reference material under the workspace or
  pile it into the middle - repeated classroom feedback is "too much stuff in the center, I don't know
  where to look." `/divisibility` is the reference implementation; `/ladder-method` followed it
  2026-07-21 (rule rail + Ladder/Factor Trees modes); `/area-model` is still queued.
- Copy tone: friendly, playful, second person ("Hey {firstName}!", "Today's plan", "Start the warm-up").
  Teach how to think, not what to think. Still: no emojis.

## Build, deploy, test

- `npm run dev` (webpack), `npm run build`, `npm run typecheck` (`tsc --noEmit`), and since
  2026-07-27 `npm test` - the aggregate of all 20 golden/contract suites, run with typecheck by
  GitHub Actions CI (`.github/workflows/ci.yml`) on every push and PR. The suites rotted for
  weeks when nothing ran them (four had stale assertions by 7/27); if a contract fails after a
  deliberate design change, update the CONTRACT to the new approved truth in the same commit.
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
  a redeploy to take effect. `vercel.json` has one cron: `/api/roster/sync` at 13:00 UTC daily.
- Classroom DISPLAY tabs stay open across deploys and never pick up new builds on their own - that
  is how "the wall is missing the feature" happens (cost a live confusion 2026-07-22: the
  projector's present tab predated the glass sheet entirely). `DeployRefresh` (root layout) polls
  the public `/api/build-id` on display routes (/board, /teacher/present, /teacher/pace,
  /live-flow, /warmup, /weekly-display - the pace projector and the all-day TVs joined
  2026-07-27; they are the longest-open tabs in the building and were silently missing
  deploys) and reloads them when a new deploy ships. NEVER add /ipad to its DISPLAY_ROUTES - the pen surface
  holds the authoritative ink state and an auto-reload would wipe the room's boards. Displays are
  safe to reload; ink resyncs via hello/state on mount.
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
- Verifying in the in-app Browser pane: the preview throttles rendering, so CSS animations sit at
  their first frame and screenshots wait for motion to settle - prove motion with
  `el.getAnimations()` or keyed-remount node identity instead of watching. `ResizeObserver`
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
