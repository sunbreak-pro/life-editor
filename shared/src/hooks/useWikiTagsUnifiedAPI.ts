import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DataService } from "../services/DataService";
import type {
  WikiTag,
  WikiTagAssignment,
  WikiTagConnection,
  WikiTagConnectionOrigin,
} from "../types/wikiTagUnified";
import { generateId } from "../utils/generateId";
import {
  extractItemLinkTargets,
  findMissingInlineLinks,
  findStaleInlineLinks,
} from "../utils/inlineLinkSync";
import { useSyncDomains } from "./useSyncDomains";
import { useDomainLoad } from "./useDomainLoad";
import type { UndoRedoLike } from "./useTodoTreeHistory";

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
/**
 * What a bulk tag operation did (#1644). The rows are written one at a time,
 * so a failure part-way leaves the earlier rows written: the caller reports
 * `failed` and keeps the rest, which is safe to retry because assigning an
 * existing pair reuses its row (#1593).
 */
export interface BulkTagResult {
  succeeded: number;
  failed: number;
}

export interface UseWikiTagsUnifiedAPIOptions {
  dataService: DataService;
  /**
   * History to record tag assign / unassign on (#1667). Injected by
   * WikiTagsUnifiedProvider, which hands over the ambient global stack when an
   * UndoRedoProvider is mounted (#1800 — the same place the other five domains
   * read it). Left out, this hook records no history, which is what a
   * standalone mount and most of the suites want.
   */
  undoRedo?: UndoRedoLike;
}

