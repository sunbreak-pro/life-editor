import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
} from "@testing-library/react";
import {
  buildTagHubModel,
  TagHubView,
  UNTAGGED_TAG_ID,
  type TagHubItem,
  type TagHubLabels,
} from "../src/components";
import type { WikiTag, WikiTagAssignment } from "../src/types/wikiTagUnified";

/*
 * The tag hub's rendered contract (#1171).
 *
 * Rendered through the real `buildTagHubModel` rather than a hand-written
 * model literal: the two are the halves of one screen, and a fixture model
 * would let the view keep passing while the derivation feeding it drifted.
 *
 * jsdom has no layout, so `wide` is passed explicitly (the host measures it
 * with useMediaQuery) — which is also the only way to exercise the narrow
 * pane-at-a-time branch here at all (CLAUDE.md §7.1).
 */

const LABELS: TagHubLabels = {
  tagsHeading: "Tags",
  filterPlaceholder: "Filter tags…",
  filterLabel: "Filter tags by name",
  listLabel: "Tags",
  empty: "No tags or items yet.",
  filterEmpty: "No matching tag",
  tagEmpty: "Nothing is filed under this tag yet.",
  selectHint: "Pick a tag to see everything filed under it.",
  back: "Back to tags",
  roles: {
    task: "Todo",
    event: "Event",
    note: "Note",
    daily: "Daily",
    unknown: "Other",
  },
};

const tag = (id: string, name: string): WikiTag => ({
  id,
  name,
  color: null,
  icon: null,
  createdAt: "2026-08-01T00:00:00Z",
  updatedAt: "2026-08-01T00:00:00Z",
  version: 1,
  isDeleted: false,
  deletedAt: null,
});

const assign = (itemId: string, tagId: string): WikiTagAssignment => ({
  id: `a-${itemId}-${tagId}`,
  itemId,
  tagId,
  updatedAt: "2026-08-01T00:00:00Z",
  isDeleted: false,
  deletedAt: null,
});

const TAGS = [tag("t-health", "Health"), tag("t-work", "Work")];
const ASSIGNMENTS = [
  assign("task-1", "t-work"),
  assign("event-1", "t-work"),
  assign("note-1", "t-work"),
  assign("daily-2026-08-29", "t-work"),
];
const ITEMS: TagHubItem[] = [
  { id: "task-1", role: "task", title: "Draft the PR" },
  {
    id: "event-1",
    role: "event",
    title: "Standup",
    detail: "2026-08-29",
    date: "2026-08-29",
  },
  { id: "note-1", role: "note", title: "Migration notes" },
  { id: "daily-2026-08-29", role: "daily", title: "2026-08-29" },
  // Carries no assignment — the untagged bucket's only member.
  { id: "note-loose", role: "note", title: "Loose thought" },
];

const MODEL = buildTagHubModel({
  tags: TAGS,
  assignments: ASSIGNMENTS,
  items: ITEMS,
  untaggedName: "Untagged",
});

const formatCount = (count: number) => `${count} items`;

function renderHub(
  over: Partial<React.ComponentProps<typeof TagHubView>> = {},
) {
  const onSelectTag = vi.fn();
  const onOpenItem = vi.fn();
  const onQueryChange = vi.fn();
  render(
    <TagHubView
      model={MODEL}
      selectedTagId={null}
      onSelectTag={onSelectTag}
      query=""
      onQueryChange={onQueryChange}
      onOpenItem={onOpenItem}
      formatCount={formatCount}
      wide
      isLoading={false}
      labels={LABELS}
      {...over}
    />,
  );
  return { onSelectTag, onOpenItem, onQueryChange };
}

beforeEach(cleanup);

