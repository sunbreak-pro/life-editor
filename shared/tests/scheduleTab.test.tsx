import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScheduleTab } from "../src/components/Analytics/ScheduleTab";
import type { ScheduleTabLabels } from "../src/components/Analytics/ScheduleTab";
import { AnalyticsFilterProvider } from "../src/components/Analytics/AnalyticsFilterContext";
import { formatDateKey } from "../src/utils/dateKey";
import type { ScheduleItem } from "../src/types/schedule";

/*
 * ScheduleTab renders three recharts children (EventCompletionTrend /
 * EventTimeDistribution / RoutineCompletionChart). recharts' ResponsiveContainer
 * needs ResizeObserver, which jsdom does not provide, so we stub the charts —
 * this suite exercises the tab's own logic (in-memory date-range filtering +
 * stat-card tokenization), not the charts.
 */
vi.mock("../src/components/Analytics/EventCompletionTrend", () => ({
  EventCompletionTrend: () => null,
}));
vi.mock("../src/components/Analytics/EventTimeDistribution", () => ({
  EventTimeDistribution: () => null,
}));
vi.mock("../src/components/Analytics/RoutineCompletionChart", () => ({
  RoutineCompletionChart: () => null,
}));

const LABELS: ScheduleTabLabels = {
  totalEvents: "Total events",
  completedEvents: "Completed",
  completionRate: "Completion rate",
  activeRoutines: "Active routines",
  routineRate: "Routine rate",
  noEvents: "No events in this range",
  eventTrend: { title: "Trend", completed: "Completed" },
  timeDistribution: { title: "By hour", count: "Count" },
  routineCompletion: { title: "Routines", rate: "Rate" },
};

/** YYYY-MM-DD key `offsetDays` away from today (negative = past). */
function dayKey(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return formatDateKey(d);
}

function makeItem(
  over: Partial<ScheduleItem> & { id: string; date: string },
): ScheduleItem {
  return {
    title: "Event",
    startTime: "09:00",
    endTime: "10:00",
    completed: false,
    completedAt: null,
    routineId: null,
    templateId: null,
    memo: null,
    noteId: null,
    content: null,
    createdAt: "2020-01-01T00:00:00.000Z",
    updatedAt: "2020-01-01T00:00:00.000Z",
    ...over,
  };
}

function renderTab(items: ScheduleItem[]) {
  return render(
    <AnalyticsFilterProvider>
      <ScheduleTab scheduleItems={items} routines={[]} labels={LABELS} />
    </AnalyticsFilterProvider>,
  );
}

describe("ScheduleTab date-range filtering (per-range presentation)", () => {
  it("counts only in-range, non-deleted items for the active preset (default 30d)", () => {
    // Default AnalyticsFilterContext preset is "30d": start = today-29.
    const items = [
      makeItem({ id: "a", date: dayKey(0), completed: true }), // in range
      makeItem({ id: "b", date: dayKey(-5), completed: false }), // in range
      makeItem({ id: "c", date: dayKey(-60), completed: true }), // out of range
      makeItem({ id: "d", date: dayKey(-1), isDeleted: true }), // filtered (deleted)
    ];

    renderTab(items);

    // Two in-range, non-deleted items → totalEvents = 2 (the -60 and the
    // deleted one are excluded). "2" is unique among the rendered stat values.
    expect(screen.getByText("2")).toBeInTheDocument();
    // Not the empty state.
    expect(screen.queryByText(LABELS.noEvents)).not.toBeInTheDocument();
  });

  it("shows the empty state when no item falls inside the range", () => {
    const items = [
      makeItem({ id: "e", date: dayKey(-60) }),
      makeItem({ id: "f", date: dayKey(-120) }),
    ];

    renderTab(items);

    expect(screen.getByText(LABELS.noEvents)).toBeInTheDocument();
  });

  it("tints the totalEvents stat icon with an ink-* token, not a raw literal", () => {
    const { container } = renderTab([
      makeItem({ id: "g", date: dayKey(0), completed: true }),
    ]);

    // Tokenized (text-blue-500 → text-ink-accent).
    expect(container.querySelector(".text-ink-accent")).not.toBeNull();
    expect(container.querySelector(".text-blue-500")).toBeNull();
  });
});
