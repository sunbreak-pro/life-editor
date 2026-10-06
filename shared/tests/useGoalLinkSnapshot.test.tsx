import { describe, it, expect, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useGoalLinkSnapshot } from "../src/components/briefing/useGoalLinkSnapshot";
import type { GoalTodoLink } from "../src/types/goal";
import { createBumpableSync } from "./helpers/bumpableSync";
import { stubDataService } from "./helpers/dataServiceStub";
import { makeTodo } from "./helpers/nodeFixtures";
import { SAMPLE_GOALS } from "./fixtures/goalLinkState";

/*
 * #2109 — a read that was in flight when a write started returns the links
 * from before it. Pinned: that stale read does not wipe the write off the
 * screen, and the end of the write reads once more so the screen catches up.
 */

const link = (goalId: string, todoId: string): GoalTodoLink => ({
  id: `l-${goalId}-${todoId}`,
  goalId,
  todoId,
  isDeleted: false,
});

describe("useGoalLinkSnapshot", () => {
  it("drops a read that started before a write, then reads again", async () => {
    const saved: GoalTodoLink[] = [];
    let releaseStale: () => void = () => {};
    let call = 0;
    const fetchGoalTodoLinks = vi.fn(() => {
      call += 1;
      const snapshot = [...saved];
      // The second read (the one the bump starts) is held back.
      if (call !== 2) return Promise.resolve(snapshot);
      return new Promise<GoalTodoLink[]>((resolve) => {
        releaseStale = () => resolve(snapshot);
      });
    });
    const loader = stubDataService({
      fetchGoals: vi.fn(async () => SAMPLE_GOALS),
      fetchGoalTodoLinks,
      linkGoalTodo: vi.fn(async (goalId: string, todoId: string) => {
        saved.push(link(goalId, todoId));
        return link(goalId, todoId);
      }),
      unlinkGoalTodo: vi.fn(async () => {}),
    });
    const todos = [makeTodo({ id: "t-free" })];
    const { wrapper, sync } = createBumpableSync();
    const { result } = renderHook(
      () => useGoalLinkSnapshot(loader, { active: true, todos }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.state).not.toBeNull());

    act(() => sync.bump("goals"));
    await waitFor(() => expect(fetchGoalTodoLinks).toHaveBeenCalledTimes(2));
    await act(async () => {
      await result.current.writeLinks(
        [{ goalId: "w-plan", todoId: "t-free" }],
        [],
      );
    });
    await act(async () => {
      releaseStale();
    });

    const linked = () =>
      result.current.state?.links.some(
        (l) => l.goalId === "w-plan" && l.todoId === "t-free",
      );
    expect(linked()).toBe(true);
    await waitFor(() => expect(fetchGoalTodoLinks).toHaveBeenCalledTimes(3));
    expect(linked()).toBe(true);
  });
});
