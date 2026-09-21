import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
  within,
  createEvent,
} from "@testing-library/react";
import { useEffect, useRef } from "react";
import {
  RightSidebarProvider,
  useRightSidebarContext,
  WikiTagsUnifiedProvider,
  resetConnectSelection,
  type DataService,
} from "@life-editor/shared";
import { ConnectScreen } from "../src/connect/ConnectScreen";
import { createBumpableSync, stubDataService } from "./helpers";

/*
 * The Connect host's wiring (#1171).
 *
 * shared/tests/tagHubView.test.tsx pins the presentation and
 * shared/tests/tagHubModel.test.ts pins the derivation; both take their data
 * as props, so both are blind to the part that lives HERE — which of the four
 * reads becomes which kind of row, which rows are filtered out on the way, and
 * what the shell is handed when a row is clicked. A slip there (events read
 * into `task` rows, a trashed note left in, the event's date dropped) leaves
 * every shared case green while the screen shows the wrong thing.
 *
 * Rendered through the real WikiTagsUnifiedProvider rather than a context
 * stub: the tag and assignment caches arrive from the same DataService as the
 * items, and a stub would let the two drift apart in the fixture.
 *
 * No jest-dom in web/ — presence comes from getBy* throwing, absence from
 * queryBy* being null.
 */

const TAGS = [
  { id: "t-work", name: "Work", color: null, icon: null, isDeleted: false },
  { id: "t-idle", name: "Idle", color: null, icon: null, isDeleted: false },
];

const ASSIGNMENTS = [
  { id: "a-1", itemId: "task-1", tagId: "t-work", isDeleted: false },
  { id: "a-2", itemId: "event-1", tagId: "t-work", isDeleted: false },
  { id: "a-3", itemId: "note-1", tagId: "t-work", isDeleted: false },
  { id: "a-4", itemId: "daily-2026-08-29", tagId: "t-work", isDeleted: false },
];

function makeDS(over: Partial<Record<keyof DataService, unknown>> = {}) {
  return stubDataService({
    fetchTodoTree: vi.fn().mockResolvedValue([
      {
        id: "task-1",
        title: "Draft the PR",
        updatedAt: "2026-08-28T00:00:00Z",
      },
      // Trashed — must not reach the hub at all.
      { id: "task-gone", title: "Deleted todo", isDeleted: true },
    ]),
    fetchEvents: vi.fn().mockResolvedValue([
      {
        id: "event-1",
        title: "Standup",
        date: "2026-08-29",
        updatedAt: "2026-08-28T00:00:00Z",
      },
    ]),
    listNotesUnified: vi.fn().mockResolvedValue([
      {
        id: "note-1",
        title: "Migration notes",
        updatedAt: "2026-08-28T00:00:00Z",
      },
      // No assignment — the untagged bucket's member.
      { id: "note-loose", title: "", updatedAt: "2026-08-27T00:00:00Z" },
    ]),
    listDailiesUnified: vi.fn().mockResolvedValue([
      {
        id: "daily-2026-08-29",
        date: "2026-08-29",
        updatedAt: "2026-08-29T00:00:00Z",
      },
    ]),
    // #1631: no repeat in the base fixture — the series cases below supply
    // their own, so the counts the other cases assert stay readable.
    fetchAllRoutines: vi.fn().mockResolvedValue([]),
    listAllWikiTagsUnified: vi.fn().mockResolvedValue(TAGS),
    listAllTagAssignments: vi.fn().mockResolvedValue(ASSIGNMENTS),
    listAllTagConnections: vi.fn().mockResolvedValue([]),
    ...over,
  });
}

/*
 * A tagged repeat (#1631): the tag is on the SERIES, the days are occurrences
 * carrying `routineId`. Dates sit far either side of the real "today" so the
 * "next occurrence" pick is deterministic without freezing the clock.
 */
const SERIES_ASSIGNMENT = {
  id: "a-5",
  itemId: "routine-1",
  tagId: "t-work",
  isDeleted: false,
};

const occurrence = (id: string, date: string) => ({
  id,
  title: "Morning review",
  date,
  routineId: "routine-1",
  updatedAt: "2026-08-28T00:00:00Z",
});

function makeSeriesDS(occurrences: ReturnType<typeof occurrence>[]) {
  return makeDS({
    fetchEvents: vi.fn().mockResolvedValue([
      {
        id: "event-1",
        title: "Standup",
        date: "2026-08-29",
        updatedAt: "2026-08-28T00:00:00Z",
      },
      ...occurrences,
    ]),
    fetchAllRoutines: vi.fn().mockResolvedValue([
      {
        id: "routine-1",
        title: "Morning review",
        updatedAt: "2026-08-28T00:00:00Z",
      },
      // Untagged, so it must stay out of the hub — including the untagged
      // bucket, where its own occurrences already speak for it.
      { id: "routine-loose", title: "Stretch", updatedAt: "2026-08-27" },
    ]),
    listAllTagAssignments: vi
      .fn()
      .mockResolvedValue([...ASSIGNMENTS, SERIES_ASSIGNMENT]),
  });
}

