---
description: Generate one lesson's full Canva slide deck end to end - assemble, fill, export, wire into Notion, ship
argument-hint: "<lesson code, e.g. CC.3 or M1.T1.L2-D1>"
---

# /generate-lesson-slides - build one lesson's slide deck end to end

Steele's Canva slide pipeline (built 2026-08-08), formalized so a cold session can run it without
rediscovering the mechanism. Argument is a lesson code (`CC.3`, `M1.T1.L2-D1`, ...); no argument
means ask which lesson before doing anything else.

This is a MANUAL, INTERACTIVE run - it needs a live Claude Code session with the Canva MCP
connector, every call approved as you go. Do NOT attempt to turn this into an Apps Script or a
background job: this Canva account has no Brand Template publishing right (autofill needs it),
and there are no stored Canva API credentials anywhere in this repo for a script to use outside
this kind of session. If a future session is tempted to automate this away, it is not possible yet
- say so and do the manual run instead.

CLAUDE.md's "Slide overlays" section (search `/generate-lesson-slides IS THE CANVA PIPELINE`) has
the one-paragraph pointer to this file. Read it first for the one-sentence version of everything
below plus the module palette; this file is where the actual mechanism lives.

## Ground rules

- Read CLAUDE.md's `slide` frame section and the DIRECTION bullet (search `FRAME + IMPORTED
  SLIDES FOR INFORMATION`) before starting - this pipeline produces exactly the imported-slide
  asset that section describes. Also read `public/slides/README.md`.
- **NEVER put a worked answer, a computed total, or a revealed solution on a slide.** Never map
  `Anchor Answer` or `Correct Answer` onto anything. The slides pose problems and leave open space;
  the answer happens on the physical whiteboard. This is the one rule in this whole pipeline that
  is not negotiable.
- FERPA: this is lesson content, not student data, so the usual boundary does not apply here - but
  never put a student's name, work, or photo on an exported slide either (same rule as
  `public/slides/README.md`).
- Entering a lesson's content into a slide is TRANSCRIPTION, not authoring (CLAUDE.md's Notion
  section). Use only what is actually authored on the Lesson Step. An empty field means the slide
  type that needs it is the wrong choice for that step, or the field is skipped - never invent
  filler text.
- Stage only the new image files you create. Never `git add .` or `git add -A` (rule 2).
- Do not push or merge past your own feature branch unless told to - the shipping steps at the
  end are the full flow, but confirm with whoever invoked this command before running them if the
  branch also carries unrelated work.

## Step 0 - load the tools

Both Canva and Notion tools are deferred; load them once, in bulk, not one at a time.

```
ToolSearch: "select:mcp__d2a1d576-9bb6-436f-8373-e2399d1bcdf9__read-design,mcp__d2a1d576-9bb6-436f-8373-e2399d1bcdf9__edit-design,mcp__d2a1d576-9bb6-436f-8373-e2399d1bcdf9__merge-designs,mcp__d2a1d576-9bb6-436f-8373-e2399d1bcdf9__export-design,mcp__d2a1d576-9bb6-436f-8373-e2399d1bcdf9__get-export-formats,mcp__d2a1d576-9bb6-436f-8373-e2399d1bcdf9__resolve-shortlink"

ToolSearch: "select:mcp__cc50efb1-70c9-4f40-a6a3-a9a543f54a86__notion-fetch,mcp__cc50efb1-70c9-4f40-a6a3-a9a543f54a86__notion-query-data-sources,mcp__cc50efb1-70c9-4f40-a6a3-a9a543f54a86__notion-update-page"
```

If the Canva or Notion connector shows up in the "requires authentication" list instead of the
deferred-tools list, stop and tell the user - it needs to be authorized from claude.ai connector
settings or `/mcp` first; there is no way around that from inside the session.

## Step 1 - read the lesson from Notion

1. `notion-fetch` the lesson itself (by title/code search first if you don't have the page id -
   `notion-search` against "Math 6 Lessons", or `notion-query-data-sources` on
   `collection://e367e541-c0c7-4613-8066-d2e61b6fee64` filtering the lesson code / title). Pull:
   `Lesson #`, `Lesson Title`, `Subtitle`, `Module #`, `Learning Intention`,
   `Selected Success Criterion`, `Discussion Prompt`, `Discussion Stems`.
