import { RotateCcw, Maximize2, Filter, X } from "lucide-react";
import type { ConnectGraphLabels } from "./labels";

interface ConnectGraphActionsProps {
  labels: ConnectGraphLabels;
  nodeCount: number;
  totalCount: number;
  edgeCount: number;
  activeFilterCount: number;
  onClearFilters: () => void;
  onReheat: () => void;
  onResetView: () => void;
}

/*
 * Connect graph actions — the count readout + reheat / fit / clear-filters
 * cluster for the rightSidebar "Graph settings" tab (Layout Standard v2
 * adoption). Replaces the retired in-body ConnectHeader: after v2 the standard
 * SectionHeader (shell header slot) owns the title + rightSidebar/width
 * toggles, so these graph-specific actions moved into the panel (user decision
 * 2026-07-11). The header's right-end controls slot is MainScreen-owned
 * (layout-standard), so the panel is the in-scope home for section actions.
 *
 * Pure presentation: copy injected already-translated (§6.4), lumen-* tokens
 * only, opaque surface (§5).
 */
export function ConnectGraphActions({
  labels,
  nodeCount,
  totalCount,
  edgeCount,
  activeFilterCount,
  onClearFilters,
  onReheat,
  onResetView,
}: ConnectGraphActionsProps) {
  const countText = `${nodeCount}/${totalCount}n · ${edgeCount}e`;
  const actionBtn =
    "flex flex-1 items-center justify-center gap-1.5 rounded-lumen-sm border border-lumen-border bg-lumen-bg px-2 py-1.5 text-[12px] text-lumen-text-secondary transition-colors hover:bg-lumen-hover hover:text-lumen-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent";

  return (
    <div className="flex flex-col gap-2 border-b border-lumen-border pb-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] tabular-nums text-lumen-text-secondary">
          {countText}
        </span>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={onClearFilters}
            title={labels.clearFilters}
            aria-label={labels.clearFilters}
            className="flex shrink-0 items-center gap-1 rounded-lumen-full border border-lumen-accent bg-lumen-accent-subtle px-2 py-0.5 text-[11px] text-lumen-accent hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
          >
            <Filter size={11} />
            {activeFilterCount}
            <X size={11} />
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onReheat}
          title={labels.reheat}
          aria-label={labels.reheat}
          className={actionBtn}
        >
          <RotateCcw size={14} />
          <span>{labels.reheat}</span>
        </button>
        <button
          type="button"
          onClick={onResetView}
          title={labels.fitView}
          aria-label={labels.fitView}
          className={actionBtn}
        >
          <Maximize2 size={14} />
          <span>{labels.fitView}</span>
        </button>
      </div>
    </div>
  );
}
