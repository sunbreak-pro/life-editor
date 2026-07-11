/*
 * Analytics feature sub-barrel (W4 · lean). Exposes the presentational
 * dashboard root + the typed labels contract to hosts. The chart/tab
 * components stay internal, and AnalyticsFilterContext exposes only the
 * `DateRange` type (host per-range fetch) — never its provider/hook. The host
 * only ever mounts <AnalyticsView> and feeds it data + labels (§6.4).
 * The global components/index.ts re-exports this with `export *`.
 */
export {
  AnalyticsView,
  ANALYTICS_TAB_ORDER,
  type AnalyticsViewProps,
  type AnalyticsTab,
} from "./AnalyticsView";
export type { AnalyticsLabels } from "./labels";
// The date-range shape the host receives via onScheduleRangeChange (per-range
// fetch). The AnalyticsFilterContext itself stays internal; only this type
// crosses the host boundary.
export type { DateRange } from "./AnalyticsFilterContext";
