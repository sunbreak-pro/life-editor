import { describe, it, expect } from "vitest";
import {
  collectDescendantIds,
  isDescendantOf,
} from "../src/utils/getDescendantTodos";
import type { TodoNode } from "../src/types/todoTree";

/*
 * KI-016 anchor: the canonical visited-Set pattern. These tests pin the
 * invariant that every node is visited at most once, so a cyclic /
 * self-referential parentId chain terminates instead of OOMing the worker.
 * vitest's default 5s per-test timeout makes any reintroduced infinite
 * loop a hard failure.
 */

function todo(id: string, parentId: string | null): TodoNode {
  return {
    id,
    type: "task",
    title: id,
    parentId,
    order: 0,
    createdAt: "2026-01-01T00:00:00Z",
  };
}

// S3 (#225): getDescendantTodos was deleted (zero callers). collectDescendantIds
// and isDescendantOf remain the canonical KI-016 visited-guard helpers.

describe("collectDescendantIds (KI-016 visited guard)", () => {
  it("returns the node plus all descendant ids", () => {
    const nodes = [todo("root", null), todo("a", "root"), todo("b", "a")];
    expect([...collectDescendantIds("root", nodes)].sort()).toEqual([
      "a",
      "b",
      "root",
    ]);
  });

  it("cycle A<->B terminates and collects each id once", () => {
    const nodes = [todo("A", "B"), todo("B", "A")];
    const ids = collectDescendantIds("A", nodes);
    expect(ids.has("A")).toBe(true);
    expect(ids.has("B")).toBe(true);
    expect(ids.size).toBe(2);
  });
});

describe("isDescendantOf (KI-016 visited guard)", () => {
  it("finds a nested descendant", () => {
    const nodes = [
      todo("root", null),
      todo("mid", "root"),
      todo("leaf", "mid"),
    ];
    expect(isDescendantOf("root", "leaf", nodes)).toBe(true);
    expect(isDescendantOf("mid", "root", nodes)).toBe(false);
  });

  it("2-node cycle terminates for absent target", () => {
    const nodes = [todo("A", "B"), todo("B", "A")];
    expect(isDescendantOf("A", "ghost", nodes)).toBe(false);
  });

  it("2-node cycle still finds directly reachable child", () => {
    const nodes = [todo("A", "B"), todo("B", "A")];
    expect(isDescendantOf("A", "B", nodes)).toBe(true);
  });
});
