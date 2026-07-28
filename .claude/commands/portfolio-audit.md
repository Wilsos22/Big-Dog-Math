# /portfolio-audit - the company just got Steele's email. Do they take the meeting?

PERSONA, held for the whole audit: you are the COMPANY. Steele cold-contacted
you - "hey, I built this, check it out" - and you are the skeptical-but-fair
technical evaluator (an edtech company's staff engineer, or an EM screening a
portfolio) deciding whether this is worth a conversation. You are evaluating
three things, in this order:

1. WHAT IT ACCOMPLISHES - what does this system actually do, as evidenced by
   what you can reach, not by what the sender claims?
2. HOW WELL - is the execution production-grade? Do the parts you can touch
   feel finished, resilient, and designed, or demo-ware?
3. HOW VIABLE - viable in both senses a company cares about: does this artifact
   prove the builder can do professional work, and could the system itself
   plausibly grow beyond one classroom (and where it could not, is the
   single-classroom scope obviously deliberate rather than naive)?

The deliverable is the company's internal evaluation memo plus the fix list
that changes its conclusion. This is a different lens from /class-audit
(classroom readiness). Run that one for launch questions. Run this one before
sending the link to anyone.

## Scopes

- `/portfolio-audit` - full (all phases)
- `/portfolio-audit cold` - Phases 1-2 only (the cold-visitor simulation)
- `/portfolio-audit engineering` - Phase 3 only (repo + code-quality lens)
- `/portfolio-audit story` - Phases 4-5 only (narrative gap + artifact drafting)

## Ground rules (every scope)

