# Big Dog Math - case study (one page)

Use this as the /about page body, a PDF leave-behind, or the long-form
README section. TODO slots mark where mock-class screenshots go. No student
data ever appears; every screenshot uses the fictional mock class.

## The problem

A 6th-grade math classroom runs on seconds. Thirty students, five periods,
one teacher, and a stack of disconnected tools: a projector that shows
slides, a whiteboard that vanishes when erased, warm-ups on paper, formative
data collected but never seen again. The teacher is the only integration
layer, and the teacher is busy teaching.

Big Dog Math is my answer, built for my own classroom: one system that runs
class start to finish and turns every touchpoint into usable evidence.

[TODO screenshot: the landing page - the brand and the join card]

## The system - four surfaces, one spine

One live lesson state machine (authored in Notion, served through a Next.js
app on Vercel, synced through Supabase) drives four surfaces at once:

- The MAIN projector presents the lesson state, timers, polls, and slides.
- The SUPPORT projector paces the room: directions, countdowns, groups.
- STUDENT Chromebooks follow the class automatically - held during warm-up,
  released to tools and polls as the lesson advances - with a privacy
  boundary that guarantees answers and teacher notes never reach them.
- The TEACHER'S iPad is a pen: ink lands live on the projectors (a typed
  realtime protocol with reconnect resync), with a phone remote for pacing
  from anywhere in the room.

[TODO screenshot: four-up of the mock run-through - present, pace, student]

Underneath runs the proficiency spine: warm-up, tool, and checkpoint
evidence flows through an idempotent ingest into per-domain mastery (EWMA),
per-standard stage gates, and live misconception clustering that groups
students by error pattern mid-lesson - so the next move is data-informed
while the lesson is still happening.

[TODO screenshot: mastery bars + misconception groups, mock class]

Around it: 24 public math manipulatives (no login), a Notion-authored
curriculum archive, join-by-code sessions with roster-verified identity,
and a room attention call.

[TODO screenshot: one manipulative mid-use, e.g. /divisibility]

## Four engineering decisions I would defend in an interview

1. Privacy as a module, not a habit. Student devices receive a snapshot that
   passes through one 53-line redaction boundary with its own contract test.
   A feature flag cannot leak the teacher's view, because the type system
   will not let the redaction drop a field and the test will not let it
   pass one.
2. Surfaces render from snapshots. The projector pages accept a posted
   lesson snapshot instead of insisting on a live session - which is why the
   lesson editor previews the REAL surfaces, and why a public demo can drive
   the real classroom through a scripted mock period with no auth and no
   database.
3. Evidence is idempotent or it is worthless. Every ingested row carries a
   dedupe key; every rejected row returns a named reason. A renamed
   spreadsheet column once silently ate a week of data - never again.
4. The port is pinned to an oracle. The mastery and grouping engines were
   prototyped in Python; the production TypeScript is golden-tested against
   that prototype (25 students, 1,441 events, 1e-6 tolerance), so tuning
   pedagogy cannot silently change math.

## Outcomes

- In daily use in a real classroom through July 2026; launching the full
  2026-27 school year on August 10.
- Live-tested with real class periods (polls, join flows, ink, review
  games) and hardened from each session's findings.
- Built solo, nights and summers, while teaching full time: 495 commits in
  the seven weeks before launch.

[TODO screenshot: the ink surface - handwriting landing on the wall]

Live: https://bigdogmath.com - Repo: github.com/Wilsos22/Big-Dog-Math
