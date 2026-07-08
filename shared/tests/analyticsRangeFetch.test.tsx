import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ScheduleTab } from "../src/components/Analytics/ScheduleTab";
import type { ScheduleTabLabels } from "../src/components/Analytics/ScheduleTab";
import {
  AnalyticsFilterProvider,
  useAnalyticsFilter,
} from "../src/components/Analytics/AnalyticsFilterContext";
import { formatDateKey } from "../src/utils/dateKey";
import type { ScheduleItem } from "../src/types/schedule";

/*
 * Per-range fetch contract (follow-up #7). The Schedule tab no longer relies on
 * the host loading all history: AnalyticsFilterContext owns the selected range
 * (single source of truth) and reports it up via `onDateRangeChange`, which the
 * host mirrors into a fetchScheduleItemsByDateRange(from, to) call. These suites
 * exercise the shared side of that contract — the callback firing with the right
 * window, and ScheduleTab's loading skeleton — since the host re-fetch itself
 * lives in web/ (outside this package).
 *
 * The three recharts children need ResizeObserver (jsdom lacks it), so we stub
 * them; only the non-loading + populated case would mount them.
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
  empty: {
    title: "No events in this range",
    description: "Add events to see analytics.",
  },
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

/** Renders a button that applies a preset, so tests can drive range changes. */
function PresetButton() {
  const { applyPreset } = useAnalyticsFilter();
  return <button onClick={() => applyPreset("7d")}>apply-7d</button>;
}

describe("AnalyticsFilterProvider onDateRangeChange (range lifted to host)", () => {
  it("fires once on mount with the default 30d window", () => {
    const onRange = vi.fn();
    render(
      <AnalyticsFilterProvider onDateRangeChange={onRange}>
        <div />
      </AnalyticsFilterProvider>,
    );

    expect(onRange).toHaveBeenCalledTimes(1);
    const range = onRange.mock.calls[0][0];
    // Default preset "30d": start = today-29, end = today.
    expect(formatDateKey(range.start)).toBe(dayKey(-29));
    expect(formatDateKey(range.end)).toBe(dayKey(0));
  });

  it("re-fires with the new window when the preset changes", () => {
    const onRange = vi.fn();
    render(
      <AnalyticsFilterProvider onDateRangeChange={onRange}>
        <PresetButton />
      </AnalyticsFilterProvider>,
    );

    expect(onRange).toHaveBeenCalledTimes(1); // initial 30d

    fireEvent.click(screen.getByText("apply-7d"));

    // Applying "7d" (start = today-6) reports the new window exactly once more.
    expect(onRange).toHaveBeenCalledTimes(2);
    const range = onRange.mock.calls[1][0];
    expect(formatDateKey(range.start)).toBe(dayKey(-6));
    expect(formatDateKey(range.end)).toBe(dayKey(0));
  });

  it("does not throw / no-ops when no callback is provided (backward compat)", () => {
    expect(() =>
      render(
        <AnalyticsFilterProvider>
          <div />
        </AnalyticsFilterProvider>,
      ),
    ).not.toThrow();
  });
});

describe("ScheduleTab loading state (per-range fetch in flight)", () => {
  it("shows a busy skeleton, not the empty copy, while loading with no items", () => {
    const { container } = render(
      <AnalyticsFilterProvider>
        <ScheduleTab scheduleItems={[]} routines={[]} loading labels={LABELS} />
      </AnalyticsFilterProvider>,
    );

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
    expect(screen.queryByText(LABELS.empty.title)).not.toBeInTheDocument();
  });

  it("keeps rendering in-range items (not the skeleton) while re-fetching", () => {
    const { container } = render(
      <AnalyticsFilterProvider>
        <ScheduleTab
          scheduleItems={[makeItem({ id: "a", date: dayKey(0) })]}
          routines={[]}
          loading
          labels={LABELS}
        />
      </AnalyticsFilterProvider>,
    );

    // Stale data stays visible (totalEvents = 1) and the root flags aria-busy.
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(container.querySelector(".animate-pulse")).toBeNull();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("shows the empty copy when settled (not loading) with no items", () => {
    render(
      <AnalyticsFilterProvider>
        <ScheduleTab scheduleItems={[]} routines={[]} labels={LABELS} />
      </AnalyticsFilterProvider>,
    );

    expect(screen.getByText(LABELS.empty.title)).toBeInTheDocument();
  });
});
