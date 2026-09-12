import { describe, it, expect } from "vitest";
import {
  todoChipId,
  type ScheduleItem,
  type TodoCalendarChip,
} from "@life-editor/shared";
import {
  toAgendaItems,
  toEditorItem,
  toMonthGridItems,
  toWeekGridItems,
} from "../src/schedule/scheduleViewModels";

/*
 * #673 (C6) — the pin under CalendarTab's four view-model conversions.
 *
 * These four blocks lived inline in a 2,900-line component that cannot be
 * rendered in jsdom (whole Provider chain + real grid layout), so nothing
 * covered them and #675 is about to move the code they sit in. What has to
 * survive that move is not "a mapper exists" but the exact per-surface shape:
 * which id a todo chip gets, which fields each surface keeps, and whether the
 * list comes back sorted.
 *
 * #1373 took the derived status out of all four — an event has no completion
 * concept any more — so none of these reads a clock and none of them takes a
 * `now`.
 */

function event(over: Partial<ScheduleItem> & { id: string }): ScheduleItem {
  return {
    date: "2026-08-12",
    title: over.id,
    startTime: "09:00",
    endTime: "10:00",
    completed: false,
    completedAt: null,
    routineId: null,
    templateId: null,
    memo: null,
    noteId: null,
    content: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...over,
  };
}

function chip(
  over: Partial<TodoCalendarChip> & { id: string },
): TodoCalendarChip {
  return {
    date: "2026-08-12",
    title: over.id,
    startTime: "13:00",
    endTime: "14:00",
    isAllDay: false,
    completed: false,
    ...over,
  };
}

describe("toWeekGridItems", () => {
  it("carries provenance, and no status on either kind (#1373)", () => {
    const vms = toWeekGridItems(
      [
        event({ id: "e-past", startTime: "09:00", endTime: "09:30" }),
        event({ id: "e-future", startTime: "11:00", endTime: "12:00" }),
      ],
      [chip({ id: "t-1" })],
      );
    expect(vms[0].variant).toBe("event");
    for (const vm of vms) expect("status" in vm).toBe(false);
  });

  it("marks a routine occurrence as such", () => {
    const [vm] = toWeekGridItems(
      [event({ id: "e-1", routineId: "routine-9" })],
      [],
    );
    expect(vm.variant).toBe("routine");
  });

  it("prefixes todo chip ids", () => {
    const [vm] = toWeekGridItems([], [chip({ id: "task-1" })]);
    expect(vm.id).toBe("todochip-task-1");
    expect(vm.variant).toBe("task");
  });

  it("keeps events first, then chips, in input order", () => {
    const vms = toWeekGridItems(
      [event({ id: "e-1" }), event({ id: "e-2" })],
      [chip({ id: "t-1" })],
    );
    expect(vms.map((v) => v.id)).toEqual(["e-1", "e-2", "todochip-t-1"]);
  });
});

describe("toMonthGridItems", () => {
  it("carries no status on either kind — month cells render no tag", () => {
    const vms = toMonthGridItems([event({ id: "e-1" })], [chip({ id: "t-1" })]);
    for (const vm of vms) {
      expect("status" in vm).toBe(false);
    }
  });

  it("keeps provenance, completion and all-day, and prefixes chip ids", () => {
    const [ev, todo] = toMonthGridItems(
      [event({ id: "e-1", routineId: "r-1", completed: true })],
      [chip({ id: "t-1", isAllDay: true })],
    );
    expect(ev).toEqual({
      id: "e-1",
      date: "2026-08-12",
      title: "e-1",
      variant: "routine",
      completed: true,
      isAllDay: undefined,
    });
    expect(todo).toEqual({
      id: "todochip-t-1",
      date: "2026-08-12",
      title: "t-1",
      variant: "task",
      completed: false,
      isAllDay: true,
    });
  });
});

