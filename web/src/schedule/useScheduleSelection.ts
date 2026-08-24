import { useCallback, useState } from "react";
import { isTodoChip, unwrapTodoChipId } from "@life-editor/shared";
import { itemTapRoute } from "./todoChipPanel";
import type { SchedulePopover } from "./useScheduleOverlays";

/*
 * What the Calendar has PICKED, and the four gestures that pick it (#889,
 * extracted from CalendarTab).
 *
 * The selection, the rightSidebar tab, and the tap / activate / open-detail /
 * context-menu handlers were spread across three hundred lines of the host with
 * the mutation layer, the filters and the creation flow interleaved between
 * them — and the four handlers answer ONE question with three near-identical
 * bodies:
 *
 *   1. Is this id even a schedule item? A todo chip's id is not, so it resolves
 *      none of the event surfaces (the grid ring, the narrow editor sheet) and
 *      must be routed to the chip's own panel instead (#564 / #626 / #761).
 *   2. Is this layout wide? The bubble is a Desktop surface; narrow answers the
 *      same press with the sheet the selection alone opens.
 *   3. Does the bubble open now, later, or not at all (#355)?
 *
 * Each of the three had drifted at least once — #564 left the chip answering a
 * drag but not a click, and #761 had to fix the long press separately from the
 * tap beside it because they were written twenty lines apart. `itemTapRoute` is
 * shared by the tap and the long press for exactly that reason, and having the
 * pair in one file is what keeps the next rule from landing on only one of them.
 *
 * `sidebarTab` comes along because it is the other thing this screen has
 * selected and the state had nowhere else to be; it is read only by
 * useScheduleRepeats and <ScheduleSidebar>.
 *
 * Deliberately NOT here: the `pendingSelectEvent` effect (#503). It needs the
 * grid filters' `revealOnGrid`, and useScheduleGridFilters already takes this
 * hook's `setSelectedId` — so pulling it in would be a cycle. It stays at the
 * call site, where the prop it consumes is.
 *
 * Pure UI state and routing: no writes, no data, nothing to fetch. Which is why
 * it can be lifted at all.
 *
 * Zero behaviour change (#889): every branch, every dependency list and every
 * order of operations below is the code that stood inline in CalendarTab.
 */

export interface UseScheduleSelectionArgs {
  isWide: boolean;
  /** #355: hold the bubble back a beat (useDeferredAction, at the call site). */
  deferPopover: (fn: () => void) => void;
  /** Drop a bubble that has not surfaced yet. */
  cancelPopover: () => void;
  setPopover: (popover: SchedulePopover | null) => void;
  /** Desktop's detail-edit overlay flag (narrow opens on the selection). */
  setOverlayOpen: (open: boolean) => void;
  /** The todo chip's own detail surface (#626 / #761 — useScheduleTodoChips). */
  setTodoDetailId: (id: string | null) => void;
}

