import type {
  AiMemory,
  AiRule,
  AiSkill,
  AiSkillInput,
} from "../types/aiCustomization";

/*
 * Pure row <-> type mapping for the Claude customization tables (0037 / #2118):
 * ai_rules (one row per user), ai_memories, ai_skills. No I/O — the service is
 * SupabaseAiCustomizationService.
 *
 * Independent tables (the 0018 shape): each row owns its `updated_at`, so
 * every patch built here sets it (DB-Q2's "always bump" applied to the row's
 * own cursor — there is no items_meta row). `user_id` is never written; the
 * DB default is auth.uid().
 */

// ---------------------------------------------------------------------------
// 1. ai_rules
// ---------------------------------------------------------------------------

export interface AiRuleRow {
  user_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export const AI_RULE_COLUMNS = "user_id, body, created_at, updated_at";

export function rowToAiRule(row: AiRuleRow): AiRule {
  return {
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * The upsert row. `user_id` is left to the DB default, which is also the
 * conflict target — the same shape `sound_settings` upserts with.
 */
export function aiRuleToUpsert(
  body: string,
  now: string,
): { body: string; updated_at: string } {
  return { body, updated_at: now };
}

// ---------------------------------------------------------------------------
// 2. ai_memories
// ---------------------------------------------------------------------------

export interface AiMemoryRow {
  id: string;
  user_id: string;
  body: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const AI_MEMORY_COLUMNS =
  "id, user_id, body, sort_order, created_at, updated_at";

export function rowToAiMemory(row: AiMemoryRow): AiMemory {
  return {
    id: row.id,
    body: row.body,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function aiMemoryToInsert(
  id: string,
  body: string,
  sortOrder: number,
): { id: string; body: string; sort_order: number } {
  return { id, body, sort_order: sortOrder };
}

// ---------------------------------------------------------------------------
// 3. ai_skills
// ---------------------------------------------------------------------------

export interface AiSkillRow {
  id: string;
  user_id: string;
  slug: string;
  description: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export const AI_SKILL_COLUMNS =
  "id, user_id, slug, description, body, created_at, updated_at";

export function rowToAiSkill(row: AiSkillRow): AiSkill {
  return {
    id: row.id,
    slug: row.slug,
    description: row.description,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function aiSkillToInsert(
  id: string,
  input: AiSkillInput,
): { id: string } & AiSkillInput {
  return {
    id,
    slug: input.slug,
    description: input.description,
    body: input.body,
  };
}

export type AiSkillUpdatePatch = Partial<AiSkillInput> & { updated_at: string };

/** Only the keys present in `updates`, plus the unconditional `updated_at`. */
export function aiSkillUpdatesToPatch(
  updates: Partial<AiSkillInput>,
  now: string,
): AiSkillUpdatePatch {
  const patch: AiSkillUpdatePatch = { updated_at: now };
  if (updates.slug !== undefined) patch.slug = updates.slug;
  if (updates.description !== undefined)
    patch.description = updates.description;
  if (updates.body !== undefined) patch.body = updates.body;
  return patch;
}

/**
 * The SKILL.md file a skill is written out as (#2120 writes it to
 * `.claude/skills/<slug>/SKILL.md`).
 *
 * Both values are emitted as JSON strings, which are also valid YAML
 * double-quoted scalars. A description holding `: `, `#` or a leading quote
 * would otherwise change how the frontmatter parses, and a kebab-case slug
 * such as `123`, `true` or `null` would be read as a number / boolean /
 * null instead of a name.
 */
export function aiSkillToSkillMarkdown(
  skill: Pick<AiSkill, "slug" | "description" | "body">,
): string {
  const body = skill.body.replace(/\r\n/g, "\n");
  const lines = [
    "---",
    `name: ${JSON.stringify(skill.slug)}`,
    `description: ${JSON.stringify(skill.description)}`,
    "---",
    "",
  ];
  if (body !== "") lines.push(body.endsWith("\n") ? body.slice(0, -1) : body);
  return `${lines.join("\n")}\n`;
}
