import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useShellNavigation } from "../src/hooks/useShellNavigation";

/*
 * #1153 — the three ways the shell asks for a todo, now that Schedule has no
 * Todo tab to switch to.
 *
 * Each used to be a tab set: `applyDestination` put `scheduleTab` on "todo"
 * and the Kanban read it on mount. The tray that replaced the board is a
 * SIDEBAR tab the Schedule section owns, and shell state cannot address a
 * right-hand drawer — so what used to be a destination is an intent the
 * section consumes. That swap is the whole surface under test here: a
 * destination that quietly lost its second half looks identical from
 * everywhere else (the section is right, the todo is simply never shown).
 *
 * Pinned at the hook. MainScreen needs the entire Provider chain to render,
 * and what breaks here is which flag is raised, not what it draws.
 */

beforeEach(() => {
  localStorage.clear();
});

describe("shell todo intents (#1153)", () => {
  it("lands nav:tasks on Schedule AND asks for the tray", () => {
    const { result } = renderHook(() => useShellNavigation());

    act(() => result.current.handleNavigate("nav:tasks"));

    expect(result.current.section).toBe("schedule");
    // Without the flag this binding is indistinguishable from nav:schedule —
    // both would open the calendar and the user's "go to my todos" would land
    // somewhere else entirely.
    expect(result.current.pendingTodoTray).toBe(true);
  });

  it("leaves nav:schedule on the calendar", () => {
    const { result } = renderHook(() => useShellNavigation());

    act(() => result.current.handleNavigate("nav:schedule"));

    expect(result.current.section).toBe("schedule");
    expect(result.current.pendingTodoTray).toBe(false);
  });

  it("consumes the tray intent once", () => {
    // A flag left standing re-opens the drawer every time the user comes back
    // to Schedule by any other route.
    const { result } = renderHook(() => useShellNavigation());

    act(() => result.current.handleNavigate("nav:tasks"));
    act(() => result.current.consumeTodoTray());

    expect(result.current.pendingTodoTray).toBe(false);
  });

  it("sends global:new-task to Schedule with the create intent", () => {
    const { result } = renderHook(() => useShellNavigation());

    act(() => result.current.handleNewTodo());

    expect(result.current.section).toBe("schedule");
    expect(result.current.pendingNewTodo).toBe(true);
  });

  it("lands a '[[' task link on Schedule with the todo stashed", () => {
    // #370 / #507. The destination lost its tab, so the todo id is the only
    // thing left saying WHICH todo to open — the section alone would drop the
    // click on the floor.
    const { result } = renderHook(() => useShellNavigation());

    act(() => result.current.navigateToItem({ id: "task-7", role: "task" }));

    expect(result.current.section).toBe("schedule");
    expect(result.current.pendingTodoSelect).toBe("task-7");
  });

  it("still lands a '[[' event link on Schedule", () => {
    const { result } = renderHook(() => useShellNavigation());

    act(() => result.current.navigateToItem({ id: "si-3", role: "event" }));

    expect(result.current.section).toBe("schedule");
    expect(result.current.pendingTodoSelect).toBe(null);
  });
});
