import { Calendar, Flame, Trophy, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RoutineStats } from "../../../../types/schedule";

interface AchievementPanelProps {
  stats: RoutineStats;
  onShowDetails: () => void;
}

export function AchievementPanel({
  stats,
  onShowDetails,
}: AchievementPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="border border-notion-border rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-notion-text">
          {t("schedule.achievement", "Achievement")}
        </span>
        <button
          onClick={onShowDetails}
          className="flex items-center gap-0.5 text-[10px] text-notion-text-secondary hover:text-notion-text transition-colors"
        >
          {t("schedule.stats.details", "Details")}
          <ChevronRight size={12} />
        </button>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Calendar size={14} className="text-blue-400" />
          <span className="text-sm font-bold text-notion-text">
            {stats.totalCompletedDays}
          </span>
          <span className="text-[10px] text-notion-text-secondary">
            {t("schedule.stats.totalAchievedDays", "Days")}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Flame size={14} className="text-orange-400" />
          <span className="text-sm font-bold text-notion-text">
            {stats.currentStreak}
          </span>
          <span className="text-[10px] text-notion-text-secondary">
            {t("schedule.stats.currentStreak", "Current")}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Trophy size={14} className="text-yellow-500" />
          <span className="text-sm font-bold text-notion-text">
            {stats.longestStreak}
          </span>
          <span className="text-[10px] text-notion-text-secondary">
            {t("schedule.stats.longestStreak", "Longest")}
          </span>
        </div>
      </div>
    </div>
  );
}
