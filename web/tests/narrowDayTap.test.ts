import { describe, it, expect, vi } from "vitest";
import { selectNarrowDay } from "../src/schedule/narrowDayTap";

/*
 * #1148 — narrow's headline gesture: tap a day in the month grid, read that
 * day in the drawer.
 *
 * The three lines it takes live in their own module precisely so these
 * assertions can exist: their host (CalendarTab) needs the full Provider chain
 * plus real layout to mount, so nothing renders it here
 * (rules/frontend.md §テスト環境の制約, D-20260812-refactor-2).
 */

function deps(over: { openSidebar?: (() => void) | undefined } = {}) {
  return {
    pickDay: vi.fn(),
    setSidebarTab: vi.fn(),
    openSidebar: vi.fn(),
    ...over,
  };
}

describe("selectNarrowDay (#1148)", () => {
  it("moves the anchor and opens the drawer on that day", () => {
    const d = deps();
    selectNarrowDay(d, "2026-08-20");

    expect(d.pickDay).toHaveBeenCalledWith("2026-08-20");
    expect(d.openSidebar).toHaveBeenCalledTimes(1);
  });

  it("forces the flow tab, whatever the drawer was last showing", () => {
    // The drawer remembers its tab. Without this, a tap made while 繰り返し
    // was selected opens a routine list — which reads as the tap doing
    // nothing at all.
    const d = deps();
    selectNarrowDay(d, "2026-08-20");

    expect(d.setSidebarTab).toHaveBeenCalledWith("flow");
  });

  it("still moves the anchor with no drawer to open", () => {
    // A section body rendered without the shell's Provider has no sidebar —
    // the same reason the host reads useRightSidebarOptional. Picking the day
    // must not depend on there being one.
    const d = deps({ openSidebar: undefined });

    expect(() => selectNarrowDay(d, "2026-08-20")).not.toThrow();
    expect(d.pickDay).toHaveBeenCalledWith("2026-08-20");
    expect(d.setSidebarTab).toHaveBeenCalledWith("flow");
  });
});