2. Query the Lesson Steps data source (`collection://8e467c1b-8937-4902-811e-ca0a2e15af4d`) for
   every step whose `Lesson` relation contains this lesson page, ordered by whatever sequences them
   (State ID / step order). For each step pull: `State Type`, `State ID`, `Main Display`, `Student
   Directions`, `Question`, `Choices`, `Anchor Problem`, `Pace Directions`, `Help Path`, `Agenda` (if
   present), `Slide Url` (so you know what's already filled - do not clobber an already-authored
   slide without a reason).
3. Note the lesson's `Module #` and resolve its accent color from the palette below. If `Module #`
   resolves to Module 1, the templates already ship with the right color baked in and you can skip
   the recolor sub-step later.

Module palette (replaces the templates' baked-in Module 1 orange when the lesson is a different
module): Class Culture `#674a40` · Module 1 `#c4660a` · Module 2 `#96690a` · Module 3 `#1f6f9c` ·
Module 4 `#c93818` · Module 5 `#1f7a52`.

## Step 2 - pick a slide type per step (the one judgment call in this pipeline)

The Notion `State Type` select does not map 1:1 onto the 8 Canva types - there are more state
types than there are slide types, and not every step deserves a slide at all. Read each step's
actual authored content and choose by what the step IS, not mechanically by its `State Type`
string. Skip a step entirely (no Canva page, no `Slide Url` write) when nothing on it is worth
designing - an interactive step (fist-to-five, a published tool, a checkpoint) IS its own screen
already; see CLAUDE.md's "DIRECTION" bullet.

Working defaults, apply with judgment, not as a lookup table:

| When the step... | Use type |
|---|---|
| is the lesson's opener (used once, from the LESSON page, not a step) | **Title** |
| shows/announces something plain, no question (`Main Display` + `Student Directions`, nothing else) | **Statement** |
| carries an authored `Question` + `Choices` shaped like a real multiple-choice check | **Prompt** |
| poses a problem via `Anchor Problem` and should leave it open (warm-up, launch, hook, You-Do) | **Blank Pose** |
| is a two-option comparison ("which is right, A or B", exactly two `Choices`) | **Contrast** |
| carries the lesson's `Learning Intention` / `Selected Success Criterion` | **Target** |
| lists an ordered sequence of moves (`Help Path`, an agenda, a We-Do walkthrough) | **Stacked List** |
| is the lesson's `discussion` state, with `Discussion Prompt` / `Discussion Stems` | **Discussion** |

The 8 template designs, their fields, and their Canva design IDs:

| Type | Fields | Design ID |
|---|---|---|
| Title | kicker, headline, support | `DAHRu01B6yM` |
| Statement | kicker, headline, support | `DAHRuz73qSI` |
| Prompt | kicker, headline, options, support | `DAHRu6o6MxU` |
| Blank Pose | kicker, prompt, support, ghost | `DAHRu6EG--c` |
| Contrast | kicker, headline, item_a, item_b, support | `DAHRu5nJKDE` |
| Target | kicker, headline, stem, criterion | `DAHRu4DEaLQ` |
| Stacked List | kicker, headline, items, ghost | `DAHRu61o1qU` |
| Discussion | kicker, headline, items | `DAHRu5Wtm9o` |

