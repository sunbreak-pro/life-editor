import { describe, it, expect } from "vitest";
import { walkAncestors } from "./walkAncestors";
import { resolveTaskColor } from "./folderColor";
import { getFolderTag } from "./folderTag";
import type { TaskNode } from "../types/taskTree";

function makeNode(overrides: Partial<TaskNode> & { id: string }): TaskNode {
  return {
    type: "task",
    title: overrides.id,
    parentId: null,
    order: 0,
    createdAt: "2024-01-01",
    ...overrides,
  };
}

describe("walkAncestors", () => {
  it("yields ancestors in order (nearest first)", () => {
    const nodes = [
      makeNode({ id: "root", type: "folder" }),
      makeNode({ id: "mid", type: "folder", parentId: "root" }),
      makeNode({ id: "leaf", parentId: "mid" }),
    ];
    const map = new Map(nodes.map((n) => [n.id, n]));
    const ids = Array.from(walkAncestors("leaf", map)).map((n) => n.id);
    expect(ids).toEqual(["mid", "root"]);
  });

  it("terminates on circular parentId chains without hanging", () => {
    const nodes = [
      makeNode({ id: "a", type: "folder", parentId: "b" }),
      makeNode({ id: "b", type: "folder", parentId: "a" }),
    ];
    const map = new Map(nodes.map((n) => [n.id, n]));
    const ids = Array.from(walkAncestors("a", map)).map((n) => n.id);
    // Must terminate; exact contents can be either ancestor but the loop exits.
    expect(ids.length).toBeLessThanOrEqual(2);
  });

  it("returns nothing for unknown startId", () => {
    const map = new Map<string, TaskNode>();
    const ids = Array.from(walkAncestors("missing", map));
    expect(ids).toEqual([]);
  });
});

describe("folderColor / folderTag — cycle safety", () => {
  it("resolveTaskColor terminates on circular parentId", () => {
    const nodes = [
      makeNode({
        id: "a",
        type: "folder",
        color: "#ff0000",
        parentId: "b",
      }),
      makeNode({ id: "b", type: "folder", parentId: "a" }),
    ];
    const map = new Map(nodes.map((n) => [n.id, n]));
    // Must not hang.
    const color = resolveTaskColor("a", map);
    expect(color).toBe("#ff0000");
  });

  it("getFolderTag terminates on circular parentId", () => {
    const nodes = [
      makeNode({ id: "a", type: "folder", title: "A", parentId: "b" }),
      makeNode({ id: "b", type: "folder", title: "B", parentId: "a" }),
    ];
    const map = new Map(nodes.map((n) => [n.id, n]));
    // Must not hang; returns something (exact string depends on traversal).
    const tag = getFolderTag("a", map);
    expect(typeof tag).toBe("string");
  });
});
