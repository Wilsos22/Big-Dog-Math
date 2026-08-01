// =====================================================================
// BIG DOG MATH - STUDENT PROFILE WORKBOOK (district Google Workspace)
//
// One place to see everything about one student: contacts, standardized
// testing, Big Dog Math site data, behavior, and the contact log.
//
// WHY THIS LIVES IN WORKSPACE, NOT ON THE SITE
// The site is pseudonymous by design (aliases + one-way email hashes; see
// CLAUDE.md rule 8). Workspace is the only zone where an alias may legally
// become a name, so any named view of student data belongs here. This script
// pulls PSEUDONYMOUS rows from the site and joins them to names locally -
// no name, email, or contact detail is ever sent outward.
//
// WHAT THIS IS NOT
// It is not a replacement for Infinite Campus. IC stays the system of record
// for enrollment, attendance, and official grades. Duplicating it creates
// drift and a second sensitive file to protect. This workbook owns only what
// IC does not have - the site's mastery evidence, your behavior notes, and
// your contact log - and imports the rest.
//
// SENSITIVITY: with contacts and behavior filled in, this becomes the most
// sensitive file you own. Keep it in district Workspace, do not share it
// beyond people entitled to the whole picture, and do not download copies.
//
// INSTALL: paste into the roster spreadsheet's Apps Script project (the same
// one holding warmup-roster-push.gs, so Roster and AliasMap are siblings),
// then run setupProfileWorkbook() once.
// =====================================================================

var BDM_PROFILE_TABS = {
  roster: "Roster",
  contacts: "Contacts",
  testing: "Testing",
  site: "SiteData",
  behavior: "Behavior",
  contactLog: "ContactLog",
  grades: "Grades",
  profile: "Profile"
};

// Grades are a GRID, ONE TAB PER PERIOD ("Grades - Period 1"), because that is
// how a stack of paper actually gets graded - one class at a time, scores
// straight across, no filtering or hunting. Columns A and B fill themselves
// from the roster; assignment columns start at C and you add one by typing its
// name in row 1. The Profile tab reads a student's row back out of their own
// period tab, so a score typed once serves both the class view and the
// individual view.
var BDM_GRADES_FIXED = ["Name", "Email"];
var BDM_GRADES_FIRST_ASSIGNMENT_COL = 3; // column C

function bdmGradesTabName_(period) {
  return "Grades - " + String(period || "").trim();
}

// Every cell is either a number of points or one of these codes. They are
// deliberately single letters - fast to type with one hand while reading
// paper. bdmGradeCodeMeaning_ is the single place their meaning is defined.
var BDM_GRADE_CODES = {
  M: "Missing",
  I: "Incomplete",
  E: "Excused",
  X: "Academic integrity"
};

function bdmGradeCodeMeaning_(value) {
  const key = String(value || "").trim().toUpperCase();
  return BDM_GRADE_CODES[key] || "";
}

// Email is the join key across every tab: it is stable, unique, and already
// the anchor the AliasMap ledger uses. Never key these tabs on name (changes,
// duplicates) or row position (breaks on every roster re-paste).
var BDM_PROFILE_HEADERS = {
  contacts: ["Email", "Guardian", "Relationship", "Phone", "Guardian Email", "Preferred Language", "Notes"],
  testing: ["Email", "Assessment", "Window", "Domain", "Score", "Placement", "Date"],
  site: ["Alias", "Period", "Evidence", "Number and Operations", "Algebra and Algebraic Thinking",
         "Measurement and Data", "Geometry", "Updated"],
  behavior: ["Date", "Email", "Type", "What happened", "Action taken", "Followed up"],
  contactLog: ["Date", "Email", "Method", "Spoke with", "Summary", "Outcome"]
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Big Dog Math")
    .addItem("Set up profile workbook", "setupProfileWorkbook")
    .addItem("Refresh grade rosters", "refreshGradesRoster")
    .addItem("Refresh site data", "refreshSiteData")
    .addSeparator()
    // Grades go to Canvas ONLY on this click. Nothing auto-syncs: a typo would
    // otherwise travel to the gradebook and on to Infinite Campus before you
    // noticed it.
    .addItem("Sync grades to Canvas", "pushGradesToCanvas")
    .addItem("Post today's lesson to Canvas", "syncTodayToCanvas")
    .addSeparator()
    .addItem("Generate aliases", "generateAliases")
    .addItem("Push roster to site", "pushRosterToSite")
    .addToUi();
}

function bdmSheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (headers && sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Idempotent: safe to re-run after adding students or changing layout.
function setupProfileWorkbook() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(BDM_PROFILE_TABS.roster)) {
    throw new Error('No "Roster" tab found. Set up the roster first (warmup-roster-push.gs).');
  }
  bdmSheet_(BDM_PROFILE_TABS.contacts, BDM_PROFILE_HEADERS.contacts);
  bdmSheet_(BDM_PROFILE_TABS.testing, BDM_PROFILE_HEADERS.testing);
  bdmSheet_(BDM_PROFILE_TABS.site, BDM_PROFILE_HEADERS.site);
  bdmSheet_(BDM_PROFILE_TABS.behavior, BDM_PROFILE_HEADERS.behavior);
  bdmSheet_(BDM_PROFILE_TABS.contactLog, BDM_PROFILE_HEADERS.contactLog);
  refreshGradesRoster();
  bdmBuildProfileTab_();
  SpreadsheetApp.getUi().alert(
    "Profile workbook ready.\n\n" +
    "Open the Profile tab and pick a student from the dropdown in B2.\n\n" +
    "Fill Contacts and Testing from your Infinite Campus exports (keyed on Email).\n" +
    "Log behavior and calls on their own tabs - they surface on the profile automatically.\n" +
    "Run \"Refresh site data\" to pull mastery from the site."
  );
}

