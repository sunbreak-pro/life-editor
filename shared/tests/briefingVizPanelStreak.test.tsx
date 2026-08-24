import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { BriefingVizPanel } from "../src/components/briefing/BriefingVizPanel";
import type { TimerSession } from "../src/types/timer";

/*
 * #993 — a finished work session reaches the streak the panel draws.
 *
 * The sync half of #993 landed in PR #1078: `timer_sessions` moved to its own
 * `sessions` domain so a pomodoro press stops making TimerProvider re-read the
 * settings, and Briefing followed the session log onto that new domain. But
 * every guard written for it stops one layer short — they assert that the
 * refetch EFFECT re-ran, never that the rows it read reach a widget. The whole
 * regression risk of that split is the other direction: Briefing quietly
 * losing its live streak because it is now the only reader of a domain nobody
 * else watches. Until something renders StreakDisplay with a non-empty
 * `sessions` array, "Briefing shows the streak" is untested.
 *
 * That is this file. `web/tests/briefingDataFetch.test.tsx` owns the other
 * half — that a `sessions` bump republishes new rows into `data.sessions`.
 *
 * Dates are built relative to now on purpose: computeWorkStreak reads the
 * system clock and only counts a current streak anchored to today or
 * yesterday, so a hardcoded fixture would rot into a silent zero.
 */

const LABELS = {
  title: "Panel",
  streak: {
    title: "Work streak",
    current: "Current",
    longest: "Longest",
    days: "days",
    noStreak: "No streak yet",
  },
  trend: { title: "Completions", completedCount: "Completed" },
  balance: {
    title: "Work / break",
    work: "Work",
    break: "Break",
    longBreak: "Long break",
  },
};

/** A finished 25-minute WORK session `daysAgo` days back. */
function workSession(id: number, daysAgo: number): TimerSession {
  const startedAt = new Date();
  startedAt.setDate(startedAt.getDate() - daysAgo);
  startedAt.setHours(10, 0, 0, 0);
  const completedAt = new Date(startedAt);
  completedAt.setMinutes(completedAt.getMinutes() + 25);
  return {
    id,
    todoId: null,
    sessionType: "WORK",
    startedAt,
    completedAt,
    // getWorkSessions drops anything without a positive duration, so a session
    // that merely exists is not enough — it has to have finished.
    duration: 25 * 60,
    completed: true,
    label: null,
  };
}

function renderPanel(sessions: TimerSession[]) {
  return render(
    <BriefingVizPanel
      sessions={sessions}
      todoNodes={[]}
      title={LABELS.title}
      streakLabels={LABELS.streak}
      trendLabels={LABELS.trend}
      balanceLabels={LABELS.balance}
    />,
  );
}

describe("BriefingVizPanel — the session log reaches the streak (#993)", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("shows the empty copy while the session log is empty", () => {
    renderPanel([]);
    expect(screen.getByText(LABELS.streak.noStreak)).toBeTruthy();
  });

  it("draws the streak once finished work sessions arrive", () => {
    // Yesterday and today — a current streak of 2.
    renderPanel([workSession(1, 1), workSession(2, 0)]);

    expect(screen.queryByText(LABELS.streak.noStreak)).toBeNull();
    // Both counters read 2; querying by the label's own row keeps this from
    // matching some unrelated "2" the charts might print.
    const current = screen.getByText(`${LABELS.streak.current} (days)`);
    expect(current.parentElement?.textContent).toContain("2");
    const longest = screen.getByText(`${LABELS.streak.longest} (days)`);
    expect(longest.parentElement?.textContent).toContain("2");
  });

  it("re-derives the streak when a new session is appended", () => {
    // Stands in for the Realtime echo of a timer_sessions INSERT: same panel,
    // one more row. Re-rendering with a longer array must move the number —
    // this is what a memo keyed on the wrong thing would break.
    const { rerender } = renderPanel([workSession(1, 0)]);
    const current = screen.getByText(`${LABELS.streak.current} (days)`);
    expect(current.parentElement?.textContent).toContain("1");

    rerender(
      <BriefingVizPanel
        sessions={[workSession(1, 1), workSession(2, 0)]}
        todoNodes={[]}
        title={LABELS.title}
        streakLabels={LABELS.streak}
        trendLabels={LABELS.trend}
        balanceLabels={LABELS.balance}
      />,
    );

    const after = screen.getByText(`${LABELS.streak.current} (days)`);
    expect(after.parentElement?.textContent).toContain("2");
  });

  it("ignores sessions that never finished", () => {
    // A running session has no duration yet. If it counted, starting a timer
    // would light up the streak before any work was done.
    const running = { ...workSession(1, 0), duration: null, completed: false };
    renderPanel([running]);
    expect(screen.getByText(LABELS.streak.noStreak)).toBeTruthy();
  });
});
