# Big Dog Math - Structural Audit

**Date:** 2026-08-04. Companion to `AUDIT-2026-08-04.md`, which found defects. This one looks for drift, duplication, silent assumptions, and the shape of what the system cannot do.

**Evidence base:** all 6 published lessons pulled through `/api/teacher/rehearse?id=` (76 steps total), live Supabase row counts, `git log` dating of every major surface, and four read-only source sweeps. **[observed]** = measured. **[source]** = read in code.

---

## The one-line version

Nothing here is broken in the way the first audit meant. What is happening is that **every capability built in the last month exists in exactly one lesson, one surface, or one file** - and the system has no mechanism that notices. The state strip is authored on 12 of 76 published steps. Discussion phases on 2 of 76. The AA-safe colour derivation exists on 1 of ~20 surfaces. The failure-notice pattern on 1 of ~15 polling loops. The fixed-stage legibility fix on 1 of 5 room-facing surfaces. The system is not accumulating; it is producing prototypes that each stop at their first use site.

---

## 1. Same idea expressed two ways across lessons

I pulled the built sequence for all six published lessons. They do not agree about anything structural.

**The State ID field is being used in four incompatible ways** **[observed]**:

| Lesson | State ID style | Example |
|---|---|---|
| M1.T1.L5-D1 | canonical catalog | `warmup, review, launch, learning-target-readers, concrete, representational, abstract, abstract, discussion, question, question, learning-target-readers, small-group, exit, closeout` |
| M1.T1.L2-D1 | canonical, different subset | `warmup, launch, concrete, representational, abstract, tool-divisibility, tool-divisibility, learning-check, question, question, independent, closeout` |
| C.C.3 | canonical + one invention | `warmup, review, discussion, discussion, question, **target**, review, review, discussion, exit, closeout` |
| C.C.4 | invented semantic ids | `culture-hook, bathroom-time, phone-focus, chromebook-pickup, device-check, absence-recovery, break, target-reveal, grades-missing, retake-success-check, culture-closeout` |
| C.C.2 | fully-qualified step codes | `M1.T1.C2.S01-evidence-warmup ... M1.T1.C2.S12-closeout` |
| C.C.1 | fully-qualified step codes | `M1.T1.C1.S01-entry-seat-card ... M1.T1.C1.S16-closeout` |

**38 of 76 published steps carry a State ID that is not in the catalog.** Unknown ids get a synthesized bank entry, and I measured what that costs:

| Lesson | distinct accent colours | distinct semantics |
|---|---|---|
| M1.T1.L2-D1 (canonical) | **10** | 8 |
| C.C.4 (invented) | **2** | 2 (`scenario`, `closeout`) |
| C.C.2 (step codes) | **1** | 6 |

**Culture Day 2 runs 50 minutes in a single accent colour.** Culture Day 4 runs 11 steps with 2. The per-state colour system that students are supposed to learn to read collapses to monochrome for two thirds of the published catalogue - and `inferClassroomStage` maps nearly every C.C.4 step to `scenario`, so those steps also share one layout.

**The two CRA lessons disagree about the authoring conventions themselves** **[observed]**:

| | M1.T1.L2-D1 | M1.T1.L5-D1 |
|---|---|---|
| Pace Directions | timecoded script, 11 of 12 steps: `0:00-3:00 Boards up...` | untimed imperatives, 0 of 15: `Build the total. Place one-fourth groups.` |
| Main Display | poster: `24` / `How many different ways...` | instruction: `Build 3/4. How many one-fourth-sized groups fit?` |
| LI stem | "**I am learning how** to find every factor pair" | "**We are learning to** find how many unit-fraction groups fit" |
| State strip | 4/4 on 12/12 steps | 0/4 on 15/15 |
| Discussion phases | 2 steps | 0 steps |
| Where the LI lives | folded into a `learning-check` ("9. Where Are We") | its own `learning-target-readers` step, twice |
| Exit evidence | paper half sheet, `independent` | typed `short-answer`, `exit` |
| Closeout copy | specific: "Cubes counted back to 24. Boards and markers in the tray." | generic: "Put away your supplies, clean your area, and reset the room." |

