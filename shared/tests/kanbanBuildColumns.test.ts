import { describe, it, expect } from "vitest";
import type { TodoNode } from "../src/types/todoTree";
import type { KanbanLabels } from "../src/components/Kanban/types";
import {
  buildStatusColumns,
  buildTagColumns,
} from "../src/components/Kanban/buildColumns";

/*
 * Column builders (life-tags S1: folder view retired; S3 #225: folder node
 * type removed). Pure mapping from the active TodoNode set →
 * KanbanColumnModel[] per view mode. Tests pin: status grouping, order
 * sorting, deleted-node exclusion, transitional orphan tolerance (a todo
 * pointing at a legacy — now excluded — folder parent still surfaces), and
 * the tag-by view (one column per tag + a trailing untagged bucket, multi-tag
 * fan-out).
 */

function makeNode(overrides: Partial<TodoNode> & { id: string }): TodoNode {
  return {
    type: "task",
    title: overrides.id,
    parentId: null,
    order: 0,
    createdAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const LABELS: KanbanLabels = {
  viewStatus: "By status",
  viewTag: "By tag",
  segmentedGroupLabel: "Switch board view",
  statusNotStarted: "Not started",
  statusDone: "Done",
  cardAriaLabel: (title, statusText) => `${title} — ${statusText}`,
  emptyColumn: "No todos here yet",
  placeholderHint: "Tag view is coming soon",
  countAriaLabel: (n) => `${n}`,
  untagged: "No tag",
  colorPickerLabel: "Change color",
  colorClearLabel: "Default color",
  colorCustomLabel: "Custom",
};

describe("buildStatusColumns", () => {
  it("makes two fixed columns in NOT_STARTED / DONE order (#873)", () => {
    const cols = buildStatusColumns([], LABELS);
    expect(cols.map((c) => c.id)).toEqual(["status-NOT_STARTED", "status-DONE"]);
    expect(cols.map((c) => c.title)).toEqual(["Not started", "Done"]);
  });

  it("groups todos by status, treating missing status as NOT_STARTED", () => {
    const nodes: TodoNode[] = [
      makeNode({ id: "t1", status: "NOT_STARTED" }),
      makeNode({ id: "t2", status: "DONE" }),
      makeNode({ id: "t3" }), // no status → NOT_STARTED
    ];
    const cols = buildStatusColumns(nodes, LABELS);
    const byId = Object.fromEntries(cols.map((c) => [c.id, c]));
    expect(byId["status-NOT_STARTED"].cards.map((c) => c.id)).toEqual([
      "t1",
      "t3",
    ]);
    expect(byId["status-DONE"].cards.map((c) => c.id)).toEqual(["t2"]);
  });

  it("surfaces a todo that still points at a legacy (excluded) folder parent", () => {
    // Transitional invariant (life-tags S3): the legacy folder row is dropped
    // by the fetch filter and can no longer be constructed as a node, but a
    // todo still referencing that (now-missing) parent id must appear by
    // status all the same.
    const nodes: TodoNode[] = [
      makeNode({ id: "t1", parentId: "f1-legacy", status: "DONE" }),
      makeNode({ id: "t2", parentId: null, status: "DONE" }),
    ];
    const cols = buildStatusColumns(nodes, LABELS);
    const done = cols.find((c) => c.id === "status-DONE")!;
    expect(done.cards.map((c) => c.id).sort()).toEqual(["t1", "t2"]);
  });

  it("excludes deleted todos", () => {
    const nodes: TodoNode[] = [
      makeNode({ id: "t1", status: "NOT_STARTED" }),
      makeNode({ id: "tdel", status: "NOT_STARTED", isDeleted: true }),
    ];
    const cols = buildStatusColumns(nodes, LABELS);
    const todo = cols.find((c) => c.id === "status-NOT_STARTED")!;
    expect(todo.cards.map((c) => c.id)).toEqual(["t1"]);
  });
});

describe("buildTagColumns", () => {
  const RED = { id: "tagR", name: "Urgent", color: "#e03e3e" };
  const VIOLET = { id: "tagV", name: "Idea", color: "#8b5cf6" };

  it("makes one column per tag (in order) + a trailing untagged bucket", () => {
    const nodes: TodoNode[] = [
      makeNode({ id: "t1", order: 0 }),
      makeNode({ id: "t2", order: 1 }),
      makeNode({ id: "t3", order: 2 }),
    ];
    const tagsByTodo = new Map([
      ["t1", [RED, VIOLET]],
      ["t2", [RED]],
    ]);
    const cols = buildTagColumns(nodes, [RED, VIOLET], tagsByTodo, LABELS);
    expect(cols.map((c) => c.id)).toEqual([
      "tag-tagR",
      "tag-tagV",
      "tag-__none__",
    ]);
    // Tag columns carry the tag's own color + are color-editable; the
    // untagged bucket is neither.
    expect(cols[0].title).toBe("Urgent");
    expect(cols[0].accentColor).toBe("#e03e3e");
    expect(cols[0].colorEditable).toBe(true);
    expect(cols[0].roundDot).toBe(true);
    const untagged = cols[2];
    expect(untagged.title).toBe("No tag");
    expect(untagged.colorEditable).toBeFalsy();
  });

  it("places a multi-tag todo in every matching column", () => {
    const nodes: TodoNode[] = [makeNode({ id: "t1", order: 0 })];
    const tagsByTodo = new Map([["t1", [RED, VIOLET]]]);
    const cols = buildTagColumns(nodes, [RED, VIOLET], tagsByTodo, LABELS);
    expect(cols[0].cards.map((c) => c.id)).toEqual(["t1"]); // RED
    expect(cols[1].cards.map((c) => c.id)).toEqual(["t1"]); // VIOLET
  });

  it("collects only untagged todos in the untagged bucket", () => {
    const nodes: TodoNode[] = [
      makeNode({ id: "t1", order: 0 }),
      makeNode({ id: "t2", order: 1 }),
      makeNode({ id: "t3", order: 2 }),
    ];
    const tagsByTodo = new Map([["t1", [RED]]]);
    const cols = buildTagColumns(nodes, [RED], tagsByTodo, LABELS);
    const untagged = cols[cols.length - 1];
    expect(untagged.id).toBe("tag-__none__");
    expect(untagged.cards.map((c) => c.id)).toEqual(["t2", "t3"]);
  });

  it("keeps a tag with no todos as an empty column", () => {
    const cols = buildTagColumns([], [RED], new Map(), LABELS);
    expect(cols.map((c) => c.id)).toEqual(["tag-tagR", "tag-__none__"]);
    expect(cols[0].cards).toEqual([]);
  });

  it("excludes deleted todos", () => {
    const nodes: TodoNode[] = [
      makeNode({ id: "t1", order: 1 }),
      makeNode({ id: "tdel", order: 2, isDeleted: true }),
    ];
    const tagsByTodo = new Map([
      ["t1", [RED]],
      ["tdel", [RED]],
    ]);
    const cols = buildTagColumns(nodes, [RED], tagsByTodo, LABELS);
    expect(cols[0].cards.map((c) => c.id)).toEqual(["t1"]);
    const untagged = cols[cols.length - 1];
    expect(untagged.cards.map((c) => c.id)).toEqual([]);
  });

  it("surfaces a todo pointing at a legacy (missing) folder parent in its tag column", () => {
    const nodes: TodoNode[] = [
      makeNode({ id: "t1", parentId: "f1-legacy", order: 1 }),
    ];
    const tagsByTodo = new Map([["t1", [RED]]]);
    const cols = buildTagColumns(nodes, [RED], tagsByTodo, LABELS);
    expect(cols[0].cards.map((c) => c.id)).toEqual(["t1"]);
  });
});
