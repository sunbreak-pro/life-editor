import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  MonthGrid,
  ScheduleToolbar,
  WeekTimeGrid,
  type MonthGridItem,
  type WeekTimeGridItem,
} from "../src/components";

/*
 * #1626 — how a holiday is DRAWN, on the three surfaces that show one.
 *
 * The rule the grids have to keep is the same on both: a holiday looks like
 * the items beside it and answers no gesture. It has no row behind it — the
 * name and the date come from the law (japaneseHolidays) — so a click has
 * nothing to open, and a <button> that opens nothing reads as broken. Each
 * grid draws its own markup, which is exactly how one of them ends up fixed
 * and the other not.
 */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOLIDAY_RED = "#e03e3e";

const MONTH_ITEMS: MonthGridItem[] = [
  { id: "a", date: "2026-09-21", title: "Gym", variant: "event" },
  {
    id: "holiday-2026-09-21",
    date: "2026-09-21",
    title: "敬老の日",
    variant: "holiday",
    isAllDay: true,
    tagColor: HOLIDAY_RED,
  },
];

const WEEK_ITEMS: WeekTimeGridItem[] = [
  {
    id: "a",
    date: "2026-09-21",
    title: "Gym",
    startTime: "19:00",
    endTime: "20:00",
    variant: "event",
  },
  {
    id: "holiday-2026-09-21",
    date: "2026-09-21",
    title: "敬老の日",
    startTime: "00:00",
    endTime: "00:00",
    isAllDay: true,
    variant: "holiday",
    tagColor: HOLIDAY_RED,
  },
];

describe("MonthGrid — holidays (#1626)", () => {
  function renderMonth() {
    const onSelectItem = vi.fn();
    const onItemActivate = vi.fn();
    render(
      <MonthGrid
        monthKey="2026-09-15"
        items={MONTH_ITEMS}
        todayKey="2026-09-21"
        weekdayLabels={WEEKDAYS}
        onSelectDay={vi.fn()}
        onSelectItem={onSelectItem}
        onItemActivate={onItemActivate}
        formatMoreCount={(n) => `+${n} more`}
      />,
    );
    return { onSelectItem, onItemActivate };
  }

  it("draws the holiday in the shared colour, as text rather than a control", () => {
    renderMonth();
    const chip = screen.getByText("敬老の日");
    expect(chip.tagName).toBe("SPAN");
    expect(chip).toHaveAttribute("data-holiday-chip", "2026-09-21");
    expect(chip.style.backgroundColor).toBe("rgb(224, 62, 62)");
    // The event beside it is still a control — only the holiday is not.
    expect(screen.getByRole("button", { name: "Gym" })).toBeInTheDocument();
  });

  it("answers no click", () => {
    const { onSelectItem, onItemActivate } = renderMonth();
    fireEvent.click(screen.getByText("敬老の日"));
    expect(onItemActivate).not.toHaveBeenCalled();
    expect(onSelectItem).not.toHaveBeenCalled();
  });
});

describe("WeekTimeGrid — holidays (#1626)", () => {
  function renderWeek() {
    const onItemActivate = vi.fn();
    render(
      <WeekTimeGrid
        data={{
          weekStart: "2026-09-20",
          items: WEEK_ITEMS,
          todayKey: "2026-09-21",
        }}
        labels={{ weekdays: WEEKDAYS, allDay: "All-day" }}
        handlers={{ onItemActivate }}
      />,
    );
    return { onItemActivate };
  }

  it("puts the holiday in the all-day lane, in the shared colour", () => {
    renderWeek();
    const chip = screen.getByText("敬老の日");
    expect(chip.tagName).toBe("SPAN");
    expect(chip).toHaveAttribute("data-holiday-chip", "2026-09-21");
    expect(chip.style.backgroundColor).toBe("rgb(224, 62, 62)");
    // The lane, not the time body — that is what `isAllDay` buys.
    expect(chip.closest("[data-week-grid-allday]")).not.toBeNull();
  });

  it("answers no click", () => {
    const { onItemActivate } = renderWeek();
    fireEvent.click(screen.getByText("敬老の日"));
    expect(onItemActivate).not.toHaveBeenCalled();
  });
});

describe("ScheduleToolbar — the holiday filter (#1626)", () => {
  function renderToolbar(holidaysHidden: boolean) {
    const onToggleHolidays = vi.fn();
    render(
      <ScheduleToolbar
        periodLabel="September 2026"
        onToday={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        view="month"
        viewOptions={[{ id: "month", label: "Month" }]}
        onChangeView={vi.fn()}
        onToggleHolidays={onToggleHolidays}
        holidaysHidden={holidaysHidden}
        addEventLabel="Add"
        labels={{
          today: "Today",
          prev: "Prev",
          next: "Next",
          hideHolidays: "Hide holidays",
          holidaysHidden: "3 holidays hidden",
        }}
      />,
    );
    return { onToggleHolidays };
  }

  it("offers the action while holidays are shown", () => {
    const { onToggleHolidays } = renderToolbar(false);
    const button = screen.getByRole("button", { name: "Hide holidays" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).toHaveAttribute("data-holiday-filter", "shown");
    fireEvent.click(button);
    expect(onToggleHolidays).toHaveBeenCalledTimes(1);
  });

  it("carries the count in its name once they are hidden", () => {
    // The #466 rule, unchanged: an empty slot on a filtered grid reads as free
    // time unless the control says what it took away.
    renderToolbar(true);
    const button = screen.getByRole("button", { name: "3 holidays hidden" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveAttribute("data-holiday-filter", "hidden");
  });

  it("draws no button at all when the host omits the handler", () => {
    // Mobile leaves both filters out — the single-day list has no scaffolding
    // problem to solve.
    render(
      <ScheduleToolbar
        periodLabel="September 2026"
        onToday={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        view="month"
        viewOptions={[{ id: "month", label: "Month" }]}
        onChangeView={vi.fn()}
        addEventLabel="Add"
        labels={{ today: "Today", prev: "Prev", next: "Next" }}
      />,
    );
    expect(document.querySelector("[data-holiday-filter]")).toBeNull();
  });
});
