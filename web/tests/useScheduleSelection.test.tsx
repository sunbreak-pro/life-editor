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
 *   - #355 → #1608: the bubble is IMMEDIATE on both. #355 held the tap's
 *     bubble back 350ms so a double-click could claim the gesture before it
 *     appeared; #1608 removed the wait, because every single click paid it and
 *     the single click is the gesture people make. What keeps a double-click
 *     from leaving two surfaces up is `handleItemOpenDetail`, which closes the
 *     bubble in the same callback that opens the overlay — pinned below.
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
  const setPopover = vi.fn((popover: SchedulePopover | null) => void popover);
  const setOverlayOpen = vi.fn((open: boolean) => void open);
  const setTodoDetailId = vi.fn((id: string | null) => void id);

  const { result } = renderHook(() =>
    useScheduleSelection({
      isWide,
      setPopover,
      setOverlayOpen,
      setTodoDetailId,
    }),
  );

  return {
    result,
    setPopover,
    setOverlayOpen,
    setTodoDetailId,
  };
}

describe("useScheduleSelection — the bubble answers every gesture at once (#1608 / #551)", () => {
  it("selects and opens the bubble in the same beat", () => {
    const { result, setPopover } = setup(true);
    act(() => result.current.handleItemActivate(EVENT_ID, POS));

    expect(result.current.selectedId).toBe(EVENT_ID);
    // #1608: no wait between the two. The 350ms the bubble used to spend
    // watching for a double-click is the lag this hook was reported for.
    expect(setPopover).toHaveBeenCalledWith({ id: EVENT_ID, ...POS });
  });

  /*
   * #1608's replacement for the wait, and the reason a double-click does not
   * leave two surfaces up: the bubble is closed IN THE SAME CALLBACK that
   * opens the overlay, so React commits the swap in one paint — no frame
   * showing neither, and nothing left in flight to surface afterwards. The
   * bug this pins is a bubble reappearing on top of the overlay a beat later.
   */
  it("swaps the bubble for the overlay in one callback on a double-click", () => {
    const { result, setPopover, setOverlayOpen } = setup(true);

    // First press of the double-click: the bubble is up.
    act(() => result.current.handleItemActivate(EVENT_ID, POS));
    expect(setPopover).toHaveBeenLastCalledWith({ id: EVENT_ID, ...POS });

    // The second press arrives as a `click` too — same bubble, overwritten.
    act(() => result.current.handleItemActivate(EVENT_ID, POS));
    // Then `dblclick`.
    act(() => result.current.handleItemOpenDetail(EVENT_ID));

    expect(setPopover).toHaveBeenLastCalledWith(null);
    expect(setOverlayOpen).toHaveBeenCalledWith(true);
    // Three writes, all of them synchronous: nothing is pending that could
    // re-open the bubble behind the overlay.
    expect(setPopover).toHaveBeenCalledTimes(3);
  });

  it("opens the same bubble on a long press, re-anchored at the new press", () => {
    const { result, setPopover } = setup(true);
    act(() => result.current.handleItemContextMenu(EVENT_ID, POS));

    expect(result.current.selectedId).toBe(EVENT_ID);
    // One write, not a close-then-open: a bubble already up is overwritten in
    // place, so the right-click cannot make it blink.
    expect(setPopover).toHaveBeenCalledTimes(1);
    expect(setPopover).toHaveBeenCalledWith({ id: EVENT_ID, ...POS });
  });

  it("draws no bubble at either gesture on narrow — it is a Desktop surface", () => {
    const tap = setup(false);
    act(() => tap.result.current.handleItemActivate(EVENT_ID, POS));
    expect(tap.result.current.selectedId).toBe(EVENT_ID);
    expect(tap.setPopover).not.toHaveBeenCalled();

    const press = setup(false);
    act(() => press.result.current.handleItemContextMenu(EVENT_ID, POS));
    // The selection alone brings up the narrow editor sheet, same as a tap.
    expect(press.result.current.selectedId).toBe(EVENT_ID);
    // Never a bubble — the only write it makes is the close (#1608).
    expect(press.setPopover).toHaveBeenCalledWith(null);
    expect(press.setPopover).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: EVENT_ID }),
    );
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
    const { result, setPopover, setTodoDetailId } = setup(true);
    act(() => result.current.handleItemActivate(CHIP_ID, POS));

    // The host resolves the chip from the bubble's id to pick the todo action
    // set, so the prefixed id is what has to arrive — not the unwrapped one.
    expect(setPopover).toHaveBeenCalledWith({ id: CHIP_ID, ...POS });
    expect(setTodoDetailId).not.toHaveBeenCalled();
  });

  /*
   * The other half of that pair, and the one the file was missing: on Desktop
   * a long press is the same bubble. Nothing but this case can tell "the chip
   * route ignores width" (which would send the press to the todo sheet) from
   * "the chip route is Desktop-only" — the three neighbouring cases pass
   * either way.
   */
  it("answers a Desktop long press with the same bubble (#564)", () => {
    const { result, setPopover, setTodoDetailId } = setup(true);
    act(() => result.current.handleItemContextMenu(CHIP_ID, POS));

    expect(setPopover).toHaveBeenCalledTimes(1);
    expect(setPopover).toHaveBeenCalledWith({ id: CHIP_ID, ...POS });
    expect(setTodoDetailId).not.toHaveBeenCalled();
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
    const { result, setPopover, setTodoDetailId } = setup(false);
    act(() => result.current.handleItemContextMenu(CHIP_ID, POS));

    expect(setTodoDetailId).toHaveBeenCalledWith(TODO_ID);
    expect(result.current.selectedId).toBeNull();
    // The chip branch has no bubble of its own to overwrite, so it closes
    // explicitly — a layout swap can leave a Desktop bubble up (#1608).
    expect(setPopover).toHaveBeenCalledWith(null);
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
