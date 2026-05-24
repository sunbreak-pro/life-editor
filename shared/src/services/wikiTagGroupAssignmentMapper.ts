import type { WikiTagGroupAssignment } from "../types/wikiTagUnified";

/*
 * Pure WikiTagGroupAssignment <-> wiki_tag_group_assignments row mapper
 * (DU-C+). RELATION table (0008 §11). UNIQUE(tag_id, group_id) WHERE
 * is_deleted=false.
 *
 * CP-Q4: created in DU-C+ for shared layer completeness; CRUD UI ships
 * in DU-F.
 */

export interface WikiTagGroupAssignmentRow {
  id: string;
  user_id: string;
  tag_id: string;
  group_id: string;
  updated_at: string;
  is_deleted: boolean;
  deleted_at: string | null;
}

export type WikiTagGroupAssignmentInsertRow = Omit<
  WikiTagGroupAssignmentRow,
  "updated_at"
>;

export type WikiTagGroupAssignmentUpdatePatch = Partial<
  Omit<WikiTagGroupAssignmentRow, "id" | "user_id" | "tag_id" | "group_id">
>;

export const WIKI_TAG_GROUP_ASSIGNMENTS_COLUMNS =
  "id, user_id, tag_id, group_id, updated_at, is_deleted, deleted_at";

export function rowToWikiTagGroupAssignment(
  row: WikiTagGroupAssignmentRow,
): WikiTagGroupAssignment {
  return {
    id: row.id,
    tagId: row.tag_id,
    groupId: row.group_id,
    updatedAt: row.updated_at,
    isDeleted: row.is_deleted,
    deletedAt: row.deleted_at,
  };
}

export function wikiTagGroupAssignmentToRow(
  assignment: WikiTagGroupAssignment,
  userId: string,
): WikiTagGroupAssignmentInsertRow {
  return {
    id: assignment.id,
    user_id: userId,
    tag_id: assignment.tagId,
    group_id: assignment.groupId,
    is_deleted: assignment.isDeleted ?? false,
    deleted_at: assignment.deletedAt ?? null,
  };
}

export function wikiTagGroupAssignmentUpdatesToPatch(
  updates: Partial<WikiTagGroupAssignment>,
  now: string,
): WikiTagGroupAssignmentUpdatePatch {
  const patch: WikiTagGroupAssignmentUpdatePatch = { updated_at: now };
  if ("isDeleted" in updates) patch.is_deleted = updates.isDeleted ?? false;
  if ("deletedAt" in updates) patch.deleted_at = updates.deletedAt ?? null;
  return patch;
}
