import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CalendarLensRow } from "../src/components";

/*
 * CalendarLensRow (#468, lifted out of CalendarTab by #889, re-based on saved
 * tag groups by #1173).
 *
 * The rules worth pinning are the ones about NOT being there. The row hides
 * itself when there is no group to offer AND nothing is filtered — which is
 * also what happens while the tags are still loading or after their fetch
 * failed, the safe direction, because the alternative is offering a chip that
 * would empty the grid. The `filtered` half is #1173's: an ad-hoc tick list
 * narrows the grid while lighting no chip, and a row that hid itself then
 * would leave the user filtered with no way back out on screen.
 *
 * And the hidden count is the lens's own: the repeat filter reports its rows
 * through the toolbar button, so a row showing a combined total would claim
 * more missing rows than there are.
 */

const CHIPS = [
  { id: "group-work", label: "Work" },
  { id: "group-home", label: "Home" },
];

const LABELS = {
  filterLabel: "Group",
  hidden: "3 hidden",
  showAll: "Show all",
};

function renderRow(over?: {
  chips?: typeof CHIPS;
  activeId?: string | null;
  filtered?: boolean;
  onClear?: () => void;
}) {
  const onChange = vi.fn();
  render(
    <CalendarLensRow
      chips={over?.chips ?? CHIPS}
      activeId={over?.activeId ?? null}
      onChange={onChange}
      filtered={over?.filtered}
      onClear={over?.onClear}
      labels={LABELS}
    />,
  );
  return { onChange };
}

describe("CalendarLensRow", () => {
  it("renders nothing when there is no group to offer and no filter on", () => {
    // Also the loading and the failed-fetch case: the host has no chips to
    // pass in either, and an empty row would cost vertical space for nothing.
    const { container } = render(
      <CalendarLensRow
        chips={[]}
        activeId={null}
        onChange={vi.fn()}
        labels={LABELS}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("still appears with no chips while an ad-hoc filter is on (#1173)", () => {
    // The filter panel can narrow the grid by tags that match no saved group.
    // Hiding the row then would take away both the "N hidden" line and the
    // only on-screen way back to the full grid.
    renderRow({ chips: [], filtered: true });
    screen.getByText("3 hidden");
    screen.getByText("Show all");
  });

  it("offers every group and reports the picked one", () => {
    const { onChange } = renderRow();
    screen.getByText("Work");
    fireEvent.click(screen.getByText("Home"));
    expect(onChange).toHaveBeenCalledWith("group-home");
  });

  it("says nothing about hidden rows while the grid shows everything", () => {
    renderRow({ activeId: null });
    expect(screen.queryByText("3 hidden")).toBeNull();
    expect(screen.queryByText("Show all")).toBeNull();
  });

  it("shows the lens's own hidden count once a group is in effect", () => {
    renderRow({ activeId: "group-work" });
    screen.getByText("3 hidden");
  });

  it("clears the lens back to null from the show-all button", () => {
    const { onChange } = renderRow({ activeId: "group-work" });
    fireEvent.click(screen.getByText("Show all"));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("prefers onClear, which also clears an ad-hoc tick list", () => {
    // `onChange(null)` only unlights a chip. With tags ticked by hand there is
    // no chip to unlight, so the host hands down the one call that empties the
    // tick list itself.
    const onClear = vi.fn();
    const { onChange } = renderRow({ activeId: "group-work", onClear });
    fireEvent.click(screen.getByText("Show all"));
    expect(onClear).toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });
});