// The Profile tab is FORMULA-DRIVEN, not script-generated, so it stays live as
// you type into the log tabs without re-running anything.
//
// LAYOUT NOTE: the two logs use FILTER, which grows downward without limit, so
// they live in their own column blocks (F.. and M..). Stacking them vertically
// would make a long behavior log collide with the section beneath it.
function bdmBuildProfileTab_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(BDM_PROFILE_TABS.profile);
  if (!sheet) sheet = ss.insertSheet(BDM_PROFILE_TABS.profile, 0);
  sheet.clear();
  sheet.clearConditionalFormatRules();

  const R = BDM_PROFILE_TABS.roster;
  const label = function (range, text) {
    sheet.getRange(range).setValue(text).setFontWeight("bold");
  };
  const section = function (range, text) {
    sheet.getRange(range).setValue(text)
      .setFontWeight("bold").setFontSize(11)
      .setBackground("#f3ecdd").setFontColor("#201e1a");
  };

  sheet.getRange("A1").setValue("STUDENT PROFILE")
    .setFontWeight("bold").setFontSize(16).setFontColor("#2e4a54");

  label("A2", "Student");
  label("A3", "Period");
  label("A4", "Email");
  label("A5", "Alias (site)");

  // The dropdown lists every name on the Roster tab and updates as it changes.
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(ss.getSheetByName(R).getRange("A2:A"), true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange("B2").setDataValidation(rule).setBackground("#fff8e1")
    .setFontWeight("bold").setFontSize(12);

  const lookup = function (col) {
    return '=IF($B$2="","",IFERROR(INDEX(' + R + "!" + col + ":" + col
      + ",MATCH($B$2," + R + '!A:A,0)),"not on roster"))';
  };
  sheet.getRange("B3").setFormula(lookup("C"));
  sheet.getRange("B4").setFormula(lookup("B"));
  sheet.getRange("B5").setFormula(lookup("D"));

  // --- Big Dog Math site data, joined on ALIAS (the site knows no names) ----
  section("A7:B7", "BIG DOG MATH");
  const siteRow = ['Evidence pieces', 'Number and Operations', 'Algebra and Algebraic Thinking',
    'Measurement and Data', 'Geometry', 'Updated'];
  const siteCols = ["C", "D", "E", "F", "G", "H"];
  for (let i = 0; i < siteRow.length; i++) {
    sheet.getRange(8 + i, 1).setValue(siteRow[i]);
    sheet.getRange(8 + i, 2).setFormula(
      '=IF($B$5="","",IFERROR(INDEX(' + BDM_PROFILE_TABS.site + "!" + siteCols[i] + ":" + siteCols[i]
      + ",MATCH($B$5," + BDM_PROFILE_TABS.site + '!A:A,0)),"no data yet"))'
    );
  }

  // EVERY SECTION BELOW USES FILTER, WHICH GROWS DOWNWARD WITHOUT LIMIT, so
  // each one gets its OWN COLUMN BLOCK. Stacked vertically, a student with
  // four contacts would collide with the section beneath and Sheets would
  // refuse to expand the array - a #REF! where a parent's phone number should
  // be. Horizontal scrolling is the cheaper cost.

  // --- Grades, read from that student's own period tab --------------------
  // INDIRECT resolves "Grades - " + the period in B3, so one formula serves
  // every period without duplicating the block per class.
  const gradeTab = '"\'' + "Grades - " + '"&$B$3&"\'!"';
  const headerRange = "INDIRECT(" + gradeTab + '&"C1:AZ1")';
  const scoreRow = "INDEX(INDIRECT(" + gradeTab + '&"C:AZ"),MATCH($B$4,INDIRECT('
    + gradeTab + '&"B:B"),0))';
  section("D1:E1", "GRADES");
  // FILTER rather than QUERY on purpose: a score column holds numbers AND the
  // letter codes, and QUERY coerces a mixed column to one type, silently
  // blanking every value that does not match. FILTER preserves both.
  sheet.getRange("D2").setFormula(
    '=IF($B$4="","",IFERROR(FILTER(TRANSPOSE({' + headerRange + ";" + scoreRow + "}),TRANSPOSE("
    + headerRange + ')<>""),"No grades yet"))'
  );

  section("G1:L1", "CONTACTS");
  sheet.getRange("G2").setFormula(
    '=IF($B$4="","",IFERROR(FILTER({' + BDM_PROFILE_TABS.contacts + "!B:G},"
    + BDM_PROFILE_TABS.contacts + '!A:A=$B$4),"No contacts on file"))'
  );

  section("N1:S1", "STANDARDIZED TESTING");
  sheet.getRange("N2").setFormula(
    '=IF($B$4="","",IFERROR(FILTER({' + BDM_PROFILE_TABS.testing + "!B:G},"
    + BDM_PROFILE_TABS.testing + '!A:A=$B$4),"No testing on file"))'
  );

  section("U1:Z1", "BEHAVIOR LOG");
  sheet.getRange("U2").setFormula(
    '=IF($B$4="","",IFERROR(FILTER({' + BDM_PROFILE_TABS.behavior + "!A:A,"
    + BDM_PROFILE_TABS.behavior + "!C:F},"
    + BDM_PROFILE_TABS.behavior + '!B:B=$B$4),"No entries"))'
  );

  section("AB1:AG1", "CONTACT LOG");
  sheet.getRange("AB2").setFormula(
    '=IF($B$4="","",IFERROR(FILTER({' + BDM_PROFILE_TABS.contactLog + "!A:A,"
    + BDM_PROFILE_TABS.contactLog + "!C:F},"
    + BDM_PROFILE_TABS.contactLog + '!B:B=$B$4),"No entries"))'
  );

  sheet.setColumnWidth(1, 210);
  sheet.setColumnWidth(2, 260);
  sheet.setColumnWidth(3, 24);
  sheet.setColumnWidth(6, 24);
  sheet.setColumnWidth(13, 24);
  sheet.setColumnWidth(20, 24);
  sheet.setColumnWidth(27, 24);
  sheet.setFrozenRows(1);

  // A weak mastery bar should be visible without reading the number.
  const bars = sheet.getRange("B9:B12");
  const rules = [
    SpreadsheetApp.newConditionalFormatRule().whenNumberLessThan(50)
      .setBackground("#fdeeee").setFontColor("#9a3412").setRanges([bars]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenNumberBetween(50, 74)
      .setBackground("#fff7e6").setFontColor("#8a5a0b").setRanges([bars]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThan(74)
      .setBackground("#e9f7ef").setFontColor("#1e6b41").setRanges([bars]).build()
  ];
  sheet.setConditionalFormatRules(rules);
}

// Build or refresh one grade grid per period. Existing scores are preserved:
// rows are re-matched by EMAIL, so a student who changes period keeps their
// history, a new student appears with empty cells, and a departed student's
// row is dropped from the grid without touching anyone else's work.
function refreshGradesRoster() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const roster = ss.getSheetByName(BDM_PROFILE_TABS.roster);
  if (!roster) throw new Error('No "Roster" tab found.');
  const values = roster.getDataRange().getValues();
  if (values.length < 2) throw new Error("The Roster tab has no students yet.");

  const header = values[0].map(function (c) {
    return String(c || "").trim().toLowerCase().replace(/[^a-z]/g, "");
  });
  const find = function (names) {
    for (let i = 0; i < header.length; i++) if (names.indexOf(header[i]) !== -1) return i;
    return -1;
  };
  const nameCol = find(["name", "student", "studentname", "fullname"]);
  const emailCol = find(["email", "studentemail", "emailaddress"]);
  const periodCol = find(["period", "class", "classperiod"]);
  if (nameCol === -1 || emailCol === -1 || periodCol === -1) {
    throw new Error("The Roster tab needs Name, Email, and Period columns.");
  }

  const byPeriod = {};
  for (let r = 1; r < values.length; r++) {
    const name = String(values[r][nameCol] || "").trim();
    const email = String(values[r][emailCol] || "").trim().toLowerCase();
    const period = String(values[r][periodCol] || "").trim();
    if (!name || !email || !period) continue;
    if (!byPeriod[period]) byPeriod[period] = [];
    byPeriod[period].push({ name: name, email: email });
  }

  const periods = Object.keys(byPeriod).sort();
  for (let p = 0; p < periods.length; p++) {
    const period = periods[p];
    const students = byPeriod[period].sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });
    const tabName = bdmGradesTabName_(period);
    let sheet = ss.getSheetByName(tabName);
    if (!sheet) {
      sheet = ss.insertSheet(tabName);
      sheet.getRange(1, 1, 1, BDM_GRADES_FIXED.length).setValues([BDM_GRADES_FIXED])
        .setFontWeight("bold");
      sheet.setFrozenRows(1);
      sheet.setFrozenColumns(2);
      sheet.setColumnWidth(1, 180);
      sheet.setColumnWidth(2, 220);
    }

    // Preserve whatever has already been entered, keyed on email.
    const existing = sheet.getDataRange().getValues();
    const width = Math.max(existing.length ? existing[0].length : 0, BDM_GRADES_FIXED.length);
    const scoresByEmail = {};
    for (let r = 1; r < existing.length; r++) {
      const email = String(existing[r][1] || "").trim().toLowerCase();
      if (email) scoresByEmail[email] = existing[r].slice(BDM_GRADES_FIRST_ASSIGNMENT_COL - 1);
    }

    const rows = students.map(function (student) {
      const kept = scoresByEmail[student.email] || [];
      const row = [student.name, student.email];
      for (let c = BDM_GRADES_FIRST_ASSIGNMENT_COL - 1; c < width; c++) {
        row.push(kept[c - (BDM_GRADES_FIRST_ASSIGNMENT_COL - 1)] === undefined
          ? "" : kept[c - (BDM_GRADES_FIRST_ASSIGNMENT_COL - 1)]);
      }
      return row;
    });

    if (sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, width).clearContent();
    }
    if (rows.length) sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }

  Logger.log("refreshGradesRoster: " + periods.length + " period tab(s) refreshed.");
  return periods;
}

