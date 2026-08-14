import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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
 * Adding to today from the paper (#623).
 *
 * The point of the「+」is that settling the day no longer means a round trip
 * to Schedule, so what is worth asserting is the wiring rather than the form:
 * the panel opens on the paper's OWN day, the write goes to that day, and the
 * new row is on the paper without waiting for a reload.
 *
 * The form itself is Schedule's <ItemCreatePanel>, already covered by its own
 * suite — this drives it only through its visible controls.
 */

const TODAY = todayDateKey();

const EXISTING = {
  id: "s1",
  date: TODAY,
  title: "Dentist",
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
} as ScheduleItem;

/** An unscheduled leaf todo — the pool the "existing todo" source offers. */
const UNPLACED = {
  id: "t-free",
  type: "task",
  title: "Draft the proposal",
  status: "NOT_STARTED",
  parentId: null,
  order: 0,
  createdAt: "2026-08-10T00:00:00.000Z",
  updatedAt: "2026-08-10T00:00:00.000Z",
} as TodoNode;

function makeDS(over: Partial<DataService> = {}): DataService {
  return stubDataService({
    fetchScheduleItemsByDate: vi
      .fn()
      .mockImplementation((date: string) =>
        Promise.resolve(date === TODAY ? [EXISTING] : []),
      ),
    fetchTodoTree: vi.fn().mockResolvedValue([UNPLACED]),
    fetchTimerSessions: vi.fn().mockResolvedValue([]),
    getDailyByDateUnified: vi.fn().mockResolvedValue(null),
    listNotesUnified: vi.fn().mockResolvedValue([]),
    listAllTagConnections: vi.fn().mockResolvedValue([]),
    createScheduleItem: vi
      .fn()
      .mockImplementation((id: string, date: string, title: string) =>
        Promise.resolve({ ...EXISTING, id, date, title }),
      ),
    createTodo: vi
      .fn()
      .mockImplementation((node: TodoNode) => Promise.resolve(node)),
    updateTodo: vi
      .fn()
      .mockImplementation((id: string, patch: Partial<TodoNode>) =>
        Promise.resolve({ ...UNPLACED, id, ...patch }),
      ),
    createNoteUnified: vi.fn(),
    createItemLink: vi.fn(),
    ...over,
  });
}

function renderScreen(ds: DataService, onNavigate = vi.fn()) {
  const value: WebSyncContextValue = {
    syncVersion: 0,
    domainVersions: Object.fromEntries(
      SYNC_DOMAINS.map((d) => [d, 0]),
    ) as Record<SyncDomain, number>,
    triggerSync: async () => undefined,
  };
  render(
    <SyncContext.Provider value={value}>
      <BriefingScreen dataService={ds} onNavigate={onNavigate} tab="morning" />
    </SyncContext.Provider>,
  );
  return { onNavigate };
}

/** Open the creation panel from the paper's schedule-heading「+」. */
async function openPanel() {
  await screen.findByText("Dentist");
  fireEvent.click(
    screen.getByRole("button", { name: "Add to today's schedule" }),
  );
  return screen.findByRole("dialog");
}

function typeTitle(text: string) {
  const field = screen.getByLabelText("Title");
  fireEvent.change(field, { target: { value: text } });
}

describe("Briefing create panel (#623)", () => {
  it("creates an event on the paper's own day and shows it at once", async () => {
    const ds = makeDS();
    renderScreen(ds);
    await openPanel();

    typeTitle("Team sync");
    fireEvent.click(screen.getByRole("button", { name: "Add event" }));

    await waitFor(() => expect(ds.createScheduleItem).toHaveBeenCalled());
    const call = vi.mocked(ds.createScheduleItem).mock.calls[0];
    // (id, date, title, start, end, …) — the date is the paper's day, never a
    // value picked in the panel: there is no date field.
    expect(call[1]).toBe(TODAY);
    expect(call[2]).toBe("Team sync");

    // On the paper without a reload, and the panel is gone.
    expect(await screen.findByText("Team sync")).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("creates a todo scheduled into today's window", async () => {
    const ds = makeDS();
    renderScreen(ds);
    await openPanel();

    fireEvent.click(screen.getByRole("tab", { name: "Todo" }));
    typeTitle("Write the deck");
    fireEvent.click(screen.getByRole("button", { name: "Add todo" }));

    await waitFor(() => expect(ds.createTodo).toHaveBeenCalled());
    const node = vi.mocked(ds.createTodo).mock.calls[0][0];
    expect(node.title).toBe("Write the deck");
    expect(node.scheduledAt?.slice(0, 10)).toBe(TODAY);
    // A todo given a concrete window is not an all-day candidate.
    expect(node.isAllDay).toBe(false);
    expect(await screen.findByText("Write the deck")).toBeTruthy();
  });

  it("places an existing todo into today", async () => {
    const ds = makeDS();
    renderScreen(ds);
    await openPanel();

    fireEvent.click(screen.getByRole("tab", { name: "Todo" }));
    fireEvent.click(screen.getByRole("radio", { name: "From existing" }));
    fireEvent.click(screen.getByRole("option", { name: "Draft the proposal" }));
    fireEvent.click(screen.getByRole("button", { name: "Place at this time" }));

    await waitFor(() => expect(ds.updateTodo).toHaveBeenCalled());
    const [id, patch] = vi.mocked(ds.updateTodo).mock.calls[0];
    expect(id).toBe("t-free");
    expect(patch.scheduledAt?.slice(0, 10)).toBe(TODAY);
    expect(patch.isAllDay).toBe(false);
    expect(ds.createTodo).not.toHaveBeenCalled();
  });

  it("'add and open' creates, then hands over to Schedule", async () => {
    const ds = makeDS();
    const { onNavigate } = renderScreen(ds);
    await openPanel();

    typeTitle("Review call");
    fireEvent.click(screen.getByRole("button", { name: "Add and edit" }));

    await waitFor(() => expect(ds.createScheduleItem).toHaveBeenCalled());
    // The paper has no event editor of its own, so "open" means the section
    // that does — named in the target-IA destination vocabulary (#676 (b)):
    // the Schedule section, on its Calendar tab.
    expect(onNavigate).toHaveBeenCalledWith({
      section: "schedule",
      tab: "calendar",
    });
  });

  it("writes nothing when the panel is dismissed", async () => {
    const ds = makeDS();
    renderScreen(ds);
    await openPanel();

    typeTitle("Never mind");
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(ds.createScheduleItem).not.toHaveBeenCalled();
    expect(ds.createTodo).not.toHaveBeenCalled();
  });
});
