// Contract: the slide-frame URL resolver classifies and rewrites exactly what a teacher pastes,
// and never hands a projector something that will render as a white void.
//
// WHY THIS EXISTS. This module had no test at all, and it sits on the one path where a mistake is
// visible to thirty students at once: an outside deck framed inside the lesson chrome. Four ways it
// could fail quietly, all pinned here:
//   1. A same-origin exported slide - the ONLY source that cannot fail on school wifi - being
//      rejected because the URL parser demands a scheme.
//   2. A share URL copied out of Canva / Slides / Figma / Lucid not being rewritten into that
//      product's embed form, which frames as a login wall or a blank rectangle.
//   3. A cross-origin URL sneaking through the same-origin branch (`//evil.com/x.png`).
//   4. An unknown site being REJECTED rather than offered with a warning, which would have meant
//      maintaining a host list forever.
//
// Run: npm run test:embed-url

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  EMBED_HOST_ALLOWLIST,
  IMAGE_HOST_ALLOWLIST,
  resolveSlideSource,
  slideSourceLabel,
} from "../.tmp-mastery/embedUrl.js";

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  console.log(`  ok  ${name}`);
}

console.log("embed url contract");

// ---- The same-origin image path ----------------------------------------------------------------
// This is the recommended source: an exported slide committed to public/slides/ and served by the
// same CDN that delivered the page. No expiry, no third party, nothing to re-fetch mid-lesson.

check("a root-relative image path resolves as a same-origin image, untouched", () => {
  const source = resolveSlideSource("/slides/m1t1l1-3.webp");
  assert.equal(source.kind, "image");
  assert.equal(source.url, "/slides/m1t1l1-3.webp");
  assert.equal(source.host, "");
  assert.equal(source.reason, "");
});

check("a cache-busting query does not break the same-origin path", () => {
  assert.equal(resolveSlideSource("/slides/a.png?v=2").kind, "image");
  assert.equal(resolveSlideSource("/slides/a.png#top").kind, "image");
});

check("every image extension the renderer supports is accepted same-origin", () => {
  for (const ext of ["png", "jpg", "jpeg", "gif", "webp", "avif", "svg"]) {
    assert.equal(resolveSlideSource(`/slides/deck.${ext}`).kind, "image", ext);
  }
});

check("a protocol-relative URL is NOT treated as same-origin", () => {
  // `//evil.com/x.png` is cross-origin. It must fall through to the parser, which rejects it.
  const source = resolveSlideSource("//evil.com/x.png");
  assert.equal(source.kind, "none");
  assert.equal(source.url, "");
});

check("a backslash cannot be used as the second slash", () => {
  // The URL spec treats `\` as `/` for http(s), so every one of these resolves to a cross-origin
  // host despite starting with a single forward slash. A guard that only checked for `//` let
  // them through as same-origin images.
  for (const raw of ["/\\evil.com/x.png", "/\\/evil.com/x.png", "/\\\\evil.com/x.png"]) {
    const source = resolveSlideSource(raw);
    assert.equal(source.kind, "none", raw);
    assert.equal(source.url, "", raw);
  }
  // Sanity: the resolution these guard against is real, not theoretical.
  assert.equal(new URL("/\\evil.com/x.png", "https://bigdogmath.com").host, "evil.com");
});

check("a same-origin PAGE is refused, with a reason", () => {
  // Framing this app inside its own projector view is a recursion nobody wants to debug in class.
  const source = resolveSlideSource("/lesson");
  assert.equal(source.kind, "none");
  assert.ok(source.reason.length > 0, "the studio needs something to show the teacher");
});

check("the same-origin label is distinguishable from a remote image", () => {
  assert.equal(slideSourceLabel(resolveSlideSource("/slides/a.webp")), "Image on this site");
  assert.equal(
    slideSourceLabel(resolveSlideSource("https://images.unsplash.com/photo-1.jpg")),
    "Image",
  );
});

// ---- Remote images -----------------------------------------------------------------------------

check("an allowlisted host serves an image; an unknown host does not", () => {
  assert.equal(resolveSlideSource("https://images.unsplash.com/photo-1.jpg").kind, "image");
  const blocked = resolveSlideSource("https://example.com/photo.jpg");
  assert.equal(blocked.kind, "none");
  assert.match(blocked.reason, /not allowed/i);
});

check("bigdogmath.com is on the image allowlist so an absolute site URL also works", () => {
  assert.ok(IMAGE_HOST_ALLOWLIST.includes("bigdogmath.com"));
  const source = resolveSlideSource("https://bigdogmath.com/slides/m1t1l1-3.webp");
  assert.equal(source.kind, "image");
  assert.equal(source.host, "bigdogmath.com");
});

// ---- Per-product embed rewrites ----------------------------------------------------------------
// Paste-what-you-see is the whole point: the URL out of the product's Share button, not embed
// syntax nobody remembers between classes.

