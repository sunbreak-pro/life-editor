import { describe, it, expect, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { useState } from "react";
import {
  MonthGrid,
  type AgendaItem,
  type MonthGridItem,
} from "@life-editor/shared";
import { ScheduleSidebar } from "../src/schedule/ScheduleSidebar";
import type { ScheduleSidebarTabId } from "../src/schedule/ScheduleSidebar";
import { rowsOnDay, useFlowDay } from "../src/schedule/useFlowDay";

/*
 * #1973 (D-20260922-sched-1 = B) — a Desktop month cell's "他 N 件" points the
 * detail panel's flow tab at that day, and the tab offers a way back to today.
 *
 * CalendarTab itself needs the full Provider chain plus real layout, so no web
 * test mounts it (rules/frontend.md §テスト環境の制約). The decision lives in
 * useFlowDay and is pinned directly below; the last block then drives the real
 * MonthGrid button and the real ScheduleSidebar through that hook, folded the
 * way CalendarTab folds them.
 */

vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@life-editor/shared")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("../src/wikitag/TagPicker", () => ({
  TagPicker: ({ itemId }: { itemId: string }) => <span>tag:{itemId}</span>,
}));

const TODAY = "2026-07-09";
// July 2026 with a Sunday start: the grid runs from 6/28 to 8/1.
const RANGE = { rangeStart: "2026-06-28", rangeEnd: "2026-08-01" };

function hookArgs(
  over: Partial<Parameters<typeof useFlowDay>[0]> = {},
): Parameters<typeof useFlowDay>[0] {
  return {
    isWide: true,
    today: TODAY,
    ...RANGE,
    setSidebarTab: vi.fn(),
    openSidebar: vi.fn(),
    ...over,
  };
}

describe("useFlowDay (#1973)", () => {
  it("starts on today", () => {
    const { result } = renderHook(() => useFlowDay(hookArgs()));
    expect(result.current.day).toBeNull();
  });

  it("points the tab at the pressed day, forces the flow tab and opens the panel", () => {
    const args = hookArgs();
    const { result } = renderHook(() => useFlowDay(args));

    act(() => result.current.showDay("2026-07-20"));

    expect(result.current.day).toBe("2026-07-20");
    // The panel remembers its tab, so a press made while 繰り返し was showing
    // would otherwise fill a list nobody is looking at.
    expect(args.setSidebarTab).toHaveBeenCalledWith("flow");
    expect(args.openSidebar).toHaveBeenCalledTimes(1);
  });

  it("still points the tab with no panel to open", () => {
    const { result } = renderHook(() =>
      useFlowDay(hookArgs({ openSidebar: undefined })),
    );
    act(() => result.current.showDay("2026-07-20"));
    expect(result.current.day).toBe("2026-07-20");
  });

  it("goes back to today", () => {
    const { result } = renderHook(() => useFlowDay(hookArgs()));
    act(() => result.current.showDay("2026-07-20"));
    act(() => result.current.backToToday());
    expect(result.current.day).toBeNull();
  });

  it("reads a press on today as today", () => {
    // The tab is already showing today; a way back to where it already is
    // would be a button that does nothing.
    const { result } = renderHook(() => useFlowDay(hookArgs()));
    act(() => result.current.showDay(TODAY));
    expect(result.current.day).toBeNull();
  });

  it("leaves narrow on its own anchor-day list", () => {
    // Narrow's flow tab already follows the anchor (#1148).
    const { result } = renderHook(() =>
      useFlowDay(hookArgs({ isWide: false })),
    );
    act(() => result.current.showDay("2026-07-20"));
    expect(result.current.day).toBeNull();
  });

  it("lets go of the day once the grid moves away from it, and does not bring it back", () => {
    // The tab lists rows from the grid's fetch window. Off that window the day
    // would read as empty whatever is on it.
    const { result, rerender } = renderHook(
      (props: Parameters<typeof useFlowDay>[0]) => useFlowDay(props),
      { initialProps: hookArgs() },
    );
    act(() => result.current.showDay("2026-07-20"));

    rerender(hookArgs({ rangeStart: "2026-08-30", rangeEnd: "2026-10-03" }));
    expect(result.current.day).toBeNull();

    // Paging back to July: a list nobody asked for must not reappear.
    rerender(hookArgs());
    expect(result.current.day).toBeNull();
  });

  it("keeps a spillover day the next month still draws", () => {
    // Pressing 7/30 and then paging to August: the August grid starts on 7/26,
    // so that day is still on screen and still fetched.
    const { result, rerender } = renderHook(
      (props: Parameters<typeof useFlowDay>[0]) => useFlowDay(props),
      { initialProps: hookArgs() },
    );
    act(() => result.current.showDay("2026-07-30"));
    rerender(hookArgs({ rangeStart: "2026-07-26", rangeEnd: "2026-09-05" }));
    expect(result.current.day).toBe("2026-07-30");
  });
});

describe("rowsOnDay (#1973)", () => {
  it("returns every item and chip on the day, with no fold", () => {
    const items = [
      { id: "a", date: "2026-07-20" },
      { id: "b", date: "2026-07-20" },
      { id: "c", date: "2026-07-20" },
      { id: "d", date: "2026-07-20" },
      { id: "x", date: "2026-07-21" },
    ];
    const chips = [
      { id: "todo-1", date: "2026-07-20" },
      { id: "todo-2", date: "2026-07-19" },
    ];

    const rows = rowsOnDay(items, chips, "2026-07-20");

    expect(rows.items.map((i) => i.id)).toEqual(["a", "b", "c", "d"]);
    expect(rows.chips.map((c) => c.id)).toEqual(["todo-1"]);
  });
});

