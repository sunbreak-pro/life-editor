import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SegmentedControl, type SegmentedOption } from "../src/components";

/*
 * Target-IA Mobile segmented control — the narrow echo of HeaderTabs. Active
 * segment carries aria-selected; clicking / arrowing another segment reports
 * it via onChange (WAI-ARIA tabs semantics).
 */

const OPTIONS: SegmentedOption[] = [
  { id: "todos", label: "Todos" },
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
      value="todos"
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
      "Todos",
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
    expect(screen.getByRole("tab", { name: "Todos" })).toHaveAttribute(
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
    const active = screen.getByRole("tab", { name: "Todos" });
    fireEvent.keyDown(active, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("notes");
    fireEvent.keyDown(active, { key: "ArrowLeft" });
    expect(onChange).toHaveBeenCalledWith("tags");
  });

  it("switches with ↑/↓ as well, matching its radiogroup siblings (#779)", () => {
    const { onChange } = renderControl();
    const active = screen.getByRole("tab", { name: "Todos" });
    fireEvent.keyDown(active, { key: "ArrowDown" });
    expect(onChange).toHaveBeenCalledWith("notes");
    fireEvent.keyDown(active, { key: "ArrowUp" });
    expect(onChange).toHaveBeenCalledWith("tags");
  });

  /*
   * #1039 — the mobile section tab band shrinks, the touch target does not.
   *
   * jsdom has no layout (CLAUDE.md §7.1), so "the band is 4px shorter" is not
   * measurable here; what IS pinnable is the contract that produces it — which
   * size the classes come from, and that the smaller one still carries the
   * invisible 44px hit area rather than dropping to its painted height.
   */
  it("keeps the roomier type and padding at the default size", () => {
    renderControl();
    for (const tab of screen.getAllByRole("tab")) {
      expect(tab).toHaveClass("text-sm");
      expect(tab).toHaveClass("py-1.5");
    }
  });

  it('steps the type down one at size="sm"', () => {
    renderControl({ size: "sm" });
    for (const tab of screen.getAllByRole("tab")) {
      expect(tab).toHaveClass("text-xs");
      expect(tab).toHaveClass("px-2.5");
      expect(tab).not.toHaveClass("text-sm");
    }
  });

  it('hangs a 44px hit area over the smaller pill at size="sm"', () => {
    renderControl({ size: "sm" });
    for (const tab of screen.getAllByRole("tab")) {
      // TAP_TARGET_TALL: a transparent ::after, the control's own width,
      // centred on it at h-11 (44px). `relative` is what it hangs from.
      expect(tab).toHaveClass("relative");
      expect(tab).toHaveClass("after:h-11");
      expect(tab).toHaveClass("after:inset-x-0");
    }
  });

  it("leaves the default size without the overlay (it has no row to shrink)", () => {
    renderControl();
    for (const tab of screen.getAllByRole("tab")) {
      expect(tab).not.toHaveClass("after:h-11");
    }
  });

  it("ignores arrow keys while disabled", () => {
    const { onChange } = renderControl({ disabled: true });
    fireEvent.keyDown(screen.getByRole("tab", { name: "Todos" }), {
      key: "ArrowDown",
    });
    expect(onChange).not.toHaveBeenCalled();
  });
});
