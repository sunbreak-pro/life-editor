import type { WikiTagAssignment } from "../types/wikiTagUnified";

/*
 * Pure WikiTagAssignment <-> wiki_tag_assignments row mapper (DU-C+).
 *
 * wiki_tag_assignments is a RELATION table (0008 §12). No version
 * (relation, not versioned). Delta sync keyed on `updated_at` +
 * `is_deleted` (Issue 008 pattern). UNIQUE(item_id, tag_id) WHERE
 * is_deleted=false means a soft-deleted assignment can be re-created.
 *
 * `item_id` references items_meta(id) — any of the 5 roles (todo /
 * event / routine / note / daily). No composite FK / role guard: tags
 * span all roles by design (DU-C+ R4).
 */

export interface WikiTagAssignmentRow {
  id: string;
  user_id: string;
  item_id: string;
  tag_id: string;
  created_at: string;
  updated_at: string;
  is_display_color: boolean;
  is_deleted: boolean;
  deleted_at: string | null;
}

export type WikiTagAssignmentInsertRow = Omit<
  WikiTagAssignmentRow,
  "created_at" | "updated_at"
>;

export type WikiTagAssignmentUpdatePatch = Partial<
  Omit<WikiTagAssignmentRow, "id" | "user_id" | "item_id" | "tag_id">
>;

/*
 * ⚠️ Needs migration 0030 in the database BEFORE this list ships: PostgREST
 * answers a SELECT naming a column that does not exist with 42703, and this
 * list feeds `listAllTagAssignments` — the one query every tag-reading screen
 * waits on. Push before merge (the same order 0028 called for).
 */
export const WIKI_TAG_ASSIGNMENTS_COLUMNS =
  "id, user_id, item_id, tag_id, created_at, updated_at, is_display_color, is_deleted, deleted_at";

export function rowToWikiTagAssignment(
  row: WikiTagAssignmentRow,
): WikiTagAssignment {
  return {
    id: row.id,
    itemId: row.item_id,
    tagId: row.tag_id,
    // Defaulted rather than trusted (#1580): the bulk read embeds
    // `items_meta!inner(...)`, and a row that reached here through some other
    // shape must not make `createdAt` undefined — the ordering that picks an
    // item's default colour reads it on every assignment.
    createdAt: row.created_at ?? row.updated_at,
    updatedAt: row.updated_at,
    isDisplayColor: row.is_display_color ?? false,
    isDeleted: row.is_deleted,
    deletedAt: row.deleted_at,
  };
}

/*
 * Read direction only (#1389). The `...ToRow` / `...UpdatesToPatch` pair this
 * file used to carry never gained a caller — SupabaseWikiTagsUnifiedService
 * writes assignment rows inline — so the only thing exercising them was their
 * own suite. The Row / InsertRow / UpdatePatch TYPES stay: those inline writes
 * are checked against them.
 */
