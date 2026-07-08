import { Network, Filter } from "lucide-react";
import type { ConnectGraphLabels } from "./labels";

/*
 * Shared graph "no graph to show" overlays — loading / empty / nomatch. Each is
 * a full-bleed centered panel drawn over the canvas area (Desktop + Mobile
 *共用). Pure presentation: copy is injected already-translated (§6.4), lumen-*
 * tokens + opaque surfaces only (§5). The loading spinner uses the `le-spin`
 * keyframe defined once here (scoped, prefers-reduced-motion aware).
 */
type GraphStateKind = "loading" | "empty" | "nomatch";

interface GraphStatesProps {
  state: GraphStateKind;
  labels: ConnectGraphLabels;
  /** active search query (nomatch shows a query-specific message when set) */
  query?: string;
  /** clear-filters action for the nomatch state */
  onClear?: () => void;
}

const SPIN_CSS = `
@keyframes le-graph-spin { to { transform: rotate(360deg); } }
.le-graph-spinner { animation: le-graph-spin 0.9s linear infinite; }
@media (prefers-reduced-motion: reduce) {
  .le-graph-spinner { animation-duration: 2.4s; }
}`;

export function GraphStates({
  state,
  labels,
  query,
  onClear,
}: GraphStatesProps) {
  if (state === "loading") {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3.5">
        <style>{SPIN_CSS}</style>
        <div className="le-graph-spinner h-7 w-7 rounded-lumen-full border-[3px] border-lumen-surface-sunken border-t-lumen-accent" />
        <div className="text-[13px] text-lumen-text-secondary">
          {labels.graphLoading}
        </div>
      </div>
    );
  }

  if (state === "empty") {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-lumen-full bg-lumen-surface-sunken text-lumen-text-tertiary">
          <Network size={24} />
        </div>
        <div className="text-[15px] font-medium text-lumen-text">
          {labels.emptyTitle}
        </div>
        <div className="text-[13px] text-lumen-text-secondary">
          {labels.emptyHint}
        </div>
      </div>
    );
  }

  // nomatch — filters/search excluded every node.
  const message =
    query && query.trim()
      ? labels.noMatchQuery.replace("{{query}}", query.trim())
      : labels.noMatch;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-lumen-full bg-lumen-surface-sunken text-lumen-text-tertiary">
        <Filter size={22} />
      </div>
      <div className="text-[15px] font-medium text-lumen-text">{message}</div>
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          className="mt-0.5 rounded-lumen-md bg-lumen-accent px-4 py-2 text-[13px] font-medium text-lumen-on-accent hover:bg-lumen-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
        >
          {labels.clearFilters}
        </button>
      )}
    </div>
  );
}
