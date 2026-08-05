# Big Dog Math website build handoff

Snapshot date: July 17, 2026

Scope: Big Dog Math website and classroom application only. This handoff contains no personal, legal, financial, or unrelated project context.

## New contributor scope boundary

This contributor works on representational math tools inside the website application.

Division of responsibility:

- The primary Codex task retains responsibility for all lesson-plan pedagogy, instructional sequencing, lesson-specific strategy choices, and deployment of curriculum content to the regular Math 6 and Math 6 ACC Notion databases.
- The new website contributor implements bounded representational-tool briefs in code and keeps new tools consistent with the existing Big Dog Math tool family.
- The owner approves changes in direction. A tool implementation does not silently make a curriculum decision.

They must not:

- research lesson content or pedagogy for individual lessons
- create, rewrite, schedule, divide, or reorganize Notion lesson pages
- create warm-ups, assignments, assessments, vocabulary, sentence stems, or lesson visuals as curriculum work
- change live Notion lesson records merely to make the website easier to test
- take ownership of the Math 6 or Math 6 ACC curriculum-planning workstream
- decide where, when, or why a tool belongs in a lesson
- modify the core classroom orchestration, Lesson Screen Studio, warm-up pipeline, or assessment flow unless that exact integration slice is explicitly assigned

They may inspect the live Notion schema and representative records read-only when that is necessary to understand an approved tool brief or diagnose a tool mapping. Their normal edit surface is the tool's route, component, shared tool UI, and the smallest required catalog or live-tool integration. Any test that requires a Notion write must use an owner-approved test page or stop and request coordination.

Notion is an external content source for this contributor, not their lesson-creation workspace.

## Representational-tool contributor lane

Each tool begins with an approved instructional brief supplied by the owner or primary Codex task. The brief defines the mathematical purpose, representation, student moves, prompts, constraints, and any evidence to collect. The website contributor implements that brief; they do not replace it with a different pedagogical concept.

Before creating a new tool:

1. Identify the closest existing tool in mathematical purpose and interaction pattern.
2. Read its route, component, shared header/navigation, configuration hook, and any evidence emitter.
3. Reuse established Big Dog Math visual tokens and interaction conventions.
4. Confirm whether the tool is standalone only, assignable in Live Flow, or both.
5. Confirm whether it is a representation aid, guided practice, or scored check. Do not add scoring or mastery evidence unless the brief explicitly requires it.

Tool implementation principles:

- Keep the mathematical representation central and the controls lean.
- Present one clear student action at a time instead of exposing every control at once.
- Design for Chromebook touchpads, touch screens, and classroom-projector visibility.
- Use Albert Sans, existing `--bdb-*` tokens, locally prefixed component styles, and a centered responsive work frame near 760 to 820 pixels where the representation allows it.
- Use `clamp(...)` for important responsive type and spacing rather than fixed projector-scale values.
- Preserve visible work and intermediate thinking instead of making steps disappear.
- Give immediate, specific local feedback, preserve revision, and do not wait for a network round trip before showing a valid interaction.
- Track wrong steps separately from final correctness when the brief calls for scored practice.
- Use concise, warm calls to action rather than long procedural paragraphs.
- Keep student-facing text smaller than projector headings and avoid unnecessary metadata.
- Allow reset or new-problem actions without accidental data loss.
- Reserve feedback space so a correction does not shift the entire work area.
- Use meaningful `aria-label` and `aria-live` text, numeric input modes when appropriate, and a reduced-motion path.
- Use at least 44-pixel touch targets; larger draggable objects and answer chips should generally be 52 to 56 pixels.
- Use React pointer events with pointer capture. Do not build hover-only or separate mouse-only interactions.
- Apply `touch-action: none` only to the actual drag surface, convert pointer coordinates through its bounding rectangle, and handle both pointer-up and pointer-cancel cleanup.
- Avoid forcing the iPad keyboard over the work. Auto-focus only when a fine pointer or the approved interaction makes it appropriate.
- Use fictional fixtures and do not store student PII.
- A new tool remains optional until the primary Codex task assigns it to a lesson and deploys that relationship through Notion.

The approved tool brief should specify:

- tool name and proposed route
- mathematical purpose and representation
- student-facing prompt and sequence of moves
- allowed inputs, manipulatives, and constraints
- correct state, common error states, revision behavior, and reset behavior
- standalone-only or explicitly approved Live Flow assignment
- no evidence, practice evidence, or scored evidence
- required standard and finite misconception tags, if evidence is approved
- Chromebook, projector, touch, keyboard, and accessibility acceptance checks

Typical files to inspect before adding a tool:

