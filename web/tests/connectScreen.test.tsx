import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
  within,
} from "@testing-library/react";
import { WikiTagsUnifiedProvider, type DataService } from "@life-editor/shared";
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
    listAllWikiTagsUnified: vi.fn().mockResolvedValue(TAGS),
    listAllTagAssignments: vi.fn().mockResolvedValue(ASSIGNMENTS),
    listAllTagConnections: vi.fn().mockResolvedValue([]),
    ...over,
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

/** The rail's rows, by their spelled-out "name: count" labels. */
const railLabels = () =>
  within(screen.getByRole("list", { name: "Tags" }))
    .getAllByRole("button")
    .map((row) => row.getAttribute("aria-label"));

beforeEach(cleanup);

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

  it("reads exactly the four item lists, once", async () => {
    const ds = makeDS();
    await renderScreen(ds);
    for (const method of [
      "fetchTodoTree",
      "fetchEvents",
      "listNotesUnified",
      "listDailiesUnified",
    ] as const) {
      expect(ds[method]).toHaveBeenCalledTimes(1);
    }
  });
});
