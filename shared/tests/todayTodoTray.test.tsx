import { describe, it, expect, vi } from "vitest";
import {
  act,
  createEvent,
  render,
  screen,
  fireEvent,
  within,
} from "@testing-library/react";
import {
  TodayTodoTray,
  type TodayTodoTrayLabels,
  type TodayTodoTrayProps,
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

/*
 * #1406 — the two-list tray Schedule draws: a today row can be sent OFF today
 * (onMoveOut), an "other" row says where it currently is (meta), and with
 * hoverActions both move buttons are hidden until the row is hovered or
 * focused. All three are opt-in, so Briefing's picker is the "absent" case.
 */
describe("TodayTodoTray moves between the two lists (#1406)", () => {
  const two = {
    placed: [
      { id: "task-1", title: "Timed", timeLabel: "09:00", completed: false },
    ],
    unplaced: [],
    addable: [{ id: "task-3", title: "Later", meta: "9/5 14:00" }],
  };

  it("sends a today row off today via onMoveOut", () => {
    const onMoveOut = vi.fn();
    render(
      <TodayTodoTray
        {...two}
        onToggleComplete={noop}
        onOpenTodo={noop}
        onAddCandidate={noop}
        onMoveOut={onMoveOut}
        singleList
        labels={{ ...labels, allDay: "All-day", moveOut: "take off today" }}
      />,
    );
    fireEvent.click(screen.getByLabelText("take off today"));
    expect(onMoveOut).toHaveBeenCalledWith("task-1");
  });

  it("draws no move-out button for a host that does not pass one", () => {
    render(
      <TodayTodoTray
        {...two}
        onToggleComplete={noop}
        onOpenTodo={noop}
        onAddCandidate={noop}
        labels={{ ...labels, moveOut: "take off today" }}
      />,
    );
    expect(screen.queryByLabelText("take off today")).toBeNull();
  });

  it("prints where an 'other' row currently is", () => {
    render(
      <TodayTodoTray
        {...two}
        onToggleComplete={noop}
        onOpenTodo={noop}
        onAddCandidate={noop}
        labels={labels}
      />,
    );
    expect(screen.getByText("9/5 14:00")).toBeTruthy();
  });

  it("hides both move buttons until hover or focus when hoverActions is on", () => {
    render(
      <TodayTodoTray
        {...two}
        onToggleComplete={noop}
        onOpenTodo={noop}
        onAddCandidate={noop}
        onMoveOut={noop}
        hoverActions
        singleList
        labels={{ ...labels, allDay: "All-day", moveOut: "take off today" }}
      />,
    );
    for (const name of ["take off today", "add to today"]) {
      const btn = screen.getByLabelText(name);
      expect(btn.className).toContain("opacity-0");
      expect(btn.className).toContain("group-hover:opacity-100");
      expect(btn.className).toContain("group-focus-within:opacity-100");
      // The row is what gets hovered, so it has to be the group.
      expect(btn.closest("li")?.className).toContain("group");
    }
  });

  it("keeps the buttons always visible for a host that does not opt in", () => {
    render(
      <TodayTodoTray
        {...two}
        onToggleComplete={noop}
        onOpenTodo={noop}
        onAddCandidate={noop}
        onMoveOut={noop}
        singleList
        labels={{ ...labels, allDay: "All-day", moveOut: "take off today" }}
      />,
    );
    expect(screen.getByLabelText("add to today").className).not.toContain(
      "opacity-0",
    );
    expect(screen.getByLabelText("take off today").className).not.toContain(
      "opacity-0",
    );
  });
});

/*
 * #2408 — the Desktop cluster and the line under the title. Both are opt-in, so
 * every case above (Briefing and narrow Schedule) is the "absent" contract.
 *
 * jsdom has no layout: a tooltip's coordinates are not checked, only that it
 * hangs from the button's top edge and that it is on document.body, out of the
 * scroller that would clip it.
 */
describe("TodayTodoTray row actions (#2408)", () => {
  const rowActions = {
    edit: "edit todo",
    moveOutHint: "moves out",
    moveToTodayHint: "moves to today",
    editHint: "opens the panel",
    deleteHint: "deletes it",
  };
  const copy = {
    ...labels,
    allDay: "All-day",
    delete: "delete todo",
    moveOut: "take off today",
    openAddable: "open addable",
  };

  function renderCluster(over: { onAddCandidate?: (id: string) => void } = {}) {
    const onMoveOut = vi.fn();
    const onOpenTodo = vi.fn();
    const onOpenAddable = vi.fn();
    const onDelete = vi.fn();
    render(
      <TodayTodoTray
        placed={[
          { id: "task-1", title: "Timed", timeLabel: "09:00", completed: false },
        ]}
        unplaced={[]}
        addable={[{ id: "task-3", title: "Later", meta: "9/5 14:00" }]}
        onToggleComplete={noop}
        onOpenTodo={onOpenTodo}
        onOpenAddable={onOpenAddable}
        onAddCandidate={over.onAddCandidate ?? noop}
        onMoveOut={onMoveOut}
        onDelete={onDelete}
        addableControls
        hoverActions
        singleList
        rowActions={rowActions}
        labels={copy}
      />,
    );
    return { onMoveOut, onOpenTodo, onOpenAddable, onDelete };
  }

  const clusterOf = (title: string) =>
    within(screen.getByText(title).closest("li")!)
      .getAllByRole("button")
      .filter((b) => b.hasAttribute("aria-label"));

  it("orders move, edit, delete on both lists", () => {
    renderCluster();
    expect(clusterOf("Timed").map((b) => b.getAttribute("aria-label"))).toEqual(
      ["take off today", "edit todo", "delete todo"],
    );
    expect(clusterOf("Later").map((b) => b.getAttribute("aria-label"))).toEqual(
      ["add to today", "edit todo", "delete todo"],
    );
  });

  it("draws the arrow that points the way the row goes", () => {
    renderCluster();
    expect(
      clusterOf("Timed")[0]!.querySelector(".lucide-arrow-down-to-line"),
    ).not.toBeNull();
    expect(
      clusterOf("Later")[0]!.querySelector(".lucide-arrow-up-to-line"),
    ).not.toBeNull();
  });

  it("routes each press to its own row and callback", () => {
    const onAddCandidate = vi.fn();
    const { onMoveOut, onOpenTodo, onOpenAddable, onDelete } = renderCluster({
      onAddCandidate,
    });
    const [out, editToday, delToday] = clusterOf("Timed");
    fireEvent.click(out!);
    expect(onMoveOut).toHaveBeenCalledWith("task-1");
    fireEvent.click(editToday!);
    expect(onOpenTodo).toHaveBeenCalledWith("task-1");
    fireEvent.click(delToday!);
    expect(onDelete).toHaveBeenCalledWith("task-1");

    const [into, editOther, delOther] = clusterOf("Later");
    fireEvent.click(into!);
    expect(onAddCandidate).toHaveBeenCalledWith("task-3");
    fireEvent.click(editOther!);
    expect(onOpenAddable).toHaveBeenCalledWith("task-3");
    fireEvent.click(delOther!);
    expect(onDelete).toHaveBeenCalledWith("task-3");
  });

  it("keeps the title press and hides the icons until hover or focus", () => {
    const { onOpenTodo } = renderCluster();
    fireEvent.click(screen.getByText("Timed"));
    expect(onOpenTodo).toHaveBeenCalledWith("task-1");
    for (const btn of [...clusterOf("Timed"), ...clusterOf("Later")]) {
      expect(btn.className).toContain("opacity-0");
      expect(btn.className).toContain("group-hover:opacity-100");
      expect(btn.className).toContain("group-focus-within:opacity-100");
      // Shown where nothing can hover.
      expect(btn.className).toContain("[@media(hover:none)]:opacity-100");
    }
  });

  it("uses no native title, which would double the tooltip below the icon", () => {
    renderCluster();
    for (const btn of [...clusterOf("Timed"), ...clusterOf("Later")]) {
      expect(btn.hasAttribute("title")).toBe(false);
    }
  });

  it.each([
    ["take off today", "Timed", "moves out"],
    ["edit todo", "Timed", "opens the panel"],
    ["delete todo", "Timed", "deletes it"],
    ["add to today", "Later", "moves to today"],
  ])("explains %s on hover, above the icon", (name, title, hint) => {
    renderCluster();
    const btn = within(screen.getByText(title).closest("li")!).getByLabelText(
      name,
    );
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.pointerEnter(btn);
    const tip = screen.getByRole("tooltip");
    expect(tip.textContent).toBe(hint);
    expect(tip.parentElement).toBe(document.body);
    expect(tip.className).toContain("fixed");
    expect(tip.style.bottom).not.toBe("");
    expect(tip.style.top).toBe("");
    expect(btn.getAttribute("aria-describedby")).toBe(tip.id);
    fireEvent.pointerLeave(btn);
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(btn.hasAttribute("aria-describedby")).toBe(false);
  });

  it("explains on keyboard focus too, and Escape dismisses it", () => {
    renderCluster();
    const btn = clusterOf("Timed")[1]!;
    act(() => btn.focus());
    expect(screen.getByRole("tooltip").textContent).toBe("opens the panel");
    fireEvent.keyDown(btn, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
    act(() => btn.focus());
    act(() => btn.blur());
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("does not open from a finger, and closes on press and on scroll", () => {
    renderCluster();
    const btn = clusterOf("Timed")[1]!;
    // jsdom has no PointerEvent to carry pointerType, so it is set by hand.
    // The enter is what React derives from a pointerover.
    const touch = createEvent.pointerOver(btn);
    Object.defineProperty(touch, "pointerType", { value: "touch" });
    fireEvent(btn, touch);
    expect(screen.queryByRole("tooltip")).toBeNull();

    fireEvent.pointerEnter(btn);
    expect(screen.getByRole("tooltip")).toBeTruthy();
    fireEvent.click(btn);
    expect(screen.queryByRole("tooltip")).toBeNull();

    fireEvent.pointerEnter(btn);
    expect(screen.getByRole("tooltip")).toBeTruthy();
    fireEvent.scroll(window);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("leaves the buttons as they were without the prop", () => {
    render(
      <TodayTodoTray
        {...rows}
        onToggleComplete={noop}
        onOpenTodo={noop}
        onAddCandidate={noop}
        onMoveOut={noop}
        onDelete={noop}
        labels={copy}
      />,
    );
    expect(screen.queryByLabelText("edit todo")).toBeNull();
    expect(screen.getAllByTitle("delete todo").length).toBeGreaterThan(0);
    fireEvent.pointerEnter(screen.getAllByTitle("delete todo")[0]!);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});

describe("TodayTodoTray metaLine (#2408)", () => {
  const timed = [
    { id: "task-1", title: "Timed", timeLabel: "09:00", completed: false },
  ];
  const untimed = [{ id: "task-2", title: "Untimed", completed: false }];

  it("moves the clock and the all-day pill out of the title, beside the extra", () => {
    render(
      <TodayTodoTray
        placed={timed}
        unplaced={untimed}
        addable={[]}
        onToggleComplete={noop}
        onOpenTodo={noop}
        onAddCandidate={noop}
        singleList
        metaLine
        renderRowExtra={(row) => <span>{`extra-${row.id}`}</span>}
        labels={{ ...labels, allDay: "All-day" }}
      />,
    );
    const clock = screen.getByText("09:00");
    expect(clock.closest("button")).toBeNull();
    expect(clock.parentElement).toBe(
      screen.getByText("extra-task-1").parentElement,
    );
    const pill = screen.getByText("All-day");
    expect(pill.closest("button")).toBeNull();
    expect(pill.parentElement).toBe(
      screen.getByText("extra-task-2").parentElement,
    );
  });

  // #2568: the second line's clock and 終日 wear the same outlined round pill.
  it("draws the clock and the all-day marker as the same pill on the second line", () => {
    render(
      <TodayTodoTray
        placed={timed}
        unplaced={untimed}
        addable={[]}
        onToggleComplete={noop}
        onOpenTodo={noop}
        onAddCandidate={noop}
        singleList
        metaLine
        labels={{ ...labels, allDay: "All-day" }}
      />,
    );
    const clock = screen.getByText("09:00");
    const allDay = screen.getByText("All-day");
    for (const pill of [clock, allDay]) {
      expect(pill.hasAttribute("data-todo-time-pill")).toBe(true);
      expect(pill.className.split(" ")).toEqual(
        expect.arrayContaining([
          "rounded-full",
          "border",
          "border-lumen-border-strong",
        ]),
      );
      // Under the title, not inside its button.
      expect(pill.closest("button")).toBeNull();
    }
    expect(allDay.className).toBe(clock.className);
    expect(allDay.className).not.toContain("chip-task");
  });

  it("moves an 'other' row's date to a second line beside its extra", () => {
    render(
      <TodayTodoTray
        placed={[]}
        unplaced={[]}
        addable={[{ id: "task-3", title: "Later", meta: "11/8" }]}
        onToggleComplete={noop}
        onOpenTodo={noop}
        onOpenAddable={noop}
        onAddCandidate={noop}
        metaLine
        renderRowExtra={(row) => <span>{`extra-${row.id}`}</span>}
        labels={labels}
      />,
    );
    const date = screen.getByText("11/8");
    expect(date.hasAttribute("data-todo-time-pill")).toBe(true);
    expect(date.closest("button")).toBeNull();
    expect(date.parentElement).toBe(
      screen.getByText("extra-task-3").parentElement,
    );
    expect(date.parentElement?.className).toContain("w-full");
  });

  it("keeps the bare date on an 'other' row without metaLine", () => {
    render(
      <TodayTodoTray
        placed={[]}
        unplaced={[]}
        addable={[{ id: "task-3", title: "Later", meta: "11/8" }]}
        onToggleComplete={noop}
        onOpenTodo={noop}
        onAddCandidate={noop}
        labels={labels}
      />,
    );
    expect(screen.getByText("11/8").hasAttribute("data-todo-time-pill")).toBe(
      false,
    );
  });

  it("keeps the clock at the title's end for a host that does not opt in", () => {
    render(
      <TodayTodoTray
        placed={timed}
        unplaced={[]}
        addable={[]}
        onToggleComplete={noop}
        onOpenTodo={noop}
        onAddCandidate={noop}
        labels={labels}
      />,
    );
    expect(screen.getByText("09:00").closest("button")).not.toBeNull();
  });
});

/*
 * #1640 — the heading action slots.
 *
 * Schedule puts a create pill in each heading so a list can be added to from
 * where it is read. The tray only places them: which one gives the todo a day
 * is the host's answer, and keeping the buttons out here is what lets the host
 * keep its copy and its tour anchor on them.
 */
describe("TodayTodoTray heading actions", () => {
  it("places each action beside its own heading, and neither without one", () => {
    const { rerender } = render(
      <TodayTodoTray
        {...rows}
        onToggleComplete={noop}
        onOpenTodo={noop}
        onAddCandidate={noop}
        labels={labels}
      />,
    );
    expect(screen.queryByText("add here")).toBeNull();

    rerender(
      <TodayTodoTray
        {...rows}
        onToggleComplete={noop}
        onOpenTodo={noop}
        onAddCandidate={noop}
        headingActions={{
          placed: <button>add here</button>,
          addable: <button>add elsewhere</button>,
        }}
        labels={labels}
      />,
    );
    const placedHeading = screen.getByText("placed");
    const addHeading = screen.getByText("add");
    expect(
      placedHeading.parentElement?.contains(screen.getByText("add here")),
    ).toBe(true);
    expect(
      addHeading.parentElement?.contains(screen.getByText("add elsewhere")),
    ).toBe(true);
  });

  // #2568: Schedule's headings are bold and primary; Briefing keeps the muted.
  it("draws strong headings only for a host that asks", () => {
    const { rerender } = render(
      <TodayTodoTray
        {...rows}
        singleList
        onToggleComplete={noop}
        onOpenTodo={noop}
        onAddCandidate={noop}
        labels={labels}
      />,
    );
    for (const text of ["placed", "add"]) {
      expect(screen.getByText(text).className).toContain(
        "text-lumen-text-secondary",
      );
    }

    rerender(
      <TodayTodoTray
        {...rows}
        singleList
        strongHeadings
        onToggleComplete={noop}
        onOpenTodo={noop}
        onAddCandidate={noop}
        labels={labels}
      />,
    );
    for (const text of ["placed", "add"]) {
      const cls = screen.getByText(text).className.split(" ");
      expect(cls).toEqual(
        expect.arrayContaining(["font-bold", "text-lumen-text"]),
      );
      expect(cls).not.toContain("text-lumen-text-secondary");
    }
  });
});

/*
 * #2010 — the "+" on an "その他" row. The BUTTON keeps the narrow 44px floor
 * (#1558), but the bordered square is painted on a 24px span inside it: a
 * border on the grown box read as a 44px frame of padding around a 16px "+".
 * jsdom has no layout, so the class contract is what is pinned.
 */
describe("#2010 — the other-row + keeps its tap area and its painted size", () => {
  it("floors the button on narrow and paints the square on the inner span", () => {
    render(
      <TodayTodoTray
        placed={[]}
        unplaced={[]}
        addable={[{ id: "task-3", title: "Later" }]}
        onToggleComplete={noop}
        onOpenTodo={noop}
        onAddCandidate={noop}
        labels={labels}
      />,
    );
    const btn = screen.getByLabelText("add to today");
    expect(btn.className).toContain("max-md:min-h-11");
    expect(btn.className).toContain("max-md:min-w-11");
    expect(btn.className.split(" ")).not.toContain("border");

    const square = btn.querySelector("span");
    expect(square?.className.split(" ")).toEqual(
      expect.arrayContaining(["size-6", "border", "border-lumen-border-strong"]),
    );
    // Unprefixed, so the painted square is the same size on both layouts.
    expect(square?.className).not.toContain("max-md:");
  });
});

/*
 * #2571: with nothing in either list, Schedule says so once instead of twice.
 * Opt-in through labels.emptyAll, so Briefing's tray keeps its lines.
 */
describe("TodayTodoTray — one line when every list is empty (#2571)", () => {
  const none = { placed: [], unplaced: [], addable: [] };
  const withAll = { ...labels, emptyAll: "no todos yet" };
  const renderTray = (
    over: Partial<TodayTodoTrayProps> = {},
  ) =>
    render(
      <TodayTodoTray
        {...none}
        onToggleComplete={noop}
        onOpenTodo={noop}
        onAddCandidate={noop}
        singleList
        labels={withAll}
        {...over}
      />,
    );

  it("says it once, and keeps both headings and their actions", () => {
    renderTray({
      headingActions: {
        placed: <button type="button">add today</button>,
        addable: <button type="button">add other</button>,
      },
    });
    expect(screen.getAllByText("no todos yet")).toHaveLength(1);
    expect(screen.queryByText("empty placed")).toBeNull();
    expect(screen.queryByText("empty addable")).toBeNull();
    screen.getByText("placed");
    screen.getByText("add");
    screen.getByRole("button", { name: "add today" });
    screen.getByRole("button", { name: "add other" });
  });

  it("keeps the per-heading line when only today is empty", () => {
    renderTray({ addable: rows.addable });
    screen.getByText("empty placed");
    expect(screen.queryByText("no todos yet")).toBeNull();
  });

  it("keeps the per-heading line when only the other list is empty", () => {
    renderTray({ placed: rows.placed });
    screen.getByText("empty addable");
    expect(screen.queryByText("no todos yet")).toBeNull();
  });

  it("does not claim 'none yet' while a list is hidden", () => {
    renderTray({ hideOther: true });
    screen.getByText("empty placed");
    expect(screen.queryByText("no todos yet")).toBeNull();
  });

  it("leaves a host without the copy as it was (Briefing)", () => {
    renderTray({ labels });
    screen.getByText("empty placed");
    screen.getByText("empty addable");
  });
});

/*
 * #2670: a clamped title must not carry vertical padding — `overflow: hidden`
 * clips at the padding edge, so the padding paints the top of line three.
 * jsdom has no layout, so this pins the classes, not the pixels.
 */
describe("TodayTodoTray — the two-line title stops at two lines (#2670)", () => {
  const clamped = (el: HTMLElement): string[] => el.className.split(" ");
  const hasNoVerticalPadding = (cls: string[]): boolean =>
    !cls.some((c) => /^(max-md:)?(py|pt|pb)-/.test(c));

  it("caps every clamped title at two text-sm lines, padding-free", () => {
    render(
      <TodayTodoTray
        {...rows}
        onToggleComplete={noop}
        onOpenTodo={noop}
        onAddCandidate={noop}
        labels={labels}
      />,
    );
    for (const text of ["Placed", "Unplaced", "Addable"]) {
      const cls = clamped(screen.getByText(text));
      expect(cls).toEqual(
        expect.arrayContaining(["max-md:line-clamp-2", "max-md:max-h-10"]),
      );
      expect(hasNoVerticalPadding(cls)).toBe(true);
    }
  });

  it("keeps the plain 'other' title's spacing on the margin (Briefing)", () => {
    render(
      <TodayTodoTray
        placed={[]}
        unplaced={[]}
        addable={rows.addable}
        onToggleComplete={noop}
        onOpenTodo={noop}
        onAddCandidate={noop}
        singleList
        labels={labels}
      />,
    );
    const cls = clamped(screen.getByText("Addable"));
    expect(cls).toContain("my-1.5");
    expect(cls).toContain("truncate");
  });

  it("keeps the opened 'other' title clamped inside its padded button", () => {
    render(
      <TodayTodoTray
        placed={[]}
        unplaced={[]}
        addable={rows.addable}
        onToggleComplete={noop}
        onOpenTodo={noop}
        onAddCandidate={noop}
        onOpenAddable={noop}
        labels={{ ...labels, openAddable: "open" }}
      />,
    );
    const cls = clamped(screen.getByText("Addable"));
    expect(cls).toContain("max-md:max-h-10");
    expect(hasNoVerticalPadding(cls)).toBe(true);
  });
});
