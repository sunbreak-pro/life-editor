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
   * Reverse the most recent command and move it to the redo stack. Returns the
   * command that ran (so the caller can toast its label), or null if empty. A
   * throwing undo still moves the command to redo and is reported via onError.
   */
  async undo(): Promise<UndoCommand | null> {
    const command = this.undoStack.pop();
    if (!command) return null;
    try {
      await command.undo();
    } catch (err) {
      console.error("[UndoRedo] undo failed", err);
    }
    this.redoStack.push(command);
    this.notify();
    return command;
  }

  /** Re-apply the most recently undone command. Mirror of {@link undo}. */
  async redo(): Promise<UndoCommand | null> {
    const command = this.redoStack.pop();
    if (!command) return null;
    try {
      await command.redo();
    } catch (err) {
      console.error("[UndoRedo] redo failed", err);
    }
    this.undoStack.push(command);
    this.notify();
    return command;
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
