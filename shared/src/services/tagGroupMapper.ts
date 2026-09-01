import type { TagGroupNode } from "../types/tagGroup";

/*
 * Pure TagGroupNode <-> (`public.wiki_tag_groups`,
 * `public.wiki_tag_group_assignments`) row mappers (#1173). NO
 * `@supabase/supabase-js` dependency.
 *
 * A group spans TWO tables, so unlike `calendarMapper` this is not a
 * bijection over one row: the domain node is stitched from a group row plus
 * its live membership rows. `rowsToTagGroups` owns that stitch so the service
 * never hand-rolls the join, and the unit suite can pin the ordering rules
 * without a client.
 *
 * Schema source of truth: `supabase/migrations/0008_data_unification_
 * schema.sql` tables 10 + 11. No DDL was added for #1173 — both tables were
 * created there and had stayed unused (0 rows) until this feature.
 */

/**
 * SELECTED row shape of `public.wiki_tag_groups`. `user_id` is server-derived
 * (RLS default `auth.uid()`). The table's `version` column is deliberately
 * absent: it is a Tauri-era leftover nothing reads, and `updated_at` is the
 * sync cursor (CLAUDE.md §3.3 / #1385).
 */
export interface TagGroupRow {
  id: string;
  user_id: string;
  name: string;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

/** SELECTED row shape of `public.wiki_tag_group_assignments`. */
export interface TagGroupAssignmentRow {
  id: string;
  user_id: string;
  tag_id: string;
  group_id: string;
  updated_at: string;
  is_deleted: boolean;
  deleted_at: string | null;
}

/**
 * Column lists for SELECTs — plain real column names only (no SQL
 * expression; the S2 recurrence-prevention rule).
 */
export const TAG_GROUP_SELECT_COLUMNS =
  "id, user_id, name, is_deleted, deleted_at, created_at, updated_at";

export const TAG_GROUP_ASSIGNMENT_SELECT_COLUMNS =
  "id, user_id, tag_id, group_id, updated_at, is_deleted, deleted_at";

/**
 * Stitch group rows + membership rows into domain nodes.
 *
 * Both inputs are expected to be the ALREADY live-filtered lists (the service
 * asks PostgREST for `is_deleted = false` on each). Memberships whose
 * `group_id` matches no supplied group are dropped rather than inventing a
 * group — a membership can outlive its group by one soft delete, and a
 * phantom group in the picker is worse than a missing chip.
 *
 * `tagIds` keeps the order the assignment rows arrive in (the service orders
 * them by `id`), and de-duplicates: the partial UNIQUE only constrains LIVE
 * rows, so a tag removed and re-added is two rows, one of them dead — but a
 * concurrent double-add on two devices can still land two live ones, and a
 * duplicate id would then count that tag twice in a member-set union.
 */
export function rowsToTagGroups(
  groups: readonly TagGroupRow[],
  assignments: readonly TagGroupAssignmentRow[],
): TagGroupNode[] {
  const byGroup = new Map<string, string[]>();
  for (const g of groups) byGroup.set(g.id, []);
  for (const a of assignments) {
    const bucket = byGroup.get(a.group_id);
    if (!bucket) continue;
    if (!bucket.includes(a.tag_id)) bucket.push(a.tag_id);
  }
  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    tagIds: byGroup.get(g.id) ?? [],
    createdAt: g.created_at,
    updatedAt: g.updated_at,
  }));
}

/**
 * Build a snake_case patch from a partial TagGroupNode update. Only keys
 * PRESENT on `updates` are emitted (Issue 020 partial-payload safety).
 * `tagIds` is NOT here — memberships are rows in the other table, and the
 * service reconciles them separately.
 */
export function tagGroupUpdatesToPatch(
  updates: Partial<Pick<TagGroupNode, "name">>,
): Partial<Pick<TagGroupRow, "name">> {
  const patch: Partial<Pick<TagGroupRow, "name">> = {};
  if ("name" in updates && updates.name !== undefined)
    patch.name = updates.name;
  return patch;
}

/**
 * Which membership rows have to change to take a group from `current` to
 * `next`.
 *
 * Removals are soft-deleted BY ROW ID and additions are fresh inserts — the
 * same convention `wiki_tag_assignments` uses (`unassignTagFromItem` flips
 * `is_deleted`; `assignTagToItem` always mints a new id). Reviving the dead
 * row instead would need `on_conflict` inference over a PARTIAL unique index,
 * which PostgREST cannot be relied on to target.
 *
 * Input order is preserved in `add` so a group's tag order follows the order
 * the user ticked them.
 */
export function diffTagGroupMembers(
  current: readonly TagGroupAssignmentRow[],
  next: readonly string[],
): { add: string[]; removeRowIds: string[] } {
  const wanted = new Set(next);
  const live = new Set<string>();
  const removeRowIds: string[] = [];
  for (const row of current) {
    // A duplicate live row for a tag we are KEEPING is still redundant, so the
    // second one is dropped here rather than left to accumulate.
    if (wanted.has(row.tag_id) && !live.has(row.tag_id)) {
      live.add(row.tag_id);
      continue;
    }
    removeRowIds.push(row.id);
  }
  const add: string[] = [];
  for (const tagId of next) {
    if (live.has(tagId) || add.includes(tagId)) continue;
    add.push(tagId);
  }
  return { add, removeRowIds };
}
