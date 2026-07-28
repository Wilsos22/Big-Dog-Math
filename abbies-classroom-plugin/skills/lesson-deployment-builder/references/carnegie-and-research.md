# Carnegie first, then supplement

## Why Carnegie first

Carnegie Learning is the adopted curriculum. Two reasons that ordering matters beyond compliance:

**The task design is good.** Carnegie's problems are built on genuine mathematical progressions and its "Learning by Doing" premise puts students on the problem before the procedure. Discarding the problems and writing your own usually produces something weaker. Start from theirs.

**Fidelity has to be legible.** Every teacher adapts, but adaptation is normally invisible — nobody can see what got changed or why. This project's whole thesis is making the collaborative day visible: what was planned, what actually ran, what got cut. That only works if each lesson records its own delta from the source. So the `Curriculum defense` block isn't documentation overhead, it's the data.

## Where to find the Carnegie source

`Lesson Resources` relation on the lesson page → a Math 6 Resource Library row (`collection://28e2eba1-de37-81e6-bd6e-000bfd93f84c`) with file properties:

| File | What it gives you |
|---|---|
| `TIG` | Teacher Implementation Guide — the primary source. Learning goals, essential ideas, activity sequence, differentiation, assessment. |
| `Clarity Guide` | Teacher clarity guide — learning intentions and success criteria in Carnegie's language. |
| `Student Pages` | The actual problems students see. |
| `Slides`, `Keynote` | Carnegie's presentation. |
| `Notes`, `Notes Key`, `Assignment`, `Assignment Key` | |
| `Interactive Notebook`, `All things Algebra` | Supplemental banks Steele already owns. |

Some lessons attach the TIG as a PDF directly on the lesson page instead.

**`Lesson Resources` is empty more often than it's populated** — it was empty on every lesson checked across two topics, while the Resource Library row existed and was findable. The row points *back* via its `Lesson Plan` relation, one-directionally. So before concluding anything is unreachable: `notion-search` scoped to `collection://28e2eba1-…` by lesson code or Carnegie lesson title, and check the back-relation. Offer to fill in the missing relation while you're there.

## Actually reading the TIG

The TIG is a **file property**. `notion-fetch` returns a `file://…_TIG.pdf` reference, not text. Use **`notion-download-attachment`** to get the content.

Check the filename against the lesson code first. Mislabelled attachments are real — a row for `M3.T2.L3` carrying `M3.T1.L3_TIG.pdf` means either the wrong file or a wrong-lesson row, and activity numbers taken from it would be fiction dressed as provenance.

### When the TIG is attached but you can't read it

This is the common case, and "stop and ask" is the wrong response to it — the user asked for a build, and the workflow already ends at an approval gate. Instead, build on Carnegie-derived text that already exists in Notion, and be transparent about the sourcing:

| Source | What it usually gives you |
|---|---|
| Resource Library row's `Essential Ideas`, `Lesson Summary` properties | Carnegie's verbatim essential ideas — often the best-written thing available |
| Resource Library row's **page body** | A hand-transcribed Launch / Develop / Connect flow. A fallback, **not** the TIG. |
| The parallel accelerated records (see the decoy table in the write contract) | Frequently the fullest transcribed instructional sequence, differentiation, and assessment for the lesson. Highest-value read when the PDF is closed. |
| The neighbouring lessons in the topic | What Carnegie's arc is doing around this day |

Then: **label every Carnegie claim with its source**, enumerate what remains unverified pending a real TIG read, and hold the lesson at `Draft`. A defense block that says "Carnegie's Develop phase, per the Resource Library transcription — activity numbers unverified" is honest and useful. One that invents "Activity 2.1" is worse than no defense at all, because it looks auditable and isn't.

Only when no Carnegie source of any kind is findable: say so and ask Steele for the pages. Never infer Carnegie's sequence from the lesson title.

## Carnegie's phase model, mapped to the state spine

Carnegie structures a lesson as **Engage → Develop → Demonstrate**. The state spine is finer-grained, and the mapping is not one-to-one:

| Carnegie phase | Typical state landing | What usually has to change |
|---|---|---|
| Engage | `launch` (+ the anchor question during `warmup`) | Carnegie's engage is often a context problem that is abstract work in a story wrapper. It rarely gives you a concrete build. |
| Develop | `concrete` → `representational` → `abstract` | This is where the resequencing happens. Carnegie frequently presents representation and notation together, or puts the manipulative *after* the notation as remediation. Split them and put concrete first. |
| Demonstrate | `learning-check`, `independent`, `exit` | Carnegie's assessment is usually sound. What's missing is the *routing* — it tells you to differentiate but not who goes where based on what evidence. |

`discussion` typically has no Carnegie equivalent as a timed state. It gets authored.

## Reading a TIG — what to extract

Work through it once and record:

