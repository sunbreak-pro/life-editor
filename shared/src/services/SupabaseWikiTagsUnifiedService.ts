import type { SupabaseClient } from "@supabase/supabase-js";
import type { WikiTagsUnifiedDataService } from "./DataService";
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
import { fetchAllPages } from "./postgrestFetchAll";
import { requireSingleRow } from "./postgrestSingle";
import type {
  WikiTag,
  WikiTagAssignment,
  WikiTagConnection,
  WikiTagConnectionOrigin,
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
 * declarations that used to sit beside these in DataService.ts are gone
 * (#671 C4 S1): they were never routed, so they could only ever throw
 * "not implemented in phase 2", and no caller in any of the four trees
 * ever reached them. This service is the whole tag/link surface now.
 *
 * Tag↔group + group_assignments live in DU-F UI; mappers exist (DU-C+
 * Step 3) but no service method is needed yet.
 */
export class SupabaseWikiTagsUnifiedService implements WikiTagsUnifiedDataService {
  constructor(private readonly client: SupabaseClient) {}

  // -------------------------------------------------------------------------
  // Tag master (wiki_tags)
  // -------------------------------------------------------------------------

  async listAllWikiTagsUnified(): Promise<WikiTag[]> {
    // Trailing .order("id") = unique tiebreaker so .range() pages are
    // deterministic (names can tie).
    const rows = await fetchAllPages<WikiTagRow>(
      (from, to) =>
        this.client
          .from("wiki_tags")
          .select(WIKI_TAGS_COLUMNS)
          .eq("is_deleted", false)
          .order("name", { ascending: true })
          .order("id")
          .range(from, to),
      "listAllWikiTagsUnified failed",
    );
    return rows.map(rowToWikiTag);
  }

  async createWikiTagUnified(
    id: string,
    name: string,
    color: string | null,
  ): Promise<WikiTag> {
    // user_id omitted on insert — DB default `auth.uid()` fills it.
    // Saves the frontend from threading a userId through every call site.
    const data = await requireSingleRow<WikiTagRow>(
      this.client
        .from("wiki_tags")
        .insert({
          id,
          name,
          color,
          is_deleted: false,
          deleted_at: null,
        })
        .select(WIKI_TAGS_COLUMNS)
        .single(),
      "createWikiTagUnified failed",
    );
    return rowToWikiTag(data);
  }

  async updateWikiTagUnified(
    id: string,
    updates: Partial<WikiTag>,
  ): Promise<WikiTag> {
    const patch = wikiTagUpdatesToPatch(updates, new Date().toISOString());
    const data = await requireSingleRow<WikiTagRow>(
      this.client
        .from("wiki_tags")
        .update(patch)
        .eq("id", id)
        .select(WIKI_TAGS_COLUMNS)
        .single(),
      "updateWikiTagUnified failed",
    );
    return rowToWikiTag(data);
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

  /**
   * Bulk-load every LIVE item↔tag assignment in one query. Mirrors
   * `listAllWikiTagGroupAssignments` (group memberships) so the hook can
   * bucket assignments by `itemId` on the client instead of issuing one
   * `listTagsForItem` query per visible row (N+1 elimination).
   *
   * "Live" is a two-sided condition (#365): the assignment itself must be
   * active AND its item must not be trashed. Soft-deleting an item only
   * flips `items_meta.is_deleted` — it deliberately does NOT cascade into
   * `wiki_tag_assignments` (a cascade could not tell apart "removed by the
   * trash" from "removed by the user" on restore), so assignment-only
   * filtering leaves rows pointing at trashed items. Those skewed the counting
   * consumers of this cache: the Tag edit modal's usage count (the reported
   * symptom) and Analytics tag aggregation. (The Connect graph, retired in
   * #1152, was already correct: it dropped any edge whose endpoint was not a
   * rendered node, and trashed items never became nodes.)
   *
   * The `items_meta!inner(is_deleted)` embed + `.eq("items_meta.is_deleted",
   * false)` pushes the liveness join into PostgREST, so this stays ONE
   * round trip (a second `items_meta` id sweep per refresh would re-run on
   * every syncVersion bump — i.e. after every typing pause). The embedded
   * column is join-only; `rowToWikiTagAssignment` ignores the extra key.
   * Restoring an item revives its tags for free — nothing was mutated.
   */
  async listAllTagAssignments(): Promise<WikiTagAssignment[]> {
    const rows = await fetchAllPages<WikiTagAssignmentRow>(
      (from, to) =>
        this.client
          .from("wiki_tag_assignments")
          .select(
            `${WIKI_TAG_ASSIGNMENTS_COLUMNS}, items_meta!inner(is_deleted)`,
          )
          .eq("is_deleted", false)
          .eq("items_meta.is_deleted", false)
          .order("id")
          .range(from, to),
      "listAllTagAssignments failed",
    );
    return rows.map(rowToWikiTagAssignment);
  }

  async assignTagToItem(
    assignmentId: string,
    itemId: string,
    tagId: string,
  ): Promise<WikiTagAssignment> {
    const data = await requireSingleRow<WikiTagAssignmentRow>(
      this.client
        .from("wiki_tag_assignments")
        .insert({
          id: assignmentId,
          item_id: itemId,
          tag_id: tagId,
          is_deleted: false,
          deleted_at: null,
        })
        .select(WIKI_TAG_ASSIGNMENTS_COLUMNS)
        .single(),
      "assignTagToItem failed",
    );
    return rowToWikiTagAssignment(data);
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

  /**
   * Bulk-load every active item↔item link in one query. The caller
   * buckets by both `fromItemId` (outgoing) and `toItemId` (incoming) on
   * the client, replacing the per-row `listLinksFromItem` +
   * `listLinksToItem` pair (×2 N+1 elimination). Same shape as
   * `listAllTagAssignments` / `listAllWikiTagGroupAssignments`.
   */
  async listAllTagConnections(): Promise<WikiTagConnection[]> {
    const rows = await fetchAllPages<WikiTagConnectionRow>(
      (from, to) =>
        this.client
          .from("wiki_tag_connections")
          .select(WIKI_TAG_CONNECTIONS_COLUMNS)
          .eq("is_deleted", false)
          .order("id")
          .range(from, to),
      "listAllTagConnections failed",
    );
    return rows.map(rowToWikiTagConnection);
  }

  async createItemLink(
    linkId: string,
    fromItemId: string,
    toItemId: string,
    origin: WikiTagConnectionOrigin = "manual",
  ): Promise<WikiTagConnection> {
    if (fromItemId === toItemId) {
      throw new Error(
        `createItemLink: self-loop rejected (from === to === "${fromItemId}")`,
      );
    }
    const data = await requireSingleRow<WikiTagConnectionRow>(
      this.client
        .from("wiki_tag_connections")
        .insert({
          id: linkId,
          from_item_id: fromItemId,
          to_item_id: toItemId,
          origin,
          is_deleted: false,
          deleted_at: null,
        })
        .select(WIKI_TAG_CONNECTIONS_COLUMNS)
        .single(),
      "createItemLink failed",
    );
    return rowToWikiTagConnection(data);
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

export const PHASE2_WIKI_TAGS_UNIFIED_METHOD_NAMES = [
  "listAllWikiTagsUnified",
  "createWikiTagUnified",
  "updateWikiTagUnified",
  "softDeleteWikiTagUnified",
  "listTagsForItem",
  "listAllTagAssignments",
  "assignTagToItem",
  "unassignTagFromItem",
  "listLinksFromItem",
  "listLinksToItem",
  "listAllTagConnections",
  "createItemLink",
  "deleteItemLink",
] as const;

export type WikiTagsUnifiedMethodName =
  (typeof PHASE2_WIKI_TAGS_UNIFIED_METHOD_NAMES)[number];

export const PHASE2_WIKI_TAGS_UNIFIED_METHODS: ReadonlySet<string> = new Set(
  PHASE2_WIKI_TAGS_UNIFIED_METHOD_NAMES,
);
