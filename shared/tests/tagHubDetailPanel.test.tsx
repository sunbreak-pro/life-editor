import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
} from "@testing-library/react";
import {
  selectRecentTaggedItems,
  TagHubDetailPanel,
  UNTAGGED_TAG_ID,
  type TagHubDetailLabels,
  type TagHubGroup,
  type TagHubItem,
  type TagHubTagSummary,
} from "../src/components";
import type { WikiTagAssignment } from "../src/types/wikiTagUnified";

/*
 * The hub's detail-panel face (#1472): the derivation that picks "recently
 * filed" rows, and the panel that draws the tag's breakdown + those rows.
 *
 * Both take their data as props, so the web host's wiring (which tag, which
 * groups, that the panel actually lands in the shared right panel) is pinned
 * in web/tests/connectScreen.test.tsx, not here.
 */

const LABELS: TagHubDetailLabels = {
  breakdownHeading: "By kind",
  recentHeading: "Recently tagged",
  recentUntaggedHeading: "Recently updated",
  recentEmpty: "Nothing is filed under this tag yet.",
  roles: {
    task: "Todo",
    event: "Event",
    note: "Note",
    table: "Table",
    daily: "Daily",
    unknown: "Other",
  },
};

const item = (
  id: string,
  role: TagHubItem["role"],
  title: string,
  updatedAt?: string,
): TagHubItem => ({ id, role, title, updatedAt });

const assign = (
  itemId: string,
  tagId: string,
  updatedAt: string,
  isDeleted = false,
): WikiTagAssignment => ({
  id: `a-${itemId}-${tagId}-${updatedAt}`,
  itemId,
  tagId,
  // #1580 / migration 0030 — see wikiTagUnified.ts.
  createdAt: updatedAt,
  isDisplayColor: false,
  updatedAt,
  isDeleted,
  deletedAt: isDeleted ? updatedAt : null,
});

const GROUPS: readonly TagHubGroup[] = [
  {
    role: "task",
    items: [
      item("task-1", "task", "Draft the PR", "2026-09-01T00:00:00Z"),
      item("task-2", "task", "Review", "2026-08-01T00:00:00Z"),
    ],
  },
  {
    role: "note",
    items: [item("note-1", "note", "Migration notes", "2026-08-15T00:00:00Z")],
  },
];

const WORK: TagHubTagSummary = {
  id: "t-work",
  name: "Work",
  color: null,
  icon: null,
  count: 3,
  isUntagged: false,
};

const formatCount = (n: number) => `${n} items`;

describe("selectRecentTaggedItems", () => {
  it("orders by when the tag was attached, not by the item's own change date", () => {
    // task-1 is the most recently EDITED item but the oldest assignment.
    const rows = selectRecentTaggedItems({
      tagId: "t-work",
      groups: GROUPS,
      assignments: [
        assign("task-1", "t-work", "2026-07-01T00:00:00Z"),
        assign("note-1", "t-work", "2026-09-02T00:00:00Z"),
        assign("task-2", "t-work", "2026-08-20T00:00:00Z"),
      ],
    });
    expect(rows.map((r) => r.id)).toEqual(["note-1", "task-2", "task-1"]);
  });

  it("ignores other tags, soft-deleted rows, and items the hub does not list", () => {
    const rows = selectRecentTaggedItems({
      tagId: "t-work",
      groups: GROUPS,
      assignments: [
        assign("task-1", "t-work", "2026-09-01T00:00:00Z"),
        assign("note-1", "t-other", "2026-09-05T00:00:00Z"),
        assign("task-2", "t-work", "2026-09-04T00:00:00Z", true),
        // A routine, or a trashed row — nothing in the groups carries this id.
        assign("routine-9", "t-work", "2026-09-06T00:00:00Z"),
      ],
    });
    expect(rows.map((r) => r.id)).toEqual(["task-1"]);
  });

  it("lists each item once even when the tag was removed and re-added", () => {
    const rows = selectRecentTaggedItems({
      tagId: "t-work",
      groups: GROUPS,
      assignments: [
        assign("task-1", "t-work", "2026-06-01T00:00:00Z"),
        assign("task-1", "t-work", "2026-09-01T00:00:00Z"),
        assign("note-1", "t-work", "2026-08-01T00:00:00Z"),
      ],
    });
    expect(rows.map((r) => r.id)).toEqual(["task-1", "note-1"]);
  });

  it("caps the list", () => {
    const rows = selectRecentTaggedItems({
      tagId: "t-work",
      groups: GROUPS,
      limit: 2,
      assignments: [
        assign("task-1", "t-work", "2026-09-01T00:00:00Z"),
        assign("task-2", "t-work", "2026-08-01T00:00:00Z"),
        assign("note-1", "t-work", "2026-07-01T00:00:00Z"),
      ],
    });
    expect(rows).toHaveLength(2);
  });

  it("falls back to the item's own change date for the untagged bucket", () => {
    const rows = selectRecentTaggedItems({
      tagId: UNTAGGED_TAG_ID,
      groups: GROUPS,
      // Assignments are irrelevant here: an untagged item has none.
      assignments: [assign("task-2", "t-work", "2026-09-09T00:00:00Z")],
    });
    expect(rows.map((r) => r.id)).toEqual(["task-1", "note-1", "task-2"]);
  });
});

