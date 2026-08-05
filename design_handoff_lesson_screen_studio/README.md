# Handoff: Lesson Screen Studio — Notion-driven state renderer

## Overview

The Lesson Screen Studio is the authoring and rendering surface for a lesson's live classroom screens. Every screen is generated automatically from a `Math 6 Lesson Steps` row in Notion; the teacher can then rearrange, add, delete, and override individual components on any screen without ever touching the parts that must stay true to the lesson.

This replaces the idea of a separate slide deck. These **are** the lesson screens on the site — the same data that drives `/control`, `/teacher/pace`, and `/session` drives these.

Three layers, in priority order:

1. **Locked chrome** — state name, accent color band, step position (12 dots), and the clock. Read from the Notion row. Rearranging components never changes them.
2. **Auto-generated layout** — each screen picks a sensible default arrangement of components based on which Notion fields the step actually has.
3. **Per-component override** — any component's fields can be edited inline. A blank field falls back to the Notion value, so an override is always additive and always reversible.

## About the design files

`M1.T1.L1-D1 State Templates.dc.html` in this bundle is a **design reference created in HTML** — a working prototype of the intended look and behavior, not production code to copy. The target is the existing Next.js app (`Wilsos22/Big-Dog-Math`), so this should be recreated as React/TypeScript using the repo's established patterns: `src/lib/notionLessons.ts` for reads, `src/lib/notionLessonStepWrites.ts` for writes, `src/lib/classStates.ts` for canonical state ids, and the existing route conventions under `src/app/`.

Do not ship the HTML. Do not add a new styling system — match how `src/app/control/page.tsx` and `src/app/teacher/pace/page.tsx` already style things.

## Fidelity

**High-fidelity.** Colors, type sizes, spacing, and the component set are final. The projector-scale type sizes in particular are deliberate and load-bearing — they are sized to be read from the back of a classroom at 1920×1080. Do not reduce them for the sake of the editor preview; the preview is scaled with a CSS transform instead.

## Design system

The studio **chrome** is built from the bound Big Dog Board design system, not hand-rolled. Load all six sheets plus the bundle, then compose:

```html
<link rel="stylesheet" href=".../tokens/fonts.css">
<link rel="stylesheet" href=".../tokens/colors.css">
<link rel="stylesheet" href=".../tokens/typography.css">
<link rel="stylesheet" href=".../tokens/spacing.css">
<link rel="stylesheet" href=".../tokens/base.css">
<link rel="stylesheet" href=".../styles.css">
<script src=".../_ds_bundle.js"></script>
```

Components used, from namespace `DesignSystem_901ffe`:

| Chrome element | Component | Props |
| --- | --- | --- |
| Control bar, Frames palette | `Panel` | `border="hairline"`, `padding={18}` / `{15}` |
| Inspector | `Panel` | `accent="blue"` (its own rounded top accent strip — do not hand-draw a `border-top`), `border="hairline"`, `padding={16}` |
| Step + screen toggles | `Button` | `variant="primary"` selected, `variant="soft"` unselected, `size="sm"` |
| Reset this screen, Revert to Notion | `Button` | `variant="soft"`, `size="sm"` |
| Delete frame | `Button` | `variant="danger"`, `size="sm"` |
| Palette entries | `Button` | `variant="soft"`, `block`, plus `style={{ justifyContent: "flex-start", textAlign: "left" }}` passed as a real prop — with a two-line `grid` child |
| Inspector inputs | `Field` | `label`, `accent="blue"`; `value` / `placeholder` / `onInput` / `data-*` pass through to the inner `<input>` |

`Button` variants are `primary` (dark) · `brand` (yellow) · `action` (blue) · `soft` (white card) · `ghost` · `danger`; sizes `sm` / `md` / `lg`; `block` for full width. `Panel` accents are `yellow` · `blue` · `green` · `orange` · `red` · `violet` · `ink` · `none`.

Chrome text and rules use the token custom properties — `--text-heading`, `--text-body`, `--text-muted`, `--text-faint`, `--line`, `--action`, `--paper`, `--cream` — never literal hex.

**The 1920×1080 screen content is deliberately exempt.** The accent band, area model, do-this list, answer boxes, and the demonstration objects are custom at projector scale and must not be forced into design-system components — their type sizes and fills are sized for a classroom projector, not a UI. The hex values listed under Design tokens below apply to that projector content only.

