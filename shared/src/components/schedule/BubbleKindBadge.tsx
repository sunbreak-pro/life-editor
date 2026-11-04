import { cn } from "../cn";

/*
 * BubbleKindBadge (#2564) — the kind capsule at the head of the Schedule's
 * click bubble, as the Claude Design proposal draws it: filled with the kind's
 * own colour, no icon.
 *
 * Not a variant of ItemRoleBadge: that one is the outlined chip with an icon
 * that the tag hub and the tag picker speak in, and it has to stay as it is
 * there. It also has no "routine" or "holiday" — a repeat is an Event with a
 * repeat to the data layer (#185), and a holiday has no row at all — while the
 * bubble has to tell all four apart.
 *
 * Pure presentation: the label arrives already translated (§6.4).
 */

export type BubbleKind = "event" | "task" | "routine" | "holiday";

export interface BubbleKindBadgeProps {
  kind: BubbleKind;
  /** Already-translated kind name. */
  label: string;
  className?: string;
}

/*
 * The month chips' token pairs, so a kind reads as the same colour in the
 * bubble as on the grid it was opened from. A holiday's chip colour is the one
 * picked in Settings and reaches the grid as a raw value, so the badge falls
 * back to the danger pair — the red a holiday is printed in on a calendar.
 */
const KIND_FACE: Record<BubbleKind, string> = {
  event: "bg-lumen-chip-event-bg text-lumen-chip-event-fg",
  task: "bg-lumen-chip-task-bg text-lumen-chip-task-fg",
  routine: "bg-lumen-chip-routine-bg text-lumen-chip-routine-fg",
  holiday: "bg-lumen-danger-subtle text-lumen-danger",
};

export function BubbleKindBadge({
  kind,
  label,
  className,
}: BubbleKindBadgeProps): React.JSX.Element {
  return (
    <span
      data-bubble-kind={kind}
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium",
        KIND_FACE[kind],
        className,
      )}
    >
      {label}
    </span>
  );
}
