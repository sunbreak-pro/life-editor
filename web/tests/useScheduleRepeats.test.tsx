import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { RoutineNode, ScheduleItem } from "@life-editor/shared";
import { useScheduleRepeats } from "../src/schedule/useScheduleRepeats";
import type { UseScheduleRepeatsArgs } from "../src/schedule/useScheduleRepeats";

/*
 * #889 — the Calendar host's repeat half, pulled out of CalendarTab.
 *
 * CalendarTab needs the whole Provider stack plus real layout to render, and
 * jsdom has neither, so nothing in this file was reachable from a test before.
 * What that hid is two rules about work that must NOT happen, plus one about
 * ORDER — none of which show up in the markup:
 *
 *   - the #408 list skips its scan unless its own tab is showing. A routine
 *     that fires on no day (#407's zombies) walks a full year before
 *     answering, so dropping the guard makes every routine write pay for a
 *     panel nobody has open.
 *   - opening a row MATERIALISES the destination day before navigating.
 *     Nothing on the nav path generates occurrences, so without it a jump onto
 *     a future-dated repeat lands on an empty day with nothing to open — the
 *     exact unreachability #408 exists to fix.
 *   - it clears the filters FIRST (#520). The destination is by definition
 *     repeat-generated, so with #466 on it is folded away the moment it is
 *     fetched.
 *
 * `useTranslation` is stubbed to echo its key.
 */

vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@life-editor/shared")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

const NOW = new Date("2026-08-16T09:00:00");

