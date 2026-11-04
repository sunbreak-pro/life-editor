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

describe("#2408 — the Desktop cluster's buttons carry the same floor", () => {
  it.each([["delete todo"], ["move out of today"], ["edit todo"]])(
    "floors %s in both directions",
    (name) => {
      render(
        <TodayTodoTray
          {...rows}
          onToggleComplete={noop}
          onOpenTodo={noop}
          onAddCandidate={noop}
          onDelete={noop}
          onMoveOut={noop}
          rowActions={{
            edit: "edit todo",
            moveOutHint: "hint",
            moveToTodayHint: "hint",
            editHint: "hint",
            deleteHint: "hint",
          }}
          labels={labels}
        />,
      );
      const btn = screen.getByLabelText(name);
      expect(btn).toHaveClass("max-md:min-h-11", "max-md:min-w-11", "size-6");
      expect(btn).not.toHaveClass("min-h-11");
    },
  );
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

/*
 * #2477 — the drawer's titles read 1 to 5 characters before the ellipsis.
 *
 * The checkbox and the two trailing buttons are all at the 44px floor, so the
 * title cannot be given more width on the title's line. It gets a second line
 * on narrow instead, its button reaches 44px, and an "other" row's
 * "9/5 14:00" moves under the title rather than taking the line from it. The
 * real widths need a browser; what is pinned here is which box each piece
 * sits in and that every new class stays behind `max-md:`.
 */
describe("#2477 — the title gets two lines and a 44px button on narrow only", () => {
  const withMeta = {
    ...rows,
    addable: [{ id: "task-4", title: "Parked", meta: "9/5 14:00" }],
  };

  function renderWithMeta() {
    return render(
      <TodayTodoTray
        {...withMeta}
        onToggleComplete={noop}
        onOpenTodo={noop}
        onOpenAddable={noop}
        onAddCandidate={noop}
        onDelete={noop}
        onMoveOut={noop}
        addableControls
        metaLine
        singleList
        labels={{ ...labels, allDay: "All-day", openAddable: "open addable" }}
      />,
    );
  }

  it("floors today's title button and lets its title wrap", () => {
    renderWithMeta();
    const button = screen.getByTitle("open in todos");
    expect(button).toHaveClass("max-md:min-h-11", "min-h-[38px]");
    expect(button).not.toHaveClass("min-h-11");
    const title = screen.getByText("Placed");
    // Desktop keeps its one truncated line…
    expect(title).toHaveClass("truncate");
    // …and a phone gets two.
    expect(title).toHaveClass(
      "max-md:line-clamp-2",
      "max-md:whitespace-normal",
      "max-md:break-words",
    );
    expect(title).not.toHaveClass("line-clamp-2");
  });

  it("floors an other row's title button and lets its title wrap", () => {
    renderWithMeta();
    const button = screen.getByTitle("open addable");
    expect(button).toHaveClass("max-md:min-h-11");
    expect(button).not.toHaveClass("min-h-11");
    const title = screen.getByText("Parked");
    expect(button.contains(title)).toBe(true);
    expect(title).toHaveClass("truncate", "max-md:line-clamp-2");
  });

  it("stacks an other row's meta under its title on narrow only", () => {
    renderWithMeta();
    const box = screen
      .getByText("Parked")
      .closest<HTMLElement>("[data-addable-title]")!;
    expect(box).not.toBeNull();
    // The meta shares the title's box, not the row's line with the buttons.
    expect(box.contains(screen.getByText("9/5 14:00"))).toBe(true);
    expect(box.contains(screen.getByLabelText("add to today"))).toBe(false);
    expect(box).toHaveClass("max-md:flex-col", "min-w-0", "flex-1");
    // Side by side on Desktop, as before.
    expect(box).not.toHaveClass("flex-col");
  });

  it("keeps a plain-text other title wrapping too", () => {
    render(
      <TodayTodoTray
        {...rows}
        onToggleComplete={noop}
        onOpenTodo={noop}
        onAddCandidate={noop}
        labels={labels}
      />,
    );
    const title = screen.getByText("Addable");
    expect(title.tagName).toBe("SPAN");
    expect(title).toHaveClass("truncate", "max-md:line-clamp-2");
  });
});
