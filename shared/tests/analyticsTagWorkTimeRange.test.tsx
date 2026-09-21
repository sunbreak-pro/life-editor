import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  AnalyticsFilterProvider,
  useAnalyticsFilter,
  type DatePreset,
} from "../src/components/Analytics/AnalyticsFilterContext";
import { TodosTab } from "../src/components/Analytics/TodosTab";
import { sessionsWithinRange } from "../src/utils/analyticsAggregation";
import type { TimerSession } from "../src/types/timer";
import type { TodoNode } from "../src/types/todoTree";
import type { WikiTag, WikiTagAssignment } from "../src/types/wikiTagUnified";

/*
 * #1860 — the header's date-range pills have to reach the tag ring.
 *
 * TodosTab handed TagWorkTimeChart every session the host holds, so the ring
 * read "Untagged 51% / routine 49%" under all four presets even though the
 * only work in the last 7 days was on the tagged item. What is asserted is the
 * slice list the stubbed <Pie> was handed.
 *
 * recharts' ResponsiveContainer needs ResizeObserver (absent in jsdom), so the
 * primitives are stubbed the way analyticsTodoTrendRange.test.tsx does.
 */
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AreaChart: () => null,
  Area: () => null,
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Bar: () => null,
  PieChart: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Pie: ({ data }: { data: { name: string; value: number }[] }) => (
    <div data-testid="tag-slices">
      {data.map((d) => `${d.name}=${Math.round(d.value)}`).join(",")}
    </div>
  ),
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

function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

function makeSession(overrides: Partial<TimerSession>): TimerSession {
  return {
    id: 1,
    todoId: null,
    sessionType: "WORK",
    startedAt: new Date(),
    completedAt: new Date(),
    duration: 1800,
    completed: true,
    label: null,
    ...overrides,
  };
}

const NODES: TodoNode[] = [
  {
    id: "task-1",
    type: "task",
    title: "Tagged todo",
    parentId: null,
    order: 0,
    createdAt: daysAgo(40).toISOString(),
  } as TodoNode,
];

const TAGS = [
  { id: "tag-1", name: "routine", color: null, isDeleted: false },
] as unknown as WikiTag[];

const ASSIGNMENTS = [
  { tagId: "tag-1", itemId: "task-1", isDeleted: false },
] as unknown as WikiTagAssignment[];

// The issue's own shape: one tagged session this week, untagged work weeks ago.
const SESSIONS: TimerSession[] = [
  makeSession({ id: 1, todoId: "task-1", startedAt: daysAgo(1) }),
  makeSession({ id: 2, todoId: null, startedAt: daysAgo(20) }),
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
        sessions={SESSIONS}
        nodes={NODES}
        events={[]}
        assignments={ASSIGNMENTS}
        tags={TAGS}
        labels={LABELS}
      />
    </AnalyticsFilterProvider>,
  );
}

function slices(): string {
  return screen.getByTestId("tag-slices").textContent ?? "";
}

describe("Work time by tag follows the date-range preset (#1860)", () => {
  it("shows both slices on the default 30-day preset", () => {
    renderTab();

    expect(slices()).toBe("routine=30,Untagged=30");
  });

  it("drops work outside the window when the 7-day preset is picked", () => {
    renderTab();

    fireEvent.click(screen.getByText("7d"));

    expect(slices()).toBe("routine=30");
  });

  it("brings it back when the 30-day preset is picked again", () => {
    renderTab();

    fireEvent.click(screen.getByText("7d"));
    fireEvent.click(screen.getByText("30d"));

    expect(slices()).toBe("routine=30,Untagged=30");
  });
});

describe("sessionsWithinRange", () => {
  it("keeps sessions on both boundary instants and drops the rest", () => {
    const start = new Date(2026, 8, 15, 0, 0, 0, 0);
    const end = new Date(2026, 8, 21, 23, 59, 59, 999);
    const sessions = [
      makeSession({ id: 1, startedAt: new Date(2026, 8, 14, 23, 59, 59, 999) }),
      makeSession({ id: 2, startedAt: start }),
      makeSession({ id: 3, startedAt: end }),
      makeSession({ id: 4, startedAt: new Date(2026, 8, 22, 0, 0, 0, 0) }),
    ];

    expect(sessionsWithinRange(sessions, start, end).map((s) => s.id)).toEqual([
      2, 3,
    ]);
  });
});
