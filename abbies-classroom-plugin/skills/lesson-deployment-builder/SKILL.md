---
name: lesson-deployment-builder
description: Build or revise ONE Notion lesson page in the Big Dog Math "Math 6 Lessons" database to full deployment depth - every lesson property, one Lesson Steps record per class state, and the teacher-facing page body - anchored on the Carnegie Learning TIG first then resequenced onto the locked Concrete-Representational-Abstract spine. Use whenever Steele names a lesson by code, title, or date and wants it built out, finished, deepened, revised, "made deployment-ready", "ready to teach", or "ready for tomorrow", or wants the class states / Lesson Steps / control-panel sequence authored for it, even if he never says "Notion" or "deployment". Also trigger on "this lesson is a stub", "make this lesson real", "add the CRA states", "map Carnegie onto my states", "write the misconception plans", "author the readiness gate", "split this lesson into two days", "write the hook", "resequence this lesson". For bulk stub creation across a unit use lesson-database-builder instead; this goes deep on one teaching day.
---

# Lesson Deployment Builder

Take one teaching day from stub to deployable. Deployable means three things at once: the **software can run it** (properties the site reads, plus one Lesson Steps record per state), the **teacher can teach it cold** (a body that answers every in-the-moment question), and the **pedagogy is defensible** (Carnegie is the starting point, every departure named).

**Read `CLAUDE.md` at the repo root first.** It is the shared brain across Claude, Codex, and the Claude Project, it is kept deliberately current, and per its own rule it wins over any stale doc — including this skill. If something here contradicts it, CLAUDE.md is right and this file needs fixing.

`classroom-os-context` carries the standing project context - architecture, hard rules, the four surfaces, the design system. Assume it loaded. `lesson-database-builder` is its sibling for bulk stub creation; this skill is the one that takes a single day to depth.

Repo: `/Users/steelewilson/Big Dog Math Site` — **not** `Documents/Website prototype`, which Drive sync corrupted and which was abandoned 2026-07-21.

---

## The four non-negotiables

**1. CRA is the spine, always.** Concrete → Representational → Abstract, in that order, with real minutes on each. Concrete is the teacher build (I Do), Representational the shared build (We Do), Abstract the student's own notation (You Do). A lesson that opens on notation gives a stuck student nothing to fall back on, and "go back and think about it" becomes an empty instruction.

CRA is carried by a **fade** as much as by state IDs — support removed phase by phase, with a different `Response Mode` at each, and either one invariant number set throughout or a deliberate ladder. Name the progression as a body block on every lesson. See `references/lesson-quality-bar.md` for how the three good lessons do it, including the honest case where a lesson's concrete is contextual rather than material.

**2. One page per teaching day. Split without being asked.** This is a locked convention and a real defect in the current data. If a lesson holds more than one day of material — Carnegie says 2 sessions, the `Date` is a range, the required work won't fit in one 50-minute frame — then it is **two pages**, D1 and D2, each with its own single date, its own success criterion, its own hook, and its own exit. Propose the split as part of the plan rather than cramming. Never write a Notion `Date` range; `/api/today` and the day-to-day retention chain both depend on single dates.

**3. Carnegie first, then earn the change.** Read the Carnegie TIG before writing a line. Carnegie's task design is genuinely good; what it does not do is sequence for a room. Start from Carnegie, resequence, and **write the defense**: Carnegie's starting point, the adaptation, why it serves the standard better, what got cut. This block is not paperwork — it is the artifact that makes adaptation visible and structured instead of invisible and personal.

**4. Filled in means *specific*, not *plausible*.** "Students may struggle with equivalent ratios" is worthless. "Students will scale 3:5 additively to 4:6 because they add 1 to each term, so the tape diagram must show unequal-sized parts before the numbers appear" is a teaching move. Sources in order: `src/lib/sbacCheckpoints.ts`, the TIG, the three good lessons, then targeted research. Never fill a field with something that only sounds right — see **What stays empty**.

---

## Match the first three lessons, nothing else

Only **M1.T1.L1-D1**, **M1.T1.L2-D1**, and **M1.T1.L2-D2** are near deployable. Everything else is a stub or a sketch — including the ~80 pages that share the 5-tab M1.T2 shape. **A widely-copied shape is not a standard just because it's widely copied.** Read `references/lesson-quality-bar.md` before authoring anything substantial; it is the bar, and it names which of the three to take what from.

This overrides the instinct to match a topic's local convention. Consistency with the room's *routines* matters (state words, the discussion rhythm, exit at 46–49). Consistency with a thin page's *depth* does not — if the neighbours are stubs, exceed them and say so.

---

## Choose the day's structure deliberately

Three kinds of day, and picking is the first decision:

- **New-learning day** → the CRA spine. The default.
- **Practice day** → error analysis run extensively, gallery walks, the vertical classroom.
- **Review day before a test** → **Bruh** or **Grudge Ball**. Self-contained games, already built, nothing to set up and nothing to author. Schedule the day, keep the fixed frame around it, and design nothing inside it.

