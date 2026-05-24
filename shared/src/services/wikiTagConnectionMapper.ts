import type { WikiTagConnection } from "../types/wikiTagUnified";

/*
 * Pure WikiTagConnection <-> wiki_tag_connections row mapper (DU-C+).
 *
 * wiki_tag_connections is a RELATION table (0008 §13). Items↔items
 * directional link graph. CHECK (from_item_id <> to_item_id) blocks
 * self-loops at DB layer. UNIQUE(from_item_id, to_item_id) WHERE
 * is_deleted=false (directional uniqueness).
 *
 * NOTE: the LEGACY `wikiTag.ts::WikiTagConnection` modelled tag↔tag.
 * The DU-A redefinition is items↔items — that is the Obsidian-style
 * link graph the unified model uses. Legacy file kept until DU-F
 * removes all callers in cohort.
 */

export interface WikiTagConnectionRow {
  id: string;
  user_id: string;
  from_item_id: string;
  to_item_id: string;
  updated_at: string;
  is_deleted: boolean;
  deleted_at: string | null;
}

export type WikiTagConnectionInsertRow = Omit<
  WikiTagConnectionRow,
  "updated_at"
>;

export type WikiTagConnectionUpdatePatch = Partial<
  Omit<WikiTagConnectionRow, "id" | "user_id" | "from_item_id" | "to_item_id">
>;

export const WIKI_TAG_CONNECTIONS_COLUMNS =
  "id, user_id, from_item_id, to_item_id, updated_at, is_deleted, deleted_at";

export function rowToWikiTagConnection(
  row: WikiTagConnectionRow,
): WikiTagConnection {
  return {
    id: row.id,
    fromItemId: row.from_item_id,
    toItemId: row.to_item_id,
    updatedAt: row.updated_at,
    isDeleted: row.is_deleted,
    deletedAt: row.deleted_at,
  };
}

export function wikiTagConnectionToRow(
  connection: WikiTagConnection,
  userId: string,
): WikiTagConnectionInsertRow {
  if (connection.fromItemId === connection.toItemId) {
    throw new Error(
      `wikiTagConnectionMapper: self-loop rejected (fromItemId === toItemId === "${connection.fromItemId}")`,
    );
  }
  return {
    id: connection.id,
    user_id: userId,
    from_item_id: connection.fromItemId,
    to_item_id: connection.toItemId,
    is_deleted: connection.isDeleted ?? false,
    deleted_at: connection.deletedAt ?? null,
  };
}

export function wikiTagConnectionUpdatesToPatch(
  updates: Partial<WikiTagConnection>,
  now: string,
): WikiTagConnectionUpdatePatch {
  const patch: WikiTagConnectionUpdatePatch = { updated_at: now };
  if ("isDeleted" in updates) patch.is_deleted = updates.isDeleted ?? false;
  if ("deletedAt" in updates) patch.deleted_at = updates.deletedAt ?? null;
  return patch;
}
