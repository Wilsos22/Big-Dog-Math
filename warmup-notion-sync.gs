// =====================================================================
// BIG DOG MATH - WARM-UP RESPONSE/LINK SYNC HELPERS
// Form submissions are written to backup export sheets INSIDE Workspace.
//
// FERPA boundary (2026-07-31): the per-student Notion sync is RETIRED.
// Student data - emails, scores, submission rows - may not leave the
// district Google Workspace for Notion. The export sheets in this
// spreadsheet are the permanent record; the site receives only pseudonymous
// evidence through warmup-evidence.gs. The Notion helpers below survive
// ONLY for the lesson-content sync (notion-warmup-requests.gs), which
// carries no student data.
// =====================================================================

const BDM_WARMUP_LINKS_EXPORT_SHEET = "Warm Up Links Export";
const BDM_WARMUP_SUBMISSIONS_EXPORT_SHEET = "Warm Up Submissions Export";

const WARMUP_NOTION_API_BASE = "https://api.notion.com/v1";
const WARMUP_NOTION_VERSION = "2026-03-11";

const WARMUP_NOTION_PROP_KEYS = {
  token: "NOTION_TOKEN",
  studentsDataSource: "NOTION_STUDENTS_DATA_SOURCE_ID",
  warmupsDataSource: "NOTION_WARMUPS_DATA_SOURCE_ID",
  submissionsDataSource: "NOTION_WARMUP_SUBMISSIONS_DATA_SOURCE_ID",
  studentsDataSourceName: "NOTION_STUDENTS_DATA_SOURCE_NAME",
  warmupsDataSourceName: "NOTION_WARMUPS_DATA_SOURCE_NAME",
  submissionsDataSourceName: "NOTION_WARMUP_SUBMISSIONS_DATA_SOURCE_NAME",
  studentsDb: "NOTION_STUDENTS_DB_ID",
  warmupsDb: "NOTION_WARMUPS_DB_ID",
  submissionsDb: "NOTION_WARMUP_SUBMISSIONS_DB_ID"
};

const WARMUP_FORM_KEY_PROPS = ["Warm Up Key", "Form ID", "Key"];
const WARMUP_FORM_TITLE_PROPS = ["Name", "Warm Up", "Title"];

// Maps each of the 5 multiple-choice questions (Q1..Q5) to a skill bucket.
// Q1 = fluency/computation, Q2-Q3 = spiral review, Q4-Q5 = current topic.
const WARMUP_QUESTION_CATEGORIES = ["Computation", "Review", "Review", "Current Topic", "Current Topic"];

function installResponseExportTrigger() {
  const ss = SpreadsheetApp.openById(RESPONSE_SS_ID);
  deleteTriggersForHandler_("syncSubmissionToExportSheet", ss.getId());

  ScriptApp.newTrigger("syncSubmissionToExportSheet")
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();

  Logger.log("Response export backup trigger installed on the response spreadsheet.");
}

// This keeps the existing menu/action name, but the form-specific triggers
// installed by generated forms now run export + Notion sync.
function installNotionSyncTrigger() {
  installResponseExportTrigger();
  const result = installWarmupFormTriggersFromKnownForms();
  Logger.log(`Notion sync backup trigger installed. Existing form trigger repair: ${result.installed} installed, ${result.failed} failed.`);
}

function installWarmupFormSubmitTriggerSafely_(form) {
  try {
    installWarmupFormSubmitTrigger_(form);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}

function installWarmupFormSubmitTrigger_(form) {
  const formId = form.getId();
  // Per-form triggers are OFF by default: the single spreadsheet-level trigger
  // (installResponseExportTrigger) already fires for every form linked to the
  // response spreadsheet, and per-form triggers double-fire submissions while
  // eating Google's 20-trigger quota ("This script has too many triggers").
  // Set Script Property BDM_PER_FORM_TRIGGERS = "on" to restore old behavior.
  deleteTriggersForHandler_("syncFormResponseToExportSheet", formId);
  const wantPerForm = PropertiesService.getScriptProperties().getProperty("BDM_PER_FORM_TRIGGERS") === "on";
  if (!wantPerForm) {
    Logger.log(`Covered by the spreadsheet-level trigger (no per-form trigger created) for ${form.getTitle()}`);
    return;
  }

  ScriptApp.newTrigger("syncFormResponseToExportSheet")
    .forForm(form)
    .onFormSubmit()
    .create();

  Logger.log(`Response export + Notion sync trigger installed for ${form.getTitle()}`);
}

function deleteTriggersForHandler_(handlerName, sourceId) {
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() !== handlerName) return;
    if (sourceId && trigger.getTriggerSourceId && trigger.getTriggerSourceId() !== sourceId) return;
    ScriptApp.deleteTrigger(trigger);
  });
}

