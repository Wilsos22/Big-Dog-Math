// Big Dog Math — canonical class-state catalog.
// Single source of truth for the control panel AND the standalone Sequence
// Builder, so labels/colors/default minutes never drift between the two.

export interface ClassState {
  id: string;
  label: string;
  minutes: number;
  color: string;
  desc: string;
  paceAction?: string;
  studentAction?: string;
  remoteAction?: string;
  scheduleHint?: "Monday";
}

export const CLOSEOUT_DIRECTIONS = "Put away your supplies, clean your area, and reset the room.";

// The UNIVERSAL state words for the projector state marker - identical lesson
// to lesson so students learn the phases, per Steele's universal-headers
// decision (7/22, reaffirmed 7/26 when custom step titles leaked into the
// marker). The CRA trio carries the gradual-release words: concrete is the
// teacher build (I Do), representational the shared build (We Do), abstract
// and independent the student's own work (You Do).
export const UNIVERSAL_STATE_TITLES: Record<string, string> = {
  "i-do": "I Do",
  "we-do": "We Do",
  "you-do": "You Do",
  concrete: "I Do",
  representational: "We Do",
  abstract: "You Do",
  independent: "You Do",
  launch: "Launch",
  review: "Review",
  warmup: "Warm-Up",
  question: "Question",
  poll: "Question",
  "learning-check": "Learning Check",
  "learning-target-readers": "Learning Targets",
  discussion: "Discussion",
  partner: "Partner Work",
  "small-group": "Small Groups",
  "gallery-walk": "Gallery Walk",
  exit: "Exit Ticket",
  closeout: "Closeout",
};

/**
 * The state marker text for projector surfaces. Never the lesson-specific
 * step title: unmapped states fall back to the state bank's GENERIC label
 * (stable lesson to lesson), and only then to the given label.
 */
export function universalStateTitle(stateId?: string | null, fallbackLabel?: string | null): string {
  const id = (stateId || "").trim();
  const mapped = UNIVERSAL_STATE_TITLES[id];
  if (mapped) return mapped;
  const bank = DEFAULT_STATES.find((state) => state.id === id)?.label;
  return bank || (fallbackLabel || "").trim();
}

