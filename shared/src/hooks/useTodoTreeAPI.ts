import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import type { TodoNode } from "../types/todoTree";
import type { DataService } from "../services/DataService";
import { useTodoTreeCRUD } from "./useTodoTreeCRUD";
import { useTodoTreeDeletion } from "./useTodoTreeDeletion";
import {
  useTodoTreeHistory,
  createNoopUndoRedo,
  type UndoRedoLike,
  type PersistSettled,
  type TodoHistoryLabel,
} from "./useTodoTreeHistory";
import { logServiceError } from "../utils/logError";
import { collectDescendantIds } from "../utils/getDescendantTodos";
import { generateTodoId } from "../utils/generateId";
import { useDomainLoad } from "./useDomainLoad";
import { useSyncDomains } from "./useSyncDomains";
import {
  getTodoSelection,
  setTodoSelection,
  clearTodoSelection,
} from "../state/materialsSelectionStore";

/*
 * #2332 (plan 2026-10-21-offline-cache.md P1b-0) — a tree write sends only
 * the rows it changed.
 *
 * The write paths below hand `syncToDb` the WHOLE list (they are written as
 * "map the list, persist the result"), and `syncTodoTree` upserts every row
 * it is given with a fresh `updated_at`. Adding one todo to a tree of a
 * hundred rewrote a hundred rows, which a delta read keyed on `updated_at`
 * (P1b) would then download again, and an offline add replayed later (P2a)
 * would write every other todo back with stale values.
 *
 * So `syncToDb` compares the list with what the DB is known to hold and sends
 * the difference. Known = the last loaded tree, with each landed write laid
 * over it. A row this hook cannot vouch for — new, failed to write, or taken
 * out of the DB by `removeFromDb` — is not in that map and is always sent.
 */
function sameTodoNode(a: TodoNode, b: TodoNode): boolean {
  if (a === b) return true;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    // Never written by syncTodoTree (the DB stamps it), so not a change.
    if (key === "updatedAt") continue;
    if (a[key as keyof TodoNode] !== b[key as keyof TodoNode]) return false;
  }
  return true;
}

function changedTodoNodes(
  known: ReadonlyMap<string, TodoNode>,
  nodes: readonly TodoNode[],
): TodoNode[] {
  return nodes.filter((n) => {
    const stored = known.get(n.id);
    return stored === undefined || !sameTodoNode(stored, n);
  });
}

/**
 * Options the host injects. The Tauri version reached into a module
 * singleton (`getDataService()`) and a host UndoRedo Context; the shared hook
 * takes both by injection so it is host-agnostic (CLAUDE.md §6.4). `undoRedo`
 * defaults to a no-op (web S1 — real UndoRedo lands in S6).
 */
export interface UseTodoTreeAPIOptions {
  dataService: DataService;
  undoRedo?: UndoRedoLike;
  /**
   * #282: opt-in cross-remount selection persistence via the module-level
   * materialsSelectionStore. Only the Materials Todos mount passes true —
   * the Schedule section mounts this hook too (MainScreen) and must neither
   * restore nor overwrite the Materials selection.
   */
  persistSelection?: boolean;
}

