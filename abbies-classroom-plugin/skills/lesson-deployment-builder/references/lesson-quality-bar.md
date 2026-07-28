# The quality bar — what a deployable lesson actually contains

Only three lessons in the database are near deployable: **M1.T1.L1-D1**, **M1.T1.L2-D1**, **M1.T1.L2-D2**. Everything else — including the ~80 pages sharing the 5-tab M1.T2 shape — is a stub or a sketch. **Do not treat a widely-copied shape as a standard just because it's widely copied.** Match these three, and where they disagree with a thinner page, they win.

They do not share a page shape. What they share is a **per-step contract** and an inventory of named commitments. That inventory is the bar.

Read these three before authoring anything substantial:

| Lesson | Page ID | Take from it |
|---|---|---|
| M1.T1.L2-D2 Greatest Common Factor | `39d2eba1de3781f1848af4263ad9d353` | **The body shape** (4 leading blocks + 6 tabs) and **the fully wired hook** |
| M1.T1.L2-D1 Factors and Multiples | `39d2eba1de37812ab44fd089468c391b` | **Content depth** — 10 misconception plans, the Jordan error-analysis state, the 0–4 rubric with route logic |
| M1.T1.L1-D1 Taking Apart Numbers | `3962eba1de3780ec81eefca62eb1ad3b` | **The fade** (laddered problems, Response Mode per phase) and the four-branch routing |

Do not reproduce L1-D1's 17-tab sprawl, and do not reproduce L2-D1's container — its flow is written down three times (narrative state blocks, a 50-minute list, and the actual step records) and the copies already disagree.

---

## The per-step contract

Every one of the 46 step records across those three lessons fills, at minimum: `Main Display`, `Pace Directions`, `Student Directions`, `Teacher Notes`, `Remote Actions`, `AI Context`, `Response Mode`, `Required`, `Start Minute`, `Duration`, `State ID`. L2-D2 also sets `Standard` on nearly every step.

A step whose fields are a title and a duration is not a step. This is the single biggest difference between these three and everything else.

**Each surface has its own voice, and they do not overlap:**

- `Main Display` — **the mathematics, nothing else:**
  ```
  24 = __ × __ = __ × __
  ```
  No call-to-action verb. `universalStateTitle()` already renders **I Do / We Do / You Do** on the projector every step, so `WATCH:` / `BUILD:` / `SOLVE:` is the same instruction twice, read at 25 feet by 30 people, buying nothing. Strip imperatives entirely and let the state marker carry the verb. The only headers worth keeping are the ones that name a recurring artifact rather than restating the state — `PUZZLE OF THE DAY` and `YOU CAN ANSWER IT NOW`, which carry a contract students have learned.
- `Pace Directions` — physical cue or process ladder only: `"Screens up. / Trackpads parked → Predict → Build → Freeze → Explain."` Present tense, current step only, never the agenda. A sequence, not a sentence.
- `Student Directions` — device-scoped and singular: `"Chromebook: LOOK UP — whiteboards only."`
- `Teacher Notes` — the five-part contract below.
- `Remote Actions` — private controls and teacher-only data. Routing arithmetic goes here.
- `AI Context` — one line naming the step's role.

**`Teacher Notes` follows a fixed five-part contract**, stated on L2-D2: every step contains the exact teacher words or questions to use; likely misconception prompts; the final transition cue; the instructional reason for the transition; and what must remain hidden or private. Formatted literally:

```
SPEAKER NOTES
Say: "..."
Ask: "..."
TRANSITION CUE: "Cap markers. Keep the boards. When the Hustle music ends,
  flip to a clean side with one marker per partner."
TRANSITION RATIONALE: formalize GCF and create a reason for prime-factor
  organization before teaching factor trees.
```

The rationale line is what makes the sequence auditable. Write it even when it feels obvious.

---

## Timing invariants

All three total exactly 55 and agree on the frame:

| Slot | Rule |
|---|---|
| `warmup` | minutes 0–5, always |
| `exit` | minutes **46–49**, always |
| `closeout` | minutes **49–50**, always |
| `Advance` | `Automatic` on every step **except** `closeout` (and any private-release state), which is `Manual` |
| Fist-to-Five | Required on every lesson |
| Differentiated practice | **0–14 minutes — a choice, not an invariant.** L1-D1 gives 14, L2-D1 gives 12, L2-D2 gives 6. |

**The release block flexes; the frame does not.** An instruction-heavy day can compress the in-class practice to a few minutes or drop it, with the required work going home as paper or a tool quota — or nowhere, deliberately. A day that needs 30 minutes of building to land one hard idea is a better lesson than one that rushes the build to protect a practice window.

