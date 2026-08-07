# Notion write contract — Math 6 Lessons

Verified against the live database July 2026. Property names are literal and case-sensitive. A misnamed property is silently ignored on write; an unlisted select value silently creates a new option and pollutes the schema.

## Contents

1. [IDs](#ids)
2. [Property-name traps](#property-name-traps)
3. [Lesson properties you author](#lesson-properties-you-author)
4. [Legal select values](#legal-select-values)
5. [Formats with required syntax](#formats-with-required-syntax)
6. [Lesson Steps write contract](#lesson-steps-write-contract)
7. [Tool routes](#tool-routes)
8. [What the site actually reads](#what-the-site-actually-reads)
9. [Traps](#traps)

---

## IDs

| Thing | ID |
|---|---|
| Math 6 Lessons data source | `collection://e367e541-c0c7-4613-8066-d2e61b6fee64` |
| Math 6 Lessons database page | `613d13a5-ac90-4ab3-9f5f-b7da95911ec3` |
| **Math 6 Lesson Steps** | `collection://8e467c1b-8937-4902-811e-ca0a2e15af4d` |
| Math 6 Resource Library (TIG, Clarity Guide, Slides) | `collection://28e2eba1-de37-81e6-bd6e-000bfd93f84c` |
| Warm up Links | `collection://3142eba1-de37-8024-b6cc-000b38db5d17` |
| Student Submissions (where exit-ticket data lands) | `collection://bf89a344-70dd-4b4f-ae49-fdef289be085` |
| Math 6 Topics | `collection://e87f119f-1f49-4858-a390-688774076ba1` |
| Math 6 Pacing Guide 2026–27 | `collection://ab4bc464-edb9-440d-bdfc-0a330d4e2bc4` |
| Class Day Log | `collection://fdbe0eaa-f212-455c-bfd2-b30e762e585a` |

**Known decoys — never the write target.** Two parallel accelerated lesson databases exist, named roughly `Math 6 Accelerated Lessons` and `Math 6 Acc Lessons` (one has a leading space in its name). They hold same-coded lessons and will surface in any search for a lesson code — a search for `M3.T2.L3` legitimately returns four pages across four databases.

**Always confirm the parent database before writing.** The only write target is `collection://e367e541-…`; if a page's parent isn't that, you have the wrong row.

The upside: those accelerated rows often carry the *fullest transcribed Carnegie sequence* for a lesson, so they are worth reading for content when the TIG PDF is closed. They run 45-minute sessions rather than 50, so take the pedagogy and ignore the timing.

Gold-standard pages to read as exemplars before authoring:

| Lesson | Page ID | Why |
|---|---|---|
| `M1.T1.L2-D1` Factors and Multiples Foundations | `39d2eba1de37812ab44fd089468c391b` | Deepest per-state spec. The model for the state-spec tab. |
| `M1.T1.L1` Taking Apart Numbers and Shapes | `3962eba1de3780ec81eefca62eb1ad3b` | Only fully-wired page: warm-up, exit ticket, resources, 15 Lesson Steps. Has embeds — do not overwrite. |
| `M1.T2.L1-D1` Parallelograms and Triangles | `39d2eba1de3781a290cce40f10a8f7d6` | The lean repeatable 5-tab shape ~80 lessons use. |

---

## Property-name traps

These are the ones that break writes. The older `lesson-database-builder` skill gets several of them wrong.

| Wrong | Right |
|---|---|
| `Module` | **`Module #`** |
| `Topic` | **`Topic #`** (select). `Topic Name` is a *relation*, different thing. |
| `Name` (title) | **`Lesson`** is the title property on lessons. **`Step`** is the title on Lesson Steps. |
| `Assignment` | No such property. There are two *file* properties: `Assignment Link`, `Assignments`. |
| `Exit Ticket Link` as a relation | It is a **url**. There is no exit-ticket database at all. |
| `Tool: Combining Like Terms` | **`Tool: Combining Like terms`** — lowercase t on "terms". |
| `Tool: Percent Bar` | **`Tool: Percent Bar (1)`** — the literal " (1)" is part of the name. |

`Warm Up Link` is a relation with limit 1 → Warm up Links. `Warm up links 1` is a near-duplicate relation with no limit to the same target. Use `Warm Up Link`.

---

## Lesson properties you author

Text unless noted. Descriptions are Notion's own where they clarify intent.

### Identity and placement
| Property | Notes |
|---|---|
| `Lesson` (title) | Lesson identifier. Convention: `M1.T2.L1-D1 Descriptive Title`. |
| `Lesson Title` | Title without the code. |
| `Subtitle` | |
| `Lesson Code` | Stable code used by the site, Google Forms, and assignment sync. `M{m}.T{t}.L{l}-D{n}` for teaching days, `-P{n}` for practice, `-R{n}` review, `-LAUNCH`, `.C{n}`. |
| `Lesson #` | |
| `Date` | date. **Never a range.** One page per teaching day — `/api/today` matches an exact date in `America/Los_Angeles`. |
| `Module #` | select |
| `Topic #` | select |
| `Course` | select — only `Math 6` |
| `Standards` | multi_select — see legal values |
| `Sessions`, `Practice Day`, `Skip`, `Classroom Mode`, `Publish Workflow` | select — see legal values |
| `Canvas / Infinite Campus Name` | Standardized assignment name used in both systems. |

### Learning design
| Property | Notes |
|---|---|
| `Learning Intention` | Student-facing. "We are learning to…" |
| `Success Criteria` | One criterion per line — the menu across the arc. |
| `Selected Success Criterion` | **Exactly one line, must start `I can`.** Code-validated: multiple lines, multiple "I can" occurrences, or a non-`I can` opening all fail and render a placeholder. |
| `Essential Ideas` | From the Carnegie TIG. |
| `Summary`, `AI summary` | |
| `Anchor Problem` | The real-world bookend question. Student-facing. |
| `Anchor Answer` | **Teacher-only.** Excluded from the student payload in code. |
| `Agenda` | One step per line. Renders as the numbered journey on the student lesson page. |
| `Reminders` | |

### Discussion and vocabulary
| Property | Notes |
|---|---|
| `Discussion Prompt` | Primary lesson discussion prompt. |
| `Discussion Stems` | One sentence stem per line. |
| `Discussion Vocabulary` | One term, or `term — definition`, per line. |

### Evidence and routing
| Property | Notes |
|---|---|
| `Mid-Lesson Check Prompt` | Fist-to-Five prompt tied to the learning intention + selected criterion. Teacher-only. |
| `Live Questions` | One planned student-screen question per line, in lesson order. Teacher-only. |
| `Practice Problems` | One planned live-check or practice problem per line. |
| `Misconception Plans` | Format below. **Teacher-only.** |
| `Exit Ticket Prompt` | Single-question exit ticket. Teacher-only in the payload. |
| `Exit Ticket Answer` | Teacher answer or scoring guidance. Teacher-only. |
| `Exit Ticket Choices` | |
| `Optional Support` | Optional assigned support, manipulative, or teacher conference path. |
| `Retention Q4`, `Retention Q5` | Warm-up items that check THIS lesson on the NEXT school day. Format below. Read only by `warmup-week-builder.gs`; never reach the website. |
| `SBAC Focus`, `SBAC Target`, `SBAC Importance` (select) | |

### Work and logistics
| Property | Notes |
|---|---|
| `Required Paper Work` | Full required paper assignment, without reproducing the problems. |
| `Required Digital Work` | Only required digital submissions for this day. |
| `Due and Turn In` | Due time and the exact paper or digital submission destination. |
| `Help Path` | Ordered help routine shown during independent work. |
| `Big Dog Challenge` | One optional challenge, after all required work is complete. |
| `Supplies` | Comma- or line-separated. |
| `Tools` | Tool names, comma-separated. They become buttons — every name must resolve in `TOOL_ROUTES`. |
| `Supply: Pencil`, `Supply: Notebook`, `Supply: Chromebook` | checkbox |
| `Tool: Whiteboard`, `Tool: Number Line`, `Tool: Percent Bar (1)`, `Tool: Combining Like terms` | checkbox |
| `Homework Tool Assignment Created` | checkbox. Set it when a manipulative is assigned as graded homework. Notion's own note: **target at least 2 per week** — this is expected practice, not a fallback. |

Supplies and tools work **two ways at once**: free text in `Supplies`/`Tools`, plus the prefixed checkboxes. The site unions them. With neither set it falls back to defaults and flags `suppliesConfigured: false`.

### URL properties (leave empty until the artifact exists)
`Exit Ticket Link`, `Exit Ticket Edit Link`, `Exit Ticket Response Sheet`, `Explainer Video`

### File properties (cannot take a string)
`Assignment Link`, `Assignments`, `Explainer Videos`

### Relations
`Warm Up Link` (limit 1 → Warm up Links) · `Lesson Steps` (→ Lesson Steps) · `Lesson Resources` (→ Resource Library) · `Pacing Unit` (→ Pacing Guide) · `Topic Name` (→ Topics) · `Student Submissions` · `Class Day Logs` · `Blocked by` / `Blocking` (self)

### Never write
`Create Warm-up` is a **button**. Notion reports it as unavailable. Omit it entirely.

---

## Legal select values

Exact strings. Anything else creates a new option.

**`Publish Workflow`** — `Needs Mapping` · `Draft` · `Ready for Review` · `Published`

**`Module #`** — `Module 1` · `Module 2` · `Module 3` · `Module 4` · `Module 5`

**`Topic #`** — `M1.T1` `M1.T2` `M1.T3` `M2.T1` `M2.T2` `M2.T3` `M3.T1` `M3.T2` `M3.T3` `M4.T1` `M4.T2` `M5.T1` `M5.T2`
(No `M4.T3`, no `M5.T3`.)

**`Course`** — `Math 6`

**`Classroom Mode`** — `No student computers` · `Chromebook rehearsal` · `Academic lesson` · `Practice or game` · `Assessment`

**`Practice Day`** — `Practice Day` · `Chromebooks Distributed` · `2 Practice Days` · `No`

**`Sessions`** — `1 Session` … `5 Sessions`

**`Skip`** — `Yes` · `No` · `Maybe`. A value of `yes` hides the page from the site.

**`SBAC Importance`** — `Not covered` · `Minimal` · `Moderate` · `Major`

**`Warm-Up Build Status`** — `Not requested` · `Requested` · `Building` · `Ready` · `Error`

**`Standards`** (multi_select, 31 existing options) —
`6.RP.1` `6.RP.2` `6.RP.3` `6.RP.3a` `6.RP.3b` `6.RP.3c` `6.RP.3d` `6.NS.1` `6.NS.2` `6.NS.3` `6.NS.4` `6.NS.6` `6.EE.1` `6.EE.2a` `6.EE.2b` `6.EE.2c` `6.EE.3` `6.EE.4` `6.EE.5` `6.EE.7` `6.EE.8` `6.EE.9` `6.G.1` `6.G.2` `6.G.4` `6.SP.5d` `5.NBT.1` `5.NBT.3b` `5.NF.4` `5.NF.6` — plus a malformed `6.EE.` (trailing dot). **Never emit `6.EE.`** and don't try to fix it.

Missing but real: `6.EE.6`, `6.NS.5`, `6.NS.7*`, `6.NS.8`, `6.G.3`, `6.SP.1`–`6.SP.5c`. If a lesson needs one, add it deliberately and tell Steele you created a new option.

**Two notations coexist, deliberately.** The Notion `Standards` select uses the short form (`6.RP.1`, `6.EE.3`). The proficiency spine's `standards` table and `Retention Q4/Q5` use **dotted-letter** CCSS (`6.RP.A.1`, `6.NS.B.4`, `6.EE.A.3`), and that is the form the mastery engine, `sbacCheckpoints.ts`, and the `misconceptions` table key on. Use the short form in the Notion select, dotted-letter in `Retention Q` and anywhere you reference a spine standard. Don't cross-copy.

The 18 standards the spine currently covers (Semester 1, M1–M2 only): `6.EE.A.3` `6.EE.A.1` `6.NS.B.4` `5.NF.B.4` `6.NS.A.1` `6.G.A.1` `6.G.A.2` `6.G.A.3` `6.G.A.4` `5.NBT.A.3b` `6.NS.B.3` `6.RP.A.1` `6.RP.A.3` `6.RP.A.3a` `6.RP.A.3b` `6.RP.A.2` `6.RP.A.3c` `6.RP.A.3d`. A Module 3–5 lesson has no spine standard yet; note it rather than inventing one.

No `status`-type properties exist on this database.

---

## Formats with required syntax

**`Misconception Plans`** — one per line:
```
misconception tag :: prepared teacher move
```
Parsed by `parsePlans()` in `src/app/teacher/rightnow/page.tsx`, which splits on `\n` **only** (commas are safe here, unlike in `Agenda`), trims, and lowercases. It then matches the tag **character-for-character** against cluster names from `grouping.ts`. A non-matching tag renders a blank prepared move at exactly the moment Steele needs it.

### The vocabulary is finite and lives in the database

Per CLAUDE.md (corrected 2026-08-06): "Misconceptions are a FINITE exact-match vocabulary (**36 tags**, no NLP); clustering keys on exact string match. Unmatched wrong choices map to `other`."

**There are 36 canonical labels as of 2026-08-06, not 13.** The list below is the original 13 and is
**incomplete** — it predates the factors/multiples, fraction-division, and divisibility tags added in
July 2026. Do not use it to decide whether a tag is canonical.

**The source of truth is `src/lib/misconceptions.ts`** — TypeScript, type-enforced at every call site,
with `npm run test:misconceptions` asserting parity against the `supabase/proficiency.sql` seed in both
directions. Read that file and match against it. A tag that is genuinely absent needs a SQL migration
*and* a TS edit; a tag that is merely missing from the stale list below needs neither.

The original 13, kept for reference only: `verbatim from the misconceptions table seed in supabase/proficiency.sql`

| Label | Standard |
|---|---|
| `treats ratio as additive` | 6.RP.A.3 |
| `reverses part and whole in percent` | 6.RP.A.3c |
| `adds denominators when adding fractions` | — |
| `misplaces decimal in division` | 6.NS.B.3 |
| `ignores order of operations` | 6.EE.A.1 |
| `confuses coefficient with exponent` | 6.EE.A.1 |
| `sign errors with negatives` | — |
| `reverses inequality symbol` | — |
| `confuses area vs perimeter` | 6.G.A.1 |
| `forgets to halve base × height for triangle area` | 6.G.A.1 |
| `confuses mean and median` | — |
| `miscounts frequencies in a data display` | — |
| `distributes to first term only` | 6.EE.A.3 |

**Adding a tag is a SQL migration, not a Notion edit.** A new label has to be inserted into the `misconceptions` table (it's a foreign key from `recommendations.misconception`). Typing an invented tag into Notion produces a plan that never matches a cluster and never renders. So when a lesson's misconception has no canonical label, do not quietly coin one — write the plan for the teacher's benefit, and **flag it as needing a `misconceptions` row** so Steele can decide whether it earns one.

**There is a real coverage gap.** The 13 cover ratio, percent, fractions, decimals, order of operations, exponents, negatives, inequalities, area/perimeter, triangle area, mean/median, data displays, and distribution. Nothing covers GCF/LCM, factor lists, or factor-list stopping rules — even though `6.NS.B.4` (GCF and LCM) is in the standards table. So the entire M1.T1 factors arc has no canonical tag, and all three of the good lessons carry tags that will not cluster. Say so rather than pretending a near-match works.

**Where to source a tag, in order:**

1. **The 13 above** — use the exact string when one fits. This is the only way the plan renders in `/teacher/rightnow`.
2. **`src/lib/sbacCheckpoints.ts`** — carries per-lesson misconception strings keyed by lesson code, and its `error-analysis` item type pairs each wrong answer with a misconception. Check whether these already match a canonical label.
3. **A descriptive lesson-specific tag**, clearly marked as not-yet-canonical, plus a note that it needs a `misconceptions` row to become live.

Whatever you use, **reuse the identical string across the whole topic.** Clustering is exact-match and a student needs 2+ occurrences of the *same string* to cluster at all, so a tag spelled two ways is two clusters of one.

The Notion `Misconception Flag` select on Student Submissions (`GCF/LCM mix-up`, `Forgot to distribute`, `Stopped early on factors`, `No meaning sentence`) is a **separate, page-level** vocabulary — not the clustering one. Don't confuse them.

**`Retention Q4` / `Retention Q5`** — exactly:
```
Question | ans: correct | wrong: value -> misconception tag | ccss: 6.NS.B.4
```
These check *this* lesson on the *next* school day.

**Multi-line text** — write real newlines. The read path renders them as `<br>`. Splitting behaviour differs per field and is not uniform: `lines()` (used for `Agenda`, `Supplies`, `Tools`) splits on `\n` **and commas**; `parsePlans()` for `Misconception Plans` splits on `\n` only. Check which applies before assuming a comma is safe.

**Rich text chunking** — Notion caps a rich-text run at 2000 chars; the repo chunks at 1900. Long fields are fine but will be split.

---

## Lesson Steps write contract

Data source `collection://8e467c1b-8937-4902-811e-ca0a2e15af4d`. **This is what the control panel, projector, and student screens actually run.** A lesson without Lesson Steps is not deployable no matter how complete its properties.

### Reading them — do this in one call, not fourteen

Following the `Lesson Steps` relation page by page costs one fetch per step, and a built lesson has 11–16. Query the data source instead and get every field of every step at once:

```sql
SELECT * FROM "collection://8e467c1b-8937-4902-811e-ca0a2e15af4d"
WHERE "Lesson" LIKE '%<lesson page id>%'
ORDER BY "Order"
```

Same trick for the neighbours at Step 0 — one query over Math 6 Lessons filtered by `"Topic #" = 'M1.T2'`, selecting only the columns you need, beats fetching each page. And when `Lesson Resources` is empty, a `notion-search` scoped to `collection://28e2eba1-…` by lesson code finds the Resource Library row in one call.

Checkboxes read as `"__YES__"` / `"__NO__"`; NULL means false. Multi-line text reads back with `<br>` for newlines. The `Create Warm-up` button reports as unavailable in SQL.

### Fields

One record per state. Title property is `Step`.

| Field | Type | Notes |
|---|---|---|
| `Step` | title | Human label, e.g. `Concrete — build 24 as an area` |
| `Lesson` | relation | → the lesson page. Required. |
| `Order` | number | integer 0–1000, sequential |
| `Start Minute` | number | 0–600, contiguous with the previous step's end |
| `Duration` | number | >0, ≤600 |
| `State ID` | text | From the state catalog. Free text, so spelling matters. |
| `Main Display` | text | Exact content for the main interactive projector this step |
| `Pace Directions` | text | Current directions **only** for the Pace + Support projector |
| `Student Action` | text | One current Chromebook or physical action |
| `Student Directions` | text | |
| `Teacher Notes` | text | **Teacher-only** |
| `Remote Actions` | text | Private iPad controls and teacher-only data |
| `Question` / `Choices` (one per line) / `Correct Answer` | text | `Correct Answer` is teacher-only |
| `Vocabulary` | text | one term or `term — definition` per line |
| `Discussion Stems` | text | one stem per line |
| `Paper Task`, `Slide Overlay`, `Tool`, `Standard` | text | |
| `Link` | url | External Google Form, assignment, or resource |
| `Required` | checkbox | |
| `Work Space Available` | checkbox | Opens the side writing panel while keeping the problem visible |
| `Advance` | select | `Automatic` · `Manual` |
| `Response Mode` | select | `None` · `Google Form` · `Paper` · `Short Answer` · `Multiple Choice` · `Multiple Choice + Explain` · `Fist to Five` · `Assigned Tool` · `Physical Response` |
| `Poll Kind` | select | `short-answer` · `multiple-choice` · `fist-to-five` |
| `AI Context` | text | **Do not overwrite blindly** — see below |

**`Poll Kind` / `Response Mode` asymmetry:** `Response Mode` has `Multiple Choice + Explain`; `Poll Kind` does **not** have `multiple-choice-explain` in the write path. Use `Poll Kind: multiple-choice` with `Response Mode: Multiple Choice + Explain`.

`Multiple Choice + Explain` shows tappable choices plus a required written explanation. The choice lands in `poll_answers.answer` (tallies, correctness, and City Routes exact-match it) and the explanation in `poll_answers.explanation`. Use it on any exit or gate item where the reasoning is the evidence — the three good lessons all do.

**Response Mode fallback chain**, per CLAUDE.md: unknown or blank `Response Mode` falls back to `Poll Kind`, then to state-id defaults (`question` → short-answer, `learning-check` → fist-to-five). **`exit` has NO fallback**, so exit steps must always carry an explicit `Response Mode`.

**`AI Context` carries three magic markers.** Read the existing value and preserve them:
- `[BDM_PUBLIC_SURFACES:split|linked]` — `linked` defaults only for `learning-target-readers` and `ipad-kid`; everything else `split`.
- `[BDM_CREATE_TOKEN:<16–100 chars>]` — idempotency trailer.
- `[BDM_ROUTINE_CONFIG:<base64url>]` — gallery-walk or small-group config. Clobbering this breaks the routine, and because it's base64 a case-insensitive text search will not reliably find it. Audit case-sensitively.

Only Lesson Steps have an in-app write path (`/teacher/studio`, `/teacher/slides`). Lesson-level properties must be authored in Notion.

---

## Tool routes

Every `Tool:` checkbox and every name in `Tools` must resolve here (matching is lowercased). **An unlisted name renders as a dead pill** a student will click during class.

`whiteboard` → `/whiteboard` · `number line` → `/number-line-plus` · `fraction bars` → `/fraction-bars` · `group bars` → `/group-bars` · `percent bar` → `/percent-bar` · `algebra tiles` → `/algebra-tiles` · `equation builder` → `/equation-builder` · `gems` → `/order-of-operations` · `order of operations` → `/order-of-operations` · `combine like terms` → `/combine-like-terms` · `proportions` → `/proportions` · `proportion builder` → `/proportions` · `timer` → `/timer` · `balance beam` → `/balance-beam` · `box method` → `/area-model` · `distributive area method` → `/distributive-area` · `distributive area` → `/distributive-area` · `area explorer` → `/area-explorer` · `area of shapes` → `/area-explorer` · `ratio explainer` → `/ratio-explainer` · `ratios explainer` → `/ratio-explainer` · `divisibility` → `/divisibility` · `divisibility rules` → `/divisibility` · `place value` → `/place-value` · `place value reader` → `/place-value` · `place value mirror` → `/place-value-mirror` · `place value chart` → `/place-value-mirror` · `long division` → `/long-division` · `dividend in the house` → `/long-division`

Plausible-looking routes that **do not exist** and will render as dead pills: `/gems` (it is `/order-of-operations`), `/combining-like-terms` (it is `/combine-like-terms`), `/ratio-proportion-builder` (it is `/proportions`), `/number-line` (it is `/number-line-plus`).

**Publishing a tool to student screens** additionally requires the route to be a `LiveToolRoute`: `/whiteboard` `/number-line-plus` `/percent-bar` `/equation-builder` `/balance-beam` `/distributive-area` `/area-explorer` `/order-of-operations` `/fraction-bars` `/algebra-tiles` `/area-model` `/multiplication-fluency` `/combine-like-terms` `/ladder-method` `/group-bars` `/proportions` `/coordinate-grid` `/term-identifier` `/challenge` `/exit-ticket` `/checkpoint`.

**Tool evidence — only 7 tools emit, and only inside a session.** `reportToolResult()` in `src/lib/toolEvidence.ts` writes one aggregate `responses` row per student × tool × day (score 0–5 accuracy plus the day's most-frequent misconception tag, at warm-up weight), and a per-problem row when the tool maps to a seeded standard. The emitting tools are exactly:

`equation-builder` · `gems` (`/order-of-operations`) · `combine-like-terms` · `balance-beam` · `area-model` · `distributive-area` · `area-explorer`

The file's own comment is the constraint that matters for homework: *"Only fires when this device has JOINED A LIVE SESSION (localStorage `bdm-student-session`) — free play doesn't write evidence."*

So **unassigned tool practice at home produces no data.** The routes are public and reachable, but free play writes nothing to the spine. If the evidence matters, collect it in class, or catch the skill on the next day's `Retention Q4`/`Q5`.

### Assignment properties: what the app reads

Three of the assignment-ish properties are read by nothing at all. Set them for Steele's own records if useful, but never describe them as triggering behavior.

| Property | Read by the app? |
|---|---|
| `Assignment Link` | **Yes.** `resolveFirstLink` on `["Assignment Link", "Assignment", "Assignment URL"]` → rendered on `/lesson` as an "Open assignment" button, `target="_blank"`. A plain outbound URL. |
| `Required Digital Work` | **Yes**, as display text only, in the independent-support panel. Creates nothing. |
| `Due Date` | **Yes**, displayed next to the assignment link. |
| `Assignments` (plural, file) | **No.** Zero references in the repo. |
| `Homework Tool Assignment Created` | **No.** Zero references in the repo. Steele's own tracking against his ≥2-per-week target. |

**The one bridge to the app's assignment system:** paste an `/assignment/<uuid>` URL into `Assignment Link`. Because that property is a URL rendered as a button, it surfaces an assigned practice drill on the student lesson page — which is otherwise only discoverable on `/explore`. It's manual and there is no automatic link between the two systems.

**The app's assignable homework** is `practice_assignments`, created at `/teacher/assignments`: a skill from the seven-item `challengeSkills` registry, level 1–3, rounds 1–50, one class or all. Attempts land in `practice_assignment_attempts` and **never in `responses`** — so today it moves no mastery bar, no stage gate, no grouping.

The `assignments` / `assignment_problems` / `problems` tables have RLS policies but zero application code — schema without a UI. Steele is wiring this area, so treat these as *designable but unwired*: write the assignment the lesson needs, tag it `[needs wiring: ...]`, and report it as a build item. What never changes is the reporting rule — never tell him something grades or tracks when it doesn't.

Some tools accept a typed config, which is how you preload a specific problem:
```
/number-line-plus   { start, change }
/percent-bar        { whole, percent, part, unknown: "part"|"whole"|"percent" }
/equation-builder   { coefficient, constant, solution }
/order-of-operations, /algebra-tiles   { expression }
/distributive-area  { set: "24x7,16x8" }
/ladder-method      { set: "24,36,60" }
```

Verify against `src/app/lesson/page.tsx` (`TOOL_ROUTES`) and `src/lib/liveClassFlow.ts` if anything looks off — the repo is authoritative.

---

## What the site actually reads

**The site never reads Notion page body blocks.** Zero calls to `/blocks` anywhere in `src/`. Everything rendered comes from properties on the lesson page, its related Lesson Steps records, and the page cover image.

So the body is for the **teacher**, and the properties + steps are for the **software**. Both matter, for different readers, and a fact that lives only in the body will never appear on a screen. If something must drive behavior, it goes in a property or a step.

Property-type coercion handles `title`, `rich_text`, `url`, `select`, `multi_select`, `date`, `formula`, `rollup`. **Everything else returns empty** — `people`, `files`, `status` render as nothing.

Student-payload exclusions (never reach a student): `Anchor Answer`, `Misconception Plans`, `Live Questions`, `Mid-Lesson Check Prompt`, `Exit Ticket Prompt`, `Exit Ticket Answer`, and all of `sequence.steps`.

Auto-generated projector visuals are inferred from step **text**, and only five kinds exist: `scoreboard`, `storyboard`, `quantity-model` (counters/tiles), `area-model`, `ratio-forms`. Area models auto-draw only on `concrete` and `representational` steps when the text names an `a x b` product; phrasing "into 10 + 6" dashes the partition. Stacked `=` or `__` blanks render as a worked-equation stack instead.

---

## Traps

1. `Publish Workflow = Published` **and** `Date` = today in `America/Los_Angeles` is what puts a lesson on student screens. Stay on `Draft` for new builds until Steele approves; on a revision, leave an existing `Ready for Review` value alone.
2. Never a `Date` **range**. One page per teaching day — the retention chain depends on "the previous school day's page." An existing range is a defect worth reporting, and usually means the page holds two days of material that want a D1/D2 split.
3. **Commas in `Agenda` silently split one line into several.** `lines()` splits on commas as well as newlines, so "Build the model, then write it" becomes two agenda steps on the student page. Same hazard in `Supplies` and `Tools`. Check existing pages for this — it is live on lessons already marked `Ready for Review`.
4. Title is `Lesson`, not `Name`. Step title is `Step`.
5. Body content with `<pdf>`, `<video>`, `<database>`, `<mention-page>`, or a Google Slides embed **cannot be regenerated from markdown**. Never wholesale-replace such a body. Resource Library rows carry more embeds than lesson pages.
6. `AI Context` on a **new** record: leave it unset and let defaults apply. Don't hand-author `[BDM_CREATE_TOKEN:…]` or the surface marker. On an **existing** record, read it and preserve what's there.
7. `SBAC Focus` and `SBAC Importance` are derivable from `sbacCheckpoints.ts` plus the standard. `SBAC Target` is a specific Smarter Balanced label — leave it empty unless you've actually read it.
8. Another agent commits to this repo. Fetch and pull before editing files; `git add` specific paths only.
9. No emojis, anywhere — UI copy, Notion content, comments, commit messages.
10. Re-fetch after writing. Partial success is possible and silent.
