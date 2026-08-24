import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { todoChipId } from "@life-editor/shared";
import { useScheduleSelection } from "../src/schedule/useScheduleSelection";
import type { SchedulePopover } from "../src/schedule/useScheduleOverlays";

/*
 * #889 — what the Calendar has PICKED, and the four gestures that pick it,
 * pulled out of CalendarTab.
 *
 * The four handlers answer one question with three near-identical bodies, and
 * every one of the three has drifted at least once already: #564 left a todo
 * chip answering a drag but not a click, and #761 had to fix the long press
 * separately from the tap beside it because they were written twenty lines
 * apart. So the cases below are deliberately written in PAIRS — tap next to
 * long press, chip next to event, wide next to narrow — because a rule landing
 * on only one half of a pair is the failure this hook exists to prevent, and it
 * is invisible in a suite that exercises one gesture per fact.
 *
 * What each pair holds:
 *
 *   - #355: the bubble is DEFERRED on a tap and IMMEDIATE on a long press. A
 *     double-click fires `click` on its first press, so an eager bubble flashed
 *     open and shut every time; a contextmenu is never the first half of a
 *     double-click, so it must not pay the delay. Selection stays instant in
 *     both — it is the part that should feel immediate.
 *   - a todo chip's id is not a schedule item's id. `handleSelectItem` refuses
 *     it outright (it points the EVENT surfaces at a row, and a chip resolves
 *     none of them) while `handleItemActivate` accepts it and routes it — to
 *     the bubble's todo action set on Desktop (#564), to the todo detail sheet
 *     on narrow (#761), unwrapped.
 *   - opening the detail surface means different things by width: the overlay
 *     flag on Desktop, the selection alone on narrow.
 *
 * jsdom has no layout, so nothing here reads a coordinate: the positions below
 * are values handed IN to the handlers, exactly as the grid hands in the ones
 * it measured, and the assertions only check that they arrive intact.
 */

const EVENT_ID = "event-1";
const TODO_ID = "task-1";
/** What the grid actually carries for a todo chip: the prefixed synthetic id. */
const CHIP_ID = todoChipId(TODO_ID);
const POS = { x: 12, y: 34 };

function setup(isWide: boolean) {
  /*
   * #355's delay, held open. Nothing runs until `flushPopover`, so "the bubble
   * has not appeared yet" and "the bubble never appears" stay distinguishable
   * — which is the whole difference between the tap and the long press.
   */
  const deferred: (() => void)[] = [];
  const deferPopover = vi.fn((fn: () => void) => {
    deferred.push(fn);
  });
  const cancelPopover = vi.fn();
  const setPopover = vi.fn((popover: SchedulePopover | null) => void popover);
  const setOverlayOpen = vi.fn((open: boolean) => void open);
  const setTodoDetailId = vi.fn((id: string | null) => void id);

  const { result } = renderHook(() =>
    useScheduleSelection({
      isWide,
      deferPopover,
      cancelPopover,
      setPopover,
      setOverlayOpen,
      setTodoDetailId,
    }),
  );

  return {
    result,
    deferPopover,
    cancelPopover,
    setPopover,
    setOverlayOpen,
    setTodoDetailId,
    /** Let the held-back beat elapse. */
    flushPopover: () =>
      act(() => {
        for (const fn of deferred) fn();
      }),
  };
}

describe("useScheduleSelection — the bubble is held back on a tap, not on a long press (#355 / #551)", () => {
  it("selects at once and lets the bubble wait", () => {
    const { result, setPopover, flushPopover } = setup(true);
    act(() => result.current.handleItemActivate(EVENT_ID, POS));

    // Immediate half.
    expect(result.current.selectedId).toBe(EVENT_ID);
    // Deferred half: still nothing on screen, which is what stops the bubble
    // flashing open and shut on the first press of a double-click.
    expect(setPopover).not.toHaveBeenCalled();

    flushPopover();
    expect(setPopover).toHaveBeenCalledWith({ id: EVENT_ID, ...POS });
  });

  it("opens it straight away on a long press, dropping any bubble still waiting", () => {
    const { result, cancelPopover, deferPopover, setPopover } = setup(true);
    act(() => result.current.handleItemContextMenu(EVENT_ID, POS));

    expect(result.current.selectedId).toBe(EVENT_ID);
    expect(deferPopover).not.toHaveBeenCalled();
    expect(setPopover).toHaveBeenCalledWith({ id: EVENT_ID, ...POS });
    // A left-click bubble already in flight would otherwise resurface a beat
    // later, somewhere else.
    expect(cancelPopover).toHaveBeenCalledTimes(1);
  });

  it("draws no bubble at either gesture on narrow — it is a Desktop surface", () => {
    const tap = setup(false);
    act(() => tap.result.current.handleItemActivate(EVENT_ID, POS));
    tap.flushPopover();
    expect(tap.result.current.selectedId).toBe(EVENT_ID);
    expect(tap.deferPopover).not.toHaveBeenCalled();
    expect(tap.setPopover).not.toHaveBeenCalled();

    const press = setup(false);
    act(() => press.result.current.handleItemContextMenu(EVENT_ID, POS));
    // The selection alone brings up the narrow editor sheet, same as a tap.
    expect(press.result.current.selectedId).toBe(EVENT_ID);
    expect(press.setPopover).not.toHaveBeenCalled();
  });
});

