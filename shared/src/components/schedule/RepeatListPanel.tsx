import { Repeat, Trash2 } from "lucide-react";
import { cn } from "../cn";

/*
 * RepeatListPanel (#408) — the rightSidebar "繰り返し" tab. Replaces the retired
 * Routines header tab: with repeat EDITING folded into the Calendar item editor,
 * the one thing the calendar cannot do on its own is REACH a routine whose
 * occurrences are not on screen (an interval starting next month, or a
 * malformed one that fires on no day at all — the #407 zombie shape). This list
 * is that route: jump to the next occurrence, or delete a routine that has none.
 *
 * Pure presentation (§3.1 / §6.4): rows arrive already formatted and translated,
 * every action is a callback. lumen-* tokens only (§5).
 */

export interface RepeatListRow {
  id: string;
  title: string;
  /** Already-formatted start time (e.g. "7:00"); "" when the routine has none. */
  timeLabel: string;
  /** Already-translated frequency summary (e.g. "毎日" / "月・水・金"). */
  frequencyLabel: string;
  /**
   * Already-formatted date of the next occurrence, or null when the routine
   * fires on no day — such a routine has nothing to navigate to, so its row is
   * not activatable and only the delete action remains.
   */
  nextLabel: string | null;
}

export interface RepeatListPanelLabels {
  /** Shown when there are no routines at all. */
  empty: string;
  /** Stands in for the date when the routine fires on no day. */
  never: string;
  /** Accessible name for the per-row delete button. */
  delete: string;
}

export interface RepeatListPanelProps {
  rows: RepeatListRow[];
  /** Navigate the calendar to this routine's next occurrence. */
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  labels: RepeatListPanelLabels;
  className?: string;
}

export function RepeatListPanel({
  rows,
  onOpen,
  onDelete,
  labels,
  className,
}: RepeatListPanelProps) {
  if (rows.length === 0) {
    return (
      <p
        className={cn(
          "rounded-md border border-lumen-border bg-lumen-bg-secondary px-4 py-6 text-center text-sm text-lumen-text-secondary",
          className,
        )}
      >
        {labels.empty}
      </p>
    );
  }

  return (
    <ul role="list" className={cn("flex flex-col gap-1.5", className)}>
      {rows.map((r) => {
        const meta = [
          r.frequencyLabel,
          r.timeLabel,
          r.nextLabel ?? labels.never,
        ]
          .filter(Boolean)
          .join(" · ");
        const body = (
          <>
            <Repeat
              aria-hidden
              className="size-3 shrink-0 text-lumen-chip-routine-fg"
              strokeWidth={2.5}
            />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-sm font-medium text-lumen-text">
                {r.title}
              </span>
              <span className="truncate text-xs text-lumen-text-secondary">
                {meta}
              </span>
            </span>
          </>
        );
        return (
          <li
            key={r.id}
            className="flex items-center gap-1 rounded-lumen-md border border-lumen-border bg-lumen-bg pr-1"
          >
            {r.nextLabel == null ? (
              // Not a button: there is no occurrence to navigate to, and a
              // control that does nothing when pressed reads as broken.
              <span className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left">
                {body}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onOpen(r.id)}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-lumen-md px-3 py-2 text-left transition-colors hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
              >
                {body}
              </button>
            )}
            <button
              type="button"
              aria-label={`${labels.delete}: ${r.title}`}
              onClick={() => onDelete(r.id)}
              className="shrink-0 rounded-lumen-md p-1.5 text-lumen-text-secondary transition-colors hover:bg-lumen-hover hover:text-lumen-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
            >
              <Trash2 aria-hidden className="size-4" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
