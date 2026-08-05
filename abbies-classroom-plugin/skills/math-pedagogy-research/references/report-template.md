# Report Template

Follow this structure. It's tiered on purpose: Part 1 is what Steele reads at 9pm the night before teaching, Part 2 is what he reads on a planning weekend and what he hands to anyone who asks "says who?"

Write in his register — direct, no throat-clearing, no "In today's educational landscape." Prose over bullets where the reasoning matters; bullets where it's genuinely a list.

Every substantive claim in Part 2 carries an inline tier tag: `[T1]`, `[T2]`, `[T3]`, `[T4]`, or `[unverified]`. Part 1 stays clean of tags except where a recommendation rests on weak evidence — then say so in words.

---

```markdown
# <Topic> — Research Brief
**Grade band:** 6th grade, Title 1 · grade level to ~2 years behind
**Standard(s):** <CCSS codes and short text>
**Compiled:** <YYYY-MM-DD>
**Scope:** <2–3 sentences: what sub-topics are covered, what was deliberately left out>
**Evidence at a glance:** <n> Tier 1 · <n> Tier 2 · <n> Tier 3 sources. <One sentence on where the evidence is strong and where it's thin for this topic.>

---

## Part 1 — Action Summary

*One page. Read this before you teach.*

### The short version
<3–5 sentences. The single most important thing the research says about teaching this topic, and the one thing most likely to go wrong.>

### Where to spend the time
<2–3 highest-leverage sub-skills, one line each with the reason. Then one line naming what gets compressed to pay for it.>

### The sequence
<Numbered, one line per step, with the purpose of each step in a clause. This is the arc, not the lesson plan.>

### The three misconceptions to plan for
<For each: the wrong answer you'll actually see → the task that surfaces it early. One line each.>

### The progression at a glance
<Name the stages according to whatever progression the evidence supports for this topic — CRA if that's what it supports, otherwise the stages of the approach you're recommending. Don't force three rows.>

| Stage | Students do | Move on when |
|---|---|---|
| | | |

### If they're two years behind
<3–4 lines: the prerequisites that actually block this topic, the diagnostic questions that reveal them, and the just-in-time move.>

### Watch out for
<2–3 lines: where the popular approach is weakly supported, or where a common shortcut creates a downstream problem.>

---

## Part 2 — The Evidence

### 1. What the research supports
<Prose. Organized by claim, not by source. Each claim: what it is, what the evidence is, how strong, and what it means for a 6th grade Title 1 room. Inline tier tags. Name authors and years in text where it helps the argument land.>

### 2. Emphasis — where the leverage is
<The case for each high-leverage sub-skill, with the type of leverage argument being made (downstream prediction, prerequisite fan-out, misconception density, standards weighting). Include what gets less time and why that's defensible.>

### 3. Sequence and why
<The recommended order with justification per step. A subsection titled "Where the research disagrees" presenting competing sequences, what the disagreement hinges on, the recommendation, and the condition that would flip it.>

### 4. Misconceptions and how to prepare
<One block per misconception:>

**Misconception:** <name>
- **Looks like:** <an actual wrong answer>
- **Why it makes sense to them:** <the previously-true rule being over-generalized>
- **Evidence:** <source + tier>
- **Surface it early with:** <specific task, question, or number choice>
- **When it shows up:** <what to say and do — confusion is step one>

### 5. Concrete activities
<Per activity: what students do, what materials (with cheap substitutes), what mathematical structure it embodies, what it can't show, the evidence or design principle behind it and its tier, and roughly how long it takes.>

### 6. The progression to abstract
<Open with which progression the evidence supports for this topic and why — CRA is a candidate here, not the assumed frame. Name the alternatives you considered and what would have to be true for one of them to win. Then: the representational bridge, the observable trigger for each transition, the return signal, and the evidence for fading over support-that-never-leaves. Be specific about what students draw and what the drawing preserves. If the recommended approach is harder to run in one period with a mixed-readiness room, say so here.>

### 7. Scaffolding and differentiation
<Prerequisite chain with a diagnostic item and interpretation for each. Gap types (conceptual / procedural / fluency bottleneck) with different responses. Support structures that keep one task for the whole room. Extension that deepens rather than accelerates.>

### 8. Open questions and weak spots
<Honest accounting: where the evidence is thin, contested, or drawn from a different population than Steele's. What you'd want to know that you couldn't find. Anything marked [unverified] and why.>

---

## Sources

<Grouped by tier, strongest first. For each:>

**[T1] Author, A. (Year). Title. *Venue*.** <URL>
> **Design:** <population, n, method> · **Found:** <what it actually reported> · **Used here for:** <which claim in this brief>

---

## Appendix — Classroom OS handoff *(optional)*

<Only if it fits without distorting anything above. A day-by-day arc mapped to Steele's CRA class states, with the warm-up 2+3 shape specified per day (2 review problems chosen as prerequisite diagnostics, 3 current questions with the misconception the third one targets named explicitly).

If the research-supported sequence does not fit the state spine, say so here and describe what it would take — a two-day split, a reordered state, a state doing double duty. Do not bend the research to fit the format.>
```

---

## The Notion version

The markdown file is the archive; the Notion page is what Steele actually reads. It uses a **skim layer over a depth layer** so the same page works for a two-minute check and a full planning session.

Structure every Part 2 section this way:

```
## 4. Misconceptions and how to prepare

- <skim bullet — the single most important takeaway from this section>
- <skim bullet>
- <skim bullet>

### In depth {toggle="true"}
	<the full section content, indented one tab so it nests inside the toggle>
```

Three to five skim bullets per section, always visible. Everything else lives behind the collapsed toggle heading. The bullets have to stand alone — someone who never opens a toggle should still get a usable answer, so write them as conclusions ("lead with measurement division; partitive can wait until day 7"), not as topic labels ("division interpretations").

Rest of the page:

- **Top callout** — scope, grade band, standards, and the evidence-at-a-glance line. Use `<callout icon="🔬">`.
- **`<table_of_contents/>`** right under the callout, so the H2s become jump links.
- **Part 1 — Action Summary** stays fully open, no toggles. It's already the skim layer.
- **Sources** — one toggle heading per tier (`### Tier 1 — Strong {toggle="true"}`), each source as a bullet with its design/found/used-for lines nested underneath.
- **Open questions and weak spots** stays open too. Burying the caveats defeats the point of having them.

Notion-flavored markdown notes: toggle headings are `## Text {toggle="true"}` with children indented by **tab**, not spaces. Standard markdown tables don't render — use the `<table>` / `<tr>` / `<td>` form. Escape `*` `~` `[` `]` `<` `>` `|` `^` outside code spans.

---

## Notes on writing it

**Length.** Part 1 is one page, hard limit — it stops being useful the moment it needs scrolling. Part 2 runs as long as the evidence justifies, typically 5–8 pages. If Part 2 is short because retrieval was thin, say that in "Evidence at a glance" rather than padding.

**Sources section.** The design/found/used-for triplet is what makes the brief defensible. A bare citation list is decoration; the triplet lets a skeptic check whether the study says what the brief claims it says.

**Voice.** Steele jokes with students, but this document is for adults and for defending decisions. Warm and direct, not chummy and not academic. Prefer "start with measurement division" over "it is recommended that instruction commence with the measurement interpretation."

**Don't hedge into uselessness.** Presenting competing evidence honestly and then refusing to recommend anything is a failure. Name the disagreement, then make the call and state what would change it.
