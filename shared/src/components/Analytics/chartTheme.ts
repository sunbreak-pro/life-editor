/*
 * Shared recharts prop constants for the Analytics charts (C2 dedup).
 * recharts matches Grid/Axis/Tooltip children by element type, so wrapping
 * them in a custom component would silently drop them from the chart —
 * shared prop objects are the safe consolidation unit.
 */

export const CHART_GRID = {
  strokeDasharray: "3 3",
  stroke: "var(--color-lumen-border)",
} as const;

/** Axis tick style (10px — the Analytics default). */
export const CHART_TICK = {
  fontSize: 10,
  fill: "var(--color-lumen-text-secondary)",
} as const;

/** 11px tick variant used by the wide work-time charts. */
export const CHART_TICK_11 = {
  fontSize: 11,
  fill: "var(--color-lumen-text-secondary)",
} as const;

/*
 * Chart heights in px, passed to <ResponsiveContainer height={...}> instead of
 * wrapping it in a fixed-height div and asking for height="100%" (#948).
 *
 * recharts warns "The width(-1) and height(-1) of chart should be greater than
 * 0" on EVERY first mount when both dimensions are percentages: the size state
 * starts at the default `initialDimension` of {-1, -1}
 * (recharts/es6/component/responsiveContainerUtils.js:7) and the ResizeObserver
 * that corrects it only runs in an effect, i.e. after that first render has
 * already logged. The warning's own suggestion (minWidth={0}) was already set
 * here and cannot help. A numeric height satisfies the check — it is an OR over
 * the two dimensions (ResponsiveContainer.js:135) — while width stays "100%",
 * so the chart is just as responsive and still renders nothing until the real
 * width is measured (no first-frame flash at a guessed size).
 *
 * The values are the px of the Tailwind classes these replaced (h-40 / h-48 /
 * h-64), so the layout is unchanged.
 */
export const CHART_HEIGHT_SM = 160;
export const CHART_HEIGHT_MD = 192;
export const CHART_HEIGHT_LG = 256;

export const CHART_TOOLTIP_STYLE = {
  background: "var(--color-lumen-bg)",
  border: "1px solid var(--color-lumen-border)",
  borderRadius: 8,
  fontSize: 12,
} as const;
