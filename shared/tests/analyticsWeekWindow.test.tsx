import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  OverviewTab,
  type OverviewTabLabels,
} from "../src/components/Analytics/OverviewTab";
import {
  calendarWeekRange,
  createdWithinRange,
} from "../src/utils/analyticsAggregation";
import { WEEK_START_STORAGE_KEY } from "../src/hooks/useWeekStart";
import { DAY_START_HOUR_STORAGE_KEY } from "../src/utils/dateKey";
import type { NoteNode } from "../src/types/note";

/*
 * #780 / D-20260811-refactor-1 = A. Every "this week" number in Analytics reads
 * the CALENDAR week containing now. The notes cards used to read a rolling
 * 7-day window instead, so two differently-defined numbers sat under one label.
 *
 * Three boundaries are pinned here, because each one moved a number:
 *   1. the week's first day counts from 00:00, its predecessor never does
 *      (the rolling window DID count the day before — this is the changed one);
 *   2. the first day is the `useWeekStart` pref, not a hardcoded Monday;
 *   3. the day-start-hour pref does NOT shift it (#356) — Analytics is keyed on
 *      the wall calendar, so a 01:00 note belongs to that calendar day even
 *      when Daily's rollover would still call it yesterday.
 *
 * Dates: Mon 2026-07-13 sits in the Mon 07-13…Sun 07-19 week when the pref is
 * Monday, and in the Sun 07-12…Sat 07-18 week when it is Sunday (the default).
 * TZ is pinned to Asia/Tokyo (vitest.config.ts), where the stored UTC instant
 * and the local calendar day genuinely disagree.
 */

const MONDAY = 1;
const SUNDAY = 0;

describe("calendarWeekRange (#780)", () => {
  it("starts on the configured Monday and ends on the following Sunday", () => {
    // 10:00 on the first day of the week.
    expect(calendarWeekRange(new Date(2026, 6, 13, 10, 0, 0), MONDAY)).toEqual({
      startKey: "2026-07-13",
      endKey: "2026-07-19",
    });
  });

  it("includes the first day from 00:00 exactly", () => {
    expect(calendarWeekRange(new Date(2026, 6, 13, 0, 0, 0), MONDAY)).toEqual({
      startKey: "2026-07-13",
      endKey: "2026-07-19",
    });
  });

  it("puts the instant just before that midnight in the previous week", () => {
    expect(
      calendarWeekRange(new Date(2026, 6, 12, 23, 59, 59, 999), MONDAY),
    ).toEqual({ startKey: "2026-07-06", endKey: "2026-07-12" });
  });

  it("keeps the last day (Sunday) in the week that started on Monday", () => {
    expect(calendarWeekRange(new Date(2026, 6, 19, 23, 30, 0), MONDAY)).toEqual(
      { startKey: "2026-07-13", endKey: "2026-07-19" },
    );
  });

  it("follows the pref: the same Monday sits in a Sunday-started week", () => {
    expect(calendarWeekRange(new Date(2026, 6, 13, 10, 0, 0), SUNDAY)).toEqual({
      startKey: "2026-07-12",
      endKey: "2026-07-18",
    });
  });

  it("ignores the day-start-hour pref (#356)", () => {
    localStorage.setItem(DAY_START_HOUR_STORAGE_KEY, "4");
    try {
      // 01:00 on the first day: a 4 AM rollover would still call this the
      // previous (calendar) day, which would be the previous week.
      expect(calendarWeekRange(new Date(2026, 6, 13, 1, 0, 0), MONDAY)).toEqual(
        {
          startKey: "2026-07-13",
          endKey: "2026-07-19",
        },
      );
    } finally {
      localStorage.clear();
    }
  });
});

