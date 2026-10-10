/**
 * Claude customization (#2118, Epic #2117) — what Life Editor hands to the
 * Claude Code it launches: the rules (written out as `.claude/CLAUDE.md`), the
 * memories (one short item each) and the Claude skills (each written out as
 * `.claude/skills/<slug>/SKILL.md`). The DB is the source of truth
 * (D-20261006-main-1); writing the files is #2120.
 *
 * Named `Ai*` so they cannot be confused with the Materials note templates
 * (#1179〜#1181), which the UI also calls templates.
 *
 * Each table owns its `updated_at` (0037 — independent tables, no items_meta
 * row), and deletes are physical: none of the three goes to the Trash.
 */

/** The user's single rules document (one row per user, `ai_rules`). */
export interface AiRule {
  body: string;
  createdAt: string;
  updatedAt: string;
}

/** One remembered item (`ai_memories`). Listed by `sortOrder`. */
export interface AiMemory {
  id: string;
  body: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** One Claude skill (`ai_skills`) — the parts of a SKILL.md. */
export interface AiSkill {
  id: string;
  /** kebab-case. Becomes the SKILL.md `name` and its folder name. */
  slug: string;
  /** One line: tells Claude when to use the skill. */
  description: string;
  /** Markdown, written below the frontmatter. */
  body: string;
  createdAt: string;
  updatedAt: string;
}

/** The fields a caller writes when creating a skill. */
export interface AiSkillInput {
  slug: string;
  description: string;
  body: string;
}

/** Which field of a rule / memory / skill a validation issue is about. */
export type AiCustomizationField = "body" | "slug" | "description";

/**
 * Why a value was refused. `taken` is a slug another of the user's skills
 * already has; the rest are the 0037 CHECKs, checked before the write.
 */
export type AiCustomizationIssue =
  "empty" | "tooLong" | "multiline" | "badSlug" | "taken";
