import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import {
  evenDateTicks,
  MAX_DATE_TICKS,
  NARROW_MAX_DATE_TICKS,
} from "../src/components/briefing/chartTheme";
// vi.mock below is hoisted above this import, so the panel's lazy() chart
// resolves to the stub.
import { BriefingVizPanel } from "../src/components/briefing/BriefingVizPanel";

/*
 * #2505 — on a phone the morning paper's charts sit in the MobileDrawer
 * (~316px on a 390px screen), and the seven date labels of the 7-day axis
 * touched: "10-2710-2810-29…". Below the wide breakpoint the panel asks the
 * chart for fewer ticks; on the wide panel nothing changes.
 *
 * jsdom has no layout, so recharts' ResponsiveContainer draws no axis here.
 * The chart is stubbed to print the tick budget it was handed, and the
 * budget itself is checked against `evenDateTicks` — the function the chart
 * feeds it to.
 */

vi.mock("../src/components/briefing/TodoCompletionTrend", () => ({
  TodoCompletionTrend: ({ maxDateTicks }: { maxDateTicks?: number }) => (
    <div data-testid="trend" data-max-ticks={String(maxDateTicks)} />
  ),
}));
const TREND_LABELS = { title: "Completions", completedCount: "Completed" };

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
    <BriefingVizPanel todoNodes={[]} title="Panel" trendLabels={TREND_LABELS} />,
  );
}

afterEach(() => {
  cleanup();
  // @ts-expect-error — drop the stub so the fallback (wide) path is default.
  delete window.matchMedia;
});

describe("BriefingVizPanel — date ticks on a phone (#2505)", () => {
  it("asks the chart for the narrow tick budget below the wide breakpoint", async () => {
    stubMatchMedia(false);
    renderPanel();
    const chart = await screen.findByTestId("trend");
    expect(chart.dataset.maxTicks).toBe(String(NARROW_MAX_DATE_TICKS));
  });

  it("keeps the wide panel on the full seven-tick budget", async () => {
    stubMatchMedia(true);
    renderPanel();
    const chart = await screen.findByTestId("trend");
    expect(chart.dataset.maxTicks).toBe(String(MAX_DATE_TICKS));
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