The LI stem divergence is the tell that this is known and unaddressed: `learningIntentionStatement` exists precisely because Notion is authored in every voice, and it was built for `/weekly-display` **only**. The restemmer solves the symptom on one TV instead of the drift at the authoring layer.

**And inside a single step, one idea gets two words.** L2-D1 step 5: Main Display says *"Which two **combine** to 24?"*; Student Action says *"Reorder your list, then **arch** the pairs."* The operation is multiplication, the class routine is called arching, and the projector says "combine." Three words for one move, on two surfaces of the same step.

---

## 2. Built once, never propagated

Quantified against the whole published catalogue (76 steps) and the whole codebase.

| Capability | Fully built? | Adopted in | Coverage |
|---|---|---|---|
| Classroom state strip (4 slots, contract, Notion properties, renders on both projectors) | yes | **1 lesson** | **12 / 76 steps** |
| Discussion phases (`think 30 \| ...`, 18-check contract, wired through present + pace + live-flow) | yes | **1 lesson** | **2 / 76 steps** |
| Timecoded Pace Directions | convention only | **1 lesson** | 11 / 76 steps |
| `structured-numeric` response mode (whole `pairs()` scorer, separates invented from missing) | yes | **1 step** | 1 / 76 |
| Discussion stems | yes | 3 lessons | 6 / 76 steps |
| AA-safe accent derivation (all 3 tiers via `color-mix`) | yes | **`/control` only** | **1 of 11** accent surfaces |
| Failure-counter + `aria-live` notice after 15s | yes | **`ClassSync` only** | **1 of 45** poll loops (2%) |
| The 88px legibility floor / reading-distance arithmetic | yes | **`/weekly-display` only** | 1 of 19 room surfaces |
| Tactile drag engine (`data-drop`, ghost, tap fallback) | yes | 2 boards, by **copy-paste, not import** | **2 of 29** manipulatives |
| `propByName` (the fix for silently-failing Notion property reads) | yes | **1 read site** | **1 of 157** (0.6%) |
| `reportToolResult` evidence emission | yes | 7 tools | **7 of 23** |
| Homework-help animation | yes | 1 lesson's help path | 1 of 6 |
| `LessonScreen` overlay on the wall | partly | plain info states only; the saved layout blob is still not threaded through | - |
| `slide` frame | yes | cannot render in studio or demo previews (`studioPreviewFlow` never carries `slideUrl`) | - |

**One correction to my own first draft.** I wrote that the fixed 1920x1080 stage was `/weekly-display`-only. That is wrong: the *stage* propagated widely - 9 of 19 room/preview surfaces use it (`LessonSlideStage`, `/teacher/studio`, `/direction-preview`, `/demo`, `/teacher/rehearse`, `/session` previews, `RatioExplainer`). What did **not** propagate is the reasoning: there are **4 independent declarations of `1920`/`1080`** under 3 different spellings, `/teacher/studio/edit` silently uses 1280x720 instead, `/demo` renders `/weekly-display` at 1280x720 though it is authored at 1920x1080, and the 88px reading-distance floor exists nowhere but the original. The mechanism travelled; the judgement did not. And `/teacher/present` and `/teacher/pace` are **hybrids** - fluid `clamp()` chrome (83 and 34 declarations) with a fixed-stage overlay conditionally on top - which is precisely why the two `showLessonSlide` clause lists matter so much.

Three consequences of non-propagation that are visible on screen today:

- **`/live-flow` uses the raw bright state accent as text and as a fill under white text** - `.lf-poll-send { background: var(--lf-accent); color: #fff }`, plus `.lf-share span`, `.lf-support-title`, `.lf-beat-mode`, `.lf-independent-label`. That is the student surface, running the exact failure mode `/control`'s three tiers were written to prevent.
- **The 62% mix constant is copy-pasted into three files** (`present:761`, `pace:416`, `ClassroomSpinner:480`) and `/teacher/page.tsx:444` uses a fourth, unrelated ratio (55% black). Present and pace then use the 62% `-deep` tier as *small-caps text*, which is the tier the canonical explicitly says needs 42%.
- **`SpeakerSpinner`, `TableCaptainSpinner` and `SupplyCheckBoard` consume `--acc-deep` with a hardcoded `#3c7d7e` fallback.** They render inside `/live-flow`, which never sets `--acc` - so on the student device the fallback teal wins over the real state colour, silently, every time.