export const DEFAULT_STATES: ClassState[] = [
  { id: "warmup", label: "Warm-Up", minutes: 5, color: "#35785a", desc: "Open the assigned warm-up. Complete all five questions on your own.", paceAction: "Start today's warm-up.", studentAction: "Open the warm-up and begin." },
  { id: "review", label: "Review", minutes: 4, color: "#35785a", desc: "Review the answers and the problems the class missed most often.", paceAction: "Let's check the answers together.", studentAction: "Look up and check your thinking." },
  { id: "learning-target-readers", label: "Learning Intention + Success Criterion", minutes: 1, color: "#d2a74f", desc: "Meet today's readers, then listen for the learning intention and success criterion.", paceAction: "Meet today's readers.", studentAction: "Look up and listen to today's readers.", remoteAction: "Use the main panel to spin or re-spin the two readers." },
  { id: "ipad-kid", label: "iPad Kid Spinner", minutes: 1, color: "#6fbd91", desc: "Spin to choose this week's iPad Kid.", paceAction: "Let's choose this week's iPad Kid.", studentAction: "Look up for this week's class role.", remoteAction: "Use the main panel to spin or re-spin the iPad Kid.", scheduleHint: "Monday" },
  { id: "launch", label: "Lesson Launch", minutes: 4, color: "#a86735", desc: "Make sense of the scenario, quantities, and question.", paceAction: "Study the problem. What do you notice?", studentAction: "Write one thing you notice." },
  { id: "concrete", label: "Concrete", minutes: 5, color: "#3f7d50", desc: "Build the relationship with the assigned concrete model.", paceAction: "Build the relationship with your materials.", studentAction: "Build the model with your materials." },
  { id: "representational", label: "Representational", minutes: 5, color: "#357f7d", desc: "Connect the concrete model to a diagram or representation.", paceAction: "Show the same idea with a model.", studentAction: "Build or draw the same relationship." },
  { id: "abstract", label: "Abstract", minutes: 5, color: "#4f5da8", desc: "Connect the representation to notation and reasoning.", paceAction: "Write the relationship with math.", studentAction: "Write the relationship with math." },
  { id: "learning-check", label: "Learning Check", minutes: 3, color: "#6f3f78", desc: "Revisit the goal and show your understanding from 0 to 5.", paceAction: "Show where you are right now.", studentAction: "Choose your honest 0 to 5." },
  { id: "discussion", label: "Discussion", minutes: 6, color: "#9d4c2f", desc: "Think, write, discuss, revise, then share.", paceAction: "Follow the current discussion phase.", studentAction: "Think first. Write something. Then discuss and revise.", remoteAction: "Run Think, Write, Discuss, Revise, and Share. Use the spinner for Share." },
  { id: "gallery-walk", label: "Gallery Walk", minutes: 12, color: "#9d4c2f", desc: "Study each station, record one useful observation, and move when the timer sounds.", paceAction: "Observe, record, then rotate.", studentAction: "Record one observation at each station.", remoteAction: "Run the rotations, monitor movement, and choose the final share-out." },
  { id: "small-group", label: "Small Group Rotations", minutes: 16, color: "#357f7d", desc: "Complete the assigned group task while the teacher meets with a focused group.", paceAction: "Work with your group and show your thinking.", studentAction: "Complete the group task on paper.", remoteAction: "Use the private pull, focus, activity, and check plan. Keep student names off public screens." },
  { id: "independent", label: "Independent Paper Work", minutes: 14, color: "#36557f", desc: "Complete the full required paper set and use the help path if needed.", paceAction: "Start the required paper set.", studentAction: "Work through your paper set." },
  { id: "exit", label: "Exit Ticket", minutes: 3, color: "#8a3d50", desc: "Complete and submit the assigned exit ticket on your own.", paceAction: "Show what you know.", studentAction: "Complete and submit your exit ticket." },
  // Buffer states: the room itself changing state is a real cost, so it gets
  // its own planned minutes and its own music. The uploaded track for each
  // vibe is the audible clock - students learn that the song ending is the
  // deadline. Hustle = quick task switch, Reset = bigger room change,
  // Settle = bring the energy down.
  { id: "transition-hustle", label: "Transition - Hustle", minutes: 1, color: "#f95335", desc: "Move now. Materials away, next spot, eyes up before the music ends.", paceAction: "Quick change - beat the music.", studentAction: "Move fast and quiet. Be ready before the music ends." },
  { id: "transition-reset", label: "Transition - Reset", minutes: 2, color: "#fcaf38", desc: "Reset the room: new groups, new materials, new station. Set up and seated before the music ends.", paceAction: "Reset to the next setup.", studentAction: "Reset your area and be seated before the music ends." },
  { id: "transition-settle", label: "Transition - Settle", minutes: 1, color: "#50a3a4", desc: "Bring it down. Voices off, seats found, breathe. Ready to focus when the music ends.", paceAction: "Settle and refocus.", studentAction: "Settle in quietly before the music ends." },
  { id: "closeout", label: "Closeout", minutes: 1, color: "#8a6b2f", desc: CLOSEOUT_DIRECTIONS, paceAction: CLOSEOUT_DIRECTIONS, studentAction: CLOSEOUT_DIRECTIONS, remoteAction: "Scan the room, then end the session when supplies are away and areas are clean." },
  { id: "i-do", label: "Direct Instruction (I do)", minutes: 4, color: "#a86735", desc: "Watch and take notes. I'll model each step." },
  { id: "we-do", label: "Guided Practice (We do)", minutes: 5, color: "#357f7d", desc: "We'll solve these together — try each step with me." },
  { id: "question", label: "Question", minutes: 2, color: "#8b5cf6", desc: "Respond to the question before the timer ends." },
  { id: "poll", label: "Live Poll", minutes: 3, color: "#6f3f78", desc: "Share a quick check-in before results appear." },
  { id: "tool-whiteboard", label: "Whiteboard", minutes: 5, color: "#0ea5e9", desc: "Use the whiteboard to show and explain your thinking." },
  { id: "tool-number-line", label: "Number Line", minutes: 5, color: "#38bdf8", desc: "Model the problem on the number line." },
  { id: "tool-percent-bar", label: "Percent Bar", minutes: 5, color: "#f472b6", desc: "Use the percent bar to make sense of the relationship." },
  { id: "tool-equation-builder", label: "Equation Builder", minutes: 6, color: "#2f9e6f", desc: "Build and solve the equation one step at a time." },
  { id: "tool-balance-beam", label: "Balance Beam", minutes: 6, color: "#50a3a4", desc: "Keep the beam level — do the same to both sides to solve." },
  { id: "tool-gems", label: "GEMS", minutes: 5, color: "#a78bfa", desc: "Use GEMS to decide which operation comes first." },
  { id: "tool-fraction-bars", label: "Fraction Bars", minutes: 5, color: "#f59e0b", desc: "Model the fraction relationship with bars." },
  { id: "tool-algebra-tiles", label: "Algebra Tiles", minutes: 6, color: "#fb7185", desc: "Build the expression with algebra tiles." },
  { id: "tool-area-model", label: "Box Method", minutes: 6, color: "#fcaf38", desc: "Fill in the boxes to multiply with the box method." },
  { id: "tool-distributive-area", label: "Distributive Area Method", minutes: 6, color: "#50a3a4", desc: "Split the rectangle your own way, then find each partial product." },
  { id: "tool-area-explorer", label: "Area Explorer", minutes: 6, color: "#50a3a4", desc: "Pick a shape, fill in the area formula, and name the unit." },
  { id: "tool-divisibility", label: "Divisibility Rules", minutes: 6, color: "#50a3a4", desc: "Test each rule, cross out the numbers, and prove factor pairs with arches." },
  { id: "tool-combine", label: "Combine Like Terms", minutes: 6, color: "#f95335", desc: "Group like terms and simplify the expression." },
  { id: "tool-ladder", label: "Ladder Method", minutes: 6, color: "#674a40", desc: "Divide down the ladder to find GCF and LCM." },
  { id: "tool-proportions", label: "Proportions", minutes: 6, color: "#50a3a4", desc: "Find the scale factor and the missing value." },
  { id: "tool-group-bars", label: "Group Bars", minutes: 5, color: "#2f9e6f", desc: "Build equal groups — fractions, decimals, percents." },
  { id: "tool-coordinate-grid", label: "Coordinate Grid", minutes: 6, color: "#4d8df6", desc: "Plot and identify points on the plane." },
  { id: "tool-term-identifier", label: "Identify Terms", minutes: 5, color: "#50a3a4", desc: "Sort coefficient, variable, operation, and constant." },
  { id: "tool-multiplication", label: "Multiplication Facts", minutes: 6, color: "#4d8df6", desc: "Fast multiplication facts practice." },
  { id: "tool-game", label: "Live Game", minutes: 5, color: "#7c5cd6", desc: "Compete in a quick auto-scored challenge — live leaderboard." },
  { id: "tool-exit-ticket", label: "Exit Ticket (collect)", minutes: 5, color: "#f95335", desc: "Answer the exit ticket on your own and turn it in." },
  { id: "tool-checkpoint", label: "SBAC Checkpoint", minutes: 5, color: "#50a3a4", desc: "Answer the checkpoint question — it shows what you've mastered." },
  { id: "you-do", label: "Independent Practice (You do)", minutes: 14, color: "#36557f", desc: "Work independently. Show all of your steps." },
  { id: "manip", label: "Manipulatives / Hands-On", minutes: 5, color: "#3f7d50", desc: "Use the manipulative to model the problem." },
  { id: "partner", label: "Partner / Group Work", minutes: 10, color: "#ec4899", desc: "Work with your partner — both of you explain your thinking." },
  { id: "cleanup", label: "Clean Up / Pack Up", minutes: 1, color: "#8a6b2f", desc: "Clean your space and pack up quietly." },
  { id: "break", label: "Brain Break", minutes: 3, color: "#a3a3a3", desc: "Quick brain break — reset and get ready to focus." },
];

