import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  OverviewTab,
  type OverviewTabLabels,
} from "../src/components/Analytics/OverviewTab";
import { MobileAnalyticsView } from "../src/components/Analytics/MobileAnalyticsView";
import {
  aggregateByWeek,
  aggregateCalendarWeekByDay,
  calendarWeekRange,
  createdWithinRange,
} from "../src/utils/analyticsAggregation";
import { WEEK_START_STORAGE_KEY } from "../src/hooks/useWeekStart";
import { DAY_START_HOUR_STORAGE_KEY } from "../src/utils/dateKey";
import type { NoteNode } from "../src/types/note";
import type { TimerSession } from "../src/types/timer";
import { makeAnalyticsLabels } from "./helpers/analyticsLabels";

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
  todos: "Todos",
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
    completedTodos: "Completed",
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

/*
 * #860 / D-20260813-briefing-1 = A — the sequel to #780 above.
 *
 * #780 moved the "this week" NUMBERS onto the calendar week and stopped there.
 * The graphics beside them stayed on other windows: the mobile week bars drew
 * `aggregateByDay(sessions, 7)` (a rolling 7 days ending today) and the Work
 * tab's weekly buckets started on a hardcoded Monday. So mid-week the mobile
 * card showed a number for Mon–Sun above a row of bars for the last 7 days,
 * and a Sunday-start user got a Work chart cut along a boundary no other
 * screen used.
 *
 * The fixture week is Mon 2026-07-13 … Sun 2026-07-19. Three clocks are pinned
 * because each one is a different way to get the window wrong: mid-week (does
 * it stop at today, or fill the week?), the first day at 00:00 (does the
 * boundary belong to this week or the previous one?), and the last day at
 * 23:30 (does it roll into next week early?).
 *
 * Sun 2026-07-12 is the discriminator date throughout: it is inside the
 * rolling 7 days from Wed 07-15, outside the Monday-started week, and inside
 * the Sunday-started one.
 */

const MID_WEEK = new Date(2026, 6, 15, 10, 0, 0); // Wed 07-15 10:00
const WEEK_FIRST_DAY = new Date(2026, 6, 13, 0, 0, 0); // Mon 07-13 00:00
const WEEK_LAST_DAY = new Date(2026, 6, 19, 23, 30, 0); // Sun 07-19 23:30

/** The Monday-started week containing all three clocks above. */
const MON_WEEK_DAYS = [
  "2026-07-13",
  "2026-07-14",
  "2026-07-15",
  "2026-07-16",
  "2026-07-17",
  "2026-07-18",
  "2026-07-19",
];

function workSession(
  id: number,
  startedAt: Date,
  minutes: number,
): TimerSession {
  return {
    id,
    todoId: null,
    sessionType: "WORK",
    startedAt,
    completedAt: startedAt,
    duration: minutes * 60,
    completed: true,
    label: null,
  };
}

/** 60 min on Mon 07-13 (inside the Monday week) + 30 min on Sun 07-12 (not). */
const SESSIONS = [
  workSession(1, new Date(2026, 6, 13, 9, 0, 0), 60),
  workSession(2, new Date(2026, 6, 12, 9, 0, 0), 30),
];

