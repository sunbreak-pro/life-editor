import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
  within,
} from "@testing-library/react";
import {
  ItemPanelProvider,
  WikiTagsUnifiedProvider,
  resetConnectSelection,
  useItemPanelContext,
  type DataService,
} from "@life-editor/shared";
import { ConnectScreen } from "../src/connect/ConnectScreen";
import { createBumpableSync, stubDataService } from "./helpers";

/*
 * The tag hub's rows after the Claude Design prototype (#2224), through the
 * real host: which day and time each kind puts at its left edge, the order
 * that day gives, the note excerpt read, a done todo, the round checkbox's
 * write, and a right-click opening the Schedule's editor over this screen.
 *
 * The derivation's ordering rule is pinned on the pure function as well
 * (shared/tests/tagHubModel.test.ts); this suite pins that the HOST feeds it
 * the right day per kind.
 *
 * Times are built from local Date parts, so the "local day / HH:MM" the host
 * derives is the same in any time zone the suite runs in.
 */

const local = (y: number, m: number, d: number, h: number, min: number) =>
  new Date(y, m - 1, d, h, min).toISOString();

const TAGS = [
  { id: "t-work", name: "Work", color: null, icon: null, isDeleted: false },
];

const IDS = [
  "task-done",
  "task-open",
  "task-undated",
  "event-1",
  "event-allday",
  "event-rep",
  "note-1",
  "daily-2026-08-26",
];

const ASSIGNMENTS = IDS.map((itemId, i) => ({
  id: `a-${i}`,
  itemId,
  tagId: "t-work",
  isDeleted: false,
}));

function makeDS(over: Partial<Record<keyof DataService, unknown>> = {}) {
  return stubDataService({
    fetchTodoTree: vi.fn().mockResolvedValue([
      {
        id: "task-undated",
        title: "Someday",
        status: "NOT_STARTED",
      },
      {
        id: "task-open",
        title: "Draft the PR",
        status: "NOT_STARTED",
        scheduledAt: local(2026, 8, 29, 9, 30),
        scheduledEndAt: local(2026, 8, 29, 10, 30),
      },
      {
        id: "task-done",
        title: "Ship it",
        status: "DONE",
        scheduledAt: local(2026, 8, 20, 10, 0),
        scheduledEndAt: local(2026, 8, 20, 11, 0),
      },
    ]),
    fetchEvents: vi.fn().mockResolvedValue([
      {
        id: "event-rep",
        title: "Review",
        date: "2026-08-30",
        startTime: "18:00",
        endTime: "19:00",
        routineId: "routine-x",
      },
      {
        id: "event-1",
        title: "Standup",
        date: "2026-08-29",
        startTime: "09:00",
        endTime: "09:15",
        routineId: null,
      },
      {
        id: "event-allday",
        title: "Offsite",
        date: "2026-08-28",
        startTime: "00:00",
        endTime: "00:00",
        isAllDay: true,
        routineId: null,
      },
    ]),
    listNotesUnified: vi.fn().mockResolvedValue([
      {
        id: "note-1",
        title: "Migration notes",
        updatedAt: local(2026, 8, 27, 14, 5),
      },
    ]),
    listNoteExcerptsUnified: vi
      .fn()
      .mockResolvedValue([{ id: "note-1", excerpt: "Start with the schema" }]),
    listDailiesUnified: vi
      .fn()
      .mockResolvedValue([{ id: "daily-2026-08-26", date: "2026-08-26" }]),
    fetchAllRoutines: vi.fn().mockResolvedValue([]),
    fetchNoteTables: vi.fn().mockResolvedValue([]),
    // The full-body reads — the hub must not touch either (#2224).
    getNoteUnified: vi.fn(),
    getNoteBodyUnified: vi.fn(),
    updateTodo: vi.fn(async (id: string, patch: object) => ({ id, ...patch })),
    listAllWikiTagsUnified: vi.fn().mockResolvedValue(TAGS),
    listAllTagAssignments: vi.fn().mockResolvedValue(ASSIGNMENTS),
    listAllTagConnections: vi.fn().mockResolvedValue([]),
    ...over,
  });
}

/** Prints the item panel's open request, the way the shell's host reads it. */
function PanelRequestProbe() {
  const { request } = useItemPanelContext();
  return (
    <output aria-label="Panel request">
      {request?.mode === "edit" ? JSON.stringify(request.target) : ""}
    </output>
  );
}

