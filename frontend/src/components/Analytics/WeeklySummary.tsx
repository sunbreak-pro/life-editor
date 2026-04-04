import { useMemo } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TimerSession } from "../../types/timer";
import type { TaskNode } from "../../types/taskTree";
import { getWorkSessions } from "../../utils/analyticsAggregation";
import { formatDateKey } from "../../utils/dateKey";

interface WeeklySummaryProps {
  sessions: TimerSession[];
  nodes: TaskNode[];
}

interface WeekStats {
  workMinutes: number;
  sessionCount: number;
  completedTasks: number;
}

function getWeekRange(weeksAgo: number): { start: string; end: string } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday - weeksAgo * 7);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return { start: formatDateKey(monday), end: formatDateKey(sunday) };
}

function computeWeekStats(
  sessions: TimerSession[],
  nodes: TaskNode[],
  weekRange: { start: string; end: string },
): WeekStats {
  const work = getWorkSessions(sessions).filter((s) => {
    const d = formatDateKey(new Date(s.startedAt));
    return d >= weekRange.start && d <= weekRange.end;
  });

  const completedTasks = nodes.filter((n) => {
    if (n.type !== "task" || !n.completedAt) return false;
    const d = n.completedAt.substring(0, 10);
    return d >= weekRange.start && d <= weekRange.end;
  }).length;

  return {
    workMinutes: work.reduce((sum, s) => sum + (s.duration ?? 0) / 60, 0),
    sessionCount: work.length,
    completedTasks,
  };
}

export function WeeklySummary({ sessions, nodes }: WeeklySummaryProps) {
  const { t } = useTranslation();

  const { thisWeek, lastWeek } = useMemo(() => {
    const thisRange = getWeekRange(0);
    const lastRange = getWeekRange(1);
    return {
      thisWeek: computeWeekStats(sessions, nodes, thisRange),
      lastWeek: computeWeekStats(sessions, nodes, lastRange),
    };
  }, [sessions, nodes]);

  const formatTime = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return t("analytics.hours", { hours: h, minutes: m });
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-notion-text mb-3">
        {t("analytics.weekly.title")}
      </h3>
      <div className="grid grid-cols-3 gap-3">
        <ComparisonCard
          label={t("analytics.weekly.workTimeLabel")}
          current={formatTime(thisWeek.workMinutes)}
          currentRaw={thisWeek.workMinutes}
          previousRaw={lastWeek.workMinutes}
        />
        <ComparisonCard
          label={t("analytics.weekly.sessionsLabel")}
          current={String(thisWeek.sessionCount)}
          currentRaw={thisWeek.sessionCount}
          previousRaw={lastWeek.sessionCount}
        />
        <ComparisonCard
          label={t("analytics.weekly.completedLabel")}
          current={String(thisWeek.completedTasks)}
          currentRaw={thisWeek.completedTasks}
          previousRaw={lastWeek.completedTasks}
        />
      </div>
    </div>
  );
}

function ComparisonCard({
  label,
  current,
  currentRaw,
  previousRaw,
}: {
  label: string;
  current: string;
  currentRaw: number;
  previousRaw: number;
}) {
  const diff =
    previousRaw > 0 ? ((currentRaw - previousRaw) / previousRaw) * 100 : 0;
  const isUp = diff > 0;
  const isDown = diff < 0;

  return (
    <div className="bg-notion-bg-secondary rounded-lg p-3">
      <p className="text-xs text-notion-text-secondary mb-1">{label}</p>
      <p className="text-lg font-bold text-notion-text">{current}</p>
      <div className="flex items-center gap-1 mt-1">
        {isUp ? (
          <TrendingUp size={12} className="text-notion-success" />
        ) : isDown ? (
          <TrendingDown size={12} className="text-red-500" />
        ) : (
          <Minus size={12} className="text-notion-text-secondary" />
        )}
        <span
          className={`text-xs font-medium ${
            isUp
              ? "text-notion-success"
              : isDown
                ? "text-red-500"
                : "text-notion-text-secondary"
          }`}
        >
          {previousRaw > 0 ? `${Math.abs(Math.round(diff))}%` : "—"}
        </span>
      </div>
    </div>
  );
}
