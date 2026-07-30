import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ScheduleToolbar } from "../src/components";

/*
 * ScheduleToolbar — the repeat filter toggle (#466 Step 5-b). The rest of the
 * toolbar is covered where it is used; these pin the toggle's contract, which
 * the host relies on to say "N hidden" and to offer the way back out.
 */

const base = {
  periodLabel: "July 2026",
  onToday: () => {},
  onPrev: () => {},
  onNext: () => {},
  view: "week",
  viewOptions: [
    { id: "week", label: "Week" },
    { id: "month", label: "Month" },
  ],
  onChangeView: () => {},
  addEventLabel: "Add event",
  labels: {
    today: "Today",
    prev: "Previous",
    next: "Next",
    hideRepeats: "Hide repeats",
    repeatsHidden: "3 hidden",
  },
};

describe("ScheduleToolbar repeat filter", () => {
  it("renders no toggle when onToggleRepeats is omitted", () => {
    // Mobile passes no handler: the single-day list has no scaffolding to fold.
    render(<ScheduleToolbar {...base} />);
    expect(screen.queryByText("Hide repeats")).toBeNull();
  });

  it("offers the action and reports not-pressed while the filter is off", () => {
    const onToggle = vi.fn();
    render(<ScheduleToolbar {...base} onToggleRepeats={onToggle} />);
    const btn = screen.getByRole("button", { name: "Hide repeats" });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(btn);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("shows the hidden-count label and reports pressed while the filter is on", () => {
    const onToggle = vi.fn();
    render(
      <ScheduleToolbar {...base} onToggleRepeats={onToggle} repeatsHidden />,
    );
    // While on, the button IS the notice: the count and the way back out are
    // the same control, so a filtered grid can never look unfiltered.
    const btn = screen.getByRole("button", { name: "3 hidden" });
    expect(btn).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("Hide repeats")).toBeNull();
    fireEvent.click(btn);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
