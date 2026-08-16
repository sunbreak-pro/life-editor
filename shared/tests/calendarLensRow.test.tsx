import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CalendarLensRow } from "../src/components";

/*
 * CalendarLensRow (#468, lifted out of CalendarTab by #889).
 *
 * The rules worth pinning are the ones about NOT being there. The row hides
 * itself when there is no calendar to offer, which is also what happens while
 * the tags are still loading or after their fetch failed — the safe
 * direction, because the alternative is offering a chip that would empty the
 * grid. And the hidden count is the lens's own: the repeat filter reports its
 * rows through the toolbar button, so a row showing a combined total would
 * claim more missing rows than there are.
 */

const CHIPS = [
  { id: "cal-work", label: "Work" },
  { id: "cal-home", label: "Home" },
];

const LABELS = {
  filterLabel: "Calendar",
  hidden: "3 hidden",
  showAll: "Show all",
};

function renderRow(over?: { chips?: typeof CHIPS; activeId?: string | null }) {
  const onChange = vi.fn();
  render(
    <CalendarLensRow
      chips={over?.chips ?? CHIPS}
      activeId={over?.activeId ?? null}
      onChange={onChange}
      labels={LABELS}
    />,
  );
  return { onChange };
}

describe("CalendarLensRow", () => {
  it("renders nothing at all when there is no calendar to offer", () => {
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

  it("offers every calendar and reports the picked one", () => {
    const { onChange } = renderRow();
    screen.getByText("Work");
    fireEvent.click(screen.getByText("Home"));
    expect(onChange).toHaveBeenCalledWith("cal-home");
  });

  it("says nothing about hidden rows while the grid shows everything", () => {
    renderRow({ activeId: null });
    expect(screen.queryByText("3 hidden")).toBeNull();
    expect(screen.queryByText("Show all")).toBeNull();
  });

  it("shows the lens's own hidden count once a calendar is in effect", () => {
    renderRow({ activeId: "cal-work" });
    screen.getByText("3 hidden");
  });

  it("clears the lens back to null from the show-all button", () => {
    const { onChange } = renderRow({ activeId: "cal-work" });
    fireEvent.click(screen.getByText("Show all"));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
