// =====================================================================
// BIG DOG MATH - PARENT CONTACT (drafts, missing work, Gmail scan)
//
// Three things, all inside district Workspace, all keyed on the Contacts tab:
//
//   draftMissingAssignmentEmails()  Scans every "Grades - <period>" tab for M
//                                   codes, groups them by student, and writes
//                                   ONE draft per family listing everything
//                                   that student is missing.
//   draftParentEmailForStudent()    Ad hoc: drafts a note about whoever is
//                                   selected in the Profile tab.
//   scanGmailForParentContacts()    Finds recent mail to/from guardian
//                                   addresses and logs it to ContactLog, so
//                                   "when did I last hear from this family"
//                                   answers itself on the student profile.
//
// EVERYTHING CREATES DRAFTS, NEVER SENDS. One wrong grade or a bad merge field
// reaching twenty families unreviewed is a bad afternoon, and a draft costs a
// glance. If you want direct send later that is a deliberate change, not a
// default. (See BDM_PARENT_SEND_DIRECTLY below.)
//
// THE SCAN STORES METADATA AND A LINK, NEVER MESSAGE BODIES. Parent mail
// carries custody, health, and complaints about other children. Copying that
// text into this workbook would duplicate the most sensitive writing in your
// job out of Gmail - where retention and access controls already exist - into
// a spreadsheet. A subject line plus a permalink answers the same question and
// leaves the content one click away, where it belongs.
//
// Wording lives in the "Templates" tab, not in this file, so you can rewrite
// the tone without touching code. It is your voice going to families.
// =====================================================================

// Flip to true ONLY if you want mail to leave immediately. Drafts are the
// default on purpose - see the header.
var BDM_PARENT_SEND_DIRECTLY = false;

var BDM_TEMPLATES_TAB = "Templates";
var BDM_TEMPLATE_HEADERS = ["Key", "Subject", "Body"];

// {{placeholders}} available in both subject and body.
var BDM_TEMPLATE_SEED = [
  [
    "missing-work",
    "{{student_first}} - missing math work",
    "Hello {{guardian}},\n\n"
      + "I wanted to let you know that {{student_first}} currently has work "
      + "missing in math ({{period}}):\n\n{{missing_list}}\n\n"
      + "Anything on that list can still be turned in. If {{student_first}} is "
      + "stuck, there is a step-by-step walkthrough at "
      + "https://bigdogmath.com/homework-help that works from home.\n\n"
      + "Please let me know if there is anything I can do to help.\n\n{{teacher}}"
  ],
  [
    "general",
    "{{student_first}} - math",
    "Hello {{guardian}},\n\nI wanted to reach out about {{student_first}} in "
      + "math ({{period}}).\n\n\n\n{{teacher}}"
  ]
];

function bdmTemplatesSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(BDM_TEMPLATES_TAB);
  if (!sheet) {
    sheet = ss.insertSheet(BDM_TEMPLATES_TAB);
    sheet.getRange(1, 1, 1, BDM_TEMPLATE_HEADERS.length).setValues([BDM_TEMPLATE_HEADERS])
      .setFontWeight("bold");
    sheet.setFrozenRows(1);
    sheet.getRange(2, 1, BDM_TEMPLATE_SEED.length, 3).setValues(BDM_TEMPLATE_SEED);
    sheet.setColumnWidth(1, 130);
    sheet.setColumnWidth(2, 280);
    sheet.setColumnWidth(3, 620);
    sheet.getRange(2, 3, BDM_TEMPLATE_SEED.length, 1).setWrap(true);
  }
  return sheet;
}

function bdmTemplate_(key) {
  const values = bdmTemplatesSheet_().getDataRange().getValues();
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][0] || "").trim() === key) {
      return { subject: String(values[r][1] || ""), body: String(values[r][2] || "") };
    }
  }
  throw new Error('No template with key "' + key + '" on the Templates tab.');
}

function bdmFill_(text, values) {
  return String(text || "").replace(/\{\{(\w+)\}\}/g, function (match, key) {
    return values[key] === undefined ? match : String(values[key]);
  });
}

function bdmFirstName_(name) {
  const trimmed = String(name || "").trim();
  const comma = trimmed.indexOf(",");
  if (comma > 0) return trimmed.slice(comma + 1).trim().split(/\s+/)[0] || trimmed;
  return trimmed.split(/\s+/)[0] || trimmed;
}

function bdmTabValues_(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  return sheet ? sheet.getDataRange().getValues() : [];
}

// student email -> { name, period }
function bdmRosterIndex_() {
  const values = bdmTabValues_(BDM_PROFILE_TABS.roster);
  const index = {};
  for (let r = 1; r < values.length; r++) {
    const email = String(values[r][1] || "").trim().toLowerCase();
    if (email) index[email] = { name: String(values[r][0] || "").trim(), period: String(values[r][2] || "").trim() };
  }
  return index;
}

