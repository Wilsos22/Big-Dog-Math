// Where a student goes the moment their warm-up submission is confirmed.
//
// The teacher picks this per lesson in Notion (the `Warm-Up Challenge` select).
// Every option here resolves to a route that works with no live session and no
// teacher action, because this fires while the teacher is still running warm-up
// on the projector and cannot be interrupted to push anything.
//
// The option list is DERIVED from SKILLS rather than hand-written, so a Notion
// option can never name a drill the engine does not have. That is the failure
// this repo keeps re-learning: an authorable property the runtime ignores looks
// identical to a working one until a student is sitting in front of it.

import { SKILLS } from "@/lib/challengeSkills";

// A skill whose best home is its own full-screen tool rather than the generic
// drill player. Steele's first-few-weeks default is the multiplication tool, so
// it is the one that deliberately does not go to /practice.
const TOOL_ROUTE_OVERRIDES: Record<string, string> = {
  multiplication: "/multiplication-fluency",
};

export interface WarmupChallengeOption {
  key: string;
  label: string;
  href: string;
}

export const WARMUP_CHALLENGE_OPTIONS: WarmupChallengeOption[] = SKILLS.map((skill) => ({
  key: skill.key,
  label: skill.label,
  href: TOOL_ROUTE_OVERRIDES[skill.key] ?? `/practice?skill=${skill.key}`,
}));

// Matches the way propByName reads Notion: case and punctuation are noise, so
// "GCF and LCM", "gcf-lcm" and "GCF & LCM" all land on the same option. A
// teacher typing the option name inline in Notion should not be able to miss by
// a hyphen.
function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Resolve a Notion `Warm-Up Challenge` value to a destination route.
 * Returns "" when nothing matches - the caller keeps the student on the home
 * base rather than navigating somewhere that will not load.
 */
export function warmupChallengeHref(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const wanted = normalize(value);
  if (!wanted) return "";
  const hit = WARMUP_CHALLENGE_OPTIONS.find(
    (option) => normalize(option.label) === wanted || normalize(option.key) === wanted,
  );
  return hit?.href ?? "";
}

/**
 * The label to show a student on the way in ("Next up: Multiplication Facts").
 * Empty when the value does not resolve, for the same reason as above.
 */
export function warmupChallengeLabel(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const wanted = normalize(value);
  const hit = WARMUP_CHALLENGE_OPTIONS.find(
    (option) => normalize(option.label) === wanted || normalize(option.key) === wanted,
  );
  return hit?.label ?? "";
}

// Where an UNAUTHORED lesson sends its students. Steele's first-few-weeks
// default is the multiplication tool, and the common case is a lesson whose
// property nobody set - so defaulting is what makes this work every day
// without per-lesson authoring, rather than only on the days someone
// remembered. Notion still wins whenever a lesson names a drill.
export const WARMUP_CHALLENGE_DEFAULT_KEY = "multiplication";

export interface WarmupChallengeDestination {
  href: string;
  label: string;
}

/**
 * The destination for a lesson's `Warm-Up Challenge` value.
 *
 * UNSET falls back to the default above. UNRECOGNISED does NOT, and the
 * difference is deliberate: a blank property means "nobody picked", while a
 * value that resolves to nothing means someone picked and it did not take -
 * an authoring error. Defaulting that one would hide it, and a teacher who
 * typed "Fraction Practice" would watch the class land on multiplication with
 * nothing anywhere saying why. So a bad value still parks the student on the
 * home base, where the teacher can see them.
 */
export function warmupChallengeDestination(value: unknown): WarmupChallengeDestination {
  const authored = typeof value === "string" ? value.trim() : "";
  if (!authored) {
    const fallback = WARMUP_CHALLENGE_OPTIONS.find(
      (option) => option.key === WARMUP_CHALLENGE_DEFAULT_KEY,
    );
    return { href: fallback?.href ?? "", label: fallback?.label ?? "" };
  }
  return { href: warmupChallengeHref(authored), label: warmupChallengeLabel(authored) };
}