describe("TagHubDetailPanel", () => {
  beforeEach(cleanup);

  const renderBreakdown = (groups: readonly TagHubGroup[]) => {
    const view = render(
      <TagHubDetailPanel
        tag={WORK}
        groups={groups}
        recent={[]}
        onOpenItem={vi.fn()}
        formatCount={formatCount}
        labels={LABELS}
      />,
    );
    const region = within(screen.getByRole("region", { name: "By kind" }));
    return {
      rows: region.getAllByRole("listitem").map((li) => li.textContent),
      // The fill inside each kind's track, by kind, as the width it was given.
      widths: Object.fromEntries(
        Array.from(
          view.container.querySelectorAll<HTMLElement>("[data-kind-bar]"),
        ).map((bar) => [
          bar.dataset.kindBar,
          (bar.firstElementChild as HTMLElement).style.width,
        ]),
      ),
    };
  };

  it("leaves the tag's name and total to the main pane (#2409)", () => {
    renderBreakdown(GROUPS);
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
    expect(screen.queryByText("3 items")).toBeNull();
  });

  it("draws the four kinds as bars, the empty kinds too (#2409)", () => {
    const { rows, widths } = renderBreakdown(GROUPS);
    expect(rows).toEqual([
      "Todo2 items",
      "Event0 items",
      "Note1 items",
      "Daily0 items",
    ]);
    // The longest bar is the largest count, and the rest scale from it.
    expect(widths).toEqual({
      task: "100%",
      event: "0%",
      note: "50%",
      daily: "0%",
    });
  });

  it("keeps all four bars at zero for a tag holding nothing (#2409)", () => {
    const { rows, widths } = renderBreakdown([]);
    expect(rows).toHaveLength(4);
    // A divide by the zero maximum would leave `NaN%`, which the DOM drops.
    expect(widths).toEqual({
      task: "0%",
      event: "0%",
      note: "0%",
      daily: "0%",
    });
  });

  it("adds a bar for note tables only when the tag holds one (#2409)", () => {
    const { rows, widths } = renderBreakdown([
      {
        role: "note",
        items: [item("note-1", "note", "Migration notes")],
      },
      {
        role: "table",
        items: [
          item("table-1", "table", "Budget"),
          item("table-2", "table", "Rota"),
        ],
      },
    ]);
    expect(rows).toEqual([
      "Todo0 items",
      "Event0 items",
      "Note1 items",
      "Table2 items",
      "Daily0 items",
    ]);
    expect(widths.table).toBe("100%");
    expect(widths.note).toBe("50%");
  });

  it("lists the recent rows and routes a click to the host", () => {
    const onOpenItem = vi.fn();
    const recent = [
      { ...GROUPS[1].items[0] },
      {
        id: "event-1",
        role: "event" as const,
        title: "Standup",
        detail: "2026-09-05",
        date: "2026-09-05",
      },
    ];
    render(
      <TagHubDetailPanel
        tag={WORK}
        groups={GROUPS}
        recent={recent}
        onOpenItem={onOpenItem}
        formatCount={formatCount}
        labels={LABELS}
      />,
    );
    const section = within(
      screen.getByRole("region", { name: "Recently tagged" }),
    );
    // The kind survives the compact chip as the glyph's accessible name.
    expect(section.getByRole("img", { name: "Event" })).toBeTruthy();
    fireEvent.click(section.getByRole("button", { name: /Standup/ }));
    expect(onOpenItem).toHaveBeenCalledWith(recent[1]);
  });

  it("says so when the tag holds nothing", () => {
    render(
      <TagHubDetailPanel
        tag={{ ...WORK, count: 0 }}
        groups={[]}
        recent={[]}
        onOpenItem={vi.fn()}
        formatCount={formatCount}
        labels={LABELS}
      />,
    );
    expect(
      screen.getByText("Nothing is filed under this tag yet."),
    ).toBeTruthy();
  });

  it("titles the untagged bucket's list by change date, not by tagging", () => {
    render(
      <TagHubDetailPanel
        tag={{
          id: UNTAGGED_TAG_ID,
          name: "Untagged",
          color: null,
          icon: null,
          count: 1,
          isUntagged: true,
        }}
        groups={[GROUPS[1]]}
        recent={[GROUPS[1].items[0]]}
        onOpenItem={vi.fn()}
        formatCount={formatCount}
        labels={LABELS}
      />,
    );
    expect(
      screen.getByRole("region", { name: "Recently updated" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("region", { name: "Recently tagged" }),
    ).toBeNull();
  });
});
