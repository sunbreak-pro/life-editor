import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, renderHook } from "@testing-library/react";
import type { ReactElement } from "react";
import { useShellNavigation } from "../src/hooks/useShellNavigation";
import { SECTION_DESCRIPTORS } from "../src/sectionDescriptors";
import { OpenInScheduleButton } from "../src/schedule/OpenInScheduleButton";
import { itemOpenAction } from "../src/schedule/itemOpenAction";
import { useScheduleShellIntents } from "../src/schedule/useScheduleShellIntents";
import { stubDataService } from "./helpers";

/*
 * #2393 — a link lands on the right screen for its kind, and a todo or event
 * from a link takes a different road from every other caller.
 *
 * Pinned at the shell hook and the descriptor rows, like connectItemReturn.test:
 * MainScreen needs a session and the whole Provider chain. What Schedule does
 * with the intent is useScheduleLinkFocus.test.
 */

beforeEach(() => {
  localStorage.clear();
});

describe("where each kind of link lands (#2393)", () => {
  it("opens a note on the notes tab", () => {
    const { result } = renderHook(() => useShellNavigation());
    act(() => result.current.navigateToLinkedItem({ id: "n1", role: "note" }));
    expect(result.current.section).toBe("materials");
    expect(result.current.materialsTab).toBe("notes");
    expect(result.current.pendingNoteSelect).toBe("n1");
    expect(result.current.pendingLinkFocus).toBe(null);
  });

  it("opens a daily on the daily tab, not on the Schedule", () => {
    const { result } = renderHook(() => useShellNavigation());
    act(() =>
      result.current.navigateToLinkedItem({
        id: "daily-2026-07-29",
        role: "daily",
      }),
    );
    expect(result.current.section).toBe("materials");
    expect(result.current.materialsTab).toBe("daily");
    expect(result.current.pendingDailySelect).toBe("2026-07-29");
  });

  it("sends a todo to the Schedule without asking for its overlay", () => {
    const { result } = renderHook(() => useShellNavigation());
    act(() => result.current.navigateToLinkedItem({ id: "t1", role: "task" }));
    expect(result.current.section).toBe("schedule");
    expect(result.current.pendingLinkFocus).toEqual({
      id: "t1",
      role: "task",
    });
    expect(result.current.pendingTodoSelect).toBe(null);
  });

  it("sends an event with its date when the chip knows it", () => {
    // PR #2417's chip passes the date; the inline "[[" click does not.
    const { result } = renderHook(() => useShellNavigation());
    act(() =>
      result.current.navigateToLinkedItem({
        id: "e1",
        role: "event",
        date: "2026-11-03",
      }),
    );
    expect(result.current.section).toBe("schedule");
    expect(result.current.pendingLinkFocus).toEqual({
      id: "e1",
      role: "event",
      date: "2026-11-03",
    });
    expect(result.current.pendingEventSelect).toBe(null);
  });

  it("sends an event with no date on too, for Schedule to look up", () => {
    const { result } = renderHook(() => useShellNavigation());
    act(() => result.current.navigateToLinkedItem({ id: "e1", role: "event" }));
    expect(result.current.pendingLinkFocus).toEqual({
      id: "e1",
      role: "event",
    });
  });

  it("consumes the intent once", () => {
    const { result } = renderHook(() => useShellNavigation());
    act(() => result.current.navigateToLinkedItem({ id: "t1", role: "task" }));
    act(() => result.current.consumeItemNav());
    expect(result.current.pendingLinkFocus).toBe(null);
  });

  it("no-ops on a role with nowhere to open", () => {
    const { result } = renderHook(() => useShellNavigation());
    const before = result.current.section;
    act(() =>
      result.current.navigateToLinkedItem({ id: "x", role: "routine" }),
    );
    expect(result.current.section).toBe(before);
    expect(result.current.pendingLinkFocus).toBe(null);
  });

  it("raises nothing when the leave guard refuses", async () => {
    const { result } = renderHook(() =>
      useShellNavigation({ confirmLeave: () => Promise.resolve(false) }),
    );
    await act(async () =>
      result.current.navigateToLinkedItem({ id: "t1", role: "task" }),
    );
    expect(result.current.pendingLinkFocus).toBe(null);
  });
});

