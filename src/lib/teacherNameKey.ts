// The teacher's browser-local name key: alias -> real name (and email ->
// alias, for translating grading exports). This is the ONLY place outside the
// district Google Workspace where student names exist, and it never leaves
// the device: stored in localStorage on the teacher's signed-in browser,
// loaded by pasting the key columns from the Workspace roster Sheet, and read
// at render time by teacher-gated surfaces. Nothing here may ever be sent to
// the server - see src/lib/pseudonym.ts for the boundary.

export interface NameKeyEntry {
  alias: string;
  name: string;
  email: string; // lowercased; "" when the sheet column was blank
}

export interface NameKey {
  updatedAt: string;
  entries: NameKeyEntry[];
}

const STORAGE_KEY = "bdm-teacher-name-key";

export function loadNameKey(): NameKey | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NameKey;
    if (!Array.isArray(parsed.entries)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveNameKey(entries: NameKeyEntry[]): NameKey {
  const key: NameKey = { updatedAt: new Date().toISOString(), entries };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(key)); } catch { /* private mode */ }
  return key;
}

export function clearNameKey(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

export function aliasToNameMap(key: NameKey | null): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of key?.entries ?? []) {
    if (entry.alias && entry.name) map.set(entry.alias.toLowerCase(), entry.name);
  }
  return map;
}

export function emailToAliasMap(key: NameKey | null): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of key?.entries ?? []) {
    if (entry.email && entry.alias) map.set(entry.email.toLowerCase(), entry.alias);
  }
  return map;
}

// Resolve a display label for teacher-gated surfaces: "Real Name (Amber Fox)"
// when the key knows the alias, the alias alone otherwise.
export function labelFor(map: Map<string, string>, alias: string | null | undefined): string {
  if (!alias) return "Unnamed student";
  const name = map.get(alias.toLowerCase());
  return name ? `${name} (${alias})` : alias;
}

// Parse the pasted key. Accepts the Workspace roster Sheet's columns copied
// straight out (tab-separated) or a CSV export. Needs a header row naming at
// least Alias and Name; Email is optional but recommended (it powers the
// checkpoint-CSV translation).
export function parseNameKey(text: string): { entries: NameKeyEntry[]; error: string | null } {
  const lines = text.split(/\r\n|\r|\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return { entries: [], error: "Paste the sheet's header row plus at least one student row." };

  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const split = (line: string): string[] => {
    if (delimiter === "\t") return line.split("\t").map((cell) => cell.trim());
    // Minimal quoted-field CSV split for names like "Last, First".
    const cells: string[] = [];
    let cell = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cell += '"'; i += 1; } else inQuotes = false;
        } else cell += ch;
      } else if (ch === '"') inQuotes = true;
      else if (ch === ",") { cells.push(cell.trim()); cell = ""; }
      else cell += ch;
    }
    cells.push(cell.trim());
    return cells;
  };

  const header = split(lines[0]).map((cell) => cell.toLowerCase().replace(/[^a-z]/g, ""));
  const aliasCol = header.findIndex((cell) => cell === "alias" || cell === "studentalias");
  const nameCol = header.findIndex((cell) => ["name", "student", "studentname", "fullname"].includes(cell));
  const emailCol = header.findIndex((cell) => ["email", "studentemail", "emailaddress"].includes(cell));
  if (aliasCol === -1 || nameCol === -1) {
    return { entries: [], error: "The header row needs Alias and Name columns (Email optional)." };
  }

  const entries: NameKeyEntry[] = [];
  for (const line of lines.slice(1)) {
    const cells = split(line);
    const alias = cells[aliasCol] || "";
    const name = cells[nameCol] || "";
    if (!alias || !name) continue;
    entries.push({
      alias,
      name,
      email: emailCol === -1 ? "" : (cells[emailCol] || "").toLowerCase(),
    });
  }
  if (!entries.length) return { entries: [], error: "No rows carried both an alias and a name." };
  return { entries, error: null };
}
