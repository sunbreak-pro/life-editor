import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { act, renderHook } from "@testing-library/react";
import {
  todoChipId,
  type ScheduleItem,
  type TodoNode,
} from "@life-editor/shared";
import type { ScheduleLinkTarget } from "../src/hooks/useShellNavigation";
import {
  LINK_FOCUS_MARK_MS,
  useScheduleLinkFocus,
  type UseScheduleLinkFocusArgs,
} from "../src/schedule/useScheduleLinkFocus";

/*
 * #2393 — where a link lands inside the Schedule: the day, the week view, the
 * mark and its six seconds, the right panel, the toast.
 *
 * At the hook because CalendarTab needs the Provider stack and real layout
 * (rules/frontend.md §テスト環境の制約). That the mark reaches a block is
 * weekTimeGrid.test.
 */

// One object across renders, as the real hook gives: the effects key on `t`.
const translation = vi.hoisted(() => ({
  t: (key: string, opts?: { title?: string }) =>
    opts?.title ? `${key}:${opts.title}` : key,
  i18n: { language: "en" },
}));

vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@life-editor/shared")>()),
  useTranslation: () => translation,
}));

function todo(over: Partial<TodoNode> & { id: string }): TodoNode {
  return { title: "Roof", ...over } as TodoNode;
}

const DATED = todo({
  id: "t-dated",
  scheduledAt: "2026-11-03T09:00:00+09:00",
  scheduledEndAt: "2026-11-03T10:00:00+09:00",
});
const DAYLESS = todo({ id: "t-dayless", title: "Someday", content: "A memo" });
const EVENT = {
  id: "e1",
  title: "Dentist",
  date: "2026-11-03",
} as ScheduleItem;

function setup(
  initial: Partial<UseScheduleLinkFocusArgs> & {
    target?: ScheduleLinkTarget | null;
  } = {},
) {
  const args = {
    target: null,
    onConsume: vi.fn(),
    isWide: true,
    todoNodes: [DATED, DAYLESS],
    todosLoading: false,
    rangeItems: [] as ScheduleItem[],
    dataService: { fetchEvents: vi.fn(() => Promise.resolve([EVENT])) },
    showToast: vi.fn(),
    revealOnGrid: vi.fn(),
    setAnchorDate: vi.fn(),
    setView: vi.fn(),
    setSelectedId: vi.fn(),
    setSidebarTab: vi.fn(),
    openSidebar: vi.fn(),
    setPopover: vi.fn(),
    setOverlayOpen: vi.fn(),
    setTodoDetailId: vi.fn(),
    ...initial,
  } satisfies UseScheduleLinkFocusArgs;
  // The shell's half: consuming clears the pending intent.
  const hook = renderHook(
    (props: UseScheduleLinkFocusArgs) => {
      const [consumed, setConsumed] = useState<ScheduleLinkTarget | null>(null);
      return useScheduleLinkFocus({
        ...props,
        target: props.target === consumed ? null : props.target,
        onConsume: () => {
          args.onConsume();
          setConsumed(props.target);
        },
      });
    },
    { initialProps: args as UseScheduleLinkFocusArgs },
  );
  let current: UseScheduleLinkFocusArgs = args;
  return {
    ...hook,
    args,
    update: (next: Partial<UseScheduleLinkFocusArgs>) => {
      current = { ...current, ...next };
      hook.rerender(current);
    },
  };
}

