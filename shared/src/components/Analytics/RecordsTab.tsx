import { useEffect, useMemo, useState } from "react";
import { Clock, Hash, Receipt, Sigma, TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AppRecord } from "../../types/appRecord";
import { APP_RECORD_SOURCE_CLAUDE } from "../../types/appRecord";
import type { ExtensionApp } from "../../types/extensionApp";
import {
  RECORD_VIEW_CHARTS,
  RECORD_VIEW_METRICS,
  type RecordView,
  type RecordViewChart,
  type RecordViewMetric,
} from "../../types/recordView";
import { formatDateKey } from "../../utils/dateKey";
import { cn } from "../cn";
import { NoticePanel } from "../NoticePanel";
import { dateRangeDays, useAnalyticsFilter } from "./AnalyticsFilterContext";
import { AnalyticsEmptyState } from "./AnalyticsEmptyState";
import { AnalyticsStatCard } from "./AnalyticsStatCard";
import { ChartCard } from "./ChartCard";
import {
  CHART_GRID,
  CHART_HEIGHT_MD,
  CHART_TICK_11,
  CHART_TOOLTIP_STYLE,
  type ChartAxisFormat,
} from "./chartTheme";
import type { RecordsLabels } from "./labels";
import {
  RECORDS_FILTER_ALL,
  barDateKey,
  buildRecordBars,
  distinctSorted,
  filterDated,
  formatRecordMetric,
  indexRecordViews,
  kindTotals,
  recordChartFor,
  recordMetricFor,
  recordViewKey,
  recordsGroupBy,
  recordsWithinDays,
  summarizeRecords,
  withDateKeys,
} from "./recordsModel";

/*
 * Analytics "Records" tab (#2164) — the numbers an extension app or the owner's
 * own Claude sent (`app_records`), read as a list and a few totals. PURE
 * PRESENTATION: the host loads the records and the ledger and injects copy
 * (§6.4). It only READS records; nothing here creates, edits or deletes one
 * (plan: those are the MCP tools' and the apps' job).
 *
 * The host fetches a window at least as wide as the date-range preset, so the
 * tab narrows it again by the preset itself — the same in-memory safety net
 * the Schedule tab keeps, which also makes a preset change correct for the
 * frame before the new read lands.
 *
 * The filters (app / kind) are local state: they live exactly as long as the
 * tab is on screen. `pendingSource` is the one outside way in — the Apps
 * section's "show records" (#2165) asks for an app, and the tab consumes that
 * once, the same shape as the shell's other pending intents.
 *
 * Which number leads each kind (#2263) is NOT local: the host keeps the saved
 * `record_views` rows and saves a pick through `onChooseMetric`, so the narrow
 * block on the phone shows the same choice. The chart's shape (#2264) is the
 * other half of the same row.
 */

/** Rows drawn before "show more": a busy app can send thousands. */
const PAGE_SIZE = 100;

const CHART_MARGIN = { top: 4, right: 8, left: 0, bottom: 0 };

/** The two per-kind selects on the "how each kind is shown" card. */
const VIEW_SELECT = cn(
  "rounded-lumen-md border border-lumen-border bg-lumen-bg px-2 py-1 text-xs text-lumen-text",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
);

export interface RecordsTabProps {
  /** Newest first, covering at least the selected date range. */
  records: readonly AppRecord[];
  /** The ledger — gives a slug its display name. Records may outlive a row. */
  apps: readonly Pick<ExtensionApp, "slug" | "name">[];
  /** True while the read for the selected range is in flight. */
  loading: boolean;
  /** Message of the failed read, or null. Said INSTEAD of "no records". */
  error: string | null;
  /** An app slug the shell wants filtered, or null (consume-once intent). */
  pendingSource: string | null;
  onPendingSourceConsumed: () => void;
  /** The saved per-kind choices (#2263). A kind with none leads with the sum. */
  views: readonly RecordView[];
  /** Saves which number leads `kind` + `unit`. */
  onChooseMetric: (
    kind: string,
    unit: string | null,
    metric: RecordViewMetric,
  ) => void;
  /** Saves which chart draws `kind` + `unit` (#2264). */
  onChooseChart: (
    kind: string,
    unit: string | null,
    chart: RecordViewChart,
  ) => void;
  /** True after a pick could not be saved (the host put the old one back). */
  viewSaveFailed: boolean;
  /**
   * The owner asked for less motion (the OS setting, or the app's own). recharts
   * animates in JS, out of reach of the CSS rule in tokens.css that stills
   * every transition, so the chart is told directly.
   */
  reduceMotion: boolean;
  labels: RecordsLabels;
  axis: ChartAxisFormat;
}

