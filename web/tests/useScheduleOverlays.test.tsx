import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useCancelDeferredPopover,
  useScheduleOverlays,
} from "../src/schedule/useScheduleOverlays";
import type { UseCancelDeferredPopoverArgs } from "../src/schedule/useScheduleOverlays";

/*
 * Everything the Calendar can have OPEN on top of the grid (#889), and the one
 * effect that watches it.
 *
 * `useCancelDeferredPopover` is a five-term disjunction whose own comment says
 * the watch-list is maintained BY HAND — three of the five are the state next
 * door, and the other two come from the mutation layer and the todo half. That
 * is the failure mode this file exists for: not a term that stops working, but
 * a SIXTH surface added somewhere else and never added here. #355's bubble then
 * surfaces on top of the new surface a beat after it opens, anchored at
 * coordinates that belonged to the press before it.
 *
 * A term dropped from the list is the same shape of bug, and a suite that
 * opened two surfaces at once would miss it — the other four terms hold the
 * `if` up on their own. So each term gets its own case, opened alone, starting
 * from a state where nothing is open at all: the assertion is that THIS value
 * changing is what cancelled, which also pins the value into the dependency
 * list rather than just into the condition.
 *
 * `cancelPopover` is `useDeferredAction`'s `cancel`, which no-ops when nothing
 * is pending — so cancelling is cheap and the hook is free to be eager. That is
 * why the cases below assert a CALL rather than any visible consequence: there
 * is none, by design.
 *
 * The state half is four `useState`s in one bundle, which is a shape where a
 * mis-wired setter (the fourth line of four, pointing at the third's state)
 * costs nothing to write and shows up only as a surface that will not open.
 * Hence one case per field, each requiring the other three to stay put.
 */

describe("useScheduleOverlays — four facts about one question", () => {
  type Api = ReturnType<typeof useScheduleOverlays>;
  /** Nothing is covering the calendar — the state every field starts from. */
  const CLOSED = {
    popover: null,
    overlayOpen: false,
    createPanel: null,
    calendarsOpen: false,
  };
  const snapshot = (api: Api) => ({
    popover: api.popover,
    overlayOpen: api.overlayOpen,
    createPanel: api.createPanel,
    calendarsOpen: api.calendarsOpen,
  });

  const BUBBLE = { id: "event-1", x: 12, y: 34 };
  const PANEL = { date: "2026-08-16", start: "09:00", end: "10:00" };

  const FIELDS: [
    name: string,
    open: (api: Api) => void,
    expected: Partial<ReturnType<typeof snapshot>>,
  ][] = [
    [
      "the single-click bubble",
      (api) => api.setPopover(BUBBLE),
      { popover: BUBBLE },
    ],
    [
      "the detail overlay flag",
      (api) => api.setOverlayOpen(true),
      { overlayOpen: true },
    ],
    [
      "the creation panel",
      (api) => api.setCreatePanel(PANEL),
      { createPanel: PANEL },
    ],
    [
      "the calendars modal",
      (api) => api.setCalendarsOpen(true),
      { calendarsOpen: true },
    ],
  ];

  it("starts with nothing over the grid", () => {
    const { result } = renderHook(() => useScheduleOverlays());
    expect(snapshot(result.current)).toEqual(CLOSED);
  });

  it.each(FIELDS)(
    "opening %s moves its own value and no other",
    (_name, open, expected) => {
      const { result } = renderHook(() => useScheduleOverlays());
      act(() => open(result.current));
      expect(snapshot(result.current)).toEqual({ ...CLOSED, ...expected });
    },
  );
});

/** Nothing open: the baseline every term below is opened alone from. */
const NOTHING_OPEN: Omit<UseCancelDeferredPopoverArgs, "cancelPopover"> = {
  overlayOpen: false,
  createPanel: null,
  calendarsOpen: false,
  scopeRequest: null,
  todoDetailId: null,
};

type Watched = Omit<UseCancelDeferredPopoverArgs, "cancelPopover">;

/*
 * One case per term, and the name says where the term comes FROM — the two that
 * are not this file's own state are the two a future surface is most likely to
 * be added beside without anyone reading this list.
 */
const TERMS: [name: string, open: Partial<Watched>][] = [
  ["the detail overlay (Desktop's flag)", { overlayOpen: true }],
  [
    "the creation panel",
    { createPanel: { date: "2026-08-16", start: "09:00", end: "10:00" } },
  ],
  ["the calendars modal", { calendarsOpen: true }],
  [
    "#279's scope chooser (from the mutation layer)",
    { scopeRequest: { mode: "edit" } },
  ],
  [
    "#626's todo detail (from useScheduleTodoChips)",
    { todoDetailId: "task-1" },
  ],
];

function renderWatcher(initial: Watched = NOTHING_OPEN) {
  const cancelPopover = vi.fn();
  const hook = renderHook(
    (props: Watched) => useCancelDeferredPopover({ ...props, cancelPopover }),
    { initialProps: initial },
  );
  return { ...hook, cancelPopover };
}

describe("useCancelDeferredPopover — every surface drops a waiting bubble (#355)", () => {
  it("leaves it alone while nothing is open", () => {
    const { cancelPopover } = renderWatcher();
    expect(cancelPopover).not.toHaveBeenCalled();
  });

  it.each(TERMS)("%s opening cancels it", (_name, open) => {
    const { rerender, cancelPopover } = renderWatcher();
    expect(cancelPopover).not.toHaveBeenCalled();

    rerender({ ...NOTHING_OPEN, ...open });

    expect(cancelPopover).toHaveBeenCalledTimes(1);
  });

  /*
   * Mounted with a surface ALREADY open — the arrangement a layout swap
   * produces, where the effect's first run is the only one it gets.
   */
  it.each(TERMS)("%s cancels on the very first render too", (_name, open) => {
    const { cancelPopover } = renderWatcher({ ...NOTHING_OPEN, ...open });
    expect(cancelPopover).toHaveBeenCalledTimes(1);
  });

  /*
   * The cancel is guarded by the condition, not fired on every change of the
   * five. Without the `if`, this rerender would cancel a bubble the user just
   * asked for by closing the thing that was in its way.
   */
  it("stands down again once the surface closes", () => {
    const { rerender, cancelPopover } = renderWatcher({
      ...NOTHING_OPEN,
      calendarsOpen: true,
    });
    expect(cancelPopover).toHaveBeenCalledTimes(1);

    rerender(NOTHING_OPEN);

    expect(cancelPopover).toHaveBeenCalledTimes(1);
  });

  /*
   * Two surfaces at once is the case that hides a dropped term, so it is here
   * as the counterexample the per-term cases above are protected from: with
   * four terms still standing the `if` fires all the same, and only the
   * one-at-a-time cases can tell which of the five did it.
   */
  it("cancels once for a change that opens two surfaces together", () => {
    const { rerender, cancelPopover } = renderWatcher();
    rerender({ ...NOTHING_OPEN, overlayOpen: true, calendarsOpen: true });
    expect(cancelPopover).toHaveBeenCalledTimes(1);
  });
});
