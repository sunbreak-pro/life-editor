import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DataService } from "../services/DataService";
import type {
  WikiTag,
  WikiTagAssignment,
  WikiTagConnection,
} from "../types/wikiTagUnified";
import { generateId } from "../utils/generateId";
import { useSyncDomains } from "./useSyncDomains";

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
  const syncVersion = useSyncDomains("tags");

  const [allTags, setAllTags] = useState<WikiTag[]>([]);
  // Bulk caches that replace the per-row N+1 fetches in TagPicker /
  // LinkPanel. Loaded once per refresh and bucketed by item below.
  const [allAssignments, setAllAssignments] = useState<WikiTagAssignment[]>([]);
  const [allConnections, setAllConnections] = useState<WikiTagConnection[]>([]);
  const [loading, setLoading] = useState(true);
  // #300: `loading` means "no data yet", NOT "a refresh is in flight". A
  // syncVersion bump lands here ~1.1s after every typing pause (own-write
  // Realtime echo), and every tag surface (TagPicker pills / LinkPanel /
  // Tags-tab list) gates its already-rendered chips on this flag — flipping
  // it during a background refetch unmounts them all for the round-trip,
  // which is the reported flicker. Stale data stays visible instead.
  const hasLoadedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!hasLoadedRef.current) setLoading(true);
    try {
      const [tags, assignments, connections] = await Promise.all([
        ds.listAllWikiTagsUnified(),
        ds.listAllTagAssignments(),
        ds.listAllTagConnections(),
      ]);
      setAllTags(tags);
      setAllAssignments(assignments);
      setAllConnections(connections);
      hasLoadedRef.current = true;
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

  const setTagIcon = useCallback(
    async (id: string, icon: string | null): Promise<WikiTag> => {
      const updated = await ds.updateWikiTagUnified(id, { icon });
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

  // tagId → number of active items carrying that tag (role-agnostic). Built
  // from the same `allAssignments` cache — no extra fetch. `allAssignments` is
  // already live-only on BOTH sides (the service filters the assignment's own
  // is_deleted AND joins items_meta to drop trashed items — #365) and
  // `wiki_tag_assignments` is UNIQUE(item_id, tag_id), so a plain count is the
  // distinct active-item count. The `!isDeleted` guard is belt-and-suspenders
  // against any optimistic local rows.
  const countsByTag = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of allAssignments) {
      if (a.isDeleted) continue;
      map.set(a.tagId, (map.get(a.tagId) ?? 0) + 1);
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
      // #409: the tag editor lists the items behind each tag, including ones
      // whose item row it cannot resolve (a routine, a dismissed event) —
      // those must still be removable, so it needs the raw rows, not just the
      // per-item buckets or the counts.
      allAssignments,
      allConnections,
      countsByTag,
      loading,
      refresh,
      createTag,
      renameTag,
      setTagColor,
      setTagIcon,
      deleteTag,
      listTagsForItem,
      assignTagToItem,
      unassignTagFromItem,
      listLinksFromItem,
      listLinksToItem,
      createItemLink,
      deleteItemLink,
      getTagsForItem,
      getLinksForItem,
    }),
    [
      allTags,
      allAssignments,
      allConnections,
      countsByTag,
      loading,
      refresh,
      createTag,
      renameTag,
      setTagColor,
      setTagIcon,
      deleteTag,
      listTagsForItem,
      assignTagToItem,
      unassignTagFromItem,
      listLinksFromItem,
      listLinksToItem,
      createItemLink,
      deleteItemLink,
      getTagsForItem,
      getLinksForItem,
    ],
  );
}