async function renderWork(
  ds: DataService = makeDS(),
  tagLabel = "Work: 8 items",
) {
  const onNavigateToItem = vi.fn();
  const { wrapper: SyncWrapper } = createBumpableSync();
  render(
    <SyncWrapper>
      <ItemPanelProvider>
        <WikiTagsUnifiedProvider dataService={ds}>
          <ConnectScreen dataService={ds} onNavigateToItem={onNavigateToItem} />
        </WikiTagsUnifiedProvider>
        <PanelRequestProbe />
      </ItemPanelProvider>
    </SyncWrapper>,
  );
  await waitFor(() => screen.getByRole("list", { name: "Tags" }));
  fireEvent.click(screen.getByRole("button", { name: tagLabel }));
  return { ds, onNavigateToItem };
}

const row = (id: string): HTMLElement => {
  const el = document.querySelector(`[data-taghub-row="${id}"]`);
  if (!(el instanceof HTMLElement)) throw new Error(`no row ${id}`);
  return el;
};

const leftEdge = (id: string): HTMLElement => {
  const el = row(id).querySelector("[data-taghub-when]");
  if (!(el instanceof HTMLElement)) throw new Error(`no left edge on ${id}`);
  return el;
};

const rowIds = (role: string) =>
  [
    ...document.querySelectorAll(
      `[data-taghub-group="${role}"] [data-taghub-row]`,
    ),
  ].map((el) => el.getAttribute("data-taghub-row"));

const panelRequest = () =>
  JSON.parse(screen.getByLabelText("Panel request").textContent || "null");

beforeEach(() => {
  cleanup();
  resetConnectSelection();
});

describe("ConnectScreen rows — frames and the left edge (#2224)", () => {
  it("puts each kind in a frame of its own, headed by kind and count", async () => {
    await renderWork();
    const frames = [...document.querySelectorAll("section[data-taghub-group]")];
    expect(frames.map((f) => f.getAttribute("data-taghub-group"))).toEqual([
      "task",
      "event",
      "note",
      "daily",
    ]);
    expect(
      frames.map((f) =>
        within(f as HTMLElement)
          .getByRole("heading", { level: 3 })
          .getAttribute("aria-label"),
      ),
    ).toEqual([
      "Todo: 3 items",
      "Event: 3 items",
      "Note: 1 item",
      "Daily: 1 item",
    ]);
  });

  it("starts every row with its day, and a time under it where there is one", async () => {
    await renderWork();
    // A todo: its scheduled day and start.
    expect(leftEdge("task-open").textContent).toContain("8/29");
    expect(leftEdge("task-open").textContent).toContain("09:30");
    // …and one set for no day says so.
    expect(leftEdge("task-undated").textContent).toBe("No date");
    // An event: its day and start, or "All day".
    expect(leftEdge("event-1").textContent).toContain("8/29");
    expect(leftEdge("event-1").textContent).toContain("09:00");
    expect(leftEdge("event-allday").textContent).toContain("All day");
    // A repeat carries the repeat glyph; a one-off does not.
    expect(leftEdge("event-rep").querySelector("svg")).not.toBeNull();
    expect(leftEdge("event-1").querySelector("svg")).toBeNull();
    // A note: when it was last updated.
    expect(leftEdge("note-1").textContent).toContain("8/27");
    expect(leftEdge("note-1").textContent).toContain("14:05");
    // A daily: its date only, with its icon.
    expect(leftEdge("daily-2026-08-26").textContent).toContain("8/26");
    expect(leftEdge("daily-2026-08-26").querySelector("svg")).not.toBeNull();
  });

  it("shows no date at the right of a row any more", async () => {
    await renderWork();
    const DATEISH = /\d{1,2}\/\d{1,2}|\d{4}-\d{2}-\d{2}|\d{2}:\d{2}/;
    // The daily is left out: its date IS its title.
    for (const id of IDS.filter((id) => !id.startsWith("daily-"))) {
      const button = within(row(id))
        .getAllByRole("button")
        .find((b) => b.querySelector("[data-taghub-when]"));
      if (!button) throw new Error(`no row button on ${id}`);
      const rest = button.cloneNode(true) as HTMLElement;
      rest.querySelector("[data-taghub-when]")?.remove();
      rest.querySelectorAll(".sr-only").forEach((el) => el.remove());
      expect(rest.textContent).not.toMatch(DATEISH);
    }
  });

  it("orders each kind by day, oldest first, with the undated todo last", async () => {
    await renderWork();
    expect(rowIds("task")).toEqual(["task-done", "task-open", "task-undated"]);
    expect(rowIds("event")).toEqual(["event-allday", "event-1", "event-rep"]);
  });
});

