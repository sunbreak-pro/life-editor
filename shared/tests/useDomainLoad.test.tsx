import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useDomainLoad } from "../src/hooks/useDomainLoad";
import { stubDataService } from "./helpers/dataServiceStub";
import type { DataService } from "../src/services/DataService";

/*
 * #672 — the shared primitive itself.
 *
 * `useDomainLoad` is exercised three times over through its callers
 * (calendarsLoadEffect / routinesLoadEffect / scheduleItemsLoadEffect), but
 * those suites can only reach what a domain hook chooses to expose. Three
 * parts of the contract are invisible from up there, and all three are the
 * kind that fail silently:
 *
 * - the superseded-response guard. A domain suite drives one load at a time;
 *   the guard only matters when two are in flight and the OLDER one lands
 *   last. Without it a stale list quietly overwrites a fresh one.
 * - the `dataService` identity in the dep array. Nothing above swaps the
 *   service, so nothing above notices if the refetch-on-backend-swap goes.
 * - the ref mirror for `load` / `apply`. Every caller writes those inline, so
 *   they are new objects on every render. They are deliberately NOT in the dep
 *   array; putting them back gives an effect that refetches forever, and no
 *   domain suite would fail — they would just spin.
 */

/** A promise whose settlement the test drives, so two loads can overlap. */
function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve: (value: T) => resolve(value) };
}

interface Props {
  dataService: DataService;
  version: number;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useDomainLoad (#672)", () => {
  it("drops a superseded read that lands after the newer one", async () => {
    const first = deferred<string[]>();
    const second = deferred<string[]>();
    const rounds = [first, second];
    const load = vi.fn(() => {
      const next = rounds.shift();
      if (!next) throw new Error("the effect fired a third, unexpected read");
      return next.promise;
    });
    const apply = vi.fn();
    const ds = stubDataService();

    const hook = renderHook(
      ({ version }: Props) =>
        useDomainLoad({
          domain: "test",
          dataService: ds,
          version,
          load,
          apply,
          fallbackMessage: "failed",
        }),
      { initialProps: { dataService: ds, version: 0 } },
    );
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));

    // A Realtime bump arrives while the first read is still out.
    hook.rerender({ dataService: ds, version: 1 });
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));

    // The newer read wins the race and is applied.
    await act(async () => second.resolve(["fresh"]));
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith(["fresh"]);
    expect(hook.result.current.isLoading).toBe(false);

    // The superseded one lands last and must be thrown away — applying it
    // would put the pre-bump list back on screen with no way to refresh it.
    await act(async () => first.resolve(["stale"]));
    expect(apply).toHaveBeenCalledTimes(1);
    expect(hook.result.current.isLoading).toBe(false);
  });

  it("restarts the load when the DataService instance is swapped", async () => {
    const dsA = stubDataService();
    const dsB = stubDataService();
    const load = vi.fn((service: DataService) =>
      Promise.resolve(service === dsA ? ["from-a"] : ["from-b"]),
    );
    const apply = vi.fn();

    const hook = renderHook(
      ({ dataService, version }: Props) =>
        useDomainLoad({
          domain: "test",
          dataService,
          version,
          load,
          apply,
          fallbackMessage: "failed",
        }),
      { initialProps: { dataService: dsA, version: 0 } },
    );
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    expect(apply).toHaveBeenCalledWith(["from-a"]);

    // The app swaps the service when the backend changes; the rows on screen
    // came from the old one and are not valid for the new one.
    await act(async () => {
      hook.rerender({ dataService: dsB, version: 0 });
    });
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    expect(load).toHaveBeenLastCalledWith(dsB);
    await waitFor(() => expect(apply).toHaveBeenCalledWith(["from-b"]));
  });

  it("does not refetch when only the callback identities change", async () => {
    const ds = stubDataService();
    let calls = 0;
    const applied: number[] = [];

    // `load` and `apply` are written inline here exactly as every caller
    // writes them: brand-new functions on every single render.
    const hook = renderHook(
      ({ tick }: { tick: number }) =>
        useDomainLoad({
          domain: "test",
          dataService: ds,
          version: 0,
          load: () => {
            calls += 1;
            return Promise.resolve(tick);
          },
          apply: (value: number) => applied.push(value),
          fallbackMessage: "failed",
        }),
      { initialProps: { tick: 0 } },
    );
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    expect(calls).toBe(1);

    await act(async () => {
      hook.rerender({ tick: 1 });
    });
    await act(async () => {
      hook.rerender({ tick: 2 });
    });

    // Nothing the load is keyed on moved, so the read must not fire again.
    expect(calls).toBe(1);
    expect(applied).toEqual([0]);
  });

  it("un-latches an error written through the imperative setter", async () => {
    const ds = stubDataService();
    const load = vi.fn(() => Promise.resolve(["row"]));

    const hook = renderHook(
      ({ version }: Props) =>
        useDomainLoad({
          domain: "test",
          dataService: ds,
          version,
          load,
          apply: () => {},
          fallbackMessage: "failed",
        }),
      { initialProps: { dataService: ds, version: 0 } },
    );
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));

    // The Schedule host owns an imperative reload (`loadDate`) that reports
    // its own failures through this setter. The shared effect must clear them
    // on its next success, or the error card outlives the problem (#296).
    act(() => hook.result.current.setError("offline"));
    expect(hook.result.current.error).toBe("offline");

    act(() => {
      hook.rerender({ dataService: ds, version: 1 });
    });
    await waitFor(() => expect(hook.result.current.error).toBeNull());
  });
});
