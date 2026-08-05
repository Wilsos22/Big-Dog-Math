# Internal evaluation memo

To: Engineering hiring channel
Re: Cold outreach from Steele Wilson - bigdogmath.com ("hey, I built this")
Evaluated: live site (cold visitor), public repo Wilsos22/Big-Dog-Math
Date: 2026-07-27

## Verdict: YES - take the meeting. But we almost missed it.

The link and the repo, taken at face value, undersell this project by an order
of magnitude. The landing page is a join-code wall for a specific classroom.
The README literally says "There is no login, database, account system, or
cloud sync yet" - while the repo contains a locked-down Postgres/RLS data
layer, three auth mechanisms, a realtime ink protocol, and a golden-tested
mastery engine. We only found the real work because we dug. Most evaluators
will not dig. One fix changes that calculus more than any other: a public,
watchable mock run-through of the classroom actually running.

## What it accomplishes (evidenced, not claimed)

- A deployed, daily-use classroom operating system for 6th-grade math:
  student devices, two projector surfaces, a teacher iPad pen surface, and a
  phone remote, all following one live lesson state machine.
- 24 public math manipulatives that work cold with no account. We walked
  /divisibility, /ladder-method, and /order-of-operations: each teaches its
  own controls, embodies real pedagogy (guided-to-independent graduation,
  rules-as-reference-rail, misconception awareness), errors cleanly, and
  renders correctly on a phone. These are finished products, not demos.
- A curriculum pipeline: lessons authored in Notion render as the live class
  flow and a public archive (/lessons shows a real, professionally written
  instructional sequence to any visitor).
- A proficiency spine: warm-up + tool + checkpoint evidence flows through an
  idempotent ingest into per-domain EWMA mastery, per-standard stage gates,
  and exact-match misconception clustering with archetype-templated next
  moves - golden-tested against a Python oracle.
- Realtime systems: iPad-to-projector ink (14-message typed wire protocol,
  normalized coordinates, reconnect resync), live polls, class-mode screen
  sync, and a room attention call.

## How well it executes

The split is unusual and diagnostic: the CORE is disciplined, the SURFACE of
the repo is a workshop floor.

Strong (verified):
- 2 occurrences of `any` across 288 strict-mode TypeScript files; zero
  ts-ignores. 70,778 LOC, 87 routes, 67 API handlers, 495 commits in 7 weeks,
  effectively solo.
- The student privacy boundary (liveFlowPrivacy.ts) is a 53-line module with
  its own contract test - the author treats a feature flag as a security
  surface.
- Golden-file tests replay 25 students x 1,441 events x 4 domains at 1e-6
  tolerance against a Python prototype, plus hand-written stage-gate cases.
- Production behavior under cold probing: JSON 401s (no stack traces), clean
  redirects to login on all gated routes, designed empty states everywhere we
  landed, zero console errors, 0.3-0.8s TTFB.
- Operational judgment in the details: single-flight session cache (measured
  1.5 to 0.27 req/s per device), display self-refresh on deploys with a
  deliberate exclusion for the state-authoritative pen surface, idempotent
  evidence ingest that returns named drop reasons.

Weak (verified):
- No CI at all; 21 real test scripts exist and nothing runs them.
- All four production dependencies pinned to "latest" - builds are
  non-reproducible and an upstream major release lands unreviewed.
- God-components: a 3,558-line control page with 55 useState hooks; 12 files
  over 1,000 lines. The libs are clean; the pages absorb everything.
- 36 hand-run SQL files with no migration runner or applied-state tracking.
- The auth middleware's two hand-synced lists (policy vs matcher) can
  diverge fail-open, and are already asymmetric.
- Repo hygiene: 57 tracked files of AI-tool scratch directories sit
  alphabetically above src/ on GitHub; the root is cluttered with design
  binaries and loose scripts; the README describes a two-generations-old toy.

## Viability

Builder: hire-track signal. The things that cannot be taught (failure-mode
reasoning, privacy instincts, testing against ground truth, honest
self-documentation) are present; the things missing (CI, migrations,
dependency discipline, decomposition) are exactly the things a team installs
in a month. The quality landed in the right half.

System: single-classroom by design, and mostly honestly so. The
1000-classroom question: REFACTOR, not rewrite. The data model (periods,
sessions, roster sync), the privacy boundary, and the lib layer generalize;
the single-teacher auth (one shared password), Notion coupling, and hand-run
migrations are the tenancy walls, and they are localized. We would want to
hear the builder name those walls unprompted - the repo suggests he can.

Security/PII: clean. No secrets in the tree, zero real student data anywhere
public (a reserved mock domain is used everywhere, deliberately), production
RLS verified locked from outside.

## Concerns

1. Discoverability: the flagship engineering (four-surface live choreography,
   ink surface, proficiency spine) is invisible to a cold visitor.
2. The README actively misdescribes the system.
3. Tracked AI-scratch directories read as "doesn't know what's in the repo."
4. No CI + "latest" pins undermine the otherwise-strong engineering story.
5. One provenance question: grade-5-extracted.txt appears to be extracted
   third-party curriculum text tracked in a public repo - resolve before
   pointing anyone here.

## What we would want to see next

A three-minute self-serve path: watch the room run (mock class) without an
account, then a README that matches reality, then the repo floor swept. With
those, this outreach converts on the first click instead of the twentieth.

---

# Translation for Steele: each concern to a concrete fix

1. Discoverability -> build the /demo mock run-through (your call, and the
   right one): a public page that drives the REAL /teacher/present and
   /teacher/pace surfaces through a scripted mock lesson using the existing
   studioPreview snapshot plumbing (they already render from posted
   snapshots), alongside a student-view pane. No auth, no database writes,
   real components. Weekend of work; changes the first-click experience
   completely. Add one line on the landing under the join card: "Curious
   what this is? Watch a class run."
2. README -> rewrite as the engineering front door: what it is, the
   architecture sketch, the traceable numbers, screenshots, link to /demo.
   2-3 hours, order-of-magnitude perception change.
3. Repo floor -> `git rm -r --cached` the aistudio_* directories and
   output/; sweep root binaries into a design/ folder or out of the repo;
   resolve grade-5-extracted.txt provenance (delete is simplest). 1 hour.
4. Engineering credibility -> pin exact dependency versions (5 minutes,
   also a real launch-safety fix before Aug 10) and add one GitHub Actions
   workflow running typecheck + the golden/contract suites (2 hours). Fix or
   generate the proxy matcher from PROTECTED_PREFIXES (2 hours).
5. Presentation -> rename the repo (big-dog-math), add a description and
   website link, pin it on the profile. 15 minutes.
6. The 90-second recording -> script is in demo-script.md; record once the
   demo page exists.
