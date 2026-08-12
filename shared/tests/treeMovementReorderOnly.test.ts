import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTaskTreeMovement } from "../src/hooks/useTaskTreeMovement";
import { useNoteTreeMovement } from "../src/hooks/useNoteTreeMovement";
import type { TaskNode } from "../src/types/taskTree";
import type { NoteNode } from "../src/types/note";

/*
 * #418 regression net — tree nesting is retired (2026-07-27 user decision).
 *
 * Pins the boundary the retirement drew: `moveNode` reorders inside ONE
 * sibling list and can never re-parent, `moveToRoot` still lifts legacy child
 * rows out, and `moveNodeInto` is gone from both movement hooks. Without this
 * net, restoring the deleted re-parent branch (or re-adding moveNodeInto)
 * would pass silently — nothing in the repo calls these hooks' move APIs
 * today, so the type checker alone would not notice.
 */

function task(
  id: string,
  order: number,
  parentId: string | null = null,
  isDeleted = false,
): TaskNode {
  return {
    id,
    type: "task",
    title: id,
    parentId,
    order,
    status: "NOT_STARTED",
    isDeleted,
    createdAt: "2026-07-27T00:00:00.000Z",
  };
}

function note(id: string, order: number, parentId: string | null): NoteNode {
  return {
    id,
    type: "note",
    title: id,
    content: "",
    parentId,
    order,
    isPinned: false,
    isDeleted: false,
    createdAt: "2026-07-27T00:00:00.000Z",
    updatedAt: "2026-07-27T00:00:00.000Z",
  };
}

function setupTasks(nodes: TaskNode[]) {
  const persistWithHistory =
    vi.fn<(current: TaskNode[], updated: TaskNode[]) => void>();
  const { result } = renderHook(() =>
    useTaskTreeMovement(nodes, persistWithHistory),
  );
  return { api: result.current, persistWithHistory };
}

function setupNotes(notes: NoteNode[]) {
  const persistWithHistory =
    vi.fn<(current: NoteNode[], updated: NoteNode[]) => void>();
  const { result } = renderHook(() =>
    useNoteTreeMovement(notes, persistWithHistory),
  );
  return { api: result.current, persistWithHistory };
}

const orderOf = (nodes: { id: string; order: number }[]) =>
  Object.fromEntries(nodes.map((n) => [n.id, n.order]));

describe("useTaskTreeMovement — reorder only (#418)", () => {
  it("reorders siblings and rewrites order densely", () => {
    const nodes = [task("A", 0), task("B", 1), task("C", 2)];
    const { api, persistWithHistory } = setupTasks(nodes);

    expect(api.moveNode("A", "C", "below")).toEqual({ success: true });
    const [, updated] = persistWithHistory.mock.calls[0];
    expect(orderOf(updated)).toEqual({ A: 2, B: 0, C: 1 });
    expect(updated.every((n) => n.parentId === null)).toBe(true);
  });

  it("rejects a drop onto a node in another parent instead of re-parenting", () => {
    const nodes = [task("P", 0), task("child", 0, "P"), task("Q", 1)];
    const { api, persistWithHistory } = setupTasks(nodes);

    expect(api.moveNode("Q", "child", "above")).toEqual({
      success: false,
      reason: "node_not_found",
    });
    expect(persistWithHistory).not.toHaveBeenCalled();
  });

  // The direction that USED to succeed before #418: the retired re-parent
  // branch guarded only non-null new parents, so dragging a child row next to
  // a ROOT node skipped the guard and lifted it out to a chosen slot. That is
  // the path a re-parent regression would come back through, so it needs its
  // own pin — the reverse direction above was already rejected pre-#418.
  it("rejects lifting a child row out by dropping it next to a root node", () => {
    const nodes = [task("P", 0), task("child", 0, "P"), task("Q", 1)];
    const { api, persistWithHistory } = setupTasks(nodes);

    expect(api.moveNode("child", "Q", "below")).toEqual({
      success: false,
      reason: "node_not_found",
    });
    expect(persistWithHistory).not.toHaveBeenCalled();
    expect(nodes.find((n) => n.id === "child")!.parentId).toBe("P");
  });

  it("still refuses to move a soft-deleted node", () => {
    const nodes = [task("A", 0, null, true), task("B", 1)];
    const { api, persistWithHistory } = setupTasks(nodes);

    expect(api.moveNode("A", "B", "below")).toEqual({
      success: false,
      reason: "deleted_node",
    });
    expect(persistWithHistory).not.toHaveBeenCalled();
  });

  it("moveToRoot lifts a legacy child row out and re-packs its old siblings", () => {
    const nodes = [
      task("P", 0),
      task("child", 0, "P"),
      task("sibling", 1, "P"),
      task("Q", 1),
    ];
    const { api, persistWithHistory } = setupTasks(nodes);

    expect(api.moveToRoot("child")).toEqual({ success: true });
    const [, updated] = persistWithHistory.mock.calls[0];
    const moved = updated.find((n) => n.id === "child")!;
    expect(moved.parentId).toBeNull();
    // Appends to the tail of the root list (P, Q) — no position control, which
    // is the capability the retired re-parent branch used to provide.
    expect(moved.order).toBe(2);
    // The child left behind closes the gap it opened.
    expect(updated.find((n) => n.id === "sibling")!.order).toBe(0);
  });

  it("exposes no nesting API", () => {
    const { api } = setupTasks([task("A", 0)]);
    expect(Object.keys(api).sort()).toEqual(["moveNode", "moveToRoot"]);
  });
});

