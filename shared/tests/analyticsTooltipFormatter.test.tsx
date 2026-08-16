import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { CHARTS } from "./helpers/analyticsChartFixtures";

/*
 * #943 — the Work / Break Balance tooltip showed three bare numbers with no
 * series names.
 *
 * recharts' contract (DefaultTooltipContent.js:75-82): a `formatter` that
 * returns an ARRAY is destructured as [value, name], so a one-element array
 * sets name to undefined and the name <span> is dropped. Returning a plain
 * string is fine — the original series name is then kept. So the invariant is
 * not "always return two elements", it is "if you return an array, return both
 * halves", and that is what this pins for every Analytics chart at once.
 *
 * recharts is stubbed here (the way the other Analytics suites do it) because
 * the subject is the formatter WE pass, not the library's rendering: the
 * tooltip DOM only exists after a real pointer lands on a real chart surface,
 * which jsdom — no layout, no hit-testing — cannot produce.
 */

interface CapturedTooltip {
  formatter?: (
    value: unknown,
    name?: unknown,
    props?: unknown,
  ) => unknown | unknown[];
}

const captured: CapturedTooltip[] = [];

vi.mock("recharts", () => {
  const Passthrough = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    ResponsiveContainer: Passthrough,
    BarChart: Passthrough,
    AreaChart: Passthrough,
    PieChart: Passthrough,
    Bar: Passthrough,
    Pie: Passthrough,
    Area: () => null,
    Cell: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Legend: () => null,
    ReferenceLine: () => null,
    Tooltip: (props: CapturedTooltip) => {
      captured.push(props);
      return null;
    },
  };
});

/** A stand-in payload for the one chart that reads props.payload. */
const ENTRY = { payload: { fullName: "Write the thing", sessions: 2 } };

describe("Analytics tooltip formatters keep the series name (#943)", () => {
  beforeEach(() => {
    captured.length = 0;
  });

  it.each(CHARTS)("$name", ({ element }) => {
    render(element);

    expect(captured).toHaveLength(1);
    const { formatter } = captured[0];
    expect(formatter).toBeTypeOf("function");

    const formatted = formatter?.(1, "Work", ENTRY);
    if (Array.isArray(formatted)) {
      // [value, name] — a one-element array is the #943 bug.
      expect(formatted).toHaveLength(2);
      expect(["string", "number"]).toContain(typeof formatted[1]);
      expect(String(formatted[1])).not.toBe("");
    } else {
      // Value-only return: recharts keeps the series name it already had.
      expect(formatted).not.toBeNull();
    }
  });

  it("Work / Break Balance passes the stacked series name straight through", () => {
    const workBreak = CHARTS.find((c) => c.name === "WorkBreakBalance");
    render(workBreak!.element);

    // The stack is three series deep, so this is the chart where a dropped
    // name cost the most: every row read as a bare "0m".
    expect(captured[0].formatter?.(12, "Long Break", ENTRY)).toEqual([
      "12m",
      "Long Break",
    ]);
  });
});
