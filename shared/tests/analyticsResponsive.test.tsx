import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AnalyticsView } from "../src/components/Analytics/AnalyticsView";
import type { AnalyticsViewProps } from "../src/components/Analytics/AnalyticsView";
import type { AnalyticsLabels } from "../src/components/Analytics/labels";
import type { TimerSession } from "../src/types/timer";

/*
 * AnalyticsView branches on width (design-analytics-v2): Desktop (≥768px, the
 * useMediaQuery fallback under jsdom) shows the 4-tab dashboard + the header
 * date-range preset pills; Mobile (<768px, mocked matchMedia) collapses to a
 * single Consumption scroll with no tabs and no period control.
 *
 * The default tab (Overview) + the Mobile view render no recharts, so jsdom's
 * missing ResizeObserver never trips here.
 */

function makeLabels(): AnalyticsLabels {
  const fmt = (m: number) => `${Math.floor(m / 60)}h ${Math.round(m % 60)}m`;
  const day = {
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
      tasks: "Tasks",
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
    taskWorkTime: "Work Time by Task",
    totalWorkTime: "Total Work Time",
    sessions: "Sessions",
    avgPerDay: "Avg / Day",
    emptyWork: { title: "No work sessions yet", description: "Start a timer." },
    emptySchedule: { title: "No events", description: "Add events." },
    emptyMobile: { title: "Nothing recorded yet", description: "Get started." },
    overview: {
      tasks: "Tasks",
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
      workTime: "Work Time",
      completedTasks: "Completed",
      pomodoroCount: "Pomodoros",
    },
    weekly: {
      title: "Weekly",
      workTimeLabel: "Work Time",
      sessionsLabel: "Sessions",
      completedLabel: "Completed",
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
      days: day,
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
    taskTrend: { title: "Trend", completedCount: "Completed" },
    stagnation: { title: "Stagnation", tasks: "tasks" },
    projectTime: { title: "By Project", noData: "No data" },
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
  };
}

function todaySession(): TimerSession {
  return {
    id: "s1",
    sessionType: "WORK",
    duration: 1500,
    startedAt: new Date().toISOString(),
    completed: true,
  } as unknown as TimerSession;
}

function baseProps(over?: Partial<AnalyticsViewProps>): AnalyticsViewProps {
  return {
    sessions: [],
    nodes: [],
    todayItems: [],
    scheduleItems: [],
    notes: [],
    routines: [],
    taskNameMap: new Map(),
    tagCount: 0,
    assignmentCount: 0,
    targetPerDay: 4,
    labels: makeLabels(),
    ...over,
  };
}

function mockMatchMedia(matches: boolean) {
  // @ts-expect-error — minimal MediaQueryList stub for jsdom.
  window.matchMedia = () => ({
    matches,
    media: "",
    addEventListener: () => {},
    removeEventListener: () => {},
  });
}

afterEach(() => {
  // @ts-expect-error — remove the stub so the fallback (wide) path is default.
  delete window.matchMedia;
});

describe("AnalyticsView responsive branch", () => {
  it("Desktop (wide) renders the 4 header tabs + the date-range preset group", () => {
    render(<AnalyticsView {...baseProps()} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(4);
    expect(tabs.map((t) => t.textContent)).toEqual([
      "Overview",
      "Tasks",
      "Work",
      "Schedule",
    ]);
    expect(
      screen.getByRole("radiogroup", { name: "Date range" }),
    ).toBeInTheDocument();
  });

  it("Desktop switches tab content on click (Work tab → empty state)", () => {
    render(<AnalyticsView {...baseProps()} />);
    fireEvent.click(screen.getByRole("tab", { name: "Work" }));
    expect(screen.getByText("No work sessions yet")).toBeInTheDocument();
  });

  it("Desktop controlled (shell-lifted band) drops the in-body tabs, keeps the preset, and follows activeTab", () => {
    render(
      <AnalyticsView
        {...baseProps({ activeTab: "work", onTabChange: vi.fn() })}
      />,
    );
    // The shell SectionHeader owns the tab band now — no in-body tabs.
    expect(screen.queryByRole("tab")).toBeNull();
    // The date-range preset stays in-body (right-aligned to the data column).
    expect(
      screen.getByRole("radiogroup", { name: "Date range" }),
    ).toBeInTheDocument();
    // Content follows the controlled activeTab (Work → its empty state).
    expect(screen.getByText("No work sessions yet")).toBeInTheDocument();
  });

  it("Mobile (narrow) collapses to a single scroll: no tabs, no preset control", () => {
    mockMatchMedia(false);
    render(<AnalyticsView {...baseProps({ sessions: [todaySession()] })} />);
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.queryByRole("radiogroup")).toBeNull();
    // The mobile "Today" card heading is present (single-scroll content).
    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  it("Mobile with no data shows the mobile empty state", () => {
    mockMatchMedia(false);
    render(<AnalyticsView {...baseProps()} />);
    expect(screen.getByText("Nothing recorded yet")).toBeInTheDocument();
  });
});
