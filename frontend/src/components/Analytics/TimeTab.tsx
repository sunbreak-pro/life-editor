import { useMemo } from "react";
import { Clock, Hash, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TimerSession } from "../../types/timer";
import type { Period } from "./PeriodSelector";
import { computeSummary } from "../../utils/analyticsAggregation";
import { useAnalyticsFilter } from "../../context/AnalyticsFilterContext";
import { PeriodSelector } from "./PeriodSelector";
import { WorkTimeChart } from "./WorkTimeChart";
import { TaskWorkTimeChart } from "./TaskWorkTimeChart";
import { WorkTimeHeatmap } from "./WorkTimeHeatmap";
import { PomodoroCompletionRate } from "./PomodoroCompletionRate";
import { WorkBreakBalance } from "./WorkBreakBalance";
import { DailyTimeline } from "./DailyTimeline";

interface TimeTabProps {
  sessions: TimerSession[];
  taskNameMap: Map<string, string>;
}

const PERIOD_DAYS: Record<Period, number> = {
  day: 14,
  week: 12,
  month: 6,
};

export function TimeTab({ sessions, taskNameMap }: TimeTabProps) {
  const { t } = useTranslation();
  const { period, setPeriod, visibleCharts } = useAnalyticsFilter();

  const summary = useMemo(() => computeSummary(sessions), [sessions]);

  const formatHours = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return t("analytics.hours", { hours: h, minutes: m });
  };

  const days = PERIOD_DAYS[period];

  if (sessions.length === 0) {
    return (
      <div className="max-w-3xl mx-auto w-full">
        <p className="text-sm text-notion-text-secondary mt-4 text-center">
          {t("analytics.noSessions")}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto w-full space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          icon={<Clock size={20} />}
          label={t("analytics.totalWorkTime")}
          value={formatHours(summary.totalMinutes)}
          color="text-blue-500"
        />
        <StatCard
          icon={<Hash size={20} />}
          label={t("analytics.sessions")}
          value={String(summary.totalSessions)}
          color="text-purple-500"
        />
        <StatCard
          icon={<TrendingUp size={20} />}
          label={t("analytics.avgPerDay")}
          value={formatHours(summary.avgMinutesPerDay)}
          color="text-orange-500"
        />
      </div>

      {/* Period selector + Work time chart */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-notion-text">
            {t("analytics.workTime")}
          </h3>
          <PeriodSelector value={period} onChange={setPeriod} />
        </div>
        {visibleCharts.has("workTimeChart") && (
          <WorkTimeChart sessions={sessions} period={period} />
        )}
      </div>

      {/* Heatmap */}
      {visibleCharts.has("workTimeHeatmap") && (
        <WorkTimeHeatmap sessions={sessions} />
      )}

      {/* Pomodoro Rate */}
      {visibleCharts.has("pomodoroRate") && (
        <PomodoroCompletionRate sessions={sessions} days={days} />
      )}

      {/* Work/Break Balance */}
      {visibleCharts.has("workBreakBalance") && (
        <WorkBreakBalance sessions={sessions} days={days} />
      )}

      {/* Daily Timeline */}
      {visibleCharts.has("dailyTimeline") && (
        <DailyTimeline sessions={sessions} />
      )}

      {/* Task work time */}
      {visibleCharts.has("taskWorkTimeChart") && (
        <TaskWorkTimeChart sessions={sessions} taskNameMap={taskNameMap} />
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-notion-bg-secondary rounded-lg p-4 flex items-center gap-3">
      <div className={color}>{icon}</div>
      <div>
        <p className="text-2xl font-bold text-notion-text">{value}</p>
        <p className="text-xs text-notion-text-secondary">{label}</p>
      </div>
    </div>
  );
}
