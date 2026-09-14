import { describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  createEvent,
  within,
} from "@testing-library/react";
import {
  MonthGrid,
  TodayTodoTray,
  WeekTimeGrid,
  TODO_DRAG_MIME,
  type TodayTodoTrayLabels,
} from "../src/components";

/*
 * #1627 — a row of the Schedule sidebar's "その他の Todo" list gets the
 * checkbox and delete button today's rows have, and can be dragged onto the
 * week / month grid to set its day (and, on a time slot, its time).
 *
 * jsdom has no DataTransfer and no layout. The first is stood in by a small
 * object carrying the three members the code reads (`setData` / `getData` /
 * `types`); the second is why the drop target is found by the element the
 * drop lands on — never by a coordinate lookup — and why the one coordinate
 * the week grid does read (the height inside a day column) is given to the
 * event directly: the column's rect top is 0 here, so clientY IS that height.
 */

function fakeDataTransfer(payload?: string) {
  const store = new Map<string, string>();
  if (payload !== undefined) store.set(TODO_DRAG_MIME, payload);
  return {
    setData: (type: string, value: string) => store.set(type, value),
    getData: (type: string) => store.get(type) ?? "",
    get types() {
      return [...store.keys()];
    },
    dropEffect: "none",
    effectAllowed: "all",
  };
}

function drop(el: Element, dataTransfer: object, clientY = 0) {
  const ev = createEvent.drop(el, { dataTransfer });
  Object.defineProperty(ev, "clientY", { value: clientY });
  fireEvent(el, ev);
}

const labels: TodayTodoTrayLabels = {
  placedHeading: "placed",
  emptyPlaced: "empty placed",
  allDay: "All-day",
  addHeading: "others",
  addAction: "move to today",
  emptyAddable: "empty others",
  openInTodos: "open",
  delete: "delete todo",
  status: "Status",
  statusLabels: { statusNotStarted: "Not started", statusDone: "Done" },
};

function renderTray(props: Partial<Parameters<typeof TodayTodoTray>[0]> = {}) {
  const onToggleComplete = vi.fn();
  const onDelete = vi.fn();
  const onAddCandidate = vi.fn();
  render(
    <TodayTodoTray
      placed={[]}
      unplaced={[]}
      addable={[{ id: "task-9", title: "Other" }]}
      onToggleComplete={onToggleComplete}
      onOpenTodo={vi.fn()}
      onAddCandidate={onAddCandidate}
      onDelete={onDelete}
      singleList
      labels={labels}
      {...props}
    />,
  );
  const row = screen.getByText("Other").closest("li")!;
  return { row, onToggleComplete, onDelete, onAddCandidate };
}

describe("TodayTodoTray — the 'other' rows (#1627)", () => {
  it("completes an other row from its own checkbox", () => {
    const { row, onToggleComplete } = renderTray({ addableControls: true });
    fireEvent.click(within(row).getByRole("checkbox"));
    expect(onToggleComplete).toHaveBeenCalledWith("task-9");
  });

  it("puts the delete button to the right of the + and soft-deletes", () => {
    const { row, onDelete, onAddCandidate } = renderTray({
      addableControls: true,
    });
    const buttons = within(row).getAllByRole("button");
    const add = within(row).getByLabelText("move to today");
    const del = within(row).getByLabelText("delete todo");
    expect(buttons.indexOf(del)).toBe(buttons.indexOf(add) + 1);
    fireEvent.click(del);
    expect(onDelete).toHaveBeenCalledWith("task-9");
    expect(onAddCandidate).not.toHaveBeenCalled();
  });

  it("keeps Briefing's picker as it was without the opt-in", () => {
    const { row } = renderTray();
    expect(within(row).queryByRole("checkbox")).toBeNull();
    expect(within(row).queryByLabelText("delete todo")).toBeNull();
    expect(row.getAttribute("draggable")).toBeNull();
  });

  it("carries the todo id on a drag when draggableAddable is on", () => {
    const { row } = renderTray({ draggableAddable: true });
    expect(row.getAttribute("draggable")).toBe("true");
    const dt = fakeDataTransfer();
    fireEvent.dragStart(row, { dataTransfer: dt });
    expect(dt.getData(TODO_DRAG_MIME)).toBe("task-9");
  });
});

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function renderWeek(onDropTodo = vi.fn()) {
  const { container } = render(
    <WeekTimeGrid
      data={{ weekStart: "2026-09-13", items: [] }}
      labels={{ weekdays: WEEKDAYS, allDay: "All-day" }}
      handlers={{ onDropTodo }}
    />,
  );
  return { container, onDropTodo };
}