Two failure modes on either side of that:
- **Padding a release block to hit 14 minutes**, or cutting a concrete phase to protect one.
- **Letting transitions eat a release block you did intend to run.** L2-D2 spends 2 minutes on two hustles and pays for them out of the work block, leaving 6 minutes for a seven-part proof strip. If the block is running, protect it and take transition minutes from instruction.

The non-negotiable is not the duration — it is **stating where the required work lands.** In-class, paper homework, tool homework with a quota and a checkable receipt, or explicitly none. Blank work fields read as unfinished; a stated "no required work tonight, the notebook page is the product" reads as decided.

---

## How CRA actually shows up

CRA is the required progression. But in these three it is carried as much by a **fade** as by state IDs, and the fade is the part that makes it real:

- **L2-D1** uses all three state IDs: `concrete` 14–19 → `representational` 19–25 → `abstract` 25–30.
- **L1-D1** deliberately has no `concrete` state — its "Do not use in this lesson" list explicitly excludes physical grid mats, dividers, region covers, and mini whiteboards, and its progression is four `representational` states fading into one `abstract`.
- **L2-D2** has no `concrete` or `abstract` state ID at all; its concrete is contextual (the parking lot) and its abstract work sits under `question`.

So: **name the CRA progression as a body block on every lesson, and carry it in state IDs whenever the lesson has a genuine physical build.** When a lesson's concrete phase is contextual rather than material, say so in the CRA block and defend it, rather than mislabeling a state or bolting on a manipulative nobody needs.

The two mechanisms that make the fade real:

**1. A named fade with a different `Response Mode` per phase.** From L1-D1:
> "I Do: screens low; students predict and watch. / We Do: screens up; students operate after each teacher cue. / Guided try: model remains visible while attention shifts toward the equation. / Independent model and equation: students complete both representations. / Independent equation only: the area model is removed."

**2. One of two number designs — pick deliberately.**
- **Number invariance** (L2-D2): "Keep the same pair, 24 and 36, through the model and proof loop so working memory is spent on the representation, not on restarting the arithmetic."
- **Laddered problems** (L1-D1): 4 × 13 (I Do) → 3 × 16 (We Do) → 6 × 12 (guided) → 5 × 14 (independent, model + equation) → 4 × 17 (independent, equation only, model removed).

Invariance suits a day building one new representation. Laddering suits a day generalizing a known one.

---

## Named commitments a deployable page carries

**Scope boundary with an explicit "Not today" list.** L2-D2:
> **Today:** factor pairs, common factors, greatest common factor, factor trees, prime factorization, one-to-one shared prime copies, and two proofs that GCF(24, 36) = 12.
> **Not today:** least common multiple, repeating-cycle problems, the Ladder Method, or mixed GCF/LCM decisions.

This is not decoration — it is what you audit step text against afterward. In July 2026 an agreed L2-D1 build was transcribed with Day-2 GCF/LCM material in four steps' teacher notes, vocabulary, stems, and base64 routine config. The miss hid in exactly the fields nobody re-reads. Audit with a **case-sensitive** sweep (base64 blobs false-positive on case-insensitive matching).

**A single source-of-truth declaration.** L2-D2: "This page and its linked lesson steps are the source of truth for M1.T1.L2-D2. If older planning language conflicts with this section, use this specification." Write this line; it's what prevents the L2-D1 triple-flow problem.

**Definition after evidence, enforced on the Remote.** "Reveal the definition only after students name the greatest shared factor." "Reveal the completed pair lists only after boards are scanned." "Reveal the complete arch only after revision." The instruction lives where the teacher will read it, not in a plan.

**A double target reveal with a prohibition between.** `learning-target-readers` appears twice: first right after the hook — "Do not collect confidence here. The Fist-to-Five comes after the discussion." — and again before the confidence poll — "This is the review, not the first reveal."

**A Fist-to-Five on every single lesson.** Required, no exceptions (Steele, July 2026). It sits in the second `learning-target-readers` state, *before* the graded gate items, with `Response Mode: Fist to Five` and choices 0–5. Two axes — confidence and correctness — and routing on one of them is guessing. L2-D2 omits it, and that is the one clear defect in the best-designed lesson in the database.

**Deterministic routing with a stated override and a same-work guarantee.** The arithmetic is written out. L2-D2: "combine Readiness 1 and 2. 2/2 → independent; 1/2 → scaffolded partner; 0/2 → teacher-guided; no response → teacher assignment." L1-D1 adds the branch that matters most, and the one that only exists if the poll does: "Gets both correct but reports Fist-to-Five 0-2: Start with the worked reference and a first-problem check." Confidence never decides alone — "confidence alone never determines the work station."