export function useScheduleSelection({
  isWide,
  deferPopover,
  cancelPopover,
  setPopover,
  setOverlayOpen,
  setTodoDetailId,
}: UseScheduleSelectionArgs) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Which rightSidebar tab is showing ("今日の流れ" / "本日の Todo" — the A-3
  // tray, #298). The old "詳細" tab was removed in #299 (item detail now lives
  // in a body-level overlay, not the rightSidebar).
  // #408 added "repeats" — with the Routines header tab retired this is the
  // only route to a routine whose occurrences are not in the visible range.
  // #467 gave Mobile the same drawer minus "todo" (the Todo board is its own
  // section tab there), so the value is normalised per layout at render.
  const [sidebarTab, setSidebarTab] = useState<"flow" | "todo" | "repeats">(
    "flow",
  );

  // Selection = highlight only (#299). The grid ring follows selectedId; the
  // duplicate handler re-selects the copy. Bubble / overlay opening is handled
  // by the activate/open-detail handlers below.
  const handleSelectItem = useCallback((id: string) => {
    // A chip id is not a ScheduleItem id, and this path exists to point the
    // schedule-item surfaces (editor pane / mutation layer) at a row. Todo
    // chips DO answer a click since #564 — through handleItemActivate, which
    // opens their own panel — so this guard is about the id's shape, not about
    // chips being read-only.
    if (isTodoChip(id)) return;
    setSelectedId(id);
  }, []);

  // #299 single-click: open the bubble popover next to the item (Desktop). On
  // Mobile a single tap opens the BottomSheet editor directly (selectedId →
  // editorPane → sheet), matching the existing lean-drawer flow.
  //
  // #355: the bubble is held back for a beat. A double-click fires `click` on
  // its first press and only announces itself afterwards, so opening the
  // bubble straight away made it flash open and shut on every double-click.
  // Selection stays immediate — it is the part that should feel instant, and
  // the detail surface wants it anyway.
  //
  // #564: todo chips come through here too. They used to be dropped on the
  // spot (the A-1 "read-only display" rule), which by now was only true of the
  // click — #297/#298/#569 had made the same chip draggable, so the all-day
  // lane ended up with chips that answered a drag but not a click. They open
  // the same bubble with the todo action set (see todoChipPanel.ts).
  //
  // #761: on NARROW they used to be dropped instead, selection included, for
  // want of a surface to send them to. They now open the todo detail sheet —
  // see itemTapRoute.
  const handleItemActivate = useCallback(
    (id: string, pos: { x: number; y: number }) => {
      if (itemTapRoute(id, isWide) === "todoSheet") {
        // Deliberately not selected on the way in: `selectedId` drives the
        // EVENT surfaces (the ring, the narrow editor sheet), and a chip id
        // resolves none of them.
        setTodoDetailId(unwrapTodoChipId(id));
        return;
      }
      setSelectedId(id);
      if (isWide) deferPopover(() => setPopover({ id, x: pos.x, y: pos.y }));
    },
    [isWide, deferPopover, setPopover, setTodoDetailId],
  );

  // #299 "詳細を編集" (bubble) / double-click: open the detail-edit surface —
  // the body-level overlay on Desktop, the BottomSheet on Mobile (selectedId
  // drives it). Closes any open bubble; one still waiting to appear is dropped
  // by the "another surface opened" effect in the host (#355).
  //
  // #564: a todo chip's detail is not this overlay — EventEditorPane edits a
  // schedule_item, and a todo has none. #626 gives the chip its own in-place
  // surface on Desktop (TodoDetailPanel in an ItemDetailOverlay), so tags are
  // editable without leaving Schedule.
  //
  // #761: narrow gets the same panel in a BottomSheet, so it no longer answers
  // with a jump to another section. The Todos hand-off is still there — as a
  // button inside the panel, where it is the user's choice rather than the only
  // thing the row can do.
  const handleItemOpenDetail = useCallback(
    (id: string) => {
      setPopover(null);
      if (isTodoChip(id)) {
        setTodoDetailId(unwrapTodoChipId(id));
        return;
      }
      setSelectedId(id);
      if (isWide) setOverlayOpen(true);
    },
    [isWide, setOverlayOpen, setPopover, setTodoDetailId],
  );

  // #551: right-click opens the SAME bubble as a left-click — one panel for
  // both gestures (the separate ScheduleItemContextMenu is retired). No #355
  // deferral here: a contextmenu gesture is never the first half of a
  // double-click, so the bubble can appear at once; cancelling a deferred
  // left-click bubble keeps it from resurfacing elsewhere a beat later. On
  // narrow the selection alone opens the BottomSheet editor, same as a tap.
  //
  // Rename / duplicate / delete are NOT here — they are writes, and they live
  // in the mutation layer. Only where the menu opens is a selection concern.
  const handleItemContextMenu = useCallback(
    (id: string, pos: { x: number; y: number }) => {
      // Same narrow routing as handleItemActivate — a long press is the
      // gesture that produces this on a phone, and it must not land somewhere
      // the tap beside it does not (#761).
      if (itemTapRoute(id, isWide) === "todoSheet") {
        cancelPopover();
        setTodoDetailId(unwrapTodoChipId(id));
        return;
      }
      cancelPopover();
      setSelectedId(id);
      if (isWide) setPopover({ id, x: pos.x, y: pos.y });
    },
    [isWide, cancelPopover, setPopover, setTodoDetailId],
  );

  return {
    selectedId,
    setSelectedId,
    sidebarTab,
    setSidebarTab,
    handleSelectItem,
    handleItemActivate,
    handleItemOpenDetail,
    handleItemContextMenu,
  };
}
