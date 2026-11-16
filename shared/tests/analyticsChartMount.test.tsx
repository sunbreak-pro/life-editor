import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render } from "@testing-library/react";
import { CHARTS } from "./helpers/analyticsChartFixtures";

/*
 * #948, against the REAL recharts.
 *
 * Every other Analytics chart suite stubs `recharts` away (jsdom has no
 * ResizeObserver) because it is asking about OUR aggregation. This one is the
 * opposite: the bug lives in what we hand the library, so stubbing it would
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
      .map((args: unknown[]) => String(args[0]))
      .filter((msg: string) => DIMENSION_WARNING.test(msg));
    expect(warnings).toEqual([]);
  });
});
