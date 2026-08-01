// Pseudonymous student identity - the FERPA boundary vocabulary.
//
// The rule this module exists to enforce: student names, district emails, and
// every piece of re-identification key material live ONLY inside the district
// Google Workspace (the roster Sheet + Apps Script) and, for live teaching,
// the teacher's own signed-in browser. The website - Vercel, Supabase, and
// anything in this repo's data layer - holds two identity fields and nothing
// else:
//
//   alias       a human-friendly pseudonym generated in the Workspace roster
//               Sheet ("Amber Fox", "Steady Otter 2"). It is what students and
//               projectors see, and what every display_name derives from.
//   email_hmac  hex HMAC-SHA256 of the lowercased district email, computed in
//               Apps Script with a key held ONLY in Script Properties. The
//               site stores and compares these hashes; it never holds the key,
//               so it cannot compute, reverse, or enumerate them.
//
// Server routes that ACCEPT roster or identity data must refuse anything that
// looks identified (see looksIdentified / assertPseudonymousRoster) - the
// boundary defends itself instead of trusting every future caller.

export const EMAIL_HMAC_PATTERN = /^[0-9a-f]{64}$/;

export const ALIAS_MIN_LENGTH = 2;
export const ALIAS_MAX_LENGTH = 40;

// Letters, digits, and single spaces: "Amber Fox", "Steady Otter 2".
// No "@" (emails), no punctuation (real-name formats like "Last, First").
const ALIAS_PATTERN = /^[A-Za-z][A-Za-z0-9]*(?: [A-Za-z0-9]+){0,3}$/;

export function isEmailHmac(value: unknown): value is string {
  return typeof value === "string" && EMAIL_HMAC_PATTERN.test(value);
}

export function isStudentAlias(value: unknown): value is string {
  return typeof value === "string"
    && value.length >= ALIAS_MIN_LENGTH
    && value.length <= ALIAS_MAX_LENGTH
    && ALIAS_PATTERN.test(value);
}

// True when a string looks like it carries a real identity - an email address
// or an email-shaped fragment. Used to fail loudly on identified payloads.
export function looksIdentified(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return value.includes("@") || /\b[\w.+-]+\s*(?:\(at\)|\[at\])\s*[\w-]+\.[a-z]{2,}\b/i.test(value);
}

export interface PseudonymousRosterRow {
  alias: string;
  emailHmac: string | null;
  period: string;
}

// Validates a pushed roster payload. Returns the clean rows, or throws with a
// row-numbered message. ANY identified-looking row rejects the WHOLE payload:
// a partial write would mean some real identities got stored before the error.
export function assertPseudonymousRoster(input: unknown): PseudonymousRosterRow[] {
  if (!Array.isArray(input) || !input.length) {
    throw new Error("Roster payload must be a non-empty students array.");
  }
  if (input.length > 500) {
    throw new Error("Roster payload is larger than one school's worth of students.");
  }
  return input.map((raw, index) => {
    const row = (raw ?? {}) as { alias?: unknown; emailHmac?: unknown; period?: unknown };
    const label = `Row ${index + 1}`;
    const alias = typeof row.alias === "string" ? row.alias.trim() : "";
    if (!isStudentAlias(alias)) {
      throw new Error(
        looksIdentified(alias)
          ? `${label}: alias looks like a real identity. Only Workspace-generated aliases may reach the site.`
          : `${label}: alias is missing or not a valid pseudonym.`,
      );
    }
    const emailHmacRaw = typeof row.emailHmac === "string" ? row.emailHmac.trim().toLowerCase() : "";
    if (emailHmacRaw && !isEmailHmac(emailHmacRaw)) {
      throw new Error(
        looksIdentified(emailHmacRaw)
          ? `${label}: emailHmac contains a raw email address. Compute the HMAC in Apps Script; never send the email itself.`
          : `${label}: emailHmac is not a 64-character hex HMAC.`,
      );
    }
    const period = typeof row.period === "string" ? row.period.trim() : "";
    if (!period || period.length > 60) {
      throw new Error(`${label}: period is missing or too long.`);
    }
    if (looksIdentified(period)) {
      throw new Error(`${label}: period looks like an email address.`);
    }
    return { alias, emailHmac: emailHmacRaw || null, period };
  });
}