function listTriggers() {
  ScriptApp.getProjectTriggers().forEach(trigger => {
    Logger.log(`${trigger.getHandlerFunction()} - source: ${trigger.getTriggerSourceId && trigger.getTriggerSourceId()}`);
  });
}

function installWarmupFormTriggersFromKnownForms() {
  const formIds = getKnownWarmupFormIds_();
  let installed = 0;
  let failed = 0;
  const errors = [];

  formIds.forEach(formId => {
    try {
      const form = FormApp.openById(formId);
      installWarmupFormSubmitTrigger_(form);
      installed++;
    } catch (err) {
      failed++;
      errors.push(`${formId}: ${String(err && err.message ? err.message : err)}`);
    }
  });

  const message = `Form trigger repair finished.\n\nInstalled: ${installed}\nFailed: ${failed}`;
  if (typeof SpreadsheetApp !== "undefined") {
    SpreadsheetApp.getUi().alert(errors.length ? `${message}\n\n${errors.slice(0, 5).join("\n")}` : message);
  }

  return { installed, failed, errors };
}

function recordWarmUpLinkSafely_(data) {
  try {
    const action = recordWarmUpLinkExport_(data);
    return { ok: true, action };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}

function recordWarmUpLinkExport_(data) {
  const ss = SpreadsheetApp.openById(RESPONSE_SS_ID);
  const sheet = getOrCreateExportSheet_(ss, BDM_WARMUP_LINKS_EXPORT_SHEET, [
    "Synced At",
    "Key",
    "Name",
    "Class",
    "School Year",
    "Week",
    "Day",
    "Date",
    "Topic",
    "Subject",
    "Form Link",
    "Edit Link",
    "Response Sheet",
    "Response Tab",
    "Folder",
    "Source"
  ]);

  const key = String(data.formId || "").trim();
  const row = [
    new Date(),
    key,
    data.title || "",
    "Math 6",
    "2026-27",
    data.weekLabel || buildWeekLabel_(data.weekNumber || ""),
    data.isoDate || "",
    data.isoDate || "",
    data.topic || "",
    data.subject || "Math 6",
    data.publishedUrl || "",
    data.editUrl || "",
    data.responseSheetUrl || "",
    data.responseTabName || "",
    data.weekFolderUrl || "",
    data.source || getWarmupSourceName_()
  ];

  const existingRow = findRowByValue_(sheet, 2, key);
  if (existingRow > 1) {
    sheet.getRange(existingRow, 1, 1, row.length).setValues([row]);
    return "updated export row";
  }

  sheet.appendRow(row);
  return "created export row";
}

function syncFormResponseToExportSheet(e) {
  try {
    const form = e.source;
    const response = e.response;
    if (!form || !response) throw new Error("Missing form response event.");

    const submissionData = buildSubmissionDataFromFormResponse_(form, response);
    const notionResult = syncWarmupSubmissionToNotionSafely_(submissionData);
    writeSubmissionExportRow_(Object.assign({}, submissionData, { notionResult }));
    // Proficiency spine bridge (warmup-evidence.gs) — never blocks the Notion sync.
    if (typeof postWarmupEvidenceSafely_ === "function") {
      postWarmupEvidenceSafely_(submissionData, form, response);
    }
  } catch (err) {
    Logger.log(`Response export/sync error: ${err.message}`);
  }
}

// Spreadsheet-level trigger path. This single trigger covers EVERY form linked
// to the response spreadsheet, so it scales past Google's 20-trigger-per-script
// limit (unlike per-form triggers). The raw spreadsheet row has no quiz score,
// week, or per-question results -- so we reach back to the linked Form, pull the
// graded response, and build the full submission from it. Falls back to the raw
// values only if the form/response can't be recovered.
function syncSubmissionToExportSheet(e) {
  try {
    const sheet = e && e.range && e.range.getSheet ? e.range.getSheet() : null;
    const values = e && e.namedValues ? e.namedValues : {};
    const email = String(
      (values["Email Address"] && values["Email Address"][0]) ||
      (values["Email"] && values["Email"][0]) || ""
    ).trim().toLowerCase();

    let submissionData = null;
    let recoveredForm = null;
    let recoveredResponse = null;
    try {
      const formUrl = sheet && sheet.getFormUrl ? sheet.getFormUrl() : "";
      if (formUrl) {
        const form = FormApp.openByUrl(formUrl);
        const response = findFormResponseForSubmission_(form, email);
        if (response) {
          submissionData = buildSubmissionDataFromFormResponse_(form, response);
          recoveredForm = form;
          recoveredResponse = response;
        }
      }
    } catch (lookupErr) {
      Logger.log(`Could not recover graded form response: ${lookupErr.message}`);
    }

    // Fallback: raw spreadsheet values (no score/week/grading available).
    if (!submissionData) {
      const sheetName = sheet ? sheet.getName() : "";
      const timestamp = (values["Timestamp"] && values["Timestamp"][0]) || new Date();
      const period = normalizePeriodName_((values["Period"] && values["Period"][0]) || "");
      submissionData = {
        submittedAt: timestamp,
        submissionKey: buildWarmupSubmissionKey_(sheetName, "", email, sheetName),
        formId: "",
        formTitle: sheetName,
        email: email,
        warmupToken: String(
          (values["Big Dog connection"] && values["Big Dog connection"][0]) || ""
        ).trim(),
        period: period,
        score: "",
        week: "",
        date: sheetName,
        topic: "",
        missedQuestions: [],
        missedCategories: [],
        source: getWarmupSourceName_()
      };
    }

    const notionResult = syncWarmupSubmissionToNotionSafely_(submissionData);
    writeSubmissionExportRow_(Object.assign({}, submissionData, { notionResult }));
    // Proficiency spine bridge (warmup-evidence.gs) — never blocks the Notion sync.
    if (typeof postWarmupEvidenceSafely_ === "function") {
      postWarmupEvidenceSafely_(submissionData, recoveredForm, recoveredResponse);
    }
  } catch (err) {
    Logger.log(`Spreadsheet response export/sync error: ${err.message}`);
  }
}

// Finds the graded Form response for this submission by respondent email
// (newest match first); falls back to the most recent response on the form.
function findFormResponseForSubmission_(form, email) {
  const responses = form.getResponses();
  if (!responses.length) return null;

  const safeEmail = String(email || "").trim().toLowerCase();
  if (safeEmail) {
    for (let i = responses.length - 1; i >= 0; i--) {
      const respEmail = String(responses[i].getRespondentEmail() || "").trim().toLowerCase();
      if (respEmail === safeEmail) return responses[i];
    }
  }
  return responses[responses.length - 1];
}

function writeSubmissionExportRow_(data) {
  const ss = SpreadsheetApp.openById(RESPONSE_SS_ID);
  const sheet = getOrCreateExportSheet_(ss, BDM_WARMUP_SUBMISSIONS_EXPORT_SHEET, [
    "Exported At",
    "Submission Key",
    "Submitted",
    "Email Address",
    "Period",
    "Score",
    "Class",
    "Week",
    "Date",
    "Topic",
    "Form ID",
    "Warm Up",
    "Source",
    "Notion Status",
    "Notion Page ID",
    "Notion Error",
    "Notion Synced At",
    "Missed Questions",
    "Missed Categories"
  ]);

  const notionResult = data.notionResult || {};
  const key = String(data.submissionKey || "").trim();
  const row = [
    new Date(),
    key,
    data.submittedAt || "",
    data.email || "",
    data.period || "",
    data.score,
    "Math 6",
    data.week || "",
    data.date || "",
    data.topic || "",
    data.formId || "",
    data.formTitle || "",
    data.source || getWarmupSourceName_(),
    notionResult.status || "",
    notionResult.pageId || "",
    notionResult.error || "",
    notionResult.syncedAt || "",
    (data.missedQuestions || []).join(", "),
    (data.missedCategories || []).join(", ")
  ];

  const existingRow = findSubmissionExportRow_(sheet, key, data);
  if (existingRow > 1) {
    sheet.getRange(existingRow, 1, 1, row.length).setValues([row]);
    return;
  }
  sheet.appendRow(row);
}

function backfillWarmupScoresFromForms() {
  const formIds = getKnownWarmupFormIds_();
  if (!formIds.length) {
    SpreadsheetApp.getUi().alert("No warm-up form IDs were found in the link/export sheets.");
    return;
  }

  let responsesProcessed = 0;
  let formsProcessed = 0;
  let failed = 0;
  const errors = [];

  formIds.forEach(formId => {
    try {
      const form = FormApp.openById(formId);
      formsProcessed++;

      form.getResponses().forEach(response => {
        const submissionData = buildSubmissionDataFromFormResponse_(form, response);
        const notionResult = syncWarmupSubmissionToNotionSafely_(submissionData);
        writeSubmissionExportRow_(Object.assign({}, submissionData, { notionResult }));
        responsesProcessed++;
      });
    } catch (err) {
      failed++;
      errors.push(`${formId}: ${String(err && err.message ? err.message : err)}`);
    }
  });

  SpreadsheetApp.getUi().alert(
    `Score backfill finished.\n\nForms checked: ${formsProcessed}\nResponses updated: ${responsesProcessed}\nFailed forms: ${failed}` +
    (errors.length ? `\n\n${errors.slice(0, 5).join("\n")}` : "")
  );
}

function buildSubmissionDataFromFormResponse_(form, response) {
  const formTitle = form.getTitle();
  const formId = form.getId();
  const itemValues = getFormResponseValues_(response);
  const email = String(response.getRespondentEmail() || itemValues["Email Address"] || itemValues["Email"] || "")
    .trim()
    .toLowerCase();
  const period = normalizePeriodName_(itemValues["Period"]);
  const score = getFormResponseScore_(response);
  const submittedAt = response.getTimestamp ? response.getTimestamp() : new Date();
  const parsed = parseWarmupTitle_(formTitle);
  const meta = parseWarmupDescription_(form.getDescription ? form.getDescription() : "");
  const questionResults = getWarmupQuestionResults_(response);
  const week = meta.week || parsed.week || "";
  const topic = meta.topic || parsed.topic || "";

  return {
    submittedAt,
    submissionKey: buildWarmupSubmissionKey_(parsed.date, topic, email, formTitle),
    formId,
    formTitle,
    email,
    warmupToken: String(itemValues["Big Dog connection"] || "").trim(),
    period,
    score,
    week: week,
    date: parsed.date || "",
    topic: topic,
    missedQuestions: questionResults.missedQuestions,
    missedCategories: questionResults.missedCategories,
    source: getWarmupSourceName_()
  };
}

// Walks the 5 multiple-choice questions in order and reports which were missed,
// plus the skill categories those misses fall into.
function getWarmupQuestionResults_(response) {
  const missedQuestions = [];
  const categories = {};
  let qIndex = 0;

  response.getItemResponses().forEach(function (itemResponse) {
    const item = itemResponse.getItem();
    if (item.getType() !== FormApp.ItemType.MULTIPLE_CHOICE) return;
    if (qIndex < 5 && !isWarmupItemCorrect_(itemResponse, item)) {
      missedQuestions.push("Q" + (qIndex + 1));
      const category = WARMUP_QUESTION_CATEGORIES[qIndex];
      if (category) categories[category] = true;
    }
    qIndex++;
  });

  return {
    missedQuestions: missedQuestions,
    missedCategories: Object.keys(categories)
  };
}

function isWarmupItemCorrect_(itemResponse, item) {
  // Prefer the graded quiz score when Google has set one.
  try {
    const score = itemResponse.getScore();
    if (score !== null && score !== undefined && score !== "") {
      return Number(score) > 0;
    }
  } catch (err) {
    // fall through to answer-key comparison
  }

  // Fallback: compare the response to the marked correct choice.
  try {
    const mc = item.asMultipleChoiceItem();
    const selected = String(itemResponse.getResponse() || "");
    return mc.getChoices().some(function (choice) {
      return choice.isCorrectAnswer && choice.isCorrectAnswer() && String(choice.getValue()) === selected;
    });
  } catch (err) {
    return true; // if we cannot determine, do not flag it as missed
  }
}

// RETIRED (FERPA boundary, 2026-07-31): per-student warm-up submissions are
// no longer written to Notion. The export sheets in this spreadsheet are the
// record; delete the Notion "Warm up Submissions" database and the Students
// database's submission relations after cutover. This stub keeps every old
// call site and trigger harmless - it never contacts Notion.
function syncWarmupSubmissionToNotionSafely_(data) {
  return {
    ok: false,
    skipped: true,
    status: "retired",
    error: "Student data no longer syncs to Notion (FERPA boundary). The export sheet is the record.",
    syncedAt: new Date()
  };
}

function splitExportList_(value) {
  return String(value || "")
    .split(",")
    .map(function (part) { return part.trim(); })
    .filter(Boolean);
}

function getWarmupNotionConfig_() {
  const props = PropertiesService.getScriptProperties();
  return {
    token: String(props.getProperty(WARMUP_NOTION_PROP_KEYS.token) || "").trim(),
    studentsDataSource: cleanNotionId_(props.getProperty(WARMUP_NOTION_PROP_KEYS.studentsDataSource)),
    warmupsDataSource: cleanNotionId_(props.getProperty(WARMUP_NOTION_PROP_KEYS.warmupsDataSource)),
    submissionsDataSource: cleanNotionId_(props.getProperty(WARMUP_NOTION_PROP_KEYS.submissionsDataSource)),
    studentsDataSourceName: String(props.getProperty(WARMUP_NOTION_PROP_KEYS.studentsDataSourceName) || "").trim(),
    warmupsDataSourceName: String(props.getProperty(WARMUP_NOTION_PROP_KEYS.warmupsDataSourceName) || "").trim(),
    submissionsDataSourceName: String(props.getProperty(WARMUP_NOTION_PROP_KEYS.submissionsDataSourceName) || "").trim(),
    studentsDb: cleanNotionId_(props.getProperty(WARMUP_NOTION_PROP_KEYS.studentsDb)),
    warmupsDb: cleanNotionId_(props.getProperty(WARMUP_NOTION_PROP_KEYS.warmupsDb)),
    submissionsDb: cleanNotionId_(props.getProperty(WARMUP_NOTION_PROP_KEYS.submissionsDb))
  };
}

function getNotionDataSourceId_(role, config) {
  const direct = cleanNotionId_(config[`${role}DataSource`]);
  const databaseId = cleanNotionId_(config[`${role}Db`]);
  const preferredName = String(config[`${role}DataSourceName`] || "").trim();

  if (direct) {
    return resolveNotionDataSourceReference_(direct, config, preferredName);
  }

  if (databaseId) {
    return resolveNotionDataSourceFromDatabase_(databaseId, config, preferredName);
  }

  return "";
}

function resolveNotionDataSourceReference_(dataSourceOrDatabaseId, config, preferredName) {
  const id = cleanNotionId_(dataSourceOrDatabaseId);
  if (!id) return "";

  try {
    notionRequest_("get", `/data_sources/${id}`, null, config);
    return id;
  } catch (dataSourceErr) {
    try {
      return resolveNotionDataSourceFromDatabase_(id, config, preferredName);
    } catch (databaseErr) {
      throw dataSourceErr;
    }
  }
}

function resolveNotionDataSourceFromDatabase_(databaseId, config, preferredName) {
  const database = notionRequest_("get", `/databases/${cleanNotionId_(databaseId)}`, null, config);
  const dataSources = database.data_sources || [];
  if (!dataSources.length) {
    throw new Error(`No data sources were found for database ${databaseId}.`);
  }

  if (preferredName) {
    const normalized = preferredName.toLowerCase();
    const matched = dataSources.find(source => {
      const name = String(source.name || source.title || "").toLowerCase();
      return source.id === preferredName || name === normalized;
    });
    if (matched) return matched.id;
    throw new Error(`Could not find data source named "${preferredName}" under database ${databaseId}.`);
  }

  if (dataSources.length > 1) {
    Logger.log(`Database ${databaseId} has ${dataSources.length} data sources. Using the first one. Set a DATA_SOURCE_ID or DATA_SOURCE_NAME to choose a specific one.`);
  }

  return dataSources[0].id;
}

function getNotionDataSourceSchema_(dataSourceId, config) {
  return notionRequest_("get", `/data_sources/${cleanNotionId_(dataSourceId)}`, null, config);
}

function findNotionPageByAnyProperty_(dataSourceId, schema, propertyNames, value, config) {
  const safeValue = String(value || "").trim();
  if (!safeValue) return null;

  for (let i = 0; i < propertyNames.length; i++) {
    const propName = propertyNames[i];
    const filter = buildNotionEqualsFilter_(schema, propName, safeValue);
    if (!filter) continue;

    const result = notionRequest_("post", `/data_sources/${cleanNotionId_(dataSourceId)}/query`, {
      filter,
      page_size: 1
    }, config);

    if (result.results && result.results.length) return result.results[0];
  }

  return null;
}

function createNotionPage_(dataSourceId, properties, config) {
  return notionRequest_("post", "/pages", {
    parent: { data_source_id: cleanNotionId_(dataSourceId) },
    properties
  }, config);
}

function updateNotionPage_(pageId, properties, config) {
  return notionRequest_("patch", `/pages/${pageId}`, { properties }, config);
}

function notionRequest_(method, path, payload, config) {
  const token = config && config.token ? config.token : getWarmupNotionConfig_().token;
  if (!token) throw new Error("NOTION_TOKEN is not set in Script Properties.");

  const options = {
    method,
    muteHttpExceptions: true,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": WARMUP_NOTION_VERSION,
      "Content-Type": "application/json"
    }
  };

  if (payload) options.payload = JSON.stringify(payload);

  const response = UrlFetchApp.fetch(`${WARMUP_NOTION_API_BASE}${path}`, options);
  const code = response.getResponseCode();
  const text = response.getContentText();
  const body = text ? JSON.parse(text) : {};

  if (code < 200 || code >= 300) {
    throw new Error(`Notion ${code}: ${body.message || text}`);
  }

  return body;
}