describe("ConnectScreen rows — the note excerpt (#2224)", () => {
  it("shows the first line under the title, without reading any body", async () => {
    const { ds } = await renderWork();
    within(row("note-1")).getByText("Start with the schema");
    expect(ds.listNoteExcerptsUnified).toHaveBeenCalledTimes(1);
    expect(ds.getNoteUnified).not.toHaveBeenCalled();
    expect(ds.getNoteBodyUnified).not.toHaveBeenCalled();
  });

  it("keeps the hub up when the excerpt read fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      await renderWork(
        makeDS({
          listNoteExcerptsUnified: vi
            .fn()
            .mockRejectedValue(new Error("offline")),
        }),
      );
      within(row("note-1")).getByText("Migration notes");
      expect(screen.queryByText("Start with the schema")).toBeNull();
    } finally {
      warn.mockRestore();
    }
  });
});

describe("ConnectScreen rows — done todos and the round checkbox (#2224)", () => {
  it("strikes a done todo through and tags it Done", async () => {
    await renderWork();
    const done = within(row("task-done"));
    expect(done.getByTitle("Ship it").className).toContain("line-through");
    done.getByText("Done");
    expect(
      done
        .getByRole("checkbox", { name: "Ship it — Status: Done" })
        .getAttribute("aria-checked"),
    ).toBe("true");
    // An open todo is neither.
    const open = within(row("task-open"));
    expect(open.getByTitle("Draft the PR").className).not.toContain(
      "line-through",
    );
    expect(open.queryByText("Done")).toBeNull();
  });

  it("completes a todo in place with one write", async () => {
    const { ds, onNavigateToItem } = await renderWork();
    const box = within(row("task-open")).getByRole("checkbox", {
      name: "Draft the PR — Status: Not started",
    });
    fireEvent.click(box);

    // Painted at once, before the write settles.
    expect(
      within(row("task-open"))
        .getByRole("checkbox", { name: "Draft the PR — Status: Done" })
        .getAttribute("aria-checked"),
    ).toBe("true");
    await waitFor(() => expect(ds.updateTodo).toHaveBeenCalledTimes(1));
    expect(ds.updateTodo).toHaveBeenCalledWith("task-open", {
      status: "DONE",
      completedAt: expect.any(String),
    });
    // The tick is a write, not a way out of the hub.
    expect(onNavigateToItem).not.toHaveBeenCalled();
    await waitFor(() => within(row("task-open")).getByText("Done"));
  });
});

describe("ConnectScreen rows — right-click edits in place (#2224)", () => {
  it("opens a todo's editor over the hub, keeping the browser menu out", async () => {
    const { onNavigateToItem } = await renderWork();
    // fireEvent returns false when the handler prevented the default.
    expect(fireEvent.contextMenu(row("task-open"))).toBe(false);
    expect(panelRequest()).toEqual({ role: "task", id: "task-open" });
    expect(onNavigateToItem).not.toHaveBeenCalled();
    // Still on the hub.
    screen.getByRole("list", { name: "Tags" });
  });

  it("opens an event's editor on the event's own day", async () => {
    const { onNavigateToItem } = await renderWork();
    fireEvent.contextMenu(row("event-1"));
    expect(panelRequest()).toEqual({
      role: "event",
      id: "event-1",
      date: "2026-08-29",
    });
    expect(onNavigateToItem).not.toHaveBeenCalled();
  });

  it("opens a note on its own screen, where notes are edited", async () => {
    const { onNavigateToItem } = await renderWork();
    fireEvent.contextMenu(row("note-1"));
    expect(screen.getByLabelText("Panel request").textContent).toBe("");
    expect(onNavigateToItem).toHaveBeenCalledWith({
      id: "note-1",
      role: "note",
      date: undefined,
    });
  });
});

/*
 * #2224 review — the round checkbox under failure and under two rows pressed
 * back to back. One screen-wide counter used to strand the first row's
 * overlay when a second row was pressed before the first write settled.
 */
