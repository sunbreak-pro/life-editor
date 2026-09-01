import { randomUUID } from "node:crypto";
import { getSupabase } from "../supabase.js";
import type { ItemRole } from "../utils/items.js";
import { fetchAllPages, fetchByIdChunks } from "../utils/pagination.js";

/*
 * WikiTag handlers — Supabase edition (#360).
 *
 * The legacy SQLite shape keyed assignments by (entity_id, entity_type)
 * and carried a `source` column plus a per-tag `text_color`. The unified
 * schema (0008 + 0022) drops all three:
 *
 *   wiki_tags              id, name, color, icon, is_deleted, …
 *   wiki_tag_assignments   id, item_id -> items_meta(id), tag_id, is_deleted, …
 *
 * So the entity TYPE is no longer stored on the assignment — it is
 * `items_meta.role`, resolved by joining in-app. Both tables are
 * soft-deleted, and `uq_wta_item_tag` only constrains LIVE rows, so
 * re-tagging an item revives the trashed assignment instead of inserting
 * a duplicate.
 */

interface WikiTagRow {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  created_at: string;
  updated_at: string;
}

interface AssignmentRow {
  id: string;
  item_id: string;
  tag_id: string;
  updated_at: string;
}

export interface TagInfo {
  id: string;
  name: string;
  color: string | null;
  icon?: string;
  assignedAt: string;
}

const TAG_COLUMNS = "id, name, color, icon, created_at, updated_at";
const ASSIGNMENT_COLUMNS = "id, item_id, tag_id, updated_at";
const DEFAULT_TAG_COLOR = "#808080";

