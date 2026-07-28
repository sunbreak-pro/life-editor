import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  FrequencyEditor,
  type FrequencyEditorValue,
  type FrequencyEditorLabels,
} from "../src/components";

/*
 * FrequencyEditor (#185 Step 2) — the repeat-settings editor in the Event
 * editor's repeat section (it was shared with the Routines-tab form until #408
 * retired that tab and its test). Here we pin the Event-side knobs: the
 * optional "none" choice and the patch-shaped onChange; the no-"none" shape is
 * covered by the first case below.
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
  converting: "Turning on repeat…",
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

describe("FrequencyEditor — pending (#434)", () => {
  // The #407 in-flight guard silently ignores a second frequency click while
  // an Event→Repeats conversion is running. Silent is the bug: the user reads
  // it as a dead button. `pending` gives that guard a visible cause.
  it("locks every control and says why while pending", () => {
    renderEditor(
      { ...base, frequencyType: "interval", frequencyInterval: 3 },
      { pending: true, onSelectNone: vi.fn() },
    );
    expect(screen.getByRole("tab", { name: "Daily" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("tab", { name: "None" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByLabelText("Every N days")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Start date")).toHaveAttribute("readonly");
    expect(screen.getByRole("status")).toHaveTextContent("Turning on repeat…");
  });

  it("keeps the locked controls focusable so focus is not lost", () => {
    // A real `disabled` would strip the section of focusable elements and
    // the browser would dump keyboard focus on <body> mid-interaction — the
    // lock is transient, the focus loss would not be.
    renderEditor(base, { pending: true });
    const daily = screen.getByRole("tab", { name: "Daily" });
    expect(daily).not.toBeDisabled();
    daily.focus();
    expect(document.activeElement).toBe(daily);
  });

  it("marks the weekday chips disabled while pending", () => {
    renderEditor(base, { pending: true });
    expect(screen.getByRole("button", { name: "Tue" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("emits nothing when a pending control is clicked", () => {
    const onSelectNone = vi.fn();
    const { onChange } = renderEditor(base, { pending: true, onSelectNone });
    fireEvent.click(screen.getByRole("tab", { name: "Daily" }));
    fireEvent.click(screen.getByRole("tab", { name: "None" }));
    fireEvent.click(screen.getByRole("button", { name: "Tue" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(onSelectNone).not.toHaveBeenCalled();
  });

  it("emits nothing when a pending interval input changes", () => {
    // readOnly stops typing, but a date picker can still commit a value in
    // some browsers — the handler guard is the one that must hold.
    const { onChange } = renderEditor(
      {
        ...base,
        frequencyType: "interval",
        frequencyInterval: 3,
        frequencyStartDate: "2026-05-17",
      },
      { pending: true },
    );
    fireEvent.change(screen.getByLabelText("Every N days"), {
      target: { value: "9" },
    });
    fireEvent.change(screen.getByLabelText("Start date"), {
      target: { value: "2026-05-20" },
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("stays interactive when pending is not set", () => {
    const { onChange } = renderEditor(base);
    expect(screen.getByRole("tab", { name: "Daily" })).not.toHaveAttribute(
      "aria-disabled",
    );
    expect(screen.queryByRole("status")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Daily" }));
    expect(onChange).toHaveBeenCalledWith({ frequencyType: "daily" });
  });
});
