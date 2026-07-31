import { describe, it, expect } from "vitest";
import {
  applyRepeatFilter,
  applyCalendarFilter,
  applyCalendarLens,
  buildCalendarMemberIds,
  pickSelectableCalendars,
} from "../src/utils/scheduleGridFilter";

/*
 * #466 Step 5-b: the grid's repeat filter. web has no test runner, so the
 * decision lives in this pure helper and the host only wires state to it.
 */

const rows = [
  { id: "si-1", routineId: "r-1" },
  { id: "si-2", routineId: null },
  { id: "si-3" },
  { id: "si-4", routineId: "r-2" },
];

describe("applyRepeatFilter", () => {
  it("is the identity case when the filter is off (same reference)", () => {
    const result = applyRepeatFilter(rows, false);
    // Same reference, not just same contents: a host memo downstream must not
    // invalidate on every render while the filter is off.
    expect(result.visible).toBe(rows);
    expect(result.hiddenCount).toBe(0);
  });

  it("drops routine-generated rows and counts what it dropped", () => {
    const { visible, hiddenCount } = applyRepeatFilter(rows, true);
    expect(visible.map((r) => r.id)).toEqual(["si-2", "si-3"]);
    // The count travels with the survivors: the caller says "N hidden" from
    // the same call that removed them, so the badge can never disagree with
    // the grid.
    expect(hiddenCount).toBe(2);
    expect(hiddenCount).toBe(rows.length - visible.length);
  });

  it("keeps rows whose routineId is null or absent", () => {
    // A manual event carries null; a task chip / partial row carries neither.
    // Both are one-offs and must survive — only a routine origin hides a row.
    const { visible, hiddenCount } = applyRepeatFilter(
      [{ id: "a", routineId: null }, { id: "b" }],
      true,
    );
    expect(visible.map((r) => r.id)).toEqual(["a", "b"]);
    expect(hiddenCount).toBe(0);
  });

  it("returns an empty list with the full count when every row repeats", () => {
    const all = [
      { id: "si-1", routineId: "r-1" },
      { id: "si-2", routineId: "r-1" },
    ];
    const { visible, hiddenCount } = applyRepeatFilter(all, true);
    expect(visible).toEqual([]);
    expect(hiddenCount).toBe(2);
  });

  it("does not mutate the input", () => {
    const input = [...rows];
    applyRepeatFilter(input, true);
    expect(input).toEqual(rows);
  });
});

/*
 * #468: the calendar lens. A calendar is a saved view over ONE life tag, so
 * membership is "carries that tag" — with the twist that a repeat is filed by
 * tagging its SERIES, not each generated occurrence.
 */

// si-2 is tagged directly; si-1 / si-4 inherit through their routines.
const assignments = [
  { itemId: "r-1", tagId: "tag-work" },
  { itemId: "si-2", tagId: "tag-work" },
  { itemId: "si-3", tagId: "tag-home" },
  { itemId: "r-2", tagId: "tag-home" },
  { itemId: "si-9", tagId: "tag-gone" }, // owned by a soft-deleted tag
];

describe("buildCalendarMemberIds", () => {
  it("collects the items carrying one tag", () => {
    expect([...buildCalendarMemberIds(assignments, "tag-work")]).toEqual([
      "r-1",
      "si-2",
    ]);
  });

  it("owns nothing when the calendar is bound to nothing", () => {
    // A calendar whose tag_id is missing must not degrade into "everything" —
    // that would silently turn a broken filter into a no-op the user can't see.
    expect(buildCalendarMemberIds(assignments, null).size).toBe(0);
    expect(buildCalendarMemberIds(assignments, undefined).size).toBe(0);
  });

  it("returns an empty set for a tag nobody carries", () => {
    expect(buildCalendarMemberIds(assignments, "tag-unused").size).toBe(0);
  });
});

