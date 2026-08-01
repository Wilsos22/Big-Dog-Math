// =====================================================================
// BIG DOG MATH - TURN-IN ASSIGNMENTS -> CANVAS
//
// Creates a Canvas assignment for work students must turn in EVEN IF THEY
// WERE ABSENT. That is the only thing district policy requires in Canvas, and
// it is deliberately the only thing this posts.
//
// WHAT IS EXCLUDED, ON PURPOSE: warm-ups, tool work, exit tickets, learning
// checks, discussion - everything that only exists inside a live lesson. That
// work is formative, it cannot be made up by an absent student, and putting it
// in the gradebook would bury the grades that matter in noise. It stays in Big
// Dog Math where it belongs.
//
// A lesson is treated as HAVING a turn-in assignment when Notion gives it an
// Assignment Link or a "Due and Turn In" value. No assignment, no Canvas post.
//
// ZERO STUDENT DATA. It reads https://bigdogmath.com/api/today, the PUBLIC
// student-facing lesson payload - no roster, names, aliases, or evidence. The
// only thing crossing to Canvas is the assignment description you authored in
// Notion. Grades are a separate concern (see the note at the bottom).
//
// SETUP (Script Properties, Project Settings):
//   BDM_CANVAS_URL        e.g. https://yourdistrict.instructure.com  (required)
//   BDM_CANVAS_TOKEN      Canvas personal access token               (required)
//                         Canvas > Account > Settings > Approved Integrations
//                         > "+ New Access Token". It carries exactly your own
//                         permissions - it cannot reach anything you cannot.
//   BDM_CANVAS_COURSE_IDS comma-separated course ids, e.g. "418291,418292"
//   BDM_CANVAS_POINTS     optional, default 10
//   BDM_SITE_URL          optional, defaults to https://bigdogmath.com
//
// USE: run testCanvasConnection() once, then syncAssignmentToCanvas() - or put
// it on an early-morning time trigger. Re-running is safe: it matches the
// existing assignment by name and updates it instead of creating a duplicate.
// =====================================================================

function bdmCanvasConfig_() {
  const props = PropertiesService.getScriptProperties();
  const base = String(props.getProperty("BDM_CANVAS_URL") || "").trim().replace(/\/+$/, "");
  const token = String(props.getProperty("BDM_CANVAS_TOKEN") || "").trim();
  const courseIds = String(props.getProperty("BDM_CANVAS_COURSE_IDS") || "")
    .split(",").map(function (s) { return s.trim(); }).filter(Boolean);
  const points = Number(props.getProperty("BDM_CANVAS_POINTS") || 10);
  if (!base) throw new Error("BDM_CANVAS_URL is not set in Script Properties.");
  if (!token) throw new Error("BDM_CANVAS_TOKEN is not set in Script Properties.");
  if (!courseIds.length) throw new Error("BDM_CANVAS_COURSE_IDS is not set in Script Properties.");
  return {
    base: base,
    token: token,
    courseIds: courseIds,
    points: isFinite(points) && points > 0 ? points : 10
  };
}

function bdmCanvasFetch_(config, path, options) {
  const merged = options || {};
  merged.muteHttpExceptions = true;
  merged.headers = { Authorization: "Bearer " + config.token };
  if (merged.payload) merged.contentType = "application/json";
  return UrlFetchApp.fetch(config.base + path, merged);
}

