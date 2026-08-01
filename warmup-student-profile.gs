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
  profile: "Profile"
};

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
    .addItem("Refresh site data", "refreshSiteData")
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

  // --- Contacts, filtered by email ----------------------------------------
  section("A15:B15", "CONTACTS");
  sheet.getRange("A16").setFormula(
    '=IF($B$4="","",IFERROR(FILTER({' + BDM_PROFILE_TABS.contacts + "!B:G},"
    + BDM_PROFILE_TABS.contacts + '!A:A=$B$4),"No contacts on file"))'
  );

  // --- Standardized testing, filtered by email -----------------------------
  section("A22:B22", "STANDARDIZED TESTING");
  sheet.getRange("A23").setFormula(
    '=IF($B$4="","",IFERROR(FILTER({' + BDM_PROFILE_TABS.testing + "!B:G},"
    + BDM_PROFILE_TABS.testing + '!A:A=$B$4),"No testing on file"))'
  );

  // --- Logs live in their own column blocks so they can grow freely --------
  section("F1:K1", "BEHAVIOR LOG");
  sheet.getRange("F2").setFormula(
    '=IF($B$4="","",IFERROR(FILTER({' + BDM_PROFILE_TABS.behavior + "!A:A,"
    + BDM_PROFILE_TABS.behavior + "!C:F},"
    + BDM_PROFILE_TABS.behavior + '!B:B=$B$4),"No entries"))'
  );

  section("M1:R1", "CONTACT LOG");
  sheet.getRange("M2").setFormula(
    '=IF($B$4="","",IFERROR(FILTER({' + BDM_PROFILE_TABS.contactLog + "!A:A,"
    + BDM_PROFILE_TABS.contactLog + "!C:F},"
    + BDM_PROFILE_TABS.contactLog + '!B:B=$B$4),"No entries"))'
  );

  sheet.setColumnWidth(1, 210);
  sheet.setColumnWidth(2, 260);
  sheet.setColumnWidth(5, 24);
  sheet.setColumnWidth(12, 24);
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
