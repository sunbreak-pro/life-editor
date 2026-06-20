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

export function clamp(value: number, lo: number, hi: number): number {
  return Math.min(Math.max(value, lo), hi);
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

export function formatDateKey(y: number, m: number, d: number): string {
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
  return formatDateKey(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}

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
