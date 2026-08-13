import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import {
  minutesFromMidnight,
  minutesToTime,
  resolveDrag,
  type HourRange,
} from "../../utils/scheduleGridLayout";
import type { WeekTimeGridItem } from "./WeekTimeGrid";

/*
 * WeekTimeGrid's pointer machinery (#675, extracted from the component).
 *
 * The grid is otherwise presentational — axis, header, lane, blocks — and this
 * was the one part of it that thinks. It came out whole because it talks to the
 * rest through exactly three things: the items it previews onto, two DOM refs
 * it measures, and the host callbacks it fires. Nothing else in the render
 * touches drag state.
 *
 * The DECISION stays where it was: `resolveDrag` in scheduleGridLayout.ts, pure
 * and pinned in shared/tests/scheduleGridLayout.test.ts. Everything read from
 * the DOM is measured here and handed over as numbers, which is what lets the
 * rules be tested at all — jsdom reports every rect as zero.
 *
 * Behaviour is pinned end to end by shared/tests/weekTimeGrid.test.tsx (which
 * stubs the rects); shared/tests/useWeekTimeGridDrag.test.tsx covers the entry
 * guards, which need no geometry at all.
 */

/**
 * Live drag state held in a ref so the window listeners read fresh values.
 *
 * "place" (schedule redesign A-3 / #298): an all-day todo chip is dragged out
 * of the all-day lane into the time body to gain a start time. Unlike "move"
 * (delta from the block's own time origin) it has no time origin, so the drop
 * time is read from the ABSOLUTE pointer Y over the scroll body; the day stays
 * the chip's own (no horizontal day change) and the write reuses `onMoveItem`.
 */
interface DragState {
  id: string;
  mode: "move" | "resize" | "place";
  startX: number;
  startY: number;
  /** Width of one day column in px (move = horizontal day mapping). */
  colWidth: number;
  /** Index of the dragged item's day within `dayKeys`. */
  origDayIdx: number;
  origStartMin: number;
  durationMin: number;
  moved: boolean;
  /** Latest snapped result, persisted on pointer-up. `allDay` = the pointer
   *  sits over the all-day lane/header (#562): "move" commits via
   *  onDropAllDay, "place" commits nothing (the chip never left the lane). */
  final: {
    dateISO: string;
    startMin: number;
    endMin: number;
    allDay: boolean;
  } | null;
}

/** Optimistic preview applied to one item during a live drag. */
interface DragPreview {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  /** "place" flips the previewed chip to timed so it leaves the all-day lane. */
  isAllDay?: boolean;
}

export type WeekTimeGridDragMode = "move" | "resize" | "place";

export interface UseWeekTimeGridDragParams {
  items: WeekTimeGridItem[];
  /** The rendered day columns, left to right — a drag maps X onto this. */
  dayKeys: string[];
  hourHeight: number;
  hourRange: HourRange;
  snapMinutesStep: number;
  /** Seed length for a "place" drag, which has no duration of its own. */
  defaultCreateDuration: number;
  onMoveItem?: (
    id: string,
    dateISO: string,
    startISO: string,
    endISO: string,
  ) => void;
  onResizeItem?: (id: string, endISO: string) => void;
  onDropAllDay?: (id: string, dateISO: string) => void;
  onSelectItem?: (id: string) => void;
  onItemActivate?: (id: string, pos: { x: number; y: number }) => void;
}

export interface WeekTimeGridDrag {
  /** True while a pointer is down on a draggable block. */
  dragging: boolean;
  /** Whether any drag is possible at all — drives cursors and touchAction. */
  dragInteractive: boolean;
  /** `items` with the live preview merged in, for bucketing and layout. */
  effectiveItems: WeekTimeGridItem[];
  beginDrag: (
    e: ReactPointerEvent,
    item: WeekTimeGridItem,
    mode: WeekTimeGridDragMode,
  ) => void;
  /**
   * The all-day lane's own bottom edge is the "dropped on the lane" boundary
   * (#563 put the lane inside the scroll box, so the scroll container's top is
   * no longer that edge). Must be attached by the component.
   */
  allDayLaneRef: RefObject<HTMLDivElement | null>;
  /**
   * The 00:00 origin for the absolute pointer→minutes mapping of a "place"
   * drag. Must be attached by the component.
   */
  timeGridRef: RefObject<HTMLDivElement | null>;
}