## Data source

Notion database **Math 6 Lesson Steps** (`collection://8e467c1b-8937-4902-811e-ca0a2e15af4d`), reached through the `Lesson Steps` relation on **Math 6 Lessons** (`collection://e367e541-c0c7-4613-8066-d2e61b6fee64`).

Reference lesson: `M1.T1.L1 Taking Apart Numbers and Shapes`, `Lesson Code` = `M1.T1.L1-D1`, 12 steps.

### Properties consumed, by component

| Notion property | Type | Used by |
| --- | --- | --- |
| `State ID` | rich_text | Locked chrome — selects accent + state word |
| `Order` | number | Locked chrome — step dots, sequence |
| `Duration` | number (minutes) | Locked chrome clock, Timer component |
| `Step` | title | State list label |
| `Main Display` | rich_text | Prompt component |
| `Screen Notes` | rich_text | Screen note component |
| `Pace Directions` | rich_text, one item per line | Do-this list component |
| `Student Directions` | rich_text | Callout component |
| `Student Action` | rich_text | Chromebook task line |
| `Question` | rich_text | Answer boxes component |
| `Response Mode` | select | Timer label, whether answer boxes appear by default |
| `Vocabulary` | rich_text, one per line | Support words component |
| `Slide Overlay` | rich_text | Color legend component |
| `Teacher Notes` | rich_text | Not rendered publicly — Remote only |
| `Remote Actions` | rich_text | Not rendered publicly — Remote only |
| `Advance` | select | Pacing behavior (`Automatic` / manual) |
| `AI Context` | rich_text | **Layout persistence** — see below |

### Layout persistence

Do **not** add a new Notion column. `src/lib/lessonStepMetadata.ts` already stores per-step config as bracketed markers inside `AI Context` (`[BDM_PUBLIC_SURFACES:split]`, `[BDM_CREATE_TOKEN:…]`) while preserving the teacher's free text. Follow that exact pattern:

```
[BDM_SCREEN_LAYOUT:<base64url of compact JSON>]
```

Layout JSON shape — one entry per screen, only for screens the teacher has actually customized:

```json
{
  "main":    { "z": [["model"], ["prompt", "text"]], "ov": { "b3": { "mainDisplay": "custom text" } } },
  "pace":    { "z": [["doThis"], ["timer", "support"]] },
  "student": { "z": [["prompt", "equation"], ["model"]] }
}
```

- `z` — array of zones, each an ordered array of component types. Order in the array is render order top-to-bottom.
- `ov` — per-component field overrides, keyed by component id. Absent key = use the Notion value.
- A screen absent from the blob renders its auto-generated default. This is what makes "reset to auto" free.

Extend `parseLessonStepAiContext` / `serializeLessonStepAiContext` with a `screenLayout` field rather than parsing `AI Context` in a second place. Add a marker pattern alongside the existing two, keep `userText` extraction intact, and keep the round-trip test contract.

## Screens / views

### Studio shell

**Purpose** — the teacher picks a step and a screen, sees exactly what will be projected, and adjusts it.

**Layout** — full-height page, `padding: 18px 22px 30px`, `display: flex; flex-direction: column; gap: 14px`. Ground is `#ECE8E0` with a dotted overlay: `radial-gradient(circle, #C9C1B0 1px, transparent 1.3px)` at `background-size: 18px 18px`.

Then a control bar, then a three-column body: `grid-template-columns: 232px minmax(0,1fr) 300px; gap: 14px; align-items: start`.

**Control bar** — a `Panel` with `border="hairline"` and `padding={18}`. Contains:

- `LESSON STEP · FROM NOTION RELATION` label — 11px, weight 900, `letter-spacing: .14em`, uppercase, `#8A8378`.
- 12 step buttons, one per `Order` — `Button` `size="sm"`, `variant="primary"` when selected and `variant="soft"` otherwise.
- `SCREEN` group — three `Button`s (Main projector, Pace + Support, Student), same selected/unselected variants.
- Status line, right-aligned, 12px/750 `#8A8378`: `<Step> · <Response Mode or "no digital response"> · <Duration> min from Duration`.
- `Reset this screen` — `Button` `variant="soft"`, `size="sm"`.

