"use client";

// The /demo mock period. One scripted GCF lesson, entirely fictional class,
// that the demo page walks through by posting these snapshots to the REAL
// surfaces (Main projector, Support projector, student page, weekly boards)
// embedded in iframes. Nothing here touches a database; the student iframe
// runs every posted snapshot through studentSafeLiveFlow itself, so even the
// demo honors the production privacy boundary.

import type { LiveClassFlowSnapshot } from "@/lib/liveClassFlow";
import type { ClassroomStateStrip } from "@/lib/classroomStateStrip";

export interface DemoPollAnswer {
  id: string;
  answer: string;
}

export interface DemoScene {
  id: string;
  title: string;
  caption: string;
  durationMs: number;
  snapshot: LiveClassFlowSnapshot;
  // Mock answers that trickle onto the teacher surfaces while the scene
  // plays, as if a fictional class were responding.
  answerScript?: { atMs: number; answer: string }[];
}

const LESSON = {
  id: null,
  code: "M1.T1.L2-D1",
  title: "Searching for Common Ground",
  learningIntention: "I can find the greatest common factor of two numbers and explain what it means.",
  successCriteria: "I can list every factor pair of a number and spot the greatest factor two numbers share.",
  selectedSuccessCriterion: "I can list every factor pair of a number and spot the greatest factor two numbers share.",
  discussionStems: ["I noticed...", "I agree with ___ because...", "A factor pair I found is..."],
  discussionVocabulary: ["factor", "factor pair", "multiple", "greatest common factor"],
};

interface SceneInput {
  stateId: string;
  label: string;
  semantic: string;
  color: string;
  seconds: number;
  mainDisplay: string;
  paceDirections: string;
  studentAction: string;
  index: number;
  // The classroom state strip for this scene, all four or nothing.
  strip?: ClassroomStateStrip;
  mode?: "board" | "directions" | "poll" | "tool";
  poll?: LiveClassFlowSnapshot["poll"];
  tool?: LiveClassFlowSnapshot["tool"];
}

const TOTAL_STEPS = 7;

function makeSnapshot(input: SceneInput): LiveClassFlowSnapshot {
  const step = {
    stateId: input.stateId,
    label: input.label,
    description: input.paceDirections,
    color: input.color,
    semantic: input.semantic as never,
    durationSeconds: input.seconds,
    question: input.poll?.question ?? "",
    pollKind: input.poll?.kind ?? null,
    choices: input.poll?.choices ?? [],
    correctAnswer: "",
    standard: "6.NS.4",
    resourceUrl: "",
    paperTask: "",
    notionStepId: null,
    notionLessonId: null,
    lessonCode: LESSON.code,
    mainDisplay: input.mainDisplay,
    paceDirections: input.paceDirections,
    studentAction: input.studentAction,
    responseMode: input.poll ? (input.poll.kind === "fist-to-five" ? "Fist to Five" : "Multiple Choice") : "None",
    discussionStems: LESSON.discussionStems,
    vocabulary: LESSON.discussionVocabulary,
  };
  return {
    version: 2,
    updatedAt: new Date().toISOString(),
    state: {
      id: input.stateId,
      label: input.label,
      description: input.paceDirections,
      color: input.color,
      semantic: input.semantic as never,
    },
    phase: null,
    timer: { totalSeconds: input.seconds, secondsLeft: input.seconds, running: false, finished: false, endsAt: null },
    poll: input.poll ?? null,
    resource: null,
    presentation: {
      title: input.label,
      body: input.mainDisplay,
      mainDisplay: input.mainDisplay,
      mode: input.mode ?? "directions",
      notionStepId: null,
      boardOpen: false,
      paceDirections: input.paceDirections,
      studentAction: input.studentAction,
      responseMode: step.responseMode,
      discussionStems: LESSON.discussionStems,
      vocabulary: LESSON.discussionVocabulary,
      behaviorStrip: input.strip ?? null,
    },
    tool: input.tool ?? null,
    lesson: LESSON,
    sequence: {
      currentIndex: input.index,
      totalSteps: TOTAL_STEPS,
      nextLabel: null,
      nextDirections: null,
      advanceMode: "manual",
      steps: Array.from({ length: TOTAL_STEPS }, (_, i) => (i === input.index ? step : {
        ...step,
        stateId: `placeholder-${i}`,
        question: "",
        pollKind: null,
        choices: [],
      })),
    },
    paper: null,
  };
}

