# Big Dog Math

A classroom operating system for 6th-grade math, built by the teacher who
uses it every day. It runs class start to finish: a student home base and
lesson page fed from Notion, live sessions with join-by-code and roster-
verified identity, two projector surfaces and an iPad pen surface following
one lesson state machine, 24 public math manipulatives, and a proficiency
spine that turns warm-up, tool, and checkpoint evidence into live mastery
and misconception data the teacher acts on mid-lesson.

Live: https://bigdogmath.com

## The room

Four surfaces follow one live lesson (authored in Notion, synced through
Supabase):

- **Main projector** (`/teacher/present`) - the lesson stage: states,
  timers, polls, slides, and an ink layer.
- **Support projector** (`/teacher/pace`) - pacing: directions, countdowns,
  vocabulary, what to do right now.
- **Student Chromebooks** (`/`, `/live-flow`, tools) - follow the class
  automatically; a dedicated privacy boundary guarantees correct answers
  and teacher notes never reach a student device.
- **Teacher iPad** (`/ipad`) - the pen: ink lands live on the projectors
  over a typed realtime protocol with reconnect resync; a phone remote
  (`/teacher/remote`) paces the room from anywhere; one Bark button calls
  the class's attention on every screen.

## The spine

Every touchpoint becomes evidence. Warm-ups (Google Forms + Apps Script),
manipulative work, and checkpoints flow through an idempotent ingest
(`/api/evidence`, dedupe keys, named drop reasons) into:

- per-domain mastery bars (EWMA, weights in config, not code),
- per-standard stage gates (accuracy alone cannot reach mastered),
- exact-match misconception clustering with archetype-templated next moves,
- live readiness grouping (City Routes) during the lesson itself.

The mastery and grouping engines are golden-tested against the Python
prototype they were ported from: 25 students x 1,441 events x 4 domains,
verified to 1e-6.

## Engineering notes

- Next.js App Router + TypeScript (strict; the repo currently contains two
  uses of `any` across ~290 source files), Supabase (Postgres + RLS +
  realtime), deployed on Vercel.
- Auth: one middleware gate (`src/proxy.ts`) - teacher device cookie, HTTP
  Basic, or cron bearer. Student identity is roster-verified through a
  warm-up receipt chain; student data endpoints are separately scoped under
  `/api/student/*`.
- Production RLS is locked down: every student read/write goes through an
  authenticated API route; anonymous probes are rejected at the table level.
- Privacy is a module, not a habit: `src/lib/liveFlowPrivacy.ts` is the one
  redaction boundary between teacher state and student devices, with its own
  contract test.
- Displays are evergreen: wall tabs poll `/api/build-id` and reload
  themselves after deploys (deliberately never the iPad, which holds
  authoritative ink state).
- `npm test` runs 17 golden/contract suites (engines, privacy boundary,
  surface frames, the auth-gate drift check); CI runs typecheck + tests on
  every push.

## Run it locally

```bash
npm install
npm run dev
```

Most public surfaces (the tools, the landing) work with no environment.
Live sessions, lessons, and the spine need Supabase and Notion credentials
- see `supabase/SETUP.md` and `NOTION-SETUP.md`.

## Checks

```bash
npm run typecheck   # strict TS across the app
npm test            # all 17 golden + contract suites
```

Built solo by a classroom teacher, nights and summers, in daily classroom
use. Feature history lives in `ROADMAP.md`; standing engineering context in
`CLAUDE.md`.
