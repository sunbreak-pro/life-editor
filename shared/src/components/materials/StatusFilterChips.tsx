import type { ReactNode } from "react";
import { cn } from "../cn";

export interface StatusFilterChip {
  id: string;
  /** Already-translated chip label (§6.4). */
  label: string;
  /** Optional count shown after the label (tabular-nums). */
  count?: number;
  /** Optional leading glyph (e.g. a status swatch / lucide icon). */
  icon?: ReactNode;
}

export interface StatusFilterChipsProps {
  chips: StatusFilterChip[];
  /** Selected chip id, or null for "no filter" (all items). */
  value: string | null;
  /** Re-clicking the selected chip clears the filter (emits null). */
  onChange: (id: string | null) => void;
  /** Already-translated accessible name for the group (§6.4). */
  label?: string;
  className?: string;
}

/*
 * Mobile Tasks round-pill status filter (brief). Selected = accent-subtle
 * fill + accent text/border + semibold; unselected = base surface + border +
 * secondary text; the count sits in tertiary. Toggle semantics: pressing the
 * active chip again clears the filter. Pure presentation: labels injected
 * already-translated (§6.4), lumen-* tokens only (§5). role="group" of
 * aria-pressed buttons (a single-select filter, not a tablist).
 */
export function StatusFilterChips({
  chips,
  value,
  onChange,
  label,
  className,
}: StatusFilterChipsProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("flex flex-wrap gap-2", className)}
    >
      {chips.map((chip) => {
        const active = chip.id === value;
        return (
          <button
            key={chip.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? null : chip.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lumen-full border px-3 py-1 text-sm",
              "transition-colors focus-visible:outline-none",
              "focus-visible:ring-2 focus-visible:ring-lumen-accent",
              active
                ? "border-lumen-accent bg-lumen-accent-subtle font-semibold text-lumen-accent"
                : "border-lumen-border bg-lumen-bg text-lumen-text-secondary hover:bg-lumen-hover",
            )}
          >
            {chip.icon != null && (
              <span aria-hidden="true" className="inline-flex">
                {chip.icon}
              </span>
            )}
            <span>{chip.label}</span>
            {chip.count != null && (
              <span
                className={cn(
                  "tabular-nums",
                  active ? "text-lumen-accent" : "text-lumen-text-tertiary",
                )}
              >
                {chip.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
