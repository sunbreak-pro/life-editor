import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  QuickCaptureSheet,
  type QuickCaptureLabels,
  type QuickCaptureSheetProps,
  type ItemCreateSlot,
} from "../src/components";

/*
 * QuickCaptureSheet (#280, moved from web CalendarTab) — the Mobile creation
 * frame. Since #2624 it opens as a short sheet (type, title, day, times) and
 * goes on to the unified <ItemCreatePanel> only from 「追加して詳細へ」, which
 * carries what was typed. These tests pin what the FRAME owns: the two stages,
 * what the short sheet sends, and the hand-over (the panel's own behaviour is
 * covered by itemCreatePanel.test.tsx).
 *
 * Closing is the host's job — its submit handlers clear the open-panel state,
 * which flips `open` here. The sheet deliberately does not close itself on
 * submit, so it can never double-close.
 */

const LABELS: QuickCaptureLabels = {
  typeLabel: "Item type",
  typeEvent: "Event",
  typeTodo: "Todo",
  attachNote: "Attach a note",
  noteSourceLabel: "Note to link",
  noteSourceNew: "New note",
  noteSourceExisting: "Existing note",
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
  noteDismiss: "Never mind",
  noteNewConfirm: "Stage note",
  notePickerTitle: "Choose notes",
  notePickerClose: "Close the picker",
  notePickerCount: (n: number) => `${n} selected`,
  notePickerDone: "Done",
  noteLocked: "Locked",
  removeNote: (title: string) => `Remove ${title}`,
};

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
  onStagedTags?: (ids: string[]) => void;
}) {
  const onSubmitEvent = vi.fn();
  const onSubmitEventAndOpen = vi.fn();
  const onCreateTodo = vi.fn();
  const onPlaceTodo = vi.fn();
  const onClose = vi.fn();
  const sheetProps: QuickCaptureSheetProps = {
    open: true,
    onClose,
    sheetTitle: "Add item",
    closeLabel: "Close",
    initial: {
      date: props?.initialDate ?? DATE,
      start: props?.initialStart,
      end: props?.initialEnd,
    },
    pools: {
      todos: [{ id: "task-1", title: "Draft the invoice" }],
      notes: [{ id: "note-1", title: "Standup minutes" }],
      ...(props?.onStagedTags
        ? {
            tags: {
              tags: [{ id: "tag-1", name: "Work" }],
              tagsOf: () => [],
              onStagedChange: props.onStagedTags,
              labels: {
                field: "Tags",
                add: "Add a tag",
                remove: (name: string) => `Remove ${name}`,
                empty: "No tags",
              },
            },
          }
        : {}),
    },
    handlers: {
      onSubmitEvent,
      onSubmitEventAndOpen,
      onCreateTodo,
      onPlaceTodo,
    },
    labels: LABELS,
  };
  const view = render(<QuickCaptureSheet {...sheetProps} />);
  return {
    view,
    sheetProps,
    onSubmitEvent,
    onSubmitEventAndOpen,
    onCreateTodo,
    onPlaceTodo,
    onClose,
  };
}

const sheet = () => screen.getByRole("dialog", { name: "Add item" });
const goToDetail = () => fireEvent.click(screen.getByText("Add and edit"));

