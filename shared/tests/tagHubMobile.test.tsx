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
  type TagHubItem,
} from "../src/components";
import type { WikiTag, WikiTagAssignment } from "../src/types/wikiTagUnified";
import {
  TAG_HUB_LABELS as LABELS,
  formatCount,
  formatUnusedTags,
} from "./tagHubLabels";

/*
 * The narrow layout's three steps (#1646 / M1–M8).
 *
 * jsdom has no layout (CLAUDE.md §7.1), so the 44px floors are pinned as the
 * CLASS contract that produces them — the same way #1561's suite does — and
 * the sheets are pinned by their accessible names, which is what a phone user
 * is actually told.
 */

const tag = (id: string, name: string): WikiTag => ({
  id,
  name,
  color: null,
  icon: null,
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-01T00:00:00Z",
  isDeleted: false,
  deletedAt: null,
});

const assign = (itemId: string, tagId: string): WikiTagAssignment => ({
  id: `a-${itemId}`,
  itemId,
  tagId,
  createdAt: "2026-09-01T00:00:00Z",
  isDisplayColor: false,
  updatedAt: "2026-09-01T00:00:00Z",
  isDeleted: false,
  deletedAt: null,
});

const ITEMS: TagHubItem[] = [
  { id: "task-1", role: "task", title: "Draft the PR" },
  { id: "note-1", role: "note", title: "Migration notes" },
];

function renderNarrow(over: Record<string, unknown> = {}, empty = false) {
  const spies = {
    onEditTag: vi.fn(),
    onDeleteTag: vi.fn(),
    onItemMenu: vi.fn(),
  };
  const model = buildTagHubModel({
    tags: empty ? [] : [tag("t-work", "Work")],
    assignments: empty ? [] : [assign("task-1", "t-work")],
    items: empty ? [] : ITEMS,
    untaggedName: "Untagged",
  });
  render(
    <TagHubView
      model={model}
      selectedTagId={null}
      onSelectTag={vi.fn()}
      query=""
      onQueryChange={vi.fn()}
      onOpenItem={vi.fn()}
      formatCount={formatCount}
      formatUnusedTags={formatUnusedTags}
      wide={false}
      isLoading={false}
      labels={LABELS}
      onToggleEdit={vi.fn()}
      onEditChange={vi.fn()}
      formatItemMenu={(title) => `${title}: Item actions`}
      {...spies}
      {...over}
    />,
  );
  return spies;
}

beforeEach(cleanup);

describe("TagHub narrow — the tag list (M1 / M2)", () => {
  it("opens the row's actions as a sheet, not a dropdown", () => {
    renderNarrow();
    fireEvent.click(screen.getByRole("button", { name: "Work: Tag actions" }));

    const sheet = screen.getByRole("dialog", { name: "Work: Tag actions" });
    expect(sheet.getAttribute("aria-modal")).toBe("true");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(
      within(sheet)
        .getAllByRole("button")
        .map((b) => b.textContent)
        .filter((text) => text),
    ).toEqual(["Rename", "Change the icon", "Change the color", "Delete tag"]);
  });

  it("reports the picked action and closes behind it", () => {
    const { onEditTag } = renderNarrow();
    fireEvent.click(screen.getByRole("button", { name: "Work: Tag actions" }));
    fireEvent.click(screen.getByRole("button", { name: "Change the color" }));

    expect(onEditTag).toHaveBeenCalledWith("t-work", "color");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("offers no merge on the phone", () => {
    renderNarrow({ onMergeTag: vi.fn() });
    fireEvent.click(screen.getByRole("button", { name: "Work: Tag actions" }));

    expect(
      screen.queryByRole("button", { name: "Merge into another tag…" }),
    ).toBeNull();
  });

  it("keeps the tag rows and the “…” at the 44px floor", () => {
    renderNarrow();
    const row = screen.getByRole("button", { name: "Work: 1 items" });
    expect(row).toHaveClass("min-h-11");
    expect(
      screen.getByRole("button", { name: "Work: Tag actions" }),
    ).toHaveClass("h-11");
  });
});

describe("TagHub narrow — a tag's items (M3)", () => {
  it("gives each row its own 44px actions button", () => {
    const { onItemMenu } = renderNarrow({ selectedTagId: "t-work" });
    const menu = screen.getByRole("button", {
      name: "Draft the PR: Item actions",
    });
    expect(menu).toHaveClass("size-11");

    fireEvent.click(menu);
    expect(onItemMenu).toHaveBeenCalledWith(
      expect.objectContaining({ id: "task-1" }),
    );
  });
});

describe("TagHub narrow — empty and loading (M6 / M7)", () => {
  it("says there is nothing yet, without a filter box", () => {
    renderNarrow({}, true);
    screen.getByText("No tags or items yet.");
    expect(screen.queryByLabelText("Filter tags by name")).toBeNull();
  });

  it("announces the wait while the reads are in flight", () => {
    renderNarrow({ isLoading: true });
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-busy")).toBe("true");
    expect(status.getAttribute("aria-label")).toBe("Loading tags");
    expect(screen.queryByRole("list", { name: "Tags" })).toBeNull();
  });
});