Reference material if you need to see the shape of a real deck before starting: the visual catalog
of all 8 side by side (`https://www.canva.com/d/b6MR-iZwsjG8Fg4` - `resolve-shortlink` it if
`read-design` won't take the share URL directly), a proven generated single example (`DAHRu2Wqq0Y`),
CC.2's full hand-built 13-page deck (`DAHRun4y91E`), and CC.1's full 36-slide deck - already
exported, wired, and live (`public/slides/cc1-*.webp`) - which is the working precedent this whole
pipeline is modeled on.

Notion field mapping per type:

- **Title** (once, from the lesson page, not a step): kicker <- `Lesson #`; headline <- `Lesson
  Title`; support <- `Subtitle`.
- **Statement**: kicker <- `State Type`; headline <- `Main Display`; support <- `Student
  Directions`.
- **Prompt**: kicker <- `State Type`; headline <- step `Question`; options <- `Choices` (one per
  line); support <- `Student Directions`.
- **Blank Pose**: kicker <- `State Type`; prompt <- `Anchor Problem`; support <- `Student
  Directions`; ghost <- `Pace Directions`. **Never** map `Anchor Answer` or `Correct Answer`.
- **Contrast**: headline <- `Question`; item_a / item_b <- the first two lines of `Choices`.
- **Target**: headline <- `Learning Intention`; stem <- the literal text "I can"; criterion <-
  `Selected Success Criterion` (strip a leading "I can" if the property already has one - do not
  double it).
- **Stacked List**: headline <- `Main Display`; items <- `Help Path` or `Agenda` (one per line);
  ghost <- `Pace Directions`.
- **Discussion**: headline <- `Discussion Prompt`; items <- `Discussion Stems`.

## Step 3 - assemble the deck, one page at a time

`merge-designs` only reliably takes ONE `insert_pages` operation per call (found by testing - the
schema advertises up to 500 items in the array, but treat one-per-call as the ground truth for
this pipeline). So an N-slide lesson costs N assembly calls, done in order:

1. First page: `merge-designs` with `type: "create_new_design"`, `title: "<LessonCode> slides"`,
   `operations: [{ type: "insert_pages", source: { type: "design", design_id: "<page 1's type
   design ID>" } }]`. Record the returned new `design_id` - this is the assembled deck for the rest
   of the run.
2. Every later page: `merge-designs` with `type: "modify_existing_design"`, `design_id:
   "<assembled deck>"`, `operations: [{ type: "insert_pages", source: { type: "design", design_id:
   "<that page's type design ID>" } }]` (omit `after_page_number` - it appends to the end).
3. After each call, sanity-check the page count landed where you expect
   (`read-design` with `filter.fields: ["page_metadata"]`) before moving on - a silently-dropped
   insert is easy to miss and shifts every later page fill onto the wrong page.

## Step 4 - fill each assembled page

Locator IDs are re-minted every time `merge-designs` copies a page in, so you cannot reuse IDs
from the original template designs - re-read each page after it lands in the assembled deck.
Element POSITIONS are stable per type (same visual recipe, every copy), which is what makes this
tractable: read one instance of each type once (the original 8 template designs, or the first
assembled page of that type) to learn the ORDER its text elements come back in from `read-design`
- that order is your field-to-locator map for every later page of that same type.

Per page, in deck order:

1. `read-design(design_id=<assembled deck>, open_transaction: true, filter: { fields:
   ["design_content"], page_indices: [<page number>] })`. This returns a `transaction_id` and the
   page's markdown with each element tagged `[locator_id]`. Match each locator to a field (kicker /
   headline / support / etc.) using the order you learned in Step 3's calibration pass, or by the
   placeholder text still sitting in the box if it's legible.
2. `edit-design(transaction_id, page_index: <page number>, operations: [...], finalize:
   "keep_open")` - one `replace_text` op per field you're filling, targeting that field's
   `element_id`.
   - Headline text should be sized to fit: apply a `format_text` op on the headline element scaling
     `font_size` roughly 70-160px by text length (short headline near 160, long near 70) - start
     from that range and adjust after checking the thumbnail, this is not an exact formula.
   - If the lesson's module accent color isn't Module 1's baked-in `#c4660a` (see Step 1), add
     `recolor_element` ops for the underline-bar shape and any accent/callout text element to the
     resolved module color.
3. Request a thumbnail for this page (`read-design` with `filter.fields: ["thumbnails"]`,
   `filter.thumbnail_pages: [<page number>]`, passing the same `transaction_id` so it reflects your
   uncommitted edit) and actually look at it - confirm text landed in the right box, isn't
   overflowing, and reads correctly. This is not optional; `edit-design`'s own tool description
   requires it.
4. Once it looks right, `edit-design(transaction_id, operations: [], finalize: "commit")` to save
   permanently. If it's wrong, fix it with more `keep_open` operations before committing, or
   `finalize: "cancel"` to throw the transaction away and start that page's fill over.

## Step 5 - export to WebP

Canva's `export-design` does NOT support WebP directly (`get-export-formats` will only ever offer
`pdf`, `png`, `jpg`, `gif`, `pptx`, `mp4`, `csv` for this design type) - export PNG and convert
locally. This is how CC.1 and CC.2's committed decks were made.

