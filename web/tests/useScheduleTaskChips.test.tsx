import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { localDateTimeToISO, taskChipId } from "@life-editor/shared";
import type { ConfirmRequest, TodoNode } from "@life-editor/shared";
import { useScheduleTaskChips } from "../src/schedule/useScheduleTaskChips";

/*
 * The Calendar host's task half, pulled out of CalendarTab in the #675 split.
 *
 * These behaviours had no test at all before, and not for want of trying: the
 * calendar needs the whole Provider stack plus real layout to render and jsdom
 * has neither, so swapping the two chip windows or dropping a delete confirm
 * went green through every gate. Out here it is a hook — no layout, no
 * providers, just calls and their arguments.
 *
 * The individual WRITES stay pinned in taskChipUndoWiring.test.ts. What is
 * under test here is the wiring around them: which window each chip list is
 * drawn from, which group a chip lands in, and which of the two delete
 * questions a row gets.
 */

const TODAY = "2026-08-13";
const RANGE_START = "2026-08-10";
const RANGE_END = "2026-08-16";
/** The grid parked on a week that does not contain today. */
const AWAY_START = "2026-09-07";
const AWAY_END = "2026-09-13";

function task(id: string, overrides: Partial<TodoNode> = {}): TodoNode {
  return {
    id,
    type: "task",
    title: id,
    parentId: null,
    order: 0,
    createdAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

// Built through localDateTimeToISO — the inverse of the chip module's own
// UTC→LOCAL read — so these fixtures land on the intended day in any timezone.
// The end is always an hour after the start: a span that ENDS before it begins
// is rescued into an all-day chip (#562), which would quietly move every row
// below into the wrong tray group.
function timed(
  id: string,
  dateKey: string,
  start = "09:00",
  overrides: Partial<TodoNode> = {},
): TodoNode {
  const end = `${String(Number(start.slice(0, 2)) + 1).padStart(2, "0")}${start.slice(2)}`;
  return task(id, {
    scheduledAt: localDateTimeToISO(dateKey, start),
    scheduledEndAt: localDateTimeToISO(dateKey, end),
    isAllDay: false,
    ...overrides,
  });
}

function allDay(
  id: string,
  dateKey: string,
  overrides: Partial<TodoNode> = {},
): TodoNode {
  return task(id, {
    scheduledAt: localDateTimeToISO(dateKey, "00:00"),
    isAllDay: true,
    ...overrides,
  });
}

const COPY = {
  confirm: (name: string) => `delete ${name}?`,
  cascadeConfirm: (name: string, count: number) =>
    `delete ${name} and ${count} more?`,
  untitled: "(untitled)",
  confirmLabel: "Delete",
  cancelLabel: "Cancel",
};

function renderChips(
  taskNodes: TodoNode[],
  opts: {
    /** What the user answers the confirm dialog. */
    answer?: boolean;
    rangeStart?: string;
    rangeEnd?: string;
  } = {},
) {
  const updateNode = vi.fn();
  const setTodoStatus = vi.fn();
  const softDeleteTodo = vi.fn();
  const asked: ConfirmRequest[] = [];
  const askConfirm = vi.fn((request: ConfirmRequest) => {
    asked.push(request);
    return Promise.resolve(opts.answer ?? true);
  });
  const hook = renderHook(() =>
    useScheduleTaskChips({
      taskNodes,
      updateNode,
      setTodoStatus,
      softDeleteTodo,
      today: TODAY,
      rangeStart: opts.rangeStart ?? RANGE_START,
      rangeEnd: opts.rangeEnd ?? RANGE_END,
      askConfirm,
      copy: COPY,
    }),
  );
  return { hook, updateNode, setTodoStatus, softDeleteTodo, askConfirm, asked };
}

describe("the two chip windows", () => {
  it("draws the range from the grid's window and today from today", () => {
    const { hook } = renderChips([
      timed("today-task", TODAY),
      timed("later-task", "2026-08-15"),
      timed("outside", "2026-07-01"),
    ]);
    expect(hook.result.current.rangeTaskChips.map((c) => c.id)).toEqual([
      "today-task",
      "later-task",
    ]);
    expect(hook.result.current.todayTaskChips.map((c) => c.id)).toEqual([
      "today-task",
    ]);
  });

  // The sidebar is where a row the grid is not showing is still reachable, so
  // its window is today's regardless of where the grid was navigated to.
  it("keeps today's chips when the grid has moved to another week", () => {
    const { hook } = renderChips([timed("today-task", TODAY)], {
      rangeStart: AWAY_START,
      rangeEnd: AWAY_END,
    });
    expect(hook.result.current.rangeTaskChips).toEqual([]);
    expect(hook.result.current.todayTaskChips.map((c) => c.id)).toEqual([
      "today-task",
    ]);
  });
});

describe("the Todo tray's three groups", () => {
  // 案 c staging (#298): a time = placed, all-day = a candidate still waiting
  // for one. Get this split backwards and the tray reads as full when nothing
  // has actually been scheduled.
  it("splits today's chips by whether they have a time yet", () => {
    const { hook } = renderChips([
      timed("placed", TODAY, "14:30"),
      allDay("candidate", TODAY),
    ]);
    expect(hook.result.current.todoPlaced).toEqual([
      {
        id: "placed",
        title: "placed",
        timeLabel: "14:30",
        completed: false,
      },
    ]);
    expect(hook.result.current.todoUnplaced).toEqual([
      { id: "candidate", title: "candidate", completed: false },
    ]);
  });

  // The picker draws from the WHOLE tree, not from today — its job is to find
  // work that has no day at all yet.
  it("offers unscheduled incomplete leaves from anywhere in the tree", () => {
    const { hook } = renderChips([
      task("free"),
      task("parent"),
      task("child", { parentId: "parent" }),
      task("finished", { status: "DONE" }),
      timed("already-placed", "2026-12-24"),
    ]);
    expect(hook.result.current.todoAddable.map((t) => t.id)).toEqual([
      "free",
      "child",
    ]);
  });
});

describe("findTaskChip", () => {
  it("answers null for an event id, which shares the same popover", () => {
    const { hook } = renderChips([timed("today-task", TODAY)]);
    expect(hook.result.current.findTaskChip("schedule-1")).toBeNull();
  });

  // The same rangeItems ?? contextItems pairing `selected` uses: the agenda
  // always lists today, so with the grid elsewhere its rows are in no range
  // chip at all — and a range-only lookup left that click silently dead (#564).
  it("falls back to today's chips when the range does not hold the row", () => {
    const { hook } = renderChips([timed("today-task", TODAY)], {
      rangeStart: AWAY_START,
      rangeEnd: AWAY_END,
    });
    expect(hook.result.current.findTaskChip(taskChipId("today-task"))?.id).toBe(
      "today-task",
    );
    expect(hook.result.current.findTaskChip(taskChipId("ghost"))).toBeNull();
  });
});

describe("the chip gestures", () => {
  // The grid speaks in synthetic chip ids; updateNode speaks in TodoNode ids.
  // Forget the unwrap and the write lands on nothing.
  it("addresses the underlying task, and labels a move by the task's shape", () => {
    const { hook, updateNode } = renderChips([
      timed("timed-task", TODAY),
      allDay("candidate", TODAY),
    ]);

    act(() =>
      hook.result.current.handleTaskChipMove(
        taskChipId("timed-task"),
        "2026-08-14",
        "11:00",
        "12:00",
      ),
    );
    expect(updateNode).toHaveBeenCalledWith(
      "timed-task",
      expect.objectContaining({ isAllDay: false }),
      { undoLabel: "todoChipMove" },
    );

    // An all-day candidate dragged into the time body is a PLACE, and the undo
    // toast has to say so.
    act(() =>
      hook.result.current.handleTaskChipMove(
        taskChipId("candidate"),
        "2026-08-14",
        "11:00",
        "12:00",
      ),
    );
    expect(updateNode).toHaveBeenLastCalledWith(
      "candidate",
      expect.anything(),
      { undoLabel: "todoChipPlace" },
    );
  });

  it("drops a resize of a task that has no start to anchor the new end to", () => {
    const { hook, updateNode } = renderChips([
      timed("timed-task", TODAY),
      task("unscheduled"),
    ]);

    act(() =>
      hook.result.current.handleTaskChipResize(
        taskChipId("timed-task"),
        "13:00",
      ),
    );
    expect(updateNode).toHaveBeenCalledWith(
      "timed-task",
      expect.objectContaining({ scheduledEndAt: expect.any(String) }),
      { undoLabel: "todoChipResize" },
    );

    updateNode.mockClear();
    act(() =>
      hook.result.current.handleTaskChipResize(
        taskChipId("unscheduled"),
        "13:00",
      ),
    );
    expect(updateNode).not.toHaveBeenCalled();
  });

  it("stages a chip dropped back on the all-day lane", () => {
    const { hook, updateNode } = renderChips([timed("timed-task", TODAY)]);
    act(() =>
      hook.result.current.handleTaskChipDropAllDay(
        taskChipId("timed-task"),
        "2026-08-14",
      ),
    );
    expect(updateNode).toHaveBeenCalledWith(
      "timed-task",
      expect.objectContaining({ isAllDay: true }),
      { undoLabel: "todoChipAllDay" },
    );
  });

  // A plain binary toggle, NOT the tree's 3-state cycle — the tray shows a
  // checkbox, and a press that landed on IN_PROGRESS would read as a no-op.
  it("toggles a todo between done and not-started only", () => {
    const { hook, setTodoStatus } = renderChips([
      timed("done", TODAY, "09:00", { status: "DONE" }),
      timed("half", TODAY, "09:00", { status: "IN_PROGRESS" }),
    ]);

    act(() => hook.result.current.handleTodoToggleComplete("done"));
    expect(setTodoStatus).toHaveBeenCalledWith("done", "NOT_STARTED");

    act(() => hook.result.current.handleTodoToggleComplete("half"));
    expect(setTodoStatus).toHaveBeenLastCalledWith("half", "DONE");
  });

  it("stages 'add to today' onto today, not onto the grid's day", () => {
    const { hook, updateNode } = renderChips([task("free")], {
      rangeStart: AWAY_START,
      rangeEnd: AWAY_END,
    });
    act(() => hook.result.current.handleTodoAddCandidate("free"));
    expect(updateNode).toHaveBeenCalledWith(
      "free",
      {
        scheduledAt: localDateTimeToISO(TODAY, "00:00"),
        isAllDay: true,
      },
      { undoLabel: "todoAddToToday" },
    );
  });
});

describe("the two delete questions", () => {
  const TREE = [
    task("leaf", { title: "Water the plants" }),
    task("parent", { title: "Pack for the trip" }),
    task("child", { parentId: "parent" }),
    task("grandchild", { parentId: "child" }),
  ];

  // #573: the tray's trash icon is a one-tap row control, and friction on a
  // leaf buys nothing — undo is a click away and there is nothing else to lose.
  it("deletes a leaf from the tray without asking", () => {
    const { hook, softDeleteTodo, askConfirm } = renderChips(TREE);
    act(() => hook.result.current.handleTodoDelete("leaf"));
    expect(softDeleteTodo).toHaveBeenCalledWith("leaf");
    expect(askConfirm).not.toHaveBeenCalled();
  });

  it("asks with the whole subtree's count before a cascade", async () => {
    const { hook, softDeleteTodo, asked } = renderChips(TREE);
    act(() => hook.result.current.handleTodoDelete("parent"));
    await waitFor(() => expect(softDeleteTodo).toHaveBeenCalledWith("parent"));
    // Two rows go with it, the grandchild included — the count is what the
    // user cannot see from a tray row.
    expect(asked[0].message).toBe("delete Pack for the trip and 2 more?");
    expect(asked[0].danger).toBe(true);
  });

  it("writes nothing when the cascade question is declined", async () => {
    const { hook, softDeleteTodo, askConfirm } = renderChips(TREE, {
      answer: false,
    });
    act(() => hook.result.current.handleTodoDelete("parent"));
    await waitFor(() => expect(askConfirm).toHaveBeenCalledTimes(1));
    expect(softDeleteTodo).not.toHaveBeenCalled();
  });

  // #775: the detail panel asks whatever the row is. On Mobile the sheet is
  // the only way into a todo, there is no hover to reveal what a control does
  // and no keyboard undo — so the leaf's frictionless path does not apply.
  it("always asks from the detail panel, and closes it on the way out", async () => {
    const { hook, softDeleteTodo, asked } = renderChips(TREE);
    act(() => hook.result.current.setTaskDetailId("leaf"));

    act(() => hook.result.current.handleTodoDetailDelete("leaf"));
    await waitFor(() => expect(softDeleteTodo).toHaveBeenCalledWith("leaf"));
    expect(asked[0].message).toBe("delete Water the plants?");
    // Closed FIRST and without the unsaved-draft guard: a pending title on a
    // row being deleted is not worth a second question.
    expect(hook.result.current.taskDetailId).toBeNull();
  });

  it("leaves the panel open when the detail delete is declined", async () => {
    const { hook, softDeleteTodo, askConfirm } = renderChips(TREE, {
      answer: false,
    });
    act(() => hook.result.current.setTaskDetailId("parent"));

    act(() => hook.result.current.handleTodoDetailDelete("parent"));
    await waitFor(() => expect(askConfirm).toHaveBeenCalledTimes(1));
    expect(softDeleteTodo).not.toHaveBeenCalled();
    expect(hook.result.current.taskDetailId).toBe("parent");
  });
});
