import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  RoutineEditorForm,
  type RoutineEditorRoutine,
  type RoutineEditorFormLabels,
} from "../src/components";

/*
 * RoutineEditorForm — the Routines-tab detail form. The frequency segmented
 * control swaps in type-specific controls (weekday chips / interval + start
 * date); toggling a weekday chip patches frequencyDays. The group type and
 * its chips were removed in #352.
 */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const LABELS: RoutineEditorFormLabels = {
  title: "Title",
  startTime: "Start",
  endTime: "End",
  frequency: "Frequency",
  frequencyDaily: "Daily",
  frequencyWeekdays: "Weekdays",
  frequencyInterval: "Every N days",
  intervalEvery: "Every",
  intervalDays: "days",
  startDate: "Start date",
  delete: "Delete routine",
};

const base: RoutineEditorRoutine = {
  id: "x",
  title: "Gym",
  startTime: "19:00",
  endTime: "20:30",
  frequencyType: "weekdays",
  frequencyDays: [1, 3, 5],
  frequencyInterval: null,
  frequencyStartDate: null,
};

function renderForm(
  routine: RoutineEditorRoutine,
  props?: Partial<Parameters<typeof RoutineEditorForm>[0]>,
) {
  const onPatch = vi.fn();
  const onDelete = vi.fn();
  render(
    <RoutineEditorForm
      routine={routine}
      onPatch={onPatch}
      onDelete={onDelete}
      weekdayLabels={WEEKDAYS}
      labels={LABELS}
      {...props}
    />,
  );
  return { onPatch, onDelete };
}

describe("RoutineEditorForm — frequency-type controls", () => {
  it("shows weekday chips for the weekdays type", () => {
    renderForm(base);
    expect(screen.getByRole("button", { name: "Mon" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Start date")).toBeNull();
  });

  it("shows the interval + start-date controls for the interval type", () => {
    renderForm({ ...base, frequencyType: "interval", frequencyInterval: 3 });
    expect(screen.getByLabelText("Start date")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mon" })).toBeNull();
  });
});

describe("RoutineEditorForm — weekday toggle", () => {
  it("removes an already-selected weekday via onPatch", () => {
    const { onPatch } = renderForm(base);
    fireEvent.click(screen.getByRole("button", { name: "Wed" })); // 3 was selected
    expect(onPatch).toHaveBeenCalledWith("x", { frequencyDays: [1, 5] });
  });

  it("adds an unselected weekday via onPatch (kept sorted)", () => {
    const { onPatch } = renderForm(base);
    fireEvent.click(screen.getByRole("button", { name: "Tue" })); // 2 not selected
    expect(onPatch).toHaveBeenCalledWith("x", { frequencyDays: [1, 2, 3, 5] });
  });
});
