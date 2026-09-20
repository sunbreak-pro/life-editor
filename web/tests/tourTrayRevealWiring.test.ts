import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { TOUR_REVEALS } from "@life-editor/shared";
import { useShellNavigation } from "../src/hooks/useShellNavigation";

/*
 * #1773 — the host half of "resume lands on the tray".
 *
 * Shared decides WHAT has to be open (`TourStep.reveal`) and this side decides
 * whether it opens. The shared suite (tourResumeTodoTray.test.tsx) models the
 * host at its seam, so it stays green against a web host that never learned
 * the new name — which is the failure this Issue already shipped once, in the
 * other direction: #1748 taught the panel and nobody noticed the tab was a
 * second fact.
 *
 * Two halves, pinned where each can actually be observed:
 *
 *   - the INTENT is a real hook, so it is rendered and driven. What matters is
 *     that it raises the flag WITHOUT going through the leave guard: the tour
 *     asks only once it is already standing in Schedule, and routing this
 *     through a navigation would put a "discard your draft?" dialog in front
 *     of a user who is not going anywhere;
 *   - the WIRING is asserted on source text, because AppProviders' reveal
 *     handler only fires from inside a running tour and MainScreen needs the
 *     whole Provider chain to mount (rules/frontend.md §テスト環境の制約 —
 *     the same escape hatch scheduleTourTodos.test.tsx takes). Both files
 *     compile perfectly well with the callback dropped; the tour just stops
 *     restoring the tab, silently.
 */

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) =>
  readFileSync(resolve(here, rel), "utf8").replace(/\r\n/g, "\n");

const providersSource = read("../src/AppProviders.tsx");
const mainScreenSource = read("../src/MainScreen.tsx");

beforeEach(() => {
  localStorage.clear();
});

describe("the todo-tray intent the tour raises (#1773)", () => {
  it("asks for the tray without navigating", () => {
    const { result } = renderHook(() => useShellNavigation());
    const before = result.current.section;

    act(() => result.current.requestTodoTray());

    expect(result.current.pendingTodoTray).toBe(true);
    expect(result.current.section).toBe(before);
  });

  it("does not wait on the leave guard", () => {
    // A guard that never answers. `handleNavigate("nav:tasks")` would hang
    // here — which is right for a navigation and wrong for this, since no
    // section is being left.
    const confirmLeave = vi.fn(() => new Promise<boolean>(() => undefined));
    const { result } = renderHook(() => useShellNavigation({ confirmLeave }));

    act(() => result.current.requestTodoTray());

    expect(result.current.pendingTodoTray).toBe(true);
    expect(confirmLeave).not.toHaveBeenCalled();
  });

  it("is still consumed once, like the binding that shares the flag", () => {
    const { result } = renderHook(() => useShellNavigation());

    act(() => result.current.requestTodoTray());
    act(() => result.current.consumeTodoTray());

    expect(result.current.pendingTodoTray).toBe(false);
  });
});

describe("the reveal wiring (#1773)", () => {
  it("honours the tray's own name in the tour reveal host", () => {
    expect(providersSource).toMatch(
      /TOUR_REVEALS\.scheduleTodoTray[\s\S]{0,200}onRevealTodoTray\?\.\(\)/,
    );
    // The name exists on the shared side it is compared against.
    expect(TOUR_REVEALS.scheduleTodoTray).toBe("schedule-todo-tray");
  });

  it("keeps the narrow stand-down over both names", () => {
    // The drawer paints at z-50 over the z-45 bubble (#1748), and which tab is
    // underneath it does not change that. The guard therefore has to sit ahead
    // of the branch rather than inside the panel-only arm.
    expect(providersSource).toMatch(
      /if \(!isWide\) return;[\s\S]{0,120}TOUR_REVEALS\.detailPanel/,
    );
  });

  it("hands the intent down from the screen that owns it", () => {
    expect(mainScreenSource).toContain(
      "onRevealTodoTray={nav.requestTodoTray}",
    );
  });
});
