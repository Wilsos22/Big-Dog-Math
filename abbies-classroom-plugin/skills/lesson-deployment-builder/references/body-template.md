# Body template — the M1.T1.L2-D2 shape

The page body is written for **the teacher**. The site reads properties and Lesson Steps, never body blocks. So the test is: could Steele teach this cold, at 7:40am, having not looked at it since he wrote it?

**Reproduce M1.T1.L2-D2's shape** (`39d2eba1de3781f1848af4263ad9d353`): four non-tabbed leading blocks, then six tabs. Not L1-D1's 17 tabs, and not L2-D1's untabbed prose — L2-D1 writes its flow three times and the copies already disagree.

The four leading blocks are un-tabbed on purpose: they're what you read before class, and they shouldn't be one click away.

---

## Notion markdown syntax

```
<tabs>
<tab>
Tab Name
content...
</tab>
</tabs>
```
The tab label is the **first line inside** the `<tab>`.

Colored headings give the callout look — the database uses almost no true callout blocks:
```
## Heading {color="blue_bg"}
## Heading {color="blue"}                    (text color)
## Heading {toggle="true" color="green_bg"}  (collapsible)
```
Palette in use: `blue_bg` structure/spec · `green_bg` materials & evidence · `yellow_bg` required work & targets · `orange_bg` vocabulary & warm-ups · `purple_bg` discussion & routing · `red_bg` misconceptions & SBAC · `gray_bg` contracts & notes

**Escaping:** `\|` for a literal pipe in heading text, `\:` for a colon in a bold time label (`**0\:00-0\:05 - Warm-Up:**`).

**Cannot be created from markdown:** PDF embeds, videos, inline databases, page mentions, Google Slides embeds. If the existing body has any, edit surgically — never replace the whole body. Resource Library rows carry more of these than lesson pages.

**Revising an existing body:** keep the page's own tab names. Add only genuinely missing tabs. Renaming tabs to match this template churns the page and breaks Steele's muscle memory for where things live.

---

## The skeleton

