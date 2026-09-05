import { useMemo } from "react";
import { Clock, Hash, TrendingUp, Timer } from "lucide-react";
import type { TimerSession } from "../../types/timer";
import type { Period } from "./PeriodSelector";
import { computeSummary } from "../../utils/analyticsAggregation";
import { useAnalyticsFilter } from "./AnalyticsFilterContext";
import { AnalyticsStatCard } from "./AnalyticsStatCard";
import { PeriodSelector, type PeriodSelectorLabels } from "./PeriodSelector";
import { WorkTimeChart, type WorkTimeChartLabels } from "./WorkTimeChart";
import {
  TodoWorkTimeChart,
  type TodoWorkTimeChartLabels,
} from "./TodoWorkTimeChart";
import { WorkTimeHeatmap, type WorkTimeHeatmapLabels } from "./WorkTimeHeatmap";
import {
  PomodoroCompletionRate,
  type PomodoroCompletionRateLabels,
} from "./PomodoroCompletionRate";
import {
  WorkBreakBalance,
  type WorkBreakBalanceLabels,
} from "./WorkBreakBalance";
import { DailyTimeline, type DailyTimelineLabels } from "./DailyTimeline";
import { AnalyticsEmptyState } from "./AnalyticsEmptyState";

export interface TimeTabLabels {
  /** Summary stat cards. */
  totalWorkTime: string;
  sessions: string;
  avgPerDay: string;
  /** Section heading + period selector. */
  workTime: string;
  /** Designed empty-state copy (no sessions). */
  empty: { title: string; description: string };
  formatHours: (minutes: number) => string;
  period: PeriodSelectorLabels;
  workTimeChart: WorkTimeChartLabels;
  heatmap: WorkTimeHeatmapLabels;
  pomodoroRate: PomodoroCompletionRateLabels;
  workBreak: WorkBreakBalanceLabels;
  timeline: DailyTimelineLabels;
  todoWorkTime: TodoWorkTimeChartLabels;
}

interface TimeTabProps {
  sessions: TimerSession[];
  todoNameMap: Map<string, string>;
  /** Pomodoro daily target (host: fetchTimerSettings().targetSessions). */
  targetPerDay: number;
  labels: TimeTabLabels;
}

/*
 * Windows for the two rate charts, in days per granularity.
 *
 * DELIBERATELY not the header's date-range preset (#1476). Every other tab has
 * exactly one window control, so the pills own it there; this tab already ships
 * its own 日/週/月 selector, and the charts below read "recently" against it —
 * WorkTimeChart's rolling 14 days is pinned by
 * `workTimeChartWeekStart.test.tsx` as a decision of its own (#860). Binding
 * the two controls together is a design change, not this bug fix, so the Work
 * tab keeps its window and #1476 only unfroze the Todo tab's.
 */
const PERIOD_DAYS: Record<Period, number> = {
  day: 14,
  week: 12,
  month: 6,
};

export function TimeTab({
  sessions,
  todoNameMap,
  targetPerDay,
  labels,
}: TimeTabProps): React.JSX.Element {
  const { period, setPeriod } = useAnalyticsFilter();

  const summary = useMemo(() => computeSummary(sessions), [sessions]);

  const days = PERIOD_DAYS[period];

  if (sessions.length === 0) {
    return (
      <AnalyticsEmptyState
        icon={<Timer size={26} />}
        title={labels.empty.title}
        description={labels.empty.description}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary cards — same column rule as the other tabs' tiles (#1480). */}
      <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-3">
        <AnalyticsStatCard
          icon={<Clock size={16} />}
          label={labels.totalWorkTime}
          value={labels.formatHours(summary.totalMinutes)}
          tone="accent"
        />
        <AnalyticsStatCard
          icon={<Hash size={16} />}
          label={labels.sessions}
          value={String(summary.totalSessions)}
          tone="accent"
        />
        <AnalyticsStatCard
          icon={<TrendingUp size={16} />}
          label={labels.avgPerDay}
          value={labels.formatHours(summary.avgMinutesPerDay)}
          tone="accent"
        />
      </div>

      {/* Chart cards — 2-column grid for density */}
      <div className="grid grid-cols-2 gap-3">
        <WorkTimeChart
          sessions={sessions}
          period={period}
          labels={labels.workTimeChart}
          control={
            <PeriodSelector
              value={period}
              onChange={setPeriod}
              labels={labels.period}
            />
          }
        />
        <WorkTimeHeatmap sessions={sessions} labels={labels.heatmap} />
        <PomodoroCompletionRate
          sessions={sessions}
          days={days}
          targetPerDay={targetPerDay}
          labels={labels.pomodoroRate}
        />
        <WorkBreakBalance
          sessions={sessions}
          days={days}
          labels={labels.workBreak}
        />
        <DailyTimeline sessions={sessions} labels={labels.timeline} />
        <TodoWorkTimeChart
          sessions={sessions}
          todoNameMap={todoNameMap}
          labels={labels.todoWorkTime}
        />
      </div>
    </div>
  );
}
