import { useMemo } from "react";
import { Flame, Trophy } from "lucide-react";
import type { TimerSession } from "../../types/timer";
import { computeWorkStreak } from "../../utils/analyticsAggregation";
import { ChartCard } from "./ChartCard";

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
      <ChartCard title={labels.title}>
        <p className="py-2 text-center text-sm text-lumen-text-secondary">
          {labels.noStreak}
        </p>
      </ChartCard>
    );
  }

  return (
    <ChartCard title={labels.title}>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-[34px] w-[34px] flex-shrink-0 place-items-center rounded-lumen-md bg-lumen-chip-progress-bg text-lumen-chip-progress-fg">
            <Flame size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-lg font-semibold tabular-nums text-lumen-text">
              {streak.currentStreak}
            </p>
            <p className="text-xs text-lumen-text-secondary">
              {labels.current} ({labels.days})
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 border-l border-lumen-border pl-3">
          <span className="grid h-[34px] w-[34px] flex-shrink-0 place-items-center rounded-lumen-md bg-lumen-chip-mint-bg text-lumen-chip-mint-fg">
            <Trophy size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-lg font-semibold tabular-nums text-lumen-text">
              {streak.longestStreak}
            </p>
            <p className="text-xs text-lumen-text-secondary">
              {labels.longest} ({labels.days})
            </p>
          </div>
        </div>
      </div>
    </ChartCard>
  );
}
