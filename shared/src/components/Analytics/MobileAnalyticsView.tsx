import { useEffect, useMemo, useState } from "react";
import { Flame, Trophy, BarChart3 } from "lucide-react";
import type { TimerSession } from "../../types/timer";
import type { TodoNode } from "../../types/todoTree";
import type { ScheduleItem } from "../../types/schedule";
import type { NoteNode } from "../../types/note";
import type { RoutineNode } from "../../types/routine";
import {
  APP_RECORD_SOURCE_CLAUDE,
  type AppRecord,
} from "../../types/appRecord";
import type { ExtensionApp } from "../../types/extensionApp";
import type { RecordView } from "../../types/recordView";
import {
  dateKeyOfInstant,
  formatDateKey,
  todayCalendarKey,
} from "../../utils/dateKey";
import {
  aggregateCalendarWeekByDay,
  aggregateRoutineCompletion,
  calendarWeekRange,
  computeWorkStreak,
  createdWithinRange,
  getWorkSessions,
} from "../../utils/analyticsAggregation";
import { WEEK_STARTS_ON } from "../../utils/scheduleGridLayout";
import { NoticePanel } from "../NoticePanel";
import { AnalyticsEmptyState } from "./AnalyticsEmptyState";
import type { AnalyticsLabels } from "./labels";
import { RecordSparkline } from "./RecordSparkline";
import {
  formatRecordMetric,
  indexRecordViews,
  recentKindSeries,
  recentKindTotals,
  recordChartFor,
  recordMetricFor,
  recordViewKey,
  withDateKeys,
} from "./recordsModel";

/*
 * Mobile (<768px) Analytics — a single Consumption scroll (design 1l–1o). No
 * tabs, no heatmap/timeline, no period switch: the range is a fixed last-30-day
 * window (the host's default preset). Order: 今日 → ストリーク → 今週 → stat 2×2
 * → ルーチン上位3 → 記録 (#2164, last 7 days per kind). Pure presentation: copy arrives already-translated (§6.4),
 * lumen-* tokens only (§5).
 */
interface MobileAnalyticsViewProps {
  sessions: TimerSession[];
  nodes: TodoNode[];
  todayItems: ScheduleItem[];
  /** Schedule items for the default (30d) range — routine rate + top routines. */
  scheduleItems: ScheduleItem[];
  notes: NoteNode[];
  routines: RoutineNode[];
  loading: boolean;
  /**
   * Already-translated sentence naming the data the host could not read
   * (#1524), or null. Drawn ABOVE the empty state as well as above the
   * cards, because a failed load empties every list — and "nothing recorded
   * yet" is exactly the wrong thing to say then.
   */
  warning?: string | null;
  /**
   * Extension-app records (#2164). The block reads the last seven days out of
   * whatever the host loaded, so the host's window must reach that far.
   */
  records?: AppRecord[];
  /**
   * The records read is still in flight (#2214): the block draws a skeleton
   * instead of "none", which would be a claim about records not yet read.
   */
  recordsLoading?: boolean;
  /** The records read failed: the block says so instead of "none". */
  recordsError?: string | null;
  /**
   * Which number leads each kind (#2263) — the same saved rows the wide
   * Records tab picks. A kind with none leads with the sum.
   */
  recordViews?: readonly RecordView[];
  /** The ledger, for the narrowed app's display name (#2312). */
  recordApps?: readonly Pick<ExtensionApp, "slug" | "name">[];
  /**
   * An app slug the Apps section's "show records" asks the block to narrow
   * to (#2312), consumed once — the wide Records tab's `pendingSource` twin.
   * The narrowing then lives as long as this view does.
   */
  pendingRecordsSource?: string | null;
  onRecordsSourceConsumed?: () => void;
  labels: AnalyticsLabels;
}

/** The records block covers this many calendar days, today included. */
const RECORDS_WINDOW_DAYS = 7;

const DOW_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function isEmpty(p: MobileAnalyticsViewProps): boolean {
  return (
    p.sessions.length === 0 &&
    p.nodes.length === 0 &&
    p.routines.length === 0 &&
    p.notes.length === 0 &&
    p.scheduleItems.length === 0 &&
    p.todayItems.length === 0 &&
    // Records still being read are not "no records" (#2214).
    !p.recordsLoading &&
    (p.records?.length ?? 0) === 0
  );
}