check("a Canva share link becomes a /view embed with a bare ?embed flag", () => {
  const source = resolveSlideSource("https://www.canva.com/design/DAF123abc/edit");
  assert.equal(source.kind, "embed");
  assert.ok(source.url.includes("/view"), source.url);
  // URLSearchParams would render this as `embed=`, which Canva ignores.
  assert.ok(/[?&]embed(?:&|$)/.test(source.url), source.url);
});

check("a Google Slides edit link becomes the minimal-chrome embed", () => {
  const source = resolveSlideSource("https://docs.google.com/presentation/d/ABC123/edit#slide=id.p");
  assert.equal(source.kind, "embed");
  assert.ok(source.url.startsWith("https://docs.google.com/presentation/d/ABC123/embed"), source.url);
  assert.ok(source.url.includes("rm=minimal"), source.url);
  assert.ok(source.url.includes("start=false"), source.url);
});

check("a Figma link is rewritten onto embed.figma.com", () => {
  const source = resolveSlideSource("https://www.figma.com/design/abcdefghij12/Board-Name");
  assert.equal(source.kind, "embed");
  assert.ok(source.url.startsWith("https://embed.figma.com/design/abcdefghij12"), source.url);
  assert.ok(source.url.includes("embed-host=bigdogmath"), source.url);
});

check("a Lucid share link becomes a /documents/embedded/ URL", () => {
  const source = resolveSlideSource("https://lucid.app/lucidspark/1a2b3c4d-5e6f/edit");
  assert.equal(source.kind, "embed");
  assert.ok(source.url.startsWith("https://lucid.app/documents/embedded/1a2b3c4d-5e6f"), source.url);
});

check("an already-embed URL passes through rather than being rewritten twice", () => {
  const lucid = resolveSlideSource("https://lucid.app/documents/embedded/1a2b3c4d-5e6f");
  assert.equal(lucid.kind, "embed");
  assert.ok(lucid.url.includes("/documents/embedded/1a2b3c4d-5e6f"), lucid.url);
});

check("each product gets its own label", () => {
  const label = (url) => slideSourceLabel(resolveSlideSource(url));
  assert.equal(label("https://www.canva.com/design/DAF123abc/edit"), "Canva design");
  assert.equal(label("https://docs.google.com/presentation/d/ABC123/edit"), "Google Slides");
  assert.equal(label("https://www.figma.com/design/abcdefghij12/Name"), "Figma board");
  assert.equal(label("https://lucid.app/lucidspark/1a2b3c4d-5e6f/edit"), "Lucid board");
});

// ---- Rejections and the site fallback -----------------------------------------------------------

check("an allowlisted host that is not a deck is refused rather than framed", () => {
  // A Google DOC on docs.google.com has no embed form we can build. Refusing beats framing a
  // login wall onto a projector.
  const source = resolveSlideSource("https://docs.google.com/document/d/ABC123/edit");
  assert.equal(source.kind, "none");
  assert.match(source.reason, /board or deck/i);
});

check("an unknown https site is offered as a website, with a warning", () => {
  const source = resolveSlideSource("https://www.desmos.com/calculator");
  assert.equal(source.kind, "site");
  assert.equal(source.url, "https://www.desmos.com/calculator");
  assert.ok(source.warning.includes("desmos.com"), source.warning);
});

check("http and junk are refused; empty gives no scolding reason", () => {
  assert.equal(resolveSlideSource("http://example.com/deck").kind, "none");
  assert.equal(resolveSlideSource("not a url").kind, "none");
  const empty = resolveSlideSource("");
  assert.equal(empty.kind, "none");
  assert.equal(empty.reason, "", "an untouched field is not an error");
});

check("a rejected source never carries a URL a surface could render", () => {
  for (const raw of ["", "nope", "http://x.com/a", "https://example.com/a.jpg", "/lesson"]) {
    const source = resolveSlideSource(raw);
    if (source.kind === "none") assert.equal(source.url, "", raw);
  }
});

// ---- Structural guards --------------------------------------------------------------------------

check("the module stays import-free so it can compile in isolation", () => {
  // Same constraint soundBank.ts and notionLessonArchive.ts live under: this contract compiles the
  // file with `tsc --ignoreConfig`, which DROPS the `@/` path aliases. A local import here fails CI
  // with "Cannot find module", and the failure looks nothing like its cause.
  const src = readFileSync(new URL("../src/lib/embedUrl.ts", import.meta.url), "utf8");
  assert.ok(!/^\s*import\s/m.test(src), "embedUrl.ts must not import anything");
});

check("the embed allowlist still covers the four products the rewrites handle", () => {
  for (const host of ["lucid.app", "figma.com", "canva.com", "docs.google.com"]) {
    assert.ok(EMBED_HOST_ALLOWLIST.includes(host), host);
  }
});

console.log(`\n${checks} checks passed.`);
