import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TodayDashboard } from "../src/components/Analytics/TodayDashboard";
import { WeeklySummary } from "../src/components/Analytics/WeeklySummary";
import { MobileAnalyticsView } from "../src/components/Analytics/MobileAnalyticsView";
import { OverviewTab } from "../src/components/Analytics/OverviewTab";
import type { AnalyticsLabels } from "../src/components/Analytics/labels";
import { aggregateTodoCompletionTrend } from "../src/utils/analyticsAggregation";
import type { TodoNode } from "../src/types/todoTree";
import type { NoteNode } from "../src/types/note";

/*
 * #420 regression guard. `completedAt` is written as a UTC ISO string
 * (`new Date().toISOString()`), but every Analytics bucket is keyed on the
 * LOCAL calendar day (#356). The five consumers below used to slice the first
 * 10 characters off the ISO string, which reads the UTC day — so east of UTC a
 * todo finished in the small hours was filed on the PREVIOUS day and vanished
 * from "today" (in JST, anything before 09:00).
 *
 * Fixture: Monday 2026-07-13, completed at 01:00 LOCAL. That single instant
 * covers all five sites at once — it is "today", the first day of the current
 * week, and the newest trend bucket.
 *
 * The positive assertions hold in every timezone. The "a slice would have
 * disagreed" assertion is guarded, because in UTC (and west of it) the local
 * and UTC days coincide and the claim is vacuous — same convention as
 * dateKeyOfInstant.test.ts (#413).
 */

const TODAY_KEY = "2026-07-13";
const NOW = new Date(2026, 6, 13, 10, 0, 0); // Mon 2026-07-13 10:00 local
const COMPLETED_AT = new Date(2026, 6, 13, 1, 0, 0); // same day, 01:00 local
const COMPLETED_ISO = COMPLETED_AT.toISOString();
/** East of UTC the sliced UTC key lands on the previous day — the #420 bug. */
const SLICE_READS_ANOTHER_DAY = COMPLETED_AT.getTimezoneOffset() < 0;

function earlyMorningTodo(): TodoNode {
  return {
    id: "task-1",
    type: "task",
    title: "Finished at 1 AM",
    parentId: null,
    order: 0,
    status: "DONE",
    createdAt: new Date(2026, 6, 12, 9, 0, 0).toISOString(),
    completedAt: COMPLETED_ISO,
  };
}

const TODAY_LABELS = {
  title: "Today",
  workTime: "Work time",
  completedTodos: "Completed today",
  pomodoroCount: "Pomodoros",
  formatHours: (minutes: number) => `${Math.round(minutes)}m`,
};

const WEEKLY_LABELS = {
  title: "This week",
  workTimeLabel: "Work time",
  sessionsLabel: "Sessions",
  completedLabel: "Completed this week",
  formatHours: (minutes: number) => `${Math.round(minutes)}m`,
};

