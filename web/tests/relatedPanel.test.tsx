import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

/*
 * The Related half of LinkPanel (#1172).
 *
 * #1152 retired the Connect graph, and this is where the question it answered
 * moved to: what is the open note sitting next to? Three relations, and the two
 * new ones are DERIVED — which is exactly why they need pinning:
 *
 *   1. "shares a tag" is computed from the bulk assignment cache. Get the
 *      filter wrong and the section either lists the whole workspace or stays
 *      empty; both look plausible from the outside.
 *   2. an item that is BOTH linked and tag-sharing appears once, under links.
 *      Otherwise the panel counts one neighbour twice and reads busier than the
 *      graph actually is.
 *   3. "that day's daily" is a lookup on the `daily-<YYYY-MM-DD>` id, so it
 *      needs no read of its own — but it must not appear for a day with no
 *      entry, which is what the candidate pool decides.
 *
 * Rows resolve through the pool, so anything the pool cannot name is dropped
 * rather than shown as an id: the row's only purpose is to be followed, and
 * navigation keys off the role the pool carries.
 *
 * Only the wiki-tag context is faked, as in linkPanel.test.tsx. i18next stays
 * real, so a hardcoded English string cannot sneak back in.
 */

const state = vi.hoisted(() => ({
  outgoing: [] as unknown[],
  incoming: [] as unknown[],
  assignments: [] as unknown[],
  tagsForItem: [] as unknown[],
  loading: false,
}));

vi.mock("@life-editor/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@life-editor/shared")>();
  return {
    ...actual,
    useWikiTagsUnifiedContext: () => ({
      loading: state.loading,
      allAssignments: state.assignments,
      getTagsForItem: () => state.tagsForItem,
      getLinksForItem: () => ({
        outgoing: state.outgoing,
        incoming: state.incoming,
      }),
      createItemLink: vi.fn(() => Promise.resolve()),
      deleteItemLink: vi.fn(() => Promise.resolve()),
    }),
  };
});

const { i18n } = await import("@life-editor/shared");
const { LinkPanel } = await import("../src/wikitag/LinkPanel");

const TARGETS = [
  { id: "note-2", label: "Kitchen rebuild", role: "note" },
  { id: "note-3", label: "Tile samples", role: "note" },
  { id: "task-9", label: "Order the tiles", role: "task" },
  { id: "daily-2026-08-29", label: "2026-08-29", role: "daily" },
];

const loadTargets = vi.fn(() => Promise.resolve(TARGETS));

function link(over: { id: string; from?: string; to?: string }) {
  return {
    id: over.id,
    fromItemId: over.from ?? "note-1",
    toItemId: over.to ?? "note-2",
    origin: "manual",
    isDeleted: false,
  };
}

function assigned(itemId: string, tagId: string) {
  return { itemId, tagId, isDeleted: false };
}

/** Open the related popover and wait for the (async) candidate pool. */
async function openRelated(): Promise<HTMLElement> {
  fireEvent.click(
    screen.getByRole("button", { name: i18n.t("materials.related.open") }),
  );
  return await screen.findByRole("dialog", {
    name: i18n.t("materials.related.dialog"),
  });
}

/** The trigger's visible count. */
function relatedCount(): string {
  return (
    screen
      .getByRole("button", { name: i18n.t("materials.related.open") })
      .textContent?.trim() ?? ""
  );
}

beforeEach(() => {
  state.outgoing = [];
  state.incoming = [];
  state.assignments = [];
  state.tagsForItem = [];
  state.loading = false;
  loadTargets.mockClear();
});

