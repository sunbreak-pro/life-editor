import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import type { TaskNode, NodeType } from "../types/taskTree";
import type { DataService } from "../services/DataService";
import { useTaskTreeCRUD, type TaskTreeCRUDConfig } from "./useTaskTreeCRUD";
import { useTaskTreeDeletion } from "./useTaskTreeDeletion";
import { useTaskTreeMovement } from "./useTaskTreeMovement";
import {
  useTaskTreeHistory,
  createNoopUndoRedo,
  type UndoRedoLike,
} from "./useTaskTreeHistory";
import { logServiceError } from "../utils/logError";
import { getFolderTag } from "../utils/folderTag";
import { useSyncContext } from "./useSyncContext";

let idCounter = Date.now();
function generateId(type: NodeType): string {
  return `${type}-${++idCounter}`;
}

/**
 * Options the host injects. The Tauri version reached into a module
 * singleton (`getDataService()`), a host UndoRedo Context, and
 * `localStorage`; the shared hook takes all three by injection so it is
 * host-agnostic (CLAUDE.md §6.4). `undoRedo` defaults to a no-op (web S1
 * — real UndoRedo lands in S6); `config` carries the localStorage-derived
 * behaviour flags.
 */
export interface UseTaskTreeAPIOptions {
  dataService: DataService;
  undoRedo?: UndoRedoLike;
  config?: TaskTreeCRUDConfig;
}

export function useTaskTreeAPI(options: UseTaskTreeAPIOptions) {
  const { dataService: ds, config } = options;
  const undoRedo = options.undoRedo ?? createNoopUndoRedo();

  const [nodes, setNodes] = useState<TaskNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [persistError, setPersistError] = useState<string | null>(null);
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

  const getChildren = useCallback(
    (parentId: string | null) => {
      return activeNodes
        .filter((n) => n.parentId === parentId)
        .sort((a, b) => {
          if (a.type === "folder" && b.type !== "folder") return -1;
          if (a.type !== "folder" && b.type === "folder") return 1;
          return a.order - b.order;
        });
    },
    [activeNodes],
  );

  const {
    addNode,
    updateNode,
    toggleExpanded,
    toggleTaskStatus,
    setTaskStatus,
    completeFolderWithChildren,
    uncompleteFolder,
  } = useTaskTreeCRUD(
    nodes,
    guardedPersistWithHistory,
    guardedPersistSilent,
    generateId,
    config,
  );
  const { softDelete, restoreNode, permanentDelete } = useTaskTreeDeletion(
    nodes,
    guardedPersistWithHistory,
    guardedPersistSilent,
    clearHistory,
  );
  const { moveNode, moveNodeInto, moveToRoot } = useTaskTreeMovement(
    nodes,
    guardedPersistWithHistory,
  );

  const getFolderTagForTask = useCallback(
    (taskId: string) => getFolderTag(taskId, nodeMap),
    [nodeMap],
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
      getFolderTagForTask,
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
      completeFolderWithChildren,
      uncompleteFolder,
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
      getFolderTagForTask,
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
      completeFolderWithChildren,
      uncompleteFolder,
      softDelete,
      restoreNode,
      permanentDelete,
      moveNode,
      moveNodeInto,
      moveToRoot,
    ],
  );
}
