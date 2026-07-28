# State catalog — the class-state system

The state system is the runtime. A `State ID` on a Lesson Steps record tells the control panel what to show on four surfaces, what response to collect, how long to run, and whether to advance itself. The state words are also what students learn to read on the projector, so they are **identical lesson to lesson** — that consistency is the point, and it's why you pick from this vocabulary rather than inventing labels.

## CRA maps onto gradual release

This is the core mapping. The projector shows the gradual-release words; the state IDs carry the CRA semantics.

| State ID | Projector title students see | CRA | What actually happens in the room |
|---|---|---|---|
| `concrete` | **I Do** | Concrete | **Structured exploration with explicit instructions**, in pairs or table groups by default. Individual only when the mathematics needs it. |
| `representational` | **We Do** | Representational | **Normally a website tool.** Teacher demonstrates one problem on it, then students run a stated number of reps. |
| `abstract` | **You Do** | Abstract | **The assignment appears.** Teacher works one; the class works one together. |
| `independent` | **You Do** | Abstract, applied | Student works alone on their route |

**The projector word and the participation structure are two different things.** `universalStateTitle()` is code — it renders I Do / We Do / You Do from the state ID, unconditionally, and students read those words as a routine anchor. But the actual gradual release Steele runs sits *inside* each phase: R contains a teacher demo then student reps, A contains a teacher-worked problem then a shared one. Do not redesign a phase to make it match its screen word.

Legacy `i-do` / `we-do` / `you-do` states exist and still map to the same titles. Prefer the CRA names — they carry the pedagogy and the accent colors.

Why the order is locked: the representation is what the notation *names*. A student who has built 24 as a 4×6 rectangle and then drawn it has something to return to when `24 = 4 × 6` stops making sense. A student who only ever saw the equation has nothing underneath it. Concrete before abstract is not a scaffold you remove; it's the referent you keep.

## Universal projector titles

`universalStateTitle()` never shows the lesson-specific step title — an unmapped state ID falls back to the state bank's generic label.

```
i-do → I Do            we-do → We Do          you-do → You Do
concrete → I Do        representational → We Do   abstract → You Do
independent → You Do   launch → Launch        review → Review
warmup → Warm-Up       question → Question    poll → Question
learning-check → Learning Check
learning-target-readers → Learning Targets
discussion → Discussion   partner → Partner Work
small-group → Small Groups   gallery-walk → Gallery Walk
exit → Exit Ticket     closeout → Closeout
```

## Core states — defaults and directions

Minutes are the bank defaults; override per lesson.

| State ID | Label | Min | Accent | Pace direction | Student action |
|---|---|---|---|---|---|
| `warmup` | Warm-Up | 5 | evergreen `#50A3A4` | — | Google Form on the Chromebook; **hook on the projector throughout** |
| `review` | Review | 4 | evergreen `#50A3A4` | — | Conditional prior-learning refresh; skip it and give the minutes to `concrete` when the day doesn't need it |
| `learning-target-readers` | Learning Targets | 1 | gold `#FCAF38` | — | **The spinner picks who reads the LI and SC aloud.** Runs twice a day |
| `launch` | Launch | 4 | scenario `#F2820C` | — | Brief discussion of how they'd attack the hook. Approaches, not answers |
| `concrete` | Concrete | 5–6 | `#2E9E5A` | "Explore with your partner. Follow the steps." | "Work the exploration with your partner." |
| `representational` | Representational | 6–7 | `#3E7CC0` | Demo, then "Run it {n} times on the tool." | "Open {tool}. Run {n}." |
| `abstract` | Abstract | 6–7 | `#845BC9` | "One from me, one together." | "Assignment out. Follow along, then work #2 with us." |
| `learning-check` | Learning Check | 3 | gold `#FCAF38` | — | Fist-to-Five + readiness gate |
| `discussion` | Discussion | 6 | `#F95335` | — | Three 2-min rounds |
| `independent` | Independent | 14 | `#674A40` | — | Route work |
| `exit` | Exit Ticket | 3 | `#D6567C` | — | Independent exit evidence |
| `closeout` | Closeout | 1 | `#C9992F` | — | Anchor payoff, cleanup |