The pattern is not laziness. Each of these was built to a high standard - the strip has an all-or-nothing rule and a contract, the phase format has 18 tests, `/control`'s colour tiers are the best accessibility work in the repo. **They were built to be general and then used once.** The thing missing is a propagation step: nothing lists which lessons lack a strip, nothing fails when a new surface renders a raw accent colour, nothing reports that 16 tools emit no evidence.

**And the Notion read layer is the sharpest case, because the fix is documented and unused.** `propByName` exists because an exact-string property lookup *fails silently* - the site reads `""` and the screen renders as though nothing was authored. It is used at **1 of 157** property reads. The other 150 are bare exact-string access. Worse, `notionLessonStepWrites.ts` is **entirely** exact-string on the write path too, so a renamed Notion property does not just read nothing - it silently **writes to nothing**.

---

## 3. Load-bearing only because you are in the room

This is the sharpest lens, and the clearest single instance is your own culture day.

**C.C.1 is titled "Culture Day 1: Confusion Is Step One." The word "confusion" appears on none of its 15 main displays.** **[observed]** The nearest is C1.03: *"If you are nervous, that is normal"* - nervousness, not confusion - and C1.11's target is about *"uncertainty, evidence, and responsible next steps."* The three-beat framing - confused is step one, then what do you know, then try something - is the thesis of the class, it is carefully protected in the docs as yours and not Carnegie's, and **it exists on no screen a student will ever see.** It lives in your mouth. On the day a kid decides what this room is, the framing arrives as teacher talk, and any student who is absent, or looking down, or still reading the seat card, does not get it.

The inverse also happens, in the same lesson. C1.13's **Main Display** contains `Teacher: "Stop. We protect peo...` - your script, printed on the room-facing projector. So the surface contract is inverted in both directions within one lesson: the idea that should be on the wall is in your voice, and the words that should be in your voice are on the wall.

Other sentences the screen is currently outsourcing to you:

- **"Hands off until I say."** (L2-D1 step 6, Student Action) - there is no screen state that ever says *now go*. The release is a spoken cue with no visual counterpart; a student who missed it sits with hands off for five minutes.
- **"Ways to multiply | Rectangles | What do you notice?"** (step 4 Main Display) - **both columns are empty on the projector.** The two lists being compared exist only on your physical board. The main screen shows two headings and a question about content it does not contain.
- **"Is there a limit?"** - the hook, up for the first 10 minutes, never answered on any screen at any later step. The payoff is spoken.
- **"Do what you can. Hand it in on your way out."** - the half sheet. The screen cannot collect it, cannot see it, and the mastery engine never learns it existed.
- **The step numbering.** Students read "Step 5 of 12, Next: **7**." You are the one who explains that 6 is not missing.
- **"I DO" over a partner build.** You are the one who says "actually, build it with your partner" while the projector says the opposite.

There is also a timing contradiction inside one step **[observed]**: L2-D1 step 2's Pace Directions script runs `0:00-3:00`, `3:00-5:00`, `5:00-6:00` - **six minutes** - while the step's duration is 5:00 and its discussion phases sum to exactly 300s. The authored script and the authored clock disagree by a minute, and the only thing reconciling them is you.

---

## 4. What a student can never do, on any surface

Established from the surfaces I drove plus a full sweep of every student-reachable route. Two claims below were checked against the **live database schema** rather than inferred from migration files.

