export function hhmmToMinutes(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function minutesToHHMM(total: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, total));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function snapMinutes(minutes: number, snap: number): number {
  if (snap <= 0) return minutes;
  return Math.round(minutes / snap) * snap;
}

/**
 * Convert a vertical pixel offset (measured from the grid's 0:00 origin —
 * i.e., after accounting for `dayStartHour`) to an absolute minute-of-day.
 */
export function topPxToMinutes(
  topPx: number,
  hourPx: number,
  dayStartHour: number,
): number {
  return dayStartHour * 60 + (topPx / hourPx) * 60;
}

/**
 * Given a new top offset for the block, compute snapped start/end HH:MM
 * strings that preserve the block's duration. Clamps within [0, 24:00].
 */
export function computeShiftedTimes(params: {
  newTopPx: number;
  durationMinutes: number;
  hourPx: number;
  dayStartHour: number;
  snap: number;
}): { start: string; end: string; snappedStartMin: number } {
  const { newTopPx, durationMinutes, hourPx, dayStartHour, snap } = params;
  const rawStart = topPxToMinutes(newTopPx, hourPx, dayStartHour);
  let startMin = snapMinutes(rawStart, snap);
  // keep within day
  startMin = Math.max(0, Math.min(24 * 60 - durationMinutes, startMin));
  const endMin = Math.min(24 * 60, startMin + durationMinutes);
  return {
    start: minutesToHHMM(startMin),
    end: minutesToHHMM(endMin),
    snappedStartMin: startMin,
  };
}
