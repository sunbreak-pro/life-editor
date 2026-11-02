import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  EventEditorPane,
  FrequencyEditor,
  ItemCreatePanel,
  TimeRangeField,
  type EventEditorItem,
  type EventEditorLabels,
  type FrequencyEditorLabels,
  type ItemCreatePanelLabels,
  type ItemCreatePanelPools,
} from "../src/components";
import { goalsForTodoPicker } from "../src/components/briefing/goalLinkPreview";
import { SAMPLE_GOALS, sampleState } from "./fixtures/goalLinkState";

/*
 * #2427 — the add dialog's 44px floor on a phone. #2414 gave it to the footer
 * and the all-day check; this covers every other control the Issue names.
 *
 * jsdom has no layout (CLAUDE.md §7.1), so these pin the CLASS CONTRACT that
 * produces the size, and whether the row of date / start / end / all-day still
 * fits 375px is the separate browser check. `max-md:` and never a bare floor:
 * each of these is also what Desktop draws, at its mouse size.
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
  sourceLabel: "How to add",
  sourceNew: "New",
  sourceExisting: "From existing",
  searchTodos: "Search todos",
  todoPickerEmpty: "No unscheduled todos",
  todoPickerNoMatch: "No matching todos",
  attachNote: "Attach a note",
  noteSourceLabel: "Note to link",
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
  attachedNote: "Attached notes",
  removeNote: (title: string) => `Remove ${title}`,
};

const GOAL_LABELS = {
  listLabel: "Goals",
  periods: { week: "Week", month: "Month", year: "Year" },
  unconnected: "Unconnected",
  achieved: "Achieved",
  becomesAchieved: "Becomes achieved",
  losesAchievement: "Loses achievement",
  achievementLost: "Achievement lost",
  previewHeading: "On save",
  saveFailed: "Could not save",
  attach: "Link to a goal",
  attached: "Linked goals",
};

const REPEAT_LABELS: FrequencyEditorLabels = {
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
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const noop = () => {};

function renderPanel(pools?: Partial<ItemCreatePanelPools>) {
  render(
    <ItemCreatePanel
      initial={{ date: "2026-09-30" }}
      pools={{
        todos: [],
        notes: [{ id: "note-1", title: "Standup minutes" }],
        goals: {
          goals: goalsForTodoPicker(SAMPLE_GOALS, "2026-09-30", []),
          state: sampleState(),
          onStagedChange: noop,
          labels: GOAL_LABELS,
        },
        tags: {
          tags: [{ id: "tag-1", name: "Work" }],
          tagsOf: () => [],
          onStagedChange: noop,
          labels: {
            field: "Tags",
            add: "Add a tag",
            remove: (name: string) => `Remove tag ${name}`,
            empty: "No tags",
          },
        },
        ...pools,
      }}
      handlers={{
        onSubmitEvent: noop,
        onSubmitEventAndOpen: noop,
        onCreateTodo: noop,
        onPlaceTodo: noop,
      }}
      labels={LABELS}
    />,
  );
}

/** On a phone, 44px; on Desktop, whatever the control already was. */
function expectFlooredOnNarrowOnly(el: HTMLElement) {
  expect(el).toHaveClass("max-md:min-h-11");
  expect(el).not.toHaveClass("min-h-11");
}

