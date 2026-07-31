/**
 * Structured numeric responses - N numeric boxes laid out as an equation.
 *
 * Multiple choice cannot separate a student who misunderstands the
 * distributive property from one who understands it and cannot multiply.
 * Those need different teacher moves, so the diagnosis comes from the PATTERN
 * across the boxes rather than from a single right/wrong.
 *
 * The exit ticket is the shape that drove this:
 *
 *     6 x 28 = 6 x ( [ ] + [ ] ) = [ ] + [ ] = [ ]
 *
 * There is no single correct answer string. ANY valid split passes: boxes 1
 * and 2 must total 28, boxes 3 and 4 must be 6 times their addend, box 5 must
 * be the product. A student who cuts at 20 + 8 and one who cuts at 14 + 14 are
 * both right.
 *
 * The rules are authored in the Lesson Step's `Correct Answer` text property,
 * one per line, because there is no appetite for a new Notion property:
 *
 *     boxes: 5
 *     sum(1,2)=28
 *     3=6*1
 *     4=6*2
 *     5=168
 *
 * A SECOND shape shares the same response kind: PAIRS. The student builds every
 * two-factor pair of a target, and completeness is scored SEPARATELY from
 * correctness - a student who invented a pair (4x4 for 18) and one who is only
 * missing a pair are different people and need different teacher moves. It is
 * authored as its own tiny spec, mutually exclusive with the boxes forms:
 *
 *     pairs(18)
 *     bank: 20
 *
 * `pairs(N)` is the product; `bank: M` sizes the tap bank (1..M) the student
 * chooses from, and defaults to N when omitted so every factor pair is
 * reachable. The two shapes are a discriminated union on `spec.mode`.
 *
 * This module has NO imports on purpose - it is compiled in isolation by
 * `npm run test:structured-numeric`, exactly like mastery.ts and grouping.ts.
 * Do not add imports or tsconfig path aliases to it.
 */

/** A single authored rule. `source` is the literal line, used in teacher-facing errors. */
export type StructuredNumericRule =
  /** `sum(a,b)=N` - those boxes must total N. Any split that totals N passes. */
  | { kind: "sum"; boxes: [number, number]; total: number; source: string }
  /** `a=K*b` - box a equals constant K times box b. */
  | { kind: "multiple"; box: number; factor: number; ofBox: number; source: string }
  /** `a=N` - box a equals constant N. */
  | { kind: "equals"; box: number; value: number; source: string };

/** The N-boxes-laid-out-as-an-equation shape (`boxes: N` + sum/multiple/equals). */
export type StructuredNumericBoxesSpec = {
  mode: "boxes";
  /** How many inputs to render. */
  boxes: number;
  /** Evaluated in authored order - the FIRST failing rule is the diagnosis. */
  rules: StructuredNumericRule[];
};

/** The build-every-factor-pair shape (`pairs: N` + optional `bank: M`). */
export type StructuredNumericPairsSpec = {
  mode: "pairs";
  /** The product every submitted pair must equal. */
  target: number;
  /**
   * The tap bank runs 1..bank. A factor pair needing a number ABOVE the bank
   * is not expected of the student - they literally cannot tap it - so the
   * completeness target is the factor pairs reachable within the bank.
   */
  bank: number;
};

export type StructuredNumericSpec = StructuredNumericBoxesSpec | StructuredNumericPairsSpec;

export type StructuredNumericParse =
  | { ok: true; spec: StructuredNumericSpec }
  | { ok: false; errors: string[] };

/** Where a rule sits in the equation, inferred from the box it constrains. */
export type StructuredNumericRole = "whole" | "partial" | "total";

export type StructuredNumericTier = 1 | 2 | 3 | 4;

export type StructuredNumericDiagnosis = {
  correct: boolean;
  /** The first rule that failed, or null when every rule passed. */
  failedRule: StructuredNumericRule | null;
  /** The failing rule's authored text, for the teacher-facing detail line. */
  ruleId: string | null;
  role: StructuredNumericRole | null;
  /** Read aloud while walking the room, so it names the error, not the rule. */
  phrase: string;
  tier: StructuredNumericTier;
  /** Exact-match tag from the seeded `misconceptions` vocabulary, or null. */
  misconception: string | null;
  /** The addends the student chose, when the spec has a `sum` rule. */
  split: number[] | null;
  /** Order-independent key for the chosen split, so 20+8 and 8+20 group together. */
  splitKey: string | null;
  /** Present only for a pairs spec - the completeness/correctness breakdown. */
  pairsResult?: StructuredNumericPairsResult;
};