function routine(
  id: string,
  overrides: Partial<RoutineNode> = {},
): RoutineNode {
  return {
    id,
    title: id,
    startTime: "08:00",
    endTime: "09:00",
    isArchived: false,
    isVisible: true,
    isDeleted: false,
    deletedAt: null,
    order: 0,
    frequencyType: "daily",
    frequencyDays: [],
    frequencyInterval: null,
    frequencyStartDate: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function item(id: string, overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id,
    date: "2026-08-16",
    title: id,
    startTime: "08:00",
    endTime: "09:00",
    completed: false,
    completedAt: null,
    routineId: null,
    templateId: null,
    memo: null,
    noteId: null,
    content: null,
    createdAt: "2026-08-16T00:00:00.000Z",
    updatedAt: "2026-08-16T00:00:00.000Z",
    ...overrides,
  };
}

function setup(
  overrides: Partial<UseScheduleRepeatsArgs> & { isWide?: boolean } = {},
) {
  const setAnchorDate = vi.fn((key: string) => void key);
  const revealOnGrid = vi.fn();
  const closeSidebar = vi.fn();
  const ensureRoutineItemsForDateRange = vi.fn(
    (from: string, to: string, rs: RoutineNode[]) =>
      Promise.resolve<unknown>([from, to, rs]),
  );
  const deleteRoutine = vi.fn(
    (id: string, options: { onCascadeChanged: () => void }) =>
      Promise.resolve({ landed: Boolean(id) && Boolean(options) }),
  );
  const reload = vi.fn();
  const showToast = vi.fn();
  const args: UseScheduleRepeatsArgs = {
    routines: [routine("routine-1")],
    selected: null,
    todayItems: [],
    sidebarTab: "repeats",
    now: NOW,
    copy: {
      freq: {
        daily: "毎日",
        weekdaysFallback: "毎週",
        intervalEvery: "",
        intervalDays: "日ごと",
      },
      weekdayLabels: ["日", "月", "火", "水", "木", "金", "土"],
      formatFullDay: (key: string) => `full:${key}`,
    },
    nav: {
      setAnchorDate,
      revealOnGrid,
      isWide: overrides.isWide ?? true,
      closeSidebar,
    },
    writes: {
      ensureRoutineItemsForDateRange,
      deleteRoutine,
      reload,
      showToast,
    },
    ...overrides,
  };
  const hook = renderHook(
    (a: UseScheduleRepeatsArgs) => useScheduleRepeats(a),
    {
      initialProps: args,
    },
  );
  return {
    hook,
    args,
    setAnchorDate,
    revealOnGrid,
    closeSidebar,
    ensureRoutineItemsForDateRange,
    deleteRoutine,
    reload,
    showToast,
  };
}

describe("useScheduleRepeats — the #408 list", () => {
  /*
   * The guard that matters. Without it every routine write walks a full year
   * per zombie routine for a panel that is not on screen.
   */
  it("does not scan while another tab is showing", () => {
    const { hook } = setup({ sidebarTab: "flow" });
    expect(hook.result.current.repeatRows).toEqual([]);
  });

  it("scans once its own tab is showing", () => {
    const { hook } = setup({ sidebarTab: "repeats" });
    expect(hook.result.current.repeatRows).toHaveLength(1);
    expect(hook.result.current.repeatRows[0].id).toBe("routine-1");
  });

  /*
   * Deliberately UNFILTERED, unlike the summary below: the panel's whole point
   * is listing the routines the calendar cannot show.
   */
  it("lists archived and hidden routines too", () => {
    const { hook } = setup({
      routines: [
        routine("visible"),
        routine("archived", { isArchived: true }),
        routine("hidden", { isVisible: false }),
      ],
    });
    expect(hook.result.current.repeatRows.map((r) => r.id)).toEqual([
      "visible",
      "archived",
      "hidden",
    ]);
  });

  it("orders by `order`, the way the retired Routines tab did", () => {
    const { hook } = setup({
      routines: [
        routine("third", { order: 3 }),
        routine("first", { order: 1 }),
        routine("second", { order: 2 }),
      ],
    });
    expect(hook.result.current.repeatRows.map((r) => r.id)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });

  it("names an untitled routine rather than showing a blank row", () => {
    const { hook } = setup({ routines: [routine("r", { title: "" })] });
    expect(hook.result.current.repeatRows[0].title).toBe(
      "scheduleScreen.untitled",
    );
  });
});

describe("useScheduleRepeats — the routine summary", () => {
  // The opposite rule to the list above: this one backs a completion count, so
  // an archived routine in it would ask the user to finish something retired.
  it("drops archived and hidden routines", () => {
    const { hook } = setup({
      routines: [
        routine("visible"),
        routine("archived", { isArchived: true }),
        routine("hidden", { isVisible: false }),
      ],
    });
    expect(hook.result.current.summaryRows.map((r) => r.id)).toEqual([
      "visible",
    ]);
  });

  it("counts only today's routine-generated items", () => {
    const { hook } = setup({
      todayItems: [
        item("manual"),
        item("from-routine-done", { routineId: "r", completed: true }),
        item("from-routine-open", { routineId: "r" }),
      ],
    });
    expect(hook.result.current.routineTotal).toBe(2);
    expect(hook.result.current.routineDone).toBe(1);
  });
});

describe("useScheduleRepeats — the selected occurrence's frequency", () => {
  it("is null for a manual event", () => {
    const { hook } = setup({ selected: item("manual") });
    expect(hook.result.current.repeatValue).toBeNull();
  });

  it("reads the source routine of a generated occurrence", () => {
    const { hook } = setup({
      routines: [
        routine("routine-1", {
          frequencyType: "weekdays",
          frequencyDays: [1, 3],
        }),
      ],
      selected: item("occurrence", { routineId: "routine-1" }),
    });
    expect(hook.result.current.repeatValue).toEqual({
      frequencyType: "weekdays",
      frequencyDays: [1, 3],
      frequencyInterval: null,
      frequencyStartDate: null,
    });
  });
});

describe("useScheduleRepeats — opening a row (#408 / #520 / #467)", () => {
  it("clears the filters BEFORE it navigates", async () => {
    const { hook, revealOnGrid, setAnchorDate } = setup();
    act(() => hook.result.current.handleOpenRepeat("routine-1"));
    await waitFor(() => expect(setAnchorDate).toHaveBeenCalled());
    expect(revealOnGrid.mock.invocationCallOrder[0]).toBeLessThan(
      setAnchorDate.mock.invocationCallOrder[0],
    );
  });

  /*
   * Nothing on the nav path generates occurrences, so the destination day has
   * to be materialised or the jump lands on an empty day.
   */
  it("materialises the destination day, then reloads", async () => {
    const { hook, ensureRoutineItemsForDateRange, reload, setAnchorDate } =
      setup();
    act(() => hook.result.current.handleOpenRepeat("routine-1"));
    await waitFor(() => expect(reload).toHaveBeenCalled());
    const day = setAnchorDate.mock.calls[0][0];
    expect(ensureRoutineItemsForDateRange).toHaveBeenCalledWith(day, day, [
      expect.objectContaining({ id: "routine-1" }),
    ]);
    expect(
      ensureRoutineItemsForDateRange.mock.invocationCallOrder[0],
    ).toBeLessThan(reload.mock.invocationCallOrder[0]);
  });

  // The reload has to run even when the materialise throws — otherwise a
  // transient failure leaves the view on whatever it happened to be showing.
  it("still reloads when materialising fails", async () => {
    const { hook, ensureRoutineItemsForDateRange, reload } = setup();
    ensureRoutineItemsForDateRange.mockRejectedValue(new Error("nope"));
    act(() => hook.result.current.handleOpenRepeat("routine-1"));
    await waitFor(() => expect(reload).toHaveBeenCalled());
  });

  it("does nothing for a routine that fires on no day (#407)", async () => {
    const { hook, setAnchorDate, ensureRoutineItemsForDateRange } = setup({
      routines: [
        routine("zombie", { frequencyType: "weekdays", frequencyDays: [] }),
      ],
    });
    act(() => hook.result.current.handleOpenRepeat("zombie"));
    expect(setAnchorDate).not.toHaveBeenCalled();
    expect(ensureRoutineItemsForDateRange).not.toHaveBeenCalled();
  });

  it("does nothing for an id the list no longer holds", () => {
    const { hook, setAnchorDate } = setup();
    act(() => hook.result.current.handleOpenRepeat("gone"));
    expect(setAnchorDate).not.toHaveBeenCalled();
  });

  /*
   * #467: on narrow the list lives in the drawer that COVERS the calendar, so
   * a jump with it left open lands on a day the user cannot see. On Desktop the
   * panel sits beside the grid and closing it would collapse something the user
   * deliberately opened.
   */
  it.each([
    ["Mobile", false, 1],
    ["Desktop", true, 0],
  ])("closes the drawer on %s", async (_layout, isWide, times) => {
    const { hook, closeSidebar, setAnchorDate } = setup({ isWide });
    act(() => hook.result.current.handleOpenRepeat("routine-1"));
    await waitFor(() => expect(setAnchorDate).toHaveBeenCalled());
    expect(closeSidebar).toHaveBeenCalledTimes(times);
  });
});

describe("useScheduleRepeats — deleting a row", () => {
  it("re-reads the visible range and says nothing when it lands", async () => {
    const { hook, deleteRoutine, reload, showToast } = setup();
    act(() => hook.result.current.handleDeleteRepeat("routine-1"));
    await waitFor(() => expect(reload).toHaveBeenCalled());
    expect(deleteRoutine.mock.calls[0][0]).toBe("routine-1");
    expect(showToast).not.toHaveBeenCalled();
  });

  /*
   * deleteRoutine drops the row optimistically and swallows the service error.
   * Silence would leave the list short one row while every occurrence stays on
   * the grid, with no way to tell which is true.
   */
  it("says so when the write did not land", async () => {
    const { hook, deleteRoutine, showToast } = setup();
    deleteRoutine.mockResolvedValue({ landed: false });
    act(() => hook.result.current.handleDeleteRepeat("routine-1"));
    await waitFor(() => expect(showToast).toHaveBeenCalled());
    expect(showToast).toHaveBeenCalledWith(
      "danger",
      "scheduleScreen.repeatDeleteFailed",
    );
  });

  // #708: an undo restores the occurrences and the seed event straight through
  // the DataService, so the visible range has to be re-read there too.
  it("passes a cascade hook that re-reads the range", async () => {
    const { hook, deleteRoutine, reload } = setup();
    act(() => hook.result.current.handleDeleteRepeat("routine-1"));
    await waitFor(() => expect(deleteRoutine).toHaveBeenCalled());
    reload.mockClear();
    deleteRoutine.mock.calls[0][1].onCascadeChanged();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
