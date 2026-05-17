import { describe, it, expect } from "vitest";
import { walkAncestors } from "../src/utils/walkAncestors";

/*
 * A audit Top5 #5: walkAncestors already ships the canonical visited-Set
 * guard. These tests pin that the existing guard terminates on cyclic /
 * self-referential parent chains (the same KI-016 class) so a regression
 * that drops the guard fails here too.
 */

interface N {
  id: string;
  parentId: string | null;
}

function mapOf(nodes: N[]): Map<string, N> {
  return new Map(nodes.map((n) => [n.id, n]));
}

describe("walkAncestors — visited guard (KI-016 class)", () => {
  it("yields ancestors from start to root in order", () => {
    const m = mapOf([
      { id: "root", parentId: null },
      { id: "mid", parentId: "root" },
      { id: "leaf", parentId: "mid" },
    ]);
    expect([...walkAncestors("leaf", m)].map((n) => n.id)).toEqual([
      "mid",
      "root",
    ]);
  });

  it("self-reference A->A terminates without yielding forever", () => {
    const m = mapOf([{ id: "A", parentId: "A" }]);
    const result = [...walkAncestors("A", m)];
    // visited guard stops after re-encountering A.
    expect(result.map((n) => n.id)).toEqual(["A"]);
  });

  it("2-node cycle A<->B terminates", () => {
    const m = mapOf([
      { id: "A", parentId: "B" },
      { id: "B", parentId: "A" },
    ]);
    const result = [...walkAncestors("A", m)];
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it("returns nothing for an unknown start id", () => {
    const m = mapOf([{ id: "A", parentId: null }]);
    expect([...walkAncestors("missing", m)]).toEqual([]);
  });
});