function makeMobileLabels(): AnalyticsLabels {
  const fmt = (m: number) => `${Math.round(m)}m`;
  const days = {
    mon: "Mon",
    tue: "Tue",
    wed: "Wed",
    thu: "Thu",
    fri: "Fri",
    sat: "Sat",
    sun: "Sun",
  };
  return {
    title: "Analytics",
    formatHours: fmt,
    tabsLabel: "Analytics views",
    tabs: {
      overview: "Overview",
      todos: "Todos",
      schedule: "Schedule",
      work: "Work",
    },
    datePreset: {
      label: "Date range",
      options: {
        "7d": "7 days",
        "30d": "30 days",
        thisMonth: "This month",
        "3m": "3 months",
        all: "All time",
      },
    },
    period: { day: "Day", week: "Week", month: "Month" },
    workTime: "Work Time",
    todoWorkTime: "Work Time by Todo",
    noTodo: "No Todo",
    totalWorkTime: "Total Work Time",
    sessions: "Sessions",
    avgPerDay: "Avg / Day",
    emptyWork: { title: "No work sessions yet", description: "Start a timer." },
    emptySchedule: { title: "No events", description: "Add events." },
    emptyMobile: { title: "Nothing recorded yet", description: "Get started." },
    emptyTagUsage: { title: "No tagged items", description: "Tag something." },
    overview: {
      todos: "Todos",
      events: "Events",
      notes: "Notes",
      work: "Work Time",
      routines: "Routines",
      tags: "Tags",
      completed: "completed",
      today: "today",
      rate: "rate",
      thisWeek: "this week",
      assigned: "assigned",
    },
    todayCard: {
      title: "Today",
      workTime: "Work time",
      completedTodos: "Completed today",
      pomodoroCount: "Pomodoros",
    },
    weekly: {
      title: "This week",
      workTimeLabel: "Work time",
      sessionsLabel: "Sessions",
      completedLabel: "Completed this week",
    },
    streak: {
      title: "Streak",
      current: "Current",
      longest: "Longest",
      days: "days",
      noStreak: "No streak yet",
    },
    heatmap: {
      title: "Heatmap",
      meta: "Hour x Weekday",
      less: "Less",
      more: "More",
      days,
      tooltip: (minutes: number) => `${minutes} min`,
    },
    pomodoroRate: {
      title: "Pomodoro rate",
      actual: "Actual",
      target: "Target",
    },
    workBreak: {
      title: "Work / Break",
      work: "Work",
      break: "Break",
      longBreak: "Long break",
    },
    timeline: { title: "Timeline", noSessions: "No sessions" },
    todoTrend: { title: "Todo trend", completedCount: "Completed" },
    stagnation: {
      title: "Stagnation",
      todos: "todos",
      buckets: {
        under1Week: "< 1 week",
        "1to2Weeks": "1-2 weeks",
        "2to4Weeks": "2-4 weeks",
        "1to3Months": "1-3 months",
        over3Months: "3+ months",
      },
    },
    tagTime: {
      title: "Time by tag",
      noData: "No data",
      untagged: "Untagged",
      other: "Other",
    },
    tagUsage: {
      title: "Tag Usage",
      tag: "Tag",
      inRange: "Created in range",
      liveTotal: "Current total",
    },
    mobile: {
      weekTitle: "This week",
      routineTitle: "Routines",
      top3: "Top 3",
    },
    schedule: {
      totalEvents: "Events",
      completedEvents: "Completed",
      completionRate: "Completion rate",
      activeRoutines: "Active routines",
      routineRate: "Routine rate",
      eventTrend: { title: "Event trend", completed: "Completed" },
      timeDistribution: { title: "Time distribution", count: "Count" },
      routineCompletion: { title: "Routine completion", rate: "Rate" },
    },
  };
}

/*
 * `createdAt` is the same story as `completedAt` (#420 QA follow-up): stored as
 * a UTC ISO string, compared against a LOCAL `formatDateKey` week boundary in
 * the "notes this week" stat. A note written at 01:00 local on the boundary day
 * therefore fell just outside the window east of UTC.
 *
 * The boundary day moved with #780: the window is now the calendar week
 * containing NOW, so its first day — Sunday 2026-07-12 under the default
 * week-start pref — is what the note has to land on. (It was NOW − 7d while the
 * stat ran on a rolling 7-day window.) The window itself is pinned in
 * `analyticsWeekWindow.test.tsx`; this file only guards the UTC-vs-local key.
 */
const WEEK_START_KEY = "2026-07-12"; // first day of the week containing NOW
const NOTE_CREATED_AT = new Date(2026, 6, 12, 1, 0, 0); // boundary day, 01:00 local

function earlyMorningNote(): NoteNode {
  return {
    id: "note-1",
    type: "note",
    title: "Written at 1 AM",
    content: "",
    parentId: null,
    order: 0,
    isPinned: false,
    isDeleted: false,
    createdAt: NOTE_CREATED_AT.toISOString(),
    updatedAt: NOTE_CREATED_AT.toISOString(),
  };
}