describe("createdWithinRange (#780)", () => {
  function noteCreatedAt(id: string, createdAt: Date): NoteNode {
    return {
      id,
      type: "note",
      title: id,
      content: "",
      parentId: null,
      order: 0,
      isPinned: false,
      isDeleted: false,
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(),
    };
  }

  it("includes both ends of the range and nothing outside it", () => {
    const items = [
      noteCreatedAt("before", new Date(2026, 6, 12, 23, 59, 0)),
      noteCreatedAt("first-day", new Date(2026, 6, 13, 0, 0, 0)),
      noteCreatedAt("last-day", new Date(2026, 6, 19, 23, 59, 0)),
      noteCreatedAt("after", new Date(2026, 6, 20, 0, 0, 0)),
    ];

    expect(
      createdWithinRange(items, "2026-07-13", "2026-07-19").map((n) => n.id),
    ).toEqual(["first-day", "last-day"]);
  });

  it("skips items whose createdAt is unparseable", () => {
    const broken = { ...noteCreatedAt("broken", new Date()), createdAt: "" };
    expect(createdWithinRange([broken], "2026-07-13", "2026-07-19")).toEqual(
      [],
    );
  });
});

const HOURS = (minutes: number): string => `${Math.round(minutes)}m`;

const LABELS: OverviewTabLabels = {
  tasks: "Tasks",
  events: "Events",
  notes: "Notes",
  work: "Work",
  routines: "Routines",
  tags: "Tags",
  completed: "completed",
  today: "today",
  rate: "rate",
  thisWeek: "this week",
  assigned: "assigned",
  formatHours: HOURS,
  todayCard: {
    title: "Today",
    workTime: "Work time",
    completedTasks: "Completed",
    pomodoroCount: "Pomodoros",
    formatHours: HOURS,
  },
  weekly: {
    title: "This week",
    workTimeLabel: "Work time",
    sessionsLabel: "Sessions",
    completedLabel: "Completed",
    formatHours: HOURS,
  },
  streak: {
    title: "Streak",
    current: "Current",
    longest: "Longest",
    days: "days",
    noStreak: "No streak yet",
  },
};

/** Mon 2026-07-13 10:00 local — mid-morning on a Monday. */
const NOW = new Date(2026, 6, 13, 10, 0, 0);

function note(id: string, createdAt: Date): NoteNode {
  return {
    id,
    type: "note",
    title: id,
    content: "",
    parentId: null,
    order: 0,
    isPinned: false,
    isDeleted: false,
    createdAt: createdAt.toISOString(),
    updatedAt: createdAt.toISOString(),
  };
}

function renderNotesCard(notes: NoteNode[]): void {
  render(
    <OverviewTab
      sessions={[]}
      nodes={[]}
      todayItems={[]}
      notes={notes}
      routines={[]}
      tagCount={0}
      assignmentCount={0}
      labels={LABELS}
    />,
  );
}

/** The notes stat card renders its count as "+<n> this week". */
function notesThisWeekText(): string {
  return screen.getByText(LABELS.notes).closest("div")?.textContent ?? "";
}

describe("Analytics 'notes this week' window (#780)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    // 4 AM rollover: Daily would still call 01:00 "yesterday". Analytics must
    // not (#356), and the assertions below hold with it set.
    localStorage.setItem(DAY_START_HOUR_STORAGE_KEY, "4");
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it("counts a note written at 01:00 on the week's first day", () => {
    localStorage.setItem(WEEK_START_STORAGE_KEY, "1");
    renderNotesCard([note("monday-1am", new Date(2026, 6, 13, 1, 0, 0))]);

    expect(notesThisWeekText()).toContain(`+1 ${LABELS.thisWeek}`);
  });

  it("drops the previous week's last day — the rolling window kept it", () => {
    localStorage.setItem(WEEK_START_STORAGE_KEY, "1");
    renderNotesCard([note("sunday-2330", new Date(2026, 6, 12, 23, 30, 0))]);

    expect(notesThisWeekText()).toContain(`+0 ${LABELS.thisWeek}`);
  });

  it("counts that same note when the week starts on Sunday", () => {
    localStorage.setItem(WEEK_START_STORAGE_KEY, "0");
    renderNotesCard([note("sunday-2330", new Date(2026, 6, 12, 23, 30, 0))]);

    expect(notesThisWeekText()).toContain(`+1 ${LABELS.thisWeek}`);
  });

  it("drops a note from 8 days ago that the rolling 7-day window kept", () => {
    localStorage.setItem(WEEK_START_STORAGE_KEY, "1");
    renderNotesCard([note("last-monday", new Date(2026, 6, 6, 12, 0, 0))]);

    expect(notesThisWeekText()).toContain(`+0 ${LABELS.thisWeek}`);
  });
});
