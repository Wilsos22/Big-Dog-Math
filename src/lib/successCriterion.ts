export const SUCCESS_CRITERION_SETUP_PLACEHOLDER = "Choose one I can statement in Notion.";

export type SelectedSuccessCriterionIssue = "missing" | "multiple" | "not-i-can" | null;

export interface SelectedSuccessCriterionInspection {
  criterion: string;
  issue: SelectedSuccessCriterionIssue;
  message: string | null;
}

function normalizeCriterionLine(value: string): string {
  return value
    .trim()
    .replace(/^(?:[-*]|\d+[.)])\s+/, "")
    .replace(/\s+/g, " ")
    .replace(/^i\s+can\b/i, "I can");
}

/**
 * Validate the lesson-level Selected Success Criterion field.
 *
 * The legacy Success Criteria field can contain a menu of options. It must
 * never be used here: this helper accepts only the deliberately selected
 * lesson statement and requires one complete, line-based I can statement.
 */
export function inspectSelectedSuccessCriterion(
  value: string | null | undefined,
): SelectedSuccessCriterionInspection {
  const lines = (value || "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map(normalizeCriterionLine)
    .filter(Boolean);

  if (lines.length === 0) {
    return {
      criterion: "",
      issue: "missing",
      message: "Choose one Selected Success Criterion in Notion before saving or starting this lesson.",
    };
  }

  if (lines.length > 1 || (lines[0].match(/\bI\s+can\b/gi)?.length || 0) > 1) {
    return {
      criterion: "",
      issue: "multiple",
      message: "Selected Success Criterion must contain exactly one I can statement on one line.",
    };
  }

  const criterion = lines[0];
  if (!/^I can(?:\s|$)/.test(criterion)) {
    return {
      criterion: "",
      issue: "not-i-can",
      message: "Selected Success Criterion must be written as one I can statement.",
    };
  }

  return { criterion, issue: null, message: null };
}

export function selectedSuccessCriterion(
  value: string | null | undefined,
): string {
  return inspectSelectedSuccessCriterion(value).criterion;
}

export function publicSuccessCriterion(
  value: string | null | undefined,
): string {
  return selectedSuccessCriterion(value) || SUCCESS_CRITERION_SETUP_PLACEHOLDER;
}

export function selectedSuccessCriterionValidationMessage(
  value: string | null | undefined,
): string | null {
  return inspectSelectedSuccessCriterion(value).message;
}

/**
 * The success CRITERIA - the plural field - as a list of normalized "I can"
 * statements, one per line.
 *
 * This is the opposite job from `selectedSuccessCriterion`, which deliberately
 * refuses a menu because the lesson flow needs exactly one target. A display
 * surface wants all of them: the criteria are what a student checks their own
 * work against, and there is normally more than one.
 *
 * Every line comes back stemmed "I can ..." - that is the classroom convention
 * and the whole point of the field - and the setup placeholder is dropped,
 * because prompting the teacher to go author something belongs on a teacher
 * surface and never on a wall.
 */
export function successCriteriaList(value: string | null | undefined): string[] {
  return (value || "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map(normalizeCriterionLine)
    .filter((line) => line && line !== SUCCESS_CRITERION_SETUP_PLACEHOLDER)
    .map((line) => (/^I can(?:\s|$)/.test(line)
      ? line
      : `I can ${line.charAt(0).toLocaleLowerCase()}${line.slice(1)}`));
}