/**
 * A pairs response, scored. Completeness (`complete`) is deliberately separate
 * from correctness: a student can be complete but have invented a pair, or have
 * every pair valid yet be missing one. The two failures route to different
 * teacher moves, so they must never collapse into one boolean.
 */
export type StructuredNumericPairsResult = {
  /** Every distinct pair the student built, order-independent. */
  submitted: [number, number][];
  /** The submitted pairs that actually multiply to the target within the bank. */
  valid: [number, number][];
  /** Submitted pairs that do NOT multiply to the target (e.g. 4x4 for 18). */
  invented: [number, number][];
  /** Expected factor pairs the student never built. */
  missing: [number, number][];
  /** Every expected factor pair is present. Says nothing about invented pairs. */
  complete: boolean;
};

export const STRUCTURED_NUMERIC_TIER_LABELS: Record<StructuredNumericTier, string> = {
  1: "Call",
  2: "Visit",
  3: "Check",
  4: "None",
};

const RULE_SYNTAX_HELP =
  "Use one rule per line: boxes: N, sum(a,b)=N, a=K*b, or a=N.";
const PAIRS_SYNTAX_HELP =
  "A pairs step takes only pairs(N) and an optional bank: M.";

const MAX_BOXES = 12;
/** The most pairs a student can build - caps the flat `values` array at 2x this. */
export const MAX_PAIRS = 12;
/**
 * Upper bound on the flat `values` array for EITHER shape. The boxes variant
 * needs MAX_BOXES; the pairs variant needs two numbers per pair. The route and
 * the client both clamp to this before writing `poll_answers.values`.
 */
export const MAX_STRUCTURED_NUMERIC_VALUES = Math.max(MAX_BOXES, MAX_PAIRS * 2);
const MAX_PAIRS_TARGET = 10000;
const MAX_PAIRS_BANK = 100;

const BOXES_LINE = /^boxes\s*:\s*(\d+)$/i;
const SUM_LINE = /^sum\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)\s*=\s*(-?\d+)$/i;
const MULTIPLE_LINE = /^(\d+)\s*=\s*(-?\d+)\s*\*\s*(\d+)$/;
const EQUALS_LINE = /^(\d+)\s*=\s*(-?\d+)$/;
const PAIRS_LINE = /^pairs\s*\(\s*(\d+)\s*\)$/i;
const BANK_LINE = /^bank\s*:\s*(\d+)$/i;

/**
 * Parse an authored answer spec.
 *
 * Deliberately NOT an expression evaluator - the boxes forms are four fixed
 * shapes and pairs is one more. Anything else is a parse error, and a parse
 * error must fail LOUDLY in the control panel load message. Silently accepting
 * a malformed spec would mark a whole class wrong on a rule nobody wrote.
 *
 * A `pairs(N)` line switches the whole spec to the pairs shape - the two modes
 * are mutually exclusive, so mixing pairs with any boxes form is an error.
 */
export function parseStructuredNumericSpec(text: string | null | undefined): StructuredNumericParse {
  const lines = (text || "").split(/\r?\n/);
  if (lines.some((line) => PAIRS_LINE.test(line.trim()))) return parsePairsSpec(lines);
  return parseBoxesSpec(lines);
}