describe("applyCalendarFilter", () => {
  it("is the identity case when the lens is off (same reference)", () => {
    const result = applyCalendarFilter(rows, null);
    // Same contract as applyRepeatFilter: a host memo downstream must not
    // invalidate on every render while the lens is off.
    expect(result.visible).toBe(rows);
    expect(result.hiddenCount).toBe(0);
    expect(applyCalendarFilter(rows, undefined).visible).toBe(rows);
  });

  it("inherits membership through the source routine", () => {
    // si-1 carries no tag of its own — r-1, the routine that generated it,
    // does. Without inheritance a tagged repeat would match zero occurrences,
    // which is every occurrence it has.
    const { visible, hiddenCount } = applyCalendarFilter(
      rows,
      buildCalendarMemberIds(assignments, "tag-work"),
    );
    expect(visible.map((r) => r.id)).toEqual(["si-1", "si-2"]);
    expect(hiddenCount).toBe(2);
  });

  it("empties the grid for a chosen calendar that owns nothing", () => {
    // An EMPTY set is not the same as "no filter": the user picked a calendar
    // and it really does hold none of these rows.
    const { visible, hiddenCount } = applyCalendarFilter(
      rows,
      new Set<string>(),
    );
    expect(visible).toEqual([]);
    expect(hiddenCount).toBe(rows.length);
  });

  it("does not mutate the input", () => {
    const input = [...rows];
    applyCalendarFilter(input, buildCalendarMemberIds(assignments, "tag-work"));
    expect(input).toEqual(rows);
  });
});

describe("composition (repeat → calendar)", () => {
  const memberIds = buildCalendarMemberIds(assignments, "tag-work");

  it("applies serially and reports the two hidden counts separately", () => {
    const repeat = applyRepeatFilter(rows, true);
    const calendar = applyCalendarFilter(repeat.visible, memberIds);
    // repeat drops si-1 / si-4; the calendar lens then drops si-3 out of what
    // is LEFT. si-1 is counted once (by repeat) and never again — chaining a
    // single running total would have claimed 4 hidden out of 4 rows while 1
    // is still on the grid.
    expect(calendar.visible.map((r) => r.id)).toEqual(["si-2"]);
    expect(repeat.hiddenCount).toBe(2);
    expect(calendar.hiddenCount).toBe(1);
    expect(repeat.hiddenCount + calendar.hiddenCount).toBe(
      rows.length - calendar.visible.length,
    );
  });

  it("keeps the repeat filter independent of the calendar lens", () => {
    // Neither resets the other: with repeats shown, the same calendar keeps
    // the routine-inherited row it dropped above.
    const repeat = applyRepeatFilter(rows, false);
    const calendar = applyCalendarFilter(repeat.visible, memberIds);
    expect(calendar.visible.map((r) => r.id)).toEqual(["si-1", "si-2"]);
    expect(repeat.hiddenCount).toBe(0);
    expect(calendar.hiddenCount).toBe(2);
  });

  it("is the full identity chain when both are off", () => {
    const repeat = applyRepeatFilter(rows, false);
    const calendar = applyCalendarFilter(repeat.visible, null);
    expect(calendar.visible).toBe(rows);
  });
});

/*
 * The host-side exclusion that keeps a broken calendar out of the chip row.
 * This used to be asserted by filtering the fixture's `tag-gone` assignments
 * away and then checking the derived set was empty — which cannot fail, since
 * the removal WAS the assertion. The real rule is the one below: the decision
 * is made against the ACTIVE tag list, not against the assignments.
 */
describe("pickSelectableCalendars", () => {
  const ledger = [
    { id: "cal-work", title: "Work", tagId: "tag-work" },
    { id: "cal-gone", title: "Old project", tagId: "tag-gone" },
    { id: "cal-home", title: "Home", tagId: "tag-home" },
  ];
  // `allTags` is active-only, so a soft-deleted tag is simply absent from it.
  const activeTagIds = new Set(["tag-work", "tag-home"]);

  it("drops a calendar whose tag is not in the active list", () => {
    expect(pickSelectableCalendars(ledger, activeTagIds).map((c) => c.id))
      // cal-gone would match zero rows forever; offering it as a chip means
      // offering a click that empties the grid with no explanation.
      .toEqual(["cal-work", "cal-home"]);
  });

  it("offers nothing while the tag list is empty (loading / failed fetch)", () => {
    // The safe direction: no chip row at all, rather than a row of chips that
    // all read as broken. It fills in by itself once the tags land.
    expect(pickSelectableCalendars(ledger, new Set())).toEqual([]);
  });

  it("keeps every calendar when all their tags are active", () => {
    const all = new Set(["tag-work", "tag-gone", "tag-home"]);
    expect(pickSelectableCalendars(ledger, all)).toHaveLength(3);
  });
});

