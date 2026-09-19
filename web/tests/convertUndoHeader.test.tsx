import { describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from "@testing-library/react";
import {
  UndoRedoProvider,
  useUndoRedoContext,
  type DataService,
  type TodoNode,
} from "@life-editor/shared";
import { HeaderUndoRedo } from "../src/HeaderUndoRedo";
import { useItemConversion } from "../src/schedule/useItemConversion";

/*
 * #1637 — "Todo を予定に変換した後、ヘッダーの Undo が disabled のまま".
 *
 * itemConversion.test.tsx pins the command a conversion pushes, but against a
 * `vi.fn()` push: nothing there proves the command reaches the stack the HEADER
 * reads, or that the header notices. This suite wires the real pieces — the one
 * UndoRedoProvider, the header buttons, and the conversion hook fed with that
 * provider's `push` exactly the way CalendarTab feeds it — and drives the
 * round trip through the buttons.
 *
 * Every Todo → Event entry reaches the stack through `handleConvertToEvent`
 * (the chip bubble = ScheduleOverlays' todoActions.onConvertToEvent, the todo
 * detail = ScheduleTodoDetail's onConvertToEvent; both host tests already pin
 * that they call it with the todo's id). Dragging a todo onto the grid is a
 * time write, not a conversion (todoChipUndoWiring.ts). So the entries are
 * driven here as the two callers spell the call, and the rest of the path is
 * shared.
 */

const TODAY = "2026-09-17";

function todo(): TodoNode {
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
  } as TodoNode;
}

function setup(over?: { reload?: () => void }) {
  const convertTodoToEvent = vi.fn(async () => ({}));
  const convertEventToTodo = vi.fn(async () => ({}));
  const updateTodo = vi.fn(async () => ({}));
  const dataService = {
    convertTodoToEvent,
    convertEventToTodo,
    updateTodo,
  } as unknown as DataService;
  const api: {
    convert?: (id: string) => void;
  } = {};

  function Host() {
    const { push } = useUndoRedoContext();
    const { handleConvertToEvent } = useItemConversion({
      dataService,
      rangeItems: [],
      contextItems: [],
      todoNodes: [todo()],
      listDate: TODAY,
      reload: over?.reload ?? (() => {}),
      refetchTodos: async () => {},
      showToast: () => {},
      askConfirm: async () => true,
      closePopover: () => {},
      closeTodoDetail: () => {},
      push,
      closeEditor: () => {},
    });
    api.convert = handleConvertToEvent;
    return null;
  }

  render(
    <UndoRedoProvider>
      <HeaderUndoRedo />
      <Host />
    </UndoRedoProvider>,
  );
  return { api, convertTodoToEvent, convertEventToTodo };
}

const button = (name: string) =>
  screen.getByRole("button", { name }) as HTMLButtonElement;

describe("Todo → Event conversion drives the header Undo (#1637)", () => {
  // The chip bubble calls `todoActions.onConvertToEvent(chip.id)` and the todo
  // detail calls `onConvertToEvent(todo.id)` — the same handler with the same
  // id, so one round trip covers both entries from here down.
  it("Undo lights up after the conversion, reverts it, and Redo re-applies", async () => {
    const h = setup();
    expect(button("Undo").disabled).toBe(true);

    await act(async () => h.api.convert!("task-1"));
    await waitFor(() => expect(button("Undo").disabled).toBe(false));
    expect(h.convertTodoToEvent).toHaveBeenCalledTimes(1);

    await act(async () => fireEvent.click(button("Undo")));
    await waitFor(() => expect(h.convertEventToTodo).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(button("Redo").disabled).toBe(false));

    await act(async () => fireEvent.click(button("Redo")));
    await waitFor(() => expect(h.convertTodoToEvent).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(button("Undo").disabled).toBe(false));
  });

  it("still records the command when a re-read after the write throws", async () => {
    // The write has landed at that point, so the conversion is real and owes an
    // Undo. The push used to come AFTER the re-reads and a throw skipped it.
    const h = setup({
      reload: () => {
        throw new Error("reload blew up");
      },
    });

    await act(async () => h.api.convert!("task-1"));

    await waitFor(() => expect(button("Undo").disabled).toBe(false));
    expect(h.convertTodoToEvent).toHaveBeenCalledTimes(1);
  });
});
