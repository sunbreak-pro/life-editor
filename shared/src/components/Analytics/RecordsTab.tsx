import { useEffect, useMemo, useState } from "react";
import { Hash, Receipt, Sigma, TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AppRecord } from "../../types/appRecord";
import { APP_RECORD_SOURCE_CLAUDE } from "../../types/appRecord";
import type { ExtensionApp } from "../../types/extensionApp";
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
 */

/** Rows drawn before "show more": a busy app can send thousands. */
const PAGE_SIZE = 100;

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
  const groupBy = recordsGroupBy(dateRangeDays(dateRange));
  const bars = useMemo(
    () => buildRecordBars(rows, groupBy, summary, startKey, endKey),
    [rows, groupBy, summary, startKey, endKey],
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
  const barsAreSums = summary.aggregable;
  const seriesName = barsAreSums
    ? labels.chart.sumSeries
    : labels.chart.countSeries;
  const chartData = bars.map((bar) => ({
    label: axis.date(barDateKey(bar.period), groupBy),
    value: bar.value,
  }));

  return (
    <div className="space-y-4">
      {error !== null ? (
        <NoticePanel tone="warning" role="status" message={labels.loadFailed} />
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
          <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-3">
            <AnalyticsStatCard
              icon={<Hash size={16} />}
              label={labels.stats.count}
              value={String(summary.count)}
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
                summary.aggregable ? undefined : labels.stats.needOneKind
              }
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
              tone="accent"
            />
          </div>

          <ChartCard
            title={
              barsAreSums ? labels.chart.sumTitle : labels.chart.countTitle
            }
          >
            <ResponsiveContainer
              width="100%"
              height={CHART_HEIGHT_MD}
              minWidth={0}
            >
              <BarChart
                data={chartData}
                margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid {...CHART_GRID} />
                <XAxis
                  dataKey="label"
                  tick={CHART_TICK_11}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={CHART_TICK_11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={barsAreSums}
                  width={56}
                  tickFormatter={(v: number) => labels.formatNumber(v)}
                />
                <Tooltip
                  cursor={{ fill: "var(--color-lumen-hover)" }}
                  contentStyle={CHART_TOOLTIP_STYLE}
                  formatter={(value: number | undefined) => [
                    barsAreSums
                      ? labels.formatValue(value ?? 0, unit)
                      : labels.formatNumber(value ?? 0),
                    seriesName,
                  ]}
                />
                <Bar
                  dataKey="value"
                  fill="var(--color-lumen-accent)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
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
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
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