/*
 * #468 N1: the lens has to cover BOTH layers the grid stacks. Task chips carry
 * the same life-tags and a chip's id is the task's items_meta.id, so filtering
 * only the schedule rows leaves every task on screen — a lens with a hole in
 * it, and a chip count that describes a different screen than the one you get.
 */
describe("applyCalendarLens", () => {
  // task-1 carries tag-work directly; task-2 carries nothing.
  const taskChips = [{ id: "task-1" }, { id: "task-2" }];
  const withTasks = [...assignments, { itemId: "task-1", tagId: "tag-work" }];
  const work = buildCalendarMemberIds(withTasks, "tag-work");

  it("narrows task chips with the same membership set as the rows", () => {
    const lens = applyCalendarLens(rows, taskChips, work);
    expect(lens.events.map((r) => r.id)).toEqual(["si-1", "si-2"]);
    expect(lens.taskChips.map((c) => c.id)).toEqual(["task-1"]);
  });

  it("folds the dropped task chips into the single hidden count", () => {
    const lens = applyCalendarLens(rows, taskChips, work);
    // 2 rows + 1 task chip. A count that only knew about the rows would say 2
    // while 3 things went missing.
    expect(lens.hiddenCount).toBe(3);
    expect(lens.hiddenCount).toBe(
      rows.length + taskChips.length - lens.visibleCount,
    );
  });

  it("keeps the chip's promise: its number is what the click leaves", () => {
    // The count shown on a chip and the grid after selecting it come from the
    // same call, so this holds for every calendar in the ledger, not just the
    // selected one.
    for (const tagId of ["tag-work", "tag-home", "tag-unused"]) {
      const members = buildCalendarMemberIds(withTasks, tagId);
      const chipCount = applyCalendarLens(
        rows,
        taskChips,
        members,
      ).visibleCount;
      const afterClick = applyCalendarLens(rows, taskChips, members);
      expect(chipCount).toBe(
        afterClick.events.length + afterClick.taskChips.length,
      );
    }
  });

  it("holds the promise after the repeat filter has already run", () => {
    // The lens runs on the post-repeat list, so the chip has to be counted
    // there too — counting over the unfiltered rows would advertise rows the
    // repeat filter has already taken away.
    const repeat = applyRepeatFilter(rows, true);
    const lens = applyCalendarLens(repeat.visible, taskChips, work);
    expect(lens.events.map((r) => r.id)).toEqual(["si-2"]);
    expect(lens.visibleCount).toBe(2); // si-2 + task-1
    expect(lens.hiddenCount).toBe(2); // si-3 + task-2
  });

  it("is the identity case when the lens is off (same references)", () => {
    // What `isWide === false` produces: passing null un-narrows every layer at
    // once, so a window narrowed below the breakpoint cannot strand a filter
    // whose only off-switch lives in the Desktop chip row.
    const lens = applyCalendarLens(rows, taskChips, null);
    expect(lens.events).toBe(rows);
    expect(lens.taskChips).toBe(taskChips);
    expect(lens.hiddenCount).toBe(0);
    expect(lens.visibleCount).toBe(rows.length + taskChips.length);
  });

  it("empties both layers for a calendar that owns nothing", () => {
    const lens = applyCalendarLens(rows, taskChips, new Set<string>());
    expect(lens.events).toEqual([]);
    expect(lens.taskChips).toEqual([]);
    expect(lens.visibleCount).toBe(0);
    expect(lens.hiddenCount).toBe(rows.length + taskChips.length);
  });
});
