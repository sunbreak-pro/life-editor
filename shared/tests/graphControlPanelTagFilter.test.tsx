import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GraphControlPanel } from "../src/components/Connect/GraphControlPanel";
import { DEFAULT_FILTER_STATE } from "../src/components/Connect/graph/graph-filters";
import { DEFAULT_FORCES } from "../src/components/Connect/graph/useGraphSimulation";
import { tagNodeId } from "../src/components/Connect/graph/graph-types";
import type { ConnectGraphLabels } from "../src/components/Connect/labels";
import type { WikiTag } from "../src/types/wikiTagUnified";

/*
 * Connect tag pill filter (#519 — the #368 narrowing carried over to the graph
 * settings panel). The panel listed every tag with no way to narrow it, so a
 * few dozen tags became a wall of pills.
 *
 * The subtle part is that this panel already HAS a search box, one section up,
 * which searches graph NODES. These tests pin that the two stay distinct and,
 * more importantly, that narrowing the pill list never touches which tags are
 * ACTIVE — a filtered-out tag must keep filtering the graph.
 */

const LABELS = {
  search: "Search nodes...",
  nodeTypes: "Node Types",
  tags: "Tags",
  tagFilterPlaceholder: "Filter tags…",
  tagFilterLabel: "Filter tags by name",
  tagFilterEmpty: "No tags match",
  clearFilters: "Clear filters",
  clearSearch: "Clear search",
  localGraph: "Local Graph",
  display: "Display",
  forces: "Forces",
  depth: "Depth",
  off: "off",
  showOrphans: "Show orphans",
  showLabels: "Show labels",
  repel: "Repel",
  linkDistance: "Link distance",
  center: "Center",
  collide: "Collide",
  selectNodeHint: "Select a node",
  typeNote: "Note",
  typeDaily: "Daily",
  typeTag: "Tag",
  hintKeys: "Esc clear",
} as unknown as ConnectGraphLabels;

const TAGS: WikiTag[] = [
  { id: "t1", name: "project" },
  { id: "t2", name: "Projection" },
  { id: "t3", name: "recipe" },
] as unknown as WikiTag[];

function setup(over: Partial<Parameters<typeof GraphControlPanel>[0]> = {}) {
  const onToggleTag = vi.fn();
  render(
    <GraphControlPanel
      labels={LABELS}
      filter={DEFAULT_FILTER_STATE}
      onSearchChange={vi.fn()}
      onToggleType={vi.fn()}
      onToggleTag={onToggleTag}
      onClearTags={vi.fn()}
      onLocalDepthChange={vi.fn()}
      showLabels
      onShowLabelsChange={vi.fn()}
      onShowOrphansChange={vi.fn()}
      forces={DEFAULT_FORCES}
      onForcesChange={vi.fn()}
      tags={TAGS}
      typeCounts={{}}
      totalTypeCounts={{}}
      selectedLabel={null}
      {...over}
    />,
  );
  // queryBy, not getBy: the empty-tag case asserts the field is ABSENT, so
  // resolving it eagerly would fail the helper before the test can look.
  return {
    get field() {
      const el = screen.queryByLabelText("Filter tags by name");
      if (!el) throw new Error("tag filter field is not rendered");
      return el;
    },
    onToggleTag,
  };
}

describe("GraphControlPanel — tag pill filter", () => {
  it("narrows the pills by case-insensitive substring", () => {
    const { field } = setup();
    expect(screen.getByText("#project")).toBeTruthy();
    expect(screen.getByText("#recipe")).toBeTruthy();

    fireEvent.change(field, { target: { value: "pro" } });

    // "Projection" matches too — the needle is lower-cased on both sides.
    expect(screen.getByText("#project")).toBeTruthy();
    expect(screen.getByText("#Projection")).toBeTruthy();
    expect(screen.queryByText("#recipe")).toBeNull();
  });

  it("restores every pill when the query is cleared", () => {
    const { field } = setup();
    fireEvent.change(field, { target: { value: "recipe" } });
    expect(screen.queryByText("#project")).toBeNull();

    fireEvent.change(field, { target: { value: "" } });
    expect(screen.getByText("#project")).toBeTruthy();
    expect(screen.getByText("#Projection")).toBeTruthy();
    expect(screen.getByText("#recipe")).toBeTruthy();
  });

  it("ignores surrounding whitespace rather than matching nothing", () => {
    const { field } = setup();
    fireEvent.change(field, { target: { value: "  recipe  " } });
    expect(screen.getByText("#recipe")).toBeTruthy();
  });

  it("says so when nothing matches, instead of leaving a blank gap", () => {
    const { field } = setup();
    fireEvent.change(field, { target: { value: "zzz" } });

    expect(screen.getByText("No tags match")).toBeTruthy();
    expect(screen.queryByText("#project")).toBeNull();
  });

  it("keeps a filtered-out tag ACTIVE — narrowing the list is not deselecting", () => {
    const active = tagNodeId("t3");
    const { field } = setup({
      filter: { ...DEFAULT_FILTER_STATE, activeTags: new Set([active]) },
    });
    // The count badge reads "selected/total" off the full tag set...
    expect(screen.getByText("1/3")).toBeTruthy();

    fireEvent.change(field, { target: { value: "project" } });

    // ...and stays that way while #recipe is merely off-screen. If this ever
    // reads 1/1 or 0/1, the filter has started editing the graph's selection.
    expect(screen.queryByText("#recipe")).toBeNull();
    expect(screen.getByText("1/3")).toBeTruthy();
  });

  it("does not label its filter like the node search one section above", () => {
    setup();
    const nodeSearch = screen.getByPlaceholderText("Search nodes...");
    const tagFilter = screen.getByPlaceholderText("Filter tags…");
    expect(nodeSearch).not.toBe(tagFilter);
  });

  it("hides the filter entirely when there are no tags to narrow", () => {
    setup({ tags: [] });
    expect(screen.queryByLabelText("Filter tags by name")).toBeNull();
    // ...and shows no "nothing matched" copy either — there is nothing to match.
    expect(screen.queryByText("No tags match")).toBeNull();
  });
});
