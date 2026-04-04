import { useMemo } from "react";
import { Flame, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TimerSession } from "../../types/timer";
import { computeWorkStreak } from "../../utils/analyticsAggregation";

interface StreakDisplayProps {
  sessions: TimerSession[];
}

export function StreakDisplay({ sessions }: StreakDisplayProps) {
  const { t } = useTranslation();

  const streak = useMemo(() => computeWorkStreak(sessions), [sessions]);

  if (streak.currentStreak === 0 && streak.longestStreak === 0) {
    return (
      <div className="bg-notion-bg-secondary rounded-lg p-4 text-center">
        <p className="text-sm text-notion-text-secondary">
          {t("analytics.streak.noStreak")}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-notion-text mb-3">
        {t("analytics.streak.title")}
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-notion-bg-secondary rounded-lg p-4 flex items-center gap-3">
          <Flame size={24} className="text-orange-500 shrink-0" />
          <div>
            <p className="text-2xl font-bold text-notion-text">
              {streak.currentStreak}
            </p>
            <p className="text-xs text-notion-text-secondary">
              {t("analytics.streak.current")} ({t("analytics.streak.days")})
            </p>
          </div>
        </div>
        <div className="bg-notion-bg-secondary rounded-lg p-4 flex items-center gap-3">
          <Trophy size={24} className="text-yellow-500 shrink-0" />
          <div>
            <p className="text-2xl font-bold text-notion-text">
              {streak.longestStreak}
            </p>
            <p className="text-xs text-notion-text-secondary">
              {t("analytics.streak.longest")} ({t("analytics.streak.days")})
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
