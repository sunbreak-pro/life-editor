import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DateRangePresetSelector } from "../src/components/Analytics/DateRangePresetSelector";
import type { DatePreset } from "../src/components/Analytics/AnalyticsFilterContext";

/*
 * DateRangePresetSelector finally wires AnalyticsFilterContext.applyPreset to a
 * real header control (design-analytics-v2). It is a single-select filter
 * (radiogroup): the active preset carries aria-checked, clicks fire onChange,
 * and Left/Right arrows roam + select.
 */
const OPTIONS: Record<DatePreset, string> = {
  "7d": "7 days",
  "30d": "30 days",
  thisMonth: "This month",
  "3m": "3 months",
  all: "All time",
};

function renderSelector(value: DatePreset = "30d") {
  const onChange = vi.fn();
  render(
    <DateRangePresetSelector
      value={value}
      onChange={onChange}
      label="Date range"
      options={OPTIONS}
    />,
  );
  return { onChange };
}

describe("DateRangePresetSelector", () => {
  it("exposes a labelled radiogroup with one radio per preset", () => {
    renderSelector();
    expect(
      screen.getByRole("radiogroup", { name: "Date range" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(5);
  });

  it("marks the active preset with aria-checked", () => {
    renderSelector("30d");
    expect(screen.getByRole("radio", { name: "30 days" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: "7 days" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("fires onChange with the preset id on click", () => {
    const { onChange } = renderSelector("30d");
    fireEvent.click(screen.getByRole("radio", { name: "This month" }));
    expect(onChange).toHaveBeenCalledWith("thisMonth");
  });

  it("selects the next preset on ArrowRight and wraps around", () => {
    const { onChange } = renderSelector("all");
    fireEvent.keyDown(screen.getByRole("radio", { name: "All time" }), {
      key: "ArrowRight",
    });
    // "all" is the last option → wraps to the first ("7d").
    expect(onChange).toHaveBeenCalledWith("7d");
  });
});
