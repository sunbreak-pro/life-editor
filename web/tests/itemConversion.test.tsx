import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { DataService, ScheduleItem, TodoNode } from "@life-editor/shared";
import { useItemConversion } from "../src/schedule/useItemConversion";

/*
 * #625 Event <-> Todo conversion, now its own hook (#889).
 *
 * Driven directly rather than through the screen, and deliberately so:
 * D-20260812-refactor-2 makes "render the screen and click the button" the
 * default and keeps the direct route for screens jsdom cannot host —
 * CalendarTab is the named example (a Provider stack plus a real grid
 * layout). Pulling the path out is what made it reachable at all; before
 * this it sat 150 lines inside that screen with no test.
 *
 * What the cases pin is the part that is easy to lose in a move: the two
 * refusals happen BEFORE any write, the confirm is what gates the write, and
 * both stores are re-read afterwards because the row changed role rather than
 * changing value.
 */

const TODAY = "2026-08-20";

function event(over?: Partial<ScheduleItem>): ScheduleItem {
  return {
    id: "s-1",
    date: TODAY,
    title: "Dentist",
    startTime: "09:00",
    endTime: "10:00",
    completed: false,
    completedAt: null,
    routineId: null,
    templateId: null,
    memo: null,
    noteId: null,
    content: null,
    isDeleted: false,
    deletedAt: null,
    isDismissed: false,
    isAllDay: false,
    createdAt: TODAY,
    updatedAt: TODAY,
    ...over,
  } as ScheduleItem;
}

function todo(over?: Partial<TodoNode>): TodoNode {
  return {
    id: "task-1",
    type: "task",
    title: "Write the report",
    status: "NOT_STARTED",
    parentId: null,
    order: 0,
    isAllDay: false,
    createdAt: TODAY,
    updatedAt: TODAY,
    ...over,
  } as TodoNode;
}

function setup(over?: {
  items?: ScheduleItem[];
  todos?: TodoNode[];
  confirm?: boolean;
  convertEventToTodo?: () => Promise<unknown>;
  convertTodoToEvent?: () => Promise<unknown>;
}) {
  const convertEventToTodo = vi.fn(
    over?.convertEventToTodo ?? (() => Promise.resolve({})),
  );
  // Spelled with its parameters so a case can read the id back off the call.
  const convertTodoToEvent = vi.fn((id: string, placement?: unknown) =>
    (over?.convertTodoToEvent ?? (() => Promise.resolve({ id, placement })))(),
  );
  // #997: the two writes an undo needs beyond the inverse conversion.
  const updateTodo = vi.fn(async (id: string, patch: unknown) => ({
    id,
    patch,
  }));
  const dismissScheduleItem = vi.fn(async () => {});
  const dataService = {
    convertEventToTodo,
    convertTodoToEvent,
    updateTodo,
    dismissScheduleItem,
  } as unknown as DataService;
  // Typed through its parameter so a case can read the request back — the
  // presence of `cancelLabel` is what separates "decide this" from
  // "acknowledge this".
  const askConfirm = vi.fn(
    async (request: {
      message: string;
      confirmLabel: string;
      cancelLabel?: string;
    }) => {
      void request;
      return over?.confirm ?? true;
    },
  );
  const reload = vi.fn();
  const refetchTodos = vi.fn(async () => {});
  const showToast = vi.fn();
  const closePopover = vi.fn();
  const closeTodoDetail = vi.fn();
  const push = vi.fn();
  const view = renderHook(() =>
    useItemConversion({
      dataService,
      rangeItems: over?.items ?? [event()],
      contextItems: [],
      todoNodes: over?.todos ?? [todo()],
      listDate: TODAY,
      reload,
      refetchTodos,
      showToast,
      askConfirm,
      closePopover,
      closeTodoDetail,
      push,
    }),
  );
  return {
    view,
    convertEventToTodo,
    convertTodoToEvent,
    askConfirm,
    reload,
    refetchTodos,
    showToast,
    closePopover,
    closeTodoDetail,
    push,
    updateTodo,
    dismissScheduleItem,
  };
}

/** The single command the last successful conversion pushed. */
function pushedCommand(push: ReturnType<typeof vi.fn>) {
  expect(push).toHaveBeenCalledTimes(1);
  return push.mock.calls[0][1] as {
    label: string;
    undo: () => void | Promise<void>;
    redo: () => void | Promise<void>;
  };
}

