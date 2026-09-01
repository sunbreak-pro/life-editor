import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WeekTimeGrid, type WeekTimeGridItem } from "../src/components";
import type { HourRange } from "../src/utils/scheduleGridLayout";

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

/**
 * #893 folded the grid's props into bundles; the cases below still describe
 * their setup in flat terms and are unchanged from before that refactor — the
 * folding happens here.
 */
function renderGrid(props?: {
  items?: WeekTimeGridItem[];
  nowMinutes?: number | null;
  hourRange?: HourRange;
}) {
  return render(
    <WeekTimeGrid
      data={{
        weekStart: "2026-07-05",
        items: props?.items ?? ITEMS,
        todayKey: "2026-07-09",
        nowMinutes: props?.nowMinutes,
      }}
      labels={{ weekdays: WEEKDAYS, allDay: "All-day" }}
      display={{ hourRange: props?.hourRange }}
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
    // The border IS the event cue — no glyph (#593 keeps event untouched).
    expect(block.querySelector("svg")).toBeNull();
  });

  it("gives a todo item the blue face and the CheckSquare glyph (#593)", () => {
    renderGrid();
    const block = screen.getByTitle("09:00–10:00 Write report");
    expect(block.className).toContain("bg-lumen-schedule-task-bg");
    expect(block.className).toContain("text-lumen-chip-task-fg");
    // Not the routine face, and no border like the event face.
    expect(block.className).not.toContain("bg-lumen-schedule-routine-bg");
    expect(block.className).not.toContain("border-lumen-schedule-event-border");
    // #593: the todo's non-hue cue — the CheckSquare todo mark.
    expect(block.querySelector("svg")).not.toBeNull();
  });

  it("marks an all-day todo chip with the glyph, all-day events without (#593)", () => {
    renderGrid({
      items: [
        ...ITEMS,
        {
          id: "allday-todo",
          date: "2026-07-09",
          title: "Buy milk",
          startTime: "00:00",
          endTime: "00:00",
          isAllDay: true,
          variant: "task",
        },
        {
          id: "allday-event",
          date: "2026-07-09",
          title: "Trash day",
          startTime: "00:00",
          endTime: "00:00",
          isAllDay: true,
          variant: "event",
        },
      ],
    });
    expect(screen.getByTitle("Buy milk").querySelector("svg")).not.toBeNull();
    expect(screen.getByTitle("Trash day").querySelector("svg")).toBeNull();
  });
});

describe("WeekTimeGrid — now-line", () => {
  /** The rule and the dot are aria-hidden and carry no text, so the
   *  data-week-grid hooks are the only handle (#1362 took the caption away). */
  const nowLineParts = (container: HTMLElement) => ({
    rule: container.querySelector('[data-week-grid="now-line"]'),
    dot: container.querySelector('[data-week-grid="now-dot"]'),
  });

  it("renders the rule and the dot when nowMinutes is in range", () => {
    const { container } = renderGrid({ nowMinutes: 14 * 60 + 30 }); // inside [0,24]
    const { rule, dot } = nowLineParts(container);
    expect(rule).not.toBeNull();
    expect(dot).not.toBeNull();
  });

  it("draws no time caption on the now-line (#1362)", () => {
    // The caption used to land on the hour axis at the same y as a tick, so
    // "14:30" and the "14:00" label overprinted each other.
    const { container } = renderGrid({ nowMinutes: 14 * 60 + 30 });
    expect(screen.queryByText("14:30")).toBeNull();
    expect(nowLineParts(container).rule).not.toBeNull();
  });

  it("omits the now-line when nowMinutes is null", () => {
    const { container } = renderGrid({ nowMinutes: null });
    const { rule, dot } = nowLineParts(container);
    expect(rule).toBeNull();
    expect(dot).toBeNull();
  });

  it("omits the now-line when nowMinutes is outside the visible window", () => {
    const { container } = renderGrid({
      nowMinutes: 14 * 60 + 30,
      hourRange: [0, 10],
    });
    const { rule, dot } = nowLineParts(container);
    expect(rule).toBeNull();
    expect(dot).toBeNull();
  });
});

describe("WeekTimeGrid — fillHeight", () => {
  it("uses max-h-[60vh] by default and drops it when fillHeight is set", () => {
    const { container, rerender } = renderGrid();
    expect(container.innerHTML).toContain("max-h-[60vh]");
    rerender(
      <WeekTimeGrid
        data={{
          weekStart: "2026-07-05",
          items: ITEMS,
          todayKey: "2026-07-09",
        }}
        labels={{ weekdays: WEEKDAYS, allDay: "All-day" }}
        display={{ fillHeight: true }}
      />,
    );
    expect(container.innerHTML).not.toContain("max-h-[60vh]");
    expect(container.innerHTML).toContain("flex-1");
  });
});
