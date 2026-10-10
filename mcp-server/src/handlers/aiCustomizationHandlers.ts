import { randomUUID } from "node:crypto";
import { getSupabase } from "../supabase.js";
import {
  AI_MEMORY_BODY_MAX_CHARS,
  AI_SKILL_BODY_MAX_CHARS,
  AI_SKILL_DESCRIPTION_MAX_CHARS,
  AI_SKILL_SLUG_MAX_CHARS,
  aiMemoryBodyIssue,
  aiSkillBodyIssue,
  aiSkillDescriptionIssue,
  aiSkillSlugIssue,
  refuse,
} from "../utils/aiCustomization.js";
import { fetchAllPages } from "../utils/pagination.js";

/*
 * Claude customization handlers (#2121, Epic #2117 R4) — how the Claude Code
 * that Life Editor launched writes back what it learned, so the phone sees it
 * at once (D-20261006-main-1 Q1 = MCP straight into the DB).
 *
 * Storage is migration 0037: three independent tables, each row owning its
 * `updated_at` (no items_meta row, no Trash). The app's half is
 * shared/src/services/SupabaseAiCustomizationService.ts; ids, the append
 * order and the limits match it.
 *
 * WHAT CLAUDE MAY DO. Read all three; add and update memories one item at a
 * time; create and update skills. Nothing here deletes, and the rules are
 * read-only — the rules are the user's own instructions to Claude, and a
 * delete has no Trash to come back from (0037 deletes physically). Removing
 * stays in the app's editing screen (#2119).
 *
 * WHOSE ROWS. RLS (owner-only, 0037) is what keeps another user's rows out.
 * Every query here also filters on the signed-in `user_id` and every insert
 * names it, so a policy that went missing would not quietly widen what a
 * tool reads or rewrites.
 */