const FACTOR_POLL: LiveClassFlowSnapshot["poll"] = {
  id: "demo-poll-factors",
  kind: "multiple-choice",
  question: "Which list shows ALL the factor pairs of 24?",
  choices: [
    "1x24, 2x12, 3x8, 4x6",
    "2x12, 3x8, 4x6",
    "1x24, 2x12, 3x8, 4x6, 5x5",
    "24x1 only",
  ],
  stage: "responding",
};

const FIST_POLL: LiveClassFlowSnapshot["poll"] = {
  id: "demo-poll-fist",
  kind: "fist-to-five",
  question: "How ready do you feel to find a GCF on your own?",
  choices: null,
  stage: "responding",
};

export const DEMO_SCENES: DemoScene[] = [
  {
    id: "warmup",
    title: "Warm-up",
    caption: "Class opens itself. The Main projector runs the steps of learning while the warm-up collects evidence - every answer already flowing toward the mastery engine.",
    durationMs: 12_000,
    snapshot: makeSnapshot({
      stateId: "warmup", label: "Warm-Up", semantic: "evergreen", color: "#fcaf38", seconds: 300,
      mainDisplay: "", paceDirections: "Sit, log in, start the warm-up. Six questions.",
      studentAction: "Finish the warm-up form.", index: 0,
      strip: { eyes: "Own paper", voice: "0 silent", supplies: "In your hands", body: "Seated" },
    }),
  },
  {
    id: "hook",
    title: "The hook",
    caption: "The teacher taps Next once - and the wall, the pace board, and every student screen move together.",
    durationMs: 14_000,
    snapshot: makeSnapshot({
      stateId: "hook", label: "The Hook", semantic: "scenario", color: "#f95335", seconds: 90,
      mainDisplay: "24 hot dogs. 36 buns. What is the LARGEST number of identical picnic tables you can set with nothing left over?",
      paceDirections: "Think alone. No pencils yet - just your brain.",
      studentAction: "Eyes up front. Be ready to share one idea.", index: 1,
      strip: { eyes: "Teacher", voice: "0 silent", supplies: "In the tray", body: "Seated" },
    }),
  },
  {
    id: "we-do",
    title: "We do",
    caption: "Working the problem together. In the real room the teacher writes on an iPad and the ink lands on this wall live.",
    durationMs: 14_000,
    snapshot: makeSnapshot({
      stateId: "we-do", label: "We Do", semantic: "representational", color: "#50a3a4", seconds: 420, mode: "board",
      mainDisplay: "Factor pairs of 24: 1x24, 2x12, 3x8, 4x6. Factor pairs of 36: 1x36, 2x18, 3x12, 4x9, 6x6. What is the greatest number on BOTH lists?",
      paceDirections: "Copy the two factor lists into your notes as we build them.",
      studentAction: "Notes out. Track the factor pairs.", index: 2,
      strip: { eyes: "The screen", voice: "1 partner", supplies: "In your hands", body: "Seated" },
    }),
  },
  {
    id: "poll",
    title: "Quick check",
    caption: "A readiness check goes out. Answer it yourself on the student screen - and watch the class's answers land on the wall.",
    durationMs: 18_000,
    snapshot: makeSnapshot({
      stateId: "question", label: "Quick Check", semantic: "learning-check", color: "#674a40", seconds: 120, mode: "poll",
      mainDisplay: "Which list shows ALL the factor pairs of 24?",
      paceDirections: "Answer on your own screen. One submission each.",
      studentAction: "Answer the quick check on your device.", index: 3,
      strip: { eyes: "Own paper", voice: "0 silent", supplies: "In your hands", body: "Seated" },
      poll: FACTOR_POLL,
    }),
    answerScript: [
      { atMs: 1500, answer: "1x24, 2x12, 3x8, 4x6" },
      { atMs: 3200, answer: "2x12, 3x8, 4x6" },
      { atMs: 4600, answer: "1x24, 2x12, 3x8, 4x6" },
      { atMs: 6100, answer: "1x24, 2x12, 3x8, 4x6" },
      { atMs: 7900, answer: "1x24, 2x12, 3x8, 4x6, 5x5" },
      { atMs: 9600, answer: "1x24, 2x12, 3x8, 4x6" },
      { atMs: 11400, answer: "1x24, 2x12, 3x8, 4x6" },
      { atMs: 13000, answer: "2x12, 3x8, 4x6" },
      { atMs: 14800, answer: "1x24, 2x12, 3x8, 4x6" },
    ],
  },
  {
    id: "results",
    title: "Results",
    caption: "The teacher flips to results. Tallies land on the wall - and notice what does NOT: student screens never receive names, answers, or the correct choice. That redaction is a tested module, not a habit.",
    durationMs: 14_000,
    snapshot: makeSnapshot({
      stateId: "question", label: "Quick Check", semantic: "learning-check", color: "#674a40", seconds: 120, mode: "poll",
      mainDisplay: "Which list shows ALL the factor pairs of 24?",
      paceDirections: "Look at the spread. Where did 5x5 come from? Talk to your partner for 30 seconds.",
      studentAction: "Discuss: why is 5x5 not a factor pair of 24?", index: 3,
      strip: { eyes: "The speaker", voice: "2 table", supplies: "Parked flat", body: "Seated" },
      poll: { ...FACTOR_POLL, stage: "results" },
    }),
  },
  {
    id: "tool",
    title: "Tool time",
    caption: "Every Chromebook is sent to the right manipulative with the task attached. The tools are public - you tried one on the way in.",
    durationMs: 14_000,
    snapshot: makeSnapshot({
      stateId: "manip", label: "Tool Time", semantic: "concrete", color: "#2f9e6f", seconds: 480, mode: "tool",
      mainDisplay: "Divisibility Rules: cross off every rule that works for 36, then build its factor family.",
      paceDirections: "Headphones optional. Work the tool - your work feeds your mastery bar.",
      studentAction: "Open Divisibility Rules and work the 36 family.", index: 4,
      strip: { eyes: "Your build", voice: "1 partner", supplies: "In your hands", body: "Seated" },
      tool: { id: "demo-tool-divisibility", route: "/divisibility", label: "Divisibility Rules", prompt: "Cross off every rule that works for 36, then build the factor family.", config: {} },
    }),
  },
  {
    id: "learning-check",
    title: "Learning check",
    caption: "Fist to five: every student rates their own readiness. The spread tells the teacher who to sit with next - this feeds the live grouping engine in the real room.",
    durationMs: 16_000,
    snapshot: makeSnapshot({
      stateId: "learning-check", label: "Learning Check", semantic: "learning-check", color: "#79507f", seconds: 90, mode: "poll",
      mainDisplay: "How ready do you feel to find a GCF on your own?",
      paceDirections: "Honest answers help me help you. Zero brave, five confident.",
      studentAction: "Rate yourself: fist to five.", index: 5,
      strip: { eyes: "Own paper", voice: "0 silent", supplies: "Parked flat", body: "Seated" },
      poll: FIST_POLL,
    }),
    answerScript: [
      { atMs: 1200, answer: "4" },
      { atMs: 2600, answer: "5" },
      { atMs: 3900, answer: "3" },
      { atMs: 5300, answer: "4" },
      { atMs: 6800, answer: "2" },
      { atMs: 8100, answer: "5" },
      { atMs: 9500, answer: "4" },
      { atMs: 11000, answer: "3" },
      { atMs: 12600, answer: "4" },
    ],
  },
  {
    id: "closeout",
    title: "Closeout",
    caption: "Exit ticket, and the period closes the way it opened: calmly, with every response already stored as evidence. That is one class period on Big Dog Math.",
    durationMs: 14_000,
    snapshot: makeSnapshot({
      stateId: "closeout", label: "Closeout", semantic: "closeout", color: "#201e1a", seconds: 180,
      mainDisplay: "Exit ticket: find the GCF of 18 and 30. Explain how you know it is the greatest.",
      paceDirections: "Pack up when your exit ticket is submitted. Push in your chair.",
      studentAction: "Submit your exit ticket, then pack up.", index: 6,
      strip: { eyes: "Own paper", voice: "0 silent", supplies: "In your hands", body: "Seated" },
    }),
  },
];

