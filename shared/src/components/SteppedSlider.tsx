import { useCallback, useRef } from "react";
import { cn } from "./cn";

export interface SteppedSliderProps {
  /** Current discrete value (min..max inclusive). */
  value: number;
  min: number;
  max: number;
  /** Step between ticks. Default 1. */
  step?: number;
  onChange: (value: number) => void;
  /** Already-translated accessible label (§6.4). */
  ariaLabel: string;
  /** Already-translated aria-valuetext, e.g. "16px (4/10)". */
  valueText?: string;
  /** Left / right end captions (already translated). Optional. */
  minLabel?: string;
  maxLabel?: string;
  /** Thumb size — `lg` (28px) for touch, `md` (16px) default for pointer. */
  size?: "md" | "lg";
}

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

/*
 * Discrete tick slider (theme system + any 1..N choice). Pure / props-injected
 * (CLAUDE.md §6.4), lumen-* tokens only. Implemented as a WAI-ARIA slider
 * (role="slider" + arrow/Home/End keys + click-to-seek) rather than a native
 * <input type=range> so the ticks, travelled fill, and thumb can be styled
 * with tokens. The run track uses border-strong; the travelled fill + thumb
 * use accent.
 */
export function SteppedSlider({
  value,
  min,
  max,
  step = 1,
  onChange,
  ariaLabel,
  valueText,
  minLabel,
  maxLabel,
  size = "md",
}: SteppedSliderProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const span = max - min || 1;
  const percent = (clamp(value, min, max) - min) / span;
  const ticks = Math.floor(span / step) + 1;
  const thumbPx = size === "lg" ? 28 : 16;

  const commit = useCallback(
    (next: number) => {
      const clamped = clamp(next, min, max);
      if (clamped !== value) onChange(clamped);
    },
    [min, max, value, onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
        case "ArrowUp":
          e.preventDefault();
          commit(value + step);
          break;
        case "ArrowLeft":
        case "ArrowDown":
          e.preventDefault();
          commit(value - step);
          break;
        case "Home":
          e.preventDefault();
          commit(min);
          break;
        case "End":
          e.preventDefault();
          commit(max);
          break;
        default:
          break;
      }
    },
    [commit, value, step, min, max],
  );

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0) return;
      const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
      const raw = min + ratio * span;
      // Snap to the nearest step.
      commit(min + Math.round((raw - min) / step) * step);
    },
    [commit, min, span, step],
  );

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={valueText}
        aria-orientation="horizontal"
        onKeyDown={handleKeyDown}
        onPointerDown={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement).focus();
          seekFromClientX(e.clientX);
        }}
        className={cn(
          "relative w-full cursor-pointer touch-none select-none",
          "focus-visible:outline-none",
          size === "lg" ? "h-8" : "h-6",
        )}
      >
        {/* Run track (unfilled). */}
        <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-lumen-border-strong" />
        {/* Travelled fill. */}
        <span
          className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-lumen-accent"
          style={{ width: `${percent * 100}%` }}
        />
        {/* Tick dots. */}
        <span className="absolute inset-x-0.5 top-1/2 flex -translate-y-1/2 items-center justify-between">
          {Array.from({ length: ticks }).map((_, i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full border border-lumen-border-strong bg-lumen-bg"
            />
          ))}
        </span>
        {/* Thumb. */}
        <span
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-lumen-bg bg-lumen-accent shadow-lumen-sm"
          style={{
            left: `${percent * 100}%`,
            width: thumbPx,
            height: thumbPx,
          }}
        />
      </div>

      {(minLabel || maxLabel) && (
        <div className="flex justify-between text-xs text-lumen-text-secondary">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      )}
    </div>
  );
}
