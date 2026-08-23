import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useDomainLoad } from "../src/hooks/useDomainLoad";
import { clearDomainSnapshots } from "../src/state/domainSnapshotStore";
import { stubDataService } from "./helpers/dataServiceStub";
import type { DataService } from "../src/services/DataService";

/*
 * #1101 — stale-while-revalidate on the shared load effect.
 *
 * The thing being fixed is invisible to a single mount, which is why it
 * survived #672's suite: switching sections UNMOUNTS the domain provider
 * (`web/src/MainScreen.tsx` swaps `descriptor.body(...)`), so coming back
 * starts from `settled === null` and shows a skeleton until the round trip
 * lands. Every test below therefore mounts, unmounts, and mounts AGAIN — the
 * second mount is the whole subject.
 *
 * `renderHook` gives no browser paint to check, so "no skeleton" is asserted
 * as its two observable halves at the moment the second mount returns, before
 * its read resolves: `isLoading` is false and `apply` has already run with the
 * previous result.
 */

/** A promise whose settlement the test drives, so a mount can be inspected mid-read. */
function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (reason: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {
    promise,
    resolve: (value: T) => resolve(value),
    reject: (reason: unknown) => reject(reason),
  };
}

interface MountOptions {
  dataService: DataService;
  load: () => Promise<string[]>;
  apply: (data: string[]) => void;
  anchor?: string;
  /** Omit to assert the un-opted-in behaviour is unchanged. */
  withKey?: boolean;
}

function mount(options: MountOptions) {
  const { dataService, load, apply, anchor, withKey = true } = options;
  return renderHook(() =>
    useDomainLoad({
      domain: "test",
      dataService,
      version: 0,
      anchor,
      load,
      apply,
      fallbackMessage: "failed",
      ...(withKey ? { snapshotKey: "notes" as const } : {}),
    }),
  );
}

