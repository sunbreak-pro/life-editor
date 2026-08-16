import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  ItemCreatePanel,
  type ItemCreatePanelLabels,
  type ItemCreateOption,
  type ItemCreateSlot,
} from "../src/components";

/*
 * ItemCreatePanel (#376) — the unified creation panel behind the Desktop
 * overlay and the Mobile QuickCaptureSheet. Pure presentation: labels injected,
 * the four callbacks are the only mutations.
 *
 * These tests keep four contracts pinned:
 *   - the #299/#353/#354 event contract inherited from EventCreateFields
 *     (prefill, trimming, blank-title no-op, Enter = plain create, read-only
 *     target day),
 *   - the todo contract (new todo vs placing an existing one, and that both
 *     carry the panel's times),
 *   - the note contract (staging only — the note tab creates nothing on its
 *     own and never changes what the submit acts on),
 *   - the drafts survive a type-tab switch, which is the whole reason the
 *     title/time state lives on the panel rather than per tab.
 */

const LABELS: ItemCreatePanelLabels = {
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
  // Deliberately NOT "Note": the chip heading must not collide with the tab of
  // the same name, or a getByText here would silently match the wrong element
  // and the real UI would read as two different things called the same word.
  attachedNote: "Linked note",
  clearNote: "Remove the note",
};

const TODOS: ItemCreateOption[] = [
  { id: "task-1", title: "Draft the invoice" },
  { id: "task-2", title: "Review PR 376" },
  { id: "task-3", title: "Book the dentist" },
];

const NOTES: ItemCreateOption[] = [
  { id: "note-1", title: "Standup minutes" },
  { id: "note-2", title: "Weekly review" },
];

/** The day the host seeds the panel with, unless a case says otherwise. */
const DATE = "2026-08-20";

/**
 * The submit payload (#940). Every callback now carries one slot object
 * instead of a start/end pair, so the cases below say what they always said —
 * "with these times" — and the shape lives in one place.
 */
function slot(over?: Partial<ItemCreateSlot>): ItemCreateSlot {
  return {
    date: DATE,
    start: "09:00",
    end: "10:00",
    isAllDay: false,
    ...over,
  };
}

/**
 * #893 folded the panel's props into bundles (`initial` / `pools` /
 * `handlers`). The cases below still describe their setup in flat terms and
 * are unchanged from before that refactor — the folding happens here, which is
 * what makes "same cases, same assertions, still green" a usable no-behaviour-
 * change proof.
 *
 * Note this cannot be a `{...props}` spread any more: a spread would REPLACE a
 * whole bundle, so `{ existingTodos: [] }` would take the note pool down with
 * it. Each override merges into its bundle instead.
 */
