import type { TodoStatus } from "../types/todoTree";
import { cn } from "./cn";
import { FOCUS_RING_TIGHT } from "./styleTokens";
import {
  STATUS_ICON,
  STATUS_ORDER,
  statusLabel,
  type StatusLabelSet,
} from "./taskStatusVisuals";

/*
 * One-tap status control for a LIST ROW (#796).
 *
 * The three statuses side by side is `TaskStatusChoices`, and it is the right
 * shape where there is width for it (the touch detail panel). A row in a list
 * has no such width, so this is the other half of the same idea: one button
 * showing the current status, advancing to the next on press —
 * NOT_STARTED → IN_PROGRESS → DONE → NOT_STARTED, the same cycle
 * `useTodoTreeCRUD.toggleTodoStatus` has always used on the Tasks side.
 *
 * The icons and the order come from `taskStatusVisuals`, so a status is drawn
 * the same here as on the Kanban board and the mobile task list — the point of
 * #796 is that Briefing stops having a vocabulary of its own.
 *
 * Pure presentation (§6.4): labels arrive already translated, the mutation is
 * the injected onChange, lumen-* tokens only (§5).
 */

export interface TaskStatusCycleButtonProps {
  status: TodoStatus;
  /** The next status in the cycle — the host persists it. */
  onChange: (next: TodoStatus) => void;
  /** Already-translated per-status labels (§6.4). */
  labels: StatusLabelSet;
  /**
   * Already-translated name of what the button controls, e.g. "Status" (§6.4).
   * Composed with the current status into the accessible name, because a button
   * labelled only "Not started" reads as one that SETS Not started.
   */
  label: string;
  /**
   * Colour of the icon once the task has left NOT_STARTED. Defaults to the app
   * accent; the newspaper surfaces pass their 朱 token so the paper keeps a
   * single voice for the user's own marks.
   */
  accentClassName?: string;
  className?: string;
}

/** The status one press advances to. */
export function nextTaskStatus(status: TodoStatus): TodoStatus {
  const i = STATUS_ORDER.indexOf(status);
  return STATUS_ORDER[(i + 1) % STATUS_ORDER.length] ?? "NOT_STARTED";
}

export function TaskStatusCycleButton({
  status,
  onChange,
  labels,
  label,
  accentClassName = "text-lumen-accent",
  className,
}: TaskStatusCycleButtonProps) {
  const Icon = STATUS_ICON[status];
  return (
    <button
      type="button"
      onClick={() => onChange(nextTaskStatus(status))}
      aria-label={`${label}: ${statusLabel(status, labels)}`}
      title={statusLabel(status, labels)}
      className={cn(
        // min-h-11 / min-w-11 = 44px, the touch-target floor (mobile-scope.md).
        "flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lumen-md transition-colors",
        FOCUS_RING_TIGHT,
        status === "NOT_STARTED"
          ? "text-lumen-text-secondary"
          : accentClassName,
        className,
      )}
    >
      <Icon size={18} aria-hidden className="shrink-0" />
    </button>
  );
}
