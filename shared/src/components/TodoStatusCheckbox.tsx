import type { TodoStatus } from "../types/todoTree";
import { cn } from "./cn";
import { FOCUS_RING_TIGHT } from "./styleTokens";
import {
  STATUS_ICON,
  statusLabel,
  type StatusLabelSet,
} from "./todoStatusVisuals";

/*
 * One-tap status control for a LIST ROW (#796, rebuilt for #873).
 *
 * Was `TodoStatusCycleButton`: three statuses, one press advancing to the next.
 * #873 (D-20260815-materials-1 = B) retired the middle value, so a press no
 * longer walks a cycle — it checks or unchecks. The control says so to assistive
 * tech (`role="checkbox"` + `aria-checked`) instead of presenting itself as a
 * plain button whose effect the user has to guess.
 *
 * The icons come from `todoStatusVisuals`, so a status is drawn the same here as
 * on the Kanban board and the mobile todo list — the point of #796 is that
 * Briefing stops having a vocabulary of its own.
 *
 * Pure presentation (§6.4): labels arrive already translated, the mutation is
 * the injected onChange, lumen-* tokens only (§5).
 */

export interface TodoStatusCheckboxProps {
  status: TodoStatus;
  /** The status the press lands on — the host persists it. */
  onChange: (next: TodoStatus) => void;
  /** Already-translated per-status labels (§6.4). */
  labels: StatusLabelSet;
  /**
   * Already-translated name of what the control sets, e.g. "Status" (§6.4).
   * Composed with the current status into the accessible name, because a
   * checkbox named only "Done" reads as one that is about something called
   * "Done" rather than one reporting the todo's state.
   */
  label: string;
  /**
   * Colour of the icon once the todo is done. Defaults to the app accent; the
   * newspaper surfaces pass their 朱 token so the paper keeps a single voice
   * for the user's own marks.
   */
  accentClassName?: string;
  className?: string;
}

/** The status one press lands on. */
export function toggledTodoStatus(status: TodoStatus): TodoStatus {
  return status === "DONE" ? "NOT_STARTED" : "DONE";
}

export function TodoStatusCheckbox({
  status,
  onChange,
  labels,
  label,
  accentClassName = "text-lumen-accent",
  className,
}: TodoStatusCheckboxProps) {
  const Icon = STATUS_ICON[status];
  const done = status === "DONE";
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      onClick={() => onChange(toggledTodoStatus(status))}
      aria-label={`${label}: ${statusLabel(status, labels)}`}
      title={statusLabel(status, labels)}
      className={cn(
        // min-h-11 / min-w-11 = 44px, the touch-target floor (mobile-scope.md).
        "flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lumen-md transition-colors",
        FOCUS_RING_TIGHT,
        done ? accentClassName : "text-lumen-text-secondary",
        className,
      )}
    >
      <Icon size={18} aria-hidden className="shrink-0" />
    </button>
  );
}