function buildNotionEqualsFilter_(schema, propertyName, value) {
  if (!schema || !schema.properties || !schema.properties[propertyName]) return null;
  const type = schema.properties[propertyName].type;
  const safeValue = String(value || "").trim();
  if (!safeValue) return null;

  if (type === "title") return { property: propertyName, title: { equals: safeValue } };
  if (type === "rich_text") return { property: propertyName, rich_text: { equals: safeValue } };
  if (type === "email") return { property: propertyName, email: { equals: safeValue } };
  if (type === "url") return { property: propertyName, url: { equals: safeValue } };
  if (type === "select") return { property: propertyName, select: { equals: safeValue } };
  if (type === "number" && !Number.isNaN(Number(safeValue))) {
    return { property: propertyName, number: { equals: Number(safeValue) } };
  }

  return null;
}

function putNotionProperty_(schema, target, propertyName, value) {
  const built = buildNotionPropertyValue_(schema, propertyName, value);
  if (!built) return false;
  target[propertyName] = built;
  return true;
}

function putNotionRelation_(schema, target, propertyName, pageId) {
  if (!schema || !schema.properties || !schema.properties[propertyName]) return false;
  if (schema.properties[propertyName].type !== "relation") return false;
  if (!pageId) return false;
  target[propertyName] = { relation: [{ id: pageId }] };
  return true;
}

