import type { RecordViewMetric } from "../../types/recordView";
import type { StagnationBucketId } from "../../utils/analyticsAggregation";
import type { DatePreset } from "./AnalyticsFilterContext";
import type { ChartAxisFormat } from "./chartTheme";

/*
 * Typed i18n labels for the Analytics feature (W4 · lean).
 *
 * Per CLAUDE.md §6.4 the shared components MUST NOT call useTranslation. The
 * web host (AnalyticsScreen) resolves every string via t() and injects this
 * object down through <AnalyticsView labels={...} />. Strings are grouped by
 * tab/chart to mirror the i18n `analytics.*` subtree and keep the host wiring
 * readable. Interpolated copy (e.g. "{hours}h {minutes}m") is passed as a
 * formatter function so the host owns the interpolation.
 */

/*
 * Copy for the extension-app records tab and the narrow records block (#2164).
 * Kept beside the rest of the Analytics labels so the host builds one object.
 */
export interface RecordsLabels {
  /** Accessible name of the filter row. */
  filtersLabel: string;
  app: { label: string; all: string };
  kind: { label: string; all: string };
  /** What `source_app = "claude"` is called on screen. */
  claudeSource: string;
  stats: {
    count: string;
    sum: string;
    avg: string;
    /** The newest record's value (#2262). */
    latest: string;
    /** Why the total, average and latest read "-" while kinds are mixed. */
    needOneKind: string;
    /** Under the card of the number chosen to lead the kind (#2263). */
    headline: string;
  };
  chart: {
    sumTitle: string;
    countTitle: string;
    /** Bars of each period's average / newest value (#2263). */
    avgTitle: string;
    latestTitle: string;
    /** Tooltip series name for a bar that adds the values up. */
    sumSeries: string;
    /** Tooltip series name for a bar that counts rows. */
    countSeries: string;
    avgSeries: string;
    latestSeries: string;
  };
  /** The per-kind "which number leads" card (#2263). */
  views: {
    title: string;
    /** Says the phone's block shows the same choice. */
    description: string;
    /** Accessible name of one kind's select: "How to show weight". */
    selectLabel: (kind: string) => string;
    /** Option text for each metric, in RECORD_VIEW_METRICS order. */
    metrics: Record<RecordViewMetric, string>;
    /** A choice that could not be saved (it is put back on screen). */
    saveFailed: string;
  };
  list: {
    title: string;
    showMore: string;
    /** "Showing {shown} of {total}" — host interpolates. */
    shown: (shown: number, total: number) => string;
  };
  /** Nothing in the range at all. */
  empty: { title: string; description: string };
  /** Records exist in the range, but the filters hide every one. */
  emptyFiltered: { title: string; description: string };
  loadFailed: string;
  /** A number with its unit ("450 JPY"), grouped for the host's language. */
  formatValue: (value: number, unit: string | null) => string;
  /** A bare number for an axis tick. */
  formatNumber: (value: number) => string;
  /** A record's instant, date and time. */
  formatDateTime: (iso: string) => string;
  mobile: {
    title: string;
    /** "Last 7 days". */
    range: string;
    empty: string;
    /** "{count} records" — host interpolates. */
    formatCount: (count: number) => string;
  };
}

export interface AnalyticsLabels {
  title: string;
  /** "{hours}h {minutes}m" — host interpolates via t("analytics.hours", ...). */
  formatHours: (minutes: number) => string;

  /**
   * Axis / tooltip vocabulary for the charts (#1864): one duration format and
   * one date format per tab, both in the host's language.
   */
  axis: ChartAxisFormat;

  /** Accessible name for the shell HeaderTabs tablist. */
  tabsLabel: string;

  tabs: {
    overview: string;
    todos: string;
    schedule: string;
    work: string;
    records: string;
  };

  /** Header date-range preset pills (7d / 30d / thisMonth / 3m / all). */
  datePreset: {
    label: string;
    options: Record<DatePreset, string>;
  };

  period: {
    day: string;
    week: string;
    month: string;
  };

  /** Work tab summary stat-card labels. */
  workTime: string;
  todoWorkTime: string;
  /** Row name for work logged against no todo (#1478). */
  noTodo: string;
  totalWorkTime: string;
  sessions: string;
  avgPerDay: string;

  /** Designed empty states (icon + title + guidance sentence). */
  emptyWork: { title: string; description: string };
  emptySchedule: { title: string; description: string };
  emptyMobile: { title: string; description: string };
  /** Tag usage card — no tags, or nothing tagged inside the range. */
  emptyTagUsage: { title: string; description: string };

  overview: {
    todos: string;
    events: string;
    notes: string;
    work: string;
    routines: string;
    tags: string;
    completed: string;
    today: string;
    rate: string;
    thisWeek: string;
    assigned: string;
    /**
     * The window each Overview tile counts over (#1859). The tiles do NOT follow
     * the date-range pills, so each one says which window it reads instead.
     */
    scope: {
      allTime: string;
      today: string;
      now: string;
    };
  };

  todayCard: {
    title: string;
    workTime: string;
    completedTodos: string;
    pomodoroCount: string;
  };

  weekly: {
    title: string;
    workTimeLabel: string;
    sessionsLabel: string;
    completedLabel: string;
  };

  streak: {
    title: string;
    current: string;
    longest: string;
    /** The unit for a given streak length — plural-aware (#1823). */
    formatDays: (count: number) => string;
    noStreak: string;
  };

  heatmap: {
    title: string;
    /** Right-aligned meta text (e.g. "時間帯 × 曜日"). */
    meta: string;
    /** Legend endpoints: low → high intensity. */
    less: string;
    more: string;
    /** Day-of-week short labels keyed mon..sun. */
    days: Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", string>;
    /** "{minutes} min" — host interpolates. */
    tooltip: (minutes: number) => string;
    /** One cell in words, day and hour included (#1867) — host interpolates. */
    cell?: (day: string, hour: number, minutes: number) => string;
  };

  pomodoroRate: {
    title: string;
    actual: string;
    target: string;
  };

  workBreak: {
    title: string;
    work: string;
    break: string;
    longBreak: string;
  };

  timeline: {
    title: string;
    noSessions: string;
  };

  todoTrend: {
    title: string;
    completedCount: string;
  };

  stagnation: {
    title: string;
    todos: string;
    /** Y-axis bracket names, one per age bucket (#1478). */
    buckets: Record<StagnationBucketId, string>;
  };

  /** Todos tab — work time split by life-tag (successor of the folder ring). */
  tagTime: {
    title: string;
    noData: string;
    untagged: string;
    other: string;
  };

  /**
   * Overview tab — tag usage across Todo / Event / Note (#1379). Two windows
   * per row, so each column names its own: `inRange` follows the date preset,
   * `liveTotal` never does. The preset's own name is not here — it is derived
   * from `datePreset.options` at the point the range is known.
   */
  tagUsage: {
    title: string;
    tag: string;
    inRange: string;
    liveTotal: string;
    /** "Top {shown} of {total} tags" — host interpolates (#1866). */
    topOf: (shown: number, total: number) => string;
  };

  /** Extension-app records (#2164): the wide tab and the narrow block. */
  records: RecordsLabels;

  /** Mobile-only single-scroll labels. */
  mobile: {
    weekTitle: string;
    routineTitle: string;
    top3: string;
  };

  schedule: {
    totalEvents: string;
    completedEvents: string;
    completionRate: string;
    activeRoutines: string;
    routineRate: string;
    eventTrend: {
      title: string;
      completed: string;
    };
    timeDistribution: {
      title: string;
      count: string;
    };
    routineCompletion: {
      title: string;
      rate: string;
    };
  };
}
