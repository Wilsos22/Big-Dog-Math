---
name: math-pedagogy-research
description: Research the scholarly literature on teaching a specific middle-grades math topic and write a defensible teaching brief — what the evidence supports, how to sequence it, which sub-skills carry the most leverage, misconceptions and how to pre-empt them, hands-on activities, and how to fade scaffolds from concrete to abstract for a Title 1 6th grade class spanning grade level to two years behind. Trigger whenever Steele names a math topic and asks what the research says, the best or most effective way to teach it, which strategies have evidence, how to sequence or scaffold or differentiate it, what misconceptions to expect, what concrete activities to use, or asks for something defensible, reputable, or evidence-based — even without the word "research." Also on "before I plan this unit," "what am I missing on ___," or "what does the literature say." Not for building one Notion lesson page (lesson-deployment-builder) or stubbing lesson rows (lesson-database-builder); this produces the research those consume.
---

# Math Pedagogy Research Brief

Produce a research brief on teaching one math topic that Steele could hand to an instructional coach, a skeptical department chair, or an evaluator and defend line by line. The audience is a 6th grade Title 1 classroom where students range from grade level to roughly two years behind, so every recommendation has to survive contact with a room that does not share a common starting point.

Two things make this brief worth writing instead of just answering from memory:

1. **It is sourced.** Real studies, real authors, real years, real findings — retrieved during this run, not recalled.
2. **It is honest about strength.** Steele's whole classroom culture is *how to think, not what to think*. A brief that flattens a randomized trial and a Pinterest post into the same confident voice fails on its own terms. Say what is well established, what is promising, and what is just craft wisdom, and label each one.

## The one rule that cannot bend

**Never write a citation you have not retrieved in this session.** Fabricated or half-remembered citations are the single failure mode that destroys the entire value of this brief — Steele is explicitly building something that holds up "when scrutinized," and one invented DOI does more damage than ten missing sources.

Concretely:

- Every named study in the brief traces to a search result or fetched page from this run.
- If you know a finding is real but could not retrieve the source, write the claim and mark it `[unverified — recalled, not retrieved this session]`. That is honest and still useful. Inventing an author/year is not.
- Do not invent page numbers, DOIs, effect sizes, or sample sizes. An effect size goes in only if you saw it in retrieved text.
- Prefer quoting or closely paraphrasing what a source actually claims over stretching it toward the recommendation you already want to make.

If retrieval is thin for a topic, a shorter brief that says "the direct evidence here is limited; here is what transfers from adjacent research" is far more valuable than a padded one.

## Workflow

### 1. Scope before searching

Pin down four things. Infer them from what Steele said; ask only if a wrong guess would waste the whole run.

- **The topic and its boundaries.** "Dividing fractions" is really several things: fraction ÷ whole number, whole ÷ fraction, fraction ÷ fraction, mixed numbers, and the measurement vs. partitive meanings underneath. Name the sub-topics you will cover.
- **The standard(s) it sits in.** For 6th grade this is usually CCSS 6.NS, 6.RP, 6.EE, 6.G, or 6.SP. Identify the specific standard and the 5th/4th grade standards it depends on — the prerequisite chain is what the "two years behind" analysis hangs off.
- **The performance band.** Default: grade level down to ~2 years behind, Title 1. Adjust if he says otherwise.
- **What he'll do with it.** Usually plan a unit or a few days. If he's mid-unit and firefighting a specific misconception, weight the brief toward that.

State the scope in one short paragraph at the top of your work so the reader knows what was and wasn't covered.

### 2. Search in parallel lanes

Read `references/source-map.md` before searching. It has the tier definitions, the venues and researchers that actually publish on middle-grades math, and query patterns that surface scholarship instead of worksheet farms.

Run these lanes concurrently — spawn subagents in a single message if available, since serial searching is where this skill burns time and tokens for no gain:

| Lane | Hunting for |
|---|---|
| **Foundational evidence** | IES/WWC practice guides, meta-analyses, syntheses, randomized trials on this topic or its domain |
| **Conceptual / representational** | How researchers say the idea should be *understood* and represented — models, number lines, schemes, developmental progressions |
| **Misconceptions & error analysis** | Documented student errors, their causes, diagnostic items, what over-generalizes from whole numbers |
| **Intervention & struggling learners** | Tier 2/3 studies, CRA and concreteness-fading research, explicit instruction, work with students below grade level |
| **Enacted practice** | NCTM/MTLT articles, curriculum research briefs, task designs — the classroom-facing layer, tiered lower |

