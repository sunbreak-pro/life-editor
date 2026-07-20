import { describe, it, expect, vi } from "vitest";
import {
  UndoRedoManager,
  MAX_HISTORY_SIZE,
  type UndoCommand,
} from "../src/utils/undoRedo/UndoRedoManager";

/*
 * UndoRedoManager (#304) — single global stack. Verifies push/undo/redo
 * ordering across "domains", redo-clear on push, the history cap, canUndo/
 * canRedo, clear, the returned command (for toasts), and listener bumps.
 */

function cmd(log: string[], name: string): UndoCommand {
  return {
    label: name,
    undo: () => log.push(`undo:${name}`),
    redo: () => log.push(`redo:${name}`),
  };
}

describe("UndoRedoManager", () => {
  it("undoes the globally most-recent command regardless of source", async () => {
    const log: string[] = [];
    const m = new UndoRedoManager();
    m.push(cmd(log, "task")); // e.g. from taskTree
    m.push(cmd(log, "event")); // e.g. from schedule
    await m.undo();
    expect(log).toEqual(["undo:event"]);
    await m.undo();
    expect(log).toEqual(["undo:event", "undo:task"]);
  });

  it("redoes in reverse-undo order", async () => {
    const log: string[] = [];
    const m = new UndoRedoManager();
    m.push(cmd(log, "a"));
    m.push(cmd(log, "b"));
    await m.undo(); // undo b
    await m.undo(); // undo a
    await m.redo(); // redo a
    await m.redo(); // redo b
    expect(log).toEqual(["undo:b", "undo:a", "redo:a", "redo:b"]);
  });

  it("clears the redo stack when a new command is pushed", async () => {
    const m = new UndoRedoManager();
    m.push(cmd([], "a"));
    await m.undo();
    expect(m.canRedo()).toBe(true);
    m.push(cmd([], "b"));
    expect(m.canRedo()).toBe(false);
  });

  it("returns the applied command so callers can label a toast", async () => {
    const m = new UndoRedoManager();
    m.push(cmd([], "renamed task"));
    const undone = await m.undo();
    expect(undone?.label).toBe("renamed task");
    const redone = await m.redo();
    expect(redone?.label).toBe("renamed task");
  });

  it("returns null on undo/redo when the stack is empty", async () => {
    const m = new UndoRedoManager();
    expect(await m.undo()).toBeNull();
    expect(await m.redo()).toBeNull();
  });

  it("caps history at MAX_HISTORY_SIZE, dropping the oldest", async () => {
    const log: string[] = [];
    const m = new UndoRedoManager();
    for (let i = 0; i < MAX_HISTORY_SIZE + 5; i++) m.push(cmd(log, `c${i}`));
    // Undo everything retained; the 5 oldest were dropped.
    let count = 0;
    while (m.canUndo()) {
      await m.undo();
      count++;
    }
    expect(count).toBe(MAX_HISTORY_SIZE);
    expect(log[0]).toBe("undo:c54"); // newest first; c0..c4 dropped
    expect(log).not.toContain("undo:c4");
  });

  it("reports canUndo / canRedo", async () => {
    const m = new UndoRedoManager();
    expect(m.canUndo()).toBe(false);
    m.push(cmd([], "a"));
    expect(m.canUndo()).toBe(true);
    expect(m.canRedo()).toBe(false);
    await m.undo();
    expect(m.canUndo()).toBe(false);
    expect(m.canRedo()).toBe(true);
  });

  it("clear() empties both stacks", async () => {
    const m = new UndoRedoManager();
    m.push(cmd([], "a"));
    await m.undo();
    m.clear();
    expect(m.canUndo()).toBe(false);
    expect(m.canRedo()).toBe(false);
  });

  it("notifies the listener on push / undo / redo / clear", async () => {
    const m = new UndoRedoManager();
    const listener = vi.fn();
    m.setListener(listener);
    m.push(cmd([], "a"));
    await m.undo();
    await m.redo();
    m.clear();
    expect(listener).toHaveBeenCalledTimes(4);
  });

  it("still moves a throwing command to the redo stack", async () => {
    const m = new UndoRedoManager();
    m.push({
      label: "boom",
      undo: () => {
        throw new Error("fail");
      },
      redo: () => {},
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await m.undo();
    expect(m.canRedo()).toBe(true);
    spy.mockRestore();
  });
});
