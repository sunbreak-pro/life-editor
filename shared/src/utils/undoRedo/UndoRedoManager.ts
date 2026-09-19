/*
 * UndoRedoManager (Issue #304) — the app-wide undo/redo history.
 *
 * A SINGLE GLOBAL stack (not per-domain, unlike the retired Tauri version):
 * every data mutation pushes one command onto one shared stack, so Undo always
 * reverses the most recent operation regardless of which section produced it.
 * Commands are opaque `{ label, undo, redo }` closures — the manager never
 * inspects app state, it only runs the closures a caller supplied.
 *
 * Pure logic: no React, no DataService, no i18n. The React binding lives in
 * UndoRedoContext; the manager is a plain class so it can be unit-tested and
 * held in a ref (one instance per provider).
 */

/** A single reversible operation. `undo`/`redo` may be async. */
export interface UndoCommand {
  /** Stable label describing the operation (used for the undo/redo toast). */
  label: string;
  undo: () => void | Promise<void>;
  redo: () => void | Promise<void>;
}

/** What running one undo/redo did. `error` is set only when `ok` is false. */
export type UndoOutcome =
  | { command: UndoCommand; ok: true }
  | { command: UndoCommand; ok: false; error: unknown };

/** Cap on retained history (oldest commands drop past this). */
export const MAX_HISTORY_SIZE = 50;

export class UndoRedoManager {
  private undoStack: UndoCommand[] = [];
  private redoStack: UndoCommand[] = [];
  private listener: (() => void) | null = null;

  /** Register the single change listener (the provider bumps a version). */
  setListener(fn: (() => void) | null): void {
    this.listener = fn;
  }

  private notify(): void {
    this.listener?.();
  }

  /**
   * Record a new command as the latest undoable operation. Clears the redo
   * stack (a fresh action invalidates any redo branch) and drops the oldest
   * command once the cap is exceeded.
   */
  push(command: UndoCommand): void {
    if (this.undoStack.length >= MAX_HISTORY_SIZE) {
      this.undoStack.shift();
    }
    this.undoStack.push(command);
    this.redoStack = [];
    this.notify();
  }

  /**
   * Reverse the most recent command and move it to the redo stack. Resolves to
   * the outcome (so the caller can toast its label), or null if empty.
   *
   * A throwing undo does NOT move to redo (#1668): the write it stood for did
   * not happen, so offering "redo" would re-apply something that was never
   * reversed. The command goes back on top of the undo stack instead (the user
   * can retry) and the error rides out on the outcome for the caller to show.
   */
  async undo(): Promise<UndoOutcome | null> {
    return this.apply(this.undoStack, this.redoStack, "undo");
  }

  /** Re-apply the most recently undone command. Mirror of {@link undo}. */
  async redo(): Promise<UndoOutcome | null> {
    return this.apply(this.redoStack, this.undoStack, "redo");
  }

  private async apply(
    from: UndoCommand[],
    to: UndoCommand[],
    direction: "undo" | "redo",
  ): Promise<UndoOutcome | null> {
    const command = from.pop();
    if (!command) return null;
    try {
      await command[direction]();
    } catch (error) {
      console.error(`[UndoRedo] ${direction} failed`, error);
      from.push(command);
      this.notify();
      return { command, ok: false, error };
    }
    to.push(command);
    this.notify();
    return { command, ok: true };
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Drop all history (both directions). */
  clear(): void {
    if (this.undoStack.length === 0 && this.redoStack.length === 0) return;
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }
}
