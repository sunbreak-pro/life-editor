import { describe, it, expect, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  fireEvent,
  within,
} from "@testing-library/react";
import {
  ItemCreatePanel,
  type ItemCreatePanelLabels,
  type ItemCreateNotePickerPlacement,
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
 *   - the note contract (#1370: staging only, from a section BOTH tabs carry
 *     — attaching a note never changes what the submit acts on, and folding
 *     the section up never drops the note; #2396: any number of notes, as
 *     an array, `[]` for none),
 *   - the drafts survive a type-tab switch, which is the whole reason the
 *     title/time state lives on the panel rather than per tab.
 */

const LABELS: ItemCreatePanelLabels = {
  typeLabel: "Item type",
  typeEvent: "Event",
  typeTodo: "Todo",
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
  // #2406: worded apart from the event's "Add and edit" so a getByText here
  // proves WHICH twin the footer drew.
  addTodoAndOpen: "Add todo and edit",
  placeTodoAndOpen: "Place and edit",
  cancel: "Cancel",
  sourceLabel: "How to add",
  sourceNew: "New",
  sourceExisting: "From existing",
  searchTodos: "Search todos",
  todoPickerEmpty: "No unscheduled todos",
  todoPickerNoMatch: "No matching todos",
  attachNote: "Attach a note",
  noteSourceLabel: "Note to link",
  // #2396: the row's three buttons. Worded apart from the todo source's
  // "New" / "From existing", so a getByText here proves WHICH one it hit.
  noteSourceNew: "New note",
  noteSourceExisting: "Choose existing",
  noteDismiss: "Never mind",
  noteTitleLabel: "Note title",
  notePlaceholder: "Note title placeholder",
  noteNewConfirm: "Stage note",
  searchNotes: "Search notes",
  notePickerEmpty: "No notes yet",
  notePickerNoMatch: "No matching notes",
  notePickerTitle: "Choose notes",
  notePickerClose: "Close the picker",
  notePickerCount: (n: number) => `${n} selected`,
  notePickerDone: "Done",
  noteLocked: "Locked",
  noteLinkHint: "Linked to the item you add below.",
  // Deliberately NOT "Attach a note": the chip heading must not collide with
  // the disclosure trigger, or a getByText here would silently match the wrong
  // element and the real UI would read as two different things called the
  // same word. (Pre-#1370 the collision to avoid was the note TAB.)
  attachedNote: "Attached notes",
  removeNote: (title: string) => `Remove ${title}`,
};

const TODOS: ItemCreateOption[] = [
  { id: "task-1", title: "Draft the invoice" },
  { id: "task-2", title: "Review PR 376" },
  { id: "task-3", title: "Book the dentist" },
];

const NOTES: ItemCreateOption[] = [
  { id: "note-1", title: "Standup minutes" },
  { id: "note-2", title: "Weekly review" },
  // #2396: a password-protected note — drawn with a lock, still attachable.
  { id: "note-3", title: "Salary talk", isLocked: true },
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
  /** #2406: draw the event tab's repeat field. Off by default. */
  withRepeat?: boolean;
  /**
   * #2406: leave out the optional pieces (Cancel, the todo "and open"
   * twins) — what a host that predates them renders.
   */
  bare?: boolean;
  /** #2396: where the note picker opens. The panel's default otherwise. */
  notePicker?: ItemCreateNotePickerPlacement;
  onNotePickerOpenChange?: (open: boolean) => void;
}) {
  const onSubmitEvent = vi.fn();
  const onSubmitEventAndOpen = vi.fn();
  const onCreateTodo = vi.fn();
  const onPlaceTodo = vi.fn();
  const onCreateTodoAndOpen = vi.fn();
  const onPlaceTodoAndOpen = vi.fn();
  const onCancel = vi.fn();
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
        ...(props?.bare ? {} : { onCreateTodoAndOpen, onPlaceTodoAndOpen }),
      }}
      labels={LABELS}
      onCancel={props?.bare ? undefined : onCancel}
      repeat={
        props?.withRepeat
          ? { weekdayLabels: WEEKDAYS, labels: REPEAT_LABELS }
          : undefined
      }
      notePicker={props?.notePicker}
      onNotePickerOpenChange={props?.onNotePickerOpenChange}
    />,
  );
  return {
    onSubmitEvent,
    onSubmitEventAndOpen,
    onCreateTodo,
    onPlaceTodo,
    onCreateTodoAndOpen,
    onPlaceTodoAndOpen,
    onCancel,
  };
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const REPEAT_LABELS = {
  frequency: "Repeat",
  frequencyNone: "None",
  frequencyDaily: "Daily",
  frequencyWeekdays: "Weekdays",
  frequencyInterval: "Every N days",
  intervalEvery: "Every",
  intervalDays: "days",
  startDate: "Starts",
  endDate: "Ends",
};

/** The footer's buttons, left to right, by their text. */
function footerButtons(): string[] {
  const add = screen
    .getAllByRole("button")
    .find((b) => /^(Add|Add todo|Place)$/.test(b.textContent ?? ""));
  return Array.from(add?.parentElement?.children ?? []).map(
    (b) => b.textContent ?? "",
  );
}

/** Switch to the todo tab (and, optionally, to the existing-todo source). */
function openTodoTab(source?: "existing") {
  fireEvent.click(screen.getByText("Todo"));
  if (source === "existing") fireEvent.click(screen.getByText("From existing"));
}

