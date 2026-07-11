import { describe, it, expect } from "vitest";
import type { TaskNode } from "../src/types/taskTree";
import { sortByDepthDesc } from "../src/utils/sortByDepthDesc";

/*
 * sortByDepthDesc unit tests (DU-B-4 — RB3-4 mitigation). Guarantees
 * permanentDeleteTask's leaf-first DELETE order so PG's ON DELETE NO
 * ACTION composite FK (DU-B-1 / 0009) is never violated.
 *
 * Required scenarios per DU-B 子計画書 §DU-B-4:
 *  - 3-level tree (root -> A -> A1 / A2; root -> B -> B1)
 *  - sibling ordering preserved on equal depth
 *  - orphan (parent missing from pool) handled, never throws
 *  - self-referential cycle handled by the visited guard
 */

function node(
  id: string,
  parentId: string | null,
  type: TaskNode["type"] = "task",
): TaskNode {
  return {
    id,
    type,
    title: id,
    parentId,
    order: 0,
    createdAt: "2026-05-23T00:00:00.000Z",
  };
}

describe("sortByDepthDesc", () => {
  it("orders a 3-level tree deepest-first (children before parent)", () => {
    // root
    //  ├─ A
    //  │   ├─ A1
    //  │   └─ A2
    //  └─ B
    //      └─ B1
    const pool: TaskNode[] = [
      node("root", null),
      node("A", "root"),
      node("A1", "A"),
      node("A2", "A"),
      node("B", "root"),
      node("B1", "B"),
    ];
    const ids = ["root", "A", "A1", "A2", "B", "B1"];
    const sorted = sortByDepthDesc(ids, pool);

    // Index check: every child must precede its parent.
    const idx = new Map(sorted.map((id, i) => [id, i]));
    expect(idx.get("A1")!).toBeLessThan(idx.get("A")!);
    expect(idx.get("A2")!).toBeLessThan(idx.get("A")!);
    expect(idx.get("B1")!).toBeLessThan(idx.get("B")!);
    expect(idx.get("A")!).toBeLessThan(idx.get("root")!);
    expect(idx.get("B")!).toBeLessThan(idx.get("root")!);
  });

  it("keeps caller order stable across equal-depth siblings", () => {
    // Two siblings at depth 1; the sort must not shuffle them.
    const pool: TaskNode[] = [
      node("root", null),
      node("S1", "root"),
      node("S2", "root"),
    ];
    expect(sortByDepthDesc(["S1", "S2", "root"], pool)).toEqual([
      "S1",
      "S2",
      "root",
    ]);
    expect(sortByDepthDesc(["S2", "S1", "root"], pool)).toEqual([
      "S2",
      "S1",
      "root",
    ]);
  });

  it("handles an orphan (parent missing from pool) without throwing", () => {
    // `ghost` references a parent id that is not in the pool. The walk
    // increments depth, then breaks on the missing lookup — exact
    // depth value is irrelevant since no other id competes; the
    // critical guarantee is "no throw, single-element identity sort".
    const pool: TaskNode[] = [node("ghost", "missing-parent")];
    expect(() => sortByDepthDesc(["ghost"], pool)).not.toThrow();
    expect(sortByDepthDesc(["ghost"], pool)).toEqual(["ghost"]);
  });

  it("does not infinite-loop on a self-referential cycle (known-issue 016)", () => {
    // a -> b -> a forms a 2-node cycle. visited guard must terminate.
    const pool: TaskNode[] = [node("a", "b"), node("b", "a")];
    expect(() => sortByDepthDesc(["a", "b"], pool)).not.toThrow();
    const sorted = sortByDepthDesc(["a", "b"], pool);
    expect(sorted.length).toBe(2);
    expect(new Set(sorted)).toEqual(new Set(["a", "b"]));
  });

  it("returns an empty array when given empty input", () => {
    expect(sortByDepthDesc([], [])).toEqual([]);
  });

  it("handles a single root with no children", () => {
    const pool: TaskNode[] = [node("solo", null)];
    expect(sortByDepthDesc(["solo"], pool)).toEqual(["solo"]);
  });
});
