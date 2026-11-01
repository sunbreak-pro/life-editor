import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { useDomainLoad } from "../src/hooks/useDomainLoad";
import {
  SyncContext,
  type WebSyncContextValue,
} from "../src/context/SyncContextValue";
import { SYNC_DOMAINS } from "../src/context/syncDomains";
import { clearDomainSnapshots } from "../src/state/domainSnapshotStore";
import { stubDataService } from "./helpers/dataServiceStub";

/*
 * #2328 — a remount reuses the last result when Sync has reported nothing
 * since, and reads again when it has.
 *
 * The Provider here is a stub holding `epoch` and one revision number. That is
 * all `useDomainLoad` sees of SyncProvider, and it keeps the cases below down
 * to the one thing under test: whether the second mount reads.
 */

interface Sync {
  epoch: number;
  revision: number;
}

function wrapperFor(sync: Sync) {
  const value: WebSyncContextValue = {
    syncVersion: 0,
    domainVersions: Object.fromEntries(
      SYNC_DOMAINS.map((d) => [d, 0]),
    ) as WebSyncContextValue["domainVersions"],
    triggerSync: async () => {},
    get epoch() {
      return sync.epoch;
    },
    getRevision: () => sync.revision,
  };
  return ({ children }: { children: ReactNode }) => (
    <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
  );
}

function mount(
  sync: Sync,
  load: () => Promise<string[]>,
  extra: { skipWhenFresh?: boolean; onFresh?: (d: string[]) => void } = {},
) {
  const { skipWhenFresh = true, onFresh } = extra;
  const apply = vi.fn();
  const ds = stubDataService();
  const hook = (dataService = ds) =>
    renderHook(
      () =>
        useDomainLoad({
          domain: "test",
          dataService,
          version: 0,
          load,
          apply,
          fallbackMessage: "failed",
          snapshotKey: "notes",
          ...(skipWhenFresh ? { skipWhenFresh: ["notes" as const] } : {}),
          onFresh,
        }),
      { wrapper: wrapperFor(sync) },
    );
  return { hook, apply, ds };
}

beforeEach(() => {
  clearDomainSnapshots();
});

describe("useDomainLoad skipWhenFresh (#2328)", () => {
  it("does not read again when nothing has changed since the last read", async () => {
    const sync = { epoch: 1, revision: 4 };
    const load = vi.fn().mockResolvedValue(["a"]);
    const onFresh = vi.fn();
    const { hook, apply } = mount(sync, load, { onFresh });

    const first = hook();
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    first.unmount();
    expect(load).toHaveBeenCalledTimes(1);

    const back = hook();
    expect(back.result.current.isLoading).toBe(false);
    expect(apply).toHaveBeenLastCalledWith(["a"]);
    expect(onFresh).toHaveBeenCalledWith(["a"]);
    // Let any effect that was going to fetch do so before asserting it did not.
    await new Promise((r) => setTimeout(r, 20));
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("reads again after a change was reported", async () => {
    const sync = { epoch: 1, revision: 4 };
    const load = vi.fn().mockResolvedValue(["a"]);
    const { hook } = mount(sync, load);

    const first = hook();
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    first.unmount();

    sync.revision = 5;
    const back = hook();
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    back.unmount();
  });

  it("reads again under a new Provider, even when the numbers match", async () => {
    const sync = { epoch: 1, revision: 0 };
    const load = vi.fn().mockResolvedValue(["a"]);
    const { hook } = mount(sync, load);

    const first = hook();
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    first.unmount();

    // A new SyncProvider restarts its counters at 0, so 0 === 0 proves nothing.
    sync.epoch = 2;
    const back = hook();
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    back.unmount();
  });

  it("reads again for a change that landed while the earlier read was in flight", async () => {
    const sync = { epoch: 1, revision: 4 };
    let release: (rows: string[]) => void = () => {};
    const load = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<string[]>((resolve) => {
            release = resolve;
          }),
      )
      .mockResolvedValue(["b"]);
    const { hook } = mount(sync, load);

    const first = hook();
    // The change arrives after the read started and before it answered.
    sync.revision = 5;
    release(["a"]);
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    first.unmount();

    const back = hook();
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    back.unmount();
  });

  it("reads as before when the caller did not opt in", async () => {
    const sync = { epoch: 1, revision: 4 };
    const load = vi.fn().mockResolvedValue(["a"]);
    const { hook } = mount(sync, load, { skipWhenFresh: false });

    const first = hook();
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    first.unmount();

    const back = hook();
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    back.unmount();
  });

  it("reads as before when the Provider cannot say (a stub without an epoch)", async () => {
    const load = vi.fn().mockResolvedValue(["a"]);
    const apply = vi.fn();
    const ds = stubDataService();
    const render = () =>
      renderHook(() =>
        useDomainLoad({
          domain: "test",
          dataService: ds,
          version: 0,
          load,
          apply,
          fallbackMessage: "failed",
          snapshotKey: "notes",
          skipWhenFresh: ["notes"],
        }),
      );
    const first = render();
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    first.unmount();
    const back = render();
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    back.unmount();
  });
});
