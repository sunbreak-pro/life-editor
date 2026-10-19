import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import {
  BriefingCarryoverPanel,
  EveningTodosPanel,
  EveningUpcomingPanel,
  type EveningScheduleEntry,
  type EveningUpcomingLabels,
} from "../src/components";
import { EVENING_LABELS } from "./helpers/eveningFixtures";

/*
 * #2285 — the papers' blocks that moved into the detail panel. The rows they
 * kept are pinned where they always were (briefingView / briefingRowWrap /
 * briefingTapTargets); this suite covers what the move changed: each block's
 * four states in its new home, and the upcoming rows' actions.
 */

const CARRYOVER_LABELS = {
  carryoverTitle: "CARRYOVER",
  todoStatus: "Status",
  statusNotStarted: "Not started",
  statusDone: "Done",
  edit: "Edit",
  jumpToTodos: "Open in Todos",
};

const UPCOMING_LABELS: EveningUpcomingLabels = {
  upcomingTitle: EVENING_LABELS.upcomingTitle,
  noUpcoming: EVENING_LABELS.noUpcoming,
  tomorrowTag: EVENING_LABELS.tomorrowTag,
  allDay: EVENING_LABELS.allDay,
  goToDay: "Go to this day's schedule",
  edit: "Edit",
  showRepeat: "See the repeat",
};

const UPCOMING: EveningScheduleEntry[] = [
  {
    id: "e1",
    title: "Dentist",
    startTime: "19:00",
    isAllDay: false,
    isTomorrow: false,
    date: "2026-10-18",
    isRoutine: false,
  },
  {
    id: "e2",
    title: "Morning run",
    startTime: "07:00",
    isAllDay: false,
    isTomorrow: true,
    date: "2026-10-19",
    isRoutine: true,
  },
];

function renderUpcoming(schedule = UPCOMING, loading = false) {
  const onGoToDay = vi.fn();
  const onOpenEditor = vi.fn();
  render(
    <EveningUpcomingPanel
      loading={loading}
      schedule={schedule}
      labels={UPCOMING_LABELS}
      onGoToDay={onGoToDay}
      onOpenEditor={onOpenEditor}
    />,
  );
  return { onGoToDay, onOpenEditor };
}

const rowButton = (title: string) =>
  screen.getByRole("button", { name: new RegExp(title) });

