import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useHolidayVisibilityPref,
  HOLIDAY_HIDDEN_STORAGE_KEY,
} from "../src/hooks/useHolidayDisplay";

/*
 * Holiday visibility as a stored preference (#1802, D-20260919-sched-5 = B).
 *
 * The calendar's other two filters reset on reload on purpose: a restored
 * filter shows a day missing most of itself, and the next event gets booked
 * into a slot that only looks free. Holidays hide rows the user did not create
 * and cannot book over, so that reason does not reach them — which is what
 * makes this one a setting.
 *
 * No React state is asserted here beyond the round trip: what a test can
 * usefully pin is that the key survives a remount (a reload, from the hook's
 * point of view) and that a hand-edited or missing value still leaves the
 * holidays visible.
 */

beforeEach(() => {
  localStorage.clear();
});

describe("useHolidayVisibilityPref", () => {
  it("starts with holidays shown when nothing is stored", () => {
    const { result } = renderHook(() => useHolidayVisibilityPref());
    expect(result.current.holidaysHidden).toBe(false);
  });

  it("survives a remount — the point of the whole issue", () => {
    const first = renderHook(() => useHolidayVisibilityPref());
    act(() => first.result.current.setHolidaysHidden(true));
    expect(localStorage.getItem(HOLIDAY_HIDDEN_STORAGE_KEY)).toBe("true");
    first.unmount();

    // A fresh mount is what a reload looks like from here.
    const second = renderHook(() => useHolidayVisibilityPref());
    expect(second.result.current.holidaysHidden).toBe(true);
  });

  it("takes an updater, so a toggle does not read-then-write", () => {
    const { result } = renderHook(() => useHolidayVisibilityPref());
    act(() => result.current.setHolidaysHidden((prev) => !prev));
    expect(result.current.holidaysHidden).toBe(true);
    act(() => result.current.setHolidaysHidden((prev) => !prev));
    expect(result.current.holidaysHidden).toBe(false);
  });

  it("shows holidays again for a value it cannot read", () => {
    // Hand-edited, or written by a build that stored something else. Hiding
    // days the user cannot explain is the worse of the two failures: the
    // toolbar button is right there to hide them on purpose.
    for (const raw of ["", "yes", "1", "{}", "TRUE"]) {
      localStorage.setItem(HOLIDAY_HIDDEN_STORAGE_KEY, raw);
      const { result, unmount } = renderHook(() => useHolidayVisibilityPref());
      expect(result.current.holidaysHidden).toBe(false);
      unmount();
    }
  });
});
