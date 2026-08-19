import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  EventEditorPane,
  type EventEditorItem,
  type EventEditorLabels,
  type FrequencyEditorLabels,
  type FrequencyEditorValue,
} from "../src/components";

/*
 * #712 — the repeat section joins the save-button draft.
 *
 * PR #681 moved every field on this pane behind the save button, and the
 * repeat section was the one control left committing on the spot. That made
 * the same panel confirm in two different ways, and "I never pressed save"
 * could still have rewritten the series. The rule the pane follows now is the
 * one the user chose for everything else (D-20260810-sched-1 = A): the button
 * is the only commit, and closing without it discards.
 *
 * The section edits a DIFFERENT row (the routine), so the two things worth
 * pinning are that nothing leaves the pane before the press and that when the
 * press comes it carries the whole repeat — the sub-fields included, since
 * dropping them would silently create the series on the wrong days.
 */

const LABELS: EventEditorLabels = {
  complete: "Mark complete",
  statusLabels: {
    notStarted: "Not started",
    inProgress: "In progress",
    done: "Done",
  },
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

const REPEAT_LABELS: FrequencyEditorLabels = {
  frequency: "Repeat",
  frequencyDaily: "Daily",
  frequencyWeekdays: "Weekdays",
  frequencyInterval: "Every N days",
  frequencyNone: "None",
  intervalEvery: "Every",
  intervalDays: "days",
  startDate: "Start date",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// 2026-07-30 is a Thursday (weekday 4) — the day an unseeded "weekdays" pick
// falls back to.
const manualItem: EventEditorItem = {
  id: "m1",
  title: "Dentist",
  date: "2026-07-30",
  isAllDay: false,
  startTime: "19:00",
  endTime: "20:30",
  completed: false,
  status: "notStarted",
  memo: "",
  isRoutine: false,
};

const routineItem: EventEditorItem = {
  ...manualItem,
  id: "r1",
  title: "Gym",
  isRoutine: true,
};

const weeklyRepeat: FrequencyEditorValue = {
  frequencyType: "weekdays",
  frequencyDays: [1, 3, 5],
  frequencyInterval: null,
  frequencyStartDate: null,
};

/**
 * #893 folded the pane's props into bundles (`handlers` / `options` /
 * `repeat`). The cases below still name the four callbacks flatly and are
 * unchanged from before that refactor — the folding happens here.
 */
function renderPane(
  item: EventEditorItem,
  repeat: FrequencyEditorValue | null,
  props?: { repeatPending?: boolean },
) {
  const fns = {
    onSave: vi.fn(),
    onToggleComplete: vi.fn(),
    onChangeRepeat: vi.fn(),
    onDetachRepeat: vi.fn(),
  };
  const view = render(
    <EventEditorPane
      item={item}
      labels={LABELS}
      handlers={{ onSave: fns.onSave, onToggleComplete: fns.onToggleComplete }}
      repeat={{
        value: repeat,
        labels: REPEAT_LABELS,
        weekdayLabels: WEEKDAYS,
        pending: props?.repeatPending,
        onChange: fns.onChangeRepeat,
        onDetach: fns.onDetachRepeat,
      }}
    />,
  );
  return { ...fns, ...view };
}

const saveButton = () => screen.getByRole("button", { name: "Save" });
const pickType = (name: string) =>
  fireEvent.click(screen.getByRole("tab", { name }));

describe("EventEditorPane — repeat draft (#712)", () => {
  it("writes nothing while the repeat is being edited", () => {
    const { onChangeRepeat, onSave } = renderPane(routineItem, weeklyRepeat);
    fireEvent.click(screen.getByRole("button", { name: "Tue" }));
    pickType("Daily");
    expect(onChangeRepeat).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("reports the pending repeat as unsaved and arms the button", () => {
    renderPane(routineItem, weeklyRepeat);
    expect(saveButton()).toBeDisabled();
    pickType("Daily");
    // Without this the one control that could still change the series would
    // also be the one the "unsaved" badge never mentions.
    expect(screen.getByText("Unsaved")).toBeTruthy();
    expect(saveButton()).toBeEnabled();
  });

  it("discards the repeat edit when the pane closes unsaved", () => {
    const { onChangeRepeat, unmount } = renderPane(routineItem, weeklyRepeat);
    pickType("Daily");
    unmount();
    expect(onChangeRepeat).not.toHaveBeenCalled();
  });

  it("commits the repeat and the fields in one press", () => {
    const { onChangeRepeat, onSave } = renderPane(routineItem, weeklyRepeat);
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Gym (long)" },
    });
    pickType("Daily");
    fireEvent.click(saveButton());
    expect(onChangeRepeat).toHaveBeenCalledTimes(1);
    // #870: the repeat goes first, so it carries the same press's fields with
    // it — a host building a routine template out of this event has nowhere
    // else to read them from yet.
    expect(onChangeRepeat).toHaveBeenCalledWith(
      { frequencyType: "daily" },
      { title: "Gym (long)" },
    );
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith("r1", { title: "Gym (long)" });
  });

  // #870: the case the bug was reported on — a manual event whose time is
  // changed and whose repeat is turned on in ONE press. The host templates the
  // series off this call, so a time missing here becomes every generated day
  // carrying the old one.
  it("carries a time changed in the same press as the repeat", () => {
    const { onChangeRepeat, onSave } = renderPane(manualItem, null);
    // Grabbed before the change: typing opens the option list, which carries
    // the same accessible name.
    const start = screen.getByLabelText("Start");
    fireEvent.change(start, { target: { value: "13:00" } });
    fireEvent.blur(start);
    pickType("Daily");
    fireEvent.click(saveButton());
    expect(onChangeRepeat).toHaveBeenCalledWith(
      expect.objectContaining({ frequencyType: "daily" }),
      expect.objectContaining({ startTime: "13:00" }),
    );
    expect(onSave).toHaveBeenCalledWith(
      "m1",
      expect.objectContaining({ startTime: "13:00" }),
    );
  });

  it("sends no field patch when only the repeat moved", () => {
    // An empty patch would still raise the this/future/all scope dialog
    // (#279) on a routine occurrence — a question about an edit that is not
    // there.
    const { onChangeRepeat, onSave } = renderPane(routineItem, weeklyRepeat);
    pickType("Daily");
    fireEvent.click(saveButton());
    expect(onChangeRepeat).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("carries the weekdays chosen before the press, not just the type", () => {
    // Turning a repeat on used to commit per click, so the sub-fields always
    // arrived in a follow-up write. In one press they have to travel with the
    // type or the series is created on the wrong days.
    const { onChangeRepeat } = renderPane(manualItem, null);
    pickType("Weekdays");
    // Seeded on the item's own weekday (Thu) the moment the type is picked, so
    // the section shows what saving would write rather than "fires never".
    expect(screen.getByRole("button", { name: "Thu" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Mon" }));
    fireEvent.click(saveButton());
    // Nothing else moved, so the field patch that rides along (#870) is empty.
    expect(onChangeRepeat).toHaveBeenCalledWith(
      { frequencyType: "weekdays", frequencyDays: [1, 4] },
      {},
    );
  });

  it("lets the last weekday be cleared — the seed applies once, not forever", () => {
    // "fires never" is a legitimate thing to ask for; re-seeding on every
    // render would make the chip un-unclickable and read as a broken control.
    const { onChangeRepeat } = renderPane(manualItem, null);
    pickType("Weekdays");
    fireEvent.click(screen.getByRole("button", { name: "Thu" }));
    expect(screen.getByRole("button", { name: "Thu" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    fireEvent.click(saveButton());
    expect(onChangeRepeat).toHaveBeenCalledWith(
      { frequencyType: "weekdays", frequencyDays: [] },
      {},
    );
  });

  it("defers the detach to the button too", () => {
    const { onDetachRepeat } = renderPane(routineItem, weeklyRepeat);
    pickType("None");
    expect(onDetachRepeat).not.toHaveBeenCalled();
    expect(saveButton()).toBeEnabled();
    fireEvent.click(saveButton());
    expect(onDetachRepeat).toHaveBeenCalledTimes(1);
  });

  it("stays clean when the choice matches what the item already has", () => {
    // #434 S-1: a button that is pressable and does nothing is worse than one
    // that is visibly off. Picking "None" on an item with no repeat, or the
    // type it already had, changes nothing.
    const { rerender } = renderPane(manualItem, null);
    pickType("None");
    expect(saveButton()).toBeDisabled();
    rerender(
      <EventEditorPane
        item={routineItem}
        labels={LABELS}
        handlers={{ onSave: vi.fn(), onToggleComplete: vi.fn() }}
        repeat={{
          value: weeklyRepeat,
          labels: REPEAT_LABELS,
          weekdayLabels: WEEKDAYS,
          onChange: vi.fn(),
          onDetach: vi.fn(),
        }}
      />,
    );
    pickType("Weekdays");
    expect(saveButton()).toBeDisabled();
  });
});