| | Possible? |
|---|---|
| See what to do right now | **yes** - and this is the product's best feature. One beat, one direction, one clock. |
| Ask the teacher a question in free text | **no.** The Abbie feature was deleted 2026-07-30; the legacy `JoinQuestion` / `/api/session/responses` path survives but is not linked from the live flow. |
| See their own score, mastery, progress, or history | **no.** By deliberate design - and it means a student has no way to know they are improving. |
| Get feedback on a wrong answer beyond right/wrong | **no** |
| Retry an item after getting it wrong | **no** |
| Revisit a previous lesson step | **no.** The student surface renders the teacher's current step only. |
| Move ahead or self-pace | **no**, except within a tool ("8. Your Own Reps - your own pace" is authored as a *tool* step precisely because the flow cannot express it) |
| Signal "I am finished" or "I need more time" | **no.** The three chips are "I'm stuck", "Say that again", "I've got this" - none of which is a pacing signal. |
| Submit work that is not typed | **no.** No photo, no drawing, no ink upload. The half sheet and every whiteboard is invisible to the system. |
| See what is due / a list of assignments | **not from `/live-flow`**; `/explore` and a pasted `/assignment/<id>` link only |
| Save and resume partly-finished work | **partly** - `/exit-ticket` backs drafts to `localStorage`; nothing else does |
| Choose a tool during a live lesson | **no** - class mode holds them |

Four of these are harder than "not built," and worth stating exactly:

- **Free text to the teacher is doubly dead.** The only path is `JoinQuestion`'s anonymous-question sheet, which renders only when a *question session* exists. Question sessions are created solely by `/start-question`, and `grep -rn "start-question" src/` returns **only `proxy.ts:11` and `:119`** - auth config, not links. So nothing can create one. And in secure mode `/api/session/*` is teacher-gated, so a student POST returns 401 anyway. Both ends are severed.
- **`/checkpoint` tells the student nothing at all.** On the secure path it hard-codes `setResult({ correct: true, answer: "" })` and renders "Turned in!" - the student is not told whether they were right, and the misconception match is legacy-path-only.
- **Retry is refused everywhere, and it persists.** `live-flow` blocks any submit whose poll id is in `submittedPollIds`, and that list is written to `localStorage`, so a reload does not reopen the item. `/challenge` auto-advances to a *new* problem after 650ms. Nothing anywhere re-serves a missed item.
- **Non-typed submission does not exist as a capability.** `grep -rn 'type="file"|capture=|getUserMedia|toDataURL|toBlob' src/` returns **only teacher surfaces** - `/ipad`, `/teacher/bruh`, `/teacher/checkpoint-upload`, `/teacher/audio`, `/control`, `InkBoard`, `WhiteboardCanvas`. `/whiteboard` has no save or submit at all. Every student write path takes strings and numbers.

**Correction to a claim I nearly repeated:** the sweep reported that `student_signals` had never been migrated (reading the "NOT YET RUN" header in `supabase/student-signals.sql`), which would mean the chips never render. **That header is stale.** I queried the live schema: `student_signals` exists, with `signal`, `step_index`, `muted`, `updated_at`. The chips render. CLAUDE.md's record of Steele running it on 2026-07-26 is correct and the file comment is not.

The through-line: **a student can receive and answer, and nothing else.** They cannot ask, revisit, retry, pace, or show non-typed work. For a system whose culture day is about confusion being step one, there is no affordance anywhere for expressing confusion in the student's own words, and no affordance for an attempt that is not yet an answer. The nearest thing - "I'm stuck" - is a chip, not a sentence, and it is deliberately click-only so it cannot be spammed. That is a defensible design decision that has the side effect of making the class's founding idea unexpressible by the people it is about.

---

## 5. What the teacher can never see

The most consequential one I proved by accident in the first audit: **you cannot see what your own projectors are showing.** There is no readback from any display. When `/teacher/present` sat on "Ready for class" while I advanced states, nothing on Control, the Remote or `/session` indicated it. Combine that with the deploy gap - where a projector can be running code from four days ago - and the teacher's mental model of the room is unverifiable from any teacher surface.

Also never visible:

- **Which specific devices are following.** `session_joins` records that a device joined; there is no per-device heartbeat, so a Chromebook that silently stopped following is indistinguishable from one that is fine.
- **What a student typed but did not submit.**
- **Which tool-evidence writes failed** - `toolEvidence.ts:280` swallows them with no counter.
- **Any paper or whiteboard work**, which in L2-D1 is four of the twelve steps.
- **Live misconception clusters, on Control.** They exist on `/teacher/rightnow` and the Remote. The documented decision was that this view belongs *inside* Control because Control must stay foregrounded. It was never built - so the one screen you are required to keep in front of you is the one screen that cannot tell you who is struggling.

