import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import {
  evenDateTicks,
  MAX_DATE_TICKS,
  NARROW_MAX_DATE_TICKS,
} from "../src/components/Analytics/chartTheme";
// vi.mock below is hoisted above this import, so the panel's lazy() charts
// resolve to the stubs.
import { BriefingVizPanel } from "../src/components/briefing/BriefingVizPanel";

/*
 * #2505 — on a phone the morning paper's charts sit in the MobileDrawer
 * (~316px on a 390px screen), and the seven date labels of the 7-day axes
 * touched: "10-2710-2810-29…". Below the wide breakpoint the panel asks the
 * charts for fewer ticks; on the wide panel and in Analytics nothing changes.
 *
 * jsdom has no layout, so recharts' ResponsiveContainer draws no axis here.
 * The charts are stubbed to print the tick budget they were handed, and the
 * budget itself is checked against `evenDateTicks` — the function both charts
 * feed it to.
 */

vi.mock("../src/components/Analytics/TodoCompletionTrend", () => ({
  TodoCompletionTrend: ({ maxDateTicks }: { maxDateTicks?: number }) => (
    <div data-testid="trend" data-max-ticks={String(maxDateTicks)} />
  ),
}));
vi.mock("../src/components/Analytics/WorkBreakBalance", () => ({
  WorkBreakBalance: ({ maxDateTicks }: { maxDateTicks?: number }) => (
    <div data-testid="balance" data-max-ticks={String(maxDateTicks)} />
  ),
}));

const LABELS = {
  streak: {
    title: "Work streak",
    current: "Current",
    longest: "Longest",
    formatDays: (n: number) => (n === 1 ? "day" : "days"),
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

function stubMatchMedia(wide: boolean) {
  // @ts-expect-error — a minimal MediaQueryList is all useMediaQuery reads.
  window.matchMedia = () => ({
    matches: wide,
    media: "",
    addEventListener: () => {},
    removeEventListener: () => {},
  });
}

function renderPanel() {
  render(
    <BriefingVizPanel
      sessions={[]}
      todoNodes={[]}
      title="Panel"
      streakLabels={LABELS.streak}
      trendLabels={LABELS.trend}
      balanceLabels={LABELS.balance}
    />,
  );
}

afterEach(() => {
  cleanup();
  // @ts-expect-error — drop the stub so the fallback (wide) path is default.
  delete window.matchMedia;
});

describe("BriefingVizPanel — date ticks on a phone (#2505)", () => {
  it("asks both charts for the narrow tick budget below the wide breakpoint", async () => {
    stubMatchMedia(false);
    renderPanel();
    for (const id of ["trend", "balance"]) {
      const chart = await screen.findByTestId(id);
      expect(chart.dataset.maxTicks).toBe(String(NARROW_MAX_DATE_TICKS));
    }
  });

  it("keeps the wide panel on the Analytics budget", async () => {
    stubMatchMedia(true);
    renderPanel();
    for (const id of ["trend", "balance"]) {
      const chart = await screen.findByTestId(id);
      expect(chart.dataset.maxTicks).toBe(String(MAX_DATE_TICKS));
    }
  });

  it("the narrow budget prints every other day of a week, ending on today", () => {
    const week = [
      "10-27",
      "10-28",
      "10-29",
      "10-30",
      "10-31",
      "11-01",
      "11-02",
    ];
    expect(evenDateTicks(week, NARROW_MAX_DATE_TICKS)).toEqual([
      "10-27",
      "10-29",
      "10-31",
      "11-02",
    ]);
    // The wide budget is unchanged: all seven.
    expect(evenDateTicks(week)).toEqual(week);
  });
});
