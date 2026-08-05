import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const routines = require(path.join(root, ".tmp-mastery", "lessonRoutineConfig.js"));

const rich = (value) => ({ type: "rich_text", rich_text: [{ plain_text: value }] });
const title = (value) => ({ type: "title", title: [{ plain_text: value }] });
const select = (value) => ({ type: "select", select: { name: value } });
const checkbox = (value) => ({ type: "checkbox", checkbox: value });
const number = (value) => ({ type: "number", number: value });

const privateSmallGroupRoutine = {
  kind: "small-group",
  rotationMinutes: 7,
  publicTask: "Complete the assigned comparison and show your reasoning on paper.",
  teacherPlan: {
    pull: "Pull the teacher-selected group after the opening example.",
    focus: "Connect ratio language to multiplicative comparison.",
    activity: "Build one comparison, then revise a second example.",
    check: "Ask each learner to explain the next move before returning.",
    materials: ["Ratio cards", "Counters"],
  },
};
const rawSmallGroupAiContext = routines.withLessonRoutineConfig(
  "Do not solve it.\n\n[BDM_PUBLIC_SURFACES:linked]",
  privateSmallGroupRoutine,
);

const stepPage = {
  id: "step-1",
  properties: {
    "Step": title("1. Small Group"),
    "Order": number(1),
    "Start Minute": number(0),
    "Duration": number(4),
    "State ID": rich("small-group"),
    "Student Directions": rich("Legacy student direction"),
    "Teacher Notes": rich("Teacher note"),
    "Paper Task": rich(""),
    "Tool": rich(""),
    "Question": rich("What do you notice?"),
    "Poll Kind": select("short-answer"),
    "Choices": rich("2,000\r\n200\r\n  \nEach batch uses less than a cup, so more than 6 fit\nFlat, closed, seated, ready"),
    "Correct Answer": rich("2,000"),
    "Standard": rich("6.NS.4"),
    "AI Context": rich(rawSmallGroupAiContext),
    "Advance": select("Automatic"),
    "Required": checkbox(true),
    "Main Display": rich("The score is 24 to 36."),
    "Pace Directions": rich("Notice the number structure."),
    "Student Action": rich("Write one observation."),
    "Remote Actions": rich("Watch private responses."),
    "Discussion Stems": rich("I noticed..."),
    "Vocabulary": rich("factor\nmultiple"),
    "Response Mode": select("Short Answer"),
    "Work Space Available": checkbox(true),
  },
};

const lessonPage = {
  id: "lesson-1",
  properties: {
    "Lesson": title("Contract Pilot"),
    "Lesson Code": rich("TEST.CONTRACT"),
    "Publish Workflow": select("Published"),
    "Lesson Steps": { type: "relation", relation: [{ id: stepPage.id }] },
    "Learning Intention": rich("We are learning to reason with factors."),
    "Success Criteria": rich("Legacy criterion"),
    "Selected Success Criterion": rich("I can explain a shared factor."),
    "Classroom Mode": select("Academic lesson"),
    "Discussion Stems": rich("I noticed...\nMy evidence is..."),
    "Discussion Vocabulary": rich("factor\nmultiple"),
    "Required Paper Work": rich("Complete the full paper set."),
    "Required Digital Work": rich("Submit the exit response."),
    "Optional Support": rich("Use the assigned factor cards."),
    "Big Dog Challenge": rich("Prove the result another way."),
    "Due and Turn In": rich("Turn in the paper before class ends."),
    "Help Path": rich("Factor, mark shared structure, then verify."),
    "Supplies": rich("Pencil, Notebook, Ruler"),
  },
};

global.fetch = async (input) => {
  const url = String(input);
  if (url.includes(`/pages/${stepPage.id}`)) {
    return new Response(JSON.stringify(stepPage), { status: 200 });
  }
  if (url.includes("/data_sources/e367e541-c0c7-4613-8066-d2e61b6fee64/query")) {
    return new Response(JSON.stringify({ results: [lessonPage] }), { status: 200 });
  }
  if (url.includes("/data_sources/")) {
    return new Response(JSON.stringify({ results: [] }), { status: 200 });
  }
  return new Response(JSON.stringify({ error: "Unexpected test URL" }), { status: 404 });
};

process.env.NOTION_TOKEN = "test-token";
const notion = require(path.join(root, ".tmp-mastery", "notionLessons.js"));
assert.equal(notion.isExplicitlySkippedLesson("Yes"), true, "Skip=Yes must remove a lesson from app scheduling.");
assert.equal(notion.isExplicitlySkippedLesson("No"), false, "Skip=No must keep a lesson available.");
assert.equal(notion.isExplicitlySkippedLesson(""), false, "A blank legacy Skip value must remain available.");
const lesson = await notion.getLessonByCode("TEST.CONTRACT");

