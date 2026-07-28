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
 * shape (no "none") is covered via routineEditorForm.test; here we pin the
 * Event-side knobs: the optional "none" choice and the patch-shaped onChange.
 * The "group" type and its chip picker were removed in #352.
 */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const LABELS: FrequencyEditorLabels = {
  frequency: "Repeat",
  frequencyDaily: "Daily",
  frequencyWeekdays: "Weekdays",
  frequencyInterval: "Every N days",
  frequencyNone: "None",
  intervalEvery: "Every",
  intervalDays: "days",
  startDate: "Start date",
};

const base: FrequencyEditorValue = {
  frequencyType: "weekdays",
  frequencyDays: [1, 3, 5],
  frequencyInterval: null,
  frequencyStartDate: null,
};

function renderEditor(
  value: FrequencyEditorValue | null,
  props?: Partial<Parameters<typeof FrequencyEditor>[0]>,
) {
  const onChange = vi.fn();
  render(
    <FrequencyEditor
      value={value}
      onChange={onChange}
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

describe("FrequencyEditor — retired group type (#352)", () => {
  it("never offers group as a choosable type", () => {
    renderEditor(base);
    expect(screen.queryByRole("tab", { name: /group/i })).toBeNull();
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

  it("drops an empty start-date emission, passes a concrete one (#407)", () => {
    // A date input emits "" while cleared / mid-edit. Persisting "" reads
    // as "fires never" under the fail-closed interval guard, and the
    // reconcile wired to frequency edits (#352) would sweep the series'
    // future — so the empty transient must never reach the host.
    const { onChange } = renderEditor({
      ...base,
      frequencyType: "interval",
      frequencyInterval: 3,
      frequencyStartDate: "2026-05-17",
    });
    fireEvent.change(screen.getByLabelText("Start date"), {
      target: { value: "" },
    });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Start date"), {
      target: { value: "2026-05-20" },
    });
    expect(onChange).toHaveBeenCalledWith({ frequencyStartDate: "2026-05-20" });
  });
});
