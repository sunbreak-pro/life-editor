import { useMemo, useState } from "react";
import type { TimerSession } from "../../types/timer";
import { aggregateDailyTimeline } from "../../utils/analyticsAggregation";
import { formatDateKey } from "../../utils/dateKey";

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

// Session-type → block tint. WORK/BREAK use notion tokens; LONG_BREAK has no
// dedicated token so it keeps the amber accent the frontend uses (data-series
// colour, not container chrome).
const SESSION_COLORS: Record<string, string> = {
  WORK: "var(--color-notion-accent, #2563eb)",
  BREAK: "var(--color-notion-success, #22c55e)",
  LONG_BREAK: "#f59e0b",
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

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-notion-text">
          {labels.title}
        </h3>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-2 py-1 text-xs rounded-md border border-notion-border bg-notion-bg text-notion-text focus:outline-none focus:border-notion-accent"
        />
      </div>

      {blocks.length === 0 ? (
        <p className="text-xs text-notion-text-secondary text-center py-4">
          {labels.noSessions}
        </p>
      ) : (
        <div className="relative">
          {/* Hour labels */}
          <div className="flex justify-between mb-1">
            {DISPLAY_HOURS.map((h) => (
              <span
                key={h}
                className="text-[9px] text-notion-text-secondary"
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
          <div
            className="relative h-8 rounded-md overflow-hidden mt-5"
            style={{
              backgroundColor: "var(--color-notion-hover, #f3f4f6)",
            }}
          >
            {/* Hour grid lines */}
            {HOURS.map((h) => (
              <div
                key={h}
                className="absolute top-0 bottom-0 border-l"
                style={{
                  left: `${(h / 24) * 100}%`,
                  borderColor:
                    h % 6 === 0
                      ? "var(--color-notion-border, #e5e5e5)"
                      : "transparent",
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
                  className="absolute top-1 bottom-1 rounded-sm opacity-85 hover:opacity-100 transition-opacity"
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
          <div className="flex gap-4 mt-2 justify-center">
            {Object.entries(SESSION_COLORS).map(([type, color]) => (
              <div key={type} className="flex items-center gap-1">
                <div
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: color }}
                />
                <span className="text-[10px] text-notion-text-secondary">
                  {sessionLabel(type)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
