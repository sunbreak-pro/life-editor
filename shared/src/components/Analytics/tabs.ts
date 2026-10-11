/*
 * Analytics tab vocabulary — deliberately in its own chart-free module.
 *
 * The shell (web useShellChrome) builds the lifted SectionHeader tab band from
 * ANALYTICS_TAB_ORDER, and the shell is part of the initial chunk. While these
 * two lines lived in AnalyticsView.tsx, that one import pulled the whole
 * dashboard — every tab, every recharts chart — into the initial chunk, which
 * defeated the lazy Analytics section (#676 (a)). Splitting the vocabulary out
 * keeps the SSOT intact (AnalyticsView still reads THIS list for its content)
 * while letting the charts stay behind the lazy boundary.
 */

export type AnalyticsTab =
  "overview" | "todos" | "work" | "schedule" | "records";

/*
 * Canonical tab order (SSOT). Shared by the shell's tab band and the view's
 * content so the two never drift (数値の非複製原則).
 *
 * `records` (#2164) goes last: the extension-app numbers are the one tab the
 * Analytics freeze was lifted for (D-20261008-main-1 Q4), and appending it
 * leaves the four frozen tabs where the user already finds them.
 */
export const ANALYTICS_TAB_ORDER: readonly AnalyticsTab[] = [
  "overview",
  "todos",
  "work",
  "schedule",
  "records",
];
