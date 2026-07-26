import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useDeferredAction } from "../src/hooks/useDeferredAction";

/*
 * useDeferredAction (#355) — the click-vs-double-click arbiter behind the
 * Schedule bubble popover.
 *
 * The browser reveals a double-click only AFTER firing `click` on its first
 * press, so anything the single-click path does immediately is visible for a
 * moment on every double-click. These cases pin the three properties the
 * popover depends on: the action does not run early, a follow-up gesture can
 * still cancel it, and it can never fire after the host unmounted.
 */

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useDeferredAction", () => {
  it("holds the action back and then runs it", () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useDeferredAction(200));

    act(() => result.current.defer(fn));
    expect(fn).not.toHaveBeenCalled();

    // Still waiting one tick short of the delay.
    act(() => void vi.advanceTimersByTime(199));
    expect(fn).not.toHaveBeenCalled();

    act(() => void vi.advanceTimersByTime(1));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("cancel before the delay drops the action entirely (the double-click case)", () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useDeferredAction(200));

    act(() => result.current.defer(fn));
    act(() => result.current.cancel());
    act(() => void vi.advanceTimersByTime(1000));

    expect(fn).not.toHaveBeenCalled();
  });

  it("cancel after it already ran is a no-op, not a throw", () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useDeferredAction(200));

    act(() => result.current.defer(fn));
    act(() => void vi.advanceTimersByTime(200));
    expect(fn).toHaveBeenCalledTimes(1);

    act(() => result.current.cancel());
    act(() => void vi.advanceTimersByTime(1000));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("the last gesture wins: a second defer supersedes the pending one", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result } = renderHook(() => useDeferredAction(200));

    act(() => result.current.defer(first));
    act(() => void vi.advanceTimersByTime(150));
    act(() => result.current.defer(second));
    act(() => void vi.advanceTimersByTime(200));

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("never fires after unmount (no popover on a screen that left)", () => {
    const fn = vi.fn();
    const { result, unmount } = renderHook(() => useDeferredAction(200));

    act(() => result.current.defer(fn));
    unmount();
    act(() => void vi.advanceTimersByTime(1000));

    expect(fn).not.toHaveBeenCalled();
  });

  it("keeps a stable identity so consumers' useCallback deps do not churn", () => {
    const { result, rerender } = renderHook(() => useDeferredAction(200));
    const first = result.current;
    rerender();
    rerender();
    expect(result.current).toBe(first);
    expect(result.current.defer).toBe(first.defer);
    expect(result.current.cancel).toBe(first.cancel);
  });
});
