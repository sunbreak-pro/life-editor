import type { UndoDomain, UndoCommand } from "./types";
import { MAX_HISTORY_SIZE } from "./types";

interface DomainStack {
  undoStack: UndoCommand[];
  redoStack: UndoCommand[];
}

export class UndoRedoManager {
  private stacks = new Map<UndoDomain, DomainStack>();
  private listener: (() => void) | null = null;

  private getStack(domain: UndoDomain): DomainStack {
    let stack = this.stacks.get(domain);
    if (!stack) {
      stack = { undoStack: [], redoStack: [] };
      this.stacks.set(domain, stack);
    }
    return stack;
  }

  setListener(fn: () => void): void {
    this.listener = fn;
  }

  private notify(): void {
    this.listener?.();
  }

  push(domain: UndoDomain, command: UndoCommand): void {
    const stack = this.getStack(domain);
    if (stack.undoStack.length >= MAX_HISTORY_SIZE) {
      stack.undoStack.shift();
    }
    stack.undoStack.push(command);
    stack.redoStack = [];
    this.notify();
  }

  async undo(domain: UndoDomain): Promise<void> {
    const stack = this.getStack(domain);
    const command = stack.undoStack.pop();
    if (!command) return;
    await command.undo();
    stack.redoStack.push(command);
    this.notify();
  }

  async redo(domain: UndoDomain): Promise<void> {
    const stack = this.getStack(domain);
    const command = stack.redoStack.pop();
    if (!command) return;
    await command.redo();
    stack.undoStack.push(command);
    this.notify();
  }

  canUndo(domain: UndoDomain): boolean {
    return (this.stacks.get(domain)?.undoStack.length ?? 0) > 0;
  }

  canRedo(domain: UndoDomain): boolean {
    return (this.stacks.get(domain)?.redoStack.length ?? 0) > 0;
  }

  clear(domain: UndoDomain): void {
    const stack = this.stacks.get(domain);
    if (stack) {
      stack.undoStack = [];
      stack.redoStack = [];
      this.notify();
    }
  }
}