Projector headline example: `representational` → headline "Make it with tiles", direction "Build, then write what you built."

## Other states

**Routines** — `ipad-kid` (Monday routine)
**Collaboration** — `gallery-walk` (12 min), `small-group` (16 min), `partner`
**Buffers** — `transition-hustle` (1 min, coral), `transition-reset` (2 min, amber), `transition-settle` (1 min, teal)
**Evidence** — `question`, `poll`, `assessment`, `assessment-setup`, `assessment-directions`, `assessment-submit`
**Tools** — ~22 `tool-*` states plus `tool-game`, `tool-exit-ticket`, `tool-checkpoint`, `assigned-tool`
**Legacy** — `i-do`, `we-do`, `you-do`, `cleanup`, `break`, `activity`

`you-do` appears in a property description but is never actually used in the data — the real equivalents are `independent` and `small-group`.

**Convention warning.** Some newer Module 2 lessons use per-lesson sequential IDs (`m2-t1-l1-d1-01` … `-12`) instead of semantic ones. Two conventions coexist. **Prefer the semantic set** unless you are editing a lesson that already uses sequential IDs, in which case match its existing convention rather than mixing.

## What the three good lessons actually do

The default spine above is the starting frame. The three near-deployable lessons (M1.T1.L1-D1, L2-D1, L2-D2 — see `lesson-quality-bar.md`) all total 50 and agree on these invariants. Follow these over the bank defaults where they differ.

**Hard frame:** `warmup` 0–5 · Fist-to-Five present · `exit` **46–49** · `closeout` **49–50**. `Advance` is `Automatic` on every step except `closeout` and any private-release state, which are `Manual`.

**The differentiated release block flexes, 0–14 minutes.** An instruction-heavy day can compress or drop it, with the required work going home as paper or a tool quota, or nowhere by decision. When the block does run, 12–14 minutes is the target and transition minutes come out of instruction, not out of it. Never pad it to hit a number, and never cut a CRA phase to protect it. See SKILL.md, "Where the required work lands."

**The gate is split, not one state — and it always includes a Fist-to-Five.**

Use the three-part design (L1-D1, L2-D1): a second `learning-target-readers` carrying the **Fist-to-Five**, then two 1-minute `question` MC items. L1-D1 adds a 2-minute `small-group` release state with `Advance: Manual`.

```
State ID:      learning-target-readers   (the second one, after the discussion)
Response Mode: Fist to Five
Poll Kind:     fist-to-five
Question:      How well do you understand this right now?
Choices:       0 / 1 / 2 / 3 / 4 / 5
```

**Confidence comes before the graded items**, never after — a student who has just answered two scored questions is rating their performance, not the mathematics.

**Every lesson gets one. This is a hard requirement** (Steele, July 2026). It is the only signal that catches the student who is objectively correct but reports 0–2, and L1-D1 has a routing branch that exists solely for that case: "Gets both correct but reports Fist-to-Five 0-2: Start with the worked reference and a first-problem check." Drop the poll and that branch is dead code. Confidence never decides a route alone, and it is teacher-only data.

M1.T1.L2-D2 uses a two-part gate with **no** Fist-to-Five (item 1 piggybacked on the tail of a work state, item 2 its own state, release as a `transition-hustle`). That is a defect in an otherwise excellent lesson — do not copy it.

**`learning-target-readers` appears twice**, with a prohibition between: the first reveal right after the hook ("Do not collect confidence here. The Fist-to-Five comes after the discussion."), the second before the poll ("This is the review, not the first reveal.").

