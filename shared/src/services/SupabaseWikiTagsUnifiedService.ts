import type { SupabaseClient } from "@supabase/supabase-js";
import {
  WIKI_TAGS_COLUMNS,
  rowToWikiTag,
  wikiTagUpdatesToPatch,
  type WikiTagRow,
} from "./wikiTagMapper";
import {
  WIKI_TAG_ASSIGNMENTS_COLUMNS,
  rowToWikiTagAssignment,
  type WikiTagAssignmentRow,
} from "./wikiTagAssignmentMapper";
import {
  WIKI_TAG_CONNECTIONS_COLUMNS,
  rowToWikiTagConnection,
  type WikiTagConnectionRow,
} from "./wikiTagConnectionMapper";
import type {
  WikiTag,
  WikiTagAssignment,
  WikiTagConnection,
} from "../types/wikiTagUnified";

/*
 * SupabaseWikiTagsUnifiedService (DU-C+ Step 4).
 *
 * Lives apart from SupabaseDataService.ts to keep the 2.8k-line monolith
 * from growing. Wired into the dispatch Proxy via PHASE2_WIKI_TAGS_
 * UNIFIED_METHODS in SupabaseDataService.ts.
 *
 * Naming policy: every method here has the `*Unified` suffix or a verb
 * that the legacy Tauri polymorphic API never used (assignTagToItem /
 * createItemLink). The legacy `fetchWikiTags` / `setWikiTagsForEntity`
 * style stays UNTOUCHED in DataService.ts — they currently throw "not
 * implemented in phase 2" and will be deleted wholesale in DU-F when the
 * remaining frontend callers migrate. Coexistence is intentional.
 *
 * Tag↔group + group_assignments live in DU-F UI; mappers exist (DU-C+
 * Step 3) but no service method is needed yet.
 */
export class SupabaseWikiTagsUnifiedService {
  constructor(private readonly client: SupabaseClient) {}

  // -------------------------------------------------------------------------
  // Tag master (wiki_tags)
  // -------------------------------------------------------------------------

  async listAllWikiTagsUnified(): Promise<WikiTag[]> {
    const { data, error } = await this.client
      .from("wiki_tags")
      .select(WIKI_TAGS_COLUMNS)
      .eq("is_deleted", false)
      .order("name", { ascending: true });
    if (error)
      throw new Error(`listAllWikiTagsUnified failed: ${error.message}`);
    return (data ?? []).map((r) => rowToWikiTag(r as unknown as WikiTagRow));
  }

  async createWikiTagUnified(
    id: string,
    name: string,
    color: string | null,
  ): Promise<WikiTag> {
    // user_id omitted on insert — DB default `auth.uid()` fills it.
    // Saves the frontend from threading a userId through every call site.
    const { data, error } = await this.client
      .from("wiki_tags")
      .insert({
        id,
        name,
        color,
        is_deleted: false,
        deleted_at: null,
        version: 1,
      })
      .select(WIKI_TAGS_COLUMNS)
      .single();
    if (error) throw new Error(`createWikiTagUnified failed: ${error.message}`);
    return rowToWikiTag(data as unknown as WikiTagRow);
  }

  async updateWikiTagUnified(
    id: string,
    updates: Partial<WikiTag>,
  ): Promise<WikiTag> {
    const patch = wikiTagUpdatesToPatch(updates, new Date().toISOString());
    const { data, error } = await this.client
      .from("wiki_tags")
      .update(patch)
      .eq("id", id)
      .select(WIKI_TAGS_COLUMNS)
      .single();
    if (error) throw new Error(`updateWikiTagUnified failed: ${error.message}`);
    return rowToWikiTag(data as unknown as WikiTagRow);
  }

