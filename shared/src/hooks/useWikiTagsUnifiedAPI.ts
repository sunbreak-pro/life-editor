import { useCallback, useEffect, useMemo, useState } from "react";
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
  // Bulk caches that replace the per-row N+1 fetches in TagPicker /
  // LinkPanel. Loaded once per refresh and bucketed by item below.
  const [allAssignments, setAllAssignments] = useState<WikiTagAssignment[]>([]);
  const [allConnections, setAllConnections] = useState<WikiTagConnection[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [tags, groups, groupAssignments, assignments, connections] =
        await Promise.all([
          ds.listAllWikiTagsUnified(),
          ds.listAllWikiTagGroupsUnified(),
          ds.listAllWikiTagGroupAssignments(),
          ds.listAllTagAssignments(),
          ds.listAllTagConnections(),
        ]);
      setAllTags(tags);
      setAllGroups(groups);
      setAllGroupAssignments(groupAssignments);
      setAllAssignments(assignments);
      setAllConnections(connections);
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

  const setTagColor = useCallback(
    async (id: string, color: string | null): Promise<WikiTag> => {
      const updated = await ds.updateWikiTagUnified(id, { color });
      setAllTags((prev) => prev.map((t) => (t.id === id ? updated : t)));
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
      const created = await ds.assignTagToItem(assignmentId, itemId, tagId);
      setAllAssignments((prev) => [...prev, created]);
      return created;
    },
    [ds],
  );

  const unassignTagFromItem = useCallback(
    async (assignmentId: string): Promise<void> => {
      await ds.unassignTagFromItem(assignmentId);
      setAllAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
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
      const created = await ds.createItemLink(linkId, fromItemId, toItemId);
      setAllConnections((prev) => [...prev, created]);
      return created;
    },
    [ds],
  );

  const deleteItemLink = useCallback(
    async (linkId: string): Promise<void> => {
      await ds.deleteItemLink(linkId);
      setAllConnections((prev) => prev.filter((l) => l.id !== linkId));
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
      // them from the cache so derived selectors stay consistent. The
      // membership rows stay alive on the DB side (no cascade soft-
      // delete wired) — the next Sync round refreshes live state.
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

  // -- bulk-derived buckets (N+1 elimination) ------------------------------

  // itemId → assignments. Built once per `allAssignments` change so each
  // TagPicker reads its row synchronously instead of fetching.
  const assignmentsByItem = useMemo(() => {
    const map = new Map<string, WikiTagAssignment[]>();
    for (const a of allAssignments) {
      const arr = map.get(a.itemId);
      if (arr) arr.push(a);
      else map.set(a.itemId, [a]);
    }
    return map;
  }, [allAssignments]);

  // itemId → { outgoing, incoming } links. A link is bucketed under its
  // `fromItemId` (outgoing) and its `toItemId` (incoming) so LinkPanel
  // reads both directions for a row synchronously.
  const linksByItem = useMemo(() => {
    const map = new Map<
      string,
      { outgoing: WikiTagConnection[]; incoming: WikiTagConnection[] }
    >();
    const bucket = (id: string) => {
      let entry = map.get(id);
      if (!entry) {
        entry = { outgoing: [], incoming: [] };
        map.set(id, entry);
      }
      return entry;
    };
    for (const c of allConnections) {
      bucket(c.fromItemId).outgoing.push(c);
      bucket(c.toItemId).incoming.push(c);
    }
    return map;
  }, [allConnections]);

  const EMPTY_ASSIGNMENTS: readonly WikiTagAssignment[] = useMemo(() => [], []);
  const EMPTY_LINKS = useMemo(
    () => ({
      outgoing: [] as WikiTagConnection[],
      incoming: [] as WikiTagConnection[],
    }),
    [],
  );

  const getTagsForItem = useCallback(
    (itemId: string): readonly WikiTagAssignment[] =>
      assignmentsByItem.get(itemId) ?? EMPTY_ASSIGNMENTS,
    [assignmentsByItem, EMPTY_ASSIGNMENTS],
  );

  const getLinksForItem = useCallback(
    (
      itemId: string,
    ): {
      outgoing: readonly WikiTagConnection[];
      incoming: readonly WikiTagConnection[];
    } => linksByItem.get(itemId) ?? EMPTY_LINKS,
    [linksByItem, EMPTY_LINKS],
  );

  return useMemo(
    () => ({
      allTags,
      allGroups,
      allGroupAssignments,
      allConnections,
      loading,
      refresh,
      createTag,
      renameTag,
      setTagColor,
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
      getTagsForItem,
      getLinksForItem,
    }),
    [
      allTags,
      allGroups,
      allGroupAssignments,
      allConnections,
      loading,
      refresh,
      createTag,
      renameTag,
      setTagColor,
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
      getTagsForItem,
      getLinksForItem,
    ],
  );
}
