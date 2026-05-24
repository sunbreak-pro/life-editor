import type { WikiTagGroup } from "../types/wikiTagUnified";

/*
 * Pure WikiTagGroup <-> wiki_tag_groups row mapper (DU-C+).
 *
 * wiki_tag_groups is a VERSIONED dedicated table (0008 §10). Mirrors
 * wikiTagMapper but without color (group has no UI tint yet).
 *
 * CP-Q4: DU-C+ creates this mapper for shared layer completeness; the
 * group CRUD UI lands in DU-F. mapper is exercised only by the
 * roundtrip unit test until the UI ships.
 */

export interface WikiTagGroupRow {
  id: string;
  user_id: string;
  name: string;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  version: number;
}

export type WikiTagGroupInsertRow = Omit<
  WikiTagGroupRow,
  "created_at" | "updated_at"
>;

export type WikiTagGroupUpdatePatch = Partial<
  Omit<WikiTagGroupRow, "id" | "user_id" | "created_at">
>;

export const WIKI_TAG_GROUPS_COLUMNS =
  "id, user_id, name, is_deleted, deleted_at, " +
  "created_at, updated_at, version";

export function rowToWikiTagGroup(row: WikiTagGroupRow): WikiTagGroup {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
    isDeleted: row.is_deleted,
    deletedAt: row.deleted_at,
  };
}

export function wikiTagGroupToRow(
  group: WikiTagGroup,
  userId: string,
): WikiTagGroupInsertRow {
  return {
    id: group.id,
    user_id: userId,
    name: group.name,
    is_deleted: group.isDeleted ?? false,
    deleted_at: group.deletedAt ?? null,
    version: group.version ?? 1,
  };
}

export function wikiTagGroupUpdatesToPatch(
  updates: Partial<WikiTagGroup>,
  now: string,
): WikiTagGroupUpdatePatch {
  const patch: WikiTagGroupUpdatePatch = { updated_at: now };
  if ("name" in updates && updates.name !== undefined)
    patch.name = updates.name;
  if ("isDeleted" in updates) patch.is_deleted = updates.isDeleted ?? false;
  if ("deletedAt" in updates) patch.deleted_at = updates.deletedAt ?? null;
  if ("version" in updates && updates.version !== undefined)
    patch.version = updates.version;
  return patch;
}
