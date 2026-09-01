import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  TodayTodoTray,
  type TodayTodoTrayLabels,
} from "../src/components/schedule/TodayTodoTray";

/*
 * #555 — the tray's per-row management surfaces: the soft-delete button and
 * the renderRowExtra slot (the host's tag surface). Both are optional, so the
 * other hosts of this tray (Briefing) keep their unchanged rendering — the
 * "absent" cases below are that contract.
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
  // Required since #1368: every row draws <TodoStatusCheckbox>, including a
  // host that only writes `completed`, so every row has a status to name.
  status: "Status",
  statusLabels: { statusNotStarted: "Not started", statusDone: "Done" },
};

const rows = {
  placed: [
    { id: "task-1", title: "Placed", timeLabel: "09:00", completed: false },
  ],
  unplaced: [{ id: "task-2", title: "Unplaced", completed: false }],
  addable: [{ id: "task-3", title: "Addable" }],
};

const noop = () => {};

describe("TodayTodoTray #555 surfaces", () => {
  it("soft-deletes the clicked row via onDelete", () => {
    const onDelete = vi.fn();
    const onOpenTodo = vi.fn();
    render(
      <TodayTodoTray
        {...rows}
        onToggleComplete={noop}
        onOpenTodo={onOpenTodo}
        onAddCandidate={noop}
        onDelete={onDelete}
        labels={{ ...labels, delete: "delete todo" }}
      />,
    );
    const buttons = screen.getAllByLabelText("delete todo");
    // One per row across both groups (placed + unplaced), none in the picker.
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[0]);
    expect(onDelete).toHaveBeenCalledWith("task-1");
    fireEvent.click(buttons[1]);
    expect(onDelete).toHaveBeenCalledWith("task-2");
    // The delete button sits beside the title button, not inside it.
    expect(onOpenTodo).not.toHaveBeenCalled();
  });

  it("renders no delete button without onDelete (Briefing contract)", () => {
    render(
      <TodayTodoTray
        {...rows}
        onToggleComplete={noop}
        onOpenTodo={noop}
        onAddCandidate={noop}
        labels={{ ...labels, delete: "delete todo" }}
      />,
    );
    expect(screen.queryByLabelText("delete todo")).toBeNull();
  });

  it("renders no delete button without labels.delete (no unnamed control)", () => {
    const { container } = render(
      <TodayTodoTray
        {...rows}
        onToggleComplete={noop}
        onOpenTodo={noop}
        onAddCandidate={noop}
        onDelete={vi.fn()}
        labels={labels}
      />,
    );
    // Only the two completion toggles, the two title buttons and the
    // addable row's add button remain.
    expect(container.querySelectorAll("button")).toHaveLength(5);
  });

  it("mounts renderRowExtra under group rows only, not the picker", () => {
    render(
      <TodayTodoTray
        {...rows}
        onToggleComplete={noop}
        onOpenTodo={noop}
        onAddCandidate={noop}
        renderRowExtra={(row) => <span>{`extra-${row.id}`}</span>}
        labels={labels}
      />,
    );
    expect(screen.getByText("extra-task-1")).toBeTruthy();
    expect(screen.getByText("extra-task-2")).toBeTruthy();
    expect(screen.queryByText("extra-task-3")).toBeNull();
  });
});

/*
 * #796 — the tray's opt-in status WRITE (two-valued since #873).
 *
 * Briefing shows Not started / Done on its paper, so the tray it mounts beside
 * that paper has to say the same thing about a Todo — and write the same field.
 * Schedule has not asked for it and keeps writing `completed`.
 *
 * #1368 took the second checkbox away: the branch used to draw its own 20px
 * box, so one todo wore two sizes in two panels. Both branches draw the shared
 * control now, and what `onSetStatus` still decides is the FIELD — which is
 * what the "absent" cases below pin.
 */
