import { useCallback, useEffect, useState } from "react";
import type { DataService } from "../services/DataService";
import type {
  WikiTag,
  WikiTagAssignment,
  WikiTagConnection,
  WikiTagGroup,
  WikiTagGroupAssignment,
} from "../types/wikiTagUnified";
import { generateId } from "../utils/generateId";
import { useSyncContext } from "./useSyncContext";

/*
 * useWikiTagsUnifiedAPI (DU-C+ Step 4).
 *
 * Hook over the unified WikiTag service (SupabaseWikiTagsUnifiedService).
 * Lives next to the legacy `useWikiTagAPI` (frontend) — both will coexist
 * until DU-F deletes the legacy frontend tag UI.
 *
 * Naming: `Unified` suffix to signal items_meta-based 5-role tag/link
 * (vs the legacy Tauri polymorphic API).
 *
 * Pattern A injection: `dataService` + `userId` injected by the Provider
 * (CLAUDE.md §6.4 — no `getDataService()` here). Reacts to `syncVersion`
 * so a Sync round refreshes the local cache.
 */
export interface UseWikiTagsUnifiedAPIOptions {
  dataService: DataService;
}

export function useWikiTagsUnifiedAPI(options: UseWikiTagsUnifiedAPIOptions) {
  const ds = options.dataService;
  const { syncVersion } = useSyncContext();

  const [allTags, setAllTags] = useState<WikiTag[]>([]);
  const [allGroups, setAllGroups] = useState<WikiTagGroup[]>([]);
  const [allGroupAssignments, setAllGroupAssignments] = useState<
    WikiTagGroupAssignment[]
  >([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [tags, groups, groupAssignments] = await Promise.all([
        ds.listAllWikiTagsUnified(),
        ds.listAllWikiTagGroupsUnified(),
        ds.listAllWikiTagGroupAssignments(),
      ]);
      setAllTags(tags);
      setAllGroups(groups);
      setAllGroupAssignments(groupAssignments);
    } finally {
      setLoading(false);
    }
  }, [ds]);

  useEffect(() => {
    void refresh();
  }, [refresh, syncVersion]);

  // -- tag master ----------------------------------------------------------

  const createTag = useCallback(
    async (name: string, color: string | null = null): Promise<WikiTag> => {
      const id = generateId("tag");
      const tag = await ds.createWikiTagUnified(id, name, color);
      setAllTags((prev) =>
        [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)),
      );
      return tag;
    },
    [ds],
  );

  const renameTag = useCallback(
    async (id: string, name: string): Promise<WikiTag> => {
      const updated = await ds.updateWikiTagUnified(id, { name });
      setAllTags((prev) =>
        prev
          .map((t) => (t.id === id ? updated : t))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      return updated;
    },
    [ds],
  );

  const deleteTag = useCallback(
    async (id: string): Promise<void> => {
      await ds.softDeleteWikiTagUnified(id);
      setAllTags((prev) => prev.filter((t) => t.id !== id));
    },
    [ds],
  );

  // -- item↔tag assignments -----------------------------------------------

  const listTagsForItem = useCallback(
    async (itemId: string): Promise<WikiTagAssignment[]> => {
      return ds.listTagsForItem(itemId);
    },
    [ds],
  );

  const assignTagToItem = useCallback(
    async (itemId: string, tagId: string): Promise<WikiTagAssignment> => {
      const assignmentId = generateId("tag_assign");
      return ds.assignTagToItem(assignmentId, itemId, tagId);
    },
    [ds],
  );

  const unassignTagFromItem = useCallback(
    async (assignmentId: string): Promise<void> => {
      await ds.unassignTagFromItem(assignmentId);
    },
    [ds],
  );

  // -- item↔item links ----------------------------------------------------

  const listLinksFromItem = useCallback(
    async (itemId: string): Promise<WikiTagConnection[]> => {
      return ds.listLinksFromItem(itemId);
    },
    [ds],
  );

  const listLinksToItem = useCallback(
    async (itemId: string): Promise<WikiTagConnection[]> => {
      return ds.listLinksToItem(itemId);
    },
    [ds],
  );

  const createItemLink = useCallback(
    async (
      fromItemId: string,
      toItemId: string,
    ): Promise<WikiTagConnection> => {
      if (fromItemId === toItemId) {
        throw new Error("createItemLink: self-loop rejected");
      }
      const linkId = generateId("link");
      return ds.createItemLink(linkId, fromItemId, toItemId);
    },
    [ds],
  );

  const deleteItemLink = useCallback(
    async (linkId: string): Promise<void> => {
      await ds.deleteItemLink(linkId);
    },
    [ds],
  );

  // -- tag groups (DU-F Step 11) ------------------------------------------

  const createGroup = useCallback(
    async (name: string): Promise<WikiTagGroup> => {
      const id = generateId("tag_group");
      const group = await ds.createWikiTagGroupUnified(id, name);
      setAllGroups((prev) =>
        [...prev, group].sort((a, b) => a.name.localeCompare(b.name)),
      );
      return group;
    },
    [ds],
  );

  const renameGroup = useCallback(
    async (id: string, name: string): Promise<WikiTagGroup> => {
      const updated = await ds.updateWikiTagGroupUnified(id, { name });
      setAllGroups((prev) =>
        prev
          .map((g) => (g.id === id ? updated : g))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      return updated;
    },
    [ds],
  );

  const deleteGroup = useCallback(
    async (id: string): Promise<void> => {
      await ds.softDeleteWikiTagGroupUnified(id);
      setAllGroups((prev) => prev.filter((g) => g.id !== id));
      // Memberships of the deleted group are no longer reachable; prune
      // them from the cache so derived selectors stay consistent. The DB
      // row itself stays alive (RLS-bound delete is async via DU-G).
      setAllGroupAssignments((prev) => prev.filter((a) => a.groupId !== id));
    },
    [ds],
  );

  const assignTagToGroup = useCallback(
    async (tagId: string, groupId: string): Promise<WikiTagGroupAssignment> => {
      const id = generateId("tag_group_assign");
      const created = await ds.assignTagToGroup(id, tagId, groupId);
      setAllGroupAssignments((prev) => [...prev, created]);
      return created;
    },
    [ds],
  );

  const unassignTagFromGroup = useCallback(
    async (assignmentId: string): Promise<void> => {
      await ds.unassignTagFromGroup(assignmentId);
      setAllGroupAssignments((prev) =>
        prev.filter((a) => a.id !== assignmentId),
      );
    },
    [ds],
  );

  return {
    allTags,
    allGroups,
    allGroupAssignments,
    loading,
    refresh,
    createTag,
    renameTag,
    deleteTag,
    listTagsForItem,
    assignTagToItem,
    unassignTagFromItem,
    listLinksFromItem,
    listLinksToItem,
    createItemLink,
    deleteItemLink,
    createGroup,
    renameGroup,
    deleteGroup,
    assignTagToGroup,
    unassignTagFromGroup,
  };
}