- `src/components/ToolNav.tsx`
- `src/components/useLiveToolConfig.tsx`
- `src/lib/liveClassFlow.ts`
- `src/lib/liveFlowContract.ts`
- `src/lib/classStates.ts`
- `src/lib/toolEvidence.ts`
- the closest existing component and its `src/app/<tool>/page.tsx` route

Use a thin `src/app/<tool>/page.tsx` wrapper with `ToolNav` and one client component. `src/components/ToolHeader.tsx` is a legacy pattern; do not render both headers and create duplicate navigation.

Useful existing comparisons include `DistributiveAreaMethod.tsx`, `AreaExplorer.tsx`, `FractionBars.tsx`, `FractionBarsBoard.tsx`, `NumberLineTool.tsx`, `LadderMethodTool.tsx`, `DoubleNumberLine.tsx`, `PercentBar.tsx`, `EquationBuilder.tsx`, and `CoordinateGrid.tsx`. Choose the closest two; do not copy every pattern into every tool. `AreaExplorer.tsx` is the strongest staged-solve and feedback reference; `DistributiveAreaMethod.tsx` is a strong pointer-versus-touch reference.

Live Flow wiring is optional and requires confirmation from the primary Codex task. When approved, inspect:

- `src/lib/liveClassFlow.ts` for the tool route and config contract
- `src/components/useLiveToolConfig.tsx` for the teacher-supplied task listener
- `src/lib/classStates.ts` for the canonical state bank
- `src/app/control/page.tsx` for registration, setup, aliases, and config creation
- `src/lib/liveFlowContract.ts` for assigned-tool routing
- `src/components/ClassSync.tsx` for the student class-mode allowlist
- `src/app/lesson/page.tsx` for student lesson-page tool mapping
- `src/app/teacher/page.tsx` for the teacher catalog
- `src/app/explore/page.tsx` only when student free play is approved

For live configuration, apply a new teacher config only when its `liveTool.id` changes. `NumberLineTool.tsx`, `PercentBar.tsx`, and `EquationBuilder.tsx` show this pattern.

Learning evidence is also optional. A non-assessable sandbox or explainer emits no evidence. When an approved tool produces a meaningful completed problem:

- add the finite tool/domain allowlist on both the client and secure server paths
- call `reportToolResult()` once per completed problem
- use a stable problem ID and the exact approved standard
- use the existing finite misconception vocabulary rather than generated prose
- mark the result correct only when the problem was completed without a wrong step
- never import or call the service-role client from the browser

Evidence files are `src/lib/toolEvidence.ts` and `src/app/api/student/tool-evidence/route.ts`.

## Start here

Big Dog Math is a teacher-controlled classroom orchestration system built around a Notion lesson plan, a Supabase-backed live session, two public projector roles, student Chromebooks, and a private iPad Remote.

The canonical workspace is:

`/Users/steelewilson/Documents/Website prototype`

Production site:

`https://bigdogmath.com`

GitHub repository:

`https://github.com/Wilsos22/Website-prototype`

Read these files before changing code:

1. `AGENTS.md`
2. `CLAUDE.md`
3. This handoff
4. `docs/M2_T1_L1_CLASSROOM_UX_CONTRACT.md`
5. `docs/m2-t1-l1-classroom-pilot-ux-contract.md`
6. `ROADMAP.md`

The shared preview checkout may not contain every production file in that list. If `docs/M2_T1_L1_CLASSROOM_UX_CONTRACT.md` is absent, read it from a clean `origin/main` worktree or with `git show origin/main:docs/M2_T1_L1_CLASSROOM_UX_CONTRACT.md`. Do not merge the dirty preview branch merely to obtain the document.

Important documentation caveats:

- `README.md` is prototype-era and incorrectly says the app has no login, database, or cloud synchronization. Do not use it as the current architecture overview.
- `docs/website-backlog.md` contains features that have since shipped. Treat it as historical until each item is checked against production code and the live app.
- `CLAUDE.md` contains the standing repository rules, but its reference to a root `middleware.ts` is stale. The current production auth boundary is `src/proxy.ts`.
- A stale document or wireframe never overrides the deployed app, current production code, live Notion schema and records, or live Supabase state.

## Source-of-truth order

Use the deployed app, live Notion records, live Supabase state, and current fetched `origin/main` to establish what the system is doing now. Current behavior does not automatically mean the behavior is instructionally correct.

Use the latest owner decisions and approved classroom UX contracts to establish the intended target. Use structured Notion Lesson and Lesson Step properties for lesson-specific content, and use the Claude Design wireframe for visual fidelity. Roadmaps, older setup notes, and historical docs come last.

