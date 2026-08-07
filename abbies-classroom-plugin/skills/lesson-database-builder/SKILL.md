---
name: lesson-database-builder
description: Build out lessons in the Notion "Math 6 Lessons" database (id e367e541-c0c7-4613-8066-d2e61b6fee64) so the Big Dog Math control panel can select from a premade library. Produces lessons that match the existing Notion schema exactly (Date, Publish Workflow, Module, Topic, Learning Intention, Success Criteria, Agenda lines, Supply:* checkboxes, Tool:* checkboxes, Warm Up Link relation, Exit Ticket Link relation, Assignment) and that fit the control panel's 11-state CRA sequence (warmup → launch → learning-target-readers → concrete → representational → abstract → learning-target-readers with Fist-to-Five → question → small-group → exit → closeout). Trigger on: "build out the lesson database", "add lessons to Notion", "finish the lesson plan database", "premake lessons", "fill the lesson library", "build a lesson for {topic}", "add a unit to Notion".
---

# Lesson Database Builder

Build lessons that drop straight into Steele's Notion "Math 6 Lessons" database and render correctly on the live student lesson page + control panel sequence.

Assume the `classroom-os-context` skill has loaded — site structure, Notion schema, and warm-up format are known. If it has NOT loaded, read it first at `skills/classroom-os-context/SKILL.md` in this plugin.

## When to invoke

Steele asks for any of: a single lesson, a multi-day unit, a backfill of past lessons, or a stub for an upcoming topic. Default to **one lesson at a time** unless he says "build the whole unit" — quality over quantity, and lessons are easier to revise individually.

## Two corrections (2026-08-06)

**1. The old four-state sequence is gone.** This file was written against `Warm Up → Mini-Lesson →
Work Time → Exit Ticket`. The real runtime is the 11-state CRA spine on a fixed 50-minute frame:
`warmup` 0-5 (hook on the projector) · `launch` 5-8 · `learning-target-readers` 8-9 · `review`
conditional · `concrete` 9-16 · `representational` 16-22 · `abstract` 22-29 ·
`learning-target-readers` 29-30 with the Fist-to-Five · `question` 30-33 · `small-group` 33-46 ·
`exit` 46-49 · `closeout` 49-50. Anything below describing the four-state model is stale — see
`classroom-os-context` for the spine and `lesson-deployment-builder` for authoring one day to depth.

**2. Every stub needs a hook line.** A stub created without one tends to stay hookless, because the
day it gets built out nobody remembers there was a decision to make. Run the **`lesson-hook`** skill —
it is a gate, not an option — or at minimum record the storyline thread the lesson will hang on, and
add the row to `lesson-hooks/HOOK-BANK.md` in the repo so the next session can see it. A stub with a
named thread is far cheaper to deepen than a stub with an empty `Anchor Problem`.

## Required inputs

Ask for whatever isn't already obvious from context:

1. **Topic / standard** (e.g. "ratios — introducing tape diagrams", "6.RP.A.1")
2. **Date** (specific date or "next Monday")
3. **Module** (the unit name as it appears in Notion — e.g. "Ratios & Proportions")
4. **Period length** — default 50 minutes if not specified
5. **Available manipulatives** — which `Tool:` checkboxes are relevant (see TOOL_ROUTES below)

If Steele has the Notion connector authorized, prefer reading an existing recent lesson to mirror tone and field formatting. Otherwise produce the lesson as a Markdown spec he can paste in.

## Output format — the lesson spec

Every lesson is a single Notion page with these fields populated:

### Top-level properties (Notion property → value)

