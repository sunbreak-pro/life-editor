/*
 * Pure layout + date math for the Schedule week/day time grid (W8).
 *
 * No React, no DataService, no i18n. All date arithmetic constructs LOCAL
 * dates from explicit (y, m, d) parts — it NEVER does `new Date("YYYY-MM-DD")`
 * (which parses as UTC midnight and drifts a day in negative timezones). The
 * schedule_items model is a local `date` (YYYY-MM-DD) + `HH:MM` start/end, so
 * keeping everything in local-part space is the whole point (CalendarView's
 * "no UTC" lesson, Issue 011/017 neighbourhood).
 *
 * Precondition: each item is a SINGLE-DAY span (startTime < endTime). Items
 * bucket by their one `date`, so an overnight/inverted item (endTime <=
 * startTime) is NOT split across day columns — it is clamped to the end of its
 * start day (see effEnd below) rather than drawn as a misleading sliver.
 *
 * Unit-tested in shared/tests/scheduleGridLayout.test.ts.
 */

import { clamp } from "./clamp";

/** Minimal shape the layout needs — a structural subset of ScheduleItem. */
export interface GridLayoutItem {
  id: string;
  date: string; // YYYY-MM-DD (local)
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  isAllDay?: boolean;
}

/** Absolute placement of one timed item within a single day column. */
export interface PositionedItem {
  id: string;
  /** Top offset as a percentage (0–100) of the visible [start,end] window. */
  topPct: number;
  /** Height as a percentage (>0) of the visible window. */
  heightPct: number;
  /** 0-based column index within this item's overlap cluster. */
  column: number;
  /** Total columns in this item's overlap cluster (>= 1). */
  columns: number;
}

/** [startHour, endHour] visible window, each 0–24, start < end. */
export type HourRange = readonly [number, number];

// Zero/negative-length items still render this many minutes tall so a click
// target exists (mirrors the frontend grid's MIN_ITEM_HEIGHT intent).
const MIN_ITEM_MINUTES = 20;

export function minutesFromMidnight(hhmm: string): number {
  const parts = hhmm.split(":");
  const hours = Number(parts[0]);
  const mins = Number(parts[1]);
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return 0;
  return hours * 60 + mins;
}

// `clamp` moved to `utils/clamp.ts` (#670 C3 PR 3) — it is plain arithmetic,
// not grid math. Imported (this module uses it 4 times) AND re-exported, so
// the existing schedule call sites and tests keep importing it from here.
// A bare `export { clamp } from "./clamp"` would NOT create a local binding.
export { clamp };

// ── px ↔ minute conversion + slot snapping (W8 interactive grid) ──────────
//
// The scrollable time body is `(endHour - startHour) * hourHeight` px tall and
// covers the [startHour, endHour] window. These pure helpers translate a pixel
// offset within that body to a minute-from-midnight value and back, and snap a
// minute value to a slot grid — the geometry the click-to-create and
// drag-to-move/resize handlers in WeekTimeGrid rely on. Keeping them here (no
// React) makes the snap maths unit-testable on its own (Step 1/5 of the W8
// salvage plan) and mirrors the old web WeekGrid's SLOT_HEIGHT logic, now
// generalised to the variable `hourHeight`/`hourRange` the primitive exposes.

/** Default slot granularity (minutes) for create/move/resize snapping. */
export const DEFAULT_SNAP_MINUTES = 30;

/**
 * Convert a vertical pixel offset within the time body to minutes-from-midnight.
 * `y` is measured from the top of the body (0 = `startHour:00`). The result is
 * clamped to the visible [startHour, endHour] window so a click on the very
 * bottom edge maps to `endHour` rather than overflowing.
 */
export function pxToMinutes(
  y: number,
  hourHeight: number,
  hourRange: HourRange = [0, 24],
): number {
  const [startHour, endHour] = hourRange;
  // Minutes per pixel. When hourHeight is unusable (<= 0) fall back to a
  // 1px-per-minute slope so a click still maps to a sane in-window minute
  // instead of saturating to the bottom edge.
  const minutesPerPx = hourHeight > 0 ? 60 / hourHeight : 1;
  const raw = startHour * 60 + y * minutesPerPx;
  return clamp(raw, startHour * 60, endHour * 60);
}

