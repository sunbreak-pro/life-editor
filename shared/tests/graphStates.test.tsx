import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GraphStates } from "../src/components/Connect/GraphStates";
import type { ConnectGraphLabels } from "../src/components/Connect/labels";

/*
 * GraphStates renders the three "no graph to show" overlays. The interesting
 * logic is the nomatch branch: a query-specific message (with {{query}}
 * interpolated) when a search is active, and the generic filter message
 * otherwise. Everything else is straight copy pass-through.
 */
const labels = {
  graphLoading: "Preparing…",
  emptyTitle: "No connections yet",
  emptyHint: "Add tags or links.",
  noMatch: "No nodes match the current filters",
  noMatchQuery: 'Nothing matches "{{query}}"',
  clearFilters: "Clear filters",
} as unknown as ConnectGraphLabels;

describe("GraphStates", () => {
  it("shows the loading copy for the loading state", () => {
    render(<GraphStates state="loading" labels={labels} />);
    expect(screen.getByText("Preparing…")).toBeTruthy();
  });

  it("shows title + hint for the empty state", () => {
    render(<GraphStates state="empty" labels={labels} />);
    expect(screen.getByText("No connections yet")).toBeTruthy();
    expect(screen.getByText("Add tags or links.")).toBeTruthy();
  });

  it("interpolates the query into the nomatch message when a search is active", () => {
    render(<GraphStates state="nomatch" labels={labels} query="supabase" />);
    expect(screen.getByText('Nothing matches "supabase"')).toBeTruthy();
  });

  it("falls back to the generic message when no query is active", () => {
    render(<GraphStates state="nomatch" labels={labels} query="  " />);
    expect(screen.getByText("No nodes match the current filters")).toBeTruthy();
  });

  it("fires onClear from the nomatch clear button", () => {
    const onClear = vi.fn();
    render(<GraphStates state="nomatch" labels={labels} onClear={onClear} />);
    fireEvent.click(screen.getByText("Clear filters"));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