// Writes an array of values to a multi-select property (Notion auto-creates
// any option names that do not exist yet). An empty array clears the property.
function putNotionMultiSelect_(schema, target, propertyName, values) {
  if (!schema || !schema.properties || !schema.properties[propertyName]) return false;
  if (schema.properties[propertyName].type !== "multi_select") return false;
  const list = (Array.isArray(values) ? values : [])
    .map(function (value) { return String(value).trim(); })
    .filter(Boolean);
  target[propertyName] = { multi_select: list.map(function (name) { return { name: name }; }) };
  return true;
}

function setNotionTitleProperty_(schema, target, preferredName, value) {
  const titleName = schema && schema.properties && schema.properties[preferredName] && schema.properties[preferredName].type === "title"
    ? preferredName
    : getNotionTitlePropertyName_(schema);

  if (!titleName) throw new Error("Could not find a title property in the Warm up Submissions database.");
  target[titleName] = { title: [{ text: { content: String(value || "") } }] };
}

function getNotionTitlePropertyName_(schema) {
  if (!schema || !schema.properties) return "";
  const names = Object.keys(schema.properties);
  for (let i = 0; i < names.length; i++) {
    if (schema.properties[names[i]].type === "title") return names[i];
  }
  return "";
}

function buildNotionPropertyValue_(schema, propertyName, value) {
  if (!schema || !schema.properties || !schema.properties[propertyName]) return null;
  const type = schema.properties[propertyName].type;

  if ((value === "" || value === null || value === undefined) && type !== "checkbox") return null;

  if (type === "title") return { title: [{ text: { content: String(value) } }] };
  if (type === "rich_text") return { rich_text: [{ text: { content: String(value) } }] };
  if (type === "email") return { email: String(value) };
  if (type === "url") return { url: String(value) };
  if (type === "number") {
    const numberValue = Number(value);
    return Number.isNaN(numberValue) ? null : { number: numberValue };
  }
  if (type === "select") return { select: { name: String(value) } };
  if (type === "status") return { status: { name: String(value) } };
  if (type === "multi_select") return { multi_select: [{ name: String(value) }] };
  if (type === "checkbox") return { checkbox: Boolean(value) };
  if (type === "date") return { date: { start: formatNotionDate_(value) } };

  return null;
}

