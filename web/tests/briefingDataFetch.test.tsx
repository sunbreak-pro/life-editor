import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { DataService } from "@life-editor/shared";
import { makeTodo, stubDataService } from "./helpers";
import {
  briefingReads,
  createBriefingHarness,
  mockOf,
  scheduleItem,
  type BriefingReadSeed,
} from "./helpers/briefingHarness";
import { useBriefingData } from "../src/briefing/hooks/useBriefingData";

/*
 * Briefing's data layer, FETCH half (#892).
 *
 * The paper is assembled from seven reads fanned out through
 * `Promise.allSettled`, and every failure mode of that fan-out is silent by
 * construction: a read that is never called leaves its block permanently
 * empty, a read that rejects is swallowed by allSettled, and a domain missing
 * from `useSyncDomains` means the block never refreshes again. None of it
 * throws, none of it logs, and the screen still renders — the paper just goes
 * quietly wrong. That is what these tests are for.
 *
 * The domain list is the part most likely to rot: it is a bare argument list
 * that stays valid TypeScript no matter which names are dropped from it, so
 * "bumping X refetches / bumping Y does not" is asserted from both sides.
 */

const TODAY = "2026-08-15";
const TOMORROW = "2026-08-16";

function makeDS(seed: BriefingReadSeed = {}): DataService {
  return stubDataService(briefingReads(seed));
}

function renderData(ds: DataService) {
  const harness = createBriefingHarness();
  const view = renderHook(() => useBriefingData(ds, TODAY), {
    wrapper: harness.wrapper,
  });
  return { ...view, harness };
}

describe("useBriefingData — fetching (#892)", () => {
  it("reads every source once, and the schedule for today AND tomorrow", async () => {
    const ds = makeDS();
    const { result } = renderData(ds);

    await waitFor(() => expect(result.current.loading).toBe(false));

    // 今後の予定 spans the rest of today plus all of tomorrow, so the schedule
    // is the one source read twice — with two different day keys.
    const byDate = mockOf(ds, "fetchScheduleItemsByDate");
    expect(byDate.mock.calls.map((c) => c[0])).toEqual([TODAY, TOMORROW]);
    expect(mockOf(ds, "fetchTodoTree")).toHaveBeenCalledTimes(1);
    expect(mockOf(ds, "fetchTimerSessions")).toHaveBeenCalledTimes(1);
    expect(mockOf(ds, "getDailyByDateUnified")).toHaveBeenCalledWith(TODAY);
    expect(mockOf(ds, "listNotesUnified")).toHaveBeenCalledTimes(1);
    expect(mockOf(ds, "listAllTagConnections")).toHaveBeenCalledTimes(1);
  });

  it("starts on the skeleton and leaves it once the reads settle", async () => {
    const ds = makeDS();
    const { result } = renderData(ds);

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it("keeps the blocks that resolved when one read rejects", async () => {
    const ds = stubDataService({
      ...briefingReads({
        scheduleByDate: { [TODAY]: [scheduleItem({ id: "s1", date: TODAY })] },
        todos: [makeTodo({ id: "t1", title: "Write report" })],
      }),
      fetchTimerSessions: vi.fn().mockRejectedValue(new Error("offline")),
    });
    const { result } = renderData(ds);

    // allSettled, not all: one dead source must not take the paper with it.
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data.schedule).toHaveLength(1);
    expect(result.current.data.todoNodes).toHaveLength(1);
    expect(result.current.data.sessions).toEqual([]);
  });

  it("refetches when any domain it reads is bumped", async () => {
    const ds = makeDS();
    const { result, harness } = renderData(ds);
    await waitFor(() => expect(result.current.loading).toBe(false));

    for (const domain of [
      "schedule",
      "todos",
      "timer",
      "dailies",
      "notes",
      "tags",
    ] as const) {
      const before = mockOf(ds, "fetchTodoTree").mock.calls.length;
      act(() => harness.sync.bump(domain));
      await waitFor(() =>
        expect(mockOf(ds, "fetchTodoTree").mock.calls.length).toBe(before + 1),
      );
    }
  });

  it("ignores domains it does not read", async () => {
    const ds = makeDS();
    const { result, harness } = renderData(ds);
    await waitFor(() => expect(result.current.loading).toBe(false));
    const before = mockOf(ds, "fetchTodoTree").mock.calls.length;

    // Reading the timer settings WRITES (#499), so an over-declared domain is
    // not merely wasted traffic — this is the assertion that keeps the list
    // from being widened "just in case".
    act(() => harness.sync.bump("audio"));
    act(() => harness.sync.bump("calendars"));

    await Promise.resolve();
    expect(mockOf(ds, "fetchTodoTree").mock.calls.length).toBe(before);
  });

  it("keeps the previous paper visible while a refetch is in flight", async () => {
    const ds = makeDS({
      scheduleByDate: {
        [TODAY]: [scheduleItem({ id: "s1", date: TODAY, title: "Dentist" })],
      },
    });
    const { result, harness } = renderData(ds);
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => harness.sync.bump("schedule"));

    // `loading` is only ever set false — a Realtime bump must not flash the
    // skeleton over a paper that is still perfectly valid.
    expect(result.current.loading).toBe(false);
    expect(result.current.data.schedule[0]?.title).toBe("Dentist");
  });
});