describe("the callers that keep the overlay (#2393)", () => {
  it("keeps Connect's returning jump on the todo overlay", () => {
    const { result } = renderHook(() => useShellNavigation());
    act(() => result.current.setSection("connect"));
    act(() =>
      result.current.navigateToItemWithReturn({ id: "t1", role: "task" }),
    );
    expect(result.current.section).toBe("schedule");
    expect(result.current.pendingTodoSelect).toBe("t1");
    expect(result.current.pendingLinkFocus).toBe(null);

    // And closing that overlay still goes back, which is why it has to stay.
    act(() => result.current.returnFromItem("t1"));
    expect(result.current.section).toBe("connect");
  });

  it("keeps Connect's event on the plain select", () => {
    const { result } = renderHook(() => useShellNavigation());
    act(() =>
      result.current.navigateToItemWithReturn({
        id: "e1",
        role: "event",
        date: "2026-11-03",
      }),
    );
    expect(result.current.pendingEventSelect).toEqual({
      id: "e1",
      date: "2026-11-03",
    });
    expect(result.current.pendingLinkFocus).toBe(null);
  });

  it("keeps the plain navigateToItem (Briefing, palette) on the overlay", () => {
    const { result } = renderHook(() => useShellNavigation());
    act(() => result.current.navigateToItem({ id: "t1", role: "task" }));
    expect(result.current.pendingTodoSelect).toBe("t1");
    expect(result.current.pendingLinkFocus).toBe(null);
  });

  it("opens the overlay for that intent and leaves the panel alone", () => {
    const setTodoDetailId = vi.fn();
    const setSidebarTab = vi.fn();
    const setAnchorDate = vi.fn();
    renderHook(() =>
      useScheduleShellIntents(
        {
          pendingNewTodo: false,
          pendingSelectTodoId: "t1",
          pendingTodoTray: false,
        },
        {
          revealOnGrid: vi.fn(),
          setAnchorDate,
          setSelectedId: vi.fn(),
          setSidebarTab,
          openSidebar: vi.fn(),
          setTodoDetailId,
        },
      ),
    );
    expect(setTodoDetailId).toHaveBeenCalledWith("t1");
    expect(setSidebarTab).not.toHaveBeenCalled();
    expect(setAnchorDate).not.toHaveBeenCalled();
  });
});

describe("which section gets which jump (#2393)", () => {
  /** Walks a descriptor's single-child Provider chain down to its screen. */
  function screenOf(
    section: "schedule" | "materials",
    nav: ReturnType<typeof useShellNavigation>,
  ) {
    let el = SECTION_DESCRIPTORS[section].body({
      ds: stubDataService(),
      nav,
      narrowTabRow: undefined,
      loadingFallback: null,
    }) as ReactElement<{ children?: unknown; onNavigateToItem?: unknown }>;
    while (el.props.onNavigateToItem === undefined && el.props.children) {
      const { children } = el.props;
      el = (
        Array.isArray(children) ? children.find(Boolean) : children
      ) as typeof el;
    }
    return el;
  }

  it("gives the two editors and a todo's body the link's jump", () => {
    const { result } = renderHook(() => useShellNavigation());
    expect(screenOf("materials", result.current).props.onNavigateToItem).toBe(
      result.current.navigateToLinkedItem,
    );
    act(() => result.current.setMaterialsTab("daily"));
    expect(screenOf("materials", result.current).props.onNavigateToItem).toBe(
      result.current.navigateToLinkedItem,
    );
    expect(screenOf("schedule", result.current).props.onNavigateToItem).toBe(
      result.current.navigateToLinkedItem,
    );
  });

  it("gives the Briefing the plain one", () => {
    const { result } = renderHook(() => useShellNavigation());
    const el = SECTION_DESCRIPTORS.briefing.body({
      ds: stubDataService(),
      nav: result.current,
      narrowTabRow: undefined,
      loadingFallback: null,
    }) as ReactElement<{ onNavigateToItem?: unknown }>;
    expect(el.props.onNavigateToItem).toBe(result.current.navigateToItem);
  });

  it("hands Schedule the link's intent and its consume", () => {
    const { result } = renderHook(() => useShellNavigation());
    const el = screenOf("schedule", result.current) as ReactElement<{
      onConsumeLinkFocus?: unknown;
    }>;
    expect(el.props.onConsumeLinkFocus).toBe(result.current.consumeItemNav);
  });
});

describe("the wiring inside the Schedule (#2393)", () => {
  // Source text, like tourTrayRevealWiring.test: CalendarTab needs the Provider
  // stack and real layout, and an optional prop dropped along the way compiles.
  const here = dirname(fileURLToPath(import.meta.url));
  const read = (rel: string) =>
    readFileSync(resolve(here, rel), "utf8").replace(/\r\n/g, "\n");

  it("hands the intent down from the screen to the hook", () => {
    expect(read("../src/schedule/ScheduleScreen.tsx")).toContain(
      "pendingLinkFocus={pendingLinkFocus}",
    );
    expect(read("../src/schedule/CalendarTab.tsx")).toContain(
      "target: pendingLinkFocus,",
    );
  });

  it("hands the hook's answer to the grid and the panel", () => {
    const tab = read("../src/schedule/CalendarTab.tsx");
    expect(tab).toContain("markedId,\n            nowMinutes,");
    expect(tab).toContain("focus: todoFocus,");
    expect(read("../src/schedule/CalendarDesktopLayout.tsx")).toContain(
      "markedId: data.markedId,",
    );
  });
});

describe("what the open button says (#2393)", () => {
  it.each(["task", "event"])("says 予定で見る for a %s", (role) => {
    expect(itemOpenAction(role)?.labelKey).toBe(
      "scheduleScreen.openInSchedule",
    );
  });

  it.each(["note", "daily"])("says 開く for a %s", (role) => {
    expect(itemOpenAction(role)?.labelKey).toBe("materials.links.openAction");
  });

  it("has nothing for a role a link cannot open", () => {
    expect(itemOpenAction("routine")).toBe(null);
  });

  it("draws the magnifying calendar on the Schedule button", () => {
    const { container } = render(
      <OpenInScheduleButton label="View" onPress={vi.fn()} />,
    );
    expect(container.querySelector("svg.lucide-calendar-search")).not.toBe(
      null,
    );
  });
});