- Audit the LIVE site (https://bigdogmath.com) and the PUBLIC repo
  (https://github.com/Wilsos22/Website-prototype) - the things a company can
  actually reach. Local code reads are for explaining what you observe, not a
  substitute for observing it.
- COLD PROFILE, strictly: open a fresh pane tab, and before anything else clear
  the origin's localStorage, sessionStorage, and cookies via javascript_tool.
  Never authenticate as the teacher. Never plant a student session except where
  a phase explicitly says to simulate joining, and then only with the MOCK
  class (period code MOCK / join code MOCKLV). A cold visitor is the entire
  point.
- PII is a stop-the-world finding: if any real student name, email, result, or
  identifying detail is reachable from the cold profile or visible in the
  public repo (files OR commit history OR issues), stop the phase and lead the
  report with it. Portfolio screenshots use the mock class only.
- Read-only: this audit changes no production code, no Notion content, no
  settings. Findings go in the report; fixes are a separate decision.
- Numbers in any produced artifact must be REAL and traceable: measured in
  this audit, recorded in ROADMAP.md/CLAUDE.md, or verifiable in the repo
  (for example the 0.27 req/s shared poller measurement, the golden-tested
  mastery/grouping engines, the tool count in LiveToolRoute). NEVER invent a
  metric for a resume bullet. If a claim cannot be traced, it does not ship.

## Phase 1 - the 30-second test

Open bigdogmath.com in the cold tab. Without clicking anything, capture what a
hiring manager understands: What is this? Who built it? Is it real or a demo?
Is there any affordance that says "here is what you are looking at"? Screenshot
the landing. Then score honestly:

- Does the landing communicate the system's scope, or does it read as a
  join-code wall for someone else's classroom?
- Is there ANY visible path labeled for outsiders (about, tour, case study,
  "for educators/companies")?
- Load feel: time-to-interactive by stopwatch, layout shift, console errors on
  load (read_console_messages), mobile viewport render (resize_window).

## Phase 2 - what it accomplishes, and how well (the 3-20 minute dig)

Now click like the evaluator who decided the landing was interesting enough to
keep going. Build the accomplishments inventory in two lists, and JUDGE each
entry on execution quality, not just existence:

DEMONSTRABLE TODAY: everything an outsider can genuinely experience. The
manipulative tool suite is public - walk 3-4 of the strongest tools
(/divisibility, /ladder-method, /algebra-tiles, /order-of-operations) and
judge them as products: do they teach their own controls, do they embody real
pedagogy (guided-to-independent, misconception awareness) or are they toys,
do they feel finished, do they error cleanly, do they work on a phone? Check
/explore, /lesson, /lessons on the cold profile - what renders with no
session, and does the empty state read as designed or broken?

LOCKED AWAY: the systems a company would hire him FOR that a cold visitor
cannot see - the four-surface live choreography, the iPad ink-to-projector
surface, the proficiency spine (EWMA bars, misconception grouping, City
Routes), the control panel, the Notion-driven lesson pipeline. For each,
note whether any public evidence of its existence is discoverable at all.
This gap list is the heart of the audit: the strongest engineering is
invisible from the cold chair.

Optionally (and only with the MOCK class): join as a mock student to verify
the join flow reads well to an outsider, then clear the session again.

## Phase 3 - the engineer's 20 minutes

What a technical evaluator finds when they look under the hood:

- Public repo first impression via WebFetch of the GitHub page: repo NAME
  ("Website-prototype" - judge it as a resume line), description, README
  content (default Next.js boilerplate is a finding), whether ROADMAP.md and
  CLAUDE.md accidentally serve as the best project documentation, commit
  message quality on the recent page, contributor graph.
- Repo hygiene sweep (Explore agents on the local checkout, since it mirrors
  the public repo): secrets discipline (.env files, keys in history - the dead
  NOTION_TOKEN literal in notionLessons.ts is a known wince), PII in tracked
  files or fixtures, stray junk (` 2`-suffixed sync duplicates, aistudio_*,
  tmp/), the emoji debt (~440 across ~70 files, pre-rule legacy - an outside
  reader has no way to know there is a rule now).
- Code-shape verdicts an engineer would form: architecture legibility (App
  Router conventions, lib/ separation, the proxy gate), the presence of REAL
  tests (golden-file mastery/grouping tests are genuinely impressive - are
  they discoverable?), typed boundaries, and the wince list (multi-thousand-
  line page components like /control, hand-run SQL migrations, hardcoded nav
  arrays). Be honest in both directions - respect and wince.
- Live-site hygiene: curl timing on key public routes, 404 behavior, security
  posture from outside (gated routes redirect cleanly; API 401s are JSON not
  stack traces), basic accessibility pass on the landing + one tool (the
  2026-07-26 AA contrast work should show here).
- The VIABILITY verdict an engineer would write: which parts prove
  professional-grade judgment (the privacy boundary, the golden-tested
  engines, idempotent evidence ingest, deploy self-refresh, the RLS lockdown)
  versus which parts reveal single-classroom assumptions (hardcoded periods,
  one-teacher auth model, hand-run migrations, no multi-tenancy). For each
  single-classroom assumption, say how it should be FRAMED to a company:
  deliberate scope with a known path to generalize beats pretending it
  scales. The memo must answer: "if we wanted this for 1000 classrooms, is
  this a rewrite or a refactor - and does the builder clearly know which?"

## Phase 4 - the story gap

Compare what the system IS (CLAUDE.md, ROADMAP.md, the tracker) against what
Phases 1-3 proved an outsider can discover. Produce the ranked punch list to
demo-ready, each item tagged with effort (hours/day/weekend) and impact.
Expected candidates - verify rather than assume:

- A public "what is this" surface: an /about or /tour page telling the story
  in outsider language, with mock-class screenshots of the locked surfaces.
- A demo mode: a safe, read-only way to SEE the live choreography (studio
  preview surfaces, a looping video, or a sandboxed mock session).
- README rewrite as the engineering front door: what it is, architecture
  sketch, the numbers, how the pieces talk, screenshots.
- Repo presentation: name, description, pinned status on his GitHub profile.
- A 90-second screen recording: the one artifact recruiters actually watch.

## Phase 5 - the artifacts

Produce and save under `outputs/portfolio/` (create it; it is untracked):

1. `audit-report.md` - written AS the company's internal evaluation memo,
   in that voice, verdict up top: do we take the meeting, yes/no/yes-if, and
   the one change that most moves the answer. Sections: what it accomplishes,
   how well it executes, viability (builder and system), concerns, and what
   we would want to see next. After the memo, a translation section for
   Steele: each memo concern mapped to a concrete fix.
2. `resume-bullets.md` - 6-10 quantified bullets in resume voice, each with a
   one-line "source:" note tracing the number (delete the source lines when
   pasting into a real resume). Cover: scale (routes, tools, surfaces), the
   realtime systems, the data/mastery engine, security posture, and the
   operational story (deployed, in daily classroom use, self-healing).
3. `case-study.md` - one-page skeleton: the problem (a real classroom),
   the system (four surfaces, one spine), the engineering (3-4 deepest
   decisions), the outcomes (real usage), with TODO slots for screenshots.
4. `demo-script.md` - the 90-second walkthrough script: what to show, in what
   order, what sentence to say over each shot.

Then report to Steele: the verdict, the top 5 punch-list items, and where the
artifacts landed. Offer to execute punch-list items as a follow-up - do not
start them inside the audit run.

## Cleanup (mandatory)

Close extra pane tabs, clear any mock-student session planted during Phase 2,
and confirm no file outside `outputs/portfolio/` and the scratchpad was
written. The audit leaves no trace in src/, public/, or Notion.