/**
 * Stage a brand-new note through the row's 新規作成 (#2396), then fold the
 * row back up.
 */
function stageNewNote(title: string) {
  fireEvent.click(screen.getByText("Attach a note"));
  fireEvent.click(screen.getByText("New note"));
  fireEvent.change(screen.getByLabelText("Note title"), {
    target: { value: title },
  });
  fireEvent.click(screen.getByText("Stage note"));
  fireEvent.click(screen.getByText("Attach a note"));
}

/** Open 既存から選ぶ (#2396) from a folded row. */
function openNotePicker() {
  fireEvent.click(screen.getByText("Attach a note"));
  fireEvent.click(screen.getByText("Choose existing"));
}

/** The note picker's rows by title. */
function pickerOption(title: string): HTMLElement {
  const list = screen.getByRole("listbox", { name: "Choose notes" });
  return within(list).getByRole("option", { name: new RegExp(title) });
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
      [],
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
      [],
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
      [],
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
      [],
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
      [],
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
      [],
    );

    fireEvent.click(screen.getByText("From existing"));
    fireEvent.click(screen.getByText("Draft the invoice"));
    fireEvent.click(screen.getByText("Place"));
    expect(onPlaceTodo).toHaveBeenCalledWith(
      "task-1",
      slot({ date: "2026-09-02" }),
      [],
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
    expect(onSubmitEvent).toHaveBeenCalledWith("Dentist", slot(), []);
  });

  it("turns the times off screen while all-day is on, and submits the flag", () => {
    const { onSubmitEvent } = renderPanel();
    // #2406: a round check now, not the editor's switch.
    const toggle = screen.getByRole("checkbox", { name: "All day" });
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
      [],
    );
  });

  it("brings the times back when all-day is switched off again", () => {
    renderPanel();
    const toggle = screen.getByRole("checkbox", { name: "All day" });
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect((screen.getByLabelText("Start") as HTMLInputElement).value).toBe(
      "09:00",
    );
  });

  /*
   * #2406 reverses #940's "event only". A todo can be all-day — the tray's
   * "add to today" has always written that shape — so the check stays on
   * screen on the todo tab, keeps its state across the switch like the
   * times do, and reaches both todo paths.
   */
  it("offers all-day on the todo tab too, and carries it into a new todo", () => {
    const { onCreateTodo } = renderPanel();
    fireEvent.click(screen.getByRole("checkbox", { name: "All day" }));
    openTodoTab();
    const toggle = screen.getByRole("checkbox", { name: "All day" });
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    expect(screen.queryByLabelText("Start")).toBeNull();

    fireEvent.change(screen.getByPlaceholderText("Todo title"), {
      target: { value: "Write the report" },
    });
    fireEvent.click(screen.getByText("Add todo"));
    expect(onCreateTodo).toHaveBeenCalledWith(
      "Write the report",
      slot({ isAllDay: true }),
      [],
    );
  });

  it("places an existing todo all-day when the check is on", () => {
    const { onPlaceTodo } = renderPanel();
    openTodoTab("existing");
    fireEvent.click(screen.getByRole("checkbox", { name: "All day" }));
    fireEvent.click(screen.getByText("Draft the invoice"));
    fireEvent.click(screen.getByText("Place"));
    expect(onPlaceTodo).toHaveBeenCalledWith(
      "task-1",
      slot({ isAllDay: true }),
      [],
    );
  });

  it("draws all-day as a round check that Space toggles once", () => {
    renderPanel();
    const toggle = screen.getByRole("checkbox", { name: "All day" });
    // jsdom has no layout, so "round" is asserted on its lever (#2217: round
    // marks a state, square picks things).
    expect(toggle.querySelector("span")?.className).toContain("rounded-full");
    // A <button> turns Space into a click on keyup as well; one press must
    // still toggle exactly once.
    fireEvent.keyDown(toggle, { key: " " });
    fireEvent.keyUp(toggle, { key: " " });
    expect(toggle.getAttribute("aria-checked")).toBe("true");
  });

  it("puts the day, the two times and all-day on one line (#2406)", () => {
    renderPanel();
    const row = screen
      .getByLabelText("Date")
      .closest("label")?.parentElement as HTMLElement;
    expect(row.contains(screen.getByLabelText("Start"))).toBe(true);
    expect(row.contains(screen.getByLabelText("End"))).toBe(true);
    expect(
      row.contains(screen.getByRole("checkbox", { name: "All day" })),
    ).toBe(true);
    // Narrow sheets wrap the line instead of pushing it off the right edge.
    expect(row.className).toContain("flex-wrap");
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
      [],
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
      [],
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
      [],
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
    expect(onPlaceTodo).toHaveBeenCalledWith(
      "task-2",
      slot({ start: "16:00", end: "17:00" }),
      [],
    );
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

  /*
   * #2406: the todo tab has its "and open" twin now. #297's reason for
   * leaving it out — no todo editor in the Schedule — went away with #626's
   * in-Schedule todo detail.
   */
  it("routes the todo tab's second button to onCreateTodoAndOpen (#2406)", () => {
    const { onCreateTodo, onCreateTodoAndOpen } = renderPanel({
      initialStart: "11:00",
      initialEnd: "11:45",
    });
    openTodoTab();
    fireEvent.change(screen.getByPlaceholderText("Todo title"), {
      target: { value: "  Write the report  " },
    });
    fireEvent.click(screen.getByText("Add todo and edit"));
    expect(onCreateTodoAndOpen).toHaveBeenCalledWith(
      "Write the report",
      slot({ start: "11:00", end: "11:45" }),
      [],
    );
    expect(onCreateTodo).not.toHaveBeenCalled();
  });

  it("places the picked todo and opens it from the existing source (#2406)", () => {
    const { onPlaceTodo, onPlaceTodoAndOpen } = renderPanel();
    openTodoTab("existing");
    expect(screen.getByText("Place and edit")).toBeDisabled();
    fireEvent.click(screen.getByText("Review PR 376"));
    fireEvent.click(screen.getByText("Place and edit"));
    expect(onPlaceTodoAndOpen).toHaveBeenCalledWith("task-2", slot(), []);
    expect(onPlaceTodo).not.toHaveBeenCalled();
  });

  it("keeps Enter on the plain todo create, as on the event tab", () => {
    const { onCreateTodo, onCreateTodoAndOpen } = renderPanel();
    openTodoTab();
    const input = screen.getByPlaceholderText("Todo title");
    fireEvent.change(input, { target: { value: "Groceries" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCreateTodo).toHaveBeenCalledTimes(1);
    expect(onCreateTodoAndOpen).not.toHaveBeenCalled();
  });

  it("draws no todo twin for a host that wired none", () => {
    renderPanel({ bare: true });
    openTodoTab();
    expect(screen.queryByText("Add todo and edit")).toBeNull();
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

  it("sinks the disabled submit into the fill, and leaves the outline faded (#1803)", () => {
    /*
     * jsdom loads no stylesheet, so "does this look pressable" is not
     * observable here — the assertion is on the lever, exactly as
     * buttonDisabledFill.test.tsx puts it (#1474). Fading an accent fill keeps
     * the hue that reads as "press me", and in dark theme the faded accent
     * lands next to the live one.
     */
    renderPanel();

    const add = screen.getByText("Add").className;
    expect(add).not.toMatch(/disabled:opacity-\d/);
    expect(add).toContain("disabled:bg-lumen-surface-sunken");

    // The outline twin beside it shared one disabled string until #1803 split
    // them; it keeps the opacity because it has no fill to fade.
    const outline = screen.getByText("Add and edit").className;
    expect(outline).toContain("disabled:opacity-50");
  });

  it("disables the place button until a todo is picked", () => {
    renderPanel();
    openTodoTab("existing");
    expect(screen.getByText("Place")).toBeDisabled();
    fireEvent.click(screen.getByText("Draft the invoice"));
    expect(screen.getByText("Place")).toBeEnabled();
  });

  it("reads Cancel / Add and edit / Add on every tab and source (#2406)", () => {
    renderPanel();
    expect(footerButtons()).toEqual(["Cancel", "Add and edit", "Add"]);
    openTodoTab();
    expect(footerButtons()).toEqual([
      "Cancel",
      "Add todo and edit",
      "Add todo",
    ]);
    fireEvent.click(screen.getByText("From existing"));
    expect(footerButtons()).toEqual(["Cancel", "Place and edit", "Place"]);
  });

  it("cancels without writing anything, whatever was typed (#2406)", () => {
    const h = renderPanel();
    fireEvent.change(screen.getByPlaceholderText("Event title"), {
      target: { value: "Kickoff" },
    });
    fireEvent.click(screen.getByText("Cancel"));
    expect(h.onCancel).toHaveBeenCalledTimes(1);
    expect(h.onSubmitEvent).not.toHaveBeenCalled();
    expect(h.onSubmitEventAndOpen).not.toHaveBeenCalled();
    // Cancel is never disabled: closing needs nothing filled in.
    expect(screen.getByText("Cancel")).toBeEnabled();
  });

  it("draws no Cancel for a host that passes no onCancel", () => {
    renderPanel({ bare: true });
    expect(screen.queryByText("Cancel")).toBeNull();
  });

  it("stays disabled while the note section covers the missing field", () => {
    // A lit-but-dead button would leave the user with no way to see why
    // nothing happened. #1370 keeps the picker on screen beside the section,
    // so this now pins "opening the section does not accidentally enable it".
    renderPanel();
    openTodoTab("existing");
    fireEvent.click(screen.getByText("Attach a note"));
    expect(screen.getByText("Place")).toBeDisabled();
  });
});

/*
 * #2396 rebuilt the note section to the Claude Design proposal: 「ノートを添付」
 * opens a row of three buttons, 既存から選ぶ is a multi-select picker, and the
 * staged notes are chips. The submit carries every one of them as an array —
 * `[]` for none. These cases replace the #1370 ones that pinned a single
 * draft behind a new / existing toggle.
 */
describe("ItemCreatePanel — the note attachment (#1370 / #2396)", () => {
  it("offers the note attachment on the event tab and on the todo tab", () => {
    // The load-bearing change of #1370: the note is the panel's, not a tab's.
    renderPanel();
    fireEvent.click(screen.getByText("Attach a note"));
    screen.getByRole("group", { name: "Note to link" });
    fireEvent.click(screen.getByText("Todo"));
    screen.getByRole("group", { name: "Note to link" });
  });

  it("offers two type tabs, and no note tab (#1370)", () => {
    renderPanel();
    const tabs = screen.getAllByRole("tab").map((t) => t.textContent);
    expect(tabs).toEqual(["Event", "Todo"]);
  });

  it("opens a row of three buttons, and folds it on a second press", () => {
    renderPanel();
    const trigger = screen.getByRole("button", { name: "Attach a note" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("group", { name: "Note to link" })).toBeNull();

    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const row = screen.getByRole("group", { name: "Note to link" });
    expect(
      within(row)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["New note", "Choose existing", "Never mind"]);
    // 新規作成 is never a dead button (#2402 will change what it does, not
    // whether it can be pressed).
    expect(within(row).getByText("New note")).toBeEnabled();

    fireEvent.click(trigger);
    expect(screen.queryByRole("group", { name: "Note to link" })).toBeNull();
  });

  it("stages a new note and hands it to the event create", () => {
    const { onSubmitEvent } = renderPanel();
    stageNewNote("Minutes");
    fireEvent.change(screen.getByPlaceholderText("Event title"), {
      target: { value: "Kickoff" },
    });
    fireEvent.click(screen.getByText("Add"));
    expect(onSubmitEvent).toHaveBeenCalledWith("Kickoff", slot(), [
      { kind: "new", title: "Minutes" },
    ]);
  });

  it("stages a title on Enter, not on the Enter that confirms an IME conversion", () => {
    const { onSubmitEvent } = renderPanel();
    fireEvent.click(screen.getByText("Attach a note"));
    fireEvent.click(screen.getByText("New note"));
    const field = screen.getByLabelText("Note title");
    fireEvent.change(field, { target: { value: "議事録" } });
    fireEvent.keyDown(field, { key: "Enter", isComposing: true });
    fireEvent.keyDown(field, { key: "Enter", keyCode: 229 });
    expect(screen.queryByText("Attached notes")).toBeNull();

    fireEvent.keyDown(field, { key: "Enter" });
    // A chip, and the field is cleared for the next one — the panel itself
    // was not submitted.
    expect(screen.getByText("Attached notes")).toBeInTheDocument();
    expect((field as HTMLInputElement).value).toBe("");
    expect(onSubmitEvent).not.toHaveBeenCalled();
  });

  it("stages several new notes one after another", () => {
    const { onSubmitEvent } = renderPanel();
    fireEvent.click(screen.getByText("Attach a note"));
    fireEvent.click(screen.getByText("New note"));
    const field = screen.getByLabelText("Note title");
    for (const title of ["Agenda", "Minutes"]) {
      fireEvent.change(field, { target: { value: title } });
      fireEvent.click(screen.getByText("Stage note"));
    }
    fireEvent.change(screen.getByPlaceholderText("Event title"), {
      target: { value: "Kickoff" },
    });
    fireEvent.click(screen.getByText("Add"));
    expect(onSubmitEvent).toHaveBeenCalledWith("Kickoff", slot(), [
      { kind: "new", title: "Agenda" },
      { kind: "new", title: "Minutes" },
    ]);
  });

  it("picks several existing notes, and the submit carries them all", () => {
    const { onSubmitEvent } = renderPanel();
    openNotePicker();
    const list = screen.getByRole("listbox", { name: "Choose notes" });
    expect(list.getAttribute("aria-multiselectable")).toBe("true");
    fireEvent.click(pickerOption("Weekly review"));
    fireEvent.click(pickerOption("Standup minutes"));
    expect(pickerOption("Weekly review").getAttribute("aria-selected")).toBe(
      "true",
    );
    expect(pickerOption("Standup minutes").getAttribute("aria-selected")).toBe(
      "true",
    );
    fireEvent.click(screen.getByText("Done"));
    expect(screen.queryByRole("listbox", { name: "Choose notes" })).toBeNull();

    fireEvent.change(screen.getByPlaceholderText("Event title"), {
      target: { value: "Kickoff" },
    });
    fireEvent.click(screen.getByText("Add"));
    expect(onSubmitEvent).toHaveBeenCalledWith("Kickoff", slot(), [
      { kind: "existing", id: "note-2" },
      { kind: "existing", id: "note-1" },
    ]);
  });

  it("counts the picks as 'n selected' and lets a second press take one back", () => {
    renderPanel();
    openNotePicker();
    expect(screen.getByText("0 selected")).toBeInTheDocument();
    fireEvent.click(pickerOption("Weekly review"));
    fireEvent.click(pickerOption("Salary talk"));
    expect(screen.getByText("2 selected")).toBeInTheDocument();
    fireEvent.click(pickerOption("Weekly review"));
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(pickerOption("Weekly review").getAttribute("aria-selected")).toBe(
      "false",
    );
  });

  it("marks a locked note with a lock, and still lets it be attached", () => {
    const { onSubmitEvent } = renderPanel();
    openNotePicker();
    const locked = pickerOption("Salary talk");
    // The lock is aria-hidden; its words are what a screen reader hears.
    expect(locked.hasAttribute("data-locked")).toBe(true);
    expect(locked.textContent).toContain("Locked");
    expect(pickerOption("Weekly review").hasAttribute("data-locked")).toBe(
      false,
    );
    fireEvent.click(locked);
    fireEvent.click(screen.getByText("Done"));
    fireEvent.change(screen.getByPlaceholderText("Event title"), {
      target: { value: "1on1" },
    });
    fireEvent.click(screen.getByText("Add"));
    expect(onSubmitEvent).toHaveBeenCalledWith("1on1", slot(), [
      { kind: "existing", id: "note-3" },
    ]);
  });

  it("filters the picker by its search, and says when nothing matches", () => {
    renderPanel();
    openNotePicker();
    fireEvent.change(screen.getByLabelText("Search notes"), {
      target: { value: "weekly" },
    });
    expect(pickerOption("Weekly review")).toBeInTheDocument();
    expect(screen.queryByText("Standup minutes")).toBeNull();
    fireEvent.change(screen.getByLabelText("Search notes"), {
      target: { value: "zzz" },
    });
    expect(screen.getByText("No matching notes")).toBeInTheDocument();
  });

  it("says the note pool is empty regardless of the query", () => {
    renderPanel({ existingNotes: [] });
    openNotePicker();
    expect(screen.getByText("No notes yet")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search notes"), {
      target: { value: "zzz" },
    });
    expect(screen.getByText("No notes yet")).toBeInTheDocument();
    expect(screen.queryByText("No matching notes")).toBeNull();
  });

  it("keeps the staged picks when the picker is closed with × instead of Done", () => {
    // × is "leave it as it was", Done is "use this" — two exits, two meanings.
    const { onSubmitEvent } = renderPanel();
    openNotePicker();
    fireEvent.click(pickerOption("Weekly review"));
    fireEvent.click(screen.getByText("Done"));

    fireEvent.click(screen.getByText("Choose existing"));
    // It reopens on what is staged now.
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    fireEvent.click(pickerOption("Standup minutes"));
    fireEvent.click(screen.getByLabelText("Close the picker"));

    fireEvent.change(screen.getByPlaceholderText("Event title"), {
      target: { value: "Kickoff" },
    });
    fireEvent.click(screen.getByText("Add"));
    expect(onSubmitEvent).toHaveBeenCalledWith("Kickoff", slot(), [
      { kind: "existing", id: "note-2" },
    ]);
  });

  it("closes only the picker on Esc", () => {
    renderPanel();
    openNotePicker();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("listbox", { name: "Choose notes" })).toBeNull();
    // The row it was opened from is still there.
    screen.getByRole("group", { name: "Note to link" });
  });

  it("shows every staged note as a chip, and × takes one off", () => {
    const { onSubmitEvent } = renderPanel();
    stageNewNote("Minutes");
    openNotePicker();
    fireEvent.click(pickerOption("Weekly review"));
    fireEvent.click(screen.getByText("Done"));
    fireEvent.click(screen.getByText("Attach a note"));

    // Folded, the chips stay: they are where a note is taken off again.
    expect(screen.getByText("Attached notes")).toBeInTheDocument();
    expect(screen.getByText("Minutes")).toBeInTheDocument();
    expect(screen.getByText("Weekly review")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Remove Minutes"));
    expect(screen.queryByText("Minutes")).toBeNull();
    fireEvent.change(screen.getByPlaceholderText("Event title"), {
      target: { value: "Kickoff" },
    });
    fireEvent.click(screen.getByText("Add"));
    expect(onSubmitEvent).toHaveBeenCalledWith("Kickoff", slot(), [
      { kind: "existing", id: "note-2" },
    ]);
  });

  it("rides along with the TODO create too", () => {
    const { onCreateTodo } = renderPanel();
    openTodoTab();
    stageNewNote("Prep");
    fireEvent.change(screen.getByPlaceholderText("Todo title"), {
      target: { value: "Write the deck" },
    });
    fireEvent.click(screen.getByText("Add todo"));
    expect(onCreateTodo).toHaveBeenCalledWith("Write the deck", slot(), [
      { kind: "new", title: "Prep" },
    ]);
  });

  it("rides along when an EXISTING todo is placed", () => {
    const { onPlaceTodo } = renderPanel();
    openTodoTab("existing");
    fireEvent.click(screen.getByText("Draft the invoice"));
    openNotePicker();
    fireEvent.click(pickerOption("Weekly review"));
    fireEvent.click(screen.getByText("Done"));
    fireEvent.click(screen.getByText("Place"));
    expect(onPlaceTodo).toHaveBeenCalledWith("task-1", slot(), [
      { kind: "existing", id: "note-2" },
    ]);
  });

  it("leaves the footer and the title field alone while the note row is open", () => {
    const { onCreateTodo } = renderPanel();
    openTodoTab();
    fireEvent.change(screen.getByPlaceholderText("Todo title"), {
      target: { value: "Write the deck" },
    });
    fireEvent.click(screen.getByText("Attach a note"));
    // Unlike the old note TAB, the section is additive: the field the submit
    // depends on is still on screen.
    expect(
      (screen.getByPlaceholderText("Todo title") as HTMLInputElement).value,
    ).toBe("Write the deck");
    expect(footerButtons()).toEqual([
      "Cancel",
      "Add todo and edit",
      "Add todo",
    ]);
    fireEvent.click(screen.getByText("Add todo"));
    expect(onCreateTodo).toHaveBeenCalledWith("Write the deck", slot(), []);
  });

  it("carries a typed but unconfirmed title, and nothing for a blank one", () => {
    const { onSubmitEvent } = renderPanel();
    fireEvent.click(screen.getByText("Attach a note"));
    fireEvent.click(screen.getByText("New note"));
    // Opening the field and leaving it blank must not create an "Untitled".
    fireEvent.change(screen.getByPlaceholderText("Event title"), {
      target: { value: "Kickoff" },
    });
    fireEvent.click(screen.getByText("Add"));
    expect(onSubmitEvent).toHaveBeenLastCalledWith("Kickoff", slot(), []);

    // What is on screen is what rides along, confirmed or not.
    fireEvent.change(screen.getByLabelText("Note title"), {
      target: { value: "  Minutes  " },
    });
    fireEvent.click(screen.getByText("Add"));
    expect(onSubmitEvent).toHaveBeenLastCalledWith("Kickoff", slot(), [
      { kind: "new", title: "Minutes" },
    ]);
  });

  it("folding the row turns a typed title into a chip", () => {
    renderPanel();
    fireEvent.click(screen.getByText("Attach a note"));
    fireEvent.click(screen.getByText("New note"));
    fireEvent.change(screen.getByLabelText("Note title"), {
      target: { value: "Minutes" },
    });
    fireEvent.click(screen.getByText("Attach a note"));
    expect(screen.getByText("Attached notes")).toBeInTheDocument();
    expect(screen.getByText("Minutes")).toBeInTheDocument();
  });

  it("'Never mind' closes the row and drops the unconfirmed title, not the chips", () => {
    const { onSubmitEvent } = renderPanel();
    stageNewNote("Minutes");
    fireEvent.click(screen.getByText("Attach a note"));
    fireEvent.click(screen.getByText("New note"));
    fireEvent.change(screen.getByLabelText("Note title"), {
      target: { value: "Half typed" },
    });
    fireEvent.click(screen.getByText("Never mind"));
    expect(screen.queryByRole("group", { name: "Note to link" })).toBeNull();
    fireEvent.change(screen.getByPlaceholderText("Event title"), {
      target: { value: "Kickoff" },
    });
    fireEvent.click(screen.getByText("Add"));
    expect(onSubmitEvent).toHaveBeenCalledWith("Kickoff", slot(), [
      { kind: "new", title: "Minutes" },
    ]);
  });

  it("starts with nothing staged every time the dialog is opened again", () => {
    // Both frames unmount the panel on close, so a reopening is a new mount.
    const first = renderPanel();
    stageNewNote("Minutes");
    openNotePicker();
    fireEvent.click(pickerOption("Weekly review"));
    fireEvent.click(screen.getByText("Done"));
    expect(screen.getByText("Attached notes")).toBeInTheDocument();
    cleanup();

    const again = renderPanel();
    expect(screen.queryByText("Attached notes")).toBeNull();
    fireEvent.click(screen.getByText("Attach a note"));
    fireEvent.click(screen.getByText("Choose existing"));
    expect(screen.getByText("0 selected")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Close the picker"));
    fireEvent.change(screen.getByPlaceholderText("Event title"), {
      target: { value: "Kickoff" },
    });
    fireEvent.click(screen.getByText("Add"));
    expect(again.onSubmitEvent).toHaveBeenCalledWith("Kickoff", slot(), []);
    expect(first.onSubmitEvent).not.toHaveBeenCalled();
  });
});

/*
 * #2396 — where the picker opens. Desktop puts a 20rem panel beside the form
 * and widens its frame for it; Mobile puts a sheet over the create sheet. The
 * panel itself only places the picker and reports it open; the frame does
 * the widening (web/tests/scheduleOverlays.test.tsx).
 */
describe("ItemCreatePanel — where the note picker opens (#2396)", () => {
  it("puts the side picker beside the form, 20rem wide", () => {
    renderPanel({ notePicker: "side" });
    openNotePicker();
    const picker = screen.getByRole("region", { name: "Choose notes" });
    expect(picker.getAttribute("data-note-picker")).toBe("side");
    expect(picker.className).toContain("w-80");
    // A sibling of the form column, not inside it.
    const form = screen.getByPlaceholderText("Event title").closest(
      ".flex-col",
    ) as HTMLElement;
    expect(form.contains(picker)).toBe(false);
    expect(picker.parentElement).toBe(form.parentElement);
    // Headed, with its own ×.
    expect(within(picker).getByText("Choose notes").tagName).toBe("H3");
    within(picker).getByLabelText("Close the picker");
  });

  it("reports the picker open and closed, and closed again on unmount", () => {
    const onOpenChange = vi.fn();
    renderPanel({ notePicker: "side", onNotePickerOpenChange: onOpenChange });
    expect(onOpenChange).not.toHaveBeenCalled();
    openNotePicker();
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByText("Done"));
    expect(onOpenChange).toHaveBeenLastCalledWith(false);

    fireEvent.click(screen.getByText("Choose existing"));
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    cleanup();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("opens the Mobile picker as a sheet of its own", () => {
    renderPanel({ notePicker: "sheet" });
    openNotePicker();
    const sheet = screen.getByRole("dialog", { name: "Choose notes" });
    expect(sheet.getAttribute("aria-modal")).toBe("true");
    within(sheet).getByRole("listbox", { name: "Choose notes" });
    within(sheet).getByText("0 selected");
    // The sheet's own close is its ×.
    fireEvent.click(within(sheet).getByLabelText("Close the picker"));
    expect(screen.queryByRole("dialog", { name: "Choose notes" })).toBeNull();
  });

  it("keeps the inline picker inside the form for a host that says nothing", () => {
    renderPanel();
    openNotePicker();
    const picker = screen.getByRole("region", { name: "Choose notes" });
    expect(picker.getAttribute("data-note-picker")).toBe("inline");
    expect(picker.className).not.toContain("w-80");
  });
});

/*
 * #2406 — a repeat picked while the event is created. The panel only holds
 * the choice; the host turns the saved row into a series. A todo has no repeat
 * (neither the type nor the table carries one), so the todo tab has no field
 * and never sends one.
 */
describe("ItemCreatePanel — the repeat (#2406)", () => {
  const repeatTabs = () =>
    within(screen.getByRole("tablist", { name: "Repeat" }));
  const addEvent = (title: string) => {
    fireEvent.change(screen.getByPlaceholderText("Event title"), {
      target: { value: title },
    });
    fireEvent.click(screen.getByText("Add"));
  };

  it("starts on 'None' and sends no repeat", () => {
    const { onSubmitEvent } = renderPanel({ withRepeat: true });
    expect(
      repeatTabs().getByRole("tab", { name: "None" }).getAttribute(
        "aria-selected",
      ),
    ).toBe("true");
    addEvent("Standup");
    expect(onSubmitEvent).toHaveBeenCalledWith("Standup", slot(), []);
    expect(onSubmitEvent.mock.calls[0][1]).not.toHaveProperty("repeat");
  });

  it("carries the picked rhythm on the slot", () => {
    const { onSubmitEvent } = renderPanel({ withRepeat: true });
    fireEvent.click(repeatTabs().getByRole("tab", { name: "Daily" }));
    addEvent("Standup");
    expect(onSubmitEvent).toHaveBeenCalledWith(
      "Standup",
      slot({
        repeat: {
          frequencyType: "daily",
          frequencyDays: [],
          frequencyInterval: null,
          frequencyStartDate: null,
          frequencyEndDate: null,
        },
      }),
      [],
    );
  });

  it("seeds weekdays with the item's own day, so the series fires", () => {
    // 2026-08-20 is a Thursday (4). A bare "weekdays" would fire never.
    const { onSubmitEventAndOpen } = renderPanel({ withRepeat: true });
    fireEvent.click(repeatTabs().getByRole("tab", { name: "Weekdays" }));
    fireEvent.change(screen.getByPlaceholderText("Event title"), {
      target: { value: "Gym" },
    });
    fireEvent.click(screen.getByText("Add and edit"));
    expect(onSubmitEventAndOpen.mock.calls[0][1].repeat).toMatchObject({
      frequencyType: "weekdays",
      frequencyDays: [4],
    });
  });

  it("drops the repeat again when 'None' is picked", () => {
    const { onSubmitEvent } = renderPanel({ withRepeat: true });
    fireEvent.click(repeatTabs().getByRole("tab", { name: "Daily" }));
    fireEvent.click(repeatTabs().getByRole("tab", { name: "None" }));
    addEvent("Standup");
    expect(onSubmitEvent.mock.calls[0][1]).not.toHaveProperty("repeat");
  });

  it("offers no repeat on the todo tab, and never sends one with a todo", () => {
    const { onCreateTodo, onPlaceTodo } = renderPanel({ withRepeat: true });
    fireEvent.click(repeatTabs().getByRole("tab", { name: "Daily" }));
    openTodoTab();
    expect(screen.queryByRole("tablist", { name: "Repeat" })).toBeNull();
    fireEvent.change(screen.getByPlaceholderText("Todo title"), {
      target: { value: "Write the report" },
    });
    fireEvent.click(screen.getByText("Add todo"));
    expect(onCreateTodo.mock.calls[0][1]).not.toHaveProperty("repeat");

    fireEvent.click(screen.getByText("From existing"));
    fireEvent.click(screen.getByText("Draft the invoice"));
    fireEvent.click(screen.getByText("Place"));
    expect(onPlaceTodo.mock.calls[0][1]).not.toHaveProperty("repeat");
  });

  it("keeps the picked rhythm across a round trip through the todo tab", () => {
    const { onSubmitEvent } = renderPanel({ withRepeat: true });
    fireEvent.click(repeatTabs().getByRole("tab", { name: "Daily" }));
    openTodoTab();
    fireEvent.click(screen.getByText("Event"));
    addEvent("Standup");
    expect(onSubmitEvent.mock.calls[0][1].repeat).toMatchObject({
      frequencyType: "daily",
    });
  });

  it("draws no repeat field for a host that passes none", () => {
    renderPanel();
    expect(screen.queryByRole("tablist", { name: "Repeat" })).toBeNull();
  });
});

/*
 * #2426 — the repeat follows the date being added. It used to be seeded once,
 * when the rhythm was picked, so a date changed afterwards booked the event on
 * a weekday its own series did not fire on, or before its own start date.
 *
 * DATE (2026-08-20) is a Thursday (4); 08-24 is a Monday (1), 08-25 a Tuesday.
 */
describe("ItemCreatePanel — the repeat follows the date (#2426)", () => {
  const pickRepeat = (name: string) =>
    fireEvent.click(
      within(screen.getByRole("tablist", { name: "Repeat" })).getByRole("tab", {
        name,
      }),
    );
  const changeDate = (value: string) =>
    fireEvent.change(screen.getByLabelText("Date"), { target: { value } });
  const toggleWeekday = (name: string) =>
    fireEvent.click(screen.getByRole("button", { name }));
  const pressedWeekdays = () =>
    ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].filter(
      (name) =>
        screen.getByRole("button", { name }).getAttribute("aria-pressed") ===
        "true",
    );
  const startField = () => screen.getByLabelText("Starts") as HTMLInputElement;
  /** What the "Add" press hands the host. */
  const addedRepeat = (onSubmitEvent: ReturnType<typeof vi.fn>) => {
    fireEvent.change(screen.getByPlaceholderText("Event title"), {
      target: { value: "Gym" },
    });
    fireEvent.click(screen.getByText("Add"));
    return onSubmitEvent.mock.calls[0][1].repeat;
  };

  it("moves a seeded weekday to the new date's weekday", () => {
    const { onSubmitEvent } = renderPanel({ withRepeat: true });
    pickRepeat("Weekdays");
    expect(pressedWeekdays()).toEqual(["Th"]);
    changeDate("2026-08-24");
    expect(pressedWeekdays()).toEqual(["Mo"]);
    expect(addedRepeat(onSubmitEvent)).toMatchObject({
      frequencyType: "weekdays",
      frequencyDays: [1],
    });
  });

  it("moves a seeded start date to the new date", () => {
    const { onSubmitEvent } = renderPanel({ withRepeat: true });
    pickRepeat("Every N days");
    expect(startField().value).toBe(DATE);
    changeDate("2026-08-24");
    expect(startField().value).toBe("2026-08-24");
    expect(addedRepeat(onSubmitEvent)).toMatchObject({
      frequencyType: "interval",
      frequencyInterval: 1,
      frequencyStartDate: "2026-08-24",
    });
    expect(onSubmitEvent.mock.calls[0][1].date).toBe("2026-08-24");
  });

  it("keeps weekdays picked by hand and adds the new date's weekday", () => {
    const { onSubmitEvent } = renderPanel({ withRepeat: true });
    pickRepeat("Weekdays");
    toggleWeekday("Sa");
    changeDate("2026-08-24");
    expect(pressedWeekdays()).toEqual(["Mo", "Th", "Sa"]);
    expect(addedRepeat(onSubmitEvent).frequencyDays).toEqual([1, 4, 6]);
  });

  it("does not pile up the weekdays of dates passed through on the way", () => {
    // A date input typed by keyboard reports every intermediate date.
    renderPanel({ withRepeat: true });
    pickRepeat("Weekdays");
    toggleWeekday("Sa");
    changeDate("2026-08-24");
    changeDate("2026-08-25");
    expect(pressedWeekdays()).toEqual(["Tu", "Th", "Sa"]);
    changeDate(DATE);
    expect(pressedWeekdays()).toEqual(["Th", "Sa"]);
  });

  it("leaves a hand-picked set alone while the date stays put", () => {
    // Taking the date's own weekday out is the user's call (no date changed).
    const { onSubmitEvent } = renderPanel({ withRepeat: true });
    pickRepeat("Weekdays");
    toggleWeekday("Sa");
    toggleWeekday("Th");
    expect(pressedWeekdays()).toEqual(["Sa"]);
    expect(addedRepeat(onSubmitEvent).frequencyDays).toEqual([6]);
  });

  it("follows the date again once the set is back to the seeded weekday", () => {
    renderPanel({ withRepeat: true });
    pickRepeat("Weekdays");
    toggleWeekday("Sa");
    toggleWeekday("Sa");
    changeDate("2026-08-24");
    expect(pressedWeekdays()).toEqual(["Mo"]);
  });

  it("keeps zero weekdays at zero when the date changes", () => {
    // Adding with no weekday is the editor's existing spec (out of #2426).
    const { onSubmitEvent } = renderPanel({ withRepeat: true });
    pickRepeat("Weekdays");
    toggleWeekday("Th");
    changeDate("2026-08-24");
    expect(pressedWeekdays()).toEqual([]);
    expect(addedRepeat(onSubmitEvent).frequencyDays).toEqual([]);
  });

  it("keeps a start date typed by hand when the date changes", () => {
    const { onSubmitEvent } = renderPanel({ withRepeat: true });
    pickRepeat("Every N days");
    fireEvent.change(startField(), { target: { value: "2026-08-10" } });
    changeDate("2026-08-24");
    expect(startField().value).toBe("2026-08-10");
    expect(addedRepeat(onSubmitEvent).frequencyStartDate).toBe("2026-08-10");
  });

  it("does not carry a start date into a rhythm that has no start field", () => {
    // The host reads a start on ANY rhythm, so a hidden one would begin the
    // daily series on the old date, before the event being added.
    const { onSubmitEvent } = renderPanel({ withRepeat: true });
    pickRepeat("Every N days");
    pickRepeat("Daily");
    changeDate("2026-08-24");
    expect(addedRepeat(onSubmitEvent)).toMatchObject({
      frequencyType: "daily",
      frequencyStartDate: null,
    });
  });

  it("seeds from the current date after a detour through another rhythm", () => {
    renderPanel({ withRepeat: true });
    pickRepeat("Weekdays");
    pickRepeat("Every N days");
    changeDate("2026-08-24");
    expect(startField().value).toBe("2026-08-24");
    pickRepeat("Weekdays");
    expect(pressedWeekdays()).toEqual(["Mo"]);
    pickRepeat("Daily");
    changeDate("2026-08-25");
    pickRepeat("Every N days");
    expect(startField().value).toBe("2026-08-25");
  });

  it("reads a cleared date as the day blur will restore", () => {
    // A cleared date input reports "" until blur puts the opening day back.
    renderPanel({ withRepeat: true });
    pickRepeat("Weekdays");
    changeDate("");
    expect(pressedWeekdays()).toEqual(["Th"]);
    fireEvent.blur(screen.getByLabelText("Date"));
    expect(pressedWeekdays()).toEqual(["Th"]);
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
      [],
    );
  });
});