/*
 * The whole gesture, through the real parts: the MonthGrid's "他 N 件" button,
 * the hook, and the flow tab. The fold below copies CalendarTab's for the four
 * fields it touches (label, agenda, now-line, way back).
 */

const DAY = "2026-07-20";
const ROWS: Array<MonthGridItem & AgendaItem> = [
  ["e1", "Stand-up", "09:00", "09:15"],
  ["e2", "Design review", "10:00", "11:00"],
  ["e3", "Lunch with Aki", "12:00", "13:00"],
  ["e4", "Dentist", "15:00", "16:00"],
].map(([id, title, startTime, endTime]) => ({
  id,
  title,
  startTime,
  endTime,
  date: DAY,
  variant: "event" as const,
}));
const TODAY_ROW: MonthGridItem & AgendaItem = {
  id: "t1",
  title: "Today's gym",
  startTime: "07:00",
  endTime: "08:00",
  date: TODAY,
  variant: "event",
};

function Harness({
  initialTab = "repeats",
}: {
  initialTab?: ScheduleSidebarTabId;
}) {
  const [tab, setTab] = useState<ScheduleSidebarTabId>(initialTab);
  const flowDay = useFlowDay({
    isWide: true,
    today: TODAY,
    ...RANGE,
    setSidebarTab: setTab,
  });
  const shown = flowDay.day ?? TODAY;
  const agenda = rowsOnDay([...ROWS, TODAY_ROW], [], shown).items;

  return (
    <>
      <MonthGrid
        monthKey={TODAY}
        items={[...ROWS, TODAY_ROW]}
        todayKey={TODAY}
        weekdayLabels={["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]}
        onSelectDay={() => {}}
        onSelectItem={() => {}}
        formatMoreCount={(n) => `+${n} more`}
        onShowMore={flowDay.showDay}
        formatShowMoreLabel={(k) => `Show all on ${k}`}
      />
      <ScheduleSidebar
        isWide
        tabs={[
          { id: "flow", label: "Flow" },
          { id: "todo", label: "Todo" },
          { id: "repeats", label: "Repeats" },
        ]}
        tab={tab}
        onTabChange={setTab}
        flow={{
          todayLabel: flowDay.day === null ? "today-label" : `day:${shown}`,
          agenda,
          agendaLabels: {
            allDay: "All-day",
            empty: "empty",
            nowLabel: "now-line",
            todoStatus: "Status",
            todoStatusLabels: {
              statusNotStarted: "Not started",
              statusDone: "Done",
            },
          },
          nowMinutes: flowDay.day === null ? 600 : null,
          selectedId: null,
          skipped: [],
          summaryRows: [],
          onToggleComplete: vi.fn(),
          onItemActivate: vi.fn(),
          onItemDoubleClick: vi.fn(),
          onRestoreSkipped: vi.fn(),
          onBackToToday: flowDay.day === null ? undefined : flowDay.backToToday,
          backToTodayLabel: "back-to-today",
        }}
        repeats={{
          hidden: false,
          rows: [],
          onOpen: vi.fn(),
          onDelete: vi.fn(),
          onShowHidden: vi.fn(),
        }}
        todo={{
          placed: [],
          unplaced: [],
          addable: [],
          onToggleComplete: vi.fn(),
          onAddCandidate: vi.fn(),
          onMoveOut: vi.fn(),
          onOpenTodo: vi.fn(),
          onOpenAddable: vi.fn(),
          onDelete: vi.fn(),
          onAdd: vi.fn(),
          onAddToday: vi.fn(),
          filter: {
            scope: "both",
            setScope: vi.fn(),
            tagIds: [],
            toggleTag: vi.fn(),
            clear: vi.fn(),
            activeCount: 0,
            showToday: true,
            showOther: true,
            apply: (rows) => rows,
          },
          filterTags: [],
        }}
      />
    </>
  );
}

describe("Month's 他 N 件 → the flow tab (#1973)", () => {
  const count = (title: string) => screen.queryAllByText(title).length;

  it("keeps the month on screen and lists every row of the pressed day", () => {
    render(<Harness />);
    // Before the press the cell draws two of the four and folds the rest.
    expect(count("Lunch with Aki")).toBe(0);
    expect(count("Dentist")).toBe(0);

    fireEvent.click(screen.getByRole("button", { name: `Show all on ${DAY}` }));

    // The month is still the view: its cells are still drawn.
    expect(screen.getAllByRole("gridcell").length).toBeGreaterThanOrEqual(35);
    // The tab switched from 繰り返し to the flow and names the day.
    expect(screen.getByText(`day:${DAY}`)).toBeTruthy();
    // All four rows are listed. The two the cell drew show twice (cell +
    // list); the two it folded show once (list only).
    expect(count("Stand-up")).toBe(2);
    expect(count("Design review")).toBe(2);
    expect(count("Lunch with Aki")).toBe(1);
    expect(count("Dentist")).toBe(1);
    // Today's row stays on its cell only, and the now-line is gone.
    expect(count("Today's gym")).toBe(1);
    expect(screen.queryByText("now-line")).toBeNull();
  });

  it("goes back to today from the tab", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: `Show all on ${DAY}` }));

    fireEvent.click(screen.getByRole("button", { name: "back-to-today" }));

    expect(screen.getByText("today-label")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "back-to-today" })).toBeNull();
    expect(count("Today's gym")).toBe(2);
    expect(count("Dentist")).toBe(0);
    expect(screen.getByText("now-line")).toBeTruthy();
  });

  it("offers no way back while the tab is already on today", () => {
    render(<Harness initialTab="flow" />);
    expect(screen.getByText("today-label")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "back-to-today" })).toBeNull();
  });
});