**The mirror is worse than no mirror.** The Remote's "Public screen mirrors" are `LiveScreenPreview` iframes that load `/teacher/present` and `/teacher/pace` **fresh, in the Remote's own browser**, and poll independently. They show what the projector *should* be rendering, not what any physical panel *is* rendering. A projector on a dead tab, a stale cached build, or a disconnected HDMI cable looks identical to a healthy one - and the mirror actively reassures you it is fine. Given the deploy gap, this is the mechanism most likely to tell you a comfortable falsehood.

**"Joined: N of M" is a permanent record, not a liveness signal - now confirmed.** I left this untested in the first audit rather than guess. The answer is in the schema: `session_joins` carries `id, session_id, student_id, display_name, joined_at, auth_user_id, request_code` and **nothing else** - I queried the live database directly. `grep -rn "last_seen|heartbeat|presence" supabase/*.sql` returns zero, and the realtime rooms never call `.track()`. So there is no per-device health signal anywhere in the system: a Chromebook whose lid closed at minute 5 still reads as joined at minute 50. ClassSync *detects* its own disconnection and tells the **student** after 15 seconds - that state is never reported upward. Do not use this number as attendance.

**Written, stored, and rendered nowhere.** A short list of data students produce that no teacher surface displays:

| Data | Written by | Read by | Rendered by |
|---|---|---|---|
| `poll_answers.explanation` (the written justification in Multiple Choice + Explain) | every MC+Explain answer | `/api/teacher/poll:36` selects it | **nothing** - `grep -rn "explanation" src/app/teacher src/app/control src/app/session` finds only unrelated BRUH/Grudge vocabulary text |
| `poll_answers.values` (which structured-numeric box was wrong) | the boxes and pairs builders | `/api/teacher/poll`, `readinessEvidence` | only as an aggregated phrase group in `/control`; never per student |
| `ToolAttemptDetail.distinctSplits` / `partials` / `missesBeforeCorrect` | the 7 emitting tools | posted to the API | **nothing** - its own docblock calls `distinctSplits` "the field nothing else in the system can see" |
| `student_signals.step_index` history | every chip tap | both readers filter to the **current step only** | a student who tapped "stuck" on steps 2, 4 and 7 leaves no visible trail |
| `visit_check_ins.promoted` | a Got-it tap | - | nothing reads it back |

The `explanation` case is the sharpest instance of the section-2 pattern. A whole response mode was built so students would justify their choice; the justification is captured, carried to the API, and shown to no one. The student does the reflective work and the teacher never sees it.

**And nine routes exist that nothing links to** (proven by grep): `/start-question`, `/teacher/growth`, `/teacher/board`, `/teacher/ipad`, `/warmup`, `/case-study`, `/systems`, `/direction-preview`, `/number-line`. Plus `/today` and `/lessons`, which have no inbound link from any *student* entry point - they link only to each other.

---

## 6. What the evidence layer structurally misses

This is where the audit turns from architecture to consequence, and the live numbers are worse than the structure predicts.

**Live database, 2026-08-04** **[observed]**:

| Table | Rows |
|---|---|
| `responses` | **216 - every single one `source='warmup'`** |
| `responses` with a `standard_id` | **0 of 216** |
| `poll_answers` | 0 |
| `practice_assignment_attempts` | 0 |
| `checkpoint_results` | 0 |
| `exit_ticket_responses` | 0 |
| **`mastery`** | **0** |
| `iready_scores` | 36 |
| `students` / with `auth_user_id` | 167 / **0** |

**The mastery table is empty. Not sparse - empty.** The proficiency spine has never produced a row. And the only evidence that exists carries no standard, so the per-standard stage gate has never had an input either.

Now the structural half. Take M1.T1.L2-D1, 48 authored minutes, and ask which minutes can reach `responses` - the only table `recompute` reads besides i-Ready and checkpoints:

| Step | Min | Reaches mastery? |
|---|---|---|
| 1. Warm-Up | 5 | **yes** - Google Form -> Apps Script -> `/api/evidence` |
| 2-5. Launch, build, compare, organize | 17 | no - whiteboard, tiles, partner talk |
| 6-7. Divisibility tool | 9 | no - **`/divisibility` is not one of the 7 emitters** |
| 8. Fist-to-Five | 2 | no - `poll_answers` never reaches `responses` |
| 9. Readiness 1 (`pairs(18)`) | 2 | no - same |
| 10. Readiness 2 | 3 | no - same |
| 11. Half sheet | 5 | no - paper |
| 12. Closeout | 5 | n/a |