function renderPanel(props?: {
  initialDate?: string;
  initialStart?: string;
  initialEnd?: string;
  initialTitle?: string;
  existingTodos?: ItemCreateOption[];
  existingNotes?: ItemCreateOption[];
}) {
  const onSubmitEvent = vi.fn();
  const onSubmitEventAndOpen = vi.fn();
  const onCreateTodo = vi.fn();
  const onPlaceTodo = vi.fn();
  render(
    <ItemCreatePanel
      initial={{
        date: props?.initialDate ?? DATE,
        start: props?.initialStart,
        end: props?.initialEnd,
        title: props?.initialTitle,
      }}
      pools={{
        todos: props?.existingTodos ?? TODOS,
        notes: props?.existingNotes ?? NOTES,
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
  return { onSubmitEvent, onSubmitEventAndOpen, onCreateTodo, onPlaceTodo };
}

/** Switch to the todo tab (and, optionally, to the existing-todo source). */
function openTodoTab(source?: "existing") {
  fireEvent.click(screen.getByText("Todo"));
  if (source === "existing") fireEvent.click(screen.getByText("From existing"));
}

/** Stage a brand-new note, then return to the tab that will do the creating. */
function stageNewNote(title: string, backTo: "Event" | "Todo") {
  fireEvent.click(screen.getByText("Note"));
  fireEvent.change(screen.getByLabelText("Note title"), {
    target: { value: title },
  });
  fireEvent.click(screen.getByText(backTo));
}

describe("ItemCreatePanel — event tab (inherited #299 / #353 / #354)", () => {
  it("opens on the event tab and submits the trimmed title with the default window", () => {
    const { onSubmitEvent } = renderPanel();
    fireEvent.change(screen.getByPlaceholderText("Event title"), {
      target: { value: "  Dentist  " },
    });
    fireEvent.click(screen.getByText("Add"));
    expect(onSubmitEvent).toHaveBeenCalledWith(
      "Dentist",
      slot({ start: "09:00", end: "10:00" }),
      null,
    );
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
    expect(onSubmitEvent).toHaveBeenCalledWith(
      "Meeting",
      slot({ start: "14:30", end: "15:30" }),
      null,
    );
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
      slot({ start: "14:00", end: "15:00" }),
      null,
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
    expect(onSubmitEvent).toHaveBeenCalledWith(
      "Standup",
      slot({ start: "09:00", end: "10:00" }),
      null,
    );
  });

  it("seeds the date field from the day the panel was opened on (#940)", () => {
    // #353 printed this day as a read-only caption; the gesture that opened
    // the panel WAS the day. It is an input now (#940), still seeded by that
    // gesture — the seed became a default rather than the only answer.
    renderPanel();
    const date = screen.getByLabelText("Date") as HTMLInputElement;
    expect(date.type).toBe("date");
    expect(date.value).toBe(DATE);
  });
});

/*
 * #940 — the day and the all-day switch. Before this the panel could only
 * create on the day it was opened from, so booking next Tuesday meant
 * navigating there first, and an all-day event could only be made by creating
 * a timed one and editing it afterwards.
 */
describe("ItemCreatePanel — date and all-day (#940)", () => {
  const setDate = (value: string) =>
    fireEvent.change(screen.getByLabelText("Date"), { target: { value } });
  const addEvent = (title: string) => {
    fireEvent.change(screen.getByPlaceholderText("Event title"), {
      target: { value: title },
    });
    fireEvent.click(screen.getByText("Add"));
  };

  it("creates on the day the user picked, not the one it opened on", () => {
    const { onSubmitEvent } = renderPanel();
    setDate("2026-09-01");
    addEvent("Dentist");
    expect(onSubmitEvent).toHaveBeenCalledWith(
      "Dentist",
      slot({ date: "2026-09-01" }),
      null,
    );
  });

  it("carries the chosen day into the todo paths too", () => {
    const { onCreateTodo, onPlaceTodo } = renderPanel();
    setDate("2026-09-02");
    openTodoTab();
    fireEvent.change(screen.getByPlaceholderText("Todo title"), {
      target: { value: "Write the report" },
    });
    fireEvent.click(screen.getByText("Add todo"));
    expect(onCreateTodo).toHaveBeenCalledWith(
      "Write the report",
      slot({ date: "2026-09-02" }),
      null,
    );

    fireEvent.click(screen.getByText("From existing"));
    fireEvent.click(screen.getByText("Draft the invoice"));
    fireEvent.click(screen.getByText("Place"));
    expect(onPlaceTodo).toHaveBeenCalledWith(
      "task-1",
      slot({ date: "2026-09-02" }),
      null,
    );
  });

  it("restores the opening day when the field is cleared to blank", () => {
    // A date input clears to "" mid-typing. Submitting that would create the
    // item on no day at all, which is never what the user meant.
    const { onSubmitEvent } = renderPanel();
    const date = screen.getByLabelText("Date");
    fireEvent.change(date, { target: { value: "" } });
    fireEvent.blur(date);
    expect((date as HTMLInputElement).value).toBe(DATE);
    addEvent("Dentist");
    expect(onSubmitEvent).toHaveBeenCalledWith("Dentist", slot(), null);
  });

  it("turns the times off screen while all-day is on, and submits the flag", () => {
    const { onSubmitEvent } = renderPanel();
    const toggle = screen.getByRole("switch", { name: "All day" });
    expect(toggle.getAttribute("aria-checked")).toBe("false");

    fireEvent.click(toggle);

    expect(toggle.getAttribute("aria-checked")).toBe("true");
    // Hidden rather than disabled, matching EventEditorPane: nothing reads
    // them, so leaving them on screen would make them look authoritative.
    expect(screen.queryByLabelText("Start")).toBeNull();
    expect(screen.queryByLabelText("End")).toBeNull();

    addEvent("Holiday");
    expect(onSubmitEvent).toHaveBeenCalledWith(
      "Holiday",
      slot({ isAllDay: true }),
      null,
    );
  });

  it("brings the times back when all-day is switched off again", () => {
    renderPanel();
    const toggle = screen.getByRole("switch", { name: "All day" });
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect((screen.getByLabelText("Start") as HTMLInputElement).value).toBe(
      "09:00",
    );
  });

  it("offers all-day on the event tab only, and cannot leak it into a todo", () => {
    // The switch is an event notion here (a todo has nowhere to show it), so
    // leaving it on and switching tabs must not smuggle the flag across.
    const { onCreateTodo } = renderPanel();
    fireEvent.click(screen.getByRole("switch", { name: "All day" }));
    openTodoTab();
    expect(screen.queryByRole("switch", { name: "All day" })).toBeNull();
    // The times are back, because the todo is timed whatever the event said.
    screen.getByLabelText("Start");

    fireEvent.change(screen.getByPlaceholderText("Todo title"), {
      target: { value: "Write the report" },
    });
    fireEvent.click(screen.getByText("Add todo"));
    expect(onCreateTodo).toHaveBeenCalledWith(
      "Write the report",
      slot({ isAllDay: false }),
      null,
    );
  });

  it("keeps the date across a type-tab switch, like the title and times", () => {
    const { onCreateTodo } = renderPanel();
    setDate("2026-09-03");
    openTodoTab();
    expect((screen.getByLabelText("Date") as HTMLInputElement).value).toBe(
      "2026-09-03",
    );
    fireEvent.change(screen.getByPlaceholderText("Todo title"), {
      target: { value: "Ship it" },
    });
    fireEvent.click(screen.getByText("Add todo"));
    expect(onCreateTodo).toHaveBeenCalledWith(
      "Ship it",
      slot({ date: "2026-09-03" }),
      null,
    );
  });
});

describe("ItemCreatePanel — todo tab (#376)", () => {
  it("creates a new todo with the panel's times", () => {
    const { onCreateTodo, onSubmitEvent } = renderPanel({
      initialStart: "11:00",
      initialEnd: "11:45",
    });
    openTodoTab();
    fireEvent.change(screen.getByPlaceholderText("Todo title"), {
      target: { value: "  Write the report  " },
    });
    fireEvent.click(screen.getByText("Add todo"));
    expect(onCreateTodo).toHaveBeenCalledWith(
      "Write the report",
      slot({ start: "11:00", end: "11:45" }),
      null,
    );
    expect(onSubmitEvent).not.toHaveBeenCalled();
  });

  it("Enter on the todo tab routes to the todo create, not the event create", () => {
    const { onCreateTodo, onSubmitEvent } = renderPanel();
    openTodoTab();
    const input = screen.getByPlaceholderText("Todo title");
    fireEvent.change(input, { target: { value: "Groceries" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCreateTodo).toHaveBeenCalledWith(
      "Groceries",
      slot({ start: "09:00", end: "10:00" }),
      null,
    );
    expect(onSubmitEvent).not.toHaveBeenCalled();
  });

  it("places an existing todo at the panel's times", () => {
    const { onPlaceTodo } = renderPanel({
      initialStart: "16:00",
      initialEnd: "17:00",
    });
    openTodoTab("existing");
    fireEvent.click(screen.getByText("Review PR 376"));
    fireEvent.click(screen.getByText("Place"));
    expect(onPlaceTodo).toHaveBeenCalledWith("task-2", slot({ start: "16:00", end: "17:00" }), null);
  });

  it("does nothing until a todo is picked", () => {
    const { onPlaceTodo } = renderPanel();
    openTodoTab("existing");
    fireEvent.click(screen.getByText("Place"));
    expect(onPlaceTodo).not.toHaveBeenCalled();
  });

  it("filters the pool by the search query, case-insensitively", () => {
    renderPanel();
    openTodoTab("existing");
    fireEvent.change(screen.getByLabelText("Search todos"), {
      target: { value: "invoice" },
    });
    expect(screen.getByText("Draft the invoice")).toBeInTheDocument();
    expect(screen.queryByText("Review PR 376")).toBeNull();
  });

  it("drops a selection the query has filtered away (never place an unseen todo)", () => {
    // Picking, then narrowing past the picked row, must not leave a live
    // selection behind: the submit would act on something off screen.
    const { onPlaceTodo } = renderPanel();
    openTodoTab("existing");
    fireEvent.click(screen.getByText("Draft the invoice"));
    fireEvent.change(screen.getByLabelText("Search todos"), {
      target: { value: "dentist" },
    });
    fireEvent.click(screen.getByText("Place"));
    expect(onPlaceTodo).not.toHaveBeenCalled();
  });

  it("says the pool itself is empty when there is nothing left to place", () => {
    renderPanel({ existingTodos: [] });
    openTodoTab("existing");
    expect(screen.getByText("No unscheduled todos")).toBeInTheDocument();
    expect(screen.queryByText("No matching todos")).toBeNull();
  });

  it("reports an empty search result separately from an empty pool", () => {
    renderPanel();
    openTodoTab("existing");
    fireEvent.change(screen.getByLabelText("Search todos"), {
      target: { value: "zzz" },
    });
    expect(screen.getByText("No matching todos")).toBeInTheDocument();
    expect(screen.queryByText("No unscheduled todos")).toBeNull();
  });

  it("offers no 'add and open' twin on the todo tab (Schedule has no todo editor — #297)", () => {
    renderPanel();
    openTodoTab();
    expect(screen.queryByText("Add and edit")).toBeNull();
  });
});

describe("ItemCreatePanel — the footer says when it cannot act (#376)", () => {
  it("disables both event buttons until the title has something in it", () => {
    renderPanel();
    expect(screen.getByText("Add")).toBeDisabled();
    expect(screen.getByText("Add and edit")).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText("Event title"), {
      target: { value: "Kickoff" },
    });
    expect(screen.getByText("Add")).toBeEnabled();
    expect(screen.getByText("Add and edit")).toBeEnabled();
  });

  it("disables the place button until a todo is picked", () => {
    renderPanel();
    openTodoTab("existing");
    expect(screen.getByText("Place")).toBeDisabled();
    fireEvent.click(screen.getByText("Draft the invoice"));
    expect(screen.getByText("Place")).toBeEnabled();
  });

  it("stays disabled on the note tab, where the missing field is off screen", () => {
    // The worst case for a silent no-op: the note tab hides both the title
    // field and the todo picker, so a lit-but-dead button would leave the user
    // with no way to see why nothing happened.
    renderPanel();
    openTodoTab("existing");
    fireEvent.click(screen.getByText("Note"));
    expect(screen.getByText("Place")).toBeDisabled();
  });
});

describe("ItemCreatePanel — note tab (#376 Step B)", () => {
  it("stages a new note and hands it to the event create", () => {
    const { onSubmitEvent } = renderPanel();
    stageNewNote("Minutes", "Event");
    fireEvent.change(screen.getByPlaceholderText("Event title"), {
      target: { value: "Kickoff" },
    });
    fireEvent.click(screen.getByText("Add"));
    expect(onSubmitEvent).toHaveBeenCalledWith("Kickoff", slot({ start: "09:00", end: "10:00" }), {
      kind: "new",
      title: "Minutes",
    });
  });

  it("stages an existing note by id", () => {
    const { onSubmitEvent } = renderPanel();
    fireEvent.click(screen.getByText("Note"));
    fireEvent.click(screen.getByText("From existing"));
    fireEvent.click(screen.getByText("Weekly review"));
    fireEvent.click(screen.getByText("Event"));
    fireEvent.change(screen.getByPlaceholderText("Event title"), {
      target: { value: "Kickoff" },
    });
    fireEvent.click(screen.getByText("Add"));
    expect(onSubmitEvent).toHaveBeenCalledWith("Kickoff", slot({ start: "09:00", end: "10:00" }), {
      kind: "existing",
      id: "note-2",
    });
  });

  it("rides along with the TODO create too", () => {
    const { onCreateTodo } = renderPanel();
    openTodoTab();
    stageNewNote("Prep", "Todo");
    fireEvent.change(screen.getByPlaceholderText("Todo title"), {
      target: { value: "Write the deck" },
    });
    fireEvent.click(screen.getByText("Add todo"));
    expect(onCreateTodo).toHaveBeenCalledWith(
      "Write the deck",
      slot({ start: "09:00", end: "10:00" }),
      { kind: "new", title: "Prep" },
    );
  });

  it("keeps the submit on the last event/todo tab while the note tab shows", () => {
    // The note tab creates nothing, so the footer must not go dead — it keeps
    // acting on whichever of event / todo was last open.
    const { onCreateTodo } = renderPanel();
    openTodoTab();
    fireEvent.change(screen.getByPlaceholderText("Todo title"), {
      target: { value: "Write the deck" },
    });
    fireEvent.click(screen.getByText("Note"));
    expect(screen.getByText("Add todo")).toBeInTheDocument();
    expect(screen.queryByText("Add and edit")).toBeNull();
    fireEvent.click(screen.getByText("Add todo"));
    expect(onCreateTodo).toHaveBeenCalledWith(
      "Write the deck",
      slot({ start: "09:00", end: "10:00" }),
      null,
    );
  });

  it("stages nothing when the note tab was opened but left blank", () => {
    // Opening the tab and changing your mind must not create an "Untitled".
    const { onSubmitEvent } = renderPanel();
    fireEvent.click(screen.getByText("Note"));
    fireEvent.click(screen.getByText("Event"));
    fireEvent.change(screen.getByPlaceholderText("Event title"), {
      target: { value: "Kickoff" },
    });
    fireEvent.click(screen.getByText("Add"));
    expect(onSubmitEvent).toHaveBeenCalledWith(
      "Kickoff",
      slot({ start: "09:00", end: "10:00" }),
      null,
    );
  });

  it("echoes the staged note on the event tab, and unstages it on demand", () => {
    // The note tab is one click away, so without the echo the attachment
    // would be invisible at the moment the user commits to it.
    const { onSubmitEvent } = renderPanel();
    stageNewNote("Minutes", "Event");
    expect(screen.getByText("Linked note")).toBeInTheDocument();
    expect(screen.getByText("Minutes")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Remove the note"));
    expect(screen.queryByText("Linked note")).toBeNull();
    fireEvent.change(screen.getByPlaceholderText("Event title"), {
      target: { value: "Kickoff" },
    });
    fireEvent.click(screen.getByText("Add"));
    expect(onSubmitEvent).toHaveBeenCalledWith(
      "Kickoff",
      slot({ start: "09:00", end: "10:00" }),
      null,
    );
  });

  it("keeps a staged note when the note search narrows past it", () => {
    // The opposite of the todo picker's rule, on purpose: a staged note is
    // carried to another tab and echoed back as a chip, so it stays visible
    // after the query moves on. Dropping it would lose the attachment
    // somewhere between picking it and submitting.
    const { onSubmitEvent } = renderPanel();
    fireEvent.click(screen.getByText("Note"));
    fireEvent.click(screen.getByText("From existing"));
    fireEvent.click(screen.getByText("Weekly review"));
    fireEvent.change(screen.getByLabelText("Search notes"), {
      target: { value: "standup" },
    });
    fireEvent.click(screen.getByText("Event"));
    expect(screen.getByText("Linked note")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Event title"), {
      target: { value: "Kickoff" },
    });
    fireEvent.click(screen.getByText("Add"));
    expect(onSubmitEvent).toHaveBeenCalledWith("Kickoff", slot({ start: "09:00", end: "10:00" }), {
      kind: "existing",
      id: "note-2",
    });
  });

  it("rides along when an EXISTING todo is placed", () => {
    const { onPlaceTodo } = renderPanel();
    openTodoTab("existing");
    fireEvent.click(screen.getByText("Draft the invoice"));
    stageNewNote("Prep", "Todo");
    fireEvent.click(screen.getByText("Place"));
    expect(onPlaceTodo).toHaveBeenCalledWith("task-1", slot({ start: "09:00", end: "10:00" }), {
      kind: "new",
      title: "Prep",
    });
  });

  it("says the note pool is empty regardless of the query", () => {
    renderPanel({ existingNotes: [] });
    fireEvent.click(screen.getByText("Note"));
    fireEvent.click(screen.getByText("From existing"));
    expect(screen.getByText("No notes yet")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search notes"), {
      target: { value: "zzz" },
    });
    expect(screen.getByText("No notes yet")).toBeInTheDocument();
    expect(screen.queryByText("No matching notes")).toBeNull();
  });
});

describe("ItemCreatePanel — shared draft across the type tabs (#376)", () => {
  it("keeps the typed title and the edited times when the type changes", () => {
    // Realising halfway through that this is a todo, not an event, must not
    // cost the typing — that is why the drafts live on the panel.
    const { onCreateTodo } = renderPanel();
    fireEvent.change(screen.getByPlaceholderText("Event title"), {
      target: { value: "Dentist" },
    });
    // #553: the TimeRangeField commits on blur/Enter, not per keystroke.
    const start = screen.getByLabelText("Start");
    fireEvent.change(start, { target: { value: "13:00" } });
    fireEvent.blur(start);
    const end = screen.getByLabelText("End");
    fireEvent.change(end, { target: { value: "13:30" } });
    fireEvent.blur(end);
    openTodoTab();
    expect(
      (screen.getByPlaceholderText("Todo title") as HTMLInputElement).value,
    ).toBe("Dentist");
    fireEvent.click(screen.getByText("Add todo"));
    expect(onCreateTodo).toHaveBeenCalledWith(
      "Dentist",
      slot({ start: "13:00", end: "13:30" }),
      null,
    );
  });
});
