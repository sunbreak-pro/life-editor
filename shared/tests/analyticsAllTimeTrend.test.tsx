import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  AnalyticsFilterProvider,
  trendRangeDays,
  useAnalyticsFilter,
  type DatePreset,
  type DateRange,
} from "../src/components/Analytics/AnalyticsFilterContext";
import { TodosTab } from "../src/components/Analytics/TodosTab";
import {
  rollUpTrendBuckets,
  trendBucketLabel,
  trendGranularity,
  trendSpansYears,
} from "../src/utils/analyticsAggregation";
import type { TodoNode } from "../src/types/todoTree";

/*
 * #1861 — "All time" drew 2400+ daily buckets from a fixed 2020-01-01, with the
 * real data crushed into the last 10px under an axis that repeated "01-01"
 * once a year. The trend now starts on the oldest day its own data has, folds
 * long spans into week / month buckets, and puts the year on the label when
 * the series crosses one.
 *
 * recharts is stubbed the way analyticsTodoTrendRange.test.tsx does; the
 * <AreaChart> stub spills the labels it was handed.
 */
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AreaChart: ({ data }: { data: { date: string; completed: number }[] }) => (
    <div data-testid="trend">
      {data.map((d) => `${d.date}:${d.completed}`).join(",")}
    </div>
  ),
  Area: () => null,
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Bar: () => null,
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

const LABELS = {
  todoTrend: { title: "Trend", completedCount: "Completed" },
  stagnation: {
    title: "Stagnation",
    todos: "todos",
    buckets: {
      under1Week: "< 1 week",
      "1to2Weeks": "1-2 weeks",
      "2to4Weeks": "2-4 weeks",
      "1to3Months": "1-3 months",
      over3Months: "3+ months",
    },
  },
  tagTime: {
    title: "By tag",
    noData: "No data",
    untagged: "Untagged",
    other: "Other tags",
    formatHours: (minutes: number) => `${Math.round(minutes)}m`,
  },
};

function doneTask(id: string, completedAt: Date): TodoNode {
  return {
    id,
    type: "task",
    title: id,
    parentId: null,
    order: 0,
    createdAt: completedAt.toISOString(),
    completedAt: completedAt.toISOString(),
  } as TodoNode;
}

function PresetButton({ preset }: { preset: DatePreset }): React.JSX.Element {
  const { applyPreset } = useAnalyticsFilter();
  return <button onClick={() => applyPreset(preset)}>{preset}</button>;
}

function renderTab(nodes: TodoNode[]): void {
  render(
    <AnalyticsFilterProvider>
      <PresetButton preset="all" />
      <TodosTab
        sessions={[]}
        nodes={nodes}
        events={[]}
        assignments={[]}
        tags={[]}
        labels={LABELS}
      />
    </AnalyticsFilterProvider>,
  );
}

function points(): string[] {
  const text = screen.getByTestId("trend").textContent ?? "";
  return text === "" ? [] : text.split(",");
}

describe("All time starts on the oldest data day (#1861)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 8, 21, 12, 0, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("draws daily buckets from the first completion, not from 2020", () => {
    renderTab([
      doneTask("task-1", new Date(2026, 8, 2, 10)),
      doneTask("task-2", new Date(2026, 8, 20, 10)),
    ]);

    fireEvent.click(screen.getByText("all"));

    const p = points();
    expect(p).toHaveLength(20); // 09-02 … 09-21
    expect(p[0]).toBe("09-02:1");
    expect(p[p.length - 1]).toBe("09-21:0");
  });

  it("folds a multi-year history into month buckets that carry the year", () => {
    renderTab([
      doneTask("task-1", new Date(2024, 10, 15, 10)),
      doneTask("task-2", new Date(2026, 8, 20, 10)),
      doneTask("task-3", new Date(2026, 8, 21, 9)),
    ]);

    fireEvent.click(screen.getByText("all"));

    const p = points();
    expect(p[0]).toBe("2024-11:1");
    expect(p[p.length - 1]).toBe("2026-09:2");
    expect(p).toHaveLength(23); // 2024-11 … 2026-09
  });

  it("falls back to the default length when nothing is completed", () => {
    renderTab([]);

    fireEvent.click(screen.getByText("all"));

    expect(points()).toHaveLength(30);
  });
});

describe("trendRangeDays", () => {
  const range: DateRange = {
    start: new Date(2020, 0, 1, 0, 0, 0, 0),
    end: new Date(2026, 8, 21, 23, 59, 59, 999),
  };

  it("is the preset's own length for every preset but all", () => {
    const week: DateRange = {
      start: new Date(2026, 8, 15, 0, 0, 0, 0),
      end: range.end,
    };
    expect(trendRangeDays(week, "7d", "2021-01-01")).toBe(7);
  });

  it("spans oldest day to range end under all", () => {
    expect(trendRangeDays(range, "all", "2026-09-01")).toBe(21);
  });

  it("never drops under a week, even for a future-dated key", () => {
    expect(trendRangeDays(range, "all", "2026-09-21")).toBe(7);
    expect(trendRangeDays(range, "all", "2027-01-01")).toBe(7);
  });
});

describe("trend bucket helpers", () => {
  it("picks day, week, then month as the span grows", () => {
    expect(trendGranularity(92)).toBe("day");
    expect(trendGranularity(93)).toBe("week");
    expect(trendGranularity(366)).toBe("week");
    expect(trendGranularity(367)).toBe("month");
  });

  it("folds days into calendar weeks and keeps the total", () => {
    // 2026-09-18 is a Friday; with a Sunday start the week turns on 09-20.
    const daily = ["2026-09-18", "2026-09-19", "2026-09-20", "2026-09-21"].map(
      (date) => ({ date, n: 1 }),
    );
    const weeks = rollUpTrendBuckets(daily, "week", 0, (into, day) => {
      into.n += day.n;
    });

    expect(weeks).toEqual([
      { date: "2026-09-18", n: 2 },
      { date: "2026-09-20", n: 2 },
    ]);
    expect(daily[0].n).toBe(1); // inputs are not mutated
  });

  it("puts the year on day labels only when the series crosses one", () => {
    expect(trendSpansYears([{ date: "2025-12-31" }, { date: "2026-01-01" }])).toBe(
      true,
    );
    expect(trendSpansYears([{ date: "2026-01-01" }, { date: "2026-09-21" }])).toBe(
      false,
    );
    expect(trendBucketLabel("2026-01-01", "day", true)).toBe("2026-01-01");
    expect(trendBucketLabel("2026-01-01", "day", false)).toBe("01-01");
    expect(trendBucketLabel("2026-01-01", "month", false)).toBe("2026-01");
  });
});
