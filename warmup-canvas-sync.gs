// =====================================================================
// BIG DOG MATH - NOTION LESSONS -> CANVAS
//
// TWO SEPARATE THINGS, and the distinction is the whole design:
//
//   syncAssignmentToCanvas()  -> a GRADED Canvas assignment, created only for
//                                work students must turn in EVEN IF THEY WERE
//                                ABSENT. This is the district requirement, and
//                                its grade reaches Infinite Campus by passback.
//
//   syncLessonPageToCanvas()  -> an UNGRADED Canvas page holding the day's
//                                lesson information, so the course is visible
//                                in Canvas to students and parents. No
//                                gradebook column, nothing to turn in.
//
//   syncTodayToCanvas()       -> runs both. Put this one on the trigger.
//
// GRADEBOOK SCOPE IS A POLICY RULE, NOT PLUMBING: warm-ups, tool work, exit
// tickets, learning checks and discussion are formative, cannot be made up by
// an absent student, and MUST NOT become Canvas assignments - they would bury
// the grades that matter. They may still be DESCRIBED on the lesson page,
// which is information rather than a grade.
//
// A lesson is treated as HAVING a turn-in assignment when Notion gives it an
// Assignment Link or a "Due and Turn In" value. No assignment, no graded post.
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
// USE: run testCanvasConnection() once, then syncTodayToCanvas() - or put that
// on an early-morning time trigger. Re-running is safe: the assignment is
// matched by name and the page by a stable per-lesson slug, so both update in
// place instead of creating duplicates.
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

function bdmSiteUrl_() {
  return String(
    PropertiesService.getScriptProperties().getProperty("BDM_SITE_URL") || "https://bigdogmath.com"
  ).replace(/\/+$/, "");
}

