import { useCallback, useEffect, useRef } from "react";
import { useUndoRedoOptional } from "@life-editor/shared";

/*
 * The Goals & Todos tab's undo history (#2880). The tab has no
 * TodoTreeProvider and writes through the service directly, so nothing put
 * its writes on the header's Undo / Redo until this; it pushes its own
 * commands onto the global stack, the way useWikiTagsUnifiedAPI does for one
 * tag assign / unassign.
 *
 * Every step names its rows by id and is never a snapshot, so a command
 * stays true however long it waits: it survives leaving Connect and coming
 * back (#1727), and needs no `expiresWithProvider`.
 *
 * Every step is also safe to run twice (link / unlink / soft delete / restore
 * / setting a field to a value). A command whose undo fails part-way stays on
 * the undo stack (#1668), and running it again then repeats the steps that
 * already went back without harm.
 */

/**
 * The labels this tab puts on its commands. The host shows each through
 * `undoRedo.labels.<label>` and falls back to the raw key, so the list is kept
 * as an array a catalog test can walk. A todo write reuses the todo tree's
 * own labels ("todoTreeChange" also covers adding one), so the same act reads
 * the same in every section.
 */
export const GOALS_UNDO_LABELS = [
  "createGoal",
  "renameGoal",
  "moveGoal",
  "toggleGoalAchieved",
  "deleteGoal",
  "linkGoalTodos",
  "moveGoalTodo",
  "todoTreeChange",
  "deleteTodo",
] as const;

export type GoalsUndoLabel = (typeof GOALS_UNDO_LABELS)[number];

/** One write that landed, with the write that takes it back. */
export interface GoalsUndoStep {
  undo: () => Promise<unknown>;
  redo: () => Promise<unknown>;
}

export interface GoalsUndo {
  /**
   * Put the steps of one operation on the history as ONE command, in the
   * order their writes landed: undo runs them backwards, redo forwards. No
   * steps means nothing changed, and nothing is pushed.
   */
  record: (label: GoalsUndoLabel, steps: readonly GoalsUndoStep[]) => void;
}

/** The domain the commands are pushed under. */
export const GOALS_UNDO_DOMAIN = "goals";

/**
 * @param onSettled Runs after every undo and redo, landed or not, so the tab
 *   re-reads and shows what the service now holds.
 */
export function useGoalsUndo(onSettled: () => void): GoalsUndo {
  const undoRedo = useUndoRedoOptional();
  // The context value changes identity on every stack change; through refs the
  // tab's write callbacks are not rebuilt each time anything is undone.
  const undoRedoRef = useRef(undoRedo);
  const onSettledRef = useRef(onSettled);
  useEffect(() => {
    undoRedoRef.current = undoRedo;
    onSettledRef.current = onSettled;
  });

  const record = useCallback(
    (label: GoalsUndoLabel, steps: readonly GoalsUndoStep[]): void => {
      if (steps.length === 0) return;
      const forward = [...steps];
      const backward = [...steps].reverse();
      // A throw is left to escape: the manager keeps the command where it was
      // and the host says the undo failed (#1668).
      const run = async (
        list: readonly GoalsUndoStep[],
        direction: "undo" | "redo",
      ): Promise<void> => {
        try {
          for (const step of list) await step[direction]();
        } finally {
          onSettledRef.current();
        }
      };
      undoRedoRef.current?.push(GOALS_UNDO_DOMAIN, {
        label,
        undo: () => run(backward, "undo"),
        redo: () => run(forward, "redo"),
      });
    },
    [],
  );

  return { record };
}