And the guarantee: **support changes the path, not the product.** "Every station completes Practice 1-6. Support changes the path, not the required work." "All three parks complete identical required paper work."

**A privacy layer as a named section.** "Projectors never show park rosters, scores, route labels, readiness bands, or misconception tags. Park names are temporary and are not written into grades, parent reports, or permanent ability profiles." L2-D2 draws three parks daily from a fixed bank of ten (Yosemite, Acadia, Redwood, Glacier, Sequoia, Denali, Saguaro, Arches, Everglades, Shenandoah) and **rotates which route each name means, daily**, so a name can never become a label.

**A 0–4 exit rubric plus next-lesson routing logic.** L2-D2's Trail Check: "4 — both factorizations, shared 2×2×3, product 12, and correct parking-lot meaning … 0 — no usable evidence", with "Flag interrupted or inaccessible evidence for teacher review instead of auto-lowering support." L2-D1 adds comparison tags — `support-transferred`, `ready-sustained`, `proof-still-developing`, `continued-support-needed`, `placement-mismatch-review`, `invalid-or-missing-evidence` — and logic like "Score 3 → Guided by default. Recommend Ready only when the factor structure is fully correct and the weakness is limited to wording."

**Scaffold removal as a state, not an instruction.** "Place the proof strip and support materials face down. Remove factor lists, colored arches, counters, worked examples, and partner talk. **Preserve non-mathematical accessibility accommodations.**" And on the exit: "Independent means your brain and the question. Accessibility supports remain; mathematical hints do not." That last distinction is the one to always carry.

**An ordered help path ending in self-diagnosis.** Numbered, runnable without the teacher, and its last step is "Tell the teacher the exact step where your thinking stops" — not "ask for help."

**A required paper product enumerated as a strip.** L2-D2's seven parts: factor pairs of 24 and 36 → complete factor lists → common factors and GCF = 12 → one complete factor tree for each → one-to-one shared prime copies → 2 × 2 × 3 = 12 → parking-lot interpretation. Plus the rule: "Whiteboard and paper work are never replaced by the Chromebook."

**A gated challenge that is transfer, not more.** L2-D1: "Find every factor of 72 and record its prime factorization with exponents. Then use 36 as your evidence to explain why a square number always has an odd number of factors."

**Vocabulary and stems attached to the step, not only the lesson.** The step that needs them carries them, because that's where they render.

**A before-class checklist including a physical rehearsal.** L1-D1: "Test the screen-low position with a Chromebook and a full sheet of paper at an actual student table. Paper must sit flat without resting on the keyboard or blocking a partner."

**Reflection questions specific enough to answer.** "Which students were mathematically ready but reported low confidence?" "Did 14 minutes allow completion of Practice 1-6?"

**First-class transition states, with the rule for when they're allowed.** Plan a `transition-hustle` (1 min) only when students physically change location. For a same-location change of prompt, materials, task, or attention, use Settle 30s from the iPad Remote instead — do not spend a planned minute on it.

---

## Publish readiness is part of done

L2-D2 has the best instructional content in the database and **cannot be served**: `Publish Workflow` is `Ready for Review`, `Warm-Up Build Status` is `Not requested`, `Retention Q4`/`Q5` are empty, and `Exit Ticket Link` / `Warm Up Link` are blank.

So the definition of done includes the serving chain, and you report its state explicitly: `Publish Workflow`, a single `Date`, `Retention Q4`/`Q5` authored, and the warm-up and exit-ticket artifacts either linked or listed as the remaining manual step.

---

## Known defects in these three — do not copy

- **Dates were moved to fake the current window.** L1-D1's `Date` is 2026-07-25 but its body says "Friday, August 14, 2026"; L2-D1's is 2026-07-26 against a body saying August 17. They were shifted so `/api/today` would serve them. Never reproduce this — and if you see body and property dates disagree, ask which is real.
- **L1-D1's `Anchor Problem` is orphaned** — a good hook in a property that reaches no screen and has no payoff.
- **L1-D1's `Assignment Link` is a GCF/LCM practice file** attached to a distributive-property lesson. Audit attachments against the scope contract.
- **L2-D2 has no Fist-to-Five**, so it can't cross confidence against correctness. Every lesson needs one — add it when you touch this page.
- **Lesson-authored misconception tags in all three fail to match the canonical vocabulary**, so their prepared moves render blank in `/teacher/rightnow`. See the write contract's tag section — this is a systemic issue, not a per-page slip.
