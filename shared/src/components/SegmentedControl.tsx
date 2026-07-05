import { useRef } from "react";
import type { KeyboardEvent } from "react";
import { cn } from "./cn";

export interface SegmentedOption {
  id: string;
  /** Already-translated segment label (§6.4). */
  label: string;
}

export interface SegmentedControlProps {
  options: SegmentedOption[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}

/*
 * Mobile-standard segmented control (target-IA — the narrow-width echo of the
 * Desktop HeaderTabs). Recessed track (bg-secondary) with equal-width
 * segments; the active segment lifts onto the base surface with a small
 * elevation. No badges (Mobile drops the count pills). WAI-ARIA tablist with
 * roving tabindex: ←/→ move focus + activate. Pure presentation: labels
 * injected already-translated (§6.4), lumen-* tokens only (§5).
 */
export function SegmentedControl({
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (
    e: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const dir = e.key === "ArrowRight" ? 1 : -1;
    const next = (index + dir + options.length) % options.length;
    refs.current[next]?.focus();
    onChange(options[next].id);
  };

  return (
    <div
      role="tablist"
      className={cn(
        "flex rounded-lumen-md bg-lumen-bg-secondary p-0.5",
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
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(option.id)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={cn(
              "flex-1 rounded-lumen-sm py-1.5 text-center text-sm",
              "transition-colors focus-visible:outline-none",
              "focus-visible:ring-2 focus-visible:ring-lumen-accent",
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
