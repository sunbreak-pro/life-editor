import type { TimerSession } from "../../types/timer";
import type { TodoNode } from "../../types/todoTree";
import type { ScheduleItem } from "../../types/schedule";
import type { WikiTag, WikiTagAssignment } from "../../types/wikiTagUnified";
import { dateRangeDays, useAnalyticsFilter } from "./AnalyticsFilterContext";
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
  const { dateRange } = useAnalyticsFilter();

  // #1476: this was a hardcoded 30, so the header's date-range pills moved the
  // Schedule tab's trend and left this one on a month no matter what was
  // picked. The nodes are the full live tree (the host does not window them),
  // so the range has to reach the chart as its bucket count.
  const days = dateRangeDays(dateRange);

  return (
    <div className="space-y-4">
      <TodoCompletionTrend nodes={nodes} days={days} labels={labels.todoTrend} />
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
