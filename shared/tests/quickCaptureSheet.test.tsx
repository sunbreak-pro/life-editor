import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  QuickCaptureSheet,
  type QuickCaptureLabels,
  type ItemCreateSlot,
} from "../src/components";

/*
 * QuickCaptureSheet (#280, moved from web CalendarTab) — the Mobile FAB's
 * quick-capture frame. Since #376 it is a pass-through around the unified
 * <ItemCreatePanel>, so these tests only pin what the FRAME owns: the sheet
 * header, and that every panel prop reaches the panel unchanged (the panel's
 * own behaviour is covered by itemCreatePanel.test.tsx).
 *
 * Closing is the host's job — its submit handlers clear the open-panel state,
 * which flips `open` here. The sheet deliberately does not close itself on
 * submit, so it can never double-close.
 */

const LABELS: QuickCaptureLabels = {
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
  attachedNote: "Note:",
  clearNote: "Remove the note",
};

/**
 * #893 folded the panel's props into bundles; the cases below still describe
 * their setup in flat terms and are unchanged from before that refactor, so
 * the folding happens here (see itemCreatePanel.test.tsx for the same note).
 */
/** The day the host seeds the sheet with, unless a case says otherwise. */
const DATE = "2026-08-20";

/** The submit payload the panel now carries (#940). */
function slot(over?: Partial<ItemCreateSlot>): ItemCreateSlot {
  return { date: DATE, start: "09:00", end: "10:00", isAllDay: false, ...over };
}

function renderSheet(props?: {
  initialDate?: string;
  initialStart?: string;
  initialEnd?: string;
}) {
  const onSubmitEvent = vi.fn();
  const onSubmitEventAndOpen = vi.fn();
  const onCreateTodo = vi.fn();
  const onPlaceTodo = vi.fn();
  const onClose = vi.fn();
  render(
    <QuickCaptureSheet
      open
      onClose={onClose}
      sheetTitle="Add item"
      closeLabel="Close"
      initial={{
        date: props?.initialDate ?? DATE,
        start: props?.initialStart,
        end: props?.initialEnd,
      }}
      pools={{
        todos: [{ id: "task-1", title: "Draft the invoice" }],
        notes: [{ id: "note-1", title: "Standup minutes" }],
      }}
      handlers={{
        onSubmitEvent,
        onSubmitEventAndOpen,
        onCreateTodo,
        onPlaceTodo,
      }}
      labels={LABELS}
    />,
  );
  return {
    onSubmitEvent,
    onSubmitEventAndOpen,
    onCreateTodo,
    onPlaceTodo,
    onClose,
  };
}

describe("QuickCaptureSheet", () => {
  it("titles the sheet with sheetTitle, not the title-input label (#376)", () => {
    // The sheet now holds more than one kind of item, so its heading names the
    // panel. Before #376 both came from the same key and read "Add event".
    renderSheet();
    expect(screen.getByText("Add item")).toBeInTheDocument();
  });

  it("forwards the submit handlers to the panel", () => {
    const { onSubmitEvent } = renderSheet();
    fireEvent.change(screen.getByPlaceholderText("Event title"), {
      target: { value: "Dentist" },
    });
    fireEvent.click(screen.getByText("Add"));
    expect(onSubmitEvent).toHaveBeenCalledWith(
      "Dentist",
      slot({ start: "09:00", end: "10:00" }),
      null,
    );
  });

  it("forwards the time prefill and the edited times", () => {
    const { onSubmitEvent } = renderSheet({
      initialStart: "19:00",
      initialEnd: "20:30",
    });
    fireEvent.change(screen.getByPlaceholderText("Event title"), {
      target: { value: "  Gym  " },
    });
    fireEvent.click(screen.getByText("Add"));
    expect(onSubmitEvent).toHaveBeenCalledWith(
      "Gym",
      slot({ start: "19:00", end: "20:30" }),
      null,
    );
  });

  it("reaches the todo tab too — Mobile gets the same panel as Desktop (#376)", () => {
    const { onCreateTodo } = renderSheet();
    fireEvent.click(screen.getByText("Todo"));
    fireEvent.change(screen.getByPlaceholderText("Todo title"), {
      target: { value: "Groceries" },
    });
    fireEvent.click(screen.getByText("Add todo"));
    expect(onCreateTodo).toHaveBeenCalledWith(
      "Groceries",
      slot({ start: "09:00", end: "10:00" }),
      null,
    );
  });

  it("leaves closing to the host, so the sheet never double-closes (#376)", () => {
    const { onClose } = renderSheet();
    fireEvent.change(screen.getByPlaceholderText("Event title"), {
      target: { value: "Standup" },
    });
    fireEvent.click(screen.getByText("Add"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("passes the target day through to the field (#353 / #940)", () => {
    // Mobile reaches creation from the FAB and from an empty-slot tap, which
    // target different days — the sheet must show which one it is holding. A
    // caption until #940; an input the user can change since.
    renderSheet({ initialDate: "2026-07-27" });
    expect((screen.getByLabelText("Date") as HTMLInputElement).value).toBe(
      "2026-07-27",
    );
  });
});