if (!lesson) throw new Error("The test lesson did not map.");
if (lesson.selectedSuccessCriterion !== "I can explain a shared factor.") throw new Error("Selected success criterion did not map.");
if (lesson.classroomMode !== "Academic lesson") throw new Error("Classroom mode did not map.");

for (const field of [
  "discussionStems",
  "discussionVocabulary",
  "requiredPaperWork",
  "requiredDigitalWork",
  "optionalSupport",
  "bigDogChallenge",
  "dueAndTurnIn",
  "helpPath",
]) {
  if (!lesson[field]) throw new Error(`Lesson field ${field} did not map.`);
}

const step = lesson.steps[0];
if (!step) throw new Error("The related lesson step did not map.");
for (const field of ["mainDisplay", "paceDirections", "studentAction", "remoteActions", "discussionStems", "vocabulary", "responseMode"]) {
  if (!step[field]) throw new Error(`Step field ${field} did not map.`);
}
if (!step.workSpaceAvailable) throw new Error("Work Space Available did not map.");

// ANSWER CHOICES SPLIT ON NEWLINES ONLY. NEVER ON COMMAS.
//
// This fixture had `Choices: rich("")` for as long as the property existed, so
// nothing here ever exercised the splitter and the bug below shipped unseen.
// Measured on the live Lesson Steps data source 2026-08-04: 14 of the 121 steps
// with authored choices carry a comma INSIDE a choice, and ZERO author their
// choices comma-separated on one line - so comma splitting never once did
// anything useful on this property.
//
// The cases below are the two real shapes it broke. "2,000" is a thousands
// separator, which made a fifth choice out of "2" and "000" and put a duplicate
// "2" in the list (two identical entries also collide as a React key on
// /lesson). The sentences are the shape the audit found first. The blank line
// is here because a teacher's trailing newline must not become an empty choice.
// The CRLF is defensive, not observed - none of the 121 live steps carries one,
// and note the per-line trim would absorb a stray \r even without the \r? in
// the pattern, so this fixture cannot pin that half on its own.
//
// The two assertions after the deepEqual are DOCUMENTATION, not extra coverage:
// both are implied by it and cannot fail independently. They are here to name
// the two product invariants a future reader would otherwise have to infer.
assert.deepEqual(
  step.choices,
  ["2,000", "200", "Each batch uses less than a cup, so more than 6 fit", "Flat, closed, seated, ready"],
  "A comma inside a choice must not shatter it, and a blank line must not become a choice.",
);
assert.equal(
  step.choices.includes(step.correctAnswer),
  true,
  "The authored answer key must be one of the choices - if it is not, no student can submit it and bare equality marks the whole class wrong.",
);
assert.equal(
  new Set(step.choices).size,
  step.choices.length,
  "Splitting must not manufacture duplicate choices.",
);

// THE OTHER HALF: `splitList` must KEEP splitting on commas.
//
// Supplies and Tools are lesson-level and genuinely are authored inline, so the
// tempting simplification - make splitList newline-only and delete splitChoices
// - would quietly turn a supply list into one run-on line on every lesson page.
assert.equal(
  lesson.supplies,
  "Pencil\nNotebook\nRuler",
  "Supplies is authored inline and must still split on commas.",
);

assert.equal(step.aiContext, "Do not solve it.", "Internal routine metadata must not enter public AI Context.");
assert.equal(step.publicSurfaceMode, "linked");
assert.deepEqual(step.routineConfig, {
  kind: "small-group",
  rotationMinutes: 7,
  publicTask: "Complete the assigned comparison and show your reasoning on paper.",
});
assert.equal(
  Object.hasOwn(step.routineConfig, "teacherPlan"),
  false,
  "Public LessonStepData must never expose the private Small Group teacher plan.",
);

const publicStepJson = JSON.stringify(step);
assert.equal(publicStepJson.includes("BDM_ROUTINE_CONFIG"), false, "Encoded internal metadata must not reach public fixtures.");
for (const privateValue of Object.values(privateSmallGroupRoutine.teacherPlan).flat()) {
  assert.equal(
    publicStepJson.includes(String(privateValue)),
    false,
    "Private pull, focus, activity, check, and materials must not leak into public LessonStepData.",
  );
}

