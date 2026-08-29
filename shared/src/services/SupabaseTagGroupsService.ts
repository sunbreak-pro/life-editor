import { type SupabaseClient } from "@supabase/supabase-js";
import type { TagGroupsDataService } from "./DataService";
import type { TagGroupNode } from "../types/tagGroup";
import {
  TAG_GROUP_SELECT_COLUMNS,
  TAG_GROUP_ASSIGNMENT_SELECT_COLUMNS,
  diffTagGroupMembers,
  rowsToTagGroups,
  tagGroupUpdatesToPatch,
  type TagGroupAssignmentRow,
  type TagGroupRow,
} from "./tagGroupMapper";
import { fetchAllPages } from "./postgrestFetchAll";
import { requireSingleRow } from "./postgrestSingle";
import { generateId } from "../utils/generateId";

/*
 * Tag groups domain (#1173) — the saved multi-tag filters that replaced the
 * `calendars` ledger. VERSIONED + soft-delete on the group row; its
 * memberships are a plain RELATION + soft-delete.
 *
 * NO DDL shipped with this feature: `wiki_tag_groups` and
 * `wiki_tag_group_assignments` were created by 0008 (tables 10 + 11), are
 * already RLS-scoped to `auth.uid()` and are already in the `supabase_realtime`
 * publication — and nothing had ever written a row to either. That is why the
 * group model beat a `schedule_groups` table on the way in: a new table would
 * have left the whole feature dead until the user ran `supabase db push`
 * (CLAUDE.md §7.3 keeps that gate in human hands), and this one works the
 * moment the code lands. Their sync domain (`tagGroups`) is the one thing
 * #1173 did add, and only in TypeScript.
 *
 * Writes are NOT transactional — PostgREST has no multi-statement transaction
 * — so `updateTagGroup` reconciles memberships with removals first, then adds.
 * A failure between the two leaves a group with FEWER tags than asked for,
 * which shows more rows on the grid than the user wanted. The other order
 * would show fewer, and a filter that hides work silently is the worse half
 * (the #466 rule: never let a filter make an empty slot look like free time).
 */
export class SupabaseTagGroupsService implements TagGroupsDataService {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  /** Live groups + their live memberships, oldest first. */
  async fetchTagGroups(): Promise<TagGroupNode[]> {
    const [groups, assignments] = await Promise.all([
      fetchAllPages<TagGroupRow>(
        (from, to) =>
          this.client
            .from("wiki_tag_groups")
            .select(TAG_GROUP_SELECT_COLUMNS)
            .eq("is_deleted", false)
            .order("created_at", { ascending: true })
            .order("id")
            .range(from, to),
        "fetchTagGroups failed",
      ),
      this.liveAssignments(),
    ]);
    return rowsToTagGroups(groups, assignments);
  }

  /**
   * Insert the group row, then one membership row per tag.
   *
   * The group lands FIRST so the memberships always have a live parent to FK
   * against; if the membership insert fails the caller is left with an empty
   * group, which is visible and fixable, rather than orphan rows that no
   * fetch would ever return.
   */
  async createTagGroup(
    id: string,
    name: string,
    tagIds: readonly string[],
  ): Promise<TagGroupNode> {
    const now = new Date().toISOString();
    const row = await requireSingleRow<TagGroupRow>(
      this.client
        .from("wiki_tag_groups")
        .insert({
          id,
          name,
          is_deleted: false,
          deleted_at: null,
          created_at: now,
          updated_at: now,
          version: 1,
        })
        .select(TAG_GROUP_SELECT_COLUMNS)
        .single(),
      "createTagGroup failed",
    );
    await this.addMembers(id, dedupe(tagIds), "createTagGroup");
    return rowsToTagGroups([row], await this.liveAssignments(id))[0];
  }

