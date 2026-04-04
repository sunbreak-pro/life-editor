import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TimerSession } from "../../types/timer";
import { aggregateByHourAndDay } from "../../utils/analyticsAggregation";

interface WorkTimeHeatmapProps {
  sessions: TimerSession[];
}

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

function getHeatmapColor(minutes: number, maxMinutes: number): string {
  if (minutes === 0 || maxMinutes === 0)
    return "var(--color-notion-hover, #f3f4f6)";
  const intensity = Math.min(minutes / maxMinutes, 1);
  if (intensity < 0.25) return "rgba(34, 197, 94, 0.2)";
  if (intensity < 0.5) return "rgba(34, 197, 94, 0.4)";
  if (intensity < 0.75) return "rgba(34, 197, 94, 0.65)";
  return "rgba(34, 197, 94, 0.9)";
}

export function WorkTimeHeatmap({ sessions }: WorkTimeHeatmapProps) {
  const { t } = useTranslation();
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);

  const { cells, maxMinutes } = useMemo(() => {
    const raw = aggregateByHourAndDay(sessions);
    const max = Math.max(...raw.map((c) => c.totalMinutes), 1);
    return { cells: raw, maxMinutes: max };
  }, [sessions]);

  const getCell = (day: number, hour: number) =>
    cells.find((c) => c.dayOfWeek === day && c.hour === hour);

  return (
    <div>
      <h3 className="text-sm font-semibold text-notion-text mb-3">
        {t("analytics.heatmap.title")}
      </h3>
      <div className="relative overflow-x-auto">
        <div
          className="inline-grid gap-[2px]"
          style={{
            gridTemplateColumns: `40px repeat(24, 1fr)`,
            gridTemplateRows: `20px repeat(7, 1fr)`,
          }}
        >
          {/* Hour labels row */}
          <div />
          {Array.from({ length: 24 }, (_, h) => (
            <div
              key={`h-${h}`}
              className="text-[9px] text-notion-text-secondary text-center leading-5"
            >
              {h}
            </div>
          ))}

          {/* Day rows */}
          {DAY_KEYS.map((dayKey, dayIndex) => (
            <>
              <div
                key={`label-${dayKey}`}
                className="text-[10px] text-notion-text-secondary flex items-center pr-1"
              >
                {t(`analytics.heatmap.${dayKey}`)}
              </div>
              {Array.from({ length: 24 }, (_, hour) => {
                const cell = getCell(dayIndex, hour);
                const minutes = cell?.totalMinutes ?? 0;
                return (
                  <div
                    key={`${dayIndex}-${hour}`}
                    className="w-4 h-4 rounded-sm cursor-pointer transition-transform hover:scale-125"
                    style={{
                      backgroundColor: getHeatmapColor(minutes, maxMinutes),
                      minWidth: 16,
                      minHeight: 16,
                    }}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setTooltip({
                        x: rect.left + rect.width / 2,
                        y: rect.top - 4,
                        text: t("analytics.heatmap.tooltip", {
                          minutes: Math.round(minutes),
                        }),
                      });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                );
              })}
            </>
          ))}
        </div>

        {/* Tooltip */}
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
