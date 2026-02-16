import { X, Flame, Trophy, Calendar } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RoutineStats } from "../../types/schedule";

interface RoutineStatsOverlayProps {
  stats: RoutineStats;
  onClose: () => void;
}

function getHeatmapColor(rate: number): string {
  if (rate === 0) return "bg-notion-border/30";
  if (rate < 25) return "bg-green-300/40";
  if (rate < 50) return "bg-green-400/50";
  if (rate < 75) return "bg-green-500/60";
  return "bg-green-600/80";
}

export function RoutineStatsOverlay({
  stats,
  onClose,
}: RoutineStatsOverlayProps) {
  const { t } = useTranslation();

  // Build 7-column grid (Sun-Sat) for heatmap
  const heatmapGrid: Array<{ date: string; completionRate: number } | null> =
    [];
  if (stats.monthlyHeatmap.length > 0) {
    const firstDate = new Date(stats.monthlyHeatmap[0].date + "T00:00:00");
    const startPadding = firstDate.getDay();
    for (let i = 0; i < startPadding; i++) heatmapGrid.push(null);
    for (const entry of stats.monthlyHeatmap) heatmapGrid.push(entry);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-notion-bg border border-notion-border rounded-lg shadow-xl w-96 max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-notion-border">
          <h3 className="text-sm font-semibold text-notion-text">
            {t("schedule.stats.title", "Stats")}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* Streak info */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <Flame size={18} className="mx-auto text-orange-400 mb-1" />
              <div className="text-lg font-bold text-notion-text">
                {stats.currentStreak}
              </div>
              <div className="text-[10px] text-notion-text-secondary">
                {t("schedule.stats.currentStreak", "Current")}
              </div>
            </div>
            <div className="text-center">
              <Trophy size={18} className="mx-auto text-yellow-500 mb-1" />
              <div className="text-lg font-bold text-notion-text">
                {stats.longestStreak}
              </div>
              <div className="text-[10px] text-notion-text-secondary">
                {t("schedule.stats.longestStreak", "Longest")}
              </div>
            </div>
            <div className="text-center">
              <Calendar size={18} className="mx-auto text-blue-400 mb-1" />
              <div className="text-lg font-bold text-notion-text">
                {stats.totalCompletedDays}
              </div>
              <div className="text-[10px] text-notion-text-secondary">
                {t("schedule.stats.totalAchievedDays", "Days")}
              </div>
            </div>
          </div>

          {/* Per-routine rates */}
          {stats.perRoutineRates.length > 0 && (
            <div>
              <h4 className="text-[10px] text-notion-text-secondary uppercase tracking-wide font-medium mb-2">
                {t("schedule.stats.perRoutine", "Per Routine")}
              </h4>
              <div className="space-y-2">
                {stats.perRoutineRates.map((r) => (
                  <div key={r.routineId}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs text-notion-text truncate max-w-[200px]">
                        {r.routineTitle}
                      </span>
                      <span className="text-[10px] text-notion-text-secondary ml-2">
                        {r.completionRate}% ({r.completedCount}/{r.totalCount})
                      </span>
                    </div>
                    <div className="h-1.5 bg-notion-border/30 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-notion-accent rounded-full transition-all"
                        style={{ width: `${r.completionRate}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Monthly heatmap */}
          <div>
            <h4 className="text-[10px] text-notion-text-secondary uppercase tracking-wide font-medium mb-2">
              {t("schedule.stats.monthlyHeatmap", "90-Day Heatmap")}
            </h4>
            <div className="grid grid-cols-7 gap-[3px]">
              {heatmapGrid.map((cell, i) =>
                cell ? (
                  <div
                    key={cell.date}
                    className={`w-full aspect-square rounded-sm ${getHeatmapColor(cell.completionRate)}`}
                    title={`${cell.date}: ${cell.completionRate}%`}
                  />
                ) : (
                  <div key={`pad-${i}`} />
                ),
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
