import { useEffect, useState } from "react";

/*
 * Everything the Calendar can have OPEN on top of the grid (#889).
 *
 * Four `useState`s sat loose among CalendarTab's dozen and read as four
 * unrelated facts. They are one: what, if anything, is covering the calendar
 * right now.
 *
 * Deliberately state, plus the one effect that reads three quarters of it
 * (useCancelDeferredPopover, below). The closing gestures in particular are
 * NOT gathered here, because they are not the same gesture:
 * `finishCreatePanel` drops the panel and the calendar lens, the editor's
 * close runs a discard-changes guard first, and the popover's own dismissal
 * is a click-outside. A helper that closed "the overlays" would have to be one
 * of those three and would quietly be wrong at the other two call sites —
 * which is exactly the kind of near-miss a grouping like this invites.
 *
 * Pure UI state: no writes, no data. Which is why it can be lifted at all.
 */

/** Anchor id + viewport coords of the single-click bubble (#299, Desktop). */
export interface SchedulePopover {
  id: string;
  x: number;
  y: number;
}

/**
 * The creation panel's target day and prefilled window (#299). `null` =
 * closed. Desktop shows it in an overlay, Mobile in the QuickCaptureSheet.
 */
export interface ScheduleCreatePanel {
  date: string;
  start: string;
  end: string;
}

export function useScheduleOverlays() {
  const [popover, setPopover] = useState<SchedulePopover | null>(null);
  /** Detail-edit overlay flag (Desktop; Mobile opens on the selection). */
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [createPanel, setCreatePanel] = useState<ScheduleCreatePanel | null>(
    null,
  );
  const [tagFilterOpen, setTagFilterOpen] = useState(false);

  return {
    popover,
    setPopover,
    overlayOpen,
    setOverlayOpen,
    createPanel,
    setCreatePanel,
    tagFilterOpen,
    setTagFilterOpen,
  };
}

/*
 * #355: whenever ANY other surface opens, drop a bubble still waiting its turn
 * — it would otherwise surface on top of that surface a moment later.
 *
 * One effect rather than a cancel sprinkled through each opener: the openers
 * are spread across CalendarTab and the mutation layer, and the next one added
 * would silently miss it. Cancelling twice is harmless (useDeferredAction
 * no-ops when nothing is pending).
 *
 * It sits beside useScheduleOverlays because three of the five things it
 * watches ARE that state — and it takes all five as parameters rather than
 * reaching for them, so the other two are written down instead of assumed:
 * `scopeRequest` comes from the mutation layer and `todoDetailId` from
 * useScheduleTodoChips, and a surface added to either of those has to be added
 * to this list by hand.
 */
export interface UseCancelDeferredPopoverArgs {
  /** Detail-edit overlay flag (Desktop). */
  overlayOpen: boolean;
  /** The creation panel, or null when it is closed. */
  createPanel: ScheduleCreatePanel | null;
  tagFilterOpen: boolean;
  /** #279's this/future/all chooser, parked until the user answers. */
  scopeRequest: { mode: "edit" | "delete" } | null;
  /** The todo chip's own detail surface (#626), or null. */
  todoDetailId: string | null;
  /** useDeferredAction's `cancel` — a no-op when nothing is pending. */
  cancelPopover: () => void;
}

export function useCancelDeferredPopover({
  overlayOpen,
  createPanel,
  tagFilterOpen,
  scopeRequest,
  todoDetailId,
  cancelPopover,
}: UseCancelDeferredPopoverArgs) {
  useEffect(() => {
    if (
      overlayOpen ||
      createPanel ||
      tagFilterOpen ||
      scopeRequest ||
      todoDetailId != null
    ) {
      cancelPopover();
    }
  }, [
    overlayOpen,
    createPanel,
    tagFilterOpen,
    scopeRequest,
    todoDetailId,
    cancelPopover,
  ]);
}