1. `get-export-formats(design_id=<assembled deck>)` - confirm `png` is offered for the pages you
   want (it will be).
2. Per page: `export-design(design_id=<assembled deck>, format: { type: "png", pages: [<page
   number>], width: 1920, height: 1080, lossless: true })`. The response includes a download URL -
   fetch it (`curl -o /tmp/<file>.png <url>`, via the Bash tool) rather than trying to read it as
   text.
3. Convert to WebP: `cwebp -q 90 /tmp/<file>.png -o public/slides/<name>.webp` (confirmed present
   at `/opt/homebrew/bin/cwebp` on this machine; if a future environment lacks it, `sips` cannot
   write WebP - fall back to ImageMagick `magick convert` or install `cwebp` via `brew install
   webp`). Check the result is comfortably under ~300KB per `public/slides/README.md`; if it's much
   larger, re-export or drop `lossless`.

Naming convention (matches the 46 existing `cc1-*` / `cc2-*` files - check `ls public/slides/`
before you start if you want a fresh example): `<lessoncode-lowercase>-<order2digit>-<slug>.webp`,
e.g. `cc3-04-the-claim.webp`. Order is the deck's page order, zero-padded to 2 digits; slug is a
short kebab-case tag from the slide's headline.

## Step 6 - wire into Notion

Match Canva pages to Lesson Steps BY CONTENT, not by position - they will not always line up 1:1
(a step you skipped in Step 2 has no page; the Title slide has no matching step at all). It is
correct to leave a step's `Slide Url` empty if nothing genuinely corresponds - never force a bad
match.

`Slide Url` is a Notion FILE property (per CLAUDE.md - it is NOT a plain text/URL property), read
on the runtime side through `propByName` in `src/lib/notionLessons.ts`, and it is what
`slideFrameFromLayout` resolves into the `slide` frame's image source. Before batch-writing:

1. `notion-fetch` the Lesson Steps data source and confirm the exact property type for `Slide Url`.
2. Test the write on ONE step first: `notion-update-page(page_id=<step page id>, command:
   "update_properties", properties: { "Slide Url": "/slides/<file>.webp" })` (or whatever shape the
   fetched schema says a file/external-link property actually wants - do not assume the same shape
   as a text property).
3. `notion-fetch` that step back and confirm the value actually landed and reads as
   `/slides/<file>.webp`, not something malformed or silently dropped. Only then continue through
   the rest of the steps for this lesson.

## Step 7 - ship it

Follow CLAUDE.md rule 3's flow exactly; this pipeline only touches new files under
`public/slides/`, so conflicts should be rare.

1. `git status` first. Stage only the new webp files by explicit path - never `git add .` or
   `git add -A` (rule 2; other sessions have uncommitted work in this tree).
   ```
   git add public/slides/<lessoncode>-01-....webp public/slides/<lessoncode>-02-....webp ...
   git commit -m "Add <LessonCode> slide deck"
   git push -u origin <branch>
   ```
2. Merge into a clean worktree tracking `origin/main`, inside the repo (a scratch worktree outside
   `.claude/worktrees/` breaks `npm run build`'s Turbopack symlink check - see CLAUDE.md's "Scratch
   worktrees" note). `git fetch origin`, merge your branch into a worktree on `main`, resolve
   anything that comes up.
3. `npm run typecheck && npm run build` on the MERGED tree, not just your feature branch.
4. Push to `main`.
5. Verify live, not just pushed: `curl "https://bigdogmath.com/api/build-id?cachebust=$(date
   +%s)"` and confirm the returned sha actually matches your new commit. CLAUDE.md documents a real
   history of silent deploy stalls on this repo - a push is not evidence of "live," the build-id
   moving is. Give it a few minutes and recheck if it hasn't moved yet; if it still hasn't after
   several minutes, say so plainly rather than assuming it's just slow.

## Report back

State: which lesson, how many slides, which steps got a type and which were deliberately skipped
(and why), the module color used, the exported file list, whether `Slide Url` writes verified, and
whether the deploy actually went live (with the confirmed build-id). Flag anything you had to
guess at - a step whose content didn't cleanly fit one of the 8 types, a `Slide Url` write whose
exact payload shape you had to improvise, a thumbnail that showed overflow you patched by hand.