// The teacher-facing "State Type" Notion property: a plain-English name for the
// KIND of each Lesson Step, mapped back to the canonical State ID the runtime
// uses. Steele wanted to see (and set from a dropdown) the kind of slide at a
// glance (2026-08-02). NOTE the property is "State Type", NOT "Slide Type" -
// "Slide Type" is a SEPARATE property for embedded outside slides/boards, so
// this one was renamed to avoid the collision (2026-08-02). Wiring the MAP - not
// just a cosmetic label - is what stops it drifting from what actually runs, the
// failure mode the Response Mode and Poll Kind drift traps in CLAUDE.md warn
// about. Every stateId here MUST be a real DEFAULT_STATES id; `test:state-type`
// pins that. It is PREFERRED over the raw `State ID` only when a step sets State
// Type, so existing steps (State ID only) render exactly as before and a teacher
// can migrate one step at a time.
export const STATE_TYPE_OPTIONS: { label: string; stateId: string }[] = [
  { label: "Warm-Up", stateId: "warmup" },
  { label: "Review", stateId: "review" },
  { label: "Learning Targets", stateId: "learning-target-readers" },
  { label: "Lesson Launch", stateId: "launch" },
  { label: "Direct Instruction (I Do)", stateId: "i-do" },
  { label: "Guided Practice (We Do)", stateId: "we-do" },
  { label: "Concrete (I Do)", stateId: "concrete" },
  { label: "Representational (We Do)", stateId: "representational" },
  { label: "Abstract (You Do)", stateId: "abstract" },
  { label: "Learning Check", stateId: "learning-check" },
  { label: "Question", stateId: "question" },
  { label: "Discussion", stateId: "discussion" },
  // Deliberately NO generic "Tool" option: a step's specific tool state (e.g.
  // tool-divisibility) is set by State ID + the Tool property, and a coarse
  // "Manipulative / Tool" -> manip would override that and drop the tool embed.
  // Tool/manipulative steps leave State Type empty and fall back to State ID.
  { label: "Partner / Group Work", stateId: "partner" },
  { label: "Independent Work", stateId: "independent" },
  { label: "Exit Ticket", stateId: "exit" },
  { label: "Transition - Hustle", stateId: "transition-hustle" },
  { label: "Transition - Reset", stateId: "transition-reset" },
  { label: "Transition - Settle", stateId: "transition-settle" },
  { label: "Closeout", stateId: "closeout" },
];

