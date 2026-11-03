import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnalyticsStatCard } from "../src/components/Analytics/AnalyticsStatCard";
import { ScheduleTab } from "../src/components/Analytics/ScheduleTab";
import {
  OverviewTab,
  type OverviewTabLabels,
} from "../src/components/Analytics/OverviewTab";
import { SummaryRow } from "../src/components/Analytics/SummaryRow";
import { AnalyticsFilterProvider } from "../src/components/Analytics/AnalyticsFilterContext";
import type { ScheduleItem } from "../src/types/schedule";
import { formatDateKey } from "../src/utils/dateKey";

/*
 * #1480 — the tiles were sized against the WINDOW, not against the column they
 * actually live in.
 *
 * Opening the detail panel squeezes the main pane to ~660px while the viewport
 * stays 1280, so `md:` / `lg:` breakpoints kept the rows three and five across
 * in a space that fits two and the numbers were clipped ("0時間33分" →
 * "0時間3…"). The fix is a container query on the data column plus labels that
 * wrap instead of truncating.
 *
 * jsdom has NO layout (CLAUDE.md §7.1: every box measures 0), so a test cannot
 * watch a tile overflow. What it CAN pin is the wiring that decides it: the
 * column rules must be container-scoped (`@…:`) rather than viewport-scoped
 * (`md:` / `lg:`), and the label must not carry `truncate`. The pixel check
 * belongs in the browser at 660px and 1280px.
 */
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Bar: () => null,
  AreaChart: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Area: () => null,
  PieChart: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Pie: () => null,
  Cell: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

describe("stat tiles keep the words that name the number (#1480)", () => {
  it("wraps the label and subtitle, and clips only the value", () => {
    render(
      <AnalyticsStatCard
        icon={<span />}
        label="アクティブなルーティン"
        value="0時間33分"
        tone="accent"
        subtitle="80% 達成率"
      />,
    );

    const label = screen.getByText("アクティブなルーティン");
    const subtitle = screen.getByText("80% 達成率");
    const value = screen.getByText("0時間33分");

    expect(label.className).not.toContain("truncate");
    expect(subtitle.className).not.toContain("truncate");
    // The number is short and stays on one line by design; an ellipsis there
    // is the last-resort guard, not the everyday behaviour.
    expect(value.className).toContain("truncate");
  });
});

describe("tile columns follow the data column, not the window (#1480)", () => {
  function todayItem(id: string): ScheduleItem {
    return {
      id,
      date: formatDateKey(new Date()),
      title: "Event",
      startTime: "09:00",
      endTime: "10:00",
      completed: true,
      completedAt: new Date().toISOString(),
      routineId: null,
      templateId: null,
      memo: null,
      noteId: null,
      content: null,
      isDeleted: false,
      createdAt: "2020-01-01T00:00:00.000Z",
      updatedAt: "2020-01-01T00:00:00.000Z",
    } as ScheduleItem;
  }

  it("sizes the schedule tiles with container queries, not lg:", () => {
    const { container } = render(
      <AnalyticsFilterProvider>
        <ScheduleTab
          scheduleItems={[todayItem("ev-1")]}
          routines={[]}
          labels={{
            totalEvents: "イベント数",
            completedEvents: "完了",
            completionRate: "完了率",
            activeRoutines: "アクティブなルーティン",
            routineRate: "ルーティン達成率",
            empty: { title: "なし", description: "なし" },
            eventTrend: { title: "推移", completed: "完了" },
            timeDistribution: { title: "時間帯", count: "件" },
            routineCompletion: { title: "ルーティン", rate: "達成率" },
          }}
        />
      </AnalyticsFilterProvider>,
    );

    const tiles = container.querySelector("[class*='grid-cols-']");
    expect(tiles).toBeTruthy();
    const cls = tiles?.className ?? "";
    expect(cls).toContain("@4xl:grid-cols-5");
    // A viewport breakpoint here is the bug: the window is still 1280 wide
    // when the detail panel has left the column 660.
    expect(cls).not.toContain("lg:grid-cols-5");
  });
});

