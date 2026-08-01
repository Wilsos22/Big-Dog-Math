// Checkpoint results CSV parser — matches the Independent Proficiency System's
// export shape (checkpoint_results_sample.csv):
//   Date, Alias, Checkpoint, Form, Item #, Lesson, Domain,
//   CCSS, Mode, Correct (Y/N), Misconception (if wrong)
// Pure functions (no deps) so the format is testable offline.
//
// FERPA boundary: the SERVER accepts rows keyed by ALIAS only. A grading
// export from Workspace naturally carries emails instead - the upload page
// translates those to aliases IN THE TEACHER'S BROWSER using the local name
// key (src/lib/teacherNameKey.ts) before anything is posted, and any Student /
// Name column is parsed for translation display only, never stored.

export interface CheckpointRow {
  date: string; // ISO date
  alias: string; // the pseudonym stored on the site; "" until translated
  email: string; // lowercased; used ONLY for client-side translation
  checkpoint: string; // e.g. IDC-M1-CP1
  item: number; // 1-based item number
  lesson: string;
  ccss: string;
  correct: boolean;
  misconception: string | null;
}

// Minimal CSV parser with quoted-field support ("Beckett, Rio").
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.length > 1 || row[0] !== "") rows.push(row);
  return rows;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9#]/g, "");

// Tolerant header matching — finds each needed column by normalized name.
const HEADERS: Record<keyof CheckpointRow, string[]> = {
  date: ["date"],
  alias: ["alias", "studentalias"],
  email: ["email", "studentemail", "emailaddress"],
  checkpoint: ["checkpoint", "checkpointid"],
  item: ["item#", "item", "itemnumber", "q#"],
  lesson: ["lesson"],
  ccss: ["ccss", "standard"],
  correct: ["correct", "iscorrect"],
  misconception: ["misconceptionifwrong", "misconception", "tag"],
};

export interface ParseResult {
  rows: CheckpointRow[];
  errors: string[];
  checkpoints: string[]; // distinct checkpoint ids, in file order
}

export function parseCheckpointCsv(text: string): ParseResult {
  const raw = parseCsv(text);
  const errors: string[] = [];
  if (raw.length < 2) return { rows: [], errors: ["CSV needs a header row and at least one data row."], checkpoints: [] };

  const header = raw[0].map(norm);
  const col: Partial<Record<keyof CheckpointRow, number>> = {};
  for (const key of Object.keys(HEADERS) as (keyof CheckpointRow)[]) {
    const idx = header.findIndex((h) => HEADERS[key].includes(h));
    if (idx !== -1) col[key] = idx;
  }
  if (col.alias === undefined && col.email === undefined) {
    errors.push("Missing identity column: need Alias (preferred) or Email (translated to aliases in the browser before upload).");
  }
  for (const required of ["checkpoint", "item", "ccss", "correct"] as const) {
    if (col[required] === undefined) errors.push(`Missing required column: ${required} (looked for: ${HEADERS[required].join(", ")}).`);
  }
  if (errors.length) return { rows: [], errors, checkpoints: [] };

  const rows: CheckpointRow[] = [];
  const checkpoints: string[] = [];
  for (let i = 1; i < raw.length; i += 1) {
    const r = raw[i];
    const get = (k: keyof CheckpointRow) => (col[k] !== undefined ? (r[col[k]!] || "").trim() : "");
    const alias = get("alias");
    const email = get("email").toLowerCase();
    const checkpoint = get("checkpoint");
    const item = parseInt(get("item"), 10);
    const correctRaw = get("correct").toUpperCase();
    if ((!alias && !email) || !checkpoint || !Number.isFinite(item)) { errors.push(`Row ${i + 1}: missing alias/checkpoint/item — skipped.`); continue; }
    if (correctRaw !== "Y" && correctRaw !== "N" && correctRaw !== "TRUE" && correctRaw !== "FALSE" && correctRaw !== "1" && correctRaw !== "0") {
      errors.push(`Row ${i + 1}: Correct must be Y/N — got "${get("correct")}" — skipped.`);
      continue;
    }
    if (!checkpoints.includes(checkpoint)) checkpoints.push(checkpoint);
    rows.push({
      date: get("date") || new Date().toISOString().slice(0, 10),
      alias,
      email,
      checkpoint,
      item,
      lesson: get("lesson"),
      ccss: get("ccss"),
      correct: correctRaw === "Y" || correctRaw === "TRUE" || correctRaw === "1",
      misconception: get("misconception") || null,
    });
  }
  return { rows, errors, checkpoints };
}

// Client-side identity translation: fill each row's alias from its email using
// the teacher's browser-local name key. Returns the emails that matched
// nothing so the page can show exactly which rows will not upload. Rows that
// already carry an alias pass through untouched.
export function translateRowsToAliases(
  rows: CheckpointRow[],
  aliasByEmail: Map<string, string>,
): { translated: CheckpointRow[]; unmatchedEmails: string[] } {
  const unmatched = new Set<string>();
  const translated = rows.map((row) => {
    if (row.alias) return { ...row, email: "" };
    const alias = aliasByEmail.get(row.email) || "";
    if (!alias) unmatched.add(row.email);
    return { ...row, alias, email: "" };
  });
  return { translated, unmatchedEmails: [...unmatched] };
}

// Rebuild a canonical alias-keyed CSV for upload. Emails never survive this.
export function serializeAliasCsv(rows: CheckpointRow[]): string {
  const quote = (value: string) => (/[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  const lines = ["Date,Alias,Checkpoint,Item #,Lesson,CCSS,Correct,Misconception"];
  for (const row of rows) {
    lines.push([
      row.date,
      quote(row.alias),
      quote(row.checkpoint),
      String(row.item),
      quote(row.lesson),
      quote(row.ccss),
      row.correct ? "Y" : "N",
      quote(row.misconception || ""),
    ].join(","));
  }
  return lines.join("\n");
}
