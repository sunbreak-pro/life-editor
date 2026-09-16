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
} from "../src/components";
import type { WikiTag, WikiTagAssignment } from "../src/types/wikiTagUnified";
import {
  TAG_HUB_LABELS as LABELS,
  formatCount,
  formatUnusedTags,
} from "./tagHubLabels";

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
 *
 * The EDITING half (#1643) is opt-in: every case below that does not name an
 * edit callback renders the hub the way a read-only host would get it, so the
 * two halves cannot be confused for each other.
 */

const tag = (id: string, name: string): WikiTag => ({
  id,
  name,
  color: null,
  icon: null,
  createdAt: "2026-08-01T00:00:00Z",
  updatedAt: "2026-08-01T00:00:00Z",
  isDeleted: false,
  deletedAt: null,
});

const assign = (itemId: string, tagId: string): WikiTagAssignment => ({
  id: `a-${itemId}-${tagId}`,
  itemId,
  tagId,
  // #1580 / migration 0030 — see wikiTagUnified.ts.
  createdAt: "2026-08-01T00:00:00Z",
  isDisplayColor: false,
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
      formatUnusedTags={formatUnusedTags}
      wide
      isLoading={false}
      labels={LABELS}
      {...over}
    />,
  );
  return { onSelectTag, onOpenItem, onQueryChange };
}

/** The tag rows' own buttons — never the "…" beside them (#1643). */
const railRows = (name = "Tags") =>
  within(screen.getByRole("list", { name }))
    .getAllByRole("listitem")
    .map((li) => within(li).getAllByRole("button")[0]);

const railLabels = (name?: string) =>
  railRows(name).map((row) => row.getAttribute("aria-label"));

/**
 * The item rows in the detail pane. Told apart from the rail's by the list they
 * sit in: only the rail's two lists carry an aria-label.
 */
const itemRows = () =>
  screen
    .getAllByRole("listitem")
    .filter(
      (li) =>
        !li.closest('[aria-label="Tags"]') &&
        !li.closest('[aria-label="Unused tags"]'),
    )
    .map((li) => within(li).getByRole("button"));

beforeEach(cleanup);

describe("TagHubView — the rail", () => {
  it("lists the tags holding something, with the untagged bucket last", () => {
    renderHub();
    // Health carries nothing, so it is behind the disclosure rather than
    // filed alphabetically above Work (#1643 / D4).
    expect(railLabels()).toEqual(["Work: 4 items", "Untagged: 1 items"]);
  });

  it("keeps the unused tags one disclosure away, not gone", () => {
    renderHub();
    const toggle = screen.getByRole("button", { name: "Unused tags (1)" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("button", { name: "Health: 0 items" }),
    ).toBeNull();

    fireEvent.click(toggle);
    expect(railLabels("Unused tags")).toEqual(["Health: 0 items"]);
  });

  it("reports the picked tag rather than selecting it itself", () => {
    const { onSelectTag } = renderHub();
    fireEvent.click(screen.getByRole("button", { name: "Work: 4 items" }));
    expect(onSelectTag).toHaveBeenCalledWith("t-work");
  });

  it("narrows to the tags matching the filter text", () => {
    renderHub({ query: "wor" });
    expect(railLabels()).toEqual(["Work: 4 items"]);
  });

  it("says so when the filter matches nothing", () => {
    renderHub({
      query: "zzz",
      model: buildTagHubModel({
        tags: [tag("t-work", "Work")],
        assignments: ASSIGNMENTS,
        items: ITEMS,
        untaggedName: "Untagged",
      }),
    });
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
    expect(screen.getAllByText("No tags or items yet.").length).toBeGreaterThan(
      0,
    );
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
    expect(screen.getByText("Pick a tag.")).toBeTruthy();
  });

  it("opens an unused tag rather than reading as nothing selected", () => {
    // The whole reason to open that disclosure is to edit or delete one, so a
    // row behind it has to resolve to a selection like any other (#1643).
    renderHub({ selectedTagId: "t-health" });
    expect(
      screen.getByRole("heading", { level: 2, name: "Health" }),
    ).toBeTruthy();
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
    // The bars are decorative, so the wait is announced by the frame (D16).
    expect(screen.getAllByRole("status")[0]).toHaveAttribute(
      "aria-label",
      "Loading tags",
    );
  });
});

/*
 * The editing half (#1643 / D2–D7), folded in from the retired tag edit modal.
 * What is pinned here is the WIRING — which control raises which callback with
 * which argument; the writes those callbacks turn into are the host's, and
 * web/tests/connectScreen.test.tsx pins those.
 */
describe("TagHubView — editing a tag", () => {
  const editProps = () => {
    const onEditTag = vi.fn();
    const onToggleEdit = vi.fn();
    const onEditChange = vi.fn();
    const onEditSave = vi.fn();
    const onDeleteTag = vi.fn();
    const onCreateTag = vi.fn();
    return {
      spies: {
        onEditTag,
        onToggleEdit,
        onEditChange,
        onEditSave,
        onDeleteTag,
        onCreateTag,
      },
      props: {
        onEditTag,
        onToggleEdit,
        onEditChange,
        onEditSave,
        onDeleteTag,
        onCreateTag,
      },
    };
  };

  it("hides every edit affordance from a host that passes none", () => {
    renderHub({ selectedTagId: "t-work" });
    expect(screen.queryByRole("button", { name: "Edit this tag" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Work: Tag actions" }),
    ).toBeNull();
    expect(screen.queryByLabelText("Enter a tag name")).toBeNull();
  });

  it("opens the block on the field the row menu named", () => {
    const { spies, props } = editProps();
    renderHub({ selectedTagId: "t-work", ...props });

    fireEvent.click(screen.getByRole("button", { name: "Work: Tag actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Change the color" }));
    expect(spies.onEditTag).toHaveBeenCalledWith("t-work", "color");
  });

  it("routes the row menu's delete to the host, which confirms", () => {
    const { spies, props } = editProps();
    renderHub({ selectedTagId: "t-work", ...props });

    fireEvent.click(screen.getByRole("button", { name: "Work: Tag actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete tag" }));
    expect(spies.onDeleteTag).toHaveBeenCalledWith("t-work");
  });

  it("gives the untagged bucket no menu and no pencil", () => {
    const { props } = editProps();
    renderHub({ selectedTagId: UNTAGGED_TAG_ID, ...props });
    expect(
      screen.queryByRole("button", { name: "Untagged: Tag actions" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit this tag" })).toBeNull();
  });

  it("drafts a rename instead of writing it, until save is pressed", () => {
    const { spies, props } = editProps();
    renderHub({
      selectedTagId: "t-work",
      editOpen: true,
      editDirty: true,
      ...props,
    });

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Work log" },
    });
    expect(spies.onEditChange).toHaveBeenCalledWith({ name: "Work log" });
    expect(spies.onEditSave).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(spies.onEditSave).toHaveBeenCalledTimes(1);
  });

  it("leaves save unpressable while nothing is pending", () => {
    const { props } = editProps();
    renderHub({ selectedTagId: "t-work", editOpen: true, ...props });
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByText("Saved")).toBeTruthy();
  });

  it("drafts a colour from the swatch that was pressed", () => {
    const { spies, props } = editProps();
    renderHub({ selectedTagId: "t-work", editOpen: true, ...props });

    const swatch = within(
      screen.getByRole("group", { name: "Color" }),
    ).getAllByRole("button")[0];
    fireEvent.click(swatch);
    expect(spies.onEditChange).toHaveBeenCalledWith({
      color: swatch.getAttribute("aria-label"),
    });
  });

  it("clears the colour rather than sending a hex for 'default'", () => {
    const { spies, props } = editProps();
    renderHub({ selectedTagId: "t-work", editOpen: true, ...props });
    fireEvent.click(screen.getByRole("button", { name: "Default" }));
    expect(spies.onEditChange).toHaveBeenCalledWith({ color: null });
  });

  it("creates a tag from the rail's pinned row, trimmed", () => {
    const { spies, props } = editProps();
    renderHub(props);

    fireEvent.change(screen.getByLabelText("Enter a tag name"), {
      target: { value: "  Recipes  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(spies.onCreateTag).toHaveBeenCalledWith("Recipes");
  });

  it("writes nothing for a blank name", () => {
    const { spies, props } = editProps();
    renderHub(props);

    fireEvent.change(screen.getByLabelText("Enter a tag name"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(spies.onCreateTag).not.toHaveBeenCalled();
  });

  it("points the empty hub's button at the field that makes a tag (D15)", () => {
    const { props } = editProps();
    renderHub({
      ...props,
      model: buildTagHubModel({
        tags: [],
        assignments: [],
        items: [],
        untaggedName: "Untagged",
      }),
    });
    fireEvent.click(screen.getByRole("button", { name: "Add a tag" }));
    expect(document.activeElement).toBe(
      screen.getByLabelText("Enter a tag name"),
    );
  });
});

/*
 * #1561 — the 44px touch floor on the hub's OWN rows (the #1512 split for
 * this section; the shared chrome is sharedTapTargets.test.tsx).
 *
 * jsdom has no layout, so the audit's 37.5 / 33 / 36×36 / 27px cannot be
 * re-measured here — each case pins the CLASS CONTRACT that produces the
 * size, the same way sharedTapTargets does. Every floor is keyed on the
 * `wide` prop, so the Desktop assertions are the ones that matter most:
 * they are what stops the mouse layout growing with the phone one.
 */
describe("TagHubView — #1561 narrow rows meet the 44px touch floor", () => {
  // The floor rides on the field's OUTER box (the `h-8` one), not the input.
  const filterBox = () =>
    screen.getByLabelText("Filter tags by name").parentElement!;

  it("floors the tag rows and the filter field on narrow", () => {
    renderHub({ wide: false });
    for (const row of railRows()) {
      expect(row).toHaveClass("min-h-11");
      // `min-*` on top of the padding, never an `h-*` (cn is a string join).
      expect(row).toHaveClass("py-1.5");
      expect(row).not.toHaveClass("h-11");
    }
    expect(filterBox()).toHaveClass("min-h-11");
    // The "sm" preset itself is untouched; the floor is layered over it.
    expect(filterBox()).toHaveClass("h-8");
  });

  it("leaves the Desktop rail at its mouse height", () => {
    renderHub({ wide: true });
    for (const row of railRows()) expect(row).not.toHaveClass("min-h-11");
    expect(filterBox()).not.toHaveClass("min-h-11");
  });

  it("floors the item rows and the back control on narrow", () => {
    renderHub({ wide: false, selectedTagId: "t-work" });
    const rows = itemRows();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row).toHaveClass("min-h-11");
      expect(row).not.toHaveClass("h-11");
    }
    // 36×36 was short on BOTH axes, so both are floored, and the painted
    // size="md" box is still what the IconButton contract says.
    const back = screen.getByRole("button", { name: "Back to tags" });
    expect(back).toHaveClass("min-h-11", "min-w-11");
    expect(back).toHaveClass("h-8", "w-8");
  });

  it("leaves the Desktop item rows at their mouse height", () => {
    renderHub({ wide: true, selectedTagId: "t-work" });
    const rows = itemRows();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row).not.toHaveClass("min-h-11");
  });

  it("gives the narrow row menu a 44px box of its own (#1643)", () => {
    renderHub({
      wide: false,
      onEditTag: vi.fn(),
      onDeleteTag: vi.fn(),
    });
    expect(
      screen.getByRole("button", { name: "Work: Tag actions" }),
    ).toHaveClass("h-11");
  });
});