When current behavior conflicts with the intended target, document the difference instead of describing either side as the whole truth.

Do not claim a feature is working because a route or source file exists. Distinguish:

- verified in the live classroom flow
- present in production code but not live-piloted
- local-only or uncommitted
- planned but not implemented
- blocked by a missing migration, environment variable, Notion relation, or external setup step

## Product boundaries

### Core classroom operating system

The core system is responsible for:

- selecting the exact lesson and exact live session
- accepting a student class code and establishing the student homepage
- assigning and verifying the Google Form warm-up
- starting, pausing, resuming, advancing, and ending the lesson
- synchronizing the Main projector, Pace and Support projector, Chromebook, and iPad Remote
- rendering lesson-specific content from structured Notion Lesson and Lesson Step data
- collecting brief digital checks, polls, exit tickets, drafts, and evidence
- showing private teacher data only on the iPad Remote or protected teacher pages
- synchronizing the iPad writing surface with the Main projector

### Standalone hosted classroom utilities

These are hosted on Big Dog Math but are not part of the room's core operating system:

| Utility | Routes | Boundary |
| --- | --- | --- |
| BRUH review game | `/teacher/bruh`, `/teacher/bruh/board`, `/teacher/bruh/remote`, `/teacher/bruh/scoreboard`, `/bruh` | Standalone whole-class review game. It is used the day before a unit test and must not be inserted automatically into ordinary lesson sequences. |
| Weekly Learning Display, also called the learning-intention tool | `/weekly-display` and `/api/weekly-display` | Standalone rotating classroom display for learning intention, success criterion, weekly topics, and bell schedule. It is not one of the synchronized lesson surfaces. |
| Math tools | Routes such as `/fraction-bars`, `/ladder-method`, `/distributive-area`, and `/area-explorer` | Tools may run alone or be explicitly assigned within a lesson state. Their existence does not make them automatic lesson states. |

The BRUH game and Weekly Display can remain visually related to Big Dog Math without being coupled to lesson-state orchestration.

## Core classroom surfaces

| Surface | Primary route | Role | Must not become |
| --- | --- | --- | --- |
| Laptop host | `/control` | Dark teacher setup and operator surface; chooses the session, lesson, sequence, and screen links | A student-facing projector or a cream-themed duplicate of the builder |
| Teacher Home | `/teacher` | Finds lessons, starts or manages sessions, and reaches Studio and screen setup | A second live remote |
| Session setup | `/session` | Shows the exact open session and launches all exact-session surfaces | A separate contradictory session state |
| Main projector | `/teacher/present?session=<session-id>` | Mathematical story, problem, model, visual, or interactive content | Timer wall, control toolbar, private notes, or student roster |
| Pace and Support projector | `/teacher/pace?session=<session-id>` | Current directions and support; timer only when it serves the phase | State bank, control toolbar, private data, or a duplicate Main screen |
| Student homepage | `/` | Code entry, today's lesson context, bright warm-up action, and allowed challenge activities | A holding page that waits for the teacher before the warm-up |
| Student live lesson | `/live-flow` | One current action, response, or explicitly assigned support | Projector-scale text, persistent join code, or unnecessary lesson metadata |
| Private iPad Remote | `/teacher/remote?session=<session-id>` | Stable private control layout, three public-screen mirrors, speaker notes, response data, state actions, and writing | A lesson-by-lesson redesign or public projector surface |
| iPad writing surface | `/ipad` and the Remote work-space control | Immediate local Pencil ink synchronized to the exact Main session | An embedded copy of Notability or Apple Notes |

The Remote is installable as an iPad Home Screen app through `public/teacher-remote.webmanifest`. It remains a web app backed by the same session, not a separate native application.

When a Chromebook is not collecting a response or running an assigned interactive, it may mirror the useful Main or Pace content or show a quiet holding state. It should not invent a fifth stream of lesson information.

## Locked classroom behavior

### Student arrival and warm-up

The intended production flow is:

1. The teacher opens a class session and selects the correct lesson.
2. The student enters the class code.
3. The student lands on the student homepage and sees today's lesson, module, and topic.
4. The student selects the bright amber `Open today's warm-up` action.
5. Big Dog Math opens the assigned Google Form.
6. The Google Form remains three fluency questions and two prior-learning retrieval questions.
7. The exact student's exact-session completion receipt is verified.
8. The student returns to or remains on the homepage, where allowed challenge activities are unlocked.
9. When the teacher begins the lesson, the confirmed student follows the synchronized lesson state.

Normal code entry must not require the teacher to approve every student. Manual teacher admission is a recovery path only.

