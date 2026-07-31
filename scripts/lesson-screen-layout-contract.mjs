import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const layout = require(path.join(root, ".tmp-mastery", "lessonScreenLayout.js"));

// Round-trip: a customized layout survives encode -> decode with the same types, order, and overrides.
const original = {
  main: [
    [{ id: "x", type: "model", ov: {} }],
    [
      { id: "y", type: "prompt", ov: { mainDisplay: "Custom prompt" } },
      { id: "z", type: "text", ov: {} },
    ],
  ],
  pace: [
    [{ id: "a", type: "doThis", ov: { doThisTitle: "Try this" } }],
    [{ id: "b", type: "timer", ov: {} }],
  ],
};

const encoded = layout.encodeScreenLayout(original);
assert.ok(encoded.length > 0, "A non-empty layout encodes to a payload.");
assert.match(encoded, /^[A-Za-z0-9_-]+$/, "The payload is base64url.");
assert.ok(layout.isEncodedScreenLayout(encoded), "A real payload validates.");

const decoded = layout.decodeScreenLayout(encoded);
assert.deepEqual(Object.keys(decoded).sort(), ["main", "pace"]);
assert.equal(decoded.main.length, 2);
assert.equal(decoded.main[0][0].type, "model");
assert.equal(decoded.main[1][0].type, "prompt");
assert.equal(decoded.main[1][0].ov.mainDisplay, "Custom prompt");
assert.equal(decoded.main[1][1].type, "text");
assert.equal(decoded.pace[0][0].ov.doThisTitle, "Try this");
assert.ok(decoded.main[0][0].id, "Decoded blocks get a runtime id.");
assert.notEqual(decoded.main[1][0].id, decoded.main[1][1].id, "Ids are unique within a screen.");

// Empty layout -> no payload, and the "student" screen is simply absent when never customized.
assert.equal(layout.encodeScreenLayout({}), "");
assert.equal(layout.encodeScreenLayout({ main: [] }), "");
assert.equal(decoded.student, undefined);

// Robustness: malformed input decodes to {} rather than throwing.
assert.deepEqual(layout.decodeScreenLayout("!!!not base64!!!"), {});
assert.deepEqual(layout.decodeScreenLayout(""), {});
assert.deepEqual(layout.decodeScreenLayout(null), {});
assert.deepEqual(layout.decodeScreenLayout("Zm9vYmFy"), {}, "Valid base64 that is not a layout object decodes empty.");
assert.equal(layout.isEncodedScreenLayout("!!!"), false);
assert.equal(layout.isEncodedScreenLayout(""), false);
assert.equal(layout.isEncodedScreenLayout(42), false);

// Demo objects are ephemeral - they must never survive into the persisted blob.
const withDemo = layout.encodeScreenLayout({
  main: [
    [
      { id: "p", type: "prompt", ov: {} },
      { id: "d", type: "manipSplit", ov: { rows: "6" } },
    ],
    [{ id: "m", type: "model", ov: {} }],
  ],
});
const demoDecoded = layout.decodeScreenLayout(withDemo);
const mainTypes = demoDecoded.main.flat().map((b) => b.type);
assert.ok(!mainTypes.includes("manipSplit"), "Demo objects are stripped from the persisted blob.");
assert.deepEqual(mainTypes, ["prompt", "model"], "Real frames survive; the demo object does not.");

// Unknown component types are dropped, not trusted.
const withJunk = layout.encodeScreenLayout({ main: [[{ id: "j", type: "prompt", ov: {} }]] });
const tampered = Buffer.from(
  JSON.stringify({ main: [[["prompt"], ["not-a-real-type"]]] }),
  "utf-8",
).toString("base64url");
const tamperedDecoded = layout.decodeScreenLayout(tampered);
assert.equal(tamperedDecoded.main[0].length, 1, "Unknown component types are filtered out on decode.");
assert.ok(layout.isEncodedScreenLayout(withJunk));

console.log("PASS - lesson screen layout encodes, decodes, validates, and rejects junk.");