export function MobileAnalyticsView(
  props: MobileAnalyticsViewProps,
): React.JSX.Element {
  const {
    sessions,
    nodes,
    todayItems,
    scheduleItems,
    notes,
    routines,
    warning,
    records,
    recordsLoading,
    recordsError,
    recordViews,
    recordApps,
    pendingRecordsSource = null,
    onRecordsSourceConsumed,
    labels,
  } = props;

  /*
   * The app the block is narrowed to (#2312), or null for every app. Taken
   * from the pending request while rendering, the RecordsTab way: the first
   * paint is already narrowed, and `taken` lets the same slug asked for again
   * later still land.
   */
  const [source, setSource] = useState<string | null>(pendingRecordsSource);
  const [taken, setTaken] = useState<string | null>(pendingRecordsSource);
  if (pendingRecordsSource !== null && pendingRecordsSource !== taken) {
    setTaken(pendingRecordsSource);
    setSource(pendingRecordsSource);
  } else if (pendingRecordsSource === null && taken !== null) {
    setTaken(null);
  }
  useEffect(() => {
    if (pendingRecordsSource !== null) onRecordsSourceConsumed?.();
  }, [pendingRecordsSource, onRecordsSourceConsumed]);

  const shownRecords = useMemo(
    () =>
      source === null
        ? (records ?? [])
        : (records ?? []).filter((r) => r.sourceApp === source),
    [records, source],
  );
  const sourceName = useMemo(() => {
    if (source === null) return null;
    if (source === APP_RECORD_SOURCE_CLAUDE) return labels.records.claudeSource;
    return recordApps?.find((app) => app.slug === source)?.name ?? source;
  }, [source, recordApps, labels.records.claudeSource]);

  const viewIndex = useMemo(
    () => indexRecordViews(recordViews ?? []),
    [recordViews],
  );
  // Each kind's seven days in its chosen number, for the small chart (#2264).
  const recordSeries = useMemo(
    () =>
      recentKindSeries(
        withDateKeys(shownRecords),
        todayCalendarKey(),
        RECORDS_WINDOW_DAYS,
        viewIndex,
      ),
    [shownRecords, viewIndex],
  );

  const model = useMemo(() => {
    // Calendar day (#356) — the desktop TodayDashboard's twin. Analytics buckets
    // sessions by wall calendar date; the day-start-hour "today"
    // (todayDateKey) belongs to Daily / routine sync.
    const todayStr = todayCalendarKey();

    // Today
    const todaySessions = sessions.filter(
      (s) => formatDateKey(new Date(s.startedAt)) === todayStr,
    );
    const todayWorkMinutes = getWorkSessions(todaySessions).reduce(
      (sum, s) => sum + (s.duration ?? 0) / 60,
      0,
    );
    const pomodoroCount = todaySessions.filter(
      (s) => s.sessionType === "WORK" && s.completed,
    ).length;
    const completedToday = nodes.filter(
      (n) =>
        n.type === "task" &&
        n.completedAt &&
        // LOCAL day of the stored UTC instant (#420) — the desktop
        // TodayDashboard's twin, and the week window below does the same.
        dateKeyOfInstant(n.completedAt) === todayStr,
    ).length;

    // Streak
    const streak = computeWorkStreak(sessions);

    // This week — the calendar week, starting on the user's configured day.
    const now = new Date();
    const { startKey: weekStart, endKey: weekEnd } = calendarWeekRange(
      now,
      WEEK_STARTS_ON,
    );
    const weekWork = getWorkSessions(sessions).filter((s) => {
      const d = formatDateKey(new Date(s.startedAt));
      return d >= weekStart && d <= weekEnd;
    });
    const weekMinutes = weekWork.reduce(
      (sum, s) => sum + (s.duration ?? 0) / 60,
      0,
    );
    const weekCompleted = nodes.filter((n) => {
      if (n.type !== "task" || !n.completedAt) return false;
      const d = dateKeyOfInstant(n.completedAt);
      if (d === null) return false;
      return d >= weekStart && d <= weekEnd;
    }).length;
    // The SAME window as weekMinutes above (#860) — these bars used to be a
    // rolling 7 days, so mid-week the row and the number beside it covered
    // different days. Mid-week the not-yet-happened days now draw as empty.
    const weekBars = aggregateCalendarWeekByDay(sessions, now, WEEK_STARTS_ON);
    const weekMax = Math.max(...weekBars.map((b) => b.totalMinutes), 1);

    // Todos / notes / routine rate
    const todos = nodes.filter((n) => n.type === "task");
    const completedTodos = todos.filter((n) => n.status === "DONE").length;
    const todayEventsCompleted = todayItems.filter((i) => i.completed).length;
    // #375: the `type === "note"` half of this filter went away with the
    // folder type (every NoteNode is a note now).
    const activeNotes = notes.filter((n) => !n.isDeleted);
    // The SAME window as weekStart/weekEnd above (#780) — this card used to run
    // on a rolling 7 days, so two differently-defined "this week" numbers sat
    // side by side under one label. Unified per D-20260811-refactor-1 = A.
    const notesThisWeek = createdWithinRange(
      activeNotes,
      weekStart,
      weekEnd,
    ).length;

    const rangeItems = scheduleItems.filter((i) => !i.isDeleted);
    const routineItems = rangeItems.filter((i) => i.routineId);
    const routineCompleted = routineItems.filter((i) => i.completed).length;
    const routineRate =
      routineItems.length > 0
        ? Math.round((routineCompleted / routineItems.length) * 100)
        : 0;

    const topRoutines = aggregateRoutineCompletion(rangeItems, routines)
      .slice()
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 3);

    // Last 7 calendar days per kind, through the shared aggregation (#2162).
    const recordTotals = recentKindTotals(
      withDateKeys(shownRecords),
      todayStr,
      RECORDS_WINDOW_DAYS,
    );

    return {
      recordTotals,
      todayWorkMinutes,
      pomodoroCount,
      completedToday,
      streak,
      weekMinutes,
      weekCompleted,
      weekBars,
      weekMax,
      totalTodos: todos.length,
      completedTodos,
      todayEvents: todayItems.length,
      todayEventsCompleted,
      totalNotes: activeNotes.length,
      notesThisWeek,
      routineRate,
      topRoutines,
    };
  }, [
    sessions,
    nodes,
    todayItems,
    scheduleItems,
    notes,
    routines,
    shownRecords,
  ]);

  if (props.loading) {
    return <MobileSkeleton title={labels.title} />;
  }

  if (isEmpty(props)) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex-shrink-0 px-4 pb-1 pt-2">
          <h2 className="text-xl font-semibold text-lumen-text">
            {labels.title}
          </h2>
        </div>
        {warning ? (
          <div className="px-4 pb-2">
            <NoticePanel tone="warning" role="status" message={warning} />
          </div>
        ) : null}
        <AnalyticsEmptyState
          icon={<BarChart3 size={26} />}
          title={labels.emptyMobile.title}
          description={labels.emptyMobile.description}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex-shrink-0 px-4 pb-1 pt-2">
        <h2 className="text-xl font-semibold text-lumen-text">
          {labels.title}
        </h2>
      </div>
      <div className="flex flex-col gap-3 px-4 pb-4 pt-2">
        {warning ? (
          <NoticePanel tone="warning" role="status" message={warning} />
        ) : null}
        {/* Today (highlighted accent card) */}
        <div className="flex flex-col gap-3 rounded-lumen-lg border border-lumen-accent bg-lumen-accent-subtle p-4">
          <span className="text-sm font-semibold text-lumen-accent">
            {labels.todayCard.title}
          </span>
          <div className="grid grid-cols-3 gap-2">
            <MiniCol
              value={labels.formatHours(model.todayWorkMinutes)}
              label={labels.todayCard.workTime}
            />
            <MiniCol
              value={String(model.completedToday)}
              label={labels.todayCard.completedTodos}
            />
            <MiniCol
              value={String(model.pomodoroCount)}
              label={labels.todayCard.pomodoroCount}
            />
          </div>
        </div>

        {/* Streak */}
        <div className="grid grid-cols-2 gap-3 rounded-lumen-lg border border-lumen-border bg-lumen-bg-secondary p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-[34px] w-[34px] flex-shrink-0 place-items-center rounded-lumen-md bg-lumen-chip-progress-bg text-lumen-chip-progress-fg">
              <Flame size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-base font-semibold tabular-nums text-lumen-text">
                {model.streak.currentStreak}
              </p>
              <p className="text-xs text-lumen-text-secondary">
                {labels.streak.current}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 border-l border-lumen-border pl-3">
            <span className="grid h-[34px] w-[34px] flex-shrink-0 place-items-center rounded-lumen-md bg-lumen-chip-mint-bg text-lumen-chip-mint-fg">
              <Trophy size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-base font-semibold tabular-nums text-lumen-text">
                {model.streak.longestStreak}
              </p>
              <p className="text-xs text-lumen-text-secondary">
                {labels.streak.longest}
              </p>
            </div>
          </div>
        </div>

        {/* This week + mini bars */}
        <div className="flex flex-col gap-3 rounded-lumen-lg border border-lumen-border bg-lumen-bg-secondary p-4">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold text-lumen-text">
              {labels.mobile.weekTitle}
            </span>
            <span className="text-xs text-lumen-text-tertiary">
              {labels.weekly.workTimeLabel}{" "}
              {labels.formatHours(model.weekMinutes)} ·{" "}
              {labels.weekly.completedLabel} {model.weekCompleted}
            </span>
          </div>
          <div className="flex h-20 items-end gap-2">
            {model.weekBars.map((b) => {
              const isMax = b.totalMinutes === model.weekMax;
              const dowKey =
                DOW_KEYS[new Date(b.date + "T00:00:00").getDay()] ?? "mon";
              return (
                <div
                  key={b.date}
                  className="flex flex-1 flex-col items-center justify-end gap-1"
                >
                  {isMax && b.totalMinutes > 0 && (
                    <span className="text-xs tabular-nums text-lumen-text-secondary">
                      {(b.totalMinutes / 60).toFixed(1)}h
                    </span>
                  )}
                  <div
                    className="w-full rounded-t-sm bg-lumen-accent"
                    style={{
                      height: `${Math.max(
                        4,
                        (b.totalMinutes / model.weekMax) * 56,
                      )}px`,
                    }}
                  />
                  <span className="text-xs text-lumen-text-tertiary">
                    {labels.heatmap.days[dowKey]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Stat 2×2 */}
        <div className="grid grid-cols-2 gap-3">
          <StatBox
            value={model.totalTodos}
            label={labels.overview.todos}
            subtitle={`${model.completedTodos} ${labels.overview.completed}`}
          />
          <StatBox
            value={model.todayEvents}
            label={labels.overview.events}
            subtitle={`${model.todayEventsCompleted} ${labels.overview.completed}`}
          />
          <StatBox
            value={`${model.routineRate}%`}
            label={labels.mobile.routineTitle}
            valueClassName="text-lumen-accent-secondary"
          />
          <StatBox
            value={model.totalNotes}
            label={labels.overview.notes}
            subtitle={`+${model.notesThisWeek} ${labels.overview.thisWeek}`}
          />
        </div>

        {/* Routine top 3 */}
        {model.topRoutines.length > 0 && (
          <div className="flex flex-col gap-3 rounded-lumen-lg border border-lumen-border bg-lumen-bg-secondary p-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-lumen-text">
                {labels.mobile.routineTitle}
              </span>
              <span className="text-xs text-lumen-text-tertiary">
                {labels.mobile.top3}
              </span>
            </div>
            <div className="flex flex-col gap-2.5">
              {model.topRoutines.map((r) => (
                /*
                 * Two rows, not three columns (#1520). The name used to sit in
                 * a fixed 96px cell next to the bar, so at 390px a title that
                 * measured 139px was cut to "PWV1409-sc…" while the bar took
                 * 143px of the same 301px row — the name had the smallest
                 * share of the row and was the only part of it that could not
                 * be inferred from what was left. Dropping the bar to its own
                 * line gives the title everything the rate chip does not claim
                 * (~255px here), and a full-width bar reads its percentage
                 * more accurately besides. `truncate` stays as the backstop
                 * for a genuinely long name so the row keeps one line.
                 */
                <div key={r.routineId} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-xs text-lumen-text">
                      {r.routineTitle}
                    </span>
                    <span className="flex-shrink-0 text-xs font-semibold tabular-nums text-lumen-text">
                      {r.rate}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-lumen-surface-sunken">
                    <span
                      className="block h-full bg-lumen-accent-secondary"
                      style={{ width: `${r.rate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/*
         * Records (#2164): the last 7 days, one entry per kind, led by the
         * number the owner chose for that kind on the wide Records tab (#2263)
         * — the latest for a weight, the sum for spending. A kind with no
         * choice saved leads with the sum (plan 案 C). Beside it, the same
         * number day by day in the chart shape chosen there (#2264), bars
         * when nothing is saved.
         */}
        <div className="flex flex-col gap-3 rounded-lumen-lg border border-lumen-border bg-lumen-bg-secondary p-4">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold text-lumen-text">
              {labels.records.mobile.title}
            </span>
            <span className="text-xs text-lumen-text-tertiary">
              {labels.records.mobile.range}
            </span>
          </div>
          {/* Narrowed by the Apps section's "show records" (#2312): say to
              which app, and give the way back to every app. */}
          {sourceName !== null ? (
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-xs text-lumen-text-secondary">
                {labels.records.mobile.formatFilteredTo(sourceName)}
              </span>
              <button
                type="button"
                onClick={() => setSource(null)}
                className="min-h-11 flex-shrink-0 rounded-lumen-md px-2 text-xs font-medium text-lumen-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
              >
                {labels.records.mobile.clearFilter}
              </button>
            </div>
          ) : null}
          {recordsLoading ? (
            <RecordsBlockSkeleton />
          ) : recordsError ? (
            <p className="text-xs text-lumen-text-secondary">
              {labels.records.loadFailed}
            </p>
          ) : model.recordTotals.length === 0 ? (
            <p className="text-xs text-lumen-text-secondary">
              {sourceName !== null
                ? labels.records.mobile.emptyFiltered
                : labels.records.mobile.empty}
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {model.recordTotals.map((total) => {
                const metric = recordMetricFor(
                  viewIndex,
                  total.kind,
                  total.unit,
                );
                const key = recordViewKey(total.kind, total.unit);
                return (
                  <li key={key} className="flex items-center gap-3">
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="min-w-0 truncate text-xs text-lumen-text">
                        {total.kind}
                        <span className="text-lumen-text-tertiary">
                          {" · "}
                          {labels.records.mobile.formatCount(total.count)}
                        </span>
                      </span>
                      <dl className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
                        <RecordFigure
                          label={labels.records.views.metrics[metric]}
                          value={formatRecordMetric(
                            labels.records,
                            total,
                            total.unit,
                            metric,
                          )}
                        />
                      </dl>
                    </div>
                    <RecordSparkline
                      values={recordSeries.get(key) ?? []}
                      chart={recordChartFor(viewIndex, total.kind, total.unit)}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniCol({
  value,
  label,
}: {
  value: string;
  label: string;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-lg font-semibold tabular-nums text-lumen-text">
        {value}
      </span>
      <span className="text-xs text-lumen-accent">{label}</span>
    </div>
  );
}

function StatBox({
  value,
  label,
  subtitle,
  valueClassName,
}: {
  value: string | number;
  label: string;
  subtitle?: string;
  valueClassName?: string;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-0.5 rounded-lumen-lg border border-lumen-border bg-lumen-bg-secondary p-3">
      <span
        className={`text-lg font-semibold tabular-nums ${
          valueClassName ?? "text-lumen-text"
        }`}
      >
        {value}
      </span>
      <span className="text-xs text-lumen-text-secondary">{label}</span>
      {subtitle && (
        <span className="text-xs text-lumen-text-tertiary">{subtitle}</span>
      )}
    </div>
  );
}

/** The labelled number on a records line (#2263): "Latest 62.4 kg". */
function RecordFigure({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <div className="flex items-baseline gap-1">
      <dt className="text-xs text-lumen-text-tertiary">{label}</dt>
      <dd className="text-sm font-semibold tabular-nums text-lumen-text">
        {value}
      </dd>
    </div>
  );
}

/**
 * The records block's body while the read is in flight (#2214) — the Records
 * tab's skeleton in miniature: blank lines where the per-kind rows will land.
 * The pulse stops under reduced motion through the app-wide rule in tokens.css.
 */
function RecordsBlockSkeleton(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2.5" aria-busy="true">
      {Array.from({ length: 2 }).map((_, i) => (
        <div
          key={i}
          className="h-4 animate-pulse rounded-lumen-sm bg-lumen-surface-sunken"
        />
      ))}
    </div>
  );
}

function MobileSkeleton({ title }: { title: string }): React.JSX.Element {
  return (
    <div className="flex h-full flex-col" aria-busy="true">
      <div className="flex-shrink-0 px-4 pb-1 pt-2">
        <h2 className="text-xl font-semibold text-lumen-text">{title}</h2>
      </div>
      <div className="flex flex-col gap-3 px-4 pb-4 pt-2">
        <div className="h-24 animate-pulse rounded-lumen-lg border border-lumen-border bg-lumen-bg-secondary" />
        <div className="h-20 animate-pulse rounded-lumen-lg border border-lumen-border bg-lumen-bg-secondary" />
        <div className="h-32 animate-pulse rounded-lumen-lg border border-lumen-border bg-lumen-bg-secondary" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-lumen-lg border border-lumen-border bg-lumen-bg-secondary"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
