import { useMemo } from "react";
import type { TimerSession } from "../../types/timer";
import type { TaskNode } from "../../types/taskTree";
import {
  calendarWeekRange,
  getWorkSessions,
} from "../../utils/analyticsAggregation";
import { useWeekStartPref } from "../../hooks/useWeekStart";
import { dateKeyOfInstant, formatDateKey } from "../../utils/dateKey";
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

export function WeeklySummary({
  sessions,
  nodes,
  labels,
}: WeeklySummaryProps): React.JSX.Element {
  const { weekStartsOn } = useWeekStartPref();

  const stats = useMemo(() => {
    // Was a private Mon-only copy of this window (#780) — the shared helper
    // honours the week-start pref, so this card and the mobile one agree.
    const range = calendarWeekRange(new Date(), weekStartsOn);
    const work = getWorkSessions(sessions).filter((s) => {
      const d = formatDateKey(new Date(s.startedAt));
      return d >= range.startKey && d <= range.endKey;
    });
    const completedTasks = nodes.filter((n) => {
      if (n.type !== "task" || !n.completedAt) return false;
      // LOCAL day of the stored UTC instant (#420) — the week range above is
      // built from local dates, so a sliced UTC key disagreed at the edges.
      const d = dateKeyOfInstant(n.completedAt);
      if (d === null) return false;
      return d >= range.startKey && d <= range.endKey;
    }).length;

    return {
      workMinutes: work.reduce((sum, s) => sum + (s.duration ?? 0) / 60, 0),
      sessionCount: work.length,
      completedTasks,
    };
  }, [sessions, nodes, weekStartsOn]);

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
