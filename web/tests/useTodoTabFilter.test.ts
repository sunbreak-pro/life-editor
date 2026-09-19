import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { CalendarMemberAssignment } from "@life-editor/shared";
import { useTodoTabFilter } from "../src/schedule/useTodoTabFilter";

/*
 * #1641 — the two axes of the Todo tab's filter, and how they combine.
 *
 * The rules are the ones the Issue fixes: the two axes AND together, several
 * tags OR together (the calendar's rule, through the same helper), and the
 * count on the button is "how many things are narrowing this".
 */

const ASSIGNMENTS: CalendarMemberAssignment[] = [
  { itemId: "today-work", tagId: "work" },
  { itemId: "other-work", tagId: "work" },
  { itemId: "other-home", tagId: "home" },
];

const ROWS = {
  placed: [
    { id: "today-work", title: "Standup", completed: false },
    { id: "today-plain", title: "Read", completed: false },
  ],
  unplaced: [{ id: "today-home", title: "Laundry", completed: false }],
  addable: [
    { id: "other-work", title: "Report" },
    { id: "other-home", title: "Shelf" },
  ],
};

function ids(rows: ReturnType<ReturnType<typeof setup>["apply"]>) {
  return {
    today: [...rows.placed, ...rows.unplaced].map((r) => r.id),
    other: rows.addable.map((r) => r.id),
  };
}

function setup() {
  const { result } = renderHook(() => useTodoTabFilter(ASSIGNMENTS));
  return {
    get current() {
      return result.current;
    },
    apply: (): ReturnType<(typeof result.current)["apply"]> =>
      result.current.apply(ROWS),
    act: (fn: () => void) => act(fn),
  };
}

describe("useTodoTabFilter", () => {
  it("hands the rows straight back while nothing is set", () => {
    const h = setup();
    const out = h.apply();
    expect(out.placed).toBe(ROWS.placed);
    expect(out.addable).toBe(ROWS.addable);
    expect(h.current.activeCount).toBe(0);
  });

  it("drops the other list when the scope is today, and the reverse", () => {
    const h = setup();
    h.act(() => h.current.setScope("today"));
    expect(ids(h.apply())).toEqual({
      today: ["today-work", "today-plain", "today-home"],
      other: [],
    });
    expect(h.current.showOther).toBe(false);
    expect(h.current.activeCount).toBe(1);

    h.act(() => h.current.setScope("other"));
    expect(ids(h.apply())).toEqual({
      today: [],
      other: ["other-work", "other-home"],
    });
    expect(h.current.showToday).toBe(false);
  });

  it("keeps only the rows carrying a ticked tag, across both lists", () => {
    const h = setup();
    h.act(() => h.current.toggleTag("work"));
    expect(ids(h.apply())).toEqual({
      today: ["today-work"],
      other: ["other-work"],
    });
    expect(h.current.activeCount).toBe(1);
  });

  it("ORs several tags", () => {
    const h = setup();
    h.act(() => h.current.toggleTag("work"));
    h.act(() => h.current.toggleTag("home"));
    expect(ids(h.apply())).toEqual({
      today: ["today-work"],
      other: ["other-work", "other-home"],
    });
    expect(h.current.activeCount).toBe(2);
  });

  it("ANDs the two axes", () => {
    const h = setup();
    h.act(() => h.current.setScope("other"));
    h.act(() => h.current.toggleTag("home"));
    expect(ids(h.apply())).toEqual({ today: [], other: ["other-home"] });
    expect(h.current.activeCount).toBe(2);
  });

  it("unticks a tag on a second press, and clear puts both axes back", () => {
    const h = setup();
    h.act(() => h.current.toggleTag("work"));
    h.act(() => h.current.toggleTag("work"));
    expect(h.current.tagIds).toEqual([]);

    h.act(() => h.current.setScope("today"));
    h.act(() => h.current.toggleTag("home"));
    h.act(() => h.current.clear());
    expect(h.current.scope).toBe("both");
    expect(h.current.tagIds).toEqual([]);
    expect(h.current.activeCount).toBe(0);
    expect(h.apply().addable).toBe(ROWS.addable);
  });
});