// student email -> [{ guardian, guardianEmail, language }]
function bdmContactsIndex_() {
  const values = bdmTabValues_(BDM_PROFILE_TABS.contacts);
  const index = {};
  for (let r = 1; r < values.length; r++) {
    const studentEmail = String(values[r][0] || "").trim().toLowerCase();
    const guardianEmail = String(values[r][4] || "").trim().toLowerCase();
    if (!studentEmail || !guardianEmail) continue;
    if (!index[studentEmail]) index[studentEmail] = [];
    index[studentEmail].push({
      guardian: String(values[r][1] || "").trim() || "families",
      guardianEmail: guardianEmail,
      language: String(values[r][5] || "").trim()
    });
  }
  return index;
}

function bdmCreateMail_(to, subject, body) {
  if (BDM_PARENT_SEND_DIRECTLY) {
    GmailApp.sendEmail(to, subject, body);
    return "sent";
  }
  GmailApp.createDraft(to, subject, body);
  return "drafted";
}

function bdmAppendContactLog_(rows) {
  if (!rows.length) return;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BDM_PROFILE_TABS.contactLog);
  if (!sheet) return;
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

// ---------------------------------------------------------------------------
// 1. Missing work - one draft per family, listing everything that student owes
// ---------------------------------------------------------------------------
function draftMissingAssignmentEmails() {
  const roster = bdmRosterIndex_();
  const contacts = bdmContactsIndex_();
  const template = bdmTemplate_("missing-work");
  const teacher = Session.getActiveUser().getEmail() || "";

  const missingByStudent = {};
  const sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets().filter(function (s) {
    return s.getName().indexOf("Grades - ") === 0;
  });
  for (let s = 0; s < sheets.length; s++) {
    const values = sheets[s].getDataRange().getValues();
    if (values.length < 2) continue;
    const header = values[0];
    for (let r = 1; r < values.length; r++) {
      const email = String(values[r][1] || "").trim().toLowerCase();
      if (!email) continue;
      for (let c = BDM_GRADES_FIRST_ASSIGNMENT_COL - 1; c < header.length; c++) {
        if (String(values[r][c] || "").trim().toUpperCase() !== "M") continue;
        const assignment = String(header[c] || "").trim();
        if (!assignment) continue;
        if (!missingByStudent[email]) missingByStudent[email] = [];
        missingByStudent[email].push(assignment);
      }
    }
  }

  const emails = Object.keys(missingByStudent);
  let created = 0;
  const noContact = [];
  const logRows = [];
  const today = new Date();

  for (let i = 0; i < emails.length; i++) {
    const studentEmail = emails[i];
    const student = roster[studentEmail];
    const guardians = contacts[studentEmail] || [];
    if (!student) continue;
    if (!guardians.length) { noContact.push(student.name); continue; }

    const list = missingByStudent[studentEmail].map(function (a) { return "  - " + a; }).join("\n");
    for (let g = 0; g < guardians.length; g++) {
      const values = {
        student_name: student.name,
        student_first: bdmFirstName_(student.name),
        period: student.period,
        guardian: guardians[g].guardian,
        missing_list: list,
        teacher: teacher
      };
      const outcome = bdmCreateMail_(
        guardians[g].guardianEmail,
        bdmFill_(template.subject, values),
        bdmFill_(template.body, values)
      );
      created++;
      logRows.push([today, studentEmail, "Email", guardians[g].guardian,
        "Missing work: " + missingByStudent[studentEmail].join(", "), outcome, ""]);
    }
  }

  bdmAppendContactLog_(logRows);
  const summary = (BDM_PARENT_SEND_DIRECTLY ? "Sent " : "Drafted ") + created
    + " parent email(s) for " + emails.length + " student(s) with missing work."
    + (noContact.length ? "\n\nNo guardian email on file for:\n  " + noContact.join("\n  ") : "")
    + (BDM_PARENT_SEND_DIRECTLY ? "" : "\n\nReview them in Gmail > Drafts before sending.");
  Logger.log(summary);
  try { SpreadsheetApp.getUi().alert(summary); } catch (err) { /* no UI on trigger */ }
  return { created: created, noContact: noContact };
}