describe("TodayTodoTray status rows (#796)", () => {
  const statusLabels = {
    statusNotStarted: "Not started",
    statusDone: "Done",
  };
  const statusRows = {
    placed: [
      {
        id: "task-1",
        title: "Placed",
        timeLabel: "09:00",
        completed: false,
        status: "NOT_STARTED" as const,
      },
    ],
    unplaced: [
      {
        id: "task-2",
        title: "Unplaced",
        completed: true,
        status: "DONE" as const,
      },
    ],
    addable: [{ id: "task-3", title: "Addable" }],
  };

  function renderTray() {
    const onSetStatus = vi.fn();
    const onToggleComplete = vi.fn();
    render(
      <TodayTodoTray
        {...statusRows}
        onToggleComplete={onToggleComplete}
        onSetStatus={onSetStatus}
        onOpenTodo={noop}
        onAddCandidate={noop}
        labels={{ ...labels, status: "Status", statusLabels }}
      />,
    );
    return { onSetStatus, onToggleComplete };
  }

  it("names each row by the status it will write", () => {
    renderTray();
    expect(screen.getByLabelText("Status: Not started")).toBeTruthy();
    expect(screen.getByLabelText("Status: Done")).toBeTruthy();
  });

  it("reports the status the press lands on", () => {
    const { onSetStatus, onToggleComplete } = renderTray();
    fireEvent.click(screen.getByLabelText("Status: Not started"));
    expect(onSetStatus).toHaveBeenCalledWith("task-1", "DONE");
    fireEvent.click(screen.getByLabelText("Status: Done"));
    expect(onSetStatus).toHaveBeenCalledWith("task-2", "NOT_STARTED");
    // The binary path is not also fired — one press, one write.
    expect(onToggleComplete).not.toHaveBeenCalled();
  });

  it("keeps writing completed for a host that does not opt in", () => {
    const onToggleComplete = vi.fn();
    render(
      <TodayTodoTray
        {...statusRows}
        onToggleComplete={onToggleComplete}
        onOpenTodo={noop}
        onAddCandidate={noop}
        labels={labels}
      />,
    );
    // Same control the opt-in host draws (#1368) — down to the touch target.
    // What differs is the field the press writes, not the box the user sees.
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(2);
    for (const box of boxes) expect(box.className).toContain("min-h-11");
    fireEvent.click(boxes[0]!);
    expect(onToggleComplete).toHaveBeenCalledExactlyOnceWith("task-1");
  });

  it("reads completed, not a status it has no way to write", () => {
    render(
      <TodayTodoTray
        placed={[
          {
            id: "task-1",
            title: "Placed",
            completed: false,
            // Left over from a host that DOES write status — this one does
            // not, so letting it win would strike a title whose own checkbox
            // reads unchecked.
            status: "DONE",
          },
        ]}
        unplaced={[]}
        addable={[]}
        onToggleComplete={noop}
        onOpenTodo={noop}
        onAddCandidate={noop}
        labels={labels}
      />,
    );
    expect(screen.getByRole("checkbox").getAttribute("aria-checked")).toBe(
      "false",
    );
    expect(screen.getByText("Placed").className).not.toContain("line-through");
  });
});

/*
 * #795 — the merged single list.
 *
 * "Pick a todo from Add from todos → it lands in Candidates → it later becomes
 * Scheduled" was two names and two lists for one act, so Briefing collapses
 * them: one list, with the time-less rows reading as all-day. The pill wears
 * the chip-todo family rather than the neutral one AgendaList gives an event,
 * which is the whole point of the third bullet — same row shape, Todo colour.
 *
 * Schedule stages candidates deliberately and keeps the pair, so the "off"
 * case below is its contract.
 */
describe("TodayTodoTray single list (#795)", () => {
  const merged = {
    placed: [
      { id: "task-1", title: "Timed", timeLabel: "09:00", completed: false },
    ],
    unplaced: [{ id: "task-2", title: "Untimed", completed: false }],
    addable: [{ id: "task-3", title: "Addable" }],
  };

  function renderMerged() {
    return render(
      <TodayTodoTray
        {...merged}
        onToggleComplete={noop}
        onOpenTodo={noop}
        onAddCandidate={noop}
        singleList
        labels={{ ...labels, allDay: "All-day" }}
      />,
    );
  }

  it("shows one heading, not the placed / unplaced pair", () => {
    renderMerged();
    expect(screen.getByText("placed")).toBeTruthy();
    expect(screen.queryByText("unplaced")).toBeNull();
    expect(screen.queryByText("empty unplaced")).toBeNull();
    // Both rows are on it.
    expect(screen.getByText("Timed")).toBeTruthy();
    expect(screen.getByText("Untimed")).toBeTruthy();
  });

  it("files the time-less rows first, as every other surface does", () => {
    const { container } = renderMerged();
    const titles = [...container.querySelectorAll("li")]
      .map((li) => li.textContent ?? "")
      .filter((text) => text.includes("Timed") || text.includes("Untimed"));
    expect(titles[0]).toContain("Untimed");
  });

  it("marks a time-less row all-day in the Todo colour", () => {
    renderMerged();
    const pill = screen.getByText("All-day");
    expect(pill.className).toContain("bg-lumen-chip-task-bg");
    expect(pill.className).toContain("text-lumen-chip-task-fg");
    // The timed row keeps its clock rather than gaining a pill.
    expect(screen.getByText("09:00")).toBeTruthy();
  });

  it("keeps the paired groups for a host that does not opt in", () => {
    render(
      <TodayTodoTray
        {...merged}
        onToggleComplete={noop}
        onOpenTodo={noop}
        onAddCandidate={noop}
        labels={{ ...labels, allDay: "All-day" }}
      />,
    );
    expect(screen.getByText("placed")).toBeTruthy();
    expect(screen.getByText("unplaced")).toBeTruthy();
    // No all-day pill either — the heading already says what the group is.
    expect(screen.queryByText("All-day")).toBeNull();
  });
});