const STATE_TYPE_BY_LABEL = new Map(
  STATE_TYPE_OPTIONS.map((option) => [option.label.trim().toLowerCase(), option.stateId]),
);

/** Map a friendly State Type label to its canonical State ID, or "" if unknown. */
export function stateIdForStateType(stateType: string | null | undefined): string {
  const key = (stateType || "").trim().toLowerCase();
  return key ? STATE_TYPE_BY_LABEL.get(key) ?? "" : "";
}

export const BANK_GROUPS = [
  {
    id: "class",
    label: "Class States",
    hint: "Room routines and teacher-led lesson flow",
    stateIds: ["warmup", "review", "learning-target-readers", "launch", "concrete", "representational", "abstract", "learning-check", "discussion", "independent", "exit", "closeout", "i-do", "we-do", "you-do", "partner", "cleanup", "break"],
  },
  {
    id: "routines",
    label: "Class Routines",
    hint: "Optional routines that belong on selected lesson days",
    stateIds: ["ipad-kid"],
  },
  {
    id: "collaboration",
    label: "Collaborative Routines",
    hint: "Structured movement, gallery review, and teacher-led small groups",
    stateIds: ["gallery-walk", "small-group"],
  },
  {
    id: "feedback",
    label: "Feedback & Games",
    hint: "Questions, checks for understanding, polls, and live games",
    stateIds: ["question", "poll", "tool-game", "tool-exit-ticket", "tool-checkpoint"],
  },
  {
    id: "process",
    label: "Guided Processes",
    hint: "Step-by-step math thinking routines",
    stateIds: ["tool-gems", "tool-equation-builder", "tool-balance-beam", "tool-combine", "tool-ladder", "tool-proportions", "tool-term-identifier"],
  },
  {
    id: "manipulatives",
    label: "Manipulatives",
    hint: "Student screens switch to digital math tools",
    stateIds: ["tool-whiteboard", "tool-number-line", "tool-percent-bar", "tool-fraction-bars", "tool-algebra-tiles", "tool-area-model", "tool-distributive-area", "tool-divisibility", "tool-area-explorer", "tool-group-bars", "tool-coordinate-grid", "tool-multiplication", "manip"],
  },
] as const;

