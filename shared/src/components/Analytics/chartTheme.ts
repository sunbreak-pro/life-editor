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

export const CHART_TOOLTIP_STYLE = {
  background: "var(--color-lumen-bg)",
  border: "1px solid var(--color-lumen-border)",
  borderRadius: 8,
  fontSize: 12,
} as const;
