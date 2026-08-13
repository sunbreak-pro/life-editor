import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { KanbanBoard } from "../src/components";
import type { KanbanColumnModel, KanbanLabels } from "../src/components";

/*
 * #565 — the tag view lays its columns out on a fixed 3-track grid instead of
 * the old fixed-316px + max-w-[980px] + flex-wrap strip, which only fit 3
 * columns where the section was ≥980px wide (Schedule → Todo is narrower, so it
 * wrapped at 2 and left a wide gutter).
 *
 * jsdom has NO layout (every box measures 0), so widths cannot be asserted
 * here. These tests pin the STRUCTURE that produces them — the grid definition
 * on the list, the per-column width mode, and the header's truncate — plus the
 * invariant that the status view's strip is untouched.
 */

const LABELS: KanbanLabels = {
  viewStatus: "By status",
  viewTag: "By tag",
  segmentedGroupLabel: "Switch view",
  statusNotStarted: "Not started",
  statusInProgress: "In progress",
  statusDone: "Done",
  cardAriaLabel: (title, statusText) => `${title} — ${statusText}`,
  emptyColumn: "No todos here yet",
  placeholderHint: "Coming soon",
  countAriaLabel: (n) => `${n} todos`,
  untagged: "No tag",
  colorPickerLabel: "Change color",
  colorClearLabel: "Default",
  colorCustomLabel: "Custom",
};

function makeColumns(titles: string[]): KanbanColumnModel[] {
  return titles.map((title, i) => ({
    id: `tag-${i}`,
    title,
    cards: [],
  }));
}

const FIVE_TAGS = makeColumns(["work", "home", "study", "health", "errands"]);

describe("KanbanBoard layout (#565)", () => {
  it("lays the tag view out on a fixed 3-track grid, not a capped flex row", () => {
    render(
      <KanbanBoard
        columns={FIVE_TAGS}
        labels={LABELS}
        viewMode="tag"
        onSelectCard={() => {}}
      />,
    );
    const list = screen.getByRole("list");
    // 3 tracks that share the host's width but stop shrinking at 220px — the
    // narrowest a column can be without clipping its header ColorPicker panel.
    expect(list).toHaveClass(
      "grid",
      "w-full",
      "[grid-template-columns:repeat(3,minmax(220px,1fr))]",
    );
    // The old cap is what pinned the row to 2 columns on a narrow host.
    expect(list.className).not.toContain("max-w-[980px]");
    expect(list.className).not.toContain("flex-wrap");
    // Every tag column is present (a 4th+ wraps onto the next grid row).
    expect(screen.getAllByRole("listitem")).toHaveLength(FIVE_TAGS.length);
  });

  it("makes tag columns fill their grid track instead of the fixed 316px strip", () => {
    render(
      <KanbanBoard
        columns={FIVE_TAGS}
        labels={LABELS}
        viewMode="tag"
        onSelectCard={() => {}}
      />,
    );
    for (const column of screen.getAllByRole("listitem")) {
      // min-w-0 is inert while the column also carries overflow-hidden (which
      // already cancels a grid item's automatic minimum size); it is pinned as
      // the guard for a future removal of overflow-hidden.
      expect(column).toHaveClass("w-full", "min-w-0");
      expect(column.className).not.toContain("w-[316px]");
    }
  });

  it("lets the tag board scroll sideways once the 220px floor is hit", () => {
    render(
      <KanbanBoard
        columns={FIVE_TAGS}
        labels={LABELS}
        viewMode="tag"
        onSelectCard={() => {}}
      />,
    );
    // The scroll container is the list's parent: on a host narrower than
    // 3×220px the tracks overflow and must be reachable, not clipped.
    const scroller = screen.getByRole("list").parentElement;
    expect(scroller).toHaveClass("overflow-auto");
  });

  it("keeps the header title truncating so a long tag name cannot widen a column", () => {
    const long = "a-very-long-tag-name-that-would-otherwise-stretch-the-column";
    render(
      <KanbanBoard
        columns={makeColumns([long, "home", "study"])}
        labels={LABELS}
        viewMode="tag"
        onSelectCard={() => {}}
      />,
    );
    const title = screen.getByText(long);
    expect(title).toHaveClass("truncate", "min-w-0");
  });

  it("leaves the status view on the fixed-width horizontal strip", () => {
    render(
      <KanbanBoard
        columns={makeColumns(["Not started", "In progress", "Done"])}
        labels={LABELS}
        viewMode="status"
        onSelectCard={() => {}}
      />,
    );
    const list = screen.getByRole("list");
    expect(list).toHaveClass("flex", "w-fit");
    expect(list.className).not.toContain("grid-template-columns");
    for (const column of screen.getAllByRole("listitem")) {
      expect(column).toHaveClass("w-[316px]", "shrink-0");
    }
  });

  it("tells a custom column renderer which width mode the active view uses", () => {
    const seen: Array<{ id: string; fluidWidth: boolean }> = [];
    const renderColumn = ({
      column,
      fluidWidth,
    }: {
      column: KanbanColumnModel;
      showTags: boolean;
      fluidWidth: boolean;
    }): React.ReactNode => {
      seen.push({ id: column.id, fluidWidth });
      return <div>{column.title}</div>;
    };

    const { rerender } = render(
      <KanbanBoard
        columns={FIVE_TAGS}
        labels={LABELS}
        viewMode="tag"
        onSelectCard={() => {}}
        renderColumn={renderColumn}
      />,
    );
    expect(seen.every((s) => s.fluidWidth)).toBe(true);

    seen.length = 0;
    rerender(
      <KanbanBoard
        columns={FIVE_TAGS}
        labels={LABELS}
        viewMode="status"
        onSelectCard={() => {}}
        renderColumn={renderColumn}
      />,
    );
    expect(seen.every((s) => s.fluidWidth)).toBe(false);
  });
});
