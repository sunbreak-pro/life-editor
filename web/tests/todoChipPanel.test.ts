import { describe, it, expect, vi } from "vitest";
import type { TodoCalendarChip, WikiTagUnified } from "@life-editor/shared";
import {
  bubbleTags,
  eventQuickEditPatch,
  eventQuickEditValue,
  itemTapRoute,
  todoChipMemo,
  todoChipPanelModel,
  type TodoChipDetails,
  todoSlotFromStart,
} from "../src/schedule/todoChipPanel";

/*
 * #564: what the unified click bubble offers on a TODO chip.
 *
 * Pinned here rather than through CalendarTab for the reason todoChipUndoWiring
 * spells out — the host needs the whole Provider stack plus real grid layout to
 * render, so a decision made inside it is invisible to every gate we can run.
 * The chip's only edit route on the calendar is this panel, and an action
 * silently dropped from it would put the chip straight back to the state the
 * Issue reports: visible, draggable, and impossible to rename or delete
 * without leaving the section.
 */

const COPY = {
  untitled: "(untitled)",
  allDay: "All-day",
  when: (dateKey: string, time: string) => `${dateKey} / ${time}`,
  delete: "Delete",
  convertToEvent: "Convert to event",
};

const CANDIDATE: TodoCalendarChip = {
  id: "task-1",
  date: "2026-06-15",
  title: "write the report",
  startTime: "00:00",
  endTime: "00:00",
  isAllDay: true,
  completed: false,
};

const PLACED: TodoCalendarChip = {
  ...CANDIDATE,
  id: "task-2",
  startTime: "09:00",
  endTime: "10:00",
  isAllDay: false,
};

function build(chip: TodoCalendarChip, details?: TodoChipDetails) {
  const onRename = vi.fn();
  const onRetime = vi.fn();
  const onDelete = vi.fn();
  const onConvertToEvent = vi.fn();
  return {
    model: todoChipPanelModel(
      chip,
      COPY,
      { onRename, onRetime, onDelete, onConvertToEvent },
      details,
    ),
    onRename,
    onRetime,
    onDelete,
    onConvertToEvent,
  };
}