// Pull pseudonymous mastery from the site and write it to SiteData, keyed by
// alias. The Profile tab joins it to a name locally. Uses the same Bearer
// CRON_SECRET the roster push uses, so no new credential is involved.
function refreshSiteData() {
  const props = PropertiesService.getScriptProperties();
  const cronSecret = props.getProperty("BDM_CRON_SECRET");
  if (!cronSecret) throw new Error("BDM_CRON_SECRET is not set in Script Properties.");
  const base = props.getProperty("BDM_SITE_URL") || "https://bigdogmath.com";
  const options = {
    method: "get",
    muteHttpExceptions: true,
    headers: { Authorization: "Bearer " + cronSecret }
  };

  const rosterRes = UrlFetchApp.fetch(base + "/api/teacher/roster", options);
  if (rosterRes.getResponseCode() !== 200) {
    throw new Error("Roster read failed (" + rosterRes.getResponseCode() + "): "
      + rosterRes.getContentText().slice(0, 200));
  }
  const roster = JSON.parse(rosterRes.getContentText());
  const periodName = {};
  (roster.periods || []).forEach(function (p) { periodName[p.id] = p.name; });

  const rows = [];
  const periodIds = Object.keys(periodName);
  for (let i = 0; i < periodIds.length; i++) {
    const pid = periodIds[i];
    const res = UrlFetchApp.fetch(base + "/api/mastery?periodId=" + encodeURIComponent(pid), options);
    if (res.getResponseCode() !== 200) {
      Logger.log("Skipped " + periodName[pid] + " (" + res.getResponseCode() + ")");
      continue;
    }
    const data = JSON.parse(res.getContentText());
    (data.students || []).forEach(function (s) {
      const byDomain = {};
      (s.mastery || []).forEach(function (m) { byDomain[m.domain] = Math.round(Number(m.percent)); });
      rows.push([
        s.name,
        periodName[pid],
        s.evidence || 0,
        byDomain["Number and Operations"] === undefined ? "" : byDomain["Number and Operations"],
        byDomain["Algebra and Algebraic Thinking"] === undefined ? "" : byDomain["Algebra and Algebraic Thinking"],
        byDomain["Measurement and Data"] === undefined ? "" : byDomain["Measurement and Data"],
        byDomain["Geometry"] === undefined ? "" : byDomain["Geometry"],
        new Date()
      ]);
    });
  }

  const sheet = bdmSheet_(BDM_PROFILE_TABS.site, BDM_PROFILE_HEADERS.site);
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, BDM_PROFILE_HEADERS.site.length).clearContent();
  }
  if (rows.length) sheet.getRange(2, 1, rows.length, BDM_PROFILE_HEADERS.site.length).setValues(rows);
  Logger.log("refreshSiteData: wrote " + rows.length + " student rows.");
}