**5 of 48 minutes produce mastery evidence, and they are the warm-up - the one part of the day that is not this lesson.** The warm-up is spiral review of *previous* days. So mastery for this lesson is computed entirely from questions about other lessons. The day's own designed assessment - two readiness items and a structured factor-pair build - contributes nothing.

**The bias is not just "typed vs not typed." It is strand-shaped** **[source]**. The 7 emitting tools are balance-beam, equation-builder, order-of-operations, combine-like-terms, algebra-adjacent area-model, distributive-area, and area-explorer. Against the teacher home's own categories:

| Category | Tools | Emitters |
|---|---|---|
| Expressions & Equations | 6 | **4** |
| Geometry | 2 | 1 |
| Number & Operations | 11 | **2** |
| Ratios & Proportions | 5 | **0** |

**No tool in Ratios and Proportions emits anything.** Sixth grade math is dominated by ratio, fraction and decimal reasoning; that is the strand with zero instrumentation. If the bars ever do fill, they will be measuring the strand that happens to have the most instrumented tools, not the strand you spend the most time teaching - and the shape of that distortion is invisible from the mastery screen, which will just show four bars.

So: the honest statement is that this is not yet a data-collection system. It is a very good classroom-orchestration system with a data-collection system drawn on it. Three separate paths (`poll_answers`, `practice_assignment_attempts`, 16 of 23 tools) all dead-end, and `formative.sql`'s own header comment asserts the opposite.

---

## 7. Redundancy, since that is where drift starts

| Concept | Implementations | Bound by a contract? |
|---|---|---|
| **State vocabulary** | 4 (catalog ids / invented semantic ids / per-lesson step codes / `target` vs `learning-target-readers`) | no |
| **Phase vocabulary** | **3**, all selectable from the same bank: CRA (`concrete`/`representational`/`abstract`), gradual release (`i-do`/`we-do`/`you-do`), and `independent` as a third name for the same thing. `STATE_TYPE_OPTIONS` offers both "Direct Instruction (I Do)" and "Concrete (I Do)". `universalStateTitle()` collapses them to the same words - but `lessonScreenModel.ts` **has no `you-do` entry at all**, so a `you-do` step falls through to "Independent Practice" in warm orange while a `concrete` step reads "Build it" | **no - already divergent** |
| **"Build the sequence from a lesson"** | **9**: `stepsFromLesson`, Control's Notion importer, `flowSnapshotForStep`, Control's publish snapshot, `navigateFlow`, `rehearsalFlow`, `studioPreviewFlow`, the Remote's `optimisticNavigation`, and `demoLesson`'s literals | **1 of 9 bound.** No contract references `stepsFromLesson`, `rehearsalSnapshot`, `buildStudioPreviewSnapshot`, `navigateFlow` or `optimisticNavigation` |
| **The "board" presentation rule** | 4 copies of `stateId === "i-do" \|\| "manip" \|\| "we-do"` | **no - 3 are stale.** Control was fixed and left a comment saying why; the other three still key on state id |
| **`showLessonSlide` gate** | 2 clause lists in 2 files, bound only by a comment saying "keep the two lists together" | no - and they are **non-identical today** |
| **`RESPONSE_MODES` picker** | 2: `notionLessonStepWrites.ts` has 10 entries; `/teacher/studio/edit` has 9 | **no - already drifted.** The missing one is **"Multiple Choice + Explain"** |
| **`POLL_KINDS`** | 2: `liveFlowContract.ts` has 5 (canonical, typed); `notionLessonStepWrites.ts` has 4 | **no - already drifted**, missing `multiple-choice-explain` and `structured-numeric` |
| **Assigned-tool route resolution** | 2: `liveAssignedToolRoute` and a private `assignedToolRoute()` inside `ClassSync` | no |
| **Notion API version string** | 5 files each hardcode `"2025-09-03"` | no - a partial bump strands 4 files on a dead version |
| **Classroom time zone** | 9 sites, 2 constant names, 4 raw inline literals | no |
| **`POLL_MS`** | 12 declarations, 6 distinct values, one name | no |
| **Design tokens** | 3 encodings of the same palette: `--bdb-*`, the `C_TEAL`-style JS literals (23 across components), and the full parallel ramp in `classroom-frames.css` | **the third is DEAD** - zero importers, zero `.dcw` consumers. It cannot drift because nothing reads it; it is a generated artifact encoding the colours a third time |
| **Google Fonts request** | 2 `@import`s for overlapping families | no |
| **Cream** | **5** in active use (`#faf6ee` token, `#fbf7ef` legacy, `#F6F3EC` x24, `#F3F0E7` x16, `#f6f1e6`) - `#F6F3EC` is spreading through the *newest* surfaces | no |
| **Token colours as literals** | 405 hex literals duplicating a token; `const C_TEAL = "#50a3a4"` declared independently in 6 components | no |
| **The word "slide"** | 2 meanings, deliberately separated once (`State Type` renamed off it) - `slide` the frame vs `Slide Url` the file property | partial |

