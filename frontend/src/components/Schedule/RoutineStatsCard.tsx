import { Flame } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RoutineStats } from "../../types/schedule";

interface RoutineStatsCardProps {
  stats: RoutineStats;
  onShowDetails: () => void;
}

function getRateColor(rate: number): string {
  if (rate === 0) return "bg-notion-border/40";
  if (rate < 30) return "bg-green-300/40";
  if (rate < 60) return "bg-green-400/60";
  if (rate < 90) return "bg-green-500/70";
  return "bg-green-600";
}

export function RoutineStatsCard({
  stats,
  onShowDetails,
}: RoutineStatsCardProps) {
  const { t } = useTranslation();

  return (
    <div className="mt-4 px-3">
      <div className="border border-notion-border rounded-lg p-3 space-y-3">
        {/* Header: Overall rate */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-notion-text-secondary uppercase tracking-wide font-medium">
            {t("schedule.stats.title", "Stats")}
          </span>
          <span className="text-sm font-semibold text-notion-text">
            {stats.overallRate}%
          </span>
        </div>

        {/* Recent 7 days streak dots */}
        <div className="flex items-center gap-1">
          {stats.recentDays.map((day) => (
            <div
              key={day.date}
              className={`w-5 h-5 rounded-sm ${getRateColor(day.completionRate)}`}
              title={`${day.date}: ${day.completionRate}% (${day.completed}/${day.total})`}
            />
          ))}
        </div>

        {/* Current streak */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Flame size={14} className="text-orange-400" />
            <span className="text-xs text-notion-text">
              {stats.currentStreak}{" "}
              {t("schedule.stats.dayStreak", "day streak")}
            </span>
          </div>
          <button
            onClick={onShowDetails}
            className="text-[10px] text-notion-accent hover:underline"
          >
            {t("schedule.stats.details", "Details")}
          </button>
        </div>
      </div>
    </div>
  );
}
