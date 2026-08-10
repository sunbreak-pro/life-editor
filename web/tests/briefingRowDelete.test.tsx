import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import {
  SyncContext,
  SYNC_DOMAINS,
  todayDateKey,
  type DataService,
  type ScheduleItem,
  type SyncDomain,
  type TaskNode,
  type WebSyncContextValue,
} from "@life-editor/shared";
import { BriefingScreen } from "../src/briefing/BriefingScreen";

/*
 * Briefing row deletes (#585).
 *
 * The paper is the place the day gets settled, so a row you decide against has
 * to be removable there. What is worth a test is the ROUTING rather than the
 * button: which DataService call each row makes, and the fact that a
 * routine-derived row is never plain-deleted (the generator would put it
 * straight back — known-issue 017) but goes through the this/future/all
 * chooser Schedule already owns.
 *
 * Everything is driven through visible text and roles — jsdom has no layout
 * (CLAUDE.md §7.1), so nothing here may depend on coordinates.
 */

const TODAY = todayDateKey();

function scheduleItem(over: Partial<ScheduleItem> & { id: string }) {
  return {
    date: TODAY,
    title: "Manual event",
    startTime: "09:00",
    endTime: "10:00",
    completed: false,
    completedAt: null,
    routineId: null,
    templateId: null,
    memo: null,
    noteId: null,
    content: null,
    createdAt: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-08-10T00:00:00.000Z",
    ...over,
  } as ScheduleItem;
}

function taskNode(over: Partial<TaskNode> & { id: string }) {
  return {
    type: "task",
    title: "Write report",
    status: "NOT_STARTED",
    scheduledAt: `${TODAY}T00:00:00`,
    isAllDay: true,
    parentId: null,
    order: 0,
    createdAt: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-08-10T00:00:00.000Z",
    ...over,
  } as TaskNode;
}

const MANUAL = scheduleItem({ id: "s-manual", title: "Dentist" });
const ROUTINE = scheduleItem({
  id: "s-routine",
  title: "Morning stretch",
  startTime: "07:00",
  endTime: "07:15",
  routineId: "r1",
});
const TASK = taskNode({ id: "t1", title: "Write report" });

function makeDataService(over: Partial<DataService> = {}): DataService {
  return {
    fetchScheduleItemsByDate: vi
      .fn()
      .mockImplementation((date: string) =>
        Promise.resolve(date === TODAY ? [MANUAL, ROUTINE] : []),
      ),
    fetchTaskTree: vi.fn().mockResolvedValue([TASK]),
    fetchTimerSessions: vi.fn().mockResolvedValue([]),
    getDailyByDateUnified: vi.fn().mockResolvedValue(null),
    listNotesUnified: vi.fn().mockResolvedValue([]),
    listAllTagConnections: vi.fn().mockResolvedValue([]),
    softDeleteScheduleItem: vi.fn().mockResolvedValue(undefined),
    restoreScheduleItem: vi.fn().mockResolvedValue(undefined),
    dismissScheduleItem: vi.fn().mockResolvedValue(undefined),
    detachRoutine: vi
      .fn()
      .mockResolvedValue({ deletedScheduleItemIds: ["s-routine"] }),
    softDeleteRoutine: vi
      .fn()
      .mockResolvedValue({ deletedScheduleItemIds: ["s-routine"] }),
    softDeleteTask: vi.fn().mockResolvedValue(undefined),
    restoreTask: vi.fn().mockResolvedValue(undefined),
    ...over,
  } as unknown as DataService;
}

function renderScreen(ds: DataService) {
  const value: WebSyncContextValue = {
    syncVersion: 0,
    domainVersions: Object.fromEntries(
      SYNC_DOMAINS.map((d) => [d, 0]),
    ) as Record<SyncDomain, number>,
    triggerSync: async () => undefined,
  };
  return render(
    <SyncContext.Provider value={value}>
      <BriefingScreen dataService={ds} onNavigate={vi.fn()} tab="morning" />
    </SyncContext.Provider>,
  );
}

/** The delete button of the row whose title is `title`. */
function deleteButtonOf(title: string): HTMLElement {
  const row = screen.getByText(title).closest("li");
  if (row === null) throw new Error(`no row for ${title}`);
  const button = row.querySelector('button[title="Delete this event"]');
  if (button === null) throw new Error(`no delete button for ${title}`);
  return button as HTMLElement;
}

describe("Briefing row delete (#585)", () => {
  it("soft-deletes a manual schedule row and drops it from the paper", async () => {
    const ds = makeDataService();
    renderScreen(ds);
    await screen.findByText("Dentist");

    fireEvent.click(deleteButtonOf("Dentist"));

    expect(ds.softDeleteScheduleItem).toHaveBeenCalledWith("s-manual");
    await waitFor(() => expect(screen.queryByText("Dentist")).toBeNull());
    // The other row is untouched — the delete acts on one item, not the list.
    expect(screen.getByText("Morning stretch")).toBeTruthy();
  });

  it("asks which occurrences before deleting a routine row, then dismisses", async () => {
    const ds = makeDataService();
    renderScreen(ds);
    await screen.findByText("Morning stretch");

    fireEvent.click(deleteButtonOf("Morning stretch"));

    // Nothing is written until the scope is chosen — a plain delete here
    // would be revived by the generator (known-issue 017).
    expect(ds.softDeleteScheduleItem).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "This event only" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "This and following events" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "All events (including past)" }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "This event only" }));
    expect(ds.dismissScheduleItem).toHaveBeenCalledWith("s-routine");
    expect(ds.softDeleteScheduleItem).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByText("Morning stretch")).toBeNull(),
    );
  });

  it("detaches the series for 'this and following'", async () => {
    const ds = makeDataService();
    renderScreen(ds);
    await screen.findByText("Morning stretch");

    fireEvent.click(deleteButtonOf("Morning stretch"));
    fireEvent.click(
      screen.getByRole("button", { name: "This and following events" }),
    );

    expect(ds.detachRoutine).toHaveBeenCalledWith("r1", TODAY);
    expect(ds.softDeleteRoutine).not.toHaveBeenCalled();
  });

  it("soft-deletes the routine for 'all'", async () => {
    const ds = makeDataService();
    renderScreen(ds);
    await screen.findByText("Morning stretch");

    fireEvent.click(deleteButtonOf("Morning stretch"));
    fireEvent.click(
      screen.getByRole("button", { name: "All events (including past)" }),
    );

    expect(ds.softDeleteRoutine).toHaveBeenCalledWith("r1");
    expect(ds.detachRoutine).not.toHaveBeenCalled();
  });

  it("cancelling the scope chooser writes nothing", async () => {
    const ds = makeDataService();
    renderScreen(ds);
    await screen.findByText("Morning stretch");

    fireEvent.click(deleteButtonOf("Morning stretch"));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(ds.dismissScheduleItem).not.toHaveBeenCalled();
    expect(ds.detachRoutine).not.toHaveBeenCalled();
    expect(ds.softDeleteRoutine).not.toHaveBeenCalled();
    expect(screen.getByText("Morning stretch")).toBeTruthy();
  });

  it("soft-deletes a todo row and drops it from the paper", async () => {
    const ds = makeDataService();
    renderScreen(ds);
    await screen.findByText("Write report");

    const row = screen.getByText("Write report").closest("li");
    const button = row?.querySelector('button[title="Delete this todo"]');
    fireEvent.click(button as HTMLElement);

    expect(ds.softDeleteTask).toHaveBeenCalledWith("t1");
    await waitFor(() => expect(screen.queryByText("Write report")).toBeNull());
  });
});
