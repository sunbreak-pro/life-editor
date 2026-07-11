import { cn } from "../cn";
import type { ScheduleStatus } from "../../utils/scheduleStatus";

/*
 * ScheduleStatusTag (#222) — pure, presentational status pill for a schedule
 * item. Replaces the old round completion checkmark with a Tag-style label:
 *
 *   notStarted → grey   ("未着手" / "Not started")
 *   inProgress → blue   ("着手中" / "In progress")
 *   done       → green  ("完了"   / "Done")
 *
 * The status itself is DERIVED upstream (deriveScheduleStatus); this component
 * only paints it. When `onClick` is supplied it renders a <button> (hover
 * affordance + focus ring) so a click can toggle completion — the AgendaList
 * row-end and the EventEditorPane use this. Without `onClick` it is a plain
 * read-only <span> (WeekTimeGrid block).
 *
 * Pure presentation (CLAUDE.md §3.1 / §6.4): the label arrives already
 * translated; lumen-* tokens only, no hardcoded colors (§5/§6). Status colors
 * come from the schedule-tag-* token family (light/dark aware).
 */

export interface ScheduleStatusTagProps {
  status: ScheduleStatus;
  /** Already-translated status label (§6.4). */
  label: string;
  /** When set, the tag is a button that toggles completion on click. */
  onClick?: () => void;
  /**
   * Toggle state for the interactive (button) tag — surfaced as `aria-pressed`
   * so screen readers announce completed/not-completed, matching the old round
   * check. Only emitted in button mode; ignored by the read-only span.
   */
  pressed?: boolean;
  /** Accessible name for the interactive tag (falls back to `label`). */
  ariaLabel?: string;
  /** xs = calendar blocks (tight), sm = agenda rows / editor. Default "sm". */
  size?: "xs" | "sm";
  className?: string;
}

function statusColorClasses(status: ScheduleStatus): string {
  switch (status) {
    case "done":
      return "border-lumen-schedule-tag-done-border bg-lumen-schedule-tag-done-bg text-lumen-schedule-tag-done-fg";
    case "inProgress":
      return "border-lumen-schedule-tag-inprogress-border bg-lumen-schedule-tag-inprogress-bg text-lumen-schedule-tag-inprogress-fg";
    case "notStarted":
    default:
      return "border-lumen-schedule-tag-notstarted-border bg-lumen-schedule-tag-notstarted-bg text-lumen-schedule-tag-notstarted-fg";
  }
}

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent";

export function ScheduleStatusTag({
  status,
  label,
  onClick,
  pressed,
  ariaLabel,
  size = "sm",
  className,
}: ScheduleStatusTagProps) {
  const sizeClass =
    size === "xs"
      ? "px-1 py-px text-[9px] leading-tight"
      : "px-1.5 py-0.5 text-[11px]";
  const base = cn(
    "inline-flex shrink-0 items-center rounded-md border font-medium whitespace-nowrap",
    sizeClass,
    statusColorClasses(status),
    className,
  );

  if (onClick) {
    return (
      <button
        type="button"
        aria-label={ariaLabel ?? label}
        aria-pressed={pressed}
        onClick={onClick}
        className={cn(
          base,
          "cursor-pointer transition-opacity hover:opacity-80",
          FOCUS,
        )}
      >
        {label}
      </button>
    );
  }

  return (
    <span aria-hidden className={base}>
      {label}
    </span>
  );
}
