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

export type StructuredNumericSpec = {
  /** How many inputs to render. */
  boxes: number;
  /** Evaluated in authored order - the FIRST failing rule is the diagnosis. */
  rules: StructuredNumericRule[];
};

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
};

export const STRUCTURED_NUMERIC_TIER_LABELS: Record<StructuredNumericTier, string> = {
  1: "Call",
  2: "Visit",
  3: "Check",
  4: "None",
};

const RULE_SYNTAX_HELP =
  "Use one rule per line: boxes: N, sum(a,b)=N, a=K*b, or a=N.";

const MAX_BOXES = 12;

const BOXES_LINE = /^boxes\s*:\s*(\d+)$/i;
const SUM_LINE = /^sum\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)\s*=\s*(-?\d+)$/i;
const MULTIPLE_LINE = /^(\d+)\s*=\s*(-?\d+)\s*\*\s*(\d+)$/;
const EQUALS_LINE = /^(\d+)\s*=\s*(-?\d+)$/;

/**
 * Parse an authored answer spec.
 *
 * Deliberately NOT an expression evaluator - four fixed forms is the whole
 * grammar. Anything else is a parse error, and a parse error must fail LOUDLY
 * in the control panel load message. Silently accepting a malformed spec would
 * mark a whole class wrong on a rule nobody wrote.
 */
export function parseStructuredNumericSpec(text: string | null | undefined): StructuredNumericParse {
  const errors: string[] = [];
  const rules: StructuredNumericRule[] = [];
  let boxes: number | null = null;

  const lines = (text || "").split(/\r?\n/);
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
  return { ok: true, spec: { boxes, rules } };
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
  spec: StructuredNumericSpec,
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
  spec: StructuredNumericSpec,
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
 * Box count only - the single piece of the spec that is safe to send to a
 * Chromebook. The rules themselves carry the answer (`5=168` IS the product),
 * so they never cross `studentSafeLiveFlow`.
 */
export function structuredNumericBoxCount(correctAnswer: string | null | undefined): number | null {
  const parsed = parseStructuredNumericSpec(correctAnswer);
  return parsed.ok ? parsed.spec.boxes : null;
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