/*
 * #2509 — the Overview tab at a 768px window. The data column is ~300px there,
 * and two rows ignored it: the six tiles stayed two across (the work total
 * clipped to 「1時間34…」) and the Today / Weekly / Streak row was a FIXED
 * `grid-cols-3`, so each card was ~90px and 「作業時間」 / 「0時間0分」 broke.
 * Both rows now step up by container width and keep three across from @2xl,
 * which is what the full-width window shows. jsdom cannot measure, so these
 * pin the column classes; the pixels are checked in the browser at 768 / 1024.
 */
describe("overview rows step their columns by the data column (#2509)", () => {
  const HOURS = (minutes: number): string => `${Math.round(minutes)}m`;
  const LABELS: OverviewTabLabels = {
    todos: "Todos",
    events: "Events",
    notes: "Notes",
    work: "Work",
    routines: "Routines",
    tags: "Tags",
    completed: "completed",
    today: "today",
    rate: "rate",
    thisWeek: "this week",
    assigned: "assigned",
    scope: { allTime: "all time", today: "today", now: "now" },
    formatHours: HOURS,
    todayCard: {
      title: "Today card",
      workTime: "Work time",
      completedTodos: "Completed",
      pomodoroCount: "Pomodoros",
      formatHours: HOURS,
    },
    weekly: {
      title: "Weekly card",
      workTimeLabel: "Work time",
      sessionsLabel: "Sessions",
      completedLabel: "Completed",
      formatHours: HOURS,
    },
    streak: {
      title: "Streak card",
      current: "Current",
      longest: "Longest",
      formatDays: (n: number) => (n === 1 ? "day" : "days"),
      noStreak: "No streak yet",
    },
    tagUsage: {
      title: "Tag Usage",
      tag: "Tag",
      inRange: "Created in range",
      liveTotal: "Current total",
      rangeLabel: "Last 30 days",
      topOf: (shown: number, total: number) => `Top ${shown} of ${total} tags`,
      empty: { title: "No tagged items", description: "Tag something." },
    },
  };

  function renderOverview(): void {
    const now = new Date();
    render(
      <OverviewTab
        sessions={[]}
        nodes={[]}
        todayItems={[]}
        events={[]}
        notes={[]}
        routines={[]}
        tags={[]}
        assignments={[]}
        dateRange={{ start: now, end: now }}
        labels={LABELS}
      />,
    );
  }

  /** The grid that directly holds the element's card. */
  function gridOf(el: HTMLElement): string[] {
    const grid = el.closest(".grid");
    expect(grid).toBeTruthy();
    return (grid?.className ?? "").split(/\s+/);
  }

  it("stacks Today / Weekly / Streak until @2xl, then keeps three across", () => {
    renderOverview();
    const cls = gridOf(screen.getByText("Today card"));
    expect(cls).toContain("grid-cols-1");
    expect(cls).toContain("@2xl:grid-cols-3");
    // The bug: a bare grid-cols-3 holds three across at any width.
    expect(cls).not.toContain("grid-cols-3");
    // All three cards share that one grid.
    expect(gridOf(screen.getByText("Weekly card"))).toEqual(cls);
    expect(gridOf(screen.getByText("Streak card"))).toEqual(cls);
  });

  it("gives each stat tile its own row below @lg", () => {
    renderOverview();
    const cls = gridOf(screen.getByText("Todos"));
    expect(cls).toContain("grid-cols-1");
    expect(cls).toContain("@lg:grid-cols-2");
    expect(cls).toContain("@2xl:grid-cols-3");
    expect(cls).not.toContain("grid-cols-2");
  });
});

describe("numbers stay readable when the column is narrow (#2509)", () => {
  it("puts the full value on a clipped tile's title", () => {
    render(
      <AnalyticsStatCard
        icon={<span />}
        label="作業時間"
        value="123時間34分"
        tone="accent"
      />,
    );
    expect(screen.getByText("123時間34分").getAttribute("title")).toBe(
      "123時間34分",
    );
  });

  it("never breaks a summary row's value", () => {
    render(<SummaryRow label="作業時間" value="0時間0分" />);
    expect(screen.getByText("0時間0分").className).toContain(
      "whitespace-nowrap",
    );
  });
});
