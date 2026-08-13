import { useMemo } from "react";
import type { TimerSession } from "../../types/timer";
import type { TodoNode } from "../../types/todoTree";
import {
  dateKeyOfInstant,
  formatDateKey,
  todayCalendarKey,
} from "../../utils/dateKey";
import { getWorkSessions } from "../../utils/analyticsAggregation";
import { ChartCard } from "./ChartCard";
import { SummaryRow } from "./SummaryRow";

export interface TodayDashboardLabels {
  title: string;
  workTime: string;
  completedTasks: string;
  pomodoroCount: string;
  formatHours: (minutes: number) => string;
}

interface TodayDashboardProps {
  sessions: TimerSession[];
  nodes: TodoNode[];
  labels: TodayDashboardLabels;
}

export function TodayDashboard({
  sessions,
  nodes,
  labels,
}: TodayDashboardProps): React.JSX.Element {
  const stats = useMemo(() => {
    // Calendar day, NOT the day-start-hour "today" that Daily / routine sync
    // use (#356): every session bucket on this screen is keyed on the wall
    // calendar date, so shifting only this card would make it disagree with
    // the trend right beside it.
    const todayStr = todayCalendarKey();

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
        // completedAt is stored as a UTC ISO string, so read its LOCAL day
        // (#420) — slicing it counted a task finished before 09:00 JST as
        // yesterday, disagreeing with the calendar-keyed cards beside it.
        dateKeyOfInstant(n.completedAt) === todayStr,
    ).length;

    return { workMinutes, completedToday, pomodoroCount };
  }, [sessions, nodes]);

  return (
    <ChartCard title={labels.title}>
      <div className="flex flex-col gap-2">
        <SummaryRow
          label={labels.workTime}
          value={labels.formatHours(stats.workMinutes)}
        />
        <SummaryRow
          label={labels.completedTasks}
          value={String(stats.completedToday)}
        />
        <SummaryRow
          label={labels.pomodoroCount}
          value={String(stats.pomodoroCount)}
        />
      </div>
    </ChartCard>
  );
}
