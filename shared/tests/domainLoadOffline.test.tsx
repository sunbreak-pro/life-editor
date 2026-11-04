import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  OWED_READ_DELAY_MS,
  useDomainLoad,
} from "../src/hooks/useDomainLoad";
import { setSessionUnreachable } from "../src/state/connectivity";
import {
  clearDomainSnapshots,
  writeDomainSnapshot,
} from "../src/state/domainSnapshotStore";
import type { ChangeCursor } from "../src/services/itemChanges";
import { resetFullReadPolicy } from "../src/services/itemChanges";
import { stubDataService } from "./helpers/dataServiceStub";

/*
 * #2334 (plan P1c step 4) — offline a domain starts no read and reports no
 * error, and comes back with one read: #2329's re-read on reconnect moves
 * `version`, and #2333's cursor must still be where the last real read left it.
 */

const ds = stubDataService();

const cursor = (): ChangeCursor => ({
  at: "2026-10-21T10:00:00.000000+00:00",
  seen: {},
  settling: {},
  readAt: Date.now(),
});

const setOnline = (online: boolean): void => {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(online);
  act(() => {
    window.dispatchEvent(new Event(online ? "online" : "offline"));
  });
};

function mount(load = vi.fn().mockResolvedValue(["read"])) {
  const apply = vi.fn();
  const hook = renderHook(
    ({ version }: { version: number }) =>
      useDomainLoad<string[]>({
        domain: "test",
        dataService: ds,
        version,
        load,
        apply,
        fallbackMessage: "failed",
        snapshotKey: "notes",
      }),
    { initialProps: { version: 0 } },
  );
  return { ...hook, load, apply };
}

beforeEach(() => {
  vi.useFakeTimers();
  globalThis.indexedDB = new IDBFactory();
  clearDomainSnapshots();
  resetFullReadPolicy();
  localStorage.clear();
  setSessionUnreachable(false);
});

afterEach(() => {
  setSessionUnreachable(false);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useDomainLoad offline (#2334)", () => {
  it("starts no read, and is not loading", async () => {
    setOnline(false);
    const { result, load } = mount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(OWED_READ_DELAY_MS * 2);
    });
    expect(load).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("replays what is stored and leaves it on screen", () => {
    writeDomainSnapshot("notes", ds, undefined, ["stored"]);
    setOnline(false);
    const { apply, load } = mount();
    expect(apply).toHaveBeenCalledWith(["stored"]);
    expect(load).not.toHaveBeenCalled();
  });

  it("gives the replay to onFresh, since no read will land", () => {
    writeDomainSnapshot("notes", ds, undefined, ["stored"]);
    setOnline(false);
    const onFresh = vi.fn();
    renderHook(() =>
      useDomainLoad<string[]>({
        domain: "test",
        dataService: ds,
        version: 0,
        load: vi.fn(),
        apply: vi.fn(),
        fallbackMessage: "failed",
        snapshotKey: "notes",
        onFresh,
      }),
    );
    expect(onFresh).toHaveBeenCalledWith(["stored"]);
  });

  it("does not read on a version bump while offline", async () => {
    setOnline(false);
    const { rerender, load } = mount();
    rerender({ version: 1 });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(OWED_READ_DELAY_MS * 2);
    });
    expect(load).not.toHaveBeenCalled();
  });

  it("hides the error of a read that failed as the line dropped", async () => {
    const load = vi.fn().mockRejectedValue(new Error("Failed to fetch"));
    const { result } = mount(load);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.error).toBe("Failed to fetch");
    setOnline(false);
    expect(result.current.error).toBeNull();
  });

  it("reads on its own after the line is back when nothing bumps it", async () => {
    setOnline(false);
    const { result, load, apply } = mount();
    setOnline(true);
    expect(load).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(OWED_READ_DELAY_MS);
    });
    expect(load).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith(["read"]);
    expect(result.current.isLoading).toBe(false);
  });

  it("reads once when #2329's re-read arrives first", async () => {
    setOnline(false);
    const { rerender, load } = mount();
    setOnline(true);
    // SyncProvider's resume lands through its 300ms queue.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    rerender({ version: 1 });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(OWED_READ_DELAY_MS * 2);
    });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("waits for the session gate when the browser says online but the session cannot refresh", async () => {
    setSessionUnreachable(true);
    const { result, load } = mount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(OWED_READ_DELAY_MS * 2);
    });
    expect(load).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    act(() => setSessionUnreachable(false));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(OWED_READ_DELAY_MS);
    });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("leaves #2333's cursor alone, so the next read is the delta from it", async () => {
    const held = cursor();
    writeDomainSnapshot("notes", ds, undefined, ["stored"], undefined, held);
    setOnline(false);
    const load = vi.fn().mockResolvedValue(["full"]);
    const read = vi
      .fn()
      .mockResolvedValue({ data: ["changed"], cursor: cursor() });
    renderHook(() =>
      useDomainLoad<string[]>({
        domain: "test",
        dataService: ds,
        version: 0,
        load,
        apply: vi.fn(),
        fallbackMessage: "failed",
        snapshotKey: "notes",
        delta: { readCursor: vi.fn().mockResolvedValue(cursor()), read },
      }),
    );
    expect(read).not.toHaveBeenCalled();
    setOnline(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(OWED_READ_DELAY_MS);
    });
    expect(read).toHaveBeenCalledWith(ds, held, ["stored"]);
    expect(load).not.toHaveBeenCalled();
  });

  it("reads at once as ever when it never went offline", async () => {
    const { load } = mount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(load).toHaveBeenCalledTimes(1);
  });
});
