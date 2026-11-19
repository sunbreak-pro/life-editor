/*
 * recharts prop constants for the briefing's Todo completion chart. They came
 * over from the retired Analytics section (#2754) with the one chart that
 * survived it, so the panel draws exactly as it did.
 *
 * recharts matches Grid/Axis/Tooltip children by element type, so wrapping
 * them in a custom component would silently drop them from the chart —
 * shared prop objects are the safe consolidation unit.
 */

export const CHART_GRID = {
  strokeDasharray: "3 3",
  stroke: "var(--color-lumen-border)",
} as const;

export const CHART_TICK = {
  fontSize: 10,
  fill: "var(--color-lumen-text-secondary)",
} as const;

/*
 * A numeric height rather than height="100%" (#948): with both dimensions as
 * percentages recharts warns "The width(-1) and height(-1) of chart should be
 * greater than 0" on every first mount, because its size state starts at
 * {-1, -1} and the ResizeObserver that corrects it only runs in an effect.
 * 192px is the h-48 this replaced.
 */
export const CHART_HEIGHT_MD = 192;

export const CHART_TOOLTIP_STYLE = {
  background: "var(--color-lumen-bg)",
  border: "1px solid var(--color-lumen-border)",
  borderRadius: 8,
  fontSize: 12,
} as const;

/*
 * Evenly spaced ticks for a day-bucket axis (#1866).
 *
 * `interval="preserveStartEnd"` thins labels at a fixed stride from the START,
 * so the last gap is whatever is left over. This axis ends on today, the label
 * that matters most, so the ticks are laid out at one stride counting back from
 * the END — every gap is equal, and the leftover lands at the far left.
 *
 * Returned as the label VALUES recharts expects in `<XAxis ticks>`; pair it
 * with `interval={0}` so recharts does not thin them a second time.
 */
export const MAX_DATE_TICKS = 7;

/*
 * Tick budget for the phone's detail drawer (#2505). The drawer is ~316px wide
 * on a 390px phone, which leaves the plot about 200px: seven "10-27" labels at
 * 10px touched and read as one run of digits. Four ticks on a 7-day axis is
 * every other day counted back from today.
 */
export const NARROW_MAX_DATE_TICKS = 4;

export function evenDateTicks(
  labels: readonly string[],
  maxTicks: number = MAX_DATE_TICKS,
): string[] {
  const n = labels.length;
  if (n <= maxTicks) return [...labels];
  const stride = Math.ceil((n - 1) / (maxTicks - 1));
  const ticks: string[] = [];
  for (let i = n - 1; i >= 0; i -= stride) ticks.unshift(labels[i]);
  return ticks;
}