describe("TagHubView — the rail", () => {
  it("lists every tag with the untagged bucket last", () => {
    renderHub();
    const rows = within(
      screen.getByRole("list", { name: "Tags" }),
    ).getAllByRole("button");
    expect(rows.map((r) => r.getAttribute("aria-label"))).toEqual([
      "Health: 0 items",
      "Work: 4 items",
      "Untagged: 1 items",
    ]);
  });

  it("reports the picked tag rather than selecting it itself", () => {
    const { onSelectTag } = renderHub();
    fireEvent.click(screen.getByRole("button", { name: "Work: 4 items" }));
    expect(onSelectTag).toHaveBeenCalledWith("t-work");
  });

  it("narrows to the tags matching the filter text", () => {
    renderHub({ query: "wor" });
    const rows = within(
      screen.getByRole("list", { name: "Tags" }),
    ).getAllByRole("button");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveAttribute("aria-label", "Work: 4 items");
  });

  it("says so when the filter matches nothing", () => {
    renderHub({ query: "zzz" });
    expect(screen.getByText("No matching tag")).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Tags" })).toBeNull();
  });

  it("shows the empty copy, and no filter box, when there is nothing at all", () => {
    renderHub({
      model: buildTagHubModel({
        tags: [],
        assignments: [],
        items: [],
        untaggedName: "Untagged",
      }),
    });
    expect(screen.getByText("No tags or items yet.")).toBeTruthy();
    expect(screen.queryByLabelText("Filter tags by name")).toBeNull();
  });
});

describe("TagHubView — the selected tag", () => {
  it("groups the tag's items by kind, each heading naming its count", () => {
    renderHub({ selectedTagId: "t-work" });
    expect(
      screen
        .getAllByRole("heading", { level: 3 })
        .map((h) => h.getAttribute("aria-label")),
    ).toEqual([
      "Todo: 1 items",
      "Event: 1 items",
      "Note: 1 items",
      "Daily: 1 items",
    ]);
  });

  it("hands a clicked row back with its role, and an event with its date", () => {
    const { onOpenItem } = renderHub({ selectedTagId: "t-work" });

    fireEvent.click(screen.getByRole("button", { name: /Draft the PR/ }));
    expect(onOpenItem).toHaveBeenCalledWith(
      expect.objectContaining({ id: "task-1", role: "task" }),
    );

    fireEvent.click(screen.getByRole("button", { name: /Standup/ }));
    // The date travels: the Calendar cannot select a row outside the window it
    // is showing, so a bare id would land on nothing (#503).
    expect(onOpenItem).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: "event-1",
        role: "event",
        date: "2026-08-29",
      }),
    );
  });

  it("reaches the untagged items through their own bucket", () => {
    const { onOpenItem } = renderHub({ selectedTagId: UNTAGGED_TAG_ID });
    fireEvent.click(screen.getByRole("button", { name: /Loose thought/ }));
    expect(onOpenItem).toHaveBeenCalledWith(
      expect.objectContaining({ id: "note-loose", role: "note" }),
    );
  });

  it("prompts for a pick while nothing is selected", () => {
    renderHub();
    expect(
      screen.getByText("Pick a tag to see everything filed under it."),
    ).toBeTruthy();
  });

  it("says the tag is empty rather than showing a blank column", () => {
    renderHub({ selectedTagId: "t-health" });
    expect(
      screen.getByText("Nothing is filed under this tag yet."),
    ).toBeTruthy();
  });

  it("offers no way to put an item on today (#1153 owns that)", () => {
    // The role split with the Calendar sidebar is a decision, not a detail:
    // one entrance for "schedule this", and it is not here.
    renderHub({ selectedTagId: "t-work" });
    expect(screen.queryByText(/today/i)).toBeNull();
  });
});

describe("TagHubView — narrow layout", () => {
  it("shows the tag list alone until a tag is picked", () => {
    renderHub({ wide: false });
    expect(screen.getByRole("list", { name: "Tags" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Back to tags" })).toBeNull();
  });

  it("swaps the list for the items, with a back control that clears it", () => {
    const { onSelectTag } = renderHub({ wide: false, selectedTagId: "t-work" });
    expect(screen.queryByRole("list", { name: "Tags" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Back to tags" }));
    expect(onSelectTag).toHaveBeenCalledWith(null);
  });

  it("keeps both panes up on the wide layout, with no back control", () => {
    renderHub({ wide: true, selectedTagId: "t-work" });
    expect(screen.getByRole("list", { name: "Tags" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Back to tags" })).toBeNull();
  });
});

describe("TagHubView — loading", () => {
  it("draws the skeleton instead of an empty hub before the reads land", () => {
    renderHub({ isLoading: true });
    expect(screen.queryByRole("list", { name: "Tags" })).toBeNull();
    expect(screen.queryByText("No tags or items yet.")).toBeNull();
  });
});
