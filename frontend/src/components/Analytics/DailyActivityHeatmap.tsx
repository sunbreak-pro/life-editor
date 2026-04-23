import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DailyNode } from "../../types/daily";
import { aggregateDailyActivity } from "../../utils/analyticsAggregation";

interface DailyActivityHeatmapProps {
  dailies: DailyNode[];
}

function getColor(hasContent: boolean): string {
  if (!hasContent) return "var(--color-notion-hover, #f3f4f6)";
  return "rgba(139, 92, 246, 0.6)";
}

export function DailyActivityHeatmap({ dailies }: DailyActivityHeatmapProps) {
  const { t } = useTranslation();
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);

  const cells = useMemo(() => aggregateDailyActivity(dailies, 90), [dailies]);

  // Group into weeks (columns), starting from Monday
  const weeks: DailyActivityHeatmapCell[][] = useMemo(() => {
    const result: DailyActivityHeatmapCell[][] = [];
    let currentWeek: DailyActivityHeatmapCell[] = [];

    for (const cell of cells) {
      const d = new Date(cell.date);
      const dayOfWeek = d.getDay();
      const mondayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

      if (mondayIndex === 0 && currentWeek.length > 0) {
        result.push(currentWeek);
        currentWeek = [];
      }
      currentWeek.push({ ...cell, dayIndex: mondayIndex });
    }
    if (currentWeek.length > 0) result.push(currentWeek);

    return result;
  }, [cells]);

  const dayLabels = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

  return (
    <div>
      <h3 className="text-sm font-semibold text-notion-text mb-3">
        {t("analytics.materials.memoHeatmap.title")}
      </h3>
      <div className="relative overflow-x-auto">
        <div className="inline-flex gap-[2px]">
          {/* Day labels */}
          <div className="flex flex-col gap-[2px] mr-1">
            {dayLabels.map((key) => (
              <div
                key={key}
                className="w-8 h-4 text-[10px] text-notion-text-secondary flex items-center"
              >
                {t(`analytics.heatmap.${key}`)}
              </div>
            ))}
          </div>
          {/* Week columns */}
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[2px]">
              {Array.from({ length: 7 }, (_, di) => {
                const cell = week.find((c) => c.dayIndex === di);
                if (!cell) {
                  return <div key={di} className="w-4 h-4" />;
                }
                return (
                  <div
                    key={di}
                    className="w-4 h-4 rounded-sm cursor-pointer transition-transform hover:scale-125"
                    style={{ backgroundColor: getColor(cell.hasContent) }}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setTooltip({
                        x: rect.left + rect.width / 2,
                        y: rect.top - 4,
                        text: `${cell.date}: ${cell.hasContent ? t("analytics.materials.memoHeatmap.tooltip", { count: 1 }) : "—"}`,
                      });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {tooltip && (
          <div
            className="fixed z-50 px-2 py-1 text-xs rounded-md bg-notion-bg border border-notion-border shadow-sm text-notion-text pointer-events-none"
            style={{
              left: tooltip.x,
              top: tooltip.y,
              transform: "translate(-50%, -100%)",
            }}
          >
            {tooltip.text}
          </div>
        )}
      </div>
    </div>
  );
}

interface DailyActivityHeatmapCell {
  date: string;
  hasContent: boolean;
  dayIndex: number;
}
