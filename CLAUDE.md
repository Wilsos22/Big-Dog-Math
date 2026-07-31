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
8. Do not store real student PII until RLS is tightened. Mock/test identities must be fully fictional.
   OPEN AS OF 2026-07-29: Steele is checking CCSD's privacy requirements and whether student data can
   live in Supabase at all. **Until he has that answer, do not build new student-data plumbing** - that
   explicitly defers bridging `poll_answers` into `responses` (the exit-ticket-to-mastery gap) and the
   `session_joins.last_seen_at` column the participation view wants. UX work is unblocked and is the
   agreed priority meanwhile.
   The facts he needs, verified 2026-07-29: `students` holds `full_name`, `email` and
   `email_normalized` - real names and district emails, re-synced daily by the 13:00 UTC roster cron.
   `session_joins` and `poll_answers` hold `display_name`. `poll_answers` holds `answer`,
   `explanation`, `values`; `responses` holds `answer`, `work_snapshot`, `misconception` - student work
   product. Two points in his favour: RLS is locked down and verified (anon gets permission-denied on
   `students`, `sessions`, `responses` and the rest), and NO student PII reaches the Anthropic API -
   `/api/live/next-move` sends `studentCount` only. If the sticking point turns out to be names plus
   district emails in a third-party cloud, the mitigation is a pseudonymous roster keyed to a district
   id with names resolved only in the teacher's browser - a real project, not a patch.
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
  THE STUCK BUTTON IS THIS ROUTE AND ONLY THIS ROUTE (Steele, 2026-07-29): the walkthrough belongs
  behind the homepage `Stuck on the assignment?` chip, NOT on a lesson or tool surface. A `Stuck?`
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
  scratch, straight up, OMG, be right back, you. THE CLIPS ARE NOT IN THE REPO AND MUST NOT BE:
  half are copyrighted recordings and this repository is public, and it is 14MB of binary besides.
  They live in IndexedDB on the classroom laptop, which is the whole point of the loadable bank.
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
  checkpoints, exit-tickets, mastery, rightnow), `/control`, `/session`, `/roster`, `/start-question`.
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
- API: gated - `/api/form-responses`, `/api/mastery` (+`/history`,`/recompute`), `/api/live/*`,
  `/api/roster/sync`, `/api/checkpoints/upload`, `/api/abbie` (+`/voice`). Public - `/api/today`,
  `/api/lessons`, `/api/warmup-summaries`, `/api/session/*`, `/api/auth/login`,
  `/api/evidence` (authed separately by header, see Notion pipeline).
  `/api/abbie` WAS PUBLIC and was gated 2026-07-29: it forwards whatever text it is handed straight
  to api.anthropic.com on the server's key, so an ungated prefix was an open relay anyone could
  spend on and put arbitrary text through. It is in `PROTECTED_PREFIXES` now. Do not move it back.

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
  before believing it. THE AUDIT WAS RIGHT ABOUT ONE THING - `students.full_name` / `email` are real
  names and district emails, which is precisely the open CCSD question in rule 8. Its proposed fix
  (drop both columns) would break `/api/roster/sync`, which UPSERTs both from Notion every morning
  at 13:00 UTC; a pseudonymous roster is a project, not a column drop.
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
  THE BIG ONE (found 2026-07-29): **`poll_answers` NEVER REACHES `responses`, SO THE EXIT TICKET MOVES
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
  THE AUTHORING FORMAT IS DECIDED AND TESTED; THE RUNTIME DOES NOT HONOUR IT YET.
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
- **THE PEN SURFACE SAYS WHEN A NEW BUILD IS WAITING** (2026-07-30). `/ipad` is deliberately absent
  from `DeployRefresh` - it holds the authoritative ink, so an automatic reload would wipe the room's
  boards mid-lesson - and the cost of that correct decision is that it can sit on a build from days
  ago with NOTHING saying so: the pen still draws, the dot still reads connected, and the only
  symptom is that a shipped fix is not there. `UpdateReadyChip` polls `/api/build-id` and offers a
  tap-to-reload chip. It must NEVER reload on its own. When a fix is reported as not working, check
  what build the iPad is actually running before re-debugging the fix.
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
  (the same fields `/teacher/studio` edits); deleting the attribute locks hand-written content.
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
  where to look." `/divisibility` is the reference implementation; `/ladder-method` followed it
  2026-07-21 (rule rail + Ladder/Factor Trees modes); `/area-model` is still queued.
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
  2026-07-27 `npm test` - the aggregate of all 27 golden/contract suites, run with typecheck by
  GitHub Actions CI (`.github/workflows/ci.yml`) on every push and PR. The suites rotted for
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
- A PANE SCREENSHOT CAN DISAGREE WITH THE LAYOUT. Against a REMOTE origin the capture is composited independently of the live tree: /weekly-display screenshotted as a board filling only the top-left ~60% of the frame while `getBoundingClientRect()` said it filled the viewport exactly. Do not chase a scaling bug off a screenshot - settle it with geometry (`elementFromPoint` at all four viewport corners is decisive, and cheap). The same capture was correct against localhost minutes earlier, so distrust it specifically on remote origins.
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
