import { describe, it, expect } from "vitest";
import {
  getDirectSearchMatches,
  getSearchMatchIds,
} from "./filterTreeBySearch";
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

describe("getDirectSearchMatches", () => {
  it("returns empty array for empty query", () => {
    const nodes = [makeNode({ id: "a", title: "apple" })];
    expect(getDirectSearchMatches(nodes, "")).toEqual([]);
  });

  it("excludes soft-deleted nodes", () => {
    const nodes = [
      makeNode({ id: "a", title: "apple" }),
      makeNode({ id: "b", title: "apple-deleted", isDeleted: true }),
    ];
    const result = getDirectSearchMatches(nodes, "apple");
    expect(result.map((n) => n.id)).toEqual(["a"]);
  });
});

describe("getSearchMatchIds", () => {
  it("excludes soft-deleted nodes from direct matches", () => {
    const nodes = [
      makeNode({ id: "a", title: "apple" }),
      makeNode({ id: "b", title: "apple-deleted", isDeleted: true }),
    ];
    const result = getSearchMatchIds(nodes, "apple");
    expect(result.has("a")).toBe(true);
    expect(result.has("b")).toBe(false);
  });

  it("includes non-deleted ancestors of matching nodes", () => {
    const nodes = [
      makeNode({ id: "root", type: "folder", title: "parent-folder" }),
      makeNode({ id: "child", parentId: "root", title: "apple" }),
    ];
    const result = getSearchMatchIds(nodes, "apple");
    expect(result.has("child")).toBe(true);
    expect(result.has("root")).toBe(true);
  });

  it("stops ancestor walk at a deleted parent", () => {
    const nodes = [
      makeNode({ id: "grand", type: "folder", title: "grand" }),
      makeNode({
        id: "parent",
        type: "folder",
        parentId: "grand",
        title: "parent",
        isDeleted: true,
      }),
      makeNode({ id: "child", parentId: "parent", title: "apple" }),
    ];
    const result = getSearchMatchIds(nodes, "apple");
    // child matches directly (not deleted itself)
    expect(result.has("child")).toBe(true);
    // ancestor walk should stop at deleted parent — neither parent nor grand are included
    expect(result.has("parent")).toBe(false);
    expect(result.has("grand")).toBe(false);
  });

  it("skips directly-matching nodes if they are deleted", () => {
    const nodes = [makeNode({ id: "a", title: "apple", isDeleted: true })];
    const result = getSearchMatchIds(nodes, "apple");
    expect(result.size).toBe(0);
  });

  it("is safe against circular parentId chains", () => {
    const nodes = [
      makeNode({
        id: "a",
        type: "folder",
        title: "apple",
        parentId: "b",
      }),
      makeNode({ id: "b", type: "folder", title: "banana", parentId: "a" }),
    ];
    // Must not hang; result can be either set but execution must terminate.
    const result = getSearchMatchIds(nodes, "apple");
    expect(result.has("a")).toBe(true);
  });
});
