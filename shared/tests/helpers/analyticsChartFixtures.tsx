import type { ReactElement } from "react";
import { EventCompletionTrend } from "../../src/components/Analytics/EventCompletionTrend";
import { EventTimeDistribution } from "../../src/components/Analytics/EventTimeDistribution";
import { PomodoroCompletionRate } from "../../src/components/Analytics/PomodoroCompletionRate";
import { RoutineCompletionChart } from "../../src/components/Analytics/RoutineCompletionChart";
import { TagWorkTimeChart } from "../../src/components/Analytics/TagWorkTimeChart";
import { TodoCompletionTrend } from "../../src/components/Analytics/TodoCompletionTrend";
import { TodoStagnationChart } from "../../src/components/Analytics/TodoStagnationChart";
import { TodoWorkTimeChart } from "../../src/components/Analytics/TodoWorkTimeChart";
import { WorkBreakBalance } from "../../src/components/Analytics/WorkBreakBalance";
import { WorkTimeChart } from "../../src/components/Analytics/WorkTimeChart";
import { formatDateKey } from "../../src/utils/dateKey";
import type { ScheduleItem } from "../../src/types/schedule";
import type { RoutineNode } from "../../src/types/routine";
import type { TimerSession } from "../../src/types/timer";
import type { TodoNode } from "../../src/types/todoTree";
import type {
  WikiTag,
  WikiTagAssignment,
} from "../../src/types/wikiTagUnified";

/*
 * Every Analytics chart that owns a <ResponsiveContainer> and a <Tooltip>,
 * each fed enough data to get past its own "no data → render null" guard.
 * A chart that renders null cannot warn and mounts no tooltip, so an
 * under-fed fixture would pass the suites below while proving nothing.
 *
 * Shared by analyticsChartMount.test.tsx (#948 / #944, real recharts) and
 * analyticsTooltipFormatter.test.tsx (#943, recharts stubbed) so the two
 * cannot drift into covering different sets of charts.
 */

/** YYYY-MM-DD key `offsetDays` away from today (negative = past). */
function dayKey(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return formatDateKey(d);
}

function daysAgo(offsetDays: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(10, 0, 0, 0);
  return d;
}

function session(
  id: number,
  sessionType: string,
  minutes: number,
  todoId: string | null = null,
  startedAt: Date = daysAgo(0),
): TimerSession {
  return {
    id,
    todoId,
    sessionType,
    startedAt,
    completedAt: startedAt,
    duration: minutes * 60,
    completed: true,
    label: null,
  } as unknown as TimerSession;
}

function todo(id: string, over: Partial<TodoNode> = {}): TodoNode {
  return {
    id,
    type: "task",
    title: id,
    parentId: null,
    order: 0,
    createdAt: daysAgo(-30).toISOString(),
    ...over,
  } as TodoNode;
}

function event(id: string, over: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id,
    date: dayKey(-1),
    title: "Event",
    startTime: "09:00",
    endTime: "10:00",
    completed: true,
    completedAt: daysAgo(-1).toISOString(),
    routineId: null,
    templateId: null,
    memo: null,
    noteId: null,
    content: null,
    createdAt: "2020-01-01T00:00:00.000Z",
    updatedAt: "2020-01-01T00:00:00.000Z",
    ...over,
  } as ScheduleItem;
}

function routine(id: string): RoutineNode {
  return {
    id,
    title: "Morning routine",
    startTime: "07:00",
    endTime: "07:30",
    isArchived: false,
    isVisible: true,
    isDeleted: false,
    deletedAt: null,
    order: 0,
    frequencyType: "daily",
    frequencyDays: [],
    frequencyInterval: null,
    frequencyStartDate: null,
    createdAt: "2020-01-01T00:00:00.000Z",
    updatedAt: "2020-01-01T00:00:00.000Z",
  };
}

function tag(id: string): WikiTag {
  return {
    id,
    name: `Tag ${id}`,
    color: "#112233",
    icon: null,
    createdAt: "2020-01-01T00:00:00.000Z",
    updatedAt: "2020-01-01T00:00:00.000Z",
    isDeleted: false,
    deletedAt: null,
  };
}

