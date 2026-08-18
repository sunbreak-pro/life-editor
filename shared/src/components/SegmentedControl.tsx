import { useRef } from "react";
import type { KeyboardEvent } from "react";
import { cn } from "./cn";
import { stepSegmentFocus } from "./segmentedKeyNav";
import { TAP_TARGET_TALL } from "./styleTokens";

export interface SegmentedOption {
  id: string;
  /** Already-translated segment label (§6.4). */
  label: string;
}

/**
 * How much vertical room a segment takes (#1039).
 *
 *  - "md" — the original. Every in-panel use (schedule editors, the sidebar
 *    tab pair) keeps it: those sit in their own boxes where 4px changes
 *    nothing, and shrinking the type there would just make them harder to read.
 *  - "sm" — the mobile SECTION tab band, which is a different problem. It runs
 *    the full width at the very top of every narrow screen, so its height is
 *    subtracted from the content on all seven sections at once ("要素を圧迫
 *    している"). One step down on the type and a slightly tighter gutter take
 *    the band from 36px to 32px.
 *
 * The touch target does NOT follow the box down: "sm" carries TAP_TARGET_TALL,
 * which hangs an invisible 44px hit area over the smaller pill. The band
 * therefore ends up EASIER to hit than it was before this size existed (36px),
 * while reading as less furniture.
 */
export type SegmentedControlSize = "md" | "sm";

const SIZE_CLASSES: Record<SegmentedControlSize, string> = {
  md: "px-3 py-1.5 text-sm",
  sm: `px-2.5 py-1.5 text-xs ${TAP_TARGET_TALL}`,
};

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
   *
   * Deliberately NOT the `disabled` attribute: this is a tablist with a
   * roving tabindex, and every segment locks at once. A real `disabled`
   * would strip the whole track of focusable elements, so the browser would
   * dump keyboard focus on <body> mid-interaction and never bring it back.
   * `aria-disabled` + inert handlers keeps the focused segment focused,
   * which is also what the ARIA authoring practices ask for on tabs.
   */
  disabled?: boolean;
  /** Vertical density — see SegmentedControlSize. Default "md". */
  size?: SegmentedControlSize;
  className?: string;
}

/*
 * Mobile-standard segmented control (target-IA — the narrow-width echo of the
 * Desktop HeaderTabs). Recessed track (bg-secondary) with equal-width
 * segments; the active segment lifts onto the base surface with a small
 * elevation. No badges (Mobile drops the count pills). WAI-ARIA tablist with
 * roving tabindex: ←/→ and ↑/↓ move focus + activate (shared
 * stepSegmentFocus — the same keys as its two radiogroup siblings, #779).
 * Pure presentation: labels
 * injected already-translated (§6.4), lumen-* tokens only (§5). Segments carry
 * horizontal padding at both sizes so they stay visually separated even under
 * intrinsic (w-auto) width, where flex-1 no longer pads them apart.
 */
export function SegmentedControl({
  options,
  value,
  onChange,
  label,
  disabled = false,
  size = "md",
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
            aria-disabled={disabled || undefined}
            tabIndex={active || (activeIndex === -1 && i === 0) ? 0 : -1}
            onClick={disabled ? undefined : () => onChange(option.id)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={cn(
              "flex-1 rounded-lumen-sm text-center",
              SIZE_CLASSES[size],
              "transition-colors focus-visible:outline-none",
              "focus-visible:ring-2 focus-visible:ring-lumen-accent",
              disabled && "cursor-not-allowed opacity-60",
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
