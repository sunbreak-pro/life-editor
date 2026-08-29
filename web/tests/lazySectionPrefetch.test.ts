import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

/*
 * The idle warm-up (#1158). lazySectionChunks.test.ts guards the SOURCE (which
 * module is listed where); this file guards the BEHAVIOUR: when it fires, in
 * what order, that it fires once, that the loads stay one-at-a-time, and that
 * one bad chunk does not take the other down.
 *
 * Both screens are mocked. Importing them for real drags TipTap + ProseMirror
 * and recharts into a jsdom worker for no benefit — what is under test is the
 * scheduler, not the screens.
 *
 * The failure case fails the FIRST loader on purpose: with two of them, only a
 * failure ahead of a survivor proves the loop carries on past one.
 *
 * jsdom has no `requestIdleCallback`, so the setTimeout branch is the DEFAULT
 * here and gets exercised for free; the rIC branch is driven by installing a
 * stub. `document.readyState` is "complete" from the start in jsdom, so the
 * schedule call is synchronous and the `load`-event branch is not reachable
 * without stubbing a getter — it is covered by the comment in the source, not
 * by a fragile test.
 *
 * `vi.resetModules()` per test because the memoised promise is module state.
 */

const h = vi.hoisted(() => ({
  loaded: [] as string[],
  failing: "",
  /** Name whose load hangs until `release()` — see the sequential test. */
  blocking: "",
  release: () => {},
}));

/*
 * The recorder is a GETTER, not the factory body. `vi.resetModules()` clears
 * the module registry but memoises mock factories, so a factory that pushed
 * would record only on the first test in the file and every later one would
 * see an empty list. The loaders read `m.<Name>` on every load, so a getter
 * records every load — and gives the failure case somewhere to throw from that
 * looks like a chunk that did not arrive.
 *
 * A blocked chunk returns a THENABLE. `.then((m) => m.<Name>)` adopts whatever
 * its callback returns, so the loader's own promise stays pending until the
 * test releases it — which is the only way from here to see whether the next
 * load started while this one was still in flight.
 */
function chunk<T extends string>(name: T) {
  return {
    get [name](): (() => null) | Promise<() => null> {
      if (h.failing === name) throw new Error("chunk 404");
      h.loaded.push(name);
      if (h.blocking !== name) return () => null;
      return new Promise<() => null>((resolve) => {
        h.release = () => resolve(() => null);
      });
    },
  };
}

vi.mock("../src/notes/NotesView", () => chunk("NotesView"));
vi.mock("../src/analytics/AnalyticsScreen", () => chunk("AnalyticsScreen"));

type Win = Window & {
  requestIdleCallback?: (
    cb: (deadline: {
      didTimeout: boolean;
      timeRemaining: () => number;
    }) => void,
    opts?: { timeout?: number },
  ) => number;
};

/*
 * A requestIdleCallback that fires immediately and records the options it was
 * handed. Recorded here rather than read back off `mock.calls[0][1]`: vi.fn()
 * types its calls tuple from the implementation signature, so a parameter the
 * stub does not consume is either a type error or an unused-args lint error,
 * depending on which way it is written.
 */
function makeIdleStub(seen: ({ timeout?: number } | undefined)[]) {
  return vi.fn(
    (
      cb: (d: { didTimeout: boolean; timeRemaining: () => number }) => void,
      opts?: { timeout?: number },
    ) => {
      seen.push(opts);
      cb({ didTimeout: false, timeRemaining: () => 50 });
      return 1;
    },
  );
}

beforeEach(() => {
  vi.resetModules();
  h.loaded.length = 0;
  h.failing = "";
  h.blocking = "";
  h.release = () => {};
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(window, "requestIdleCallback");
});

async function load() {
  return import("../src/lazySections");
}