describe("useScheduleSelection — a todo chip is not a schedule item", () => {
  /*
   * `handleSelectItem` exists to point the schedule-item surfaces (editor
   * pane, mutation layer) at a row. A chip id resolves none of them, so a
   * selected chip lights a ring with nothing behind it.
   */
  it("refuses a chip id on the plain select path", () => {
    const { result } = setup(true);
    act(() => result.current.handleSelectItem(CHIP_ID));
    expect(result.current.selectedId).toBeNull();

    act(() => result.current.handleSelectItem(EVENT_ID));
    expect(result.current.selectedId).toBe(EVENT_ID);
  });

  it("answers a Desktop tap with the bubble instead, carrying the CHIP id (#564)", () => {
    const { result, setPopover, setTodoDetailId, flushPopover } = setup(true);
    act(() => result.current.handleItemActivate(CHIP_ID, POS));
    flushPopover();

    // The host resolves the chip from the bubble's id to pick the todo action
    // set, so the prefixed id is what has to arrive — not the unwrapped one.
    expect(setPopover).toHaveBeenCalledWith({ id: CHIP_ID, ...POS });
    expect(setTodoDetailId).not.toHaveBeenCalled();
  });

  /*
   * The other half of that pair, and the one the file was missing: on Desktop
   * a long press is the same bubble, minus the #355 wait. Nothing but this
   * case can tell "the chip route ignores width" (which would send the press
   * to the todo sheet) from "the chip route is Desktop-only" — the three
   * neighbouring cases pass either way.
   */
  it("answers a Desktop long press with the same bubble, immediately (#355)", () => {
    const { result, cancelPopover, deferPopover, setPopover, setTodoDetailId } =
      setup(true);
    act(() => result.current.handleItemContextMenu(CHIP_ID, POS));

    expect(setPopover).toHaveBeenCalledWith({ id: CHIP_ID, ...POS });
    expect(deferPopover).not.toHaveBeenCalled();
    expect(setTodoDetailId).not.toHaveBeenCalled();
    // Same drop of a left-click bubble still waiting as the event long press:
    // the chip route must not cost the gesture its cancellation.
    expect(cancelPopover).toHaveBeenCalledTimes(1);
  });

  it("sends a narrow tap to the todo sheet, unwrapped and unselected (#761)", () => {
    const { result, setPopover, setTodoDetailId } = setup(false);
    act(() => result.current.handleItemActivate(CHIP_ID, POS));

    expect(setTodoDetailId).toHaveBeenCalledWith(TODO_ID);
    // Deliberately not selected on the way in — `selectedId` drives the event
    // surfaces, and this id resolves none of them.
    expect(result.current.selectedId).toBeNull();
    expect(setPopover).not.toHaveBeenCalled();
  });

  /*
   * The long press is the gesture a phone actually produces here, and #761 had
   * to fix it separately from the tap. It must land in the same place.
   */
  it("sends a narrow long press to exactly the same place as the tap", () => {
    const { result, cancelPopover, setPopover, setTodoDetailId } = setup(false);
    act(() => result.current.handleItemContextMenu(CHIP_ID, POS));

    expect(setTodoDetailId).toHaveBeenCalledWith(TODO_ID);
    expect(result.current.selectedId).toBeNull();
    expect(setPopover).not.toHaveBeenCalled();
    expect(cancelPopover).toHaveBeenCalledTimes(1);
  });
});

describe("useScheduleSelection — opening the detail surface", () => {
  it("closes the bubble first, then opens the Desktop overlay", () => {
    const { result, setPopover, setOverlayOpen } = setup(true);
    act(() => result.current.handleItemOpenDetail(EVENT_ID));

    expect(setPopover).toHaveBeenCalledWith(null);
    expect(result.current.selectedId).toBe(EVENT_ID);
    expect(setOverlayOpen).toHaveBeenCalledWith(true);
  });

  it("leaves the flag alone on narrow — the selection alone opens the sheet", () => {
    const { result, setOverlayOpen } = setup(false);
    act(() => result.current.handleItemOpenDetail(EVENT_ID));

    expect(result.current.selectedId).toBe(EVENT_ID);
    expect(setOverlayOpen).not.toHaveBeenCalled();
  });

  /*
   * #564 / #626: a chip's detail is not this overlay — <EventEditorPane> edits
   * a schedule_item and a todo has none, so the chip gets its own panel at
   * both widths.
   */
  it("routes a chip to its own panel even on Desktop, without selecting it", () => {
    const { result, setOverlayOpen, setTodoDetailId } = setup(true);
    act(() => result.current.handleItemOpenDetail(CHIP_ID));

    expect(setTodoDetailId).toHaveBeenCalledWith(TODO_ID);
    expect(setOverlayOpen).not.toHaveBeenCalled();
    expect(result.current.selectedId).toBeNull();
  });
});