export function useWikiTagsUnifiedAPI(options: UseWikiTagsUnifiedAPIOptions) {
  const ds = options.dataService;
  const syncVersion = useSyncDomains("tags");
  const undoRedo = options.undoRedo;
  // The ambient context value changes identity on every stack change; reading
  // it through a ref keeps the mutators below (and so this hook's return
  // value) from being rebuilt each time anything in the app is undone.
  const undoRedoRef = useRef(undoRedo);
  useEffect(() => {
    undoRedoRef.current = undoRedo;
  });

  const [allTags, setAllTags] = useState<WikiTag[]>([]);
  // Bulk caches that replace the per-row N+1 fetches in TagPicker /
  // LinkPanel. Loaded once per refresh and bucketed by item below.
  const [allAssignments, setAllAssignments] = useState<WikiTagAssignment[]>([]);
  const [allConnections, setAllConnections] = useState<WikiTagConnection[]>([]);
  // Has a bulk load ever LANDED? State rather than a ref because `loading`
  // below is derived from it and has to re-render when it flips. Written only
  // from `applyAll`, which runs as an async callback, never from an effect
  // body (#586 / #891 — see useDomainLoad's header for why that distinction
  // is the whole point of this hook).
  const [hasLoaded, setHasLoaded] = useState(false);

  // The three bulk reads and the three setters, named once so the load effect
  // below and the imperative `refresh` cannot drift apart.
  const loadAll = useCallback(
    (service: DataService) =>
      Promise.all([
        service.listAllWikiTagsUnified(),
        service.listAllTagAssignments(),
        service.listAllTagConnections(),
      ]),
    [],
  );

  const applyAll = useCallback(
    ([tags, assignments, connections]: [
      WikiTag[],
      WikiTagAssignment[],
      WikiTagConnection[],
    ]) => {
      setAllTags(tags);
      setAllAssignments(assignments);
      setAllConnections(connections);
      setHasLoaded(true);
    },
    [],
  );

  // Load on mount and on every tags bump, through the shared load effect
  // (#672 / #891). `error` is new on this hook's surface — the effect this
  // replaces had no catch at all, so a failed bulk load became an unhandled
  // rejection and the tag surfaces just showed an empty graph. Nothing renders
  // it yet (an error card is a visible change); what it buys now is that
  // #296's un-latch is in place before any surface starts reading it.
  const { isLoading: attemptInFlight, error } = useDomainLoad({
    domain: "WikiTags",
    snapshotKey: "wikiTags",
    dataService: ds,
    version: syncVersion,
    load: loadAll,
    apply: applyAll,
    fallbackMessage: "Failed to load tags",
  });

  /*
   * #300: `loading` means "no data yet", NOT "a refresh is in flight". A
   * syncVersion bump lands here ~1.1s after every typing pause (own-write
   * Realtime echo), and every tag surface (TagPicker pills / LinkPanel /
   * Tags-tab list) gates its already-rendered chips on this flag — flipping it
   * during a background refetch unmounts them all for the round-trip, which is
   * the reported flicker. Stale data stays visible instead.
   *
   * Written out as `in flight AND nothing has ever landed` rather than
   * `refetchReportsLoading: false`, because the two differ after a FAILED
   * first load: the old code re-armed its loading flag on the next attempt
   * (`if (!hasLoadedRef.current) setLoading(true)`) and there genuinely is no
   * data yet in that state. `refetchReportsLoading: false` would have left it
   * false and reported "no tags" instead of "still trying".
   */
  const loading = attemptInFlight && !hasLoaded;

  // Imperative reload, kept on the public surface (no in-repo caller today).
  // Behaviour note: it no longer raises `loading` while in flight. That only
  // ever applied before the first successful load — the flag was pinned false
  // afterwards by the #300 rule above — and an imperative call cannot drive
  // the shared effect's derived state without writing it from a render.
  const refresh = useCallback(async () => {
    applyAll(await loadAll(ds));
  }, [applyAll, loadAll, ds]);

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

  const setTagName = useCallback(
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

  // The write + cache update, without history. Undo and redo replay these,
  // so they must not push a command of their own.
  const writeAssign = useCallback(
    async (itemId: string, tagId: string): Promise<WikiTagAssignment> => {
      const assignmentId = generateId("tag_assign");
      const created = await ds.assignTagToItem(assignmentId, itemId, tagId);
      // By id, not by append: the service revives the pair's existing row
      // when there is one (#1593), so `created` can be a row the cache is
      // already holding — an assignment the user clicked twice would
      // otherwise show up as two pills.
      setAllAssignments((prev) => [
        ...prev.filter((a) => a.id !== created.id),
        created,
      ]);
      return created;
    },
    [ds],
  );

  const writeUnassign = useCallback(
    async (assignmentId: string): Promise<void> => {
      await ds.unassignTagFromItem(assignmentId);
      setAllAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
    },
    [ds],
  );

  // What the cache held when a mutator was called. Read from a ref so the
  // mutators do not re-create on every assignment change.
  const assignmentsRef = useRef(allAssignments);
  useEffect(() => {
    assignmentsRef.current = allAssignments;
  });

  /*
   * #1667 — both directions go on the global Undo stack.
   *
   * The pair (item, tag) is what the user acted on, not the row id: the
   * service revives a pair's soft-deleted row rather than inserting a second
   * one (#1593), so a redo gets the same row back today, but the commands
   * track whatever id the latest write returned instead of relying on that.
   */
  const assignTagToItem = useCallback(
    async (itemId: string, tagId: string): Promise<WikiTagAssignment> => {
      const wasAssigned = assignmentsRef.current.some(
        (a) => a.itemId === itemId && a.tagId === tagId && !a.isDeleted,
      );
      let current = await writeAssign(itemId, tagId);
      // Assigning a tag the item already carries changed nothing; undoing it
      // would remove a tag the user never touched.
      if (!wasAssigned) {
        undoRedoRef.current?.push("tags", {
          label: "assignTag",
          undo: () => writeUnassign(current.id),
          redo: async () => {
            current = await writeAssign(itemId, tagId);
          },
        });
      }
      return current;
    },
    [writeAssign, writeUnassign],
  );

  const unassignTagFromItem = useCallback(
    async (assignmentId: string): Promise<void> => {
      const row = assignmentsRef.current.find((a) => a.id === assignmentId);
      await writeUnassign(assignmentId);
      // A row the cache never saw has no pair to put back.
      if (!row) return;
      let currentId = assignmentId;
      undoRedoRef.current?.push("tags", {
        label: "unassignTag",
        undo: async () => {
          currentId = (await writeAssign(row.itemId, row.tagId)).id;
        },
        redo: () => writeUnassign(currentId),
      });
    },
    [writeAssign, writeUnassign],
  );

  // -- bulk operations (#1644) ---------------------------------------------
  //
  // These call the history-FREE writes, not the mutators above. One press
  // covering 20 rows is one thing the user did, and pushing 20 commands would
  // evict the rest of the stack (MAX_HISTORY_SIZE) while making Ctrl+Z undo
  // the run one row at a time. Giving a run a single command is worth doing;
  // it is #1667's follow-up, not part of it.
  //
  // Sequential calls to the single-row writes above rather than an RPC: the
  // plan's alternatives table keeps a Postgres function out until a real
  // bulk operation is measured to stall (no DDL for 10–20 row selections).
  // Sequential rather than Promise.all so a failing row cannot race the rest
  // and the counts are exact.

  /** The live assignment carrying `tagId` on `itemId`, if any. */
  const findAssignment = useCallback(
    (itemId: string, tagId: string) =>
      allAssignments.find(
        (a) => a.itemId === itemId && a.tagId === tagId && !a.isDeleted,
      ),
    [allAssignments],
  );

  const bulkAssign = useCallback(
    async (
      itemIds: readonly string[],
      tagId: string,
    ): Promise<BulkTagResult> => {
      const result: BulkTagResult = { succeeded: 0, failed: 0 };
      for (const itemId of itemIds) {
        try {
          await writeAssign(itemId, tagId);
          result.succeeded += 1;
        } catch {
          result.failed += 1;
        }
      }
      return result;
    },
    [writeAssign],
  );

  const bulkUnassign = useCallback(
    async (
      itemIds: readonly string[],
      tagId: string,
    ): Promise<BulkTagResult> => {
      const result: BulkTagResult = { succeeded: 0, failed: 0 };
      for (const itemId of itemIds) {
        const row = findAssignment(itemId, tagId);
        // Nothing to take off counts as done: the item already reads as
        // untagged, which is what was asked for.
        if (!row) {
          result.succeeded += 1;
          continue;
        }
        try {
          await writeUnassign(row.id);
          result.succeeded += 1;
        } catch {
          result.failed += 1;
        }
      }
      return result;
    },
    [findAssignment, writeUnassign],
  );

  /**
   * Refile items from one tag to another: every assign first, then the old
   * rows of only the items that made it across — an item whose assign failed
   * keeps its old tag instead of ending up with none.
   */
  const moveItemsToTag = useCallback(
    async (
      itemIds: readonly string[],
      fromTagId: string,
      toTagId: string,
    ): Promise<BulkTagResult> => {
      if (fromTagId === toTagId)
        return { succeeded: itemIds.length, failed: 0 };
      const moved: string[] = [];
      let failed = 0;
      for (const itemId of itemIds) {
        try {
          await writeAssign(itemId, toTagId);
          moved.push(itemId);
        } catch {
          failed += 1;
        }
      }
      const off = await bulkUnassign(moved, fromTagId);
      return { succeeded: off.succeeded, failed: failed + off.failed };
    },
    [writeAssign, bulkUnassign],
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
      origin: WikiTagConnectionOrigin = "manual",
    ): Promise<WikiTagConnection> => {
      if (fromItemId === toItemId) {
        throw new Error("createItemLink: self-loop rejected");
      }
      const linkId = generateId("link");
      const created = await ds.createItemLink(
        linkId,
        fromItemId,
        toItemId,
        origin,
      );
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

  /*
   * Reconcile the link graph against the body a save just stored (#372, made
   * two-way by #1690). Both directions, because the text is the record:
   *
   *   - an inline-origin edge whose "[[ ]]" has left the text is soft-deleted
   *   - a link the text carries with no live edge gets one, origin "inline"
   *
   * The add is what makes Ctrl+Shift+Z work. Only the picker used to create
   * the edge (`onResolvedInserted`), so a redo brought the link node back into
   * the text and left the LinkPanel row gone for good — the delete half had
   * already removed it on the save after the Ctrl+Z, and nothing ever put it
   * back. A paste and a template body were the same shape.
   *
   * Manual edges (LinkPanel / Connect) are never candidates for either half:
   * the delete only looks at origin "inline", and the add treats an edge of
   * any origin as already present.
   *
   * No-op when the body is not a TipTap doc — legacy plain text cannot carry
   * link atoms, and an unparseable body must not read as "all links removed".
   */
  const syncInlineLinks = useCallback(
    async (fromItemId: string, content: string): Promise<void> => {
      const targets = extractItemLinkTargets(content);
      if (targets === null) return;
      const stale = findStaleInlineLinks(allConnections, fromItemId, targets);
      const missing = findMissingInlineLinks(
        allConnections,
        fromItemId,
        targets,
      );
      await Promise.all([
        ...stale.map(async (l) => {
          await ds.deleteItemLink(l.id);
          setAllConnections((prev) => prev.filter((c) => c.id !== l.id));
        }),
        ...missing.map(async (toItemId) => {
          const created = await ds.createItemLink(
            generateId("link"),
            fromItemId,
            toItemId,
            "inline",
          );
          setAllConnections((prev) => [...prev, created]);
        }),
      ]);
    },
    [ds, allConnections],
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

  /**
   * Point the item's display colour at one of its tags (#1580), or clear the
   * choice with `tagId = null` so it falls back to the earliest-assigned one.
   *
   * Takes a TAG id rather than an assignment id because that is what a caller
   * has: the picker lists an item's tags. The row is looked up here, from the
   * bulk cache the caller is already rendering from.
   *
   * Local state is updated as one pass over the item's rows — the write is a
   * swap (see the service), so flipping only the new row would leave the old
   * one lit until the next refresh and the picker would show two.
   */
  const setDisplayColorTag = useCallback(
    async (itemId: string, tagId: string | null): Promise<void> => {
      const target = tagId
        ? (assignmentsByItem.get(itemId) ?? []).find(
            (a) => a.tagId === tagId && !a.isDeleted,
          )
        : null;
      // A tag the item does not carry cannot speak for it. Silently doing
      // nothing would read as the click being ignored, so say so.
      if (tagId && !target) {
        throw new Error(
          `setDisplayColorTag: ${tagId} is not assigned to ${itemId}`,
        );
      }
      await ds.setDisplayColorTag(itemId, target?.id ?? null);
      setAllAssignments((prev) =>
        prev.map((a) =>
          a.itemId === itemId
            ? { ...a, isDisplayColor: target != null && a.id === target.id }
            : a,
        ),
      );
    },
    [ds, assignmentsByItem],
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
      error,
      refresh,
      createTag,
      setTagName,
      setTagColor,
      setTagIcon,
      deleteTag,
      listTagsForItem,
      assignTagToItem,
      unassignTagFromItem,
      bulkAssign,
      bulkUnassign,
      moveItemsToTag,
      setDisplayColorTag,
      listLinksFromItem,
      listLinksToItem,
      createItemLink,
      deleteItemLink,
      syncInlineLinks,
      getTagsForItem,
      getLinksForItem,
    }),
    [
      allTags,
      allAssignments,
      allConnections,
      countsByTag,
      loading,
      error,
      refresh,
      createTag,
      setTagName,
      setTagColor,
      setTagIcon,
      deleteTag,
      listTagsForItem,
      assignTagToItem,
      unassignTagFromItem,
      bulkAssign,
      bulkUnassign,
      moveItemsToTag,
      setDisplayColorTag,
      listLinksFromItem,
      listLinksToItem,
      createItemLink,
      deleteItemLink,
      syncInlineLinks,
      getTagsForItem,
      getLinksForItem,
    ],
  );
}
