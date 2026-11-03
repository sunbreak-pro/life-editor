import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  GoalDetailPanel,
  buildGoalTreeModel,
  type Goal,
  type GoalDetailLabels,
  type GoalTreeLabels,
  type GoalTreeNode,
} from "../src";

/*
 * The goal panel's "Remove" beside the goal-above link (#2410,
 * D-20261102-connect-1 = A). Where the host shows the link alone (a wide
 * screen, `parentSelect` false) the button is the only way back to no goal
 * above, and it asks for the same write as the select's "None". With the
 * select, or with nothing above, there is nothing to take off.
 */

function goal(over: Partial<Goal> & Pick<Goal, "id" | "title">): Goal {
  return {
    periodKind: "week",
    periodKey: "2026-09-27",
    sortOrder: 0,
    parentGoalId: null,
    manualAchievedAt: null,
    periodEndDecision: null,
    decidedAt: null,
    carriedFromGoalId: null,
    legacyKey: null,
    isDeleted: false,
    createdAt: "2026-09-27T00:00:00Z",
    updatedAt: "2026-09-27T00:00:00Z",
    ...over,
  };
}

const MONTH = goal({
  id: "m1",
  title: "Run weekly",
  periodKind: "month",
  periodKey: "2026-09",
});
const WEEK = goal({ id: "w1", title: "Run 3 times", parentGoalId: "m1" });
const LOOSE_WEEK = goal({ id: "w2", title: "Swim once", sortOrder: 1 });

const TREE_LABELS = {
  kinds: { year: "Year", month: "Month", week: "Week" },
  formatDateRange: (start: string, end: string) => `${start} – ${end}`,
  statusLabels: { statusNotStarted: "Not started", statusDone: "Done" },
  status: "Status",
  achieved: "Achieved",
  unconnected: "Unconnected",
  formatProgress: (done: number, total: number) => `${done}/${total}`,
  formatOpenTodo: (title: string) => `Open ${title}`,
} as unknown as GoalTreeLabels;

const LABELS: GoalDetailLabels = {
  titleLabel: "Goal title",
  parentLabel: "Goal above",
  parentNone: "None",
  unlinkParent: "Remove",
  formatUnlinkParent: (title) => `Remove from the goal above: ${title}`,
  todosHeading: "Linked todos",
  todosEmpty: "No todos",
  linkTodos: "Link todos",
  childrenHeading: "Goals under this one",
  formatEarlierChildren: (count) => `${count} more`,
  markAchieved: "Mark as achieved",
  unmarkAchieved: "Remove the achieved mark",
  manualHint: "Hint",
  deleteGoal: "Delete goal",
  formatPeriod: (kind, key) => `${kind} · ${key}`,
  tree: TREE_LABELS,
};

function node(id: string): GoalTreeNode {
  const model = buildGoalTreeModel({
    goals: [MONTH, WEEK, LOOSE_WEEK],
    links: [],
    todos: [],
    todayKey: "2026-09-30",
    untitled: "Untitled",
  });
  const found = model.byId.get(id);
  if (!found) throw new Error(`no node ${id}`);
  return found;
}

function renderPanel(
  id: string,
  over: { parentSelect?: boolean; parentGoal?: Goal | null } = {},
): { onChangeParent: ReturnType<typeof vi.fn> } {
  const onChangeParent = vi.fn();
  render(
    <GoalDetailPanel
      node={node(id)}
      parentOptions={[{ id: "m1", title: "Run weekly", periodKind: "month" }]}
      parentGoal={over.parentGoal === undefined ? MONTH : over.parentGoal}
      parentSelect={over.parentSelect}
      onRename={vi.fn()}
      onChangeParent={onChangeParent}
      onSetManualAchieved={vi.fn()}
      onDelete={vi.fn()}
      onSelectGoal={vi.fn()}
      onSetTodoStatus={vi.fn()}
      onOpenTodo={vi.fn()}
      labels={LABELS}
    />,
  );
  return { onChangeParent };
}

const UNLINK = { name: "Remove from the goal above: Run weekly" };

describe("GoalDetailPanel — taking the goal above off (#2410)", () => {
  it("offers Remove beside the link, and it asks for the select's None", () => {
    const { onChangeParent } = renderPanel("w1");
    screen.getByRole("button", { name: "Run weekly" });
    const unlink = screen.getByRole("button", UNLINK);
    expect(unlink.textContent).toBe("Remove");

    fireEvent.click(unlink);
    expect(onChangeParent).toHaveBeenCalledTimes(1);
    expect(onChangeParent).toHaveBeenCalledWith(null);
  });

  it("leaves it out where the select is shown: None is there", () => {
    const { onChangeParent } = renderPanel("w1", { parentSelect: true });
    const select = screen.getByRole("combobox", { name: "Goal above" });
    expect(screen.queryByRole("button", UNLINK)).toBeNull();
    expect(screen.queryByRole("button", { name: /^Remove/ })).toBeNull();

    // The same write the button stands in for.
    fireEvent.change(select, { target: { value: "" } });
    expect(onChangeParent).toHaveBeenCalledWith(null);
  });

  it("leaves it out when there is no goal above", () => {
    renderPanel("w2", { parentGoal: null });
    screen.getByText("None");
    expect(
      screen.queryByRole("button", { name: /^Remove from the goal above/ }),
    ).toBeNull();
  });
});