describe("持ち越し in the panel (#2285)", () => {
  function renderCarryover(
    entries: Parameters<typeof BriefingCarryoverPanel>[0]["entries"],
    loading = false,
  ) {
    return render(
      <BriefingCarryoverPanel
        loading={loading}
        entries={entries}
        labels={CARRYOVER_LABELS}
        onToggleTodo={vi.fn()}
        onJumpToTodos={vi.fn()}
      />,
    );
  }

  it("is left out with no rows, as the paper left it out", () => {
    const { container } = renderCarryover([]);
    expect(container.innerHTML).toBe("");
  });

  it("holds its heading over a skeleton while the paper loads", () => {
    const { container } = renderCarryover([], true);
    expect(screen.getByRole("region", { name: "CARRYOVER" })).toBeTruthy();
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("is ruled off from the block above it, like the charts", () => {
    renderCarryover([
      { id: "c1", title: "Old todo", daysLabel: "day 3", completed: false },
    ]);
    expect(screen.getByRole("region", { name: "CARRYOVER" })).toHaveClass(
      "border-t",
      "pt-4",
    );
  });

  it("drops the rule when it opens the panel", () => {
    renderCarryover([
      { id: "c1", title: "Old todo", daysLabel: "day 3", completed: false },
    ]);
    expect(screen.getByRole("region", { name: "CARRYOVER" })).toHaveClass(
      "first:mt-0",
      "first:border-t-0",
      "first:pt-0",
    );
  });
});

describe("残りの Todo in the panel (#2285)", () => {
  function renderTodos(loading: boolean) {
    return render(
      <EveningTodosPanel
        loading={loading}
        todos={[]}
        labels={EVENING_LABELS}
        onSetTodoStatus={vi.fn()}
      />,
    );
  }

  it("says it is empty when no todo is left", () => {
    renderTodos(false);
    const region = screen.getByRole("region", {
      name: EVENING_LABELS.todosTitle,
    });
    expect(within(region).getByText(EVENING_LABELS.noTodos)).toBeTruthy();
  });

  it("draws a skeleton, not a false「none」, while the paper loads", () => {
    const { container } = renderTodos(true);
    expect(screen.queryByText(EVENING_LABELS.noTodos)).toBeNull();
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
  });
});

describe("今後の予定 in the panel, with row actions (#2285)", () => {
  it("says it is empty when nothing is coming up", () => {
    renderUpcoming([]);
    expect(screen.getByText(EVENING_LABELS.noUpcoming)).toBeTruthy();
  });

  it("draws a skeleton while the paper loads", () => {
    renderUpcoming(UPCOMING, true);
    expect(screen.queryByText("Dentist")).toBeNull();
    expect(screen.queryByText(EVENING_LABELS.noUpcoming)).toBeNull();
  });

  it("prints each row's time, title and the tomorrow tag, with no actions yet", () => {
    renderUpcoming();
    expect(rowButton("Dentist").textContent).toContain("19:00");
    expect(rowButton("Morning run").textContent).toContain(
      EVENING_LABELS.tomorrowTag,
    );
    expect(screen.queryByRole("group")).toBeNull();
    expect(rowButton("Dentist").getAttribute("aria-expanded")).toBe("false");
  });

  it("opens an event row's actions under it: go to the day, and edit", () => {
    const { onGoToDay, onOpenEditor } = renderUpcoming();
    fireEvent.click(rowButton("Dentist"));
    expect(rowButton("Dentist").getAttribute("aria-expanded")).toBe("true");
    const group = screen.getByRole("group", { name: "Dentist" });
    expect(rowButton("Dentist").getAttribute("aria-controls")).toBe(group.id);
    expect(within(group).queryByText(UPCOMING_LABELS.showRepeat)).toBeNull();

    fireEvent.click(
      within(group).getByRole("button", { name: UPCOMING_LABELS.goToDay }),
    );
    expect(onGoToDay).toHaveBeenCalledExactlyOnceWith(UPCOMING[0]);
    fireEvent.click(
      within(group).getByRole("button", { name: UPCOMING_LABELS.edit }),
    );
    expect(onOpenEditor).toHaveBeenCalledExactlyOnceWith(UPCOMING[0]);
  });

  it("offers a routine row「繰り返しを見る」instead of「編集」", () => {
    const { onOpenEditor } = renderUpcoming();
    fireEvent.click(rowButton("Morning run"));
    const group = screen.getByRole("group", { name: "Morning run" });
    expect(
      within(group).queryByRole("button", { name: UPCOMING_LABELS.edit }),
    ).toBeNull();
    fireEvent.click(
      within(group).getByRole("button", { name: UPCOMING_LABELS.showRepeat }),
    );
    expect(onOpenEditor).toHaveBeenCalledExactlyOnceWith(UPCOMING[1]);
  });

  it("keeps one row open at a time, and closes it on a second press", () => {
    renderUpcoming();
    fireEvent.click(rowButton("Dentist"));
    fireEvent.click(rowButton("Morning run"));
    expect(screen.getAllByRole("group")).toHaveLength(1);
    expect(screen.getByRole("group", { name: "Morning run" })).toBeTruthy();
    expect(rowButton("Dentist").getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(rowButton("Morning run"));
    expect(screen.queryByRole("group")).toBeNull();
  });

  it("floors the row and its actions at 44px below md only", () => {
    renderUpcoming();
    fireEvent.click(rowButton("Dentist"));
    const targets = [
      rowButton("Dentist"),
      ...within(screen.getByRole("group")).getAllByRole("button"),
    ];
    for (const el of targets) {
      expect(el).toHaveClass("max-md:min-h-11");
      expect(el).not.toHaveClass("min-h-11");
    }
  });
});
