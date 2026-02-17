import { Calendar, Flame, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RoutineStats } from "../../../../types/schedule";

interface RoutineStatsPanelProps {
  stats: RoutineStats;
}

export function RoutineStatsPanel({ stats }: RoutineStatsPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-3 gap-3 mb-4">
      <div className="border border-notion-border rounded-lg p-3 text-center">
        <Calendar size={18} className="mx-auto text-blue-400 mb-1" />
        <div className="text-lg font-bold text-notion-text">
          {stats.totalCompletedDays}
        </div>
        <div className="text-[10px] text-notion-text-secondary">
          {t("schedule.stats.totalAchievedDays", "Days")}
        </div>
      </div>
      <div className="border border-notion-border rounded-lg p-3 text-center">
        <Flame size={18} className="mx-auto text-orange-400 mb-1" />
        <div className="text-lg font-bold text-notion-text">
          {stats.currentStreak}
        </div>
        <div className="text-[10px] text-notion-text-secondary">
          {t("schedule.stats.currentStreak", "Current")}
        </div>
      </div>
      <div className="border border-notion-border rounded-lg p-3 text-center">
        <Trophy size={18} className="mx-auto text-yellow-500 mb-1" />
        <div className="text-lg font-bold text-notion-text">
          {stats.longestStreak}
        </div>
        <div className="text-[10px] text-notion-text-secondary">
          {t("schedule.stats.longestStreak", "Longest")}
        </div>
      </div>
    </div>
  );
}
