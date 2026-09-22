import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  SyncContext,
  SYNC_DOMAINS,
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
 * Briefing row「編集」opens the item, not the section (#1824).
 *
 * Both rows used to call `onNavigate({ section: "schedule" })`, which lands on
 * Schedule and stops: no selection, no panel, nothing to edit — a button that
 * named an act it did not perform. The shell has carried an ITEM intent since
 * #285 (`navigateToItem`, consumed by Schedule as `pendingSelectTodoId` /
 * `pendingSelectEvent`); the fix is that the paper names its own row.
 *
 * What is worth pinning is the PAYLOAD: the row's own id, the right role, and
 * — for an event — the date, without which the Calendar would select a row on
 * whatever week happens to be open (#503).
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
const TODO = todoNode({ id: "t1", title: "Write report" });

function makeDS(): DataService {
  return stubDataService({
    fetchScheduleItemsByDate: vi
      .fn()
      .mockImplementation((date: string) =>
        Promise.resolve(date === TODAY ? [EVENT] : []),
      ),
    fetchTodoTree: vi.fn().mockResolvedValue([TODO]),
    fetchTimerSessions: vi.fn().mockResolvedValue([]),
    getDailyByDateUnified: vi.fn().mockResolvedValue(null),
    listNotesUnified: vi.fn().mockResolvedValue([]),
    listAllTagConnections: vi.fn().mockResolvedValue([]),
  });
}

function renderScreen(over: {
  onNavigate?: () => void;
  onNavigateToItem?: (t: { id: string; role: string; date?: string }) => void;
}) {
  const value: WebSyncContextValue = {
    syncVersion: 0,
    domainVersions: Object.fromEntries(
      SYNC_DOMAINS.map((d) => [d, 0]),
    ) as Record<SyncDomain, number>,
    triggerSync: async () => undefined,
  };
  return render(
    <SyncContext.Provider value={value}>
      <BriefingScreen
        dataService={makeDS()}
        onNavigate={over.onNavigate ?? vi.fn()}
        onNavigateToItem={over.onNavigateToItem}
        tab="morning"
      />
    </SyncContext.Provider>,
  );
}

/** The 編集 button of the row whose title is `title`. */
function editButtonOf(title: string, hint: string): HTMLElement {
  const row = screen.getByText(title).closest("li");
  if (row === null) throw new Error(`no row for ${title}`);
  const button = row.querySelector(`button[title="${hint}"]`);
  if (button === null) throw new Error(`no edit button for ${title}`);
  return button as HTMLElement;
}

describe("Briefing row edit (#1824)", () => {
  it("opens the todo itself", async () => {
    const onNavigateToItem = vi.fn();
    renderScreen({ onNavigateToItem });
    await screen.findByText("Write report");

    fireEvent.click(editButtonOf("Write report", "Open in Todos"));

    expect(onNavigateToItem).toHaveBeenCalledWith({ id: "t1", role: "task" });
  });

  it("opens the event itself, with the day it is on", async () => {
    const onNavigateToItem = vi.fn();
    renderScreen({ onNavigateToItem });
    await screen.findByText("Dentist");

    fireEvent.click(editButtonOf("Dentist", "Open in Schedule"));

    // The date travels with the id (#503) — the Calendar shows one window at a
    // time, so an id alone would highlight nothing.
    expect(onNavigateToItem).toHaveBeenCalledWith({
      id: "s-manual",
      role: "event",
      date: TODAY,
    });
  });

  it("still lands on the section where the host wires no item intent", async () => {
    // Tests and any host without item navigation keep the old behaviour: a
    // jump that reaches the right section beats a dead button.
    const onNavigate = vi.fn();
    renderScreen({ onNavigate });
    await screen.findByText("Write report");

    fireEvent.click(editButtonOf("Write report", "Open in Todos"));

    expect(onNavigate).toHaveBeenCalledWith({ section: "schedule" });
  });
});