export function useTodoTreeAPI(options: UseTodoTreeAPIOptions) {
  const { dataService: ds } = options;
  const undoRedo = options.undoRedo ?? createNoopUndoRedo();
  const persistSelection = options.persistSelection ?? false;

  const [nodes, setNodes] = useState<TodoNode[]>([]);
  const [persistError, setPersistError] = useState<string | null>(null);
  // Pure selection state (W7). DataService-independent — mirrors Notes'
  // `selectedNoteId` (useNotesUnifiedAPI). Drives the todo detail the Kanban
  // host shows in the rightSidebar; the ref lets the delete wrappers below clear a selection
  // that falls inside a deleted subtree without re-subscribing.
  const [selectedTodoId, setSelectedTodoIdState] = useState<string | null>(
    null,
  );
  const selectedTodoIdRef = useRef(selectedTodoId);
  useEffect(() => {
    selectedTodoIdRef.current = selectedTodoId;
  }, [selectedTodoId]);
  // #282: write-through wrapper for the PUBLIC setter so a Materials tab/
  // section switch can restore the selection after this provider remounts.
  // null clears the store entry. Todo ids need existence validation on
  // restore (see the restore effect), unlike Daily's always-valid date key,
  // so we do NOT seed the initial state from the store here.
  const setSelectedTodoId = useCallback(
    (id: string | null): void => {
      setSelectedTodoIdState(id);
      if (!persistSelection) return;
      if (id === null) clearTodoSelection();
      else setTodoSelection(id);
    },
    [persistSelection],
  );
  const loadedRef = useRef(false);
  // What the DB holds as far as this hook knows (#2332 — see changedTodoNodes).
  // Filled only from a read that reached the DB: a list replayed from the
  // snapshot store (#1101) may be older than the DB, so until the first read
  // lands every write sends the whole list, as before #2332.
  const knownRef = useRef<Map<string, TodoNode>>(new Map());
  const fetchLandedRef = useRef(false);
  const syncVersion = useSyncDomains("todos");

  // One-shot RESTORE (#282): re-select the todo the user had open before the
  // provider unmounted (Materials tab/section switch). The id lives in the
  // module-level materialsSelectionStore, which outlives this React tree.
  // Called from the load path's `apply` below (#586 — setState there is an
  // async callback, not the effect body), so it only ever sees a
  // SUCCESSFULLY loaded set: a failed fetch never reaches it, which is what
  // keeps a transient error from consuming the one-shot (restoredRef) or
  // erasing the remembered selection — the next successful reload retries.
  // Never fights a user action already made (bail if something is selected).
  // A stored id that is missing or soft-deleted in the loaded set clears the
  // store entry.
  const restoredRef = useRef(false);
  const restoreSelection = useCallback(
    (loaded: TodoNode[]) => {
      if (!persistSelection) return; // non-Materials mount (Schedule) — no restore
      if (restoredRef.current) return;
      restoredRef.current = true;
      const storedId = getTodoSelection();
      if (storedId === null) return;
      if (selectedTodoIdRef.current !== null) return; // user already selected
      const node = loaded.find((n) => n.id === storedId);
      if (!node || node.isDeleted) {
        clearTodoSelection(); // stale/soft-deleted id — drop it
        return;
      }
      setSelectedTodoIdState(storedId); // store already holds it, no write-through
    },
    [persistSelection],
  );

  // Load from DataService on mount and on every todos bump, through the shared
  // load effect (#672 / #891). Live todos only since #2326: the trashed ones
  // were read alongside on every mount for a Trash list that the Trash screen
  // reads for itself. A todo trashed in THIS session still sits in `nodes`
  // with `isDeleted`, which is what undo and restoreNode work from. Same
  // three states as the hand-written version it replaces, plus #296's error
  // un-latch, which this hook was missing: one transient failure used to
  // leave the error card up for the rest of the session.
  const { isLoading, error } = useDomainLoad({
    domain: "TodoTree",
    snapshotKey: "todoTree",
    dataService: ds,
    version: syncVersion,
    load: async (service) => {
      const fetched = await service.fetchTodoTree();
      // Set HERE, not in `apply`: the snapshot replay never runs it.
      fetchLandedRef.current = true;
      return fetched;
    },
    apply: (active) => {
      setNodes(active);
      if (fetchLandedRef.current)
        knownRef.current = new Map(active.map((n) => [n.id, n]));
      loadedRef.current = true;
      restoreSelection(active);
    },
    fallbackMessage: "Failed to load todos",
    // The board (KanbanView) swaps itself for a skeleton while this is true,
    // and Realtime echoes the tab's own writes back, so a bump-driven re-read
    // must not flip it — matching the effect this replaces, which only ever
    // wrote `false`.
    refetchReportsLoading: false,
  });

  const refetch = useCallback(async () => {
    try {
      const fetched = await ds.fetchTodoTree();
      setNodes(fetched);
      fetchLandedRef.current = true;
      knownRef.current = new Map(fetched.map((n) => [n.id, n]));
    } catch (e) {
      logServiceError("TodoTree", "refetch", e);
    }
  }, [ds]);

  // The most recent tree write, settled either way (#1485). `removeFromDb`
  // queues behind it: the undo of a create can fire while the create's own
  // upsert is still in flight, and a soft delete that reaches the DB first is
  // a zero-row UPDATE — PostgREST calls that success, and the insert landing a
  // moment later puts the todo back with the undo already spent.
  const lastSyncRef = useRef<Promise<void>>(Promise.resolve());

  /*
   * #1682 — the write both queues and REPORTS.
   *
   * Two changes over the fire-and-forget version. It chains on `lastSyncRef`
   * like `removeFromDb` always did, so an undo pressed while the original
   * upsert is still in flight lands after it rather than against it; and it
   * hands the promise back, so the undo closure that called it can fail and
   * let the manager say so. Before this a failed tree sync set `persistError`
   * — a state nothing renders — and the user got "Undid: todo change" over a
   * reversal that never reached the DB.
   *
   * The queue itself is kept on a swallowed copy: one failed write must not
   * leave every later write chained behind a rejected promise.
   */
  const syncToDb = useCallback(
    (updated: TodoNode[], onSettled?: PersistSettled): Promise<void> => {
      setPersistError(null);
      // The difference is taken when the write's turn comes, not when it is
      // queued: by then every earlier write has landed (or failed) and the
      // map says so.
      const run = lastSyncRef.current.then(() => {
        const changed = changedTodoNodes(knownRef.current, updated);
        if (changed.length === 0) {
          onSettled?.(true);
          return;
        }
        return ds.syncTodoTree(changed).then(
          () => {
            for (const n of changed) knownRef.current.set(n.id, n);
            onSettled?.(true);
          },
          (e: unknown) => {
            // Whether any of them landed is unknown: send them all next time.
            for (const n of changed) knownRef.current.delete(n.id);
            logServiceError("TodoTree", "sync", e);
            setPersistError(
              e instanceof Error ? e.message : "Failed to save todos",
            );
            onSettled?.(false);
            throw e;
          },
        );
      });
      lastSyncRef.current = run.catch(() => {});
      return run;
    },
    [ds],
  );

  // Undo of a create (#1485): the row leaves the DB the way an undone Event
  // create does (useScheduleItemsCRUD → softDeleteScheduleItem) — a soft
  // delete, so it is recoverable from Trash and a redo's upsert brings the
  // same id back with `is_deleted: false`.
  const removeFromDb = useCallback(
    (id: string): Promise<void> => {
      // The row in the DB stops matching its node (it is deleted there), so a
      // redo must send it again (#2332). Forgotten when the turn comes, after
      // the create's own write has recorded it.
      const run = lastSyncRef.current.then(() => {
        knownRef.current.delete(id);
        return ds.softDeleteTodo(id);
      });
      lastSyncRef.current = run.then(
        () => {},
        (e: unknown) => logServiceError("TodoTree", "undoCreate", e),
      );
      return run.then(() => {});
    },
    [ds],
  );

  const {
    persistWithHistory: rawPersistWithHistory,
    persistCreateWithHistory: rawPersistCreateWithHistory,
    persistSilent: rawPersistSilent,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
  } = useTodoTreeHistory(setNodes, syncToDb, undoRedo, removeFromDb);

  // The guard drops the write when the tree has not loaded yet (persisting a
  // half-known tree would delete the rows it doesn't know about). That drop is
  // silent on screen, so anything chained to the write is told it did NOT land
  // — otherwise a follow-up would write against a row that was never created.
  const guardedPersistWithHistory = useCallback(
    (
      currentNodes: TodoNode[],
      updated: TodoNode[],
      onSettled?: PersistSettled,
      label?: TodoHistoryLabel,
    ) => {
      if (!loadedRef.current) {
        onSettled?.(false);
        return;
      }
      rawPersistWithHistory(currentNodes, updated, onSettled, label);
    },
    [rawPersistWithHistory],
  );

  const guardedPersistCreateWithHistory = useCallback(
    (
      currentNodes: TodoNode[],
      updated: TodoNode[],
      createdId: string,
      onSettled?: PersistSettled,
    ) => {
      if (!loadedRef.current) {
        onSettled?.(false);
        return;
      }
      rawPersistCreateWithHistory(currentNodes, updated, createdId, onSettled);
    },
    [rawPersistCreateWithHistory],
  );

  const guardedPersistSilent = useCallback(
    (updated: TodoNode[], onSettled?: PersistSettled) => {
      if (!loadedRef.current) {
        onSettled?.(false);
        return;
      }
      rawPersistSilent(updated, onSettled);
    },
    [rawPersistSilent],
  );

  const activeNodes = useMemo(() => nodes.filter((n) => !n.isDeleted), [nodes]);
  const deletedNodes = useMemo(() => nodes.filter((n) => n.isDeleted), [nodes]);
  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  // childrenByParent is built once per activeNodes change (O(n) group +
  // sort) so getChildren is an O(1) Map lookup instead of an O(n) filter+
  // sort per call. TodoTreeView's flatten calls getChildren twice per node
  // (children + hasChildren probe) -> O(n^2); the Map collapses that to O(n).
  // life-tags S3: folders were retired, so siblings sort by `order` alone.
  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, TodoNode[]>();
    for (const n of activeNodes) {
      const list = map.get(n.parentId);
      if (list) list.push(n);
      else map.set(n.parentId, [n]);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.order - b.order);
    }
    return map;
  }, [activeNodes]);

  const getChildren = useCallback(
    (parentId: string | null): TodoNode[] => {
      return childrenByParent.get(parentId) ?? [];
    },
    [childrenByParent],
  );

  const {
    addNode,
    updateNode,
    toggleExpanded,
    toggleTodoStatus,
    setTodoStatus,
  } = useTodoTreeCRUD(
    nodes,
    guardedPersistWithHistory,
    guardedPersistSilent,
    generateTodoId,
    guardedPersistCreateWithHistory,
  );
  const {
    softDelete: rawSoftDelete,
    restoreNode,
    permanentDelete: rawPermanentDelete,
  } = useTodoTreeDeletion(
    nodes,
    guardedPersistWithHistory,
    guardedPersistSilent,
    clearHistory,
  );

  // Clear the selection when the deleted subtree contains the selected id
  // (matches Notes' softDeleteNote, which nulls selectedNoteId for the
  // whole removed subtree). Deletion cascades to descendants, so we test
  // membership against the full subtree, not just the target id.
  const softDelete = useCallback(
    (id: string, options?: { skipUndo?: boolean }) => {
      const subtree = collectDescendantIds(id, nodes);
      const current = selectedTodoIdRef.current;
      if (current !== null && subtree.has(current)) {
        setSelectedTodoIdState(null);
        if (persistSelection) clearTodoSelection(); // #282: don't restore a soft-deleted todo
      }
      rawSoftDelete(id, options);
    },
    [nodes, rawSoftDelete, persistSelection],
  );

  const permanentDelete = useCallback(
    (id: string) => {
      const subtree = collectDescendantIds(id, nodes);
      const current = selectedTodoIdRef.current;
      if (current !== null && subtree.has(current)) {
        setSelectedTodoIdState(null);
        if (persistSelection) clearTodoSelection(); // #282: don't restore a permanently-deleted todo
      }
      rawPermanentDelete(id);
    },
    [nodes, rawPermanentDelete, persistSelection],
  );
  // Resolve the selected node from the live map (null when nothing is
  // selected or the id no longer exists). Mirrors Notes' `selectedNote`.
  const selectedTodo = useMemo(
    () => (selectedTodoId ? (nodeMap.get(selectedTodoId) ?? null) : null),
    [nodeMap, selectedTodoId],
  );

  return useMemo(
    () => ({
      nodes: activeNodes,
      nodeMap,
      deletedNodes,
      getChildren,
      isLoading,
      error,
      persistError,
      selectedTodoId,
      setSelectedTodoId,
      selectedTodo,
      refetch,
      undo,
      redo,
      canUndo,
      canRedo,
      addNode,
      updateNode,
      toggleExpanded,
      toggleTodoStatus,
      setTodoStatus,
      softDelete,
      restoreNode,
      permanentDelete,
    }),
    [
      activeNodes,
      nodeMap,
      deletedNodes,
      getChildren,
      isLoading,
      error,
      persistError,
      selectedTodoId,
      setSelectedTodoId,
      selectedTodo,
      refetch,
      undo,
      redo,
      canUndo,
      canRedo,
      addNode,
      updateNode,
      toggleExpanded,
      toggleTodoStatus,
      setTodoStatus,
      softDelete,
      restoreNode,
      permanentDelete,
    ],
  );
}
