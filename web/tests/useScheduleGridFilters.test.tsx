import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type {
  ScheduleItem,
  TagGroupNode,
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
 *   2. `isWide` gates the membership SET, not each consumer. The controls that
 *      turn the lens off are Desktop-only, so a window narrowed with tags
 *      picked would otherwise leave the grid filtered with nothing on screen
 *      able to clear it.
 *   3. Turning the repeat filter ON drops a repeat-generated selection (#466).
 *   4. Narrowing the tag set past the selection drops it too (#468) — but
 *      CLEARING the lens keeps it, because clearing hides nothing.
 *   5. The lit chip is DERIVED from the tag set, never stored beside it
 *      (#1173), so the two cannot disagree after an untick.
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
  isDeleted: false,
  deletedAt: null,
});

const group = (id: string, ...tagIds: string[]): TagGroupNode => ({
  id,
  name: id,
  tagIds,
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
    tagGroups: [],
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
   * none of the lens's tags. Run the lens over the unfiltered list and it is
   * counted
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
      tagGroups: [group("group-1", "tag-1")],
      allTags: [tag("tag-1")],
      allAssignments: [assign("manual-tagged", "tag-1")],
    });

    // Both filters on: the repeat row is gone via the repeat filter, and the
    // lens must not report it a second time.
    act(() => hook.result.current.handleToggleRepeats());
    act(() => hook.result.current.handleSelectGroup("group-1"));

    expect(hook.result.current.hiddenRepeats).toBe(1);
    expect(hook.result.current.hiddenByTags).toBe(0);
    // And the one row both filters left alone is what the grid draws.
    expect(hook.result.current.monthItems.map((i) => i.id)).toEqual([
      "manual-tagged",
    ]);
  });

  it("counts a lens-only exclusion normally", () => {
    const { hook } = setup({
      rangeItems: [item("tagged"), item("untagged")],
      tagGroups: [group("group-1", "tag-1")],
      allTags: [tag("tag-1")],
      allAssignments: [assign("tagged", "tag-1")],
    });
    act(() => hook.result.current.handleSelectGroup("group-1"));
    expect(hook.result.current.hiddenByTags).toBe(1);
    expect(hook.result.current.hiddenRepeats).toBe(0);
  });

  // The chip count comes out of the same call the grid uses, so a chip can
  // never promise a number the grid then contradicts — todo chips included.
  it("counts todo chips in the chip row, like the grid does", () => {
    const { hook } = setup({
      rangeItems: [item("tagged-event")],
      rangeTodoChips: [chip("task-1"), chip("task-2")],
      tagGroups: [group("group-1", "tag-1")],
      allTags: [tag("tag-1")],
      allAssignments: [
        assign("tagged-event", "tag-1"),
        assign("task-1", "tag-1"),
      ],
    });
    expect(hook.result.current.groupChips).toEqual([
      { id: "group-1", label: "group-1", count: 2 },
    ]);
  });
});

