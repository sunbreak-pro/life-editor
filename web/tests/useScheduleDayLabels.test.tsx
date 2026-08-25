import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useScheduleDayLabels } from "../src/schedule/useScheduleDayLabels";
import type { UseScheduleDayLabelsArgs } from "../src/schedule/useScheduleDayLabels";

/*
 * #889 — every date and day-shaped label the Calendar host hands down, pulled
 * out of CalendarTab.
 *
 * The pure `(language, dateKey) -> string` formatters are one layer down in
 * scheduleCopy.ts and pinned there (scheduleCopy.test.ts states the ja↔en and
 * year-edge cases as facts). What this file is for is the part that could not
 * follow them out — the BINDINGS. Each label below is tied to a particular day,
 * and the bug shape is always the same one: a caption that names a day the user
 * is not looking at.
 *
 *   - #774 is that bug, caught in production: the narrow day list said
 *     「今日の予定はありません」 on a June day the user had scrolled to. The two
 *     AgendaList bundles differ in exactly one key, and it is this one.
 *   - the two day captions come from the same formatter and different days
 *     (`today` vs `anchorDate`), which is one character of difference at the
 *     call site and no difference at all on screen while the calendar happens
 *     to be parked on today — the state every manual check starts in.
 *   - #878 dropped the YEAR from the day caption because the heading above it
 *     carries one. Reaching for `formatLongDate` here puts it back, and the two
 *     lines then say the year twice, an inch apart.
 *
 * The last case pins a MEMO BOUNDARY rather than a string, because here that is
 * behaviour: `formatFullDay` is a dependency of useScheduleRepeats' copy bundle
 * and a prop of MonthGrid, so a formatter that changed identity on every tick
 * would re-derive the repeat copy and re-render the grid once a minute — and
 * widening the list to something a keystroke touches does it on every character
 * typed into the memo field. Only the two callbacks are worth checking: the
 * rest of the bundle is strings, which compare by value whatever the memo does.
 *
 * `useTranslation` is stubbed to echo its key and to report a fixed language:
 * the echo makes the #774 assertion read as the two keys that differ, and a
 * pinned language keeps the Intl output stable without touching the i18next
 * singleton.
 */

vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@life-editor/shared")>()),
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

const TODAY = "2026-08-16";
/** Parked four days ahead, which is the state #774 was reported in. */
const ANCHOR = "2026-08-20";
const WEEK_START = "2026-08-16";
const WEEK_END = "2026-08-22";

const STATUS_LABELS = {
  notStarted: "Not started",
  inProgress: "In progress",
  done: "Done",
};

function setup(over: Partial<UseScheduleDayLabelsArgs> = {}) {
  const initialProps: UseScheduleDayLabelsArgs = {
    anchorDate: ANCHOR,
    today: TODAY,
    view: "month",
    isWide: true,
    weekStart: WEEK_START,
    weekEnd: WEEK_END,
    nowMinutes: 540,
    statusLabels: STATUS_LABELS,
    ...over,
  };
  return renderHook((a: UseScheduleDayLabelsArgs) => useScheduleDayLabels(a), {
    initialProps,
  });
}

describe("useScheduleDayLabels — the two agenda bundles (#774)", () => {
  it("names the day the narrow list is showing, while the flow tab keeps 'today'", () => {
    const { result } = setup();
    // The Dayflow tab IS today's list, so for it the two branches would say
    // the same thing — it stays on the today wording unconditionally.
    expect(result.current.agendaLabels.empty).toBe("scheduleScreen.emptyToday");
    expect(result.current.anchorAgendaLabels.empty).toBe(
      "scheduleScreen.emptyDay",
    );
  });

  it("says the same thing in both once the anchor IS today", () => {
    const { result } = setup({ anchorDate: TODAY });
    expect(result.current.anchorAgendaLabels.empty).toBe(
      "scheduleScreen.emptyToday",
    );
  });

  /*
   * The anchor bundle is a spread of the other plus the one key. Building it
   * from scratch is how the two lists end up with different words for
   * "all-day" or a now-line the day list forgot.
   */
  it("differs in that one key and nothing else", () => {
    const { result } = setup();
    expect({
      ...result.current.anchorAgendaLabels,
      empty: result.current.agendaLabels.empty,
    }).toEqual(result.current.agendaLabels);
  });

  it("carries the minute clock into the now-line caption of both", () => {
    const { result, rerender } = setup({ nowMinutes: 540 });
    expect(result.current.agendaLabels.nowLabel).toBe("09:00");
    expect(result.current.anchorAgendaLabels.nowLabel).toBe("09:00");

    rerender({
      anchorDate: ANCHOR,
      today: TODAY,
      view: "month",
      isWide: true,
      weekStart: WEEK_START,
      weekEnd: WEEK_END,
      nowMinutes: 545,
      statusLabels: STATUS_LABELS,
    });
    expect(result.current.agendaLabels.nowLabel).toBe("09:05");
  });
});

describe("useScheduleDayLabels — which day each caption names", () => {
  it("gives the narrow list the anchor day and the flow tab today", () => {
    const { result } = setup();
    // 20th vs 16th — the same formatter, pointed at two different days.
    expect(result.current.anchorDayLabel).toContain("20");
    expect(result.current.anchorDayLabel).not.toContain("16");
    expect(result.current.todayLabel).toContain("16");
    expect(result.current.todayLabel).not.toContain("20");
  });

  it("leaves the year to the heading above it (#878)", () => {
    const { result } = setup();
    expect(result.current.periodLabel).toContain("2026");
    expect(result.current.anchorDayLabel).not.toContain("2026");
  });
});

describe("useScheduleDayLabels — the memo boundaries", () => {
  it("keeps the two cell formatters across a clock tick, and re-derives the day labels on a move", () => {
    const { result, rerender } = setup();
    const before = {
      formatFullDay: result.current.formatFullDay,
      formatDayDate: result.current.formatDayDate,
    };

    const args = (over: Partial<UseScheduleDayLabelsArgs>) => ({
      anchorDate: ANCHOR,
      today: TODAY,
      view: "month",
      isWide: true,
      weekStart: WEEK_START,
      weekEnd: WEEK_END,
      nowMinutes: 540,
      statusLabels: STATUS_LABELS,
      ...over,
    });

    // A tick of the minute clock. Neither formatter reads it, so neither may
    // turn over — MonthGrid takes `formatFullDay` as a prop and the repeat
    // copy bundle takes it as a dependency.
    rerender(args({ nowMinutes: 541 }));
    expect(result.current.formatFullDay).toBe(before.formatFullDay);
    expect(result.current.formatDayDate).toBe(before.formatDayDate);

    // …and the other direction, so this is a boundary rather than a freeze:
    // moving the calendar has to move the labels bound to the anchor.
    rerender(args({ anchorDate: "2026-09-05" }));
    expect(result.current.periodLabel).toContain("September");
    expect(result.current.anchorDayLabel).toContain("September");
    expect(result.current.todayLabel).toContain("August");
    // The formatters are language-bound only — a move does not turn them over
    // either.
    expect(result.current.formatFullDay).toBe(before.formatFullDay);
  });
});
