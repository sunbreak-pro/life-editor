import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIsTouchDevice } from "./useIsTouchDevice";

type MediaQueryListener = (event: MediaQueryListEvent) => void;

interface MockMediaQueryList {
  matches: boolean;
  media: string;
  addEventListener: (type: "change", listener: MediaQueryListener) => void;
  removeEventListener: (type: "change", listener: MediaQueryListener) => void;
  fire: (matches: boolean) => void;
}

function createMockMatchMedia(initialMatches: boolean): {
  matchMedia: (query: string) => MockMediaQueryList;
  mql: MockMediaQueryList;
} {
  let matches = initialMatches;
  const listeners = new Set<MediaQueryListener>();

  const mql: MockMediaQueryList = {
    get matches() {
      return matches;
    },
    media: "(hover: none) and (pointer: coarse)",
    addEventListener: (_type, listener) => {
      listeners.add(listener);
    },
    removeEventListener: (_type, listener) => {
      listeners.delete(listener);
    },
    fire: (next: boolean) => {
      matches = next;
      const event = { matches: next, media: mql.media } as MediaQueryListEvent;
      listeners.forEach((l) => l(event));
    },
  };

  return { matchMedia: () => mql, mql };
}

describe("useIsTouchDevice", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("returns true when the touch media query matches initially", () => {
    const { matchMedia } = createMockMatchMedia(true);
    window.matchMedia = matchMedia as typeof window.matchMedia;

    const { result } = renderHook(() => useIsTouchDevice());
    expect(result.current).toBe(true);
  });

  it("returns false when the touch media query does not match initially", () => {
    const { matchMedia } = createMockMatchMedia(false);
    window.matchMedia = matchMedia as typeof window.matchMedia;

    const { result } = renderHook(() => useIsTouchDevice());
    expect(result.current).toBe(false);
  });

  it("updates when the matchMedia result changes", () => {
    const { matchMedia, mql } = createMockMatchMedia(false);
    window.matchMedia = matchMedia as typeof window.matchMedia;

    const { result } = renderHook(() => useIsTouchDevice());
    expect(result.current).toBe(false);

    act(() => {
      mql.fire(true);
    });
    expect(result.current).toBe(true);

    act(() => {
      mql.fire(false);
    });
    expect(result.current).toBe(false);
  });

  it("removes its listener on unmount", () => {
    const { matchMedia, mql } = createMockMatchMedia(false);
    const addSpy = vi.spyOn(mql, "addEventListener");
    const removeSpy = vi.spyOn(mql, "removeEventListener");
    window.matchMedia = matchMedia as typeof window.matchMedia;

    const { unmount } = renderHook(() => useIsTouchDevice());
    expect(addSpy).toHaveBeenCalledTimes(1);

    unmount();
    expect(removeSpy).toHaveBeenCalledTimes(1);
  });
});