async function renderScreen(ds: DataService = makeDS()) {
  const onNavigateToItem = vi.fn();
  const { wrapper: SyncWrapper } = createBumpableSync();
  render(
    <SyncWrapper>
      <WikiTagsUnifiedProvider dataService={ds}>
        <ConnectScreen dataService={ds} onNavigateToItem={onNavigateToItem} />
      </WikiTagsUnifiedProvider>
    </SyncWrapper>,
  );
  // The rail only exists once both the tag cache and the four item reads land.
  await waitFor(() => screen.getByRole("list", { name: "Tags" }));
  return { onNavigateToItem };
}

/*
 * #1472: a stand-in for the shell's detail panel — registers itself as the
 * portal target the way RightSidebarContents does, so whatever ConnectScreen
 * portals lands in a region the assertions can scope to.
 */
function PanelWell() {
  const { setPortalTarget } = useRightSidebarContext();
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    setPortalTarget(ref.current);
    return () => setPortalTarget(null);
  }, [setPortalTarget]);
  return <aside aria-label="Details" ref={ref} />;
}

async function renderWithPanel(ds: DataService = makeDS()) {
  const onNavigateToItem = vi.fn();
  const { wrapper: SyncWrapper } = createBumpableSync();
  render(
    <SyncWrapper>
      <RightSidebarProvider>
        <WikiTagsUnifiedProvider dataService={ds}>
          <ConnectScreen dataService={ds} onNavigateToItem={onNavigateToItem} />
        </WikiTagsUnifiedProvider>
        <PanelWell />
      </RightSidebarProvider>
    </SyncWrapper>,
  );
  await waitFor(() => screen.getByRole("list", { name: "Tags" }));
  const panel = () =>
    within(screen.getByRole("complementary", { name: "Details" }));
  return { onNavigateToItem, panel };
}

/**
 * The rail's rows, by their spelled-out "name: count" labels. The first button
 * in each <li> is the row; the second is its "…" (#1643).
 */
const railLabels = (name = "Tags") =>
  within(screen.getByRole("list", { name }))
    .getAllByRole("listitem")
    .map((li) =>
      within(li).getAllByRole("button")[0].getAttribute("aria-label"),
    );

beforeEach(() => {
  cleanup();
  // #1473: the tag selection outlives the tree on purpose, so it must not
  // outlive a test.
  resetConnectSelection();
});

