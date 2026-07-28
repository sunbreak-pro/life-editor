import type { TimerSession } from "../../types/timer";
import type { TaskNode } from "../../types/taskTree";
import type { WikiTag, WikiTagAssignment } from "../../types/wikiTagUnified";
import {
  TaskCompletionTrend,
  type TaskCompletionTrendLabels,
} from "./TaskCompletionTrend";
import {
  TaskStagnationChart,
  type TaskStagnationChartLabels,
} from "./TaskStagnationChart";
import {
  TagWorkTimeChart,
  type TagWorkTimeChartLabels,
} from "./TagWorkTimeChart";

export interface TasksTabLabels {
  taskTrend: TaskCompletionTrendLabels;
  stagnation: TaskStagnationChartLabels;
  tagTime: TagWorkTimeChartLabels;
}

interface TasksTabProps {
  sessions: TimerSession[];
  nodes: TaskNode[];
  assignments: WikiTagAssignment[];
  tags: WikiTag[];
  labels: TasksTabLabels;
}

export function TasksTab({
  sessions,
  nodes,
  assignments,
  tags,
  labels,
}: TasksTabProps): React.JSX.Element {
  return (
    <div className="space-y-4">
      <TaskCompletionTrend nodes={nodes} days={30} labels={labels.taskTrend} />
      <div className="grid grid-cols-2 gap-3">
        <TaskStagnationChart nodes={nodes} labels={labels.stagnation} />
        <TagWorkTimeChart
          sessions={sessions}
          nodes={nodes}
          assignments={assignments}
          tags={tags}
          labels={labels.tagTime}
        />
      </div>
    </div>
  );
}