function parseBoxesSpec(lines: string[]): StructuredNumericParse {
  const errors: string[] = [];
  const rules: StructuredNumericRule[] = [];
  let boxes: number | null = null;

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return;
    const lineNumber = index + 1;

    const boxesMatch = line.match(BOXES_LINE);
    if (boxesMatch) {
      if (boxes !== null) {
        errors.push(`Line ${lineNumber}: "${line}" repeats boxes:. Declare the box count once.`);
        return;
      }
      const count = Number(boxesMatch[1]);
      if (count < 1 || count > MAX_BOXES) {
        errors.push(`Line ${lineNumber}: "${line}" needs a box count between 1 and ${MAX_BOXES}.`);
        return;
      }
      boxes = count;
      return;
    }

    const sumMatch = line.match(SUM_LINE);
    if (sumMatch) {
      rules.push({
        kind: "sum",
        boxes: [Number(sumMatch[1]), Number(sumMatch[2])],
        total: Number(sumMatch[3]),
        source: line,
      });
      return;
    }

    // Checked before the plain `a=N` form, or `3=6*1` would parse as a
    // constant and the multiplication rule would be silently lost.
    const multipleMatch = line.match(MULTIPLE_LINE);
    if (multipleMatch) {
      rules.push({
        kind: "multiple",
        box: Number(multipleMatch[1]),
        factor: Number(multipleMatch[2]),
        ofBox: Number(multipleMatch[3]),
        source: line,
      });
      return;
    }

    const equalsMatch = line.match(EQUALS_LINE);
    if (equalsMatch) {
      rules.push({ kind: "equals", box: Number(equalsMatch[1]), value: Number(equalsMatch[2]), source: line });
      return;
    }

    errors.push(`Line ${lineNumber}: "${line}" is not a supported rule. ${RULE_SYNTAX_HELP}`);
  });

  if (boxes === null) {
    errors.push(`The spec needs a "boxes: N" line saying how many inputs to render. ${RULE_SYNTAX_HELP}`);
  }
  if (!rules.length) {
    errors.push(`The spec needs at least one rule besides boxes:. ${RULE_SYNTAX_HELP}`);
  }

  // Range-check every referenced box only once the count is known, so an
  // out-of-range reference is reported against the real limit.
  if (boxes !== null) {
    const limit: number = boxes;
    for (const rule of rules) {
      for (const box of referencedBoxes(rule)) {
        if (box < 1 || box > limit) {
          errors.push(`"${rule.source}" refers to box ${box}, but the spec declares ${limit} boxes.`);
        }
      }
    }
  }

  if (errors.length || boxes === null) return { ok: false, errors };
  return { ok: true, spec: { mode: "boxes", boxes, rules } };
}

/**
 * Parse the pairs shape: `pairs(N)` plus an optional `bank: M`. Nothing else is
 * allowed - a boxes rule mixed in is an authoring mistake, not a silent no-op.
 */
function parsePairsSpec(lines: string[]): StructuredNumericParse {
  const errors: string[] = [];
  let target: number | null = null;
  let bank: number | null = null;

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return;
    const lineNumber = index + 1;

    const pairsMatch = line.match(PAIRS_LINE);
    if (pairsMatch) {
      if (target !== null) {
        errors.push(`Line ${lineNumber}: "${line}" repeats pairs(). Declare the target once.`);
        return;
      }
      const value = Number(pairsMatch[1]);
      if (value < 2 || value > MAX_PAIRS_TARGET) {
        errors.push(`Line ${lineNumber}: "${line}" needs a target between 2 and ${MAX_PAIRS_TARGET}.`);
        return;
      }
      target = value;
      return;
    }

    const bankMatch = line.match(BANK_LINE);
    if (bankMatch) {
      if (bank !== null) {
        errors.push(`Line ${lineNumber}: "${line}" repeats bank:. Declare the bank once.`);
        return;
      }
      const value = Number(bankMatch[1]);
      if (value < 1 || value > MAX_PAIRS_BANK) {
        errors.push(`Line ${lineNumber}: "${line}" needs a bank between 1 and ${MAX_PAIRS_BANK}.`);
        return;
      }
      bank = value;
      return;
    }

    errors.push(`Line ${lineNumber}: "${line}" cannot be mixed with pairs(). ${PAIRS_SYNTAX_HELP}`);
  });

  if (target === null) {
    errors.push(`A pairs step needs a "pairs(N)" line. ${PAIRS_SYNTAX_HELP}`);
    return { ok: false, errors };
  }
  // Default the bank to the target so every factor pair (1..N) is reachable.
  const resolvedBank = bank ?? target;
  // A step the student can never complete is worse than no step - if the bank
  // is too small to reach a single factor pair, fail loudly, do not open it.
  if (!expectedFactorPairs(target, resolvedBank).length) {
    errors.push(`pairs(${target}) has no factor pair reachable from a bank of 1 to ${resolvedBank}. Raise the bank.`);
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, spec: { mode: "pairs", target, bank: resolvedBank } };
}

