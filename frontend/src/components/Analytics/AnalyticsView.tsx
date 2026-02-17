import { useMemo, useState, useEffect } from "react";
import {
  BarChart3,
  CheckCircle2,
  Circle,
  FolderOpen,
  Clock,
  Hash,
  TrendingUp,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { LAYOUT } from "../../constants/layout";
import { useTaskTreeContext } from "../../hooks/useTaskTreeContext";
import { getDataService } from "../../services";
import type { TimerSession } from "../../types/timer";
import { computeSummary } from "../../utils/analyticsAggregation";
import { WorkTimeChart } from "./WorkTimeChart";
import { TaskWorkTimeChart } from "./TaskWorkTimeChart";
import { PeriodSelector, type Period } from "./PeriodSelector";
import { SectionTabs, type TabItem } from "../shared/SectionTabs";

type AnalyticsTab = "overview" | "detail";

const ANALYTICS_TABS: readonly TabItem<AnalyticsTab>[] = [
  { id: "overview", labelKey: "tabs.overview" },
  { id: "detail", labelKey: "tabs.detail" },
];

export function AnalyticsView() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("overview");
  const { nodes } = useTaskTreeContext();
  const [sessions, setSessions] = useState<TimerSession[]>([]);
  const [period, setPeriod] = useState<Period>("day");

  useEffect(() => {
    getDataService().fetchTimerSessions().then(setSessions);
  }, []);

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
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
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

  const taskNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of nodes) {
      map.set(n.id, n.title || n.id);
    }
    return map;
  }, [nodes]);

  const summary = useMemo(() => computeSummary(sessions), [sessions]);

  const formatHours = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return t("analytics.hours", { hours: h, minutes: m });
  };

  return (
    <div
      className={`h-full flex flex-col ${LAYOUT.CONTENT_PX} ${LAYOUT.CONTENT_PT} ${LAYOUT.CONTENT_PB}`}
    >
      <h2 className={`text-2xl font-bold text-notion-text ${LAYOUT.TITLE_MB}`}>
        {t("analytics.title")}
      </h2>
      <SectionTabs
        tabs={ANALYTICS_TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      <div className={`flex-1 overflow-y-auto ${LAYOUT.TABS_MT}`}>
        {activeTab === "overview" ? (
          <div className="max-w-3xl mx-auto w-full">
            <div className="grid grid-cols-2 gap-4 mb-8">
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

            <div className="bg-notion-bg-secondary rounded-lg p-4 mb-4">
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

            <div className="bg-notion-bg-secondary rounded-lg p-4 mb-8">
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

            {/* Work time summary */}
            {sessions.length > 0 ? (
              <>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <StatCard
                    icon={<Clock size={20} />}
                    label={t("analytics.totalWorkTime")}
                    valueStr={formatHours(summary.totalMinutes)}
                    color="text-blue-500"
                  />
                  <StatCard
                    icon={<Hash size={20} />}
                    label={t("analytics.sessions")}
                    value={summary.totalSessions}
                    color="text-purple-500"
                  />
                  <StatCard
                    icon={<TrendingUp size={20} />}
                    label={t("analytics.avgPerDay")}
                    valueStr={formatHours(summary.avgMinutesPerDay)}
                    color="text-orange-500"
                  />
                </div>

                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-notion-text">
                    {t("analytics.workTime")}
                  </h3>
                  <PeriodSelector value={period} onChange={setPeriod} />
                </div>

                <div className="space-y-4">
                  <WorkTimeChart sessions={sessions} period={period} />
                  <TaskWorkTimeChart
                    sessions={sessions}
                    taskNameMap={taskNameMap}
                  />
                </div>
              </>
            ) : (
              <p className="text-sm text-notion-text-secondary mt-4 text-center">
                {t("analytics.noSessions")}
              </p>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-notion-text-secondary text-sm">
              {t("common.comingSoon")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  valueStr,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value?: number;
  valueStr?: string;
  color: string;
}) {
  return (
    <div className="bg-notion-bg-secondary rounded-lg p-4 flex items-center gap-3">
      <div className={color}>{icon}</div>
      <div>
        <p className="text-2xl font-bold text-notion-text">
          {valueStr ?? value}
        </p>
        <p className="text-xs text-notion-text-secondary">{label}</p>
      </div>
    </div>
  );
}
