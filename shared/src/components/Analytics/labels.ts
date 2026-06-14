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

export interface AnalyticsLabels {
  title: string;
  /** "{hours}h {minutes}m" — host interpolates via t("analytics.hours", ...). */
  formatHours: (minutes: number) => string;
  /** Empty-state copy shared by the Work tab. */
  noSessions: string;

  tabs: {
    overview: string;
    tasks: string;
    schedule: string;
    work: string;
  };

  period: {
    day: string;
    week: string;
    month: string;
  };

  /** Work tab summary stat-card labels. */
  workTime: string;
  taskWorkTime: string;
  totalWorkTime: string;
  sessions: string;
  avgPerDay: string;

  overview: {
    tasks: string;
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
  };

  todayCard: {
    title: string;
    workTime: string;
    completedTasks: string;
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
    days: string;
    noStreak: string;
  };

  heatmap: {
    title: string;
    /** Day-of-week short labels keyed mon..sun. */
    days: Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", string>;
    /** "{minutes} min" — host interpolates. */
    tooltip: (minutes: number) => string;
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

  taskTrend: {
    title: string;
    completedCount: string;
  };

  stagnation: {
    title: string;
    tasks: string;
  };

  projectTime: {
    title: string;
    noData: string;
  };

  schedule: {
    totalEvents: string;
    completedEvents: string;
    completionRate: string;
    activeRoutines: string;
    routineRate: string;
    noEvents: string;
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