  /**
   * Rename and/or re-bind a group. `name` bumps `version` + `updated_at` the
   * way `updateCalendar` did; `tagIds` reconciles the membership rows.
   *
   * Membership churn also touches `updated_at` on the group row even when the
   * name did not change: the group's identity to every reader IS its tag set,
   * so a sync cursor that ignored a re-bind would hand other devices a stale
   * filter.
   */
  async updateTagGroup(
    id: string,
    updates: { name?: string; tagIds?: readonly string[] },
  ): Promise<TagGroupNode> {
    const patch = tagGroupUpdatesToPatch(updates);
    const rebinding = updates.tagIds !== undefined;

    if (rebinding) {
      const { add, removeRowIds } = diffTagGroupMembers(
        await this.liveAssignments(id),
        dedupe(updates.tagIds ?? []),
      );
      if (removeRowIds.length > 0) {
        const now = new Date().toISOString();
        const { error } = await this.client
          .from("wiki_tag_group_assignments")
          .update({ is_deleted: true, deleted_at: now, updated_at: now })
          .in("id", removeRowIds);
        if (error) throw new Error(`updateTagGroup failed: ${error.message}`);
      }
      await this.addMembers(id, add, "updateTagGroup");
    }

    if (Object.keys(patch).length > 0 || rebinding) {
      const next = await this.nextVersion(id, "updateTagGroup");
      const { error } = await this.client
        .from("wiki_tag_groups")
        .update({
          ...patch,
          version: next,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw new Error(`updateTagGroup failed: ${error.message}`);
    }

    const row = await requireSingleRow<TagGroupRow>(
      this.client
        .from("wiki_tag_groups")
        .select(TAG_GROUP_SELECT_COLUMNS)
        .eq("id", id)
        .single(),
      "updateTagGroup failed",
    );
    return rowsToTagGroups([row], await this.liveAssignments(id))[0];
  }

  /**
   * Soft-delete the group and its memberships.
   *
   * Memberships go too rather than riding on the parent's flag, because the
   * partial UNIQUE `(tag_id, group_id) where is_deleted = false` would
   * otherwise reject re-adding the same tag if the group id were ever reused,
   * and because `fetchTagGroups` pages the whole membership table — dead rows
   * under a dead group are pure weight on every refresh.
   */
  async deleteTagGroup(id: string): Promise<void> {
    // The version READ comes first, before anything is mutated. Inlined into
    // the update below it would run AFTER the memberships were already
    // soft-deleted, so a throw there (the group is gone, the network dropped)
    // would leave a live group holding no tags — a chip that can only ever
    // empty the grid, which is the one shape the lens must never offer.
    const next = await this.nextVersion(id, "deleteTagGroup");
    const now = new Date().toISOString();
    const marked = { is_deleted: true, deleted_at: now, updated_at: now };
    const { error: memberError } = await this.client
      .from("wiki_tag_group_assignments")
      .update(marked)
      .eq("group_id", id)
      .eq("is_deleted", false);
    if (memberError)
      throw new Error(`deleteTagGroup failed: ${memberError.message}`);
    const { error } = await this.client
      .from("wiki_tag_groups")
      .update({ ...marked, version: next })
      .eq("id", id);
    if (error) throw new Error(`deleteTagGroup failed: ${error.message}`);
  }

  /** Live membership rows, optionally narrowed to one group. */
  private async liveAssignments(
    groupId?: string,
  ): Promise<TagGroupAssignmentRow[]> {
    return fetchAllPages<TagGroupAssignmentRow>((from, to) => {
      const q = this.client
        .from("wiki_tag_group_assignments")
        .select(TAG_GROUP_ASSIGNMENT_SELECT_COLUMNS)
        .eq("is_deleted", false);
      return (groupId ? q.eq("group_id", groupId) : q)
        .order("id")
        .range(from, to);
    }, "fetchTagGroups failed");
  }

  private async addMembers(
    groupId: string,
    tagIds: readonly string[],
    label: string,
  ): Promise<void> {
    if (tagIds.length === 0) return;
    const now = new Date().toISOString();
    const { error } = await this.client
      .from("wiki_tag_group_assignments")
      .insert(
        tagIds.map((tagId) => ({
          id: generateId("tga"),
          tag_id: tagId,
          group_id: groupId,
          updated_at: now,
          is_deleted: false,
          deleted_at: null,
        })),
      );
    if (error) throw new Error(`${label} failed: ${error.message}`);
  }

  private async nextVersion(id: string, label: string): Promise<number> {
    const data = await requireSingleRow<{ version: number }>(
      this.client
        .from("wiki_tag_groups")
        .select("version")
        .eq("id", id)
        .single(),
      `${label} failed`,
    );
    return (data.version ?? 0) + 1;
  }
}

/** First occurrence wins, so a group's tag order is the order it was given. */
function dedupe(tagIds: readonly string[]): string[] {
  return [...new Set(tagIds)];
}

export const PHASE2_TAG_GROUP_METHOD_NAMES = [
  "fetchTagGroups",
  "createTagGroup",
  "updateTagGroup",
  "deleteTagGroup",
] as const;

export type TagGroupMethodName = (typeof PHASE2_TAG_GROUP_METHOD_NAMES)[number];

export const PHASE2_TAG_GROUP_METHODS: ReadonlySet<string> = new Set(
  PHASE2_TAG_GROUP_METHOD_NAMES,
);
