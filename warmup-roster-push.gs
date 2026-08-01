// =====================================================================
// BIG DOG MATH - WORKSPACE ROSTER PUSH (the FERPA boundary's front door)
//
// The roster Sheet in the district Google Workspace is the ONLY place student
// names and district emails exist. This script pushes a PSEUDONYMOUS roster
// to the site: each row becomes { alias, emailHmac, period } and nothing
// else. The site validates that shape and refuses anything identified.
//
// Sheet setup: a tab named "Roster" with a header row containing at least
//   Name | Email | Period | Alias
// (any order; extra columns are ignored). Leave Alias blank for new students
// and run generateAliases() - it fills stable two-word pseudonyms.
//
// Script Properties (Project Settings):
//   BDM_ROSTER_HMAC_KEY  required - the one-way email key. Same value as the
//                        warm-up script's BDM_ROSTER_HMAC_KEY. Generate once
//                        (long random string), store ONLY in Script
//                        Properties. Never put it in Vercel, Supabase, or the
//                        repo: the whole design rests on the site being
//                        UNABLE to compute or reverse these hashes.
//   BDM_CRON_SECRET      required - same value as CRON_SECRET in Vercel;
//                        authorizes the push through the teacher proxy.
//   BDM_ROSTER_URL       optional - defaults to
//                        https://bigdogmath.com/api/roster/sync
//
// Run pushRosterToSite() after roster changes, or install a daily trigger on
// it (Triggers > Add Trigger > time-driven). The push never deletes site
// students; removed rows are only reported back.
// =====================================================================

var BDM_ROSTER_SHEET_NAME = "Roster";

// Word lists for generated aliases: 6th-grade friendly, no real-name shapes.
var BDM_ALIAS_ADJECTIVES = [
  "Amber", "Bold", "Brave", "Bright", "Calm", "Clever", "Cosmic", "Daring",
  "Eager", "Electric", "Fearless", "Gentle", "Golden", "Happy", "Icy",
  "Jolly", "Keen", "Lucky", "Mellow", "Mighty", "Noble", "Peppy", "Quick",
  "Quiet", "Rapid", "Royal", "Sandy", "Sharp", "Silver", "Smart", "Snappy",
  "Solar", "Speedy", "Steady", "Stellar", "Sturdy", "Sunny", "Swift",
  "Turbo", "Vivid", "Wild", "Witty", "Zesty", "Zippy"
];
var BDM_ALIAS_ANIMALS = [
  "Badger", "Bison", "Bobcat", "Cheetah", "Comet", "Condor", "Cougar",
  "Coyote", "Dolphin", "Eagle", "Falcon", "Ferret", "Fox", "Gecko",
  "Hawk", "Heron", "Husky", "Jaguar", "Kestrel", "Koala", "Lemur", "Lynx",
  "Marmot", "Marten", "Moose", "Narwhal", "Ocelot", "Orca", "Osprey",
  "Otter", "Owl", "Panda", "Panther", "Pelican", "Puffin", "Raven",
  "Salmon", "Seal", "Stallion", "Tiger", "Toucan", "Walrus", "Wolf",
  "Wombat"
];

function bdmRosterSheet_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BDM_ROSTER_SHEET_NAME);
  if (!sheet) throw new Error('No tab named "' + BDM_ROSTER_SHEET_NAME + '" in this spreadsheet.');
  return sheet;
}

function bdmRosterColumns_(headerRow) {
  const normalized = headerRow.map(function (cell) {
    return String(cell || "").trim().toLowerCase().replace(/[^a-z]/g, "");
  });
  const find = function (names) {
    for (let i = 0; i < normalized.length; i++) {
      if (names.indexOf(normalized[i]) !== -1) return i;
    }
    return -1;
  };
  return {
    name: find(["name", "student", "studentname", "fullname"]),
    email: find(["email", "studentemail", "emailaddress"]),
    period: find(["period", "class", "classperiod"]),
    alias: find(["alias", "studentalias"])
  };
}

// Same one-way disguise as warmup-evidence.gs - keep the two identical.
function bdmRosterEmailHmac_(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return "";
  const key = PropertiesService.getScriptProperties().getProperty("BDM_ROSTER_HMAC_KEY");
  if (!key) throw new Error("BDM_ROSTER_HMAC_KEY is not set in Script Properties.");
  const bytes = Utilities.computeHmacSha256Signature(normalized, key);
  return bytes.map(function (b) {
    const v = (b + 256) % 256;
    return (v < 16 ? "0" : "") + v.toString(16);
  }).join("");
}

