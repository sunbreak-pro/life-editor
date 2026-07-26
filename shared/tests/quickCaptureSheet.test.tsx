import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuickCaptureSheet, type QuickCaptureLabels } from "../src/components";

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
  typeTask: "Task",
  title: "Title",
  eventPlaceholder: "Event title",
  taskPlaceholder: "Task title",
  date: "Date",
  startTime: "Start",
  endTime: "End",
  addEvent: "Add",
  addEventAndOpen: "Add and edit",
  taskSourceLabel: "How to add",
  taskSourceNew: "New",
  taskSourceExisting: "From existing",
  addTask: "Add task",
  placeTask: "Place",
  searchTasks: "Search tasks",
  pickerEmpty: "No unscheduled tasks",
  pickerNoMatch: "No matching tasks",
};

function renderSheet(props?: Partial<Parameters<typeof QuickCaptureSheet>[0]>) {
  const onSubmitEvent = vi.fn();
  const onSubmitEventAndOpen = vi.fn();
  const onCreateTask = vi.fn();
  const onPlaceTask = vi.fn();
  const onClose = vi.fn();
  render(
    <QuickCaptureSheet
      open
      onClose={onClose}
      sheetTitle="Add item"
      existingTasks={[{ id: "task-1", title: "Draft the invoice" }]}
      onSubmitEvent={onSubmitEvent}
      onSubmitEventAndOpen={onSubmitEventAndOpen}
      onCreateTask={onCreateTask}
      onPlaceTask={onPlaceTask}
      labels={LABELS}
      {...props}
    />,
  );
  return {
    onSubmitEvent,
    onSubmitEventAndOpen,
    onCreateTask,
    onPlaceTask,
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
    expect(onSubmitEvent).toHaveBeenCalledWith("Dentist", "09:00", "10:00");
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
    expect(onSubmitEvent).toHaveBeenCalledWith("Gym", "19:00", "20:30");
  });

  it("reaches the task tab too — Mobile gets the same panel as Desktop (#376)", () => {
    const { onCreateTask } = renderSheet();
    fireEvent.click(screen.getByText("Task"));
    fireEvent.change(screen.getByPlaceholderText("Task title"), {
      target: { value: "Groceries" },
    });
    fireEvent.click(screen.getByText("Add task"));
    expect(onCreateTask).toHaveBeenCalledWith("Groceries", "09:00", "10:00");
  });

  it("leaves closing to the host, so the sheet never double-closes (#376)", () => {
    const { onClose } = renderSheet();
    fireEvent.change(screen.getByPlaceholderText("Event title"), {
      target: { value: "Standup" },
    });
    fireEvent.click(screen.getByText("Add"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("passes the target day through to the fields (#353)", () => {
    // Mobile reaches creation from the FAB and from an empty-slot tap, which
    // target different days — the sheet must show which one it is holding.
    renderSheet({ dateLabel: "Mon, July 27, 2026" });
    expect(screen.getByText("Mon, July 27, 2026")).toBeInTheDocument();
  });
});
