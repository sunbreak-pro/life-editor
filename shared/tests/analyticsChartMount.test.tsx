import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render } from "@testing-library/react";
import { WorkBreakBalance } from "../src/components/Analytics/WorkBreakBalance";
import {
  CHARTS,
  ONE_MINUTE,
  WORK_BREAK_LABELS,
} from "./helpers/analyticsChartFixtures";

/*
 * #948 + #944, against the REAL recharts.
 *
 * Every other Analytics chart suite stubs `recharts` away (jsdom has no
 * ResizeObserver) because it is asking about OUR aggregation. This one is the
 * opposite: both bugs live in what we hand the library, so stubbing it would
 * delete the thing under test.
 *
 * #948 — recharts warned "The width(-1) and height(-1) of chart should be
 * greater than 0" on every mount, not just in some unlucky layout: the
 * container's size state starts at the default `initialDimension` of {-1, -1}
 * (recharts/es6/component/responsiveContainerUtils.js:7) and only the
 * ResizeObserver effect corrects it — i.e. after that first render has already
 * logged. A bare mount reproduces it, so a bare mount is what this asserts.
 * Both dimensions had to be non-positive for the warning to fire (it is an OR),
 * which is why a numeric height silences it while width stays responsive.
 */

const DIMENSION_WARNING = /should be greater than 0/;

describe("Analytics charts mount without recharts' -1 dimension warning (#948)", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it.each(CHARTS)("$name logs nothing on first mount", ({ element }) => {
    const { container } = render(element);

    // The chart really mounted — otherwise "no warning" would be vacuous.
    expect(container.querySelector(".recharts-responsive-container")).not.toBe(
      null,
    );
    const warnings = warnSpy.mock.calls
      .map((args) => String(args[0]))
      .filter((msg) => DIMENSION_WARNING.test(msg));
    expect(warnings).toEqual([]);
  });
});

/*
 * jsdom has no layout, so recharts measures 0×0 and draws nothing. Feeding the
 * container element a plausible box makes the chart draw for real, which is
 * what lets the Y ticks below be read.
 *
 * The stub is deliberately narrowed to the container instead of patching
 * Element.prototype wholesale: recharts also measures TEXT through
 * getBoundingClientRect, and a blanket 640px-wide answer makes every tick label
 * look enormous — the Y axis then drops out of the SVG entirely and the
 * assertion silently has nothing to check.
 */
const BOX = { width: 640, height: 192 };
const realGetBoundingClientRect = Element.prototype.getBoundingClientRect;

describe("Work / Break Balance ticks whole minutes (#944)", () => {
  beforeEach(() => {
    globalThis.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    };
    Element.prototype.getBoundingClientRect = function (): DOMRect {
      if (this.classList?.contains("recharts-responsive-container")) {
        return {
          ...BOX,
          top: 0,
          left: 0,
          bottom: BOX.height,
          right: BOX.width,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        } as DOMRect;
      }
      return realGetBoundingClientRect.call(this);
    };
  });

  afterEach(() => {
    Element.prototype.getBoundingClientRect = realGetBoundingClientRect;
    // @ts-expect-error — remove the stub so other suites see jsdom's default.
    delete globalThis.ResizeObserver;
  });

  it("draws no fractional-minute Y tick for a one-minute day", () => {
    const { container } = render(
      <WorkBreakBalance
        sessions={ONE_MINUTE}
        days={7}
        labels={WORK_BREAK_LABELS}
      />,
    );

    /*
     * The Y ticks are the ones carrying the "m" unit — recharts renders the
     * tick labels as siblings of the .recharts-yAxis group rather than inside
     * it, so they are picked out by their text, not by axis ancestry. The X
     * ticks are MM-DD date keys and never match.
     */
    const ticks = Array.from(
      container.querySelectorAll(".recharts-cartesian-axis-tick-value"),
    )
      .map((el) => el.textContent ?? "")
      .filter((t) => t.endsWith("m"));

    // Guard against asserting over an empty list if the axis stops rendering.
    expect(ticks.length).toBeGreaterThan(1);
    // The bars are Math.round()ed minutes, so "0.25m" measures nothing real.
    expect(ticks.filter((t) => t.includes("."))).toEqual([]);
    expect(ticks).toContain("1m");
  });
});
