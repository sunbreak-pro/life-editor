import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { useDailiesUnifiedAPI } from "../src/hooks/useDailiesUnifiedAPI";
import { SyncContext } from "../src/context/SyncContextValue";
import { uniformDomainVersions } from "../src/context/syncDomains";
import type { DataService } from "../src/services/DataService";
import { stubDataService } from "./helpers/dataServiceStub";
import type { DailyNode } from "../src/types/daily";

/*
 * #371 — `upsertDaily` stays optimistic + fire-and-forget for existing
 * callers, but now hands back the PERSISTED node so work that needs the
 * items_meta row to exist can wait for it. A brand-new day's `[[ ]]` edge is
 * exactly that: wiki_tag_connections.from_item_id FK-references items_meta,
 * and the optimistic DailyNode lands long before the write does.
 */

function wrapper({ children }: { children: ReactNode }) {
  return createElement(
    SyncContext.Provider,
    {
      value: {
        syncVersion: 0,
        domainVersions: uniformDomainVersions(0),
        triggerSync: async () => {},
      },
    },
    children,
  );
}

const SAVED: DailyNode = {
  id: "daily-2026-07-26",
  date: "2026-07-26",
  content: "hello",
  createdAt: "2026-07-26T00:00:00.000Z",
  updatedAt: "2026-07-26T00:00:00.000Z",
};

function makeDS(upsert: DataService["upsertDailyByDateUnified"]) {
  return stubDataService({
    listDailiesUnified: () => Promise.resolve([]),
    upsertDailyByDateUnified: upsert,
  });
}

describe("useDailiesUnifiedAPI.upsertDaily (#371)", () => {
  it("resolves with the persisted node", async () => {
    const ds = makeDS(() => Promise.resolve(SAVED));
    const { result } = renderHook(
      () => useDailiesUnifiedAPI({ dataService: ds }),
      { wrapper },
    );

    await expect(
      result.current.upsertDaily("2026-07-26", "hello"),
    ).resolves.toEqual(SAVED);
  });

  it("resolves with null instead of rejecting when the write fails", async () => {
    // The rejection is logged, not thrown: callers that ignore the promise
    // must not turn a failed save into an unhandled rejection, and a caller
    // that waits gets a null it can act on (leave the edge queued, retry).
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ds = makeDS(() => Promise.reject(new Error("offline")));
    const { result } = renderHook(
      () => useDailiesUnifiedAPI({ dataService: ds }),
      { wrapper },
    );

    await expect(
      result.current.upsertDaily("2026-07-26", "hello"),
    ).resolves.toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("[Daily] sync: offline"),
    );
    warn.mockRestore();
  });

  it("still updates local state before the write lands", async () => {
    let release: ((node: DailyNode) => void) | undefined;
    const ds = makeDS(
      () =>
        new Promise<DailyNode>((resolve) => {
          release = resolve;
        }),
    );
    const { result } = renderHook(
      () => useDailiesUnifiedAPI({ dataService: ds }),
      { wrapper },
    );
    // Let the mount load settle first — its setDailies([]) would otherwise
    // land on top of the optimistic insert below.
    await act(async () => {});

    let pending: Promise<DailyNode | null> | undefined;
    await act(async () => {
      pending = result.current.upsertDaily("2026-07-26", "hello");
    });
    expect(result.current.dailies.map((d) => d.date)).toEqual(["2026-07-26"]);

    release?.(SAVED);
    await expect(pending).resolves.toEqual(SAVED);
  });
});
