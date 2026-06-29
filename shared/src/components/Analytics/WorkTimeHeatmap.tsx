import { useMemo, useState, Fragment } from "react";
import type { TimerSession } from "../../types/timer";
import { aggregateByHourAndDay } from "../../utils/analyticsAggregation";

export type HeatmapDayKey =
  | "mon"
  | "tue"
  | "wed"
  | "thu"
  | "fri"
  | "sat"
  | "sun";

export interface WorkTimeHeatmapLabels {
  title: string;
  days: Record<HeatmapDayKey, string>;
  /** "{minutes} min" — host interpolates. */
  tooltip: (minutes: number) => string;
}

interface WorkTimeHeatmapProps {
  sessions: TimerSession[];
  labels: WorkTimeHeatmapLabels;
}

const DAY_KEYS: readonly HeatmapDayKey[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
];

function getHeatmapColor(minutes: number, maxMinutes: number): string {
  if (minutes === 0 || maxMinutes === 0)
    return "var(--color-ink-hover, #f3f4f6)";
  const intensity = Math.min(minutes / maxMinutes, 1);
  if (intensity < 0.25) return "rgba(34, 197, 94, 0.2)";
  if (intensity < 0.5) return "rgba(34, 197, 94, 0.4)";
  if (intensity < 0.75) return "rgba(34, 197, 94, 0.65)";
  return "rgba(34, 197, 94, 0.9)";
}

export function WorkTimeHeatmap({
  sessions,
  labels,
}: WorkTimeHeatmapProps): React.JSX.Element {
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
      <h3 className="text-sm font-semibold text-ink-text mb-3">
        {labels.title}
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
              className="text-[9px] text-ink-text-secondary text-center leading-5"
            >
              {h}
            </div>
          ))}

          {/* Day rows */}
          {DAY_KEYS.map((dayKey, dayIndex) => (
            <Fragment key={`row-${dayKey}`}>
              <div className="text-[10px] text-ink-text-secondary flex items-center pr-1">
                {labels.days[dayKey]}
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
                        text: labels.tooltip(Math.round(minutes)),
                      });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="fixed z-50 px-2 py-1 text-xs rounded-md bg-ink-bg border border-ink-border shadow-sm text-ink-text pointer-events-none"
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
