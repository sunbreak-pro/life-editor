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

export type AnalyticsTab = "overview" | "tasks" | "work" | "schedule";

/*
 * Canonical tab order (SSOT). Shared by the shell's tab band and the view's
 * content so the two never drift (数値の非複製原則).
 */
export const ANALYTICS_TAB_ORDER: readonly AnalyticsTab[] = [
  "overview",
  "tasks",
  "work",
  "schedule",
];
