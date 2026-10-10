import { describe, it, expect } from "vitest";
import {
  EditorHistoryOrder,
  pickRedoSide,
  pickUndoSide,
} from "../src/utils/undoRedo/historyOrder";
import { UndoRedoManager } from "../src/utils/undoRedo/UndoRedoManager";

/*
 * #2141 — "newer first" between a body editor's history and the app stack
 * (D-20261008-main-3). Both sides stamp their steps from one clock — when a
 * step is done and when it is undone; these pin the bookkeeping on each side
 * and the rule that compares them.
 */

const noop = { label: "x", undo: () => {}, redo: () => {} };

describe("pickUndoSide / pickRedoSide", () => {
  it("takes the side with the later stamp", () => {
    expect(pickUndoSide(5, 3)).toBe("app");
    expect(pickUndoSide(3, 5)).toBe("editor");
    expect(pickRedoSide(5, 3)).toBe("app");
    expect(pickRedoSide(3, 5)).toBe("editor");
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

  it("keeps a step's done stamp across undo and redo", () => {
    const order = new EditorHistoryOrder();
    order.observe(1, 0, "recorded");
    const stamp = order.undoSeq();

    order.observe(0, 1, "history");
    expect(order.undoSeq()).toBeNull();
    expect(order.redoSeq()!).toBeGreaterThan(stamp!);

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

  it("stamps a new step even when the depth cap shrinks the history", () => {
    const app = new UndoRedoManager();
    // prosemirror-history lets the undo side reach 121, then trims it to 100
    // in the same transaction that adds the new step.
    const order = new EditorHistoryOrder(120, 0);
    app.push(noop);

    order.observe(100, 0, "recorded");

    expect(order.undoSeq()!).toBeGreaterThan(app.peekUndoSeq()!);
  });

  it("drops the top step when an undo had nothing left to reverse", () => {
    const order = new EditorHistoryOrder();
    order.observe(1, 0, "recorded");
    const older = order.undoSeq();
    order.observe(2, 0, "recorded");

    // The newest step's changes were replaced from elsewhere: the history
    // pops it and records nothing to redo.
    order.observe(1, 0, "history");

    expect(order.undoSeq()).toBe(older);
    expect(order.redoSeq()).toBeNull();
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
  });
});

describe("UndoRedoManager stamps", () => {
  it("keeps the done stamp across undo and redo, and stamps the undo", async () => {
    const app = new UndoRedoManager();
    expect(app.peekUndoSeq()).toBeNull();
    app.push(noop);
    const stamp = app.peekUndoSeq();

    await app.undo();
    expect(app.peekUndoSeq()).toBeNull();
    expect(app.peekRedoSeq()!).toBeGreaterThan(stamp!);

    await app.redo();
    expect(app.peekUndoSeq()).toBe(stamp);
  });
});

describe("redo order across both sides", () => {
  it("redoes the body first when a tag was undone before the body was", async () => {
    // Tag, undo it, type "abc", undo that, then Redo: "abc" was taken back
    // last, so it comes back first — although the tag was done earlier.
    const app = new UndoRedoManager();
    const order = new EditorHistoryOrder();
    app.push(noop);
    await app.undo();
    order.observe(1, 0, "recorded");
    order.observe(0, 1, "history");

    expect(pickRedoSide(app.peekRedoSeq(), order.redoSeq())).toBe("editor");
  });
});
