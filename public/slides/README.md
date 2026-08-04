# public/slides

Exported slide images for the lesson `slide` frame. A file dropped here is served from
`https://bigdogmath.com/slides/<name>` and is referenced from a Lesson Step as a root-relative
path: `/slides/m1t1l1-d1-3.webp`.

## Why images live here instead of a live embed

This is the most reliable slide source there is. A live Canva / Google Slides / Lucid / Figma
embed depends on school wifi at the moment the projector renders, on a third party staying up,
and on that third party not changing its framing policy - three ways to put the four-second
"Board did not load" fallback card on a classroom screen mid-lesson. An image here is served by
the same CDN that just delivered the page: if the page loaded, the slide loaded.

A Notion-UPLOADED file is the worst option and must not be used for anything the room has to
read. Notion resolves an upload to a signed S3 url that expires in about an hour, and Control
freezes the url when it builds the lineup and republishes that same dead url all period. A deck
loaded at 7:30 is a fallback card by period 4.

Live embeds are still right for a board being actively edited during class - a Lucid or Figma
canvas the room is watching change. Reserve them for that.

## Naming

`<lesson-code-lowercased>-<step order>.<ext>` - for example `m1t1l1-d1-3.webp` is the slide for
step 3 of M1.T1.L1-D1. One file per Lesson Step; a step is one visual with its own clock.

## Format

Export at 1920x1080 and save as WebP. WebP holds text crisply and runs roughly a fifth the size
of PNG, which matters because these are committed to a public git repository and accumulate over
a school year. Keep a slide under about 300KB; if it is much larger, the export is oversized.

## Before you commit one

NO STUDENT NAMES, no district emails, no student work with a name on it, no roster screenshots.
This repository is public and these files are served publicly. See the FERPA boundary in
`CLAUDE.md`.
