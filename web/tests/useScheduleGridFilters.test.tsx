import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type {
  CalendarNode,
  ScheduleItem,
  TodoCalendarChip,
  WikiTagAssignmentUnified,
  WikiTagUnified,
} from "@life-editor/shared";
import { useScheduleGridFilters } from "../src/schedule/useScheduleGridFilters";
import type { UseScheduleGridFiltersArgs } from "../src/schedule/useScheduleGridFilters";

/*
 * #889 — the calendar's two filters and everything drawn from them, pulled out
 * of CalendarTab.
 *
 * Four rules live here, and not one of them is visible in the markup:
 *
 *   1. The lens runs AFTER the repeat filter, and the order decides the
 *      COUNTS. Run it over the unfiltered list and a row the repeat filter
 *      already took away is counted twice, so "N hidden" overshoots.
 *   2. `isWide` gates the membership SET, not each consumer. The chip row that
 *      turns the lens off is Desktop-only, so a window narrowed with a
 *      calendar picked would otherwise leave the grid filtered with nothing on
 *      screen able to clear it.
 *   3. Turning the repeat filter ON drops a repeat-generated selection (#466).
 *   4. Picking a calendar the selection is not in drops it too (#468) — but
 *      CLEARING the lens keeps it, because clearing hides nothing.
 *
 * Rules 3 and 4 used to be two nearly-identical callbacks sitting 200 lines
 * from the filters they guard, which is how one gets updated without the
 * other. None of this was reachable from a test before: CalendarTab needs the
 * whole Provider stack plus real layout, and jsdom has neither.
 */

const STAMP = "2026-08-16T00:00:00.000Z";

function item(id: string, overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id,
    date: "2026-08-16",
    title: id,
    startTime: "10:00",
    endTime: "11:00",
    completed: false,
    completedAt: null,
    routineId: null,
    templateId: null,
    memo: null,
    noteId: null,
    content: null,
    createdAt: STAMP,
    updatedAt: STAMP,
    ...overrides,
  };
}

function chip(
  id: string,
  overrides: Partial<TodoCalendarChip> = {},
): TodoCalendarChip {
  return {
    id,
    date: "2026-08-16",
    title: id,
    startTime: "13:00",
    endTime: "14:00",
    isAllDay: false,
    completed: false,
    ...overrides,
  };
}

const tag = (id: string): WikiTagUnified => ({
  id,
  name: id,
  color: null,
  icon: null,
  createdAt: STAMP,
  updatedAt: STAMP,
  version: 1,
  isDeleted: false,
  deletedAt: null,
});

const calendar = (id: string, tagId: string): CalendarNode => ({
  id,
  title: id,
  tagId,
  order: 0,
  createdAt: STAMP,
  updatedAt: STAMP,
});

const assign = (itemId: string, tagId: string): WikiTagAssignmentUnified => ({
  id: `${tagId}:${itemId}`,
  itemId,
  tagId,
  updatedAt: STAMP,
  isDeleted: false,
  deletedAt: null,
});

function setup(overrides: Partial<UseScheduleGridFiltersArgs> = {}) {
  const setSelectedId = vi.fn((id: string | null) => void id);
  const setPopover = vi.fn((p: null) => void p);
  const args: UseScheduleGridFiltersArgs = {
    rangeItems: [],
    rangeTodoChips: [],
    calendars: [],
    allTags: [],
    allAssignments: [],
    isWide: true,
    now: new Date("2026-08-16T09:00:00"),
    anchorDate: "2026-08-16",
    selected: null,
    setSelectedId,
    setPopover,
    ...overrides,
  };
  const hook = renderHook(
    (a: UseScheduleGridFiltersArgs) => useScheduleGridFilters(a),
    { initialProps: args },
  );
  return { hook, args, setSelectedId, setPopover };
}