describe("ConnectScreen rows — the round checkbox when writes go wrong (#2224)", () => {
  const statusOf = (id: string, title: string) =>
    within(row(id))
      .getByRole("checkbox", { name: new RegExp(`^${title} — Status`) })
      .getAttribute("aria-checked");

  it("takes the tick back when the write fails", async () => {
    await renderWork(
      makeDS({ updateTodo: vi.fn().mockRejectedValue(new Error("offline")) }),
    );
    fireEvent.click(
      within(row("task-open")).getByRole("checkbox", {
        name: "Draft the PR — Status: Not started",
      }),
    );
    expect(statusOf("task-open", "Draft the PR")).toBe("true");
    await waitFor(() => expect(statusOf("task-open", "Draft the PR")).toBe("false"));
  });

  it("settles each row on its own when two are pressed back to back", async () => {
    // The first row's write fails AFTER the second row was pressed.
    let failFirst: (error: Error) => void = () => undefined;
    const updateTodo = vi.fn((id: string, patch: object) =>
      id === "task-open"
        ? new Promise((_, reject) => {
            failFirst = reject;
          })
        : Promise.resolve({ id, ...patch }),
    );
    await renderWork(makeDS({ updateTodo }));

    fireEvent.click(
      within(row("task-open")).getByRole("checkbox", {
        name: "Draft the PR — Status: Not started",
      }),
    );
    fireEvent.click(
      within(row("task-done")).getByRole("checkbox", {
        name: "Ship it — Status: Done",
      }),
    );
    await waitFor(() => expect(updateTodo).toHaveBeenCalledTimes(2));
    failFirst(new Error("offline"));

    // The failed row goes back; the other keeps what was written.
    await waitFor(() => expect(statusOf("task-open", "Draft the PR")).toBe("false"));
    expect(statusOf("task-done", "Ship it")).toBe("false");
  });

  it("writes one row's presses in the order they were made", async () => {
    const order: string[] = [];
    let releaseFirst: () => void = () => undefined;
    const updateTodo = vi.fn((id: string, patch: { status: string }) => {
      order.push(`start ${patch.status}`);
      const done = () => order.push(`end ${patch.status}`);
      if (order.length === 1) {
        return new Promise((resolve) => {
          releaseFirst = () => {
            done();
            resolve({ id, ...patch });
          };
        });
      }
      done();
      return Promise.resolve({ id, ...patch });
    });
    await renderWork(makeDS({ updateTodo }));
    const box = () =>
      within(row("task-open")).getByRole("checkbox", {
        name: /^Draft the PR — Status/,
      });

    fireEvent.click(box()); // → DONE
    fireEvent.click(box()); // → NOT_STARTED, queued behind the first
    await waitFor(() => expect(updateTodo).toHaveBeenCalledTimes(1));
    releaseFirst();
    await waitFor(() => expect(updateTodo).toHaveBeenCalledTimes(2));
    expect(order).toEqual([
      "start DONE",
      "end DONE",
      "start NOT_STARTED",
      "end NOT_STARTED",
    ]);
    await waitFor(() => expect(box().getAttribute("aria-checked")).toBe("false"));
  });
});

/*
 * #2224 review — a repeat's single row (#1631) is filed under the SERIES id,
 * but the editor needs an occurrence: it opens the one the row already
 * navigates to, on that occurrence's day.
 */
describe("ConnectScreen rows — right-click on a repeat (#2224)", () => {
  it("opens the editor on the series' next occurrence", async () => {
    const { onNavigateToItem } = await renderWork(
      makeDS({
        fetchEvents: vi.fn().mockResolvedValue([
          {
            id: "occ-next",
            title: "Morning review",
            date: "2099-01-01",
            startTime: "07:00",
            endTime: "07:30",
            routineId: "routine-1",
          },
        ]),
        fetchAllRoutines: vi
          .fn()
          .mockResolvedValue([{ id: "routine-1", title: "Morning review" }]),
        listAllTagAssignments: vi.fn().mockResolvedValue([
          { id: "a-r", itemId: "routine-1", tagId: "t-work", isDeleted: false },
        ]),
      }),
      "Work: 1 item",
    );
    fireEvent.contextMenu(row("routine-1"));
    expect(panelRequest()).toEqual({
      role: "event",
      id: "occ-next",
      date: "2099-01-01",
    });
    expect(onNavigateToItem).not.toHaveBeenCalled();
  });
});
