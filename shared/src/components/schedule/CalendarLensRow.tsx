import {
  StatusFilterChips,
  type StatusFilterChip,
} from "../materials/StatusFilterChips";

/*
 * The calendar lens (#468) — one row of single-select chips under the toolbar
 * that narrows the grid to a saved tag GROUP (#1173 re-based it off the
 * retired one-tag calendars), lifted out of CalendarTab (#889).
 *
 * Two reasons the row appears: there is a group to offer, or the grid is
 * narrowed right now. The second is what #1173 added — the filter panel can
 * set an ad-hoc tick list that matches no saved group, and gating the row on
 * chips alone would then narrow the grid with no "N hidden" line and no way
 * back out on screen. While the tags are still loading — or their fetch failed
 * — there are no chips and nothing is filtered, so the row is simply not
 * there. That is the safe direction: it appears once the data lands, and it
 * never offers a chip that would empty the grid.
 *
 * The hidden count is the lens's OWN (`hiddenCount`), not a running total.
 * Rows the repeat filter already folded away are reported by the toolbar
 * button instead, and adding the two would claim more missing rows than there
 * are.
 *
 * Pure presentation (§3.1 / §6.4): copy arrives translated, the selection is a
 * callback, lumen-* tokens only.
 */

export interface CalendarLensRowLabels {
  /**
   * Accessible name for the chip group, also drawn as the row's heading
   * while there are chips to head (#2562).
   */
  filterLabel: string;
  /** Already-interpolated "N rows hidden" line. */
  hidden: string;
  /** Button that clears the lens. */
  showAll: string;
}

export interface CalendarLensRowProps {
  chips: StatusFilterChip[];
  /** The saved group in effect, or null (unsaved tick list, or no filter). */
  activeId: string | null;
  onChange: (id: string | null) => void;
  /**
   * Whether the grid is narrowed at all. Wider than `activeId != null`: an
   * ad-hoc tick list narrows the grid while lighting no chip. Defaults to the
   * chip-derived answer so a caller with only saved groups needs no extra prop.
   */
  filtered?: boolean;
  /** Clears the lens whatever set it — a chip or an ad-hoc tick list. */
  onClear?: () => void;
  labels: CalendarLensRowLabels;
}

export function CalendarLensRow({
  chips,
  activeId,
  onChange,
  filtered,
  onClear,
  labels,
}: CalendarLensRowProps) {
  const narrowed = filtered ?? activeId !== null;
  if (chips.length === 0 && !narrowed) return null;
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {/* aria-hidden: the chip group already carries the same words as its
          accessible name, so a reader would otherwise hear them twice. No
          heading over an ad-hoc tick list with no chips — there is no group
          on the row for it to name. */}
      {chips.length > 0 && (
        <span
          aria-hidden
          data-lens-heading
          className="text-xs text-lumen-text-tertiary"
        >
          {labels.filterLabel}
        </span>
      )}
      <StatusFilterChips
        chips={chips}
        value={activeId}
        onChange={onChange}
        label={labels.filterLabel}
        size="sm"
      />
      {narrowed && (
        <>
          <span className="text-xs text-lumen-text-secondary">
            {labels.hidden}
          </span>
          {/* #2562: a text link rather than a bordered button, so the way
              back reads as part of the "N hidden" sentence beside it instead
              of as one more chip. */}
          <button
            type="button"
            onClick={() => (onClear ? onClear() : onChange(null))}
            className="rounded-lumen-sm text-xs font-medium text-lumen-accent underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
          >
            {labels.showAll}
          </button>
        </>
      )}
    </div>
  );
}
