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
  /** Accessible name for the chip group. */
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
          <button
            type="button"
            onClick={() => (onClear ? onClear() : onChange(null))}
            className="rounded-lumen-md border border-lumen-border-strong px-2 py-0.5 text-xs font-medium text-lumen-text transition-colors hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
          >
            {labels.showAll}
          </button>
        </>
      )}
    </div>
  );
}
