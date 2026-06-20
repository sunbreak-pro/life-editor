import { describe, it, expect } from "vitest";
import type { TaskNode } from "../src/types/taskTree";
import type { KanbanLabels } from "../src/components/Kanban/types";
import {
  buildFolderColumns,
  buildStatusColumns,
  buildTagColumns,
} from "../src/components/Kanban/buildColumns";

/*
 * K1 + K2 column builders. Pure mapping from the active TaskNode set →
 * KanbanColumnModel[] per view mode. Tests pin: folder/status grouping,
 * order sorting, deleted-node exclusion, the "folders are containers, never
 * cards" invariant, folder-pill resolution, and the tag-by view (one column
 * per tag + a trailing untagged bucket, multi-tag fan-out).
 */

function makeNode(overrides: Partial<TaskNode> & { id: string }): TaskNode {
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
  viewFolder: "By folder",
  viewStatus: "By status",
  viewTag: "By tag",
  segmentedGroupLabel: "Switch board view",
  statusNotStarted: "Not started",
  statusInProgress: "In progress",
  statusDone: "Done",
  cardAriaLabel: (title, statusText) => `${title} — ${statusText}`,
  emptyColumn: "No tasks here yet",
  placeholderHint: "Tag view is coming soon",
  countAriaLabel: (n) => `${n}`,
  untagged: "No tag",
  colorPickerLabel: "Change color",
  colorClearLabel: "Default color",
  colorCustomLabel: "Custom",
};

describe("buildFolderColumns", () => {
  it("makes one column per active folder, with its direct task children", () => {
    const nodes: TaskNode[] = [
      makeNode({ id: "f1", type: "folder", title: "Work", order: 0 }),
      makeNode({ id: "f2", type: "folder", title: "Home", order: 1 }),
      makeNode({ id: "t1", parentId: "f1", title: "A", order: 0 }),
      makeNode({ id: "t2", parentId: "f1", title: "B", order: 1 }),
      makeNode({ id: "t3", parentId: "f2", title: "C", order: 0 }),
    ];
    const cols = buildFolderColumns(nodes);
    expect(cols.map((c) => c.id)).toEqual(["f1", "f2"]);
    expect(cols[0].cards.map((c) => c.id)).toEqual(["t1", "t2"]);
    expect(cols[1].cards.map((c) => c.id)).toEqual(["t3"]);
  });

  it("keeps a folder with no tasks as an empty column", () => {
    const nodes: TaskNode[] = [
      makeNode({ id: "f1", type: "folder", title: "Empty", order: 0 }),
    ];
    const cols = buildFolderColumns(nodes);
    expect(cols).toHaveLength(1);
    expect(cols[0].cards).toEqual([]);
  });

  it("sorts folders and cards by order, not insertion", () => {
    const nodes: TaskNode[] = [
      makeNode({ id: "f2", type: "folder", title: "Second", order: 5 }),
      makeNode({ id: "f1", type: "folder", title: "First", order: 1 }),
      makeNode({ id: "tb", parentId: "f1", title: "B", order: 9 }),
      makeNode({ id: "ta", parentId: "f1", title: "A", order: 2 }),
    ];
    const cols = buildFolderColumns(nodes);
    expect(cols.map((c) => c.id)).toEqual(["f1", "f2"]);
    expect(cols[0].cards.map((c) => c.id)).toEqual(["ta", "tb"]);
  });

  it("excludes deleted tasks/folders and never cards a folder", () => {
    const nodes: TaskNode[] = [
      makeNode({ id: "f1", type: "folder", title: "Work", order: 0 }),
      makeNode({
        id: "fdel",
        type: "folder",
        title: "Gone",
        order: 1,
        isDeleted: true,
      }),
      makeNode({ id: "t1", parentId: "f1", title: "A", order: 0 }),
      makeNode({
        id: "tdel",
        parentId: "f1",
        title: "DeletedTask",
        order: 1,
        isDeleted: true,
      }),
      // A nested folder under f1 must NOT appear as a card in f1.
      makeNode({ id: "sub", type: "folder", parentId: "f1", order: 2 }),
    ];
    const cols = buildFolderColumns(nodes);
    expect(cols.map((c) => c.id)).toEqual(["f1", "sub"]);
    expect(cols[0].cards.map((c) => c.id)).toEqual(["t1"]);
  });

  it("propagates the folder color as the column accent", () => {
    const nodes: TaskNode[] = [
      makeNode({
        id: "f1",
        type: "folder",
        title: "Colored",
        order: 0,
        color: "#2563eb",
      }),
    ];
    const cols = buildFolderColumns(nodes);
    expect(cols[0].accentColor).toBe("#2563eb");
  });

  it("does not stamp folderColor on folder-view cards (the column conveys it)", () => {
    const nodes: TaskNode[] = [
      makeNode({
        id: "f1",
        type: "folder",
        title: "Colored",
        order: 0,
        color: "#2563eb",
      }),
      makeNode({ id: "t1", parentId: "f1", title: "A", order: 0 }),
    ];
    const cols = buildFolderColumns(nodes);
    // Folder view tints the PANEL (column.accentColor), not the cards — so the
    // folder color rides on the column, and cards carry no folderColor here.
    expect(cols[0].accentColor).toBe("#2563eb");
    expect(cols[0].cards[0].folderColor).toBeUndefined();
  });
});

