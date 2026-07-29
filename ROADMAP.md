# Big Dog Math — Feature Roadmap

**The live tracker is in Notion:** "Big Dog Math — Feature Tracker"
(https://app.notion.com/p/f248b4164504427d896087e9b98aa2f4 · data source
`56ee55bb-c067-4613-8f3b-6d5810a82ced`). Steele checks things off there; agents
should update BOTH that database and this mirror when a feature ships.

Snapshot (2026-07-16):

## Live
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

**"Stuck? Walk it through." — the M1.T1.L1 worked example** (7/29, from the
Claude Design handoff "Distributive Walkthrough"). Six click-to-advance steps
that build `a x b = a ( p + q )` on one stage: rewrite it, draw the box
template, pick the friendly factor, split the other one, then multiply and add
— with the target answer parked to the side from step 1 and filled green at the
end so the student sees both routes agree. Earlier steps stay up and dim to
0.34, so the whole chain of reasoning is still on screen; step 3 is deliberately
a question ("which factor is easier to work with?") because that is the only
step in the method that is a decision rather than a move. Reachable two ways:
a `Stuck?` chip on `/distributive-area` that opens it as a full-screen overlay
so no half-placed split is lost, and the public `/stuck` route, which takes the
problem in the URL and needs no session — so it can sit in a Notion `Help Path`
line and still work at 8pm. It never demonstrates the problem the student is
working on: `walkthroughExampleFor()` hands back a parallel example, contract-
tested across every problem the tool can generate, because a solved copy of the
question in front of them replaces the work instead of unblocking it. Reflows
on a phone (answer panel leaves the stage, no sideways scroll) and honours
`prefers-reduced-motion` by rendering each step finished. ·
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
progress bars from the classroom clock. One accent hue per weekday. The reveal
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
- **City Routes v1** (7/19) — the private differentiated release every M1.T1 lesson
  references. After the two-question readiness check, students split into three
  temporary support routes announced only as rotating park names (Yosemite,
  Acadia, ... — a deliberately connotation-free ten-name bank in
  `src/lib/cityRoutes.ts`), so no public screen ever shows a score, tier, or
  ability label. Pure engine (deterministic name+meaning rotation per lesson code
  + shuffle salt; 2/2 = independent, 1/2 = partner, 0/2 = teacher-guided;
  correct-but-low-Fist-to-Five flags a teacher check, never demotes; no answers =
  needs assignment). Server-only tables (`supabase/city-routes.sql`, mastery-style
  lockdown), teacher API `/api/live/city-routes` (gated), student card API
  `/api/student/city-route` (dual-mode like session-state: verified identity
  under the secure rollout, claimed id in transitional mode; returns
  city/destination/materials/first action only), review/override/shuffle/release
  panel on the iPad Remote, and the
  student card on `/live-flow` during small-group and independent states.
  Code + migration done; waiting on Steele to run `supabase/city-routes.sql`
  and a live run. Deferred: projector city-to-location key, timed stagger
  (encoded in first-action copy for now), per-lesson destination/materials
  editing, arrival receipts.
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
- **Abbie everywhere** — DONE (Area=Abbie): console + mic, student-screen
  broadcast, Ask-Abbie queue, contextual reactions, and bits all shipped 7/7-8.
  Later, optional: server-side cross-day memory (auto-summarized) instead of the
  device-local note.
- Claude enrichment: score short-answer reasoning (next-move sharpening now Live)
- RLS tightening on legacy tables (required before real student data)
- Reskin remaining tools; vertical draggable control sequence
- Abbie lesson-sequence phases 2–5 (auto-built spinner/misconception/flashback/exit)

## Parked
Infinite Campus push · Scan/OCR checkpoint pipeline · Google student sign-in
(CCSD OAuth question first)

## Steele's open setup items
0. (done) supabase/bruh.sql has been applied - BRUH is live.
1. Reseed mock fixtures (`seed2_part_1…4`, `iready_seed2`) → verify colored bars.
2. Add `Misconception Plans` text property to the Lessons DB; author `tag :: move` lines.
3. Vercel envs: `NOTION_ROSTER_DB_ID`, `CRON_SECRET`, later `EVIDENCE_INGEST_KEY`;
   delete unused `NEXT_PUBLIC_TEACHER_PIN`.
4. Share the roster Notion DB with the integration.
5. Run `supabase/abbie-broadcast.sql` (done) and `supabase/abbie-questions.sql`
   once each so Abbie's student bubble and the Ask-Abbie queue work in class.
