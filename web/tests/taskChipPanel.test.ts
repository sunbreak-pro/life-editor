import { describe, it, expect, vi } from "vitest";
import type { TaskCalendarChip } from "@life-editor/shared";
import {
  answersChipClick,
  taskChipPanelModel,
} from "../src/schedule/taskChipPanel";

/*
 * #564: what the unified click bubble offers on a TASK chip.
 *
 * Pinned here rather than through CalendarTab for the reason taskChipUndoWiring
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
  rename: "Rename",
  delete: "Delete",
};

const CANDIDATE: TaskCalendarChip = {
  id: "task-1",
  date: "2026-06-15",
  title: "write the report",
  startTime: "00:00",
  endTime: "00:00",
  isAllDay: true,
  completed: false,
};

const PLACED: TaskCalendarChip = {
  ...CANDIDATE,
  id: "task-2",
  startTime: "09:00",
  endTime: "10:00",
  isAllDay: false,
};

function build(chip: TaskCalendarChip) {
  const onRename = vi.fn();
  const onDelete = vi.fn();
  return {
    model: taskChipPanelModel(chip, COPY, { onRename, onDelete }),
    onRename,
    onDelete,
  };
}

describe("taskChipPanelModel (#564)", () => {
  it("offers rename and delete, with delete marked dangerous", () => {
    const { model } = build(CANDIDATE);
    expect(model.actions.map((a) => a.id)).toEqual(["rename", "delete"]);
    expect(model.actions[0].label).toBe("Rename");
    expect(model.actions[1].label).toBe("Delete");
    expect(model.actions[1].danger).toBe(true);
  });

  it("renames through an inline input seeded with the current title", () => {
    const { model, onRename } = build(CANDIDATE);
    const inline = model.actions[0].inlineInput;
    expect(inline?.value).toBe("write the report");
    inline?.onCommit("write the other report");
    expect(onRename).toHaveBeenCalledWith("write the other report");
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
    expect(model.timeLabel).toBe("All-day");
  });

  it("prints the span of a placed chip", () => {
    const { model } = build(PLACED);
    expect(model.timeLabel).toBe("09:00–10:00");
  });

  it("falls back to the untitled placeholder, but seeds the input empty", () => {
    const { model } = build({ ...CANDIDATE, title: "" });
    expect(model.title).toBe("(untitled)");
    // Seeding the input with the placeholder would commit "(untitled)" as a
    // real title on the first Enter.
    expect(model.actions[0].inlineInput?.value).toBe("");
  });
});

describe("answersChipClick (#564)", () => {
  it("answers everything on Desktop", () => {
    expect(answersChipClick("taskchip-task-1", true)).toBe(true);
    expect(answersChipClick("evt-1", true)).toBe(true);
  });

  it("leaves a narrow tap on a task chip untouched", () => {
    // Selection included: narrow's detail surface is the BottomSheet editor,
    // which resolves schedule_items only, so a selected task chip would show a
    // ring with nothing behind it.
    expect(answersChipClick("taskchip-task-1", false)).toBe(false);
  });

  it("still answers a narrow tap on a schedule item", () => {
    expect(answersChipClick("evt-1", false)).toBe(true);
  });
});
