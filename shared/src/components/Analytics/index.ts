/*
 * Analytics feature sub-barrel (W4 · lean). Exposes the presentational
 * dashboard root + the typed labels contract to hosts. The chart/tab
 * components and the internal AnalyticsFilterContext are NOT exported — the
 * host only ever mounts <AnalyticsView> and feeds it data + labels (§6.4).
 * The global components/index.ts re-exports this with `export *`.
 */
export { AnalyticsView, type AnalyticsViewProps } from "./AnalyticsView";
export type { AnalyticsLabels } from "./labels";
