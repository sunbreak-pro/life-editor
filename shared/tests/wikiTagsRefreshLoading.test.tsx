import { describe, it, expect } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createElement, useState, type ReactNode } from "react";
import { useWikiTagsUnifiedAPI } from "../src/hooks/useWikiTagsUnifiedAPI";
import { SyncContext } from "../src/context/SyncContextValue";
import type { DataService } from "../src/services/DataService";

/*
 * #300 — a background refetch (syncVersion bump) must NOT resurrect the
 * loading state. `loading` means "no data yet": TagPicker / LinkPanel / the
 * Tags tab all gate their already-rendered chips on it, so flipping it during
 * the own-write Realtime echo's refetch unmounted every visible tag pill for
 * the length of a 5-query round-trip — once per typing pause.
 */

// Bumpable Sync provider — the captured setter lets a test simulate a
// Realtime-driven syncVersion bump without the real SyncProvider.
let bumpSyncVersion: () => void = () => {};
function BumpableSyncProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  bumpSyncVersion = () => setVersion((v) => v + 1);
  return createElement(
    SyncContext.Provider,
    { value: { syncVersion: version, triggerSync: async () => {} } },
    children,
  );
}

// DataService stub: the initial round resolves immediately; after
// deferNextRound() the five bulk list calls hang until releaseAll().
function makeDS() {
  let defer = false;
  const pending: Array<(rows: never[]) => void> = [];
  const list = () => {
    if (!defer) return Promise.resolve([]);
    return new Promise<never[]>((resolve) => {
      pending.push(resolve);
    });
  };
  const ds = {
    listAllWikiTagsUnified: list,
    listAllWikiTagGroupsUnified: list,
    listAllWikiTagGroupAssignments: list,
    listAllTagAssignments: list,
    listAllTagConnections: list,
  } as unknown as DataService;
  return {
    ds,
    deferNextRound: () => {
      defer = true;
    },
    releaseAll: () => {
      pending.splice(0).forEach((resolve) => resolve([]));
    },
    pendingCount: () => pending.length,
  };
}

describe("useWikiTagsUnifiedAPI loading (#300)", () => {
  it("reports loading until the initial bulk load lands", async () => {
    const { ds } = makeDS();
    const hook = renderHook(() => useWikiTagsUnifiedAPI({ dataService: ds }), {
      wrapper: BumpableSyncProvider,
    });
    expect(hook.result.current.loading).toBe(true);
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
  });

  it("keeps loading=false while a syncVersion-bump refetch is in flight", async () => {
    const { ds, deferNextRound, releaseAll, pendingCount } = makeDS();
    const hook = renderHook(() => useWikiTagsUnifiedAPI({ dataService: ds }), {
      wrapper: BumpableSyncProvider,
    });
    await waitFor(() => expect(hook.result.current.loading).toBe(false));

    deferNextRound();
    act(() => bumpSyncVersion());
    // The refetch has started (all five bulk queries in flight)…
    await waitFor(() => expect(pendingCount()).toBe(5));
    // …but the previously rendered tag data must stay up — no loading flip.
    expect(hook.result.current.loading).toBe(false);

    await act(async () => releaseAll());
    expect(hook.result.current.loading).toBe(false);
  });
});
