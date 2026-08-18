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
  const dataService = {
    convertEventToTodo,
    convertTodoToEvent,
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
  const closeEditor = vi.fn();
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
      closeEditor,
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
    closeEditor,
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
    // #998: the narrow sheet edits EVENTS, and this row has stopped being one.
    expect(h.closeEditor).toHaveBeenCalledTimes(1);
  });

  it("writes nothing when the confirm is declined", async () => {
    const h = setup({ confirm: false });
    await act(async () => h.view.result.current.handleConvertToTodo("s-1"));

    expect(h.convertEventToTodo).not.toHaveBeenCalled();
    expect(h.reload).not.toHaveBeenCalled();
    // #998: a declined confirm must not drop the user's selection — the sheet
    // stays on the row it was asking about.
    expect(h.closeEditor).not.toHaveBeenCalled();
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
    // #998: the refusal has to leave the sheet open ON the row it is talking
    // about, or the explanation names something the user can no longer see.
    expect(h.closeEditor).not.toHaveBeenCalled();
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
    // #998 is one-directional: the event editor is not open on a todo, so the
    // two closes must not cross-wire.
    expect(h.closeEditor).not.toHaveBeenCalled();
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
