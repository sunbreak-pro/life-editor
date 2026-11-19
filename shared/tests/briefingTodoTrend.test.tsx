import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChartCard } from "../src/components/briefing/ChartCard";
import {
  evenDateTicks,
  MAX_DATE_TICKS,
} from "../src/components/briefing/chartTheme";
import {
  aggregateTodoCompletionTrend,
  trendDateLabels,
} from "../src/components/briefing/todoCompletionTrendData";
import type { TodoNode } from "../src/types/todoTree";

/*
 * The briefing's Todo completion chart kept the pieces it used from the
 * retired Analytics section (#2754). These pin the behaviour those pieces had
 * there, so the panel keeps drawing the same thing.
 */

function doneTodo(id: string, completedAt: Date): TodoNode {
  return {
    id,
    type: "task",
    title: id,
    parentId: null,
    order: 0,
    status: "DONE",
    createdAt: new Date(2026, 0, 1).toISOString(),
    completedAt: completedAt.toISOString(),
  };
}

describe("aggregateTodoCompletionTrend", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 13, 10, 0, 0)); // Mon 2026-07-13 local
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns one bucket per day, oldest first, ending today", () => {
    const buckets = aggregateTodoCompletionTrend([], 7);
    expect(buckets.map((b) => b.date)).toEqual([
      "2026-07-07",
      "2026-07-08",
      "2026-07-09",
      "2026-07-10",
      "2026-07-11",
      "2026-07-12",
      "2026-07-13",
    ]);
    expect(buckets.every((b) => b.completedCount === 0)).toBe(true);
  });

  it("files a 01:00 completion under the LOCAL day (#420)", () => {
    const buckets = aggregateTodoCompletionTrend(
      [doneTodo("early", new Date(2026, 6, 13, 1, 0, 0))],
      7,
    );
    expect(buckets.find((b) => b.date === "2026-07-13")?.completedCount).toBe(
      1,
    );
    expect(buckets.reduce((sum, b) => sum + b.completedCount, 0)).toBe(1);
  });

  it("ignores open todos and completions outside the window", () => {
    const open: TodoNode = {
      ...doneTodo("open", new Date()),
      completedAt: undefined,
    };
    const old = doneTodo("old", new Date(2026, 5, 1, 9, 0, 0));
    const buckets = aggregateTodoCompletionTrend([open, old], 7);
    expect(buckets.reduce((sum, b) => sum + b.completedCount, 0)).toBe(0);
  });
});

describe("trendDateLabels", () => {
  it("prints MM-DD inside one year", () => {
    expect(
      trendDateLabels([
        { date: "2026-07-12", completedCount: 0 },
        { date: "2026-07-13", completedCount: 0 },
      ]),
    ).toEqual(["07-12", "07-13"]);
  });

  it("keeps the year once the week crosses New Year", () => {
    expect(
      trendDateLabels([
        { date: "2025-12-31", completedCount: 0 },
        { date: "2026-01-01", completedCount: 0 },
      ]),
    ).toEqual(["2025-12-31", "2026-01-01"]);
  });
});

describe("evenDateTicks (#1866)", () => {
  const days = Array.from(
    { length: 30 },
    (_, i) => `d${String(i).padStart(2, "0")}`,
  );

  it("always ends on the last label — today", () => {
    const ticks = evenDateTicks(days);
    expect(ticks[ticks.length - 1]).toBe("d29");
  });

  it("keeps every gap equal, the last one included", () => {
    const idx = evenDateTicks(days).map((t) => days.indexOf(t));
    const gaps = idx.slice(1).map((v, i) => v - idx[i]);
    expect(new Set(gaps).size).toBe(1);
    expect(idx.length).toBeLessThanOrEqual(MAX_DATE_TICKS);
  });

  it("labels every point when there are few enough", () => {
    expect(evenDateTicks(days.slice(0, 7))).toEqual(days.slice(0, 7));
  });
});

describe("ChartCard", () => {
  it("renders the title and the chart body", () => {
    render(
      <ChartCard title="Todo completions">
        <div data-testid="body" />
      </ChartCard>,
    );
    expect(
      screen.getByRole("heading", { name: "Todo completions" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("body")).toBeInTheDocument();
  });
});
