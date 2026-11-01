import { describe, it, expect, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ScheduleItem } from "@life-editor/shared";
import { createBumpableSync } from "./helpers";
import {
  existingEventRows,
  useExistingEventPool,
} from "../src/schedule/useExistingEventPool";

/*
 * #2406 — what the creation panel's event 「既存から選ぶ」 lists, and when it
 * is read. `fetchEvents` walks the whole event history, so "not until asked"
 * is a promise worth pinning; so is telling "could not read" from "none".
 */

function event(over: Partial<ScheduleItem>): ScheduleItem {
  return {
    id: "evt",
    date: "2026-10-01",
    title: "Dentist",
    startTime: "09:00",
    endTime: "10:00",
    routineId: null,
    ...over,
  } as ScheduleItem;
}

function setup(fetchEvents: () => Promise<ScheduleItem[]>, panelOpen = true) {
  const { wrapper } = createBumpableSync();
  const ds = { fetchEvents: vi.fn(fetchEvents) };
  const tagIdsOf = vi.fn((item: ScheduleItem) =>
    item.routineId ? ["tag-series"] : [],
  );
  const view = renderHook(
    ({ open }: { open: boolean }) =>
      useExistingEventPool({ dataService: ds, panelOpen: open, tagIdsOf }),
    { wrapper, initialProps: { open: panelOpen } },
  );
  return { ds, view };
}

describe("existingEventRows", () => {
  it("lists a series once, as its latest occurrence", () => {
    const rows = existingEventRows([
      event({ id: "a", date: "2026-01-01", routineId: "r-1" }),
      event({ id: "b", date: "2026-03-01", routineId: "r-1" }),
      event({ id: "c", date: "2026-02-01", routineId: "r-1" }),
      event({ id: "d", date: "2026-02-01", routineId: "r-2", title: "Run" }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(["b", "d"]);
  });

  it("keeps same-titled single events apart, newest first", () => {
    const rows = existingEventRows([
      event({ id: "old", date: "2026-01-01" }),
      event({ id: "new", date: "2026-05-01" }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(["new", "old"]);
  });
});

describe("useExistingEventPool", () => {
  it("reads nothing until the source is chosen", async () => {
    const h = setup(async () => [event({ id: "a" })]);
    expect(h.ds.fetchEvents).not.toHaveBeenCalled();
    expect(h.view.result.current.eventPool.options).toEqual([]);

    act(() => h.view.result.current.eventPool.onOpen());
    await waitFor(() =>
      expect(h.view.result.current.eventPool.options).toEqual([
        { id: "a", title: "Dentist" },
      ]),
    );
    expect(h.ds.fetchEvents).toHaveBeenCalledTimes(1);
  });

  it("reads nothing with the panel shut, and again when it reopens", async () => {
    const h = setup(async () => [event({ id: "a" })], false);
    act(() => h.view.result.current.eventPool.onOpen());
    expect(h.ds.fetchEvents).not.toHaveBeenCalled();

    h.view.rerender({ open: true });
    await waitFor(() => expect(h.ds.fetchEvents).toHaveBeenCalledTimes(1));
  });

  it("finds the listed event, and seeds the tags from what it shows", async () => {
    const h = setup(async () => [event({ id: "a", routineId: "r-1" })]);
    act(() => h.view.result.current.eventPool.onOpen());
    await waitFor(() =>
      expect(h.view.result.current.findEvent("a")?.id).toBe("a"),
    );
    expect(h.view.result.current.eventPool.tagsOf("a")).toEqual(["tag-series"]);
    expect(h.view.result.current.findEvent("gone")).toBeUndefined();
    expect(h.view.result.current.eventPool.tagsOf("gone")).toEqual([]);
  });

  it("tells loading, none and could-not-read apart", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const none = setup(async () => []);
    const loading = none.view.result.current.eventPool.labels.empty;
    act(() => none.view.result.current.eventPool.onOpen());
    await waitFor(() =>
      expect(none.view.result.current.eventPool.labels.empty).not.toBe(loading),
    );
    const empty = none.view.result.current.eventPool.labels.empty;

    const broken = setup(() => Promise.reject(new Error("no")));
    act(() => broken.view.result.current.eventPool.onOpen());
    await waitFor(() =>
      expect(broken.view.result.current.eventPool.labels.empty).not.toBe(
        loading,
      ),
    );
    const failed = broken.view.result.current.eventPool.labels.empty;
    expect(failed).not.toBe(empty);
    expect(broken.view.result.current.eventPool.options).toEqual([]);
    quiet.mockRestore();
  });
});
