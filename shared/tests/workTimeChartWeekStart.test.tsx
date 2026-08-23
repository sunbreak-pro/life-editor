import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkTimeChart } from "../src/components/Analytics/WorkTimeChart";
import type { TimerSession } from "../src/types/timer";

/*
 * #860 — the Work tab half of the fix, at the CALLER.
 *
 * `analyticsWeekWindow.test.tsx` pins `aggregateByWeek` itself; this pins that
 * WorkTimeChart hands it `WEEK_STARTS_ON` (Sunday, #1102) instead of cutting
 * the sessions on a boundary of its own. The two are worth separating because
 * #860 exists precisely because #780 fixed a window and left a caller on the
 * old one — a green aggregation test says nothing about what the chart asks
 * for.
 *
 * recharts' ResponsiveContainer needs ResizeObserver (absent in jsdom), so the
 * primitives are stubbed the way tagWorkTimeChart.test.tsx does, with
 * <BarChart> spilling its data so the buckets are assertable.
 */
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  BarChart: ({
    data,
    children,
  }: {
    data: { label: string; hours: number }[];
    children: React.ReactNode;
  }) => (
    <ul>
      {data.map((d, i) => (
        <li key={i}>{`${d.label} = ${d.hours}`}</li>
      ))}
      {children}
    </ul>
  ),
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}));

/** Wed 2026-07-15 10:00 local — mid-week, the same clock as the #860 suite. */
const MID_WEEK = new Date(2026, 6, 15, 10, 0, 0);

function workSession(
  id: number,
  startedAt: Date,
  minutes: number,
): TimerSession {
  return {
    id,
    todoId: null,
    sessionType: "WORK",
    startedAt,
    completedAt: startedAt,
    duration: minutes * 60,
    completed: true,
    label: null,
  };
}

/** 60 min on Mon 07-13 and 30 min on Sun 07-12 — the boundary straddles them. */
const SESSIONS = [
  workSession(1, new Date(2026, 6, 13, 9, 0, 0), 60),
  workSession(2, new Date(2026, 6, 12, 9, 0, 0), 30),
];

function bucketLines(): string[] {
  return screen.getAllByRole("listitem").map((el) => el.textContent ?? "");
}

describe("WorkTimeChart weekly buckets start on Sunday (#860 / #1102)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(MID_WEEK);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderWeekly(): void {
    render(
      <WorkTimeChart
        sessions={SESSIONS}
        period="week"
        labels={{ workTime: "Work Time" }}
      />,
    );
  }

  it("opens the buckets on Sunday, so 07-12 and 07-13 share one", () => {
    renderWeekly();

    const lines = bucketLines();
    // A Monday boundary would have split these two: Sun 07-12 would close the
    // week that began 07-06, and Mon 07-13 would open the next one.
    expect(lines).toContain("7/12~ = 1.5");
    expect(lines.some((l) => l.startsWith("7/13~"))).toBe(false);
    expect(lines.some((l) => l.startsWith("7/6~"))).toBe(false);
  });

  it("keeps the day view on its rolling 14 days", () => {
    render(
      <WorkTimeChart
        sessions={SESSIONS}
        period="day"
        labels={{ workTime: "Work Time" }}
      />,
    );

    // 07-02…07-15 inclusive — "recently", not two calendar weeks (#860 left it).
    const lines = bucketLines();
    expect(lines).toHaveLength(14);
    expect(lines[0]).toBe("7/2 = 0");
    expect(lines[13]).toBe("7/15 = 0");
  });
});