**Left column — frame palette.** A `Panel` with `border="hairline"` and `padding={15}`. Heading `FRAMES`. One `Button` per component type — `variant="soft"`, `block` — each containing a two-line grid: the component label (14px/900, `--text-heading`) and beneath it the Notion property it binds to (10px/800, `letter-spacing .08em`, uppercase, `--text-muted`).

`Button` is `display: flex; justify-content: center`, so a two-line label centers by default. Left-align it on the **button itself** with `justifyContent: "flex-start"` and `textAlign: "left"` — not with `width: 100%` on the inner grid, which resolves against a shrink-to-fit wrapper and does nothing. Also set `height: auto` with symmetric vertical padding so the taller two-line label isn't constrained by the button's fixed size.

Palette entries: Prompt (`Main Display`), Screen note (`Screen Notes`), Area model (`Anchor Problem`), Do this list (`Pace Directions`), Timer (`Duration`), Support words (`Vocabulary`), Answer boxes (`Question`), Color legend (`Slide Overlay`), Callout (`Student Directions`).

Clicking adds that component to the screen. Timer, Support words, and Color legend land in zone 1; everything else lands in zone 0.

**Center — screen preview.** Caption line above (`<Screen> · <Step>`, 12px/900 uppercase `#8A8378`) plus dimensions (12px/750 `#A79E90`): `1920 × 1080` for the projectors, `1366 × 768 on device · authored at 1920 × 1080` for the Chromebook.

The frame itself: `position: relative; width: 100%; aspect-ratio: 16/9; overflow: hidden; border-radius: 16px; box-shadow: 0 22px 54px -26px rgba(103,74,64,.62)`.

Inside it, the screen is authored at literal `1920 × 1080` and scaled down with `transform: scale(hostWidth / 1920)` and `transform-origin: top left`, measured with a `ResizeObserver` on the frame. This is what keeps projector type sizes honest.

Because the whole screen is transform-scaled, the dotted ground must be **counter-scaled** or it disappears at preview size. Divide the pattern by the scale factor:

```
background-size: (11 / scale)px
dot radius:      (0.45 / scale)px → (0.7 / scale)px
```

At `scale = 1` on the real projector this resolves to an 11px grid with 0.45px dots. Clamp the divisor at `0.05` to avoid a blowup before first measure.

Screen base is `#F3F0E7` with `radial-gradient(circle, #BEB5A1 …)`.

### The locked band

Left column of every screen, `220px` wide (`214px` on the Chromebook layout). `display: grid; grid-template-rows: auto minmax(0,1fr) auto auto; justify-items: center; gap: 24px; padding: 40px 0 32px`. `box-shadow: 10px 0 30px -10px rgba(40,32,20,.3)`. Background is the phase accent.

Contents, top to bottom:

1. State word — `writing-mode: vertical-rl; transform: rotate(180deg)`, 60px/900, `letter-spacing .05em`, uppercase, `#fff`, `align-self: start`.
2. Step dots — 12 pills, `width 24px; height 9px; border-radius 999px`. Filled `#fff` for `i < Order`, else `rgba(255,255,255,.38)`.
3. Clock — `mm:ss` from `Duration`, 68px/800, `line-height .9`, `letter-spacing -.04em`, `font-variant-numeric: tabular-nums`, `#fff`. Beneath it `Step <n> / 12`, 20px/900, `letter-spacing .12em`, uppercase, `rgba(255,255,255,.85)`.
4. Screen name — 19px/900, `letter-spacing .12em`, uppercase, `rgba(255,255,255,.82)`.

Nothing in this band is editable from the studio. It is derived, every time, from the Notion row.

### Snapping zones

Each screen defines exactly two zones. Components stack vertically inside a zone; they never free-float, so nothing can overlap on a projector.

| Screen | Zone 0 | Zone 1 | Zone flex |
| --- | --- | --- | --- |
| Main projector | Model zone | Prompt zone | `1.38 1 0` / `0.62 1 0` |
| Pace + Support | Direction zone | Timer + support zone | `1.3 1 0` / `0.7 1 0` |
| Student | Task zone | Model zone | `1 1 0` / `0.62 1 0` |

