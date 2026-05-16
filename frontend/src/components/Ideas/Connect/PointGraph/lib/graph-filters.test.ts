import { describe, it, expect } from "vitest";
import type { GraphSnapshot } from "./graph-types";
import { tagNodeId } from "./graph-types";
import {
  DEFAULT_FILTER_STATE,
  DEFAULT_TYPE_TOGGLES,
  activeFilterCount,
  applyFilters,
  isFilterActive,
  type FilterState,
} from "./graph-filters";

// note A --wikilink--> note B ; both tagged #x ; orphan note C
const snapshot: GraphSnapshot = {
  nodes: [
    { id: "n-a", label: "Alpha", type: "note" },
    { id: "n-b", label: "Beta", type: "note" },
    { id: "n-c", label: "Gamma", type: "note" },
    { id: "d-1", label: "2026-05-13", type: "daily" },
    { id: tagNodeId("x"), label: "#x", type: "tag", entityId: "x" },
  ],
  links: [
    { source: "n-a", target: "n-b", kind: "wikilink" },
    { source: "n-a", target: tagNodeId("x"), kind: "tag" },
    { source: "n-b", target: tagNodeId("x"), kind: "tag" },
  ],
};

function state(over: Partial<FilterState> = {}): FilterState {
  return { ...DEFAULT_FILTER_STATE, ...over };
}

describe("applyFilters", () => {
  it("returns everything with the default state", () => {
    const { snapshot: out, searchMatchSet } = applyFilters(snapshot, state());
    expect(out.nodes).toHaveLength(5);
    expect(out.links).toHaveLength(3);
    expect(searchMatchSet).toBeNull();
  });

  it("filters out a deselected node type", () => {
    const { snapshot: out } = applyFilters(
      snapshot,
      state({ activeTypes: { ...DEFAULT_TYPE_TOGGLES, tag: false } }),
    );
    expect(out.nodes.some((n) => n.type === "tag")).toBe(false);
    // tag-kind links dangle once the tag node is gone
    expect(out.links.every((l) => l.kind !== "tag")).toBe(true);
  });

  it("search keeps matches and expands one hop", () => {
    const { snapshot: out, searchMatchSet } = applyFilters(
      snapshot,
      state({ search: "alpha" }),
    );
    expect(searchMatchSet).toEqual(new Set(["n-a"]));
    const ids = out.nodes.map((n) => n.id).sort();
    // n-a matched; n-b and tag:x are 1-hop neighbors
    expect(ids).toEqual(["n-a", "n-b", tagNodeId("x")].sort());
  });

  it("tag filter keeps only entities carrying that tag", () => {
    const { snapshot: out } = applyFilters(
      snapshot,
      state({ activeTags: new Set([tagNodeId("x")]) }),
    );
    const ids = out.nodes.map((n) => n.id).sort();
    expect(ids).toEqual(["n-a", "n-b", tagNodeId("x")].sort());
  });

  it("hides orphans when showOrphans is false", () => {
    const { snapshot: out } = applyFilters(
      snapshot,
      state({ showOrphans: false }),
    );
    expect(out.nodes.some((n) => n.id === "n-c")).toBe(false);
    expect(out.nodes.some((n) => n.id === "d-1")).toBe(false);
  });

  it("local graph limits to n-hop neighborhood", () => {
    const { snapshot: out } = applyFilters(
      snapshot,
      state({ localFocusId: "n-a", localDepth: 1 }),
    );
    const ids = out.nodes.map((n) => n.id).sort();
    expect(ids).toEqual(["n-a", "n-b", tagNodeId("x")].sort());
  });
});

describe("isFilterActive / activeFilterCount", () => {
  it("default state is inactive with zero count", () => {
    expect(isFilterActive(state())).toBe(false);
    expect(activeFilterCount(state())).toBe(0);
  });

  it("counts each independent active dimension", () => {
    const s = state({
      search: "x",
      activeTags: new Set([tagNodeId("x")]),
      showOrphans: false,
    });
    expect(isFilterActive(s)).toBe(true);
    expect(activeFilterCount(s)).toBe(3);
  });
});
