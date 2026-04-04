import { useMemo } from "react";
import { Clock, CheckCircle2, Timer } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TimerSession } from "../../types/timer";
import type { TaskNode } from "../../types/taskTree";
import { formatDateKey } from "../../utils/dateKey";
import { getWorkSessions } from "../../utils/analyticsAggregation";

interface TodayDashboardProps {
  sessions: TimerSession[];
  nodes: TaskNode[];
}

export function TodayDashboard({ sessions, nodes }: TodayDashboardProps) {
  const { t } = useTranslation();

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

  const formatTime = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return t("analytics.hours", { hours: h, minutes: m });
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-notion-text mb-3">
        {t("analytics.today.title")}
      </h3>
      <div className="grid grid-cols-3 gap-3">
        <MiniCard
          icon={<Clock size={16} />}
          label={t("analytics.today.workTime")}
          value={formatTime(stats.workMinutes)}
          color="text-blue-500"
        />
        <MiniCard
          icon={<CheckCircle2 size={16} />}
          label={t("analytics.today.completedTasks")}
          value={String(stats.completedToday)}
          color="text-notion-success"
        />
        <MiniCard
          icon={<Timer size={16} />}
          label={t("analytics.today.pomodoroCount")}
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
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-notion-bg-secondary rounded-lg p-3 flex items-center gap-2">
      <div className={color}>{icon}</div>
      <div className="min-w-0">
        <p className="text-lg font-bold text-notion-text truncate">{value}</p>
        <p className="text-xs text-notion-text-secondary truncate">{label}</p>
      </div>
    </div>
  );
}