function assignment(itemId: string, tagId: string): WikiTagAssignment {
  return {
    id: `asg-${itemId}-${tagId}`,
    itemId,
    tagId,
    updatedAt: "2020-01-01T00:00:00.000Z",
    isDeleted: false,
    deletedAt: null,
  };
}

/** One work minute — the #944 repro. Whole minutes, so 0.25m is unreachable. */
export const ONE_MINUTE: TimerSession[] = [session(1, "WORK", 1)];

export const WORK_BREAK_LABELS = {
  title: "Balance",
  work: "Work",
  break: "Break",
  longBreak: "Long Break",
};

export interface ChartFixture {
  name: string;
  element: ReactElement;
}

export const CHARTS: ChartFixture[] = [
  {
    name: "EventCompletionTrend",
    element: (
      <EventCompletionTrend
        items={[event("ev-1")]}
        days={7}
        labels={{ title: "Trend", completed: "Completed" }}
      />
    ),
  },
  {
    name: "EventTimeDistribution",
    element: (
      <EventTimeDistribution
        items={[event("ev-1")]}
        labels={{ title: "By hour", count: "Events" }}
      />
    ),
  },
  {
    name: "PomodoroCompletionRate",
    element: (
      <PomodoroCompletionRate
        sessions={ONE_MINUTE}
        days={7}
        targetPerDay={4}
        labels={{ title: "Pomodoro", actual: "Actual", target: "Target" }}
      />
    ),
  },
  {
    name: "RoutineCompletionChart",
    element: (
      <RoutineCompletionChart
        items={[event("ev-1", { routineId: "routine-1" })]}
        routines={[routine("routine-1")]}
        labels={{ title: "Routines", rate: "Rate" }}
      />
    ),
  },
  {
    name: "TagWorkTimeChart",
    element: (
      <TagWorkTimeChart
        sessions={[session(1, "WORK", 30, "task-1")]}
        nodes={[todo("task-1")]}
        events={[]}
        assignments={[assignment("task-1", "tag-1")]}
        tags={[tag("tag-1")]}
        labels={{
          title: "By tag",
          noData: "No data",
          untagged: "Untagged",
          other: "Other tags",
          formatHours: (m: number) => `${Math.round(m)}m`,
        }}
      />
    ),
  },
  {
    name: "TodoCompletionTrend",
    element: (
      <TodoCompletionTrend
        nodes={[
          todo("task-1", {
            status: "DONE",
            completedAt: daysAgo(-1).toISOString(),
          }),
        ]}
        days={7}
        labels={{ title: "Trend", completedCount: "Completed" }}
      />
    ),
  },
  {
    name: "TodoStagnationChart",
    element: (
      <TodoStagnationChart
        nodes={[todo("task-1")]}
        labels={{
          title: "Stagnation",
          todos: "todos",
          buckets: {
            under1Week: "< 1 week",
            "1to2Weeks": "1-2 weeks",
            "2to4Weeks": "2-4 weeks",
            "1to3Months": "1-3 months",
            over3Months: "3+ months",
          },
        }}
      />
    ),
  },
  {
    name: "TodoWorkTimeChart",
    element: (
      <TodoWorkTimeChart
        sessions={[session(1, "WORK", 30, "task-1")]}
        todoNameMap={new Map([["task-1", "Write the thing"]])}
        labels={{ title: "By todo", sessions: "Sessions", noTodo: "No Todo" }}
      />
    ),
  },
  {
    name: "WorkBreakBalance",
    element: (
      <WorkBreakBalance
        sessions={ONE_MINUTE}
        days={7}
        labels={WORK_BREAK_LABELS}
      />
    ),
  },
  {
    name: "WorkTimeChart",
    element: (
      <WorkTimeChart
        sessions={ONE_MINUTE}
        period="day"
        labels={{ workTime: "Work Time" }}
      />
    ),
  },
];
