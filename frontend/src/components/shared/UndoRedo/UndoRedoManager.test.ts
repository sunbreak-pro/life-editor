import { describe, it, expect, vi } from "vitest";
import { UndoRedoManager } from "./UndoRedoManager";

describe("UndoRedoManager", () => {
  it("pushes and undoes a command", async () => {
    const mgr = new UndoRedoManager();
    const undoFn = vi.fn();
    const redoFn = vi.fn();

    mgr.push("taskTree", { label: "test", undo: undoFn, redo: redoFn });

    expect(mgr.canUndo("taskTree")).toBe(true);
    expect(mgr.canRedo("taskTree")).toBe(false);

    await mgr.undo("taskTree");

    expect(undoFn).toHaveBeenCalledOnce();
    expect(mgr.canUndo("taskTree")).toBe(false);
    expect(mgr.canRedo("taskTree")).toBe(true);
  });

  it("redoes after undo", async () => {
    const mgr = new UndoRedoManager();
    const undoFn = vi.fn();
    const redoFn = vi.fn();

    mgr.push("memo", { label: "test", undo: undoFn, redo: redoFn });
    await mgr.undo("memo");
    await mgr.redo("memo");

    expect(redoFn).toHaveBeenCalledOnce();
    expect(mgr.canUndo("memo")).toBe(true);
    expect(mgr.canRedo("memo")).toBe(false);
  });

  it("clears redo stack on new push", async () => {
    const mgr = new UndoRedoManager();

    mgr.push("note", { label: "a", undo: vi.fn(), redo: vi.fn() });
    await mgr.undo("note");
    expect(mgr.canRedo("note")).toBe(true);

    mgr.push("note", { label: "b", undo: vi.fn(), redo: vi.fn() });
    expect(mgr.canRedo("note")).toBe(false);
  });

  it("domains are independent", () => {
    const mgr = new UndoRedoManager();

    mgr.push("taskTree", { label: "a", undo: vi.fn(), redo: vi.fn() });
    mgr.push("memo", { label: "b", undo: vi.fn(), redo: vi.fn() });

    expect(mgr.canUndo("taskTree")).toBe(true);
    expect(mgr.canUndo("memo")).toBe(true);
    expect(mgr.canUndo("note")).toBe(false);
  });

  it("clear removes all entries for a domain", () => {
    const mgr = new UndoRedoManager();

    mgr.push("taskTree", { label: "a", undo: vi.fn(), redo: vi.fn() });
    mgr.push("taskTree", { label: "b", undo: vi.fn(), redo: vi.fn() });

    mgr.clear("taskTree");

    expect(mgr.canUndo("taskTree")).toBe(false);
    expect(mgr.canRedo("taskTree")).toBe(false);
  });

  it("respects max history size", () => {
    const mgr = new UndoRedoManager();

    for (let i = 0; i < 60; i++) {
      mgr.push("taskTree", {
        label: `cmd-${i}`,
        undo: vi.fn(),
        redo: vi.fn(),
      });
    }

    let count = 0;
    while (mgr.canUndo("taskTree")) {
      mgr.undo("taskTree");
      count++;
    }
    expect(count).toBe(50);
  });

  it("notifies listener on push/undo/redo/clear", async () => {
    const mgr = new UndoRedoManager();
    const listener = vi.fn();
    mgr.setListener(listener);

    mgr.push("taskTree", { label: "a", undo: vi.fn(), redo: vi.fn() });
    expect(listener).toHaveBeenCalledTimes(1);

    await mgr.undo("taskTree");
    expect(listener).toHaveBeenCalledTimes(2);

    await mgr.redo("taskTree");
    expect(listener).toHaveBeenCalledTimes(3);

    mgr.clear("taskTree");
    expect(listener).toHaveBeenCalledTimes(4);
  });

  it("handles undo on empty stack gracefully", async () => {
    const mgr = new UndoRedoManager();
    await mgr.undo("taskTree");
    await mgr.redo("taskTree");
    // No error thrown
  });

  it("handles async undo/redo", async () => {
    const mgr = new UndoRedoManager();
    let value = 0;

    mgr.push("memo", {
      label: "async",
      undo: async () => {
        await new Promise((r) => setTimeout(r, 10));
        value = 0;
      },
      redo: async () => {
        await new Promise((r) => setTimeout(r, 10));
        value = 1;
      },
    });
    value = 1;

    await mgr.undo("memo");
    expect(value).toBe(0);

    await mgr.redo("memo");
    expect(value).toBe(1);
  });
});
