import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useDailiesUnifiedAPI } from "../src/hooks/useDailiesUnifiedAPI";
import { createBumpableSync } from "./helpers/bumpableSync";
import { stubDataService } from "./helpers/dataServiceStub";
import type { DailyNode } from "../src/types/daily";

/*
 * #891 — the load effect of useDailiesUnifiedAPI, moved onto the shared
 * `useDomainLoad` (#672).
 *
 * This was the quietest of the four copies: it logged a failure and then said
 * nothing. With no loading flag and no error state, a failed read looked
 * exactly like "you have no dailies yet" — an empty list, for the rest of the
 * session. `isLoading` / `error` are new on the hook's surface as a result;
 * no UI reads them yet (wiring an error card is a visible change), so these
 * assertions are what holds them honest until one does.
 */

const { sync, wrapper } = createBumpableSync();

function makeDaily(date: string): DailyNode {
  return {
    id: `daily-${date}`,
    date,
    content: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

interface Round {
  dailies: DailyNode[] | Error;
}

/**
 * DataService stub whose daily list is scripted round by round. After
 * `deferNextRound()` the read hangs until `release()`, which is how the tests
 * observe the in-flight window.
 */
function makeDS(rounds: Round[]) {
  let defer = false;
  const pending: Array<() => void> = [];

  const listDailiesUnified = vi.fn(() => {
    const round = rounds.shift() ?? { dailies: [] };
    const settle = () =>
      round.dailies instanceof Error
        ? Promise.reject(round.dailies)
        : Promise.resolve(round.dailies);
    if (!defer) return settle();
    return new Promise<DailyNode[]>((resolve, reject) => {
      pending.push(() => settle().then(resolve, reject));
    });
  });

  const ds = stubDataService({ listDailiesUnified });
  return {
    ds,
    listDailiesUnified,
    deferNextRound: () => {
      defer = true;
    },
    release: () => {
      defer = false;
      pending.splice(0).forEach((settle) => settle());
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useDailiesUnifiedAPI load effect (#891)", () => {
  it("reports loading until the first read lands, then holds the rows", async () => {
    const { ds } = makeDS([{ dailies: [makeDaily("2026-08-16")] }]);
    const hook = renderHook(() => useDailiesUnifiedAPI({ dataService: ds }), {
      wrapper,
    });

    expect(hook.result.current.isLoading).toBe(true);
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    expect(hook.result.current.dailies.map((d) => d.date)).toEqual([
      "2026-08-16",
    ]);
    expect(hook.result.current.error).toBeNull();
  });

  it("refetches when the dailies domain moves", async () => {
    const { ds, listDailiesUnified } = makeDS([
      { dailies: [makeDaily("2026-08-16")] },
      { dailies: [makeDaily("2026-08-16"), makeDaily("2026-08-15")] },
    ]);
    const hook = renderHook(() => useDailiesUnifiedAPI({ dataService: ds }), {
      wrapper,
    });
    await waitFor(() => expect(listDailiesUnified).toHaveBeenCalledTimes(1));

    act(() => sync.bump("dailies"));
    await waitFor(() => expect(listDailiesUnified).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(hook.result.current.dailies).toHaveLength(2));
  });

  it("keeps the entries on screen while a bump-driven refetch is in flight", async () => {
    const { ds, listDailiesUnified, deferNextRound, release } = makeDS([
      { dailies: [makeDaily("2026-08-16")] },
      { dailies: [makeDaily("2026-08-15")] },
    ]);
    const hook = renderHook(() => useDailiesUnifiedAPI({ dataService: ds }), {
      wrapper,
    });
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));

    // Realtime echoes the tab's own writes back (syncDomains.ts), so this is
    // what every local edit looks like — the entry list must not read as "no
    // data yet" while the echo's re-read is in flight.
    deferNextRound();
    act(() => sync.bump("dailies"));
    await waitFor(() => expect(listDailiesUnified).toHaveBeenCalledTimes(2));
    expect(hook.result.current.isLoading).toBe(false);
    expect(hook.result.current.dailies.map((d) => d.date)).toEqual([
      "2026-08-16",
    ]);

    await act(async () => release());
    expect(hook.result.current.isLoading).toBe(false);
    expect(hook.result.current.dailies.map((d) => d.date)).toEqual([
      "2026-08-15",
    ]);
  });

  it("ignores a bump on a domain it does not read", async () => {
    const { ds, listDailiesUnified } = makeDS([
      { dailies: [makeDaily("2026-08-16")] },
    ]);
    renderHook(() => useDailiesUnifiedAPI({ dataService: ds }), { wrapper });
    await waitFor(() => expect(listDailiesUnified).toHaveBeenCalledTimes(1));

    // A note edit or a calendar edit must not re-pull the daily list (#499).
    act(() => {
      sync.bump("notes");
      sync.bump("calendars");
    });
    await act(async () => {});
    expect(listDailiesUnified).toHaveBeenCalledTimes(1);
  });

  it("surfaces a failed read instead of showing it as an empty list", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { ds } = makeDS([{ dailies: new Error("offline") }]);
    const hook = renderHook(() => useDailiesUnifiedAPI({ dataService: ds }), {
      wrapper,
    });

    await waitFor(() => expect(hook.result.current.error).toBe("offline"));
    // A failed load must settle too — otherwise a surface reading isLoading
    // would sit on its loading state forever with no error ever shown.
    expect(hook.result.current.isLoading).toBe(false);
    expect(hook.result.current.dailies).toEqual([]);
  });

  it("un-latches the error once a later read succeeds (#296)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { ds } = makeDS([
      { dailies: new Error("offline") },
      { dailies: [makeDaily("2026-08-16")] },
    ]);
    const hook = renderHook(() => useDailiesUnifiedAPI({ dataService: ds }), {
      wrapper,
    });
    await waitFor(() => expect(hook.result.current.error).toBe("offline"));

    act(() => sync.bump("dailies"));
    await waitFor(() => expect(hook.result.current.error).toBeNull());
    expect(hook.result.current.dailies.map((d) => d.date)).toEqual([
      "2026-08-16",
    ]);
  });
});
