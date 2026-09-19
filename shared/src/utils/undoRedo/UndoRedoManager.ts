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

/**
 * What a command says about itself so the host can ASK before running it
 * (#1638). Only a write that landed on a REPEATING item carries one: reversing
 * an edit that was applied to a whole series is not something to do on a
 * keystroke, and the scope it covers is the part the calendar does not show.
 *
 * The manager never reads `scope` — it only knows a command with a `confirm`
 * block has to pass the gate first. The words belong to the host (§6.4).
 */
export interface UndoConfirmSpec {
  kind: "repeat";
  scope: "this" | "future" | "all";
}

/**
 * The host's question (#1638). `false` leaves BOTH stacks exactly as they
 * were — a declined undo must not consume the command, or "cancel" would be a
 * way to quietly drop history.
 */
export type UndoConfirmGate = (request: {
  direction: "undo" | "redo";
  label: string;
  confirm: UndoConfirmSpec;
}) => Promise<boolean>;

/** A single reversible operation. `undo`/`redo` may be async. */
export interface UndoCommand {
  /** Stable label describing the operation (used for the undo/redo toast). */
  label: string;
  undo: () => void | Promise<void>;
  redo: () => void | Promise<void>;
  /** Ask before running this one — see UndoConfirmSpec (#1638). */
  confirm?: UndoConfirmSpec;
  /**
   * This command writes back a SNAPSHOT of a whole collection, so it must not
   * outlive the provider that took the snapshot (#1727).
   *
   * Almost every command names what it touches — one row, by id — and stays
   * true however long it waits: running it later writes that row and nothing
   * else. A snapshot command is the exception. `syncTodoTree(before)` restores
   * every node it was handed, so replaying it after the section was rebuilt
   * would also undo whatever happened to those rows in between.
   *
   * The provider that pushed it calls `expireDomain` on unmount, which is
   * what drops these and leaves the by-id commands standing.
   */
  expiresWithProvider?: boolean;
}

/** What running one undo/redo did. `error` is set only when `ok` is false. */
export type UndoOutcome =
  | { command: UndoCommand; ok: true }
  | { command: UndoCommand; ok: false; error: unknown };

/** Cap on retained history (oldest commands drop past this). */
export const MAX_HISTORY_SIZE = 50;

/** A command plus the domain that pushed it (only `expireDomain` reads it). */
interface HistoryEntry {
  command: UndoCommand;
  domain: string;
}

export class UndoRedoManager {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private listener: (() => void) | null = null;
  private confirmGate: UndoConfirmGate | null = null;

  /** Register the single change listener (the provider bumps a version). */
  setListener(fn: (() => void) | null): void {
    this.listener = fn;
  }

  private notify(): void {
    this.listener?.();
  }

  /**
   * Register the question asked before a command carrying a `confirm` spec
   * runs (#1638). One gate at a time, and null while no host offers a dialog —
   * with no gate those commands run straight through, which is what keeps them
   * reversible from a screen that has nowhere to ask.
   */
  setConfirmGate(gate: UndoConfirmGate | null): void {
    this.confirmGate = gate;
  }

  /**
   * Record a new command as the latest undoable operation. Clears the redo
   * stack (a fresh action invalidates any redo branch) and drops the oldest
   * command once the cap is exceeded.
   */
  push(command: UndoCommand, domain = ""): void {
    if (this.undoStack.length >= MAX_HISTORY_SIZE) {
      this.undoStack.shift();
    }
    this.undoStack.push({ command, domain });
    this.redoStack = [];
    this.notify();
  }

  /**
   * Reverse the most recent command and move it to the redo stack. Resolves to
   * the outcome (so the caller can toast its label), or null if empty — or if
   * the command asked a question and the user declined (#1638), which leaves
   * both stacks untouched.
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
    from: HistoryEntry[],
    to: HistoryEntry[],
    direction: "undo" | "redo",
  ): Promise<UndoOutcome | null> {
    const next = from[from.length - 1];
    if (!next) return null;
    if (next.command.confirm && this.confirmGate) {
      let ok: boolean;
      try {
        ok = await this.confirmGate({
          direction,
          label: next.command.label,
          confirm: next.command.confirm,
        });
      } catch (error) {
        /*
         * A gate that throws never asked anything, so the command stays put —
         * the same place a "no" leaves it. What it must NOT do is escape:
         * this method is awaited by a `void`-ed promise chain, so a rejection
         * here became an unhandled one, which the dev server answers with a
         * full-screen error overlay over a reversal that simply could not be
         * offered (#1681). It rides out as an outcome instead, and the host
         * says "couldn't undo" like it does for any other failure.
         */
        console.error(`[UndoRedo] ${direction} gate failed`, error);
        return { command: next.command, ok: false, error };
      }
      // Nothing moves on a "no", and nothing moves either if the stack changed
      // while the question was open — the answer was about THAT command, and
      // another write can land on top while a dialog waits.
      if (!ok || from[from.length - 1] !== next) return null;
    }
    const entry = from.pop();
    if (!entry) return null;
    const { command } = entry;
    try {
      await command[direction]();
    } catch (error) {
      console.error(`[UndoRedo] ${direction} failed`, error);
      from.push(entry);
      this.notify();
      return { command, ok: false, error };
    }
    to.push(entry);
    this.notify();
    return { command, ok: true };
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Drop the snapshot commands a domain pushed, in both directions (#1727).
   *
   * Called when that domain's provider unmounts — a section switch. Commands
   * that name their rows by id are LEFT ALONE: they write the same row
   * whenever they run, and the provider that comes back reads the result off
   * the server like any other change. Before this, navigation wiped the whole
   * app's history to keep the snapshot commands from replaying.
   */
  expireDomain(domain: string): void {
    const survives = (e: HistoryEntry) =>
      !(e.domain === domain && e.command.expiresWithProvider);
    const undo = this.undoStack.filter(survives);
    const redo = this.redoStack.filter(survives);
    if (
      undo.length === this.undoStack.length &&
      redo.length === this.redoStack.length
    ) {
      return;
    }
    this.undoStack = undo;
    this.redoStack = redo;
    this.notify();
  }

  /** Drop all history (both directions). */
  clear(): void {
    if (this.undoStack.length === 0 && this.redoStack.length === 0) return;
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }
}
