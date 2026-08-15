import { describe, it, expect } from "vitest";
import type { ScheduleItem, TodoCalendarChip } from "@life-editor/shared";
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
 * which id a todo chip gets, which surface derives a status and which leaves it
 * off, and whether the list comes back sorted.
 *
 * `now` is fixed at 2026-08-12 10:00 local so the derived statuses are facts
 * rather than a function of when the suite runs (TZ is pinned to Asia/Tokyo in
 * vitest.config.ts).
 */

const NOW = new Date(2026, 7, 12, 10, 0, 0);

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
  it("derives status and provenance for schedule items", () => {
    const [past, future] = toWeekGridItems(
      [
        event({ id: "e-past", startTime: "09:00", endTime: "09:30" }),
        event({ id: "e-future", startTime: "11:00", endTime: "12:00" }),
      ],
      [],
      NOW,
    );
    expect(past.status).toBe("inProgress");
    expect(future.status).toBe("notStarted");
    expect(past.variant).toBe("event");
  });

  it("marks a routine occurrence as such", () => {
    const [vm] = toWeekGridItems(
      [event({ id: "e-1", routineId: "routine-9" })],
      [],
      NOW,
    );
    expect(vm.variant).toBe("routine");
  });

  it("prefixes todo chip ids and leaves their status off", () => {
    const [vm] = toWeekGridItems([], [chip({ id: "task-1" })], NOW);
    expect(vm.id).toBe("todochip-task-1");
    expect(vm.variant).toBe("task");
    // Deliberate: #761 wired chip status into the AGENDA only. Deriving one
    // here would put a status tag on every grid chip — a UI change, which C6
    // is not.
    expect(vm.status).toBeUndefined();
  });

  it("keeps events first, then chips, in input order", () => {
    const vms = toWeekGridItems(
      [event({ id: "e-1" }), event({ id: "e-2" })],
      [chip({ id: "t-1" })],
      NOW,
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
      NOW,
    );
    expect(vms.map((v) => v.id)).toEqual([
      "e-allday",
      "todochip-t-mid",
      "e-late",
    ]);
  });

  it("derives a status for todo chips too, unlike the grids (#761)", () => {
    const [vm] = toAgendaItems(
      [],
      [chip({ id: "t-1", startTime: "09:00", endTime: "09:30" })],
      NOW,
    );
    expect(vm.status).toBe("inProgress");
    expect(vm.variant).toBe("task");
  });

  it("reports a completed row as done whatever the clock says", () => {
    const [vm] = toAgendaItems(
      [event({ id: "e-1", startTime: "23:00", completed: true })],
      [],
      NOW,
    );
    expect(vm.status).toBe("done");
  });

  it("does not mutate the arrays it was given", () => {
    const events = [
      event({ id: "e-late", startTime: "16:00" }),
      event({ id: "e-early", startTime: "08:00" }),
    ];
    toAgendaItems(events, [], NOW);
    expect(events.map((e) => e.id)).toEqual(["e-late", "e-early"]);
  });
});

describe("toEditorItem", () => {
  it("returns null when nothing is selected", () => {
    expect(toEditorItem(null, NOW)).toBeNull();
  });

  it("fills the editor's required fields from the item's optional ones", () => {
    const vm = toEditorItem(event({ id: "e-1" }), NOW);
    // ScheduleItem leaves both undefined/null; EventEditorItem requires them.
    expect(vm?.isAllDay).toBe(false);
    expect(vm?.memo).toBe("");
    expect(vm?.isRoutine).toBe(false);
  });

  it("reads isRoutine off routineId and keeps the memo verbatim", () => {
    const vm = toEditorItem(
      event({ id: "e-1", routineId: "r-1", memo: "bring the form" }),
      NOW,
    );
    expect(vm?.isRoutine).toBe(true);
    expect(vm?.memo).toBe("bring the form");
    expect(vm?.status).toBe("inProgress");
  });
});
