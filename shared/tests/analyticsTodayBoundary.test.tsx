import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TodayDashboard } from "../src/components/Analytics/TodayDashboard";
import type { TimerSession } from "../src/types/timer";
import { DAY_START_HOUR_STORAGE_KEY } from "../src/utils/dateKey";

/*
 * #356 decision pin: Analytics' "today" is the wall CALENDAR day and stays
 * independent of the day-start-hour pref (`life-editor-day-start-hour`) that
 * Daily / routine sync follow via todayDateKey().
 *
 * Every Analytics bucket — the 30-day trends, the hour × weekday heatmap, the
 * 0–24h timeline axis — is keyed on the calendar date. Rolling only the
 * "today" cards over at HH:00 would make them disagree with the chart sitting
 * next to them, and (because each session's own key is a calendar key) would
 * drop exactly the small-hours sessions the shift is meant to capture. If
 * Analytics ever should follow the rollover, both sides of every comparison
 * have to move together — a separate, larger change than swapping these calls.
 */

const LABELS = {
  title: "Today",
  workTime: "Work time",
  completedTodos: "Completed",
  pomodoroCount: "Pomodoros",
  formatHours: (minutes: number) => `${Math.round(minutes)}m`,
};

function session(startedAt: string): TimerSession {
  const at = new Date(startedAt);
  return {
    id: 1,
    todoId: "task-1",
    sessionType: "WORK",
    startedAt: at,
    completedAt: at,
    duration: 1800, // 30 minutes
    completed: true,
    label: null,
  };
}

describe("Analytics 'today' boundary (#356)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 02:00 — inside the small-hours window where a 4 AM rollover would still
    // call this "yesterday".
    vi.setSystemTime(new Date("2026-07-11T02:00:00"));
    localStorage.setItem(DAY_START_HOUR_STORAGE_KEY, "4");
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it("counts a 01:00 session as today even with a 4 AM day-start pref", () => {
    render(
      <TodayDashboard
        sessions={[session("2026-07-11T01:00:00")]}
        nodes={[]}
        labels={LABELS}
      />,
    );

    expect(screen.getByText("30m")).toBeInTheDocument();
  });

  it("excludes the previous calendar day's late session", () => {
    render(
      <TodayDashboard
        sessions={[session("2026-07-10T23:30:00")]}
        nodes={[]}
        labels={LABELS}
      />,
    );

    expect(screen.getByText("0m")).toBeInTheDocument();
  });
});