describe("QuickCaptureSheet — the short sheet (#2624)", () => {
  it("titles the sheet with sheetTitle, not the title-input label (#376)", () => {
    // The sheet holds more than one kind of item, so its heading names the
    // panel. Before #376 both came from the same key and read "Add event".
    renderSheet();
    expect(screen.getByText("Add item")).toBeInTheDocument();
  });

  it("opens part-way up the screen with only the type, title, day and times", () => {
    renderSheet();
    expect(sheet().className).not.toContain("h-full");
    expect(sheet().querySelector("[data-quick-capture]")).not.toBeNull();
    screen.getByRole("tablist", { name: "Item type" });
    screen.getByLabelText("Title");
    screen.getByLabelText("Date");
    screen.getByLabelText("Start");
    screen.getByLabelText("End");
    // The rest waits on the full page.
    expect(screen.queryByText("Attach a note")).toBeNull();
    expect(screen.queryByRole("checkbox", { name: "All day" })).toBeNull();
    expect(screen.queryByText("How to add")).toBeNull();
    expect(screen.queryByText("Tags")).toBeNull();
  });

  it("adds an event from the short sheet", () => {
    const { onSubmitEvent } = renderSheet();
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Dentist" },
    });
    fireEvent.click(screen.getByText("Add"));
    expect(onSubmitEvent).toHaveBeenCalledWith(
      "Dentist",
      slot({ start: "09:00", end: "10:00" }),
      [],
    );
  });

  it("forwards the time prefill and the edited times", () => {
    const { onSubmitEvent } = renderSheet({
      initialStart: "19:00",
      initialEnd: "20:30",
    });
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "  Gym  " },
    });
    fireEvent.click(screen.getByText("Add"));
    expect(onSubmitEvent).toHaveBeenCalledWith(
      "Gym",
      slot({ start: "19:00", end: "20:30" }),
      [],
    );
  });

  it("adds a todo on its day alone, with no time fields", () => {
    const { onCreateTodo, onSubmitEvent } = renderSheet();
    fireEvent.click(screen.getByText("Todo"));
    expect(screen.queryByLabelText("Start")).toBeNull();
    expect(screen.queryByLabelText("End")).toBeNull();
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Groceries" },
    });
    fireEvent.click(screen.getByText("Add todo"));
    expect(onCreateTodo).toHaveBeenCalledWith(
      "Groceries",
      slot({ isAllDay: true }),
      [],
    );
    expect(onSubmitEvent).not.toHaveBeenCalled();
  });

  it("adds nothing without a title", () => {
    const { onSubmitEvent } = renderSheet();
    const add = screen.getByText("Add") as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    fireEvent.keyDown(screen.getByLabelText("Title"), { key: "Enter" });
    expect(onSubmitEvent).not.toHaveBeenCalled();
  });

  it("adds on Enter, but not on the Enter that confirms a Japanese conversion", () => {
    const { onSubmitEvent } = renderSheet();
    const title = screen.getByLabelText("Title");
    fireEvent.change(title, { target: { value: "歯医者" } });
    fireEvent.keyDown(title, { key: "Enter", isComposing: true });
    fireEvent.keyDown(title, { key: "Enter", keyCode: 229 });
    expect(onSubmitEvent).not.toHaveBeenCalled();
    fireEvent.keyDown(title, { key: "Enter" });
    expect(onSubmitEvent).toHaveBeenCalledWith("歯医者", slot(), []);
  });

  it("leaves closing to the host, so the sheet never double-closes (#376)", () => {
    const { onClose } = renderSheet();
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Standup" },
    });
    fireEvent.click(screen.getByText("Add"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("passes the target day through to the field (#353 / #940)", () => {
    // Mobile reaches creation from the FAB and from an empty-slot tap, which
    // target different days — the sheet must show which one it is holding.
    renderSheet({ initialDate: "2026-07-27" });
    expect((screen.getByLabelText("Date") as HTMLInputElement).value).toBe(
      "2026-07-27",
    );
  });

  it("clears the host's staged tags, since it stages none itself", () => {
    // The host keeps the last staged set until a submit takes it; the full
    // panel used to clear it by mounting, and this sheet now mounts instead.
    const onStagedTags = vi.fn();
    renderSheet({ onStagedTags });
    expect(onStagedTags).toHaveBeenCalledWith([]);
  });

  it("gives every button a 44px floor on a phone", () => {
    renderSheet();
    for (const name of ["Add and edit", "Add"]) {
      expect(screen.getByText(name).className).toContain("max-md:min-h-11");
    }
  });
});

describe("QuickCaptureSheet — on to the full page (#2624)", () => {
  it("carries an event's title, day and times to the full page, writing nothing", () => {
    const { onSubmitEvent, onSubmitEventAndOpen } = renderSheet({
      initialStart: "19:00",
      initialEnd: "20:30",
    });
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Dinner" },
    });
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2026-08-22" },
    });
    goToDetail();

    expect(onSubmitEvent).not.toHaveBeenCalled();
    expect(onSubmitEventAndOpen).not.toHaveBeenCalled();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(sheet().className).toContain("h-full");
    expect(sheet().querySelector("[data-quick-capture]")).toBeNull();
    // The full panel's extras are there now.
    screen.getByText("Attach a note");
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe(
      "Dinner",
    );
    expect((screen.getByLabelText("Date") as HTMLInputElement).value).toBe(
      "2026-08-22",
    );
    expect((screen.getByLabelText("Start") as HTMLInputElement).value).toBe(
      "19:00",
    );
    expect((screen.getByLabelText("End") as HTMLInputElement).value).toBe(
      "20:30",
    );

    fireEvent.click(screen.getByText("Add"));
    expect(onSubmitEvent).toHaveBeenCalledWith(
      "Dinner",
      slot({ date: "2026-08-22", start: "19:00", end: "20:30" }),
      [],
    );
  });

  it("goes on even before a title is typed", () => {
    renderSheet();
    goToDetail();
    screen.getByText("Attach a note");
  });

  it("lands a todo on the todo tab, all-day, as the short sheet had it", () => {
    const { onCreateTodo } = renderSheet();
    fireEvent.click(screen.getByText("Todo"));
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Groceries" },
    });
    goToDetail();

    expect(
      screen.getByRole("tab", { name: "Todo" }).getAttribute("aria-selected"),
    ).toBe("true");
    expect(
      screen
        .getByRole("checkbox", { name: "All day" })
        .getAttribute("aria-checked"),
    ).toBe("true");
    fireEvent.click(screen.getByText("Add todo"));
    expect(onCreateTodo).toHaveBeenCalledWith(
      "Groceries",
      slot({ isAllDay: true }),
      [],
    );
  });

  it("closes the whole add from the full page", () => {
    const { onClose } = renderSheet();
    goToDetail();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("starts the next opening on the short sheet again", () => {
    const { view, sheetProps } = renderSheet();
    goToDetail();
    view.rerender(<QuickCaptureSheet {...sheetProps} open={false} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    view.rerender(<QuickCaptureSheet {...sheetProps} open />);
    expect(sheet().querySelector("[data-quick-capture]")).not.toBeNull();
    expect(screen.queryByText("Attach a note")).toBeNull();
  });
});