describe("WeekTimeGrid — drops from the sidebar (#1627)", () => {
  it("places a todo dropped on a day column at the snapped slot", () => {
    const { container, onDropTodo } = renderWeek();
    const column = container.querySelector(
      '[data-week-grid-day="2026-09-15"]',
    )!;
    // Default hourHeight 48: 14:10 is 680px down, which snaps to 14:00.
    drop(column, fakeDataTransfer("task-9"), 14 * 48 + 8);
    expect(onDropTodo).toHaveBeenCalledWith({
      todoId: "task-9",
      dateISO: "2026-09-15",
      startTime: "14:00",
      endTime: "15:00",
    });
  });

  it("gives a todo dropped on the all-day lane its day and no time", () => {
    const { container, onDropTodo } = renderWeek();
    const cell = container.querySelector(
      '[data-week-grid-allday="2026-09-16"]',
    )!;
    drop(cell, fakeDataTransfer("task-9"));
    expect(onDropTodo).toHaveBeenCalledWith({
      todoId: "task-9",
      dateISO: "2026-09-16",
      startTime: null,
      endTime: null,
    });
  });

  it("ignores a drag that carries no todo", () => {
    const { container, onDropTodo } = renderWeek();
    const column = container.querySelector(
      '[data-week-grid-day="2026-09-15"]',
    )!;
    drop(column, fakeDataTransfer());
    expect(onDropTodo).not.toHaveBeenCalled();
  });

  it("accepts the drag over a column only when it carries a todo", () => {
    const { container } = renderWeek();
    const column = container.querySelector(
      '[data-week-grid-day="2026-09-15"]',
    )!;
    // preventDefault on dragover is what tells the browser "drop allowed".
    const withTodo = createEvent.dragOver(column, {
      dataTransfer: fakeDataTransfer("task-9"),
    });
    fireEvent(column, withTodo);
    expect(withTodo.defaultPrevented).toBe(true);
    const withText = createEvent.dragOver(column, {
      dataTransfer: fakeDataTransfer(),
    });
    fireEvent(column, withText);
    expect(withText.defaultPrevented).toBe(false);
  });
});

describe("MonthGrid — drops from the sidebar (#1627)", () => {
  it("gives a todo dropped on a cell that day with no time", () => {
    const onDropTodo = vi.fn();
    const { container } = render(
      <MonthGrid
        monthKey="2026-09-14"
        items={[]}
        weekdayLabels={WEEKDAYS}
        onDropTodo={onDropTodo}
        formatMoreCount={(n) => `+${n}`}
      />,
    );
    const cell = container.querySelector('[data-month-cell="2026-09-22"]')!;
    drop(cell, fakeDataTransfer("task-9"));
    expect(onDropTodo).toHaveBeenCalledWith({
      todoId: "task-9",
      dateISO: "2026-09-22",
      startTime: null,
      endTime: null,
    });
  });

  it("takes no drop for a host that does not opt in", () => {
    const { container } = render(
      <MonthGrid
        monthKey="2026-09-14"
        items={[]}
        weekdayLabels={WEEKDAYS}
        formatMoreCount={(n) => `+${n}`}
      />,
    );
    const cell = container.querySelector('[data-month-cell="2026-09-22"]')!;
    const over = createEvent.dragOver(cell, {
      dataTransfer: fakeDataTransfer("task-9"),
    });
    fireEvent(cell, over);
    expect(over.defaultPrevented).toBe(false);
  });
});
