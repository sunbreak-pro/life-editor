import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  DAY_START_HOUR_STORAGE_KEY,
  ToastContext,
  WikiTagsUnifiedProvider,
  type DataService,
  type Goal,
  type TodoNode,
} from "@life-editor/shared";
import { createBumpableSync, makeTodo, stubDataService } from "./helpers";
import { useCreatePanelNotes } from "../src/schedule/useCreatePanelNotes";
import { SAMPLE_GOALS } from "../../shared/tests/fixtures/goalLinkState";

/*
 * #2109 — the create panel's goal field, host half. The panel only stages
 * goals; the links are written by `attachNote`, the call the todo create
 * already makes once the new todo's row exists (the FK ordering in
 * useCreatePanelNotes' header). Pinned: the pool is offered only when there
 * are goals (and only to a host that passes its live tree), a staged goal is
 * linked to the saved todo exactly once, a failed link is reported, "this
 * week" follows the day-start hour, and the event path never links goals.
 */

function setup(
  options: {
    goals?: Goal[];
    todos?: readonly TodoNode[] | null;
    linkFails?: boolean;
  } = {},
) {
  const { goals = SAMPLE_GOALS, linkFails = false } = options;
  const todos =
    options.todos === null
      ? undefined
      : (options.todos ?? [makeTodo({ id: "t-free", title: "住民票" })]);
  const linkGoalTodo = vi.fn(async (goalId: string, todoId: string) => {
    if (linkFails) throw new Error("offline");
    return { id: `l-${goalId}-${todoId}`, goalId, todoId, isDeleted: false };
  });
  const fetchGoals = vi.fn(async () => goals);
  const showToast = vi.fn();
  const ds = stubDataService({
    listNotesUnified: vi.fn(async () => []),
    listAllTagAssignments: vi.fn(async () => []),
    fetchGoals,
    fetchGoalTodoLinks: vi.fn(async () => []),
    linkGoalTodo,
    unlinkGoalTodo: vi.fn(async () => {}),
  }) as DataService;
  const { wrapper: Sync } = createBumpableSync();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ToastContext.Provider value={{ showToast }}>
      <Sync>
        <WikiTagsUnifiedProvider dataService={ds}>
          {children}
        </WikiTagsUnifiedProvider>
      </Sync>
    </ToastContext.Provider>
  );
  const onAttachError = vi.fn();
  const hook = renderHook(
    () =>
      useCreatePanelNotes({
        dataService: ds,
        active: true,
        onAttachError,
        todos,
      }),
    { wrapper },
  );
  return { hook, linkGoalTodo, fetchGoals, showToast, onAttachError };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-30T10:00:00"));
});
afterEach(() => {
  vi.useRealTimers();
  localStorage.removeItem(DAY_START_HOUR_STORAGE_KEY);
});

describe("the creation panel's goal field (host)", () => {
  it("links the staged goals to the saved todo, once", async () => {
    const h = setup();
    await waitFor(() => expect(h.hook.result.current.goalPool).toBeDefined());
    const pool = h.hook.result.current.goalPool!;
    expect(pool.goals.map((g) => g.id)).toContain("w-plan");

    act(() => pool.onStagedChange(["w-plan", "w-book"]));
    await act(async () => {
      h.hook.result.current.attachNote("task-new", null);
    });
    expect(h.linkGoalTodo.mock.calls).toEqual([
      ["w-plan", "task-new"],
      ["w-book", "task-new"],
    ]);

    // Consumed: a second todo created in the same opening links nothing.
    await act(async () => {
      h.hook.result.current.attachNote("task-other", null);
    });
    expect(h.linkGoalTodo).toHaveBeenCalledTimes(2);
  });

  it("tells the user when the new todo could not be linked", async () => {
    const h = setup({ linkFails: true });
    await waitFor(() => expect(h.hook.result.current.goalPool).toBeDefined());
    act(() => h.hook.result.current.goalPool!.onStagedChange(["w-plan"]));
    await act(async () => {
      h.hook.result.current.attachNote("task-new", null);
    });
    await waitFor(() =>
      expect(h.showToast).toHaveBeenCalledWith(
        "danger",
        expect.stringContaining("could not be linked to its goals"),
      ),
    );
    // The note toast is a different failure; it stays quiet.
    expect(h.onAttachError).not.toHaveBeenCalled();
  });

  it("counts 'this week' from the day-start hour, as the Briefing does", async () => {
    // Sunday 01:00 with the day starting at 04:00 is still Saturday night:
    // the week on offer is 09-27's, not the new (goal-less) one.
    localStorage.setItem(DAY_START_HOUR_STORAGE_KEY, "4");
    vi.setSystemTime(new Date("2026-10-04T01:00:00"));
    const h = setup();
    await waitFor(() => expect(h.hook.result.current.goalPool).toBeDefined());
    expect(h.hook.result.current.goalPool!.goals.map((g) => g.id)).toContain(
      "w-plan",
    );
  });

  it("never links goals from the event path", async () => {
    const h = setup();
    await waitFor(() => expect(h.hook.result.current.goalPool).toBeDefined());
    act(() => h.hook.result.current.goalPool!.onStagedChange(["w-plan"]));
    await act(async () => {
      await h.hook.result.current.attachNoteAlongside("evt-1", null);
    });
    expect(h.linkGoalTodo).not.toHaveBeenCalled();
  });

  it("offers no pool when there are no goals", async () => {
    const h = setup({ goals: [] });
    await waitFor(() => expect(h.fetchGoals).toHaveBeenCalled());
    await act(async () => {});
    expect(h.hook.result.current.goalPool).toBeUndefined();
  });

  it("reads no goals for a host that does not pass its tree", async () => {
    const h = setup({ todos: null });
    await act(async () => {});
    expect(h.fetchGoals).not.toHaveBeenCalled();
    expect(h.hook.result.current.goalPool).toBeUndefined();
  });
});
