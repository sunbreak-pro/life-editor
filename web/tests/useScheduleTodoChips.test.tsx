import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { localDateTimeToISO, todoChipId } from "@life-editor/shared";
import type { ConfirmRequest, TodoNode } from "@life-editor/shared";
import { useScheduleTodoChips } from "../src/schedule/useScheduleTodoChips";

/*
 * The Calendar host's todo half, pulled out of CalendarTab in the #675 split.
 *
 * These behaviours had no test at all before, and not for want of trying: the
 * calendar needs the whole Provider stack plus real layout to render and jsdom
 * has neither, so swapping the two chip windows or dropping a delete confirm
 * went green through every gate. Out here it is a hook — no layout, no
 * providers, just calls and their arguments.
 *
 * The individual WRITES stay pinned in todoChipUndoWiring.test.ts. What is
 * under test here is the wiring around them: which window each chip list is
 * drawn from, which group a chip lands in, and which of the two delete
 * questions a row gets.
 *
 * `useTranslation` is stubbed to echo its key with the interpolated values
 * appended, because #1000 moved the delete copy INTO the hook (it was handed in
 * as `copy` before). A plain key echo would not do: what the two delete
 * assertions are actually about is that the row's title and the subtree count
 * reach the sentence, and a bare key hides exactly that.
 */

vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@life-editor/shared")>()),
  useTranslation: () => ({
    t: (key: string, opts?: { name?: string; count?: number }) => {
      if (!opts) return key;
      const count = opts.count === undefined ? "" : `:${opts.count}`;
      return `${key}:${opts.name}${count}`;
    },
  }),
}));

const TODAY = "2026-08-13";
const RANGE_START = "2026-08-10";
const RANGE_END = "2026-08-16";
/** The grid parked on a week that does not contain today. */
const AWAY_START = "2026-09-07";
const AWAY_END = "2026-09-13";

