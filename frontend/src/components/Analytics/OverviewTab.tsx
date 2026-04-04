import { useMemo } from "react";
import { BarChart3, CheckCircle2, Circle, FolderOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TimerSession } from "../../types/timer";
import type { TaskNode } from "../../types/taskTree";
import { formatDateKey } from "../../utils/dateKey";
import { TodayDashboard } from "./TodayDashboard";
import { WeeklySummary } from "./WeeklySummary";
import { StreakDisplay } from "./StreakDisplay";

interface OverviewTabProps {
  sessions: TimerSession[];
  nodes: TaskNode[];
}

export function OverviewTab({ sessions, nodes }: OverviewTabProps) {
  const { t } = useTranslation();

  const stats = useMemo(() => {
    const tasks = nodes.filter((n) => n.type === "task");
    const folders = nodes.filter((n) => n.type === "folder");
    const completed = tasks.filter((n) => n.status === "DONE");
    const incomplete = tasks.filter((n) => n.status !== "DONE");
    const completionRate =
      tasks.length > 0
        ? Math.round((completed.length / tasks.length) * 100)
        : 0;

    const now = new Date();
    const todayStr = formatDateKey(now);
    const todayTasks = tasks.filter(
      (t) => t.scheduledAt?.substring(0, 10) === todayStr,
    );
    const todayCompleted = todayTasks.filter((t) => t.status === "DONE");
    const todayCompletionRate =
      todayTasks.length > 0
        ? Math.round((todayCompleted.length / todayTasks.length) * 100)
        : 0;

    return {
      totalTasks: tasks.length,
      completedTasks: completed.length,
      incompleteTasks: incomplete.length,
      totalFolders: folders.length,
      completionRate,
      todayTotal: todayTasks.length,
      todayCompleted: todayCompleted.length,
      todayCompletionRate,
    };
  }, [nodes]);

  return (
    <div className="max-w-3xl mx-auto w-full space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          icon={<BarChart3 size={20} />}
          label={t("analytics.totalTasks")}
          value={stats.totalTasks}
          color="text-notion-accent"
        />
        <StatCard
          icon={<CheckCircle2 size={20} />}
          label={t("analytics.completed")}
          value={stats.completedTasks}
          color="text-notion-success"
        />
        <StatCard
          icon={<Circle size={20} />}
          label={t("analytics.inProgress")}
          value={stats.incompleteTasks}
          color="text-yellow-500"
        />
        <StatCard
          icon={<FolderOpen size={20} />}
          label={t("analytics.folders")}
          value={stats.totalFolders}
          color="text-notion-text-secondary"
        />
      </div>

      {/* Completion rates */}
      <div className="space-y-4">
        <div className="bg-notion-bg-secondary rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-notion-text">
              {t("analytics.todayRate")}
            </span>
            <span className="text-sm font-bold text-notion-success">
              {stats.todayCompletionRate}%
              <span className="text-xs font-normal text-notion-text-secondary ml-1">
                ({stats.todayCompleted}/{stats.todayTotal})
              </span>
            </span>
          </div>
          <div className="w-full h-3 bg-notion-hover rounded-full overflow-hidden">
            <div
              className="h-full bg-notion-success rounded-full transition-all duration-500"
              style={{ width: `${stats.todayCompletionRate}%` }}
            />
          </div>
        </div>

        <div className="bg-notion-bg-secondary rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-notion-text">
              {t("analytics.totalRate")}
            </span>
            <span className="text-sm font-bold text-notion-accent">
              {stats.completionRate}%
            </span>
          </div>
          <div className="w-full h-3 bg-notion-hover rounded-full overflow-hidden">
            <div
              className="h-full bg-notion-accent rounded-full transition-all duration-500"
              style={{ width: `${stats.completionRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Today Dashboard */}
      <TodayDashboard sessions={sessions} nodes={nodes} />

      {/* Weekly Summary */}
      <WeeklySummary sessions={sessions} nodes={nodes} />

      {/* Streak Display */}
      <StreakDisplay sessions={sessions} />
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
  value: number;
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
