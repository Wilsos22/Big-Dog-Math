# Big Dog Math — Feature Roadmap

**The live tracker is in Notion:** "Big Dog Math — Feature Tracker"
(https://app.notion.com/p/f248b4164504427d896087e9b98aa2f4 · data source
`56ee55bb-c067-4613-8f3b-6d5810a82ced`). Steele checks things off there; agents
should update BOTH that database and this mirror when a feature ships.

Snapshot (2026-07-16):

## Live
**A lesson finally moves a mastery bar** (8/4). Every learning check, readiness
question and exit ticket wrote to `poll_answers`, and nothing read it into
`responses` - the only table `recompute` reads besides i-Ready and checkpoints -
so the `mastery` table had been empty for the life of the project, and 5 of a
48-minute lesson's minutes could reach mastery at all. `src/lib/pollEvidence.ts`
re-grades from (poll, answer), because `poll_answers` stores no correctness and
no standard; both live on the `polls` row. `POST /api/teacher/poll-evidence`
writes the rows and then calls `recomputePeriod`, since nothing else in the
codebase ever triggered it. `GET` is a dry run. Structured-numeric and
multiple-choice only - short answer is bare string equality, and a fist-to-five
is a confidence self-report that must never score a standard. Factor-pair builds
get partial credit, capped below full marks when the build is wrong so the bar
cannot rise 100% for a student the misconception tag just flagged. Notion's
`Standard` values do not match the seeded ids (five of six were unseeded), so
the normalizer inserts a cluster letter when exactly one seeded id qualifies and
refuses on ambiguity; unresolvable is reported, never guessed. One bar row per
student per LESSON, not per question, because the bars are an EWMA at alpha 0.30
and per-question rows would take a bar 60 to 14 on four wrong answers in one
period. 44 contract checks, each verified by reverting its fix and watching the
suite go red. **Not yet proven end to end: `poll_answers` has zero rows lifetime
until the FERPA Workspace half lands, and the vocabulary SQL is unrun.**

**Decimals, step by step** (8/2, rebuilt 8/3 from twenty toolbar comments).
`/decimal-steps` is a guided tool covering all four operations, one move at a
time. Students TYPE the arithmetic and only choose on the decisions; a carry is
decided and then physically written into a box that solidifies; multiplication
runs digit by digit; the decimal is clicked and dragged, leaving dashed arcs
under the number; the walk opens by naming the operation and typing a
whole-number estimate; and the correct answer is no longer always in the first
slot. Original entry follows. A guided tool covering all four operations, in a teacher-led mode
for the front of the room and a student mode on the Chromebooks. Every step is a
"what do we do next?" multiple choice whose wrong answers are real sixth-grade
errors, and the digits being worked on light up as the question is asked. It
opens with the question the whole tool is built around — how do we line these
up? — whose right answer differs by operation: decimals for adding and
subtracting, right edges for multiplying (count the places at the end), and for
dividing, move the decimal until the divisor is whole. Division then makes them
DO it: having answered how many places, they hop the decimal that many times on
the divisor and again on the dividend, each hop drawing the caret you would draw
on the board, before divide/multiply/subtract/bring down run with the equations
down the side. Separate from `/long-division`, which stays whole-number only. The
problem set is one string the teacher types once and travels the usual three ways.
`npm run test:decimal-steps`.

**Order fractions on the number line** (8/1, Steele's ask). `/number-line-plus`
gains a third mode: students drag a set of cards onto a 0-to-5 line with a tick
every half and put them in order, smallest to largest. Mixed numbers and
improper fractions both, positive numbers only. A card counts as placed if it
lands within half a unit of where it truly sits — the verdict is the ORDER, and
a failed check names only the smallest set of cards that would fix it, never a
true position. Equivalent cards (3/2 beside 6/4) are a tie and pass either way.
The set is one string the teacher types once — `1/2, 7/3, 2 1/4; 3/4, 3`, where
a semicolon starts another round — and it travels the same three ways as the
Distributive and Factor Tree series: the `/control` tool setup, a `?set=` link
for work at home, and the live tool config. Cards may be fractions, mixed
numbers, decimals or percents, so comparing the three forms on one line is a set
to type, not code to write. `npm run test:fraction-order`.

**FERPA data boundary — pseudonymous student identity** (7/31, Steele's
directive: student data cannot go to Notion and must be disguised everywhere
outside Google Workspace). The site now knows students only as a Workspace-
generated alias plus a one-way email HMAC whose key never leaves Apps Script;
the roster pushes pseudonymously from a district Sheet (the Notion roster pull,
its Vercel cron, the per-student Notion syncs - submissions, i-Ready, weekly
summaries, day-review push, parent outreach - and the dormant Google OAuth
student sign-in are all gone). Ingest routes refuse identified payloads
(`npm run test:ferpa-boundary`), the teacher re-identifies via a browser-local
name key pasted from the Sheet (`/roster`), and the checkpoint CSV translates
emails to aliases in the browser before upload. The classroom spinner is the
one room-facing exception: it shows FIRST names, resolved at render from the
browser-local key, with aliases still on the wire. SERVER SIDE CUT OVER
2026-08-01: schema migrated, deployed to main, every real-name row wiped, PII
scrub run (no name or email column survives), mock class reseeded. Remaining:
Steele's Workspace steps per `supabase/FERPA-CUTOVER.md` (roster Sheet, HMAC
key, Apps Script paste-ins, roster push, archiving the Notion student DBs).

**Lesson Screen Studio — compose the lesson screens from Notion** (7/31, from
the "Lesson visual design direction" handoff). `/teacher/studio` now composes
each lesson's Main / Pace / Student screen automatically from a Notion Lesson
Step, with a frame palette, two snapping zones, and per-component overrides that
fall back to the Notion value when blank. The locked band — state word, accent,
step dots, clock — is always derived from the row and never editable. Layout
persists as a fourth `AI Context` marker, `[BDM_SCREEN_LAYOUT:...]`, which is the
studio's only Notion write; every frame edit is a reversible override in that
blob, so "reset to auto" is free. Three main-screen "demonstration objects" —
slide the split, snap two pieces, move + resize — let the teacher drag a live
model during class; they are deliberately ephemeral (never synced, saved, or
recorded). The prior lesson-content editor is preserved
at `/teacher/studio/edit`. OPEN: present and pace do not render the shared
`LessonScreen` library — they are fluid, not a 1920x1080 canvas — so the studio
authors layouts ahead of the projector reading them; that adoption is a separate,
verified follow-up.

TRIED AND REVERSED (8/3 → 8/4). An additive `LessonSlideStage` overlay did put
the auto-composed `LessonScreen` on both projectors for "plain worded" states.
Steele ran it and cut it: the gate was a per-surface list of exclusions, so the
room got the dotted frame on some states and the studio's colour band on others
inside one lesson — and on `launch` the two projectors disagreed with each other
at the same instant. There is one projector design again (dotted paper, accent
state pill top left, clock top right, state strip). The lesson for the follow-up
is that a design landing on some states and not others must not be gated by
exclusion; it needs a positive test both surfaces read from one place. And per
the DIRECTION below, the route to the wall is the `slide` frame around an
imported deck, not the native zone grid — which is why this reversal leaves
`/teacher/studio` with no output path to a projector, on purpose.

