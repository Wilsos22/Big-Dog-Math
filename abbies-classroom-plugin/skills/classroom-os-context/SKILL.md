---
name: classroom-os-context
description: Standing context for Steele Wilson's Big Dog Math classroom operating system - the live Next.js/Vercel site at bigdogmath.com, the Notion "Math 6 Lessons" database and its Lesson Steps runtime, the 11-state CRA lesson spine, the four classroom surfaces, the proficiency spine, Abbie the dog mascot, and the teaching philosophy. Load this at the start of any conversation touching the codebase, the Notion lessons, the control panel, the projector or iPad surfaces, warm-ups, manipulatives, rosters, session codes, class mode, or anything Steele is building for his 6th grade math class. Trigger on "the site", "my site", "the lesson page", "the control panel", "Screen Studio", "the warm-up", "Abbie", "the tools", or the Math 6 Lessons database.
---

# Big Dog Math - classroom OS context

Standing context so Steele never re-explains the project. Read it whenever the conversation touches the site, lessons, the control panel, Notion, or classroom workflows.

**`CLAUDE.md` at the repo root outranks this file.** It is the shared brain across Claude Code, Codex, and cloud sessions, it is kept deliberately current, and its own rule 9 requires correcting it the moment something turns out to be stale. When the two disagree, CLAUDE.md is right and this file needs fixing. Read it before any code work.

## The teacher

Steele Wilson, 6th grade math. Young, jokes with students, builds culture around **how to think, not what to think**.

The three steps, which are load-bearing and appear on the walls and the screens: **being confused is step one - that is how you know you are engaged. Step two is what do you know. Step three is try something.** Attempts get rewarded, not just right answers.

Five beliefs: We Think. We Try. We Don't Give Up. We Help Each Other. We Celebrate Effort.

Poster vocabulary, which is the working vocabulary for directions and stems: learning must leave evidence, make thinking visible, try one move, check the evidence, revise and try again, use a resource, ask for help, help a thinker.

**Abbie** is Steele's grown dog and the mascot, voiced by `/api/abbie`. Deadpan, calls him "dad", roasts *him* - never a student, never a student's ability. One sentence, no emoji, no stage directions.

He teaches **Carnegie Learning** but adapts rather than implements faithfully, and that adaptation is deliberately the point: the collaborative classroom day has no software layer at most publishers, and this system generates that missing dataset. Carnegie says "Learning by Doing" and "productive struggle"; Carnegie does **not** frame confusion as valuable. The confusion-is-step-one framing is Steele's own and must never be attributed to Carnegie.

## The product

- **Live:** https://bigdogmath.com (also website-prototype-three.vercel.app)
- **Repo:** https://github.com/Wilsos22/Big-Dog-Math, default branch `main`
- **Local folder:** `/Users/steelewilson/Big Dog Math Site` - **not** inside Documents. It was moved out on 2026-07-21 because Google Drive sync corrupted `.git`, `.next`, and `node_modules` with ` 2`-suffixed duplicates at least six times. Never move it back into a cloud-synced folder.
- Stack: Next.js App Router + TypeScript on Vercel, Supabase, Notion via the data_sources API.

**Priority signal:** the iPad ink surface (`/ipad`, `/board`, the glass sheet over `/teacher/present`) is the most important feature after data collection. Treat ink regressions as urgent. The planned buildout is complete; do not propose new ink features without his word.

## Hard rules

1. **No emojis anywhere.** UI copy, headings, comments, commit messages, docs, Apps Script. The codebase has ~440 pre-existing ones; do not add more, strip them from files you edit.
2. **Never `git add .`** - a Google AI Studio agent and cloud sessions commit to this same repo concurrently. Stage explicit paths. Fetch and merge before pushing.
3. **Verified work ships without waiting** - push the branch, merge to `main`, typecheck and build the merged tree, push, verify the live route changed. Still ask first for: curriculum and Notion content, classroom-orchestration core, locked designs, schema/RLS migrations, anything destructive.
4. Never import `supabaseServer.ts` (service role) into client-reachable code.
5. Secrets live in Vercel env vars only.
6. `/control` stays **dark** for projector contrast. Do not carry the cream theme onto it.
7. Verify the build before saying done - `npm run typecheck` minimum, `npm run build` for anything non-trivial.
8. No real student PII until RLS is tightened. Mock identities stay fully fictional.
9. **Keep CLAUDE.md true immediately** - correct it in the same turn you discover a stale line, as its own commit onto `main`. Anything another agent needs goes there, not in a Claude-only memory note, because Codex cannot read those.

