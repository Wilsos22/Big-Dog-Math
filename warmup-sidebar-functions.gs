// =====================================================================
// BIG DOG MATH - SIDEBAR FUNCTIONS
// Sidebar trigger for the warm-up generator. The three wrappers below are the
// single switch point between question sources: they now call the parametric
// ENGINE (warmup-engine.gs -> /api/warmup). To fall back to the old OpenAI
// path, swap each engine call for its ...FromAI_ / ...FromTopics equivalent
// (shown in the comment on each line).
// =====================================================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Big Dog Math")
    .addItem("Warm-Up Builder", "showWarmupBuilder")
    .addItem("Build Week from Notion Lessons", "promptBuildWeekFromNotion")
    .addSeparator()
    .addItem("Install Response Export Trigger", "installNotionSyncTrigger")
    .addItem("Repair Existing Form Triggers", "installWarmupFormTriggersFromKnownForms")
    .addItem("Backfill Scores from Forms", "backfillWarmupScoresFromForms")
    .addToUi();
  // The per-student Notion sync menu items are RETIRED (FERPA boundary,
  // 2026-07-31): student data stays inside Workspace. The lesson-content
  // Notion sync (notion-warmup-requests.gs) is unaffected.
}

// The week builder had no way to be run (added 2026-08-05). warmup-week-builder.gs
// shipped with buildWeekFromNotionLessons(), ROADMAP claimed a sidebar button for
// it, and there was none - generateWeekAuto goes to generateWeekFormsFromEngine_,
// never to the week builder. So after the paste-in there was still nothing to
// press. A menu item takes no arguments and buildWeekFromNotionLessons needs a
// {number, startDate}, which is why this wrapper exists rather than a bare entry.
//
// It builds all five days in ONE press and does not stop at the first failure:
// buildWeekFromNotionLessons already catches per day and returns {ok, dayIndex,
// error}, so a Wednesday with no published lesson must not cost you Thursday and
// Friday. The summary names the days that failed and why.
function promptBuildWeekFromNotion() {
  const ui = SpreadsheetApp.getUi();
  const fallback = (typeof WEEK_CONFIG !== "undefined" && WEEK_CONFIG) ? WEEK_CONFIG : { number: "", startDate: "" };

  const dateAsk = ui.prompt(
    "Build week from Notion lessons",
    "Monday's date as MM-DD-YY (currently " + (fallback.startDate || "not set") + "):",
    ui.ButtonSet.OK_CANCEL);
  if (dateAsk.getSelectedButton() !== ui.Button.OK) return;
  const startDate = String(dateAsk.getResponseText() || "").trim() || fallback.startDate;

  const numAsk = ui.prompt(
    "Build week from Notion lessons",
    "Week number (currently " + (fallback.number || "not set") + "):",
    ui.ButtonSet.OK_CANCEL);
  if (numAsk.getSelectedButton() !== ui.Button.OK) return;
  const number = String(numAsk.getResponseText() || "").trim() || fallback.number;

  let results;
  try {
    // normalizeWeekConfig_ enforces MM-DD-YY and says so; let its message through
    // rather than a generic failure, because a bad date is the likely mistake.
    results = buildWeekFromNotionLessons({ number: number, startDate: startDate });
  } catch (err) {
    ui.alert("Week build failed", String(err && err.message ? err.message : err), ui.ButtonSet.OK);
    return;
  }

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const built = [];
  const failed = [];
  (results || []).forEach(function (r, i) {
    const name = days[(r && typeof r.dayIndex === "number") ? r.dayIndex : i] || ("Day " + (i + 1));
    if (r && r.ok) built.push(name);
    else failed.push(name + ": " + String((r && r.error) || "unknown error"));
  });

  let message = "Built " + built.length + " of 5.";
  if (built.length) message += "\n\nBuilt: " + built.join(", ");
  if (failed.length) message += "\n\nNot built:\n- " + failed.join("\n- ");
  if (failed.length) {
    message += "\n\nA day usually fails because its lesson is not Published in Notion "
      + "for that date, or the date is a weekend. Fix the lesson and re-run - "
      + "rebuilding a day that already worked is safe.";
  }
  ui.alert("Week build", message, ui.ButtonSet.OK);
}

function showWarmupBuilder() {
  const html = HtmlService.createHtmlOutputFromFile("WarmupBuilder")
    .setTitle("Warm-Up Builder")
    .setWidth(460);
  SpreadsheetApp.getUi().showSidebar(html);
}

// Weekly build path. Blank topic slots are fine - the engine resolves each
// day's topic from the Notion calendar by date.
function generateWeekAuto(weekConfig, topics) {
  return generateWeekFormsFromEngine_(weekConfig, topics); // AI fallback: generateWeekFormsFromTopics(weekConfig, topics)
}

// dayIndex: 0=Monday ... 4=Friday. A blank topic is allowed (resolved by date).
function generateSingleDayAuto(weekConfig, dayIndex, weekTopic, overrideTopic) {
  const topic = String(overrideTopic || weekTopic || "").trim();
  return createWarmupFormFromEngine_(weekConfig, dayIndex, topic); // AI fallback: createWarmupFormFromAI_(weekConfig, dayIndex, topic)
}

// Preview one day's question set without creating a form.
function previewDayAuto(weekTopic, dayName, dayIndex, overrideTopic) {
  const topic = String(overrideTopic || weekTopic || "").trim();
  const info = getWarmupDayInfo_(normalizeWeekConfig_(WEEK_CONFIG).startDate, dayIndex);
  return generateEngineQuestionSet_(info.isoDate, topic); // AI fallback: generateAIQuestionSet_(topic, normalizeWeekConfig_(WEEK_CONFIG), dayIndex)
}