describe("useScheduleGridFilters — rule 2: narrow un-narrows everything", () => {
  /*
   * The chip row that turns the lens off renders on Desktop only. A window
   * narrowed below 768px with a group picked would otherwise leave the grid
   * filtered with no way on screen to clear it.
   */
  it("ignores a picked group on narrow", () => {
    const shared = {
      rangeItems: [item("tagged"), item("untagged")],
      rangeTodoChips: [chip("task-1")],
      tagGroups: [group("group-1", "tag-1")],
      allTags: [tag("tag-1")],
      allAssignments: [assign("tagged", "tag-1")],
    };
    const wide = setup({ ...shared, isWide: true });
    act(() => wide.hook.result.current.handleSelectGroup("group-1"));
    expect(wide.hook.result.current.hiddenByTags).toBe(2);

    const narrow = setup({ ...shared, isWide: false });
    act(() => narrow.hook.result.current.handleSelectGroup("group-1"));
    // Every layer un-narrows together, chips included.
    expect(narrow.hook.result.current.hiddenByTags).toBe(0);
    expect(narrow.hook.result.current.monthItems).toHaveLength(3);
  });

  /*
   * Resolving through the ACTIVE tag list is what makes a tag deleted
   * mid-session degrade to "no filter" rather than an empty grid with no lit
   * chip to turn off. A group left with no live tag is not offered at all.
   */
  it("degrades to no filter when the group's tags are gone", () => {
    const { hook } = setup({
      rangeItems: [item("a"), item("b")],
      tagGroups: [group("group-1", "tag-gone")],
      allTags: [],
      allAssignments: [],
    });
    act(() => hook.result.current.handleSelectGroup("group-1"));
    expect(hook.result.current.activeGroupId).toBeNull();
    expect(hook.result.current.hiddenByTags).toBe(0);
    expect(hook.result.current.groupChips).toEqual([]);
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

  it("drops a selection the picked group excludes (#468)", () => {
    const outsider = item("outsider");
    const { hook, setSelectedId, setPopover } = setup({
      rangeItems: [item("tagged"), outsider],
      selected: outsider,
      tagGroups: [group("group-1", "tag-1")],
      allTags: [tag("tag-1")],
      allAssignments: [assign("tagged", "tag-1")],
    });
    act(() => hook.result.current.handleSelectGroup("group-1"));
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
      tagGroups: [group("group-1", "tag-1")],
      allTags: [tag("tag-1")],
      allAssignments: [assign("routine-1", "tag-1")],
    });
    act(() => hook.result.current.handleSelectGroup("group-1"));
    expect(setSelectedId).not.toHaveBeenCalled();
  });

  /*
   * The guard is `next.length === 0`, shared by every route that changes the
   * tag set: a chip cleared, the last checkbox unticked, "show all". An empty
   * lens hides nothing, so there is no selection to protect from it. This case
   * pins the OUTCOME rather than the guard.
   */
  it("keeps the selection when the lens is CLEARED — clearing hides nothing", () => {
    const outsider = item("outsider");
    const { hook, setSelectedId } = setup({
      rangeItems: [outsider],
      selected: outsider,
      tagGroups: [group("group-1", "tag-1")],
      allTags: [tag("tag-1")],
      allAssignments: [],
    });
    act(() => hook.result.current.handleSelectGroup("group-1"));
    setSelectedId.mockClear();
    act(() => hook.result.current.handleSelectGroup(null));
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
      tagGroups: [group("group-1", "tag-1")],
      allTags: [tag("tag-1")],
      allAssignments: [],
    });
    act(() => {
      hook.result.current.handleToggleRepeats();
      hook.result.current.handleSelectGroup("group-1");
    });
    act(() => hook.result.current.revealOnGrid());
    expect(hook.result.current.repeatsHidden).toBe(false);
    expect(hook.result.current.activeGroupId).toBeNull();
    expect(hook.result.current.hiddenRepeats).toBe(0);
  });

  /*
   * #506: creation clears the LENS only. A new manual event is not
   * repeat-generated, so that filter was never hiding it — and dropping it too
   * would undo a setting the user did not ask about.
   */
  it("clearTagLens leaves the repeat filter alone", () => {
    const { hook } = setup({
      rangeItems: [item("occ", { routineId: "r" })],
      tagGroups: [group("group-1", "tag-1")],
      allTags: [tag("tag-1")],
      allAssignments: [],
    });
    act(() => {
      hook.result.current.handleToggleRepeats();
      hook.result.current.handleSelectGroup("group-1");
    });
    act(() => hook.result.current.clearTagLens());
    expect(hook.result.current.activeGroupId).toBeNull();
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

describe("useScheduleGridFilters — rule 5: the many-tag lens (#1173)", () => {
  /*
   * The union is the whole reason the one-tag calendar became a many-tag
   * group. Ticking a second tag ADDS its rows; an intersection would make the
   * obvious act — "also show me home" — empty the grid, since almost nothing
   * carries two life tags at once.
   */
  it("unions the ticked tags rather than intersecting them", () => {
    const { hook } = setup({
      rangeItems: [item("work-row"), item("home-row"), item("untagged")],
      allTags: [tag("tag-work"), tag("tag-home")],
      allAssignments: [
        assign("work-row", "tag-work"),
        assign("home-row", "tag-home"),
      ],
    });

    act(() => hook.result.current.handleToggleTag("tag-work"));
    expect(hook.result.current.monthItems.map((i) => i.id)).toEqual([
      "work-row",
    ]);

    act(() => hook.result.current.handleToggleTag("tag-home"));
    expect(hook.result.current.monthItems.map((i) => i.id)).toEqual([
      "work-row",
      "home-row",
    ]);
    // Only the untagged row is missing, and the count says so.
    expect(hook.result.current.hiddenByTags).toBe(1);
  });

  it("unticking the last tag turns the lens off entirely", () => {
    const { hook } = setup({
      rangeItems: [item("work-row"), item("untagged")],
      allTags: [tag("tag-work")],
      allAssignments: [assign("work-row", "tag-work")],
    });
    act(() => hook.result.current.handleToggleTag("tag-work"));
    expect(hook.result.current.hiddenByTags).toBe(1);
    act(() => hook.result.current.handleToggleTag("tag-work"));
    // Not "a lens that owns nothing" — no lens at all.
    expect(hook.result.current.hiddenByTags).toBe(0);
    expect(hook.result.current.monthItems).toHaveLength(2);
    expect(hook.result.current.selectedTagIds).toEqual([]);
  });

  /*
   * Rule 5: `activeGroupId` is derived from the tick list, so reaching a
   * group's exact tag set BY HAND lights its chip, and unticking one tag of an
   * applied group puts it out again. Storing the id beside the ticks would let
   * the chip stay lit over a set that is no longer that group.
   */
  it("derives the lit chip from the ticks, in both directions", () => {
    const { hook } = setup({
      rangeItems: [item("work-row")],
      tagGroups: [group("group-1", "tag-work", "tag-home")],
      allTags: [tag("tag-work"), tag("tag-home")],
      allAssignments: [assign("work-row", "tag-work")],
    });

    // Reached by hand, in the other order: still this group.
    act(() => hook.result.current.handleToggleTag("tag-home"));
    act(() => hook.result.current.handleToggleTag("tag-work"));
    expect(hook.result.current.activeGroupId).toBe("group-1");

    // One tag off: no longer this group, but the grid stays narrowed.
    act(() => hook.result.current.handleToggleTag("tag-home"));
    expect(hook.result.current.activeGroupId).toBeNull();
    expect(hook.result.current.selectedTagIds).toEqual(["tag-work"]);
  });

  it("applying a group copies its tags into the tick list", () => {
    const { hook } = setup({
      rangeItems: [item("work-row")],
      tagGroups: [group("group-1", "tag-work", "tag-home")],
      allTags: [tag("tag-work"), tag("tag-home")],
      allAssignments: [assign("work-row", "tag-work")],
    });
    act(() => hook.result.current.handleSelectGroup("group-1"));
    expect(hook.result.current.selectedTagIds).toEqual([
      "tag-work",
      "tag-home",
    ]);
    expect(hook.result.current.activeGroupId).toBe("group-1");
  });

  /*
   * A group holding a soft-deleted tag keeps its chip and stays applicable —
   * the dead id simply drops out of the union. Treating the group as broken
   * instead would take away a working filter over a tag the user still has.
   */
  it("drops only the dead tag from a partly-deleted group", () => {
    const { hook } = setup({
      rangeItems: [item("work-row"), item("untagged")],
      tagGroups: [group("group-1", "tag-work", "tag-gone")],
      allTags: [tag("tag-work")],
      allAssignments: [assign("work-row", "tag-work")],
    });
    act(() => hook.result.current.handleSelectGroup("group-1"));
    expect(hook.result.current.selectedTagIds).toEqual(["tag-work"]);
    expect(hook.result.current.activeGroupId).toBe("group-1");
    expect(hook.result.current.groupChips).toEqual([
      { id: "group-1", label: "group-1", count: 1 },
    ]);
  });

  /*
   * The number next to a tag in the panel is what ticking it ALONE would
   * leave — the only reading that survives the union, where ticking a second
   * tag can only ever add rows.
   */
  it("counts each tag as if it were the only one ticked", () => {
    const { hook } = setup({
      rangeItems: [item("work-row"), item("home-row"), item("untagged")],
      rangeTodoChips: [chip("task-1")],
      allTags: [tag("tag-work"), tag("tag-home")],
      allAssignments: [
        assign("work-row", "tag-work"),
        assign("task-1", "tag-work"),
        assign("home-row", "tag-home"),
      ],
    });
    act(() => hook.result.current.handleToggleTag("tag-work"));
    // Unchanged by what is ticked: the count answers "what would this tag
    // show", not "what does the current lens show".
    expect(hook.result.current.tagCounts.get("tag-work")).toBe(2);
    expect(hook.result.current.tagCounts.get("tag-home")).toBe(1);
  });
});