The warm-up can begin before the teacher starts the lesson pacing timer. A student must not be trapped on a generic waiting screen after entering a valid code.

Warm-up remains a real Google Form. Do not create a native warm-up form unless the owner separately approves it.

Warm-up and warm-up review do not display the learning intention or success criterion. Review is a brief look at answers and frequently missed problems, not a correction or resubmission workflow.

### Lesson progression and timers

- Selecting a lesson in the host may stage its identity and assigned warm-up on the open session so students can see the lesson context and start the warm-up before `Begin lesson`. It must not start the timer or advance the synchronized instructional/projector surfaces.
- Loading a lesson inside Lesson Screen Studio is a private editing preview and must not mutate the active session.
- Starting the lesson turns on automatic pacing by default.
- The teacher can pause, resume, move Back or Next, stop pacing, or end the session.
- Manual navigation preserves whether the lesson was running or paused.
- Timer values are clamped so corrupt local values never display as an hours-long countdown.
- Timer zero provides a clear chime and transition before automatic advancement.
- A visual timer is not constantly required during lesson delivery. It is useful for warm-up, the learning check, discussion phases, activities, independent work, and transitions. During direct mathematical explanation, the support screen is often more useful for vocabulary, sentence stems, a worked example, or steps.
- This selective-timer rule is the latest owner decision and overrides older contract language that describes the Pace timer as permanently fixed and visible.
- Student drafts survive state changes and reconnects. Editing, saving, saved, failed, reconnecting, sending, received, and submitted states must be explicit and truthful.

### Instructional structure the system must support

The website is built to support strong lessons, not to dictate generic slides. New-topic lessons should be able to move through:

1. Brief prior-knowledge activation and sense-making
2. Concrete work, using real table manipulatives first when practical
3. A digital concrete tool only when physical materials are not the best option
4. Representational work, including a purpose-built site tool when it removes drawing friction
5. Structured abstract guided practice on whiteboards
6. A digital readiness check before independent work
7. Private temporary routing to a small group, continued practice, or extension
8. Paper-first independent work with digital support when useful
9. A separate exit-ticket formative
10. Cleanup-only closeout

The frozen 55-minute M2.T1.L1 sequence is the complete pilot reference, not a command to make every future day identical. A lesson's exact sequence comes from its structured Notion plan. Screens must support the best delivery for that lesson, while the foundational instructional rules above remain intact.

The abstract whiteboard routine should support: watch one example without writing, copy the next prompt, think with the marker down, write or circle something that matters, compare with a partner, revise, then hold boards up.

The digital readiness check is separate from the whiteboard practice. It should give the teacher immediate evidence for small-group decisions.

Discussion and error analysis use structured phases: Think, Write, Discuss, Revise, and Share. Sentence stems and vocabulary must be visible when students are expected to use them.

Gallery Walk and Small Group are configurable lesson routines, not generic decorative screens. Private teacher grouping information stays off public projectors.

### Learning target and success criterion

- The learning intention is not shown during warm-up.
- Each daily lesson selects exactly one student-facing success criterion from the options in Notion.
- The success criterion is one concise `I can` statement.
- The learning intention and selected success criterion first appear at the midlesson learning check and may reappear later only when useful.
- The optional student-name reader spinner and Monday iPad Kid spinner are selectable states; they are not permanently overlaid on the control panel.

### Independent work and closeout

- Independent work is paper-first unless a lesson intentionally assigns a digital practice state.
- The website shows directions, required problem numbers, due and turn-in information, the help path, optional support, and any assigned tool.
- The website does not duplicate the paper problem text.
- The crafted paper set is required in full. One Big Dog Challenge may be optional after required work.
- The teacher grades paper manually and may enter results or challenge points later.
- Paper scanning and automated grading are future possibilities, not current scope.
- The student Chromebook may show a brief lesson review, worked sequence, vocabulary, or an assigned site tool during independent work.
- Closeout only tells students to put away supplies, turn in required work, clean their area, and reset the room.
- Hide empty categories. Show games and tools only when deployed and explicitly assigned.

### Private rotating City Routes

The approved readiness-routing concept uses neutral city names so students are never publicly labeled by level.

- Use a bank of ten cities and select three for a lesson.
- Rotate both the city names and the instructional meaning attached to each city.
- The teacher privately reviews, overrides, and releases routes.
- A student sees only their own city, physical destination, materials, and first action.
- Public screens show no names, scores, tier labels, misconception labels, or route roster.
- Route assignments expire after the lesson and must never become permanent labels.