Zone container: `display: flex; flex-direction: column; gap: 26px; min-width: 0`. The zone row is `display: flex; gap: 44px; padding: 44px 48px`.

An empty zone renders a dashed placeholder: `border: 3px dashed rgba(120,110,90,.42)`, `border-radius: 26px`, `background: transparent` so the dotted ground reads through, centered label (30px/900 uppercase `#A79E90`) naming the zone, plus `Add a frame from the left` (23px/800 `#BDB4A6`).

The Chromebook screen additionally has a 60px context bar above the zone row: `background rgba(255,255,255,.66)`, `border-bottom 1px solid rgba(120,110,90,.16)`, `padding 0 42px`, 25px/800 `#6F675C` — showing `Step <n> of 12`, `Next: <next step title>`, and the student name right-aligned.

### Default layout derivation

Computed from which fields the step has. This is the "if the lesson was never uploaded" behavior too — a step with no content yields empty dashed zones, which is a valid, useful blank template.

- **Main** — has a model → `[["model"], ["prompt","text"]]`, and if it also has an equation the second zone becomes `["prompt","equation"]`. No model but has an equation → `[["prompt","equation"], []]`. Otherwise `[["prompt","text"], []]`.
- **Pace** — `[["doThis"], ["timer","support"]]`, dropping `support` when `Vocabulary` is empty.
- **Student** — zone 0 is `["prompt","equation"]` when the step has an equation, else `["prompt","callout"]`. Zone 1 is `["model"]` when a model exists, else empty.

## Components

Every component renders as a white card: `background #fff`, `border-radius 26px`, `padding 30px 34px`, `box-shadow 0 14px 36px rgba(40,32,20,.1)`, `border 1px solid #DBD5C9`. Selected state swaps to `border 3px solid #50A3A4` plus `outline 3px solid rgba(80,163,164,.4)` at `outline-offset 7px`.

`align-content` is `center` for Area model and Answer boxes, `start` for everything else. Flex sizing per type:

| Component | flex |
| --- | --- |
| Area model, Answer boxes | `1 1 0` |
| Do this list, Support words | `1 1 auto` |
| Prompt, Screen note, Timer, Color legend, Callout | `0 0 auto` |

### Prompt
`Main Display` as an `<h2>`: weight 800, `line-height 1.02`, `letter-spacing -.03em`, `color #2E4A54`, `text-wrap: balance`. Size varies by screen — 80px on Pace, 64px on Main, 52px on Student.

### Screen note
`Screen Notes` as a `<p>`: 32px/750, `line-height 1.32`, `#4A453E`.

### Area model
Header row: model title (27px/900, `letter-spacing .1em`, uppercase, `#3D8586`) and a right-aligned hint (23px/800 `#A79E90`).

Body is `grid-template-columns: 86px minmax(0,1fr); gap: 20px`. Left is the row count — 66px/900, `line-height .9`, `letter-spacing -.04em`, `#3D8586`, with `ROWS` beneath at 21px/850 uppercase.

Right is the grid: `min-height 210px`, `border 4px solid #201E1A`, `border-radius 8px`, `background #fff`, with a two-axis grid overlay `linear-gradient(to right, rgba(32,30,26,.17) 1px, transparent 1px)` and the same to bottom, sized `calc(100%/cols) calc(100%/rows)`.

Two absolutely positioned regions: left `rgba(252,175,56,.44)` width `split/cols`, right `rgba(132,91,201,.3)` for the remainder, each centering a 52px/900 tabular label (`#9C6310` and `#4D3079`). A divider sits at the split: `width 8px`, `margin-left -4px`, `background #201E1A`, `border-radius 999px`, `top/bottom -14px`.

Editable fields: model title, model hint, rows, columns, split at. Clamp `rows`/`cols` to `>= 1` and `split` to `0…cols`.

### Do this list
Heading from `List heading` (default `Do this`), 25px/900, `letter-spacing .12em`, uppercase, in the phase ink color. Then one row per line of `Pace Directions`: a numbered chip (`min-width 54px; height 54px; border-radius 14px`, phase chip background and ink, 28px) followed by the text at 36px/800 `#201E1A`. Rows are `display: flex; gap: 18px; align-items: baseline`, stacked with `gap: 18px`.

