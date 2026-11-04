import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import {
  DEFAULT_GOAL_TREE_ARRANGEMENT,
  type GoalTreeArrangement,
} from "../src/components/goalTree/buildGoalTreeModel";
import {
  describeGoalTreeFilter,
  GoalTreeArrangePanel,
  type GoalTreeArrangeLabels,
} from "../src/components/goalTree/GoalTreeArrangePanel";

/*
 * The goal tree's sort and filter in the Claude Design proposal's form (#2410):
 * period chips pressed again to clear, three statuses, and a switch.
 */

const LABELS: GoalTreeArrangeLabels = {
  heading: "Sort & filter",
  sortLabel: "Sort",
  sorts: { standard: "Standard", progress: "Progress", name: "Name" },
  periodLabel: "Period",
  all: "All",
  periods: { year: "This year", month: "This month", week: "This week" },
  statusLabel: "Status",
  statuses: { inProgress: "In progress", achieved: "Achieved" },
  hideDoneTodos: "Hide done todos",
};

function renderPanel(arrangement = DEFAULT_GOAL_TREE_ARRANGEMENT) {
  const onChange = vi.fn<(next: GoalTreeArrangement) => void>();
  render(
    <GoalTreeArrangePanel
      arrangement={arrangement}
      onChange={onChange}
      labels={LABELS}
    />,
  );
  return { onChange };
}

const withFilter = (
  filter: Partial<GoalTreeArrangement["filter"]>,
): GoalTreeArrangement => ({
  ...DEFAULT_GOAL_TREE_ARRANGEMENT,
  filter: { ...DEFAULT_GOAL_TREE_ARRANGEMENT.filter, ...filter },
});

describe("GoalTreeArrangePanel (#2410)", () => {
  it("offers the period as three chips with none picked at first", () => {
    renderPanel();
    const chips = within(
      screen.getByRole("group", { name: "Period" }),
    ).getAllByRole("button");
    expect(chips.map((chip) => chip.textContent)).toEqual([
      "This year",
      "This month",
      "This week",
    ]);
    for (const chip of chips) {
      expect(chip.getAttribute("aria-pressed")).toBe("false");
      expect(chip.querySelector("svg")).toBeNull();
    }
  });

  it("picks a chip, and marks only the picked one with a check", () => {
    const { onChange } = renderPanel(withFilter({ period: "month" }));
    const chip = (name: string) => screen.getByRole("button", { name });
    expect(chip("This month").getAttribute("aria-pressed")).toBe("true");
    expect(chip("This month").querySelector("svg")).not.toBeNull();
    expect(chip("This week").querySelector("svg")).toBeNull();

    fireEvent.click(chip("This week"));
    expect(onChange.mock.calls[0]?.[0].filter.period).toBe("week");
  });

  it("clears the period when the picked chip is pressed again", () => {
    const { onChange } = renderPanel(withFilter({ period: "month" }));
    fireEvent.click(screen.getByRole("button", { name: "This month" }));
    expect(onChange.mock.calls[0]?.[0].filter.period).toBe("all");
  });

  it("keeps the other filters when one changes", () => {
    const { onChange } = renderPanel(
      withFilter({ status: "achieved", hideDoneTodos: true }),
    );
    fireEvent.click(screen.getByRole("button", { name: "This year" }));
    expect(onChange.mock.calls[0]?.[0].filter).toEqual({
      period: "year",
      status: "achieved",
      hideDoneTodos: true,
    });
  });

  it("offers three statuses, without the unconnected one", () => {
    const { onChange } = renderPanel();
    const status = within(screen.getByRole("tablist", { name: "Status" }));
    expect(status.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "All",
      "In progress",
      "Achieved",
    ]);
    fireEvent.click(status.getByRole("tab", { name: "Achieved" }));
    expect(onChange.mock.calls[0]?.[0].filter.status).toBe("achieved");
  });

  it("turns hiding done todos on and off with a switch", () => {
    const { onChange } = renderPanel();
    const hide = screen.getByRole("switch", { name: "Hide done todos" });
    expect(hide.getAttribute("aria-checked")).toBe("false");
    expect(screen.queryByRole("checkbox")).toBeNull();
    fireEvent.click(hide);
    expect(onChange.mock.calls[0]?.[0].filter.hideDoneTodos).toBe(true);
  });

  it("gives the chips a 44px target under 768px", () => {
    renderPanel();
    expect(screen.getByRole("group", { name: "Period" }).className).toContain(
      "max-md:[&>button]:min-h-11",
    );
    expect(
      screen.getByRole("switch", { name: "Hide done todos" }).className,
    ).toContain("max-md:min-h-11");
  });
});

describe("describeGoalTreeFilter (#2410)", () => {
  it("names the period as the chips do", () => {
    expect(
      describeGoalTreeFilter(
        { period: "week", status: "achieved", hideDoneTodos: true },
        LABELS,
      ),
    ).toEqual(["This week", "Achieved", "Hide done todos"]);
  });

  it("says nothing when nothing is filtered", () => {
    expect(
      describeGoalTreeFilter(DEFAULT_GOAL_TREE_ARRANGEMENT.filter, LABELS),
    ).toEqual([]);
  });
});
