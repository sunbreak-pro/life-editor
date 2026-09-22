import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { StreakDisplay } from "../src/components/Analytics/StreakDisplay";
import { i18n } from "../src/i18n";
import type { TimerSession } from "../src/types/timer";

/*
 * #1823 — a one-day streak reads「1 day」in English.
 *
 * `analytics.streak.days` was the fixed word「days」, so the widget printed
 * "1 days" next to a streak of one. Japanese was unaffected (it has one form),
 * which is why the bug survived: the surfaces it shows on — the Briefing
 * detail panel and the Analytics Overview tab — are read in ja here.
 *
 * Two halves, because either one alone can be green while the screen is
 * wrong: the CATALOG has to carry the plural forms, and the WIDGET has to hand
 * the count to the host so the right one is picked. §6.4 keeps useTranslation
 * out of shared UI, so the label arrives as a function — the same shape
 * TagHub formatCount already uses.
 */

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
    duration: 25 * 60,
    completed: true,
    label: null,
  };
}

const LABELS = {
  title: "Streaks",
  current: "Current",
  longest: "Longest",
  formatDays: (count: number) =>
    i18n.getFixedT("en")("analytics.streak.days", { count }),
  noStreak: "No streak yet",
};

/**
 * The unit printed on a tile — the second span of the value line, which is the
 * `<p>` immediately before the tile's label (#1863's markup).
 */
function unitOf(label: string): string {
  const value = screen.getByText(label).previousElementSibling;
  if (value === null) throw new Error(`the "${label}" tile has no value line`);
  const unit = value.children[1];
  if (unit === undefined) throw new Error(`the "${label}" value has no unit`);
  return unit.textContent ?? "";
}

describe("#1823 — the streak unit agrees with its number", () => {
  afterEach(cleanup);

  it("carries both English forms and the single Japanese one", () => {
    const en = i18n.getFixedT("en");
    expect(en("analytics.streak.days", { count: 1 })).toBe("day");
    expect(en("analytics.streak.days", { count: 2 })).toBe("days");
    expect(en("analytics.streak.days", { count: 0 })).toBe("days");

    // Japanese has one plural category, so both counts resolve to `_other`.
    const ja = i18n.getFixedT("ja");
    expect(ja("analytics.streak.days", { count: 1 })).toBe("日");
    expect(ja("analytics.streak.days", { count: 2 })).toBe("日");
  });

  it("prints one day for a one-day streak", () => {
    // One finished session today: current = longest = 1.
    render(<StreakDisplay sessions={[workSession(1, 0)]} labels={LABELS} />);
    expect(unitOf(LABELS.current)).toBe("day");
    expect(unitOf(LABELS.longest)).toBe("day");
  });

  it("prints two days for a two-day streak", () => {
    render(
      <StreakDisplay
        sessions={[workSession(1, 1), workSession(2, 0)]}
        labels={LABELS}
      />,
    );
    expect(unitOf(LABELS.current)).toBe("days");
    expect(unitOf(LABELS.longest)).toBe("days");
  });

  it("asks for each number its own unit", () => {
    // A widget that resolved the unit ONCE and printed it twice would be
    // green above. This pins the call itself: one per tile, each with its
    // own number.
    const seen: number[] = [];
    render(
      <StreakDisplay
        sessions={[workSession(1, 1), workSession(2, 0)]}
        labels={{
          ...LABELS,
          formatDays: (count) => {
            seen.push(count);
            return "d";
          },
        }}
      />,
    );
    expect(seen).toEqual([2, 2]);
  });
});
