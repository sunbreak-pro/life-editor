import { useMemo } from "react";
import type { TimerSession } from "../../types/timer";
import type { TaskNode } from "../../types/taskTree";
import { formatDateKey } from "../../utils/dateKey";
import { getWorkSessions } from "../../utils/analyticsAggregation";
import { ChartCard } from "./ChartCard";
import { SummaryRow } from "./SummaryRow";

export interface TodayDashboardLabels {
  title: string;
  workTime: string;
  completedTasks: string;
  pomodoroCount: string;
  formatHours: (minutes: number) => string;
}

interface TodayDashboardProps {
  sessions: TimerSession[];
  nodes: TaskNode[];
  labels: TodayDashboardLabels;
}

export function TodayDashboard({
  sessions,
  nodes,
  labels,
}: TodayDashboardProps): React.JSX.Element {
  const stats = useMemo(() => {
    const todayStr = formatDateKey(new Date());

    const todaySessions = sessions.filter(
      (s) => formatDateKey(new Date(s.startedAt)) === todayStr,
    );
    const todayWork = getWorkSessions(todaySessions);
    const workMinutes = todayWork.reduce(
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
        n.completedAt.substring(0, 10) === todayStr,
    ).length;

    return { workMinutes, completedToday, pomodoroCount };
  }, [sessions, nodes]);

  return (
    <ChartCard title={labels.title}>
      <div className="flex flex-col gap-2">
        <SummaryRow
          label={labels.workTime}
          value={labels.formatHours(stats.workMinutes)}
        />
        <SummaryRow
          label={labels.completedTasks}
          value={String(stats.completedToday)}
        />
        <SummaryRow
          label={labels.pomodoroCount}
          value={String(stats.pomodoroCount)}
        />
      </div>
    </ChartCard>
  );
}
