import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
  within,
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

/** The rail's rows, by their spelled-out "name: count" labels. */
const railLabels = () =>
  within(screen.getByRole("list", { name: "Tags" }))
    .getAllByRole("button")
    .map((row) => row.getAttribute("aria-label"));

beforeEach(() => {
  cleanup();
  // #1473: the tag selection outlives the tree on purpose, so it must not
  // outlive a test.
  resetConnectSelection();
});

describe("ConnectScreen", () => {
  it("counts each tag off the four reads, and files the rest as untagged", async () => {
    await renderScreen();
    expect(railLabels()).toEqual([
      "Idle: 0 items",
      "Work: 4 items",
      "Untagged: 1 item",
    ]);
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

  it("routes a clicked row to the shell's item-nav with its role", async () => {
    const { onNavigateToItem } = await renderScreen();
    fireEvent.click(screen.getByRole("button", { name: "Work: 4 items" }));

    fireEvent.click(screen.getByRole("button", { name: /Draft the PR/ }));
    expect(onNavigateToItem).toHaveBeenCalledWith({
      id: "task-1",
      role: "task",
      date: undefined,
    });

    fireEvent.click(screen.getByRole("button", { name: /Migration notes/ }));
    expect(onNavigateToItem).toHaveBeenLastCalledWith({
      id: "note-1",
      role: "note",
      date: undefined,
    });
  });

  it("sends an event's date along, because the Calendar needs it to select", async () => {
    const { onNavigateToItem } = await renderScreen();
    fireEvent.click(screen.getByRole("button", { name: "Work: 4 items" }));
    fireEvent.click(screen.getByRole("button", { name: /Standup/ }));
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
    expect(screen.getByRole("button", { name: /Draft the PR/ })).toBeTruthy();
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
    expect(railLabels()).toEqual([
      "Idle: 0 items",
      "Work: 5 items",
      "Untagged: 1 item",
    ]);
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
    expect(screen.getAllByRole("button", { name: /Morning review/ })).toHaveLength(
      1,
    );
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
    fireEvent.click(screen.getByRole("button", { name: /Morning review/ }));
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
    fireEvent.click(screen.getByRole("button", { name: /Morning review/ }));
    expect(onNavigateToItem).toHaveBeenCalledWith({
      id: "event-last",
      role: "event",
      date: "2020-02-01",
    });
  });
});
