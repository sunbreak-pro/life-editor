import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { TaskNode } from "../types/taskTree";
import { useUndoRedo } from "../components/shared/UndoRedo";

export function useTaskTreeHistory(
  setNodes: Dispatch<SetStateAction<TaskNode[]>>,
  syncToDb: (nodes: TaskNode[]) => void,
) {
  const {
    push,
    undo: undoCtx,
    redo: redoCtx,
    canUndo: canUndoCtx,
    canRedo: canRedoCtx,
    clear: clearCtx,
  } = useUndoRedo();

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