function getWarmupScoreInfo_(score) {
  const numeric = Number(score);
  if (Number.isNaN(numeric)) return { group: "", needsFollowUp: false };
  if (numeric < 3) return { group: "Intervention", needsFollowUp: true };
  if (numeric === 3) return { group: "Almost", needsFollowUp: false };
  return { group: "Got It", needsFollowUp: false };
}

function buildWarmupSubmissionKey_(date, topic, email, fallbackTitle) {
  const safeDate = String(date || "").trim();
  const safeTopic = String(topic || fallbackTitle || "Warm Up").trim();
  const safeEmail = String(email || "unknown").trim().toLowerCase();
  return `${safeDate} ${safeTopic} - mailto:${safeEmail}`.trim();
}

function cleanNotionId_(value) {
  const cleaned = String(value || "")
    .replace(/^collection:\/\//, "")
    .trim();
  const idMatch = cleaned.match(/[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return idMatch ? idMatch[0] : cleaned;
}

function formatNotionDate_(value) {
  if (value instanceof Date) return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ssXXX");
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ssXXX");
  }
  return String(value);
}

function ensureExportColumn_(sheet, headers, name) {
  const existing = headers.indexOf(name);
  if (existing >= 0) return existing + 1;
  const col = sheet.getLastColumn() + 1;
  sheet.getRange(1, col).setValue(name);
  headers.push(name);
  return col;
}

function getKnownWarmupFormIds_() {
  const ids = {};

  try {
    const responseSs = SpreadsheetApp.openById(RESPONSE_SS_ID);
    const exportSheet = responseSs.getSheetByName(BDM_WARMUP_LINKS_EXPORT_SHEET);
    collectWarmupFormIdsFromSheet_(exportSheet, ids);
  } catch (err) {
    Logger.log(`Could not scan warm-up link export sheet: ${err.message}`);
  }

  try {
    const linkSs = SpreadsheetApp.openById(FORM_LINK_SHEET_ID);
    linkSs.getSheets().forEach(sheet => collectWarmupFormIdsFromSheet_(sheet, ids));
  } catch (err) {
    Logger.log(`Could not scan form link sheet: ${err.message}`);
  }

  return Object.keys(ids);
}

function collectWarmupFormIdsFromSheet_(sheet, ids) {
  if (!sheet || sheet.getLastRow() < 1 || sheet.getLastColumn() < 1) return;
  const values = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  values.forEach(row => {
    row.forEach(value => {
      const formId = extractWarmupFormIdFromValue_(value);
      if (formId) ids[formId] = true;
    });
  });
}

function extractWarmupFormIdFromValue_(value) {
  const text = String(value || "").trim();
  if (!text) return "";

  const editUrlMatch = text.match(/\/forms\/d\/(?!e\/)([A-Za-z0-9_-]{20,})/);
  if (editUrlMatch) return editUrlMatch[1];

  if (/^[A-Za-z0-9_-]{20,}$/.test(text) && text.indexOf("http") !== 0) return text;
  return "";
}

function findSubmissionExportRow_(sheet, key, data) {
  const exact = findRowByValue_(sheet, 2, key);
  if (exact > 1 || sheet.getLastRow() < 2) return exact;

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const emailIndex = headers.indexOf("Email Address");
  const formIdIndex = headers.indexOf("Form ID");
  const warmUpIndex = headers.indexOf("Warm Up");
  const dateIndex = headers.indexOf("Date");
  const topicIndex = headers.indexOf("Topic");
  if (emailIndex < 0) return -1;

  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  const email = String(data.email || "").trim().toLowerCase();
  const formId = String(data.formId || "").trim();
  const formTitle = String(data.formTitle || "").trim();
  const date = String(data.date || "").trim();
  const topic = String(data.topic || "").trim();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowEmail = String(row[emailIndex] || "").trim().toLowerCase();
    if (!rowEmail || rowEmail !== email) continue;

    const rowFormId = formIdIndex >= 0 ? String(row[formIdIndex] || "").trim() : "";
    const rowWarmUp = warmUpIndex >= 0 ? String(row[warmUpIndex] || "").trim() : "";
    const rowDate = dateIndex >= 0 ? String(row[dateIndex] || "").trim() : "";
    const rowTopic = topicIndex >= 0 ? String(row[topicIndex] || "").trim() : "";

    if (formId && rowFormId === formId) return i + 2;
    if (formTitle && rowWarmUp === formTitle) return i + 2;
    if (date && topic && rowDate === date && rowTopic === topic) return i + 2;
  }

  return -1;
}

function getWarmupSourceName_() {
  try {
    return GRADE5_PDF_SOURCE || "grade-5.pdf";
  } catch (err) {
    return "grade-5.pdf";
  }
}

function getOrCreateExportSheet_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    const existingHeaders = sheet.getRange(1, 1, 1, Math.max(headers.length, sheet.getLastColumn())).getValues()[0];
    const needsHeaders = headers.some((header, i) => existingHeaders[i] !== header);
    if (needsHeaders) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  return sheet;
}

