import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  FrequencyEditor,
  type FrequencyEditorValue,
  type FrequencyEditorLabels,
} from "../src/components";

/*
 * FrequencyEditor (#185 Step 2) — the repeat-settings editor shared between
 * RoutineEditorForm and the Event editor's repeat section. The Routines-tab
 * shape (no "none", group choosable) is covered via routineEditorForm.test;
 * here we pin the Event-side knobs: the optional "none" choice, allowGroup
 * gating, and the patch-shaped onChange.
 */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const LABELS: FrequencyEditorLabels = {
  frequency: "Repeat",
  frequencyDaily: "Daily",
  frequencyWeekdays: "Weekdays",
  frequencyInterval: "Every N days",
  frequencyGroup: "Group",
  frequencyNone: "None",
  intervalEvery: "Every",
  intervalDays: "days",
  startDate: "Start date",
  groups: "Groups",
};

const base: FrequencyEditorValue = {
  frequencyType: "weekdays",
  frequencyDays: [1, 3, 5],
  frequencyInterval: null,
  frequencyStartDate: null,
  groupIds: [],
};

const GROUPS = [{ id: "g1", name: "Morning", color: "tomato" }];

function renderEditor(
  value: FrequencyEditorValue | null,
  props?: Partial<Parameters<typeof FrequencyEditor>[0]>,
) {
  const onChange = vi.fn();
  render(
    <FrequencyEditor
      value={value}
      onChange={onChange}
      groups={GROUPS}
      weekdayLabels={WEEKDAYS}
      labels={LABELS}
      {...props}
    />,
  );
  return { onChange };
}

describe("FrequencyEditor — none (no repeat) choice", () => {
  it("omits the none segment unless onSelectNone is provided", () => {
    renderEditor(base);
    expect(screen.queryByRole("tab", { name: "None" })).toBeNull();
  });

  it("marks none active for a null value and hides sub-controls", () => {
    renderEditor(null, { onSelectNone: vi.fn() });
    const none = screen.getByRole("tab", { name: "None" });
    expect(none).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("button", { name: "Mon" })).toBeNull();
    expect(screen.queryByLabelText("Start date")).toBeNull();
  });

  it("routes none to onSelectNone and types to onChange", () => {
    const onSelectNone = vi.fn();
    const { onChange } = renderEditor(base, { onSelectNone });
    fireEvent.click(screen.getByRole("tab", { name: "None" }));
    expect(onSelectNone).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("tab", { name: "Daily" }));
    expect(onChange).toHaveBeenCalledWith({ frequencyType: "daily" });
  });
});

describe("FrequencyEditor — allowGroup gating", () => {
  it("offers group by default", () => {
    renderEditor(base);
    expect(screen.getByRole("tab", { name: "Group" })).toBeInTheDocument();
  });

  it("hides group when allowGroup is false", () => {
    renderEditor(base, { allowGroup: false });
    expect(screen.queryByRole("tab", { name: "Group" })).toBeNull();
  });

  it("keeps group visible when it is the current value even with allowGroup false", () => {
    renderEditor(
      { ...base, frequencyType: "group", groupIds: [] },
      { allowGroup: false },
    );
    expect(screen.getByRole("tab", { name: "Group" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("button", { name: /Morning/ })).toBeInTheDocument();
  });
});

describe("FrequencyEditor — patches", () => {
  it("toggles weekdays via a frequencyDays patch (kept sorted)", () => {
    const { onChange } = renderEditor(base);
    fireEvent.click(screen.getByRole("button", { name: "Tue" }));
    expect(onChange).toHaveBeenCalledWith({ frequencyDays: [1, 2, 3, 5] });
    fireEvent.click(screen.getByRole("button", { name: "Wed" }));
    expect(onChange).toHaveBeenCalledWith({ frequencyDays: [1, 5] });
  });

  it("toggles group membership via a groupIds patch", () => {
    const { onChange } = renderEditor({
      ...base,
      frequencyType: "group",
      groupIds: [],
    });
    fireEvent.click(screen.getByRole("button", { name: /Morning/ }));
    expect(onChange).toHaveBeenCalledWith({ groupIds: ["g1"] });
  });

  it("clamps the interval to at least 1", () => {
    const { onChange } = renderEditor({
      ...base,
      frequencyType: "interval",
      frequencyInterval: 3,
    });
    fireEvent.change(screen.getByLabelText("Every N days"), {
      target: { value: "0" },
    });
    expect(onChange).toHaveBeenCalledWith({ frequencyInterval: 1 });
  });
});