  async softDeleteWikiTagUnified(id: string): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await this.client
      .from("wiki_tags")
      .update({ is_deleted: true, deleted_at: now, updated_at: now })
      .eq("id", id);
    if (error)
      throw new Error(`softDeleteWikiTagUnified failed: ${error.message}`);
  }

  // -------------------------------------------------------------------------
  // Item↔tag assignments (wiki_tag_assignments)
  // -------------------------------------------------------------------------

  async listTagsForItem(itemId: string): Promise<WikiTagAssignment[]> {
    const { data, error } = await this.client
      .from("wiki_tag_assignments")
      .select(WIKI_TAG_ASSIGNMENTS_COLUMNS)
      .eq("item_id", itemId)
      .eq("is_deleted", false);
    if (error) throw new Error(`listTagsForItem failed: ${error.message}`);
    return (data ?? []).map((r) =>
      rowToWikiTagAssignment(r as unknown as WikiTagAssignmentRow),
    );
  }

  async assignTagToItem(
    assignmentId: string,
    itemId: string,
    tagId: string,
  ): Promise<WikiTagAssignment> {
    const { data, error } = await this.client
      .from("wiki_tag_assignments")
      .insert({
        id: assignmentId,
        item_id: itemId,
        tag_id: tagId,
        is_deleted: false,
        deleted_at: null,
      })
      .select(WIKI_TAG_ASSIGNMENTS_COLUMNS)
      .single();
    if (error) throw new Error(`assignTagToItem failed: ${error.message}`);
    return rowToWikiTagAssignment(data as unknown as WikiTagAssignmentRow);
  }

  async unassignTagFromItem(assignmentId: string): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await this.client
      .from("wiki_tag_assignments")
      .update({ is_deleted: true, deleted_at: now, updated_at: now })
      .eq("id", assignmentId);
    if (error) throw new Error(`unassignTagFromItem failed: ${error.message}`);
  }

  // -------------------------------------------------------------------------
  // Item↔item links (wiki_tag_connections)
  // -------------------------------------------------------------------------

  async listLinksFromItem(itemId: string): Promise<WikiTagConnection[]> {
    const { data, error } = await this.client
      .from("wiki_tag_connections")
      .select(WIKI_TAG_CONNECTIONS_COLUMNS)
      .eq("from_item_id", itemId)
      .eq("is_deleted", false);
    if (error) throw new Error(`listLinksFromItem failed: ${error.message}`);
    return (data ?? []).map((r) =>
      rowToWikiTagConnection(r as unknown as WikiTagConnectionRow),
    );
  }

  async listLinksToItem(itemId: string): Promise<WikiTagConnection[]> {
    const { data, error } = await this.client
      .from("wiki_tag_connections")
      .select(WIKI_TAG_CONNECTIONS_COLUMNS)
      .eq("to_item_id", itemId)
      .eq("is_deleted", false);
    if (error) throw new Error(`listLinksToItem failed: ${error.message}`);
    return (data ?? []).map((r) =>
      rowToWikiTagConnection(r as unknown as WikiTagConnectionRow),
    );
  }

  async createItemLink(
    linkId: string,
    fromItemId: string,
    toItemId: string,
  ): Promise<WikiTagConnection> {
    if (fromItemId === toItemId) {
      throw new Error(
        `createItemLink: self-loop rejected (from === to === "${fromItemId}")`,
      );
    }
    const { data, error } = await this.client
      .from("wiki_tag_connections")
      .insert({
        id: linkId,
        from_item_id: fromItemId,
        to_item_id: toItemId,
        is_deleted: false,
        deleted_at: null,
      })
      .select(WIKI_TAG_CONNECTIONS_COLUMNS)
      .single();
    if (error) throw new Error(`createItemLink failed: ${error.message}`);
    return rowToWikiTagConnection(data as unknown as WikiTagConnectionRow);
  }

  async deleteItemLink(linkId: string): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await this.client
      .from("wiki_tag_connections")
      .update({ is_deleted: true, deleted_at: now, updated_at: now })
      .eq("id", linkId);
    if (error) throw new Error(`deleteItemLink failed: ${error.message}`);
  }
}

export const PHASE2_WIKI_TAGS_UNIFIED_METHODS: ReadonlySet<string> = new Set([
  "listAllWikiTagsUnified",
  "createWikiTagUnified",
  "updateWikiTagUnified",
  "softDeleteWikiTagUnified",
  "listTagsForItem",
  "assignTagToItem",
  "unassignTagFromItem",
  "listLinksFromItem",
  "listLinksToItem",
  "createItemLink",
  "deleteItemLink",
]);
