import type { WikiTag } from "../types/wikiTagUnified";

/*
 * Pure WikiTag <-> wiki_tags row mapper (DU-C+).
 *
 * wiki_tags is a VERSIONED dedicated table (0008 §9). The row holds all
 * authoritative metadata for a tag master; no items_meta involvement.
 *
 * What this module owns:
 *   - `WikiTagRow` SELECT shape (verbatim 0008 columns)
 *   - `WikiTagInsertRow` / `WikiTagUpdatePatch` WRITE shapes
 *   - SELECT column list
 *   - `rowToWikiTag` / `wikiTagToRow` (INSERT) / `wikiTagUpdatesToPatch`
 *
 * What this module does NOT own:
 *   - The `updated_at = now()` bump on UPDATE — `wikiTagUpdatesToPatch`
 *     ALWAYS emits it, so callers cannot accidentally skip it (same
 *     contract as taskMapper / DB-Q2).
 *   - Sync delta cursor logic (lives in SupabaseDataService).
 */

export interface WikiTagRow {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  version: number;
}

export type WikiTagInsertRow = Omit<WikiTagRow, "created_at" | "updated_at">;

export type WikiTagUpdatePatch = Partial<
  Omit<WikiTagRow, "id" | "user_id" | "created_at">
>;

export const WIKI_TAGS_COLUMNS =
  "id, user_id, name, color, is_deleted, deleted_at, " +
  "created_at, updated_at, version";

export function rowToWikiTag(row: WikiTagRow): WikiTag {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
    isDeleted: row.is_deleted,
    deletedAt: row.deleted_at,
  };
}

export function wikiTagToRow(tag: WikiTag, userId: string): WikiTagInsertRow {
  return {
    id: tag.id,
    user_id: userId,
    name: tag.name,
    color: tag.color,
    is_deleted: tag.isDeleted ?? false,
    deleted_at: tag.deletedAt ?? null,
    version: tag.version ?? 1,
  };
}

export function wikiTagUpdatesToPatch(
  updates: Partial<WikiTag>,
  now: string,
): WikiTagUpdatePatch {
  const patch: WikiTagUpdatePatch = { updated_at: now };
  if ("name" in updates && updates.name !== undefined)
    patch.name = updates.name;
  if ("color" in updates) patch.color = updates.color ?? null;
  if ("isDeleted" in updates) patch.is_deleted = updates.isDeleted ?? false;
  if ("deletedAt" in updates) patch.deleted_at = updates.deletedAt ?? null;
  if ("version" in updates && updates.version !== undefined)
    patch.version = updates.version;
  return patch;
}
