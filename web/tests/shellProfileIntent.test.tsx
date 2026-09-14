import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useShellNavigation } from "../src/hooks/useShellNavigation";

/*
 * #1624 — the sidebar's account row opens Settings on its Profile category.
 *
 * The category is SettingsScreen's own local state, so the shell cannot set
 * it; it raises an intent the screen consumes, the same idiom as the todo
 * intents (#1153). Pinned at the hook for the same reason those are:
 * MainScreen needs the whole Provider chain to render, and what breaks here is
 * which flag is raised, not what it draws.
 */

beforeEach(() => {
  localStorage.clear();
});

describe("shell profile intent (#1624)", () => {
  it("lands on Settings AND asks for the Profile category", () => {
    const { result } = renderHook(() => useShellNavigation());

    act(() => result.current.openProfile());

    expect(result.current.section).toBe("settings");
    expect(result.current.pendingProfile).toBe(true);
  });

  it("consumes the intent once", () => {
    // A flag left standing would drag every later visit to Settings back to
    // Profile, whichever category the user was actually after.
    const { result } = renderHook(() => useShellNavigation());

    act(() => result.current.openProfile());
    act(() => result.current.consumeProfile());

    expect(result.current.pendingProfile).toBe(false);
  });

  it("raises nothing when the guard refuses the move", async () => {
    const { result } = renderHook(() =>
      useShellNavigation({ confirmLeave: () => Promise.resolve(false) }),
    );
    const before = result.current.section;

    await act(async () => {
      result.current.openProfile();
      await Promise.resolve();
    });

    expect(result.current.section).toBe(before);
    expect(result.current.pendingProfile).toBe(false);
  });
});
