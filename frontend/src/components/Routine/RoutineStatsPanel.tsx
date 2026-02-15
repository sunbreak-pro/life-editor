import { useMemo } from "react";
import { Flame, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useRoutineContext } from "../../hooks/useRoutineContext";
import { RoutineHeatmap } from "./RoutineHeatmap";
import type { WeeklyRate } from "../../types/routine";

const MILESTONE_LABELS: Record<number, string> = {
  7: "7d",
  30: "30d",
  100: "100d",
  365: "1y",
};

function WeeklyChart({ rates }: { rates: WeeklyRate[] }) {
  const { t } = useTranslation();
  const maxRate = Math.max(...rates.map((r) => r.rate), 0.01);

  return (
    <div>
      <h4 className="text-xs font-medium text-notion-text-secondary mb-2">
        {t("routine.weeklyRate")}
      </h4>
      <div className="flex items-end gap-1 h-16">
        {rates.map((week) => (
          <div
            key={week.weekStart}
            className="flex-1 flex flex-col items-center"
          >
            <div
              className="w-full bg-notion-accent/20 rounded-t-sm min-h-[2px]"
              style={{ height: `${(week.rate / maxRate) * 100}%` }}
              title={`${week.weekStart}: ${Math.round(week.rate * 100)}%`}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[9px] text-notion-text-secondary/60">
          {rates[0]?.weekStart.slice(5)}
        </span>
        <span className="text-[9px] text-notion-text-secondary/60">
          {rates[rates.length - 1]?.weekStart.slice(5)}
        </span>
      </div>
    </div>
  );
}

export function RoutineStatsPanel() {
  const { t } = useTranslation();
  const ctx = useRoutineContext();

  const heatmapData = useMemo(() => ctx.getHeatmapData(), [ctx]);
  const weeklyRates = useMemo(() => ctx.getWeeklyRates(), [ctx]);

  const routineStats = useMemo(() => {
    return ctx.routines.map((r) => ({
      routine: r,
      stats: ctx.getStatsForRoutine(r),
    }));
  }, [ctx]);

  return (
    <div className="px-4 py-3 space-y-5">
      {/* Heatmap */}
      <RoutineHeatmap data={heatmapData} />

      {/* Weekly Rate Chart */}
      {weeklyRates.length > 0 && <WeeklyChart rates={weeklyRates} />}

      {/* Streak Records */}
      <div>
        <h4 className="text-xs font-medium text-notion-text-secondary mb-2">
          {t("routine.streakRecords")}
        </h4>
        <div className="space-y-1.5">
          {routineStats.map(({ routine, stats }) => (
            <div
              key={routine.id}
              className="flex items-center justify-between px-2 py-1.5 rounded-md bg-notion-bg-secondary/50"
            >
              <span className="text-xs text-notion-text truncate flex-1">
                {routine.title}
              </span>
              <div className="flex items-center gap-3 shrink-0">
                <span className="flex items-center gap-1 text-xs text-orange-500">
                  <Flame size={11} />
                  {stats.currentStreak}
                </span>
                <span className="flex items-center gap-1 text-xs text-notion-text-secondary">
                  <Trophy size={11} />
                  {stats.bestStreak}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Milestones */}
      <div>
        <h4 className="text-xs font-medium text-notion-text-secondary mb-2">
          {t("routine.milestones")}
        </h4>
        <div className="flex flex-wrap gap-2">
          {routineStats.map(({ routine, stats }) =>
            stats.milestones.map((m) => (
              <span
                key={`${routine.id}-${m}`}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
              >
                <Flame size={10} />
                {routine.title.slice(0, 10)} — {MILESTONE_LABELS[m] ?? `${m}d`}
              </span>
            )),
          )}
          {routineStats.every(({ stats }) => stats.milestones.length === 0) && (
            <span className="text-xs text-notion-text-secondary">
              {t("routine.noMilestones")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
