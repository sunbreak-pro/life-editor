import { useMemo, type ReactNode } from "react";
import { Clock, CheckCircle2, Timer } from "lucide-react";
import type { TimerSession } from "../../types/timer";
import type { TaskNode } from "../../types/taskTree";
import { formatDateKey } from "../../utils/dateKey";
import { getWorkSessions } from "../../utils/analyticsAggregation";

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
    <div>
      <h3 className="text-sm font-semibold text-ink-text mb-3">
        {labels.title}
      </h3>
      <div className="grid grid-cols-3 gap-3">
        <MiniCard
          icon={<Clock size={16} />}
          label={labels.workTime}
          value={labels.formatHours(stats.workMinutes)}
          color="text-blue-500"
        />
        <MiniCard
          icon={<CheckCircle2 size={16} />}
          label={labels.completedTasks}
          value={String(stats.completedToday)}
          color="text-ink-success"
        />
        <MiniCard
          icon={<Timer size={16} />}
          label={labels.pomodoroCount}
          value={String(stats.pomodoroCount)}
          color="text-red-500"
        />
      </div>
    </div>
  );
}

function MiniCard({
  icon,
  label,
  value,
  color,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  color: string;
}): React.JSX.Element {
  return (
    <div className="bg-ink-bg-secondary rounded-lg p-3 flex items-center gap-2">
      <div className={color}>{icon}</div>
      <div className="min-w-0">
        <p className="text-lg font-bold text-ink-text truncate">{value}</p>
        <p className="text-xs text-ink-text-secondary truncate">{label}</p>
      </div>
    </div>
  );
}
