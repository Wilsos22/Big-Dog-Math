# Audit - /division-house and /decimal-steps

Date: 2026-08-03. Read-only audit of code and classroom UX. Two independent agents read each tool
against the quality bar in `CLAUDE.md`; every claim below was re-verified against the source before
it was written down. Nothing was changed.

Findings are ranked by what would hurt in a live class, not by how hard they are to fix.

---

## The two that will embarrass you in front of the room

### 1. `/decimal-steps` drops the placeholder zero from every single-digit-multiplier product

`src/lib/decimalSteps.ts:724-729`, and the missing counterpart at `:779-780`

```ts
const text = String(value);                 // <- unpadded
const prefix = single ? "prod" : `p${j}`;
...
if (!single) {
  lay("sum", prod, "prod");                 // <- the padded string is used ONLY here
}
```

`prod` (`:686`, `String(productInt).padStart(places + 1, "0")`) carries the placeholder zeros. When the
multiplier is one digit, that row *is* the sum row, but it is laid from the unpadded `String(value)`, so
the zeros are never created as cells. Executed against the compiled engine:

| problem | headline `answerText` | what the board's sum row spells |
|---|---|---|
| `0.3 x 0.3` | `0.09` | `_._9` |
| `0.07 x 0.8` | `0.056` | `_._56` |
| `0.008 x 9` | `0.072` | `_._72` |
| `0.25 x 0.4` | `0.100` | `_.100` |

(`_` is an empty grid cell.) The multi-partial path is fine - `0.25 x 0.75` renders `0.1875` correctly.
This only bites one-digit multipliers, which is most of an entry-level decimal set.

Why it matters: the placeholder zero in `0.3 x 0.3 = 0.09` is the hardest single idea in multiplying
decimals and the reason this board exists. A student walks all seven steps right, moves the point, and
the board reads `. 9` with a hole where the tenths zero belongs - while the headline above it says
`0.09`. On a projector that is your own board contradicting itself.

