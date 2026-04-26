import { describe, it, expect } from "vitest";
import type { Node, Edge } from "@xyflow/react";
import { mergeNodes, mergeEdges } from "./reactFlowMerge";

function makeNode(
  overrides: Partial<Node> & { id: string; data?: Record<string, unknown> },
): Node {
  return {
    id: overrides.id,
    type: overrides.type ?? "card",
    position: overrides.position ?? { x: 0, y: 0 },
    data: overrides.data ?? {},
    ...overrides,
  };
}

function makeEdge(overrides: Partial<Edge> & { id: string }): Edge {
  return {
    id: overrides.id,
    source: overrides.source ?? "a",
    target: overrides.target ?? "b",
    ...overrides,
  };
}

describe("mergeNodes", () => {
  it("returns prev when prev === next", () => {
    const a = makeNode({ id: "a" });
    const arr = [a];
    expect(mergeNodes(arr, arr)).toBe(arr);
  });

  it("returns next when prev is empty", () => {
    const next = [makeNode({ id: "a" })];
    expect(mergeNodes([], next)).toBe(next);
  });

  it("preserves per-entry identity when content is unchanged", () => {
    const prevA = makeNode({ id: "a", data: { x: 1 } });
    const prevB = makeNode({ id: "b", data: { x: 2 } });
    const nextA = makeNode({ id: "a", data: { x: 1 } });
    const nextB = makeNode({ id: "b", data: { x: 2 } });
    const merged = mergeNodes([prevA, prevB], [nextA, nextB]);
    expect(merged[0]).toBe(prevA);
    expect(merged[1]).toBe(prevB);
  });

  it("returns prev reference when nothing changed", () => {
    const prev = [
      makeNode({ id: "a", data: { x: 1 } }),
      makeNode({ id: "b", data: { x: 2 } }),
    ];
    const next = [
      makeNode({ id: "a", data: { x: 1 } }),
      makeNode({ id: "b", data: { x: 2 } }),
    ];
    expect(mergeNodes(prev, next)).toBe(prev);
  });

  it("uses next entry when position changed", () => {
    const prev = [makeNode({ id: "a", position: { x: 0, y: 0 } })];
    const nextNode = makeNode({ id: "a", position: { x: 10, y: 0 } });
    const merged = mergeNodes(prev, [nextNode]);
    expect(merged[0]).toBe(nextNode);
  });

  it("uses next entry when data shallow-differs", () => {
    const prev = [makeNode({ id: "a", data: { x: 1 } })];
    const nextNode = makeNode({ id: "a", data: { x: 2 } });
    const merged = mergeNodes(prev, [nextNode]);
    expect(merged[0]).toBe(nextNode);
  });

  it("treats removed nodes as a real change", () => {
    const prev = [makeNode({ id: "a" }), makeNode({ id: "b" })];
    const next = [prev[0]];
    const merged = mergeNodes(prev, next);
    expect(merged).not.toBe(prev);
    expect(merged.length).toBe(1);
  });

  it("treats added nodes as a real change", () => {
    const prev = [makeNode({ id: "a" })];
    const next = [prev[0], makeNode({ id: "b" })];
    const merged = mergeNodes(prev, next);
    expect(merged).not.toBe(prev);
    expect(merged.length).toBe(2);
  });

  it("treats reorder as a real change (parents-before-children matters)", () => {
    const a = makeNode({ id: "a" });
    const b = makeNode({ id: "b" });
    const prev = [a, b];
    const nextA = makeNode({ id: "a" });
    const nextB = makeNode({ id: "b" });
    const next = [nextB, nextA];
    const merged = mergeNodes(prev, next);
    expect(merged).not.toBe(prev);
    expect(merged[0].id).toBe("b");
    expect(merged[1].id).toBe("a");
  });

  it("ignores deepArrayDataKeys identity differences when contents match", () => {
    const prev = [
      makeNode({
        id: "a",
        data: { tagDots: [{ id: "t1", color: "red" }] },
      }),
    ];
    const next = [
      makeNode({
        id: "a",
        data: { tagDots: [{ id: "t1", color: "red" }] }, // new array, same content
      }),
    ];
    const merged = mergeNodes(prev, next, {
      deepArrayDataKeys: new Set(["tagDots"]),
    });
    expect(merged).toBe(prev);
  });

  it("detects content change inside deepArrayDataKeys array", () => {
    const prev = [
      makeNode({
        id: "a",
        data: { tagDots: [{ id: "t1", color: "red" }] },
      }),
    ];
    const next = [
      makeNode({
        id: "a",
        data: { tagDots: [{ id: "t1", color: "blue" }] },
      }),
    ];
    const merged = mergeNodes(prev, next, {
      deepArrayDataKeys: new Set(["tagDots"]),
    });
    expect(merged).not.toBe(prev);
    expect(merged[0]).toBe(next[0]);
  });

  it("detects style.width / style.height change", () => {
    const prev = [makeNode({ id: "a", style: { width: 100, height: 50 } })];
    const next = [makeNode({ id: "a", style: { width: 200, height: 50 } })];
    const merged = mergeNodes(prev, next);
    expect(merged[0]).toBe(next[0]);
  });
});

describe("mergeEdges", () => {
  it("returns prev when nothing changed", () => {
    const sharedData = { onDelete: () => {} };
    const prev = [makeEdge({ id: "e1", data: sharedData })];
    const next = [makeEdge({ id: "e1", data: sharedData })];
    expect(mergeEdges(prev, next)).toBe(prev);
  });

  it("uses next when target differs", () => {
    const prev = [makeEdge({ id: "e1", source: "a", target: "b" })];
    const next = [makeEdge({ id: "e1", source: "a", target: "c" })];
    const merged = mergeEdges(prev, next);
    expect(merged[0]).toBe(next[0]);
  });

  it("uses next when sourceHandle differs", () => {
    const prev = [makeEdge({ id: "e1", sourceHandle: "left-target" })];
    const next = [makeEdge({ id: "e1", sourceHandle: "right-source" })];
    const merged = mergeEdges(prev, next);
    expect(merged[0]).toBe(next[0]);
  });

  it("treats data ref change as a real change (no deep compare)", () => {
    const prev = [makeEdge({ id: "e1", data: { onDelete: () => {} } })];
    const next = [makeEdge({ id: "e1", data: { onDelete: () => {} } })];
    const merged = mergeEdges(prev, next);
    expect(merged[0]).toBe(next[0]);
  });

  it("treats removed edges as a real change", () => {
    const prev = [makeEdge({ id: "e1" }), makeEdge({ id: "e2" })];
    const next = [prev[0]];
    const merged = mergeEdges(prev, next);
    expect(merged).not.toBe(prev);
    expect(merged.length).toBe(1);
  });
});