Each lane returns: source, tier, what it actually found (population, design, result), and the instructional implication. Tell subagents the citation rule above — they must not invent sources either.

### 3. Weigh, don't just collect

Before writing, do the analytic work. `references/analysis-moves.md` walks through each of these in detail — read it, because these moves are what separate a brief from a literature dump:

- **Emphasis determination** — which sub-skills carry disproportionate downstream leverage, and on what evidence
- **Sequencing** — what order the research supports and *why*, including where sources disagree
- **Misconception pre-emption** — designing instruction so the error surfaces early and gets confronted, rather than patching it in April
- **Concrete work and the fade** — what to put in hands, and the empirically supported way to take it away
- **The two-years-behind band** — prerequisite diagnosis, and acceleration vs. remediation

### 4. Handle disagreement out loud

Where the literature genuinely conflicts — and on fraction division, representation choice, and productive struggle vs. explicit instruction, it does — present the competing positions with their strongest evidence and say what the disagreement hinges on. Then give Steele a recommendation and the conditions under which you'd switch.

**CRA is a starting point, not a commitment.** Steele uses it because a single task with a built-in progression accommodates a room with three years of spread — that's a practical constraint, not an allegiance. He has said it directly: if the research shows something works better, he wants what works.

So treat CRA as one candidate among several and test it against the alternatives *for this topic*. If the evidence points toward a number-line-first progression, worked-example pairs, invented strategies before the algorithm, or a fade schedule that looks nothing like C→R→A, lead with that and explain why. Do not open the progression section with CRA and then bolt on caveats; open with whatever the evidence supports and locate CRA within it.

One thing to check before recommending an alternative: **can one teacher run it in one 55-minute period with a mixed-readiness room?** If an approach has stronger evidence but requires splitting students into parallel lessons, or a co-teacher, or materials he won't have — say so. That's a cost for Steele to weigh, not a reason to bury the finding.

### 5. Write and deliver

Follow `references/report-template.md` exactly for structure. It opens with a one-page action summary Steele can read the night before teaching, then the full scholarly detail below it.

**Save to the repo:**
```
/Users/steelewilson/Big Dog Math Site/research/<YYYY-MM-DD>-<topic-slug>.md
```
Create `research/` if it doesn't exist. Slug example: `2026-07-29-dividing-fractions-mixed-numbers.md`.

**Mirror to Notion** if a Notion tool is available: create a page titled `Research — <Topic>` under the **Research Briefs** hub page (search Notion for it; create it at workspace level if it doesn't exist).

The Notion version is not a paste of the markdown — it's restructured into a skim layer over a depth layer, so Steele can read three bullets per section or open the toggle and go deep. `references/report-template.md` has the exact block structure under "The Notion version." Follow it; that layering is the whole reason the Notion copy exists.

If Notion tools aren't connected this session, say so in one line rather than failing the run — the markdown file is the primary artifact.

**Then in chat:** the action summary only, plus one line on where the file lives and anything you flagged as unverified or thin. Don't paste the full brief into chat; he has the file.

### 6. Optional classroom-OS handoff

If the brief maps cleanly onto Steele's CRA class-state spine, add the handoff section at the end of the template. Two guardrails, in his words: it "should not exclude information that is valid in exchange for trying to force the strategy into the format of my states."

- The handoff is an **appendix**, never a filter. Nothing gets cut from the research sections because it doesn't fit a state.
- If a research-supported sequence doesn't fit the spine, say that explicitly and describe what it *would* take — a two-day split, a different state order, a state that does double duty.

Load `classroom-os-context` if you need the state names, warm-up format, or Notion schema.

## Reference files

- `references/source-map.md` — evidence tiers, where to search, high-yield anchor literature for middle-grades math, query patterns. **Read before searching.**
- `references/analysis-moves.md` — how to do emphasis determination, misconception pre-emption, the concrete-to-abstract fade, and the below-grade-level analysis. **Read before writing.**
- `references/report-template.md` — the exact output structure. **Follow it.**
