import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { useEffect } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  ItemPanelProvider,
  SyncContext,
  SYNC_DOMAINS,
  todayDateKey,
  useItemPanelContext,
  type DataService,
  type ItemPanelRequest,
  type ScheduleItem,
  type SyncDomain,
  type WebSyncContextValue,
} from "@life-editor/shared";
import { stubDataService } from "./helpers";
import { BriefingScreen } from "../src/briefing/BriefingScreen";

/*
 * Adding to today from the paper (#623 → #2223).
 *
 * Each column of the time table carries its own「+」, and both open
 * Schedule's creation panel IN PLACE through #2218's entry point — the paper
 * no longer mounts a creation panel of its own. What only this host decides
 * is what the panel is seeded with: the paper's own day, and the next
 * half-hour mark as the start. The panel itself (its fields, its writes) is
 * ItemPanelHost's and Schedule's, covered by their suites.
 *
 * Only `Date` is faked, so the clock reads a fixed minute while promises and
 * timers behave as they do in every other suite.
 */

function scheduleItem(date: string): ScheduleItem {
  return {
    id: "s1",
    date,
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
}

function makeDS(today: string): DataService {
  return stubDataService({
    fetchScheduleItemsByDate: vi
      .fn()
      .mockImplementation((date: string) =>
        Promise.resolve(date === today ? [scheduleItem(today)] : []),
      ),
    fetchTodoTree: vi.fn().mockResolvedValue([]),
    fetchTimerSessions: vi.fn().mockResolvedValue([]),
    getDailyByDateUnified: vi.fn().mockResolvedValue(null),
    listNotesUnified: vi.fn().mockResolvedValue([]),
    listAllTagConnections: vi.fn().mockResolvedValue([]),
  });
}

const SYNC: WebSyncContextValue = {
  syncVersion: 0,
  domainVersions: Object.fromEntries(SYNC_DOMAINS.map((d) => [d, 0])) as Record<
    SyncDomain,
    number
  >,
  triggerSync: async () => undefined,
};

let lastRequest: ItemPanelRequest | null = null;
function RequestProbe() {
  const { request } = useItemPanelContext();
  useEffect(() => {
    lastRequest = request;
  });
  return null;
}

/** Freeze the wall clock at HH:MM on a fixed day; returns the paper's day. */
function at(hours: number, minutes: number): string {
  vi.setSystemTime(new Date(2026, 9, 12, hours, minutes));
  return todayDateKey();
}

function renderScreen(today: string, withPanel = true) {
  lastRequest = null;
  const onNavigate = vi.fn();
  const paper = (
    <BriefingScreen
      dataService={makeDS(today)}
      onNavigate={onNavigate}
      tab="morning"
    />
  );
  render(
    <SyncContext.Provider value={SYNC}>
      {withPanel ? (
        <ItemPanelProvider>
          {paper}
          <RequestProbe />
        </ItemPanelProvider>
      ) : (
        paper
      )}
    </SyncContext.Provider>,
  );
  return { onNavigate };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("Briefing create panel (#623 → #2223)", () => {
  it("opens the panel on today from the events column, at the next half hour", async () => {
    const today = at(10, 10);
    const { onNavigate } = renderScreen(today);
    await screen.findByText("Dentist");
    fireEvent.click(screen.getByRole("button", { name: "Add an event" }));
    await waitFor(() => expect(lastRequest).not.toBeNull());
    expect(lastRequest).toMatchObject({
      mode: "create",
      initial: { date: today, start: "10:30", end: "11:30" },
    });
    // Opened from the paper, so the panel can hand the item on to Schedule.
    expect(lastRequest!.options.onOpenInSchedule).toBeTypeOf("function");
    expect(onNavigate).not.toHaveBeenCalled();
    // The paper's own creation dialog is gone.
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens the same panel from the todos column", async () => {
    const today = at(10, 10);
    renderScreen(today);
    await screen.findByText("Dentist");
    fireEvent.click(screen.getByRole("button", { name: "Add a todo" }));
    await waitFor(() =>
      expect(lastRequest).toMatchObject({
        mode: "create",
        initial: { date: today, start: "10:30", end: "11:30" },
      }),
    );
  });

  it("starts at the NEXT mark when the clock sits on one", async () => {
    const today = at(10, 0);
    renderScreen(today);
    await screen.findByText("Dentist");
    fireEvent.click(screen.getByRole("button", { name: "Add an event" }));
    await waitFor(() =>
      expect(lastRequest).toMatchObject({
        initial: { start: "10:30", end: "11:30" },
      }),
    );
  });

  it("keeps the start and the end inside the day late in the evening", async () => {
    const today = at(23, 20);
    renderScreen(today);
    await screen.findByText("Dentist");
    fireEvent.click(screen.getByRole("button", { name: "Add an event" }));
    await waitFor(() =>
      expect(lastRequest).toMatchObject({
        initial: { date: today, start: "23:30", end: "23:59" },
      }),
    );
  });

  it("goes to Schedule where no panel can be opened", async () => {
    const today = at(10, 10);
    const { onNavigate } = renderScreen(today, false);
    await screen.findByText("Dentist");
    fireEvent.click(screen.getByRole("button", { name: "Add an event" }));
    expect(onNavigate).toHaveBeenCalledExactlyOnceWith({ section: "schedule" });
  });
});
