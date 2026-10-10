/*
 * Limits of the Claude customization data (#2121) — the MCP server's copy of
 * shared/src/services/aiCustomizationLimits.ts (#2118).
 *
 * A copy, not an import: the server builds on its own (tsc + the Worker
 * bundle) and never reaches into shared/src at runtime, the same reason
 * goalAchievement.ts is a copy. The DB CHECKs of
 * supabase/migrations/0037_ai_customization.sql are the last word;
 * checking here first turns a refusal into a sentence Claude can act on
 * instead of a raw 23514. `aiCustomizationLimits.test.ts` runs the same
 * probes through this file and shared's, so the two cannot drift apart.
 *
 * COUNTING. Postgres `char_length` counts code points; JS `.length` counts
 * UTF-16 units. `countChars` counts the way the DB does.
 */

export const AI_RULE_BODY_MAX_CHARS = 40_000;
export const AI_MEMORY_BODY_MAX_CHARS = 1_000;
export const AI_SKILL_SLUG_MAX_CHARS = 64;
export const AI_SKILL_DESCRIPTION_MAX_CHARS = 1_024;
export const AI_SKILL_BODY_MAX_CHARS = 40_000;

export type AiCustomizationIssue =
  "empty" | "tooLong" | "multiline" | "badSlug";

const SLUG_SHAPE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/;
const NOT_BLANK = /\S/;
const LINE_BREAK = /[\r\n]/;

export function countChars(text: string): number {
  return Array.from(text).length;
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

const ISSUE_TEXT: Record<AiCustomizationIssue, (max: number) => string> = {
  empty: () => "must not be empty",
  tooLong: (max) => `is longer than ${max} characters`,
  multiline: () => "must be a single line",
  badSlug: () =>
    "must be kebab-case (lowercase letters and digits joined by single hyphens) " +
    "and not a name Windows reserves (con, prn, aux, nul, com1-9, lpt1-9)",
};

/** Throw the refusal as a sentence naming the field, for Claude to fix and retry. */
export function refuse(
  field: string,
  issue: AiCustomizationIssue,
  max: number,
): never {
  throw new Error(`${field} ${ISSUE_TEXT[issue](max)}`);
}
