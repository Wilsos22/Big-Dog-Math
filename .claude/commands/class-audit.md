# /class-audit - run a full (or scoped) simulation and critique of Big Dog Math

Steele's "run simulation and critique button" (requested 2026-07-27). Perform an
objective evaluation of the classroom system and report what works, what is at
risk, and what must be done - ranked, with owners. Scope comes from the
argument; no argument means `full`.

Scopes: `full` | `student` | `teacher` | `curriculum` | `code` | `pedagogy`

## Ground rules

- Read CLAUDE.md first. Do not re-litigate decided designs (proficiency spine,
  Warm Notebook, click-only signals, constant-width pen); critique execution
  against them.
- READ ONLY on Notion and production. Never write to Notion during an audit;
  never use Steele's real teacher password (throwaway TEACHER_PASSWORD in a
  worktree .env.local covers gated pages locally).
- Findings need evidence: a file:line, a screenshot, or a query result. Rank as
  LAUNCH BLOCKER / FIRST-WEEK RISK / LIVE-WITH-IT, each with the classroom
  moment it would bite and a one-line fix.
- End with "What is genuinely solid" - specific, verified, not flattery.

## Scope: code (subagent, parallel)

Launch an Explore subagent (very thorough), read-only, asking: "what breaks,
confuses, or embarrasses during a real school day?" Focus: the student day path
(landing/join, ClassSync + WarmupJoinSync, /live-flow, /api/student/*), the
teacher day path (/session, /control, /api/control-remote, present, pace), the
data spine (mastery, grouping, evidence, recompute), operational failure modes
(Notion down vs no lesson published, Supabase outage, missing env), and
polling volume per device. Cap at 15 ranked findings.

## Scope: curriculum (subagent, parallel)

Launch a general-purpose subagent with Notion MCP tools, READ ONLY
(notion-fetch / notion-search / notion-query-data-sources only). It must first
read src/lib/notionLessons.ts for data-source ids and property names, then
audit: (1) lesson coverage for the next two teaching weeks - pages exist,
single dates, Publish Workflow = Published, steps with known State IDs,
explicit Response Mode on every exit step; (2) warm-up readiness (forms built,
retention fields sane); (3) roster database populated with REAL students -
report counts per period only, never names or emails; (4) Feature Tracker rows
at `Priority = "Now"` AND the `Done` CHECKBOX = `__NO__`. Do NOT filter on
`Status != Done` — `Status` has no such value (it runs Live / Planned / Parked /
Needs revision / In progress), so that filter matches EVERY row and reports
finished features as outstanding work. Output a coverage table + ranked gaps.

## Scope: student / teacher (the live simulation - run in this session)

1. Stand up the ink worktree dev server (add the `bigdog-ink` launch.json
   entry pointing npm --prefix at the worktree; revert launch.json when done).
   The worktree .env.local needs the PUBLIC Supabase URL + anon key (extract
   from the deployed bundle if absent) and NEXT_PUBLIC_SECURE_STUDENT_DATA=true
   for production-faithful auth paths. Sync the worktree with origin/main FIRST
   or you will chase ghosts that are already fixed (this happened: a "missing"
   tool banner was just a stale worktree).
2. Write the stateful Service Worker simulator to public/sw-class-sim.js (a
   past version exists in git history of this command's authoring session; the
   shape that matters: steps array modeled on
   supabase/mock-live-session-seed.sql's live_flow v2 snapshot, polls MUST
   carry stage:"responding", persist the step index in the Cache API because
   SW globals die on idle, answer /api/student/session-state,
   /api/teacher/session, /api/teacher/poll, /api/control-remote next/previous,
   /api/live/signals, /api/today, /api/build-id).
3. Mint a REAL Supabase anonymous auth session (POST /auth/v1/signup with the
   public anon key, body {}) and plant it at sb-<ref>-auth-token, plus
   bdm-student-session + sessionStorage bdm-student-tab=1 - that is a faithful
   verified Chromebook.
4. Walk the beats and SCREENSHOT each chair: student landing, /live-flow at a
   multiple-choice readiness step (answer it for real), the published tool
   page with its LiveToolBanner, fist-to-five, exit short-answer; teacher
   /teacher/present and /teacher/pace at two beats; drive advancement through
   POST /api/control-remote {action:"next"} - the real transport.
   Pane caveats: SW-controlled NAVIGATIONS can fail (navigate manually per
   beat instead of waiting on ClassSync hops), screenshots front tabs and
   allocate viewports, rAF stalls in unfronted tabs.
5. Judge each screenshot as a critique, not a smoke test: where do the eyes
   go, what would an 11-year-old do, what does the teacher see at a glance.
6. CLEANUP is part of the run: unregister the SW, delete sw-class-sim.js,
   clear planted storage + the class-sim cache, strip the env flag, revert
   launch.json, stop the server.

## Scope: pedagogy (run in this session)

Assess against the locked Independent Proficiency System and 6th-grade
practice: does classroom evidence actually reach the mastery bars (check the
current truth of tool-evidence and practice_assignments wiring in CLAUDE.md
and the code - both have silently diverged before); are misconceptions
exact-match tags on real wrong answers; do lesson steps carry retention and
gradual release (concrete/representational/abstract); is anything shown to
students that spoils answers or shames publicly; does the first week of
curriculum build culture before content.

## Scope: full

All of the above: launch code + curriculum subagents first (background), run
student/teacher + pedagogy yourself while they work, then synthesize ONE
report: verdict up front, launch blockers with owners (Steele / Claude /
decision), first-week risks, what is solid, and a dated punch list. Mirror the
punch list into the Notion Feature Tracker only if Steele asks.
