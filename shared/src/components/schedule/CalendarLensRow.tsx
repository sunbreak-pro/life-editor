import {
  StatusFilterChips,
  type StatusFilterChip,
} from "../materials/StatusFilterChips";

/*
 * The calendar lens (#468) — one row of single-select chips under the toolbar
 * that narrows the grid to a single calendar, lifted out of CalendarTab
 * (#889).
 *
 * Rendered at all only when there is a calendar to offer, so the empty case
 * costs no vertical space. While the tags are still loading — or their fetch
 * failed — the host has no chips to pass and the row simply is not there.
 * That is the safe direction: it appears once the data lands, and it never
 * offers a chip that would empty the grid.
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
  /** The calendar in effect, or null while the grid shows everything. */
  activeId: string | null;
  onChange: (id: string | null) => void;
  labels: CalendarLensRowLabels;
}

export function CalendarLensRow({
  chips,
  activeId,
  onChange,
  labels,
}: CalendarLensRowProps) {
  if (chips.length === 0) return null;
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      <StatusFilterChips
        chips={chips}
        value={activeId}
        onChange={onChange}
        label={labels.filterLabel}
        size="sm"
      />
      {activeId !== null && (
        <>
          <span className="text-xs text-lumen-text-secondary">
            {labels.hidden}
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="rounded-lumen-md border border-lumen-border-strong px-2 py-0.5 text-xs font-medium text-lumen-text transition-colors hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
          >
            {labels.showAll}
          </button>
        </>
      )}
    </div>
  );
}
