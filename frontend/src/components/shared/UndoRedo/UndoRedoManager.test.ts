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

  describe("multi-domain", () => {
    it("undoLatest picks the most recently pushed across domains", async () => {
      const mgr = new UndoRedoManager();
      const undoA = vi.fn();
      const undoB = vi.fn();

      mgr.push("taskTree", { label: "a", undo: undoA, redo: vi.fn() });
      mgr.push("scheduleItem", { label: "b", undo: undoB, redo: vi.fn() });

      await mgr.undoLatest(["taskTree", "scheduleItem"]);

      expect(undoB).toHaveBeenCalledOnce();
      expect(undoA).not.toHaveBeenCalled();
    });

    it("redoLatest picks the most recently undone across domains", async () => {
      const mgr = new UndoRedoManager();
      const redoA = vi.fn();
      const redoB = vi.fn();

      mgr.push("taskTree", { label: "a", undo: vi.fn(), redo: redoA });
      mgr.push("scheduleItem", { label: "b", undo: vi.fn(), redo: redoB });

      // Undo both
      await mgr.undo("scheduleItem");
      await mgr.undo("taskTree");

      // Redo latest should pick scheduleItem (higher seq)
      await mgr.redoLatest(["taskTree", "scheduleItem"]);

      expect(redoB).toHaveBeenCalledOnce();
      expect(redoA).not.toHaveBeenCalled();
    });

    it("undoLatest handles empty domains gracefully", async () => {
      const mgr = new UndoRedoManager();
      await mgr.undoLatest(["taskTree", "memo"]);
      // No error
    });

    it("canUndoAny returns true if any domain has entries", () => {
      const mgr = new UndoRedoManager();
      mgr.push("memo", { label: "a", undo: vi.fn(), redo: vi.fn() });

      expect(mgr.canUndoAny(["taskTree", "memo"])).toBe(true);
      expect(mgr.canUndoAny(["taskTree", "note"])).toBe(false);
    });

    it("canRedoAny returns true if any domain has redo entries", async () => {
      const mgr = new UndoRedoManager();
      mgr.push("memo", { label: "a", undo: vi.fn(), redo: vi.fn() });
      await mgr.undo("memo");

      expect(mgr.canRedoAny(["taskTree", "memo"])).toBe(true);
      expect(mgr.canRedoAny(["taskTree", "note"])).toBe(false);
    });

    it("seq ordering is correct across interleaved pushes", async () => {
      const mgr = new UndoRedoManager();
      const calls: string[] = [];

      mgr.push("taskTree", {
        label: "t1",
        undo: () => {
          calls.push("undo-t1");
        },
        redo: vi.fn(),
      });
      mgr.push("memo", {
        label: "m1",
        undo: () => {
          calls.push("undo-m1");
        },
        redo: vi.fn(),
      });
      mgr.push("taskTree", {
        label: "t2",
        undo: () => {
          calls.push("undo-t2");
        },
        redo: vi.fn(),
      });

      const domains: ("taskTree" | "memo")[] = ["taskTree", "memo"];

      await mgr.undoLatest(domains); // should undo t2
      await mgr.undoLatest(domains); // should undo m1
      await mgr.undoLatest(domains); // should undo t1

      expect(calls).toEqual(["undo-t2", "undo-m1", "undo-t1"]);
    });
  });
});
