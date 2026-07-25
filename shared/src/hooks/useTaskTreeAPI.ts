import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import type { TaskNode, NodeType } from "../types/taskTree";
import type { DataService } from "../services/DataService";
import { useTaskTreeCRUD } from "./useTaskTreeCRUD";
import { useTaskTreeDeletion } from "./useTaskTreeDeletion";
import { useTaskTreeMovement } from "./useTaskTreeMovement";
import {
  useTaskTreeHistory,
  createNoopUndoRedo,
  type UndoRedoLike,
} from "./useTaskTreeHistory";
import { logServiceError } from "../utils/logError";
import { collectDescendantIds } from "../utils/getDescendantTasks";
import { useSyncContext } from "./useSyncContext";
import {
  getTaskSelection,
  setTaskSelection,
  clearTaskSelection,
} from "../state/materialsSelectionStore";

let idCounter = Date.now();
function generateId(type: NodeType): string {
  return `${type}-${++idCounter}`;
}

/**
 * Options the host injects. The Tauri version reached into a module
 * singleton (`getDataService()`) and a host UndoRedo Context; the shared hook
 * takes both by injection so it is host-agnostic (CLAUDE.md §6.4). `undoRedo`
 * defaults to a no-op (web S1 — real UndoRedo lands in S6).
 */
export interface UseTaskTreeAPIOptions {
  dataService: DataService;
  undoRedo?: UndoRedoLike;
  /**
   * #282: opt-in cross-remount selection persistence via the module-level
   * materialsSelectionStore. Only the Materials Tasks mount passes true —
   * the Schedule section mounts this hook too (MainScreen) and must neither
   * restore nor overwrite the Materials selection.
   */
  persistSelection?: boolean;
}