The nine sequence-builders are the one I would watch. They exist for good reasons (server-side start, rehearsal without a session, studio preview, optimistic client navigation), and the consequences are already visible: `studioPreviewFlow` never learned about `slideUrl`, so the preview surfaces silently cannot show a slide frame; Control's Notion importer has grown a `remoteActions: step.remoteActions || step.teacherNotes` fallback with no counterpart in `lessonFlowBuild`; and three copies of the board-mode rule never received the fix the fourth got.

**The two already-drifted authoring vocabularies converge on one lesson feature, and the coincidence is worth sitting with.** `/teacher/studio/edit`'s `RESPONSE_MODES` list is missing exactly one entry - **Multiple Choice + Explain** - so that mode cannot be authored from the Studio. And per section 5, the `explanation` it produces is rendered by no teacher surface. So the one response mode built to make students justify their reasoning is both hard to author and impossible to read. Neither half is a bug anyone would notice from inside their own half.

**The contract suite is excellent and aimed at the wrong layer.** There are 47 scripts in `scripts/`, and `control-lineup-contract.mjs` is a model of the form. But coverage tracks **libraries**, not **duplications**: every concept above that lives in a page component rather than `src/lib/` is unbound. Of 15 duplicated concepts, 1 has a binding contract and 4 have already drifted in ways visible in the source right now.

---

## 8. Oldest-built vs newest-built, and the delta

The whole system is **seven weeks old** (first commit 2026-06-12). "Legacy" here means six weeks. **[observed, `git log`]**

| Surface | Born | Last touched | Commits | Lines |
|---|---|---|---|---|
| `/control` | 06-12 | 08-03 | **89** | 4,243 |
| `/session` | 06-13 | 08-02 | 31 | 1,091 |
| `/roster` | 06-13 | 07-31 | 6 | 270 |
| `/lesson` | 06-13 | 08-03 | 29 | 520 |
| `/live-flow` | 06-19 | 08-01 | 45 | 1,477 |
| `/ipad` | 06-29 | 08-03 | 24 | 485 |
| `/builder` | 06-30 | 07-27 | **2** | 364 |
| `/teacher/mastery` | 07-02 | **07-12** | 7 | 306 |
| `/teacher-login` | 07-04 | **07-17** | 2 | 82 |
| `/teacher/rightnow` | 07-04 | 07-22 | 9 | 246 |
| `/teacher/present` | 07-12 | 08-03 | **70** | 1,508 |
| `/teacher/pace` | 07-14 | 08-03 | 34 | 779 |
| `/weekly-display` | 07-15 | **07-29** | 5 | 1,267 |
| `/teacher/studio` | 07-15 | 08-03 | 17 | 726 |
| `/demo` | 07-27 | **07-27** | **1** | 303 |
| `LessonScreen` | 07-31 | 08-03 | 6 | 721 |
| `/teacher/rehearse` | **08-03** | 08-03 | 3 | 476 |

