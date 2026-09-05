import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { StreakDisplay } from "../src/components/Analytics/StreakDisplay";
import type { TimerSession } from "../src/types/timer";

/*
 * #1467 — the streak card's two tiles line up.
 *
 * In the ~320px detail panel the right tile is 13px narrower than the left one
 * (it draws the divider between them: `border-l` + `pl-3`), so「最長 (日)」ran
 * out of room and wrapped after「最長」while「現在 (日)」stayed on one line.
 * The row centres its contents, so the taller of the two blocks pushed its
 * number up and the two counters no longer sat on the same line.
 *
 * jsdom has no layout (CLAUDE.md §7.1) — a test here cannot measure the wrap.
 * What it can pin is the two structural facts that make the wrap impossible:
 * the label is one word (the unit moved onto the number's line), and both lines
 * declare `truncate`, which is `white-space: nowrap` plus an ellipsis. A label
 * that cannot break cannot make its tile taller than its neighbour's.
 */

const LABELS = {
  title: "Streaks",
  current: "Current",
  longest: "Longest",
  days: "days",
  noStreak: "No streak yet",
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
    duration: 25 * 60,
    completed: true,
    label: null,
  };
}

/** Yesterday + today = a current streak of 2, and a longest of 2. */
function renderStreak() {
  return render(
    <StreakDisplay
      sessions={[workSession(1, 1), workSession(2, 0)]}
      labels={LABELS}
    />,
  );
}

/** The `<p>` that prints a tile's label, and the `<p>` that prints its number. */
function tile(label: string): { label: HTMLElement; number: HTMLElement } {
  const el = screen.getByText(label);
  const number = el.previousElementSibling;
  if (number === null) throw new Error(`the "${label}" tile has no number`);
  return { label: el, number: number as HTMLElement };
}

describe("Streak tiles keep their label on one line (#1467)", () => {
  afterEach(cleanup);

  it("prints the label alone — the unit is no longer parenthesised after it", () => {
    renderStreak();
    // The old markup rendered "Longest (days)", which is what ran out of room.
    expect(tile(LABELS.longest).label.textContent).toBe(LABELS.longest);
    expect(tile(LABELS.current).label.textContent).toBe(LABELS.current);
    expect(screen.queryByText(`${LABELS.longest} (${LABELS.days})`)).toBeNull();
  });

  it("moves the unit onto the number's own line", () => {
    renderStreak();
    // Same information, half the width: "2 days" reads as one figure, and the
    // line under it is then short enough for the narrower tile.
    expect(tile(LABELS.longest).number.textContent).toBe(`2${LABELS.days}`);
    expect(tile(LABELS.current).number.textContent).toBe(`2${LABELS.days}`);
  });

  it("declares both lines of both tiles unwrappable", () => {
    renderStreak();
    for (const label of [LABELS.current, LABELS.longest]) {
      const { label: text, number } = tile(label);
      expect(text.className).toContain("truncate");
      expect(number.className).toContain("truncate");
    }
  });

  it("styles the two tiles identically, so neither can outgrow the other", () => {
    renderStreak();
    // Any difference between these class lists is a difference in how the two
    // halves of the card wrap — which is the bug this file guards.
    expect(tile(LABELS.current).label.className).toBe(
      tile(LABELS.longest).label.className,
    );
    expect(tile(LABELS.current).number.className).toBe(
      tile(LABELS.longest).number.className,
    );
  });

  it("still shows the empty copy when nothing has been worked yet", () => {
    render(<StreakDisplay sessions={[]} labels={LABELS} />);
    expect(screen.getByText(LABELS.noStreak)).toBeTruthy();
  });
});
