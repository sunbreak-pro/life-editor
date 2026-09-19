import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import type { ReactNode } from "react";
import type { Mock } from "vitest";
import {
  TimerProvider,
  formatDateKey,
  type DataService,
} from "@life-editor/shared";
import { stubDataService, createBumpableSync } from "./helpers";
import { WorkScreen } from "../src/work/WorkScreen";

/*
 * #1666 — the Work sidebar as two tabs. Mounted over the real TimerProvider
 * (as workScreenActions does) with the portal flattened, so the tabs are on
 * the page next to the timer.
 *
 * What is pinned: settings is the tab you land on and still edits the timer;
 * the history tab reads the log only once it is opened, and draws today's WORK
 * rows with their time range, length, linked item and that item's tags.
 */

vi.mock("@life-editor/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@life-editor/shared")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, opts?: Record<string, unknown>) =>
        opts ? `${key}|${Object.values(opts).join(",")}` : key,
      i18n: { language: "en" },
    }),
    RightSidebarPortal: ({ children }: { children: ReactNode }) => (
      <>{children}</>
    ),
  };
});

/** Today at hh:mm, local time — the helper keys days by the local calendar. */
function todayAt(hour: number, minute: number): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

function makeDs(): { ds: DataService; fns: Record<string, Mock> } {
  const fns: Record<string, Mock> = {
    fetchTimerSettings: vi.fn(async () => ({
      workDuration: 25,
      breakDuration: 5,
      longBreakDuration: 15,
      sessionsBeforeLongBreak: 4,
      autoStartBreaks: false,
      targetSessions: 4,
    })),
    fetchPomodoroPresets: vi.fn(async () => []),
    fetchTodoTree: vi.fn(async () => [
      { id: "task-1", type: "task", title: "Write the spec", isDeleted: false },
    ]),
    fetchScheduleItemsByDateRange: vi.fn(async () => [
      {
        id: "event-1",
        title: "Piano lesson",
        date: formatDateKey(new Date()),
        startTime: "18:00",
        endTime: "19:00",
        isDeleted: false,
      },
    ]),
    fetchTimerSessions: vi.fn(async () => [
      {
        id: 11,
        todoId: "task-1",
        eventId: null,
        sessionType: "WORK",
        startedAt: todayAt(9, 0),
        completedAt: todayAt(9, 25),
        duration: 1500,
        completed: true,
        label: null,
      },
      {
        id: 12,
        todoId: null,
        eventId: "event-1",
        sessionType: "WORK",
        startedAt: todayAt(10, 0),
        completedAt: todayAt(10, 10),
        duration: 600,
        completed: false,
        label: null,
      },
      {
        id: 13,
        todoId: null,
        eventId: null,
        sessionType: "BREAK",
        startedAt: todayAt(9, 25),
        completedAt: todayAt(9, 30),
        duration: 300,
        completed: true,
        label: null,
      },
    ]),
    listAllWikiTagsUnified: vi.fn(async () => [
      {
        id: "tag-1",
        name: "writing",
        color: null,
        icon: null,
        isDeleted: false,
      },
    ]),
    listAllTagAssignments: vi.fn(async () => [
      { id: "wta-1", itemId: "task-1", tagId: "tag-1", isDeleted: false },
    ]),
    updateTimerSettings: vi.fn(async () => undefined),
  };
  return { ds: stubDataService(fns) as DataService, fns };
}

const { wrapper: SyncWrapper } = createBumpableSync();

async function renderWork() {
  const harness = makeDs();
  render(
    <SyncWrapper>
      <TimerProvider dataService={harness.ds}>
        <WorkScreen dataService={harness.ds} />
      </TimerProvider>
    </SyncWrapper>,
  );
  await screen.findByRole("button", { name: "work.controls.reset" });
  return harness;
}

const openTab = (name: string) =>
  fireEvent.click(screen.getByRole("tab", { name }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Work sidebar tabs (#1666)", () => {
  it("opens on the timer settings tab without reading the session log", async () => {
    const { fns } = await renderWork();
    const tablist = screen.getByRole("tablist", {
      name: "work.sidebarTabs.label",
    });
    expect(
      within(tablist)
        .getAllByRole("tab")
        .map((tab) => tab.textContent),
    ).toEqual(["work.sidebarTabs.settings", "work.sidebarTabs.history"]);
    screen.getByText("pomodoro.title");
    expect(fns.fetchTimerSessions).not.toHaveBeenCalled();
  });

  it("switches to the history tab and lists today's WORK sessions", async () => {
    const { fns } = await renderWork();
    openTab("work.sidebarTabs.history");

    const rows = await screen.findAllByTestId("work-history-row");
    expect(fns.fetchTimerSessions).toHaveBeenCalledTimes(1);
    // The BREAK row is not work.
    expect(rows).toHaveLength(2);
    expect(screen.queryByText("pomodoro.title")).toBeNull();
    screen.getByText("work.history.today");

    within(rows[0]).getByText("09:00–09:25");
    within(rows[0]).getByText("work.history.minutes|25");
    within(rows[0]).getByText("Write the spec");
    within(rows[0]).getByText("writing");

    within(rows[1]).getByText("10:00–10:10");
    within(rows[1]).getByText("work.history.minutes|10");
    within(rows[1]).getByText("Piano lesson");
  });

  it("goes back to the settings editor", async () => {
    const { fns } = await renderWork();
    openTab("work.sidebarTabs.history");
    await screen.findAllByTestId("work-history-row");
    openTab("work.sidebarTabs.settings");
    screen.getByText("pomodoro.title");
    expect(fns.updateTimerSettings).not.toHaveBeenCalled();
  });
});