### Timer
`mm:ss` from `Duration` at 132px/800, `line-height .86`, `letter-spacing -.05em`, tabular, in the phase ink color. Label beneath at 25px/850, `letter-spacing .1em`, uppercase, `#8A8378` — defaults to `Response Mode`, or `On task`.

### Support words
Heading (23px/900, `letter-spacing .12em`, uppercase, phase ink) — `Words we are using` when `Vocabulary` is present, else `Support`. Then one `<p>` per line at 31px/850 `#201E1A`.

### Answer boxes
Centered equation row, `display: flex; gap: 16px; flex-wrap: wrap`, 66px/900 tabular, `letter-spacing -.02em`:

`<front> × ( <partA> + <partB> ) = [box] + [box] = [box]`

Front factor is `#3D8586`, first part `#9C6310`, second part `#4D3079`. The three boxes are `width 104px; height 96px; border-radius 18px; background #fff` with borders `6px solid #FCAF38`, `6px solid #845BC9`, and `6px solid #201E1A` respectively — amber box pairs with the amber region of the model, violet with violet. The wider total box is `124px`.

Note beneath, centered, 26px/800 `#8A8378`.

### Color legend
Heading 23px/900 uppercase `#3D8586`, then three swatch rows at 28px/800 `#4A453E`, each with a `26px` square at `border-radius 7px`: `#50A3A4` front factor, `#FCAF38` first addend, `#845BC9` second addend. This color coding is constant for the whole lesson.

### Callout
`Student Directions` at 30px/850 `#201E1A`.

## Demonstration objects (main screen only)

Three palette entries are teacher-manipulated demo objects. They are deliberately **not** synced, not persisted, and not recorded as evidence — they exist so the teacher can show something live on the main projector during one lesson. Local component state only.

| Palette entry | Type | Interaction |
| --- | --- | --- |
| Demo · slide the split | `manipSplit` | Drag anywhere in the rectangle to move the dividing line. Snaps to whole grid columns and labels both parts (`20 wide` / `8 wide`). |
| Demo · snap two pieces | `manipSnap` | Button toggles the gap between two grid pieces closed and open, `transition: gap 700ms cubic-bezier(.2,.7,.2,1)`. Open shows both partial products; closed shows the combined dimensions and area. |
| Demo · move + resize | `manipFree` | Drag the rectangle to move it; drag the corner handle to resize. Clamped inside its container, minimum 8% per side. |

### Why these are separate from the Area model component

The Area model component renders a *fixed* partition from the Notion row — it is the same on every screen and every run of the lesson. These demo objects render a partition the teacher moves during class. Same visual language, different purpose. Keep them as distinct types rather than adding an `interactive` flag, because the editable fields differ: `manipSnap` takes a shared side plus two piece widths, while Area model takes rows / columns / split.

### Implementation notes

- **Live state lives outside the layout.** Keep it in a separate map keyed by component id (`manip[blockId]`), never in the layout blob. Rearranging frames must not reset a demo object mid-lesson, and a dragged divider must not dirty the save state or get written to Notion.
- **Percentages, not pixels.** All positions and sizes are stored as percentages of the container and pointer deltas are divided by the container's measured `getBoundingClientRect()`. This is what makes dragging work correctly while the whole screen sits under a CSS `transform: scale()` in the studio preview — the same code then works unscaled on the real projector.
- **Pointer events, not mouse events.** `pointerdown` on the target, then `pointermove` / `pointerup` on `window` so the drag survives the cursor leaving the element. Set `touch-action: none` on anything draggable. Remove both listeners on `pointerup`.
- **`stopPropagation` on every demo handler** — otherwise the drag also triggers the component-select click underneath.
- **Snap to meaningful units.** `manipSplit` rounds the divider to whole columns and clamps to `1…cols-1`, so the teacher can never land on a fractional or degenerate split while demonstrating.
- Expose all four handlers to the view layer. Handlers referenced by the template but missing from the render values fail silently — the element renders correctly and simply does nothing on click, which is easy to mistake for a CSS problem.

### Extending this

New demo objects should follow the same shape: a type in the palette, a flex entry, an editable-field list, a render branch, and handlers that only touch the local `manip` map. Anything that needs to *animate on its own* rather than react to the teacher belongs in the same place — build it as a component with its state in that map, not driven from the layout, so the animation survives the studio re-rendering around it when frames are rearranged.