describe("ConnectScreen", () => {
  it("counts each tag off the four reads, and files the rest as untagged", async () => {
    await renderScreen();
    expect(railLabels()).toEqual(["Work: 4 items", "Untagged: 1 item"]);
    // Idle carries nothing, so it is behind the rail's disclosure (#1643).
    fireEvent.click(screen.getByRole("button", { name: "Unused tags (1)" }));
    expect(railLabels("Unused tags")).toEqual(["Idle: 0 items"]);
  });

  it("keeps trashed rows out of the hub entirely", async () => {
    await renderScreen();
    fireEvent.click(screen.getByRole("button", { name: "Work: 4 items" }));
    expect(screen.queryByText("Deleted todo")).toBeNull();
    // …and it is not hiding in the untagged bucket either.
    fireEvent.click(screen.getByRole("button", { name: "Untagged: 1 item" }));
    expect(screen.queryByText("Deleted todo")).toBeNull();
  });

  it("labels each read with its own kind", async () => {
    await renderScreen();
    fireEvent.click(screen.getByRole("button", { name: "Work: 4 items" }));
    expect(
      screen
        .getAllByRole("heading", { level: 3 })
        .map((h) => h.getAttribute("aria-label")),
    ).toEqual([
      "Todo: 1 item",
      "Event: 1 item",
      "Note: 1 item",
      "Daily: 1 item",
    ]);
  });

  it("gives a daily its date as its name and an untitled note the fallback", async () => {
    await renderScreen();
    fireEvent.click(screen.getByRole("button", { name: "Work: 4 items" }));
    // By accessible NAME, not by text: the date also appears as the event
    // row's trailing detail, and only the daily row is named by it alone.
    expect(screen.getByRole("button", { name: "2026-08-29" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Untagged: 1 item" }));
    expect(screen.getByText("Untitled")).toBeTruthy();
  });

  it("routes a row's chevron to the shell's item-nav with its role", async () => {
    const { onNavigateToItem } = await renderScreen();
    fireEvent.click(screen.getByRole("button", { name: "Work: 4 items" }));

    fireEvent.click(
      screen.getByRole("button", { name: "Open “Draft the PR”" }),
    );
    expect(onNavigateToItem).toHaveBeenCalledWith({
      id: "task-1",
      role: "task",
      date: undefined,
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Open “Migration notes”" }),
    );
    expect(onNavigateToItem).toHaveBeenLastCalledWith({
      id: "note-1",
      role: "note",
      date: undefined,
    });
  });

  it("sends an event's date along, because the Calendar needs it to select", async () => {
    const { onNavigateToItem } = await renderScreen();
    fireEvent.click(screen.getByRole("button", { name: "Work: 4 items" }));
    fireEvent.click(screen.getByRole("button", { name: "Open “Standup”" }));
    expect(onNavigateToItem).toHaveBeenCalledWith({
      id: "event-1",
      role: "event",
      date: "2026-08-29",
    });
  });

  it("puts the selected tag's breakdown and recent rows in the detail panel (#1472)", async () => {
    const { panel, onNavigateToItem } = await renderWithPanel();
    // Nothing selected — nothing portalled, so the shell's empty copy stands.
    expect(panel().queryByRole("heading")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Work: 4 items" }));
    expect(
      panel().getByRole("heading", { level: 2, name: "Work" }),
    ).toBeTruthy();
    expect(
      within(panel().getByRole("region", { name: "By kind" }))
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["Todo1 item", "Event1 item", "Note1 item", "Daily1 item"]);

    // The panel's rows leave the hub the same way the main pane's do.
    fireEvent.click(
      within(
        panel().getByRole("region", { name: "Recently tagged" }),
      ).getByRole("button", { name: /Standup/ }),
    );
    expect(onNavigateToItem).toHaveBeenCalledWith({
      id: "event-1",
      role: "event",
      date: "2026-08-29",
    });
  });

  it("re-opens the tag the user had picked after a section switch (#1473)", async () => {
    await renderScreen();
    fireEvent.click(screen.getByRole("button", { name: "Work: 4 items" }));
    expect(
      screen.getByRole("heading", { level: 2, name: "Work" }),
    ).toBeTruthy();

    // A section switch unmounts the body (sectionDescriptors mounts it inside
    // the switch) and mounts it afresh on the way back. Same DataService, same
    // Provider tree, no props that could carry the selection across.
    cleanup();
    await renderScreen();
    expect(
      screen.getByRole("heading", { level: 2, name: "Work" }),
    ).toBeTruthy();
    expect(
      screen.getAllByRole("button", { name: /Draft the PR/ }).length,
    ).toBeGreaterThan(0);
  });

  it("comes back with nothing selected when the user had cleared it", async () => {
    await renderScreen();
    fireEvent.click(screen.getByRole("button", { name: "Work: 4 items" }));
    cleanup();
    // Deselection is a state the user chose too, not the absence of one.
    resetConnectSelection();
    await renderScreen();
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
  });

  it("reads exactly the five item lists, once", async () => {
    const ds = makeDS();
    await renderScreen(ds);
    for (const method of [
      "fetchTodoTree",
      "fetchEvents",
      "listNotesUnified",
      "listDailiesUnified",
      "fetchAllRoutines",
    ] as const) {
      expect(ds[method]).toHaveBeenCalledTimes(1);
    }
  });
});

/*
 * Repeating items (#1631). The tag the user attaches to a repeat is written to
 * the series, so before this the hub joined it against occurrence ids, matched
 * nothing, and showed the repeat nowhere while its days piled into "untagged".
 */
describe("ConnectScreen — repeating items", () => {
  it("shows a tagged repeat as ONE row, counted once, whatever the run length", async () => {
    await renderScreen(
      makeSeriesDS([
        occurrence("event-r1", "2099-01-01"),
        occurrence("event-r2", "2099-02-01"),
        occurrence("event-r3", "2020-01-01"),
      ]),
    );
    expect(railLabels()).toEqual(["Work: 5 items", "Untagged: 1 item"]);
    fireEvent.click(screen.getByRole("button", { name: "Work: 5 items" }));
    // One Event group holding the one-off AND the series — not four rows.
    expect(
      screen
        .getAllByRole("heading", { level: 3 })
        .map((h) => h.getAttribute("aria-label")),
    ).toEqual([
      "Todo: 1 item",
      "Event: 2 items",
      "Note: 1 item",
      "Daily: 1 item",
    ]);
    expect(
      screen.getAllByRole("button", { name: "Open “Morning review”" }),
    ).toHaveLength(1);
  });

  it("keeps the repeat's days out of the untagged bucket", async () => {
    await renderScreen(
      makeSeriesDS([
        occurrence("event-r1", "2099-01-01"),
        occurrence("event-r2", "2020-01-01"),
      ]),
    );
    fireEvent.click(screen.getByRole("button", { name: "Untagged: 1 item" }));
    // Only the untitled note is in there — not the occurrences, and not the
    // untagged series either.
    expect(screen.getByText("Untitled")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Morning review/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Stretch/ })).toBeNull();
  });

  it("opens the repeat at its NEXT day, which is what the Calendar can select", async () => {
    const { onNavigateToItem } = await renderScreen(
      makeSeriesDS([
        occurrence("event-past", "2020-01-01"),
        occurrence("event-next", "2099-01-01"),
        occurrence("event-later", "2099-02-01"),
      ]),
    );
    fireEvent.click(screen.getByRole("button", { name: "Work: 5 items" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Open “Morning review”" }),
    );
    // The routine id itself would highlight nothing — the row is FILED under
    // it but OPENS the occurrence.
    expect(onNavigateToItem).toHaveBeenCalledWith({
      id: "event-next",
      role: "event",
      date: "2099-01-01",
    });
  });

  it("falls back to the most recent past day for a repeat that has stopped", async () => {
    const { onNavigateToItem } = await renderScreen(
      makeSeriesDS([
        occurrence("event-old", "2020-01-01"),
        occurrence("event-last", "2020-02-01"),
      ]),
    );
    fireEvent.click(screen.getByRole("button", { name: "Work: 5 items" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Open “Morning review”" }),
    );
    expect(onNavigateToItem).toHaveBeenCalledWith({
      id: "event-last",
      role: "event",
      date: "2020-02-01",
    });
  });
});
/*
 * Editing tags from the hub (#1643), migrated from web/tests/tagEditorActions
 * when D-20260912-main-1 retired the modal that suite drove.
 *
 * What is pinned here is the half that lives on THIS side of the view's props:
 * the real `useWikiTagsUnifiedAPI` turning each callback into one DataService
 * call. Three of the identity writes land on the SAME method
 * (`updateWikiTagUnified`) and differ only by which key is in the patch, so a
 * copy-paste slip there — a colour arriving as `{ name }` — leaves every view
 * test green while the tag comes back renamed to "#e11d48".
 *
 * So the cases below assert the method, its arguments, AND that no sibling
 * write fired: rendering the real hook is what makes "only this one" mean
 * anything.
 */

/** Every write a click in this screen can reach — the "no sibling" pool. */
const WRITE_METHODS = [
  "createWikiTagUnified",
  "updateWikiTagUnified",
  "softDeleteWikiTagUnified",
  "unassignTagFromItem",
  "assignTagToItem",
  "createItemLink",
  "deleteItemLink",
] as const;

function makeWritableDS() {
  const writes: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of WRITE_METHODS) {
    // Every write resolves with a tag-shaped row: the hook folds the result
    // back into its local list, so `undefined` would take the screen down
    // before the assertion runs.
    writes[method] = vi.fn(async () => ({ ...TAGS[0] }));
  }
  return { ds: makeDS(writes), writes };
}

/** Asserts exactly one write method fired, with exactly these arguments. */
function expectOnlyWrite(
  writes: Record<string, ReturnType<typeof vi.fn>>,
  method: string,
  args: unknown[],
) {
  expect(writes[method].mock.calls).toEqual([args]);
  for (const other of WRITE_METHODS) {
    if (other === method) continue;
    expect(writes[other]).not.toHaveBeenCalled();
  }
}

/** Opens a tag in the hub (a selection, not a write). */
const openTag = (label: string) =>
  fireEvent.click(screen.getByRole("button", { name: label }));

/** Opens the edit block on the selected tag through the header's pencil. */
const openEditor = () =>
  fireEvent.click(screen.getByRole("button", { name: "Edit this tag" }));

const save = () =>
  fireEvent.click(screen.getByRole("button", { name: "Save" }));

describe("ConnectScreen — creating a tag", () => {
  it("sends the typed name and nothing else", async () => {
    const { ds, writes } = makeWritableDS();
    await renderScreen(ds);

    fireEvent.change(screen.getByLabelText("Enter a tag name"), {
      target: { value: "Recipes" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(writes.createWikiTagUnified).toHaveBeenCalled());
    // The id is minted host-side (generateId("tag")), so the shape is what can
    // be pinned — a colourless new tag, created under a tag-prefixed id.
    expectOnlyWrite(writes, "createWikiTagUnified", [
      expect.stringMatching(/^tag-/) as unknown,
      "Recipes",
      null,
    ]);
  });

  it("writes nothing for a blank name", async () => {
    const { ds, writes } = makeWritableDS();
    await renderScreen(ds);

    fireEvent.change(screen.getByLabelText("Enter a tag name"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    for (const method of WRITE_METHODS) {
      expect(writes[method]).not.toHaveBeenCalled();
    }
  });
});

describe("ConnectScreen — the save button routes each field to its own patch", () => {
  it("rename → updateWikiTagUnified(id, { name })", async () => {
    const { ds, writes } = makeWritableDS();
    await renderScreen(ds);
    openTag("Work: 4 items");
    openEditor();

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Work log" },
    });
    save();

    await waitFor(() => expect(writes.updateWikiTagUnified).toHaveBeenCalled());
    expectOnlyWrite(writes, "updateWikiTagUnified", [
      "t-work",
      { name: "Work log" },
    ]);
  });

  it("colour → updateWikiTagUnified(id, { color }), carrying the swatch pressed", async () => {
    const { ds, writes } = makeWritableDS();
    await renderScreen(ds);
    openTag("Work: 4 items");
    openEditor();

    // Each swatch is labelled with its own hex, so the value asserted below is
    // read off the button that was pressed rather than restated here.
    const swatch = within(
      screen.getByRole("group", { name: "Color" }),
    ).getAllByRole("button")[0];
    const hex = swatch.getAttribute("aria-label");
    fireEvent.click(swatch);
    save();

    await waitFor(() => expect(writes.updateWikiTagUnified).toHaveBeenCalled());
    expectOnlyWrite(writes, "updateWikiTagUnified", ["t-work", { color: hex }]);
  });

  it("icon → updateWikiTagUnified(id, { icon }), carrying the glyph pressed", async () => {
    const { ds, writes } = makeWritableDS();
    await renderScreen(ds);
    openTag("Work: 4 items");
    openEditor();

    fireEvent.click(screen.getByRole("button", { name: "Icon" }));
    // The glyphs are `option`s, not bare buttons, since #1701 put a search
    // field on the panel: they are the listbox that field drives. Asking for
    // buttons here would hand back the "Default icon" row underneath.
    const choice = within(
      screen.getByRole("group", { name: "Icon" }),
    ).getAllByRole("option")[0];
    const icon = choice.getAttribute("aria-label");
    fireEvent.click(choice);
    save();

    await waitFor(() => expect(writes.updateWikiTagUnified).toHaveBeenCalled());
    expectOnlyWrite(writes, "updateWikiTagUnified", ["t-work", { icon }]);
  });

  it("keeps two moved fields in two patches, both aimed at the open tag", async () => {
    const { ds, writes } = makeWritableDS();
    await renderScreen(ds);
    openTag("Work: 4 items");
    openEditor();

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Work log" },
    });
    const swatch = within(
      screen.getByRole("group", { name: "Color" }),
    ).getAllByRole("button")[0];
    const hex = swatch.getAttribute("aria-label");
    fireEvent.click(swatch);
    save();

    await waitFor(() =>
      expect(writes.updateWikiTagUnified).toHaveBeenCalledTimes(2),
    );
    // Name first, then colour — the order the panel has always written in, and
    // both on t-work rather than on whatever was selected before.
    expect(writes.updateWikiTagUnified.mock.calls).toEqual([
      ["t-work", { name: "Work log" }],
      ["t-work", { color: hex }],
    ]);
    expect(writes.softDeleteWikiTagUnified).not.toHaveBeenCalled();
  });

  it("acts on the tag that is open, not the one opened before it", async () => {
    const { ds, writes } = makeWritableDS();
    await renderScreen(ds);
    openTag("Work: 4 items");
    // Idle is an unused tag, so reaching it means opening the disclosure —
    // which is exactly why that run stays reachable (#1643 / D4).
    fireEvent.click(screen.getByRole("button", { name: "Unused tags (1)" }));
    openTag("Idle: 0 items");
    openEditor();

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Idle hands" },
    });
    save();

    await waitFor(() => expect(writes.updateWikiTagUnified).toHaveBeenCalled());
    expectOnlyWrite(writes, "updateWikiTagUnified", [
      "t-idle",
      { name: "Idle hands" },
    ]);
  });
});

describe("ConnectScreen — removing a tag", () => {
  it("asks first, then soft-deletes — never a hard write", async () => {
    const { ds, writes } = makeWritableDS();
    await renderScreen(ds);

    fireEvent.click(screen.getByRole("button", { name: "Work: Tag actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete tag" }));
    // Nothing is written until the question is answered.
    expect(writes.softDeleteWikiTagUnified).not.toHaveBeenCalled();

    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Delete tag",
      }),
    );

    await waitFor(() =>
      expect(writes.softDeleteWikiTagUnified).toHaveBeenCalled(),
    );
    expectOnlyWrite(writes, "softDeleteWikiTagUnified", ["t-work"]);
  });

  it("leaves the tag alone when the question is refused", async () => {
    const { ds, writes } = makeWritableDS();
    await renderScreen(ds);

    fireEvent.click(screen.getByRole("button", { name: "Work: Tag actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete tag" }));
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Cancel",
      }),
    );

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    for (const method of WRITE_METHODS) {
      expect(writes[method]).not.toHaveBeenCalled();
    }
  });
});