## The lesson runtime

**A lesson lives in Notion; the site renders it from properties and Lesson Steps, never from page body blocks.** There are zero `/blocks` calls in `src/`. Prose written into a page body is invisible to the site - it is for the teacher.

- Lessons database: `collection://e367e541-c0c7-4613-8066-d2e61b6fee64`. Title property is **`Lesson`**. Module and topic are **`Module #`** and **`Topic #`**.
- **Lesson Steps**: `collection://8e467c1b-8937-4902-811e-ca0a2e15af4d`. Title property is **`Step`**. This is what the control panel and every surface actually run. Read them with one SQL query filtered on the lesson page id, not one fetch per step.
- `/api/today` returns the lesson where `Publish Workflow` = `Published` **and** `Date` equals today in `America/Los_Angeles`. **One page per teaching day, never a Date range.**
- Entering an agreed lesson is **transcription, not authoring**. A field the agreement does not dictate stays empty - empty renders as nothing, wrong renders on a classroom screen.

### The 50-minute spine - the canonical new-learning day

This sequence is Steele's, stated directly in July 2026. It is the order, not a suggestion.

| Min | State | What happens |
|---|---|---|
| 0-5 | `warmup` | Google Form retrieval. **The projector carries the hook the whole time** - a real-world problem students only read and think about. Not solvable yet; solvable by the end. |
| 5-8 | `launch` | Brief discussion of how they would attack the hook. Approaches, not answers. |
| 8-9 | `learning-target-readers` | LI and SC revealed, **read aloud by whoever the spinner lands on**. No confidence collected here. |
| 9-16 | `concrete` | **C.** Structured exploration with explicit instructions, **in pairs or table groups** by default. |
| 16-22 | `representational` | **R, and R is normally a website tool.** Teacher demos one problem on it, then students run a stated number of reps. |
| 22-29 | `abstract` | **A.** The assignment appears, and **the numbered routine gets derived here** - see the rule below. Teacher works one, class works one together. |
| 29-30 | `learning-target-readers` | LI and SC again - the review, not the reveal. Carries the **Fist-to-Five**. |
| 30-33 | `question` | **Two problems.** Answers set the private routes. Use `question`, not `learning-check` - the bank's `learning-check` is the 0-to-5 confidence state and the UI special-cases it. |
| 33-46 | `small-group` | Differentiated release. This is the block that flexes. |
| 46-49 | `exit` | Back at seats. Independent evidence. The hook returns. |
| 49-50 | `closeout` | Payoff - you can answer it now - and cleanup. |

Sums to 50 exactly. `review` is conditional; when it runs its minutes come out of `concrete`.

### Abstract always carries a numbered step-by-step

Whenever the mathematics allows it, `abstract` teaches an explicitly numbered routine. Three clauses make it a handrail instead of a recipe:

1. **It belongs in `abstract` and nowhere earlier.** C and R build the meaning; A packages it. A procedure introduced before the meaning is a recipe students run without understanding.
2. **The steps get derived, not delivered.** The teacher works the problem and each number appears on the board as that step happens. The list is the residue of the work, never a preamble to it. Do not put the finished list on screen first.
3. **The numbering is stable across every surface.** Step 4 on the board is step 4 on `Pace Directions`, step 4 on the homework help page, and step 4 in the teacher's visit list. Once that holds, "I'm stuck on 4" becomes something a student can say to a partner or a parent - and the step numbers become the diagnostic vocabulary, so the prepared teacher move is just "go back to step 4".

Include at least one step that is a **decision rather than a move** - the place where the student chooses, and where "why did you do that?" has a real answer. In M1.T1.L1 that is step 3, *which factor is easier for me to work with?*

`universalStateTitle()` renders the state word on the projector every step - `concrete` shows **I Do**, `representational` **We Do**, `abstract` and `independent` **You Do**. Students learn to read those words because they are identical lesson to lesson. **The screen word and the participation structure are separate things**: the real gradual release sits inside each phase (demo then reps in R, one worked then one shared in A), not across them.