This requirement is approved but currently local and documentation-only. It appears in local preview commit `fdd3e6f` and this handoff, not in the fetched `origin/main` production contract. No production source implementation was found during this audit, so do not describe City Routes as shipped without a new verification.

## Visual contract

- Use Albert Sans and the `--bdb-*` tokens in `src/app/globals.css`.
- Keep `/control` dark for classroom contrast.
- Main and Pace use rich dark tonal fields with a soft semantic glow.
- Chromebooks use a warm cream ground with compact type and a matching semantic accent.
- Labels and familiar icons remain so color is never the only signal.
- Keep information lean. Every item on a live surface must directly serve the current phase.
- Do not add emoji to UI copy, code comments, logs, documentation, or commit messages.

Semantic state families:

- Warm-up and Review: evergreen
- Launch: scenario-owned palette
- Concrete: forest
- Representational: teal
- Abstract: indigo
- Learning Check: plum with gold emphasis
- Discussion: burnt orange
- Independent: navy
- Exit Ticket: burgundy
- Closeout: warm gold

The detailed color values and layout dimensions are frozen in `docs/M2_T1_L1_CLASSROOM_UX_CONTRACT.md`.

The current visual reference is:

`Claude Design Wireframe/M2.T1.L1-handoff-2026-07-15.dc.html`

The wireframe is currently an untracked local file and is absent from `origin/main`. A clean production worktree will not contain it unless the owner or coordinating agent supplies the local design asset. It is a visual reference, not a substitute for live behavior, structured content, or the UX contract.

## Lesson content and Lesson Screen Studio

Notion is the lesson-content source. Supabase is the live-session and response source. The new website contributor consumes and maps that content but does not author or research it.

The lesson integration is centered in `src/lib/notionLessons.ts`. It reads the regular Math 6 lesson data sources and maps both lesson-level properties and related Lesson Steps.

Important lesson-level fields include:

- Lesson Code, title, date, module, topic, and standard
- Publish Workflow and Skip status
- Learning Intention
- Success Criteria options and Selected Success Criterion
- Classroom Mode
- Discussion Stems and Discussion Vocabulary
- Required Paper Work and Required Digital Work
- Optional Support and Big Dog Challenge
- Due and Turn In and Help Path
- Warm Up Link and Exit Ticket Link
- related Lesson Steps

Exit tickets default to the explicitly assigned Google Form or other external formative for that lesson. Legacy exit-ticket records created by earlier site workflows must not silently become the instructional source.

Important Lesson Step fields include:

- order, start minute, duration, state ID, and advance mode
- Main Display
- Pace Directions
- Student Action
- Remote Actions and Teacher Notes
- question, response mode, choices, correct answer, and standard
- paper task, tool, and link URL
- discussion stems and vocabulary
- work-space availability
- public surface mode: `split` or `linked`
- Gallery Walk or Small Group routine configuration

One Notion lesson page represents one teaching day. A multi-day lesson is divided into one page per day. `Skip = Yes` excludes a lesson. The app should use the exact lesson ID or exact lesson code and must not silently choose a trashed, skipped, duplicate, or old page.

Regular Math 6 and Math 6 ACC are separate Notion lesson streams. Do not merge or cross-edit them unless the owner explicitly requests it. Confirm the course and exact lesson code before changing lesson-linked behavior.

The Lesson Screen Studio is `/teacher/studio`.

Studio responsibilities:

- select a published lesson and one of its Lesson Steps
- preview Main, Pace and Support, Student, and private iPad content together
- show inherited lesson content in editable fields so a teacher can change a word or two
- add or replace a step from the canonical state bank
- choose linked public surfaces when all public screens may show the same content
- configure split surfaces when each role needs different content
- configure discussion, Gallery Walk, Small Group, response, tool, resource, and writing behavior
- save guarded edits to Notion with revision-conflict handling
- never mutate an active live session while the teacher is privately editing

Key Studio files:

- `src/app/teacher/studio/page.tsx`
- `src/app/api/teacher/lesson/route.ts`
- `src/app/api/teacher/lessons/route.ts`
- `src/app/api/teacher/lesson-step/route.ts`
- `src/lib/notionLessons.ts`
- `src/lib/notionLessonStepWrites.ts`
- `src/lib/lessonStepMetadata.ts`
- `src/lib/lessonRoutineConfig.ts`
- `src/lib/successCriterion.ts`
- `src/lib/lessonVisuals.ts`

## Runtime architecture and key files

The app uses Next.js App Router, React, and TypeScript on Vercel. The lockfile, not the word `latest` in `package.json`, is the source of the installed framework versions.

### Authentication and privacy

