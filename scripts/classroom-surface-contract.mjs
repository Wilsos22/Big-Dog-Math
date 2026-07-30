import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const present = read("src/app/teacher/present/page.tsx");
const pace = read("src/app/teacher/pace/page.tsx");
const student = read("src/app/live-flow/page.tsx");
const remote = read("src/app/teacher/remote/page.tsx");
const session = read("src/app/session/page.tsx");
const teacher = read("src/app/teacher/page.tsx");
const control = read("src/app/control/page.tsx");
const inkBoard = read("src/components/InkBoard.tsx");
const inkSync = read("src/lib/inkSync.ts");
const timers = read("src/lib/liveClassFlow.ts");
const remoteLayout = read("src/app/teacher/remote/layout.tsx");
const remoteManifest = read("public/teacher-remote.webmanifest");

// Anchors re-based 2026-07-27 to the Warm Notebook canonical surfaces
// (the 2026-07-20 Turn 12 standardization) - same intents, current landmarks.
// FALSE PASS FOUND 2026-07-29: the 'src="/big-dog-mark.png"' anchor was dropped
// from this list because it had not been testing the projector frame since
// 2026-07-20. The Warm Notebook redesign (3d6eb9a) set `.stage-mark {
// display:none }` and stopped rendering the img in the topbar, so the ONLY
// remaining big-dog-mark img on Main was the one inside the Abbie broadcast
// bubble - itself hidden until Abbie spoke. The anchor passed on an element the
// room never saw. Do not re-add a logo to Main to satisfy a contract; the
// approved Turn 12a frame is content-only and putting the mark back is Steele's
// call.
for (const required of [
  "grid-template-rows:66px minmax(0,1fr)",
  'className="stage-dot"',
  "className={`stage-timer",
  'className="stage-main-prompt"',
  // Replaced the "session?.abbie?.text" anchor 2026-07-29: the Abbie broadcast
  // bubble came off the projector with the rest of the Abbie AI feature
  // (Steele: "it doesnt contribute to the learning"), and the classroom state
  // group is the approved element that now owns the top right of the stage.
  "<ClassroomStateStrip",
]) {
  if (!present.includes(required)) {
    throw new Error(`Main projector is missing the approved fixed-frame element: ${required}`);
  }
}
// The Abbie AI feature is deliberately unmounted, not deleted. Re-mounting it
// anywhere is Steele's call, so the surfaces assert the absence rather than
// letting a component quietly reappear on a classroom screen or a student page.
// Matches a JSX mount or the deck export, never prose - the files carry comments
// explaining where the feature used to be, and those must stay readable.
for (const [surface, source] of [["Main projector", present], ["iPad Remote", remote], ["Control", control]]) {
  if (/<Abbie[A-Za-z]*|ABBIE_REMOTE_BUTTONS|className="stage-abbie/.test(source)) {
    throw new Error(`${surface} has re-mounted the Abbie AI feature, which Steele took off the site on 2026-07-29.`);
  }
}
if (!present.includes('resource.url.startsWith("/")')
  || !present.includes('["discussion", "independent", "closeout"].includes(theme.id)')) {
  throw new Error("A linked resource must not replace the Main instructional layout during discussion, independent work, or closeout.");
}

for (const required of [
  'className="pw-left"',
  'className="pw-center"',
  'className="pw-right"',
  'className="pw-pace"',
  'className="pw-pace-copy"',
]) {
  if (!pace.includes(required)) {
    throw new Error(`Pace + Support is missing the approved projector frame: ${required}`);
  }
}

for (const required of [
  'className="lf-mark"',
  'className="lf-phase-dot"',
  'className="lf-sync"',
  'className="lf-who"',
  'className="lf-body"',
  "var(--bdb-",
]) {
  if (!student.includes(required)) {
    throw new Error(`Chromebook is missing the approved warm-cream frame: ${required}`);
  }
}

for (const required of [
  "Lesson Remote",
  "Public screen mirrors",
  "grid-template-columns:314px minmax(0,1fr)",
  "grid-template-columns:repeat(3,minmax(0,1fr))",
  "Open work space",
  "Speaker notes",
  "overflow-y:auto",
  "safe-area-inset-bottom",
]) {
  if (!remote.includes(required)) {
    throw new Error(`iPad Remote is missing the approved private layout or recovered control: ${required}`);
  }
}
if (remote.includes('<h1 className="remote-title">Classroom Remote</h1>')) {
  throw new Error("The iPad header must use the approved compact Lesson Remote title.");
}
if (!remoteLayout.includes('manifest: "/teacher-remote.webmanifest"')
  || !remoteLayout.includes("appleWebApp")
  || !remoteManifest.includes('"display": "standalone"')) {
  throw new Error("The Lesson Remote must remain installable as an iPad Home Screen app.");
}

for (const route of ["/teacher/present?session=", "/teacher/pace?session=", "/teacher/remote?session="]) {
  if (!session.includes(route)) throw new Error(`Session setup is missing the exact-session launcher: ${route}`);
}
if (!teacher.includes("Set up screens") || !control.includes("Set up screens")) {
  throw new Error("Teacher Home and dark Control must both expose the screen setup hub.");
}

if (!control.includes("MAX_STATE_SECONDS") || !timers.includes("MAX_LIVE_STATE_SECONDS")) {
  throw new Error("Both Control and synchronized surfaces must clamp corrupt timer values.");
}
if (!inkBoard.includes("requestAnimationFrame")
  || !inkBoard.includes("onConnectionChange")
  || !inkSync.includes('"connecting" | "connected" | "disconnected"')) {
  throw new Error("The iPad writing surface must batch Pencil traffic and report its projector connection state.");
}

console.log("PASS - four classroom surfaces retain the approved roles, frames, launchers, timer guard, and live writing status.");
