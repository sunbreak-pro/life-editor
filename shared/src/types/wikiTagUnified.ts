/*
 * Unified WikiTag domain types (DU-C+).
 *
 * Supersedes the legacy `wikiTag.ts` definitions that were modelled around
 * Tauri's polymorphic `entityType` ("task"|"daily"|"note"). The unified
 * model lives on top of `items_meta` (5 roles: task/event/routine/note/
 * daily) — tags hang off any item by `itemId`, links are items↔items.
 *
 * Naming clash with `wikiTag.ts` is intentional: callers pick by import
 * path. DU-F will migrate the last frontend callers and the legacy file
 * will be removed in cohort. Until then both coexist.
 *
 * Schema source of truth: `supabase/migrations/0008_data_unification_
 * schema.sql` (tables 9-13). No CREATE was added in DU-C+ — only the
 * CalendarTag legacy was DROPped (0012).
 */

/** Tag master record (wiki_tags). VERSIONED dedicated table. */
export interface WikiTag {
  id: string;
  name: string;
  /** Optional UI tint color. */
  color: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  isDeleted: boolean;
  deletedAt: string | null;
}

/** Tag group master (wiki_tag_groups). VERSIONED dedicated table. */
export interface WikiTagGroup {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  isDeleted: boolean;
  deletedAt: string | null;
}

/**
 * Item↔tag assignment (wiki_tag_assignments). RELATION + soft-delete,
 * no version. `itemId` references `items_meta(id)` for any of the 5 roles
 * — there is no `entityType` discriminator (the role is recoverable via
 * `items_meta.role` if needed).
 */
export interface WikiTagAssignment {
  id: string;
  itemId: string;
  tagId: string;
  updatedAt: string;
  isDeleted: boolean;
  deletedAt: string | null;
}

/**
 * Item↔item link (wiki_tag_connections). RELATION + soft-delete, no
 * version. Directional `from → to`; self-loop is rejected at DB layer
 * (CHECK from_item_id <> to_item_id).
 *
 * NOTE: the legacy `WikiTagConnection` in `wikiTag.ts` modelled tag↔tag
 * connections (sourceTagId / targetTagId). The unified model is items↔
 * items — that is the DU-A redefinition the Obsidian-style link graph
 * uses, and the legacy tag-graph semantics are discarded.
 */
export interface WikiTagConnection {
  id: string;
  fromItemId: string;
  toItemId: string;
  updatedAt: string;
  isDeleted: boolean;
  deletedAt: string | null;
}

/**
 * Tag↔group membership (wiki_tag_group_assignments). RELATION +
 * soft-delete, no version. UNIQUE(tag_id, group_id) where is_deleted=
 * false at DB layer (a soft-deleted membership can be re-added).
 */
export interface WikiTagGroupAssignment {
  id: string;
  tagId: string;
  groupId: string;
  updatedAt: string;
  isDeleted: boolean;
  deletedAt: string | null;
}