// The all-day boards (two TVs in the back of the room) - a mock week in the
// same shape /api/weekly-display serves.
//
// The vocabulary carries "Term - definition" lines, plus a figure line on two
// days, because that is what /weekly-display's key-term reveal reads. A day
// authored as a bare term list still renders - the board just holds the
// learning intention instead of resolving it into the term.
export const DEMO_WEEK = {
  today: "2026-08-18",
  timeZone: "America/Los_Angeles",
  weekStart: "2026-08-17",
  weekEnd: "2026-08-21",
  days: [
    { weekday: "Monday", date: "2026-08-17", lessons: [demoDay("M1.T1.L1", "Taking Apart Numbers and Shapes", "6.EE.3", "I can write equivalent expressions using the distributive property.", "I can show the same area two ways.\nI can match every part of the box to a part of the expression.\nI can check that both ways give the same total.", "distributive property - Multiplying a sum is the same as multiplying each part and then adding.\nrate: 5 x 9 -> 5 x (4 + 5) -> 20 + 25\nequivalent; area model")] },
    { weekday: "Tuesday", date: "2026-08-18", lessons: [demoDay("M1.T1.L2-D1", "Searching for Common Ground", "6.NS.4", LESSON.learningIntention, LESSON.successCriteria, "greatest common factor - The largest factor that two numbers share. List every factor of each number, then take the biggest one in both lists.\ntable: 18 = 1, 2, 3, *6, 9, 18 | 30 = 1, 2, 3, 5, *6, 10, 15, 30\nfactor; factor pair; multiple")] },
    { weekday: "Wednesday", date: "2026-08-19", lessons: [demoDay("M1.T1.L2-D2", "Common Ground: GCF and LCM", "6.NS.4", "I can use GCF and LCM to solve problems.", "I can decide whether a problem is asking for a GCF or an LCM.\nI can defend the choice I made with the numbers in front of me.", "least common multiple - The smallest multiple that two numbers share. Count by each number until the same one shows up in both lists.\ntable: 4 = 4, 8, *12, 16 | 6 = 6, *12, 18, 24\ngreatest common factor")] },
    { weekday: "Thursday", date: "2026-08-20", lessons: [demoDay("M1.T1.L3", "Composing and Decomposing Numbers", "6.NS.4", "I can break numbers into prime factors.", "I can build a factor tree that ends in primes.\nI can read the prime factorization off the tree.\nI can check it by multiplying back.", "prime factorization - A number written as a product of primes only. Split it into any factor pair, then keep splitting until every branch is prime.\nsteps: Split into a factor pair | Keep splitting composites | Stop at primes\nprime; composite")] },
    { weekday: "Friday", date: "2026-08-21", lessons: [demoDay("M1.T1.L4", "Did You Get the Part?", "5.NF.4", "I can multiply fractions using an area model.", "I can shade an area model to show a fraction of a fraction.", "area model - A rectangle split both ways so each piece shows one part of the product.\nrate: 1/2 of 3/4 -> 3/8\nnumerator; denominator")] },
  ],
};

function demoDay(lessonCode: string, title: string, standard: string, learningIntention: string, successCriteria: string, vocab: string) {
  return {
    id: lessonCode,
    lessonCode,
    title,
    standard,
    learningIntention,
    successCriteria,
    discussionVocabulary: vocab,
    topic: "Factors and Multiples",
    moduleTopic: "Module 1 - Topic 1",
    classroomMode: "Core",
  };
}