// A FILE property must resolve to a link.
//
// `Assignment Link`, `Assignments` and `Explainer Videos` are all `files` in the
// lessons database - despite `Assignment Link`'s name and its own description
// ("Link to the assignment when no file is embedded"). extractUrl handled url,
// title, rich_text, formula and rollup but NOT files, so attaching the
// assignment resolved to "" and the student lesson page rendered "Assignment
// link coming soon" while Notion plainly showed the file. Nothing errored, which
// is why it read as an authoring mistake for as long as it did.
const lessons = require(path.join(root, ".tmp-mastery", "notionLessons.js"));

assert.equal(
  lessons.extractUrl({ type: "files", files: [{ name: "hw.pdf", file: { url: "https://notion-signed.example/hw.pdf?X-Amz=1" } }] }),
  "https://notion-signed.example/hw.pdf?X-Amz=1",
  "An uploaded file must resolve to its url, or attaching the assignment does nothing.",
);
assert.equal(
  lessons.extractUrl({ type: "files", files: [{ name: "hw", external: { url: "https://classroom.example/hw" } }] }),
  "https://classroom.example/hw",
  "A pasted external link in a files property must resolve.",
);
assert.equal(
  lessons.extractUrl({
    type: "files",
    files: [{ name: "hw", external: { url: "https://permanent.example/hw" }, file: { url: "https://signed.example/hw" } }],
  }),
  "https://permanent.example/hw",
  "External wins over a Notion upload: the signed url expires in about an hour.",
);
assert.equal(lessons.extractUrl({ type: "files", files: [] }), "", "No attachment stays empty rather than guessing.");
assert.equal(lessons.extractUrl({ type: "files" }), "", "A files property with no array must not throw.");
// The types that already worked must keep working.
assert.equal(lessons.extractUrl({ type: "url", url: "https://a.example" }), "https://a.example");
assert.equal(lessons.extractUrl(undefined), "");
console.log("  ok  a files property resolves to a link, external before signed upload");

// The slide frame's layout overrides. This exists because the mirror flag failed SILENTLY once: an
// earlier version returned as soon as it found a slide block carrying a url, so a teacher who left
// the studio's url field blank - letting the Notion `Slide Url` property supply it, which is the
// documented readable-copy path - and flipped the mirror toggle got a toggle that saved correctly
// and never reached a projector.
const layouts = require(path.join(root, ".tmp-mastery", "lessonScreenLayout.js"));
const encodeMain = (blocks) =>
  layouts.encodeScreenLayout({ main: [blocks.map((b, i) => ({ id: `b${i}`, ov: {}, ...b })), []] });

assert.deepEqual(
  lessons.slideFrameFromLayout(""),
  { url: "", mirror: false, fit: "contain" },
  "No layout falls through to the Notion property with the safe defaults.",
);
assert.deepEqual(
  lessons.slideFrameFromLayout(encodeMain([{ type: "text", ov: { text: "hi" } }])),
  { url: "", mirror: false, fit: "contain" },
  "A layout with no slide block claims nothing.",
);
assert.deepEqual(
  lessons.slideFrameFromLayout(
    encodeMain([{ type: "slide", ov: { slideUrl: "/slides/a.webp", slideMirror: "1", slideFit: "cover" } }]),
  ),
  { url: "/slides/a.webp", mirror: true, fit: "cover" },
  "A slide block carrying a url supplies all three settings.",
);
assert.deepEqual(
  lessons.slideFrameFromLayout(encodeMain([{ type: "slide", ov: { slideMirror: "1" } }])),
  { url: "", mirror: true, fit: "contain" },
  "THE FIX: a block with no url still carries the teacher's mirror decision for the url the Notion property will supply.",
);
assert.deepEqual(
  lessons.slideFrameFromLayout(
    encodeMain([
      { type: "slide", ov: { slideMirror: "1" } },
      { type: "slide", ov: { slideUrl: "/slides/b.webp" } },
    ]),
  ),
  { url: "/slides/b.webp", mirror: false, fit: "contain" },
  "A block naming its own url is the slide, and its settings go with it - the bare block does not lend it a mirror.",
);
assert.deepEqual(
  lessons.slideFrameFromLayout("not-base64-at-all!!"),
  { url: "", mirror: false, fit: "contain" },
  "A corrupt blob must never take the lesson down.",
);
assert.equal(
  lessons.slideFrameFromLayout(encodeMain([{ type: "slide", ov: { slideUrl: "/a.webp", slideFit: " Cover " } }])).fit,
  "cover",
  "Fit is a free-text field, so it is trimmed and lowercased before it decides anything.",
);
console.log("  ok  slide frame overrides survive the layout blob, mirror independent of url");

console.log("PASS - Notion lesson and step fields map into the four-surface contract.");
