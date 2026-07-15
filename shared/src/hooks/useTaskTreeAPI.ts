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
}

export function useTaskTreeAPI(options: UseTaskTreeAPIOptions) {
  const { dataService: ds } = options;
  const undoRedo = options.undoRedo ?? createNoopUndoRedo();

  const [nodes, setNodes] = useState<TaskNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [persistError, setPersistError] = useState<string | null>(null);
  // Pure selection state (W7). DataService-independent — mirrors Notes'
  // `selectedNoteId` (useNotesUnifiedAPI). Drives the Tasks MasterDetail
  // detail pane; the ref lets the delete wrappers below clear a selection
  // that falls inside a deleted subtree without re-subscribing.
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const selectedTaskIdRef = useRef(selectedTaskId);
  useEffect(() => {
    selectedTaskIdRef.current = selectedTaskId;
  }, [selectedTaskId]);
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
      if (current !== null && subtree.has(current)) setSelectedTaskId(null);
      rawSoftDelete(id, options);
    },
    [nodes, rawSoftDelete],
  );

  const permanentDelete = useCallback(
    (id: string) => {
      const subtree = collectDescendantIds(id, nodes);
      const current = selectedTaskIdRef.current;
      if (current !== null && subtree.has(current)) setSelectedTaskId(null);
      rawPermanentDelete(id);
    },
    [nodes, rawPermanentDelete],
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
