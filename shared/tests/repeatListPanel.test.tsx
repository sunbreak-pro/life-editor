import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  RepeatListPanel,
  type RepeatListRow,
  type RepeatListPanelLabels,
} from "../src/components";

/*
 * RepeatListPanel (#408) — the rightSidebar tab that replaced the Routines
 * header tab. What these pin is the reachability contract: every routine has a
 * row (the calendar itself can only show materialised occurrences), a row with
 * no next occurrence is not a dead button, and delete stays available on the
 * rows that have nowhere to navigate.
 */

const LABELS: RepeatListPanelLabels = {
  empty: "No routines yet",
  never: "Fires on no day",
  delete: "Delete routine",
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

function renderPanel(override?: Partial<RepeatListRow[]>) {
  const onOpen = vi.fn();
  const onDelete = vi.fn();
  render(
    <RepeatListPanel
      rows={(override as RepeatListRow[]) ?? rows}
      onOpen={onOpen}
      onDelete={onDelete}
      labels={LABELS}
    />,
  );
  return { onOpen, onDelete };
}

describe("RepeatListPanel", () => {
  it("shows the empty copy when there is nothing to list", () => {
    renderPanel([]);
    expect(screen.getByText("No routines yet")).toBeInTheDocument();
  });

  it("lists every row with its frequency, time and next date", () => {
    renderPanel();
    expect(screen.getByText("Morning run")).toBeInTheDocument();
    expect(
      screen.getByText("Daily · 7:00 · July 28 (Tue)"),
    ).toBeInTheDocument();
  });

  it("navigates to the next occurrence when a row is activated", () => {
    const { onOpen } = renderPanel();
    // Anchored: the row's own name STARTS with the title, while the delete
    // button's is "Delete routine: <title>" — an unanchored match hits both.
    fireEvent.click(screen.getByRole("button", { name: /^Morning run/ }));
    expect(onOpen).toHaveBeenCalledWith("r-1");
  });

  it("renders a no-occurrence row as text, not a dead button", () => {
    // A button that does nothing when pressed reads as broken; the row still
    // has to be visible, because it is the only place this routine exists.
    const { onOpen } = renderPanel();
    expect(screen.queryByRole("button", { name: /^Broken repeat/ })).toBeNull();
    expect(screen.getByText("Broken repeat")).toBeInTheDocument();
    expect(
      screen.getByText("Every N days · Fires on no day"),
    ).toBeInTheDocument();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("keeps delete reachable on a routine with no occurrence", () => {
    // Without this the #407 zombies would be permanently unreachable: no
    // occurrence to select on the calendar, and no Routines tab any more.
    const { onDelete } = renderPanel();
    fireEvent.click(
      screen.getByRole("button", { name: "Delete routine: Broken repeat" }),
    );
    expect(onDelete).toHaveBeenCalledWith("r-2");
  });
});