export function RecordsTab({
  records,
  apps,
  loading,
  error,
  pendingSource,
  onPendingSourceConsumed,
  views,
  onChooseMetric,
  onChooseChart,
  viewSaveFailed,
  reduceMotion,
  labels,
  axis,
}: RecordsTabProps): React.JSX.Element {
  const { dateRange } = useAnalyticsFilter();
  const [source, setSource] = useState<string>(
    pendingSource ?? RECORDS_FILTER_ALL,
  );
  const [kind, setKind] = useState<string>(RECORDS_FILTER_ALL);
  const [visible, setVisible] = useState(PAGE_SIZE);

  /*
   * Take the pending app. Adjusting state while rendering (not in an effect)
   * keeps the first paint on the right filter; `taken` remembers which request
   * was applied so the same slug asked for again later still lands, and a
   * request that is still standing is never applied twice.
   */
  const [taken, setTaken] = useState<string | null>(pendingSource);
  if (pendingSource !== null && pendingSource !== taken) {
    setTaken(pendingSource);
    setSource(pendingSource);
    setKind(RECORDS_FILTER_ALL);
    setVisible(PAGE_SIZE);
  } else if (pendingSource === null && taken !== null) {
    setTaken(null);
  }
  useEffect(() => {
    if (pendingSource !== null) onPendingSourceConsumed();
  }, [pendingSource, onPendingSourceConsumed]);

  const startKey = formatDateKey(dateRange.start);
  const endKey = formatDateKey(dateRange.end);
  const inRange = useMemo(
    () => recordsWithinDays(withDateKeys(records), startKey, endKey),
    [records, startKey, endKey],
  );

  const appNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const app of apps) names.set(app.slug, app.name);
    return names;
  }, [apps]);
  const sourceName = (slug: string): string =>
    slug === APP_RECORD_SOURCE_CLAUDE
      ? labels.claudeSource
      : (appNames.get(slug) ?? slug);

  const sourceOptions = useMemo(
    () =>
      distinctSorted(
        inRange.map((d) => d.record.sourceApp),
        source,
      ),
    [inRange, source],
  );
  const kindOptions = useMemo(
    () =>
      distinctSorted(
        filterDated(inRange, { source, kind: RECORDS_FILTER_ALL }).map(
          (d) => d.record.kind,
        ),
        kind,
      ),
    [inRange, source, kind],
  );

  const rows = useMemo(
    () => filterDated(inRange, { source, kind }),
    [inRange, source, kind],
  );
  const summary = useMemo(() => summarizeRecords(rows), [rows]);
  const viewIndex = useMemo(() => indexRecordViews(views), [views]);
  const totals = useMemo(() => kindTotals(rows), [rows]);
  // Mixed kinds cannot be added up or averaged, so their bars count rows.
  const metric: RecordViewMetric = summary.aggregable
    ? recordMetricFor(viewIndex, rows[0].record.kind, summary.unit)
    : "count";
  // Mixed kinds keep the bars they always had: a count has no trend to read.
  const chart: RecordViewChart = summary.aggregable
    ? recordChartFor(viewIndex, rows[0].record.kind, summary.unit)
    : "bar";
  const groupBy = recordsGroupBy(dateRangeDays(dateRange));
  const bars = useMemo(
    () => buildRecordBars(rows, groupBy, summary, startKey, endKey, metric),
    [rows, groupBy, summary, startKey, endKey, metric],
  );

  const filtering =
    source !== RECORDS_FILTER_ALL || kind !== RECORDS_FILTER_ALL;

  if (loading) return <RecordsSkeleton />;

  // A failed read leaves `records` empty, which is not "nothing recorded".
  if (error !== null && records.length === 0) {
    return (
      <NoticePanel tone="warning" role="status" message={labels.loadFailed} />
    );
  }

  if (inRange.length === 0 && !filtering) {
    return (
      <AnalyticsEmptyState
        icon={<Receipt size={26} />}
        title={labels.empty.title}
        description={labels.empty.description}
      />
    );
  }

  const unit = summary.unit;
  const barsInUnit = metric !== "count";
  const chartTitle = {
    sum: labels.chart.sumTitle,
    avg: labels.chart.avgTitle,
    latest: labels.chart.latestTitle,
    count: labels.chart.countTitle,
  }[metric];
  const seriesName = {
    sum: labels.chart.sumSeries,
    avg: labels.chart.avgSeries,
    latest: labels.chart.latestSeries,
    count: labels.chart.countSeries,
  }[metric];
  // An empty average / latest period has no bar at all (recordsModel).
  const chartData = bars.map((bar) => ({
    label: axis.date(barDateKey(bar.period), groupBy),
    value: bar.value ?? undefined,
  }));
  // Both chart shapes share the grid, the axes and the tooltip's wording.
  const axes = [
    <CartesianGrid key="grid" {...CHART_GRID} />,
    <XAxis
      key="x"
      dataKey="label"
      tick={CHART_TICK_11}
      tickLine={false}
      axisLine={false}
      interval="preserveStartEnd"
    />,
    <YAxis
      key="y"
      tick={CHART_TICK_11}
      tickLine={false}
      axisLine={false}
      allowDecimals={barsInUnit}
      width={56}
      tickFormatter={(v: number) => labels.formatNumber(v)}
    />,
  ];
  const tooltip = (value: number | undefined): [string, string] => [
    barsInUnit
      ? labels.formatValue(value ?? 0, unit)
      : labels.formatNumber(value ?? 0),
    seriesName,
  ];
  // The card of the chosen number says it leads; only one kind can have one.
  const headline = (card: RecordViewMetric): string | undefined =>
    summary.aggregable && card === metric ? labels.stats.headline : undefined;

  return (
    <div className="space-y-4">
      {error !== null ? (
        <NoticePanel tone="warning" role="status" message={labels.loadFailed} />
      ) : null}
      {viewSaveFailed ? (
        <NoticePanel
          tone="warning"
          role="status"
          message={labels.views.saveFailed}
        />
      ) : null}

      <div
        role="group"
        aria-label={labels.filtersLabel}
        className="flex flex-wrap items-end gap-3"
      >
        <FilterSelect
          label={labels.app.label}
          allLabel={labels.app.all}
          value={source}
          options={sourceOptions.map((slug) => ({
            value: slug,
            label: sourceName(slug),
          }))}
          onChange={(next) => {
            setSource(next);
            // A kind the new app never sent would leave the list empty.
            setKind(RECORDS_FILTER_ALL);
            setVisible(PAGE_SIZE);
          }}
        />
        <FilterSelect
          label={labels.kind.label}
          allLabel={labels.kind.all}
          value={kind}
          options={kindOptions.map((k) => ({ value: k, label: k }))}
          onChange={(next) => {
            setKind(next);
            setVisible(PAGE_SIZE);
          }}
        />
      </div>

      {rows.length === 0 ? (
        <AnalyticsEmptyState
          icon={<Receipt size={26} />}
          title={labels.emptyFiltered.title}
          description={labels.emptyFiltered.description}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
            <AnalyticsStatCard
              icon={<Hash size={16} />}
              label={labels.stats.count}
              value={String(summary.count)}
              subtitle={headline("count")}
              selected={headline("count") !== undefined}
              tone="accent"
            />
            <AnalyticsStatCard
              icon={<Sigma size={16} />}
              label={labels.stats.sum}
              value={
                summary.stats
                  ? labels.formatValue(summary.stats.sum, unit)
                  : "-"
              }
              subtitle={
                summary.aggregable ? headline("sum") : labels.stats.needOneKind
              }
              selected={headline("sum") !== undefined}
              tone="accent"
            />
            <AnalyticsStatCard
              icon={<TrendingUp size={16} />}
              label={labels.stats.avg}
              value={
                summary.stats
                  ? labels.formatValue(summary.stats.avg, unit)
                  : "-"
              }
              subtitle={headline("avg")}
              selected={headline("avg") !== undefined}
              tone="accent"
            />
            <AnalyticsStatCard
              icon={<Clock size={16} />}
              label={labels.stats.latest}
              value={
                summary.stats
                  ? labels.formatValue(summary.stats.latest, unit)
                  : "-"
              }
              subtitle={headline("latest")}
              selected={headline("latest") !== undefined}
              tone="accent"
            />
          </div>

          <ChartCard
            title={labels.views.title}
            legend={
              <p className="text-xs text-lumen-text-tertiary">
                {labels.views.description}
              </p>
            }
          >
            <ul className="flex flex-col">
              {totals.map((total) => {
                const chosen = recordMetricFor(
                  viewIndex,
                  total.kind,
                  total.unit,
                );
                const shape = recordChartFor(viewIndex, total.kind, total.unit);
                return (
                  <li
                    key={recordViewKey(total.kind, total.unit)}
                    className="flex flex-wrap items-center justify-between gap-3 border-t border-lumen-border py-2 first:border-t-0 first:pt-0"
                  >
                    <span className="min-w-0 text-sm font-medium text-lumen-text">
                      {total.kind}
                      {total.unit ? (
                        <span className="font-normal text-lumen-text-tertiary">
                          {" · "}
                          {total.unit}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="text-sm font-semibold tabular-nums text-lumen-text">
                        {formatRecordMetric(labels, total, total.unit, chosen)}
                      </span>
                      <select
                        aria-label={labels.views.selectLabel(total.kind)}
                        value={chosen}
                        onChange={(e) =>
                          onChooseMetric(
                            total.kind,
                            total.unit,
                            e.target.value as RecordViewMetric,
                          )
                        }
                        className={VIEW_SELECT}
                      >
                        {RECORD_VIEW_METRICS.map((option) => (
                          <option key={option} value={option}>
                            {labels.views.metrics[option]}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label={labels.views.chartSelectLabel(total.kind)}
                        value={shape}
                        onChange={(e) =>
                          onChooseChart(
                            total.kind,
                            total.unit,
                            e.target.value as RecordViewChart,
                          )
                        }
                        className={VIEW_SELECT}
                      >
                        {RECORD_VIEW_CHARTS.map((option) => (
                          <option key={option} value={option}>
                            {labels.views.charts[option]}
                          </option>
                        ))}
                      </select>
                    </span>
                  </li>
                );
              })}
            </ul>
          </ChartCard>

          <ChartCard title={chartTitle}>
            {/* Says what was drawn: jsdom cannot measure a chart to read it. */}
            <div
              data-chart={chart}
              data-motion={reduceMotion ? "reduced" : "full"}
            >
              <ResponsiveContainer
                width="100%"
                height={CHART_HEIGHT_MD}
                minWidth={0}
              >
                {chart === "line" ? (
                  <LineChart data={chartData} margin={CHART_MARGIN}>
                    {axes}
                    <Tooltip
                      cursor={{ stroke: "var(--color-lumen-border)" }}
                      contentStyle={CHART_TOOLTIP_STYLE}
                      formatter={tooltip}
                    />
                    {/* A day without a value is stepped over, not dropped to 0. */}
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="var(--color-lumen-accent)"
                      strokeWidth={2}
                      dot={{
                        r: 3,
                        fill: "var(--color-lumen-accent)",
                        strokeWidth: 0,
                      }}
                      activeDot={{
                        r: 4,
                        fill: "var(--color-lumen-accent)",
                        strokeWidth: 0,
                      }}
                      connectNulls
                      isAnimationActive={!reduceMotion}
                    />
                  </LineChart>
                ) : (
                  <BarChart data={chartData} margin={CHART_MARGIN}>
                    {axes}
                    <Tooltip
                      cursor={{ fill: "var(--color-lumen-hover)" }}
                      contentStyle={CHART_TOOLTIP_STYLE}
                      formatter={tooltip}
                    />
                    <Bar
                      dataKey="value"
                      fill="var(--color-lumen-accent)"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={!reduceMotion}
                    />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard
            title={labels.list.title}
            meta={
              rows.length > visible
                ? labels.list.shown(visible, rows.length)
                : undefined
            }
          >
            <ul className="flex flex-col">
              {rows.slice(0, visible).map(({ record }) => (
                <li
                  key={record.id}
                  className="flex items-start justify-between gap-3 border-t border-lumen-border py-2 first:border-t-0 first:pt-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-medium text-lumen-text">
                        {record.kind}
                      </span>
                      {Object.entries(record.dims)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([key, value]) => (
                          <span
                            key={key}
                            className="rounded-lumen-full bg-lumen-surface-sunken px-2 py-0.5 text-xs text-lumen-text-secondary"
                          >
                            {key}: {String(value)}
                          </span>
                        ))}
                    </div>
                    <p className="text-xs text-lumen-text-tertiary">
                      <time dateTime={record.occurredAt}>
                        {labels.formatDateTime(record.occurredAt)}
                      </time>
                      {" · "}
                      {sourceName(record.sourceApp)}
                      {record.note ? ` · ${record.note}` : ""}
                    </p>
                  </div>
                  <span className="flex-shrink-0 text-sm font-semibold tabular-nums text-lumen-text">
                    {labels.formatValue(record.value, record.unit)}
                  </span>
                </li>
              ))}
            </ul>
            {rows.length > visible ? (
              <button
                type="button"
                onClick={() => setVisible((n) => n + PAGE_SIZE)}
                className={cn(
                  "self-center rounded-lumen-md border border-lumen-border px-3 py-1.5 text-xs text-lumen-text-secondary",
                  "hover:bg-lumen-hover hover:text-lumen-text",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
                )}
              >
                {labels.list.showMore}
              </button>
            ) : null}
          </ChartCard>
        </>
      )}
    </div>
  );
}

interface FilterSelectProps {
  label: string;
  allLabel: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}

function FilterSelect({
  label,
  allLabel,
  value,
  options,
  onChange,
}: FilterSelectProps): React.JSX.Element {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-lumen-text-secondary">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "min-w-[10rem] rounded-lumen-md border border-lumen-border bg-lumen-bg px-3 py-1.5 text-sm text-lumen-text",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
        )}
      >
        <option value={RECORDS_FILTER_ALL}>{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/* The tab's frame while the read is in flight: no zero flash. */
function RecordsSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-[86px] animate-pulse rounded-lumen-lg border border-lumen-border bg-lumen-bg-secondary"
          />
        ))}
      </div>
      <div className="h-56 animate-pulse rounded-lumen-lg border border-lumen-border bg-lumen-bg-secondary" />
    </div>
  );
}