describe("prefetchLazySections", () => {
  it("warms every code-split body, in order, on the setTimeout path", async () => {
    const { prefetchLazySections } = await load();
    const done = prefetchLazySections();
    // Nothing before the delay: the whole point is not to compete with the
    // initial load.
    expect(h.loaded).toEqual([]);
    await vi.runAllTimersAsync();
    await done;
    // Order is the contract, not an accident: the loads are sequential so at
    // most one speculative request is in flight at a time.
    expect(h.loaded).toEqual(["NotesView", "AnalyticsScreen"]);
  });

  it("does not start the second chunk while the first is still in flight", async () => {
    /*
     * The order assertion above does NOT cover this. Both loads record in map
     * order whether they are awaited in a loop or handed to Promise.all, so
     * that test passes on a parallel implementation too — measured: swapping
     * the loop for Promise.all left all of this file green until this case
     * existed. Holding the first chunk open is what tells the two apart, and
     * "one speculative request at a time" is the whole reason the loop is a
     * loop (see the SEQUENTIAL note in lazySections.ts).
     */
    h.blocking = "NotesView";
    const { prefetchLazySections } = await load();
    const done = prefetchLazySections();
    await vi.runAllTimersAsync();

    expect(h.loaded).toEqual(["NotesView"]);

    h.release();
    await done;
    expect(h.loaded).toEqual(["NotesView", "AnalyticsScreen"]);
  });

  it("prefers requestIdleCallback, with a timeout so it cannot wait forever", async () => {
    const seen: ({ timeout?: number } | undefined)[] = [];
    const rIC = makeIdleStub(seen);
    (window as Win).requestIdleCallback = rIC;

    const { prefetchLazySections } = await load();
    await prefetchLazySections();

    expect(rIC).toHaveBeenCalledTimes(1);
    // The timeout is what stops a page that never goes idle from never warming.
    expect(seen).toEqual([{ timeout: 4000 }]);
    expect(h.loaded).toHaveLength(2);
  });

  it("runs at most once per page", async () => {
    const rIC = makeIdleStub([]);
    (window as Win).requestIdleCallback = rIC;

    const { prefetchLazySections } = await load();
    // StrictMode mounts the shell twice; both calls must share one warm-up.
    await Promise.all([prefetchLazySections(), prefetchLazySections()]);

    expect(rIC).toHaveBeenCalledTimes(1);
    expect(h.loaded).toHaveLength(2);
  });

  it("keeps going when one chunk fails to load", async () => {
    h.failing = "NotesView";
    const { prefetchLazySections } = await load();
    const done = prefetchLazySections();
    await vi.runAllTimersAsync();
    // Resolves rather than rejecting: a warm-up miss is not a user-visible
    // failure, the Suspense boundary still fetches on demand.
    await expect(done).resolves.toBeUndefined();
    expect(h.loaded).toEqual(["AnalyticsScreen"]);
  });

  it("downloads nothing when the user asked to save data", async () => {
    const connection = { saveData: true };
    Object.defineProperty(navigator, "connection", {
      value: connection,
      configurable: true,
    });
    try {
      const { prefetchLazySections } = await load();
      await prefetchLazySections();
      await vi.runAllTimersAsync();
      expect(h.loaded).toEqual([]);
    } finally {
      Reflect.deleteProperty(navigator, "connection");
    }
  });

  it("does not warm while offline", async () => {
    // A failed import() is remembered by the browser: the module map records
    // the failure and the boundary's own import() of that same URL rejects off
    // the record instead of retrying. Warming through a tunnel would therefore
    // hand the user's later tap an instant failure, which is strictly worse
    // than the fallback line they get today.
    const online = Object.getOwnPropertyDescriptor(
      Navigator.prototype,
      "onLine",
    );
    Object.defineProperty(navigator, "onLine", {
      value: false,
      configurable: true,
    });
    try {
      const { prefetchLazySections } = await load();
      await prefetchLazySections();
      await vi.runAllTimersAsync();
      expect(h.loaded).toEqual([]);
    } finally {
      Reflect.deleteProperty(navigator, "onLine");
      if (online) Object.defineProperty(Navigator.prototype, "onLine", online);
    }
  });

  it("warms normally when the browser exposes no connection info", async () => {
    // Safari and Firefox do not implement navigator.connection at all; absent
    // must read as "no preference", not as "save data".
    expect(
      (navigator as Navigator & { connection?: unknown }).connection,
    ).toBeUndefined();
    const { prefetchLazySections } = await load();
    const done = prefetchLazySections();
    await vi.runAllTimersAsync();
    await done;
    expect(h.loaded).toHaveLength(2);
  });
});
