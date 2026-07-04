import { useMemo } from "react";
import { Clock, Hash, TrendingUp } from "lucide-react";
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

export interface TimeTabLabels {
  /** Summary stat cards. */
  totalWorkTime: string;
  sessions: string;
  avgPerDay: string;
  /** Section heading + period selector + empty state. */
  workTime: string;
  noSessions: string;
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
      <div className="max-w-3xl mx-auto w-full">
        <p className="text-sm text-lumen-text-secondary mt-4 text-center">
          {labels.noSessions}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto w-full space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <AnalyticsStatCard
          icon={<Clock size={20} />}
          label={labels.totalWorkTime}
          value={labels.formatHours(summary.totalMinutes)}
          color="text-lumen-accent"
        />
        <AnalyticsStatCard
          icon={<Hash size={20} />}
          label={labels.sessions}
          value={String(summary.totalSessions)}
          color="text-purple-500"
        />
        <AnalyticsStatCard
          icon={<TrendingUp size={20} />}
          label={labels.avgPerDay}
          value={labels.formatHours(summary.avgMinutesPerDay)}
          color="text-orange-500"
        />
      </div>

      {/* Period selector + Work time chart */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-lumen-text">
            {labels.workTime}
          </h3>
          <PeriodSelector
            value={period}
            onChange={setPeriod}
            labels={labels.period}
          />
        </div>
        <WorkTimeChart
          sessions={sessions}
          period={period}
          labels={labels.workTimeChart}
        />
      </div>

      {/* Heatmap */}
      <WorkTimeHeatmap sessions={sessions} labels={labels.heatmap} />

      {/* Pomodoro Rate */}
      <PomodoroCompletionRate
        sessions={sessions}
        days={days}
        targetPerDay={targetPerDay}
        labels={labels.pomodoroRate}
      />

      {/* Work/Break Balance */}
      <WorkBreakBalance
        sessions={sessions}
        days={days}
        labels={labels.workBreak}
      />

      {/* Daily Timeline */}
      <DailyTimeline sessions={sessions} labels={labels.timeline} />

      {/* Task work time */}
      <TaskWorkTimeChart
        sessions={sessions}
        taskNameMap={taskNameMap}
        labels={labels.taskWorkTime}
      />
    </div>
  );
}