describe("Analytics completedAt day key (#420)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stores completedAt as a UTC instant that a slice would misread", () => {
    if (SLICE_READS_ANOTHER_DAY) {
      expect(COMPLETED_ISO.slice(0, 10)).not.toBe(TODAY_KEY);
    }
    // Always true: the instant IS the local calendar day under test.
    expect(COMPLETED_AT.getDate()).toBe(13);
  });

  it("buckets a 01:00 completion into today's completion-trend bucket", () => {
    const buckets = aggregateTodoCompletionTrend([earlyMorningTodo()], 30);
    const today = buckets.find((b) => b.date === TODAY_KEY);

    expect(today?.completedCount).toBe(1);
    // No other day absorbed it — the pre-fix bug moved it to the day before.
    expect(buckets.reduce((sum, b) => sum + b.completedCount, 0)).toBe(1);
  });

  it("counts a 01:00 completion in the desktop today card", () => {
    render(
      <TodayDashboard
        sessions={[]}
        nodes={[earlyMorningTodo()]}
        labels={TODAY_LABELS}
      />,
    );

    const row = screen.getByText(TODAY_LABELS.completedTodos).parentElement;
    expect(row).toHaveTextContent("1");
  });

  it("counts a 01:00 Monday completion in the weekly summary", () => {
    render(
      <WeeklySummary
        sessions={[]}
        nodes={[earlyMorningTodo()]}
        labels={WEEKLY_LABELS}
      />,
    );

    const row = screen.getByText(WEEKLY_LABELS.completedLabel).parentElement;
    expect(row).toHaveTextContent("1");
  });

  it("counts a 01:00 completion in the mobile today card and week window", () => {
    const labels = makeMobileLabels();
    const { container } = render(
      <MobileAnalyticsView
        sessions={[]}
        nodes={[earlyMorningTodo()]}
        todayItems={[]}
        scheduleItems={[]}
        notes={[]}
        routines={[]}
        loading={false}
        labels={labels}
      />,
    );

    const todayCell = screen.getByText(
      labels.todayCard.completedTodos,
    ).parentElement;
    expect(todayCell).toHaveTextContent("1");
    // Week line renders "<completedLabel> <count>" (MobileAnalyticsView week window).
    expect(container.textContent).toContain(
      `${labels.weekly.completedLabel} 1`,
    );
  });
});

describe("Analytics createdAt day key (#420 QA follow-up)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("puts a note written at 01:00 on the boundary day inside the week", () => {
    if (SLICE_READS_ANOTHER_DAY) {
      // The old slice read the previous UTC day, which sorts BELOW the
      // inclusive boundary — that is exactly how the note fell out.
      expect(earlyMorningNote().createdAt.slice(0, 10) >= WEEK_START_KEY).toBe(
        false,
      );
    }

    const labels = makeMobileLabels();
    const { container } = render(
      <MobileAnalyticsView
        sessions={[]}
        nodes={[]}
        todayItems={[]}
        scheduleItems={[]}
        notes={[earlyMorningNote()]}
        routines={[]}
        loading={false}
        labels={labels}
      />,
    );

    // Notes stat renders "+<count> <thisWeek>".
    expect(container.textContent).toContain(`+1 ${labels.overview.thisWeek}`);
  });

  it("counts the same note in the desktop overview stat", () => {
    const labels = makeMobileLabels();
    const { container } = render(
      <OverviewTab
        sessions={[]}
        nodes={[]}
        todayItems={[]}
        events={[]}
        notes={[earlyMorningNote()]}
        routines={[]}
        tags={[]}
        assignments={[]}
        dateRange={{ start: new Date(), end: new Date() }}
        labels={{
          ...labels.overview,
          formatHours: labels.formatHours,
          todayCard: { ...labels.todayCard, formatHours: labels.formatHours },
          weekly: { ...labels.weekly, formatHours: labels.formatHours },
          streak: labels.streak,
          tagUsage: {
            ...labels.tagUsage,
            rangeLabel: labels.datePreset.options["30d"],
            empty: labels.emptyTagUsage,
          },
        }}
      />,
    );

    expect(container.textContent).toContain(`+1 ${labels.overview.thisWeek}`);
  });
});
