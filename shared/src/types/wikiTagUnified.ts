/*
 * Unified WikiTag domain types (DU-C+).
 *
 * Supersedes the legacy `wikiTag.ts` definitions that were modelled around
 * Tauri's polymorphic `entityType` ("task"|"daily"|"note"). The unified
 * model lives on top of `items_meta` (5 roles: todo/event/routine/note/
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
  /** Optional lucide-react icon name (e.g. "Tag" / "Star"); resolved to a
   *  component by `resolveTagIcon`. null = use the default icon. */
  icon: string | null;
  createdAt: string;
  updatedAt: string;
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
 * Who created a link edge (#372). "inline" = mirrored from a "[[ ]]" link in
 * a document body — eligible for delete-sync when the text link goes away.
 * "manual" = added by hand (LinkPanel / Connect) — never auto-deleted. Rows
 * predating the origin column default to "manual" (safe side: keep them).
 */
export type WikiTagConnectionOrigin = "manual" | "inline";

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
  origin: WikiTagConnectionOrigin;
  updatedAt: string;
  isDeleted: boolean;
  deletedAt: string | null;
}
