import { describe, it, expect } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useWikiTagsUnifiedAPI } from "../src/hooks/useWikiTagsUnifiedAPI";
import { createBumpableSync } from "./helpers/bumpableSync";
import { stubDataService } from "./helpers/dataServiceStub";

/*
 * #300 — a background refetch (syncVersion bump) must NOT resurrect the
 * loading state. `loading` means "no data yet": TagPicker / LinkPanel all gate
 * their already-rendered chips on it, so flipping it during the own-write
 * Realtime echo's refetch unmounted every visible tag pill for the length of a
 * 3-query round-trip — once per typing pause.
 */

// Bumpable Sync provider — the captured setter lets a test simulate a
// Realtime-driven syncVersion bump without the real SyncProvider. Shared with
// syncDomainWiring / the #672 load-effect suites (tests/helpers/bumpableSync);
// calling `bump()` with no domain moves every counter, which is the app-wide
// shape this suite was written against. The test awaits the initial load
// before bumping, so the helper's publishing effect has always run by then.
const { sync, wrapper } = createBumpableSync();

// DataService stub: the initial round resolves immediately; after
// deferNextRound() the three bulk list calls hang until releaseAll().
function makeDS() {
  let defer = false;
  const pending: Array<(rows: never[]) => void> = [];
  const list = () => {
    if (!defer) return Promise.resolve([]);
    return new Promise<never[]>((resolve) => {
      pending.push(resolve);
    });
  };
  const ds = stubDataService({
    listAllWikiTagsUnified: list,
    listAllTagAssignments: list,
    listAllTagConnections: list,
  });
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
      wrapper,
    });
    expect(hook.result.current.loading).toBe(true);
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
  });

  it("keeps loading=false while a syncVersion-bump refetch is in flight", async () => {
    const { ds, deferNextRound, releaseAll, pendingCount } = makeDS();
    const hook = renderHook(() => useWikiTagsUnifiedAPI({ dataService: ds }), {
      wrapper,
    });
    await waitFor(() => expect(hook.result.current.loading).toBe(false));

    deferNextRound();
    act(() => sync.bump());
    // The refetch has started (all three bulk queries in flight)…
    await waitFor(() => expect(pendingCount()).toBe(3));
    // …but the previously rendered tag data must stay up — no loading flip.
    expect(hook.result.current.loading).toBe(false);

    await act(async () => releaseAll());
    expect(hook.result.current.loading).toBe(false);
  });
});
