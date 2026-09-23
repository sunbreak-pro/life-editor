import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import {
  RelationPanel,
  type RelationPanelLabels,
  type TagHubItem,
} from "../src/components";
import { TAG_HUB_LABELS } from "./tagHubLabels";

/*
 * #1846 — the narrow host shows RelationPanel in a bottom sheet whose body now
 * scrolls. A scroller clips what overflows its TOP for good, so the add-link
 * chooser, which opens upward in the Desktop sidebar, opens downward there.
 * jsdom has no layout: the placement classes are what is pinned.
 */

const LABELS: RelationPanelLabels = {
  back: "Back",
  openItem: "Open",
  links: "Links",
  sharedTags: "Shared tags",
  sameDayDaily: "Same day",
  formatSection: (label, count) => `${label} (${count})`,
  sectionEmpty: "Nothing",
  formatRemoveLink: (title) => `Remove ${title}`,
  addLink: "Add a link",
  addLinkDialog: "Link to an item",
  searchPlaceholder: "Search",
  candidates: "Candidates",
  noCandidates: "No candidates",
  roles: TAG_HUB_LABELS.roles,
};

const ITEM: TagHubItem = { id: "note-1", role: "note", title: "Plan" };

function renderPanel(addLinkOpensDown?: boolean) {
  render(
    <RelationPanel
      item={ITEM}
      linked={[]}
      sharedTagItems={[]}
      sameDayDaily={null}
      candidates={[{ id: "note-2", role: "note", title: "Other" }]}
      onBack={vi.fn()}
      onOpenItem={vi.fn()}
      onRemoveLink={vi.fn()}
      onAddLink={vi.fn()}
      addLinkOpensDown={addLinkOpensDown}
      labels={LABELS}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Add a link" }));
  return screen.getByRole("dialog", { name: "Link to an item" });
}

beforeEach(cleanup);

describe("RelationPanel — where the add-link chooser opens (#1846)", () => {
  it("opens upward by default (the Desktop sidebar)", () => {
    const dialog = renderPanel();
    expect(dialog).toHaveClass("bottom-full");
    expect(dialog).not.toHaveClass("top-full");
  });

  it("opens downward inside the phone's sheet", () => {
    const dialog = renderPanel(true);
    expect(dialog).toHaveClass("top-full");
    expect(dialog).not.toHaveClass("bottom-full");
  });
});
