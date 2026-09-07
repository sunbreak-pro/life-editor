import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  TodayTodoTray,
  type TodayTodoTrayLabels,
} from "../src/components/schedule/TodayTodoTray";

/*
 * #1515 + #1558 — the schedule drawer's Todo row: its 44px touch floor and the
 * overflow that floor would otherwise make worse.
 *
 * jsdom has no layout (CLAUDE.md §7.1), so nothing here can re-measure the
 * `getBoundingClientRect()` figures the audit reported, nor the `scrollWidth >
 * clientWidth` that #1515 is named after. Every assertion pins the CLASS
 * CONTRACT that produces the size — the same shape as shared/tests/
 * sharedTapTargets.test.tsx, which covers the chrome every section shares
 * while this file covers the schedule lane's own row.
 *
 * `max-md:` and not a bare floor, because ONE component draws both instances:
 * the Desktop sidebar row and the phone drawer row are this same tray, so an
 * unprefixed `min-h-11` would grow the mouse-sized buttons too. The Desktop
 * assertions below are what stops that regressing.
 */

const labels: TodayTodoTrayLabels = {
  placedHeading: "placed",
  unplacedHeading: "unplaced",
  emptyPlaced: "empty placed",
  emptyUnplaced: "empty unplaced",
  addHeading: "add",
  addAction: "add to today",
  emptyAddable: "empty addable",
  openInTodos: "open in todos",
  delete: "delete todo",
  moveOut: "move out of today",
  status: "Status",
  statusLabels: { statusNotStarted: "Not started", statusDone: "Done" },
};

const rows = {
  placed: [
    { id: "task-1", title: "Placed", timeLabel: "09:00", completed: false },
  ],
  unplaced: [],
  addable: [{ id: "task-3", title: "Addable" }],
};

const noop = () => {};

function renderTray() {
  return render(
    <TodayTodoTray
      {...rows}
      onToggleComplete={noop}
      onOpenTodo={noop}
      onAddCandidate={noop}
      onDelete={noop}
      onMoveOut={noop}
      labels={labels}
    />,
  );
}

describe("#1558 — the tray's row buttons meet the 44px floor on narrow only", () => {
  it.each([
    ["delete todo"],
    ["move out of today"],
    ["add to today"],
  ])("floors %s in both directions", (name) => {
    renderTray();
    const btn = screen.getByLabelText(name);
    expect(btn).toHaveClass("max-md:min-h-11", "max-md:min-w-11");
    // Unprefixed floors would grow the Desktop sidebar's rows too.
    expect(btn).not.toHaveClass("min-h-11");
    // The painted mouse-size box is unchanged.
    expect(btn).toHaveClass("size-6");
  });
});

describe("#1515 — the title button is allowed to shrink", () => {
  it("gives the flexible column min-w-0", () => {
    renderTray();
    /*
     * The row's own overflow, in one class. A flex ITEM defaults to
     * min-width:auto, so without this the title button refuses to shrink below
     * its content and pushes the two trailing buttons past the panel — which
     * is the 8px of horizontal scrollbar #1515 measured, and which grows by
     * exactly the width the floor above adds.
     */
    const title = screen.getByTitle("open in todos");
    expect(title).toHaveClass("min-w-0", "flex-1");
  });
});