Anything that needs student screens to react is a different problem and does not belong here — that has to flow through `liveClassFlow.ts` like the rest of the synchronized state.

## Interactions & behavior

**Select** — click a component to select it. Click a zone's empty space to deselect. Selection drives the right-hand inspector.

**Component toolbar** — appears above the selected component only, `position: absolute; top: -30px; right: 0; z-index: 5`, four buttons at `46px` square (`border-radius 12px`, `3px` borders):

- `↑` / `↓` — reorder within the zone. No-op at the ends.
- `move right` / `move left` — send the component to the other zone, appended at the end. Label reflects current zone.
- `×` — delete. Red: `border` and `background #F95335`, `color #fff`.

All four `stopPropagation` so they don't re-trigger selection.

**Add** — clicking a palette entry appends a new component and selects it immediately, so the inspector is already focused on the thing just added.

**Edit** — inspector fields write into that component's override map. Setting a field to empty string **deletes** the override rather than storing `""`, which is what makes the Notion value come back. The input's `placeholder` shows the current Notion value so the teacher can always see what they're overriding.

**Revert to Notion** — clears every override on the selected component, keeping it in place.

**Reset this screen** — drops the whole layout entry for the current step + screen, returning to the derived default.

**Save** — the concept reference shows `Saved` / `Save to Notion` in the top bar and a `Review in Control` link. Implement save as a debounced write through `notionLessonStepWrites.ts` with the existing mutation-token reconciliation, and surface the four states: editing, saving, saved, save failed. The prototype holds layout in memory only; **persistence is the main thing to add.**

## State management

```ts
stepIdx: number          // index into the ordered steps array
screen: "main" | "pace" | "student"
layouts: Record<string, Zone[][]>   // key: `${stepIdx}:${screen}`
selected: string | null  // component id
scale: number            // preview scale from ResizeObserver
seq: number              // monotonic id source for new components
```

Layout is created lazily: on first access for a `stepIdx:screen` key, derive the default and store it. Component ids only need to be unique within a screen.

Data fetching: read the lesson and its ordered steps server-side (the app already does this) and pass them in. The studio itself needs no client fetch beyond the save call.

## Design tokens

Phase accents, keyed by `State ID`. Each carries an accent (the band), an ink (headings and timer inside components), and a numbered-chip pair.

| State ID | Word | Accent | Ink | Chip bg | Chip ink |
| --- | --- | --- | --- | --- | --- |
| `warmup` | Warm-up | `#F2820C` | `#C4660A` | `#FCE6CC` | `#8F4A07` |
| `hook` | Hook | `#F2820C` | `#C4660A` | `#FCE6CC` | `#8F4A07` |
| `target` | Target | `#50A3A4` | `#2E4A54` | `#DCEBEB` | `#2E4A54` |
| `concrete` | Build it | `#2E9E5A` | `#1F7A45` | `#DAEEDF` | `#155A33` |
| `tool_demo` | Watch | `#2E9E5A` | `#1F7A45` | `#DAEEDF` | `#155A33` |
| `six_steps` | Six steps | `#2E9E5A` | `#1F7A45` | `#DAEEDF` | `#155A33` |
| `target_review` | Check in | `#50A3A4` | `#2E4A54` | `#DCEBEB` | `#2E4A54` |
| `readiness1` | Show me | `#674A40` | `#674A40` | `#ECE7DD` | `#4A453E` |
| `readiness2` | Show me | `#674A40` | `#674A40` | `#ECE7DD` | `#4A453E` |
| `independent` | Work time | `#F2820C` | `#C4660A` | `#FCE6CC` | `#8F4A07` |
| `exit` | Exit | `#674A40` | `#674A40` | `#ECE7DD` | `#4A453E` |
| `cleanup` | Close | `#50A3A4` | `#2E4A54` | `#DCEBEB` | `#2E4A54` |

Unknown `State ID` falls back to the `warmup` entry. Reconcile these ids against `src/lib/classStates.ts` — the canonical list there uses `learning-check`, `representational`, `abstract`, `closeout`, and others. Map to the canonical ids and keep this table as the accent lookup.

