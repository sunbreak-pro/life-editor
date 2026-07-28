import { useRef } from "react";
import type { KeyboardEvent } from "react";
import { cn } from "./cn";
import { stepSegmentFocus } from "./segmentedKeyNav";

export interface SegmentedOption {
  id: string;
  /** Already-translated segment label (§6.4). */
  label: string;
}

export interface SegmentedControlProps {
  options: SegmentedOption[];
  value: string;
  onChange: (id: string) => void;
  /** Already-translated accessible name for the tablist (§6.4). */
  label?: string;
  /**
   * Locks every segment while the host is busy applying the last choice
   * (#434). Pointer and keyboard both no-op, and the track reads as busy —
   * a silently-dropped click is what "押しても無反応" looked like.
   */
  disabled?: boolean;
  className?: string;
}

/*
 * Mobile-standard segmented control (target-IA — the narrow-width echo of the
 * Desktop HeaderTabs). Recessed track (bg-secondary) with equal-width
 * segments; the active segment lifts onto the base surface with a small
 * elevation. No badges (Mobile drops the count pills). WAI-ARIA tablist with
 * roving tabindex: ←/→ move focus + activate. Pure presentation: labels
 * injected already-translated (§6.4), lumen-* tokens only (§5). Segments carry
 * horizontal padding (px-3) so they stay visually separated even under
 * intrinsic (w-auto) width, where flex-1 no longer pads them apart.
 */
export function SegmentedControl({
  options,
  value,
  onChange,
  label,
  disabled = false,
  className,
}: SegmentedControlProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  // Keeps the tablist keyboard-reachable when value matches no option:
  // the first segment falls back to tabindex 0 (roving-tabindex invariant).
  const activeIndex = options.findIndex((o) => o.id === value);

  const handleKeyDown = (
    e: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (disabled) return;
    const next = stepSegmentFocus(e, index, options, refs);
    if (next) onChange(next.id);
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      aria-busy={disabled || undefined}
      className={cn(
        "flex gap-0.5 rounded-lumen-md bg-lumen-bg-secondary p-0.5",
        className,
      )}
    >
      {options.map((option, i) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled}
            tabIndex={active || (activeIndex === -1 && i === 0) ? 0 : -1}
            onClick={() => onChange(option.id)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={cn(
              "flex-1 rounded-lumen-sm px-3 py-1.5 text-center text-sm",
              "transition-colors focus-visible:outline-none",
              "focus-visible:ring-2 focus-visible:ring-lumen-accent",
              "disabled:cursor-not-allowed disabled:opacity-60",
              active
                ? "bg-lumen-bg font-medium text-lumen-text shadow-lumen-sm"
                : "text-lumen-text-secondary",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