1. **Learning goals** in Carnegie's own words.
2. **Essential ideas** — these usually go straight into `Essential Ideas` with light editing. They're often the best-written thing in the guide.
3. **Standards** Carnegie claims. Cross-check against the `Standards` options; Carnegie sometimes claims more than a single day can carry.
4. **Activity sequence in Carnegie's order**, with its phase labels and its timing.
5. **Which student pages** belong to which activity.
6. **Differentiation notes** — usually thin but occasionally names a specific misconception worth keeping verbatim.
7. **Assessment** — the problems and what they check.

Then answer these four, in writing, because they become the defense block:

- Does Carnegie ever put a **concrete referent** in front of students? If not, what should it be?
- Does the notation arrive **before or after** the representation?
- Is there **more than one day** of material here?
- Where is the **essential idea** — do students encounter it, or is it only in a teacher sidebar?

## Writing the defense

Four lines, specific, no hedging. The bad version and the good version:

> **Weak:** Carnegie's approach was modified to better fit our classroom structure and student needs.

> **Strong:**
> - **Carnegie's starting point:** Develop opens on Activity 2.1, a table of equivalent ratios students complete, then generalizes to `a/b = c/d`. No manipulative appears until the "Additional Practice" sidebar.
> - **Adaptation:** Moved the tape diagram from remediation to the front. Students build 3:5 with two-color tiles (concrete, 5 min), draw it as a tape diagram (representational, 5 min), then complete Carnegie's table 2.1 as the abstract phase (5 min).
> - **Defense:** 6.RP.1 asks students to *describe* a ratio relationship, not just compute one. Carnegie's table produces correct answers before students can say what the relationship is, which is exactly the ground the additive-scaling error grows in. Tiles first make the equal-size-parts requirement physical, so `4:6` fails visibly instead of arithmetically.
> - **Cut:** Activity 2.3 (ratio tables with three quantities) moved to D2 — it needs the two-quantity case secure first.

Note what makes it strong: it names the actual activity numbers, the actual minutes, the actual standard language, and the actual misconception. Anyone could audit it.

## Where to research, and when

### Source zero — check the repo before you research anything

**`src/lib/sbacCheckpoints.ts`** is the most valuable file in the repo for this skill and it is easy to miss. It is keyed by lesson (`covers: "L2 Composite Figures"`) and by date, and per checkpoint it holds:

- the **canonical misconception strings** for that lesson — the ones the software will actually cluster on
- the SBAC item shapes students will face, with DOK levels
- the standard in dotted-letter notation (`6.G.A.1`)

Which means it can fill `SBAC Focus`, `SBAC Importance`, both `Retention Q` fields, and much of `Misconception Plans` — with strings that match the code instead of merely sounding right. Read it before the TIG's differentiation notes and long before the web.

Then prior lessons in the topic. Reuse beats re-derivation; cite which lesson you took it from.

### Then, targeted lookups

Two to four per lesson. Carnegie is reliably thin on exactly two things:

### 1. Misconceptions — the highest-value research

You want three things a naming alone doesn't give you: **why** students make the error, **what representation dissolves it**, and **what the wrong answer looks like numerically** so a gate question can catch it.

Sources, roughly in order of usefulness for 6th grade math:
- **Illustrative Mathematics / Open Up Resources 6–8** — task-level misconception notes and the "why", genuinely strong on ratio, rate, and expressions.
- **Achieve the Core** — coherence maps showing what prerequisite is actually missing when a student fails a task.
- **NCTM Illuminations** — activity-level; good for concrete models.
- **Smarter Balanced item specifications** — the item shapes students will actually face, which is what `SBAC Focus` should reflect.
- **Desmos Classroom** — good representational sequences worth adapting to the tools that exist.

Paraphrase and adapt. Never quote more than a sentence. Cite what you used in the Carnegie tab's source links so Steele can audit.

### 2. The real-world anchor

The bookend question has to *require* the day's learning — not be decorated by it. Test: can a student answer it with yesterday's math? If yes, it's the wrong question.

It should also matter to an 11-year-old in this room. Generic textbook contexts (two trains, a fruit stand) fail this. Specific stakes work: something about food, money, games, sports, phones, fairness between siblings, or the actual school.

Author the question and its answer together. The answer is `Anchor Answer` and is teacher-only.

### When to skip research entirely

If the topic is well-covered by an existing lesson in the database that already worked, **reuse it** and say which lesson you took it from. Re-deriving a misconception plan that's already written is waste. Read the neighbouring lessons in the topic before reaching for the web — that's usually where the answer is.

## Attribution discipline

Carnegie says **"Learning by Doing"** and **"productive struggle."** Carnegie does **not** describe itself as problem-based and does **not** frame confusion as valuable.

The confusion-is-step-one framing — confused is step one, then *what do you know*, then *try something* — is Steele's own contribution. It's adjacent to Carnegie's productive struggle but distinct from it, and it must never be presented as Carnegie's idea. Keep the line clean in the defense block and anywhere the pedagogy gets described: cite Carnegie for what Carnegie says, and let the culture layer be Steele's.