describe("useItemConversion — Event → Todo", () => {
  it("asks first, then writes and re-reads both stores", async () => {
    // Both, because the row left one list and joined another — neither store
    // finds that out on its own.
    const h = setup();
    await act(async () => h.view.result.current.handleConvertToTodo("s-1"));

    expect(h.askConfirm).toHaveBeenCalledTimes(1);
    expect(h.convertEventToTodo).toHaveBeenCalledWith("s-1", { order: 0 });
    await waitFor(() => expect(h.reload).toHaveBeenCalledTimes(1));
    expect(h.refetchTodos).toHaveBeenCalledTimes(1);
    expect(h.closePopover).toHaveBeenCalledTimes(1);
  });

  it("writes nothing when the confirm is declined", async () => {
    const h = setup({ confirm: false });
    await act(async () => h.view.result.current.handleConvertToTodo("s-1"));

    expect(h.convertEventToTodo).not.toHaveBeenCalled();
    expect(h.reload).not.toHaveBeenCalled();
    // #997: nothing happened, so there must be nothing on the stack to undo.
    expect(h.push).not.toHaveBeenCalled();
  });

  it("refuses a routine occurrence before it asks anything else", async () => {
    // D-20260810-sched-5: the action stays enabled and ANSWERS with the
    // reason — a greyed-out row teaches nothing. One acknowledge dialog, and
    // no write at all.
    const h = setup({ items: [event({ routineId: "routine-1" })] });
    await act(async () => h.view.result.current.handleConvertToTodo("s-1"));

    expect(h.convertEventToTodo).not.toHaveBeenCalled();
    expect(h.askConfirm).toHaveBeenCalledTimes(1);
    expect(h.askConfirm.mock.calls[0][0]).not.toHaveProperty("cancelLabel");
  });

  it("does nothing for an id neither store holds", async () => {
    const h = setup();
    await act(async () => h.view.result.current.handleConvertToTodo("s-gone"));

    expect(h.askConfirm).not.toHaveBeenCalled();
    expect(h.convertEventToTodo).not.toHaveBeenCalled();
  });

  it("reports a failed write instead of a success", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const h = setup({
      convertEventToTodo: () => Promise.reject(new Error("offline")),
    });
    await act(async () => h.view.result.current.handleConvertToTodo("s-1"));

    await waitFor(() => expect(h.showToast).toHaveBeenCalled());
    expect(h.showToast.mock.calls[0][0]).toBe("danger");
  });
});

describe("useItemConversion — Todo → Event", () => {
  it("asks first, then writes and re-reads both stores", async () => {
    const h = setup();
    await act(async () => h.view.result.current.handleConvertToEvent("task-1"));

    expect(h.convertTodoToEvent).toHaveBeenCalledTimes(1);
    expect(h.convertTodoToEvent.mock.calls[0][0]).toBe("task-1");
    await waitFor(() => expect(h.reload).toHaveBeenCalledTimes(1));
    expect(h.closeTodoDetail).toHaveBeenCalledTimes(1);
  });

  it("refuses a todo that has children, before any write", async () => {
    // D-20260810-sched-4: events have no hierarchy, so a parent cannot become
    // one. The service checks again against the DB; this check exists so the
    // common case gets a sentence instead of a red toast.
    const h = setup({
      todos: [todo(), todo({ id: "task-2", parentId: "task-1" })],
    });
    await act(async () => h.view.result.current.handleConvertToEvent("task-1"));

    expect(h.convertTodoToEvent).not.toHaveBeenCalled();
    expect(h.askConfirm).toHaveBeenCalledTimes(1);
  });

  it("still converts a CHILD todo, after saying it loses its parent", async () => {
    const h = setup({
      todos: [todo({ id: "task-2", parentId: "task-1" }), todo()],
    });
    await act(async () => h.view.result.current.handleConvertToEvent("task-2"));

    expect(h.askConfirm.mock.calls[0][0]).toHaveProperty("cancelLabel");
    expect(h.convertTodoToEvent).toHaveBeenCalledTimes(1);
  });
});

