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
    openFilter: "Filter by tag",
    filterActive: "Filtered by 2 tags",
  },
};

/** The badge, as the toolbar draws it (#1639). */
const badge = () => document.querySelector("[data-filter-count]");

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

/*
 * #1469 — in a narrow pane (detail panel open at 1280 wide) the toolbar folds
 * its two text buttons to icons instead of wrapping onto a second row. jsdom
 * has no layout, so the fold itself is not observable here; what these pin is
 * the contract that makes the fold safe: the accessible name does not depend
 * on the text that gets hidden, and the text sits in its own node so a
 * container variant CAN hide it without taking the icon with it.
 */
describe("ScheduleToolbar narrow-pane fold", () => {
  it("keeps the add-event button's name when its text folds to the icon", () => {
    const onAdd = vi.fn();
    render(<ScheduleToolbar {...base} onAddEvent={onAdd} />);
    const btn = screen.getByRole("button", { name: "Add event" });
    // Name from aria-label, not from the (foldable) text.
    expect(btn).toHaveAttribute("aria-label", "Add event");
    expect(btn).toHaveAttribute("title", "Add event");
    const text = screen.getByText("Add event");
    expect(text.tagName).toBe("SPAN");
    expect(text.className).toContain("@max-3xl:hidden");
    fireEvent.click(btn);
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("folds the repeat ACTION but never the hidden-count NOTICE", () => {
    // Off: "Hide repeats" is an action — the icon alone can carry it.
    const { unmount } = render(
      <ScheduleToolbar {...base} onToggleRepeats={() => {}} />,
    );
    const off = screen.getByRole("button", { name: "Hide repeats" });
    expect(off).toHaveAttribute("aria-label", "Hide repeats");
    expect(screen.getByText("Hide repeats").className).toContain(
      "@max-3xl:hidden",
    );
    unmount();

    // On: the count is the #466 point of the button — an empty slot on a
    // filtered grid reads as free time — so it stays visible at every width.
    render(
      <ScheduleToolbar {...base} onToggleRepeats={() => {}} repeatsHidden />,
    );
    const on = screen.getByRole("button", { name: "3 hidden" });
    expect(on).toHaveAttribute("aria-label", "3 hidden");
    expect(screen.getByText("3 hidden").className).not.toContain(
      "@max-3xl:hidden",
    );
  });
});

/*
 * #1639 — how many tags the grid is narrowed by, on the filter icon.
 *
 * The button already turned accent-coloured while a filter was on, which says
 * THAT one is on and nothing about how much it hides. The number is what tells
 * the user whether an empty-looking week is empty or filtered.
 */
describe("ScheduleToolbar filter count", () => {
  it("draws no badge while nothing is filtered", () => {
    render(<ScheduleToolbar {...base} onOpenFilter={() => {}} />);
    expect(badge()).toBeNull();
    // The name is still the invitation, not a report.
    screen.getByRole("button", { name: "Filter by tag" });
  });

  it("shows the number for one tag, and names it in the accessible label", () => {
    render(
      <ScheduleToolbar
        {...base}
        onOpenFilter={() => {}}
        filterActive
        filterCount={1}
        labels={{ ...base.labels, filterActive: "Filtered by 1 tag" }}
      />,
    );
    expect(badge()?.textContent).toBe("1");
    // aria-hidden on the badge: the count is in the button's name already, and
    // hearing "1" on its own after it says nothing.
    expect(badge()?.getAttribute("aria-hidden")).toBe("true");
    screen.getByRole("button", { name: "Filtered by 1 tag" });
  });

  it("shows a bigger count", () => {
    render(
      <ScheduleToolbar
        {...base}
        onOpenFilter={() => {}}
        filterActive
        filterCount={3}
      />,
    );
    expect(badge()?.textContent).toBe("3");
  });

  it("drops the badge again when the filter is cleared", () => {
    const { rerender } = render(
      <ScheduleToolbar
        {...base}
        onOpenFilter={() => {}}
        filterActive
        filterCount={2}
      />,
    );
    expect(badge()?.textContent).toBe("2");
    rerender(
      <ScheduleToolbar {...base} onOpenFilter={() => {}} filterCount={0} />,
    );
    expect(badge()).toBeNull();
  });
});
