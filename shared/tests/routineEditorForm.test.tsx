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
 * date / group chips); toggling a weekday chip patches frequencyDays.
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
  frequencyGroup: "Group",
  intervalEvery: "Every",
  intervalDays: "days",
  startDate: "Start date",
  groups: "Groups",
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
  groupIds: [],
};

const GROUPS = [{ id: "g1", name: "Morning", color: "tomato" }];

function renderForm(
  routine: RoutineEditorRoutine,
  props?: Partial<Parameters<typeof RoutineEditorForm>[0]>,
) {
  const onPatch = vi.fn();
  const onDelete = vi.fn();
  render(
    <RoutineEditorForm
      routine={routine}
      groups={GROUPS}
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

  it("shows group chips for the group type", () => {
    renderForm({ ...base, frequencyType: "group", groupIds: [] });
    expect(screen.getByRole("button", { name: /Morning/ })).toBeInTheDocument();
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
