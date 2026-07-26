import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  ItemCreatePanel,
  type ItemCreatePanelLabels,
  type ItemCreateTaskOption,
} from "../src/components";

/*
 * ItemCreatePanel (#376) — the unified creation panel behind the Desktop
 * overlay and the Mobile QuickCaptureSheet. Pure presentation: labels injected,
 * the four callbacks are the only mutations.
 *
 * These tests keep three contracts pinned:
 *   - the #299/#353/#354 event contract inherited from EventCreateFields
 *     (prefill, trimming, blank-title no-op, Enter = plain create, read-only
 *     target day),
 *   - the #376 task contract (new task vs placing an existing one, and that
 *     both carry the panel's times),
 *   - the drafts survive a type-tab switch, which is the whole reason the
 *     title/time state lives on the panel rather than per tab.
 */

const LABELS: ItemCreatePanelLabels = {
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

const TASKS: ItemCreateTaskOption[] = [
  { id: "task-1", title: "Draft the invoice" },
  { id: "task-2", title: "Review PR 376" },
  { id: "task-3", title: "Book the dentist" },
];

function renderPanel(props?: Partial<Parameters<typeof ItemCreatePanel>[0]>) {
  const onSubmitEvent = vi.fn();
  const onSubmitEventAndOpen = vi.fn();
  const onCreateTask = vi.fn();
  const onPlaceTask = vi.fn();
  render(
    <ItemCreatePanel
      existingTasks={TASKS}
      onSubmitEvent={onSubmitEvent}
      onSubmitEventAndOpen={onSubmitEventAndOpen}
      onCreateTask={onCreateTask}
      onPlaceTask={onPlaceTask}
      labels={LABELS}
      {...props}
    />,
  );
  return { onSubmitEvent, onSubmitEventAndOpen, onCreateTask, onPlaceTask };
}

/** Switch to the task tab (and, optionally, to the existing-task source). */
function openTaskTab(source?: "existing") {
  fireEvent.click(screen.getByText("Task"));
  if (source === "existing") fireEvent.click(screen.getByText("From existing"));
}

describe("ItemCreatePanel — event tab (inherited #299 / #353 / #354)", () => {
  it("opens on the event tab and submits the trimmed title with the default window", () => {
    const { onSubmitEvent } = renderPanel();
    fireEvent.change(screen.getByPlaceholderText("Event title"), {
      target: { value: "  Dentist  " },
    });
    fireEvent.click(screen.getByText("Add"));
    expect(onSubmitEvent).toHaveBeenCalledWith("Dentist", "09:00", "10:00");
  });

  it("seeds the time fields from initialStart / initialEnd (empty-slot prefill)", () => {
    const { onSubmitEvent } = renderPanel({
      initialStart: "14:30",
      initialEnd: "15:30",
    });
    expect((screen.getByLabelText("Start") as HTMLInputElement).value).toBe(
      "14:30",
    );
    expect((screen.getByLabelText("End") as HTMLInputElement).value).toBe(
      "15:30",
    );
    fireEvent.change(screen.getByPlaceholderText("Event title"), {
      target: { value: "Meeting" },
    });
    fireEvent.click(screen.getByText("Add"));
    expect(onSubmitEvent).toHaveBeenCalledWith("Meeting", "14:30", "15:30");
  });

  it("routes the second button to onSubmitEventAndOpen with the same payload (#354)", () => {
    const { onSubmitEvent, onSubmitEventAndOpen } = renderPanel({
      initialStart: "14:00",
      initialEnd: "15:00",
    });
    fireEvent.change(screen.getByPlaceholderText("Event title"), {
      target: { value: "  Review  " },
    });
    fireEvent.click(screen.getByText("Add and edit"));
    expect(onSubmitEventAndOpen).toHaveBeenCalledWith(
      "Review",
      "14:00",
      "15:00",
    );
    expect(onSubmitEvent).not.toHaveBeenCalled();
  });

  it("keeps Enter on the plain create, so the fast path stays fast (#354)", () => {
    const { onSubmitEvent, onSubmitEventAndOpen } = renderPanel();
    const input = screen.getByPlaceholderText("Event title");
    fireEvent.change(input, { target: { value: "Standup" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmitEvent).toHaveBeenCalledTimes(1);
    expect(onSubmitEventAndOpen).not.toHaveBeenCalled();
  });

  it("a blank title is a no-op on BOTH buttons", () => {
    const { onSubmitEvent, onSubmitEventAndOpen } = renderPanel();
    fireEvent.click(screen.getByText("Add and edit"));
    fireEvent.click(screen.getByText("Add"));
    expect(onSubmitEvent).not.toHaveBeenCalled();
    expect(onSubmitEventAndOpen).not.toHaveBeenCalled();
  });

  it("submits on Enter but ignores Enter during IME composition", () => {
    const { onSubmitEvent } = renderPanel();
    const input = screen.getByPlaceholderText("Event title");
    fireEvent.change(input, { target: { value: "Standup" } });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(onSubmitEvent).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmitEvent).toHaveBeenCalledWith("Standup", "09:00", "10:00");
  });

  it("shows the target day read-only when the host supplies one (#353)", () => {
    // The day comes from the gesture that opened the panel; offering an input
    // here would contradict it. Asserting the element type (not just the
    // absence of a label) so swapping in an unlabelled <input> also fails.
    renderPanel({ dateLabel: "Mon, July 27, 2026" });
    expect(screen.getByText("Date")).toBeInTheDocument();
    expect(screen.getByText("Mon, July 27, 2026").tagName).toBe("P");
    expect(screen.queryByLabelText("Date")).toBeNull();
    // title + start + end, and nothing more.
    expect(document.querySelectorAll("input")).toHaveLength(3);
  });

  it("skips the day row while the host has no target day (panel closed / opening)", () => {
    renderPanel();
    expect(screen.queryByText("Date")).toBeNull();
  });
});

describe("ItemCreatePanel — task tab (#376)", () => {
  it("creates a new task with the panel's times", () => {
    const { onCreateTask, onSubmitEvent } = renderPanel({
      initialStart: "11:00",
      initialEnd: "11:45",
    });
    openTaskTab();
    fireEvent.change(screen.getByPlaceholderText("Task title"), {
      target: { value: "  Write the report  " },
    });
    fireEvent.click(screen.getByText("Add task"));
    expect(onCreateTask).toHaveBeenCalledWith(
      "Write the report",
      "11:00",
      "11:45",
    );
    expect(onSubmitEvent).not.toHaveBeenCalled();
  });

  it("Enter on the task tab routes to the task create, not the event create", () => {
    const { onCreateTask, onSubmitEvent } = renderPanel();
    openTaskTab();
    const input = screen.getByPlaceholderText("Task title");
    fireEvent.change(input, { target: { value: "Groceries" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCreateTask).toHaveBeenCalledWith("Groceries", "09:00", "10:00");
    expect(onSubmitEvent).not.toHaveBeenCalled();
  });

  it("places an existing task at the panel's times", () => {
    const { onPlaceTask } = renderPanel({
      initialStart: "16:00",
      initialEnd: "17:00",
    });
    openTaskTab("existing");
    fireEvent.click(screen.getByText("Review PR 376"));
    fireEvent.click(screen.getByText("Place"));
    expect(onPlaceTask).toHaveBeenCalledWith("task-2", "16:00", "17:00");
  });

  it("does nothing until a task is picked", () => {
    const { onPlaceTask } = renderPanel();
    openTaskTab("existing");
    fireEvent.click(screen.getByText("Place"));
    expect(onPlaceTask).not.toHaveBeenCalled();
  });

  it("filters the pool by the search query, case-insensitively", () => {
    renderPanel();
    openTaskTab("existing");
    fireEvent.change(screen.getByLabelText("Search tasks"), {
      target: { value: "invoice" },
    });
    expect(screen.getByText("Draft the invoice")).toBeInTheDocument();
    expect(screen.queryByText("Review PR 376")).toBeNull();
  });

  it("drops a selection the query has filtered away (#376 — never place an unseen task)", () => {
    // Picking, then narrowing past the picked row, must not leave a live
    // selection behind: the submit would act on something off screen.
    const { onPlaceTask } = renderPanel();
    openTaskTab("existing");
    fireEvent.click(screen.getByText("Draft the invoice"));
    fireEvent.change(screen.getByLabelText("Search tasks"), {
      target: { value: "dentist" },
    });
    fireEvent.click(screen.getByText("Place"));
    expect(onPlaceTask).not.toHaveBeenCalled();
  });

  it("says the pool itself is empty when there is nothing left to place", () => {
    renderPanel({ existingTasks: [] });
    openTaskTab("existing");
    expect(screen.getByText("No unscheduled tasks")).toBeInTheDocument();
    expect(screen.queryByText("No matching tasks")).toBeNull();
  });

  it("reports an empty search result separately from an empty pool", () => {
    renderPanel();
    openTaskTab("existing");
    fireEvent.change(screen.getByLabelText("Search tasks"), {
      target: { value: "zzz" },
    });
    expect(screen.getByText("No matching tasks")).toBeInTheDocument();
    expect(screen.queryByText("No unscheduled tasks")).toBeNull();
  });

  it("offers no 'add and open' twin on the task tab (Schedule has no task editor — #297)", () => {
    renderPanel();
    openTaskTab();
    expect(screen.queryByText("Add and edit")).toBeNull();
  });
});

describe("ItemCreatePanel — shared draft across the type tabs (#376)", () => {
  it("keeps the typed title and the edited times when the type changes", () => {
    // Realising halfway through that this is a task, not an event, must not
    // cost the typing — that is why the drafts live on the panel.
    const { onCreateTask } = renderPanel();
    fireEvent.change(screen.getByPlaceholderText("Event title"), {
      target: { value: "Dentist" },
    });
    fireEvent.change(screen.getByLabelText("Start"), {
      target: { value: "13:00" },
    });
    fireEvent.change(screen.getByLabelText("End"), {
      target: { value: "13:30" },
    });
    openTaskTab();
    expect(
      (screen.getByPlaceholderText("Task title") as HTMLInputElement).value,
    ).toBe("Dentist");
    fireEvent.click(screen.getByText("Add task"));
    expect(onCreateTask).toHaveBeenCalledWith("Dentist", "13:00", "13:30");
  });
});
