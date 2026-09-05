import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnalyticsStatCard } from "../src/components/Analytics/AnalyticsStatCard";
import { ScheduleTab } from "../src/components/Analytics/ScheduleTab";
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
