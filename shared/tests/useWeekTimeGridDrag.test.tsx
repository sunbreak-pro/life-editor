import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  useWeekTimeGridDrag,
  type WeekTimeGridDragMode,
} from "../src/components/schedule/useWeekTimeGridDrag";
import type { WeekTimeGridItem } from "../src/components/schedule/WeekTimeGrid";

/*
 * WeekTimeGrid's pointer machinery, pulled out of the component in the #675
 * split.
 *
 * weekTimeGrid.test.tsx already drives the whole gesture end to end (it stubs
 * the rects jsdom reports as zero) and stays the guard for what a completed
 * drag WRITES. What it cannot say cleanly is which pointer-downs are refused
 * before a drag ever begins: from the outside a refused drag and a drag that
 * wrote nothing look identical. Here `dragging` answers directly, and none of
 * it needs geometry.
 */

const DAY_KEYS = [
  "2026-08-10",
  "2026-08-11",
  "2026-08-12",
  "2026-08-13",
  "2026-08-14",
  "2026-08-15",
  "2026-08-16",
];

function item(
  id: string,
  overrides: Partial<WeekTimeGridItem> = {},
): WeekTimeGridItem {
  return {
    id,
    date: "2026-08-13",
    title: id,
    startTime: "09:00",
    endTime: "10:00",
    ...overrides,
  };
}

/**
 * A pointer-down the hook can read. `offsetParent` is null, which is the
 * jsdom truth anyway — colWidth falls back to 0 and no test below depends on
 * a horizontal day change.
 */
function pointerDown(button = 0) {
  const stopPropagation = vi.fn();
  const event = {
    button,
    clientX: 10,
    clientY: 10,
    currentTarget: { offsetParent: null },
    stopPropagation,
  } as unknown as ReactPointerEvent;
  return { event, stopPropagation };
}

function renderDrag(
  params: {
    items?: WeekTimeGridItem[];
    onMoveItem?: (
      id: string,
      dateISO: string,
      startISO: string,
      endISO: string,
    ) => void;
    onResizeItem?: (id: string, endISO: string) => void;
  } = {},
) {
  const onMoveItem =
    "onMoveItem" in params ? params.onMoveItem : vi.fn<() => void>();
  const onResizeItem =
    "onResizeItem" in params ? params.onResizeItem : vi.fn<() => void>();
  return renderHook(() =>
    useWeekTimeGridDrag({
      items: params.items ?? [item("event-1")],
      dayKeys: DAY_KEYS,
      hourHeight: 48,
      hourRange: [0, 24],
      snapMinutesStep: 30,
      defaultCreateDuration: 60,
      onMoveItem,
      onResizeItem,
    }),
  );
}

/** Start a drag and report whether the hook accepted it. */
function tryBegin(
  hook: ReturnType<typeof renderDrag>,
  target: WeekTimeGridItem,
  mode: WeekTimeGridDragMode,
  button = 0,
) {
  const { event, stopPropagation } = pointerDown(button);
  act(() => hook.result.current.beginDrag(event, target, mode));
  return { started: hook.result.current.dragging, stopPropagation };
}

describe("which pointer-downs start a drag", () => {
  it("takes a primary-button press on a timed block", () => {
    const hook = renderDrag();
    const { started, stopPropagation } = tryBegin(hook, item("e"), "move");
    expect(started).toBe(true);
    // Swallowed so the day column below does not also read it as an
    // empty-slot create.
    expect(stopPropagation).toHaveBeenCalled();
  });

  // A right- or middle-click belongs to the context menu, not to a drag.
  it("ignores anything but the primary button", () => {
    const hook = renderDrag();
    const { started, stopPropagation } = tryBegin(hook, item("e"), "move", 2);
    expect(started).toBe(false);
    // NOT swallowed: the press has to reach the context-menu handler.
    expect(stopPropagation).not.toHaveBeenCalled();
  });

  // "place" (A-3 / #298) is the one path allowed to start on an all-day chip —
  // it is what gives the chip a time. A "move" there has no time origin to
  // work from.
  it("lets only a place drag start on an all-day chip", () => {
    const chip = item("chip", { isAllDay: true });
    expect(tryBegin(renderDrag(), chip, "move").started).toBe(false);
    expect(tryBegin(renderDrag(), chip, "resize").started).toBe(false);
    expect(tryBegin(renderDrag(), chip, "place").started).toBe(true);
  });

  it("refuses a mode whose write callback the host did not supply", () => {
    const noMove = renderDrag({ onMoveItem: undefined });
    expect(tryBegin(noMove, item("e"), "move").started).toBe(false);
    expect(
      tryBegin(noMove, item("chip", { isAllDay: true }), "place").started,
    ).toBe(false);
    // Resize is still wired, so it is still accepted.
    expect(tryBegin(noMove, item("e"), "resize").started).toBe(true);

    const noResize = renderDrag({ onResizeItem: undefined });
    expect(tryBegin(noResize, item("e"), "resize").started).toBe(false);
    expect(tryBegin(noResize, item("e"), "move").started).toBe(true);
  });
});

describe("what the grid reads back", () => {
  // Drives cursors and `touchAction` on every block, so a read-only grid does
  // not advertise a gesture it will refuse.
  it("reports interactivity from whether any write callback exists", () => {
    expect(renderDrag().result.current.dragInteractive).toBe(true);
    expect(
      renderDrag({ onResizeItem: undefined }).result.current.dragInteractive,
    ).toBe(true);
    expect(
      renderDrag({ onMoveItem: undefined, onResizeItem: undefined }).result
        .current.dragInteractive,
    ).toBe(false);
  });

  // The identity matters: the day-bucket map memoises on this array, and a
  // fresh copy per render would rebuild it on every unrelated re-render.
  it("hands back the very same items array while no drag is live", () => {
    const items = [item("event-1"), item("event-2")];
    const hook = renderDrag({ items });
    expect(hook.result.current.effectiveItems).toBe(items);
    hook.rerender();
    expect(hook.result.current.effectiveItems).toBe(items);
  });
});
