import { useMemo, useState } from "react";
import type { TimerSession } from "../../types/timer";
import { aggregateDailyTimeline } from "../../utils/analyticsAggregation";
import { formatDateKey } from "../../utils/dateKey";
import { ChartCard } from "./ChartCard";

export interface DailyTimelineLabels {
  title: string;
  noSessions: string;
  work: string;
  break: string;
  longBreak: string;
}

interface DailyTimelineProps {
  sessions: TimerSession[];
  labels: DailyTimelineLabels;
}

// Session-type → block tint. WORK/BREAK reuse lumen chrome tokens; LONG_BREAK
// uses a distinct categorical token so the three phases stay separable.
const SESSION_COLORS: Record<string, string> = {
  WORK: "var(--color-lumen-accent)",
  BREAK: "var(--color-lumen-accent-secondary)",
  LONG_BREAK: "var(--color-chart-cat-7)",
};

const HOURS = Array.from({ length: 25 }, (_, i) => i);
const DISPLAY_HOURS = [0, 3, 6, 9, 12, 15, 18, 21, 24];

export function DailyTimeline({
  sessions,
  labels,
}: DailyTimelineProps): React.JSX.Element {
  const [selectedDate, setSelectedDate] = useState(() =>
    formatDateKey(new Date()),
  );

  const blocks = useMemo(
    () => aggregateDailyTimeline(sessions, selectedDate),
    [sessions, selectedDate],
  );

  const sessionLabel = (type: string): string =>
    type === "WORK"
      ? labels.work
      : type === "BREAK"
        ? labels.break
        : labels.longBreak;

  const dateControl = (
    <input
      type="date"
      value={selectedDate}
      onChange={(e) => setSelectedDate(e.target.value)}
      className="rounded-md border border-lumen-border bg-lumen-bg px-2 py-1 text-xs text-lumen-text focus:border-lumen-accent focus:outline-none"
    />
  );

  return (
    <ChartCard title={labels.title} control={dateControl}>
      {blocks.length === 0 ? (
        <p className="py-4 text-center text-xs text-lumen-text-secondary">
          {labels.noSessions}
        </p>
      ) : (
        <div className="relative">
          {/* Hour labels */}
          <div className="mb-1 flex justify-between">
            {DISPLAY_HOURS.map((h) => (
              <span
                key={h}
                className="text-[9px] text-lumen-text-tertiary"
                style={{
                  position: "absolute",
                  left: `${(h / 24) * 100}%`,
                  transform: "translateX(-50%)",
                }}
              >
                {h}
              </span>
            ))}
          </div>

          {/* Timeline bar */}
          <div className="relative mt-5 h-8 overflow-hidden rounded-md bg-lumen-surface-sunken">
            {/* Hour grid lines */}
            {HOURS.map((h) => (
              <div
                key={h}
                className="absolute bottom-0 top-0 border-l"
                style={{
                  left: `${(h / 24) * 100}%`,
                  borderColor:
                    h % 6 === 0 ? "var(--color-lumen-border)" : "transparent",
                }}
              />
            ))}

            {/* Session blocks */}
            {blocks.map((block, i) => {
              const startPercent =
                ((block.startHour * 60 + block.startMinute) / (24 * 60)) * 100;
              const widthPercent = (block.durationMinutes / (24 * 60)) * 100;
              return (
                <div
                  key={i}
                  className="absolute bottom-1 top-1 rounded-sm opacity-85 transition-opacity hover:opacity-100"
                  style={{
                    left: `${startPercent}%`,
                    width: `${Math.max(widthPercent, 0.3)}%`,
                    backgroundColor:
                      SESSION_COLORS[block.sessionType] ?? SESSION_COLORS.WORK,
                  }}
                  title={`${block.startHour}:${String(block.startMinute).padStart(2, "0")} - ${Math.round(block.durationMinutes)}min (${block.sessionType})`}
                />
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-2 flex justify-center gap-4">
            {Object.entries(SESSION_COLORS).map(([type, color]) => (
              <div key={type} className="flex items-center gap-1">
                <div
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: color }}
                />
                <span className="text-[10px] text-lumen-text-secondary">
                  {sessionLabel(type)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </ChartCard>
  );
}