describe("useScheduleGridFilters — rule 1: the counts do not double-count", () => {
  /*
   * One row that BOTH filters would hide: it is repeat-generated AND carries
   * no calendar tag. Run the lens over the unfiltered list and it is counted
   * once by each, so the two "N hidden" lines together claim more rows than
   * the grid is actually missing.
   */
  it("does not count a row the repeat filter already took away", () => {
    const rangeItems = [
      item("manual-tagged"),
      item("from-repeat", { routineId: "routine-1" }),
    ];
    const { hook } = setup({
      rangeItems,
      calendars: [calendar("cal-1", "tag-1")],
      allTags: [tag("tag-1")],
      allAssignments: [assign("manual-tagged", "tag-1")],
    });

    // Both filters on: the repeat row is gone via the repeat filter, and the
    // lens must not report it a second time.
    act(() => hook.result.current.handleToggleRepeats());
    act(() => hook.result.current.handleSelectCalendar("cal-1"));

    expect(hook.result.current.hiddenRepeats).toBe(1);
    expect(hook.result.current.hiddenByCalendar).toBe(0);
    // And the one row both filters left alone is what the grid draws.
    expect(hook.result.current.monthItems.map((i) => i.id)).toEqual([
      "manual-tagged",
    ]);
  });

  it("counts a lens-only exclusion normally", () => {
    const { hook } = setup({
      rangeItems: [item("tagged"), item("untagged")],
      calendars: [calendar("cal-1", "tag-1")],
      allTags: [tag("tag-1")],
      allAssignments: [assign("tagged", "tag-1")],
    });
    act(() => hook.result.current.handleSelectCalendar("cal-1"));
    expect(hook.result.current.hiddenByCalendar).toBe(1);
    expect(hook.result.current.hiddenRepeats).toBe(0);
  });

  // The chip count comes out of the same call the grid uses, so a chip can
  // never promise a number the grid then contradicts — todo chips included.
  it("counts todo chips in the chip row, like the grid does", () => {
    const { hook } = setup({
      rangeItems: [item("tagged-event")],
      rangeTodoChips: [chip("task-1"), chip("task-2")],
      calendars: [calendar("cal-1", "tag-1")],
      allTags: [tag("tag-1")],
      allAssignments: [
        assign("tagged-event", "tag-1"),
        assign("task-1", "tag-1"),
      ],
    });
    expect(hook.result.current.calendarChips).toEqual([
      { id: "cal-1", label: "cal-1", count: 2 },
    ]);
  });
});

describe("useScheduleGridFilters — rule 2: narrow un-narrows everything", () => {
  /*
   * The chip row that turns the lens off renders on Desktop only. A window
   * narrowed below 768px with a calendar picked would otherwise leave the grid
   * filtered with no way on screen to clear it.
   */
  it("ignores a picked calendar on narrow", () => {
    const shared = {
      rangeItems: [item("tagged"), item("untagged")],
      rangeTodoChips: [chip("task-1")],
      calendars: [calendar("cal-1", "tag-1")],
      allTags: [tag("tag-1")],
      allAssignments: [assign("tagged", "tag-1")],
    };
    const wide = setup({ ...shared, isWide: true });
    act(() => wide.hook.result.current.handleSelectCalendar("cal-1"));
    expect(wide.hook.result.current.hiddenByCalendar).toBe(2);

    const narrow = setup({ ...shared, isWide: false });
    act(() => narrow.hook.result.current.handleSelectCalendar("cal-1"));
    // Every layer un-narrows together, chips included.
    expect(narrow.hook.result.current.hiddenByCalendar).toBe(0);
    expect(narrow.hook.result.current.monthItems).toHaveLength(3);
  });

  /*
   * Resolving through the SELECTABLE list is what makes a tag deleted
   * mid-session degrade to "no filter" rather than an empty grid with no lit
   * chip to turn off.
   */
  it("degrades to no filter when the calendar's tag is gone", () => {
    const { hook } = setup({
      rangeItems: [item("a"), item("b")],
      calendars: [calendar("cal-1", "tag-gone")],
      allTags: [],
      allAssignments: [],
    });
    act(() => hook.result.current.handleSelectCalendar("cal-1"));
    expect(hook.result.current.activeCalendar).toBeNull();
    expect(hook.result.current.hiddenByCalendar).toBe(0);
    expect(hook.result.current.calendarChips).toEqual([]);
  });
});