| Notion field | What to put |
|--------------|-------------|
| Name (title) | Short, concrete lesson title — e.g. "Tape diagrams for part-to-whole ratios" |
| Date | The lesson's date |
| Publish Workflow | `Draft` while building, `Published` only when Steele approves |
| Module | The unit name |
| Topic | Sub-topic within the module |
| Learning Intention | One sentence, student-facing, starts with "I can…" |
| Success Criteria | 2–3 bullets, student-facing, observable |
| Agenda | One agenda step per line — see "Agenda lines" below |
| Supply: ___ checkboxes | One checkbox per physical supply needed |
| Tool: ___ checkboxes | One checkbox per on-site manipulative (see TOOL_ROUTES) |
| Warm Up Link | Relation to a Warm Ups database page (built separately) |
| Exit Ticket Link | Relation to an Exit Tickets database page |
| Assignment | URL or short text describing the assigned practice |
| Retention Q4 / Retention Q5 | Usually LEAVE BLANK — the warm-up week builder fills them from the curated pool and Steele edits there. Format if authoring by hand: `Question \| ans: correct \| wrong: value -> misconception tag \| ccss: 6.NS.B.4` |

### Multi-day lessons: ONE PAGE PER TEACHING DAY (locked convention, 2026-07-05)

Never give a lesson a Date **range**. A lesson that runs 3 days gets **3 pages**, each with a single
Date, each Published — e.g. `M1.T1.L1 Area Model Multiplication — Day 2`. Same Module/Topic # on all
of them; per-day Agenda/Learning Intention/Success Criteria on each. Why this is load-bearing:

1. The site (`/api/today`) finds lessons by **exact date** — a range-dated lesson vanishes from the
   student lesson page and control panel on days 2+.
2. The warm-up **retention chain** targets "the previous school day's page": day 2's warm-up Q4/Q5
   check day 1's page (its Retention Q4/Q5 fields), day 3 checks day 2, and so on. One page per day
   is what makes each day's retention questions align to that day's actual content.

### Agenda lines — match the control panel state sequence

Write agenda lines in the same order and naming as the control panel states. The lesson page renders them as a numbered journey; the control panel uses the order to drive its timer sequence.

**Never put a comma in an agenda line.** The site splits on commas as well as newlines, so one comma silently becomes three steps.

The 50-minute new-learning day:

1. **Warm Up (0-5)** — Google Form retrieval on Chromebooks. The hook sits on the projector the whole time: readable now, not solvable until the end.
2. **Launch (5-8)** — how would you attack it. Approaches only. No solving and no reveal.
3. **Learning Target (8-9)** — LI and SC go up and get read aloud by whoever the spinner lands on. Do not collect confidence here.
4. **Review (conditional)** — refresh the prior learning the day depends on *or* skip it and give the minutes to Concrete. Decide on purpose and say which.
5. **Concrete (9-16)** — structured exploration with explicit instructions. Pairs or table groups by default.
6. **Representational (16-22)** — normally a website tool. Teacher demonstrates one then students run a stated number of reps.
7. **Abstract (22-29)** — the assignment appears and the numbered routine gets derived here. Teacher works one then the class works one together.
8. **Learning Target again (29-30)** — the review not the reveal. Carries the **Fist-to-Five**. Every lesson gets one.
9. **Question (30-33)** — two problems whose answers set the private routes.
10. **Small Group / Release (33-46)** — differentiated release. **This is the block that flexes**; it is where minutes come from when the rest of the lesson needs them. It may shrink to zero. It never crosses 46.
11. **Exit (46-49)** — back at seats. Independent evidence. The hook returns in its original wording.
12. **Closeout (49-50)** — the payoff and cleanup.

Sums to 50 exactly. `Warm Up` 0-5, the Fist-to-Five before the graded items, `Exit` 46-49 and `Closeout` 49-50 are hard frame. Everything else negotiates with the release block.

**A practice day or a review day does not use this list.** Practice days run error analysis, gallery walks, or the vertical classroom; review days run Bruh or Grudge Ball and need no authoring at all. The fixed frame above still applies to both. See `lesson-deployment-builder` and `classroom-os-context`.

### Supply: checkboxes — default options