// ---------------------------------------------------------------------------
// 2. Ad hoc - draft about whoever is selected on the Profile tab
// ---------------------------------------------------------------------------
function draftParentEmailForStudent() {
  const profile = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BDM_PROFILE_TABS.profile);
  if (!profile) throw new Error("No Profile tab. Run setupProfileWorkbook() first.");
  const studentEmail = String(profile.getRange("B4").getValue() || "").trim().toLowerCase();
  if (!studentEmail || studentEmail === "not on roster") {
    throw new Error("Pick a student in the Profile tab first (cell B2).");
  }

  const student = bdmRosterIndex_()[studentEmail];
  const guardians = bdmContactsIndex_()[studentEmail] || [];
  if (!guardians.length) {
    throw new Error("No guardian email on file for " + (student ? student.name : studentEmail)
      + ". Add one on the Contacts tab.");
  }
  const template = bdmTemplate_("general");
  const teacher = Session.getActiveUser().getEmail() || "";
  const logRows = [];
  const today = new Date();

  for (let g = 0; g < guardians.length; g++) {
    const values = {
      student_name: student.name,
      student_first: bdmFirstName_(student.name),
      period: student.period,
      guardian: guardians[g].guardian,
      teacher: teacher
    };
    const outcome = bdmCreateMail_(
      guardians[g].guardianEmail,
      bdmFill_(template.subject, values),
      bdmFill_(template.body, values)
    );
    logRows.push([today, studentEmail, "Email", guardians[g].guardian,
      "Started a note home", outcome, ""]);
  }
  bdmAppendContactLog_(logRows);
  const summary = (BDM_PARENT_SEND_DIRECTLY ? "Sent" : "Drafted") + " "
    + guardians.length + " email(s) about " + student.name + "."
    + (BDM_PARENT_SEND_DIRECTLY ? "" : " Finish it in Gmail > Drafts.");
  try { SpreadsheetApp.getUi().alert(summary); } catch (err) { /* ignore */ }
  return summary;
}

// ---------------------------------------------------------------------------
// 3. Scan Gmail and log parent threads onto the right student
// ---------------------------------------------------------------------------
// ONE broad search, then match locally. Searching per guardian would be ~300
// queries and would hit Apps Script's quota long before it finished.
function scanGmailForParentContacts() {
  const days = Number(
    PropertiesService.getScriptProperties().getProperty("BDM_GMAIL_SCAN_DAYS") || 30
  );
  const contacts = bdmContactsIndex_();
  const guardianToStudent = {};
  const studentEmails = Object.keys(contacts);
  for (let i = 0; i < studentEmails.length; i++) {
    const list = contacts[studentEmails[i]];
    for (let g = 0; g < list.length; g++) {
      guardianToStudent[list[g].guardianEmail] = {
        studentEmail: studentEmails[i],
        guardian: list[g].guardian
      };
    }
  }

  // Existing log entries, so a re-scan never duplicates a thread.
  const existing = {};
  const logValues = bdmTabValues_(BDM_PROFILE_TABS.contactLog);
  for (let r = 1; r < logValues.length; r++) {
    const ref = String(logValues[r][6] || "").trim();
    if (ref) existing[ref] = true;
  }

  const threads = GmailApp.search("newer_than:" + days + "d -in:chats -in:drafts", 0, 300);
  const rows = [];
  const unknownSenders = {};

  for (let t = 0; t < threads.length; t++) {
    const messages = threads[t].getMessages();
    for (let m = 0; m < messages.length; m++) {
      const message = messages[m];
      const id = message.getId();
      if (existing[id]) continue;

      const from = String(message.getFrom() || "").toLowerCase();
      const to = String(message.getTo() || "").toLowerCase();
      let matched = null;
      const guardians = Object.keys(guardianToStudent);
      for (let g = 0; g < guardians.length; g++) {
        if (from.indexOf(guardians[g]) !== -1 || to.indexOf(guardians[g]) !== -1) {
          matched = guardianToStudent[guardians[g]];
          break;
        }
      }

      if (!matched) {
        // Surface addresses that wrote to you but sit on no student record -
        // usually a parent using a work address. These are Contacts rows
        // waiting to be added, which is why they are reported rather than
        // silently dropped.
        const addr = (from.match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || [])[0];
        if (addr && from.indexOf("no-reply") === -1 && from.indexOf("noreply") === -1) {
          unknownSenders[addr] = (unknownSenders[addr] || 0) + 1;
        }
        continue;
      }

      // Metadata and a link only. The body stays in Gmail.
      rows.push([
        message.getDate(),
        matched.studentEmail,
        "Email",
        matched.guardian,
        message.getSubject(),
        "https://mail.google.com/mail/u/0/#all/" + threads[t].getId(),
        id
      ]);
      existing[id] = true;
    }
  }

  bdmAppendContactLog_(rows);

  const frequent = Object.keys(unknownSenders)
    .filter(function (a) { return unknownSenders[a] >= 2; })
    .slice(0, 15);
  const summary = "Logged " + rows.length + " parent message(s) from the last " + days + " days."
    + (frequent.length
      ? "\n\nThese addresses wrote to you more than once but are on no student's "
        + "Contacts row - add them if they are parents:\n  " + frequent.join("\n  ")
      : "");
  Logger.log(summary);
  try { SpreadsheetApp.getUi().alert(summary); } catch (err) { /* ignore */ }
  return { logged: rows.length, unknown: frequent };
}