- `src/proxy.ts`: protected-route boundary for teacher pages and sensitive APIs
- `src/lib/teacherAuth.ts`, `src/lib/teacherToken.ts`: teacher access helpers
- `src/lib/studentIdentity.ts`: student identity and roster checks
- `src/lib/liveFlowPrivacy.ts`: public/private lesson-flow boundary
- `docs/student-data-security.md`: security rollout notes
- `docs/student-google-auth-rollout.md`: deferred Google OAuth path

Teacher auth must fail closed when configured protection is unavailable. Do not weaken teacher API protection to make a test pass.

Student local storage is convenience state, not authorization. Server routes must enforce session, roster, warm-up, and ownership checks.

Do not store real student PII in fixtures or source files.

### Supabase

- `src/lib/supabase.ts`: browser-safe client
- `src/lib/supabaseServer.ts`: server-only service-role client
- `supabase/*.sql`: additive schemas, migrations, policies, and hardening

Never import `src/lib/supabaseServer.ts` into client or browser code. Server-only tables are accessed through `src/app/api/*` route handlers.

Important classroom migrations include:

- `supabase/student-warmup-sessions.sql`
- `supabase/session-joins.sql`
- `supabase/remote-control.sql`
- `supabase/lesson-live-evidence.sql`
- `supabase/polls.sql`
- `supabase/formative.sql`
- `supabase/bruh.sql` for the standalone BRUH game

The existence of a migration file does not prove it has been applied to the live project. Verify the live schema before depending on it.

### Notion and warm-ups

- `src/lib/notionLessons.ts`: lesson and Lesson Step reads
- `src/lib/notionLessonStepWrites.ts`: guarded Lesson Step edits
- `src/app/api/today/route.ts`: published daily lesson
- `warmup-generator.gs`, `warmup-evidence.gs`, `warmup-notion-sync.gs`: Google Apps Script warm-up pipeline
- `src/app/api/student/warmup-start/route.ts`
- `src/app/api/student/warmup-status/route.ts`
- `src/app/api/student/warmup-verify/route.ts`
- `src/app/api/student/join/route.ts`
- `src/lib/warmupResource.ts`

Warm-up creation for future lessons is currently paused while lesson content and templates are stabilized. Do not bulk-generate or clean out warm-ups without a separate instruction and a live Notion audit.

### Live classroom state

- `src/lib/classStates.ts`: canonical state bank and defaults
- `src/lib/classroomPilot.ts`: semantic stages and discussion support
- `src/lib/liveClassFlow.ts`: synchronized snapshot, sequence, timer, tool, and remote command types
- `src/lib/liveFlowContract.ts`: navigation, responses, tools, and support behavior
- `src/lib/discussionProtocol.ts`: Think, Write, Discuss, Revise, Share phases
- `src/app/control/page.tsx`: dark laptop host and sequencer
- `src/app/session/page.tsx`: exact-session lifecycle and screen launchers
- `src/app/teacher/present/page.tsx`: Main projector
- `src/app/teacher/pace/page.tsx`: Pace and Support projector
- `src/app/live-flow/page.tsx`: synchronized Chromebook surface
- `src/app/teacher/remote/page.tsx`: private iPad Remote
- `src/components/ClassSync.tsx`: student session synchronization

### Writing, audio, and Abbie

- `src/components/InkBoard.tsx` and `src/lib/inkSync.ts`: local-first Pencil drawing and session synchronization
- `src/app/teacher/audio/page.tsx` and `src/lib/classroomAudio.ts`: classroom-host audio library
- `src/components/AbbieConsole.tsx` and `/api/abbie`: optional teacher-triggered Abbie utility

The writing system intentionally uses its own canvas so strokes can be synchronized to the exact Main projector. Notability and Apple Notes cannot be embedded as the synchronized drawing engine.

Teacher audio is stored on the classroom host device. Remote sound or Abbie triggers depend on the classroom host being open and connected; they are not a cloud media library.

## Environment variables

Never record values in documentation, chat, commits, screenshots, or logs. Verify names and presence only.

Current code references these groups:

- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `BDM_SUPABASE_URL`, `BDM_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Teacher access: `TEACHER_USERNAME`, `TEACHER_PASSWORD`, `BDM_TEACHER_PASSWORD`, `CRON_SECRET`
- Notion: `NOTION_TOKEN`, `NOTION_ROSTER_DB_ID`, `NOTION_ROSTER_DS_ID`, `NOTION_WARMUP_DATABASE_ID`, warm-up data-source IDs, and other feature-specific Notion IDs
- Warm-up evidence: `EVIDENCE_INGEST_KEY` and related public rollout flags
- Student-security rollout: `NEXT_PUBLIC_SECURE_STUDENT_DATA`, `NEXT_PUBLIC_REQUIRE_STUDENT_GOOGLE_AUTH`, `NEXT_PUBLIC_STUDENT_EMAIL_DOMAIN`, `NEXT_PUBLIC_WARMUP_IDENTITY_ENABLED`
- Abbie voice and enrichment: `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_MODEL`, `ELEVENLABS_VOICE_ID`

Inspect the current production code and Vercel configuration before removing, renaming, or consolidating any variable.

## Production status verified for this handoff

Production branch at fetch time:

`origin/main` at `f09ad27` (`fix: restore synchronized classroom surfaces`)

Recent production work includes:

- Lesson Screen Studio and guarded Notion Lesson Step editing
- restored four-surface classroom roles and exact-session launchers
- selectable spinner, discussion, Gallery Walk, and Small Group state support
- secure code-first Google Form warm-up flow
- installable iPad Remote shell and synchronized writing status
- standalone BRUH game
- standalone Weekly Display

Live HTTP checks on July 17, 2026 confirmed:

- `https://bigdogmath.com` returned 200
- `https://bigdogmath.com/bruh` returned 200
- `https://bigdogmath.com/weekly-display` returned 200
- protected teacher routes redirected to `/teacher-login`, confirming the public auth gate was active

These checks prove that the routes are deployed and the teacher gate responds. They do not prove an end-to-end classroom session, Supabase migration, Notion relation, Apple Pencil stream, or Google Form receipt works.

## Shared-checkout warning

The shared checkout was actively changing while this handoff was assembled.

At one point it was `codex/m2-t1-l1-preview` at `fdd3e6f`; during the audit other agents added `087063c` for Area Explorer and additional teacher-auth commits. Its ahead count changed repeatedly while this document was being checked, while the branch still lacked newer production commits from `origin/main`. Re-run the graph instead of relying on any count in a handoff.

Observed local or untracked work included:

- `next-env.d.ts`
- `Big_Dog_Thinking_Posters/`
- `Claude Design Wireframe/`
- `Notebook Slide Decks/`
- Weekly Display design references and branch-divergent route copies
- `src/app/api/teacher/lesson-media/`
- `supabase/lesson-media.sql`

Some Weekly Display files appear untracked only because the preview branch is behind production; the feature itself is on `origin/main` and live. Lesson media work was not verified as deployed.

Do not switch, reset, merge, stage, or delete files in this shared checkout based on the snapshot above. Re-run status and coordinate ownership first. A contributor should use a clean worktree or branch created from a freshly fetched `origin/main` whenever possible.

Never use `git add .` or `git add -A`. Stage only the exact files you changed.

## What still needs proof or work

The core orchestration workstream's highest-priority next activity is one complete, front-to-back classroom pilot using a fictional class and a newly created session. That pilot remains with the primary Codex task unless a bounded website slice is delegated. Production commits and contract tests address many previously reported failures, but those fixes must not be treated as classroom-verified until the pilot passes.

The pilot should verify:

1. Teacher Home selects the intended live Notion lesson and opens one consistent session.
2. Student code entry lands on the homepage, not a waiting screen.
3. The amber warm-up action opens the correct non-trashed Google Form without individual teacher approval.
4. Verified completion unlocks the homepage challenge area and later synchronized lesson entry.
5. Begin lesson moves all confirmed students and all three public surfaces to the same exact session state.
6. Main and Pace retain their different roles and match the approved wireframe hierarchy.
7. Warm-up contains no learning intention or success criterion.
8. The learning check introduces exactly one `I can` statement.
9. Discussion shows its phases, sentence stems, and vocabulary.
10. Student response prompts have a real response control.
11. Paper-first independent work shows useful supports without reproducing paper problems.
12. Auto-advance starts with the lesson, while Pause, Resume, Back, Next, Stop, and timer zero behave correctly.
13. The Control timer cannot display a corrupt hours-long value.
14. iPad commands give immediate local feedback and confirmed or failed delivery status.
15. Abbie and sound utilities remain reachable without cutting off primary controls.
16. Apple Pencil ink appears immediately on the iPad and then on the exact Main projector with acceptable smoothness.
17. Opening the work space keeps the mathematical problem visible beside the board.
18. Studio inherited text appears inside editable inputs, saved visuals remain visible, and Notion conflicts are handled safely.
19. Gallery Walk, Small Group, linked surfaces, spinner, and discussion configurations survive save and reload.
20. End session clears the running state consistently on Teacher Home, Session, Control, Remote, and student devices.

