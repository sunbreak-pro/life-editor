import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import {
  SyncContext,
  SYNC_DOMAINS,
  ToastProvider,
  todayDateKey,
  type DataService,
  type ScheduleItem,
  type SyncDomain,
  type TodoNode,
  type WebSyncContextValue,
} from "@life-editor/shared";
import { stubDataService } from "./helpers";
import { BriefingScreen } from "../src/briefing/BriefingScreen";

/*
 * A deleted row says so, and says how to bring it back (#1825).
 *
 * The delete was already reversible — both handlers file an undo command — but
 * the screen said nothing: the row vanished with no dialog and no status
 * message, while the same data deleted from Materials asks first. The paper
 * keeps its one-press delete; what it owed the reader was the receipt.
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

function todoNode(over: Partial<TodoNode> & { id: string }) {
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
  } as TodoNode;
}

const EVENT = scheduleItem({ id: "s-manual", title: "Dentist" });
const ROUTINE = scheduleItem({
  id: "s-routine",
  title: "Morning stretch",
  startTime: "07:00",
  endTime: "07:15",
  routineId: "r1",
});
const TODO = todoNode({ id: "t1", title: "Write report" });

function makeDS(): DataService {
  return stubDataService({
    fetchScheduleItemsByDate: vi
      .fn()
      .mockImplementation((date: string) =>
        Promise.resolve(date === TODAY ? [EVENT, ROUTINE] : []),
      ),
    fetchTodoTree: vi.fn().mockResolvedValue([TODO]),
    fetchTimerSessions: vi.fn().mockResolvedValue([]),
    getDailyByDateUnified: vi.fn().mockResolvedValue(null),
    listNotesUnified: vi.fn().mockResolvedValue([]),
    listAllTagConnections: vi.fn().mockResolvedValue([]),
    softDeleteScheduleItem: vi.fn().mockResolvedValue(undefined),
    softDeleteTodo: vi.fn().mockResolvedValue(undefined),
  });
}

function renderScreen() {
  const value: WebSyncContextValue = {
    syncVersion: 0,
    domainVersions: Object.fromEntries(
      SYNC_DOMAINS.map((d) => [d, 0]),
    ) as Record<SyncDomain, number>,
    triggerSync: async () => undefined,
  };
  return render(
    <SyncContext.Provider value={value}>
      <ToastProvider>
        <BriefingScreen
          dataService={makeDS()}
          onNavigate={vi.fn()}
          tab="morning"
        />
      </ToastProvider>
    </SyncContext.Provider>,
  );
}

/** The delete button of the row whose title is `title`. */
function deleteButtonOf(title: string, hint: string): HTMLElement {
  const row = screen.getByText(title).closest("li");
  if (row === null) throw new Error(`no row for ${title}`);
  const button = row.querySelector(`button[title="${hint}"]`);
  if (button === null) throw new Error(`no delete button for ${title}`);
  return button as HTMLElement;
}

describe("Briefing row delete receipt (#1825)", () => {
  it("names the deleted event and the way back", async () => {
    renderScreen();
    await screen.findByText("Dentist");

    fireEvent.click(deleteButtonOf("Dentist", "Delete this event"));

    const toast = await screen.findByRole("status");
    expect(toast.textContent).toContain("Dentist");
    // The undo already existed; the toast is what puts it on screen.
    expect(toast.textContent).toContain("Undo");
  });

  it("names the deleted todo too", async () => {
    renderScreen();
    await screen.findByText("Write report");

    fireEvent.click(deleteButtonOf("Write report", "Delete this todo"));

    const toast = await screen.findByRole("status");
    expect(toast.textContent).toContain("Write report");
  });

  it("stays quiet where a dialog already asks", async () => {
    // A routine-derived row goes through the this/future/all chooser (#585),
    // so the reader has already been asked — a receipt on TOP of that would
    // be a second answer to a question they just answered.
    renderScreen();
    await screen.findByText("Morning stretch");

    fireEvent.click(deleteButtonOf("Morning stretch", "Delete this event"));

    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
    expect(screen.queryByRole("status")).toBeNull();
  });
});