function todo(id: string, overrides: Partial<TodoNode> = {}): TodoNode {
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
  return todo(id, {
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
  return todo(id, {
    scheduledAt: localDateTimeToISO(dateKey, "00:00"),
    isAllDay: true,
    ...overrides,
  });
}

function renderChips(
  todoNodes: TodoNode[],
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
    useScheduleTodoChips({
      todoNodes,
      updateNode,
      setTodoStatus,
      softDeleteTodo,
      today: TODAY,
      rangeStart: opts.rangeStart ?? RANGE_START,
      rangeEnd: opts.rangeEnd ?? RANGE_END,
      askConfirm,
    }),
  );
  return { hook, updateNode, setTodoStatus, softDeleteTodo, askConfirm, asked };
}

describe("the two chip windows", () => {
  it("draws the range from the grid's window and today from today", () => {
    const { hook } = renderChips([
      timed("today-todo", TODAY),
      timed("later-todo", "2026-08-15"),
      timed("outside", "2026-07-01"),
    ]);
    expect(hook.result.current.rangeTodoChips.map((c) => c.id)).toEqual([
      "today-todo",
      "later-todo",
    ]);
    expect(hook.result.current.todayTodoChips.map((c) => c.id)).toEqual([
      "today-todo",
    ]);
  });

  // The sidebar is where a row the grid is not showing is still reachable, so
  // its window is today's regardless of where the grid was navigated to.
  it("keeps today's chips when the grid has moved to another week", () => {
    const { hook } = renderChips([timed("today-todo", TODAY)], {
      rangeStart: AWAY_START,
      rangeEnd: AWAY_END,
    });
    expect(hook.result.current.rangeTodoChips).toEqual([]);
    expect(hook.result.current.todayTodoChips.map((c) => c.id)).toEqual([
      "today-todo",
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
      todo("free"),
      todo("parent"),
      todo("child", { parentId: "parent" }),
      todo("finished", { status: "DONE" }),
      timed("already-placed", "2026-12-24"),
    ]);
    expect(hook.result.current.todoAddable.map((t) => t.id)).toEqual([
      "free",
      "child",
    ]);
  });
});

describe("findTodoChip", () => {
  it("answers null for an event id, which shares the same popover", () => {
    const { hook } = renderChips([timed("today-todo", TODAY)]);
    expect(hook.result.current.findTodoChip("schedule-1")).toBeNull();
  });

  // The same rangeItems ?? contextItems pairing `selected` uses: the agenda
  // always lists today, so with the grid elsewhere its rows are in no range
  // chip at all — and a range-only lookup left that click silently dead (#564).
  it("falls back to today's chips when the range does not hold the row", () => {
    const { hook } = renderChips([timed("today-todo", TODAY)], {
      rangeStart: AWAY_START,
      rangeEnd: AWAY_END,
    });
    expect(hook.result.current.findTodoChip(todoChipId("today-todo"))?.id).toBe(
      "today-todo",
    );
    expect(hook.result.current.findTodoChip(todoChipId("ghost"))).toBeNull();
  });
});

describe("the chip gestures", () => {
  // The grid speaks in synthetic chip ids; updateNode speaks in TodoNode ids.
  // Forget the unwrap and the write lands on nothing.
  it("addresses the underlying todo, and labels a move by the todo's shape", () => {
    const { hook, updateNode } = renderChips([
      timed("timed-todo", TODAY),
      allDay("candidate", TODAY),
    ]);

    act(() =>
      hook.result.current.handleTodoChipMove(
        todoChipId("timed-todo"),
        "2026-08-14",
        "11:00",
        "12:00",
      ),
    );
    expect(updateNode).toHaveBeenCalledWith(
      "timed-todo",
      expect.objectContaining({ isAllDay: false }),
      { undoLabel: "todoChipMove" },
    );

    // An all-day candidate dragged into the time body is a PLACE, and the undo
    // toast has to say so.
    act(() =>
      hook.result.current.handleTodoChipMove(
        todoChipId("candidate"),
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

  it("drops a resize of a todo that has no start to anchor the new end to", () => {
    const { hook, updateNode } = renderChips([
      timed("timed-todo", TODAY),
      todo("unscheduled"),
    ]);

    act(() =>
      hook.result.current.handleTodoChipResize(
        todoChipId("timed-todo"),
        "13:00",
      ),
    );
    expect(updateNode).toHaveBeenCalledWith(
      "timed-todo",
      expect.objectContaining({ scheduledEndAt: expect.any(String) }),
      { undoLabel: "todoChipResize" },
    );

    updateNode.mockClear();
    act(() =>
      hook.result.current.handleTodoChipResize(
        todoChipId("unscheduled"),
        "13:00",
      ),
    );
    expect(updateNode).not.toHaveBeenCalled();
  });

  it("stages a chip dropped back on the all-day lane", () => {
    const { hook, updateNode } = renderChips([timed("timed-todo", TODAY)]);
    act(() =>
      hook.result.current.handleTodoChipDropAllDay(
        todoChipId("timed-todo"),
        "2026-08-14",
      ),
    );
    expect(updateNode).toHaveBeenCalledWith(
      "timed-todo",
      expect.objectContaining({ isAllDay: true }),
      { undoLabel: "todoChipAllDay" },
    );
  });

  // A plain binary toggle. It predates #873 (when the tree still cycled through
  // three values) and is kept because the chip must write a status even for a
  // todo that has none — an unset row is unfinished, so a press means DONE.
  it("toggles a todo between done and not-started only", () => {
    const { hook, setTodoStatus } = renderChips([
      timed("done", TODAY, "09:00", { status: "DONE" }),
      timed("unset", TODAY, "09:00", { status: undefined }),
    ]);

    act(() => hook.result.current.handleTodoToggleComplete("done"));
    expect(setTodoStatus).toHaveBeenCalledWith("done", "NOT_STARTED");

    act(() => hook.result.current.handleTodoToggleComplete("unset"));
    expect(setTodoStatus).toHaveBeenLastCalledWith("unset", "DONE");
  });

  it("stages 'add to today' onto today, not onto the grid's day", () => {
    const { hook, updateNode } = renderChips([todo("free")], {
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
    todo("leaf", { title: "Water the plants" }),
    todo("parent", { title: "Pack for the trip" }),
    todo("child", { parentId: "parent" }),
    todo("grandchild", { parentId: "child" }),
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
    expect(asked[0].message).toBe(
      "todoDetail.todoDeleteCascadeConfirm:Pack for the trip:2",
    );
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
    act(() => hook.result.current.setTodoDetailId("leaf"));

    act(() => hook.result.current.handleTodoDetailDelete("leaf"));
    await waitFor(() => expect(softDeleteTodo).toHaveBeenCalledWith("leaf"));
    expect(asked[0].message).toBe(
      "todoDetail.todoDeleteConfirm:Water the plants",
    );
    // Closed FIRST and without the unsaved-draft guard: a pending title on a
    // row being deleted is not worth a second question.
    expect(hook.result.current.todoDetailId).toBeNull();
  });

  it("leaves the panel open when the detail delete is declined", async () => {
    const { hook, softDeleteTodo, askConfirm } = renderChips(TREE, {
      answer: false,
    });
    act(() => hook.result.current.setTodoDetailId("parent"));

    act(() => hook.result.current.handleTodoDetailDelete("parent"));
    await waitFor(() => expect(askConfirm).toHaveBeenCalledTimes(1));
    expect(softDeleteTodo).not.toHaveBeenCalled();
    expect(hook.result.current.todoDetailId).toBe("parent");
  });
});
