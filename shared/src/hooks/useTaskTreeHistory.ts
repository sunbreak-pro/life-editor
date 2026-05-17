import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { TaskNode } from "../types/taskTree";

/**
 * The slice of the UndoRedo manager this hook needs. The Tauri build
 * supplies a full UndoRedo Context implementation; the web build (S1)
 * passes a no-op (`createNoopUndoRedo()`) until the real UndoRedo
 * subsystem is ported in S6. Injecting it keeps the heavy UndoRedo
 * chain out of S1 (CLAUDE.md §6.4 — shared hooks take dependencies by
 * injection rather than importing a host Context directly).
 */
export interface UndoRedoLike {
  push: (
    domain: string,
    command: { label: string; undo: () => void; redo: () => void },
  ) => void;
  undo: (domain: string) => void;
  redo: (domain: string) => void;
  canUndo: (domain: string) => boolean;
  canRedo: (domain: string) => boolean;
  clear: (domain: string) => void;
}

/** A no-op UndoRedo implementation (web S1 — history is a no-op until S6). */
export function createNoopUndoRedo(): UndoRedoLike {
  return {
    push: () => {},
    undo: () => {},
    redo: () => {},
    canUndo: () => false,
    canRedo: () => false,
    clear: () => {},
  };
}

export function useTaskTreeHistory(
  setNodes: Dispatch<SetStateAction<TaskNode[]>>,
  syncToDb: (nodes: TaskNode[]) => void,
  undoRedo: UndoRedoLike,
) {
  const {
    push,
    undo: undoCtx,
    redo: redoCtx,
    canUndo: canUndoCtx,
    canRedo: canRedoCtx,
    clear: clearCtx,
  } = undoRedo;

  const persistWithHistory = useCallback(
    (currentNodes: TaskNode[], updated: TaskNode[]) => {
      const before = currentNodes;
      const after = updated;
      push("taskTree", {
        label: "taskTreeChange",
        undo: () => {
          setNodes(before);
          syncToDb(before);
        },
        redo: () => {
          setNodes(after);
          syncToDb(after);
        },
      });
      setNodes(updated);
      syncToDb(updated);
    },
    [setNodes, syncToDb, push],
  );

  const persistSilent = useCallback(
    (updated: TaskNode[]) => {
      setNodes(updated);
      syncToDb(updated);
    },
    [setNodes, syncToDb],
  );

  const undo = useCallback(() => {
    undoCtx("taskTree");
  }, [undoCtx]);

  const redo = useCallback(() => {
    redoCtx("taskTree");
  }, [redoCtx]);

  const canUndo = canUndoCtx("taskTree");
  const canRedo = canRedoCtx("taskTree");

  const clearHistory = useCallback(() => {
    clearCtx("taskTree");
  }, [clearCtx]);

  return {
    persistWithHistory,
    persistSilent,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
  };
}