// Fill every blank Alias cell with a stable, unique two-word pseudonym.
// Deliberately random (never derived from the name or email) so an alias can
// never be reversed. Collisions get a numeric suffix.
function generateAliases() {
  const sheet = bdmRosterSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) throw new Error("The Roster tab needs a header row and students.");
  const cols = bdmRosterColumns_(values[0]);
  if (cols.alias === -1) throw new Error("Add an Alias column to the Roster tab first.");

  // AliasMap is the permanent email -> alias ledger. Aliases are pinned to a
  // student's EMAIL, not to a row, so you can paste a fresh district export
  // over the Roster tab whenever the office moves kids around and every
  // returning student keeps the alias their evidence is filed under. Without
  // this, a re-paste that reorders rows silently reassigns aliases, which
  // creates duplicate students on the site and orphans their history.
  const mapSheet = bdmAliasMapSheet_();
  const mapValues = mapSheet.getLastRow() > 1
    ? mapSheet.getRange(2, 1, mapSheet.getLastRow() - 1, 2).getValues()
    : [];
  const aliasByEmail = {};
  const taken = {};
  for (let i = 0; i < mapValues.length; i++) {
    const email = String(mapValues[i][0] || "").trim().toLowerCase();
    const alias = String(mapValues[i][1] || "").trim();
    if (!email || !alias) continue;
    aliasByEmail[email] = alias;
    taken[alias.toLowerCase()] = true;
  }
  for (let r = 1; r < values.length; r++) {
    const existing = String(values[r][cols.alias] || "").trim();
    if (existing) taken[existing.toLowerCase()] = true;
  }

  // Pass 1: restore known aliases by email, so a re-pasted export re-attaches
  // itself. This also repairs rows where a paste misaligned the alias column.
  let restored = 0;
  const newMapRows = [];
  if (cols.email !== -1) {
    for (let r = 1; r < values.length; r++) {
      const email = String(values[r][cols.email] || "").trim().toLowerCase();
      if (!email) continue;
      const known = aliasByEmail[email];
      const current = String(values[r][cols.alias] || "").trim();
      if (known && current !== known) {
        sheet.getRange(r + 1, cols.alias + 1).setValue(known);
        values[r][cols.alias] = known;
        restored++;
      } else if (!known && current) {
        // First run after an upgrade: adopt the alias already on the row.
        aliasByEmail[email] = current;
        newMapRows.push([email, current]);
      }
    }
  }

  let filled = 0;
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][cols.alias] || "").trim()) continue;
    const hasIdentity = (cols.name !== -1 && String(values[r][cols.name] || "").trim())
      || (cols.email !== -1 && String(values[r][cols.email] || "").trim());
    if (!hasIdentity) continue;
    let alias = "";
    for (let attempt = 0; attempt < 200 && !alias; attempt++) {
      const candidate = BDM_ALIAS_ADJECTIVES[Math.floor(Math.random() * BDM_ALIAS_ADJECTIVES.length)]
        + " " + BDM_ALIAS_ANIMALS[Math.floor(Math.random() * BDM_ALIAS_ANIMALS.length)];
      if (!taken[candidate.toLowerCase()]) alias = candidate;
    }
    if (!alias) {
      const base = BDM_ALIAS_ADJECTIVES[Math.floor(Math.random() * BDM_ALIAS_ADJECTIVES.length)]
        + " " + BDM_ALIAS_ANIMALS[Math.floor(Math.random() * BDM_ALIAS_ANIMALS.length)];
      let n = 2;
      while (taken[(base + " " + n).toLowerCase()]) n++;
      alias = base + " " + n;
    }
    taken[alias.toLowerCase()] = true;
    sheet.getRange(r + 1, cols.alias + 1).setValue(alias);
    values[r][cols.alias] = alias;
    filled++;
    if (cols.email !== -1) {
      const email = String(values[r][cols.email] || "").trim().toLowerCase();
      if (email) {
        aliasByEmail[email] = alias;
        newMapRows.push([email, alias]);
      }
    }
  }

  if (newMapRows.length) {
    mapSheet.getRange(mapSheet.getLastRow() + 1, 1, newMapRows.length, 2).setValues(newMapRows);
  }
  Logger.log("generateAliases: filled " + filled + " new alias(es), restored "
    + restored + " by email, ledger now holds " + Object.keys(aliasByEmail).length + ".");
}

// The permanent email -> alias ledger. Hidden by default: it is the one tab
// that ties a real email to a site alias, so it is re-identification key
// material and belongs nowhere but this Workspace file.
function bdmAliasMapSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("AliasMap");
  if (!sheet) {
    sheet = ss.insertSheet("AliasMap");
    sheet.getRange(1, 1, 1, 2).setValues([["Email", "Alias"]]);
    sheet.setFrozenRows(1);
    sheet.hideSheet();
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, 2).setValues([["Email", "Alias"]]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Push the pseudonymous roster to the site. Names and emails stay here.
function pushRosterToSite() {
  const props = PropertiesService.getScriptProperties();
  const cronSecret = props.getProperty("BDM_CRON_SECRET");
  if (!cronSecret) throw new Error("BDM_CRON_SECRET is not set in Script Properties.");
  const url = props.getProperty("BDM_ROSTER_URL") || "https://bigdogmath.com/api/roster/sync";

  const sheet = bdmRosterSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) throw new Error("The Roster tab needs a header row and students.");
  const cols = bdmRosterColumns_(values[0]);
  if (cols.alias === -1 || cols.period === -1) {
    throw new Error("The Roster tab needs Alias and Period columns (run generateAliases() for blanks).");
  }

  const students = [];
  const skipped = [];
  for (let r = 1; r < values.length; r++) {
    const alias = String(values[r][cols.alias] || "").trim();
    const period = String(values[r][cols.period] || "").trim();
    const email = cols.email === -1 ? "" : String(values[r][cols.email] || "").trim();
    if (!alias && !email && (cols.name === -1 || !String(values[r][cols.name] || "").trim())) continue; // blank row
    if (!alias || !period) {
      skipped.push("row " + (r + 1) + (alias ? "" : " (no alias - run generateAliases())") + (period ? "" : " (no period)"));
      continue;
    }
    students.push({
      alias: alias,
      emailHmac: email ? bdmRosterEmailHmac_(email) : null,
      period: period
    });
  }
  if (!students.length) throw new Error("No pushable rows. " + skipped.join("; "));

  const res = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    muteHttpExceptions: true,
    headers: { Authorization: "Bearer " + cronSecret },
    payload: JSON.stringify({ students: students })
  });
  const code = res.getResponseCode();
  Logger.log("Roster push " + code + ": " + res.getContentText().slice(0, 500));
  if (skipped.length) Logger.log("Skipped rows: " + skipped.join("; "));
  if (code < 200 || code >= 300) throw new Error("Roster push failed (" + code + "). See log.");
}
