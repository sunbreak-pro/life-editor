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
 *
 * #1368 made it the ONE todo checkbox: the paper's carryover rows and the
 * Schedule tray's binary rows drew their own boxes at their own sizes, so the
 * same todo wore three looks depending on where the user met it.
 *
 * #1486 let a host add the row's own name to that: in a list, "what the control
 * sets" is only half an answer — the other half is which of the five identical
 * rows it sets it on.
 */

/**
 * Diameter of the drawn mark, in px — and the reason it is 20 rather than the
 * 18 this control started with: the Schedule rightSidebar tray drew a `size-5`
 * box, that is the one the user reads comfortably (#1368), so the shared
 * control adopts ITS size instead of the other way round.
 *
 * Exported because one todo checkbox is NOT a React component: the Notes
 * editor's is a ProseMirror-owned <input> that only CSS can size
 * (`--todo-checkbox-size` in web/src/index.css).
 * web/tests/taskListCheckboxSize.test.ts fails if the two numbers drift apart.
 */
export const TODO_CHECKBOX_ICON_PX = 20;

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
   * Already-translated name of the row the status belongs to — a todo's title
   * (§6.4). Optional, because a control that stands alone is named well enough
   * by what it sets. In a LIST it is not (#1486): a paper printing five todos
   * announces "Status: Not started" five times, and the reader who cannot see
   * the row has no way to tell which todo the checkbox in front of them ticks.
   */
  itemName?: string;
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
  itemName,
  accentClassName = "text-lumen-accent",
  className,
}: TodoStatusCheckboxProps) {
  const Icon = STATUS_ICON[status];
  const done = status === "DONE";
  // "Write report — Status: Not started": which row, then what the control
  // sets, then where that stands. The row comes first because it is what the
  // user is listening for while they walk down a list (#1486).
  const statusText = statusLabel(status, labels);
  const name =
    itemName === undefined
      ? `${label}: ${statusText}`
      : `${itemName} — ${label}: ${statusText}`;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      onClick={() => onChange(toggledTodoStatus(status))}
      aria-label={name}
      title={statusText}
      className={cn(
        // min-h-11 / min-w-11 = 44px, the touch-target floor (mobile-scope.md).
        "flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lumen-md transition-colors",
        FOCUS_RING_TIGHT,
        done ? accentClassName : "text-lumen-text-secondary",
        className,
      )}
    >
      <Icon size={TODO_CHECKBOX_ICON_PX} aria-hidden className="shrink-0" />
    </button>
  );
}