**Math color coding** — constant across the whole lesson, do not vary per phase: front factor `#50A3A4` / `#3D8586`, first addend `#FCAF38` (fill `rgba(252,175,56,.44)`, ink `#9C6310`), second addend `#845BC9` (fill `rgba(132,91,201,.3)`, ink `#4D3079`).

**Neutrals** — all of these exist as design-system tokens; use the token in chrome and the literal only inside projector content. Ink `#201E1A` (`--ink-900`), body `#4A453E` (`--ink-700`), muted `#8A8378` (`--ink-500`), faint `#B4ADA1` (`--ink-400`), hairline `#DBD5C9` (`--ink-300`), sunk `#ECE7DD` (`--ink-200`), paper `#F6F3EC` (`--ink-100`), app ground `#ECE8E0` (`--cream`). Projector-only values with no token: screen base `#F3F0E7`, placeholder inks `#A79E90` / `#BDB4A6`, dot `#BEB5A1` on screens and `#C9C1B0` on the app ground.

**Type** — Albert Sans throughout. Weights used: 750, 800, 850, 900. Projector body copy never below 23px; the smallest type anywhere on a screen is the 19px band label.

**Radii** — 11–14px controls, 20px panels, 22–26px component cards, 999px pills.

**Shadows** — card `0 6px 18px rgba(40,32,20,.07)`, component `0 14px 36px rgba(40,32,20,.1)`, frame `0 22px 54px -26px rgba(103,74,64,.62)`, band `10px 0 30px -10px rgba(40,32,20,.3)`.

## Wiring checklist

1. **Route** — add the studio under `src/app/`, teacher-gated like `/control` and `/session` (see the `TEACHER_PASSWORD` gate in `NOTION-SETUP.md`).
2. **Read** — load the lesson and its `Lesson Steps` relation ordered by `Order` via `notionLessons.ts`. Empty/unpublished steps must render the blank dashed template, not an error.
3. **Persist** — extend `lessonStepMetadata.ts` with a `[BDM_SCREEN_LAYOUT:…]` marker as described, then save through `notionLessonStepWrites.ts`.
4. **Timer** — the band clock currently shows `Duration` statically. Drive it from the live pacing snapshot in `liveClassFlow.ts` so all surfaces agree, and honor `Advance` (`Automatic` vs manual) plus the existing pause/resume/stop semantics.
5. **Render at full size** — the same components, unscaled, are what `/control` and `/teacher/pace` project. Factor the component set so the studio preview and the live surfaces share one implementation; only the wrapping transform differs.
6. **Fourth surface** — the concept reference also previews a private iPad Remote. Not built in this prototype. It uses `Teacher Notes` and `Remote Actions`, which are already parsed and deliberately never rendered on a public surface.

## Adherence note

The projector screen content intentionally uses literal hex and hand-built layout — that is correct and should be preserved. Everything outside the 16:9 frame should route through `Panel` / `Button` / `Field` and the token custom properties. If a chrome need genuinely isn't covered by the component set, build it from tokens rather than new literals, and flag it as an addition to the design system.

## Assets

`design-references/lesson-screen-studio-concept.png` — copied from the repo, included here. It is the layout reference for the studio shell: state list left, surfaces center, Notion-bound inspector right, save controls top.

No icons or images are used in the screens themselves. Per the design system there is no icon set and no emoji anywhere.

## Files

- `M1.T1.L1-D1 State Templates.dc.html` — the studio prototype. Everything above is implemented here except persistence and the live timer, including all three demonstration objects.
- `M1.T1.L1-D1 Screens v1.dc.html` — earlier explorations, including the visual direction that became this one (option `2a`: dotted paper ground plus the accent state band). Reference only.
- `design-references/lesson-screen-studio-concept.png` — studio shell reference.

## Open questions

- The 12 accent/state ids above are keyed to this lesson's steps. Only steps 1 and 2 use verbatim Notion text; steps 3–12 were derived from the lesson's own properties (`Live Questions`, `Help Path`, `Practice Problems`, `Exit Ticket Prompt`) because those step rows were not yet filled in. Once they are, the derived content should be dropped entirely — nothing in the renderer should hardcode lesson content.
- Zone counts are fixed at two per screen. If a screen ever needs three, `ZONE_FLEX` / `ZONE_EMPTY` and the `move` toggle need to become n-ary rather than a binary swap.
