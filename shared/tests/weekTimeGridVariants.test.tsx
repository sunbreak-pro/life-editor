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

describe("WeekTimeGrid — completion is a TODO's alone (#1373)", () => {
  /*
   * An event has no completion in the UI any more, but `completed` is still a
   * column and the MCP set_schedule_complete tool still writes it. So the
   * rule has to hold against a row that IS completed — which no UI gesture
   * can produce, hence the seeded fixture: without it a regression is
   * invisible to manual checking.
   */
  const COMPLETED: WeekTimeGridItem[] = [
    {
      id: "done-event",
      date: "2026-07-09",
      title: "Retro",
      startTime: "12:00",
      endTime: "13:00",
      variant: "event",
      completed: true,
    },
    {
      id: "done-routine",
      date: "2026-07-09",
      title: "Gym",
      startTime: "19:00",
      endTime: "20:00",
      variant: "routine",
      completed: true,
    },
    {
      id: "done-todo",
      date: "2026-07-09",
      title: "Write report",
      startTime: "09:00",
      endTime: "10:00",
      variant: "task",
      completed: true,
    },
    {
      id: "allday-done-event",
      date: "2026-07-09",
      title: "Trash day",
      startTime: "00:00",
      endTime: "00:00",
      isAllDay: true,
      variant: "event",
      completed: true,
    },
    {
      id: "allday-done-todo",
      date: "2026-07-09",
      title: "Buy stamps",
      startTime: "00:00",
      endTime: "00:00",
      isAllDay: true,
      variant: "task",
      completed: true,
    },
  ];

  it("never strikes a completed EVENT or ROUTINE block through", () => {
    renderGrid({ items: COMPLETED });
    expect(screen.getByTitle("12:00–13:00 Retro").className).not.toContain(
      "line-through",
    );
    expect(screen.getByTitle("19:00–20:00 Gym").className).not.toContain(
      "line-through",
    );
  });

  it("keeps the struck-through look on a completed TODO block", () => {
    renderGrid({ items: COMPLETED });
    expect(
      screen.getByTitle("09:00–10:00 Write report").className,
    ).toContain("line-through");
  });

  it("applies the same rule to the all-day lane chips", () => {
    renderGrid({ items: COMPLETED });
    expect(screen.getByTitle("Trash day").className).not.toContain(
      "line-through",
    );
    expect(screen.getByTitle("Buy stamps").className).toContain("line-through");
  });

  it("draws no status pill on any block", () => {
    renderGrid({ items: COMPLETED });
    for (const word of ["Not started", "In progress", "Done"]) {
      expect(screen.queryByText(word)).toBeNull();
    }
  });
});

/*
 * #1580 — a tag's colour on the block itself.
 *
 * The tag REPLACES the variant face (「種別の色より優先」), so each case checks
 * both halves: the colour arrives AND the variant class is gone. What does NOT
 * move is the non-hue half of provenance — the Repeat and CheckSquare glyphs
 * stay, so a coloured block still says what kind it is without relying on hue
 * at all, which is the rule the variant faces were written under (#593).
 *
 * The ink is not asserted as a literal (scheduleTagColor.test.ts owns the
 * contrast rule); what matters here is that the block carries one, so a title
 * can never land on an arbitrary fill in the page's default colour.
 */
describe("WeekTimeGrid — tag colour on the block (#1580)", () => {
  const TAGGED: WeekTimeGridItem[] = ITEMS.map((i) =>
    i.id === "gym" ? { ...i, tagColor: "#1e3a8a" } : i,
  );

  it("paints the block with the tag colour instead of the variant face", () => {
    renderGrid({ items: TAGGED });
    const block = screen.getByTitle("19:00–20:30 Gym");
    expect(block.style.backgroundColor).toBe("rgb(30, 58, 138)");
    expect(block.style.color).not.toBe("");
    expect(block.className).not.toContain("bg-lumen-schedule-routine-bg");
  });

  it("leaves an untagged block on its variant face", () => {
    renderGrid({ items: TAGGED });
    const block = screen.getByTitle("12:00–13:00 Dinner");
    expect(block.style.backgroundColor).toBe("");
    expect(block.className).toContain("bg-lumen-schedule-event-bg");
  });

  it("keeps the routine glyph, and lights its band off the readable ink", () => {
    renderGrid({ items: TAGGED });
    const block = screen.getByTitle("19:00–20:30 Gym");
    // The provenance glyph survives the recolour.
    expect(block.querySelector("svg")).not.toBeNull();
    // The band's own token can land within a shade of an arbitrary fill and
    // disappear; currentColor is the ink the fill was contrast-checked against.
    const band = block.querySelector("span[aria-hidden]") as HTMLElement;
    expect(band.className).toContain("bg-current");
    expect(band.className).not.toContain("bg-lumen-chip-routine-dot");
  });

  it("keeps the token band on an untagged routine", () => {
    renderGrid();
    const band = screen
      .getByTitle("19:00–20:30 Gym")
      .querySelector("span[aria-hidden]") as HTMLElement;
    expect(band.className).toContain("bg-lumen-chip-routine-dot");
  });

  it("does not disturb the block's own position styles", () => {
    // The face style is spread INTO the positioning object; a colour that
    // wiped `top` / `height` would drop every block to the top of the column.
    renderGrid({ items: TAGGED });
    const block = screen.getByTitle("19:00–20:30 Gym");
    expect(block.style.top).not.toBe("");
    expect(block.style.height).not.toBe("");
  });
});
