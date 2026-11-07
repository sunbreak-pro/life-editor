import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import {
  RepeatListPanel,
  type RepeatListRow,
  type RepeatListPanelLabels,
} from "../src/components";

/*
 * RepeatListPanel (#408) — the rightSidebar tab that replaced the Routines
 * header tab. What these pin is the reachability contract: every routine has a
 * row (the calendar itself can only show materialised occurrences), and a row
 * with no next occurrence is not a dead button.
 *
 * #2569 made the row the prototype's two lines — the name, then the frequency
 * on the left and「次 …」on the right — and took the trash off it: deleting
 * lives in the row's panel (ScheduleOverlays, #1678), which the no-occurrence
 * row opens too.
 */

const LABELS: RepeatListPanelLabels = {
  empty: "No routines yet",
  never: "Fires on no day",
  next: (date) => `Next ${date}`,
};

const rows: RepeatListRow[] = [
  {
    id: "r-1",
    title: "Morning run",
    timeLabel: "7:00",
    frequencyLabel: "Daily",
    nextLabel: "July 28 (Tue)",
  },
  {
    id: "r-2",
    title: "Broken repeat",
    timeLabel: "",
    frequencyLabel: "Every N days",
    nextLabel: null,
  },
];

function renderPanel(override?: RepeatListRow[]) {
  const onOpen = vi.fn();
  render(
    <RepeatListPanel rows={override ?? rows} onOpen={onOpen} labels={LABELS} />,
  );
  return { onOpen };
}

const rowButton = (title: string): HTMLElement =>
  screen.getByText(title).closest("button")!;

const metaLine = (title: string): HTMLElement =>
  rowButton(title).querySelector<HTMLElement>("[data-repeat-row-meta]")!;

describe("RepeatListPanel", () => {
  it("shows the empty copy when there is nothing to list", () => {
    renderPanel([]);
    expect(screen.getByText("No routines yet")).toBeInTheDocument();
  });

  it("puts the frequency on the left and the next date on the right (#2569)", () => {
    renderPanel();
    const meta = metaLine("Morning run");
    const [left, right] = Array.from(meta.children) as HTMLElement[];
    expect(left.textContent).toBe("Daily");
    expect(right.textContent).toBe("Next July 28 (Tue)");
    // The date never shrinks, so a long frequency truncates before it does
    // (390px drawer).
    expect(left.className.split(" ")).toEqual(
      expect.arrayContaining(["min-w-0", "flex-1", "truncate"]),
    );
    expect(right.className.split(" ")).toEqual(
      expect.arrayContaining(["shrink-0", "whitespace-nowrap"]),
    );
  });

  it("leaves the time off the row — the row's panel reads it (#2574)", () => {
    renderPanel();
    expect(within(rowButton("Morning run")).queryByText(/7:00/)).toBeNull();
  });

  it("says the routine fires on no day where the date would be", () => {
    renderPanel();
    const [left, right] = Array.from(
      metaLine("Broken repeat").children,
    ) as HTMLElement[];
    expect(left.textContent).toBe("Every N days");
    expect(right.textContent).toBe("Fires on no day");
  });

  it("draws the row without a border, as two lines", () => {
    renderPanel();
    const btn = rowButton("Morning run");
    expect(btn.className.split(" ")).not.toContain("border");
    expect(btn.closest("li")!.className.split(" ")).not.toContain("border");
    expect(btn.className.split(" ")).toContain("flex-col");
  });

  it("hands the press back with the point it happened at (#1678)", () => {
    const { onOpen } = renderPanel();
    fireEvent.click(rowButton("Morning run"), { clientX: 12, clientY: 34 });
    // The point is what the host anchors its panel at — the same hand-off a
    // grid item makes (#299).
    expect(onOpen).toHaveBeenCalledWith("r-1", { x: 12, y: 34 });
  });

  it("opens a no-occurrence row too (#1678)", () => {
    // The press opens the row's PANEL, and a series with nothing on the
    // calendar is the one most worth opening (#407's zombies) — its delete
    // is there since #2569, and the jump is disabled there with a reason.
    const { onOpen } = renderPanel();
    fireEvent.click(rowButton("Broken repeat"), { clientX: 5, clientY: 6 });
    expect(onOpen).toHaveBeenCalledWith("r-2", { x: 5, y: 6 });
  });

  it("offers no delete on any row (#2569)", () => {
    renderPanel();
    // One button per row: the row itself.
    expect(screen.getAllByRole("button")).toHaveLength(rows.length);
  });

  it("gives the row press a 44px floor on narrow only (#2083)", () => {
    renderPanel();
    const row = rowButton("Morning run");
    expect(row.className).toContain("max-md:min-h-11");
    expect(row.className.split(" ")).not.toContain("min-h-11");
  });
});