**The delta, and it runs the wrong way.** The best-designed room surface is `/weekly-display` - fixed 1920x1080 stage, computed 88px legibility floor, a documented derivation of reading distance from screen size. It has **5 commits and has not been touched since 2026-07-29**. Meanwhile `/teacher/present`, with **70 commits and 14 touches since**, is still fluid and lands at 27.9px. The surface that got the thinking is the one that stopped being edited; the surface being edited constantly never received the thinking.

Same shape on colour: `/control` (89 commits) has the only AA-safe `color-mix` derivation in the repo, and none of the 44 white-on-bright violations sit in it. The thinking is local to wherever it happened.

Two other things the dating shows:

- **`/demo` has exactly one commit, ever.** It is simultaneously the portfolio front door and - per the docs - the projector test harness. A load-bearing surface with zero maintenance since the day it landed.
- **The "legacy 7" Georgia pages are not old, they are abandoned.** `/teacher/mastery` was last touched 2026-07-12 and `/teacher-login` on 07-17, both roughly three weeks ago in a seven-week project. They did not age out; work simply moved and never came back. `/teacher/mastery` is the surface that would display the mastery bars - the system's stated purpose - and it has 7 commits and an empty table behind it.

---

## 9. The assumption that was true when built and stopped getting examined

Six, ordered by what they currently cost.

1. **"A push to `main` deploys."** True from June until 2026-08-03. It is the premise of `DeployRefresh` (which reloads projectors when the build id changes) and of `UpdateReadyChip` on the iPad. Both mechanisms are now inert, and they are the mechanisms that would have told you. The assumption did not just become false - it took the alarm with it.
2. **`PERIOD_MIN = 55`** (`control/page.tsx:247`). Correct when written. The period became 50. Nothing examines a constant, so Control still invites you to build a 55-minute lineup, and the file header comment still says "a 55-minute period." The cleanest possible example: a number that was right, quietly became wrong, and has no test.
3. **"State ID comes from the catalog."** True for the first lessons. Four vocabularies later, 38 of 76 published steps run on synthesized states, and two whole lessons render monochrome. Nothing warns; the load message names unknown ids, but the lesson runs.
4. **"The projector is a browser window, so fluid layout is fine."** True when `/teacher/present` was previewed on a laptop. It became a 55-inch panel at 25 feet. `/weekly-display` examined this assumption and rejected it; present never did.
5. **"Tool names are prefixes of route keys."** `liveAssignedToolRoute` matches by longest prefix, which works for `distributiveareamethod` -> `distributivearea`. It fails for `boxmethod` and `proportionbuilder`, which are not prefixes of anything. The naming convention drifted away from the matcher and the matcher returns `null` silently.
6. **"`/api/warmup` is a POC, so it can expose the answer key."** Its own comment at `route.ts:19-20` says to gate it before wiring it to production forms. It was never gated on its own terms - it is protected today only because a blanket env flag happens to cover it. I verified the flag is on and the endpoint 401s, so this is safe *now*; it is safe for a reason nobody chose.

The pattern behind all six: **this codebase records its assumptions unusually well and re-reads them unusually rarely.** CLAUDE.md is an extraordinary artifact - it caught its own stale "three data source ids" line and its own "not wired yet" line that had become false. But the corrections happen when someone trips over them. There is no periodic pass, and the things above are exactly the class of fact that nobody trips over until a class period is already going wrong.

---

## What I would do about it

Not fixes - the first audit has those. Three habits, in order of leverage:

1. **Make propagation a step, not an intention.** One script that prints, per published lesson: strip coverage, phase coverage, unknown state ids, emitting-vs-non-emitting tool steps, and pace-script-vs-duration mismatches. Run it before publishing. Every finding in sections 1 and 2 is mechanically detectable and none of it is currently detected.
2. **Make one thing carry the thesis on a screen.** The confusion framing is the intellectual core of this class and it is currently spoken-only. It does not need a feature - it needs to exist on a surface a student sees on day one and can look back at.
3. **Decide whether the evidence layer is real.** Right now three write paths dead-end and the mastery table is empty. Either bridge `poll_answers` into `responses` with a standard and a misconception tag - which makes the exit ticket and the readiness checks count, and is the single highest-value engineering change in the system - or stop describing the bars as the point until it exists. The current state, where `formative.sql` says the data feeds mastery and it does not, is the worst of the three.