describe("LinkPanel — the related panel (#1172)", () => {
  it("says so when the item has no neighbours at all", async () => {
    render(<LinkPanel itemId="note-1" loadTargets={loadTargets} />);
    await openRelated();

    expect(screen.getByText(i18n.t("materials.related.empty"))).toBeTruthy();
  });

  it("lists the items that share a tag with this one", async () => {
    state.tagsForItem = [assigned("note-1", "tag-house")];
    state.assignments = [
      assigned("note-1", "tag-house"),
      assigned("note-3", "tag-house"),
      assigned("task-9", "tag-house"),
      // A different tag — not a neighbour.
      assigned("note-2", "tag-work"),
    ];
    render(
      <LinkPanel
        itemId="note-1"
        loadTargets={loadTargets}
        onNavigateToItem={vi.fn()}
      />,
    );
    const dialog = await openRelated();

    await waitFor(() => {
      expect(dialog.textContent).toContain("Tile samples");
    });
    expect(dialog.textContent).toContain("Order the tiles");
    expect(dialog.textContent).not.toContain("Kitchen rebuild");
  });

  it("counts a linked, tag-sharing item once — under links", async () => {
    state.outgoing = [link({ id: "l1", to: "note-3" })];
    state.tagsForItem = [assigned("note-1", "tag-house")];
    state.assignments = [
      assigned("note-1", "tag-house"),
      assigned("note-3", "tag-house"),
    ];
    render(
      <LinkPanel
        itemId="note-1"
        loadTargets={loadTargets}
        onNavigateToItem={vi.fn()}
      />,
    );
    const dialog = await openRelated();

    await waitFor(() => expect(dialog.textContent).toContain("Tile samples"));
    // One row in the panel, one chip outside it — never two rows inside.
    const inDialog = dialog.textContent?.match(/Tile samples/g) ?? [];
    expect(inDialog).toHaveLength(1);
    expect(relatedCount()).toBe("1");
  });

  it("offers the daily for the day the host names", async () => {
    render(
      <LinkPanel
        itemId="note-1"
        loadTargets={loadTargets}
        onNavigateToItem={vi.fn()}
        relatedDailyDate="2026-08-29"
      />,
    );
    const dialog = await openRelated();

    await waitFor(() => expect(dialog.textContent).toContain("2026-08-29"));
    expect(dialog.textContent).toContain(
      i18n.t("materials.related.sameDayDaily"),
    );
  });

  it("leaves the daily out for a day with no entry", async () => {
    render(
      <LinkPanel
        itemId="note-1"
        loadTargets={loadTargets}
        onNavigateToItem={vi.fn()}
        // No `daily-2026-01-01` in the pool → that day has no entry.
        relatedDailyDate="2026-01-01"
      />,
    );
    const dialog = await openRelated();

    expect(dialog.textContent).not.toContain(
      i18n.t("materials.related.sameDayDaily"),
    );
    expect(screen.getByText(i18n.t("materials.related.empty"))).toBeTruthy();
  });

  it("opens a related row through the host's navigation", async () => {
    const onNavigateToItem = vi.fn();
    state.tagsForItem = [assigned("note-1", "tag-house")];
    state.assignments = [
      assigned("note-1", "tag-house"),
      assigned("task-9", "tag-house"),
    ];
    render(
      <LinkPanel
        itemId="note-1"
        loadTargets={loadTargets}
        onNavigateToItem={onNavigateToItem}
      />,
    );
    const dialog = await openRelated();
    await waitFor(() =>
      expect(dialog.textContent).toContain("Order the tiles"),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: i18n.t("materials.links.open", { title: "Order the tiles" }),
      }),
    );

    expect(onNavigateToItem).toHaveBeenCalledExactlyOnceWith({
      id: "task-9",
      role: "task",
    });
    // Following a row closes the panel it was followed from.
    expect(
      screen.queryByRole("dialog", {
        name: i18n.t("materials.related.dialog"),
      }),
    ).toBeNull();
  });

  it("leaves out a tag sibling the candidate pool cannot name", async () => {
    state.tagsForItem = [assigned("note-1", "tag-house")];
    state.assignments = [
      assigned("note-1", "tag-house"),
      // An event / routine the Notes pool never carries: it has no role here,
      // so there is nowhere for a click to go.
      assigned("event-123", "tag-house"),
    ];
    render(
      <LinkPanel
        itemId="note-1"
        loadTargets={loadTargets}
        onNavigateToItem={vi.fn()}
      />,
    );
    const dialog = await openRelated();

    expect(dialog.textContent).not.toContain("event-123");
    expect(relatedCount()).toBe("0");
  });
});