function findRowByValue_(sheet, column, value) {
  if (!value || sheet.getLastRow() < 2) return -1;
  const values = sheet.getRange(2, column, sheet.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(value)) return i + 2;
  }
  return -1;
}

function getFormResponseValues_(response) {
  const values = {};
  response.getItemResponses().forEach(itemResponse => {
    values[itemResponse.getItem().getTitle()] = itemResponse.getResponse();
  });
  return values;
}

function getFormResponseScore_(response) {
  try {
    const gradable = response.getGradableItemResponses();
    let hasScore = false;
    const total = gradable.reduce((sum, itemResponse) => {
      const rawScore = itemResponse.getScore();
      if (rawScore !== null && rawScore !== undefined && rawScore !== "") hasScore = true;
      return sum + (Number(rawScore) || 0);
    }, 0);
    if (hasScore) return total;
  } catch (err) {
    Logger.log(`Google quiz score was not available; calculating score from answer key. ${err.message}`);
  }

  return calculateMultipleChoiceScoreFromAnswerKey_(response);
}

function calculateMultipleChoiceScoreFromAnswerKey_(response) {
  let total = 0;
  let sawScoredItem = false;

  response.getItemResponses().forEach(itemResponse => {
    try {
      const item = itemResponse.getItem();
      if (item.getType() !== FormApp.ItemType.MULTIPLE_CHOICE) return;

      const multipleChoiceItem = item.asMultipleChoiceItem();
      const points = Number(multipleChoiceItem.getPoints()) || 0;
      if (!points) return;

      sawScoredItem = true;
      const selected = String(itemResponse.getResponse() || "");
      const correct = multipleChoiceItem.getChoices().some(choice => {
        return choice.isCorrectAnswer && choice.isCorrectAnswer() && String(choice.getValue()) === selected;
      });

      if (correct) total += points;
    } catch (err) {
      Logger.log(`Could not score item from answer key: ${err.message}`);
    }
  });

  return sawScoredItem ? total : "";
}