describe("the add dialog's floor on a phone (#2427)", () => {
  it("floors the title and date fields", () => {
    renderPanel();
    expectFlooredOnNarrowOnly(screen.getByRole("textbox", { name: "Title" }));
    expectFlooredOnNarrowOnly(screen.getByLabelText("Date"));
  });

  it("floors both time fields", () => {
    renderPanel();
    expectFlooredOnNarrowOnly(screen.getByRole("combobox", { name: "Start" }));
    expectFlooredOnNarrowOnly(screen.getByRole("combobox", { name: "End" }));
  });

  it("floors the note trigger, with or without a tag field beside it", () => {
    renderPanel();
    expectFlooredOnNarrowOnly(
      screen.getByRole("button", { name: "Attach a note" }),
    );
    expect(screen.getByRole("button", { name: "Add a tag" })).toHaveClass(
      "max-md:min-h-11",
    );
  });

  it("floors the note trigger when it spans the line alone", () => {
    renderPanel({ tags: undefined });
    expectFlooredOnNarrowOnly(
      screen.getByRole("button", { name: "Attach a note" }),
    );
  });

  it("floors the goal trigger", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("tab", { name: "Todo" }));
    expectFlooredOnNarrowOnly(
      screen.getByRole("button", { name: "Link to a goal" }),
    );
  });

  it("floors a tag's × both ways, and keeps it from shrinking", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Add a tag" }));
    fireEvent.click(screen.getByRole("option", { name: "Work" }));
    const remove = screen.getByRole("button", { name: "Remove tag Work" });
    expect(remove).toHaveClass("size-5", "max-md:size-11", "shrink-0");
    expect(remove).not.toHaveClass("size-11");
  });

  it("floors the three note buttons and the new-note fields", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Attach a note" }));
    for (const name of ["New note", "Choose existing", "Never mind"]) {
      expectFlooredOnNarrowOnly(screen.getByRole("button", { name }));
    }
    fireEvent.click(screen.getByRole("button", { name: "New note" }));
    expectFlooredOnNarrowOnly(
      screen.getByRole("textbox", { name: "Note title" }),
    );
    expectFlooredOnNarrowOnly(
      screen.getByRole("button", { name: "Stage note" }),
    );
  });

  it("floors a staged note's × both ways", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Attach a note" }));
    fireEvent.click(screen.getByRole("button", { name: "New note" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Note title" }), {
      target: { value: "Minutes" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Stage note" }));
    const remove = screen.getByRole("button", { name: "Remove Minutes" });
    expect(remove).toHaveClass("size-5", "max-md:size-11", "shrink-0");
    expect(remove).not.toHaveClass("size-11");
  });

  it("leaves the date row wrapping, so the taller fields cannot widen it", () => {
    renderPanel();
    const date = screen.getByLabelText("Date");
    const row = date.closest("label")?.parentElement;
    expect(row).toHaveClass("flex-wrap", "items-end");
    expect(date).toHaveClass("min-w-0", "appearance-none");
    expect(screen.getByRole("checkbox", { name: "All day" })).toHaveClass(
      "shrink-0",
      "max-md:min-h-11",
    );
  });

  it("sizes the footer's two submits from their labels on a phone", () => {
    // An equal split (flex-basis 0) is 103px each at 375px, under the 110px
    // that 「追加して詳細へ」 needs, so its last character fell to a second line.
    renderPanel();
    for (const name of ["Add and edit", "Add"]) {
      expect(screen.getByRole("button", { name })).toHaveClass(
        "flex-1",
        "max-md:basis-auto",
      );
    }
  });
});

describe("FrequencyEditor's weekday chips (#2427)", () => {
  function renderWeekdays() {
    render(
      <FrequencyEditor
        value={{
          frequencyType: "weekdays",
          frequencyDays: [1],
          frequencyInterval: null,
          frequencyStartDate: null,
          frequencyEndDate: null,
        }}
        onChange={noop}
        weekdayLabels={WEEKDAYS}
        labels={REPEAT_LABELS}
      />,
    );
    return WEEKDAYS.map((name) => screen.getByRole("button", { name }));
  }

  it("reaches 44px past a 34px chip on a phone only", () => {
    const chips = renderWeekdays();
    expect(chips).toHaveLength(7);
    for (const chip of chips) {
      // ::after measures from the padding box: 34px less the 1px border is
      // 32px, and 6px either side makes 44px.
      expect(chip).toHaveClass(
        "size-[34px]",
        "border",
        "max-md:relative",
        "max-md:after:absolute",
        "max-md:after:inset-[-6px]",
      );
      expect(chip).not.toHaveClass("after:absolute");
    }
  });

  it("spaces the chips so the areas meet without overlapping", () => {
    const [first] = renderWeekdays();
    // 34px + 10px = a 44px pitch. A smaller gap would hand part of one chip's
    // area to the next.
    expect(first.parentElement).toHaveClass("flex-wrap", "max-md:gap-[10px]");
  });
});

describe("the floor on the other screens FIELD reaches (#2427)", () => {
  const editorLabels: EventEditorLabels = {
    title: "Title",
    date: "Date",
    allDay: "All-day",
    startTime: "Start",
    endTime: "End",
    memo: "Memo",
    save: "Save",
    originRoutine: "Generated from routine",
    skipThisDay: "Skip this day",
    delete: "Delete",
  };
  const item: EventEditorItem = {
    id: "m1",
    title: "Dentist",
    date: "2026-08-17",
    isAllDay: false,
    startTime: "09:00",
    endTime: "10:00",
    memo: "",
    isRoutine: false,
  };
  const renderEditor = () =>
    render(
      <EventEditorPane
        item={item}
        labels={editorLabels}
        handlers={{ onSave: vi.fn() }}
        options={{ canEditDate: true, canEditAllDay: true }}
      />,
    );

  it("keeps the edit panel's memo at its own 72px on a phone", () => {
    // A `max-md:min-h-11` beside `min-h-[72px]` would win below 768px and
    // shrink the memo there.
    renderEditor();
    const memo = screen.getByRole("textbox", { name: "Memo" });
    expect(memo).toHaveClass("min-h-[72px]");
    expect(memo).not.toHaveClass("max-md:min-h-11");
  });

  it("keeps the all-day switch level with the date field beside it", () => {
    renderEditor();
    expectFlooredOnNarrowOnly(screen.getByLabelText("Date"));
    expectFlooredOnNarrowOnly(screen.getByRole("switch", { name: "All-day" }));
  });

  it("floors TimeRangeField wherever it is drawn", () => {
    render(
      <TimeRangeField
        start="09:00"
        end="10:00"
        onChange={noop}
        labels={{ start: "From", end: "To" }}
      />,
    );
    expectFlooredOnNarrowOnly(screen.getByRole("combobox", { name: "From" }));
    expectFlooredOnNarrowOnly(screen.getByRole("combobox", { name: "To" }));
  });
});
