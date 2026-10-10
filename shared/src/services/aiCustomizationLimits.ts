import type {
  AiCustomizationField,
  AiCustomizationIssue,
  AiSkillInput,
} from "../types/aiCustomization";

/*
 * Size and shape limits of the Claude customization data (#2118).
 *
 * The SAME numbers are CHECK constraints in
 * supabase/migrations/0037_ai_customization.sql — the DB is the last word,
 * these are what the service checks before writing (so a refusal names the
 * field instead of surfacing as a raw 23514) and what the editing screen
 * (#2119) shows as the remaining count. `aiCustomizationLimits.test.ts` reads
 * the migration and fails if the two drift apart.
 *
 * COUNTING. Postgres `char_length` counts characters (code points). JS
 * `string.length` counts UTF-16 units, so an emoji is 1 for the DB and 2 for
 * `.length` — a body at the limit would pass the DB and fail here, or the
 * reverse. `countChars` counts code points, the way the DB does.
 */

/** Rules (`.claude/CLAUDE.md`). Claude Code warns about a CLAUDE.md past 40k characters. */
export const AI_RULE_BODY_MAX_CHARS = 40_000;
/** One memory item. */
export const AI_MEMORY_BODY_MAX_CHARS = 1_000;
/** Skill name = SKILL.md `name` and its folder name. */
export const AI_SKILL_SLUG_MAX_CHARS = 64;
/** SKILL.md `description` (the same ceiling Claude skills have). */
export const AI_SKILL_DESCRIPTION_MAX_CHARS = 1_024;
/** SKILL.md body. */
export const AI_SKILL_BODY_MAX_CHARS = 40_000;

/** Lowercase letters and digits, joined by single hyphens (0037 `ai_skills_slug_shape`). */
const SLUG_SHAPE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** Folder names Windows refuses (0037 `ai_skills_slug_not_reserved`). */
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/;
/**
 * Has at least one non-space character. Stricter than 0037 `[^[:space:]]`:
 * JS `\s` also counts NBSP / U+FEFF as space, which the DB locale may not, so
 * the app refuses a few bodies the DB would take — never the reverse.
 */
const NOT_BLANK = /\S/;
const LINE_BREAK = /[\r\n]/;

/** Characters as Postgres `char_length` counts them (code points). */
export function countChars(text: string): number {
  return Array.from(text).length;
}

export function aiRuleBodyIssue(body: string): AiCustomizationIssue | null {
  return countChars(body) > AI_RULE_BODY_MAX_CHARS ? "tooLong" : null;
}

export function aiMemoryBodyIssue(body: string): AiCustomizationIssue | null {
  if (!NOT_BLANK.test(body)) return "empty";
  return countChars(body) > AI_MEMORY_BODY_MAX_CHARS ? "tooLong" : null;
}

export function aiSkillSlugIssue(slug: string): AiCustomizationIssue | null {
  if (slug === "") return "empty";
  if (countChars(slug) > AI_SKILL_SLUG_MAX_CHARS) return "tooLong";
  return SLUG_SHAPE.test(slug) && !WINDOWS_RESERVED.test(slug)
    ? null
    : "badSlug";
}

export function aiSkillDescriptionIssue(
  description: string,
): AiCustomizationIssue | null {
  if (!NOT_BLANK.test(description)) return "empty";
  if (LINE_BREAK.test(description)) return "multiline";
  return countChars(description) > AI_SKILL_DESCRIPTION_MAX_CHARS
    ? "tooLong"
    : null;
}

export function aiSkillBodyIssue(body: string): AiCustomizationIssue | null {
  return countChars(body) > AI_SKILL_BODY_MAX_CHARS ? "tooLong" : null;
}

/** Issues of the fields present in `input`, keyed by field. Empty = all fine. */
export function aiSkillIssues(
  input: Partial<AiSkillInput>,
): Partial<Record<AiCustomizationField, AiCustomizationIssue>> {
  const issues: Partial<Record<AiCustomizationField, AiCustomizationIssue>> =
    {};
  const slug = input.slug === undefined ? null : aiSkillSlugIssue(input.slug);
  if (slug) issues.slug = slug;
  const description =
    input.description === undefined
      ? null
      : aiSkillDescriptionIssue(input.description);
  if (description) issues.description = description;
  const body = input.body === undefined ? null : aiSkillBodyIssue(input.body);
  if (body) issues.body = body;
  return issues;
}

/**
 * A value the service refused before (or, for `taken`, instead of) the write.
 * Carries the field and the reason so the editing screen can word it.
 */
export class AiCustomizationValidationError extends Error {
  constructor(
    readonly field: AiCustomizationField,
    readonly issue: AiCustomizationIssue,
    label: string,
  ) {
    super(`${label}: ${field} is ${issue}`);
    this.name = "AiCustomizationValidationError";
  }
}

/** Throws for the first issue in `issues` (slug, then description, then body). */
export function throwFirstAiIssue(
  issues: Partial<Record<AiCustomizationField, AiCustomizationIssue>>,
  label: string,
): void {
  for (const field of ["slug", "description", "body"] as const) {
    const issue = issues[field];
    if (issue) throw new AiCustomizationValidationError(field, issue, label);
  }
}
