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
      {/* The unit rides with the number, not with the label (#1467). The two
          tiles are not equally wide: the right one spends 13px of its column on
          the divider it draws (`border-l` + `pl-3`), so in the ~320px detail
          panel「最長 (日)」ran out of room and broke after「最長」while
         「現在 (日)」stayed on one line — and because the row centres its
          contents, a label of two lines pushed its number up out of line with
          its neighbour's. A label of one word has nothing to break after, and
          `truncate` keeps that true however narrow the user drags the panel. */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-[34px] w-[34px] flex-shrink-0 place-items-center rounded-lumen-md bg-lumen-chip-progress-bg text-lumen-chip-progress-fg">
            <Flame size={18} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold tabular-nums text-lumen-text">
              {streak.currentStreak}
              <span className="ml-1 text-xs font-normal text-lumen-text-secondary">
                {labels.days}
              </span>
            </p>
            <p className="truncate text-xs text-lumen-text-secondary">
              {labels.current}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 border-l border-lumen-border pl-3">
          <span className="grid h-[34px] w-[34px] flex-shrink-0 place-items-center rounded-lumen-md bg-lumen-chip-mint-bg text-lumen-chip-mint-fg">
            <Trophy size={18} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold tabular-nums text-lumen-text">
              {streak.longestStreak}
              <span className="ml-1 text-xs font-normal text-lumen-text-secondary">
                {labels.days}
              </span>
            </p>
            <p className="truncate text-xs text-lumen-text-secondary">
              {labels.longest}
            </p>
          </div>
        </div>
      </div>
    </ChartCard>
  );
}
