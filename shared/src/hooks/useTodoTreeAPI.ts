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

  // Load from DataService on mount and on every todos bump (including
  // soft-deleted todos), through the shared load effect (#672 / #891). Same
  // three states as the hand-written version it replaces, plus #296's error
  // un-latch, which this hook was missing: one transient failure used to
  // leave the error card up for the rest of the session.
  const { isLoading, error } = useDomainLoad({
    domain: "TodoTree",
    snapshotKey: "todoTree",
    dataService: ds,
    version: syncVersion,
    load: (service) =>
      Promise.all([service.fetchTodoTree(), service.fetchDeletedTodos()]),
    apply: ([active, deleted]) => {
      const all = [...active, ...deleted];
      setNodes(all);
      loadedRef.current = true;
      restoreSelection(all);
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
      const [active, deleted] = await Promise.all([
        ds.fetchTodoTree(),
        ds.fetchDeletedTodos(),
      ]);
      setNodes([...active, ...deleted]);
    } catch (e) {
      logServiceError("TodoTree", "refetch", e);
    }
  }, [ds]);

  const syncToDb = useCallback(
    (updated: TodoNode[], onSettled?: PersistSettled) => {
      setPersistError(null);
      ds.syncTodoTree(updated)
        .then(() => onSettled?.(true))
        .catch((e) => {
          logServiceError("TodoTree", "sync", e);
          setPersistError(
            e instanceof Error ? e.message : "Failed to save todos",
          );
          onSettled?.(false);
        });
    },
    [ds],
  );

  const {
    persistWithHistory: rawPersistWithHistory,
    persistSilent: rawPersistSilent,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
  } = useTodoTreeHistory(setNodes, syncToDb, undoRedo);

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
