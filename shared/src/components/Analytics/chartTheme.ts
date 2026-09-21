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

/*
 * Fit a category label into a fixed-width axis gutter (#1862).
 *
 * A recharts category axis takes its gutter in PX (`<YAxis width>`), and an
 * SVG <text> neither wraps nor clips to it — a label wider than the gutter
 * runs out of the left edge of the chart and is cut by the card. Truncating by
 * CHARACTER count cannot prevent that: twelve full-width characters are about
 * twice as wide as twelve Latin ones, so a cap that suits "Morning run" still
 * overflows for 「APIについて学んでみる」.
 *
 * jsdom has no layout and the chart has no canvas to measure with before it
 * mounts, so the width is estimated from the code point: East Asian wide /
 * full-width glyphs advance a full em, everything else 0.62em — deliberately
 * on the generous side of a proportional Latin face, so the estimate errs
 * toward truncating early rather than overflowing.
 */
const WIDE_GLYPH_EM = 1;
const NARROW_GLYPH_EM = 0.62;
const ELLIPSIS = "…";

function isWideGlyph(codePoint: number): boolean {
  return (
    (codePoint >= 0x1100 && codePoint <= 0x115f) || // Hangul Jamo
    (codePoint >= 0x2e80 && codePoint <= 0xa4cf) || // CJK, kana, radicals
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) || // Hangul syllables
    (codePoint >= 0xf900 && codePoint <= 0xfaff) || // CJK compatibility
    (codePoint >= 0xfe30 && codePoint <= 0xfe4f) || // CJK compatibility forms
    (codePoint >= 0xff00 && codePoint <= 0xff60) || // full-width forms
    (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
    codePoint >= 0x1f300 // emoji and the supplementary ideographic planes
  );
}

/** Estimated rendered width of `text` in px at `fontSize`. */
export function estimateLabelWidth(text: string, fontSize: number): number {
  let em = 0;
  for (const ch of text) {
    em += isWideGlyph(ch.codePointAt(0) ?? 0) ? WIDE_GLYPH_EM : NARROW_GLYPH_EM;
  }
  return em * fontSize;
}

/** `text`, cut with an ellipsis so its estimated width stays within `maxPx`. */
export function fitAxisLabel(
  text: string,
  maxPx: number,
  fontSize: number,
): string {
  if (estimateLabelWidth(text, fontSize) <= maxPx) return text;
  const budget = maxPx - estimateLabelWidth(ELLIPSIS, fontSize);
  let out = "";
  let width = 0;
  // Iterating the string walks code points, so a surrogate pair is never split.
  for (const ch of text) {
    const w =
      (isWideGlyph(ch.codePointAt(0) ?? 0) ? WIDE_GLYPH_EM : NARROW_GLYPH_EM) *
      fontSize;
    if (width + w > budget) break;
    out += ch;
    width += w;
  }
  return out.trimEnd() + ELLIPSIS;
}

/*
 * One axis vocabulary per tab (#1864).
 *
 * The Work tab read "1時間2分" on its stat tiles, "0.15h" on the chart under
 * them and "0m / 8m" on the chart beside that, and its four date axes used
 * four formats ("9/8", "09-08", "2026/9", "8/23~") — none of which followed
 * the language, because each chart hardcoded its own. Charts now take this
 * pair of formatters instead. The host builds it once (copy arrives through
 * props in this codebase — the shared tree never calls useTranslation), so
 * every axis and tooltip on a tab speaks the same units as the tiles above it.
 */
export type AxisDateUnit = "day" | "week" | "month";

export interface ChartAxisFormat {
  /** A duration in MINUTES, in the host's language ("1h 30m" / "1時間30分"). */
  duration: (minutes: number) => string;
  /**
   * A bucket's local `YYYY-MM-DD` key. `unit` says what the bucket covers: a
   * week key is the week's first day, a month key is the 1st of the month.
   */
  date: (dateKey: string, unit: AxisDateUnit) => string;
}

/*
 * Language-neutral fallback for a chart mounted outside Analytics (the
 * Briefing panel draws WorkBreakBalance with labels of its own). It prints what
 * that chart printed before #1864, so such a host is unchanged until it passes
 * a real format.
 */
export const FALLBACK_AXIS_FORMAT: ChartAxisFormat = {
  duration: (minutes) => `${Math.round(minutes)}m`,
  date: (dateKey, unit) =>
    unit === "month" ? dateKey.substring(0, 7) : dateKey.substring(5),
};

/** Gutter for a duration axis — "1時間30分" at 11px needs more than the default 60. */
export const DURATION_AXIS_WIDTH = 64;
