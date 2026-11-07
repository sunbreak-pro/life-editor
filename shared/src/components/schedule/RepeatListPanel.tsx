import { Repeat } from "lucide-react";
import { cn } from "../cn";

/*
 * RepeatListPanel (#408) — the rightSidebar "繰り返し" tab. Replaces the retired
 * Routines header tab: with repeat EDITING folded into the Calendar item editor,
 * the one thing the calendar cannot do on its own is REACH a routine whose
 * occurrences are not on screen (an interval starting next month, or a
 * malformed one that fires on no day at all — the #407 zombie shape). This list
 * is that route: jump to the next occurrence, or delete a routine that has none.
 *
 * #467 mounts the same panel on Mobile, where the scope is viewing only. Since
 * #2569 no row offers a delete at either width, so the two are the same list.
 *
 * #2569 took the trash off the row. The row's panel already carries「削除」on
 * Desktop (ScheduleOverlays' repeat bubble, #1678, behind the host's
 * <ConfirmDialog> since #1279), and the no-occurrence row opens that panel
 * too, so the series stays deletable from one place instead of two — and the row became the prototype's borderless two-line shape: the
 * name, then the frequency on the left and「次 …」on the right. The time left
 * the row; the panel's summary is where it is read (#2574).
 *
 * Pure presentation (§3.1 / §6.4): rows arrive already formatted and translated,
 * every action is a callback. lumen-* tokens only (§5).
 */

export interface RepeatListRow {
  id: string;
  title: string;
  /**
   * Already-formatted start time (e.g. "7:00"); "" when the routine has none.
   * Not drawn on the row since #2569 — the row's panel reads it (#2574).
   */
  timeLabel: string;
  /** Already-translated frequency summary (e.g. "毎日" / "月・水・金"). */
  frequencyLabel: string;
  /**
   * Already-formatted date of the next occurrence, or null when the routine
   * fires on no day. Since #1678 such a row still opens — the panel it opens
   * is where the series is read and edited, and only its "show the next one"
   * action is unavailable.
   */
  nextLabel: string | null;
}

export interface RepeatListPanelLabels {
  /** Shown when there are no routines at all. */
  empty: string;
  /** Stands in for the date when the routine fires on no day. */
  never: string;
  /** The next occurrence's line, e.g.「次 10月11日（日）」(#2569). */
  next: (date: string) => string;
}

export interface RepeatListPanelProps {
  rows: RepeatListRow[];
  /**
   * The row was pressed (#1678). `pos` is the press's viewport point, which
   * the host anchors its panel at — the same hand-off a grid item makes
   * (#299), so the two surfaces answer a click the same way.
   *
   * It used to mean "navigate to the next occurrence". That move is one of the
   * actions inside the panel now, which is why a row with no occurrence can be
   * pressed at all.
   */
  onOpen: (id: string, pos: { x: number; y: number }) => void;
  labels: RepeatListPanelLabels;
  className?: string;
}

export function RepeatListPanel({
  rows,
  onOpen,
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
    <ul role="list" className={cn("flex flex-col gap-0.5", className)}>
      {rows.map((r) => (
        <li key={r.id}>
          {/*
           * Every row is pressable since #1678, the no-occurrence one
           * included: the press opens the panel that reads and edits the
           * SERIES, and a series with nothing on the calendar is exactly the
           * one a user most needs to open (#407's zombies live here). What
           * that row cannot do — jump to an occurrence — is disabled inside
           * the panel, where it can say so. Deleting lives there too (#2569).
           */}
          <button
            type="button"
            onClick={(e) => onOpen(r.id, { x: e.clientX, y: e.clientY })}
            // #2083: the 44px floor on narrow, where this row is a tap
            // target in the drawer. Desktop keeps its mouse-sized box.
            className="flex w-full min-w-0 flex-col gap-0.5 rounded-lumen-md px-2 py-1.5 text-left max-md:min-h-11 transition-colors hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
          >
            <span className="flex min-w-0 items-center gap-2">
              <Repeat
                aria-hidden
                className="size-3 shrink-0 text-lumen-info"
                strokeWidth={2.5}
              />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-lumen-text">
                {r.title}
              </span>
            </span>
            {/* pl-5 = the icon's 0.75rem + the gap's 0.5rem, so the second
                line starts under the name. The date never shrinks: a long
                frequency truncates first, so「次 …」stays readable at 390px. */}
            <span
              data-repeat-row-meta=""
              className="flex min-w-0 items-baseline gap-2 pl-5 text-xs text-lumen-text-secondary"
            >
              <span className="min-w-0 flex-1 truncate">
                {r.frequencyLabel}
              </span>
              <span className="shrink-0 whitespace-nowrap tabular-nums">
                {r.nextLabel == null ? labels.never : labels.next(r.nextLabel)}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