function bdmEscapeHtml_(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function bdmHtmlList_(value) {
  const lines = String(value || "").split(/\r?\n/)
    .map(function (l) { return l.trim(); })
    .filter(Boolean);
  if (!lines.length) return "";
  return "<ul>" + lines.map(function (l) {
    return "<li>" + bdmEscapeHtml_(l) + "</li>";
  }).join("") + "</ul>";
}

// The description has to stand on its own for the student who was not there.
// That is the whole point of this assignment existing in Canvas.
function bdmAssignmentDescription_(lesson, siteUrl) {
  const parts = [];
  if (lesson.dueAndTurnIn) {
    parts.push("<p><strong>" + bdmEscapeHtml_(lesson.dueAndTurnIn) + "</strong></p>");
  }
  if (lesson.requiredPaperWork) {
    parts.push("<h3>What to do</h3>" + bdmHtmlList_(lesson.requiredPaperWork));
  }
  if (lesson.learningIntention) {
    parts.push("<h3>What this is practicing</h3><p>"
      + bdmEscapeHtml_(lesson.learningIntention) + "</p>");
  }

  const links = [];
  if (lesson.assignmentLink) {
    links.push('<li><a href="' + bdmEscapeHtml_(lesson.assignmentLink)
      + '">Open the assignment</a></li>');
  }
  links.push('<li><a href="' + siteUrl
    + '/homework-help">Stuck? Walk through it one step at a time</a></li>');
  parts.push("<h3>Links</h3><ul>" + links.join("") + "</ul>");

  if (lesson.standard) {
    parts.push("<p><em>Standard: " + bdmEscapeHtml_(lesson.standard) + "</em></p>");
  }
  parts.push("<p><em>Posted automatically from Big Dog Math. Edit the lesson in "
    + "Notion rather than here - this description is rewritten on each sync.</em></p>");
  return parts.filter(Boolean).join("\n");
}

// Canvas assignments have no stable slug the way pages do, so the sync matches
// on the exact name it would have created. That keeps re-runs idempotent
// without needing to store an id mapping anywhere.
function bdmFindAssignmentByName_(config, courseId, name) {
  const res = bdmCanvasFetch_(config, "/api/v1/courses/" + encodeURIComponent(courseId)
    + "/assignments?per_page=100&search_term=" + encodeURIComponent(name.slice(0, 60)), { method: "get" });
  if (res.getResponseCode() !== 200) return null;
  const list = JSON.parse(res.getContentText());
  for (let i = 0; i < list.length; i++) {
    if (String(list[i].name || "").trim() === name.trim()) return list[i];
  }
  return null;
}

function syncAssignmentToCanvas() {
  const config = bdmCanvasConfig_();
  const siteUrl = String(
    PropertiesService.getScriptProperties().getProperty("BDM_SITE_URL") || "https://bigdogmath.com"
  ).replace(/\/+$/, "");

  const res = UrlFetchApp.fetch(siteUrl + "/api/today", { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) {
    throw new Error("Could not read today's lesson (" + res.getResponseCode() + ").");
  }
  const payload = JSON.parse(res.getContentText());
  const lesson = payload.lesson;
  if (!lesson) {
    Logger.log("No lesson published for " + payload.date + ". Nothing posted.");
    return { posted: 0, reason: "no lesson published" };
  }

  // The gate: only work that must be turned in regardless of attendance.
  const hasTurnIn = Boolean(String(lesson.assignmentLink || "").trim())
    || Boolean(String(lesson.dueAndTurnIn || "").trim());
  if (!hasTurnIn) {
    Logger.log("Lesson " + (lesson.lessonCode || payload.date)
      + " has no assignment link or turn-in note - in-lesson work only. Nothing posted.");
    return { posted: 0, reason: "no turn-in assignment today" };
  }

  const name = (lesson.lessonCode ? lesson.lessonCode + " - " : "")
    + (lesson.title || "Assignment");
  const body = {
    assignment: {
      name: name,
      description: bdmAssignmentDescription_(lesson, siteUrl),
      points_possible: config.points,
      // on_paper keeps the gradebook column (so the grade reaches Infinite
      // Campus through passback) without asking students to upload anything.
      submission_types: ["on_paper"],
      published: true
    }
  };
  const due = String(lesson.dueDate || "").trim();
  if (due) body.assignment.due_at = due;

  let posted = 0;
  const failures = [];
  for (let i = 0; i < config.courseIds.length; i++) {
    const courseId = config.courseIds[i];
    const existing = bdmFindAssignmentByName_(config, courseId, name);
    const path = "/api/v1/courses/" + encodeURIComponent(courseId) + "/assignments"
      + (existing ? "/" + existing.id : "");
    const result = bdmCanvasFetch_(config, path, {
      method: existing ? "put" : "post",
      payload: JSON.stringify(body)
    });
    const code = result.getResponseCode();
    if (code >= 200 && code < 300) {
      posted++;
      Logger.log("Course " + courseId + ": " + (existing ? "updated" : "created") + " \"" + name + "\"");
    } else {
      failures.push(courseId + " (" + code + "): " + result.getContentText().slice(0, 200));
    }
  }

  if (failures.length) Logger.log("Failed: " + failures.join(" | "));
  Logger.log("syncAssignmentToCanvas: " + posted + "/" + config.courseIds.length + " course(s).");
  return { posted: posted, failures: failures };
}

// Read-only check. Run this once before trusting a trigger.
function testCanvasConnection() {
  const config = bdmCanvasConfig_();
  const self = bdmCanvasFetch_(config, "/api/v1/users/self", { method: "get" });
  if (self.getResponseCode() !== 200) {
    throw new Error("Canvas token rejected (" + self.getResponseCode() + "). Check BDM_CANVAS_TOKEN.");
  }
  Logger.log("Canvas token OK for: " + (JSON.parse(self.getContentText()).name || "unknown user"));
  for (let i = 0; i < config.courseIds.length; i++) {
    const id = config.courseIds[i];
    const course = bdmCanvasFetch_(config, "/api/v1/courses/" + encodeURIComponent(id), { method: "get" });
    Logger.log(course.getResponseCode() === 200
      ? "Course " + id + ": " + JSON.parse(course.getContentText()).name
      : "Course " + id + ": NOT REACHABLE (" + course.getResponseCode() + ")");
  }
}

// GRADES ARE NOT POSTED HERE, and that is deliberate. This script creates the
// gradebook column; scores are a separate step that must join alias -> email
// -> Canvas student, which only the roster spreadsheet can do. Keeping the two
// apart means a broken grade push can never damage the assignment students
// depend on for make-up work.
