import type { TimerSession } from "../../types/timer";
import type { TaskNode } from "../../types/taskTree";
import {
  TaskCompletionTrend,
  type TaskCompletionTrendLabels,
} from "./TaskCompletionTrend";
import {
  TaskStagnationChart,
  type TaskStagnationChartLabels,
} from "./TaskStagnationChart";
import {
  ProjectWorkTimeChart,
  type ProjectWorkTimeChartLabels,
} from "./ProjectWorkTimeChart";

export interface TasksTabLabels {
  taskTrend: TaskCompletionTrendLabels;
  stagnation: TaskStagnationChartLabels;
  projectTime: ProjectWorkTimeChartLabels;
}

interface TasksTabProps {
  sessions: TimerSession[];
  nodes: TaskNode[];
  labels: TasksTabLabels;
}

export function TasksTab({
  sessions,
  nodes,
  labels,
}: TasksTabProps): React.JSX.Element {
  return (
    <div className="max-w-3xl mx-auto w-full space-y-6">
      <TaskCompletionTrend nodes={nodes} days={30} labels={labels.taskTrend} />
      <TaskStagnationChart nodes={nodes} labels={labels.stagnation} />
      <ProjectWorkTimeChart
        sessions={sessions}
        nodes={nodes}
        labels={labels.projectTime}
      />
    </div>
  );
}