**CRA is carried by the fade as much as by state IDs.** L2-D1 uses all three IDs. L1-D1 deliberately has no `concrete` state and fades four `representational` states into one `abstract`. L2-D2 has neither `concrete` nor `abstract` as IDs. So name the CRA progression as a body block on every lesson, use the state IDs whenever there is a genuine physical build, and defend a contextual-concrete day in the CRA block rather than mislabeling a state.

**A CRA phase can span records.** A 1-minute "watch first" worked example plus a 4-minute try, both `abstract` — L2-D1 does this. Any minutes floor is **per phase**, summed across records, not per record.

**`independent` vs `small-group` when you're pulling.** All three use `small-group` for the differentiated release block, not `independent` — and that's the better default, because `small-group`'s `[BDM_ROUTINE_CONFIG:…]` gets `teacherPlan` and `materials` **automatically stripped** before students see anything. That's a real privacy guarantee instead of a convention you have to remember.

**`transition-hustle` is a first-class planned state** — but only when students physically change location. For a same-location change of prompt, materials, task, or attention, use Settle 30s from the iPad Remote and spend no planned minute.

**`ipad-kid`** is a 1-minute Monday routine; L2-D1 runs it at minute 9. The spine sums to exactly 50 with no slack, so if it runs, something gives up a minute — usually `review` or `closeout`. Not automatic; propose a re-timed Monday variant that still sums correctly.

**`abstract` / work-state Response Mode.** `classStateStepDefaults()` derives `None`, but the good lessons set `Physical Response` for whiteboard work, `Paper` where the evidence is on paper, and `Assigned Tool` where a manipulative carries it. Pick by where the evidence physically lands, not by the state ID.

**Exit items use `Multiple Choice + Explain`** in two of the three, because the reasoning is the evidence. The choice lands in `poll_answers.answer` (which City Routes exact-matches) and the explanation in `poll_answers.explanation`.

## Per-state step defaults

`classStateStepDefaults()` derives these from the state ID. Match them unless the lesson needs otherwise — matching keeps the room predictable.

```
warmup / exit          → Response Mode: Google Form
learning-check / poll  → Response Mode: Fist to Five, Poll Kind: fist-to-five,
                         Question: "How well do you understand this right now?",
                         Choices: 0 1 2 3 4 5
question               → Response Mode: Short Answer
paper states           → Response Mode: Paper
assigned tool states   → Response Mode: Assigned Tool
everything else        → Response Mode: None
default Advance: Automatic, Required: true
```

`discussion` seeds stems and vocabulary:
```
Discussion Stems:
  I agree with ___ because...
  I disagree because...
  My evidence is...
  I changed my thinking because...
Vocabulary: strategy / evidence / justify / represent / revise
```
Replace these with lesson-specific stems and terms — the defaults are a floor, not a target. Good stems name the mathematical move ("I represented it as ___ because that shows ___"), not just the social one.

## The four surfaces

Every state authors four independent surfaces. Getting the split right is most of what makes a lesson deployable.

| Surface | Field | Audience | Rule |
|---|---|---|---|
| Main projector | `Main Display` | whole class | **The mathematics only.** The problem, the build, the question. No call-to-action verb. |
| Pace + Support projector | `Pace Directions` | whole class | **Current directions only.** One instruction, present tense. Not the agenda, not what's next. |
| Student Chromebook | `Student Action` / `Student Directions` | individual | One action. What the student's hands do right now. |
| Private teacher iPad | `Remote Actions` | teacher only | Look-fors, evidence to capture, route overrides, teacher-only data. |

### The state already says the verb — do not say it twice

`universalStateTitle()` renders the state word on the projector on every step, guaranteed: `concrete` shows **I Do**, `representational` shows **We Do**, `abstract` and `independent` show **You Do**, `discussion` shows **Discussion**, and so on. Students learn to read those words because they are identical lesson to lesson.

So the call to action is already on screen. `Main Display` should not repeat it.

```
BAD                          GOOD
WATCH: 4 x 13                4 × 13
BUILD: 24 as a rectangle     24 = __ × __
SOLVE: 4(5 + 10)             4(5 + 10) = __ + __
LOOK UP - whiteboards only   {nothing here; that belongs on Pace Directions}
```

