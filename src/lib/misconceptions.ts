/**
 * The finite misconception vocabulary, in TypeScript.
 *
 * Clustering is EXACT STRING MATCH (design is locked: a finite vocabulary, no
 * NLP). A tag with no seeded row does not error anywhere - it silently loses
 * its domain, so i-Ready corroboration in /api/live/groups goes to zero, and
 * any teacher move authored against that tag renders blank. That failure mode
 * is invisible: the cluster still appears, just uncorroborated and unplanned.
 *
 * This list MUST stay identical to the `misconceptions` seed in
 * `supabase/proficiency.sql`; `npm run test:misconceptions` asserts both
 * directions and fails the build on drift. Adding a tag means editing BOTH,
 * and the SQL is hand-run in the Supabase SQL Editor.
 *
 * Type a new emitter's tag as `MisconceptionTag` and a bad label becomes a
 * compile error at the call site instead of a silent miss in production.
 */
export const MISCONCEPTION_TAGS = [
  "treats ratio as additive",
  "reverses part and whole in percent",
  "adds denominators when adding fractions",
  "misplaces decimal in division",
  "ignores order of operations",
  "confuses coefficient with exponent",
  "sign errors with negatives",
  "reverses inequality symbol",
  "confuses area vs perimeter",
  "forgets to halve base × height for triangle area",
  "confuses mean and median",
  "miscounts frequencies in a data display",
  "distributes to first term only",
  "changes the whole",
] as const;

export type MisconceptionTag = (typeof MISCONCEPTION_TAGS)[number];

export function isMisconceptionTag(value: string | null | undefined): value is MisconceptionTag {
  return MISCONCEPTION_TAGS.includes(value as MisconceptionTag);
}
