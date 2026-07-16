import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WeekTimeGrid, type WeekTimeGridItem } from "../src/components";

/*
 * WeekTimeGrid W8 target-IA extensions: provenance color-coding (routine 藍 /
 * event 紫), the today-column now-line (drawn only when nowMinutes is inside
 * the visible window), and the fillHeight body-sizing switch.
 */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const ITEMS: WeekTimeGridItem[] = [
  {
    id: "gym",
    date: "2026-07-09",
    title: "Gym",
    startTime: "19:00",
    endTime: "20:30",
    variant: "routine",
  },
  {
    id: "dinner",
    date: "2026-07-09",
    title: "Dinner",
    startTime: "12:00",
    endTime: "13:00",
    variant: "event",
  },
  {
    id: "report",
    date: "2026-07-09",
    title: "Write report",
    startTime: "09:00",
    endTime: "10:00",
    variant: "task",
  },
];

function renderGrid(props?: Partial<Parameters<typeof WeekTimeGrid>[0]>) {
  return render(
    <WeekTimeGrid
      weekStart="2026-07-05"
      items={ITEMS}
      weekdayLabels={WEEKDAYS}
      allDayLabel="All-day"
      todayKey="2026-07-09"
      {...props}
    />,
  );
}

describe("WeekTimeGrid — provenance variants", () => {
  it("gives a routine item the 藍 face", () => {
    renderGrid();
    const block = screen.getByTitle("19:00–20:30 Gym");
    expect(block.className).toContain("bg-lumen-schedule-routine-bg");
    expect(block.className).toContain("text-lumen-chip-routine-fg");
  });

  it("gives an event item the 紫 face + border", () => {
    renderGrid();
    const block = screen.getByTitle("12:00–13:00 Dinner");
    expect(block.className).toContain("bg-lumen-schedule-event-bg");
    expect(block.className).toContain("border-lumen-schedule-event-border");
  });

  it("gives a task item the blue face and no Repeat glyph / band", () => {
    renderGrid();
    const block = screen.getByTitle("09:00–10:00 Write report");
    expect(block.className).toContain("bg-lumen-schedule-task-bg");
    expect(block.className).toContain("text-lumen-chip-task-fg");
    // Not the routine face, and no border like the event face.
    expect(block.className).not.toContain("bg-lumen-schedule-routine-bg");
    expect(block.className).not.toContain("border-lumen-schedule-event-border");
    // No routine left-band / Repeat glyph on a task block.
    expect(block.querySelector("svg")).toBeNull();
  });
});

describe("WeekTimeGrid — now-line", () => {
  it("renders the now-line time label when nowMinutes is in range", () => {
    renderGrid({ nowMinutes: 14 * 60 + 30 }); // 14:30, inside [0,24]
    expect(screen.getByText("14:30")).toBeInTheDocument();
  });

  it("omits the now-line when nowMinutes is null", () => {
    renderGrid({ nowMinutes: null });
    expect(screen.queryByText("14:30")).toBeNull();
  });

  it("omits the now-line when nowMinutes is outside the visible window", () => {
    renderGrid({ nowMinutes: 14 * 60 + 30, hourRange: [0, 10] });
    expect(screen.queryByText("14:30")).toBeNull();
  });
});

describe("WeekTimeGrid — fillHeight", () => {
  it("uses max-h-[60vh] by default and drops it when fillHeight is set", () => {
    const { container, rerender } = renderGrid();
    expect(container.innerHTML).toContain("max-h-[60vh]");
    rerender(
      <WeekTimeGrid
        weekStart="2026-07-05"
        items={ITEMS}
        weekdayLabels={WEEKDAYS}
        allDayLabel="All-day"
        todayKey="2026-07-09"
        fillHeight
      />,
    );
    expect(container.innerHTML).not.toContain("max-h-[60vh]");
    expect(container.innerHTML).toContain("flex-1");
  });
});
