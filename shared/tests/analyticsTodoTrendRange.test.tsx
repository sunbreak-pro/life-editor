import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  AnalyticsFilterProvider,
  useAnalyticsFilter,
  type DatePreset,
} from "../src/components/Analytics/AnalyticsFilterContext";
import { TodosTab } from "../src/components/Analytics/TodosTab";
import type { TodoNode } from "../src/types/todoTree";

/*
 * #1476 — the header's date-range pills have to reach the Todo tab's trend.
 *
 * TodosTab passed a hardcoded `days={30}`, so the Schedule tab's trend shrank
 * with the preset and this one never moved. The bucket COUNT is what the bug
 * was about, so that is what is asserted: the stubbed <AreaChart> spills how
 * many points it was handed.
 *
 * recharts' ResponsiveContainer needs ResizeObserver (absent in jsdom), so the
 * primitives are stubbed the way tagWorkTimeChart.test.tsx does.
 */
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AreaChart: ({ data }: { data: unknown[] }) => (
    <div data-testid="trend-buckets">{data.length}</div>
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
  stagnation: { title: "Stagnation", todos: "todos" },
  tagTime: {
    title: "By tag",
    noData: "No data",
    untagged: "Untagged",
    other: "Other tags",
    formatHours: (minutes: number) => `${Math.round(minutes)}m`,
  },
};

/** One open todo — enough for the tab to render, irrelevant to the count. */
const NODES: TodoNode[] = [
  {
    id: "task-1",
    type: "task",
    title: "Write the thing",
    parentId: null,
    order: 0,
    createdAt: new Date().toISOString(),
  } as TodoNode,
];

function PresetButton({ preset }: { preset: DatePreset }): React.JSX.Element {
  const { applyPreset } = useAnalyticsFilter();
  return <button onClick={() => applyPreset(preset)}>{preset}</button>;
}

function renderTab(): void {
  render(
    <AnalyticsFilterProvider>
      <PresetButton preset="7d" />
      <PresetButton preset="30d" />
      <TodosTab
        sessions={[]}
        nodes={NODES}
        events={[]}
        assignments={[]}
        tags={[]}
        labels={LABELS}
      />
    </AnalyticsFilterProvider>,
  );
}

function bucketCount(): number {
  return Number(screen.getByTestId("trend-buckets").textContent);
}

describe("Todo completion trend follows the date-range preset (#1476)", () => {
  it("opens on the default 30-day preset", () => {
    renderTab();

    expect(bucketCount()).toBe(30);
  });

  it("shrinks to 7 buckets when the 7-day preset is picked", () => {
    renderTab();

    fireEvent.click(screen.getByText("7d"));

    expect(bucketCount()).toBe(7);
  });

  it("grows back when the 30-day preset is picked again", () => {
    renderTab();

    fireEvent.click(screen.getByText("7d"));
    fireEvent.click(screen.getByText("30d"));

    expect(bucketCount()).toBe(30);
  });
});
