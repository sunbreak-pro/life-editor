import { useMemo, useState, Fragment } from "react";
import type { TimerSession } from "../../types/timer";
import { aggregateByHourAndDay } from "../../utils/analyticsAggregation";
import { ChartCard } from "./ChartCard";

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
  /** Right-aligned meta text (e.g. "時間帯 × 曜日"). */
  meta: string;
  /** Legend endpoints: low → high intensity. */
  less: string;
  more: string;
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

/*
 * 4-step intensity scale, tokenized (design 1e). The old rgba(34,197,94,…)
 * literals are gone: empty cells sit on the sunken surface, filled cells use
 * the status-done green band at 30% / 60% / 100% opacity. These are literal
 * class strings so Tailwind's @source scan picks them up.
 */
const HEAT_STEPS = [
  "bg-lumen-surface-sunken",
  "bg-lumen-status-done-band/30",
  "bg-lumen-status-done-band/60",
  "bg-lumen-status-done-band",
] as const;

function heatStep(minutes: number, maxMinutes: number): string {
  if (minutes === 0 || maxMinutes === 0) return HEAT_STEPS[0];
  const intensity = Math.min(minutes / maxMinutes, 1);
  if (intensity < 0.34) return HEAT_STEPS[1];
  if (intensity < 0.67) return HEAT_STEPS[2];
  return HEAT_STEPS[3];
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
    <ChartCard title={labels.title} meta={labels.meta}>
      <div className="relative overflow-x-auto">
        <div
          className="inline-grid gap-[2px]"
          style={{
            gridTemplateColumns: `28px repeat(24, 1fr)`,
            gridTemplateRows: `16px repeat(7, 1fr)`,
          }}
        >
          {/* Hour labels row */}
          <div />
          {Array.from({ length: 24 }, (_, h) => (
            <div
              key={`h-${h}`}
              className="text-center text-[9px] leading-4 text-lumen-text-tertiary"
            >
              {h}
            </div>
          ))}

          {/* Day rows */}
          {DAY_KEYS.map((dayKey, dayIndex) => (
            <Fragment key={`row-${dayKey}`}>
              <div className="flex items-center pr-1 text-[10px] text-lumen-text-tertiary">
                {labels.days[dayKey]}
              </div>
              {Array.from({ length: 24 }, (_, hour) => {
                const cell = getCell(dayIndex, hour);
                const minutes = cell?.totalMinutes ?? 0;
                return (
                  <div
                    key={`${dayIndex}-${hour}`}
                    className={`h-3.5 w-3.5 min-h-[14px] min-w-[14px] rounded-sm transition-transform hover:scale-125 ${heatStep(minutes, maxMinutes)}`}
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

        {/* Intensity legend (少ない → 多い) */}
        <div className="mt-3 flex items-center justify-end gap-1.5">
          <span className="text-[10px] text-lumen-text-tertiary">
            {labels.less}
          </span>
          {HEAT_STEPS.map((step) => (
            <span key={step} className={`h-3 w-3 rounded-sm ${step}`} />
          ))}
          <span className="text-[10px] text-lumen-text-tertiary">
            {labels.more}
          </span>
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="pointer-events-none fixed z-50 rounded-md border border-lumen-border bg-lumen-bg px-2 py-1 text-xs text-lumen-text shadow-lumen-sm"
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
    </ChartCard>
  );
}