Fixed and universal: warm-up 0-5 with the hook up · LI/SC read from the spinner · **every lesson carries a Fist-to-Five**, before the graded items · exit **46-49** · closeout **49-50** · `Advance` Automatic except closeout and private-release states. The release block flexes; what does not flex is stating where the required work lands.

**Transitions are designed, not absorbed.** Every physical move - into pairs, out to vertical surfaces, back to seats before the exit ticket - is its own `transition-hustle` (1 min) or `transition-reset` (2 min) record, and its minutes come out of neighbouring instruction so the day still sums to 50. Same-location changes of prompt or attention use Settle 30s from the iPad Remote and cost no planned minute.

### Three kinds of day

- **New-learning day** - the CRA spine above.
- **Practice day** - error analysis run extensively, gallery walks, the vertical classroom. A different structure, not a CRA day with a game attached. Every activity has to end in something written that could be graded.
- **Review day before a test** - **Bruh** or **Grudge Ball**. Self-contained games, already built, nothing to set up and nothing to author.

Everything in the "fixed and universal" line above applies to all three.

### Discussion is three different moves

Not interchangeable, and each has one home:

1. **Compare what you did** - inside `concrete`, no state, 60-90 seconds, one line on Pace Directions.
2. **Insight with no work** - a 4-minute `discussion` state right after `concrete`, before the tool in R gives the idea a name. Capture two student noticings verbatim and reuse the exact wording in the R demo.
3. **The whiteboard protocol** - think, write, try, discuss with your partner, revise, share out via the spinner wheel. A full work cycle that **is** the release block rather than an addition to it. Wrong work never gets erased, and every student leaves with an individual receipt because the board is not evidence the system can see.

### The release block has two shapes

One coupled decision - the shape decides where the assignment lands.

- **Shape A, whiteboard release.** The class works the assignment's own problems on whiteboards at their desks, no small groups, teacher circulates. The paper assignment goes home rehearsed. `abstract` shrinks to modelling one, because the "we do one together" beat becomes the first board problem; the release runs 35-51.
- **Shape B, small-group release.** `abstract` runs full - model one, do one together on the actual assignment paper - then straight into small groups 38-51, teacher pulling by route while the rest work the paper. The assignment is finished in class.

### Room logistics

Students grab the assignment on the way in and slide it under the Chromebook. **Computers stay open all period**; the whiteboard lies flat on the keyboard deck and manipulatives use the space between partners. That means no class transition for board work - the only movement is the handful pulled to a table in Shape B.

Vertical whiteboards at the walls are a **practice-day** structure, not the everyday release, and those do cost transition minutes (1 out, 2 back).

**Keys under the board.** A whiteboard on a keyboard presses keys. If a text input is focused - the `/live-flow` poll answer box saves drafts on every keystroke - a student leaning on their board types into it and the garbage persists. Do not schedule a text-entry state underneath board work.

### Closing a Chromebook lid does not remove a student

There is **no presence tracking anywhere in the system** - no heartbeat, no `last_seen`, no timeout, no disconnect handler. Joining is a one-time insert into `session_joins`; identity lives in `localStorage` and survives sleep and browser restart. Live state arrives by `setInterval` polling that Chrome pauses on sleep and resumes on wake. `ClassSync.tsx` explicitly swallows transient read errors rather than kicking students out.

Two consequences: the teacher's "Joined: N of 30" is **cumulative, not live**, so it is not an attendance check; and `/exit-ticket` holds typed text in React state only, with no `localStorage` backup - a discarded tab loses a half-written exit ticket silently. That is the one real data-loss path in the student flow.

### The four surfaces

Each is written for its own audience, and the separation is the whole design:

- **Main projector** (`Main Display`) - the mathematics only. No call-to-action verb: the state marker already says I Do / We Do / You Do, so `WATCH:` is the same instruction twice, read at 25 feet by thirty people.
- **Pace + Support projector** (`Pace Directions`) - current directions only, present tense, a sequence not a sentence.
- **Student Chromebook** (`Student Action`) - one device-scoped action.
- **Private teacher iPad** (`Remote Actions`) - look-fors, evidence, routing, overrides. Teacher-only.

### Privacy is absolute

No student ever sees their own score, tier, confidence category, misconception label, or an ability-revealing group name. Public projectors never show names or rosters. Route names rotate their meaning daily so a name never becomes a label. Support changes the path, not the required work - every route completes the identical product.

