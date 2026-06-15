import { describe, it, expect, vi, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useMediaQuery } from "../src/hooks/useMediaQuery";

/*
 * W5 app shell — matchMedia wrapper. jsdom does NOT define
 * window.matchMedia, so the default-undefined case exercises the fallback
 * path; a mock covers the live match + change-event path.
 */

type Listener = () => void;

function mockMatchMedia(initial: boolean) {
  const listeners = new Set<Listener>();
  const mql = {
    matches: initial,
    media: "",
    addEventListener: (_type: string, cb: Listener) => listeners.add(cb),
    removeEventListener: (_type: string, cb: Listener) => listeners.delete(cb),
  };
  // @ts-expect-error — assigning a minimal MediaQueryList stub for tests.
  window.matchMedia = vi.fn().mockReturnValue(mql);
  return {
    setMatches(next: boolean) {
      mql.matches = next;
      listeners.forEach((cb) => cb());
    },
  };
}

afterEach(() => {
  // jsdom has no matchMedia by default — restore that so the fallback
  // assertions stay valid across tests.
  // @ts-expect-error — deleting the test stub.
  delete window.matchMedia;
});

describe("useMediaQuery", () => {
  it("falls back to the given default when matchMedia is unavailable", () => {
    expect(window.matchMedia).toBeUndefined();
    const wide = renderHook(() => useMediaQuery("(min-width: 768px)", true));
    expect(wide.result.current).toBe(true);
    const narrow = renderHook(() => useMediaQuery("(min-width: 768px)", false));
    expect(narrow.result.current).toBe(false);
  });

  it("defaults the fallback to wide (true)", () => {
    const { result } = renderHook(() => useMediaQuery("(min-width: 768px)"));
    expect(result.current).toBe(true);
  });

  it("reflects the live match and responds to change events", () => {
    const mm = mockMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery("(min-width: 768px)"));
    expect(result.current).toBe(false);
    act(() => mm.setMatches(true));
    expect(result.current).toBe(true);
    act(() => mm.setMatches(false));
    expect(result.current).toBe(false);
  });
});
