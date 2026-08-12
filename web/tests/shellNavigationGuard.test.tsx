import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useShellNavigation } from "../src/hooks/useShellNavigation";

/*
 * #753 — leaving a section unmounts its whole body, draft and all, and the
 * panel inside never sees it coming. So every navigation this hook exposes
 * asks the shell-level guard first (UnsavedGuardProvider, mounted in App.tsx)
 * and only moves once the answer comes back true.
 *
 * Pinned at the hook rather than through MainScreen: the shell needs the entire
 * Provider chain to render, and what can actually break here is the ORDER —
 * a navigation that moved first and asked afterwards, or a pending intent
 * (new-task / "[[" jump) raised even though the move was refused.
 */

beforeEach(() => {
  localStorage.clear();
});

/** A guard the test answers by hand, one navigation at a time. */
function deferredGuard() {
  const answers: ((ok: boolean) => void)[] = [];
  const confirmLeave = vi.fn(
    () => new Promise<boolean>((resolve) => answers.push(resolve)),
  );
  return {
    confirmLeave,
    pending: () => answers.length,
    answer: async (ok: boolean) => {
      const resolve = answers.shift();
      expect(resolve).toBeDefined();
      await act(async () => {
        resolve?.(ok);
      });
    },
  };
}

describe("useShellNavigation — the leave guard (#753)", () => {
  it("navigates straight through with no guard supplied", () => {
    const { result } = renderHook(() => useShellNavigation());
    act(() => result.current.setSection("settings"));
    expect(result.current.section).toBe("settings");
  });

  it("holds the section change until the guard says yes", async () => {
    const guard = deferredGuard();
    const { result } = renderHook(() =>
      useShellNavigation({ confirmLeave: guard.confirmLeave }),
    );
    const before = result.current.section;

    act(() => result.current.setSection("settings"));
    // Asked, and NOT moved: a hook that read the pending promise as a truthy
    // "yes" would already be on the next section with the draft gone.
    expect(guard.confirmLeave).toHaveBeenCalledTimes(1);
    expect(result.current.section).toBe(before);

    await guard.answer(true);
    await waitFor(() => expect(result.current.section).toBe("settings"));
  });

  it("stays put when the discard is refused", async () => {
    const guard = deferredGuard();
    const { result } = renderHook(() =>
      useShellNavigation({ confirmLeave: guard.confirmLeave }),
    );
    const before = result.current.section;

    act(() => result.current.setSection("settings"));
    await guard.answer(false);
    expect(result.current.section).toBe(before);

    // And the next attempt asks again — nothing is remembered from a refusal.
    act(() => result.current.setSection("settings"));
    expect(guard.confirmLeave).toHaveBeenCalledTimes(2);
  });

  it("guards the destination routes too, tab included", async () => {
    const guard = deferredGuard();
    const { result } = renderHook(() =>
      useShellNavigation({ confirmLeave: guard.confirmLeave }),
    );

    act(() =>
      result.current.navigateTo({ section: "materials", tab: "daily" }),
    );
    expect(result.current.materialsTab).toBe("notes");

    await guard.answer(true);
    await waitFor(() => expect(result.current.section).toBe("materials"));
    expect(result.current.materialsTab).toBe("daily");
  });

  it("raises the new-task intent only once the move is agreed", async () => {
    const guard = deferredGuard();
    const { result } = renderHook(() =>
      useShellNavigation({ confirmLeave: guard.confirmLeave }),
    );

    act(() => result.current.handleNewTask());
    // A refused jump that still raised the flag would open the create dialog
    // the next time the user went to Todos of their own accord.
    expect(result.current.pendingNewTask).toBe(false);

    await guard.answer(false);
    expect(result.current.pendingNewTask).toBe(false);

    act(() => result.current.handleNewTask());
    await guard.answer(true);
    await waitFor(() => expect(result.current.pendingNewTask).toBe(true));
    expect(result.current.scheduleTab).toBe("todo");
  });

  it("stashes a '[[' jump only once the move is agreed", async () => {
    const guard = deferredGuard();
    const { result } = renderHook(() =>
      useShellNavigation({ confirmLeave: guard.confirmLeave }),
    );

    act(() => result.current.navigateToItem({ id: "note-1", role: "note" }));
    expect(result.current.pendingNoteSelect).toBeNull();

    await guard.answer(true);
    await waitFor(() =>
      expect(result.current.pendingNoteSelect).toBe("note-1"),
    );
    expect(result.current.section).toBe("materials");
  });

  it("does not ask at all for a role with nowhere to land", () => {
    const guard = deferredGuard();
    const { result } = renderHook(() =>
      useShellNavigation({ confirmLeave: guard.confirmLeave }),
    );

    act(() => result.current.navigateToItem({ id: "x", role: "routine" }));
    expect(guard.confirmLeave).not.toHaveBeenCalled();
  });
});