describe("toAgendaItems", () => {
  it("sorts all-day rows first, then ascending by start time", () => {
    const vms = toAgendaItems(
      [
        event({ id: "e-late", startTime: "16:00", endTime: "17:00" }),
        event({ id: "e-allday", isAllDay: true, startTime: "00:00" }),
      ],
      [chip({ id: "t-mid", startTime: "12:00", endTime: "13:00" })],
    );
    expect(vms.map((v) => v.id)).toEqual([
      "e-allday",
      "todochip-t-mid",
      "e-late",
    ]);
  });

  it("marks todo chips as such, and carries no status on either kind (#1373)", () => {
    const vms = toAgendaItems(
      [event({ id: "e-1", startTime: "23:00", completed: true })],
      [chip({ id: "t-1", startTime: "09:00", endTime: "09:30" })],
    );
    expect(vms.map((v) => v.variant)).toEqual(["task", "event"]);
    for (const vm of vms) expect("status" in vm).toBe(false);
    // `completed` survives as data — the todo checkbox reads it, and the MCP
    // tool still writes it for events (AgendaList gates the strikethrough).
    expect(vms.find((v) => v.id === "e-1")?.completed).toBe(true);
  });

  it("does not mutate the arrays it was given", () => {
    const events = [
      event({ id: "e-late", startTime: "16:00" }),
      event({ id: "e-early", startTime: "08:00" }),
    ];
    toAgendaItems(events, []);
    expect(events.map((e) => e.id)).toEqual(["e-late", "e-early"]);
  });
});

describe("toEditorItem", () => {
  it("returns null when nothing is selected", () => {
    expect(toEditorItem(null)).toBeNull();
  });

  it("fills the editor's required fields from the item's optional ones", () => {
    const vm = toEditorItem(event({ id: "e-1" }));
    // ScheduleItem leaves both undefined/null; EventEditorItem requires them.
    expect(vm?.isAllDay).toBe(false);
    expect(vm?.memo).toBe("");
    expect(vm?.isRoutine).toBe(false);
  });

  it("reads isRoutine off routineId and keeps the memo verbatim", () => {
    const vm = toEditorItem(
      event({ id: "e-1", routineId: "r-1", memo: "bring the form" }),
    );
    expect(vm?.isRoutine).toBe(true);
    expect(vm?.memo).toBe("bring the form");
    // No status and no completed: the editor pane has no completion control
    // since #1373, so neither field reaches it.
    expect("status" in (vm as object)).toBe(false);
    expect("completed" in (vm as object)).toBe(false);
  });
});

/*
 * #1580 — the tag colour reaching all three list surfaces.
 *
 * One trap, three times: a todo's GRID id is the prefixed `todoChipId(c.id)`,
 * while its tags hang off the bare `c.id`. Looking the colour up by the id the
 * row already carries finds nothing, and the failure is silent — the todo just
 * keeps its variant colour while events beside it turn. Every case below
 * therefore asks about a todo as well as an event.
 */
describe("tag colours (#1580)", () => {
  const COLORS = new Map([
    ["e1", "#1e3a8a"],
    ["t1", "#fde68a"],
  ]);

  it("puts the colour on week-grid rows, todos included", () => {
    const rows = toWeekGridItems(
      [event({ id: "e1" }), event({ id: "e2" })],
      [chip({ id: "t1" })],
      COLORS,
    );
    expect(rows.find((r) => r.id === "e1")?.tagColor).toBe("#1e3a8a");
    expect(rows.find((r) => r.id === "e2")?.tagColor).toBeUndefined();
    // Looked up by the TodoNode id, not by the prefixed grid id.
    expect(rows.find((r) => r.id === todoChipId("t1"))?.tagColor).toBe(
      "#fde68a",
    );
  });

  it("puts the colour on month-grid cells, todos included", () => {
    const rows = toMonthGridItems(
      [event({ id: "e1" }), event({ id: "e2" })],
      [chip({ id: "t1" })],
      COLORS,
    );
    expect(rows.find((r) => r.id === "e1")?.tagColor).toBe("#1e3a8a");
    expect(rows.find((r) => r.id === "e2")?.tagColor).toBeUndefined();
    expect(rows.find((r) => r.id === todoChipId("t1"))?.tagColor).toBe(
      "#fde68a",
    );
  });

  it("puts the colour on agenda rows, todos included", () => {
    const rows = toAgendaItems(
      [event({ id: "e1" })],
      [chip({ id: "t1" })],
      COLORS,
    );
    expect(rows.find((r) => r.id === "e1")?.tagColor).toBe("#1e3a8a");
    expect(rows.find((r) => r.id === todoChipId("t1"))?.tagColor).toBe(
      "#fde68a",
    );
  });

  it("leaves every row colourless when the argument is omitted", () => {
    // The default keeps every existing call site — and every surface with no
    // coloured tags anywhere — on the variant colours.
    const rows = toMonthGridItems([event({ id: "e1" })], [chip({ id: "t1" })]);
    expect(rows.every((r) => r.tagColor === undefined)).toBe(true);
  });
});