export function useWeekTimeGridDrag({
  items,
  dayKeys,
  hourHeight,
  hourRange,
  snapMinutesStep,
  defaultCreateDuration,
  onMoveItem,
  onResizeItem,
  onDropAllDay,
  onSelectItem,
  onItemActivate,
}: UseWeekTimeGridDragParams): WeekTimeGridDrag {
  const [startHour, endHour] = hourRange;
  const allDayLaneRef = useRef<HTMLDivElement | null>(null);
  const timeGridRef = useRef<HTMLDivElement | null>(null);

  const dragRef = useRef<DragState | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const dragInteractive = !!(onMoveItem || onResizeItem);

  // Merge any live drag preview onto the source items so both the bucketing and
  // the absolute layout reflect the optimistic position during a drag.
  const effectiveItems = useMemo(() => {
    if (!dragPreview) return items;
    return items.map((it) =>
      it.id === dragPreview.id
        ? {
            ...it,
            date: dragPreview.date,
            startTime: dragPreview.startTime,
            endTime: dragPreview.endTime,
            // "place" flips an all-day chip to timed so it moves from the
            // all-day lane into the positioned time body during the drag.
            isAllDay: dragPreview.isAllDay ?? it.isAllDay,
          }
        : it,
    );
  }, [items, dragPreview]);

  const beginDrag = (
    e: ReactPointerEvent,
    item: WeekTimeGridItem,
    mode: WeekTimeGridDragMode,
  ) => {
    if (e.button !== 0) return;
    // move/resize act on timed blocks only; "place" is the sole path allowed to
    // start on an all-day chip (it gives it a time — A-3 / #298).
    if (mode !== "place" && item.isAllDay) return;
    if ((mode === "move" || mode === "place") && !onMoveItem) return;
    if (mode === "resize" && !onResizeItem) return;
    e.stopPropagation();
    // For a timed block ("move"/"resize") the offsetParent is its day column,
    // and that column's width maps a horizontal drag to a whole-day offset.
    // For "place" the drag starts on an all-day chip, whose offsetParent is the
    // sticky header/lane wrapper (#563) rather than a single day cell — that is
    // harmless because "place" never reads colWidth (its day stays fixed), and
    // "resize" ignores width too.
    const col = (e.currentTarget as HTMLElement)
      .offsetParent as HTMLElement | null;
    // "place": an all-day chip has no time origin — seed a default block anchored
    // at the top of the visible window; the real start comes from the absolute
    // pointer Y over the time body (onMove). Its day stays fixed (no horizontal
    // day change), so colWidth is irrelevant.
    const startMin =
      mode === "place" ? startHour * 60 : minutesFromMidnight(item.startTime);
    const durationMin =
      mode === "place"
        ? defaultCreateDuration
        : Math.max(
            minutesFromMidnight(item.endTime),
            startMin + snapMinutesStep,
          ) - startMin;
    dragRef.current = {
      id: item.id,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      colWidth: col ? col.getBoundingClientRect().width : 0,
      origDayIdx: dayKeys.indexOf(item.date),
      origStartMin: startMin,
      durationMin,
      moved: false,
      final: null,
    };
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      // The decision itself is pure (`resolveDrag`, pinned in
      // shared/tests/scheduleGridLayout.test.ts). Everything read from the DOM
      // is measured here and handed over as numbers — which is what lets the
      // rules be tested at all, since jsdom reports every rect as zero.
      const laneEl = allDayLaneRef.current;
      const gridEl = timeGridRef.current;
      const next = resolveDrag(
        d,
        { x: ev.clientX, y: ev.clientY },
        {
          dayKeys,
          hourHeight,
          hourRange,
          snapStep: snapMinutesStep,
          allDayLaneBottom: laneEl
            ? laneEl.getBoundingClientRect().bottom
            : null,
          timeGridTop: gridEl ? gridEl.getBoundingClientRect().top : null,
          canDropAllDay: !!onDropAllDay,
        },
      );
      if (!next) return;
      d.moved = true;
      d.final = {
        dateISO: next.dateISO,
        startMin: next.startMin,
        endMin: next.endMin,
        allDay: next.allDay,
      };
      setDragPreview({
        id: d.id,
        date: next.dateISO,
        startTime: minutesToTime(next.startMin),
        endTime: minutesToTime(next.endMin),
        isAllDay: next.previewIsAllDay,
      });
    };
    const onUp = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (d) {
        if (d.moved && d.final) {
          if (d.final.allDay) {
            // #562: released over the all-day lane. "move" hands the item to
            // the host to flip back to all-day; "place" writes nothing — the
            // chip never stopped being all-day.
            if (d.mode === "move") onDropAllDay?.(d.id, d.final.dateISO);
          } else if (d.mode === "move" || d.mode === "place") {
            // "place" writes through the same host callback as move — the host
            // routes a todo chip to updateNode(scheduledAt/…, isAllDay:false),
            // turning the all-day candidate into a timed block (A-3 / #298).
            onMoveItem?.(
              d.id,
              d.final.dateISO,
              minutesToTime(d.final.startMin),
              minutesToTime(d.final.endMin),
            );
          } else {
            onResizeItem?.(d.id, minutesToTime(d.final.endMin));
          }
        } else {
          // Non-drag pointer-up = a click on a movable block (#297 guard). Open
          // the bubble anchored at the pointer, not the old rightSidebar select
          // (#299). This is the ONLY click route a draggable item has — an
          // all-day todo chip included — since a drag handler leaves no onClick
          // to fall back on (#564).
          if (onItemActivate)
            onItemActivate(d.id, { x: ev.clientX, y: ev.clientY });
          else onSelectItem?.(d.id);
        }
      }
      dragRef.current = null;
      setDragPreview(null);
      setDragging(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [
    dragging,
    dayKeys,
    hourHeight,
    hourRange,
    startHour,
    endHour,
    snapMinutesStep,
    onMoveItem,
    onResizeItem,
    onDropAllDay,
    onSelectItem,
    onItemActivate,
  ]);

  return {
    dragging,
    dragInteractive,
    effectiveItems,
    beginDrag,
    allDayLaneRef,
    timeGridRef,
  };
}