/**
 * The unordered factor pairs of `target` whose BOTH factors are within 1..bank,
 * small factor first. This is the completeness target: a pair needing a number
 * above the bank cannot be tapped, so it is never expected.
 */
export function expectedFactorPairs(target: number, bank: number): [number, number][] {
  const pairs: [number, number][] = [];
  for (let d = 1; d * d <= target; d += 1) {
    if (target % d !== 0) continue;
    const other = target / d;
    if (d <= bank && other <= bank) pairs.push([d, other]);
  }
  return pairs;
}

function referencedBoxes(rule: StructuredNumericRule): number[] {
  if (rule.kind === "sum") return [rule.boxes[0], rule.boxes[1]];
  if (rule.kind === "multiple") return [rule.box, rule.ofBox];
  return [rule.box];
}

/** The box a rule constrains - the one whose value the rule is a claim about. */
function constrainedBox(rule: StructuredNumericRule): number | null {
  if (rule.kind === "sum") return null;
  return rule.box;
}

/**
 * A rule's role in the equation, inferred positionally.
 *
 * `sum` rules are the whole-preservation check. A rule on the LAST box is the
 * final total. Everything else constrains a partial product. This is why the
 * spec has no role annotations: the box index already carries it.
 */
export function structuredNumericRuleRole(
  rule: StructuredNumericRule,
  spec: StructuredNumericBoxesSpec,
): StructuredNumericRole {
  if (rule.kind === "sum") return "whole";
  return constrainedBox(rule) === spec.boxes ? "total" : "partial";
}

function ruleHolds(rule: StructuredNumericRule, values: readonly (number | null)[]): boolean {
  const at = (box: number): number | null => {
    const value = values[box - 1];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  };
  if (rule.kind === "sum") {
    const first = at(rule.boxes[0]);
    const second = at(rule.boxes[1]);
    if (first === null || second === null) return false;
    return first + second === rule.total;
  }
  if (rule.kind === "multiple") {
    const target = at(rule.box);
    const source = at(rule.ofBox);
    if (target === null || source === null) return false;
    return target === rule.factor * source;
  }
  const target = at(rule.box);
  return target !== null && target === rule.value;
}

/**
 * Diagnose a student's boxes.
 *
 * Rules are evaluated in authored order and the FIRST failure is the
 * diagnosis, which keeps the result deterministic and explainable - the
 * teacher can always point at the line that failed.
 *
 * The tier is what the teacher actually acts on:
 *   1 Call  - the concept is wrong, pull them to the table
 *   2 Visit - the partials do not match the split at all
 *   3 Check - concept intact, arithmetic slipped
 *   4 None  - correct
 *
 * The distinction that matters most: a student whose ONLY wrong box is the
 * final total understands the property and made a multiplication error. That
 * is tier 3, never tier 1.
 */
export function diagnoseStructuredNumeric(
  spec: StructuredNumericSpec,
  values: readonly (number | null)[],
): StructuredNumericDiagnosis {
  if (spec.mode === "pairs") return diagnosePairs(spec, values);
  const split = studentSplit(spec, values);
  const base = {
    split,
    splitKey: split ? splitKeyFor(split) : null,
  };

  const failed = spec.rules.find((rule) => !ruleHolds(rule, values)) || null;
  if (!failed) {
    return {
      ...base,
      correct: true,
      failedRule: null,
      ruleId: null,
      role: null,
      phrase: "Correct",
      tier: 4,
      misconception: null,
    };
  }

  const role = structuredNumericRuleRole(failed, spec);
  const shared = { ...base, correct: false, failedRule: failed, ruleId: failed.source, role };

  if (role === "whole") {
    return {
      ...shared,
      phrase: "Parts do not add back to the original",
      tier: 1,
      misconception: "changes the whole",
    };
  }

  if (role === "partial") {
    // One partial right and another wrong is the signature of multiplying the
    // first addend and carrying the second one down untouched. If NO partial
    // is right the split itself was never applied, which is a different visit.
    const partialsHeld = spec.rules.some(
      (rule) => rule !== failed
        && structuredNumericRuleRole(rule, spec) === "partial"
        && ruleHolds(rule, values),
    );
    return partialsHeld
      ? {
          ...shared,
          phrase: "Only multiplied one part",
          tier: 1,
          misconception: "distributes to first term only",
        }
      : {
          ...shared,
          phrase: "Partial products do not match the split",
          tier: 2,
          misconception: "distributes to first term only",
        };
  }

  return {
    ...shared,
    phrase: "Arithmetic, concept is fine",
    tier: 3,
    misconception: null,
  };
}

