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
 * The goal tree's sort and filter in the Claude Design proposal's form (#2410,
 * #2610): three period chips, each on or off on its own and all on at first,
 * three statuses, a switch, and "Reset all" while anything is set.
 */

const LABELS: GoalTreeArrangeLabels = {
  heading: "Sort & filter",
  sortLabel: "Sort",
  sorts: { standard: "Standard", progress: "Progress", name: "Name" },
  periodLabel: "Period",
  all: "All",
  periods: { year: "This year", month: "This month", week: "This week" },
  periodSeparator: ", ",
  statusLabel: "Status",
  statuses: { inProgress: "In progress", achieved: "Achieved" },
  hideDoneTodos: "Hide done todos",
  resetAll: "Reset all",
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

const chip = (name: string) => screen.getByRole("button", { name });

describe("GoalTreeArrangePanel (#2410, #2610)", () => {
  it("offers the period as three chips, all on and checked at first", () => {
    renderPanel();
    const chips = within(
      screen.getByRole("group", { name: "Period" }),
    ).getAllByRole("button");
    expect(chips.map((c) => c.textContent)).toEqual([
      "This year",
      "This month",
      "This week",
    ]);
    for (const c of chips) {
      expect(c.getAttribute("aria-pressed")).toBe("true");
      expect(c.querySelector("svg")).not.toBeNull();
    }
  });

  it("turns one period off on its own, leaving the others on", () => {
    const { onChange } = renderPanel();
    fireEvent.click(chip("This month"));
    expect(onChange.mock.calls[0]?.[0].filter.periods).toEqual([
      "year",
      "week",
    ]);
  });

  it("draws an off chip without its check, and turns it back on in chip order", () => {
    const { onChange } = renderPanel(withFilter({ periods: ["week"] }));
    expect(chip("This year").getAttribute("aria-pressed")).toBe("false");
    expect(chip("This year").querySelector("svg")).toBeNull();
    expect(chip("This week").querySelector("svg")).not.toBeNull();

    fireEvent.click(chip("This year"));
    expect(onChange.mock.calls[0]?.[0].filter.periods).toEqual([
      "year",
      "week",
    ]);
  });

  it("keeps the last period on, so the tree is never emptied by it", () => {
    const { onChange } = renderPanel(withFilter({ periods: ["month"] }));
    fireEvent.click(chip("This month"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps the other filters when one changes", () => {
    const { onChange } = renderPanel(
      withFilter({ status: "achieved", hideDoneTodos: true }),
    );
    fireEvent.click(chip("This year"));
    expect(onChange.mock.calls[0]?.[0].filter).toEqual({
      periods: ["month", "week"],
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

  it("sets the field labels in bold", () => {
    renderPanel();
    for (const name of ["Sort", "Period", "Status"]) {
      const label = screen.getByText(name, { selector: "span" });
      expect(label.className).toContain("font-bold");
    }
  });

  it("offers no reset while nothing is set", () => {
    renderPanel();
    expect(screen.queryByRole("button", { name: "Reset all" })).toBeNull();
  });

  it("resets a period back to all three on, and the sort to Standard", () => {
    const { onChange } = renderPanel({
      sort: "name",
      filter: { periods: ["week"], status: "achieved", hideDoneTodos: true },
    });
    fireEvent.click(chip("Reset all"));
    expect(onChange).toHaveBeenCalledWith(DEFAULT_GOAL_TREE_ARRANGEMENT);
    expect(onChange.mock.calls[0]?.[0].filter.periods).toEqual([
      "year",
      "month",
      "week",
    ]);
  });

  it("offers the reset when only the sort is changed", () => {
    renderPanel({ ...DEFAULT_GOAL_TREE_ARRANGEMENT, sort: "progress" });
    chip("Reset all");
  });
});

describe("describeGoalTreeFilter (#2410, #2610)", () => {
  it("names the periods left on, in chip order, then the rest", () => {
    expect(
      describeGoalTreeFilter(
        {
          periods: ["month", "year"],
          status: "achieved",
          hideDoneTodos: true,
        },
        LABELS,
      ),
    ).toEqual(["This year, This month", "Achieved", "Hide done todos"]);
  });

  it("says nothing when nothing is filtered", () => {
    expect(
      describeGoalTreeFilter(DEFAULT_GOAL_TREE_ARRANGEMENT.filter, LABELS),
    ).toEqual([]);
  });
});
