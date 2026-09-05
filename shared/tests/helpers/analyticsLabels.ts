import type { AnalyticsLabels } from "../../src/components/Analytics/labels";

/*
 * A complete `AnalyticsLabels` fixture (#860).
 *
 * Every Analytics component takes the whole label tree even when it renders
 * three strings out of it (§6.4 — the shared tree holds no copy), so any suite
 * that renders one has to spell out ~100 lines of placeholder text. Two suites
 * predating this helper each wrote their own copy with suite-specific wording
 * (`analyticsResponsive.test.tsx`, `analyticsCompletedDayKey.test.tsx`); this
 * is where a third would have gone, and where those two should converge if
 * either is touched again.
 *
 * The day names are the plain English abbreviations because the mobile week
 * bars label each bar with one — a suite asserting the bar ORDER reads them
 * back, so they must stay distinct and stable.
 */
export function makeAnalyticsLabels(
  overrides: Partial<AnalyticsLabels> = {},
): AnalyticsLabels {
  const fmt = (m: number): string => `${Math.round(m)}m`;
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
      title: "Streaks",
      current: "Current",
      longest: "Longest",
      days: "days",
      noStreak: "Start a streak",
    },
    heatmap: {
      title: "Heatmap",
      meta: "Hour × Day",
      less: "Less",
      more: "More",
      days: {
        mon: "Mon",
        tue: "Tue",
        wed: "Wed",
        thu: "Thu",
        fri: "Fri",
        sat: "Sat",
        sun: "Sun",
      },
      tooltip: (m: number) => `${m} min`,
    },
    pomodoroRate: { title: "Pomodoro", actual: "Actual", target: "Target" },
    workBreak: {
      title: "Balance",
      work: "Work",
      break: "Break",
      longBreak: "Long Break",
    },
    timeline: { title: "Timeline", noSessions: "No sessions" },
    todoTrend: { title: "Trend", completedCount: "Completed" },
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
      title: "By Tag",
      noData: "No data",
      untagged: "Untagged",
      other: "Other tags",
    },
    tagUsage: {
      title: "Tag Usage",
      tag: "Tag",
      inRange: "Created in range",
      liveTotal: "Current total",
    },
    mobile: {
      weekTitle: "This Week",
      routineTitle: "Routine Rate",
      top3: "Top 3",
    },
    schedule: {
      totalEvents: "Total Events",
      completedEvents: "Completed",
      completionRate: "Completion Rate",
      activeRoutines: "Active Routines",
      routineRate: "Routine Rate",
      eventTrend: { title: "Event Trend", completed: "Completed" },
      timeDistribution: { title: "By Hour", count: "Events" },
      routineCompletion: { title: "Routine Rates", rate: "Rate" },
    },
    ...overrides,
  };
}