describe("useNoteTreeMovement — reorder only (#418)", () => {
  it("reorders siblings and rewrites order densely", () => {
    const notes = [note("A", 0, null), note("B", 1, null), note("C", 2, null)];
    const { api, persistWithHistory } = setupNotes(notes);

    expect(api.moveNode("C", "A", "above")).toEqual({ success: true });
    const [, updated] = persistWithHistory.mock.calls[0];
    expect(orderOf(updated)).toEqual({ A: 1, B: 2, C: 0 });
  });

  it("rejects a drop onto a note in another parent instead of re-parenting", () => {
    const notes = [
      note("P", 0, null),
      note("child", 0, "P"),
      note("Q", 1, null),
    ];
    const { api, persistWithHistory } = setupNotes(notes);

    expect(api.moveNode("Q", "child", "above")).toEqual({
      success: false,
      reason: "node_not_found",
    });
    expect(persistWithHistory).not.toHaveBeenCalled();
  });

  it("rejects lifting a child row out by dropping it next to a root note", () => {
    const notes = [
      note("P", 0, null),
      note("child", 0, "P"),
      note("Q", 1, null),
    ];
    const { api, persistWithHistory } = setupNotes(notes);

    expect(api.moveNode("child", "Q", "below")).toEqual({
      success: false,
      reason: "node_not_found",
    });
    expect(persistWithHistory).not.toHaveBeenCalled();
    expect(notes.find((n) => n.id === "child")!.parentId).toBe("P");
  });

  // Deliberate asymmetry with Tasks (pre-dates #418, kept on purpose): Notes
  // has no isDeleted guard, so a soft-deleted note is simply filtered out of
  // the sibling list and reports `node_not_found`, not `deleted_node`. Pinned
  // so a future "let's make these two hooks symmetric" pass has to be explicit
  // about changing Notes' return value.
  it("reports node_not_found (not deleted_node) for a soft-deleted note", () => {
    const deleted = { ...note("A", 0, null), isDeleted: true };
    const { api, persistWithHistory } = setupNotes([
      deleted,
      note("B", 1, null),
    ]);

    expect(api.moveNode("A", "B", "below")).toEqual({
      success: false,
      reason: "node_not_found",
    });
    expect(persistWithHistory).not.toHaveBeenCalled();
  });

  it("exposes no nesting API", () => {
    const { api } = setupNotes([note("A", 0, null)]);
    expect(Object.keys(api).sort()).toEqual(["moveNode", "moveToRoot"]);
  });
});