// /api/today is PUBLIC and carries no student data - the same payload a
// student's browser gets. No key is needed or wanted here.
function bdmFetchTodayLesson_(siteUrl) {
  const res = UrlFetchApp.fetch(siteUrl + "/api/today", { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) {
    throw new Error("Could not read today's lesson (" + res.getResponseCode() + ").");
  }
  return JSON.parse(res.getContentText());
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
  const siteUrl = bdmSiteUrl_();
  const payload = bdmFetchTodayLesson_(siteUrl);
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

function bdmSection_(heading, html) {
  if (!html) return "";
  return "<h3>" + bdmEscapeHtml_(heading) + "</h3>" + html;
}

function bdmParagraph_(value) {
  const text = String(value || "").trim();
  return text ? "<p>" + bdmEscapeHtml_(text) + "</p>" : "";
}

// The lesson page is INFORMATION, not a grade: what we did, what we were
// learning, what you needed, and where to go if you missed it. Anything Notion
// left blank is omitted - an empty heading reads as a mistake to a parent.
function bdmLessonPageBody_(lesson, siteUrl) {
  const parts = [];
  if (lesson.learningIntention) {
    parts.push(bdmSection_("Today we are learning", bdmParagraph_(lesson.learningIntention)));
  }
  if (lesson.selectedSuccessCriterion) {
    parts.push(bdmSection_("You've got it when", bdmParagraph_(lesson.selectedSuccessCriterion)));
  }
  if (lesson.essentialIdeas) {
    parts.push(bdmSection_("The big idea", bdmParagraph_(lesson.essentialIdeas)));
  }
  if (lesson.agenda) parts.push(bdmSection_("Plan for the day", bdmHtmlList_(lesson.agenda)));
  if (lesson.supplies) parts.push(bdmSection_("What you need", bdmHtmlList_(lesson.supplies)));
  if (lesson.requiredPaperWork) {
    parts.push(bdmSection_("Work from this lesson", bdmHtmlList_(lesson.requiredPaperWork)));
  }

  const links = [];
  links.push('<li><a href="' + siteUrl + '/lesson">The lesson page on Big Dog Math</a></li>');
  links.push('<li><a href="' + siteUrl
    + '/homework-help">Stuck? Walk through it one step at a time</a></li>');
  if (lesson.assignmentLink) {
    links.push('<li><a href="' + bdmEscapeHtml_(lesson.assignmentLink) + '">Assignment</a></li>');
  }
  parts.push(bdmSection_("Links", "<ul>" + links.join("") + "</ul>"));

  if (lesson.standard) {
    parts.push("<p><em>Standard: " + bdmEscapeHtml_(lesson.standard) + "</em></p>");
  }
  parts.push("<p><em>Posted automatically from Big Dog Math. Edit the lesson in "
    + "Notion rather than here - this page is rewritten on each sync.</em></p>");
  return parts.filter(Boolean).join("\n");
}

// A stable slug per lesson makes the page sync idempotent: the same lesson
// always targets the same Canvas page, so re-running updates rather than
// piling up near-duplicates across a semester.
function bdmCanvasPageSlug_(lesson) {
  const base = String(lesson.lessonCode || "").trim() || String(lesson.date || "").trim() || "lesson";
  return ("bdm-" + base).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// Parse at NOON so a timezone offset can never roll the date to the day
// before, which would file a Monday lesson under the previous week.
function bdmParseIsoDate_(value) {
  const m = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0) : null;
}

function bdmMondayOf_(date) {
  const d = new Date(date.getTime());
  const day = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d;
}

// Canvas MODULES are weeks here. Note the name collision to watch for: the
// lesson payload's own `module` field is the CURRICULUM module (M1, M2) and
// has nothing to do with this.
//
// Week numbering needs BDM_SCHOOL_YEAR_START (e.g. "2026-08-10"). Without it
// the module is still created, just labelled by date instead of number - a
// missing property should not stop the day from posting.
function bdmWeekInfo_(lessonDate) {
  const date = bdmParseIsoDate_(lessonDate);
  if (!date) return null;
  const monday = bdmMondayOf_(date);
  const friday = new Date(monday.getTime());
  friday.setDate(friday.getDate() + 4);

  const start = bdmParseIsoDate_(
    PropertiesService.getScriptProperties().getProperty("BDM_SCHOOL_YEAR_START")
  );
  let number = null;
  if (start) {
    const weeks = Math.round((monday.getTime() - bdmMondayOf_(start).getTime()) / 604800000);
    if (weeks >= 0) number = weeks + 1;
  }

  const tz = Session.getScriptTimeZone();
  const span = Utilities.formatDate(monday, tz, "MMM d") + " - "
    + Utilities.formatDate(friday, tz, "MMM d");
  return {
    number: number,
    label: (number ? "Week " + number + ": " : "Week of ") + span,
    position: number || null
  };
}

function bdmFindOrCreateModule_(config, courseId, week) {
  const list = bdmCanvasFetch_(config,
    "/api/v1/courses/" + encodeURIComponent(courseId) + "/modules?per_page=100", { method: "get" });
  if (list.getResponseCode() === 200) {
    const modules = JSON.parse(list.getContentText());
    for (let i = 0; i < modules.length; i++) {
      if (String(modules[i].name || "").trim() === week.label.trim()) return modules[i];
    }
  }
  const payload = { module: { name: week.label, published: true } };
  if (week.position) payload.module.position = week.position;
  const created = bdmCanvasFetch_(config,
    "/api/v1/courses/" + encodeURIComponent(courseId) + "/modules",
    { method: "post", payload: JSON.stringify(payload) });
  const code = created.getResponseCode();
  if (code < 200 || code >= 300) {
    Logger.log("Module create failed on course " + courseId + " (" + code + "): "
      + created.getContentText().slice(0, 160));
    return null;
  }
  const made = JSON.parse(created.getContentText());
  // Some Canvas versions ignore published on create, so publish explicitly.
  bdmCanvasFetch_(config, "/api/v1/courses/" + encodeURIComponent(courseId)
    + "/modules/" + made.id, { method: "put", payload: JSON.stringify({ module: { published: true } }) });
  return made;
}

// Idempotent by page_url: the day is added to its week once, and re-running
// the sync never stacks duplicate items under the module.
function bdmEnsureModuleItem_(config, courseId, moduleId, pageSlug, title) {
  const list = bdmCanvasFetch_(config, "/api/v1/courses/" + encodeURIComponent(courseId)
    + "/modules/" + moduleId + "/items?per_page=100", { method: "get" });
  if (list.getResponseCode() === 200) {
    const items = JSON.parse(list.getContentText());
    for (let i = 0; i < items.length; i++) {
      if (String(items[i].page_url || "") === pageSlug) return items[i];
    }
  }
  const res = bdmCanvasFetch_(config, "/api/v1/courses/" + encodeURIComponent(courseId)
    + "/modules/" + moduleId + "/items", {
    method: "post",
    payload: JSON.stringify({
      module_item: { title: title, type: "Page", page_url: pageSlug, published: true }
    })
  });
  const code = res.getResponseCode();
  if (code < 200 || code >= 300) {
    Logger.log("Module item failed on course " + courseId + " (" + code + "): "
      + res.getContentText().slice(0, 160));
    return null;
  }
  return JSON.parse(res.getContentText());
}

// Posts the day's lesson as an UNGRADED Canvas page. Runs whether or not there
// is a turn-in assignment - every teaching day should be visible in Canvas.
function syncLessonPageToCanvas() {
  const config = bdmCanvasConfig_();
  const siteUrl = bdmSiteUrl_();
  const payload = bdmFetchTodayLesson_(siteUrl);
  const lesson = payload.lesson;
  if (!lesson) {
    Logger.log("No lesson published for " + payload.date + ". No page posted.");
    return { posted: 0, reason: "no lesson published" };
  }

  const title = (lesson.lessonCode ? lesson.lessonCode + " - " : "")
    + (lesson.title || "Lesson");
  const slug = bdmCanvasPageSlug_(lesson);
  const body = bdmLessonPageBody_(lesson, siteUrl);

  const week = bdmWeekInfo_(lesson.date);

  let posted = 0;
  const failures = [];
  for (let i = 0; i < config.courseIds.length; i++) {
    const courseId = config.courseIds[i];
    // PUT to a page url creates it when absent and updates it when present,
    // which is what makes a re-run safe.
    const result = bdmCanvasFetch_(config, "/api/v1/courses/" + encodeURIComponent(courseId)
      + "/pages/" + encodeURIComponent(slug), {
      method: "put",
      payload: JSON.stringify({ wiki_page: { title: title, body: body, published: true } })
    });
    const code = result.getResponseCode();
    if (code < 200 || code >= 300) {
      failures.push(courseId + " (" + code + "): " + result.getContentText().slice(0, 200));
      continue;
    }
    posted++;

    // File the day under its week module. A module failure must not undo the
    // page - the page is the thing students actually need.
    if (week) {
      const module = bdmFindOrCreateModule_(config, courseId, week);
      if (module) bdmEnsureModuleItem_(config, courseId, module.id, slug, title);
    }
    Logger.log("Course " + courseId + ": page \"" + title + "\""
      + (week ? " filed under " + week.label : ""));
  }
  if (failures.length) Logger.log("Page failures: " + failures.join(" | "));
  Logger.log("syncLessonPageToCanvas: " + posted + "/" + config.courseIds.length + " course(s).");
  return { posted: posted, failures: failures };
}

// The one to put on a morning trigger: lesson page always, graded assignment
// only when today's lesson actually has turn-in work.
function syncTodayToCanvas() {
  const page = syncLessonPageToCanvas();
  const assignment = syncAssignmentToCanvas();
  return { page: page, assignment: assignment };
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

// =====================================================================
// GRADES: spreadsheet grid -> Canvas gradebook -> Infinite Campus
//
// Runs ONLY when you pick "Sync grades to Canvas" from the menu. Nothing about
// grades is automatic or triggered: a typo in a score would otherwise reach
// the Canvas gradebook and pass on to Infinite Campus before you noticed it.
//
// Reads every "Grades - <period>" tab. Column A is name, B is email, and each
// column from C onward is an assignment whose header must match the Canvas
// assignment name exactly. A cell is either a number of points or one of four
// codes. HOW EACH CODE REACHES CANVAS - change these if your grading policy
// differs, they are judgement calls, not facts:
//
//   M  Missing              -> flagged missing in Canvas, scored 0
//   I  Incomplete           -> left UNGRADED (no score posted), flagged missing
//                              so it shows in your to-do rather than counting
//                              as a zero against the student
//   E  Excused              -> Canvas "EX" - excluded from the average entirely
//   X  Academic integrity   -> scored 0, and NOT flagged missing (the work was
//                              turned in; the issue is not absence)
//
// Students are matched to Canvas by EMAIL, across every course in
// BDM_CANVAS_COURSE_IDS, so no period-to-course mapping is needed - whichever
// course a student is enrolled in is the one that receives their score.
// =====================================================================

function bdmCanvasStudentIndex_(config) {
  const index = {};
  for (let i = 0; i < config.courseIds.length; i++) {
    const courseId = config.courseIds[i];
    let page = 1;
    while (page <= 10) {
      const res = bdmCanvasFetch_(config, "/api/v1/courses/" + encodeURIComponent(courseId)
        + "/users?enrollment_type[]=student&include[]=email&per_page=100&page=" + page, { method: "get" });
      if (res.getResponseCode() !== 200) break;
      const users = JSON.parse(res.getContentText());
      if (!users.length) break;
      for (let u = 0; u < users.length; u++) {
        const email = String(users[u].email || users[u].login_id || "").trim().toLowerCase();
        if (email && !index[email]) index[email] = { courseId: courseId, userId: users[u].id };
      }
      if (users.length < 100) break;
      page++;
    }
  }
  return index;
}

function bdmFindCanvasAssignments_(config, courseId) {
  const byName = {};
  let page = 1;
  while (page <= 10) {
    const res = bdmCanvasFetch_(config, "/api/v1/courses/" + encodeURIComponent(courseId)
      + "/assignments?per_page=100&page=" + page, { method: "get" });
    if (res.getResponseCode() !== 200) break;
    const list = JSON.parse(res.getContentText());
    if (!list.length) break;
    for (let i = 0; i < list.length; i++) {
      byName[String(list[i].name || "").trim()] = list[i].id;
    }
    if (list.length < 100) break;
    page++;
  }
  return byName;
}

// Returns null when the cell should not be posted at all (blank, or a code
// meaning "no score yet"). Anything unrecognised is reported, never guessed.
function bdmGradePayloadFor_(raw) {
  const value = String(raw == null ? "" : raw).trim();
  if (!value) return null;

  const code = value.toUpperCase();
  if (code === "E") return { posted_grade: "EX" };
  if (code === "M") return { posted_grade: "0", late_policy_status: "missing" };
  if (code === "I") return { late_policy_status: "missing" };
  if (code === "X") return { posted_grade: "0", late_policy_status: "none" };

  const number = Number(value);
  if (isFinite(number) && number >= 0) return { posted_grade: String(number) };
  return { invalid: true };
}

function pushGradesToCanvas() {
  const config = bdmCanvasConfig_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets().filter(function (s) {
    return s.getName().indexOf("Grades - ") === 0;
  });
  if (!sheets.length) throw new Error('No "Grades - <period>" tabs found. Run "Refresh grade rosters" first.');

  const students = bdmCanvasStudentIndex_(config);
  const assignmentsByCourse = {};
  const problems = [];
  let posted = 0;
  let unmatchedStudents = 0;

  for (let s = 0; s < sheets.length; s++) {
    const sheet = sheets[s];
    const values = sheet.getDataRange().getValues();
    if (values.length < 2) continue;
    const header = values[0];

    for (let c = BDM_GRADES_FIRST_ASSIGNMENT_COL - 1; c < header.length; c++) {
      const assignmentName = String(header[c] || "").trim();
      if (!assignmentName) continue;

      // grade_data is built per course, since a Canvas assignment id only
      // exists within its own course.
      const perCourse = {};
      for (let r = 1; r < values.length; r++) {
        const email = String(values[r][1] || "").trim().toLowerCase();
        if (!email) continue;
        const payload = bdmGradePayloadFor_(values[r][c]);
        if (!payload) continue;
        if (payload.invalid) {
          problems.push(sheet.getName() + " " + assignmentName + ": \"" + values[r][c]
            + "\" for " + values[r][0] + " is not a number or M/I/E/X");
          continue;
        }
        const canvas = students[email];
        if (!canvas) { unmatchedStudents++; continue; }
        if (!perCourse[canvas.courseId]) perCourse[canvas.courseId] = {};
        perCourse[canvas.courseId][canvas.userId] = payload;
      }

      const courseIds = Object.keys(perCourse);
      for (let i = 0; i < courseIds.length; i++) {
        const courseId = courseIds[i];
        if (!assignmentsByCourse[courseId]) {
          assignmentsByCourse[courseId] = bdmFindCanvasAssignments_(config, courseId);
        }
        const assignmentId = assignmentsByCourse[courseId][assignmentName];
        if (!assignmentId) {
          problems.push("Course " + courseId + ": no Canvas assignment named \""
            + assignmentName + "\"");
          continue;
        }
        const res = bdmCanvasFetch_(config, "/api/v1/courses/" + encodeURIComponent(courseId)
          + "/assignments/" + assignmentId + "/submissions/update_grades", {
          method: "post",
          payload: JSON.stringify({ grade_data: perCourse[courseId] })
        });
        const code = res.getResponseCode();
        if (code >= 200 && code < 300) {
          posted += Object.keys(perCourse[courseId]).length;
        } else {
          problems.push("Course " + courseId + " / " + assignmentName + " (" + code + "): "
            + res.getContentText().slice(0, 160));
        }
      }
    }
  }

  const summary = "Synced " + posted + " score(s) to Canvas."
    + (unmatchedStudents ? "\n\n" + unmatchedStudents
      + " score(s) skipped - those students were not found in any Canvas course." : "")
    + (problems.length ? "\n\nProblems:\n" + problems.slice(0, 12).join("\n") : "");
  Logger.log(summary);
  try { SpreadsheetApp.getUi().alert(summary); } catch (err) { /* no UI when triggered */ }
  return { posted: posted, problems: problems };
}
