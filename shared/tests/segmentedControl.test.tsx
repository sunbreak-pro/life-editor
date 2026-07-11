import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SegmentedControl, type SegmentedOption } from "../src/components";

/*
 * Target-IA Mobile segmented control — the narrow echo of HeaderTabs. Active
 * segment carries aria-selected; clicking / arrowing another segment reports
 * it via onChange (WAI-ARIA tabs semantics).
 */

const OPTIONS: SegmentedOption[] = [
  { id: "tasks", label: "Tasks" },
  { id: "notes", label: "Notes" },
  { id: "daily", label: "Daily" },
  { id: "tags", label: "Tags" },
];

function renderControl(
  props?: Partial<Parameters<typeof SegmentedControl>[0]>,
) {
  const onChange = vi.fn();
  render(
    <SegmentedControl
      options={OPTIONS}
      value="tasks"
      onChange={onChange}
      {...props}
    />,
  );
  return { onChange };
}

describe("SegmentedControl", () => {
  it("renders one role=tab per option", () => {
    renderControl();
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(OPTIONS.length);
    expect(tabs.map((t) => t.textContent)).toEqual([
      "Tasks",
      "Notes",
      "Daily",
      "Tags",
    ]);
  });

  it("pads each segment horizontally so intrinsic-width labels stay separated", () => {
    // Regression guard for #183: under w-auto the segments must not collapse
    // into a run-on label (e.g. "DayWeekMonth"). px-3 keeps them apart.
    renderControl();
    for (const tab of screen.getAllByRole("tab")) {
      expect(tab).toHaveClass("px-3");
    }
  });

  it("marks the selected segment with aria-selected", () => {
    renderControl();
    expect(screen.getByRole("tab", { name: "Tasks" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Notes" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("reports the chosen segment via onChange on click", () => {
    const { onChange } = renderControl();
    fireEvent.click(screen.getByRole("tab", { name: "Daily" }));
    expect(onChange).toHaveBeenCalledWith("daily");
  });

  it("switches with arrow keys (wrapping past the ends)", () => {
    const { onChange } = renderControl();
    const active = screen.getByRole("tab", { name: "Tasks" });
    fireEvent.keyDown(active, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("notes");
    fireEvent.keyDown(active, { key: "ArrowLeft" });
    expect(onChange).toHaveBeenCalledWith("tags");
  });
});
