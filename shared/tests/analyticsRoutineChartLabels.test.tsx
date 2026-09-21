import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RoutineCompletionChart } from "../src/components/Analytics/RoutineCompletionChart";
import {
  estimateLabelWidth,
  fitAxisLabel,
} from "../src/components/Analytics/chartTheme";
import type { ScheduleItem } from "../src/types/schedule";
import type { RoutineNode } from "../src/types/routine";

/*
 * #1862 — two things on the Routine Completion Rates chart:
 *  1. labels were cut at 12 CHARACTERS while the gutter is 100 PX, so a
 *     full-width title (~105px) ran out of the left edge of the SVG;
 *  2. an all-0% chart was labels over an empty grid.
 *
 * jsdom has no layout, so what is pinned is the estimate the chart cuts by and
 * the props it hands recharts — the stubs spill them. The in-SVG rect check the
 * issue asks for is a real-browser step (chat-main, after merge).
 */
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  BarChart: ({
    data,
    children,
  }: {
    data: { name: string; rate: number }[];
    children: React.ReactNode;
  }) => (
    <div>
      <ul>
        {data.map((d) => (
          <li key={d.name} data-testid="row">
            {d.name}
          </li>
        ))}
      </ul>
      {children}
    </div>
  ),
  Bar: ({
    minPointSize,
    children,
  }: {
    minPointSize?: number;
    children?: React.ReactNode;
  }) => (
    <div data-testid="bar" data-min-point-size={minPointSize}>
      {children}
    </div>
  ),
  LabelList: ({
    dataKey,
    formatter,
  }: {
    dataKey: string;
    formatter: (v: unknown) => string;
  }) => (
    <span data-testid="value-label" data-key={dataKey}>
      {formatter(0)}|{formatter(75)}
    </span>
  ),
  XAxis: () => null,
  YAxis: ({ width }: { width: number }) => (
    <span data-testid="gutter">{width}</span>
  ),
  CartesianGrid: () => null,
  Tooltip: () => null,
}));

function routine(id: string, title: string): RoutineNode {
  return {
    id,
    title,
    startTime: "07:00",
    endTime: "07:30",
    isArchived: false,
    isVisible: true,
    isDeleted: false,
    deletedAt: null,
    order: 0,
    frequencyType: "daily",
    frequencyDays: [],
    frequencyInterval: null,
    frequencyStartDate: null,
    createdAt: "2020-01-01T00:00:00.000Z",
    updatedAt: "2020-01-01T00:00:00.000Z",
  };
}

function item(id: string, routineId: string): ScheduleItem {
  return {
    id,
    date: "2026-09-20",
    title: "Event",
    startTime: "09:00",
    endTime: "10:00",
    completed: false,
    completedAt: null,
    routineId,
    templateId: null,
    memo: null,
    noteId: null,
    content: null,
    createdAt: "2020-01-01T00:00:00.000Z",
    updatedAt: "2020-01-01T00:00:00.000Z",
  } as ScheduleItem;
}

const LABELS = { title: "Routines", rate: "Rate" };
const TICK_FONT_PX = 10;

describe("routine labels fit the Y gutter (#1862)", () => {
  it("cuts the issue's full-width title to fit inside the gutter", () => {
    render(
      <RoutineCompletionChart
        items={[item("ev-1", "r-1")]}
        routines={[routine("r-1", "APIについて学んでみるシリーズ")]}
        labels={LABELS}
      />,
    );

    const label = screen.getByTestId("row").textContent ?? "";
    const gutter = Number(screen.getByTestId("gutter").textContent);

    expect(label.endsWith("…")).toBe(true);
    // 8px of the gutter is recharts' tick mark + gap; the text gets the rest.
    expect(estimateLabelWidth(label, TICK_FONT_PX)).toBeLessThanOrEqual(
      gutter - 8,
    );
  });

  it("leaves a title that already fits alone", () => {
    render(
      <RoutineCompletionChart
        items={[item("ev-1", "r-1")]}
        routines={[routine("r-1", "Morning run")]}
        labels={LABELS}
      />,
    );

    expect(screen.getByTestId("row").textContent).toBe("Morning run");
  });
});

describe("an all-zero chart still reads as a chart (#1862)", () => {
  it("gives a 0% bar a stub and prints the rate beside every bar", () => {
    render(
      <RoutineCompletionChart
        items={[item("ev-1", "r-1")]}
        routines={[routine("r-1", "Morning run")]}
        labels={LABELS}
      />,
    );

    expect(
      Number(screen.getByTestId("bar").getAttribute("data-min-point-size")),
    ).toBeGreaterThan(0);
    const value = screen.getByTestId("value-label");
    expect(value.getAttribute("data-key")).toBe("rate");
    expect(value.textContent).toBe("0%|75%");
  });
});

describe("fitAxisLabel", () => {
  it("counts a full-width glyph as wider than a Latin one", () => {
    expect(estimateLabelWidth("あ", 10)).toBeGreaterThan(
      estimateLabelWidth("a", 10),
    );
  });

  it("never splits a surrogate pair", () => {
    const out = fitAxisLabel("😀😀😀😀😀😀😀😀😀😀😀😀", 50, 10);

    expect(out.endsWith("…")).toBe(true);
    expect([...out.slice(0, -1)].every((ch) => ch === "😀")).toBe(true);
  });

  it("stays within the budget it was given", () => {
    const out = fitAxisLabel("とても長いルーチンの名前がここに入ります", 88, 10);

    expect(estimateLabelWidth(out, 10)).toBeLessThanOrEqual(88);
  });
});
