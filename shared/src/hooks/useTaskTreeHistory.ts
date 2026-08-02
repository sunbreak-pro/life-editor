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

/**
 * Reports whether a persist actually landed in the DB. Callers that must write
 * something whose FK points at the rows being persisted (an item link — #376)
 * cannot fire before this says `true`.
 */
export type PersistSettled = (ok: boolean) => void;

/**
 * Every label a tree write may put on its undo command.
 *
 * A label is a KEY, resolved by the host against `undoRedo.labels.*`
 * (web/src/UndoRedoHost.tsx) — an unmapped one falls back to the raw string, so
 * the toast would read "Undid: taskChipMove". That toast is the only thing
 * telling the user WHAT Ctrl+Z just reversed, and nothing about a missing
 * catalog entry is loud, so the set is closed (the derived union catches typos
 * at the call site) AND kept as a runtime ARRAY: the other half of each label
 * lives in two i18n catalogs, and a list a test can walk is what makes the pair
 * checkable (shared/tests/taskChipScheduleUndo.test.tsx).
 *
 * "taskTreeChange" is the catch-all every pre-#569 path already used (add /
 * status / move / delete — one generic word for the whole tree). The
 * `taskChip*` / `taskAddToToday` entries are the Schedule-originated writes
 * #569 made undoable, where "task change" would be true but useless: on a
 * calendar the user has just done something with a POSITION, and the word has
 * to name that.
 */
export const TASK_HISTORY_LABELS = [
  "taskTreeChange",
  "taskChipPlace",
  "taskChipMove",
  "taskChipResize",
  "taskChipAllDay",
  "taskAddToToday",
] as const;

export type TaskHistoryLabel = (typeof TASK_HISTORY_LABELS)[number];

export function useTaskTreeHistory(
  setNodes: Dispatch<SetStateAction<TaskNode[]>>,
  syncToDb: (nodes: TaskNode[], onSettled?: PersistSettled) => void,
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
    (
      currentNodes: TaskNode[],
      updated: TaskNode[],
      onSettled?: PersistSettled,
      label: TaskHistoryLabel = "taskTreeChange",
    ) => {
      const before = currentNodes;
      const after = updated;
      // Deliberately NOT forwarding onSettled into undo/redo: it belongs to
      // this one write. A redo re-runs the sync, and re-firing a follow-up
      // (e.g. attaching a note) would duplicate it.
      push("taskTree", {
        label,
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
      syncToDb(updated, onSettled);
    },
    [setNodes, syncToDb, push],
  );

  const persistSilent = useCallback(
    (updated: TaskNode[], onSettled?: PersistSettled) => {
      setNodes(updated);
      syncToDb(updated, onSettled);
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