export function useTaskTreeAPI(options: UseTaskTreeAPIOptions) {
  const { dataService: ds } = options;
  const undoRedo = options.undoRedo ?? createNoopUndoRedo();
  const persistSelection = options.persistSelection ?? false;

  const [nodes, setNodes] = useState<TaskNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [persistError, setPersistError] = useState<string | null>(null);
  // Pure selection state (W7). DataService-independent — mirrors Notes'
  // `selectedNoteId` (useNotesUnifiedAPI). Drives the Tasks MasterDetail
  // detail pane; the ref lets the delete wrappers below clear a selection
  // that falls inside a deleted subtree without re-subscribing.
  const [selectedTaskId, setSelectedTaskIdState] = useState<string | null>(
    null,
  );
  const selectedTaskIdRef = useRef(selectedTaskId);
  useEffect(() => {
    selectedTaskIdRef.current = selectedTaskId;
  }, [selectedTaskId]);
  // #282: write-through wrapper for the PUBLIC setter so a Materials tab/
  // section switch can restore the selection after this provider remounts.
  // null clears the store entry. Task ids need existence validation on
  // restore (see the restore effect), unlike Daily's always-valid date key,
  // so we do NOT seed the initial state from the store here.
  const setSelectedTaskId = useCallback(
    (id: string | null): void => {
      setSelectedTaskIdState(id);
      if (!persistSelection) return;
      if (id === null) clearTaskSelection();
      else setTaskSelection(id);
    },
    [persistSelection],
  );
  const loadedRef = useRef(false);
  const { syncVersion } = useSyncContext();

  // Load from DataService on mount (including soft-deleted tasks)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [active, deleted] = await Promise.all([
          ds.fetchTaskTree(),
          ds.fetchDeletedTasks(),
        ]);
        if (!cancelled) {
          setNodes([...active, ...deleted]);
          loadedRef.current = true;
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load tasks");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ds, syncVersion]);

  // One-shot RESTORE (#282): re-select the task the user had open before the
  // provider unmounted (Materials tab/section switch). The id lives in the
  // module-level materialsSelectionStore, which outlives this React tree. Runs
  // at most once per mount (restoredRef) and never fights a user action already
  // made (bail if something is already selected). A stored id that is missing
  // or soft-deleted in the loaded set clears the store entry.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (!persistSelection) return; // non-Materials mount (Schedule) — no restore
    if (restoredRef.current) return;
    if (isLoading) return; // wait until nodes have loaded
    // A failed fetch must NOT consume the one-shot nor clear the store — a
    // transient error would otherwise permanently erase the remembered
    // selection. `nodes` in the deps retries after a successful reload.
    if (!loadedRef.current) return;
    restoredRef.current = true;
    const storedId = getTaskSelection();
    if (storedId === null) return;
    if (selectedTaskIdRef.current !== null) return; // user already selected
    const node = nodes.find((n) => n.id === storedId);
    if (!node || node.isDeleted) {
      clearTaskSelection(); // stale/soft-deleted id — drop it
      return;
    }
    setSelectedTaskIdState(storedId); // store already holds it, no write-through
  }, [persistSelection, isLoading, nodes]);

  const refetch = useCallback(async () => {
    try {
      const [active, deleted] = await Promise.all([
        ds.fetchTaskTree(),
        ds.fetchDeletedTasks(),
      ]);
      setNodes([...active, ...deleted]);
    } catch (e) {
      logServiceError("TaskTree", "refetch", e);
    }
  }, [ds]);

  const syncToDb = useCallback(
    (updated: TaskNode[]) => {
      setPersistError(null);
      ds.syncTaskTree(updated).catch((e) => {
        logServiceError("TaskTree", "sync", e);
        setPersistError(
          e instanceof Error ? e.message : "Failed to save tasks",
        );
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
  } = useTaskTreeHistory(setNodes, syncToDb, undoRedo);

  const guardedPersistWithHistory = useCallback(
    (currentNodes: TaskNode[], updated: TaskNode[]) => {
      if (!loadedRef.current) return;
      rawPersistWithHistory(currentNodes, updated);
    },
    [rawPersistWithHistory],
  );

  const guardedPersistSilent = useCallback(
    (updated: TaskNode[]) => {
      if (!loadedRef.current) return;
      rawPersistSilent(updated);
    },
    [rawPersistSilent],
  );

  const activeNodes = useMemo(() => nodes.filter((n) => !n.isDeleted), [nodes]);
  const deletedNodes = useMemo(() => nodes.filter((n) => n.isDeleted), [nodes]);
  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  // childrenByParent is built once per activeNodes change (O(n) group +
  // sort) so getChildren is an O(1) Map lookup instead of an O(n) filter+
  // sort per call. TaskTreeView's flatten calls getChildren twice per node
  // (children + hasChildren probe) -> O(n^2); the Map collapses that to O(n).
  // life-tags S3: folders were retired, so siblings sort by `order` alone.
  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, TaskNode[]>();
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
    (parentId: string | null): TaskNode[] => {
      return childrenByParent.get(parentId) ?? [];
    },
    [childrenByParent],
  );

  const {
    addNode,
    updateNode,
    toggleExpanded,
    toggleTaskStatus,
    setTaskStatus,
  } = useTaskTreeCRUD(
    nodes,
    guardedPersistWithHistory,
    guardedPersistSilent,
    generateId,
  );
  const {
    softDelete: rawSoftDelete,
    restoreNode,
    permanentDelete: rawPermanentDelete,
  } = useTaskTreeDeletion(
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
      const current = selectedTaskIdRef.current;
      if (current !== null && subtree.has(current)) {
        setSelectedTaskIdState(null);
        if (persistSelection) clearTaskSelection(); // #282: don't restore a soft-deleted task
      }
      rawSoftDelete(id, options);
    },
    [nodes, rawSoftDelete, persistSelection],
  );

  const permanentDelete = useCallback(
    (id: string) => {
      const subtree = collectDescendantIds(id, nodes);
      const current = selectedTaskIdRef.current;
      if (current !== null && subtree.has(current)) {
        setSelectedTaskIdState(null);
        if (persistSelection) clearTaskSelection(); // #282: don't restore a permanently-deleted task
      }
      rawPermanentDelete(id);
    },
    [nodes, rawPermanentDelete, persistSelection],
  );
  const { moveNode, moveNodeInto, moveToRoot } = useTaskTreeMovement(
    nodes,
    guardedPersistWithHistory,
  );

  // Resolve the selected node from the live map (null when nothing is
  // selected or the id no longer exists). Mirrors Notes' `selectedNote`.
  const selectedTask = useMemo(
    () => (selectedTaskId ? (nodeMap.get(selectedTaskId) ?? null) : null),
    [nodeMap, selectedTaskId],
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
      selectedTaskId,
      setSelectedTaskId,
      selectedTask,
      refetch,
      undo,
      redo,
      canUndo,
      canRedo,
      addNode,
      updateNode,
      toggleExpanded,
      toggleTaskStatus,
      setTaskStatus,
      softDelete,
      restoreNode,
      permanentDelete,
      moveNode,
      moveNodeInto,
      moveToRoot,
    }),
    [
      activeNodes,
      nodeMap,
      deletedNodes,
      getChildren,
      isLoading,
      error,
      persistError,
      selectedTaskId,
      setSelectedTaskId,
      selectedTask,
      refetch,
      undo,
      redo,
      canUndo,
      canRedo,
      addNode,
      updateNode,
      toggleExpanded,
      toggleTaskStatus,
      setTaskStatus,
      softDelete,
      restoreNode,
      permanentDelete,
      moveNode,
      moveNodeInto,
      moveToRoot,
    ],
  );
}
