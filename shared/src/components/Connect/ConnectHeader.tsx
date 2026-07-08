import { Network, RotateCcw, Maximize2, Filter, X } from "lucide-react";
import type { ConnectGraphLabels } from "./labels";

interface ConnectHeaderProps {
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
 * Connect section header row (App Shell tab-row standard). Replaces the old
 * floating HUD (GraphTopBar): a real header pinned to the top of the section
 * body — section title + node/edge count badge + an optional active-filter
 * chip, with reheat / fit-to-view actions at the right end.
 *
 * The rightSidebar open/close toggle is intentionally NOT here — the shell's
 * sectionToolbar row (one level up in MainScreen) already renders
 * RightSidebarToggle, giving the target-IA 2-row layout (mini-plan decision B).
 * lumen-* tokens, opaque surface (§5 / §6.4).
 */
export function ConnectHeader({
  labels,
  nodeCount,
  totalCount,
  edgeCount,
  activeFilterCount,
  onClearFilters,
  onReheat,
  onResetView,
}: ConnectHeaderProps) {
  const countText = `${nodeCount}/${totalCount}n · ${edgeCount}e`;

  const iconBtn =
    "grid h-7 w-7 place-items-center rounded-lumen-sm text-lumen-text-secondary transition-colors hover:bg-lumen-hover hover:text-lumen-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent";

  return (
    <div className="flex-shrink-0 bg-lumen-bg px-4 md:px-6">
      <div className="flex items-stretch border-b border-lumen-border">
        <div className="-mb-px flex items-center gap-2 border-b-2 border-lumen-accent py-2 text-[14px] font-semibold text-lumen-text">
          <Network size={16} />
          <span>{labels.title}</span>
          <span className="rounded-lumen-sm bg-lumen-surface-sunken px-2 py-0.5 font-mono text-[11px] font-normal text-lumen-text-secondary tabular-nums">
            {countText}
          </span>
        </div>

        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={onClearFilters}
            title={labels.clearFilters}
            aria-label={labels.clearFilters}
            className="ml-3 flex items-center gap-1.5 self-center rounded-lumen-full border border-lumen-accent bg-lumen-accent-subtle px-2.5 py-0.5 text-[11px] text-lumen-accent hover:bg-lumen-hover"
          >
            <Filter size={10} />
            {activeFilterCount}
            <X size={10} />
          </button>
        )}

        <div className="ml-auto flex items-center gap-1 self-center">
          <button
            type="button"
            onClick={onReheat}
            title={labels.reheat}
            aria-label={labels.reheat}
            className={iconBtn}
          >
            <RotateCcw size={15} />
          </button>
          <button
            type="button"
            onClick={onResetView}
            title={labels.fitView}
            aria-label={labels.fitView}
            className={iconBtn}
          >
            <Maximize2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