describe("aggregateCalendarWeekByDay (#860)", () => {
  it("fills the whole week mid-week, leaving the days still to come empty", () => {
    const buckets = aggregateCalendarWeekByDay(SESSIONS, MID_WEEK, MONDAY);

    expect(buckets.map((b) => b.date)).toEqual(MON_WEEK_DAYS);
    // Mon got its hour; Sun 07-12 is out of the week even though a rolling
    // 7 days from Wed 07-15 (07-09…07-15) would have counted it.
    expect(buckets[0].totalMinutes).toBeCloseTo(60);
    expect(buckets.reduce((sum, b) => sum + b.totalMinutes, 0)).toBeCloseTo(60);
    // Thu…Sun have not happened yet — empty bars, not a shorter row.
    expect(buckets.slice(3).every((b) => b.totalMinutes === 0)).toBe(true);
  });

  it("returns all seven days on the week's first day, at 00:00 exactly", () => {
    const buckets = aggregateCalendarWeekByDay(
      SESSIONS,
      WEEK_FIRST_DAY,
      MONDAY,
    );

    expect(buckets.map((b) => b.date)).toEqual(MON_WEEK_DAYS);
    expect(buckets.reduce((sum, b) => sum + b.totalMinutes, 0)).toBeCloseTo(60);
  });

  it("stays in the same week on its last day, at 23:30", () => {
    const buckets = aggregateCalendarWeekByDay(SESSIONS, WEEK_LAST_DAY, MONDAY);

    expect(buckets.map((b) => b.date)).toEqual(MON_WEEK_DAYS);
    expect(buckets[0].totalMinutes).toBeCloseTo(60);
  });

  it("follows the pref: a Sunday start shifts the window and picks up 07-12", () => {
    const buckets = aggregateCalendarWeekByDay(SESSIONS, MID_WEEK, SUNDAY);

    expect(buckets.map((b) => b.date)).toEqual([
      "2026-07-12",
      "2026-07-13",
      "2026-07-14",
      "2026-07-15",
      "2026-07-16",
      "2026-07-17",
      "2026-07-18",
    ]);
    expect(buckets.reduce((sum, b) => sum + b.totalMinutes, 0)).toBeCloseTo(90);
  });

  it("covers exactly the window calendarWeekRange reports", () => {
    for (const now of [MID_WEEK, WEEK_FIRST_DAY, WEEK_LAST_DAY]) {
      for (const start of [MONDAY, SUNDAY] as const) {
        const buckets = aggregateCalendarWeekByDay([], now, start);
        const { startKey, endKey } = calendarWeekRange(now, start);
        expect(buckets).toHaveLength(7);
        expect(buckets[0].date).toBe(startKey);
        expect(buckets[6].date).toBe(endKey);
      }
    }
  });
});

describe("aggregateByWeek boundary (#860)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(MID_WEEK);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts each bucket on the configured Monday", () => {
    const buckets = aggregateByWeek(SESSIONS, 2, MONDAY);

    expect(buckets.map((b) => b.date)).toEqual(["2026-07-06", "2026-07-13"]);
    // Sun 07-12 closes the PREVIOUS week when the week starts on Monday.
    expect(buckets[0].totalMinutes).toBeCloseTo(30);
    expect(buckets[1].totalMinutes).toBeCloseTo(60);
  });

  it("moves the boundary when the week starts on Sunday", () => {
    const buckets = aggregateByWeek(SESSIONS, 2, SUNDAY);

    expect(buckets.map((b) => b.date)).toEqual(["2026-07-05", "2026-07-12"]);
    // Both sessions now sit in the current week — this is the displayed-value
    // change the decision accepted.
    expect(buckets[0].totalMinutes).toBe(0);
    expect(buckets[1].totalMinutes).toBeCloseTo(90);
  });
});

describe("Analytics mobile 'this week' card (#860)", () => {
  const MOBILE_LABELS = makeAnalyticsLabels();
  const DAY_NAME = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(MID_WEEK);
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  function renderMobileCard(): void {
    render(
      <MobileAnalyticsView
        sessions={SESSIONS}
        nodes={[]}
        todayItems={[]}
        scheduleItems={[]}
        notes={[]}
        routines={[]}
        loading={false}
        labels={MOBILE_LABELS}
      />,
    );
  }

  /** The day label under each bar, in the order the bars are drawn. */
  function barDays(): string[] {
    return screen.getAllByText(DAY_NAME).map((el) => el.textContent ?? "");
  }

  /** The card's header row: the title plus the week's work-time total. */
  function weekHeaderText(): string {
    return (
      screen.getByText(MOBILE_LABELS.mobile.weekTitle).closest("div")
        ?.textContent ?? ""
    );
  }

  it("draws Mon→Sun and totals only that week when the week starts on Monday", () => {
    localStorage.setItem(WEEK_START_STORAGE_KEY, "1");
    renderMobileCard();

    // A rolling 7 days from Wed would have read Thu,Fri,Sat,Sun,Mon,Tue,Wed.
    expect(barDays()).toEqual([
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
      "Sun",
    ]);
    expect(weekHeaderText()).toContain("60m");
  });

  it("draws Sun→Sat and totals 07-12 in when the week starts on Sunday", () => {
    localStorage.setItem(WEEK_START_STORAGE_KEY, "0");
    renderMobileCard();

    expect(barDays()).toEqual([
      "Sun",
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
    ]);
    // The number moved with the bars — that is the whole point of #860.
    expect(weekHeaderText()).toContain("90m");
  });
});
