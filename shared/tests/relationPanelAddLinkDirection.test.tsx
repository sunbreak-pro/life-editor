import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  within,
} from "@testing-library/react";
import {
  RelationPanel,
  type RelationPanelLabels,
  type TagHubItem,
} from "../src/components";
import { TAG_HUB_LABELS } from "./tagHubLabels";

/*
 * #1846 — the narrow host shows RelationPanel in a bottom sheet whose body now
 * scrolls. A scroller clips what overflows its TOP for good, so the add-link
 * chooser opens downward. #2602 moved the button under the links, near the
 * top of the Desktop sidebar too, so downward became the default there as
 * well. jsdom has no layout: the placement classes are what is pinned.
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

interface PanelOptions {
  addLinkOpensDown?: boolean;
  linked?: TagHubItem[];
  sharedTagItems?: TagHubItem[];
}

function renderPanel({
  addLinkOpensDown,
  linked = [],
  sharedTagItems = [],
}: PanelOptions = {}) {
  const handlers = {
    onBack: vi.fn(),
    onOpenItem: vi.fn(),
    onRemoveLink: vi.fn(),
    onAddLink: vi.fn(),
  };
  const { container } = render(
    <RelationPanel
      item={ITEM}
      linked={linked.map((item) => ({ item, linkIds: [`link-${item.id}`] }))}
      sharedTagItems={sharedTagItems}
      sameDayDaily={null}
      candidates={[{ id: "note-2", role: "note", title: "Other" }]}
      {...handlers}
      addLinkOpensDown={addLinkOpensDown}
      labels={LABELS}
    />,
  );
  return { container, ...handlers };
}

function openChooser() {
  fireEvent.click(screen.getByRole("button", { name: "Add a link" }));
  return screen.getByRole("dialog", { name: "Link to an item" });
}

beforeEach(cleanup);

describe("RelationPanel — where the add-link chooser opens (#1846 / #2602)", () => {
  it("opens downward by default", () => {
    renderPanel();
    const dialog = openChooser();
    expect(dialog).toHaveClass("top-full");
    expect(dialog).not.toHaveClass("bottom-full");
  });

  it("opens downward inside the phone's sheet", () => {
    renderPanel({ addLinkOpensDown: true });
    const dialog = openChooser();
    expect(dialog).toHaveClass("top-full");
    expect(dialog).not.toHaveClass("bottom-full");
  });

  it("still opens upward when a host asks for it", () => {
    renderPanel({ addLinkOpensDown: false });
    const dialog = openChooser();
    expect(dialog).toHaveClass("bottom-full");
    expect(dialog).not.toHaveClass("top-full");
  });
});

/*
 * #2602 — the prototype's order: kind and title, links, items sharing a tag,
 * that day's daily, then "open" and "back" at the bottom. Document order is
 * what a screen reader and the Tab key follow, so that is what is pinned.
 */
describe("RelationPanel — order and headings (#2602)", () => {
  const precedes = (a: Element, b: Element): boolean =>
    Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

  it("runs kind, title, the three sections, then open and back", () => {
    renderPanel();
    const kind = screen.getByText(TAG_HUB_LABELS.roles.note);
    const title = screen.getByRole("heading", { name: "Plan" });
    const links = screen.getByRole("region", { name: "Links (0)" });
    const shared = screen.getByRole("region", { name: "Shared tags (0)" });
    const daily = screen.getByRole("region", { name: "Same day (0)" });
    const open = screen.getByRole("button", { name: "Open" });
    const back = screen.getByRole("button", { name: "Back" });

    const order = [kind, title, links, shared, daily, open, back];
    for (let i = 1; i < order.length; i++) {
      expect(precedes(order[i - 1], order[i])).toBe(true);
    }
  });

  it("heads each section with its name alone, keeping the count in the region's name", () => {
    renderPanel({
      sharedTagItems: [
        { id: "task-1", role: "task", title: "Draft" },
        { id: "event-1", role: "event", title: "Standup" },
      ],
    });

    const shared = screen.getByRole("region", { name: "Shared tags (2)" });
    within(shared).getByRole("heading", { name: "Shared tags" });
    expect(screen.queryByRole("heading", { name: /\(\d+\)/ })).toBeNull();
  });

  it("marks each row sharing a tag with its kind", () => {
    renderPanel({
      sharedTagItems: [
        { id: "task-1", role: "task", title: "Draft" },
        { id: "event-1", role: "event", title: "Standup" },
      ],
    });

    const shared = screen.getByRole("region", { name: "Shared tags (2)" });
    within(shared).getByRole("img", { name: TAG_HUB_LABELS.roles.task });
    within(shared).getByRole("img", { name: TAG_HUB_LABELS.roles.event });
  });

  it("says nothing is there for an empty section", () => {
    renderPanel();
    const daily = screen.getByRole("region", { name: "Same day (0)" });
    within(daily).getByText("Nothing");
  });

  it("puts the add-link button inside the links section, under its rows", () => {
    renderPanel({ linked: [{ id: "note-3", role: "note", title: "Spec" }] });

    const links = screen.getByRole("region", { name: "Links (1)" });
    // The row's name is its kind glyph's label, then the title.
    const row = within(links).getByRole("button", { name: "Note Spec" });
    const add = within(links).getByRole("button", { name: "Add a link" });
    expect(precedes(row, add)).toBe(true);
  });

  it("keeps adding and removing a link working", () => {
    const { onAddLink, onRemoveLink } = renderPanel({
      linked: [{ id: "note-3", role: "note", title: "Spec" }],
    });

    fireEvent.click(screen.getByRole("button", { name: "Remove Spec" }));
    expect(onRemoveLink).toHaveBeenCalledWith(["link-note-3"]);

    const dialog = openChooser();
    fireEvent.click(within(dialog).getByRole("button", { name: /Other/ }));
    expect(onAddLink).toHaveBeenCalledWith({
      id: "note-2",
      role: "note",
      title: "Other",
    });
  });

  it("opens the item and goes back from the bottom row", () => {
    const { onOpenItem, onBack } = renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(onOpenItem).toHaveBeenCalledWith(ITEM);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