```markdown
## Canonical classroom-state specification {color="blue_bg"}
This page and its linked lesson steps are the source of truth for {LESSON CODE}.
If older planning language conflicts with this section, use this specification.

- **Date:** {single date — never a range}
- **Course and code:** Math 6 / {LESSON CODE}
- **Period length:** 50 minutes
- **Primary structure:** {CRA new learning \| error analysis \| gallery walk \| practice}
- **Why it fits:** {how this structure improves access to THIS mathematics}
- **Student product:** {the physical or digital thing that exists at minute 55}
- **Required evidence:** {what gets collected, on what surface}

## Scope boundary {color="gray_bg"}
- **Today:** {the complete list of what is taught}
- **Not today:** {what is deliberately held, and for which day}

## Carnegie foundation and classroom adaptation {color="gray_bg"}
- **Carnegie's starting point:** {activity numbers and its order, per the TIG}
- **Adaptation:** {what changed, with minutes}
- **Defense:** {why the change serves the standard better — quote the standard's verb}
- **Cut or moved:** {what was dropped and where it went}

## CRA progression {color="green_bg"}
- **Concrete:** {the physical build, or "contextual — see defense" if there is none}
- **Representational:** {the diagram or model}
- **Abstract:** {the notation}
- **Fade:** {how support is removed phase to phase, and the Response Mode at each}
- **Number design:** {invariance — same numbers throughout \| laddered — list the ladder}

## Real-world anchor and payoff {color="orange_bg"}
- **Anchor problem:** {student-readable situation + the dare sentence}
- **Anchor answer (teacher only):** {answer + how the day's method proves it}
- **Where it appears:** warm-up minute 0 / launch / at the definition / gate item / exit / payoff state
- **Payoff line:** {names the model that proves it — not just the number}

<tabs>
<tab>
Lesson Flow

## 50-minute flow {color="blue"}
1. **0\:00-0\:05 - Warm-Up:** {one sentence}
...
N. **0\:49-0\:50 - Closeout:** {one sentence}

One sentence per line. Anything longer belongs in Speaker Notes.
</tab>

<tab>
Speaker Notes and Transitions

Per step, the five-part contract:

## {n}. {Step name} \| {state id} \| {n} min {color="{accent}_bg"}
SPEAKER NOTES
Say: "{exact words}"
Ask: "{exact questions}"
HIDDEN: {what must not be revealed yet}
TRANSITION CUE: "{exact words that end the step}"
TRANSITION RATIONALE: {the instructional reason this step hands off to the next}

## Transition rules {color="gray_bg"}
Plan transition-hustle (1 min) ONLY when students physically change location.
Same-location changes of prompt, materials, task, or attention use Settle 30s
from the iPad Remote — no planned minute.
</tab>

<tab>
Four Surfaces

## Main projector {color="blue_bg"}
{the mathematics only, across the period. No call-to-action verb — the state
 marker already renders I Do / We Do / You Do, so WATCH:/BUILD:/SOLVE: is the
 instruction twice. Exceptions: PUZZLE OF THE DAY and YOU CAN ANSWER IT NOW.}
## Pace + Support projector
{current directions only, present tense, a sequence not a sentence}
## Student Chromebook
{one action per state, device-scoped}
## Private teacher Remote {color="red_bg"}
{look-fors, evidence to capture, routing data, override controls}
</tab>

<tab>
Readiness and Routes

## Evidence used for routing {color="green_bg"}
## Fist-to-Five {color="yellow_bg"}
- **Prompt:** {tied to the learning intention and selected criterion}
- **Placement:** second target reveal, BEFORE the graded gate items
- **Use:** adjusts a route correctness has already set; never decides alone; teacher-only
## Gate items {color="yellow_bg"}
### Item {n} — {what it proves}
- Correct: {answer}
- Wrong "{value}" means: {diagnosis} -> {route}
## Routing arithmetic {color="purple_bg"}
{explicit: 2/2 -> independent; 1/2 -> scaffolded partner; 0/2 -> teacher-guided;
 no response -> teacher assignment; correct but Fist-to-Five 0-2 -> worked
 reference + first-problem check}
## Route definitions
- **Teacher First / Guided / Ready:** {focus, activity, check for each}
## Same-work guarantee
{all routes complete the identical required work; support changes the path}
## Release check
{how a student earns off a route mid-period, and the teacher override}
## Privacy contract {color="gray_bg"}
{public names used, rotated how often; what projectors never show}
</tab>

<tab>
Required Work and Assessment

## Where the work lands {color="gray_bg"}
- **Choice:** {in-class practice \| paper homework \| tool homework \| none by decision}
- **Why:** {one line — usually "instruction-heavy day, practice goes home"}
- **In-class release minutes:** {0-14}

## Required paper work {color="yellow_bg"}
{enumerated strip: 1. ... 2. ... }
- **Due:** / **Turn in:** / **Grading:**
## Required digital work
{if tool homework: name the tool, the exact route, the problem count, and the
 receipt — screenshot of the tool's count, a written tally, or reported on the
 next warm-up. Set Homework Tool Assignment Created. Do not claim it moves the
 mastery bars: reportToolResult only fires inside a joined live session.}
## Help path
{numbered, runnable without the teacher, last step = "tell the teacher the exact
 step where your thinking stops"}
## Optional Big Dog Challenge
{transfer, not more of the same}
## Exit evidence {color="red_bg"}
- Prompt / Correct answer / Response Mode (explicit — exit has no fallback)
- Screens for: {misconception}
- Anchor returns: {how}
## 0-4 rubric
{4 = ... down to 0 = no usable evidence; flag interrupted or inaccessible
 evidence for teacher review instead of auto-lowering support}
## Next-lesson recommendation logic
## Scaffold removal
{what goes face down; accessibility accommodations are preserved,
 mathematical hints are not}
</tab>

<tab>
Teacher Supports and Resources

## Before class {color="green_bg"}
{staging list, including any physical rehearsal}
## Misconception responses {color="red_bg"}
- **{canonical tag}:** {prepared move}
{mark any tag absent from `src/lib/misconceptions.ts` (36 labels as of 2026-08-06) as needing a
 misconceptions row before it will render in /teacher/rightnow}
## Vocabulary and stems {color="orange_bg"}
{also attached to the individual steps that need them}
## Resources {color="green_bg"}
## Held for the next day
## Publish readiness {color="gray_bg"}
{Publish Workflow, single Date, Retention Q4/Q5, warm-up + exit artifacts}
## Reflection {color="gray_bg"}
{2-3 questions specific enough to answer, e.g. "which students were
 mathematically ready but reported low confidence?"}
</tab>
</tabs>
```

---

## Writing standards

**Flow lines are one sentence.** The flow is for a glance at 7:40am; depth goes in Speaker Notes.

**Before-class is a staging list, not an inventory.** "Print 30 area cards, cut into pairs, one set per table" beats "area cards." Include a physical rehearsal when the lesson depends on a physical arrangement.

**The help path is a routine, not encouragement.** Numbered, ordered, runnable without the teacher. The poster vocabulary is the right language: try one move, check the evidence, use a resource, ask a thinker.

**Transition rationales get written even when obvious.** They're what makes the sequence auditable, and they're the first thing you'll want when a day runs short.

**Every gate item names what each wrong answer means.** The wrong-answer mapping *is* the routing logic; without it the gate sorts nobody.

**No emojis.**