export interface ClassStateStepDefaults {
  title: string;
  stateId: string;
  duration: number;
  studentDirections: string;
  teacherNotes: string;
  paperTask: string;
  tool: string;
  question: string;
  pollKind: "" | "short-answer" | "multiple-choice" | "fist-to-five";
  choices: string[];
  correctAnswer: string;
  advance: "Automatic";
  required: true;
  linkUrl: string;
  mainDisplay: string;
  paceDirections: string;
  studentAction: string;
  remoteActions: string;
  discussionStems: string;
  vocabulary: string;
  responseMode: "None" | "Google Form" | "Paper" | "Short Answer" | "Fist to Five" | "Assigned Tool";
  workSpaceAvailable: boolean;
}

export function classStateStepDefaults(state: ClassState): ClassStateStepDefaults {
  const isWarmupOrExit = state.id === "warmup" || state.id === "exit";
  const isLearningCheck = state.id === "learning-check";
  const isQuestion = state.id === "question";
  const isPoll = state.id === "poll";
  const isPaper = state.id === "independent" || state.id === "you-do";
  const isDiscussion = state.id === "discussion";
  const isAssignedTool = state.id.startsWith("tool-")
    && !["tool-game", "tool-exit-ticket", "tool-checkpoint"].includes(state.id);
  const responseMode = isWarmupOrExit
    ? "Google Form"
    : isLearningCheck || isPoll
      ? "Fist to Five"
      : isQuestion
        ? "Short Answer"
        : isPaper
          ? "Paper"
          : isAssignedTool
            ? "Assigned Tool"
            : "None";

  return {
    title: state.label,
    stateId: state.id,
    duration: state.minutes,
    studentDirections: state.desc,
    teacherNotes: state.remoteAction || "",
    paperTask: "",
    tool: isAssignedTool ? state.label : "",
    question: isLearningCheck || isPoll
      ? "How well do you understand this right now?"
      : isQuestion
        ? state.desc
        : "",
    pollKind: isLearningCheck || isPoll ? "fist-to-five" : isQuestion ? "short-answer" : "",
    choices: isLearningCheck || isPoll ? ["0", "1", "2", "3", "4", "5"] : [],
    correctAnswer: "",
    advance: "Automatic",
    required: true,
    linkUrl: "",
    mainDisplay: "",
    paceDirections: "",
    studentAction: "",
    remoteActions: state.remoteAction || "",
    discussionStems: isDiscussion
      ? "I agree with ___ because...\nI disagree because...\nMy evidence is...\nI changed my thinking because..."
      : "",
    vocabulary: isDiscussion ? "strategy\nevidence\njustify\nrepresent\nrevise" : "",
    responseMode,
    workSpaceAvailable: false,
  };
}
