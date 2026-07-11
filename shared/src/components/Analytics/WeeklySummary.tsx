import { useMemo } from "react";
import type { TimerSession } from "../../types/timer";
import type { TaskNode } from "../../types/taskTree";
import { getWorkSessions } from "../../utils/analyticsAggregation";
import { formatDateKey } from "../../utils/dateKey";
import { ChartCard } from "./ChartCard";
import { SummaryRow } from "./SummaryRow";

export interface WeeklySummaryLabels {
  title: string;
  workTimeLabel: string;
  sessionsLabel: string;
  completedLabel: string;
  formatHours: (minutes: number) => string;
}

interface WeeklySummaryProps {
  sessions: TimerSession[];
  nodes: TaskNode[];
  labels: WeeklySummaryLabels;
}

function getWeekRange(): { start: string; end: string } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return { start: formatDateKey(monday), end: formatDateKey(sunday) };
}

export function WeeklySummary({
  sessions,
  nodes,
  labels,
}: WeeklySummaryProps): React.JSX.Element {
  const stats = useMemo(() => {
    const range = getWeekRange();
    const work = getWorkSessions(sessions).filter((s) => {
      const d = formatDateKey(new Date(s.startedAt));
      return d >= range.start && d <= range.end;
    });
    const completedTasks = nodes.filter((n) => {
      if (n.type !== "task" || !n.completedAt) return false;
      const d = n.completedAt.substring(0, 10);
      return d >= range.start && d <= range.end;
    }).length;

    return {
      workMinutes: work.reduce((sum, s) => sum + (s.duration ?? 0) / 60, 0),
      sessionCount: work.length,
      completedTasks,
    };
  }, [sessions, nodes]);

  return (
    <ChartCard title={labels.title}>
      <div className="flex flex-col gap-2">
        <SummaryRow
          label={labels.workTimeLabel}
          value={labels.formatHours(stats.workMinutes)}
        />
        <SummaryRow
          label={labels.sessionsLabel}
          value={String(stats.sessionCount)}
        />
        <SummaryRow
          label={labels.completedLabel}
          value={String(stats.completedTasks)}
        />
      </div>
    </ChartCard>
  );
}