describe("useScheduleGridFilters — rules 3 and 4: the selection guards", () => {
  it("drops a repeat-generated selection when the repeat filter goes on (#466)", () => {
    const occurrence = item("occ", { routineId: "routine-1" });
    const { hook, setSelectedId, setPopover } = setup({
      rangeItems: [occurrence],
      selected: occurrence,
    });
    act(() => hook.result.current.handleToggleRepeats());
    expect(setSelectedId).toHaveBeenCalledWith(null);
    expect(setPopover).toHaveBeenCalledWith(null);
  });

  it("keeps a manual selection — the filter was never hiding it", () => {
    const manual = item("manual");
    const { hook, setSelectedId } = setup({
      rangeItems: [manual],
      selected: manual,
    });
    act(() => hook.result.current.handleToggleRepeats());
    expect(setSelectedId).not.toHaveBeenCalled();
  });

  it("keeps the selection when the filter goes back OFF", () => {
    const occurrence = item("occ", { routineId: "routine-1" });
    const { hook, setSelectedId } = setup({
      rangeItems: [occurrence],
      selected: occurrence,
    });
    act(() => hook.result.current.handleToggleRepeats());
    setSelectedId.mockClear();
    act(() => hook.result.current.handleToggleRepeats());
    expect(setSelectedId).not.toHaveBeenCalled();
  });

  it("drops a selection the picked calendar excludes (#468)", () => {
    const outsider = item("outsider");
    const { hook, setSelectedId, setPopover } = setup({
      rangeItems: [item("tagged"), outsider],
      selected: outsider,
      calendars: [calendar("cal-1", "tag-1")],
      allTags: [tag("tag-1")],
      allAssignments: [assign("tagged", "tag-1")],
    });
    act(() => hook.result.current.handleSelectCalendar("cal-1"));
    expect(setSelectedId).toHaveBeenCalledWith(null);
    expect(setPopover).toHaveBeenCalledWith(null);
  });

  /*
   * Routine inheritance: an occurrence stays selected when its SERIES carries
   * the tag. Tags hang off the routine, not off the generated rows (#468) —
   * testing only the row's own id would drop every occurrence on every pick.
   */
  it("keeps an occurrence whose SERIES carries the tag", () => {
    const occurrence = item("occ", { routineId: "routine-1" });
    const { hook, setSelectedId } = setup({
      rangeItems: [occurrence],
      selected: occurrence,
      calendars: [calendar("cal-1", "tag-1")],
      allTags: [tag("tag-1")],
      allAssignments: [assign("routine-1", "tag-1")],
    });
    act(() => hook.result.current.handleSelectCalendar("cal-1"));
    expect(setSelectedId).not.toHaveBeenCalled();
  });

  /*
   * TWO guards enforce this, not one: the explicit `id == null` early return,
   * and the `!cal` lookup that follows (no calendar has a null id, so a clear
   * never resolves one). Removing the first changes no behaviour — it is
   * belt-and-braces, and this case pins the OUTCOME rather than either guard.
   */
  it("keeps the selection when the lens is CLEARED — clearing hides nothing", () => {
    const outsider = item("outsider");
    const { hook, setSelectedId } = setup({
      rangeItems: [outsider],
      selected: outsider,
      calendars: [calendar("cal-1", "tag-1")],
      allTags: [tag("tag-1")],
      allAssignments: [],
    });
    act(() => hook.result.current.handleSelectCalendar("cal-1"));
    setSelectedId.mockClear();
    act(() => hook.result.current.handleSelectCalendar(null));
    expect(setSelectedId).not.toHaveBeenCalled();
  });
});

describe("useScheduleGridFilters — the two ways filters get cleared", () => {
  /*
   * #520: being TAKEN to a row drops BOTH filters. Either one alone reproduces
   * the whole bug — the day changes with nothing on it.
   */
  it("revealOnGrid drops both", () => {
    const { hook } = setup({
      rangeItems: [item("manual"), item("occ", { routineId: "r" })],
      calendars: [calendar("cal-1", "tag-1")],
      allTags: [tag("tag-1")],
      allAssignments: [],
    });
    act(() => {
      hook.result.current.handleToggleRepeats();
      hook.result.current.handleSelectCalendar("cal-1");
    });
    act(() => hook.result.current.revealOnGrid());
    expect(hook.result.current.repeatsHidden).toBe(false);
    expect(hook.result.current.activeCalendar).toBeNull();
    expect(hook.result.current.hiddenRepeats).toBe(0);
  });

  /*
   * #506: creation clears the LENS only. A new manual event is not
   * repeat-generated, so that filter was never hiding it — and dropping it too
   * would undo a setting the user did not ask about.
   */
  it("clearCalendarLens leaves the repeat filter alone", () => {
    const { hook } = setup({
      rangeItems: [item("occ", { routineId: "r" })],
      calendars: [calendar("cal-1", "tag-1")],
      allTags: [tag("tag-1")],
      allAssignments: [],
    });
    act(() => {
      hook.result.current.handleToggleRepeats();
      hook.result.current.handleSelectCalendar("cal-1");
    });
    act(() => hook.result.current.clearCalendarLens());
    expect(hook.result.current.activeCalendar).toBeNull();
    expect(hook.result.current.repeatsHidden).toBe(true);
  });
});

describe("useScheduleGridFilters — what each surface draws", () => {
  it("gives the Mobile list only the anchor day, filtered like the grid", () => {
    const { hook } = setup({
      rangeItems: [
        item("today"),
        item("tomorrow", { date: "2026-08-17" }),
        item("today-repeat", { routineId: "r" }),
      ],
      anchorDate: "2026-08-16",
    });
    expect(hook.result.current.anchorDayItems.map((i) => i.id)).toEqual([
      "today",
      "today-repeat",
    ]);

    act(() => hook.result.current.handleToggleRepeats());
    expect(hook.result.current.anchorDayItems.map((i) => i.id)).toEqual([
      "today",
    ]);
  });

  it("merges events and todo chips into both grids", () => {
    const { hook } = setup({
      rangeItems: [item("event-1")],
      rangeTodoChips: [chip("task-1")],
    });
    expect(hook.result.current.gridItems).toHaveLength(2);
    expect(hook.result.current.monthItems).toHaveLength(2);
  });
});