function formatTag(row: WikiTagRow) {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    icon: row.icon ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toTagInfo(tag: WikiTagRow, assignment: AssignmentRow): TagInfo {
  return {
    id: tag.id,
    name: tag.name,
    color: tag.color,
    icon: tag.icon ?? undefined,
    assignedAt: assignment.updated_at,
  };
}

/**
 * Live assignments for the given item ids. Chunked by id list AND paged
 * within each chunk — one item can carry many tags, so a chunk's result is
 * not bounded by the chunk size.
 */
async function fetchAssignments(itemIds: string[]): Promise<AssignmentRow[]> {
  if (itemIds.length === 0) return [];
  const { client } = await getSupabase();
  return fetchByIdChunks<AssignmentRow>(itemIds, (chunk) =>
    fetchAllPages<AssignmentRow>(
      (from, to) =>
        client
          .from("wiki_tag_assignments")
          .select(ASSIGNMENT_COLUMNS)
          .eq("is_deleted", false)
          .in("item_id", chunk)
          .order("updated_at", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to),
      "wiki_tag_assignments",
    ),
  );
}

/** Live tags by id (1:1 per id, so chunking alone bounds the result). */
async function fetchTagsByIds(
  tagIds: string[],
): Promise<Map<string, WikiTagRow>> {
  const byId = new Map<string, WikiTagRow>();
  if (tagIds.length === 0) return byId;

  const { client } = await getSupabase();
  const rows = await fetchByIdChunks<WikiTagRow>(tagIds, async (chunk) => {
    const { data, error } = await client
      .from("wiki_tags")
      .select(TAG_COLUMNS)
      .eq("is_deleted", false)
      .in("id", chunk);
    if (error) throw new Error(`wiki_tags: ${error.message}`);
    return (data ?? []) as unknown as WikiTagRow[];
  });
  for (const row of rows) byId.set(row.id, row);
  return byId;
}

/** Live tag by exact name, or null. */
async function findTagByName(name: string): Promise<WikiTagRow | null> {
  const { client } = await getSupabase();
  const { data, error } = await client
    .from("wiki_tags")
    .select(TAG_COLUMNS)
    .eq("is_deleted", false)
    .eq("name", name)
    .maybeSingle();
  if (error) throw new Error(`wiki_tags lookup: ${error.message}`);
  return (data as unknown as WikiTagRow | null) ?? null;
}

export async function getTagsForEntity(itemId: string): Promise<TagInfo[]> {
  const assignments = await fetchAssignments([itemId]);
  const tagById = await fetchTagsByIds(assignments.map((a) => a.tag_id));

  const out: TagInfo[] = [];
  for (const a of assignments) {
    const tag = tagById.get(a.tag_id);
    if (tag) out.push(toTagInfo(tag, a));
  }
  return out;
}

/**
 * item id → its tags, for every LIVE item of one role. Replaces the legacy
 * `getTagMapByEntityType` (the entity type now lives on items_meta.role).
 */
export async function getTagMapByRole(
  role: ItemRole,
): Promise<Map<string, TagInfo[]>> {
  const { client } = await getSupabase();
  const metaRows = await fetchAllPages<{ id: string }>(
    (from, to) =>
      client
        .from("items_meta")
        .select("id")
        .eq("role", role)
        .eq("is_deleted", false)
        .order("id", { ascending: true })
        .range(from, to),
    "items_meta by role",
  );

  const itemIds = metaRows.map((m) => m.id);
  const assignments = await fetchAssignments(itemIds);
  const tagById = await fetchTagsByIds(assignments.map((a) => a.tag_id));

  const map = new Map<string, TagInfo[]>();
  for (const a of assignments) {
    const tag = tagById.get(a.tag_id);
    if (!tag) continue;
    const list = map.get(a.item_id) ?? [];
    list.push(toTagInfo(tag, a));
    map.set(a.item_id, list);
  }
  return map;
}

export async function getEntityTags(args: { entity_id: string }) {
  const tags = await getTagsForEntity(args.entity_id);
  return { entityId: args.entity_id, tags };
}

export async function listWikiTags(args: { query?: string }) {
  const { client } = await getSupabase();
  const tags = await fetchAllPages<WikiTagRow>((from, to) => {
    let query = client
      .from("wiki_tags")
      .select(TAG_COLUMNS)
      .eq("is_deleted", false);
    if (args.query) query = query.ilike("name", `%${args.query}%`);
    return query
      .order("name", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to);
  }, "list wiki_tags");
  if (tags.length === 0) return [];

  // Usage counts in one pass over the live assignments of these tags.
  const assignmentRows = await fetchByIdChunks<{ tag_id: string }>(
    tags.map((t) => t.id),
    (chunk) =>
      fetchAllPages<{ tag_id: string }>(
        (from, to) =>
          client
            .from("wiki_tag_assignments")
            .select("id, tag_id")
            .eq("is_deleted", false)
            .in("tag_id", chunk)
            .order("id", { ascending: true })
            .range(from, to),
        "assignment counts",
      ),
  );

  const countByTag = new Map<string, number>();
  for (const row of assignmentRows) {
    countByTag.set(row.tag_id, (countByTag.get(row.tag_id) ?? 0) + 1);
  }

  return tags.map((tag) => ({
    ...formatTag(tag),
    usageCount: countByTag.get(tag.id) ?? 0,
  }));
}

export async function tagEntity(args: {
  tag_name: string;
  entity_id: string;
  entity_type?: string;
}) {
  const { client, userId } = await getSupabase();

  // The entity type is items_meta.role now; a caller-supplied entity_type
  // is validated against it rather than stored.
  const { data: meta, error: mErr } = await client
    .from("items_meta")
    .select("id, role")
    .eq("id", args.entity_id)
    .eq("is_deleted", false)
    .maybeSingle();
  if (mErr) throw new Error(`items_meta lookup: ${mErr.message}`);
  if (!meta) throw new Error(`Item not found: ${args.entity_id}`);
  const role = (meta as { role: string }).role;
  if (args.entity_type && args.entity_type !== role) {
    throw new Error(
      `Item ${args.entity_id} is a "${role}", not a "${args.entity_type}"`,
    );
  }

  const now = new Date().toISOString();
  let tag = await findTagByName(args.tag_name);
  if (!tag) {
    const id = `tag-${randomUUID()}`;
    const { error } = await client.from("wiki_tags").insert({
      id,
      user_id: userId,
      name: args.tag_name,
      color: DEFAULT_TAG_COLOR,
      is_deleted: false,
      deleted_at: null,
    });
    if (error) throw new Error(`create wiki_tag: ${error.message}`);
    tag = await findTagByName(args.tag_name);
    if (!tag)
      throw new Error(
        `create wiki_tag: "${args.tag_name}" not readable after insert`,
      );
  }

  // uq_wta_item_tag only constrains live rows: revive a trashed assignment
  // instead of inserting a second one for the same pair.
  const { data: existing, error: exErr } = await client
    .from("wiki_tag_assignments")
    .select("id, is_deleted")
    .eq("item_id", args.entity_id)
    .eq("tag_id", tag.id)
    .maybeSingle();
  if (exErr) throw new Error(`assignment lookup: ${exErr.message}`);

  if (existing) {
    const row = existing as { id: string; is_deleted: boolean };
    if (row.is_deleted) {
      const { error } = await client
        .from("wiki_tag_assignments")
        .update({ is_deleted: false, deleted_at: null, updated_at: now })
        .eq("id", row.id);
      if (error) throw new Error(`revive assignment: ${error.message}`);
    }
  } else {
    const { error } = await client.from("wiki_tag_assignments").insert({
      id: `tag_assign-${randomUUID()}`,
      user_id: userId,
      item_id: args.entity_id,
      tag_id: tag.id,
      is_deleted: false,
      deleted_at: null,
    });
    if (error) throw new Error(`create assignment: ${error.message}`);
  }

  return {
    tag: formatTag(tag),
    entityId: args.entity_id,
    entityType: role,
  };
}

/**
 * The inverse of `tagEntity` (#782 ①). That one revives a trashed assignment
 * rather than inserting a duplicate, so this one only trashes the live row —
 * the pair keeps working after any number of tag/untag cycles. `wiki_tags`
 * itself is left alone: other items may still carry the tag.
 */
export async function untagEntity(args: {
  tag_name: string;
  entity_id: string;
}) {
  const tag = await findTagByName(args.tag_name);
  // Nothing to remove is the state the caller asked for, not an error.
  if (!tag) return { removed: false };

  const { client } = await getSupabase();
  const { data, error } = await client
    .from("wiki_tag_assignments")
    .select("id")
    .eq("item_id", args.entity_id)
    .eq("tag_id", tag.id)
    .eq("is_deleted", false)
    .maybeSingle();
  if (error) throw new Error(`assignment lookup: ${error.message}`);
  if (!data) return { removed: false };

  const now = new Date().toISOString();
  const { error: uErr } = await client
    .from("wiki_tag_assignments")
    .update({ is_deleted: true, deleted_at: now, updated_at: now })
    .eq("id", (data as { id: string }).id);
  if (uErr) throw new Error(`remove assignment: ${uErr.message}`);

  return { removed: true, tag: formatTag(tag), entityId: args.entity_id };
}

export async function searchByTag(args: {
  tag_name: string;
  entity_type?: string;
}) {
  const tag = await findTagByName(args.tag_name);
  if (!tag) return { tag: null, results: [] };

  const { client } = await getSupabase();
  const assignments = await fetchAllPages<AssignmentRow>(
    (from, to) =>
      client
        .from("wiki_tag_assignments")
        .select(ASSIGNMENT_COLUMNS)
        .eq("is_deleted", false)
        .eq("tag_id", tag.id)
        .order("id", { ascending: true })
        .range(from, to),
    "assignments by tag",
  );
  if (assignments.length === 0) return { tag: formatTag(tag), results: [] };

  interface TaggedMeta {
    id: string;
    role: string;
    title: string;
    created_at: string;
  }
  const metaRows = await fetchByIdChunks<TaggedMeta>(
    assignments.map((a) => a.item_id),
    async (chunk) => {
      const { data, error } = await client
        .from("items_meta")
        .select("id, role, title, created_at")
        .eq("is_deleted", false)
        .in("id", chunk);
      if (error) throw new Error(`tagged items_meta: ${error.message}`);
      return (data ?? []) as TaggedMeta[];
    },
  );

  const metaById = new Map<string, TaggedMeta>();
  for (const m of metaRows) {
    if (args.entity_type && m.role !== args.entity_type) continue;
    metaById.set(m.id, m);
  }
  if (metaById.size === 0) return { tag: formatTag(tag), results: [] };

  // Per-role payload details, mirroring the columns the legacy handler
  // surfaced (todo: status/schedule, daily: date, note: meta only).
  const ids = [...metaById.keys()];
  const todoIds = ids.filter((id) => metaById.get(id)?.role === "task");
  const dailyIds = ids.filter((id) => metaById.get(id)?.role === "daily");

  const [todoDetail, dailyDetail] = await Promise.all([
    (async () => {
      const map = new Map<string, Record<string, unknown>>();
      const rows = await fetchByIdChunks<{
        item_id: string;
        status: string | null;
        scheduled_at: string | null;
      }>(todoIds, async (chunk) => {
        const { data, error } = await client
          .from("tasks_payload")
          .select("item_id, status, scheduled_at")
          .in("item_id", chunk);
        if (error) throw new Error(`tagged tasks_payload: ${error.message}`);
        return (data ?? []) as Array<{
          item_id: string;
          status: string | null;
          scheduled_at: string | null;
        }>;
      });
      for (const row of rows) {
        map.set(row.item_id, {
          status: row.status === null ? null : row.status.toLowerCase(),
          scheduledAt: row.scheduled_at,
        });
      }
      return map;
    })(),
    (async () => {
      const map = new Map<string, Record<string, unknown>>();
      const rows = await fetchByIdChunks<{ item_id: string; date: string }>(
        dailyIds,
        async (chunk) => {
          const { data, error } = await client
            .from("dailies_payload")
            .select("item_id, date")
            .in("item_id", chunk);
          if (error)
            throw new Error(`tagged dailies_payload: ${error.message}`);
          return (data ?? []) as Array<{ item_id: string; date: string }>;
        },
      );
      for (const row of rows) map.set(row.item_id, { date: row.date });
      return map;
    })(),
  ]);

  const results = [];
  for (const a of assignments) {
    const meta = metaById.get(a.item_id);
    if (!meta) continue;
    results.push({
      entityId: meta.id,
      entityType: meta.role,
      assignedAt: a.updated_at,
      entity: {
        id: meta.id,
        title: meta.title,
        createdAt: meta.created_at,
        ...(todoDetail.get(meta.id) ?? {}),
        ...(dailyDetail.get(meta.id) ?? {}),
      },
    });
  }

  return { tag: formatTag(tag), results };
}
