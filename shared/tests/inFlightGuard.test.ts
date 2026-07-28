import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useInFlightGuard } from "../src/hooks/useInFlightGuard";

/*
 * useInFlightGuard (#434) — the shared half of the #407 double-conversion
 * guard. It used to be a bare ref inside web/src/schedule/useScheduleMutations,
 * where no test could reach it (web ships no test runner). What matters here
 * is the property that made #407 possible in the first place: a second claim
 * arriving before the first released must be refused, and refused
 * SYNCHRONOUSLY — both clicks can land in one tick, so a guard that waited
 * for a re-render would wave the second one through.
 */

describe("useInFlightGuard", () => {
  it("refuses a second claim on the same id until it is released", () => {
    const { result } = renderHook(() => useInFlightGuard());

    let first = false;
    let second = false;
    act(() => {
      // Both inside ONE act: this is the double-click case — two claims in
      // the same tick, before any re-render could publish the first.
      first = result.current.begin("seed-1");
      second = result.current.begin("seed-1");
    });
    expect(first).toBe(true);
    expect(second).toBe(false);

    act(() => result.current.end("seed-1"));
    let third = false;
    act(() => {
      third = result.current.begin("seed-1");
    });
    expect(third).toBe(true);
  });

  it("tracks ids independently", () => {
    const { result } = renderHook(() => useInFlightGuard());
    let a = false;
    let b = false;
    act(() => {
      a = result.current.begin("seed-1");
      b = result.current.begin("seed-2");
    });
    expect(a).toBe(true);
    expect(b).toBe(true);
    expect([...result.current.inFlightIds].sort()).toEqual([
      "seed-1",
      "seed-2",
    ]);

    act(() => result.current.end("seed-1"));
    expect(result.current.inFlightIds).toEqual(["seed-2"]);
    expect(result.current.isInFlight("seed-1")).toBe(false);
    expect(result.current.isInFlight("seed-2")).toBe(true);
  });

  it("publishes the claim for rendering", () => {
    const { result } = renderHook(() => useInFlightGuard());
    expect(result.current.inFlightIds).toEqual([]);
    act(() => {
      result.current.begin("seed-1");
    });
    expect(result.current.inFlightIds).toEqual(["seed-1"]);
    act(() => result.current.end("seed-1"));
    expect(result.current.inFlightIds).toEqual([]);
  });

  it("ignores an end for an id that was never claimed", () => {
    const { result } = renderHook(() => useInFlightGuard());
    act(() => result.current.end("never-claimed"));
    expect(result.current.inFlightIds).toEqual([]);
    let claimed = false;
    act(() => {
      claimed = result.current.begin("never-claimed");
    });
    expect(claimed).toBe(true);
  });

  it("sees a claim synchronously, before any re-render", () => {
    const { result } = renderHook(() => useInFlightGuard());
    act(() => {
      result.current.begin("seed-1");
      // The ref-backed read is the one write paths must branch on; the
      // rendered mirror has not been published at this point.
      expect(result.current.isInFlight("seed-1")).toBe(true);
    });
  });
});
