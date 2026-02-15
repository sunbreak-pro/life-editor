import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { HeatmapDay } from "../../types/routine";

interface RoutineHeatmapProps {
  data: HeatmapDay[];
}

function getHeatmapColor(rate: number): string {
  if (rate === 0) return "bg-notion-bg-secondary";
  if (rate < 0.33) return "bg-green-200 dark:bg-green-900/40";
  if (rate < 0.66) return "bg-green-400 dark:bg-green-700/60";
  return "bg-green-600 dark:bg-green-500";
}

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

export function RoutineHeatmap({ data }: RoutineHeatmapProps) {
  const { t } = useTranslation();

  // Organize into weeks (columns) x days (rows)
  const grid = useMemo(() => {
    const weeks: HeatmapDay[][] = [];
    let currentWeek: HeatmapDay[] = [];
    for (let i = 0; i < data.length; i++) {
      const date = new Date(data[i].date + "T00:00:00");
      // Monday = 0, Sunday = 6
      const dayIndex = date.getDay() === 0 ? 6 : date.getDay() - 1;
      if (dayIndex === 0 && currentWeek.length > 0) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      currentWeek.push(data[i]);
    }
    if (currentWeek.length > 0) weeks.push(currentWeek);
    return weeks;
  }, [data]);

  return (
    <div>
      <h4 className="text-xs font-medium text-notion-text-secondary mb-2">
        {t("routine.heatmap")}
      </h4>
      <div className="flex gap-0.5">
        {/* Day labels */}
        <div className="flex flex-col gap-0.5 mr-1">
          {DAY_LABELS.map((label, i) => (
            <div
              key={i}
              className="w-3 h-3 text-[8px] text-notion-text-secondary/60 flex items-center justify-center"
            >
              {i % 2 === 0 ? label : ""}
            </div>
          ))}
        </div>
        {/* Weeks */}
        {grid.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-0.5">
            {week.map((day) => (
              <div
                key={day.date}
                className={`w-3 h-3 rounded-sm ${getHeatmapColor(day.rate)}`}
                title={`${day.date}: ${day.completed}/${day.total}`}
              />
            ))}
          </div>
        ))}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-1 mt-2">
        <span className="text-[9px] text-notion-text-secondary/60">
          {t("routine.less")}
        </span>
        <div className="w-3 h-3 rounded-sm bg-notion-bg-secondary" />
        <div className="w-3 h-3 rounded-sm bg-green-200 dark:bg-green-900/40" />
        <div className="w-3 h-3 rounded-sm bg-green-400 dark:bg-green-700/60" />
        <div className="w-3 h-3 rounded-sm bg-green-600 dark:bg-green-500" />
        <span className="text-[9px] text-notion-text-secondary/60">
          {t("routine.more")}
        </span>
      </div>
    </div>
  );
}
