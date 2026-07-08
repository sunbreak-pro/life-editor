import { useRef } from "react";
import type { KeyboardEvent } from "react";
import { cn } from "../cn";
import type { DatePreset } from "./AnalyticsFilterContext";

/*
 * Analytics DateRangePresetSelector (design-analytics-v2). The header-level
 * period pill group (7日 / 30日 / 今月 / 3ヶ月 / 全期間) that finally wires the
 * AnalyticsFilterContext.applyPreset logic — previously implemented but never
 * mounted — to a real control. Recessed track (bg-secondary) with the active
 * pill lifted onto the base surface + a small elevation, echoing the shell
 * SegmentedControl visuals. Single-select filter semantics (radiogroup, not
 * tablist): ←/→ roam + select. Pure presentation: labels arrive
 * already-translated (§6.4), lumen-* tokens only (§5).
 */
const PRESET_ORDER: readonly DatePreset[] = [
  "7d",
  "30d",
  "thisMonth",
  "3m",
  "all",
];

export interface DateRangePresetSelectorProps {
  value: DatePreset;
  onChange: (preset: DatePreset) => void;
  /** Already-translated accessible name for the group (§6.4). */
  label: string;
  /** Already-translated short label per preset (§6.4). */
  options: Record<DatePreset, string>;
  className?: string;
}

export function DateRangePresetSelector({
  value,
  onChange,
  label,
  options,
  className,
}: DateRangePresetSelectorProps): React.JSX.Element {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeIndex = PRESET_ORDER.findIndex((p) => p === value);

  const handleKeyDown = (
    e: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const dir = e.key === "ArrowRight" ? 1 : -1;
    const next = (index + dir + PRESET_ORDER.length) % PRESET_ORDER.length;
    const nextPreset = PRESET_ORDER[next];
    if (!nextPreset) return;
    refs.current[next]?.focus();
    onChange(nextPreset);
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "flex rounded-lumen-md bg-lumen-bg-secondary p-0.5",
        className,
      )}
    >
      {PRESET_ORDER.map((preset, i) => {
        const active = preset === value;
        return (
          <button
            key={preset}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active || (activeIndex === -1 && i === 0) ? 0 : -1}
            onClick={() => onChange(preset)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={cn(
              "rounded-lumen-sm px-3 py-1 text-xs transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
              active
                ? "bg-lumen-bg font-medium text-lumen-text shadow-lumen-sm"
                : "text-lumen-text-secondary hover:text-lumen-text",
            )}
          >
            {options[preset]}
          </button>
        );
      })}
    </div>
  );
}
