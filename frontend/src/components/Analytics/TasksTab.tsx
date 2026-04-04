import { useTranslation } from "react-i18next";
import type { TimerSession } from "../../types/timer";
import type { TaskNode } from "../../types/taskTree";
import { useAnalyticsFilter } from "../../context/AnalyticsFilterContext";
import { TaskCompletionTrend } from "./TaskCompletionTrend";
import { TaskStagnationChart } from "./TaskStagnationChart";
import { ProjectWorkTimeChart } from "./ProjectWorkTimeChart";

interface TasksTabProps {
  sessions: TimerSession[];
  nodes: TaskNode[];
}

export function TasksTab({ sessions, nodes }: TasksTabProps) {
  const { t: _t } = useTranslation();
  const { visibleCharts } = useAnalyticsFilter();

  return (
    <div className="max-w-3xl mx-auto w-full space-y-6">
      {visibleCharts.has("taskCompletionTrend") && (
        <TaskCompletionTrend nodes={nodes} days={30} />
      )}

      {visibleCharts.has("taskStagnation") && (
        <TaskStagnationChart nodes={nodes} />
      )}

      {visibleCharts.has("projectWorkTime") && (
        <ProjectWorkTimeChart sessions={sessions} nodes={nodes} />
      )}
    </div>
  );
}