Check only what's actually used. Common supplies: `Supply: Pencil`, `Supply: Notebook`, `Supply: Calculator`, `Supply: Whiteboard`, `Supply: Marker`, `Supply: Ruler`, `Supply: Protractor`, `Supply: Graph paper`, `Supply: Sticky notes`.

### Tool: checkboxes — must map to TOOL_ROUTES

The lesson page's `TOOL_ROUTES` map in `src/app/lesson/page.tsx` translates each `Tool:` checkbox into a manipulative URL. Only use tools that already exist as routes. Current tools (verify against `src/app/` before assuming):

- `Tool: Equation Builder` → `/equation-builder`
- `Tool: GEMS` → `/gems`
- `Tool: Combining Like Terms` → `/combining-like-terms`
- `Tool: Fraction Bars` → `/fraction-bars`
- `Tool: Percent Bar` → `/percent-bar`
- `Tool: Number Line` → `/number-line`
- `Tool: Ratio Proportion Builder` → `/ratio-proportion-builder`
- `Tool: Area Model` → `/area-model`

If Steele wants a manipulative that doesn't exist yet, flag it instead of inventing a route.

## Warm-up content rules

Warm-ups follow the 2 + 3 format:

- **2 review computation problems** — fluency from a prior unit. Pick from the last 2–3 weeks.
- **3 current problems** — on today's topic. The **third problem must target a specific, named misconception** (e.g. "students will treat 3:5 as 3+5=8 parts instead of 8 total parts → 3-of-8 shaded"). State the misconception in the lesson spec so Steele knows what to listen for during share-out.

When generating warm-ups for the Notion Warm Ups database, output:

```
Warm-up: {Lesson title} — {date}

Review (fluency):
  1. {problem}      → answer: {answer}
  2. {problem}      → answer: {answer}

Today (preview):
  3. {problem}      → answer: {answer} | misconception to watch: {n/a}
  4. {problem}      → answer: {answer} | misconception to watch: {n/a}
  5. {problem}      → answer: {answer} | misconception to watch: {THE big one}
```

## Exit ticket rules

One problem. Tied directly to one success criterion. Solvable in 3 minutes. Include answer + the misconception it screens for.

## Small group guidance

Every lesson spec ends with a **Small Group block** for the teacher (not student-facing). Format:

```
SMALL GROUP (during Work Time):
  Pull: students who missed warm-up question 5 (the misconception probe)
  Focus: {one-sentence reteach focus}
  Activity: {concrete activity using the manipulative tool listed in Tool:}
  Check: {how teacher confirms understanding before releasing back to independent work}
```

## Pedagogy sourcing

When the topic is unfamiliar or Steele asks for "best practices," pull from reputable sources before writing:

- NCTM Illuminations (illuminations.nctm.org)
- Achieve the Core / Student Achievement Partners (achievethecore.org)
- OpenUp Resources / IM 6–8 Math (illustrativemathematics.org)
- Desmos Classroom activities (teacher.desmos.com)

Cite the source inline in a `// notes` comment at the end of the lesson spec so Steele can audit. Never quote more than a sentence — paraphrase the pedagogy and adapt to the 2+3 / state-sequence format.

## Delivery

Default delivery is **Markdown** Steele can paste into Notion. If the Notion connector is authorized in this session, offer to write the page directly — but always show the spec first for approval.

## Quality bar

Before declaring a lesson done, check:

- [ ] Learning Intention starts with "I can…" and is one sentence
- [ ] Success Criteria are observable (not "understand"/"know")
- [ ] Warm-up follows 2+3 with a named misconception on question 5
- [ ] Agenda totals the period length
- [ ] Every `Tool:` checkbox maps to an existing TOOL_ROUTES entry
- [ ] Exit ticket screens for a specific misconception
- [ ] Small group block names who to pull and what activity
- [ ] Tone is Abbie-friendly, not stiff or textbook-y