**DIRECTION — frame + imported slides, not a native slide editor** (Steele,
8/3). The native slide-composition path (the drag-resize component grid) is
SHELVED — it reinvents Canva. The moat is the FRAME (state chrome, shared clock,
ink layer, class-sync) plus the INTERACTIVE layer (tools, Fist-to-5, polls,
discussion beat-timers, the spine); information slides are authored in
Canva / Figma / Google Slides and imported through the `slide` frame, which the
app wraps in the chrome. Keep one dumb auto-default so the nightly grind stays
zero-effort. Prefer a published Canva/Slides link over a Notion upload (the
upload's signed url expires in ~1h). Corollary: pace + student MIRROR the main
screen unless they serve a real second purpose (discussion stems/vocab, a
student input surface, or student-only overlay chrome). Detail lives in CLAUDE.md
under the Lesson Screen Studio section. So the studio-adoption follow-up above
targets the frame-around-an-imported-slide, not a native grid.

Two legs hold this up and a weak one sinks it: the frame must wrap an imported
slide so it reads native (not bolted-on), and the native auto-compose must be
good enough that most days the teacher never opens Canva — that was the whole
point, to kill nightly slideshow-making. So the real cut is templated vs bespoke,
not info vs interactive: data-driven info (today's problem, warm-up, the plan)
stays native + auto; only bespoke visual info (diagrams, worked examples, hooks)
goes to Canva. Guard the auto-default as the primary path, and prefer exported
images over live embeds for classroom-critical slides (school wifi flakes).

**The classroom state strip — eyes / voice / supplies / body** (7/29, Steele's
ask). A vertical four-slot group pinned top right of both projectors, modelled
on a garment care label, authored per Lesson Step from four new Notion selects.
The mechanism is precorrection: name the expected state before the transition
that breaks it, which is why it ships with the lesson instead of being another
thing to drive from the iPad. Three redundant cues carry each slot — fixed
position, colour, and a monochrome stroke glyph — and the voice digit never
comes off, even when `?words=off` drops the words. ALL FOUR OR NOTHING: a step
missing any value shows no strip, because a strip that is sometimes empty stops
being scanned, and `/control` names the part-filled steps in its load message.
The iPad can override a slot live for Settle 30s; the override is stamped with
the sequence index it was issued at and expires on the next advance with no
clearing code anywhere. It steps aside when the work space opens, because that
panel is the ink surface. Backfilling the existing lesson steps is authoring and
is still open — until then every lesson correctly shows nothing.

**Fraction bars: estimate the direction, non-unit divisors, declare the whole**
(7/29). A fifth mode, "Bigger or smaller?", targets the finding that preservice
teachers judged the direction of a fraction-division answer with a divisor under
1 correctly only 29 percent of the time, below chance, while doing the
arithmetic correctly. One expression, two buttons, nothing scored or tracked —
a three-minute daily habit. The problem set is built so no shortcut survives:
of the division items 6 are bigger and 5 smaller, 5 have a divisor above 1, and
the multiplication items split 2 to 3, so neither "dividing by a fraction makes
it bigger" nor the operator alone predicts anything. "How many fit?" now takes
non-unit divisors and leftovers, and LABELS THE LEFTOVER IN UNITS OF THE DIVISOR
inside a dashed outline of the group it belongs to — 3/4 divided by 2/3 is 1
group and 1/8 of another, with 1/12 (against the whole bar) and 1/9 (against the
dividend) named as the two classic misses rather than generically rejected.
Explore mode can declare which bar is one whole, the Cuisenaire move no digital
tool does.

**"Stuck? Walk it through." — the Help Path, animated** (7/29, from the Claude
Design handoff "Distributive Walkthrough"). The Stuck button on the student
homepage now draws the method instead of only listing it. Behind
`/homework-help`: six click-to-advance steps that build `a x b = a ( p + q )` on
one stage — rewrite it, draw the box template, circle the friendly factor, split
the other one, then multiply and add — with the target answer parked to the side
from step 1 and filled green at the end so the student sees both routes agree.
Earlier steps stay up and dim to 0.34, so the whole chain of reasoning is still
on screen; step 3 is deliberately a question because that is the only step in
the method that is a decision rather than a move. **The words are Notion's**: the
lesson's authored `Help Path` supplies every sentence, so editing that property
changes what the student reads and no code moves. A path that is not six steps
refuses to animate and falls back to the existing plain one-step-per-screen
list, because the stage draws six specific things and illustrating some other
routine with a distributive picture would be worse than not animating. This is
absence and homework support, not a lesson surface — no session, no join, works
at 8pm from a kitchen table. Reflows on a phone (answer panel leaves the stage,
no sideways scroll) and honours `prefers-reduced-motion` by rendering each step
finished. ·
Student home/join · Lesson page (Notion-fed) · Manipulative tools suite ·
Live polls (stuck-poll trap fixed) · Class mode broadcast · Challenge games ·
Today's boards · Control panel · Session controls · Rosters ·
**/demo: watch a class period run** (7/27 night - the audit memo's number
one fix and Steele's directive: outsiders see the ROOM RUNNING, not a
slideshow about it. The real Main projector, Support projector, student
page, and all-day boards render in scaled iframes and play a scripted
fictional GCF lesson - warm-up culture list, hook, we-do, a quick check
whose mock answers trickle onto the wall and hold through the results
flip, tool time, fist-to-five, closeout, end card. Autoplay with captions;
the Next button is the teacher's remote in the visitor's hand; the student
pane is live (answer the poll yourself - local echo, the redacted snapshot
goes through the production privacy module inside the surface). Public
wrappers re-export the gated projector pages safely: preview mode renders
only posted data. Along the way: theme lookups no longer crash on unknown
semantics, present's poll fetcher is preview-gated, and /teacher/pace +
/weekly-display finally joined DeployRefresh. Landing gained the outsider
door. Repo renamed to Big-Dog-Math and the folder to Big Dog Math Site -
which, renamed mid-dev-server, produced the evening's brief false alarm of
a vanished repo) ·
**Portfolio-audit fix batch: the repo grows up** (7/27 evening - Steele's
"lets get that squared away tonight" after the company-vantage audit. The
public repo's floor swept: 60 tracked junk files untracked (AI Studio
scratch dirs that sat alphabetically above src/ on GitHub, build-output
PDFs, extracted third-party worksheet text). Dependencies pinned exact -
next/react/react-dom/supabase were all "latest", meaning any deploy could
silently adopt a new major. npm test now aggregates all 17 golden/contract
suites and GitHub Actions CI runs typecheck + tests on every push - the
suites existed for weeks with nothing running them, and reviving them found
four stale contracts (pre-home-base link locking, pre-Warm-Notebook frame
anchors, the missing Multiple Choice + Explain mode, the pre-progress-strip
privacy shape - each re-anchored to the current approved design) plus ONE
REAL BUG: notionLessonArchive still queried two dead Notion data sources on
every archive read. New proxy-gate contract makes the auth gate's two
hand-synced lists unable to drift fail-open (probed live first: no actual
hole existed). The 68 remaining legacy emoji across 17 src files went to
zero. README rewritten as the engineering front door - the old one claimed
"there is no login, database, account system, or cloud sync yet" over a
locked-down RLS data layer. Repo description + homepage set. Left for
Steele: the repo rename and profile pin, two clicks on GitHub. Next build:
the /demo mock run-through of the room running) ·
**The attention call: Bark on the iPad** (7/27 - Steele's ask, replacing the
two-claps-and-a-woooo. One tap on the always-visible amber Bark pill next
to the iPad's Tools handle booms the class call through the room displays
(board + main projector) and flashes a two-beat amber Eyes-up pulse - and
the same pulse, visual only, hits every joined student Chromebook wherever
the student is, because the eyes-down kid staring at their screen is
exactly who the redirect is for. The call is a synthesized
bing-bong - a descending doorbell third with a full quarter note of air
between the notes (Steele's timing, 7/27: his Stream Deck bing-bong clip
was "a little too fast") - until public/sounds/attention-call.mp3 exists in
the deploy; any recording dropped there (Abbie's real bark stays the
strongest candidate) replaces the chime automatically. The class answers
with two knuckle-knocks on the desk. Same day: the Red Bull counter came
off /control at Steele's request - the counter widget only; the running bit
stays in Abbie's personality material. Browser autoplay means each display needs one
real tap after each load before it can sound: an arming chip shows for 90
seconds at setup and reappears if a call arrives silent, and tapping it
plays the call as a built-in speaker check. 4-second send cooldown so a
grabbed iPad cannot spam the room. Verified end to end in the pane over
real Supabase realtime: board pulse + counter, projector pulse, Chromebook
visual-only pulse with no chip, cooldown disabling the button, zero console
errors on fresh mounts) ·
**Launch-readiness code batch** (7/27 - the Claude-owned half of the launch
audit punch list, all five blockers plus first-week hardening, shipped as
one verified merge. Shared session-state poller: ClassSync, /live-flow,
AbbieStudentBubble, and useLiveToolConfig now ride one single-flight cached
fetcher (src/lib/studentSessionShared.ts) - measured 0.27 requests/second
per device, down from ~1.5, so 30 Chromebooks no longer look like a
throttling incident. Teacher polling calmed (Control 1.2s, projectors
1-1.5s). Dead-end escapes: the Ask-for-help gate opens on ALL identity
failure codes and the I'm-stuck chip surfaces the admit path instead of
silently un-clicking. First-bell stampede: the Notion lesson lookup is
cached + single-flighted per day, and a session created without its warm-up
heals itself on the next code entry. Tool evidence: the secure path now
writes the daily 0-5 aggregate row (day tally rides the report body), so
the City Routes tie-breaker fires in production and the bars weigh tool
work once per day - per-problem rows only when a seeded standard applies;
golden tests pass. Plus: Notion fetches carry 8s timeouts with distinct
"Notion is down" vs "no lesson published" copy, /session's roster list
survives failed polls, the phantom Notion data-source id is gone (by-code
lookup works), embedded tools render chrome-free on the projector, review
polls are honest with non-submitters, and grouping keys by student id so
name collisions cannot swap archetypes) ·
**Factor Trees collapse: the upside-down triangle** (7/26 - Steele's spec
right behind the UX round: the primes must not combine in one morphing row.
Each row is ONE computation - the highlighted pair becomes its product and
every other factor drops straight down - repeating until the original
number stands alone at the point. Every row stays visible, dimmed with the
multiplied pair dashed, so the finished triangle IS the written-out work:
2x2x2x3 / 4x2x3 / 8x3 / 24. The pop-out equation follows the active row's
pair. Verified in-pane end to end on 24) ·
**Ladder Method UX round: guided first tries, independent after** (7/26 -
Steele's ask via /design-critique: intuitive layout for 6th graders, eyes
drawn right, natural flow. First encounter per device: numbered step heads
(1 check the lit rules, 2 type a divisor and run the ladder, 3 what you
have earned) and a pulsing beacon on the divisor input; completing one full
GCF+LCM cycle or one factor tree graduates the device to clean reference
labels. Every visit: the six problem pills left the top bar for the bottom
actions row (they outshouted the math), the divisor input tripled in
presence, the rewards column dims until something lands, and the coach line
is tone-coded (neutral / green win / coral try-again). Flow repairs: the
Factor Tree split form moved INSIDE the panel tethered under the amber
selected node with a matching lead chip, and the GCF result stays a
question mark until the student multiplies the chain out themselves - it
used to spoil the answer the moment the ladder closed. Plus AA deep-token
contrast on every colored control and workspace-first stacking on narrow
screens. Verified end to end in the pane: beacon animating, try/win tones,
rail-tap loads divisor, full ladder to graduation persisting, tethered tree
form following the selection, mobile order, zero horizontal overflow) ·
**Period 2 shakedown fixes** (7/26 - Steele ran a real session and joined
incognito; four findings, four fixes. (1) The Pace screen showed a
Fist-to-Five histogram during a multiple-choice readiness check - the block
keyed on the learning-check THEME, which readiness questions share; it now
gates on the poll's actual kind. (2) Long choice lists clipped on the student
screen and the Main results panel - both centered overflowing grids that cut
off top and bottom; align-content safe center plus scrolling fixes both.
(3) /divisibility was never wired as a live tool, so the D1 lesson could not
send students to the tool built for it - now in ASSIGNED_TOOL_ROUTES (Notion
"Tool: Divisibility Rules" resolves), LiveToolRoute, ClassSync targets, the
control bank (tool-divisibility) and map, with the LiveToolBanner on the
component (route count 19 wired / 22 arms). (4) An unverified device had no
path to save answers and no way to ask: the landing's admission-request
button no longer hides when no form exists, and /live-flow surfaces "your
teacher needs to let you in" with an inline Ask-for-help + help code the
moment an answer fails on the missing join. All four verified in the pane
with a mocked student API; teacher admit completes the join server-side via
the existing admission RPC) ·
**Tool evidence breaks City Routes ties** (7/26 - Steele's pick from the
critique list: the routing sat on two multiple-choice items while the Area
Tool logged a constructed response. recommendRoute now takes the session's
own tool-work average (the 0-5 aggregate rows the manipulatives already
write) as a conservative tie-breaker: mixed readiness answers raise to
independent on strong work (>=4/5) or lower to teacher on weak (<2.5),
none-correct rises to partner but never independent, all-correct never
lowers, and strong work clears the all-correct-but-fist-2 low-confidence
flag. No tool work = the locked rule exactly. The Remote panel shows a T
score chip and a "Tool work raised/lowered/confirmed" tag so a moved route
is never a mystery, and the teacher override still beats everything.
Verified by an executed 15-case matrix against the compiled pure engine) ·
**Universal state words everywhere on the markers** (7/26 - Steele's catch
from the Studio: the Main pill and Pace chip showed the lesson-specific step
title ("7. Divisibility Proves the Factor Arch") whenever the state id was
not in the universal map. universalStateTitle now lives in
src/lib/classStates.ts shared by both projectors: the map covers the CRA trio
as gradual-release words (concrete = I Do, representational = We Do,
abstract/independent = You Do) plus Learning Check, Discussion, Partner Work,
Small Groups, Gallery Walk and the rest, and unmapped states fall back to the
state bank's GENERIC label - never the step title. The step's specific name
stays in the directions/topbar where it belongs. Side effect: the
public/state-titles art lookup now applies to CRA states too) ·
**Home base always + screens push past warm-up** (7/26 - Steele's two asks.
(1) Advancing past warm-up now pushes EVERY student screen, verified or not:
code entry stores a provisional session (empty studentId) so ClassSync
follows immediately, and secure-mode session-state READS relaxed to the
projector-public studentSafeLiveFlow projection for unverified devices
(writes still require the verified join). Fixes the critique's invisible
unverified student. (2) The landing after code entry is the HOME BASE, full
stop - no gate view, no locked links, no "keep this page open": the old lock
existed because verification polling lived only on the landing; it now runs
globally (WarmupJoinSync in the root layout) and completes wherever the
student is, upgrading the provisional session in place. The warm-up card
opens the form when one exists and says "No warm-up loaded yet - that is
fine" when none does. Verified end to end with a stateful mock API: code
entry -> unlocked home base -> held during warm-up -> pushed to /live-flow on
advance while unverified -> verified in place on another page) ·
**Outside critique response, rounds 1-3** (7/26 - a hired end-to-end critique
(design-references/critiques/bigdogmath-critiques.pdf) drove three shipped
batches. Round 1, accessibility: AA contrast on all eight scanned student
pages (ink-faint darkened; teal/coral/green-deep companion tokens under white
text; GEMS tiles keep bright fills with ink labels + crossed-out done steps),
44px tap targets across ToolNav/Fraction Bars/GEMS/Area Model, home-page
phone overflow fixed (join input intrinsic width), GEMS badge overflow fixed,
emoji stripped from touched files. Round 2: student progress strip on
/live-flow (Step X of Y, what's next, persistent Target criterion - privacy
filter passes position but never steps), visible time warnings (edge glow at
30s, red timer at 10s - the audio cues' visual mirror), pace readout on
/control + /session ("Plan left: N min, finish about H:MM"), one name per
action (Next state everywhere), End-session arm countdown, weekly-display
weekend roll-forward. Round 3: the "I'm stuck / Say that again / I've got
this" student self-signal chips feeding live counts on /session -
student-signals.sql RUN by Steele 7/26, chips live. Same day, his click-only
decision hardened the layer: a 10s server cooldown on signal writes, counts +
stuck/again names now ALSO on the iPad Remote (the in-hand surface), and
teacher controls - per-student mute (no feedback to the student) and a
session-wide signals on/off switch - via student-signal-controls.sql, which
Steele ran the same day, so the whole signal layer is live. No free-text
input by design: the fixed chips ARE the spam filter. Pedagogy critiques and
bigger IA items remain decision items, not code) ·
**Warm-up culture screen: the steps of learning** (7/25 - Steele's ask: the
Main projector's empty warm-up real estate now carries a big animated "steps
of learning" list - 1 Confusion, 2 Try something, 3 Get it wrong, 4 Try again,
5 Now you've got it - so confusion reads as step one, not failure, while
students work the warm-up on Chromebooks. Numbers in the warm-up accent, labels
in heading ink, each rising in staggered on the Warm Notebook cream. Editable
LEARNING_STEPS constant in present/page.tsx; shows only when no anchor Puzzle
of the day is posed, which still wins) ·
**BRUH, the live team review game** (7/16 — ran in class and ran well. Replaces
the 46-slide Canva deck + buzzer receiver: the board itself shows who is in, who
is locked out and who is right. Teacher tool only; students arrive by broadcast.
`/teacher/bruh` setup with saved banks + 9 presets (270 questions, each
double-verified), `/teacher/bruh/board` projector, `/teacher/bruh/remote` iPad,
`/teacher/bruh/scoreboard` second screen, `/bruh` student. Server-authoritative
round clock and grading; units are required when the answer names one. Tables are
server-only. Deliberately does NOT feed the proficiency spine — it is about
teamwork and effort, not assessment) ·
**Anchor problems** (7/21 - each lesson can pose a real-world problem during
warm-up ("Puzzle of the day" on the main projector) that returns at closeout
with "You can answer it now." Notion fields Anchor Problem / Anchor Answer;
the answer stays teacher-only. L1 concert floor, L2-D1 water balloons,
L2-D2 skate park are live) ·
**Warm Notebook rollout complete** (7/21 - all four surfaces plus landing,
lessons archive, and Screen Studio wear the decided look; the teacher Remote
is dark per the 12d design; projectors have A-/A+ text scaling to 2.5x) ·
**Notion lesson cover on the student home base** (7/22 - the lesson page's
Notion cover image bands across the top of the landing's lesson card, both
before and after the warm-up opens. It rides /api/today per request because
Notion-hosted covers use short-lived signed URLs (never store them); a
code-match guard skips the art when the session's assigned lesson differs
from today's dated lesson, and a missing cover renders nothing) ·
**Instant warm-up + student home base** (7/21 - permanent period class codes
(`periods.class_code`, DOG2-DOG5/DOG7/MOCK) open the day's warm-up the moment
a student types the code: `/api/student/warmup-start` reuses or auto-creates
the day's session seeded with today's published form, and the teacher's
/session inherits it. Once the form is open in its second tab - or the
response verifies - the landing becomes a home base: today's lesson card plus
Today's lesson / Challenge games / Explore the tools links that unlock when
the warm-up connects, keeping the origin tab's verification polling alive) ·
**iPad Remote: live screen mirrors** (7/22 - Steele's catch: the Remote's
mirror rail still showed text summaries of each surface. The three mirrors
now embed the REAL pages - Main and Pace + Support with the session param,
the Student view following the published tool route - as scaled live
iframes (shared src/components/LiveScreenPreview.tsx, measured-width
scaling with a zero-rect retry), so the staged hook, scene sweeps,
transitions, and everything else appear on the Remote exactly as the room
sees them) ·
**Session page as in-class cockpit** (7/21 - Steele's ask, two rounds: /session
runs class start to finish without /control. The join-code card carries a
lesson transport - Start today's lesson (new server-side
/api/control-remote start-lesson action builds the flow from the published
Notion lesson and enters step 0 through the Remote's own navigateFlow), then
Back / Pause / Next state with the live state name, step count, and ticking
countdown; automatic pacing keeps advancing through the endpoint's lazy
transition while the page polls. The Classroom screens card shows LIVE scaled
iframe previews of Main, Pace + Support, and the Student view (follows the
class-mode broadcast), the iPad Remote stays as a link, the Challenge game
card collapses to a toggle when idle (expands automatically while one runs),
and the bottom "Ask a question" composer is gone - lesson steps carry the
questions now. The open-question card survives only as the off-switch for an
orphaned open poll. 7/22: ending got honest - End is a two-tap confirm (the
window.confirm dialog blocked the page ~3s and read badly on iPad), ending
one session immediately adopts and announces any OTHER open session instead
of letting it reappear silently on the next visit, and a banner with "End
all open sessions" shows whenever more than one is open - the "I ended it
but it's open again" report was two separate open sessions, not a failed
close) ·
**Transition buffer states with music** (7/21 - Steele's insight: the room
changing state is a real cost, so it gets its own planned minutes and its own
music. Three new first-class states - Transition - Hustle (coral, 1 min,
quick task switch), Transition - Reset (amber, 2 min, bigger room change),
Transition - Settle (teal, 1 min, bring the energy down) - drop into any
lesson as ordinary Notion steps (State ID transition-hustle / -reset /
-settle) or /builder lineups. Because control already plays music per state,
each vibe gains an upload slot automatically and the classroom laptop starts
and stops the track with the state: the song ending IS the deadline students
hear. The main projector renders a dedicated scene - vibe word, movement
directions, giant countdown, draining bar, "Up next" - and automatic pacing
sweeps into the next activity when the buffer ends, so transitions stop
eating the next state's clock. Preview: /teacher/present?preview=
transition-hustle. Plus TRANSITION NOW (same day): ad-hoc movement windows
from the iPad Remote's pacing deck or /session's transport - Hustle 15s /
Hustle 30s / Settle 30s. An interlude overlay pauses the state clock, both
projectors show the countdown scene with "Up next: Back to <state>", control
plays the vibe's track, and the lazy pacing check clears it at zero and
resumes the paused clock; Next/Back cancels it early) ·
**Long Division choreography rebuild** (7/21 - Steele's frame-by-frame spec
from the Vercel toolbar: the digits themselves now drag from the house to the
side equation one at a time (7 highlights, drags by the divide sign; the
divisor follows), the finished equation wave-highlights left to right before
the answer appears, and the answer drags back into the house - up into the
quotient on Divide, down under the digit on Multiply. Subtract draws its
minus sign and bar in the house stroke by stroke, wave-highlights the column
downward, and fades the difference in slowly; Bring down draws its arrow
before the digit lands. New Back button re-enters the previous step from its
first frame for rewatching, and Auto-lead now runs the full choreography on
EVERY problem - it only ran on problem 1, which is why it was hard to
follow) ·
**Slide extras: highlighter-glass shapes + permanent state label** (7/22 -
Steele's polish. Overlay rectangles/circles render as a VERY FAINT color
wash the slide shows straight through (9% tint, 22% on Deeper wash), a
neutral dark outline (grey/black, never colored), square corners on
rectangles, and a float shadow so they lift off the paper. Lines, arrows,
images gained the shadow too. Separately, the projector's universal state
name (I Do / We Do / You Do) became a PERMANENT marker: flat italic
Verdana-family sans, pinned top-left, wiping in left-to-right on each state
change - visually distinct from the lesson's own directions in the system
font. Replaced the centered title lockups and the board title band) ·
**Slide extras editor (Canva-lite overlays)** (7/22 - Steele's ask, built on
his green light: /teacher/slides is a drag-and-drop decoration editor over
the auto-generated slides. Pick a published lesson and step, place text,
math-font equations (italic variables, x^2 powers, {3}/{4} stacked
fractions), rectangles, circles, lines, arrows, and images-by-URL on a 16:9
stage, drag and resize, and save. Storage is a new Slide Overlay rich-text
property on the Math 6 Lesson Steps database (percent-based element JSON,
chunked at Notion's 2000-char limit), guarded by the same
expectedLastEditedTime conflict check as Studio saves. The overlay rides the
live-flow sequence steps through every builder and renders on the main
projector above the auto slide - and below the teacher's ink on board
states - so auto and hand-made coexist; a step with no overlay renders
exactly as before. Teacher home gained the Slide extras card) ·
**Bookend screens + single state marker** (7/22 - three Steele asks. (1) The
Main projector's state name is now ONE marker: a big outlined accent pill
top-left that pops in to announce the state (was showing the state name three
times - topbar chip, topbar title, italic label); the topbar carries only
lesson title/code + timer now. (2) Exit state is a closing board - success
criterion large plus a Don't-forget card of manual reminders/upcoming dates
from a new Notion Reminders field, each sliding in - since students do the
Google Form exit on Chromebooks. (3) The Pace + Support screen runs today's
agenda as an animated numbered rundown during warm-up (existing Agenda
field), so the class sees the plan while Main holds the hook. Exit ticket
stays a Google Form; native exit wiring left in place) ·
**Main projector: universal state headers + equation-chain layout** (7/22 -
round two: slide titles are now the UNIVERSAL state words (I Do / We Do /
You Do, Launch, Review, Exit Ticket - identical lesson to lesson so students
recognize the phase; the step's specific name stays in the topbar), and
Steele's hand-made title graphics drop into public/state-titles/<slug>.png
(we-do.png, i-do.png, you-do.png...) to replace the typographic title
wherever one exists - HEAD-checked per state, typographic fallback.
Equation-chain steps (text with stacked equals or __ blanks, like the
equation-only phase) now render as an aligned worked-equation stack - head
expression, one row per equals step, blanks drawn as real outlined boxes -
and the area-model resolver skips them on purpose: that step removes the
model by design) ·
**Main projector: slide titles + area-model scaffold** (7/22 - Steele's ask:
the phase name is now a designed title built into the slide - board states
(I Do / We Do) get a slim accent-ruled title band above the ink surface with
the directions in problem cards below it minus the duplicated "We Do:"
prefix, and directions slides get a centered title lockup with the drawn
accent rule, directions staying in the working font one size tier down. And
the support scaffold stays on screen while the words move toward the
equation: for the M1.T1.L1 lessons, any step text naming an a x b product
earns an auto-drawn area-model figure (new "area-model" LessonVisual kind) -
side lengths labeled, split partition dashed when the text says "into 10 +
6", regions left empty for the class to fill. Floats top-right of the ink
board on board states, sits under the directions on independent states) ·
**Projectors: staged hook + scene transitions** (7/21 - Steele's ask: the
warm-up anchor ("Puzzle of the day") now enters as a staged moment - kicker
settles, an accent rule draws itself beneath, the question rises in, then the
quiet direction line; after settling the rule breathes slowly so the screen
stays alive across warm-up. The closeout payoff reuses the same entrance.
The hook shows on BOTH panels: /teacher/pace mirrors the staging during
warm-up and stands its big clock card down - the small topbar timer pill
carries the time on each screen. Every lesson-state change on both panels now
enters as a scene - a calm rise-and-fade on the content plus a thin sweep of
the incoming state's accent drawing across the top, and the topbar chip and
dot crossfade their accent instead of snapping. All motion honors
prefers-reduced-motion) ·
**Warm Notebook screen kit** (7/20 — `public/screens/`: one hand-owned,
projector-ready HTML file per lesson state in the decided turn-12 Warm Notebook
look, scaled to any display by `_system/frame.js`; `_system/frame.css` is
generated from the Design canvas by `scripts/build-screen-kit.mjs` and the
screens themselves are never regenerated — Steele edits them directly.
`data-slot` marks text the site can fill from the Notion lesson step; deleting
the attribute locks hand-written content. Ships with a blank starter and a rich
exemplar; intended rendering layer under `/teacher/studio` and the four
surfaces) ·
**Weekly classroom display** (7/16, rebuilt from the Claude Design board 7/29 —
two all-day TVs rotating four screens on a fixed 1920x1080 stage scaled to the
display: the learning intention resolves into its key term (highlighter sweep,
then every other word drops away while the highlighted term pans up and its
definition and a worked example populate around it), success criteria on ink,
the week with today's row raised, and a bell schedule that derives "Now" and its
progress bars from the classroom clock. One accent hue per weekday. The two
targets are stemmed differently on purpose (Steele, 7/29): the intention reads
"I am learning to ..." and the day's ONE chosen success criterion - the
`Selected Success Criterion` property, never the Success Criteria menu - reads
"I can ...", so the second screen is what you check your work against rather
than a restatement of the first. The reveal
reads `Term - definition` out of the existing Notion Discussion Vocabulary and
holds the sentence unchanged when no definition is authored, so nothing new is
required to ship it and one dash per lesson turns it on) ·
**Screen Studio previews are the live surfaces** (7/22 - Steele's catch: the
Studio Main and Pace previews were still the old dark projector design
because they were hand-built copies that drifted from the Warm Notebook
redesign. They now EMBED the real /teacher/present and /teacher/pace pages
in scaled iframes, fed the draft over postMessage (new studioPreview mode on
both surfaces + src/lib/studioPreviewFlow.ts builds the snapshot from the
draft), so the previews are the live surfaces and can never drift again -
staged hook, scene sweeps, state label, slide overlays, area-model figure,
all appear as the room sees them. Student + Remote previews still hand-built,
to embed later) ·
**Lesson Screen Studio** (7/15 — one private editing surface for every lesson
state with synchronized Main, Pace + Support, Student Chromebook, and iPad
Remote previews; guarded Notion saves with revision conflicts; no active-session
mutation) ·
**Notion roster sync** (needs `NOTION_ROSTER_DB_ID` + `CRON_SECRET` envs) ·
Teacher login (6-month device cookie; PIN gate removed) · Warm-up analytics ·
Checkpoint delivery · iPad ink → board · Abbie³ (voice + Stream Deck) ·
**Proficiency spine**: schema/seeds, EWMA engine (golden-tested 25/25),
mastery board + growth charts, /api/evidence, clustering + archetypes
(golden-tested 25/25), Right-now view w/ Notion Misconception Plans merge ·
**Checkpoint CSV upload** (/teacher/checkpoint-upload — tier + SBAC flags,
idempotent, auto-recompute) · **Tool evidence emitters** (EB/GEMS/CLT → mastery, session-gated) · Figma lesson-flow template ·
**Equation Builder redesign** (7/6 — auto-generated one-step equations incl.
÷ form, Albert Sans font one ink color, goal popup w/ sticky-red
wrong picks + Level Up! short answer, "Identify the variable" w/ named wrong
taps + persistent highlight, first-move question, inverse-drop animation, zero
pair "= 0" pop that vanishes, term auto-drops, student computes the other
side, inverse-ops key, level-switch fanfare, x on either side in Level Up!,
celebration + in-a-row counter; Regular/Level Up! naming here + GEMS) ·
**Growth view** (Right Now is now "Growth", linked from teacher nav + home;
/teacher/growth redirects) · **Claude-sharpened next moves** (7/6 —
/api/live/next-move + per-archetype "Sharpen this move" button on each Growth
cluster; archetype-aware, tool-grounded, reuses ANTHROPIC_API_KEY, template fallback) ·
**Abbie Console** (7/7 — summon Abbie³ from the control panel:
hold-to-talk mic (Web Speech STT + Stream Deck F8/?ptt=) for free-form live
conversation with running history, plus 6 quick-tap moods and a type/ask box;
context-aware (current state + lesson intention); teal projector bubble the
class sees + her real voice, voice/text-only toggle; /api/abbie takes a
`context` field; roast material loaded — Kendrick, tight pants, Legos, dog-park
small talk, etc.) ·
**Abbie on student screens** (7/7 — her line broadcasts to a dedicated
sessions.abbie column and pops a teal bubble on every joined student's screen,
any mode; global AbbieStudentBubble in the layout; needs abbie-broadcast.sql) ·
**Moderated Ask-Abbie queue** (7/7 — students type a question from an "Ask
Abbie" button; lands in the control-panel queue with a count badge; teacher
edits/approves and she answers the room, or dismisses; one pending per student;
abbie_questions table, needs abbie-questions.sql) ·
**Abbie contextual reactions** (7/7 — teacher-triggered: "Have Abbie react" on
poll results hands her the tally for a one-line take; "Have Abbie announce it"
on the spinner has her call the pick; shared abbieBus, no new setup) ·
**Abbie bits** (7/7 — Red Bull counter chip that roasts dad's hypocrisy on tap;
cross-day memory note in the console woven into her context; personality tuned
to complaining-teen, less Red Bull, shorter replies)

## Known broken — 2026-08-04
Found by the first `/status` sweep. Nothing here was reported by a student or a
class; all four came out of reading the live site against the repo.

- **Vercel is not building from `main`, and it is the one that matters.** The
  live `/api/build-id` returns `265ea95` (built Aug 4, 04:39 UTC) while
  `origin/main` had moved 26 commits and about 20 hours past it. Stranded in
  that gap: `88a0a84` (the slide overlay covering `/teacher/pace`, and a lesson
  with no End), `84208c7` (the Division House six-move rebuild), `49332c9` (the
  50-minute period budget), `a866066` (iPad double-tap undo and hold-to-
  straighten), `e145490` (the sound bank AudioContext fix). So the projector
  bugs found running a real lesson are fixed in the repo and still on the wall,
  and because `DeployRefresh` reloads displays on a build-id CHANGE, a build
  that never ships leaves every projector on the old code with nothing anywhere
  saying why. CLAUDE.md documents the suspected cause (the GitHub App losing
  repo access when the repo went private on 8/3 - the last successful deploy
  still records `githubRepoVisibility: "public"`). ONLY STEELE CAN TEST IT: one
  redeploy from the Vercel dashboard settles whether the connection recovers.
  **RESOLVED THE SAME EVENING.** Steele pushed two "Trigger deploy" commits
  (`40da109`, `c3e0a92`); both built READY to production, and every push since
  has deployed automatically. Live `/api/build-id` now tracks `origin/main`
  within a couple of minutes, so all 26 stranded commits - including every
  projector fix from the 8/3 run - are finally in the room. The ROOT CAUSE was
  never established: a manual trigger restored it, which is consistent with the
  GitHub App theory but does not prove it. If pushes ever stop deploying again,
  the check is `/api/build-id` against `origin/main`, and the fix to try first
  is a manual redeploy.
- **`.claude/commands/class-audit.md` asks Notion the wrong question.** Its
  curriculum scope says "Feature Tracker rows at Priority 'Now' not Done". The
  tracker's `Status` select has no `Done` value, so that filter matches every
  row; done-ness is a separate `Done` checkbox. Measured 8/4: `Priority = Now`
  returns 18 rows of which NINE are complete, so a curriculum audit reports
  shipped features as outstanding work. Correct filter is `Priority = "Now"`
  AND `Done = "__NO__"` (recorded in CLAUDE.md, commit `ea485b9`).
- **Setup item 3 below tells you to break teacher auth.** It calls
  `NEXT_PUBLIC_TEACHER_PIN` unused; it is read at `src/lib/teacherAuth.ts:12`.
  Corrected in place below.
- **Five branches never merged into `origin/main`:**
  `codex/integrated-security`, `codex/warmup-identity-preview`,
  `claude/big-dog-website-roadmap-yp65vy`, `claude/quizzical-mcnulty-effb35`,
  `backup-before-rebuild-80e3da5`. The two `codex/` ones sound load-bearing and
  nobody has said whether they are finished work or abandoned. Needs a read,
  then a merge or a delete.

## Known broken — reported live 2026-08-03
Steele found these while running a real lesson through the surfaces. Four are
FIXED (commit `88a0a84`); the rest is diagnosed below and needs his call.

FIXED:
- **"You Do" was broken on BOTH projectors, for two different reasons.** On
  present the scene is nothing but a map over `paperSections`, so a step with no
  work fields and no Main Display painted an empty grid inside an `inset:0`
  section — a blank projector for the whole 14 minutes. It falls through to the
  directions scene now. On pace it was the overlay bug below.
- **`/teacher/pace` on the Divisibility tool state** — and on every `tool-*`
  state, plus board / transition / exit / routine / warm-up / You Do. Not
  Divisibility-specific. `showLessonSlide` on pace was written with only pace's
  OWN scene branches in its exclusion list, so the auto-composed slide came up on
  states the main projector does not show it for. Reproduced and confirmed fixed
  in a browser.
- **The final step now knows it is the final step.** Next reads "Last state" and
  is disabled, an End lesson key appears in its own row, the notes card stops
  advertising a step that does not exist, and a `commandError` flag replaces the
  string-matching that swallowed the server's 409.
- **The refused "I'm stuck" bounce.** `ClassSync` treated a MISSING
  `live_flow.state` the same as the warm-up state and pushed a student who was
  watching the lesson to `/`, then back the moment state returned. It holds
  position now. The chips are gated on `flow.state`, so the same gap also took
  the stuck chip off screen — one fault, not two.

FIXED, CONFIRMED IN A REAL RUN BY STEELE 2026-08-04:
- **The ready check.** Half was never a bug: "renders an anonymous bar first" is
  `resolveRemoteNextBehavior` deliberately turning Next into "Reveal anonymous
  bars" on a responding learning check. The real fault was that `/control` keyed
  the live poll to the STATE ID, and Steele's shape is always a fist-to-five poll
  followed by TWO ready checks — and his lessons author consecutive checks with
  one shared state id ("Readiness Question 1" and "Readiness Question 2" are both
  `question`, verified against the live Notion Lesson Steps source, in lesson
  after lesson). So the first poll never closed, its question and revealed bars
  republished as the second step's, and the second never opened its own. Keyed to
  `sequence.currentIndex` now. Same pass fixed the remote-command rehydrate
  dropping `boxes`/`pairs`, which blanked the inputs on a Structured Numeric step
  the moment the Remote advanced into it. Both pinned in `test:control-lineup`.

STILL OPEN:
- **The Student preview rendering the homepage was NOT reproducible.** The
  ClassSync suspicion is wrong for a preview: `isTeacherPreview()` returns true
  inside an iframe, so ClassSync is inert there. Driven on `/demo`, the student
  pane rendered every state correctly through the same bridge `/teacher/rehearse`
  uses. Worth re-checking which surface he meant — if it was a real Chromebook
  rather than a preview pane, the ClassSync fix above is likely the same fault.

NOT bugs, confirmed against the live database the same day: the stuck chip
saying "wait for the teacher to let you in", and Fist-to-5 taps never reaching
the board. Both are the verified-student gate working as designed — 0 of 167
students have an `auth_user_id` and the open session has 0 joins. Nothing
student-writing can pass until the Workspace half of the FERPA cutover lands
(`supabase/FERPA-CUTOVER.md` steps 1, 2, 5, 6, 8 — Steele's hands only).

## In progress
- **iPad ink engine + the glass sheet** (7/21, commit c68da00) — Phase 1 of the
  "get the pen surface as close to Notability as the web allows" push. Strokes
  are now filled variable-width polygons: width flows continuously with
  EMA-smoothed Pencil pressure, both ends taper (mouse and finger get a light
  velocity synthesis). Three stacked canvases — translucent highlighter under,
  baked dry ink, and a per-frame wet layer carrying in-flight strokes, the
  Pencil's PREDICTED points (drawn, never stored or sent), and the eraser
  preview ring; only the wet layer uses a desynchronized context because the
  dry layers feed Export readback. Surface rect cached per stroke (no layout
  read per move event), zero-rects can never poison coordinates, and a surface
  opened in a background tab (projector behind /control) now sizes itself the
  moment it first lays out instead of staying 1x1 and silently painting
  nothing. New Highlight tool, Pencil-first palm rejection ("Finger draws"
  toggle; no first-touch window), and a screen wake lock. NEW "Write on
  screen" mode — the glass sheet: /teacher/present mounts a transparent
  pass-through ink overlay across the whole stage, and the iPad renders the
  same live view in an iframe under a transparent pen layer, letterboxed to
  the aspect ratio the projector announces, so strokes land on the wall
  exactly where the pen put them — over the lesson, poll results, any state.
  Board mode, scratch, templates, problems, and export unchanged. Verified
  end to end locally with synthetic Pencil pressure ramps across two tabs
  (taper geometry on the wire, display bake, palm rejection, highlighter
  layering, eraser, background-tab recovery, and an iPad-drawn circle landing
  exactly around the target on the present stage). Pencil-in-hand feel test
  is Steele's. PHASE 2 shipped same day (commit 1fbb770): synced UNDO/REDO
  with an operation history (undoing an eraser swipe restores everything it
  took; toolbar buttons with live enabled states on both surfaces plus
  scratch; two-finger tap undoes, three-finger tap redoes), the STROKE
  ERASER as the default Eraser (touch a stroke and the whole stroke
  vanishes, one history op per swipe; the classic rub-out lives on as the
  Pixel tool), HOLD-TO-STRAIGHTEN (hold the pen still ~600ms and the
  scribble snaps to a line - angle pulled onto 0/45/90, far end keeps
  following the pen - or a circle or rectangle; the wall swaps the raw
  scribble for the clean shape in one beat on pen-up), a LASER POINTER (a
  glowing fading trail every surface sees, never stored, never exported),
  and reconnect resync (a display that drops re-requests full board state,
  so a wifi blip cannot leave the wall missing strokes; also fixed a latent
  Phase 1 bug where switching surfaces could replay the last Clear).
  Verified with synthetic Pencil and touch events end to end; wire carries
  remove/restore/replace/laser. PHASE 3 shipped 7/22 (commit c848cb6): PINCH
  ZOOM + PAN on the pen surface only — a view transform applied at paint time
  and inverted at input capture, so strokes stay in page coordinates, the
  wire format is untouched, and the wall never zooms. The same two fingers
  that tap to undo become the pinch once they move; one finger pans while
  zoomed; ctrl+wheel zooms at the desk; a percent chip offers Fit; and the
  dotted paper, background image, and problem cards all scale WITH the ink so
  grid templates stay under what was written on them. PAGES — chips (1 2 3 +,
  cap 8) flip between up to eight boards; each page syncs on its own room so
  hello/state resync works per page for free, a pageflip message on the ctrl
  channel drives the display (which re-asks after a reconnect and shows Page
  N of M in its pill), and inactive pages stay mounted with canvases parked
  at 1x1 — strokes, history, and channels survive, flipping back is one
  repaint, and per-page Undo/Clear/Background/Problem/Export all act on the
  page in view. The same mechanism fixed a real Phase 1/2 gap: switching
  Board / Write on screen used to unmount the other surface and silently
  discard the iPad's copy of that ink. Both board surfaces and the PNG export
  now sit on the Warm Notebook dotted cream ground (the display page went
  cream too). Also fixed a latent Phase 2 loop — notifyHistory read the
  onHistoryChange prop directly, so an inline parent callback made the
  mount-notify effect setState every render (Maximum update depth exceeded).
  Verified in-pane end to end: zoom math exact against the fixed-point
  formula, zoomed input inverse-mapped to 6 decimals on the wire, pinch =
  finger-spread ratio, tap-undo still fires (one remove) while a moved
  finger kills the tap, pan clamps to the page, pages isolate their rooms
  with zero cross-leakage, hidden pages free to 1x1 and repaint bit-for-bit
  (212=212 samples), and a second tab's display followed live pageflips and
  painted while backgrounded. Zoom is deliberately absent from the glass
  sheet (ink must stay aligned to the screen under it) and gestures still
  need "Finger draws" OFF. Templates no longer fight the paper (7/22, merge
  8e67878): a set background image - coordinate plane, any grid template -
  suppresses the dotted ground on the live board and in the export; removing
  it hands the dots back at the current zoom. UI ROUND (7/22, commit e3e71e0, merge a715596):
  the iPad toolbar became a translucent FLOATING PALETTE over a full-bleed
  writing surface - a small Tools pill (with the connection dot) is all that
  stays when hidden, and the palette organizes into rows (surface + pages,
  colors + widths, tools, actions) with rare controls behind More; open
  state persists per device. Same round fixed "Write on screen goes back to
  waiting for the lesson": /teacher/present resolved its session from the
  URL param OR the device's STORED teacher session id, and a stale stored
  id pinned the iPad's mirror (and any no-param projector open) to a dead
  session forever - the stored id is now only a hint that falls back to
  auto-attaching to the single live session (verified via SW-mocked session
  API: stale id + one live session renders the live state where it used to
  wait). FEEL-TEST ROUND (7/22, commit 627aedc, merge
  0ab4595) from Steele's first real Pencil session: the pen is now a
  CONSTANT-WIDTH marker with round caps (his verdict - he writes equations,
  not calligraphy; pressure still captured on the wire, radiusFor is the
  way back). His "Write on screen shows up nowhere but the iPad" reproduced
  as NOT a code bug - glass ink verified end to end over real Supabase
  Realtime for the first time (public bundle keys in a local worktree
  env) - but as a STALE PROJECTOR TAB: display tabs never pick up new
  builds. Fixed for good with DeployRefresh: display routes (/board,
  /teacher/present, /live-flow, /warmup) poll the new public /api/build-id
  and reload themselves when a deploy ships (never /ipad - the pen holds
  authoritative ink). Handwriting-to-typed-equation was considered and
  shelved per Steele ("if it'll be glitchy don't sweat it") - recognition
  needs a vision-model round trip, wrong risk profile mid-lesson.
  COMPLETE FOR NOW (Steele, 7/22): "ill live with
  the ipad strokes for a bit and see if anything that isnt there needs to
  be." No further ink phases are queued - real classroom use decides what
  comes next, and glass-sheet export was considered and declined (annotations
  do not need to become artifacts; including the under-screen would take DOM
  rasterization of the present stage). First real-use bug report came in
  same day and was fixed within the hour (ff4df7d): the Pixel eraser's ring
  froze at touch-down and erased blind, because pixel erase paints straight
  onto the dry layers and nothing repainted the wet layer holding the ring -
  the ring now tracks the drag for both eraser tools. Open loop: his Pencil
  feel test -
  pressure curve, snap timing, eraser reach, laser fade, zoom ceiling, dot
  pitch are all one-number dials.
  **STALE ABOVE, CORRECTED 2026-08-04.** Everything in this entry describing
  PAGES (the 1-8 chips, `pageflip`, "Page N of M"), the `__scratch` overlay,
  and the Board / Write-on-screen surface switch describes a design that was
  TORN OUT on 2026-07-30 for one-surface-one-room - see `src/app/ipad/page.tsx`
  and `src/app/board/page.tsx`. There is now ONE interactive board on
  `<room>__over`, rendered unconditionally by every display; Paper is a
  background toggle, not a surface, and the split whiteboard is a white panel
  the same pen writes across. The pressure line is also superseded: the pen is
  a CONSTANT-WIDTH marker by Steele's decision, and the 8/3 work was three
  geometry fixes (round caps that swept the wrong way and never once capped a
  stroke, a mitered joint so a corner stops pinching, and a React re-render on
  every pen lift), not the dials this entry lists. Read the rest as history.
- **Ladder Method — rule rail redesign + Factor Trees mode** (7/21, commit
  c9206cc) — /ladder-method now follows the three-column manipulative
  convention: the divisibility rules sit in the LARGE LEFT RAIL (same wording
  as /divisibility, rules 2-6 plus 7's honest non-rule), the ladder or trees
  in the center, results on the right. The rail is live guidance — a rule
  lights green when it works on BOTH bottom numbers (Ladder) or on the node
  being split (Trees), and tapping a lit rule loads that divisor. When the
  ladder closes, the pulled-out divisors line up UNDER it and the student
  multiplies them out one step at a time for the GCF, then extends the chain
  with the two bottom leftovers for the LCM; wrong products get the real
  arithmetic named. Factor Trees mode (rebuilt same day to Steele's spec,
  commit 4de7f5c): the rules own the left third and the tree owns the rest.
  No number options on screen — the teacher sets the sequence ahead of time
  (Factor Trees field on the /control ladder state, or ?set=24,36,60; shared
  parser src/lib/factorTreeSet.ts; /ladder-method gained a { set }
  LiveToolConfig arm) and students get one number at a time with progress
  dots and localStorage resume. The student types BOTH factors of a split; a
  wrong pair names its real product, pulses the lit rules, and points at one
  ("Not sure? Try 2 — the last digit is even"). New prime branches FLASH
  until tapped; the tap draws a circle and check mark that settles. When
  every prime is confirmed, the primes lift out of the tree and fly down to
  a line at the bottom (staggered, capped under 2s, hard fallback so a
  backgrounded tab can never strand a student; reduced motion lands them
  instantly), then the line collapses two at a time through an anchored
  pop-out — 2 x 2 becomes 4, 4 x 2 becomes 8 — until the original number
  stands alone, rebuilt from its primes. The earlier two-tree side-by-side
  compare was superseded by this spec and removed. No evidence emitters
  (unchanged). Verified end to end in-browser both modes; typecheck and
  build clean. Merged to main and live 7/21.
- **Divisibility D1 — rules 1-6, closes with clickable factor arches** (7/21,
  commit 8c7a79a, same branch as the Distributive Area work) — /divisibility now
  matches its D1 lesson scope. The rule rail is ÷1 through ÷6 only (7-10 removed
  outright); the numbers are 24, 35, 36, 40, 42, 48, chosen so every crossing
  point sits at or below 6 — the six rules always finish the factor list, and a
  factor of 7 arrives as a partner (35 = 5 x 7, 42 = 6 x 7) instead of needing a
  rule. The stop is still the computed crossing d*d > N (24 stops after testing
  4, 35 after 5), never "the board ran out". The least-to-greatest ordering step
  is replaced by pair-picking on the ascending factor line: the student clicks
  the TWO factors that multiply to N; a right pick draws a real curved SVG arch
  between them (endpoints pulse once, the product pops green at the apex,
  settles, fades), a wrong pick names the product they actually made ("Not this
  pair - 3 x 12 = 36, not 24"). 36 closes its square with a single 6 under a
  small 6 x 6 self-loop — no duplicated factor. Arches nest by span with the
  outermost tallest; the arch panel is full-width so 48's ten factors fit a
  Chromebook with no horizontal scroll. Completion line: "The arches are closed.
  Every factor has a partner, so the list is complete." prefers-reduced-motion
  shows the closed arches instantly. No evidence emitters (unchanged — this stays
  an optional-support tool). Verified in-browser across all six numbers plus the
  wrong Yes/No and wrong-pair paths; typecheck and build clean. Merged to main
  7/21.
- **Distributive Area Method — one-screen redesign + teacher problem series** (7/20)
  — the tool now works on a single screen: "Keep it whole" is gone (splitting is
  the point), and the equation chain sits directly under the area model, where
  students plug the parts into `a(__ + __) = a(__) + a(__)` and solve it one step
  at a time, each solved product dropping into its own region on the rectangle.
  Interactions cut from ~13 to 6 — one click to split, then five checks; no detour
  payoff screen, no product typed twice. Wrong answers get feedback aimed at the
  specific mistake (outside factor used as a part, added instead of multiplied,
  answered with the whole rectangle, product added to a part); two of those tag
  the existing "distributes to first term only" misconception. Area model ~3x
  bigger, sized off the measured container with a viewport-aware height budget, so
  the flow fits without scrolling on a laptop and an iPad. A teacher-set problem
  series can start three ways, all one format (`24x7, 16x8`, first number is the
  one they split): the Problem series field on the Distributive Area Method state
  in `/control` (rides the existing `live_flow` snapshot via a new `LiveToolConfig`
  variant — no new table or endpoint), a `?set=` link for a Notion step or handout,
  or the builder on the tool itself. Blank = students pick their own numbers, i.e.
  today's behaviour. Shared format/parser in `src/lib/distributiveProblems.ts`.
  Code done and typecheck/build clean; merged to main 7/21. Still owed: Steele's
  one-time spot-check of the control-panel publish with a student tab joined (that
  handoff could not be exercised locally — `/control` needs `TEACHER_PASSWORD`).
  Post-merge cleanup queued: swap the tool's local task banner for the shared
  `LiveToolBanner`, which main restyled for cream pages while this branch was in
  flight.
- **Grudge Ball** — second live team review game, forked from BRUH's engine (shares
  the question loop, grading, and `bruh_sets` banks; separate `grudge_*` tables so
  BRUH cannot regress). Same answer/reveal/explain, then the reward beat becomes
  shoot + steal: the teacher taps a correct team, they explain, shoot a real hoop
  for ~30s (a teammate taps MAKE per basket), then walk to the panel and knock X's
  off rivals by hand. Erase model (anti-snowball); zero X's = out of the shooting
  but still answering + immune; "back with a grudge" revives after 2 wilds-while-out
  wins, taking 3 from the nemesis. `/teacher/grudge` (+`/board`,`/scoreboard`,
  `/remote`), `/grudge` student. Code + migration done; waiting on Steele to run
  `supabase/grudge.sql` and a live run. Deliberately not on the proficiency spine.
- **Week builder** — code shipped (warmup-pools-data.gs + warmup-week-builder.gs +
  sidebar button); waiting on Steele's Apps Script paste-in. Builds the week from
  published Notion lessons: pool-backed Q4/Q5 (verified tags), AI openers only.
- Warm-up → spine bridge — live and verified (Evidence post 200, 7/4)

## Planned
- **The laptop as the participation and edge-case view** (Steele, 2026-07-29,
  refining "the laptop shows student data"): a general state of participation that
  flags students who are not submitting - the edge cases, including students not
  submitting on a website tool. This is a BETTER use of the laptop than live
  misconception clusters, because clusters are partly on the iPad already (the
  visit list groups tier 2 by the error), whereas **non-submission has no home
  anywhere in the system.**
  **Most of it is queryable today.** `poll_answers` gives who answered which step;
  the signals table gives who tapped stuck; `responses` with `source='tool'` gives
  who produced tool evidence this session; `students` minus `session_joins` gives
  who is on the roster but never joined. `visitList.ts:158` already treats "no
  answers at all" as tier 2, so non-submitters are not invisible - but only for the
  readiness checks, only during the release block, and only lumped in with students
  who answered one thing wrong.
  **ONE PIECE OF PLUMBING IS MISSING, and it is cheap.** `session_joins` carries
  `joined_at` and nothing else - no last-seen, no heartbeat. So there is no way to
  tell a Chromebook that has been closed for eight minutes from one that is open
  and idle. Every student device ALREADY polls `/api/student/session-state` every
  three seconds, so the fix is one nullable `last_seen_at` column plus a touch on
  that route. That single column turns "who has not submitted" into "who has not
  submitted AND has not been seen since 9:14", which is the difference between a
  guess and a flag worth walking over for.
  **Framing constraint - do not call it "off task".** Liveness and submission are
  measurable; attention is not. A student can stare out the window with a perfectly
  healthy Chromebook. Label the flags "hasn't submitted" and "hasn't been seen",
  never "off task", or the surface makes a claim its data cannot support - the same
  class of error as the readiness bug that marked a whole class incorrect.
  Privacy: this is teacher-only and must never reach a student device or a public
  projector; do not widen `studentSafeLiveFlow` for it.
- **Run the lesson without a control panel** (Steele, 2026-07-29: "needing to go
  to the control is not intuitive... I don't need a center control panel running
  on my laptop just to make the rest run"). He is not mirroring screens; he runs
  the lesson off the screens it is already on, so a laptop-bound conductor
  surface is dead weight. He wants to drive from a Screen-Studio-style wireframe.
  **Most of this already exists.** `/api/control-remote` executes server-side
  today: `start-lesson` (builds the sequence from Notion, flips broadcast, arms
  step zero), next/previous, all four timer actions, show/hide-board,
  set/clear-behavior, transition-now, reveal-results, reveal-final-score,
  spin-spinner, the sound and Abbie cues, and lazy automatic pacing on any GET.
  Pacing advances as long as ANY surface is polling.
  **Four things still require `/control` to be open:**
  1. **Discussion rounds.** The phase snapshot is authored by `DiscussionProtocol`'s
     local React state and published through Control's snapshot; the `discussion-*`
     remote actions are only requests the overlay interprets. Close the laptop
     mid-discussion and the rounds stop. This is the big one.
  2. **Tool publishing** — `publishToolSetup` builds `flow.tool` from Control's form.
  3. **The exit-ticket / challenge / checkpoint launch UI.** The writes themselves
     already go through service-role APIs (verified: `isTeacherSurface()` routes
     them), so only the configuring UI is Control-bound.
  4. **Lineup editing and reordering.**
  **The structural prize:** Control's once-a-second FULL REPLACE publish loop is
  both why it must stay open and the source of the two worst documented bug
  classes - fields erased on reconnect, and a second tab clobbering the lineup
  with its own local skeleton. Server-authored state removes that whole class.
  **The renderer is already built.** `/demo` shows the real Main projector,
  Support projector, student page and all-day boards in scaled iframes with a
  "Next - advance the room" button acting as the teacher's remote, and Screen
  Studio already embeds the real surfaces. A runner is `/demo`'s structure
  pointed at the live session with Next wired to `/api/control-remote` - and the
  surfaces poll the session themselves, so it needs no posting at all.
  **Sequencing note:** doing the authored discussion phases SERVER-SIDE kills
  blocker 1 as a side effect, so build that first rather than twice.
  **"What role is Control playing anymore?" (his question, 2026-07-29 - and the
  honest answer is almost none).** The iPad deck already carries Pacing, Timer,
  Transition now, This slide (board + classroom state), Discussion routine,
  Private response data, Abbie and Sound effects. `/session` has "Start today's
  lesson" and `/teacher`'s live-session card has the same, both firing the
  complete server-side `start-lesson`. So Control's only genuinely unique jobs
  are: (a) **being the interpreter for the iPad's own discussion buttons** - the
  rounds live in `DiscussionProtocol`'s React state, so the iPad's Discussion
  routine section is a remote pointed at a program running on the laptop; (b)
  holding the tool-publish and formative-launch FORMS, which are pre-class setup,
  not running work; (c) the bank and lineup editor, which he does not use because
  he builds in Notion and Screen Studio. Everything else is the publish loop,
  which exists only to serve (a)-(c).
  **HIS ACTUAL SETUP (clarified 2026-07-29): everything is browser tabs.** Start
  the session from the interactive panel, then open the main projector view in one
  tab and the pacing screen in another - both projectors are just browser
  windows, and the iPad is the remote. There is no dedicated control machine in
  the picture at all, which is why Control reads as vestigial to him: it is a
  third surface whose only job is to exist.
  So the starting surface must be FIRE AND FORGET - it cannot need to stay open,
  foregrounded, or even mounted. That is a hard requirement, not a preference, and
  it breaks two ways today:
  - Navigate that tab off `/control` and the discussion rounds die with it, since
    the rounds are Control's local state. Publishing stops too.
  - LEAVE it open in a background tab and Chrome throttles its timers - hidden
    tabs drop to about 1/s, and after roughly five minutes hidden, intensive
    throttling can take them to about once a MINUTE. Control's publish loop runs
    at 1/s, so a backgrounded Control would fall behind and the projector's state
    and timer would lag. Worth measuring rather than assuming (playing audio can
    exempt a tab), but it is the wrong shape either way.
  `start-lesson` is ALREADY fire-and-forget - one POST arms the whole lesson
  server-side, and `/session` plus `/teacher` both have that button. So his
  workflow already works for everything EXCEPT the discussion rounds and the
  tool/formative forms. Those two are the entire gap.
  A stripped Control is then just join code, current step, Start/Back/Next/Pause;
  the bank, lineup editor and tool forms belong on a setup surface, not in the
  view that is open while a class runs.
  **WHAT ACTUALLY BREAKS IF CONTROL GOES AWAY - the two real objections.**
  1. ~~The exit ticket~~ **RESOLVED 2026-07-29 - not a blocker.** Checked every
     exit step in the deployable lessons: L1-D1 "The Concert Floor", L2-D1 "The
     Taki Miracle", L2-D2 "Abbie and the Neighbor Dog" and P1-BRUH all carry a
     `Response Mode` and a `Question`, so `navigateFlow` creates a POLL and the
     evidence lands in `poll_answers` through `/live-flow`. That path is entirely
     server-side and needs no Control. Exit tickets are local to the site, not a
     Google Form (Steele confirmed).
     KNOWN DRIFT worth a decision, though: the `exit_tickets` table, the
     `/exit-ticket` route, and Control's exit form are a SECOND on-site exit
     mechanism that the authored lessons do not use - `launchExitTicket` has one
     UI call site, `/control:1578`. The docs still describe `/exit-ticket` as
     where the day's evidence is collected (it even backs drafts to localStorage
     for it), so the two paths disagree about which is real. Pick one and retire
     or re-point the other before it surprises someone mid-period.
  2. **Tool configs are not authorable anywhere.** All four `buildLiveToolConfig`
     call sites are in `/control`, so `flow.tool` and its payload - the Factor
     Trees number set, the distributive problem set, the GEMS expression - can
     only be published from Control's form. A Control-free run cannot push a
     teacher-set sequence, which also disables the `/ladder-method` mode lock,
     since that triggers on a pushed set. The fix is to make the config authorable
     (a `Tool Config` text property, or honour a `?set=` query string on the step's
     `Link`), which removes Control from the tool path entirely.
  **What works BETTER than expected, and is worth not re-engineering.** The timer
  needs no ticker: `flow.timer.endsAt` is an absolute timestamp and
  `liveTimerSeconds()` computes the remaining seconds locally, so read-only
  projector tabs keep perfect time with nothing publishing to them. And automatic
  pacing is applied lazily on any GET, so two polling projector tabs advance the
  lesson between them without a driver. The read-only-projectors design is sound.
  **One resilience regression to accept deliberately:** the iPad becomes the only
  way to drive, where today Control is the fallback. `/session` already carries a
  minimal Start / Back / Pause / Next toolbar for exactly that - keep it, and know
  it is there.
- Claude enrichment: score short-answer reasoning (next-move sharpening now Live)
- RLS tightening on legacy tables (required before real student data)
- Reskin remaining tools; vertical draggable control sequence

(Removed 2026-08-04: two Abbie entries - "Abbie everywhere - DONE" and "Abbie
lesson-sequence phases 2-5". The feature was unmounted 7/29 and its files
deleted 7/30 on Steele's word; `supabase/abbie-teardown.sql` is what shipped.
Re-enabling is a rebuild, not a remount, so there is nothing here to plan.)

## Parked
Infinite Campus push · Scan/OCR checkpoint pipeline · Google student sign-in
(CCSD OAuth question first)

## Steele's open setup items
Pruned 2026-08-04 by the first `/status` sweep - four of the six items pointed at
work that no longer exists, and one of them would have broken teacher auth.

1. ~~**Redeploy from the Vercel dashboard**~~ **RESOLVED 2026-08-04 - the
   pipeline is healthy.** Measured end to end this session: pushed
   `a6fe76c..bc8d232` to `main` and the live `/api/build-id` moved to `bc8d232`
   in **60 seconds**. Nothing is stranded behind the deploy gap any more. Keep
   the CLAUDE.md habit of checking `/api/build-id` after a push anyway - the gap
   was real for 22 commits and "pushed" is still a different claim from "live".
2. ~~**Run `supabase/poll-evidence-vocabulary.sql`**~~ **RESOLVED 2026-08-04 -
   Steele ran it, and both rows are confirmed in the live `misconceptions` table
   carrying `standard_id = 6.NS.B.4`.** The tags now cluster with a domain
   instead of into blanks. Original note follows. Four lines. The poll -> mastery
   bridge shipped 2026-08-04 and writes two new misconception tags
   (`lists a non-factor pair`, `stops before all pairs are found`). An unseeded
   tag does NOT error: it silently loses its domain, so i-Ready corroboration in
   `/api/live/groups` goes to zero and any teacher move authored against it
   renders blank. Same rows are also in `proficiency.sql`; this file exists so
   you can run four lines instead of the whole seed.
3. **Set `WARMUP_ENGINE_KEY` in the WARM-UP Apps Script project** to the same
   value as `CRON_SECRET` in Vercel. `/api/warmup` is now gated
   (`SECURE_ROLLOUT_PREFIXES` + `NEXT_PUBLIC_SECURE_STUDENT_DATA=true`) and
   `warmup-engine.gs:39` only sends an Authorization header when that property
   is set - so building a warm-up fails with `Teacher login required.` from
   `src/proxy.ts:104`. The script's own comment says to set it "once /api/warmup
   is gated"; the condition came true and nobody re-read the comment.
   **PARTLY DONE 2026-08-04 AND NOT YET PROVEN.** Steele set the property, but
   Vercel does not let you read `CRON_SECRET` back, so whether the two values
   MATCH is unverified - and a mismatch is invisible until a warm-up build
   returns `Teacher login required.` The fix is not to recover the old value but
   to ROTATE: generate one new string and paste the identical value into THREE
   places - Vercel `CRON_SECRET` (then redeploy, or the change does not take),
   the WARM-UP project's `WARMUP_ENGINE_KEY`, and the ROSTER project's Bearer
   token for `warmup-roster-push.gs`. Miss the third and the roster push starts
   401ing silently. The proof it worked is `testWarmupEngineFetch()` in the
   warm-up project returning a set rather than an auth error.
4. **Clean the roster Sheet.** The 2026-08-04 push reported 151 sheet rows
   against 156 site students, so roughly **14 stale draft-roster students** sit
   in the database and the push NEVER deletes - they will pad every roster count
   and every "Joined N of M" denominator all year. Also: several rows skipped as
   "duplicate row for one site student" (Golden Badger, Jolly Ocelot, Vivid
   Ocelot, Sunny Walrus, Smart Toucan, Eager Salmon - usually a schedule change
   leaving both rows), and rows 153-157 skipped for "no period".
5. Run `supabase/table-captains-and-supply-checks.sql` - table captains and the
   closeout supply check are DARK until it is applied, and `/api/roster/sync`
   500s on the `table_number` select without it.
6. Run `supabase/grudge.sql` - Grudge Ball's code and migration are done and
   waiting on this plus a live run.
7. The FERPA cutover's Workspace half - **NARROWED 2026-08-04, steps 1 and 5 are
   DONE.** All 156 students in Periods 1-5 carry an `alias` AND an `email_hmac`,
   created 2026-08-01; the site cannot compute an HMAC, so the key exists and
   `pushRosterToSite()` has run. A re-run that day reported
   `created:0 updated:0 unchanged:142`, proving the roster project's key still
   matches the stored hashes.
   **STEP 8 RAN 2026-08-05** - nine live Notion databases archived, including the
   `Rosters` source of truth (174 rows / 157 real district emails / 168 student
   numbers), `Parent INfo` (guardian names + phone numbers) and four MAP/SBAC
   tables carrying student names. Six were already archived, which is why the
   workspace looked clean; the runbook's named list was half the real set. Two
   human steps remain there: **empty the Notion trash** (archiving is not
   deleting) and hand-delete the 1-row `Student Submissions` database the API
   refuses. Details and the two verification traps: `supabase/FERPA-CUTOVER.md`.
   WHAT IS ACTUALLY LEFT: **step 2** (confirm the WARM-UP project's
   `BDM_ROSTER_HMAC_KEY` matches the roster project's - unproven, and invisible
   until a real warm-up returns "not on roster"), **step 6** (one real warm-up on
   a district account - this is what writes `auth_user_id`; the roster never
   does).
   **Until step 6 lands, no student write can succeed at all** - fist-to-5, the
   stuck chip, tool evidence and now the poll -> mastery bridge all fail the
   verified-student gate and present as dead buttons. Re-measured 8/4:
   `select count(*) from students where auth_user_id is not null` returns 0.
   This is still the single biggest blocker in the file.
8. Paste `warmup-week-builder.gs` + `warmup-pools-data.gs` into the WARM-UP
   Apps Script project (code shipped, waiting on the paste-in).
9. Add `Misconception Plans` text property to the Lessons DB; author
   `tag :: move` lines. The code side reads it already
   (`src/lib/notionLessons.ts:685`, consumed by `/teacher/rightnow`).

Removed as stale on 2026-08-04, with what replaced them:
- "Reseed mock fixtures (`seed2_part_1…4`, `iready_seed2`)" - no such identifier
  exists anywhere in `supabase/`, `src/` or `scripts/`. The mock class is
  `supabase/mock-classroom-seed.sql` plus `mock-live-session-seed.sql`.
- "Vercel envs `NOTION_ROSTER_DB_ID` … delete unused `NEXT_PUBLIC_TEACHER_PIN`" -
  `NOTION_ROSTER_DB_ID` has zero references since the FERPA cutover deleted the
  Notion roster pull, `CRON_SECRET` and `EVIDENCE_INGEST_KEY` are both live and
  in use, and `NEXT_PUBLIC_TEACHER_PIN` is NOT unused: it is read at
  `src/lib/teacherAuth.ts:12`. Deleting it as instructed would break teacher auth.
- "Share the roster Notion DB with the integration" - the Notion pull and its
  Vercel cron are gone; the roster pushes from `warmup-roster-push.gs`.
- "Run `supabase/abbie-broadcast.sql` and `supabase/abbie-questions.sql`" -
  neither file exists. `supabase/abbie-teardown.sql` is what shipped.
- "(done) supabase/bruh.sql has been applied" - kept as history, not an open item.
