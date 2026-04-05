import type { UndoDomain, UndoCommand } from "./types";
import { MAX_HISTORY_SIZE } from "./types";

interface DomainStack {
  undoStack: UndoCommand[];
  redoStack: UndoCommand[];
}

export class UndoRedoManager {
  private stacks = new Map<UndoDomain, DomainStack>();
  private listener: (() => void) | null = null;
  private seq = 0;

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
    command._seq = ++this.seq;
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

  /** Undo the most recently pushed command across multiple domains. */
  async undoLatest(domains: UndoDomain[]): Promise<void> {
    let best: { domain: UndoDomain; seq: number } | null = null;
    for (const d of domains) {
      const stack = this.stacks.get(d);
      if (!stack || stack.undoStack.length === 0) continue;
      const top = stack.undoStack[stack.undoStack.length - 1];
      const s = top._seq ?? 0;
      if (!best || s > best.seq) {
        best = { domain: d, seq: s };
      }
    }
    if (best) {
      await this.undo(best.domain);
    }
  }

  /** Redo the most recently undone command across multiple domains. */
  async redoLatest(domains: UndoDomain[]): Promise<void> {
    let best: { domain: UndoDomain; seq: number } | null = null;
    for (const d of domains) {
      const stack = this.stacks.get(d);
      if (!stack || stack.redoStack.length === 0) continue;
      const top = stack.redoStack[stack.redoStack.length - 1];
      const s = top._seq ?? 0;
      if (!best || s > best.seq) {
        best = { domain: d, seq: s };
      }
    }
    if (best) {
      await this.redo(best.domain);
    }
  }

  canUndo(domain: UndoDomain): boolean {
    return (this.stacks.get(domain)?.undoStack.length ?? 0) > 0;
  }

  canRedo(domain: UndoDomain): boolean {
    return (this.stacks.get(domain)?.redoStack.length ?? 0) > 0;
  }

  canUndoAny(domains: UndoDomain[]): boolean {
    return domains.some((d) => this.canUndo(d));
  }

  canRedoAny(domains: UndoDomain[]): boolean {
    return domains.some((d) => this.canRedo(d));
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
