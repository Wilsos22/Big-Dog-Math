// The per-step screen layout the Lesson Screen Studio persists inside a Lesson Step's
// `AI Context` as a single `[BDM_SCREEN_LAYOUT:<base64url>]` marker (see lessonStepMetadata.ts).
//
// This module is the shared, framework-free contract for that blob: the layout shape, the
// component vocabulary, and the encode/decode/validate helpers. It has NO React or step-data
// dependencies on purpose - the write path in notionLessonStepWrites.ts imports the validator,
// so this file has to stay safe to run on the server. The studio's auto-value derivation and the
// default-zone rules live beside the components, which is where step data is known.

export const SCREEN_KEYS = ["main", "pace", "student"] as const;
export type ScreenKey = (typeof SCREEN_KEYS)[number];

export const SCREEN_COMPONENT_TYPES = [
  "prompt",
  "text",
  "model",
  "doThis",
  "timer",
  "support",
  "equation",
  "legend",
  "callout",
] as const;
export type ScreenComponentType = (typeof SCREEN_COMPONENT_TYPES)[number];

// One placed component. `ov` is the per-field override map; an absent key means "use the Notion
// value" (that is what makes an override additive and reversible). `id` is a runtime handle only -
// it is unique within a screen and is regenerated on decode, never persisted.
export interface ScreenBlock {
  id: string;
  type: ScreenComponentType;
  ov: Record<string, string>;
}

// A screen is exactly two zones today; each zone is an ordered list of blocks, top to bottom.
export type ScreenZones = ScreenBlock[][];

// Only the screens the teacher has actually customized appear. A missing screen renders its
// derived default, which is what makes "reset to auto" free.
export type StepScreenLayout = Partial<Record<ScreenKey, ScreenZones>>;

// Bounds - a layout that would blow the Notion text budget must be rejected before it is written.
const MAX_PAYLOAD_LENGTH = 8000;
const MAX_ZONES_PER_SCREEN = 4;
const MAX_BLOCKS_PER_ZONE = 12;
const MAX_OVERRIDE_KEY_LENGTH = 40;
const MAX_OVERRIDE_VALUE_LENGTH = 2000;

const COMPONENT_TYPE_SET = new Set<string>(SCREEN_COMPONENT_TYPES);

// Wire form is compact: per screen, an array of zones; each zone an array of entries; each entry is
// [type] with no overrides, or [type, overrides] with them. Ids are not stored.
type WireEntry = [string] | [string, Record<string, string>];
type WireScreen = WireEntry[][];

const BASE64_URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let encoded = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    encoded += BASE64_URL_ALPHABET[first >> 2];
    encoded += BASE64_URL_ALPHABET[((first & 3) << 4) | ((second ?? 0) >> 4)];
    if (second !== undefined) encoded += BASE64_URL_ALPHABET[((second & 15) << 2) | ((third ?? 0) >> 6)];
    if (third !== undefined) encoded += BASE64_URL_ALPHABET[third & 63];
  }
  return encoded;
}

function decodeBase64Url(value: string): string | null {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) return null;
  const bytes: number[] = [];
  for (let index = 0; index < value.length; index += 4) {
    const first = BASE64_URL_ALPHABET.indexOf(value[index]);
    const second = BASE64_URL_ALPHABET.indexOf(value[index + 1]);
    const third = index + 2 < value.length ? BASE64_URL_ALPHABET.indexOf(value[index + 2]) : -1;
    const fourth = index + 3 < value.length ? BASE64_URL_ALPHABET.indexOf(value[index + 3]) : -1;
    if (first < 0 || second < 0 || (third < 0 && index + 2 < value.length) || (fourth < 0 && index + 3 < value.length)) {
      return null;
    }
    bytes.push((first << 2) | (second >> 4));
    if (third >= 0) bytes.push(((second & 15) << 4) | (third >> 2));
    if (fourth >= 0) bytes.push(((third & 3) << 6) | fourth);
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes));
  } catch {
    return null;
  }
}

function sanitizeOverrides(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof key !== "string" || key.length === 0 || key.length > MAX_OVERRIDE_KEY_LENGTH) continue;
    if (typeof value !== "string" || value.length > MAX_OVERRIDE_VALUE_LENGTH) continue;
    out[key] = value;
  }
  return out;
}

function zonesFromWire(screen: unknown, screenKey: ScreenKey): ScreenZones | null {
  if (!Array.isArray(screen) || screen.length > MAX_ZONES_PER_SCREEN) return null;
  const zones: ScreenZones = [];
  screen.forEach((zone, zoneIndex) => {
    if (!Array.isArray(zone) || zone.length > MAX_BLOCKS_PER_ZONE) {
      zones.push([]);
      return;
    }
    const blocks: ScreenBlock[] = [];
    zone.forEach((entry, blockIndex) => {
      if (!Array.isArray(entry) || entry.length === 0) return;
      const type = entry[0];
      if (typeof type !== "string" || !COMPONENT_TYPE_SET.has(type)) return;
      blocks.push({
        id: `${screenKey}-z${zoneIndex}b${blockIndex}`,
        type: type as ScreenComponentType,
        ov: sanitizeOverrides(entry[1]),
      });
    });
    zones.push(blocks);
  });
  return zones;
}

function wireFromZones(zones: ScreenZones): WireScreen {
  return zones.map((zone) =>
    zone.map((block): WireEntry => {
      const overrides = sanitizeOverrides(block.ov);
      return Object.keys(overrides).length ? [block.type, overrides] : [block.type];
    }),
  );
}

// Encode a runtime layout to a base64url payload. Screens with no zones are dropped, and an
// entirely empty layout returns "" - the marker is only written when there is something to save.
export function encodeScreenLayout(layout: StepScreenLayout): string {
  const wire: Record<string, WireScreen> = {};
  for (const key of SCREEN_KEYS) {
    const zones = layout[key];
    if (!zones || !zones.length) continue;
    wire[key] = wireFromZones(zones);
  }
  if (!Object.keys(wire).length) return "";
  const encoded = encodeBase64Url(JSON.stringify(wire));
  return encoded.length > MAX_PAYLOAD_LENGTH ? "" : encoded;
}

// Decode a payload to a runtime layout. Any malformed input yields {} rather than throwing, so a
// corrupt blob falls back to the derived defaults instead of breaking the studio or a surface.
export function decodeScreenLayout(payload: string | null | undefined): StepScreenLayout {
  if (typeof payload !== "string" || payload === "" || payload.length > MAX_PAYLOAD_LENGTH) return {};
  const json = decodeBase64Url(payload);
  if (json === null) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const layout: StepScreenLayout = {};
  for (const key of SCREEN_KEYS) {
    const zones = zonesFromWire((parsed as Record<string, unknown>)[key], key);
    if (zones) layout[key] = zones;
  }
  return layout;
}

// True when a payload is a well-formed, in-bounds encoded layout. Used by the write path to reject
// anything that would not round-trip or would overflow the Notion text budget.
export function isEncodedScreenLayout(payload: unknown): boolean {
  if (typeof payload !== "string" || payload === "" || payload.length > MAX_PAYLOAD_LENGTH) return false;
  if (!/^[A-Za-z0-9_-]+$/.test(payload)) return false;
  const decoded = decodeScreenLayout(payload);
  return Object.keys(decoded).length > 0;
}
