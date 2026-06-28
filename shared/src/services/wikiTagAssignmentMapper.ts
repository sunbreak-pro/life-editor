import type { WikiTagAssignment } from "../types/wikiTagUnified";
import { relationSoftDeleteUpdatesToPatch } from "./softDeleteMapper";

/*
 * Pure WikiTagAssignment <-> wiki_tag_assignments row mapper (DU-C+).
 *
 * wiki_tag_assignments is a RELATION table (0008 §12). No version
 * (relation, not versioned). Delta sync keyed on `updated_at` +
 * `is_deleted` (Issue 008 pattern). UNIQUE(item_id, tag_id) WHERE
 * is_deleted=false means a soft-deleted assignment can be re-created.
 *
 * `item_id` references items_meta(id) — any of the 5 roles (task /
 * event / routine / note / daily). No composite FK / role guard: tags
 * span all roles by design (DU-C+ R4).
 */

export interface WikiTagAssignmentRow {
  id: string;
  user_id: string;
  item_id: string;
  tag_id: string;
  updated_at: string;
  is_deleted: boolean;
  deleted_at: string | null;
}

export type WikiTagAssignmentInsertRow = Omit<
  WikiTagAssignmentRow,
  "updated_at"
>;

export type WikiTagAssignmentUpdatePatch = Partial<
  Omit<WikiTagAssignmentRow, "id" | "user_id" | "item_id" | "tag_id">
>;

export const WIKI_TAG_ASSIGNMENTS_COLUMNS =
  "id, user_id, item_id, tag_id, updated_at, is_deleted, deleted_at";

export function rowToWikiTagAssignment(
  row: WikiTagAssignmentRow,
): WikiTagAssignment {
  return {
    id: row.id,
    itemId: row.item_id,
    tagId: row.tag_id,
    updatedAt: row.updated_at,
    isDeleted: row.is_deleted,
    deletedAt: row.deleted_at,
  };
}

export function wikiTagAssignmentToRow(
  assignment: WikiTagAssignment,
  userId: string,
): WikiTagAssignmentInsertRow {
  return {
    id: assignment.id,
    user_id: userId,
    item_id: assignment.itemId,
    tag_id: assignment.tagId,
    is_deleted: assignment.isDeleted ?? false,
    deleted_at: assignment.deletedAt ?? null,
  };
}

export function wikiTagAssignmentUpdatesToPatch(
  updates: Partial<WikiTagAssignment>,
  now: string,
): WikiTagAssignmentUpdatePatch {
  return relationSoftDeleteUpdatesToPatch(updates, now);
}