/*
 * #1676 — the rail row's right-click opens the "…" menu at the pointer. The
 * view suite pins that the SAME menu opens; these pin that each item then ends
 * in the SAME write the "…" path produces, through the real hook.
 */
describe("ConnectScreen — the row's right-click menu", () => {
  /** Right-clicks a rail row and says whether the native menu was suppressed. */
  const rightClickRow = (label: string) => {
    const row = screen
      .getByRole("button", { name: label })
      .closest("li") as HTMLElement;
    const event = createEvent.contextMenu(row, { clientX: 40, clientY: 60 });
    fireEvent(row, event);
    return event.defaultPrevented;
  };

  it("opens the tag menu and keeps the browser's own menu out", async () => {
    await renderScreen();
    expect(rightClickRow("Work: 4 items")).toBe(true);
    screen.getByRole("menu", { name: "Work: Tag actions" });
  });

  it("renames through the menu with the same patch as the …", async () => {
    const { ds, writes } = makeWritableDS();
    await renderScreen(ds);

    rightClickRow("Work: 4 items");
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
    fireEvent.change(await screen.findByLabelText("Name"), {
      target: { value: "Work log" },
    });
    save();

    await waitFor(() => expect(writes.updateWikiTagUnified).toHaveBeenCalled());
    expectOnlyWrite(writes, "updateWikiTagUnified", [
      "t-work",
      { name: "Work log" },
    ]);
  });

  it("recolours and re-icons through the menu with the same patches", async () => {
    const { ds, writes } = makeWritableDS();
    await renderScreen(ds);

    rightClickRow("Work: 4 items");
    fireEvent.click(screen.getByRole("menuitem", { name: "Change the color" }));
    const swatch = within(
      await screen.findByRole("group", { name: "Color" }),
    ).getAllByRole("button")[0];
    const hex = swatch.getAttribute("aria-label");
    fireEvent.click(swatch);

    rightClickRow("Work: 4 items");
    fireEvent.click(screen.getByRole("menuitem", { name: "Change the icon" }));
    fireEvent.click(screen.getByRole("button", { name: "Icon" }));
    // `option`, not `button` — see the note in the save-button suite (#1701).
    const choice = within(
      screen.getByRole("group", { name: "Icon" }),
    ).getAllByRole("option")[0];
    const icon = choice.getAttribute("aria-label");
    fireEvent.click(choice);
    save();

    await waitFor(() =>
      expect(writes.updateWikiTagUnified).toHaveBeenCalledTimes(2),
    );
    expect(writes.updateWikiTagUnified.mock.calls).toEqual([
      ["t-work", { icon }],
      ["t-work", { color: hex }],
    ]);
  });

  it("deletes through the menu only after the same question", async () => {
    const { ds, writes } = makeWritableDS();
    await renderScreen(ds);

    rightClickRow("Work: 4 items");
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete tag" }));
    expect(writes.softDeleteWikiTagUnified).not.toHaveBeenCalled();
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Delete tag",
      }),
    );

    await waitFor(() =>
      expect(writes.softDeleteWikiTagUnified).toHaveBeenCalled(),
    );
    expectOnlyWrite(writes, "softDeleteWikiTagUnified", ["t-work"]);
  });

  it("leaves the untagged bucket's native menu alone", async () => {
    await renderScreen();
    expect(rightClickRow("Untagged: 1 item")).toBe(false);
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

/*
 * #1644 — bulk selection and merging, through the real hook: which rows a
 * checkbox names, which write each bar action becomes, and how many times.
 */
/*
 * #1645 — a row click now SELECTS (plan assumption 1) and the right panel
 * switches to that item's relations. What is pinned here is the swap of
 * meanings (click vs chevron / double click) and the one write the panel adds.
 */
describe("ConnectScreen — the relations panel", () => {
  const openWork = () => openTag("Work: 4 items");

  it("selects a clicked row instead of leaving the hub", async () => {
    const { onNavigateToItem, panel } = await renderWithPanel();
    openWork();

    fireEvent.click(screen.getByRole("button", { name: /^Standup/ }));

    expect(onNavigateToItem).not.toHaveBeenCalled();
    // The panel swapped the tag's breakdown for the row's neighbourhood.
    panel().getByRole("heading", { name: "Standup" });
    panel().getByRole("region", { name: "Links (0)" });
  });

  it("still leaves the hub by the chevron or a double click", async () => {
    const { onNavigateToItem } = await renderWithPanel();
    openWork();

    fireEvent.click(screen.getByRole("button", { name: "Open “Standup”" }));
    fireEvent.doubleClick(screen.getByRole("button", { name: /^Standup/ }));

    expect(onNavigateToItem.mock.calls).toEqual([
      [{ id: "event-1", role: "event", date: "2026-08-29" }],
      [{ id: "event-1", role: "event", date: "2026-08-29" }],
    ]);
  });

  it("lists the rows sharing a tag with the selected one", async () => {
    const { panel } = await renderWithPanel();
    openWork();
    fireEvent.click(screen.getByRole("button", { name: /^Standup/ }));

    // Everything else under Work, minus the row itself.
    panel().getByRole("region", { name: "Items sharing a tag (3)" });
  });

  it("links the selected row to the item picked in the panel", async () => {
    const { ds, writes } = makeWritableDS();
    const { panel } = await renderWithPanel(ds);
    openWork();
    fireEvent.click(screen.getByRole("button", { name: /^Standup/ }));

    fireEvent.click(panel().getByRole("button", { name: "Add a link" }));
    const picker = within(
      panel().getByRole("dialog", { name: "Link to an item" }),
    );
    fireEvent.change(picker.getByLabelText("Search by title…"), {
      target: { value: "Migration" },
    });
    fireEvent.click(picker.getByRole("button", { name: /Migration notes/ }));

    await waitFor(() => expect(writes.createItemLink).toHaveBeenCalled());
    // (linkId, from = the selected row, to = the picked one, origin)
    const call = writes.createItemLink.mock.calls[0];
    expect([call[1], call[2]]).toEqual(["event-1", "note-1"]);
  });

  /*
   * #1734: the brief's M5 heads the picker's rows with "Candidates (N)". The
   * count has to follow the search, not the whole pool — a heading frozen at
   * the unfiltered number is the failure this pins.
   */
  it("heads the picker's rows with the count the search left", async () => {
    const { panel } = await renderWithPanel();
    openWork();
    fireEvent.click(screen.getByRole("button", { name: /^Standup/ }));

    fireEvent.click(panel().getByRole("button", { name: "Add a link" }));
    const picker = within(
      panel().getByRole("dialog", { name: "Link to an item" }),
    );
    picker.getByRole("heading", { name: /^Candidates \(\d+\)$/ });

    fireEvent.change(picker.getByLabelText("Search by title…"), {
      target: { value: "Migration" },
    });
    picker.getByRole("heading", { name: "Candidates (1)" });

    fireEvent.change(picker.getByLabelText("Search by title…"), {
      target: { value: "nothing matches this" },
    });
    picker.getByRole("heading", { name: "Candidates (0)" });
    picker.getByText("No matching item");
  });

  it("goes back to the tag's breakdown", async () => {
    const { panel } = await renderWithPanel();
    openWork();
    fireEvent.click(screen.getByRole("button", { name: /^Standup/ }));
    fireEvent.click(panel().getByRole("button", { name: "Back to this tag" }));

    panel().getByRole("region", { name: "By kind" });
  });
});

describe("ConnectScreen — bulk tag operations", () => {
  const check = (title: string) =>
    fireEvent.click(
      screen.getByRole("checkbox", { name: `Select “${title}”` }),
    );

  const checkThree = () => {
    check("Draft the PR");
    check("Standup");
    check("Migration notes");
  };

  it("adds a picked tag to each of three checked rows", async () => {
    const { ds, writes } = makeWritableDS();
    await renderScreen(ds);
    openTag("Work: 4 items");
    checkThree();

    screen.getByText("3 selected");
    fireEvent.click(screen.getByRole("button", { name: "Add a tag" }));
    fireEvent.click(
      within(
        screen.getByRole("dialog", { name: "Add a tag to the selection" }),
      ).getByRole("button", { name: "Idle" }),
    );

    await waitFor(() =>
      expect(writes.assignTagToItem).toHaveBeenCalledTimes(3),
    );
    expect(
      writes.assignTagToItem.mock.calls.map((call) => [call[1], call[2]]),
    ).toEqual([
      ["task-1", "t-idle"],
      ["event-1", "t-idle"],
      ["note-1", "t-idle"],
    ]);
    // The selection is spent once the write finishes.
    await waitFor(() => expect(screen.queryByText("3 selected")).toBeNull());
  });

  it("creates the typed tag once, then adds it to each checked row", async () => {
    const { ds, writes } = makeWritableDS();
    await renderScreen(ds);
    openTag("Work: 4 items");
    checkThree();

    fireEvent.click(screen.getByRole("button", { name: "Add a tag" }));
    fireEvent.change(screen.getByLabelText("Search or create a tag…"), {
      target: { value: "Recipes" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create “Recipes”" }));

    await waitFor(() =>
      expect(writes.assignTagToItem).toHaveBeenCalledTimes(3),
    );
    expect(writes.createWikiTagUnified).toHaveBeenCalledTimes(1);
    expect(writes.createWikiTagUnified.mock.calls[0][1]).toBe("Recipes");
  });

  it("offers no remove or move on the untagged bucket", async () => {
    await renderScreen();
    openTag("Untagged: 1 item");
    check("Untitled");

    screen.getByRole("button", { name: "Add a tag" });
    expect(
      screen.queryByRole("button", { name: "Remove this tag" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Move to another tag" }),
    ).toBeNull();
  });

  it("clears the selection on Esc", async () => {
    await renderScreen();
    openTag("Work: 4 items");
    check("Standup");
    screen.getByText("1 selected");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("1 selected")).toBeNull();
    expect(
      (
        screen.getByRole("checkbox", {
          name: "Select “Standup”",
        }) as HTMLInputElement
      ).checked,
    ).toBe(false);
  });

  it("merges a tag: every item re-filed, the old rows removed, then the tag deleted", async () => {
    const { ds, writes } = makeWritableDS();
    await renderScreen(ds);

    fireEvent.click(screen.getByRole("button", { name: "Work: Tag actions" }));
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Merge into another tag…" }),
    );
    const dialog = within(await screen.findByRole("dialog"));
    fireEvent.click(dialog.getByRole("radio", { name: "Idle" }));
    dialog.getByText("4 items move to “Idle”, and this tag is deleted.");
    fireEvent.click(dialog.getByRole("button", { name: "Merge" }));

    await waitFor(() =>
      expect(writes.softDeleteWikiTagUnified).toHaveBeenCalled(),
    );
    expect(writes.assignTagToItem).toHaveBeenCalledTimes(4);
    expect(
      writes.assignTagToItem.mock.calls.every((call) => call[2] === "t-idle"),
    ).toBe(true);
    expect(writes.unassignTagFromItem.mock.calls).toEqual([
      ["a-1"],
      ["a-2"],
      ["a-3"],
      ["a-4"],
    ]);
    expect(writes.softDeleteWikiTagUnified.mock.calls).toEqual([["t-work"]]);
  });
});

describe("ConnectScreen — what writes nothing", () => {
  it("opening a tag, and opening its editor, are navigation", async () => {
    const { ds, writes } = makeWritableDS();
    await renderScreen(ds);

    openTag("Work: 4 items");
    openEditor();

    screen.getByLabelText("Name");
    for (const method of WRITE_METHODS) {
      expect(writes[method]).not.toHaveBeenCalled();
    }
  });

  it("typing without saving leaves the tag alone", async () => {
    const { ds, writes } = makeWritableDS();
    await renderScreen(ds);
    openTag("Work: 4 items");
    openEditor();

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Work log" },
    });

    // The block says so on screen; the service has heard nothing (#715 — blur
    // stopped committing, the button is the only commit).
    screen.getByText("Unsaved");
    for (const method of WRITE_METHODS) {
      expect(writes[method]).not.toHaveBeenCalled();
    }
  });

  it("asks before a draft is thrown away by picking another tag (#740)", async () => {
    const { ds, writes } = makeWritableDS();
    await renderScreen(ds);
    openTag("Work: 4 items");
    openEditor();
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Work log" },
    });

    openTag("Untagged: 1 item");
    // The selection has NOT moved: refusing has to leave the screen as it was.
    expect(
      screen.getByRole("heading", { level: 2, name: "Work" }),
    ).toBeTruthy();
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Discard",
      }),
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Untagged" }),
    ).toBeTruthy();

    for (const method of WRITE_METHODS) {
      expect(writes[method]).not.toHaveBeenCalled();
    }
  });
});

