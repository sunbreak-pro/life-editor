import type { TimerSession } from "../../types/timer";
import type { TodoNode } from "../../types/todoTree";
import type { ScheduleItem } from "../../types/schedule";
import type { WikiTag, WikiTagAssignment } from "../../types/wikiTagUnified";
import {
  TodoCompletionTrend,
  type TodoCompletionTrendLabels,
} from "./TodoCompletionTrend";
import {
  TodoStagnationChart,
  type TodoStagnationChartLabels,
} from "./TodoStagnationChart";
import {
  TagWorkTimeChart,
  type TagWorkTimeChartLabels,
} from "./TagWorkTimeChart";

export interface TodosTabLabels {
  todoTrend: TodoCompletionTrendLabels;
  stagnation: TodoStagnationChartLabels;
  tagTime: TagWorkTimeChartLabels;
}

interface TodosTabProps {
  sessions: TimerSession[];
  nodes: TodoNode[];
  /** Live events — the tag ring counts work measured against them too (#1375). */
  events: ScheduleItem[];
  assignments: WikiTagAssignment[];
  tags: WikiTag[];
  labels: TodosTabLabels;
}

export function TodosTab({
  sessions,
  nodes,
  events,
  assignments,
  tags,
  labels,
}: TodosTabProps): React.JSX.Element {
  return (
    <div className="space-y-4">
      <TodoCompletionTrend nodes={nodes} days={30} labels={labels.todoTrend} />
      <div className="grid grid-cols-2 gap-3">
        <TodoStagnationChart nodes={nodes} labels={labels.stagnation} />
        <TagWorkTimeChart
          sessions={sessions}
          nodes={nodes}
          events={events}
          assignments={assignments}
          tags={tags}
          labels={labels.tagTime}
        />
      </div>
    </div>
  );
}