beforeEach(() => {
  // Only the clock: act() needs its own scheduling to settle a promise.
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("a todo with a day (#2393)", () => {
  const target: ScheduleLinkTarget = { id: "t-dated", role: "task" };

  it("moves to its day on the week view, without the caller's date", () => {
    const { args, result } = setup({ target });
    expect(args.setAnchorDate).toHaveBeenCalledWith("2026-11-03");
    expect(args.setView).toHaveBeenCalledWith("week");
    expect(args.revealOnGrid).toHaveBeenCalled();
    expect(result.current.markedId).toBe(todoChipId("t-dated"));
  });

  it("shows it in the right panel's Todo tab too", () => {
    const { args, result } = setup({ target });
    expect(args.setSidebarTab).toHaveBeenCalledWith("todo");
    expect(args.openSidebar).toHaveBeenCalled();
    expect(result.current.todoFocus?.todo.title).toBe("Roof");
  });

  it("does not open the todo overlay, and closes one already open", () => {
    // A "[[" pressed inside a todo's own detail arrives with that detail up.
    const { args } = setup({ target });
    expect(args.setTodoDetailId).toHaveBeenCalledTimes(1);
    expect(args.setTodoDetailId).toHaveBeenCalledWith(null);
  });

  it("says it framed the todo", () => {
    const { args } = setup({ target });
    expect(args.showToast).toHaveBeenCalledExactlyOnceWith(
      "info",
      "scheduleScreen.linkFocusTodoMarked:Roof",
    );
  });

  it("consumes the intent once", () => {
    const { args } = setup({ target });
    expect(args.onConsume).toHaveBeenCalledTimes(1);
  });
});

describe("a todo with no day (#2393)", () => {
  const target: ScheduleLinkTarget = { id: "t-dayless", role: "task" };

  it("appears in the right panel only", () => {
    const { args, result } = setup({ target });
    expect(args.setSidebarTab).toHaveBeenCalledWith("todo");
    expect(args.openSidebar).toHaveBeenCalled();
    expect(result.current.todoFocus?.todo.title).toBe("Someday");
    expect(result.current.todoFocus?.todo.excerpt).toBe("A memo");
    expect(result.current.markedId).toBe(null);
    expect(args.setAnchorDate).not.toHaveBeenCalled();
    expect(args.setView).not.toHaveBeenCalled();
  });

  it("says it is in the panel", () => {
    const { args } = setup({ target });
    expect(args.showToast).toHaveBeenCalledExactlyOnceWith(
      "info",
      "scheduleScreen.linkFocusTodoInPanel:Someday",
    );
  });

  it("names the card's two actions", () => {
    const { args, result } = setup({ target });
    vi.mocked(args.setTodoDetailId).mockClear();
    act(() => result.current.todoFocus?.onOpen());
    expect(args.setTodoDetailId).toHaveBeenCalledWith("t-dayless");
    act(() => result.current.todoFocus?.onDismiss());
    expect(result.current.todoFocus).toBe(null);
  });
});

describe("waiting for the tree (#2393)", () => {
  const target: ScheduleLinkTarget = { id: "t-dated", role: "task" };

  it("holds the intent while the tree loads", () => {
    const { args, update, result } = setup({
      target,
      todoNodes: [],
      todosLoading: true,
    });
    expect(args.onConsume).not.toHaveBeenCalled();
    update({ todoNodes: [DATED], todosLoading: false });
    expect(args.onConsume).toHaveBeenCalledTimes(1);
    expect(result.current.markedId).toBe(todoChipId("t-dated"));
  });

  it("holds it through the empty first render of a replayed snapshot", () => {
    // #2328: not loading from the first render, with the rows a pass behind.
    const { args, update, result } = setup({ target, todoNodes: [] });
    expect(args.onConsume).not.toHaveBeenCalled();
    update({ todoNodes: [DATED] });
    expect(result.current.markedId).toBe(todoChipId("t-dated"));
  });

  it("lands on the section with nothing to show for a todo that is gone", () => {
    const { args, result } = setup({
      target: { id: "t-gone", role: "task" },
    });
    expect(args.onConsume).toHaveBeenCalledTimes(1);
    expect(result.current.markedId).toBe(null);
    expect(result.current.todoFocus).toBe(null);
    expect(args.showToast).not.toHaveBeenCalled();
  });
});

describe("the mark's six seconds (#2393)", () => {
  const target: ScheduleLinkTarget = { id: "t-dated", role: "task" };

  it("comes off after six seconds and not before", () => {
    const { result } = setup({ target });
    expect(LINK_FOCUS_MARK_MS).toBe(6000);
    act(() => vi.advanceTimersByTime(5999));
    expect(result.current.markedId).toBe(todoChipId("t-dated"));
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.markedId).toBe(null);
  });

  it("gives a second link its whole six seconds", () => {
    const { result, update } = setup({ target });
    act(() => vi.advanceTimersByTime(5000));
    update({ target: { id: "e1", role: "event", date: "2026-11-03" } });
    update({ rangeItems: [EVENT] });
    expect(result.current.markedId).toBe("e1");
    act(() => vi.advanceTimersByTime(5999));
    expect(result.current.markedId).toBe("e1");
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.markedId).toBe(null);
  });

  it("leaves no timer behind on unmount", () => {
    const { unmount } = setup({ target });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("an event (#2393)", () => {
  const dated: ScheduleLinkTarget = {
    id: "e1",
    role: "event",
    date: "2026-11-03",
  };

  it("moves to the caller's day on the week view and selects it", () => {
    const { args } = setup({ target: dated });
    expect(args.onConsume).toHaveBeenCalledTimes(1);
    expect(args.setAnchorDate).toHaveBeenCalledWith("2026-11-03");
    expect(args.setView).toHaveBeenCalledWith("week");
    expect(args.setSelectedId).toHaveBeenLastCalledWith("e1");
    expect(args.dataService.fetchEvents).not.toHaveBeenCalled();
  });

  it("marks it and toasts once its row lands, not before", () => {
    const { args, result, update } = setup({ target: dated });
    expect(result.current.markedId).toBe(null);
    expect(args.showToast).not.toHaveBeenCalled();
    update({ rangeItems: [EVENT] });
    expect(result.current.markedId).toBe("e1");
    expect(args.showToast).toHaveBeenCalledExactlyOnceWith(
      "info",
      "scheduleScreen.linkFocusEventMarked:Dentist",
    );
    // The six seconds count from there.
    act(() => vi.advanceTimersByTime(5999));
    expect(result.current.markedId).toBe("e1");
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.markedId).toBe(null);
  });

  it("does not touch the panel", () => {
    const { args } = setup({ target: dated });
    expect(args.setSidebarTab).not.toHaveBeenCalled();
    expect(args.openSidebar).not.toHaveBeenCalled();
  });

  it("looks up the day when the caller has only an id and a role", async () => {
    const { args } = setup({ target: { id: "e1", role: "event" } });
    expect(args.dataService.fetchEvents).toHaveBeenCalledTimes(1);
    await act(async () => {
      await Promise.resolve();
    });
    expect(args.setAnchorDate).toHaveBeenCalledWith("2026-11-03");
    expect(args.setSelectedId).toHaveBeenLastCalledWith("e1");
  });

  it("stays put when the lookup finds nothing", async () => {
    const { args } = setup({ target: { id: "e-gone", role: "event" } });
    await act(async () => {
      await Promise.resolve();
    });
    expect(args.setAnchorDate).not.toHaveBeenCalled();
  });

  it("lets a later link beat a slow lookup", async () => {
    let answer: (rows: ScheduleItem[]) => void = () => {};
    const { args, update } = setup({
      target: { id: "e1", role: "event" },
      dataService: {
        fetchEvents: vi.fn(
          () =>
            new Promise<ScheduleItem[]>((resolve) => {
              answer = resolve;
            }),
        ),
      },
    });
    update({ target: { id: "t-dated", role: "task" } });
    const moves = vi.mocked(args.setAnchorDate).mock.calls.length;
    await act(async () => {
      answer([{ ...EVENT, date: "2027-01-01" }]);
      await Promise.resolve();
    });
    expect(vi.mocked(args.setAnchorDate).mock.calls.length).toBe(moves);
  });
});

describe("on a phone, where there is no week grid (#2393)", () => {
  it("moves a todo's day and opens the drawer, with no frame to claim", () => {
    const { args, result } = setup({
      isWide: false,
      target: { id: "t-dated", role: "task" },
    });
    expect(args.setAnchorDate).toHaveBeenCalledWith("2026-11-03");
    expect(args.setView).not.toHaveBeenCalled();
    expect(args.openSidebar).toHaveBeenCalled();
    expect(result.current.markedId).toBe(null);
    expect(args.showToast).toHaveBeenCalledExactlyOnceWith(
      "info",
      "scheduleScreen.linkFocusTodoInPanel:Roof",
    );
  });

  it("opens an event's sheet through the selection, with no toast", () => {
    const { args, result, update } = setup({
      isWide: false,
      target: { id: "e1", role: "event", date: "2026-11-03" },
    });
    expect(args.setAnchorDate).toHaveBeenCalledWith("2026-11-03");
    expect(args.setSelectedId).toHaveBeenLastCalledWith("e1");
    expect(args.setView).not.toHaveBeenCalled();
    update({ rangeItems: [EVENT] });
    expect(result.current.markedId).toBe(null);
    expect(args.showToast).not.toHaveBeenCalled();
  });
});
