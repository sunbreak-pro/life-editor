import { useState } from "react";

/*
 * Everything the Calendar can have OPEN on top of the grid (#889).
 *
 * Four `useState`s sat loose among CalendarTab's dozen and read as four
 * unrelated facts. They are one: what, if anything, is covering the calendar
 * right now.
 *
 * Deliberately state and nothing else. The closing gestures are NOT gathered
 * here, because they are not the same gesture: `finishCreatePanel` drops the
 * panel and the calendar lens, the editor's close runs a discard-changes
 * guard first, and the popover's own dismissal is a click-outside. A helper
 * that closed "the overlays" would have to be one of those three and would
 * quietly be wrong at the other two call sites — which is exactly the kind of
 * near-miss a grouping like this invites.
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
  const [calendarsOpen, setCalendarsOpen] = useState(false);

  return {
    popover,
    setPopover,
    overlayOpen,
    setOverlayOpen,
    createPanel,
    setCreatePanel,
    calendarsOpen,
    setCalendarsOpen,
  };
}
