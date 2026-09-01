import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  EventEditorPane,
  ItemCreatePanel,
  TimeRangeField,
  type EventEditorItem,
  type EventEditorLabels,
  type ItemCreatePanelLabels,
} from "../src/components";

/*
 * Narrow-width shrink guards for the schedule create / edit fields (#1036).
 *
 * On a phone the time pair ran out through the right edge of the sheet and the
 * all-day switch went with it. The cause was not a width anywhere — it was the
 * ABSENCE of `min-w-0`. A flex item defaults to `min-width: auto`, which floors
 * it at the min-content width of what it holds, and a bare <input> reports the
 * ~20-character box the browser gives it rather than the "HH:MM" it displays.
 * Two of those side by side need ~370px, so at 375px the row could only resolve
 * by overflowing; `w-full` on the input does not help, because a percentage
 * width is ignored while the parent computes its intrinsic minimum.
 *
 * Asserted on the class, not on geometry: jsdom has no layout (CLAUDE.md §7.1),
 * so every element here measures 0 and a real overflow test is impossible in
 * this environment — the browser check is the DoD's separate, human step. What
 * a class assertion CAN catch is the regression that actually happened: the
 * utility was simply never written. `cn` is plain concatenation (rules/frontend
 * §Gotchas), so a dropped class fails silently rather than erroring.
 */

/** The flex item whose minimum size is what the fix releases. */
const columnOf = (field: HTMLElement) => field.closest("label");

const EDITOR_LABELS: EventEditorLabels = {
  title: "Title",
  date: "Date",
  allDay: "All-day",
  startTime: "Start",
  endTime: "End",
  memo: "Memo",
  save: "Save",
  saved: "Saved",
  unsaved: "Unsaved",
  originRoutine: "Generated from routine",
  skipThisDay: "Skip this day",
  delete: "Delete",
};

const ITEM: EventEditorItem = {
  id: "m1",
  title: "Dentist",
  date: "2026-08-17",
  isAllDay: false,
  startTime: "09:00",
  endTime: "10:00",
  memo: "",
  isRoutine: false,
};

const CREATE_LABELS: ItemCreatePanelLabels = {
  typeLabel: "Item type",
  typeEvent: "Event",
  typeTodo: "Todo",
  typeNote: "Note",
  title: "Title",
  eventPlaceholder: "Event title",
  todoPlaceholder: "Todo title",
  date: "Date",
  allDay: "All day",
  startTime: "Start",
  endTime: "End",
  addEvent: "Add",
  addEventAndOpen: "Add and edit",
  addTodo: "Add todo",
  placeTodo: "Place",
  sourceLabel: "How to add",
  sourceNew: "New",
  sourceExisting: "From existing",
  searchTodos: "Search todos",
  todoPickerEmpty: "No unscheduled todos",
  todoPickerNoMatch: "No matching todos",
  noteTitleLabel: "Note title",
  notePlaceholder: "Note title placeholder",
  searchNotes: "Search notes",
  notePickerEmpty: "No notes yet",
  notePickerNoMatch: "No matching notes",
  noteLinkHint: "Linked to the item you add below.",
  attachedNote: "Linked note",
  clearNote: "Remove the note",
};

function renderCreatePanel() {
  render(
    <ItemCreatePanel
      initial={{ date: "2026-08-17" }}
      pools={{ todos: [], notes: [] }}
      handlers={{
        onSubmitEvent: vi.fn(),
        onSubmitEventAndOpen: vi.fn(),
        onCreateTodo: vi.fn(),
        onPlaceTodo: vi.fn(),
      }}
      labels={CREATE_LABELS}
    />,
  );
}

describe("TimeRangeField", () => {
  it("lets both time columns shrink below the input's intrinsic width", () => {
    render(
      <TimeRangeField
        start="09:00"
        end="10:00"
        onChange={vi.fn()}
        labels={{ start: "Start", end: "End" }}
      />,
    );

    for (const name of ["Start", "End"]) {
      const column = columnOf(screen.getByRole("combobox", { name }));
      expect(column?.className).toContain("min-w-0");
      expect(column?.className).toContain("flex-1");
    }
  });
});

describe("EventEditorPane date row", () => {
  it("lets the date column shrink so the all-day switch keeps its seat", () => {
    render(
      <EventEditorPane
        item={ITEM}
        labels={EDITOR_LABELS}
        handlers={{ onSave: vi.fn()}}
        options={{ canEditDate: true, canEditAllDay: true }}
      />,
    );

    // The switch is `shrink-0` on purpose (it is a fixed label), so the date
    // beside it is the only side that can give — and it can only give once the
    // automatic minimum is released.
    expect(screen.getByRole("switch", { name: "All-day" }).className).toContain(
      "shrink-0",
    );
    expect(columnOf(screen.getByLabelText("Date"))?.className).toContain(
      "min-w-0",
    );
  });

  it("keeps the shrink guard on the time pair it renders", () => {
    render(
      <EventEditorPane
        item={ITEM}
        labels={EDITOR_LABELS}
        handlers={{ onSave: vi.fn()}}
        options={{ canEditDate: true, canEditAllDay: true }}
      />,
    );

    expect(
      columnOf(screen.getByRole("combobox", { name: "Start" }))?.className,
    ).toContain("min-w-0");
  });
});

describe("ItemCreatePanel date row", () => {
  it("lets the date column shrink on every tab that shows it", () => {
    renderCreatePanel();

    expect(screen.getByRole("switch", { name: "All day" }).className).toContain(
      "shrink-0",
    );
    expect(columnOf(screen.getByLabelText("Date"))?.className).toContain(
      "min-w-0",
    );
    // The time pair is on the same screen as the date on every creating tab —
    // the todo tab renders it too, which is why the overflow was reported
    // there as well.
    expect(
      columnOf(screen.getByRole("combobox", { name: "End" }))?.className,
    ).toContain("min-w-0");
  });
});
