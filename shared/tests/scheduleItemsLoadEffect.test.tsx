import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useScheduleItemsAPI } from "../src/hooks/useScheduleItemsAPI";
import { createBumpableSync } from "./helpers/bumpableSync";
import type { ScheduleItem } from "../src/types/schedule";
import type { DataService } from "../src/services/DataService";

/*
 * #672 — the load effect of useScheduleItemsAPI, ported to useDomainLoad last
 * of the three baseline files. Same contract as routinesLoadEffect, plus the
 * one thing only this hook has: the anchored date. Switching days must restart
 * the load exactly like a Realtime bump — before the port that was a dep of a
 * hand-written effect, now it is the `anchor` field, and nothing else in the
 * repo exercises it.
 */

const { sync, wrapper } = createBumpableSync();

function item(id: string, overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id,
    date: "2026-08-10",
    title: id,
    startTime: "09:00",
    endTime: "10:00",
    completed: false,
    completedAt: null,
    routineId: null,
    templateId: null,
    memo: null,
    noteId: null,
    content: null,
    isDeleted: false,
    deletedAt: null,
    isDismissed: false,
    isAllDay: false,
    createdAt: "2026-08-12T00:00:00.000Z",
    updatedAt: "2026-08-12T00:00:00.000Z",
    ...overrides,
  };
}

/**
 * DataService stub. `active` / `deleted` are scripted round by round; an Error
 * in a round means that read rejects.
 */
function makeDS(
  active: Array<ScheduleItem[] | Error>,
  deleted: Array<ScheduleItem[] | Error> = [],
) {
  const take = (rounds: Array<ScheduleItem[] | Error>) => {
    const next = rounds.shift() ?? [];
    if (next instanceof Error) return Promise.reject(next);
    return Promise.resolve(next);
  };
  const fetchScheduleItemsByDateAll = vi.fn(() => take(active));
  const fetchDeletedScheduleItems = vi.fn(() => take(deleted));
  const ds = {
    fetchScheduleItemsByDateAll,
    fetchDeletedScheduleItems,
  } as unknown as DataService;
  return { ds, fetchScheduleItemsByDateAll, fetchDeletedScheduleItems };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useScheduleItemsAPI load effect (#672)", () => {
  it("reports loading until the first read lands, then holds both lists", async () => {
    const { ds } = makeDS([[item("schedule-1")]], [[item("schedule-9")]]);
    const hook = renderHook(
      () => useScheduleItemsAPI({ dataService: ds, date: "2026-08-10" }),
      { wrapper },
    );

    expect(hook.result.current.isLoading).toBe(true);
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    expect(hook.result.current.items.map((i) => i.id)).toEqual(["schedule-1"]);
    await waitFor(() =>
      expect(hook.result.current.deletedItems.map((i) => i.id)).toEqual([
        "schedule-9",
      ]),
    );
    expect(hook.result.current.error).toBeNull();
  });

  it("refetches when the schedule domain moves", async () => {
    const { ds, fetchScheduleItemsByDateAll } = makeDS([
      [item("schedule-1")],
      [item("schedule-1"), item("schedule-2")],
    ]);
    const hook = renderHook(
      () => useScheduleItemsAPI({ dataService: ds, date: "2026-08-10" }),
      { wrapper },
    );
    await waitFor(() =>
      expect(fetchScheduleItemsByDateAll).toHaveBeenCalledTimes(1),
    );

    act(() => sync.bump("schedule"));
    await waitFor(() =>
      expect(fetchScheduleItemsByDateAll).toHaveBeenCalledTimes(2),
    );
    await waitFor(() => expect(hook.result.current.items).toHaveLength(2));
  });

  it("restarts the load when the anchored date changes", async () => {
    const { ds, fetchScheduleItemsByDateAll } = makeDS([
      [item("schedule-1")],
      [item("schedule-2", { date: "2026-08-11" })],
    ]);
    const hook = renderHook(
      ({ date }: { date: string }) =>
        useScheduleItemsAPI({ dataService: ds, date }),
      { wrapper, initialProps: { date: "2026-08-10" } },
    );
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));

    hook.rerender({ date: "2026-08-11" });
    // Derived loading: the settled read is for the OLD date, so the hook is
    // back to "no data yet" immediately, with no state write in an effect.
    expect(hook.result.current.isLoading).toBe(true);
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    expect(fetchScheduleItemsByDateAll).toHaveBeenLastCalledWith("2026-08-11");
    expect(hook.result.current.items.map((i) => i.id)).toEqual(["schedule-2"]);
  });

  it("still fills the active list when the trash read fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { ds } = makeDS([[item("schedule-1")]], [new Error("trash down")]);
    const hook = renderHook(
      () => useScheduleItemsAPI({ dataService: ds, date: "2026-08-10" }),
      { wrapper },
    );

    await waitFor(() =>
      expect(hook.result.current.items.map((i) => i.id)).toEqual([
        "schedule-1",
      ]),
    );
    expect(hook.result.current.isLoading).toBe(false);
    // The trash view has its own empty state; a failure there is logged, not
    // surfaced as the section's error.
    expect(hook.result.current.error).toBeNull();
    expect(hook.result.current.deletedItems).toEqual([]);
  });

  it("surfaces a failed read and un-latches it on the next success (#296)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { ds } = makeDS([new Error("offline"), [item("schedule-1")]]);
    const hook = renderHook(
      () => useScheduleItemsAPI({ dataService: ds, date: "2026-08-10" }),
      { wrapper },
    );

    await waitFor(() => expect(hook.result.current.error).toBe("offline"));
    expect(hook.result.current.isLoading).toBe(false);

    act(() => sync.bump("schedule"));
    await waitFor(() => expect(hook.result.current.error).toBeNull());
    expect(hook.result.current.items.map((i) => i.id)).toEqual(["schedule-1"]);
  });
});
