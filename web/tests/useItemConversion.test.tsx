import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  ItemConversionError,
  type ScheduleItem,
  type TodoNode,
} from "@life-editor/shared";
import { useItemConversion } from "../src/schedule/useItemConversion";
import { stubDataService } from "./helpers";

/*
 * #1642 P1 — useItemConversion, pinned before phase 2 moves code around it.
 * itemConversion.test.tsx covers the core path; this suite takes what was
 * still unpinned. Not pinned on purpose: an undo or redo that meets the
 * in-flight guard returns without a word (N-13), a phase-2 fix (P4).
 */

// Echo the key, so a toast reads as the sentence it picked.
vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@life-editor/shared")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

const TODAY = "2026-09-26";

const event = (over?: Partial<ScheduleItem>): ScheduleItem => ({
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
});

const todo = (over?: Partial<TodoNode>): TodoNode => ({
  id: "task-1",
  type: "task",
  title: "Write the report",
  status: "NOT_STARTED",
  parentId: null,
  order: 3,
  createdAt: TODAY,
  ...over,
});

function setup(over?: {
  todos?: TodoNode[];
  confirm?: boolean;
  withPush?: boolean;
  convertEventToTodo?: () => Promise<unknown>;
  convertTodoToEvent?: () => Promise<unknown>;
}) {
  const spies = {
    convertEventToTodo: vi.fn(over?.convertEventToTodo ?? (async () => ({}))),
    convertTodoToEvent: vi.fn((id: string, placement: unknown) =>
      over?.convertTodoToEvent ? over.convertTodoToEvent() : Promise.resolve({ id, placement }),
    ),
    updateTodo: vi.fn(async () => ({})),
    dismissScheduleItem: vi.fn(async () => {}),
  };
  const makeDS = () => stubDataService(spies);
  const h = {
    ...spies,
    reload: vi.fn(),
    showToast: vi.fn(),
    closePopover: vi.fn(),
    closeTodoDetail: vi.fn(),
    closeEditor: vi.fn(),
    push: vi.fn(),
  };
  const dataService = makeDS();
  const view = renderHook(() =>
    useItemConversion({
      dataService,
      rangeItems: [event()],
      contextItems: [],
      todoNodes: over?.todos ?? [todo()],
      listDate: TODAY,
      reload: h.reload,
      refetchTodos: async () => {},
      showToast: h.showToast,
      askConfirm: async () => over?.confirm ?? true,
      closePopover: h.closePopover,
      closeTodoDetail: h.closeTodoDetail,
      closeEditor: h.closeEditor,
      push: over?.withPush === false ? undefined : h.push,
    }),
  );
  return { ...h, api: () => view.result.current };
}

describe("useItemConversion — Event → Todo", () => {
  it("closes the bubble and the editor only after a yes, and then says it worked", async () => {
    const declined = setup({ confirm: false });
    await act(async () => declined.api().handleConvertToTodo("s-1"));
    expect(declined.closePopover).not.toHaveBeenCalled();
    expect(declined.closeEditor).not.toHaveBeenCalled();

    const h = setup();
    await act(async () => h.api().handleConvertToTodo("s-1"));
    await waitFor(() =>
      expect(h.showToast).toHaveBeenCalledWith(
        "success",
        "itemConvert.toTodoDone",
      ),
    );
    expect(h.closePopover).toHaveBeenCalledTimes(1);
    expect(h.closeEditor).toHaveBeenCalledTimes(1);
    expect(h.closeTodoDetail).not.toHaveBeenCalled();
  });

  it("writes once when the same event is pressed again mid-write (#434)", async () => {
    let land: () => void = () => {};
    const h = setup({
      convertEventToTodo: () =>
        new Promise<void>((resolve) => (land = resolve)),
    });

    await act(async () => h.api().handleConvertToTodo("s-1"));
    await act(async () => h.api().handleConvertToTodo("s-1"));
    expect(h.convertEventToTodo).toHaveBeenCalledTimes(1);

    await act(async () => land());
    await waitFor(() => expect(h.push).toHaveBeenCalledTimes(1));
  });
});

describe("useItemConversion — Todo → Event", () => {
  it("closes the todo detail after a yes and lands an unscheduled todo all-day on the list's day", async () => {
    const h = setup();

    await act(async () => h.api().handleConvertToEvent("task-1"));

    await waitFor(() =>
      expect(h.convertTodoToEvent).toHaveBeenCalledWith("task-1", {
        date: TODAY,
        startTime: "00:00",
        endTime: "00:00",
        isAllDay: true,
      }),
    );
    expect(h.closeTodoDetail).toHaveBeenCalledTimes(1);
    expect(h.closeEditor).not.toHaveBeenCalled();
  });

  it("gives the server's children refusal its own sentence, and pushes nothing", async () => {
    // "Conversion failed" would send the user looking for a network problem.
    vi.spyOn(console, "error").mockImplementation(() => {});
    const h = setup({
      convertTodoToEvent: () =>
        Promise.reject(new ItemConversionError("children", "has children")),
    });

    await act(async () => h.api().handleConvertToEvent("task-1"));

    await waitFor(() =>
      expect(h.showToast).toHaveBeenCalledWith(
        "danger",
        "itemConvert.childrenBlockedServer",
      ),
    );
    expect(h.push).not.toHaveBeenCalled();
  });

  it("labels its command, and redoes onto the slot the first write used", async () => {
    const h = setup({
      todos: [
        todo({
          scheduledAt: `${TODAY}T14:00:00`,
          scheduledEndAt: `${TODAY}T15:30:00`,
        }),
      ],
    });

    await act(async () => h.api().handleConvertToEvent("task-1"));
    await waitFor(() => expect(h.push).toHaveBeenCalledTimes(1));
    const command = h.push.mock.calls[0][1] as {
      label: string;
      undo: () => Promise<void>;
      redo: () => Promise<void>;
    };
    expect(command.label).toBe("convertTodoToEvent");

    await act(async () => command.undo());
    await act(async () => command.redo());

    const [first, again] = h.convertTodoToEvent.mock.calls;
    expect(again).toEqual(first);
  });
});
