import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  formatFullDay,
  formatLongDate,
  formatMonthTitle,
  formatPeriodLabel,
  formatShortDate,
  formatTodoSchedule,
  useScheduleCopy,
} from "../src/schedule/scheduleCopy";

/*
 * #673 (C6) — the pin under the Schedule host's copy.
 *
 * These strings used to be built at five separate `new Intl.DateTimeFormat`
 * sites and half a dozen `t(...)` object literals inside a 2,900-line
 * component, where the only way to check one was to look at the screen. Two
 * things need holding still while #675 moves the code around them: the field
 * set each formatter asks for (drop `year` and the creation panel silently
 * stops saying which year you are adding to — #353), and which bundle each
 * surface receives.
 *
 * The formatters take the language as an argument, so ja can be asserted
 * without touching the i18next singleton. `useScheduleCopy` reads the
 * singleton, which is en by default under vitest (no localStorage entry).
 */

describe("date formatters", () => {
  it("formatShortDate keeps the week-range ends numeric", () => {
    expect(formatShortDate("en", "2026-08-10")).toBe("8/10");
  });

  it("formatFullDay names the day without a year", () => {
    const out = formatFullDay("en", "2026-08-12");
    expect(out).toContain("August");
    expect(out).toContain("12");
    expect(out).not.toContain("2026");
  });

  it("formatLongDate adds the year the creation panel needs (#353)", () => {
    expect(formatLongDate("en", "2026-08-12")).toContain("2026");
  });

  it("formatMonthTitle names year and month only", () => {
    expect(formatMonthTitle("en", "2026-08-12")).toBe("August 2026");
  });

  it("formats in the language it was handed", () => {
    expect(formatMonthTitle("ja", "2026-08-12")).toBe("2026年8月");
    expect(formatShortDate("ja", "2026-08-10")).toBe("8/10");
  });

  it("reads the key as a LOCAL day — no UTC drift at the year edges", () => {
    // `new Date("2026-01-01")` parses as UTC midnight and lands on Dec 31 in
    // negative offsets; the schedule model is local-parts throughout.
    expect(formatLongDate("en", "2026-01-01")).toContain("January");
    expect(formatLongDate("en", "2026-01-01")).toContain("2026");
    expect(formatLongDate("en", "2025-12-31")).toContain("December");
    expect(formatLongDate("en", "2025-12-31")).toContain("2025");
  });
});

describe("formatPeriodLabel", () => {
  const base = {
    language: "en",
    anchorDate: "2026-08-12",
    isWide: true,
    weekStart: "2026-08-10",
    weekEnd: "2026-08-16",
  };

  it("names the month in month view", () => {
    expect(formatPeriodLabel({ ...base, view: "month" })).toBe("August 2026");
  });

  it("names both ends of the week on wide", () => {
    expect(formatPeriodLabel({ ...base, view: "week" })).toBe("8/10 – 8/16");
  });

  it("falls back to the anchor day for a week on narrow", () => {
    // Narrow draws a single day list, so a week range would name days that are
    // nowhere on screen.
    const out = formatPeriodLabel({ ...base, view: "week", isWide: false });
    expect(out).toContain("August");
    expect(out).toContain("2026");
  });

  it("names the anchor day in day view and in narrow's list view", () => {
    const day = formatPeriodLabel({ ...base, view: "day" });
    const list = formatPeriodLabel({ ...base, view: "list", isWide: false });
    expect(day).toContain("August");
    expect(list).toBe(day);
  });
});

describe("useScheduleCopy", () => {
  const render = (
    over: {
      isWide?: boolean;
      notesError?: boolean;
      selectedTagCount?: number;
    } = {},
  ) =>
    renderHook(() =>
      useScheduleCopy({
        isWide: over.isWide ?? true,
        notesError: over.notesError ?? false,
        selectedTagCount: over.selectedTagCount ?? 0,
      }),
    ).result.current;

  it("gives the same three sidebar tabs at both widths (#1153)", () => {
    // The Todo tab used to be withheld from narrow, which reached its todos
    // through the section's own Todo tab instead. That tab is retired, so
    // withholding this one would leave the phone with no route to a todo.
    const ids = ["flow", "todo", "repeats"];
    expect(render({ isWide: true }).sidebarTabs.map((x) => x.id)).toEqual(ids);
    expect(render({ isWide: false }).sidebarTabs.map((x) => x.id)).toEqual(ids);
  });

  it("puts the tour's todo anchor on the todo tab and nowhere else (#1124)", () => {
    // The anchor moved here when #1153 retired the section's own Todo tab.
    // `resolveTourAnchor` takes the FIRST match in the document, so a second
    // segment carrying it would decide the step's target by render order.
    const withId = render().sidebarTabs.filter((x) => x.tourId);
    expect(withId.map((x) => [x.id, x.tourId])).toEqual([
      ["todo", "schedule-todo-tab"],
    ]);
  });

  it("offers the three desktop views in order", () => {
    expect(render().desktopViewOptions.map((o) => o.label)).toEqual([
      "Day",
      "Week",
      "Month",
    ]);
  });

  it("names all seven weekdays", () => {
    expect(render().weekdayLabels).toHaveLength(7);
  });

  it("refuses to claim 'no notes yet' when the list failed to load", () => {
    expect(
      render({ notesError: false }).createPanelLabels.notePickerEmpty,
    ).toBe("No notes yet");
    expect(render({ notesError: true }).createPanelLabels.notePickerEmpty).toBe(
      "Couldn't load your notes",
    );
  });

  it("composes a duration out of hours and minutes (#553)", () => {
    const { formatDuration } = render();
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(120)).toBe("2 hr");
    expect(formatDuration(90)).toBe("1 hr 30 min");
  });

  it("wraps that duration into the free-gap line (#691)", () => {
    expect(render().formatGapLabel(90)).toBe("1 hr 30 min free");
  });

  // #877: the todo detail sheet's schedule row. The three answers are "this
  // day, this span", "this day, all of it", and "no day at all" — the last one
  // being a real answer rather than a blank, since saying nothing is exactly
  // what the sheet used to do.
  it("names the day and the span of a scheduled todo (#877)", () => {
    const copy = { allDay: "All-day", unscheduled: "Not scheduled" };
    const timed = formatTodoSchedule(
      "en",
      {
        date: "2026-08-15",
        startTime: "13:00",
        endTime: "14:00",
        isAllDay: false,
      },
      copy,
    );
    expect(timed).toContain("13:00 – 14:00");
    // The year travels with it (#353's reasoning): the sheet opens from a chip
    // on whatever day the calendar is parked on.
    expect(timed).toContain("2026");

    expect(
      formatTodoSchedule(
        "en",
        {
          date: "2026-08-15",
          startTime: "00:00",
          endTime: "00:00",
          isAllDay: true,
        },
        copy,
      ),
    ).toContain("All-day");
    // …and no 00:00–00:00, which is what an all-day slot carries underneath.
    expect(
      formatTodoSchedule(
        "en",
        {
          date: "2026-08-15",
          startTime: "00:00",
          endTime: "00:00",
          isAllDay: true,
        },
        copy,
      ),
    ).not.toContain("00:00");

    expect(formatTodoSchedule("en", null, copy)).toBe("Not scheduled");
  });

  it("fills the repeat editor's labels", () => {
    const { repeatLabels } = render();
    expect(repeatLabels.frequencyDaily).toBe("Daily");
    expect(repeatLabels.intervalEvery).toBe("Every");
  });
});
