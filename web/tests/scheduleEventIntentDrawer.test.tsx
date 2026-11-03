import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  useScheduleShellIntents,
  type ScheduleShellIntentTargets,
} from "../src/schedule/useScheduleShellIntents";

/*
 * #2506 — "open this event" closes narrow's drawer.
 *
 * The right sidebar's open state lives in the shell, above the section switch,
 * so a drawer opened on the evening paper is still open when its「この日の予定へ
 * 移動」lands on the Schedule. On narrow that drawer covers the whole screen:
 * the day the user asked for was selected underneath it and stayed hidden
 * after the detail was dismissed. Desktop's panel sits beside the grid and is
 * left as it was.
 *
 * Pinned at the hook, which is where the intent is consumed; CalendarTab only
 * hands it `isWide` and the sidebar's programmatic `close`.
 */

function targets(isWide: boolean) {
  return {
    revealOnGrid: vi.fn(),
    setAnchorDate: vi.fn(),
    setSelectedId: vi.fn(),
    setSidebarTab: vi.fn(),
    openSidebar: vi.fn(),
    closeSidebar: vi.fn(),
    isWide,
    setTodoDetailId: vi.fn(),
  } satisfies ScheduleShellIntentTargets;
}

const noOtherIntents = {
  pendingNewTodo: false,
  pendingSelectTodoId: null,
  pendingTodoTray: false,
};

describe("pendingSelectEvent and the sidebar (#2506)", () => {
  it("closes the drawer on narrow and still lands on the day", () => {
    const t = targets(false);
    const consumed = vi.fn();

    renderHook(() =>
      useScheduleShellIntents(
        {
          ...noOtherIntents,
          pendingSelectEvent: { id: "si-1", date: "2026-11-03" },
          onConsumePendingEvent: consumed,
        },
        t,
      ),
    );

    expect(t.closeSidebar).toHaveBeenCalledTimes(1);
    // The existing half of the intent is unchanged: the day is put in the
    // window and the row is selected.
    expect(t.setAnchorDate).toHaveBeenCalledWith("2026-11-03");
    expect(t.setSelectedId).toHaveBeenCalledWith("si-1");
    expect(t.openSidebar).not.toHaveBeenCalled();
    expect(consumed).toHaveBeenCalledTimes(1);
  });

  it("leaves Desktop's panel alone", () => {
    const t = targets(true);

    renderHook(() =>
      useScheduleShellIntents(
        {
          ...noOtherIntents,
          pendingSelectEvent: { id: "si-1", date: "2026-11-03" },
          onConsumePendingEvent: vi.fn(),
        },
        t,
      ),
    );

    expect(t.closeSidebar).not.toHaveBeenCalled();
    expect(t.setAnchorDate).toHaveBeenCalledWith("2026-11-03");
    expect(t.setSelectedId).toHaveBeenCalledWith("si-1");
  });

  it("does not touch the drawer when no event is asked for", () => {
    const t = targets(false);

    renderHook(() =>
      useScheduleShellIntents(
        { ...noOtherIntents, pendingSelectEvent: null },
        t,
      ),
    );

    expect(t.closeSidebar).not.toHaveBeenCalled();
    expect(t.setSelectedId).not.toHaveBeenCalled();
  });

  it("survives a host with no sidebar Provider", () => {
    const t = { ...targets(false), closeSidebar: undefined };

    expect(() =>
      renderHook(() =>
        useScheduleShellIntents(
          {
            ...noOtherIntents,
            pendingSelectEvent: { id: "si-1", date: "2026-11-03" },
          },
          t,
        ),
      ),
    ).not.toThrow();
    expect(t.setSelectedId).toHaveBeenCalledWith("si-1");
  });
});
