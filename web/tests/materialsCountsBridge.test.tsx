import { describe, it, expect, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import {
  SyncContext,
  SYNC_DOMAINS,
  type DataService,
  type MaterialsCounts,
  type SyncDomain,
  type WebSyncContextValue,
} from "@life-editor/shared";
import { stubDataService } from "./helpers";
import { MaterialsCountsBridge } from "../src/MaterialsCountsBridge";

/*
 * MaterialsCountsBridge (#499 domain split + #511 count reads).
 *
 * Two behaviours worth a test, both of which are silent when broken:
 *
 *   1. Domain scoping — the bridge is mounted app-wide, so if one domain's
 *      bump refetches all three, every note keystroke pulls tasks and dailies
 *      too. That is exactly the regression #499 removed, and nothing in the UI
 *      would show it coming back.
 *
 *   2. Publish gating — the three counts arrive independently, so publishing
 *      early would flash a real badge next to two zeros that only mean "not
 *      fetched yet". A zero badge is indistinguishable from a true zero.
 *
 * The counts are asserted through onCounts rather than by rendering badges:
 * this component renders nothing (it feeds MainScreen's state).
 */

function zeroVersions(): Record<SyncDomain, number> {
  return Object.fromEntries(SYNC_DOMAINS.map((d) => [d, 0])) as Record<
    SyncDomain,
    number
  >;
}

function makeDS(over: Partial<DataService> = {}): DataService {
  return stubDataService({
    countUnfinishedTodos: vi.fn().mockResolvedValue(3),
    countLiveNotes: vi.fn().mockResolvedValue(7),
    countLiveDailies: vi.fn().mockResolvedValue(9),
    ...over,
  });
}

function setup(ds: DataService) {
  const onCounts = vi.fn<(counts: MaterialsCounts) => void>();
  const versions = zeroVersions();
  const value: WebSyncContextValue = {
    syncVersion: 0,
    domainVersions: versions,
    triggerSync: async () => undefined,
  };
  const view = render(
    <SyncContext.Provider value={value}>
      <MaterialsCountsBridge dataService={ds} onCounts={onCounts} />
    </SyncContext.Provider>,
  );
  /** Bump one domain's counter the way SyncProvider does, then re-render. */
  const bump = (domain: SyncDomain) => {
    const next = { ...versions, [domain]: versions[domain] + 1 };
    versions[domain] += 1;
    view.rerender(
      <SyncContext.Provider value={{ ...value, domainVersions: next }}>
        <MaterialsCountsBridge dataService={ds} onCounts={onCounts} />
      </SyncContext.Provider>,
    );
  };
  return { onCounts, bump };
}

describe("MaterialsCountsBridge", () => {
  it("publishes the three counts once all of them have arrived", async () => {
    const ds = makeDS();
    const { onCounts } = setup(ds);

    await waitFor(() =>
      expect(onCounts).toHaveBeenCalledWith({ tasks: 3, notes: 7, daily: 9 }),
    );
  });

  it("stays silent until the slowest count lands (no half-filled badges)", async () => {
    let releaseDailies: (n: number) => void = () => undefined;
    const ds = makeDS({
      countLiveDailies: vi.fn(
        () =>
          new Promise<number>((resolve) => {
            releaseDailies = resolve;
          }),
      ),
    });
    const { onCounts } = setup(ds);

    // Tasks and notes have resolved by now; dailies has not.
    await waitFor(() => expect(ds.countLiveNotes).toHaveBeenCalled());
    expect(onCounts).not.toHaveBeenCalled();

    releaseDailies(9);
    await waitFor(() =>
      expect(onCounts).toHaveBeenCalledWith({ tasks: 3, notes: 7, daily: 9 }),
    );
  });

  it("refetches only the domain that moved", async () => {
    const ds = makeDS();
    const { onCounts, bump } = setup(ds);
    await waitFor(() => expect(onCounts).toHaveBeenCalled());

    (ds.countLiveNotes as ReturnType<typeof vi.fn>).mockResolvedValue(8);
    bump("notes");

    await waitFor(() =>
      expect(onCounts).toHaveBeenLastCalledWith({
        tasks: 3,
        notes: 8,
        daily: 9,
      }),
    );
    // The other two never ran a second time — that is the #499 invariant.
    expect(ds.countUnfinishedTodos).toHaveBeenCalledTimes(1);
    expect(ds.countLiveDailies).toHaveBeenCalledTimes(1);
    expect(ds.countLiveNotes).toHaveBeenCalledTimes(2);
  });

  it("keeps the last known count when a refetch fails", async () => {
    const ds = makeDS();
    const { onCounts, bump } = setup(ds);
    await waitFor(() => expect(onCounts).toHaveBeenCalled());

    (ds.countLiveNotes as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("offline"),
    );
    bump("notes");
    await waitFor(() => expect(ds.countLiveNotes).toHaveBeenCalledTimes(2));

    // A failed pull must not publish notes: 0 — the badge would read as
    // "no notes" when the notes are merely unreachable.
    expect(onCounts).toHaveBeenLastCalledWith({ tasks: 3, notes: 7, daily: 9 });
  });
});