Fix: `const text = single ? prod : String(value)`, and add the new leading cells to `move-product`'s
`reveal` so they appear when the point lands (otherwise the contract's "nothing on the board is
unreachable" check at `scripts/decimal-steps-contract.mjs:214` will correctly fail). Then add a contract
check that the answer row read against the settled marker spells `answerText`.

### 2. `/division-house` marks a correct tap wrong on any two-digit divisor

`src/lib/divisionHouse.ts:202`, `:248`, `:279`

```ts
const firstDivisorSlot = "ds-0";
...
id: `pick-divisor-${i}`, slots: [firstDivisorSlot],
...
id: `pick-mult-${i}`,    slots: [firstDivisorSlot],
```

The divisor is laid one digit per cell (`ds-0`, `ds-1`) and every divisor cell renders as a live button.
So for `144 / 12` a student who taps the **2** of "12" - which *is* the divisor - gets the miss nudge
"It sits outside the house, on the left." The pulse lights only the **1**, so the board also presents
"12" as if the 1 were a separate number.

This inverts the invariant `CLAUDE.md` states for this exact tool: "a multi-digit number is ONE number
... which is why a prompt carries `slots: string[]` and not a single id." Divisors up to 99 are accepted
(`:105`), `parseHouseSet` passes them, and `/control` (`src/app/control/page.tsx:3795-3807`) accepts them
with no warning - so a teacher typing `144/12, 288/24` mid-lesson ships a tool that punishes correct
taps. The contract never exercises a two-digit divisor (every case is 3, 4, 6, 7, 8, 9), so nothing
catches it.

Fix: build the list once - `const divisorSlots = dsText.split("").map((_, i) => \`ds-${i}\`)` - and use
it for both prompts, keeping `slots[0]` as the `visual.from`/`to` anchor. Add a `144/12` case to the
contract.

---

## Would hurt in a live class

### 3. `/decimal-steps` teaches a false rule about which way the decimal moves

`src/lib/decimalSteps.ts:823-826`

```ts
{ text: "Left", correct: true, why: "Right - counting in from the right end makes the answer smaller,
  which is what multiplying by a piece of a number does." },
```

Unconditional. `6.2 x 3 = 18.6` - the tool tells the student the answer got *smaller* because they
multiplied "by a piece of a number." Three is not a piece of a number and 18.6 is not smaller. `6.2 x 3`
is in the board's own `FALLBACK` set (`DecimalStepsBoard.tsx:47`), so this is on screen by default.

Worse, it is delivered as the *confirmation* of a correct answer, at the moment the rule is forming, and
it will be recited back on a test.

Fix: make the `why` place-value based and factor-independent - "the two numbers had N digits after their
points altogether, so the answer has N; you count in from the right end." The size argument only holds
when both factors are under 1; either scope it to that case or drop it.

### 4. `/decimal-steps` estimate step is theatre for any answer under about 2.5, and rejects a sensible estimate

`src/lib/decimalSteps.ts:271-272`

```ts
const rounded = Math.round(value);
const tolerance = Math.max(1, Math.abs(value) * 0.2);
```

Measured bands:

| problem | true | accepts |
|---|---|---|
| `0.07 x 0.8` | 0.056 | anything in `[-1, 1]` - including `1` and `-1` |
| `1.1 - 0.9` | 0.2 | `[-1, 1]` - `-1` passes |
| `9.6 / 0.4` | 24 | `[19.2, 28.8]` - **`19` fails**, `28` passes |
| `12.4 + 3.75` | 16.15 | `[12.77, 19.23]` - correct |

Three separate defects. The `Math.max(1, ...)` floor swallows the whole neighbourhood for small answers,
so every product under 1 - most of the multiply curriculum - accepts anything and the step means nothing.
Negatives pass, so a stray minus sign earns a full-screen "Yes!". And the band is centred on
`Math.round(value)` rather than `value`, which is why "round 0.4 up to a half, so about 19" - the exact
move you want - fails by 0.2 while 28 passes.

Fix: centre on `value`; replace the flat floor with a scale-aware one; reject negatives with their own
message. For products under 1 the whole-number framing is wrong anyway - either ask "closer to 0 or
closer to 1?" or skip the step for that shape.

### 5. `/decimal-steps` seats every question in the same slot forever

`src/lib/decimalSteps.ts:218-231`. The permutation is a pure function of the **step id**, and step ids are
constant across problems (`lineup`, `point`, `setup`, `zeros`, `qpoint`, `and-the-other`, `bring-0`).
Measured over 44 choice steps across 10 problems:

```
lineup        -> slot 2, every time, on +, -, and x
point         -> slot 1, every time
qpoint        -> slot 1, every time
setup         -> slot 3, every time
3-choice steps: slot0 = 0 hits, slot1 = 16, slot2 = 13
```

The fix for "always tap the first button" became "always tap the third button." A student working a
published four-problem set learns the line-up answer is the third button by problem two, without reading
it. The contract cannot see this - it only asserts `first < total * 0.55`, which 7% satisfies, and which a
permutation parking every answer in slot 2 forever would also satisfy.

Fix: hash on `step.id` **plus the problem signature** (`${a.text}${op}${b.text}`) so the seat is stable
within a problem - which is all id-determinism was ever protecting - and varies between problems. Replace
the contract check with a per-step-id one.

### 6. Any student can reveal the `/decimal-steps` answer in two taps

`src/components/DecimalStepsBoard.tsx:412-415`, `:532-537`, `:478`

`mode` is client state persisted to localStorage, and the Teacher led / Student toggle sits in the top bar
of a public, ungated tool that every Chromebook opens. Tap "Teacher led", tap "Show the answer": typed
steps print `expect`, choice steps ring the correct button amber. There is no cookie check, no gate.

Against the design rule "never reveal an answer the student has not earned," this is decorative.

Fix: derive teacher mode from something a student does not hold - the `bdm_teacher` cookie is already the
site's teacher signal - or move the reveal to a teacher surface entirely.

### 7. `/decimal-steps` never focuses the input, on a tool that is mostly typing

`src/components/DecimalStepsBoard.tsx:492-506`. No `autoFocus`, no ref, no focus effect. `useRef` is
imported on line 21 and never used - the tell that a focus ref was intended and lost.

Step counts: `12.4 + 3.75` is 11 steps, `9.6 / 0.4` is 15, `0.25 x 0.75` is 15. The majority are typed.
Every one is tap-the-box-then-type on a Chromebook trackpad, and Enter (which does work) is unreachable
until the box has focus.

Fix: `useEffect` on `[stepIdx]` focusing the input when `step.kind === "input" && !solvedStep`.

### 8. `/division-house`'s confirmation line answers the very next question

`src/lib/divisionHouse.ts:227` rendered by `DivisionHouseBoard.tsx:441`

```ts
say: `We are dividing ${c.partial}.`,
```

`pick-partial-i` is immediately followed by `op-divide-i`, and `.dh-say` renders the *previous* prompt's
`say`. So the rail reads: "What operation are we doing here?" / [Divide][Multiply][Subtract][Bring down] /
"We are **dividing** 13." This fires on the first operation question of every round of every problem.

It is the same failure the strip rule exists to prevent - the question answering itself - arriving through
the text channel instead. The other three operation prompts do not leak; I checked.

Fix: drop the verb - `say: \`${c.partial} is the number under the bracket now.\``

### 9. `/division-house` gives no feedback where the finger is - the shake CSS is dead

`src/components/DivisionHouseBoard.tsx:208-210` defines `.dh-slot.wrong` with a shake and a coral border.
It is never added to any className (`:318`). The only response to a miss is a paragraph in the right-hand
rail, which on the 960px single-column breakpoint sits *below* a 520-768px board - off screen.

A 6th grader taps, nothing visibly happens, and taps again harder.

Fix: track `wrongSlot` (id plus a nonce so the animation replays), pass `wrong` to that cell's className,
clear it on the next click.

### 10. `/division-house` sentences jam two numerals together, and read wrong on a zero quotient digit

`src/lib/divisionHouse.ts:260`

```ts
say: `${divisor} goes into ${c.partial} ${c.q} time${c.q === 1 ? "" : "s"}, and it goes up top.`,
```

`936/4` produces "4 goes into 9 2 times". `618/3` round 1 produces **"3 goes into 1 0 times"**, which a
sixth grader reads as "3 goes into 10 times." Every round of every problem.

Fix: separate the numerals - `${c.partial} ÷ ${divisor} = ${c.q}, and the ${c.q} goes up top` - which also
matches the ÷ sign the board just drew.

### 11. `/division-house` round-0 wording is wrong exactly where the idea matters most

`src/lib/divisionHouse.ts:211-231`. Hand-traced `138/6`: the loop skips `i=0`, so the first cycle has
`pos = 1` and `partialSlots = ["dv-0","dv-1"]`. Both cells pulse, the ask says "the first **number**", the
hint says "the first **digit**", and the confirmation says "We are dividing 13" - after the student may
well have clicked the lone 1. `100/99` pulses three cells under "the first digit."

The single most important idea in this case - *6 does not go into 1, so we take 13* - is never said
anywhere. The contract flags this case as important but only checks it geometrically.

Fix: branch the round-0 ask and hint on `c.pos > 0`: "The divisor does not fit in the first digit. Click
the smallest number at the front that it does fit into."

### 12. `/decimal-steps` renders a quotient under 1 with no leading zero

`src/lib/decimalSteps.ts:881-884`, `:904-906`. `quotientText` handles it (`.replace(/^0+(?=\d)/, "") ||
"0"`), so the *string* is `0.9`. The *board* is not: `4.5 / 5` builds only `q-1`, giving a quotient row of
`[_ 9]` with the marker at boundary 1 - it reads `.9`.

The skip is correct and necessary for `7.35 / 2.1` (which does correctly read `3.5`, not `03.5`). The
distinction missing is that a skipped position **left of the decimal point** still needs its `0` when no
significant digit ever lands before the point.

Dividing a decimal by a larger whole number is where a 6th grade unit starts, and "write the zero in the
ones place" is graded convention. The board teaches the opposite.

Fix: after the cycle loop, if no cycle has `pos < dotAt`, push a `q-` cell at `dotAt - 1` with text `"0"`,
revealed on the `qpoint` step.

### 13. `/decimal-steps` asks for a whole four-digit addition in one box

`src/lib/decimalSteps.ts:781-796`. For `0.25 x 0.75` the `addpartials` step is one input, label
`125 + 1750 =`, expecting `1875`. The same tool has just insisted the student add `12.4 + 3.75` one column
at a time with a decision step and a physical carry box for every carry.

It does not violate the letter of "never multiply a whole row at once", but it is the same failure on the
addition side - and it is the last step, so a student who cannot do it mentally is stuck with a repeating
one-line hint.

Fix: reuse `buildColumnBoard` / `carrySteps` over the partial rows so the final addition is columns and
carries like every other addition in the tool.

### 14. `/division-house` grows off the bottom of a Chromebook and nothing scrolls the target into view

`src/components/DivisionHouseBoard.tsx:181`, `:290`. Rows are `2 + 2 x cycles`, so `875/4` is 8 rows =
768px and a 4-digit dividend is 960px. On a 1366x768 Chromebook the third round's work is below the fold,
and there is no `scrollIntoView` anywhere. The one affordance telling a student where to tap is the amber
pulse, and by round 3 it is off screen.

Fix: `useEffect` on `step` calling `scrollIntoView({ block: "nearest" })` on the current target cell.

### 15. `/division-house` renders as a small island on the projector

`DivisionHouseBoard.tsx:35-36`, `:143-144`; `src/app/teacher/present/page.tsx:907`, `:1267`

`.stage-tool` applies no transform or zoom, so the tool renders at its natural CSS sizes inside a
full-width iframe. With the default set `boardW` is 520px inside a container whose left column is ~824px -
roughly a quarter of a 1920px wall. The Divide/Multiply/Subtract/Bring-down strip is 11.5px, the round
label 11.8px, the trail 13.6px. `CLAUDE.md`'s own projector arithmetic puts far-of-the-room legibility
near 85px, and Steele's `/divisibility` direction is "the content FILLS THE SCREEN."

Computed, not observed - but the absence of any scaling in `.stage-tool` is certain.

Fix: scale `.dh-root` from a measured container (the `/weekly-display` fixed-stage pattern, or a
`transform: scale()` off `clientWidth` on a ref - never `window.innerWidth`), and size the rail text off
the same scale.

### 16. `/division-house` signs drift out of the gutter after round one

`src/components/DivisionHouseBoard.tsx:348-352`. The gutter is exactly one column wide (`GUTTER = 1`), but
the sign is placed at the raw midpoint of a diagonal whose endpoints move right each round. Computed for
`936/4` (CELL 104, gutter x 104-208): multiply sign at `q-0` lands x=156 (correct), `q-1` x=208 (on the
boundary), `q-2` **x=260, inside the house**, at y=96 - exactly on the bracket's top bar and over the first
dividend digit. For `144/12` the round-0 ÷ glyph (5.4rem, ~86px wide, translate -50%) spans roughly x
165-251 and sits on top of the "2" of "12".

`CLAUDE.md`: the gutter "is not decoration - the divide and multiply signs and their arrows live in it."

Fix: clamp the sign's `x` to the gutter column centre `(trace.houseCol - 0.5) * CELL` for ÷ and x, letting
only `y` follow the midpoint. The two-segment arrow gap already handles the rest.

### 17. `/decimal-steps` has no ceiling on problem size

`src/lib/decimalSteps.ts:1186-1194`. The refusal set covers negatives, non-terminating quotients and
divide-by-zero - all verified working. It has no size ceiling. Executed: `9999.999 x 9999.999` builds
fine - **140 steps, 14 columns**. `parseDec` allows 4 integer digits and 3 places, so this is inside the
documented input range, and `/control` prints "1 problem." with no warning. The board is 784px wide at the
default cell size and unusable at the 900px breakpoint.

Fix: refuse when `trace.steps.length > ~40` or `trace.columns > 9`, reason "too many steps to walk in
class - use smaller numbers." `/control` already prints the reason verbatim.

### 18. `/division-house` contract pins the 12-step order for one problem and one round

`scripts/division-house-contract.mjs:36-61`. `96/4` has 21 prompts; only indices 0-12 are order-checked,
only for `96/4`. Nothing asserts the order in round >= 1, and nothing asserts it at all for the
zero-quotient case, the short-quotient case, or any two-digit divisor. The later "every spot a prompt names
exists" loop covers five shapes but checks existence and fill only, never sequence.

A regression that dropped `pick-divisor` from rounds >= 1, or reordered `place-quotient` / `op-multiply` in
a zero-quotient round, passes the whole suite green.

Fix: extract the 12-step expectation to a constant and assert `shape(t).slice(r*12, r*12+12)` for every
non-terminal round across `[96/4, 618/6, 138/6, 84/9, 144/12, 1000/8]`, with the terminal round asserted as
that list minus the three bring-down steps.

---

## Polish

- **`/decimal-steps` rewrites the student's accepted estimate.** `DecimalStepsBoard.tsx:497` -
  `value={solvedStep ? step.input.expect : typed}`. A student types 17 for `12.4 + 3.75`, it is accepted,
  and the box immediately reads 16 with no explanation. Keep their value on nearness-judged steps and put
  the rounding in the `say`.
- **Empty submit is answered like a wrong answer.** `DecimalStepsBoard.tsx:200-203` renders the arithmetic
  hint when the box is blank. Distinguish it: "Type a number first."
- **`/division-house` repeats the last sentence twice.** `DivisionHouseBoard.tsx:441` and `:443-445` -
  `slice(step-4, step)` includes `step-1`, so the green `.dh-say` line and the last trail entry are the
  same sentence stacked. Use `slice(max(0, step-5), max(0, step-1))`.
- **`/division-house` subtraction rule underlines the wrong span.** `DivisionHouseBoard.tsx:149-157` builds
  the rule from `work` slots only. `618/3` round 1 underlines one column while the number being taken away
  spans two. Union the rule's span with the round's `partialSlots` columns.
- **`/division-house` drops problems past the 12th with no `rejected` entry.** `divisionHouse.ts:407`
  breaks after the 12th push, so chunks 13+ are never reported. The module's own doc comment promises the
  opposite. A teacher pasting 15 problems sees "12 problems." with no explanation.
- **`12/0` is rejected with a message that never mentions zero.** `divisionHouse.ts:398-403` falls to the
  range branch. Add a `divisor === 0 || dividend === 0` branch.
- **Both tools leave `published` set after an unpublish.** `DivisionHouseBoard.tsx:75-80` and
  `DecimalStepsBoard.tsx:115-121` early-return when `liveTool` goes null, so students keep the old set
  until reload. `setPublished(null)` in the guard.
- **`/division-house` reduced-motion gaps.** `.dh-subrule`'s scaleX has no reduce override, and under
  reduce `.dh-yes` is set to `animation:none; opacity:0` - a reduced-motion student loses the "Yes!"
  confirmation entirely rather than getting a static one.
- **`/division-house` accessibility.** Up to 60 buttons share `aria-label="empty spot"`, and the prompt /
  hint / say column has no `aria-live`, so a screen reader announces nothing when the step advances.
- **`/division-house` operation buttons have no `:active` or `:focus-visible`** - a Chromebook or iPad tap
  gives no press feedback at all. Only `:hover` exists.
- **`/division-house` `?set=` flashes the default set** - it is read in a mount effect, so the first paint
  always shows `DEFAULT_HOUSE_SET` and then swaps.
- **`/division-house` wraps silently at the end of a set** - `nextProblem` does `% problems.length`, so
  finishing the last problem restarts problem 1 with no "you finished" beat.
- **`CLAUDE.md` is stale on the count-places step** (rule 9). It says the answer is a choice with
  "whichever number has more" as the offered trap and an equal-counts drop-out. The v2 rewrite made `count`
  a typed **input** (`decimalSteps.ts:802-817`) - there are no offered choices, no trap, and no drop-out.
  The sums are all correct. Fix the paragraph in its own commit. Residue: for `6.2 x 3` the hint reads
  "6.2 has 1, and 3 has 0. Add them, do not take the bigger one" - where both give the same answer.
- **Dead code.** `decValue` (`decimalSteps.ts:191`) has zero callers; `useRef` is imported unused in
  `DecimalStepsBoard.tsx:21`; `#fff` is hardcoded at `DivisionHouseBoard.tsx:176` where every other colour
  is a token.

---

## Two judgment calls for Steele

**The `/division-house` operation buttons are always in cycle order** (`divisionHouse.ts:27-32`), so "tap
the leftmost unlit chip" answers every operation question without thinking. `/decimal-steps` solved the
analogous problem with `seatChoices` for exactly this reason. I am not calling it a defect - the stated
goal is "getting reps following the numbers" and "start to remember what the sequence is," and reading the
sequence off the strip *is* the rehearsal. If you want it tightened, seat the four buttons by a hash of
`prompt.id` while leaving the strip in fixed cycle order.

**`/decimal-steps` disables each wrong choice permanently** (`DecimalStepsBoard.tsx:484`), so any 3-choice
step falls to brute force in at most two taps. The `why` text carries the teaching, so this may be
intended. Flagging rather than asserting.

---

## Verified good

Checked and correct; not in the list above.

**`/division-house`** - the strip never lights a step before it is named (`slice(0, step)` is strictly the
answered set, round-scoped). No other giveaway channel on operation prompts; `activeVisual` always resolves
to the previous round-scoped sign, never the answer. Arithmetic hand-traced on `936/4`, `618/3`, `824/4`,
`138/6`, `875/4`, `7/7`, `144/12`, `1000/99`, `100/99` - every one satisfies `quotient * divisor +
remainder === dividend` with `0 <= remainder < divisor`. No divide-by-zero, NaN, empty prompt list or
infinite loop; negatives are impossible at the parser. No grid collisions and nothing spills into the
gutter. Only the inside of the house is clickable; the gutter and every cell above/below the divisor render
as inert spans. Multi-digit numbers are one number everywhere *except* the divisor (finding 2). Sign
semantics are right: `−` suppresses the arrow and sits left above the rule, `↓` draws one continuous arrow
with no glyph, `÷`/`x` get the two-segment split so the line never crosses the sign. React hygiene is clean
- the reset effect is keyed on a serialized signature, the live-tool effect on `liveToolId`, no
`window.innerWidth`, no stale closures, no zero-rect hazard. No dead end: Start over is always present.

**`/decimal-steps`** - arithmetic is genuinely integer-scaled; no `toFixed`, no `parseFloat` round-trip,
float division only in the estimate. Verified `0.1 + 0.2 = 0.3`, `1.1 - 0.9 = 0.2`, `12.4 + 3.75 = 16.15`,
`5.0 - 3.47 = 1.53` with correct regroup steps, `9.6 / 0.4 = 24`. `7.35 / 2.1` reads `3.5`, not `03.5`. The
four set-up answers are all distinct and correct, and "line up the decimal points" *is* offered as a wrong
choice on the multiply board. The division decimal move is genuinely four separate required steps - the
"moved only the divisor" error is catchable twice. Product and difference are separate rows. Multiplication
is genuinely digit-by-digit. The carry is a decision plus a physical act, with the box open and pulsing
until filled. All refusal paths work with teacher-readable reasons that `/control` prints verbatim.
`seatChoices` is deterministic and nothing assumes `choices[0]` is the answer.

**Both** - live-session wiring is complete: `LiveToolRoute`, a typed config arm, `useLiveToolConfig`,
`<LiveToolBanner>`, `ASSIGNED_TOOL_ROUTES`, `TOOL_ROUTES`, `ClassSync`, `classStates`, `/control`'s form
field and Notion tool-name map, plus the `/teacher` and `/explore` tiles. Both config effects are keyed on
`liveToolId`, not the tool object, and `id` is minted once at publish time - so the 1s poll cannot restart
a student mid-answer. Zero emoji in any file. AA contrast holds on every pair computed; the deep companions
are used correctly and there is no white-on-teal/coral/green. Touch targets are 44px+ throughout. Neither
tool emits evidence via `reportToolResult` - correct for "reps, not a test", but it means the proficiency
spine sees nothing from either.