describe("ConnectScreen — the header's totals (D1)", () => {
  it("reports the live tag and item totals, then clears them on unmount", async () => {
    const onCountsChange = vi.fn();
    const { wrapper: SyncWrapper } = createBumpableSync();
    const ds = makeDS();
    render(
      <SyncWrapper>
        <WikiTagsUnifiedProvider dataService={ds}>
          <ConnectScreen
            dataService={ds}
            onNavigateToItem={vi.fn()}
            onCountsChange={onCountsChange}
          />
        </WikiTagsUnifiedProvider>
      </SyncWrapper>,
    );
    await waitFor(() => screen.getByRole("list", { name: "Tags" }));

    // Both tags, the unused one included — the header counts the master, not
    // the rail's used run.
    //
    // AWAITED, not asserted straight after the rail appears: the report is an
    // effect, and the rail showing up is a DOM mutation. `waitFor` resolves on
    // the mutation, so on a loaded machine the assertion can run in the gap
    // before React has flushed the passive effect that makes the call — which
    // is exactly how this failed in CI while passing locally every time.
    await waitFor(() =>
      expect(onCountsChange).toHaveBeenLastCalledWith({ tags: 2, items: 5 }),
    );

    cleanup();
    expect(onCountsChange).toHaveBeenLastCalledWith(null);
  });
});