/** The addends the student chose, taken from the first `sum` rule. */
function studentSplit(
  spec: StructuredNumericBoxesSpec,
  values: readonly (number | null)[],
): number[] | null {
  const sumRule = spec.rules.find((rule) => rule.kind === "sum");
  if (!sumRule || sumRule.kind !== "sum") return null;
  const chosen = sumRule.boxes.map((box) => {
    const value = values[box - 1];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  });
  return chosen.every((value): value is number => value !== null) ? chosen : null;
}

/** The flat `values` array read two-at-a-time into distinct, order-independent pairs. */
function pairsFromValues(values: readonly (number | null)[]): [number, number][] {
  const seen = new Set<string>();
  const pairs: [number, number][] = [];
  for (let index = 0; index + 1 < values.length; index += 2) {
    const a = values[index];
    const b = values[index + 1];
    if (typeof a !== "number" || !Number.isFinite(a)) continue;
    if (typeof b !== "number" || !Number.isFinite(b)) continue;
    const [low, high] = a <= b ? [a, b] : [b, a];
    const key = `${low}x${high}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push([low, high]);
  }
  return pairs;
}

function pairKey(a: number, b: number): string {
  return a <= b ? `${a}x${b}` : `${b}x${a}`;
}

/**
 * Diagnose a pairs response.
 *
 * Completeness and correctness are scored on SEPARATE axes, then collapsed into
 * one diagnosis whose PHRASE is what groups students in the tally:
 *   - invented pair present -> "Listed a pair that is not a factor pair" (tier 2
 *     Visit): the student thinks something that is not a factor pair is one. The
 *     more urgent of the two, and it must never merge with a missing-pair row.
 *   - every pair valid but one is missing -> "Missing a factor pair" (tier 3
 *     Check): the concept is intact, they just were not exhaustive.
 *   - complete and nothing invented -> correct (tier 4).
 *
 * No misconception TAG is attached: the seeded vocabulary is Steele's to extend,
 * and the phrase already separates the two groups, which is all the tally needs.
 */
/**
 * Score a pairs submission against the target's reachable factor pairs.
 *
 * Pure, and it needs ONLY the target and the bank - both of which the student
 * device already holds (they cross studentSafeLiveFlow as poll.pairs). That is
 * the whole trick behind the feedback loop: the Chromebook can show a student
 * their own result the instant they submit ("you found 1x18 and 2x9, you missed
 * 3x6"), and the projector can reveal the full rainbow, with NO answer ever
 * sent from the server - the factors of 18 are derivable from 18.
 */
export function reviewPairsSubmission(
  target: number,
  bank: number,
  values: readonly (number | null)[],
): StructuredNumericPairsResult {
  const submitted = pairsFromValues(values);
  const isValid = ([a, b]: [number, number]): boolean =>
    a >= 1 && b >= 1 && a <= bank && b <= bank && a * b === target;
  const valid = submitted.filter(isValid);
  const invented = submitted.filter((pair) => !isValid(pair));
  const validKeys = new Set(valid.map(([a, b]) => pairKey(a, b)));
  const missing = expectedFactorPairs(target, bank).filter(([a, b]) => !validKeys.has(pairKey(a, b)));
  return { submitted, valid, invented, missing, complete: missing.length === 0 };
}

function diagnosePairs(
  spec: StructuredNumericPairsSpec,
  values: readonly (number | null)[],
): StructuredNumericDiagnosis {
  const pairsResult = reviewPairsSubmission(spec.target, spec.bank, values);
  const base = { split: null, splitKey: null, failedRule: null, role: null, pairsResult };

  if (pairsResult.complete && pairsResult.invented.length === 0) {
    return { ...base, correct: true, ruleId: null, phrase: "Correct", tier: 4, misconception: null };
  }
  if (pairsResult.invented.length > 0) {
    return {
      ...base,
      correct: false,
      ruleId: `pairs(${spec.target})`,
      phrase: "Listed a pair that is not a factor pair",
      tier: 2,
      misconception: null,
    };
  }
  return {
    ...base,
    correct: false,
    ruleId: `pairs(${spec.target})`,
    phrase: "Missing a factor pair",
    tier: 3,
    misconception: null,
  };
}

/**
 * Order-independent key for a split, so 20 + 8 and 8 + 20 count as the same
 * decomposition when measuring how much the class converged.
 */
export function splitKeyFor(split: readonly number[]): string {
  return [...split].sort((a, b) => a - b).join("+");
}

export type StructuredNumericSplitConcentration = {
  topKey: string | null;
  count: number;
  total: number;
  /** 0-1. High means the class found one cut and stopped looking. */
  share: number;
};

/**
 * How concentrated the class's splits are.
 *
 * If nearly everyone chose the same cut, flexibility has not landed even among
 * the students who are correct - which is a class-level note, not a per-student
 * one, and is invisible to any single response.
 */
export function structuredNumericSplitConcentration(
  splitKeys: readonly (string | null)[],
): StructuredNumericSplitConcentration {
  const present = splitKeys.filter((key): key is string => Boolean(key));
  if (!present.length) return { topKey: null, count: 0, total: 0, share: 0 };
  const counts = new Map<string, number>();
  for (const key of present) counts.set(key, (counts.get(key) || 0) + 1);
  let topKey = present[0];
  let count = 0;
  for (const [key, keyCount] of counts) {
    if (keyCount > count) {
      topKey = key;
      count = keyCount;
    }
  }
  return { topKey, count, total: present.length, share: count / present.length };
}

export type StructuredNumericResponse = {
  id: string;
  name: string;
  values: readonly (number | null)[];
};

export type StructuredNumericGroup = {
  tier: StructuredNumericTier;
  tierLabel: string;
  /** The error itself - this is the stop, and the sentence the teacher opens with. */
  phrase: string;
  misconception: string | null;
  students: { id: string; name: string }[];
};

export type StructuredNumericSummary = {
  total: number;
  correct: number;
  /** Most urgent first. Tier 2 collapses into ONE row per error, not one per student. */
  groups: StructuredNumericGroup[];
  splits: StructuredNumericSplitConcentration;
  /**
   * Set when routing is the wrong answer: one error holds more than
   * RETEACH_SHARE of the class, so the teacher should stop and reteach rather
   * than walk sixteen names.
   */
  reteachPhrase: string | null;
};

/** Above this share of responses, one shared error means stop and reteach. */
export const STRUCTURED_NUMERIC_RETEACH_SHARE = 0.4;

/**
 * Turn a poll's raw answers into what the teacher acts on.
 *
 * Students are grouped BY THE ERROR, never listed one per row: nine students
 * with the same misconception is one stop with one sentence, not nine visits.
 */
export function summarizeStructuredNumeric(
  spec: StructuredNumericSpec,
  responses: readonly StructuredNumericResponse[],
): StructuredNumericSummary {
  const groups = new Map<string, StructuredNumericGroup>();
  const splitKeys: (string | null)[] = [];
  let correct = 0;

  for (const response of responses) {
    const diagnosis = diagnoseStructuredNumeric(spec, response.values);
    splitKeys.push(diagnosis.splitKey);
    if (diagnosis.correct) {
      correct += 1;
      continue;
    }
    const existing = groups.get(diagnosis.phrase);
    if (existing) {
      existing.students.push({ id: response.id, name: response.name });
    } else {
      groups.set(diagnosis.phrase, {
        tier: diagnosis.tier,
        tierLabel: STRUCTURED_NUMERIC_TIER_LABELS[diagnosis.tier],
        phrase: diagnosis.phrase,
        misconception: diagnosis.misconception,
        students: [{ id: response.id, name: response.name }],
      });
    }
  }

  // Most urgent first, then biggest group - the teacher walks this top down.
  const ordered = [...groups.values()].sort(
    (a, b) => a.tier - b.tier || b.students.length - a.students.length,
  );

  const widest = ordered.reduce<StructuredNumericGroup | null>(
    (worst, group) => (!worst || group.students.length > worst.students.length ? group : worst),
    null,
  );
  const reteachPhrase = widest && responses.length
    && widest.students.length / responses.length > STRUCTURED_NUMERIC_RETEACH_SHARE
    ? widest.phrase
    : null;

  return {
    total: responses.length,
    correct,
    groups: ordered,
    splits: structuredNumericSplitConcentration(splitKeys),
    reteachPhrase,
  };
}

/**
 * Box count only - the single piece of the BOXES spec that is safe to send to a
 * Chromebook. The rules themselves carry the answer (`5=168` IS the product),
 * so they never cross `studentSafeLiveFlow`. Null for a pairs spec or a plain
 * text answer.
 */
export function structuredNumericBoxCount(correctAnswer: string | null | undefined): number | null {
  const parsed = parseStructuredNumericSpec(correctAnswer);
  return parsed.ok && parsed.spec.mode === "boxes" ? parsed.spec.boxes : null;
}

/**
 * The public poll fields for a structured-numeric step - the ONLY part of the
 * spec allowed to cross `studentSafeLiveFlow`. The boxes variant crosses a
 * count; the pairs variant crosses the target and the bank range (the factors
 * are derivable from the target anyway, and the student needs both to answer).
 * The rules, and for boxes the answers they encode, stay teacher-side.
 */
export function structuredNumericPollFields(
  correctAnswer: string | null | undefined,
): { boxes?: number; pairs?: { target: number; bank: number } } {
  const parsed = parseStructuredNumericSpec(correctAnswer);
  if (!parsed.ok) return {};
  if (parsed.spec.mode === "pairs") return { pairs: { target: parsed.spec.target, bank: parsed.spec.bank } };
  return { boxes: parsed.spec.boxes };
}

/**
 * The canonical summary written to `poll_answers.answer`.
 *
 * It stays the FINAL box, because `answer` is exact-matched by City Routes in
 * recommendRoute and by the readiness tallies. Writing a JSON array into that
 * column would silently break both - the structured values go in the separate
 * `values` column instead.
 */
export function canonicalStructuredNumericAnswer(values: readonly (number | null)[]): string {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index];
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

/**
 * A readable, non-empty summary for `poll_answers.answer` on a pairs step.
 *
 * The built pairs live in `values` (the same column the boxes variant uses).
 * `answer` keeps a canonical, order-independent string ("1x18, 2x9, 3x6") so a
 * teacher reading a raw row sees the pairs and the not-empty answer guard
 * passes. It is NEVER exact-matched anywhere - pairs are judged by diagnosis,
 * like every structured-numeric step - so ASCII "x" is fine.
 */
export function canonicalPairsAnswer(values: readonly (number | null)[]): string {
  return pairsFromValues(values)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .map(([a, b]) => `${a}x${b}`)
    .join(", ");
}

/**
 * Count the `[ ]` blanks in a question so the boxes can be rendered inline.
 *
 * Brackets rather than underscores because Notion EATS `___` in a text
 * property - the parser reads triple underscores as formatting and silently
 * deletes them, which once put a broken equation on a projector.
 */
export function structuredNumericBlankCount(question: string | null | undefined): number {
  return (question || "").match(/\[\s*\]/g)?.length || 0;
}

/**
 * Split a question into the text around its `[ ]` blanks.
 * Returns `segments.length === blanks + 1`, so a box goes after every segment
 * but the last.
 */
export function structuredNumericSegments(question: string | null | undefined): string[] {
  return (question || "").split(/\[\s*\]/g);
}
