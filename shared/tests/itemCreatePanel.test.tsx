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
  type ItemCreatePanelHandlers,
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
  noteRowPrompt: "What about a note?",
  noteTitleLabel: "Note title",
  notePlaceholder: "Note title placeholder",
  noteNewConfirm: "Stage note",
  searchNotes: "Search notes",
  notePickerEmpty: "No notes yet",
  notePickerNoMatch: "No matching notes",
  notePickerTitle: "Choose notes",
  notePickerClose: "Close the picker",
  notePickerCount: (n: number) => `${n} selected`,
  // #2573: the empty foot, worded apart from the count so a getByText here
  // proves which of the two the foot drew.
  notePickerNone: "Pick notes to attach them",
  noteUpdated: (updatedAt: string) => `Updated ${updatedAt.slice(0, 10)}`,
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
  {
    id: "note-1",
    title: "Standup minutes",
    updatedAt: "2026-10-10T09:00:00.000Z",
  },
  {
    id: "note-2",
    title: "Weekly review",
    updatedAt: "2026-10-08T09:00:00.000Z",
  },
  // #2396: a password-protected note — drawn with a lock, still attachable.
  // #2573: no `updatedAt`, so its row draws no "updated" line.
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
  /** #2402: the handler that makes 新規作成 act at once. */
  onCreateMemoNote?: ItemCreatePanelHandlers["onCreateMemoNote"];
  /** #2573: labels other than the fixture's. */
  labels?: ItemCreatePanelLabels;
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
        onCreateMemoNote: props?.onCreateMemoNote,
      }}
      labels={props?.labels ?? LABELS}
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
    fireEvent.change(screen.getByLabelText("Title"), {
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
    fireEvent.change(screen.getByLabelText("Title"), {
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
    fireEvent.change(screen.getByLabelText("Title"), {
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
    const input = screen.getByLabelText("Title");
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
    const input = screen.getByLabelText("Title");
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
    fireEvent.change(screen.getByLabelText("Title"), {
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
    fireEvent.change(screen.getByLabelText("Title"), {
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

    fireEvent.change(screen.getByLabelText("Title"), {
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
    fireEvent.change(screen.getByLabelText("Title"), {
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
    fireEvent.change(screen.getByLabelText("Title"), {
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
    const input = screen.getByLabelText("Title");
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
    fireEvent.change(screen.getByLabelText("Title"), {
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
    const input = screen.getByLabelText("Title");
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

/*
 * #2406: the event tab's 「既存から選ぶ」, as the proposal draws it — a search
 * field and a list in place of the title, the date line and the repeat. The
 * panel only says which event; what that writes is the host's (a copy, never
 * the original — useScheduleCreateFlow.test.tsx).
 */
describe("ItemCreatePanel — an existing event (#2406)", () => {
  const EVENTS: ItemCreateOption[] = [
    { id: "evt-1", title: "Team sync" },
    { id: "evt-2", title: "Dentist" },
  ];

  function renderExisting(over?: {
    options?: ItemCreateOption[];
    withoutHandler?: boolean;
    withoutPool?: boolean;
    empty?: string;
  }) {
    const onCopyEvent = vi.fn();
    const onCopyEventAndOpen = vi.fn();
    const onSubmitEvent = vi.fn();
    const onOpen = vi.fn();
    const onStagedChange = vi.fn();
    render(
      <ItemCreatePanel
        initial={{ date: DATE }}
        pools={{
          todos: TODOS,
          notes: NOTES,
          tags: {
            tags: [
              { id: "tag-work", name: "Work" },
              { id: "tag-home", name: "Home" },
            ],
            // What the plain field would seed from. The event's own seed below
            // must win, or a repeat's series tags would go missing.
            tagsOf: () => ["tag-home"],
            onStagedChange,
            labels: {
              field: "Tags",
              add: "Add a tag",
              remove: (name: string) => `Remove ${name}`,
              empty: "No tags",
            },
          },
          events: over?.withoutPool
            ? undefined
            : {
                options: over?.options ?? EVENTS,
                tagsOf: (id: string) => (id === "evt-1" ? ["tag-work"] : []),
                onOpen,
                labels: {
                  search: "Search events",
                  empty: over?.empty ?? "No events",
                  noMatch: "No matching events",
                },
              },
        }}
        handlers={{
          onSubmitEvent,
          onSubmitEventAndOpen: vi.fn(),
          onCreateTodo: vi.fn(),
          onPlaceTodo: vi.fn(),
          ...(over?.withoutHandler ? {} : { onCopyEvent, onCopyEventAndOpen }),
        }}
        labels={LABELS}
        onCancel={vi.fn()}
        repeat={{ weekdayLabels: WEEKDAYS, labels: REPEAT_LABELS }}
      />,
    );
    return {
      onCopyEvent,
      onCopyEventAndOpen,
      onSubmitEvent,
      onOpen,
      onStagedChange,
    };
  }

  const chooseExisting = () =>
    fireEvent.click(screen.getByRole("radio", { name: "From existing" }));
  const row = (name: string) => screen.getByRole("option", { name });

  it("offers the source only where both the list and the handler are wired", () => {
    renderExisting({ withoutPool: true });
    expect(screen.queryByText("From existing")).toBeNull();
    cleanup();
    renderExisting({ withoutHandler: true });
    expect(screen.queryByText("From existing")).toBeNull();
    cleanup();
    renderExisting();
    expect(screen.getByText("From existing")).toBeInTheDocument();
  });

  it("swaps the title, the date line and the repeat for the search and the list", () => {
    const { onOpen } = renderExisting();
    expect(onOpen).not.toHaveBeenCalled();
    chooseExisting();
    expect(onOpen).toHaveBeenCalledTimes(1);

    expect(screen.queryByLabelText("Title")).toBeNull();
    expect(screen.getByLabelText("Date").closest("[hidden]")).not.toBeNull();
    expect(screen.queryByText("Daily")).toBeNull();
    expect(screen.getByLabelText("Search events")).toBeInTheDocument();
    expect(row("Team sync")).toBeInTheDocument();
    expect(footerButtons()).toEqual(["Cancel", "Add and edit", "Add"]);
  });

  it("brings the form back as it was when the source goes back to new", () => {
    renderExisting();
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Half typed" },
    });
    chooseExisting();
    fireEvent.click(screen.getByRole("radio", { name: "New" }));
    expect(screen.getByLabelText("Title")).toHaveValue("Half typed");
    expect(screen.getByLabelText("Date").closest("[hidden]")).toBeNull();
    expect(screen.getByText("Daily")).toBeInTheDocument();
  });

  it("does not move the todo tab's source along with it", () => {
    renderExisting();
    chooseExisting();
    fireEvent.click(screen.getByText("Todo"));
    expect(screen.getByRole("radio", { name: "New" })).toBeChecked();
    expect(screen.getByLabelText("Title")).toBeInTheDocument();
  });

  it("keeps both submits off until a row is picked", () => {
    const { onCopyEvent, onSubmitEvent } = renderExisting();
    chooseExisting();
    expect(screen.getByText("Add")).toBeDisabled();
    expect(screen.getByText("Add and edit")).toBeDisabled();
    fireEvent.click(row("Dentist"));
    expect(screen.getByText("Add")).toBeEnabled();
    expect(screen.getByText("Add and edit")).toBeEnabled();
    expect(onCopyEvent).not.toHaveBeenCalled();
    expect(onSubmitEvent).not.toHaveBeenCalled();
  });

  it("highlights the picked row and shows its tags under the list", () => {
    const { onStagedChange } = renderExisting();
    chooseExisting();
    // No tag row until there is an event for it to speak of.
    expect(screen.queryByText("Tags")).toBeNull();

    fireEvent.click(row("Team sync"));
    expect(row("Team sync")).toHaveAttribute("aria-selected", "true");
    expect(row("Team sync").className).toContain("bg-lumen-accent-subtle");
    expect(screen.getByText("Work")).toBeInTheDocument();
    expect(screen.getByText("Add a tag")).toBeInTheDocument();
    expect(onStagedChange).toHaveBeenLastCalledWith(["tag-work"]);
  });

  it("starts the tags over from the next event when the pick changes", () => {
    const { onStagedChange } = renderExisting();
    chooseExisting();
    fireEvent.click(row("Team sync"));
    fireEvent.click(row("Dentist"));
    expect(screen.queryByText("Work")).toBeNull();
    expect(onStagedChange).toHaveBeenLastCalledWith([]);
  });

  it("reports a tag added in the dialog along with the event's own", () => {
    const { onStagedChange } = renderExisting();
    chooseExisting();
    fireEvent.click(row("Team sync"));
    fireEvent.click(screen.getByText("Add a tag"));
    fireEvent.click(screen.getByRole("option", { name: "Home" }));
    expect(onStagedChange).toHaveBeenLastCalledWith(["tag-work", "tag-home"]);
  });

  it("hands over the picked event, with any note staged, on 追加", () => {
    const { onCopyEvent, onCopyEventAndOpen, onSubmitEvent } = renderExisting();
    chooseExisting();
    fireEvent.click(row("Dentist"));
    stageNewNote("Questions");
    fireEvent.click(screen.getByText("Add"));
    expect(onCopyEvent).toHaveBeenCalledWith("evt-2", [
      { kind: "new", title: "Questions" },
    ]);
    expect(onCopyEventAndOpen).not.toHaveBeenCalled();
    expect(onSubmitEvent).not.toHaveBeenCalled();
  });

  it("hands it to the twin on 追加して詳細へ", () => {
    const { onCopyEvent, onCopyEventAndOpen } = renderExisting();
    chooseExisting();
    fireEvent.click(row("Dentist"));
    fireEvent.click(screen.getByText("Add and edit"));
    expect(onCopyEventAndOpen).toHaveBeenCalledWith("evt-2", []);
    expect(onCopyEvent).not.toHaveBeenCalled();
  });

  it("drops a pick the search has narrowed away", () => {
    const { onCopyEvent } = renderExisting();
    chooseExisting();
    fireEvent.click(row("Team sync"));
    fireEvent.change(screen.getByLabelText("Search events"), {
      target: { value: "dentist" },
    });
    expect(screen.getByText("Add")).toBeDisabled();
    fireEvent.click(screen.getByText("Add"));
    expect(onCopyEvent).not.toHaveBeenCalled();
    expect(screen.queryByText("Tags")).toBeNull();
  });

  it("says what the host says about an empty list, apart from no match", () => {
    renderExisting({ options: [], empty: "Could not read them" });
    chooseExisting();
    expect(screen.getByText("Could not read them")).toBeInTheDocument();
    cleanup();
    renderExisting();
    chooseExisting();
    fireEvent.change(screen.getByLabelText("Search events"), {
      target: { value: "zzz" },
    });
    expect(screen.getByText("No matching events")).toBeInTheDocument();
  });
});

describe("ItemCreatePanel — the footer says when it cannot act (#376)", () => {
  it("disables both event buttons until the title has something in it", () => {
    renderPanel();
    expect(screen.getByText("Add")).toBeDisabled();
    expect(screen.getByText("Add and edit")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Title"), {
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
    fireEvent.change(screen.getByLabelText("Title"), {
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
    fireEvent.change(screen.getByLabelText("Title"), {
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
    fireEvent.change(screen.getByLabelText("Title"), {
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

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Kickoff" },
    });
    fireEvent.click(screen.getByText("Add"));
    expect(onSubmitEvent).toHaveBeenCalledWith("Kickoff", slot(), [
      { kind: "existing", id: "note-2" },
      { kind: "existing", id: "note-1" },
    ]);
  });

  it("counts the picks as 'n selected' and lets a second press take one back", () => {
    // Before any pick the foot says what picking does (#2573), not "0".
    renderPanel();
    openNotePicker();
    expect(screen.getByText("Pick notes to attach them")).toBeInTheDocument();
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
    fireEvent.change(screen.getByLabelText("Title"), {
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

    fireEvent.change(screen.getByLabelText("Title"), {
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
    fireEvent.change(screen.getByLabelText("Title"), {
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
    fireEvent.change(screen.getByLabelText("Title"), {
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
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Write the deck" },
    });
    fireEvent.click(screen.getByText("Attach a note"));
    // Unlike the old note TAB, the section is additive: the field the submit
    // depends on is still on screen.
    expect(
      (screen.getByLabelText("Title") as HTMLInputElement).value,
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
    fireEvent.change(screen.getByLabelText("Title"), {
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
    fireEvent.change(screen.getByLabelText("Title"), {
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
    expect(screen.getByText("Pick notes to attach them")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Close the picker"));
    fireEvent.change(screen.getByLabelText("Title"), {
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
describe("ItemCreatePanel — 新規作成 with the host's handler (#2402)", () => {
  const openRow = () =>
    fireEvent.click(screen.getByRole("button", { name: LABELS.attachNote }));
  const newButton = () =>
    screen.getByRole<HTMLButtonElement>("button", {
      name: LABELS.noteSourceNew,
    });

  it("acts at once on an event, with the form as it stands", () => {
    const onCreateMemoNote = vi.fn();
    renderPanel({ onCreateMemoNote, initialTitle: "  Dentist  " });
    openRow();
    fireEvent.click(newButton());
    expect(onCreateMemoNote).toHaveBeenCalledExactlyOnceWith(
      {
        kind: "event",
        title: "Dentist",
        slot: { date: DATE, start: "09:00", end: "10:00", isAllDay: false },
      },
      [],
    );
    // It opened no title field: there is nothing to type.
    expect(screen.queryByLabelText(LABELS.noteTitleLabel)).toBeNull();
    expect(newButton().hasAttribute("aria-expanded")).toBe(false);
  });

  it("takes an empty title, which the footer does not", () => {
    const onCreateMemoNote = vi.fn();
    renderPanel({ onCreateMemoNote });
    openRow();
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: LABELS.addEvent })
        .disabled,
    ).toBe(true);
    fireEvent.click(newButton());
    expect(onCreateMemoNote.mock.calls[0][0]).toMatchObject({
      kind: "event",
      title: "",
    });
  });

  it("acts on the todo tab as a new todo", () => {
    const onCreateMemoNote = vi.fn();
    renderPanel({ onCreateMemoNote, initialTitle: "Write" });
    fireEvent.click(screen.getByRole("tab", { name: LABELS.typeTodo }));
    openRow();
    fireEvent.click(newButton());
    expect(onCreateMemoNote.mock.calls[0][0]).toMatchObject({
      kind: "task",
      title: "Write",
    });
  });

  it("is disabled under 既存から選ぶ until a todo is picked, then names it", () => {
    const onCreateMemoNote = vi.fn();
    renderPanel({ onCreateMemoNote });
    fireEvent.click(screen.getByRole("tab", { name: LABELS.typeTodo }));
    fireEvent.click(screen.getByRole("radio", { name: LABELS.sourceExisting }));
    openRow();
    expect(newButton().disabled).toBe(true);
    fireEvent.click(newButton());
    expect(onCreateMemoNote).not.toHaveBeenCalled();

    const [todo] = TODOS;
    fireEvent.click(screen.getByRole("option", { name: todo.title }));
    expect(newButton().disabled).toBe(false);
    fireEvent.click(newButton());
    expect(onCreateMemoNote).toHaveBeenCalledExactlyOnceWith(
      { kind: "picked", todoId: todo.id, title: todo.title },
      [],
    );
  });

  it("carries the notes already picked as chips", () => {
    const onCreateMemoNote = vi.fn();
    renderPanel({ onCreateMemoNote, notePicker: "inline" });
    openRow();
    fireEvent.click(
      screen.getByRole("button", { name: LABELS.noteSourceExisting }),
    );
    const [note] = NOTES;
    // By title: since #2573 the row's name also carries its updated date.
    fireEvent.click(pickerOption(note.title));
    fireEvent.click(screen.getByRole("button", { name: LABELS.notePickerDone }));
    fireEvent.click(newButton());
    expect(onCreateMemoNote.mock.calls[0][1]).toEqual([
      { kind: "existing", id: note.id },
    ]);
  });

  it("keeps staging on a host without the handler", () => {
    renderPanel();
    openRow();
    expect(newButton().getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(newButton());
    screen.getByLabelText(LABELS.noteTitleLabel);
  });
});

describe("ItemCreatePanel — where the note picker opens (#2396)", () => {
  it("puts the side picker beside the form, 20rem wide", () => {
    renderPanel({ notePicker: "side" });
    openNotePicker();
    const picker = screen.getByRole("region", { name: "Choose notes" });
    expect(picker.getAttribute("data-note-picker")).toBe("side");
    expect(picker.className).toContain("w-80");
    // A sibling of the form column, not inside it. `.flex-1` since #2566:
    // the title's own <label> is a flex column too, and sits inside the form.
    const form = screen.getByLabelText("Title").closest(
      ".flex-1.flex-col",
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
    within(sheet).getByText("Pick notes to attach them");
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
describe("ItemCreatePanel — the note row and picker, as the prototype draws them (#2573)", () => {
  it("leads the trigger with a clip, and the row with its question", () => {
    renderPanel();
    const trigger = screen.getByRole("button", { name: "Attach a note" });
    expect(trigger.querySelector("svg.lucide-paperclip")).not.toBeNull();
    expect(trigger.querySelector("svg.lucide-chevron-right")).toBeNull();
    // A small outlined button, not a bare text row.
    expect(trigger.className).toContain("border");

    fireEvent.click(trigger);
    // Open shows on the trigger itself: the clip does not turn.
    expect(trigger.querySelector("svg.lucide-chevron-down")).toBeNull();
    expect(trigger.className).toContain("border-lumen-accent");
    const row = screen.getByRole("group", { name: "Note to link" });
    expect(row.firstElementChild?.textContent).toBe("What about a note?");
    expect(row.className).toContain("bg-lumen-surface-sunken");
    // The question is text, not a fourth button.
    expect(
      within(row)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["New note", "Choose existing", "Never mind"]);
  });

  it("draws each note's updated date under its title", () => {
    renderPanel();
    openNotePicker();
    expect(
      within(pickerOption("Standup minutes")).getByText("Updated 2026-10-10"),
    ).toBeInTheDocument();
    expect(
      within(pickerOption("Weekly review")).getByText("Updated 2026-10-08"),
    ).toBeInTheDocument();
    // A note without the field draws no line at all.
    expect(pickerOption("Salary talk").textContent).not.toContain("Updated");
  });

  it("draws no line when the host's formatter has nothing to say", () => {
    renderPanel({ labels: { ...LABELS, noteUpdated: () => "" } });
    openNotePicker();
    expect(pickerOption("Standup minutes").textContent).toBe("Standup minutes");
  });

  it("says what picking does until a note is picked, then counts", () => {
    renderPanel();
    openNotePicker();
    expect(screen.getByText("Pick notes to attach them")).toBeInTheDocument();
    expect(screen.queryByText("0 selected")).toBeNull();
    fireEvent.click(pickerOption("Weekly review"));
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(screen.queryByText("Pick notes to attach them")).toBeNull();
    fireEvent.click(pickerOption("Weekly review"));
    expect(screen.getByText("Pick notes to attach them")).toBeInTheDocument();
  });

  it("still attaches the picked notes, dates or not", () => {
    const { onSubmitEvent } = renderPanel();
    openNotePicker();
    fireEvent.click(pickerOption("Standup minutes"));
    fireEvent.click(pickerOption("Salary talk"));
    fireEvent.click(screen.getByText("Done"));
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Kickoff" },
    });
    fireEvent.click(screen.getByText("Add"));
    expect(onSubmitEvent).toHaveBeenCalledWith("Kickoff", slot(), [
      { kind: "existing", id: "note-1" },
      { kind: "existing", id: "note-3" },
    ]);
  });

  it("keeps the old row and count for a host without the new labels", () => {
    const older: ItemCreatePanelLabels = { ...LABELS };
    delete older.noteRowPrompt;
    delete older.notePickerNone;
    delete older.noteUpdated;
    renderPanel({ labels: older });
    fireEvent.click(screen.getByRole("button", { name: "Attach a note" }));
    const row = screen.getByRole("group", { name: "Note to link" });
    expect(row.firstElementChild?.textContent).toBe("New note");
    fireEvent.click(screen.getByText("Choose existing"));
    expect(screen.getByText("0 selected")).toBeInTheDocument();
    expect(pickerOption("Standup minutes").textContent).toBe("Standup minutes");
  });
});

describe("ItemCreatePanel — the repeat (#2406)", () => {
  const repeatTabs = () =>
    within(screen.getByRole("tablist", { name: "Repeat" }));
  const addEvent = (title: string) => {
    fireEvent.change(screen.getByLabelText("Title"), {
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
    fireEvent.change(screen.getByLabelText("Title"), {
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
    fireEvent.change(screen.getByLabelText("Title"), {
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
    fireEvent.change(screen.getByLabelText("Title"), {
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
    fireEvent.change(screen.getByLabelText("Title"), {
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
      (screen.getByLabelText("Title") as HTMLInputElement).value,
    ).toBe("Dentist");
    fireEvent.click(screen.getByText("Add todo"));
    expect(onCreateTodo).toHaveBeenCalledWith(
      "Dentist",
      slot({ start: "13:00", end: "13:30" }),
      [],
    );
  });
});

/*
 * #2566 — the add dialog's top, in the prototype's form: each switch under
 * its own heading and the two side by side, the title named above its input
 * with no placeholder, and the tag list opening upward with each tag's icon.
 */
describe("ItemCreatePanel — headed switches, the title heading, the tag list (#2566)", () => {
  const TAG_POOL = {
    tags: [
      { id: "tag-work", name: "Work", color: "#1e3a8a", icon: "Briefcase" },
      { id: "tag-home", name: "Home" },
    ],
    tagsOf: () => [],
    onStagedChange: vi.fn(),
    labels: {
      field: "Tags",
      add: "Add a tag",
      remove: (name: string) => `Remove ${name}`,
      empty: "No tags",
    },
  };

  function renderWithTags() {
    render(
      <ItemCreatePanel
        initial={{ date: DATE }}
        pools={{ todos: TODOS, notes: NOTES, tags: TAG_POOL }}
        handlers={{
          onSubmitEvent: vi.fn(),
          onSubmitEventAndOpen: vi.fn(),
          onCreateTodo: vi.fn(),
          onPlaceTodo: vi.fn(),
        }}
        labels={LABELS}
      />,
    );
  }

  it("heads the type switch and the source switch, side by side", () => {
    renderPanel();
    openTodoTab();
    const typeHeading = screen.getByText("Item type");
    const sourceHeading = screen.getByText("How to add");
    // Each heading sits over its own switch…
    expect(
      within(typeHeading.parentElement!).getByRole("tablist", {
        name: "Item type",
      }),
    ).toBeInTheDocument();
    expect(
      within(sourceHeading.parentElement!).getByRole("radiogroup", {
        name: "How to add",
      }),
    ).toBeInTheDocument();
    // …and the two groups share one row (two columns from `sm` up).
    const row = typeHeading.parentElement!.parentElement!;
    expect(row).toBe(sourceHeading.parentElement!.parentElement);
    expect(row.className.split(" ")).toEqual(
      expect.arrayContaining(["grid", "sm:grid-cols-2"]),
    );
    // The heading is not read twice: the switch carries the same name.
    expect(typeHeading.getAttribute("aria-hidden")).toBe("true");
  });

  it("draws the type switch alone where there is no source to choose", () => {
    renderPanel();
    screen.getByText("Item type");
    expect(screen.queryByText("How to add")).toBeNull();
  });

  it("names the title above its input and draws no placeholder", () => {
    renderPanel();
    const input = screen.getByLabelText("Title");
    expect(input.tagName).toBe("INPUT");
    expect(input.getAttribute("placeholder")).toBeNull();
    expect(screen.queryByPlaceholderText("Event title")).toBeNull();
    openTodoTab();
    expect(screen.getByLabelText("Title").getAttribute("placeholder")).toBeNull();
    expect(screen.queryByPlaceholderText("Todo title")).toBeNull();
  });

  it("opens the tag list above its button, each row led by the tag's icon", () => {
    renderWithTags();
    fireEvent.click(screen.getByRole("button", { name: "Add a tag" }));
    const list = screen.getByRole("listbox", { name: "Add a tag" });
    const popup = list.parentElement!;
    expect(popup.className.split(" ")).toEqual(
      expect.arrayContaining(["bottom-full", "mb-1", "w-52"]),
    );
    expect(popup.className.split(" ")).not.toContain("top-full");
    const work = within(list).getByRole("option", { name: /Work/ });
    const icon = work.querySelector("svg");
    expect(icon).not.toBeNull();
    // Tinted with the tag's colour, and no colour dot beside it.
    expect(icon!.getAttribute("style")).toContain("color");
    expect(work.querySelector("span.rounded-full")).toBeNull();
    // A tag with no icon or colour still gets the generic glyph.
    const home = within(list).getByRole("option", { name: /Home/ });
    expect(home.querySelector("svg")).not.toBeNull();
  });
});
