import type { TodoStatus } from "../types/todoTree";
import { cn } from "./cn";
import { FOCUS_RING_TIGHT } from "./styleTokens";
import {
  STATUS_ICON,
  STATUS_ORDER,
  statusLabel,
  type StatusLabelSet,
} from "./todoStatusVisuals";

/*
 * Touch status picker (#470) — every status side by side, each set in a single
 * tap. The Desktop detail panel toggles with one control (TodoDetailPanel's
 * built-in button), which hides the available values; on a phone the whole set
 * is worth the width. #873 took the set from three values down to two
 * (未完 / 完了), so the row is now a pair.
 *
 * Toggle buttons (`aria-pressed`), not a radiogroup: a real radiogroup owes the
 * user arrow-key navigation with a roving tabindex, and this row exists for
 * touch. Pure presentation — labels arrive already-translated (§6.4), the
 * mutation is the injected onChange, lumen-* tokens only (§5).
 */

export interface TodoStatusChoicesProps {
  /** Current status. null / undefined renders every choice unselected. */
  value?: TodoStatus | null;
  onChange: (status: TodoStatus) => void;
  /** Already-translated per-status labels (§6.4). */
  labels: StatusLabelSet;
  /** Already-translated accessible name for the group (§6.4). */
  label: string;
  className?: string;
}

export function TodoStatusChoices({
  value,
  onChange,
  labels,
  label,
  className,
}: TodoStatusChoicesProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("grid grid-cols-2 gap-1.5", className)}
    >
      {STATUS_ORDER.map((status) => {
        const Icon = STATUS_ICON[status];
        const active = status === value;
        return (
          <button
            key={status}
            type="button"
            onClick={() => onChange(status)}
            aria-pressed={active}
            className={cn(
              // min-h-11 = 44px, the touch-target floor.
              "flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs",
              "transition-colors",
              FOCUS_RING_TIGHT,
              active
                ? "border-lumen-accent bg-lumen-accent-subtle font-semibold text-lumen-accent"
                : "border-lumen-border bg-lumen-bg text-lumen-text hover:bg-lumen-hover",
            )}
          >
            <Icon size={14} aria-hidden className="shrink-0" />
            <span className="truncate">{statusLabel(status, labels)}</span>
          </button>
        );
      })}
    </div>
  );
}
