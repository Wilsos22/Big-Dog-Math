export const PUBLIC_SURFACE_MODES = ["split", "linked"] as const;

export type PublicSurfaceMode = (typeof PUBLIC_SURFACE_MODES)[number];

export interface ParsedLessonStepAiContext {
  userText: string;
  publicSurfaceMode: PublicSurfaceMode | null;
  // Base64url payload for the studio's per-step screen layout (`[BDM_SCREEN_LAYOUT:...]`),
  // "" when the step has no saved layout. See lessonScreenLayout.ts for the decoded shape.
  screenLayout: string;
  createToken: string;
  lineEnding: "\n" | "\r\n";
}

interface SerializeLessonStepAiContextInput {
  userText: string;
  publicSurfaceMode: PublicSurfaceMode | null;
  screenLayout?: string | null;
  createToken?: string | null;
  lineEnding?: "\n" | "\r\n";
}

const CREATE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,100}$/;
const CREATE_TOKEN_TRAILER_PATTERN = /\[BDM_CREATE_TOKEN:([A-Za-z0-9_-]{16,100})\]\s*$/;
const PUBLIC_SURFACE_MARKER_PATTERN = /^[\t ]*\[BDM_PUBLIC_SURFACES:(split|linked)\][\t ]*$/gm;
// The studio persists its per-step screen layout as a single base64url line marker. Kept
// specific to BDM_SCREEN_LAYOUT (never a generic BDM_* sweep) so unknown markers stay user text.
const SCREEN_LAYOUT_MARKER_PATTERN = /^[\t ]*\[BDM_SCREEN_LAYOUT:([A-Za-z0-9_-]*)\][\t ]*$/gm;
const SCREEN_LAYOUT_PAYLOAD_PATTERN = /^[A-Za-z0-9_-]+$/;
const LINKED_BY_DEFAULT_STATE_IDS = new Set([
  "learning-target-readers",
  "ipad-kid",
]);

function lineEndingFor(value: string): "\n" | "\r\n" {
  return value.includes("\r\n") ? "\r\n" : "\n";
}

function trimInternalBoundaryWhitespace(value: string): string {
  return value
    .replace(/^(?:[\t ]*\r?\n)+/, "")
    .replace(/(?:\r?\n[\t ]*)+$/, "")
    .trimEnd();
}

function publicSurfaceMarkers(value: string): PublicSurfaceMode[] {
  const modes: PublicSurfaceMode[] = [];
  for (const match of value.matchAll(PUBLIC_SURFACE_MARKER_PATTERN)) {
    const mode = match[1];
    if (mode === "split" || mode === "linked") modes.push(mode);
  }
  return modes;
}

function screenLayoutMarkers(value: string): string[] {
  const payloads: string[] = [];
  for (const match of value.matchAll(SCREEN_LAYOUT_MARKER_PATTERN)) {
    if (match[1]) payloads.push(match[1]);
  }
  return payloads;
}

function withoutInternalMarkers(value: string): string {
  return trimInternalBoundaryWhitespace(
    value
      .replace(PUBLIC_SURFACE_MARKER_PATTERN, "")
      .replace(SCREEN_LAYOUT_MARKER_PATTERN, ""),
  );
}

export function isPublicSurfaceMode(value: unknown): value is PublicSurfaceMode {
  return value === "split" || value === "linked";
}

export function parseLessonStepAiContext(value: string | null | undefined): ParsedLessonStepAiContext {
  const source = typeof value === "string" ? value : "";
  const lineEnding = lineEndingFor(source);
  const createTokenMatch = source.match(CREATE_TOKEN_TRAILER_PATTERN);
  const createToken = createTokenMatch?.[1] || "";
  const beforeCreateToken = createTokenMatch && typeof createTokenMatch.index === "number"
    ? source.slice(0, createTokenMatch.index)
    : source;
  const modes = publicSurfaceMarkers(beforeCreateToken);
  const layouts = screenLayoutMarkers(beforeCreateToken);

  return {
    userText: withoutInternalMarkers(beforeCreateToken),
    publicSurfaceMode: modes[modes.length - 1] || null,
    screenLayout: layouts[layouts.length - 1] || "",
    createToken,
    lineEnding,
  };
}

export function serializeLessonStepAiContext({
  userText,
  publicSurfaceMode,
  screenLayout = "",
  createToken = "",
  lineEnding = lineEndingFor(userText),
}: SerializeLessonStepAiContextInput): string {
  if (publicSurfaceMode !== null && !isPublicSurfaceMode(publicSurfaceMode)) {
    throw new TypeError("Public surface mode must be split, linked, or null.");
  }
  if (screenLayout && !SCREEN_LAYOUT_PAYLOAD_PATTERN.test(screenLayout)) {
    throw new TypeError("Screen layout must be a base64url payload.");
  }
  if (createToken && !CREATE_TOKEN_PATTERN.test(createToken)) {
    throw new TypeError("Create token must use the supported internal token format.");
  }

  const cleanText = parseLessonStepAiContext(userText).userText;
  const sections = [cleanText];
  if (publicSurfaceMode) sections.push(`[BDM_PUBLIC_SURFACES:${publicSurfaceMode}]`);
  if (screenLayout) sections.push(`[BDM_SCREEN_LAYOUT:${screenLayout}]`);
  if (createToken) sections.push(`[BDM_CREATE_TOKEN:${createToken}]`);
  return sections.filter(Boolean).join(`${lineEnding}${lineEnding}`);
}

export function setScreenLayout(
  value: string | null | undefined,
  screenLayout: string,
): string {
  const parsed = parseLessonStepAiContext(value);
  return serializeLessonStepAiContext({
    ...parsed,
    screenLayout,
  });
}

export function setPublicSurfaceMode(
  value: string | null | undefined,
  publicSurfaceMode: PublicSurfaceMode,
): string {
  const parsed = parseLessonStepAiContext(value);
  return serializeLessonStepAiContext({
    ...parsed,
    publicSurfaceMode,
  });
}

export function replaceLessonStepAiContextText(
  value: string | null | undefined,
  userText: string,
): string {
  const parsed = parseLessonStepAiContext(value);
  return serializeLessonStepAiContext({
    ...parsed,
    userText,
  });
}

export function defaultPublicSurfaceModeForState(stateId: string | null | undefined): PublicSurfaceMode {
  return LINKED_BY_DEFAULT_STATE_IDS.has((stateId || "").trim().toLowerCase()) ? "linked" : "split";
}

export function resolvePublicSurfaceMode(
  value: string | null | undefined,
  stateId: string | null | undefined,
): PublicSurfaceMode {
  return parseLessonStepAiContext(value).publicSurfaceMode || defaultPublicSurfaceModeForState(stateId);
}
