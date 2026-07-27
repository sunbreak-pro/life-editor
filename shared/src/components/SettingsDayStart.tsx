import { Sunrise } from "lucide-react";
import { cn } from "./cn";

/** 0–23 — the selectable day-start hours. */
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

export interface SettingsDayStartProps {
  /** Current day-start hour (0–23). */
  value: number;
  onChange: (hour: number) => void;
  /** Already-translated copy (CLAUDE.md §6.4: no useTranslation here). */
  labels: {
    heading: string;
    description: string;
    hourLabel: string;
    hint: string;
  };
}

/*
 * Day-start (rollover) hour card (#373 — the write side of the #218 pref).
 * Pure / props-injected: the value + setter come from the host
 * (useDayStartHourPref), which persists to `life-editor-day-start-hour`.
 * The option labels are plain zero-padded 24h clock strings ("00:00".."23:00")
 * — the same notation the Schedule grid axis and routine times already use in
 * both locales — so they carry no translated copy and are built here instead
 * of being injected. The hint spells out that readers evaluate the boundary at
 * call time (utils/dateKey), i.e. a change lands on the next "today"
 * computation rather than repainting an open screen.
 * lumen-* tokens only, opaque surface (CLAUDE.md §5 / §6.4).
 */
export function SettingsDayStart({
  value,
  onChange,
  labels,
}: SettingsDayStartProps) {
  return (
    <div className="flex flex-col gap-3" data-section-id="day-start">
      <div className="flex flex-col gap-1">
        <h3 className="flex items-center gap-2 text-base font-semibold text-lumen-text">
          <Sunrise size={16} className="text-lumen-text-secondary" />
          <span>{labels.heading}</span>
        </h3>
        <p className="text-sm text-lumen-text-secondary">
          {labels.description}
        </p>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-lumen-text">
          {labels.hourLabel}
        </span>
        <select
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={cn(
            "w-full rounded-lumen-md border border-lumen-border bg-lumen-bg px-3 py-2 text-sm text-lumen-text",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
          )}
        >
          {HOURS.map((hour) => (
            <option key={hour} value={hour}>
              {`${String(hour).padStart(2, "0")}:00`}
            </option>
          ))}
        </select>
      </label>

      <p className="text-xs text-lumen-text-secondary">{labels.hint}</p>
    </div>
  );
}