describe("buildStatusColumns", () => {
  it("makes three fixed columns in NOT_STARTED / IN_PROGRESS / DONE order", () => {
    const cols = buildStatusColumns([], LABELS);
    expect(cols.map((c) => c.id)).toEqual([
      "status-NOT_STARTED",
      "status-IN_PROGRESS",
      "status-DONE",
    ]);
    expect(cols.map((c) => c.title)).toEqual([
      "Not started",
      "In progress",
      "Done",
    ]);
  });

  it("groups tasks by status, treating missing status as NOT_STARTED", () => {
    const nodes: TaskNode[] = [
      makeNode({ id: "t1", status: "IN_PROGRESS" }),
      makeNode({ id: "t2", status: "DONE" }),
      makeNode({ id: "t3" }), // no status → NOT_STARTED
    ];
    const cols = buildStatusColumns(nodes, LABELS);
    const byId = Object.fromEntries(cols.map((c) => [c.id, c]));
    expect(byId["status-NOT_STARTED"].cards.map((c) => c.id)).toEqual(["t3"]);
    expect(byId["status-IN_PROGRESS"].cards.map((c) => c.id)).toEqual(["t1"]);
    expect(byId["status-DONE"].cards.map((c) => c.id)).toEqual(["t2"]);
  });

  it("resolves the folder pill name/color from the task's parent folder", () => {
    const nodes: TaskNode[] = [
      makeNode({
        id: "f1",
        type: "folder",
        title: "Work",
        order: 0,
        color: "#2563eb",
      }),
      makeNode({ id: "t1", parentId: "f1", status: "DONE" }),
      makeNode({ id: "t2", parentId: null, status: "DONE" }),
    ];
    const cols = buildStatusColumns(nodes, LABELS);
    const done = cols.find((c) => c.id === "status-DONE")!;
    const card1 = done.cards.find((c) => c.id === "t1")!;
    const card2 = done.cards.find((c) => c.id === "t2")!;
    expect(card1.folderName).toBe("Work");
    expect(card1.folderColor).toBe("#2563eb");
    expect(card2.folderName).toBeUndefined();
  });

  it("excludes deleted tasks and never cards folders", () => {
    const nodes: TaskNode[] = [
      makeNode({ id: "f1", type: "folder", order: 0 }),
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
    const nodes: TaskNode[] = [
      makeNode({ id: "t1", order: 0 }),
      makeNode({ id: "t2", order: 1 }),
      makeNode({ id: "t3", order: 2 }),
    ];
    const tagsByTask = new Map([
      ["t1", [RED, VIOLET]],
      ["t2", [RED]],
    ]);
    const cols = buildTagColumns(nodes, [RED, VIOLET], tagsByTask, LABELS);
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

  it("places a multi-tag task in every matching column", () => {
    const nodes: TaskNode[] = [makeNode({ id: "t1", order: 0 })];
    const tagsByTask = new Map([["t1", [RED, VIOLET]]]);
    const cols = buildTagColumns(nodes, [RED, VIOLET], tagsByTask, LABELS);
    expect(cols[0].cards.map((c) => c.id)).toEqual(["t1"]); // RED
    expect(cols[1].cards.map((c) => c.id)).toEqual(["t1"]); // VIOLET
  });

  it("collects only untagged tasks in the untagged bucket", () => {
    const nodes: TaskNode[] = [
      makeNode({ id: "t1", order: 0 }),
      makeNode({ id: "t2", order: 1 }),
      makeNode({ id: "t3", order: 2 }),
    ];
    const tagsByTask = new Map([["t1", [RED]]]);
    const cols = buildTagColumns(nodes, [RED], tagsByTask, LABELS);
    const untagged = cols[cols.length - 1];
    expect(untagged.id).toBe("tag-__none__");
    expect(untagged.cards.map((c) => c.id)).toEqual(["t2", "t3"]);
  });

  it("keeps a tag with no tasks as an empty column", () => {
    const cols = buildTagColumns([], [RED], new Map(), LABELS);
    expect(cols.map((c) => c.id)).toEqual(["tag-tagR", "tag-__none__"]);
    expect(cols[0].cards).toEqual([]);
  });

  it("excludes deleted tasks and never cards folders", () => {
    const nodes: TaskNode[] = [
      makeNode({ id: "f1", type: "folder", order: 0 }),
      makeNode({ id: "t1", order: 1 }),
      makeNode({ id: "tdel", order: 2, isDeleted: true }),
    ];
    const tagsByTask = new Map([
      ["t1", [RED]],
      ["tdel", [RED]],
    ]);
    const cols = buildTagColumns(nodes, [RED], tagsByTask, LABELS);
    expect(cols[0].cards.map((c) => c.id)).toEqual(["t1"]);
    // f1 (folder) is a container, never a card, even with no tag.
    const untagged = cols[cols.length - 1];
    expect(untagged.cards.map((c) => c.id)).toEqual([]);
  });

  it("resolves the folder pill from the task's parent folder", () => {
    const nodes: TaskNode[] = [
      makeNode({
        id: "f1",
        type: "folder",
        title: "Work",
        order: 0,
        color: "#2563eb",
      }),
      makeNode({ id: "t1", parentId: "f1", order: 1 }),
    ];
    const tagsByTask = new Map([["t1", [RED]]]);
    const cols = buildTagColumns(nodes, [RED], tagsByTask, LABELS);
    const card = cols[0].cards.find((c) => c.id === "t1")!;
    expect(card.folderName).toBe("Work");
    expect(card.folderColor).toBe("#2563eb");
  });
});