interface AiMemoryRow {
  id: string;
  body: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface AiSkillRow {
  id: string;
  slug: string;
  description: string;
  body: string;
  created_at: string;
  updated_at: string;
}

const MEMORY_COLUMNS = "id, body, sort_order, created_at, updated_at";
const SKILL_COLUMNS = "id, slug, description, body, created_at, updated_at";

/** Postgres unique_violation — ai_skills (user_id, slug). */
const UNIQUE_VIOLATION = "23505";

function formatMemory(row: AiMemoryRow) {
  return {
    id: row.id,
    body: row.body,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function formatSkill(row: AiSkillRow) {
  return {
    id: row.id,
    slug: row.slug,
    description: row.description,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function checkMemoryBody(body: string): void {
  const issue = aiMemoryBodyIssue(body);
  if (issue) refuse("body", issue, AI_MEMORY_BODY_MAX_CHARS);
}

function checkSlug(field: string, slug: string): void {
  const issue = aiSkillSlugIssue(slug);
  if (issue) refuse(field, issue, AI_SKILL_SLUG_MAX_CHARS);
}

function checkDescription(description: string): void {
  const issue = aiSkillDescriptionIssue(description);
  if (issue) refuse("description", issue, AI_SKILL_DESCRIPTION_MAX_CHARS);
}

function checkSkillBody(body: string): void {
  const issue = aiSkillBodyIssue(body);
  if (issue) refuse("body", issue, AI_SKILL_BODY_MAX_CHARS);
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

/** The rules document. Never creates the row (a read does not write, #499). */
export async function getAiRules() {
  const { client, userId } = await getSupabase();
  const { data, error } = await client
    .from("ai_rules")
    .select("body, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`get_ai_rules: ${error.message}`);
  const row = data as { body: string; updated_at: string } | null;
  return { body: row?.body ?? "", updatedAt: row?.updated_at ?? null };
}

// ---------------------------------------------------------------------------
// Memories
// ---------------------------------------------------------------------------

export async function listAiMemories() {
  const { client, userId } = await getSupabase();
  const rows = await fetchAllPages<AiMemoryRow>(
    (from, to) =>
      client
        .from("ai_memories")
        .select(MEMORY_COLUMNS)
        .eq("user_id", userId)
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    "ai_memories",
  );
  return { memories: rows.map(formatMemory) };
}

/** Appends at the end of the list (sort_order = current max + 1), like the app. */
export async function addAiMemory(args: { body: string }) {
  checkMemoryBody(args.body);
  const { client, userId } = await getSupabase();

  const { data: last, error: lastErr } = await client
    .from("ai_memories")
    .select("sort_order")
    .eq("user_id", userId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastErr) throw new Error(`add_ai_memory read: ${lastErr.message}`);
  const sortOrder =
    ((last as { sort_order: number } | null)?.sort_order ?? -1) + 1;

  const { data, error } = await client
    .from("ai_memories")
    .insert({
      id: `aimemory-${randomUUID()}`,
      user_id: userId,
      body: args.body,
      sort_order: sortOrder,
    })
    .select(MEMORY_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(`add_ai_memory: ${error.message}`);
  if (!data) throw new Error("add_ai_memory: the new memory was not returned");
  return formatMemory(data as AiMemoryRow);
}

export async function updateAiMemory(args: { id: string; body: string }) {
  checkMemoryBody(args.body);
  const { client, userId } = await getSupabase();
  const { data, error } = await client
    .from("ai_memories")
    .update({ body: args.body, updated_at: new Date().toISOString() })
    .eq("id", args.id)
    .eq("user_id", userId)
    .select(MEMORY_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(`update_ai_memory: ${error.message}`);
  if (!data) throw new Error(`Memory not found: ${args.id}`);
  return formatMemory(data as AiMemoryRow);
}

// ---------------------------------------------------------------------------
// Claude skills
// ---------------------------------------------------------------------------

/** Name and description only — get_ai_skill returns a body. */
export async function listAiSkills() {
  const { client, userId } = await getSupabase();
  const rows = await fetchAllPages<AiSkillRow>(
    (from, to) =>
      client
        .from("ai_skills")
        .select(SKILL_COLUMNS)
        .eq("user_id", userId)
        .order("slug", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    "ai_skills",
  );
  return {
    skills: rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      description: row.description,
      updatedAt: row.updated_at,
    })),
  };
}

async function findSkillBySlug(slug: string): Promise<AiSkillRow | null> {
  const { client, userId } = await getSupabase();
  const { data, error } = await client
    .from("ai_skills")
    .select(SKILL_COLUMNS)
    .eq("user_id", userId)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`ai_skills lookup: ${error.message}`);
  return (data as AiSkillRow | null) ?? null;
}

export async function getAiSkill(args: { slug: string }) {
  const row = await findSkillBySlug(args.slug);
  if (!row) throw new Error(`Skill not found: ${args.slug}`);
  return formatSkill(row);
}

function takenError(slug: string): Error {
  return new Error(
    `A skill named "${slug}" already exists — pick another name, or change it with update_ai_skill`,
  );
}

export async function createAiSkill(args: {
  slug: string;
  description: string;
  body?: string;
}) {
  const body = args.body ?? "";
  checkSlug("slug", args.slug);
  checkDescription(args.description);
  checkSkillBody(body);
  if (await findSkillBySlug(args.slug)) throw takenError(args.slug);

  const { client, userId } = await getSupabase();
  const { data, error } = await client
    .from("ai_skills")
    .insert({
      id: `aiskill-${randomUUID()}`,
      user_id: userId,
      slug: args.slug,
      description: args.description,
      body,
    })
    .select(SKILL_COLUMNS)
    .maybeSingle();
  if (error) {
    if (error.code === UNIQUE_VIOLATION) throw takenError(args.slug);
    throw new Error(`create_ai_skill: ${error.message}`);
  }
  if (!data) throw new Error("create_ai_skill: the new skill was not returned");
  return formatSkill(data as AiSkillRow);
}

export async function updateAiSkill(args: {
  slug: string;
  new_slug?: string;
  description?: string;
  body?: string;
}) {
  if (
    args.new_slug === undefined &&
    args.description === undefined &&
    args.body === undefined
  ) {
    throw new Error(
      "update_ai_skill: nothing to change — pass new_slug, description or body",
    );
  }
  if (args.new_slug !== undefined) checkSlug("new_slug", args.new_slug);
  if (args.description !== undefined) checkDescription(args.description);
  if (args.body !== undefined) checkSkillBody(args.body);

  const current = await findSkillBySlug(args.slug);
  if (!current) throw new Error(`Skill not found: ${args.slug}`);
  if (args.new_slug !== undefined && args.new_slug !== args.slug) {
    if (await findSkillBySlug(args.new_slug)) throw takenError(args.new_slug);
  }

  const patch: Record<string, string> = {
    updated_at: new Date().toISOString(),
  };
  if (args.new_slug !== undefined) patch.slug = args.new_slug;
  if (args.description !== undefined) patch.description = args.description;
  if (args.body !== undefined) patch.body = args.body;

  const { client, userId } = await getSupabase();
  const { data, error } = await client
    .from("ai_skills")
    .update(patch)
    .eq("id", current.id)
    .eq("user_id", userId)
    .select(SKILL_COLUMNS)
    .maybeSingle();
  if (error) {
    if (error.code === UNIQUE_VIOLATION && args.new_slug !== undefined)
      throw takenError(args.new_slug);
    throw new Error(`update_ai_skill: ${error.message}`);
  }
  if (!data) throw new Error(`Skill not found: ${args.slug}`);
  return formatSkill(data as AiSkillRow);
}
