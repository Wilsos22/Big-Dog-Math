// Turns a URL a teacher pasted into something the `slide` screen component can actually render:
// an image, or an iframe whose host is on the allowlist. Paste-what-you-see is the whole point -
// the share URL copied out of Lucid, Figma, Canva or Google Slides is rewritten into that product's
// embed form here, so nobody has to remember embed syntax between classes.
//
// Framework-free on purpose: lessonScreenModel and the studio both import it, and neither may pull
// React or the DOM into the server bundle.

export type SlideSourceKind = "image" | "embed" | "site" | "none";

export interface SlideSource {
  kind: SlideSourceKind;
  // The URL to hand to <img src> or <iframe src>. Empty when kind is "none".
  url: string;
  host: string;
  // Why a URL was rejected. Surfaced in the studio inspector only - never on a projector.
  reason: string;
  // Set on `site` sources. Plenty of sites send X-Frame-Options: DENY and simply refuse to load in
  // a frame - we cannot detect that ahead of time, so the studio warns and the projector falls back.
  warning: string;
}

const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|avif|svg)(?:$|[?#])/i;

// Hosts permitted inside an iframe on a classroom projector. Keep this in sync with `frame-src`
// in the CSP. An off-list host renders the "cannot embed" card rather than a blank frame, because
// a blank frame read at 25 feet looks like a broken lesson.
export const EMBED_HOST_ALLOWLIST: readonly string[] = [
  "lucid.app",
  "lucidchart.com",
  "www.lucidchart.com",
  "lucidspark.com",
  "www.lucidspark.com",
  "figma.com",
  "www.figma.com",
  "embed.figma.com",
  "canva.com",
  "www.canva.com",
  "docs.google.com",
];

// Hosts we are willing to load an <img> from. Notion's own file CDN is included so a Files
// property on the Lesson Step works without a separate upload step.
export const IMAGE_HOST_ALLOWLIST: readonly string[] = [
  "prod-files-secure.s3.us-west-2.amazonaws.com",
  "s3.us-west-2.amazonaws.com",
  "www.notion.so",
  "images.unsplash.com",
  "drive.google.com",
  "lh3.googleusercontent.com",
];

function hostAllowed(host: string, list: readonly string[]): boolean {
  return list.some((allowed) => host === allowed || host.endsWith("." + allowed));
}

function parse(raw: string): URL | null {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

// ---- Per-product rewrites ----------------------------------------------------------------------

// lucid.app/lucidspark/<id>/edit  ->  lucid.app/documents/embedded/<id>
function rewriteLucid(url: URL): URL | null {
  if (url.pathname.startsWith("/documents/embedded/")) return url;
  const match = url.pathname.match(/\/(?:lucidspark|lucidchart|documents)\/([0-9a-f-]{8,})/i);
  if (!match) return null;
  const next = new URL("https://lucid.app/documents/embedded/" + match[1]);
  next.searchParams.set("invitationId", url.searchParams.get("invitationId") || "");
  if (!next.searchParams.get("invitationId")) next.searchParams.delete("invitationId");
  return next;
}

// figma.com/board/<id>/...  ->  embed.figma.com/board/<id>?embed-host=bigdogmath
function rewriteFigma(url: URL): URL | null {
  if (url.host === "embed.figma.com") {
    url.searchParams.set("embed-host", "bigdogmath");
    return url;
  }
  const match = url.pathname.match(/^\/(board|file|design|proto|slides)\/([0-9A-Za-z]{10,})/);
  if (!match) return null;
  const next = new URL(`https://embed.figma.com/${match[1]}/${match[2]}`);
  next.searchParams.set("embed-host", "bigdogmath");
  return next;
}

// canva.com/design/<id>/view  ->  same URL with ?embed
function rewriteCanva(url: URL): URL | null {
  if (!/^\/design\/[^/]+\//.test(url.pathname)) return null;
  const next = new URL(url.toString());
  if (!next.pathname.endsWith("/view")) {
    next.pathname = next.pathname.replace(/\/(edit|watch|view)?$/, "/view");
  }
  next.searchParams.set("embed", "");
  return next;
}

// docs.google.com/presentation/d/<id>/edit  ->  .../embed?rm=minimal
function rewriteGoogle(url: URL): URL | null {
  const match = url.pathname.match(/^\/presentation\/d\/([^/]+)/);
  if (!match) return null;
  const next = new URL(`https://docs.google.com/presentation/d/${match[1]}/embed`);
  next.searchParams.set("start", "false");
  next.searchParams.set("loop", "false");
  next.searchParams.set("rm", "minimal");
  return next;
}

// ---- Public API --------------------------------------------------------------------------------

/**
 * Classify and normalise a pasted slide URL.
 *
 * An image URL passes through untouched. A board URL is rewritten to its product's embed form.
 * Anything else comes back as `kind: "none"` with a reason the studio can show the teacher.
 */
export function resolveSlideSource(raw: string): SlideSource {
  const url = parse(raw);
  if (!url) {
    const trimmed = String(raw || "").trim();
    return {
      kind: "none",
      url: "",
      host: "",
      reason: trimmed ? "Needs a full https:// link" : "",
      warning: "",
    };
  }

  const host = url.host.toLowerCase();

  if (IMAGE_EXTENSIONS.test(url.pathname)) {
    return hostAllowed(host, IMAGE_HOST_ALLOWLIST)
      ? { kind: "image", url: url.toString(), host, reason: "", warning: "" }
      : { kind: "none", url: "", host, reason: `Images are not allowed from ${host}`, warning: "" };
  }

  // Any other https page is offered as a plain website embed. No allowlist here on purpose - the
  // field is teacher-authored and the surface is a projector, and refusing unknown sites would have
  // meant maintaining a list forever. Sites that block framing fail into the fallback card.
  if (!hostAllowed(host, EMBED_HOST_ALLOWLIST)) {
    return {
      kind: "site",
      url: url.toString(),
      host,
      reason: "",
      warning: `Some sites refuse to load inside a frame. Open ${host} once on the projector before class.`,
    };
  }

  const rewritten =
    host.includes("lucid") ? rewriteLucid(url)
    : host.includes("figma") ? rewriteFigma(url)
    : host.includes("canva") ? rewriteCanva(url)
    : host.includes("docs.google") ? rewriteGoogle(url)
    : url;

  if (!rewritten) {
    return { kind: "none", url: "", host, reason: "That link is not a board or deck we can embed", warning: "" };
  }

  // Canva wants a bare `?embed` flag, which URLSearchParams would render as `embed=`.
  const out = rewritten.toString().replace(/([?&])embed=(?=&|$)/, "$1embed");
  return { kind: "embed", url: out, host, reason: "", warning: "" };
}

/** A one-line human label for the source, used in the studio inspector. */
export function slideSourceLabel(source: SlideSource): string {
  if (source.kind === "image") return "Image";
  if (source.kind === "site") return "Website";
  if (source.kind !== "embed") return "";
  if (source.host.includes("lucid")) return "Lucid board";
  if (source.host.includes("figma")) return "Figma board";
  if (source.host.includes("canva")) return "Canva design";
  if (source.host.includes("docs.google")) return "Google Slides";
  return "Embedded board";
}
