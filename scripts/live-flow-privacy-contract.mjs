import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const { publicLiveLessonSnapshot, studentSafeLiveFlow } = require(
  path.join(root, ".tmp-mastery", "liveFlowPrivacy.js"),
);

const selectedCriterion = "I can explain one ratio.";
const flow = {
  version: 2,
  updatedAt: "2026-07-16T12:00:00.000Z",
  transition: {
    token: "private-transition-token",
    startedAt: "2026-07-16T11:59:59.000Z",
  },
  state: {
    id: "gallery-walk",
    label: "Gallery Walk",
    description: "Study each strategy.",
    color: "#1f6f78",
  },
  phase: null,
  timer: {
    totalSeconds: 180,
    secondsLeft: 120,
    running: true,
    finished: false,
  },
  // A structured-numeric PAIRS poll: the student builds every factor pair of 18
  // from a bank of 1..20. Only the target and bank may cross; the rule spec,
  // which lives in the (stripped) current step's correctAnswer, may not.
  poll: {
    id: "poll-current",
    kind: "structured-numeric",
    question: "Show every factor pair of 18.",
    choices: null,
    stage: "responding",
    pairs: { target: 18, bank: 20 },
  },
  resource: {
    label: "Current public resource",
    url: "/current-public-resource",
  },
  presentation: {
    title: "Gallery Walk",
    body: "Study each strategy.",
    mode: "directions",
    notionStepId: "current-step",
    remoteActions: "private-remote-action",
    routineConfig: {
      kind: "gallery-walk",
      stationCount: 4,
      rotationMinutes: 3,
      movementDirections: "Move clockwise when the timer sounds.",
      observationPrompt: "Notice one strategy and one piece of evidence.",
      recordPrompt: "Record one observation at each station.",
      sharePrompt: "Share one idea your group wants to carry forward.",
      materials: ["private-gallery-material"],
    },
  },
  tool: null,
  lesson: {
    id: "lesson-id",
    code: "M2.T1.L1",
    title: "Ratios",
    learningIntention: "We are learning to reason about ratios.",
    successCriteria: "Legacy option one\nLegacy option two",
    selectedSuccessCriterion: selectedCriterion,
  },
  sequence: {
    currentIndex: 0,
    totalSteps: 2,
    nextLabel: "Future check",
    nextDirections: "future-private-directions",
    advanceMode: "automatic",
    steps: [
      {
        stateId: "gallery-walk",
        label: "Gallery Walk",
        description: "Study each strategy.",
        color: "#1f6f78",
        semantic: "representational",
        durationSeconds: 180,
        question: "Show every factor pair of 18.",
        pollKind: "structured-numeric",
        choices: [],
        // The raw pairs rule spec. It must be stripped with sequence.steps and
        // never reach a student in any form - only the derived poll.pairs does.
        correctAnswer: "pairs(18)\nbank: 20",
        standard: "6.RP.A.1",
        resourceUrl: "",
        paperTask: "",
        notionStepId: "current-step",
        notionLessonId: "lesson-id",
        lessonCode: "M2.T1.L1",
      },
      {
        stateId: "learning-check",
        label: "Future check",
        description: "future-private-directions",
        color: "#79507f",
        semantic: "learning-check",
        durationSeconds: 180,
        question: "future-private-question",
        pollKind: "multiple-choice",
        choices: ["1", "2", "3"],
        correctAnswer: "future-correct-answer",
        standard: "6.RP.A.1",
        resourceUrl: "/future-private-resource",
        paperTask: "future-private-paper-task",
        notionStepId: "future-step",
        notionLessonId: "lesson-id",
        lessonCode: "M2.T1.L1",
        remoteActions: "future-private-remote-action",
      },
    ],
  },
  paper: {
    task: "Current public paper direction",
  },
};

const safeLesson = publicLiveLessonSnapshot(flow.lesson);
assert.equal(safeLesson.successCriteria, selectedCriterion);
assert.equal(safeLesson.selectedSuccessCriterion, selectedCriterion);

const safeFlow = studentSafeLiveFlow(flow);
assert.ok(safeFlow);
// 2026-07-26 student progress strip: the public sequence is EXACTLY this
// minimal projection - position plus the next step's student-facing label
// and directions. deepEqual guarantees no extra key (especially `steps`,
// which carries correct answers and teacher notes) can ever ride along.
assert.deepEqual(
  safeFlow.sequence,
  {
    currentIndex: 0,
    totalSteps: 2,
    nextLabel: "Future check",
    nextDirections: "future-private-directions",
    advanceMode: "automatic",
  },
  "Students receive only the minimal progress projection - never sequence.steps.",
);
assert.equal("transition" in safeFlow, false, "Teacher transition claims must remain private.");
assert.equal(safeFlow.lesson.successCriteria, selectedCriterion);
assert.equal(safeFlow.lesson.selectedSuccessCriterion, selectedCriterion);
assert.equal(safeFlow.presentation.routineConfig.observationPrompt, "Notice one strategy and one piece of evidence.");
assert.equal("materials" in safeFlow.presentation.routineConfig, false, "Gallery Walk materials must remain private.");
assert.equal("remoteActions" in safeFlow.presentation, false, "Remote controls must remain private.");
assert.equal(safeFlow.resource.url, "/current-public-resource", "The current public resource should remain available.");
assert.equal(safeFlow.paper.task, "Current public paper direction", "The current public paper direction should remain available.");

// The next step's description (its student-facing directions) is public by
// design since the progress strip; everything else about future steps stays
// private - especially questions, correct answers, resources, and remote
// actions.
// A structured-numeric pairs poll crosses ONLY the target and the bank. The
// poll object must carry no rule spec, no correct answer, no factor list - the
// student derives the factors themselves, which is the whole task.
assert.deepEqual(
  safeFlow.poll.pairs,
  { target: 18, bank: 20 },
  "The pairs target and bank are the public problem statement.",
);
const allowedPollKeys = ["id", "kind", "question", "choices", "stage", "awaitingTeacherAdvance", "boxes", "pairs"];
for (const key of Object.keys(safeFlow.poll)) {
  assert.ok(
    allowedPollKeys.includes(key),
    `poll.${key} is not an allowed public poll field - the answer spec must never ride on the poll.`,
  );
}

const safeJson = JSON.stringify(safeFlow);
for (const privateValue of [
  "Legacy option one",
  "Legacy option two",
  "private-transition-token",
  "private-gallery-material",
  "private-remote-action",
  "future-private-question",
  "future-correct-answer",
  "/future-private-resource",
  "future-private-paper-task",
  "future-private-remote-action",
  // The raw pairs rule spec, in either authored line form, must never appear -
  // only the derived {target, bank} object may.
  "pairs(18)",
  "bank: 20",
]) {
  assert.equal(safeJson.includes(privateValue), false, `${privateValue} must not enter the student payload.`);
}

console.log("PASS - live student payload excludes future steps, raw criteria, the answer spec, and private routine data.");
