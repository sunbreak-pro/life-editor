import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { IDBFactory } from "fake-indexeddb";
import { useDomainLoad, type DomainDelta } from "../src/hooks/useDomainLoad";
import {
  SyncContext,
  type WebSyncContextValue,
} from "../src/context/SyncContextValue";
import { SYNC_DOMAINS } from "../src/context/syncDomains";
import {
  PERSIST_DEBOUNCE_MS,
  clearDomainSnapshots,
  forgetDomainSnapshots,
  hydrateDomainSnapshots,
  readDomainSnapshot,
  writeDomainSnapshot,
} from "../src/state/domainSnapshotStore";
import { readPersistedSnapshots } from "../src/state/persistentCache";
import {
  resetFullReadPolicy,
  type ChangeCursor,
} from "../src/services/itemChanges";
import { stubDataService } from "./helpers/dataServiceStub";

/*
 * #2333 — useDomainLoad's side of the delta read: when it runs, what it is
 * given, and that the list and its cursor stay one unit.
 */

const AT = "2026-10-21T10:00:00.000000+00:00";
const NEXT = "2026-10-21T11:00:00.000000+00:00";

const cursor = (at = AT): ChangeCursor => ({
  at,
  seen: {},
  readAt: Date.now(),
});

function setup(
  overrides: Partial<DomainDelta<string[]>> = {},
  load = vi.fn().mockResolvedValue(["full"]),
) {
  const ds = stubDataService();
  const apply = vi.fn();
  const delta = {
    readCursor: vi.fn().mockResolvedValue(cursor()),
    read: vi.fn().mockResolvedValue({ data: ["delta"], cursor: cursor(NEXT) }),
    ...overrides,
  };
  const options = (version = 0) => ({
    domain: "test",
    dataService: ds,
    version,
    load,
    apply,
    fallbackMessage: "failed",
    snapshotKey: "notes" as const,
    delta,
  });
  return { ds, apply, delta, load, options };
}

beforeEach(() => {
  clearDomainSnapshots();
  resetFullReadPolicy();
  localStorage.clear();
});

describe("useDomainLoad delta", () => {
  it("reads in full first, taking the cursor before the read starts", async () => {
    const order: string[] = [];
    const { ds, options } = setup(
      {
        readCursor: async () => {
          order.push("cursor");
          return cursor();
        },
      },
      vi.fn(async () => {
        order.push("load");
        return ["full"];
      }),
    );
    const { result } = renderHook(() => useDomainLoad(options()));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(order).toEqual(["cursor", "load"]);
    expect(readDomainSnapshot("notes", ds, undefined)?.cursor?.at).toBe(AT);
  });

  it("applies the next read to the snapshot, not to anything newer on screen", async () => {
    const { ds, apply, delta, load, options } = setup();
    writeDomainSnapshot("notes", ds, undefined, ["base"], undefined, cursor());
    const { result } = renderHook(() => useDomainLoad(options()));
    await waitFor(() => expect(apply).toHaveBeenCalledWith(["delta"]));
    expect(delta.read).toHaveBeenCalledWith(
      ds,
      expect.objectContaining({ at: AT }),
      ["base"],
    );
    expect(load).not.toHaveBeenCalled();
    expect(delta.readCursor).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();

    const stored = readDomainSnapshot<string[]>("notes", ds, undefined);
    expect(stored?.data).toEqual(["delta"]);
    expect(stored?.cursor?.at).toBe(NEXT);
  });

  it.each([
    ["answers null", vi.fn().mockResolvedValue(null)],
    ["fails", vi.fn().mockRejectedValue(new Error("boom"))],
  ])(
    "falls back to the full read with no error when the delta %s",
    async (_, read) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const { ds, apply, options } = setup({ read });
      writeDomainSnapshot(
        "notes",
        ds,
        undefined,
        ["base"],
        undefined,
        cursor(),
      );
      const { result } = renderHook(() => useDomainLoad(options()));
      await waitFor(() => expect(apply).toHaveBeenCalledWith(["full"]));
      expect(result.current.error).toBeNull();
    },
  );

  it("keeps the list when the cursor cannot be had, and reads in full next time", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { ds, apply, delta, options } = setup({
      readCursor: vi.fn().mockRejectedValue(new Error("42703")),
    });
    const { result } = renderHook(() => useDomainLoad(options()));
    await waitFor(() => expect(apply).toHaveBeenCalledWith(["full"]));
    expect(result.current.error).toBeNull();
    expect(readDomainSnapshot("notes", ds, undefined)?.cursor).toBeUndefined();
    expect(delta.read).not.toHaveBeenCalled();
  });

  it("reads in full when the last read is over a week old", async () => {
    const { ds, apply, delta, options } = setup();
    const stale = { ...cursor(), readAt: Date.now() - 8 * 86_400_000 };
    writeDomainSnapshot("notes", ds, undefined, ["base"], undefined, stale);
    renderHook(() => useDomainLoad(options()));
    await waitFor(() => expect(apply).toHaveBeenCalledWith(["full"]));
    expect(delta.read).not.toHaveBeenCalled();
  });

  it("counts a delta read for #2328, and a fresh mount still skips", async () => {
    const value: WebSyncContextValue = {
      syncVersion: 0,
      domainVersions: Object.fromEntries(
        SYNC_DOMAINS.map((d) => [d, 0]),
      ) as WebSyncContextValue["domainVersions"],
      triggerSync: async () => {},
      epoch: 1,
      getRevision: () => 7,
    };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
    );
    const { ds, apply, delta, options } = setup();
    writeDomainSnapshot("notes", ds, undefined, ["base"], undefined, cursor());
    const opts = { ...options(), skipWhenFresh: ["notes" as const] };

    const first = renderHook(() => useDomainLoad(opts), { wrapper });
    await waitFor(() => expect(apply).toHaveBeenCalledWith(["delta"]));
    first.unmount();
    expect(delta.read).toHaveBeenCalledTimes(1);
    expect(readDomainSnapshot("notes", ds, undefined)?.fresh).toEqual({
      epoch: 1,
      revision: 7,
    });

    renderHook(() => useDomainLoad(opts), { wrapper });
    await new Promise((r) => setTimeout(r, 20));
    expect(delta.read).toHaveBeenCalledTimes(1);
  });
});

describe("the list and its cursor on the device", () => {
  const USER = "delta-user";

  beforeEach(async () => {
    await forgetDomainSnapshots(USER);
    globalThis.indexedDB = new IDBFactory();
  });

  it("go in one row, and come back together", async () => {
    const ds = stubDataService();
    await hydrateDomainSnapshots(USER);
    writeDomainSnapshot(
      "notes",
      ds,
      undefined,
      [{ id: "a" }],
      undefined,
      cursor(),
    );
    await new Promise((r) => setTimeout(r, PERSIST_DEBOUNCE_MS + 50));
    const rows = await readPersistedSnapshots(USER);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ data: [{ id: "a" }], cursor: { at: AT } });

    clearDomainSnapshots();
    await hydrateDomainSnapshots(USER);
    const back = readDomainSnapshot("notes", ds, undefined);
    expect(back?.data).toEqual([{ id: "a" }]);
    expect(back?.cursor?.at).toBe(AT);
  });
});