## The tools

Adding a manipulative takes **two** wirings or it silently fails:

1. A lowercase entry in `TOOL_ROUTES` (`src/app/lesson/page.tsx`) or the Notion `Tool:` name renders as a **dead pill**.
2. An entry in `LiveToolRoute` (`src/lib/liveClassFlow.ts`) **and** the component calling `useLiveToolConfig("/route")` and rendering `<LiveToolBanner tool={...} />`, or published directions are dropped and students see nothing.

Route names that trip people up: `gems` → `/order-of-operations`, `combine like terms` → `/combine-like-terms`, `proportion builder` → `/proportions`, `box method` → `/area-model`, `number line` → `/number-line-plus`.

`src/lib/challengeSkills.ts` is the shared problem bank for `/challenge` **and** assignable practice - 15 skills, one entry is all a new drill needs, no UI change.

## Evidence and the proficiency spine

Design is locked. Build it, do not redesign it.

- Per-domain EWMA mastery bars; accuracy alone caps at `approaching`; a Tier-2 checkpoint >=80% with produced work reaches `mastered`.
- **Misconceptions are a finite exact-match vocabulary** (18 tags in the `misconceptions` table). Clustering keys on the exact string. **Adding a tag is a SQL migration** - a tag typed into Notion never clusters and renders a blank prepared move in `/teacher/rightnow`.
- `reportToolResult` fires **only** inside a joined live session, and only 7 tools emit. At-home tool play records nothing.
- Assigned practice (`practice_assignments`, created at `/teacher/assignments`) writes only to `practice_assignment_attempts` and **never** to `responses` - it moves no mastery bar. `formative.sql`'s comments claim otherwise; they describe intent that was never wired.

## Warm-ups

5 multiple-choice (exactly 4 choices, one correct, no duplicate values) + 1 short-answer bonus. Q1 fluency, Q2-Q3 spiral review, **Q4-Q5 retention of the previous taught day**, drawn from that lesson's `Retention Q4`/`Retention Q5`, pulling backward only. The pipeline is Google Apps Script, mirrored in the repo as `warmup-*.gs`.

## Design system

Warm Notebook, decided 2026-07-20, turn 12 canonical.

- Font `--bdb-font` = **Albert Sans**, not Georgia. Georgia survives on ~7 legacy teacher pages only.
- Palette is `--bdb-*` in `globals.css`: ground `#faf6ee`, card `#ffffff`, ink `#201e1a`, line `#ece4d4`, amber `#fcaf38`, teal `#50a3a4`, brown `#674a40`, coral `#f95335`, green `#2f9e6f`.
- **Contrast rule:** white text fails AA on teal, coral and green - filled controls use the deep companions `--bdb-teal-deep`, `--bdb-coral-deep`, `--bdb-green-deep`.
- Pages self-style with a per-page inline `<style>` and a unique class prefix reading `var(--bdb-*)`.
- **Manipulative layout:** reference material in a large LEFT rail, the thing being acted on in the center, the product being built on the right. Never stack reference under the workspace. `/divisibility` is the reference implementation.
- Copy tone: friendly, second person, playful. Teach how to think, not what to think. Still no emojis.

## Authoring surfaces

`/teacher/studio` is Screen Studio - it embeds the **real** `/teacher/present` and `/teacher/pace` in scaled iframes and posts the draft as a snapshot, so redesigning a surface never needs a matching Studio change. Its per-step editor includes the slide-extras panel beside Main Display, so a slide's text and the format of the components on it are edited in one place. `/teacher/slides` remains for focused overlay work and renders the same shared editor.

## What Steele usually wants

1. **Instant feedback on student work during class** - the high-value one. Read the response, name the specific misconception, give one concrete move he can make in the next thirty seconds. Not a long analysis.
2. New site features and manipulatives.
3. Design and UX passes that match Warm Notebook and reduce what students have to look at.
4. Automating something that should run itself.

Suggest skills, plugins and connectors that would do the job thoroughly, even ones he does not have yet. Reduce token usage where it does not hurt the product.

For building or revising a single lesson to deployment depth, use the **lesson-deployment-builder** skill. For bulk stubs across an unbuilt unit, use **lesson-database-builder**.