describe("useItemConversion — undo (#997)", () => {
  it("pushes nothing for a write that failed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const h = setup({
      convertEventToTodo: () => Promise.reject(new Error("offline")),
    });
    await act(async () => h.view.result.current.handleConvertToTodo("s-1"));

    await waitFor(() =>
      expect(h.showToast).toHaveBeenCalledWith("danger", expect.anything()),
    );
    expect(h.push).not.toHaveBeenCalled();
  });

  it("labels the Event -> Todo command", async () => {
    const h = setup();
    await act(async () => h.view.result.current.handleConvertToTodo("s-1"));
    await waitFor(() => expect(h.push).toHaveBeenCalledTimes(1));
    expect(pushedCommand(h.push).label).toBe("convertEventToTodo");
  });

  it("puts the event back on its OWN slot, dismissed flag included", async () => {
    // Values deliberately unlike the fixture defaults, so the assertion cannot
    // pass by landing on today's 09:00-10:00 by accident.
    const h = setup({
      items: [
        event({
          date: "2026-08-14",
          startTime: "13:15",
          endTime: "14:45",
          isAllDay: false,
          isDismissed: true,
        }),
      ],
    });
    await act(async () => h.view.result.current.handleConvertToTodo("s-1"));
    await waitFor(() => expect(h.push).toHaveBeenCalledTimes(1));

    await act(async () => {
      await pushedCommand(h.push).undo();
    });

    expect(h.convertTodoToEvent).toHaveBeenCalledWith("s-1", {
      date: "2026-08-14",
      startTime: "13:15",
      endTime: "14:45",
      isAllDay: false,
    });
    // convertTodoToEvent always writes is_dismissed = false, so without this
    // the row would come back visible.
    expect(h.dismissScheduleItem).toHaveBeenCalledWith("s-1");
    expect(h.reload).toHaveBeenCalledTimes(2);
  });

  it("re-runs the same forward conversion on redo", async () => {
    const h = setup();
    await act(async () => h.view.result.current.handleConvertToTodo("s-1"));
    await waitFor(() => expect(h.push).toHaveBeenCalledTimes(1));
    const cmd = pushedCommand(h.push);

    await act(async () => {
      await cmd.undo();
    });
    await act(async () => {
      await cmd.redo();
    });

    expect(h.convertEventToTodo).toHaveBeenCalledTimes(2);
    expect(h.convertEventToTodo.mock.calls[1]).toEqual(["s-1", { order: 0 }]);
  });

  it("restores the Todo's role AND every field the conversion dropped", async () => {
    const h = setup({
      todos: [
        todo({ id: "task-parent" }),
        todo({
          id: "task-1",
          parentId: "task-parent",
          order: 7,
          status: "DONE",
          isExpanded: true,
          priority: 2,
          color: "amber",
          icon: "star",
          timeMemo: "morning",
          workDurationMinutes: 45,
          reminderEnabled: true,
          reminderOffset: 15,
        }),
      ],
    });
    await act(async () => h.view.result.current.handleConvertToEvent("task-1"));
    await waitFor(() => expect(h.push).toHaveBeenCalledTimes(1));

    await act(async () => {
      await pushedCommand(h.push).undo();
    });

    // The ROLE, back at the position it held.
    expect(h.convertEventToTodo).toHaveBeenCalledWith("task-1", { order: 7 });
    // The FIELDS the re-role cannot carry: convertEventToTodo builds its
    // TodoNode from the event alone, so anything not in that literal comes
    // back NULL or false.
    expect(h.updateTodo).toHaveBeenCalledWith(
      "task-1",
      expect.objectContaining({
        parentId: "task-parent",
        status: "DONE",
        isExpanded: true,
        priority: 2,
        color: "amber",
        icon: "star",
        timeMemo: "morning",
        workDurationMinutes: 45,
        reminderEnabled: true,
        reminderOffset: 15,
      }),
    );
    // Order matters: tasks_payload does not exist until the re-role lands, so
    // a patch sent first would have nothing to write onto.
    expect(h.convertEventToTodo.mock.invocationCallOrder[0]).toBeLessThan(
      h.updateTodo.mock.invocationCallOrder[0],
    );
  });

  it("reports a failed undo instead of going quiet", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const h = setup({
      convertTodoToEvent: () => Promise.reject(new Error("offline")),
    });
    await act(async () => h.view.result.current.handleConvertToTodo("s-1"));
    await waitFor(() => expect(h.push).toHaveBeenCalledTimes(1));

    await act(async () => {
      await pushedCommand(h.push).undo();
    });

    // The manager console.errors a throwing command and still moves it to the
    // redo stack, so a silent undo would look exactly like a working one.
    expect(h.showToast).toHaveBeenLastCalledWith("danger", expect.anything());
  });
});