Not a spectrum: a practice day is not a CRA day with a game bolted on, and a new-learning day does not open with Grudge Ball.

What carries across both: the hook on the projector during the warm-up, LI and SC read from the spinner, the Fist-to-Five before any graded item, the exit ticket at 46–49, closeout at 49–50, and designed transitions.

Within a practice day, Steele's rule decides which activity:

> "Use error analysis or a gallery walk when it produces better reasoning than repeating CRA."
> "Prefer error analysis, method comparison, or a gallery walk when students already know the concept."
> "Use games, card sorts, relays, gallery walks, or design challenges only when they produce mathematical evidence."

So: still need a model-to-symbol bridge → CRA. Already have the concept and need better reasoning → error analysis or gallery walk. Either way, does it end in something written you could grade? If not, don't run it. Name the pick and defend it in the body's structure block.

**Analyzing incorrect work is the highest-value move in the system** and belongs on nearly every day in some form — a 6-minute wrong-worked-example inside `discussion` on a new-learning day, a full four-station clinic on a practice day, and misconception-mapped distractors on every multiple-choice item regardless. The house protocol has a five-part receipt (what is correct / the first incorrect step / why it's tempting / the precise repair / what check catches it earlier), a diagnostic order that puts representation errors before arithmetic, and two rules that make it work: credit the correct work first, and withhold the reveal until after revision.

**Gallery walks** work when students already have the concept and there is a product worth walking to. Real configs run 3 stations × 2 minutes or 4 × 4–5, each round with a *different* job, one-way timed movement, "comment on the mathematics, not the artwork", a required revision, and an individual receipt at the end. Budget 2 minutes for the hustle out and back, taken from instruction.

**The discussion protocol is fixed:** Think 1 · Write 1 · Discuss 2 · Revise 1 · Share 1, with stems and vocabulary visible on the support surface the whole time. Write stems that force a mathematical sentence, not a social one.

Full detail, including verbatim prompts and failure guards, in `references/structures.md`.

---

## The hook has to actually be intriguing

Both ends of the day. Two tests: approachable enough to **estimate** before instruction, impossible to **prove** without it. If a student can answer it with yesterday's math it's the wrong question; if they can't even guess, it isn't a hook.

Passing both tests still isn't enough — a valid hook can be flat. What makes one land:

- **A dare in the second sentence.** "40 water balloons, equal buckets, none left over. What are ALL the ways you could split them? *Could you prove you found every single one?*" Most flat hooks are missing that second sentence.
- **The answer is something you must name before you can compute it.** The parking-lot hook works because 12 could mean sections or spaces, and that ambiguity *is* the day's misconception. "Do not hunt for an operation. First tell me what the answer counts."
- **Stakes an 11-year-old recognizes.** Skate parks, carnival lights, water balloons, parking lots. Two trains leaving a station is not a hook.
- **A deferral promise on the screen.** "You do not need to solve this yet. You will be able to answer it by the end of class." The screen makes a contract; the payoff pays it.

**Wire it in five places** — warm-up minute 0 unresolved, re-posed as its own `launch` state with READ → PREDICT → JUSTIFY, interpreted back into context the moment the concept is named, one gate item, and the exit plus a payoff state named "You Can Answer It Now" that states how the day's model proves it rather than just revealing the number. Concealment is written as a rule on every earlier step, not hoped for.

The failure to avoid: M1.T1.L1-D1 has a genuinely good `Anchor Problem` that appears in **none** of its fifteen steps. An anchor not wired into a `Main Display` and a payoff state does not exist.

---

## Workflow

### Step 0 — Fix the target, check its integrity, read what exists

Establish exactly one lesson by `Lesson Code` or date. Disambiguating is harder than it looks: 155 rows with near-identical titles, plus two parallel accelerated databases holding same-coded lessons. Confirm the parent database is `collection://e367e541-…` before writing. Open the ID table in `references/notion-write-contract.md` now so you don't re-fetch schemas.

Read, in order:

1. **The page** — all properties and full body.
2. **Its Lesson Steps** — one SQL query, not one fetch per step (recipe in the write contract).
3. **Its Carnegie source** — `Lesson Resources` → Resource Library row → TIG. **That relation is empty more often than not**; when it is, search the Resource Library data source by lesson code before concluding anything is unreachable.
4. **The three good lessons**, if you haven't this session.
5. **The neighbours** — for routine continuity and to know what the previous exit ticket asked.

**Integrity-check the row.** Each of these is a live defect somewhere in the database:

- `Date` is a single date. A range means the page holds two days — propose the split.
- Body date and `Date` property agree. Two Published lessons have dates shifted to fake the current serving window; if they disagree, ask which is real.
- `Lesson Code` populated and matching the title.
- `Lesson Resources` related.
- `Sessions` agrees with how much material is actually there.
- Every `Tools` name and `Tool:` checkbox resolves to a real route.
- No commas in `Agenda` lines — the site splits on commas as well as newlines, so one comma silently becomes three steps.
- Attachments match the scope (one lesson has a GCF/LCM worksheet attached to a distributive-property day).

**When a neighbour is also a stub** — usually — say what your continuity claim *depends on* instead of asserting continuity that doesn't exist.

### Step 1 — Extract Carnegie, honestly

The TIG is a **file property**; `notion-fetch` returns a `file://…_TIG.pdf` reference, not text. Use `notion-download-attachment`. Check the filename against the lesson code — mislabelled attachments happen.

| Situation | What to do |
|---|---|
| **Readable** | Read it. Intended path. |
| **Attached but unreadable** (no tool, or wrong lesson) | Do not stop. Build on Carnegie-derived text already in Notion — the Resource Library row's `Essential Ideas`, `Lesson Summary`, and body, and the parallel accelerated records, which often carry a fuller transcribed sequence. **Label every Carnegie claim by source**, enumerate what's unverified, hold at `Draft`. |
| **Nothing findable** after searching the library | Say so and ask. Never infer Carnegie's sequence from the lesson title. |

Pull the learning goals, essential ideas, claimed standards, the activity sequence in Carnegie's order with its Engage / Develop / Demonstrate labels, its differentiation, its assessment, and which student pages belong to it. Then diagnose against CRA — typically: no concrete build exists; the manipulative arrives after the notation as remediation; two days sit in one lesson; the essential idea is buried in a teacher sidebar.

**Language discipline.** Carnegie says "Learning by Doing" and "productive struggle." Carnegie does **not** frame confusion as valuable. Confusion-is-step-one is Steele's own contribution — adjacent, never attributed.

### Step 2 — Design on the state spine

First decide **which kind of day this is.** Both kinds share the same fixed frame; what sits in the middle differs.

- **New-learning day** → the CRA spine below. This is the default.
- **Practice day** → error analysis run extensively, gallery walk, vertical classroom, Bruh, Grudge Ball. See `references/structures.md`.

#### The new-learning day spine — this is the sequence, in this order

Steele dictated this flow directly (July 2026). It is the canonical order; deviate only with a stated reason.

| # | State | Min | What actually happens |
|---|---|---|---|
| 1 | `warmup` | 0–5 | Google Form retrieval on Chromebooks. **The projector carries the hook the whole time** — a real-world problem students only read and think about. They are not expected to solve it now; by the end of the day they can. |
| 2 | `launch` | 5–8 | Brief discussion of *how they would attack* the hook. Thoughts and approaches, no solving, no reveal. |
| 3 | `learning-target-readers` | 8–9 | **LI and SC go up and get read aloud — by whoever the spinner lands on.** This is the first reveal. Do not collect confidence here. |
| 4 | `review` | conditional | **Conditional.** Refresh the prior learning the day depends on, *or* skip it and give the minutes to `concrete`. Decide on purpose and say which. |
| 5 | `concrete` | 9–16 | **C.** Structured exploration with explicit instructions. **Pairs or table groups by default**; individual only when the mathematics needs it. |
| 6 | `representational` | 16–22 | **R — and R is normally a website tool.** Teacher demonstrates one problem on the tool, then students run a stated number of reps on it. Reps and setup requirements flex; name the number. |
| 7 | `abstract` | 22–29 | **A.** The assignment appears. Teacher works one; the class works one together. |
| 8 | `learning-target-readers` | 29–30 | LI and SC again — the review, not the reveal. Carries the **Fist-to-Five**. |
| 9 | `question` | 30–33 | **Two problems.** Their answers set the private routes. |
| 10 | `small-group` | 33–46 | Differentiated release on the private routes. **Flexes — see below.** |
| 11 | `exit` | 46–49 | Back at seats. Independent evidence. The hook returns. |
| 12 | `closeout` | 49–50 | Payoff — "you can answer it now" — and cleanup. |

Sums to 50 exactly. **Transitions come out of these minutes, never on top of them** (see below).

**Hard frame, does not flex:** `warmup` 0–5 with the hook on screen · LI/SC read from the spinner after the hook discussion · Fist-to-Five before the graded items · `exit` **46–49** · `closeout` **49–50** · `Advance: Automatic` everywhere except `closeout` and private-release states.

**The release block is the flexible one.** An instruction-heavy day can compress it or drop it and let the build expand — a lesson that needs 30 minutes to land one hard idea beats one that rushes the build to protect a practice window. Don't pad it to hit a number, and don't cut a CRA phase to protect it. What is **not** optional is deciding where the required work lands and saying so. See below.

**Where `discussion` goes — three moves, three homes.** Do not default to a generic talk block; pick the one the day needs. Full detail in `references/structures.md`.

1. **Compare what you did** — inside `concrete`, no state, 60–90 seconds, one line on `Pace Directions`.
2. **Insight, no work** — a 4-minute `discussion` state **right after `concrete`**, before the tool in R gives the idea a name. This is where a "just talk about what you noticed" discussion belongs and the only place it works.
3. **The whiteboard protocol** — think → write → try → discuss with your partner → revise → share via the spinner. A full work cycle of about 8 minutes that **is** the release block on a Shape A day, run on boards resting on the keyboard decks at students' own desks. Every student leaves with an individual receipt; the board itself is not evidence the system can see.

The whiteboard protocol and a `small-group` pull are alternatives, never the same day — see the two release shapes below.

Two rules easy to get wrong:

- **The target is revealed early, then reviewed late.** First reveal at step 3, right after the hook discussion, read by the spinner's pick. Second appearance at step 8 before the Fist-to-Five. What stays hidden through CRA is the *answer to the hook*, not the learning intention.
- **Exactly one success criterion**, one line starting `I can`. The multi-line `Success Criteria` is a menu across the arc; `Selected Success Criterion` is today's pick. Code-validated.

### Transitions are designed, not absorbed

Every change of configuration costs real time, and an undesigned transition is where a 50-minute plan becomes a 55-minute plan. Budget it explicitly:

- **Students physically move** — into pairs, out to vertical surfaces, to gallery stations, back to seats before the exit ticket — that is a planned `transition-hustle` (1 min) or `transition-reset` (2 min) state with its own record, and the minutes come out of the neighbouring instruction block so the day still sums to 50.
- **Same location, new prompt or materials or attention** — no planned state. Run Settle 30s from the iPad Remote and spend no minute.
- The dictated flow has at least two real moves on most days: into pairs or tables for `concrete`, and back to seats before `exit`. Name them or the day runs long.
- A transition state still authors all four surfaces. `Pace Directions` carries the sequence (`Stand → Chromebooks closed → Table 4 to the back wall → 30 seconds`); `Main Display` carries the countdown context or nothing at all.

### What is written on each screen is part of the design, not a caption

Author all four surfaces on every step, including transitions and the release block, and author each for its own audience. `Main Display` is mathematics only — no `WATCH:`, no `BUILD:`, because `universalStateTitle()` already renders I Do / We Do / You Do at the top of that same screen and a restated verb costs reading time at 25 feet. `Pace Directions` is the current directions as a sequence, not a sentence. `Student Action` is one device-scoped action. `Remote Actions` is teacher-only and never leaks. Full rule, the two header exceptions, and the bad/good table in `references/state-catalog.md`.

A step with a duration and a title but empty surfaces is not a step — it is a blank screen in front of thirty people.

- **Every lesson gets a Fist-to-Five. No exceptions.** See below.

### Every lesson has a Fist-to-Five

This is a hard requirement, not a preference. Every teaching day — new learning, practice, review, error-analysis station day, gallery walk — carries one confidence poll.

Where it goes: folded into the **second** `learning-target-readers` state, right after the target is reviewed and **before** the objective gate items. That order matters — a student who has already answered two graded questions is reporting confidence about their performance, not about the mathematics.

How to author it:
```
State ID:      learning-target-readers   (the second one)
Response Mode: Fist to Five
Poll Kind:     fist-to-five
Question:      How well do you understand this right now?
Choices:       0 / 1 / 2 / 3 / 4 / 5   (one per line)
```
Write the prompt tied to the day's learning intention and selected criterion — that's what `Mid-Lesson Check Prompt` is for. And carry the prohibition on the earlier reveal: "Do not collect confidence here. The Fist-to-Five comes after the discussion."

Why it's non-negotiable: it is the **only** signal that catches the student who is objectively correct but reports 0–2. That student passes every gate item and gets routed to independent work they don't believe they can do, and you find out at the exit ticket or not at all. L1-D1 has a dedicated routing branch for exactly this case — "Gets both correct but reports Fist-to-Five 0-2: Start with the worked reference and a first-problem check." Without the poll, that branch is dead code.

It also cuts the other way: a student reporting 5 who missed both gate items needs a different conversation than one reporting 2 who missed both. Confidence and correctness are two axes, and routing on one of them is guessing.

**Confidence never decides routing alone** — "confidence alone never determines the work station." It adjusts a route that correctness has already set, and it is teacher-only data: a student never sees their own or anyone else's number.

M1.T1.L2-D2 has no Fist-to-Five. That is the one clear defect in the best-designed lesson in the database, not a variant to copy.

### Every lesson has student talk

Standing rule, raised by Steele on 2026-07-28, and it applies to lessons already built rather than
only to new ones. A lesson is not finished unless students get to talk to each other **on purpose**.

Two acceptable forms, either or both:

1. **A structured turn-and-talk placed inside an existing step**, where it makes sense. This means a
   named beat on the `Pace Directions` with its own timer phase — not "discuss with your partner"
   tacked onto a slide. If it has no minutes and no name, it does not happen.
2. **A dedicated `discussion` state**, typically 3 minutes after independent work and before the
   exit. The likely shape is 43-46, taking independent work from 13 down to 10. Run it on the days
   that earn it; M1.T1.L3, the consolidation day, is where Steele wants it piloted.

**The deployable lessons genuinely do not use it.** Verified against the Notion database on
2026-07-29: `M1.T1.L1-D1` (the only Published lesson), `M1.T1.L2-D1`, and `M1.T1.L2-D2` each have NO
`discussion` step. That is the gap Steele named, and it is real.

Do not be fooled by the raw count. Thirty-four Lesson Steps carry `State ID: discussion` across the
database, but they sit in the older stubs and sketches, the CC culture lessons, and the M1.T2/M1.T3
shapes - none of which run. `M1.T1-P1` (the BRUH deck) and `M1.T1.L3` each have one, but both are
`Ready for Review`, and `/api/today` serves only `Published` pages dated today. **When auditing this,
count the deployable lessons, not the whole database** - the database-wide number says the opposite of
the truth. Before writing a new discussion step, check whether that particular lesson already has one.

The runtime is ready: `discussion` is a full entry in the state catalog (`src/lib/classStates.ts`), so
both lesson engines give it a real bank entry rather than the empty synthesized one unknown ids get.
It routes through `universalStateTitle()`, gets its own accent, forces `pollKind` to null so no poll
can steal the projector, and has a dedicated two-column scene on all three surfaces. `/control`
reveals a "Run discussion" button that drives `src/lib/discussionProtocol.ts`.

**But the protocol is not universal, and must not be forced to be** (Steele, 2026-07-29). Error
analysis, respectful difference, whiteboard consensus, and share-out are genuinely different shapes,
so one fixed sequence is the wrong abstraction. What is invariant is that every phase gets **its own
timer and one clear direction** - when to think, when to write, when to talk, when to listen, in
whatever order that discussion needs. The current code is the opposite: `DISCUSSION_ROUNDS` hardcodes
three 120-second rounds with fixed labels, so neither the sequence nor the durations can vary, and the
catalog description promises five phases while three run. Until the phase list is authorable, design a
discussion around three equal beats or expect to fight the tool.

Three authoring traps, all verified in the code:

- **`Discussion Prompt` does not reach the runtime.** It is read from the lesson, but only
  `/lesson` consumes it — it is not in the flow snapshot either engine builds, so it reaches no
  projector, no Chromebook, and no iPad. On a discussion step the projector headline comes from
  **`Main Display`**. Author the prompt there, or it is invisible.
- **The step-level vocabulary property is named `Vocabulary`, not `Discussion Vocabulary`.** The
  lesson-level one is `Discussion Vocabulary`. A per-step column named "Discussion Vocabulary" is
  silently dropped.
- **The support projector bounds what it shows**: six sentence stems and three vocabulary cards. Its
  column is absolutely positioned with no overflow, so a seventh stem is clipped with nothing on
  screen to say so. Author within that, or accept that the tail is invisible.

Leave the three properties EMPTY on a step that runs no discussion. Authored stems publish on every
state, and the surfaces only show them on a genuine discussion step — but "empty renders as nothing,
wrong renders on a classroom screen" applies here as everywhere.

### The release block has two shapes, and the shape decides where the assignment lands

This is one coupled decision, not two. Pick the release shape and the homework answer follows.

#### Shape A — whiteboard release. The assignment goes home.

Students work **the assignment's own problems** on whiteboards, at their desks, with the think-write-try-discuss-revise cycle. No small groups; the whole class is on boards and the teacher circulates. The paper assignment then goes home as homework — and it goes home *rehearsed*, because they just worked its first problems with revision and a partner.

The "we do one together" beat moves **out of `abstract` and into the board block** — the first board problem is the shared one. So `abstract` shrinks to about 4 minutes of modelling one, and the release grows.

```
0-5 warmup · 5-9 launch · 9-10 LI/SC · 10-14 review · 14-20 concrete
20-27 representational · 27-31 abstract (model one) · 31-32 LI/SC + Fist-to-Five
32-35 learning check · 35-51 whiteboard on the assignment problems
46-49 exit · 49-50 closeout                                          = 50
```

Sixteen minutes is room for two full cycles plus a spinner share-out, or three problems on a lighter cycle. Fill `Required Paper Work` and `Due and Turn In` with the real due time and destination, and keep the `Help Path` — it matters *more* at home, where there is no teacher to ask.

#### Shape B — small-group release. The assignment is worked in class, on paper.

`abstract` runs its full form: teacher models one, the class does one together **on the actual assignment paper**. Then straight into small groups — the teacher pulls a group by route while everyone else continues the paper.

```
0-5 warmup · 5-9 launch · 9-10 LI/SC · 10-14 review · 14-20 concrete
20-27 representational · 27-34 abstract (model one, do one on paper)
34-35 LI/SC + Fist-to-Five · 35-38 learning check · 38-51 small groups
46-49 exit · 49-50 closeout                                          = 50
```

`abstract` needs the full 7 here because writing on paper is slower than writing on a board. Fill `Required Paper Work`, `Due and Turn In`, and the enumerated product strip. Routes differentiate the path; every route completes the identical product.

#### Neither shape moves anybody

Whiteboards live flat on the **keyboard deck** with the Chromebook screen still up, and manipulatives use the space between partners. So no class transition either way — the only movement is the four to six students the teacher pulls to a table in Shape B, which costs about 30 seconds and needs no planned state. Vertical whiteboards at the walls are a **practice-day** structure, not the everyday release, and those *do* cost transition minutes.

**Keys under the board.** A whiteboard resting on a keyboard presses keys. If a text input is focused — the poll answer box on `/live-flow` in particular, whose drafts save on every keystroke — a student leaning on their board is typing into it and the garbage persists. Do not schedule a text-entry state underneath board work, and prefer rigid boards to flexible ones.

### The other two answers, when neither shape fits

**An assigned practice drill.** The digital-homework path. Steele creates it at `/teacher/assignments`; it works from home with no live session, auto-grades, and reports per-student progress. Details below. Pairs naturally with Shape A, where the paper already went home — use one or the other, not both on the same night.

**No assignment.** A legitimate choice on a heavy conceptual day, a culture day, or the day before an assessment. Say it explicitly — "No required work tonight; the notebook page from class is the product" — rather than leaving the work fields blank. Blank reads as unfinished; stated reads as decided.

### Assigned practice drills — what the system can actually do

Created at `/teacher/assignments` into `practice_assignments`. A teacher picks a **skill**, a **level 1–3**, a **round count** (1–50), **one class or all classes**, and optionally a title and a free-text due note. Problems generate client-side from the skill; there is no stored problem set.

**Some already exist.** Steele has mock assignments created. **Read the live list at `/teacher/assignments` and reuse an open one** rather than proposing a new one — and never hardcode an assignment UUID into a skill or a lesson field without checking it still exists.

The seven assignable skills, with their levels and the manipulative each pairs with:

| Skill key | Label | Levels 1 / 2 / 3 | Paired tool |
|---|---|---|---|
| `order-of-operations` | Order of Operations | No parentheses / Parentheses / Exponents & division | `/order-of-operations` |
| `solve-for-x` | Solve for x | x + b = c / ax + b = c / Harder, negatives | `/equation-builder` |
| `combine-like-terms` | Combine Like Terms | All positive / With subtraction / Mixed order | `/combine-like-terms` |
| `multiplication` | Multiplication Facts | Up to 9x9 / Up to 12x12 / 2-digit x 1-digit | `/multiplication-fluency` |
| `percent` | Percents | Friendly % / Trickier % / Work backwards | `/percent-bar` |
| `integers` | Integer Operations | Adding / Subtracting / Multiply, mixed | `/number-line-plus` |
| `fractions` | Fractions | Equivalent / Compare / Simplify | `/fraction-bars` |

**Coverage gap:** there is no generator yet for GCF/LCM, area or volume, ratios, statistics, or decimals — so Module 1, the only built part of the curriculum, has no matching drill *today*. Don't force a mismatched one, and don't let the gap cap the design either: if the lesson wants a GCF drill, specify it (skill key, three level labels, round count, paired tool) and mark it as needing a generator. Steele is wiring these; the lesson design is what tells him which to build first.

**What it tracks, and what it doesn't.** Results show on `/teacher/assignments`: per-student correct/total, a complete flag once attempts reach the target rounds, class accuracy, and the twelve most-missed prompts. That's a genuinely useful homework check.

But attempts write only to `practice_assignment_attempts`. They **never reach `responses`**, so an assigned drill moves **no** mastery bar, **no** per-standard stage gate, and **no** archetype grouping — it does not appear in `/teacher/mastery` or `/teacher/rightnow`. Two comments in the codebase (`formative.sql`'s header and the `skill` column note) claim it "feeds the same mastery read"; that was intent, never wired. Do not repeat it as fact, and never tell Steele a homework drill will move a proficiency bar.

**Students only find assignments on `/explore`** — not the homepage, not `/lesson`. So when a lesson assigns one, close that gap: paste the `/assignment/<uuid>` URL into the lesson's **`Assignment Link`** property. That property is rendered on the student lesson page as an "Open assignment" button, which makes it the only available bridge between the app's assignment system and a Notion lesson. It's manual, and it's worth doing every time.

### Design the assignment you want, then mark the plumbing

Lesson design leads; the code catches up. Steele is actively wiring this area, so **do not narrow a lesson because a feature isn't built yet.** Design the homework the mathematics calls for, then label its status honestly in one of three ways:

- **Wired today** — in-class practice, paper homework, an assigned drill from the seven skills. Write it normally.
- **Designable, not wired** — write it into the lesson in full detail and tag it `[needs wiring: ...]`, then carry it into the follow-ups list so Steele has a concrete build item rather than a vague gap.
- **Never claimed** — do not tell him something tracks, grades, or moves a bar when it doesn't. That's the one line that doesn't move.

Currently in the middle bucket, all reasonable to design for:

- **Assigning a manipulative with a problem set.** The `assignments` / `assignment_problems` / `problems` tables exist with full RLS policies but have zero application code — schema without a UI. So "10 problems on `/algebra-tiles`, these specific problems, due Friday" is a legitimate lesson design; it just needs the front end. Specify the tool route, the problems, and the count.
- **Tracked tool completion.** `reportToolResult()` only fires inside a joined live session, so at-home tool work records nothing today. Design the quota anyway and give it an interim receipt the teacher can check — a written tally, a screenshot of the tool's own count, or a number reported on the next warm-up.
- **Drill attempts feeding the proficiency spine.** Design as if a homework drill will eventually inform grouping, but never report that it does now.
- **Real due dates and per-student assignment.** `practice_assignments` has only a free-text due *note* and targets a whole class or all classes. Write the actual due date and any per-student differentiation into the lesson; the field will catch up.

Set `Homework Tool Assignment Created` when a tool goes home. It's read by nothing in the app — it exists for Steele's own tracking against his target of at least two per week.

**When there is no in-class release block, the readiness gate still runs** — it's required evidence and it carries the Fist-to-Five. What changes is what its output does: instead of assigning a same-period route, it becomes a **next-day recommendation** and, where relevant, the homework tier (who gets the shorter round count, who gets a worked reference alongside it). Say which of the two the gate is doing on this lesson, so the routing table isn't written for a release that never happens.

**When there is no in-class release block, the readiness gate still runs** — it's required evidence and it carries the Fist-to-Five. What changes is what its output does: instead of assigning a same-period route, it becomes a **next-day recommendation** and, where relevant, the homework tier (who gets the shorter quota, who gets a worked reference alongside it). Say which of the two the gate is doing on this lesson, so the routing table isn't written for a release that never happens.

### Step 3 — Research the sequence and the tools, then compare against Carnegie

This is a real comparison step, not a gap-filler. Every lesson answers: **is Carnegie's sequence the best available one for this mathematics, and is Carnegie's activity the best available activity?**

Work it in this order, cheapest first:

1. **`src/lib/sbacCheckpoints.ts`** — keyed by lesson, it often already holds the misconception strings and SBAC item shapes you were about to go find.
2. **The three good lessons** — reuse beats re-derivation. Cite which lesson you took it from.
3. **Targeted external research** — how this specific concept is best sequenced and which representation or manipulative does the work. Sources and search patterns in `references/carnegie-and-research.md`. Two to four lookups is usually enough; more than that and you are researching instead of building.
4. **The tool question, explicitly.** The R phase is normally a website tool, so ask which of the site's manipulatives carries this concept, whether it is fully wired (both `TOOL_ROUTES` **and** `LiveToolRoute` + `useLiveToolConfig`), and whether the research points at a representation the site does not have yet. If it does, that is a build request, not an invented route.

**The default is Carnegie.** Carnegie's task design is genuinely good and it is what he teaches. Depart from it only when the research gives him **something he can point to** — a named source, a specific finding, and a one-line statement of what it buys. "A different order feels better" is not a reason; "students who build the area model before the algorithm retain the distributive step, per X" is.

Write the comparison into the body's defense block as three lines: Carnegie's sequence and activity · what the research says · the call, with the citation if you departed. That block is the artifact that makes the adaptation defensible to anyone who asks — including him, six weeks later.

### Step 4 — Show the plan, get approval, then write

**Hard stop.** CLAUDE.md rule 3 requires asking Steele first for curriculum and Notion content specifically, and entering an agreed lesson is **transcription, not authoring** — authoring happens in chat where he can argue with it.

**Creating** — the full spec: state-by-state flow with minutes, every property value, the defense block, the empties list, and any day-split proposal.

**Revising** — a **diff**. Per changed field: before, after, one line of why. Untouched fields by name only. Call out deletions. Steele cannot see what changed in a wall of restated values.

### Step 5 — Write, in this order

`references/notion-write-contract.md` before the first write.

1. **Lesson properties.** New build → `Draft`. Revision → leave the existing workflow value alone unless the revision invalidates the review.
2. **Lesson Steps** — one per state, with `Order`, `Start Minute`, `Duration`, `State ID`, and all five text surfaces filled per the per-step contract. A step with a title and a duration is not a step. Never write raw text over `AI Context` — it carries `[BDM_PUBLIC_SURFACES:…]`, `[BDM_CREATE_TOKEN:…]`, and base64 `[BDM_ROUTINE_CONFIG:…]`.
3. **Page body** — the M1.T1.L2-D2 shape in `references/body-template.md`. On a revision keep existing tab names.

**Body-overwrite hazard.** PDF embeds, videos, inline databases, page mentions, and Slides embeds **cannot** be recreated from markdown. Never wholesale-replace such a body; edit surgically and say which tabs you left alone.

### Step 6 — Verify, then audit for scope bleed

Report the result of each:

- Minutes sum to **50**; `Start Minute` contiguous; `exit` at 46, `closeout` at 49.
- **`abstract` carries a numbered step-by-step** wherever the mathematics allows, derived on the board rather than delivered, with the same numbering on every surface.
- **Where the required work lands is stated** — in-class, paper homework, tool homework with a quota and a receipt, or explicitly none. Not left blank and ambiguous.
- CRA progression present and named; the fade and number design stated.
- `Selected Success Criterion` is one line matching `^I can`.
- **A Fist-to-Five exists**, with `Response Mode: Fist to Five`, choices 0–5, sitting before the objective gate items. Every lesson, no exceptions.
- Every tool name resolves in `TOOL_ROUTES`; every select value legal.
- `exit` carries an explicit `Response Mode` (it has no fallback).
- Misconception tags are canonical labels, or flagged as needing a `misconceptions` row.
- **Scope audit.** Sweep every step text field against the page's "Not today" list, **case-sensitively** (base64 blobs false-positive on case-insensitive matching). In July 2026 an agreed L2-D1 build was transcribed with Day-2 material in four steps' teacher notes, vocabulary, stems, and routine config — the miss hid in exactly the fields nobody re-reads.
- No teacher-only content on a student surface.
- No emojis, anywhere.
- Re-fetch and confirm what landed. Notion writes can partially succeed.
- **Publish readiness**, reported as its own line: `Publish Workflow`, single `Date`, `Retention Q4`/`Q5`, warm-up and exit-ticket artifacts. The best-designed lesson in the database currently cannot be served because these are blank.

---

## What stays empty

Every field whose value can be *derived* gets one. Not every field gets a string.

- **Artifacts that don't exist yet** — `Warm Up Link`, `Exit Ticket Link`, `Exit Ticket Edit Link`, `Exit Ticket Response Sheet`, `Explainer Video`. A fabricated Google Form URL is a dead link during class. Write the *content* so the form takes a minute to build; leave the URL blank.
- **File properties** — `Assignment Link`, `Assignments`, `Explainer Videos`. Need uploads.
- **`Create Warm-up`** — a button. Never in a write payload.
- **`SBAC Target`** unless you've read the actual Smarter Balanced label.
- **`AI Context` on new records** — leave unset, let defaults apply.
- **Anything Steele hasn't decided** — a manipulative with no route is a build request, not an invented route name.

Report empties as a list: field, why, what would fill it. That list is his pre-class checklist.

**Report `[needs wiring: ...]` items as a second, separate list.** These are different from empties — the lesson design is complete, the code isn't there yet. Keep them out of the pre-class checklist (he can't action them before first period) and present them as a build list instead. A lesson that names three specific missing pieces is more useful to him than one that quietly designed around them.

---

## Voice

Student-facing copy is second person, warm, direct, dry. Never corny, never worksheet voice.

**On a screen, be as brief as the surface allows.** The state marker already tells students what to do — `universalStateTitle()` renders I Do / We Do / You Do / Discussion on the projector every step, identical lesson to lesson, which is why they learn to read it. So `Main Display` carries **only the mathematics**: put the problem up, not `WATCH: the problem`. Every word on a projector is read at 25 feet by thirty people, and a label that restates the state costs reading time and buys nothing. `Pace Directions` and `Student Directions` are the directions surfaces and may be imperative, but a sequence beats a sentence — `Trackpads parked → Predict → Build → Freeze → Explain`. Full rule and the two header exceptions in `references/state-catalog.md`.

The culture is load-bearing. Confusion is step one, that's how you know you're engaged; step two is *what do you know*; step three is *try something*. Attempts get rewarded, not just right answers. The poster vocabulary is the working vocabulary — learning must leave evidence, make thinking visible, try one move, check the evidence, revise and try again, use a resource, ask for help, help a thinker — and a student who has read those on the wall for six weeks knows what "try one move" asks of them.

Five beliefs: We Think. We Try. We Don't Give Up. We Help Each Other. We Celebrate Effort.

Abbie is Steele's grown dog and the mascot: deadpan, calls him "dad," roasts *him* — never a student, never a student's ability. One sentence, no emoji, no stage directions.

**Privacy is absolute.** No student sees their own score, tier, confidence category, misconception label, or a group name that reveals ability. Public projectors never show names or rosters. Public route names rotate their meaning daily so a name can never become a label. Support changes the path, not the required work — every route completes the identical product.

---

## References

- `references/lesson-quality-bar.md` — what the three good lessons contain: the per-step contract, timing invariants, the fade, and the named commitments. **Read before authoring.**
- `references/structures.md` — choosing CRA vs error analysis vs gallery walk; the error-analysis protocol, gallery-walk configs, discussion protocol, and hook design, with verbatim prompts.
- `references/notion-write-contract.md` — IDs, property names, legal select values, the 13 canonical misconception tags, the Lesson Steps query and write contract, tool routes, traps.
- `references/state-catalog.md` — state vocabulary, CRA mapping, what the good lessons do, four surfaces, routine configs, readiness gates.
- `references/body-template.md` — the M1.T1.L2-D2 body shape, Notion tab/color syntax, escaping.
- `references/carnegie-and-research.md` — reaching and reading a TIG, what to do when you can't, Carnegie's phase model, writing the defense, where to research.
