import { useMemo } from "react";
import { Flame, Trophy } from "lucide-react";
import type { TimerSession } from "../../types/timer";
import { computeWorkStreak } from "../../utils/analyticsAggregation";

export interface StreakDisplayLabels {
  title: string;
  current: string;
  longest: string;
  days: string;
  noStreak: string;
}

interface StreakDisplayProps {
  sessions: TimerSession[];
  labels: StreakDisplayLabels;
}

export function StreakDisplay({
  sessions,
  labels,
}: StreakDisplayProps): React.JSX.Element {
  const streak = useMemo(() => computeWorkStreak(sessions), [sessions]);

  if (streak.currentStreak === 0 && streak.longestStreak === 0) {
    return (
      <div className="bg-notion-bg-secondary rounded-lg p-4 text-center">
        <p className="text-sm text-notion-text-secondary">{labels.noStreak}</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-notion-text mb-3">
        {labels.title}
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-notion-bg-secondary rounded-lg p-4 flex items-center gap-3">
          <Flame size={24} className="text-orange-500 shrink-0" />
          <div>
            <p className="text-2xl font-bold text-notion-text">
              {streak.currentStreak}
            </p>
            <p className="text-xs text-notion-text-secondary">
              {labels.current} ({labels.days})
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
              {labels.longest} ({labels.days})
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
