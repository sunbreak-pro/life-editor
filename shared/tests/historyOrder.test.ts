import { describe, it, expect } from "vitest";
import {
  EditorHistoryOrder,
  pickRedoSide,
  pickUndoSide,
} from "../src/utils/undoRedo/historyOrder";
import { UndoRedoManager } from "../src/utils/undoRedo/UndoRedoManager";

/*
 * #2141 — "newer first" between a body editor's history and the app stack
 * (D-20261008-main-3). Both sides stamp their steps from one clock; these pin
 * the clock's bookkeeping on each side and the rule that compares them.
 */

const noop = { label: "x", undo: () => {}, redo: () => {} };

describe("pickUndoSide / pickRedoSide", () => {
  it("undoes the newer stamp and redoes the older one", () => {
    expect(pickUndoSide(5, 3)).toBe("app");
    expect(pickUndoSide(3, 5)).toBe("editor");
    // After undoing 5 then 3, redo tops are 5 (app) and 3 (editor): the one
    // undone last is the older stamp.
    expect(pickRedoSide(5, 3)).toBe("editor");
    expect(pickRedoSide(3, 5)).toBe("app");
  });

  it("falls back to whichever side has a step, or null", () => {
    expect(pickUndoSide(null, 2)).toBe("editor");
    expect(pickUndoSide(2, null)).toBe("app");
    expect(pickUndoSide(null, null)).toBeNull();
    expect(pickRedoSide(null, 2)).toBe("editor");
    expect(pickRedoSide(2, null)).toBe("app");
    expect(pickRedoSide(null, null)).toBeNull();
  });
});

describe("EditorHistoryOrder", () => {
  it("stamps a new step newer than an app command pushed before it", () => {
    const app = new UndoRedoManager();
    app.push(noop);
    const order = new EditorHistoryOrder();
    order.observe(1, 0, "recorded");
    expect(order.undoSeq()!).toBeGreaterThan(app.peekUndoSeq()!);
  });

  it("carries a step's stamp across undo and redo", () => {
    const order = new EditorHistoryOrder();
    order.observe(1, 0, "recorded");
    const stamp = order.undoSeq();

    order.observe(0, 1, "history");
    expect(order.undoSeq()).toBeNull();
    expect(order.redoSeq()).toBe(stamp);

    order.observe(1, 0, "history");
    expect(order.undoSeq()).toBe(stamp);
    expect(order.redoSeq()).toBeNull();
  });

  it("treats typing after an undo as a new step, not a redo", () => {
    const order = new EditorHistoryOrder();
    order.observe(1, 0, "recorded");
    const first = order.undoSeq()!;
    order.observe(0, 1, "history");

    // Same depths a redo would leave, but this is new typing.
    order.observe(1, 0, "recorded");

    expect(order.undoSeq()!).toBeGreaterThan(first);
    expect(order.redoSeq()).toBeNull();
  });

  it("re-stamps the top step when typing is folded into it", () => {
    const app = new UndoRedoManager();
    const order = new EditorHistoryOrder();
    order.observe(1, 0, "recorded");
    app.push(noop);

    // TipTap grouped this keystroke into the existing step.
    order.observe(1, 0, "recorded");

    expect(order.undoSeq()!).toBeGreaterThan(app.peekUndoSeq()!);
  });

  it("leaves stamps alone for changes the history did not record", () => {
    const order = new EditorHistoryOrder();
    order.observe(1, 0, "recorded");
    const stamp = order.undoSeq();

    order.observe(1, 0, "other");

    expect(order.undoSeq()).toBe(stamp);
  });

  it("pads steps it never saw as older than everything", () => {
    const order = new EditorHistoryOrder(2, 0);
    expect(order.undoSeq()).toBe(0);
    // A depth cap trimming the bottom keeps the newest stamps.
    order.observe(3, 0, "recorded");
    const newest = order.undoSeq();
    order.observe(2, 0, "other");
    expect(order.undoSeq()).toBe(newest);
  });
});

describe("UndoRedoManager stamps", () => {
  it("moves a command's stamp between the stacks with it", async () => {
    const app = new UndoRedoManager();
    expect(app.peekUndoSeq()).toBeNull();
    app.push(noop);
    const stamp = app.peekUndoSeq();

    await app.undo();
    expect(app.peekUndoSeq()).toBeNull();
    expect(app.peekRedoSeq()).toBe(stamp);

    await app.redo();
    expect(app.peekUndoSeq()).toBe(stamp);
  });
});