/**
 * Convert minutes-from-midnight to a vertical pixel offset within the time
 * body (inverse of `pxToMinutes`, before clamping).
 */
export function minutesToPx(
  minutes: number,
  hourHeight: number,
  hourRange: HourRange = [0, 24],
): number {
  const [startHour] = hourRange;
  return ((minutes - startHour * 60) / 60) * hourHeight;
}

/** Snap a minute value to the nearest `slot`-minute boundary (slot > 0). */
export function snapMinutes(
  minutes: number,
  slot: number = DEFAULT_SNAP_MINUTES,
): number {
  const safeSlot = slot > 0 ? slot : DEFAULT_SNAP_MINUTES;
  return Math.round(minutes / safeSlot) * safeSlot;
}

/** Format minutes-from-midnight as a zero-padded `HH:MM` (00:00–24:00). */
export function minutesToTime(minutes: number): string {
  const clamped = clamp(Math.round(minutes), 0, 24 * 60);
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Pointer travel (px) below which a drag still counts as a click. */
export const DRAG_THRESHOLD_PX = 4;

/**
 * What the grid knew when the pointer went down. Everything here is captured
 * once at drag start — the geometry that can only be read from the DOM
 * (`colWidth`) included.
 */
export interface DragOrigin {
  /** "move" = whole block, "resize" = bottom edge, "place" = all-day chip
   *  dropped into the time body (#298 — no time origin of its own). */
  mode: "move" | "resize" | "place";
  startX: number;
  startY: number;
  /** Width of one day column in px; 0 disables the horizontal day remap. */
  colWidth: number;
  /** Index of the dragged item's day within `dayKeys`. */
  origDayIdx: number;
  origStartMin: number;
  durationMin: number;
  /** Whether the threshold was already crossed earlier in this same drag. */
  moved: boolean;
}

/**
 * The measurements the resolver needs from the live DOM. The caller reads them
 * (getBoundingClientRect) and passes numbers, which is what keeps the decision
 * itself testable: jsdom has no layout, so every rect it could read is zero.
 */
export interface DragGeometry {
  /** Date keys of the rendered columns, left to right. */
  dayKeys: string[];
  hourHeight: number;
  hourRange: HourRange;
  snapStep: number;
  /** Viewport Y of the all-day lane's bottom edge; null when there is no lane. */
  allDayLaneBottom: number | null;
  /** Viewport Y of the time grid's 00:00 line; null when it is not mounted. */
  timeGridTop: number | null;
  /** The host accepts a drop back onto the all-day lane ("move" only). */
  canDropAllDay: boolean;
}

/** Where the drag currently says the item belongs. */
export interface DragResolution {
  dateISO: string;
  startMin: number;
  endMin: number;
  /** Released here, the item becomes (or stays) all-day. */
  allDay: boolean;
  /** What the optimistic preview should claim about all-day-ness; undefined
   *  leaves the item's own value alone. */
  previewIsAllDay: boolean | undefined;
}

/**
 * Pointer position + captured geometry → the item's new placement (#673 / C6).
 *
 * Lifted out of WeekTimeGrid's pointermove listener, which is where every
 * schedule drag bug so far has come from (#562's inverted 00:00 full-day bands,
 * #563's lane boundary) and which no test could reach: it needs a live pointer
 * sequence over an element tree with real rects, and jsdom has neither.
 *
 * Returns null while the pointer is still inside the click threshold — the
 * caller keeps treating the gesture as a click until this says otherwise.
 */
export function resolveDrag(
  drag: DragOrigin,
  pointer: { x: number; y: number },
  geo: DragGeometry,
): DragResolution | null {
  const dx = pointer.x - drag.startX;
  const dy = pointer.y - drag.startY;
  if (!drag.moved && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD_PX) {
    return null;
  }
  const [startHour, endHour] = geo.hourRange;
  const deltaMin = (dy / geo.hourHeight) * 60;
  const remapDay = (): number => {
    if (!(drag.colWidth > 0 && geo.dayKeys.length > 1)) return drag.origDayIdx;
    const offset = Math.round(dx / drag.colWidth);
    return Math.min(
      geo.dayKeys.length - 1,
      Math.max(0, drag.origDayIdx + offset),
    );
  };
  const dateOf = (idx: number): string =>
    geo.dayKeys[idx] ?? geo.dayKeys[drag.origDayIdx];

  // All-day zone (#562): the pointer left the time body upward, i.e. it is over
  // the all-day lane (or the header just above it). A "move" becomes a
  // drop-to-all-day when the host opted in; a "place" reverts — the chip is
  // still all-day, so releasing here must write nothing. Without this branch
  // the lane's y used to be clamped into a time, which is how the 00:00
  // inverted full-day bands were minted.
  const overAllDayLane =
    (drag.mode === "place" || (drag.mode === "move" && geo.canDropAllDay)) &&
    geo.allDayLaneBottom != null &&
    pointer.y < geo.allDayLaneBottom;
  if (overAllDayLane) {
    return {
      dateISO: dateOf(drag.mode === "move" ? remapDay() : drag.origDayIdx),
      startMin: 0,
      endMin: 0,
      allDay: true,
      previewIsAllDay: true,
    };
  }

  let dayIdx = drag.origDayIdx;
  let startMin = drag.origStartMin;
  let endMin: number;
  if (drag.mode === "place") {
    // Absolute drop: map the pointer's Y over the scroll body to a start time
    // (same mapping as empty-slot create). The day stays the chip's own — no
    // horizontal remap — and the block is kept fully in-window. The time grid
    // scrolls WITH the content, so its rect top already is the 00:00 line —
    // no scrollTop term (#563).
    const mins =
      geo.timeGridTop != null
        ? pxToMinutes(
            pointer.y - geo.timeGridTop,
            geo.hourHeight,
            geo.hourRange,
          )
        : drag.origStartMin;
    startMin = Math.min(
      Math.max(snapMinutes(mins, geo.snapStep), startHour * 60),
      endHour * 60 - drag.durationMin,
    );
    endMin = startMin + drag.durationMin;
  } else if (drag.mode === "move") {
    // Clamp inside the visible window (#562): an unclamped overshoot past
    // either edge used to snap to a negative / >24:00 start, and minutesToTime
    // then flattened both ends onto the same minute — the inverted span the
    // grid draws as an uneditable full-day band.
    startMin = clamp(
      snapMinutes(drag.origStartMin + deltaMin, geo.snapStep),
      startHour * 60,
      Math.max(startHour * 60, endHour * 60 - drag.durationMin),
    );
    endMin = startMin + drag.durationMin;
    dayIdx = remapDay();
  } else {
    endMin = Math.max(
      snapMinutes(
        drag.origStartMin + drag.durationMin + deltaMin,
        geo.snapStep,
      ),
      drag.origStartMin + geo.snapStep,
    );
  }
  return {
    dateISO: dateOf(dayIdx),
    startMin,
    endMin,
    allDay: false,
    // "place" flips the previewed chip to timed so it leaves the all-day lane.
    previewIsAllDay: drag.mode === "place" ? false : undefined,
  };
}

/**
 * Lay out the TIMED items of a single day (all-day items are filtered out —
 * callers render those in a separate lane). Returns positions in the SAME
 * order as the input array. Overlapping items are packed into the minimum
 * number of side-by-side columns via a left-to-right sweep; every item in an
 * overlap cluster reports the cluster's total column count so the caller can
 * compute equal widths (`100 / columns`%). This is the deliberately "素朴な"
 * (naive) column packing the W8 plan calls for — no lane optimisation.
 */
export function layoutDayItems(
  items: GridLayoutItem[],
  hourRange: HourRange = [0, 24],
): PositionedItem[] {
  const [startHour, endHour] = hourRange;
  const rangeStart = startHour * 60;
  const rangeEnd = endHour * 60;
  const span = Math.max(rangeEnd - rangeStart, 1);

  const timed = items
    .map((it, idx) => ({ it, idx }))
    .filter(({ it }) => !it.isAllDay)
    .map(({ it, idx }) => {
      const rawStart = minutesFromMidnight(it.startTime);
      const rawEnd = minutesFromMidnight(it.endTime);
      // Overnight / inverted times (end <= start) don't span columns; treat
      // them as running to the end of the visible window instead of folding
      // into a min-height sliver at the bottom of the start day.
      const effEnd = rawEnd <= rawStart ? rangeEnd : rawEnd;
      const start = clamp(rawStart, rangeStart, rangeEnd);
      const end = clamp(
        Math.max(effEnd, rawStart + MIN_ITEM_MINUTES),
        rangeStart,
        rangeEnd,
      );
      return { id: it.id, idx, start, end };
    });

  // Sweep order: earliest start first, then earliest end.
  const order = timed
    .slice()
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const columnByItem = new Map<string, number>();
  const columnsByItem = new Map<string, number>();

  let cluster: typeof order = [];
  let clusterEnd = -Infinity;

  const flush = (): void => {
    if (cluster.length === 0) return;
    const colEnds: number[] = []; // running end-minute per column
    for (const g of cluster) {
      let placed = -1;
      for (let c = 0; c < colEnds.length; c++) {
        if (g.start >= colEnds[c]) {
          placed = c;
          break;
        }
      }
      if (placed === -1) {
        placed = colEnds.length;
        colEnds.push(g.end);
      } else {
        colEnds[placed] = g.end;
      }
      columnByItem.set(g.id, placed);
    }
    const totalCols = colEnds.length;
    for (const g of cluster) columnsByItem.set(g.id, totalCols);
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const g of order) {
    // A new cluster begins when this item starts at/after every prior item's
    // end (no transitive overlap with the open cluster).
    if (cluster.length > 0 && g.start >= clusterEnd) flush();
    cluster.push(g);
    clusterEnd = Math.max(clusterEnd, g.end);
  }
  flush();

  // Emit back in original input order (timed only).
  return order
    .slice()
    .sort((a, b) => a.idx - b.idx)
    .map((g) => ({
      id: g.id,
      topPct: ((g.start - rangeStart) / span) * 100,
      heightPct: ((g.end - g.start) / span) * 100,
      column: columnByItem.get(g.id) ?? 0,
      columns: columnsByItem.get(g.id) ?? 1,
    }));
}

// ── Local date-key arithmetic (YYYY-MM-DD, no UTC) ────────────────────────

export function parseDateKey(key: string): { y: number; m: number; d: number } {
  const [y, m, d] = key.split("-").map(Number);
  return { y, m, d };
}

/**
 * LOCAL `Date` for a `YYYY-MM-DD` key, optionally at a `HH:MM` wall time.
 *
 * Always build day-keyed dates through this — never `new Date(key)`, which
 * parses the key as UTC midnight and lands on the previous day in negative
 * timezones. Ten call sites across `shared/` and `web/` hand-wrote
 * `const [y, m, d] = key.split("-").map(Number); new Date(y, m - 1, d)`
 * (#670 C3 PR 3); the `m - 1` is the part that is easy to get wrong, so it
 * is spelled once here.
 */
export function dateFromKey(key: string, timeHHMM?: string): Date {
  const { y, m, d } = parseDateKey(key);
  if (timeHHMM === undefined) return new Date(y, m - 1, d);
  const [hh, mm] = timeHHMM.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

// Renamed from `formatDateKey` (C6): the old name collided with the 1-arg
// Date formatter in utils/dateKey.ts that the root barrel exports.
export function formatDateKeyFromParts(
  y: number,
  m: number,
  d: number,
): string {
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

/** Day-of-week for a local date key: 0 (Sun) – 6 (Sat). */
export function dayOfWeek(key: string): number {
  const { y, m, d } = parseDateKey(key);
  return new Date(y, m - 1, d).getDay();
}

/** Add `delta` days to a local date key (handles month/year rollover). */
export function addDaysKey(key: string, delta: number): string {
  const { y, m, d } = parseDateKey(key);
  const dt = new Date(y, m - 1, d + delta);
  return formatDateKeyFromParts(
    dt.getFullYear(),
    dt.getMonth() + 1,
    dt.getDate(),
  );
}

/**
 * Week start day: 0 = Sunday, 1 = Monday.
 *
 * The app runs on Sunday and nothing switches it (#1102) — the stored
 * week-start pref (#217) and its hook are gone. The type stays because the
 * grid math below still takes the day as a parameter.
 */
export type WeekStartsOn = 0 | 1;

/**
 * The one week start the whole app reads (#1102). Consumers pass this to the
 * grid math instead of resolving a preference.
 *
 * The math keeps its parameter rather than hardcoding 0 inside: the Monday case
 * is the only thing that exercises the step-back arithmetic, and that
 * arithmetic is exactly what drifted in #860 (the Work tab kept a private
 * Monday-only copy). A test that can only ask for Sunday cannot tell a correct
 * implementation from `return key`.
 */
export const WEEK_STARTS_ON: WeekStartsOn = 0;

/**
 * Snap a date key back to the first day of its week.
 * `weekStartsOn`: 0 = Sunday (default), 1 = Monday.
 */
export function startOfWeekKey(key: string, weekStartsOn: 0 | 1 = 0): string {
  const dow = dayOfWeek(key);
  const diff = (dow - weekStartsOn + 7) % 7;
  return addDaysKey(key, -diff);
}

/** The `days` consecutive date keys starting at `weekStartKey`. */
export function weekDayKeys(weekStartKey: string, days = 7): string[] {
  return Array.from({ length: days }, (_, i) => addDaysKey(weekStartKey, i));
}

// ── Month-grid date math (W8 month view) ─────────────────────────────────
//
// Same "no UTC" discipline as the week helpers: all arithmetic goes through
// `new Date(y, m-1, d)` (LOCAL parts) so a YYYY-MM-DD key never drifts a day
// in a negative timezone. The month grid backs MonthGrid (Desktop cells +
// Mobile dots).

/** Snap a date key to the first day of its month (YYYY-MM-01). */
export function startOfMonthKey(key: string): string {
  const { y, m } = parseDateKey(key);
  return formatDateKeyFromParts(y, m, 1);
}

/**
 * Add `delta` months to a date key, landing on the FIRST of the resulting
 * month (the day is dropped — the only use is month navigation, where a
 * clamped day would be ambiguous across 28–31-day months). Handles year
 * rollover via the local Date constructor's normalization.
 */
export function addMonthsKey(key: string, delta: number): string {
  const { y, m } = parseDateKey(key);
  const dt = new Date(y, m - 1 + delta, 1);
  return formatDateKeyFromParts(dt.getFullYear(), dt.getMonth() + 1, 1);
}

/**
 * Build the calendar grid for the month containing `key`: a 7-column × N-row
 * (N = 4–6) matrix of date keys, aligned so each row starts on `weekStartsOn`
 * (0 = Sunday default, 1 = Monday). The grid is padded with the trailing days
 * of the previous month and the leading days of the next month so every cell
 * is filled (callers dim the out-of-month cells). Rows are added until the
 * whole month is covered AND the last row completes its week.
 */
export function monthGridKeys(
  key: string,
  weekStartsOn: 0 | 1 = 0,
): string[][] {
  const first = startOfMonthKey(key);
  const { y, m } = parseDateKey(first);
  // Last day of this month = day 0 of the next month.
  const lastDay = new Date(y, m, 0).getDate();
  const gridStart = startOfWeekKey(first, weekStartsOn);
  // Days from gridStart to the last of the month, then round up to a full week.
  const lastKey = formatDateKeyFromParts(y, m, lastDay);
  let cursor = gridStart;
  const flat: string[] = [];
  // Emit at least until we pass the month's last day, then finish the week.
  do {
    flat.push(cursor);
    cursor = addDaysKey(cursor, 1);
  } while (cursor <= lastKey || flat.length % 7 !== 0);
  const rows: string[][] = [];
  for (let i = 0; i < flat.length; i += 7) rows.push(flat.slice(i, i + 7));
  return rows;
}
