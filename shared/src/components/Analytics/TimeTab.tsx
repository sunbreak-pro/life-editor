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
  TaskWorkTimeChart,
  type TaskWorkTimeChartLabels,
} from "./TaskWorkTimeChart";
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
import { EmptyState } from "./EmptyState";

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
  taskWorkTime: TaskWorkTimeChartLabels;
}

interface TimeTabProps {
  sessions: TimerSession[];
  taskNameMap: Map<string, string>;
  /** Pomodoro daily target (host: fetchTimerSettings().targetSessions). */
  targetPerDay: number;
  labels: TimeTabLabels;
}

const PERIOD_DAYS: Record<Period, number> = {
  day: 14,
  week: 12,
  month: 6,
};

export function TimeTab({
  sessions,
  taskNameMap,
  targetPerDay,
  labels,
}: TimeTabProps): React.JSX.Element {
  const { period, setPeriod } = useAnalyticsFilter();

  const summary = useMemo(() => computeSummary(sessions), [sessions]);

  const days = PERIOD_DAYS[period];

  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={<Timer size={26} />}
        title={labels.empty.title}
        description={labels.empty.description}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
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
        <TaskWorkTimeChart
          sessions={sessions}
          taskNameMap={taskNameMap}
          labels={labels.taskWorkTime}
        />
      </div>
    </div>
  );
}