function normalizePeriodName_(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/[1-5]/);
  return match ? `Period ${match[0]}` : raw;
}

function parseWarmupTitle_(title) {
  const parsed = { week: "", date: "", day: "", topic: "" };
  const text = String(title || "").trim();

  // New format: "Friday 05-15-26"
  const simple = text.match(/^([A-Za-z]+)\s+(\d{2}-\d{2}-\d{2})$/);
  if (simple) {
    parsed.day = simple[1];
    parsed.date = simple[2];
    return parsed;
  }

  // Legacy format: "M6.W37.05-15.26 Friday Topic"
  const legacy = text.match(/M6\.W([^.]+)\.(\d{2}-\d{2})\.(\d{2})\s+(\w+)\s+(.+)$/);
  if (legacy) {
    parsed.week = `Week ${legacy[1]}`;
    parsed.date = `${legacy[2]}-${legacy[3]}`;
    parsed.day = legacy[4];
    parsed.topic = legacy[5];
  }
  return parsed;
}

// Week + topic now live in the form description ("Week 37 • Topic: ...").
function parseWarmupDescription_(description) {
  const text = String(description || "");
  const weekMatch = text.match(/Week\s+(\d+)/i);
  const topicMatch = text.match(/Topic:\s*([^\n]+)/i);
  return {
    week: weekMatch ? ("Week " + weekMatch[1]) : "",
    topic: topicMatch ? topicMatch[1].trim() : ""
  };
}
