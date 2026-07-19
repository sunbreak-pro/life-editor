import { describe, it, expect } from "vitest";
import {
  buildWeekdayLabels,
  frequencyLabel,
  itemVariant,
  sortDayItems,
  type FrequencyLabelCopy,
} from "../src/utils/scheduleLabels";

/*
 * scheduleLabels (#280) — pure label/mapping helpers extracted from the web
 * Schedule host. Copy is injected already resolved (§6.4), so the tests pass
 * plain english stand-ins.
 */

const COPY: FrequencyLabelCopy = {
  daily: "Every day",
  weekdaysFallback: "Weekdays",
  group: "By group",
  intervalEvery: "Every",
  intervalDays: "days",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

describe("buildWeekdayLabels", () => {
  it("resolves the 7 scheduleCalendar.weekday* keys Sun-first", () => {
    const seen: string[] = [];
    const labels = buildWeekdayLabels((key) => {
      seen.push(key);
      return key.replace("scheduleCalendar.weekday", "");
    });
    expect(labels).toEqual(WEEKDAYS);
    expect(seen[0]).toBe("scheduleCalendar.weekdaySun");
    expect(seen).toHaveLength(7);
  });
});

describe("frequencyLabel", () => {
  it("daily → the daily copy", () => {
    expect(
      frequencyLabel(
        { frequencyType: "daily", frequencyDays: [], frequencyInterval: null },
        COPY,
        WEEKDAYS,
      ),
    ).toBe("Every day");
  });

  it("weekdays → sorted day names joined with ・", () => {
    expect(
      frequencyLabel(
        {
          frequencyType: "weekdays",
          frequencyDays: [5, 1, 3],
          frequencyInterval: null,
        },
        COPY,
        WEEKDAYS,
      ),
    ).toBe("Mon・Wed・Fri");
  });

  it("weekdays with no days → the fallback copy", () => {
    expect(
      frequencyLabel(
        {
          frequencyType: "weekdays",
          frequencyDays: [],
          frequencyInterval: null,
        },
        COPY,
        WEEKDAYS,
      ),
    ).toBe("Weekdays");
  });

  it("interval → every-N summary, defaulting a null interval to 1", () => {
    expect(
      frequencyLabel(
        {
          frequencyType: "interval",
          frequencyDays: [],
          frequencyInterval: 3,
        },
        COPY,
        WEEKDAYS,
      ),
    ).toBe("Every 3 days");
    expect(
      frequencyLabel(
        {
          frequencyType: "interval",
          frequencyDays: [],
          frequencyInterval: null,
        },
        COPY,
        WEEKDAYS,
      ),
    ).toBe("Every 1 days");
  });

  it("group → the group copy", () => {
    expect(
      frequencyLabel(
        { frequencyType: "group", frequencyDays: [], frequencyInterval: null },
        COPY,
        WEEKDAYS,
      ),
    ).toBe("By group");
  });
});

describe("sortDayItems", () => {
  it("puts all-day items first, then sorts by start time, without mutating", () => {
    const input = [
      { isAllDay: false, startTime: "14:00" },
      { isAllDay: true, startTime: "00:00" },
      { isAllDay: false, startTime: "09:00" },
    ];
    const sorted = sortDayItems(input);
    expect(sorted.map((i) => i.startTime)).toEqual(["00:00", "09:00", "14:00"]);
    expect(sorted[0].isAllDay).toBe(true);
    // input order untouched (slice-then-sort)
    expect(input[0].startTime).toBe("14:00");
  });
});

describe("itemVariant", () => {
  it("routine when routineId is set, event otherwise", () => {
    expect(itemVariant({ routineId: "routine-1" })).toBe("routine");
    expect(itemVariant({ routineId: null })).toBe("event");
  });
});