Known risk areas from earlier live use include stale or trashed warm-up links, contradictory session state, students not following the teacher's next state, oversized or unnecessary text, timer corruption, missing projector selection guidance, unresponsive Remote controls, Abbie actions that appear inert, ink visible only on the iPad, missing lesson visuals, and generic layouts that drift from the approved Claude wireframe. Recent production commits were intended to address several of these, but each item remains a verification target.

City Routes are approved but currently documentation-only unless a new code and live-state check proves otherwise.

## Safe contribution sequence

1. Fetch the current repository state.
2. Confirm the latest `origin/main` and the live deployment before making assumptions.
3. Use a clean worktree or coordinated branch from `origin/main`.
4. Read the UX contract and the exact files for the assigned slice.
5. Verify live Notion and Supabase assumptions read-only before changing integrations. Do not edit live lesson content.
6. Reproduce one concrete failure with fictional data.
7. Fix the smallest complete vertical slice.
8. Run the relevant contract tests, typecheck, and production build.
9. Stage only the exact changed paths.
10. Fetch and merge safely before pushing.
11. Verify the Vercel deployment and repeat the affected live pilot steps.
12. Report what is verified live, what is code-only, what remains, and whether the owner needs to do anything.

The owner has authorized agents to commit, push, and deploy for this project. That permission does not override shared-tree safety, exact-path staging, required checks, migration caution, or live verification.

## Required checks

There is no single all-tools integration test. Every standalone representational tool change requires at least:

```bash
npm run typecheck
npm run build
```

Manually verify the tool in free play at Chromebook and projector sizes. If it is explicitly integrated into a live joined session, also verify the assigned prompt/config, reconnect, reset, and leave-class behavior.

When approved tool work changes classroom-runtime or lesson-mapping files, add the relevant contract checks:

```bash
npm run test:classroom-surfaces
npm run test:live-flow-contract
npm run test:live-flow-privacy-contract
npm run test:public-lesson-contract
```

The broader classroom system has additional tests listed in `package.json`. Run them when the changed slice touches those contracts. Source-contract and golden checks are valuable regression guards, but they are not a substitute for live-size interaction testing.

## Recommended first contribution

For this contributor, begin with one owner-approved representational-tool brief. Build one complete tool route and component, match it to the closest existing tools, verify it at Chromebook and projector sizes, and add only the minimum catalog or Live Flow wiring named in the brief.

Do not begin with another broad visual rebuild, a lesson rewrite, a Notion cleanup, or a redesign of the classroom operating system. The primary Codex task retains the cross-surface pilot and curriculum-integration responsibility unless a specific website slice is delegated.

This division lets tool creation move in parallel while lesson plans, pedagogy, and Notion deployment remain coherent under one owner.

## Ready-to-paste contributor prompt

```text
Work only on the Big Dog Math website in /Users/steelewilson/Documents/Website prototype. Read AGENTS.md, CLAUDE.md, and docs/WEBSITE_BUILD_HANDOFF.md completely before acting. Treat the deployed app, freshly fetched origin/main, live Notion schema and lesson records, and live Supabase state as sources of truth. Preserve all user and other-agent work. The shared checkout may be dirty and diverged, so use a clean worktree or coordinated branch from origin/main and never stage all files.

You are the representational-math-tool website contributor. The primary Codex task retains all lesson-plan pedagogy, instructional sequencing, lesson-specific strategy decisions, and deployment to the regular Math 6 and Math 6 ACC Notion databases. Do not research, create, rewrite, schedule, or reorganize lessons, warm-ups, assignments, assessments, vocabulary, sentence stems, or curriculum visuals. Do not decide where a tool belongs in a lesson. Notion inspection is read-only and only for understanding an approved tool brief or diagnosing a website mapping. Do not change live lesson records for testing; use fixtures or an owner-approved test page.

The core classroom system is the exact session plus four synchronized roles: Main projector, Pace and Support projector, Student Chromebook, and private iPad Remote, with the dark laptop Control as host. BRUH and Weekly Display are standalone hosted utilities, not automatic lesson-sequence states. Keep the approved UX and instructional rules in this handoff intact.

Take one approved tool brief at a time. Before changing code, identify the two closest existing tools, the exact production commit, the route and component files you will own, whether the tool is standalone or Live Flow assignable, any explicit evidence requirement, and the current branch and dirty-tree risk. Match existing Big Dog Math tool patterns, keep the math representation central, and make only the smallest required integration changes. After changes, run relevant tests, npm run typecheck, and npm run build; stage only exact paths; verify the deployed tool at Chromebook and projector sizes. Clearly separate verified-live, code-only, local-only, blocked, and remaining work.
```