describe("todoChipPanelModel (#564)", () => {
  // #2222: rename left the row list for the in-place edit of the summary.
  it("offers convert and delete, with only delete marked dangerous", () => {
    const { model } = build(CANDIDATE);
    expect(model.actions.map((a) => a.id)).toEqual([
      "convertToEvent",
      "delete",
    ]);
    expect(model.actions[0].label).toBe("Convert to event");
    // #625: converting MOVES the item, it does not remove it — danger styling
    // would read as "this destroys something".
    expect(model.actions[0].danger).toBeUndefined();
    expect(model.actions[1].label).toBe("Delete");
    expect(model.actions[1].danger).toBe(true);
  });

  it("converts through the host's re-role write (#625)", () => {
    const { model, onConvertToEvent } = build(CANDIDATE);
    model.actions[0].onSelect?.();
    expect(onConvertToEvent).toHaveBeenCalledTimes(1);
  });

  it("edits an all-day todo's title only, seeded with the current title", () => {
    const { model, onRename, onRetime } = build(CANDIDATE);
    expect(model.quickEditValue).toEqual({ title: "write the report" });
    model.commitQuickEdit({ title: "write the other report" });
    expect(onRename).toHaveBeenCalledWith("write the other report");
    expect(onRetime).not.toHaveBeenCalled();
  });

  it("moves a timed todo by its start, keeping its length", () => {
    const { model, onRename, onRetime } = build(PLACED);
    expect(model.quickEditValue).toEqual({
      title: "write the report",
      start: "09:00",
    });
    model.commitQuickEdit({ title: "write the report", start: "13:30" });
    expect(onRename).not.toHaveBeenCalled();
    expect(onRetime).toHaveBeenCalledWith({
      date: "2026-06-15",
      start: "13:30",
      end: "14:30",
    });
  });

  it("deletes through the host's soft-delete", () => {
    const { model, onDelete } = build(CANDIDATE);
    model.actions[1].onSelect?.();
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("says 'all-day' rather than printing the 00:00–00:00 staging span", () => {
    const { model } = build(CANDIDATE);
    expect(model.title).toBe("write the report");
    // The #298 staging shape carries midnight at both ends; printed literally
    // it reads as a zero-length event at midnight.
    expect(model.when).toBe("2026-06-15 / All-day");
  });

  it("prints the day and the span of a placed chip (#2574)", () => {
    const { model } = build(PLACED);
    expect(model.when).toBe("2026-06-15 / 09:00–10:00");
  });

  it("carries the todo's tags and memo into the summary (#2574)", () => {
    const tags = [{ id: "t-1", name: "Work", color: "#3366ff", icon: null }];
    const { model } = build(PLACED, { tags, memo: "bring the draft" });
    expect(model.tags).toEqual(tags);
    expect(model.memo).toBe("bring the draft");
  });

  it("has nothing to draw for a todo with neither (#2574)", () => {
    const { model } = build(PLACED);
    expect(model.tags).toEqual([]);
    expect(model.memo).toBe("");
  });

  it("falls back to the untitled placeholder, but seeds the input empty", () => {
    const { model } = build({ ...CANDIDATE, title: "" });
    expect(model.title).toBe("(untitled)");
    // Seeding the input with the placeholder would commit "(untitled)" as a
    // real title on the first Enter.
    expect(model.quickEditValue.title).toBe("");
  });
});

describe("todoChipMemo (#2574)", () => {
  const body = (...lines: string[]) =>
    JSON.stringify({
      type: "doc",
      content: lines.map((text) => ({
        type: "paragraph",
        content: text ? [{ type: "text", text }] : [],
      })),
    });

  it("reads the first line of text out of the todo's rich-text body", () => {
    expect(
      todoChipMemo("todochip-task-1", [
        { id: "task-0", content: body("someone else's") },
        { id: "task-1", content: body("", "bring the draft", "and a pen") },
      ]),
    ).toBe("bring the draft");
  });

  it("reads nothing from an empty body, no body, or a todo that is gone", () => {
    expect(
      todoChipMemo("todochip-task-1", [{ id: "task-1", content: body("") }]),
    ).toBeUndefined();
    expect(todoChipMemo("todochip-task-1", [{ id: "task-1" }])).toBeUndefined();
    expect(todoChipMemo("todochip-task-1", [])).toBeUndefined();
  });
});

describe("bubbleTags (#2574)", () => {
  const tag = (
    id: string,
    overrides: Partial<WikiTagUnified> = {},
  ): WikiTagUnified => ({
    id,
    name: id,
    color: null,
    icon: null,
    isDeleted: false,
    deletedAt: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  });

  it("keeps the assignments' order and drops trashed and unknown tags", () => {
    expect(
      bubbleTags(
        [{ tagId: "b" }, { tagId: "gone" }, { tagId: "trash" }, { tagId: "a" }],
        [tag("a"), tag("b"), tag("trash", { isDeleted: true })],
      ).map((shown) => shown.id),
    ).toEqual(["b", "a"]);
  });
});

describe("itemTapRoute (#564 → #761)", () => {
  it("keeps every Desktop tap on the select-then-bubble path", () => {
    expect(itemTapRoute("todochip-task-1", true)).toBe("select");
    expect(itemTapRoute("evt-1", true)).toBe("select");
  });

  it("sends a narrow tap on a todo chip to the todo sheet", () => {
    // #564 dropped this tap for want of a surface; #761 gives narrow one, so
    // the row answers instead of doing nothing next to an event that opens.
    expect(itemTapRoute("todochip-task-1", false)).toBe("todoSheet");
  });

  it("leaves a narrow tap on a schedule item alone", () => {
    // Selection alone brings up the narrow editor sheet — unchanged.
    expect(itemTapRoute("evt-1", false)).toBe("select");
  });
});

describe("todoSlotFromStart (#2222)", () => {
  it("holds the end to the same day", () => {
    expect(
      todoSlotFromStart(
        { date: "2026-06-15", startTime: "09:00", endTime: "11:00" },
        "23:00",
      ),
    ).toEqual({ date: "2026-06-15", start: "23:00", end: "23:59" });
  });

  it("is no move when nothing of the slot is left", () => {
    expect(
      todoSlotFromStart(
        { date: "2026-06-15", startTime: "09:00", endTime: "10:00" },
        "23:59",
      ),
    ).toBeNull();
  });
});

describe("eventQuickEditValue / eventQuickEditPatch (#2222)", () => {
  const EVENT = {
    id: "event-1",
    title: "Standup",
    date: "2026-06-15",
    startTime: "09:00",
    endTime: "09:30",
    isAllDay: false,
    routineId: null,
  };

  it("edits title, day and span on a plain event", () => {
    expect(eventQuickEditValue(EVENT)).toEqual({
      title: "Standup",
      date: "2026-06-15",
      start: "09:00",
      end: "09:30",
    });
  });

  it("keeps a repeat occurrence on its day", () => {
    expect(eventQuickEditValue({ ...EVENT, routineId: "r-1" })).toEqual({
      title: "Standup",
      start: "09:00",
      end: "09:30",
    });
  });

  it("has no clock time on an all-day event", () => {
    expect(eventQuickEditValue({ ...EVENT, isAllDay: true })).toEqual({
      title: "Standup",
      date: "2026-06-15",
    });
  });

  it("gives a holiday no form at all", () => {
    expect(
      eventQuickEditValue({ ...EVENT, id: "holiday-2026-06-15" }),
    ).toBeNull();
  });

  it("patches only what changed, and nothing when nothing did", () => {
    expect(
      eventQuickEditPatch(EVENT, {
        title: "Standup",
        date: "2026-06-16",
        start: "09:00",
        end: "10:00",
      }),
    ).toEqual({ date: "2026-06-16", endTime: "10:00" });
    expect(eventQuickEditPatch(EVENT, eventQuickEditValue(EVENT)!)).toBeNull();
  });
});