Every word on a projector is read at 25 feet by 30 people. A label that restates the state costs reading time and buys nothing. Strip imperatives — `WATCH`, `BUILD`, `SOLVE`, `TRY`, `DISCUSS`, `WRITE` — from `Main Display` entirely. Put the mathematics up and let the state marker do its job.

**Two headers to keep**, because they name a recurring artifact rather than restating the state:

- `PUZZLE OF THE DAY` on the hook, which carries a contract students have learned — this is the thing that comes back at the end.
- `YOU CAN ANSWER IT NOW` at the payoff, which is the closing of that contract.

Both are content, not instruction. That is the test: does the header tell a student something the state doesn't? If not, cut it.

The same economy applies to `Pace Directions` and `Student Directions`, which *are* the directions surfaces and so may be imperative — but shorter is still better. The ladder form is the model: `Trackpads parked → Predict → Build → Freeze → Explain`. Not a sentence, a sequence.

`[BDM_PUBLIC_SURFACES:split]` (the default) drives main and support independently. `linked` mirrors them, and only `learning-target-readers` and `ipad-kid` default to it.

## Routine configs

`gallery-walk` and `small-group` take a base64url config in `AI Context` as `[BDM_ROUTINE_CONFIG:…]`.

```
gallery-walk: stationCount (≤20), rotationMinutes (≤60), movementDirections,
              observationPrompt, recordPrompt, sharePrompt, materials (≤24)
small-group:  rotationMinutes, publicTask,
              teacherPlan { pull, focus, activity, check, materials }
```

The public projection strips `materials` and the **entire** `teacherPlan` before students see it. That is the privacy boundary — `teacherPlan.pull` names who you're pulling, and it must never render publicly.

Text fields cap at 800 chars.

## Discussion protocol

Six minutes, exactly three rounds. Don't improvise this — the rhythm is what makes 6th graders actually talk.

1. **Think + Write** (2 min) — silent, individual, on paper. Writing first means the quiet students have something to say.
2. **Discuss + Revise** (2 min) — partner or table. Revision is the goal, not agreement.
3. **Share** (1–2 min) — whole class. Elevate 1–2 statements you overheard while circulating, by name, so students see that being listened to is the reward.

## Readiness gate and private routes

The `learning-check` state does two jobs: a public Fist-to-Five (self-report) and a short adaptive gate (2–3 questions) whose responses assign a private route.

Three routes, named privately on the teacher iPad:

| Private route | Meaning | What the student sees |
|---|---|---|
| Ready | Independent, extend | A destination, materials, a first action |
| Guided | Needs the representation again | A destination, materials, a first action |
| Teacher First | Pull to small group | A destination, materials, a first action |

**The student never sees which route they got.** No score, no tier, no confidence category, no misconception label, no group name that implies ability. Public-facing names are neutral (the existing pages use city or park names). The teacher can override any assignment and release a student early.

When you author a gate, write for each question: the prompt, the correct answer, and what each *wrong* answer means — because the wrong-answer mapping is the routing logic. Then map response patterns to routes explicitly, e.g. "missed Q1 but got Q2 → Guided (has the procedure, not the meaning)".

## Verify

- Minutes sum to the period length (50 for Math 6)
- `Start Minute` contiguous, no gaps or overlaps
- `concrete` → `representational` → `abstract` in order, each **phase** ≥4 min summed across its records
- The hook is on `Main Display` for the whole warm-up, unresolved, and returns at `exit` and `closeout`
- `learning-target-readers` appears **twice**: the reveal right after the hook discussion (spinner picks the readers, no confidence collected), and the review before the Fist-to-Five
- Every physical move has its own transition state with real minutes taken out of instruction, not added to the day
- Every state ID is spelled from this catalog
- Every surface field is written for its own audience — no directions on the main display, no agenda on the pace screen, nothing teacher-only outside `Remote Actions`
