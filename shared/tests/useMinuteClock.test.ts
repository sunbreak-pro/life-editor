import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMinuteClock } from "../src/hooks/useMinuteClock";

/*
 * useMinuteClock (#889) — the calendar's clock, in the two shapes it is read
 * in.
 *
 * Schedule kept these as two `useState`s ticked side by side in one interval,
 * each reading the wall clock for itself. What these cases pin is the reason
 * that was worth changing: the two shapes now come from ONE read, so they
 * cannot disagree across a minute boundary, and the interval is cleaned up.
 */

afterEach(() => {
  vi.useRealTimers();
});

/** Freeze the clock at a local wall time, then run the hook against it. */
function atLocalTime(hours: number, minutes: number) {
  vi.useFakeTimers();
  const start = new Date(2026, 7, 20, hours, minutes, 0);
  vi.setSystemTime(start);
  return renderHook(() => useMinuteClock());
}

describe("useMinuteClock", () => {
  it("reports minutes-from-midnight for the Date it is holding", () => {
    const { result } = atLocalTime(9, 30);
    expect(result.current.nowMinutes).toBe(9 * 60 + 30);
    expect(result.current.now.getHours()).toBe(9);
  });

  it("keeps the two shapes in step across a minute boundary", () => {
    // The whole point of one read: the now-line and the status that decides a
    // row must not be drawn a minute apart.
    const { result } = atLocalTime(9, 59);
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    const { now, nowMinutes } = result.current;
    expect(nowMinutes).toBe(now.getHours() * 60 + now.getMinutes());
    expect(nowMinutes).toBe(10 * 60);
  });

  it("advances once a minute, not on every render", () => {
    const { result } = atLocalTime(0, 0);
    act(() => {
      vi.advanceTimersByTime(59_000);
    });
    expect(result.current.nowMinutes).toBe(0);
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current.nowMinutes).toBe(1);
  });

  it("stops ticking once unmounted, so it cannot leak across sections", () => {
    const { unmount } = atLocalTime(9, 0);
    const clear = vi.spyOn(globalThis, "clearInterval");
    unmount();
    expect(clear).toHaveBeenCalled();
    clear.mockRestore();
  });

  it("reads midnight as zero rather than a full day", () => {
    const { result } = atLocalTime(0, 0);
    expect(result.current.nowMinutes).toBe(0);
  });
});
