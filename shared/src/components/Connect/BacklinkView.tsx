import {
  Folder,
  FileText,
  Calendar,
  Hash,
  ArrowLeft,
  type LucideIcon,
} from "lucide-react";
import type { GraphNode, GraphNodeType } from "./graph/graph-types";

/** One incoming-link entry, already resolved to a display label by the host. */
export interface BacklinkEntry {
  /** source item id (the item that links to the selected node) */
  id: string;
  /** resolved display label (host falls back to "Untitled") */
  label: string;
  /** node type of the source, for the row icon (defaults to note) */
  type?: GraphNodeType;
}

export interface BacklinkViewLabels {
  /** connect.sidebar.incomingLinks — "Links to this note" section header */
  incomingLinks: string;
  /** backlinks.empty — selection has no incoming links */
  empty: string;
  /** connect.graph.selectNodeHint — nothing selected yet */
  selectHint: string;
}

const TYPE_ICON: Record<GraphNodeType, LucideIcon> = {
  project: Folder,
  note: FileText,
  daily: Calendar,
  tag: Hash,
};

interface BacklinkViewProps {
  /** currently selected node (null = nothing selected) */
  node: GraphNode | null;
  entries: BacklinkEntry[];
  labels: BacklinkViewLabels;
  /** select a backlink source (re-centers the graph on it) */
  onSelect: (id: string) => void;
}

/*
 * Backlinks tab content for the shell rightSidebar (App Shell Turn 2). The
 *常設 aside w-64 frame is gone — this now renders straight into the panel well
 * of <ConnectSidebarPanel>. The host computes `entries` from the unified
 * item-link data and resolves labels; this part only renders + emits select
 * intents. lumen-* tokens, opaque surfaces (§5 / §6.4).
 */
export function BacklinkView({
  node,
  entries,
  labels,
  onSelect,
}: BacklinkViewProps) {
  if (!node) {
    return (
      <div className="rounded-lumen-sm bg-lumen-surface-sunken px-3 py-2.5 text-[11px] text-lumen-text-secondary">
        {labels.selectHint}
      </div>
    );
  }

  const NodeIcon = TYPE_ICON[node.type];

  return (
    <div className="flex flex-col gap-3.5">
      {/* Selected-node header card */}
      <div className="flex items-center gap-2.5 rounded-lumen-md border border-lumen-border bg-lumen-bg px-3 py-2.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lumen-md bg-lumen-hover text-lumen-text">
          <NodeIcon size={14} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[12px] font-medium text-lumen-text">
            {node.label}
          </span>
          <span className="truncate font-mono text-[10px] text-lumen-text-tertiary">
            {node.id}
          </span>
        </span>
      </div>

      <div>
        <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-lumen-text-tertiary">
          <ArrowLeft size={11} />
          <span>{labels.incomingLinks}</span>
          <span className="ml-auto font-mono font-normal">
            {entries.length}
          </span>
        </div>
        {entries.length === 0 ? (
          <div className="rounded-lumen-sm bg-lumen-surface-sunken px-3 py-2.5 text-[11px] text-lumen-text-secondary">
            {labels.empty}
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {entries.map((entry) => {
              const RowIcon = TYPE_ICON[entry.type ?? "note"];
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => onSelect(entry.id)}
                  className="flex items-center gap-2 rounded-lumen-sm px-2 py-1.5 text-left hover:bg-lumen-hover"
                >
                  <RowIcon
                    size={12}
                    className="shrink-0 text-lumen-text-secondary"
                  />
                  <span className="min-w-0 flex-1 truncate text-[12px] text-lumen-text">
                    {entry.label}
                  </span>
                  <ArrowLeft
                    size={11}
                    className="shrink-0 text-lumen-text-tertiary"
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