beforeEach(() => {
  // Module-level store: without this a suite inherits the previous test's
  // snapshot and the failures land in the wrong test.
  clearDomainSnapshots();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useDomainLoad stale-while-revalidate (#1101)", () => {
  it("draws the previous result on remount instead of waiting for the read", async () => {
    const ds = stubDataService();
    const first = mount({
      dataService: ds,
      load: () => Promise.resolve(["kept"]),
      apply: vi.fn(),
    });
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    first.unmount();

    // The section is re-entered. Its read is still out — this is the frame
    // that used to be a skeleton.
    const second = deferred<string[]>();
    const apply = vi.fn();
    const back = mount({
      dataService: ds,
      load: () => second.promise,
      apply,
    });

    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith(["kept"]);
    expect(back.result.current.isLoading).toBe(false);

    await act(async () => second.resolve(["kept"]));
  });

  it("replaces the stale result once the revalidate lands", async () => {
    const ds = stubDataService();
    const first = mount({
      dataService: ds,
      load: () => Promise.resolve(["old"]),
      apply: vi.fn(),
    });
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    first.unmount();

    const second = deferred<string[]>();
    const apply = vi.fn();
    mount({ dataService: ds, load: () => second.promise, apply });
    expect(apply).toHaveBeenCalledWith(["old"]);

    // The point of the "revalidate" half: a snapshot that is never overwritten
    // is just a cache that goes wrong quietly.
    await act(async () => second.resolve(["new"]));
    expect(apply).toHaveBeenCalledTimes(2);
    expect(apply).toHaveBeenLastCalledWith(["new"]);

    // And the NEXT mount starts from the fresh one, not the one it replaced.
    const third = deferred<string[]>();
    const laterApply = vi.fn();
    mount({ dataService: ds, load: () => third.promise, apply: laterApply });
    expect(laterApply).toHaveBeenCalledWith(["new"]);
    await act(async () => third.resolve(["new"]));
  });

  it("keeps showing the snapshot when the revalidate fails, and does not store the failure", async () => {
    const ds = stubDataService();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const first = mount({
      dataService: ds,
      load: () => Promise.resolve(["kept"]),
      apply: vi.fn(),
    });
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    first.unmount();

    const failing = deferred<string[]>();
    const apply = vi.fn();
    const back = mount({ dataService: ds, load: () => failing.promise, apply });
    expect(apply).toHaveBeenCalledWith(["kept"]);

    await act(async () => {
      failing.reject(new Error("offline"));
      await failing.promise.catch(() => {});
    });
    await waitFor(() => expect(back.result.current.error).toBe("offline"));
    // The list on screen is untouched — a failed read has nothing better.
    expect(apply).toHaveBeenCalledTimes(1);
    back.unmount();

    // A failure must not overwrite the stored list either, or one flaky read
    // would cost every later mount its head start.
    const apply3 = vi.fn();
    mount({
      dataService: ds,
      load: () => Promise.resolve(["kept"]),
      apply: apply3,
    });
    expect(apply3).toHaveBeenCalledWith(["kept"]);
  });

  it("does not serve a snapshot across a DataService swap", async () => {
    const dsA = stubDataService();
    const dsB = stubDataService();
    const first = mount({
      dataService: dsA,
      load: () => Promise.resolve(["from-a"]),
      apply: vi.fn(),
    });
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    first.unmount();

    // Rows read through the old backend are not valid for the new one, so this
    // mount has to wait like the first one did.
    const pending = deferred<string[]>();
    const apply = vi.fn();
    const back = mount({
      dataService: dsB,
      load: () => pending.promise,
      apply,
    });
    expect(apply).not.toHaveBeenCalled();
    expect(back.result.current.isLoading).toBe(true);

    await act(async () => pending.resolve(["from-b"]));
  });

  it("does not serve a snapshot taken under a different anchor", async () => {
    const ds = stubDataService();
    const first = mount({
      dataService: ds,
      anchor: "2026-08-19",
      load: () => Promise.resolve(["that-day"]),
      apply: vi.fn(),
    });
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    first.unmount();

    // Schedule's anchor is the day on screen. Yesterday's items are not a
    // stale view of today's — they are the wrong answer.
    const pending = deferred<string[]>();
    const apply = vi.fn();
    const back = mount({
      dataService: ds,
      anchor: "2026-08-20",
      load: () => pending.promise,
      apply,
    });
    expect(apply).not.toHaveBeenCalled();
    expect(back.result.current.isLoading).toBe(true);

    await act(async () => pending.resolve(["next-day"]));
  });

  it("leaves callers without a snapshotKey exactly as they were", async () => {
    const ds = stubDataService();
    const first = mount({
      dataService: ds,
      load: () => Promise.resolve(["row"]),
      apply: vi.fn(),
      withKey: false,
    });
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    first.unmount();

    // Opt-in, not opt-out: a hook that never asked for a cache must not get
    // one (its `apply` may not be safe to replay, and nobody checked).
    const pending = deferred<string[]>();
    const apply = vi.fn();
    const back = mount({
      dataService: ds,
      load: () => pending.promise,
      apply,
      withKey: false,
    });
    expect(apply).not.toHaveBeenCalled();
    expect(back.result.current.isLoading).toBe(true);

    await act(async () => pending.resolve(["row"]));
  });

  it("keeps the cache in memory only", async () => {
    const ds = stubDataService();
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    const hook = mount({
      dataService: ds,
      load: () => Promise.resolve(["row"]),
      apply: vi.fn(),
    });
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    hook.unmount();

    // D-20260818-refactor-1: memory only. A persisted snapshot outlives the
    // schema that produced it and there is no migration story for that.
    expect(setItem).not.toHaveBeenCalled();

    // ...and `clearDomainSnapshots` really is the only thing holding it, so a
    // fresh process starts cold.
    clearDomainSnapshots();
    const pending = deferred<string[]>();
    const apply = vi.fn();
    const back = mount({ dataService: ds, load: () => pending.promise, apply });
    expect(apply).not.toHaveBeenCalled();
    expect(back.result.current.isLoading).toBe(true);

    await act(async () => pending.resolve(["row"]));
  });

  it("stores the winner of a race, not the superseded read", async () => {
    const ds = stubDataService();
    const slow = deferred<string[]>();
    const fast = deferred<string[]>();
    const rounds = [slow, fast];
    const apply = vi.fn();

    const hook = renderHook(
      ({ version }: { version: number }) =>
        useDomainLoad({
          domain: "test",
          dataService: ds,
          version,
          load: () => {
            const next = rounds.shift();
            if (!next) throw new Error("unexpected third read");
            return next.promise;
          },
          apply,
          fallbackMessage: "failed",
          snapshotKey: "notes",
        }),
      { initialProps: { version: 0 } },
    );

    // A Realtime bump lands while the first read is still out; the second one
    // answers first, and then the first one finally arrives.
    hook.rerender({ version: 1 });
    await act(async () => fast.resolve(["fresh"]));
    await act(async () => slow.resolve(["stale"]));
    expect(apply).toHaveBeenCalledTimes(1);
    hook.unmount();

    // The superseded response is dropped on screen already; storing it would
    // put it back at the next mount, which is worse — it would look current.
    const laterApply = vi.fn();
    const pending = deferred<string[]>();
    mount({ dataService: ds, load: () => pending.promise, apply: laterApply });
    expect(laterApply).toHaveBeenCalledWith(["fresh"]);

    await act(async () => pending.resolve(["fresh"]));
  });
});
