import {
  FileText,
  Calendar,
  Hash,
  ArrowLeft,
  type LucideIcon,
} from "lucide-react";

/**
 * The item kinds a backlink row can point at. Formerly `GraphNodeType` from
 * the Connect graph's data model; declared here now that the graph is gone
 * (#1152), because the view only ever used it to pick a row icon.
 */
export type BacklinkNodeType = "note" | "daily" | "tag";

/**
 * The item the panel is showing backlinks FOR. A three-field subset of the
 * old `GraphNode` — the only fields this view ever read.
 */
export interface BacklinkNode {
  /** note.id / daily.id / `tag:<tagId>` */
  id: string;
  label: string;
  type: BacklinkNodeType;
}

/** One incoming-link entry, already resolved to a display label by the host. */
export interface BacklinkEntry {
  /** source item id (the item that links to the selected node) */
  id: string;
  /** resolved display label (host falls back to "Untitled") */
  label: string;
  /** node type of the source, for the row icon (defaults to note) */
  type?: BacklinkNodeType;
}

export interface BacklinkViewLabels {
  /** backlinks.incomingLinks — "Links to this note" section header */
  incomingLinks: string;
  /** backlinks.empty — selection has no incoming links */
  empty: string;
  /** backlinks.selectHint — nothing selected yet */
  selectHint: string;
}

const TYPE_ICON: Record<BacklinkNodeType, LucideIcon> = {
  note: FileText,
  daily: Calendar,
  tag: Hash,
};

interface BacklinkViewProps {
  /** the item whose backlinks these are (null = nothing selected) */
  node: BacklinkNode | null;
  entries: BacklinkEntry[];
  labels: BacklinkViewLabels;
  /** open a backlink source */
  onSelect: (id: string) => void;
}

/*
 * "What links here", as a panel: a header card for the selected item, then the
 * list of items that link TO it.
 *
 * Kept out of the Connect retirement (#1152). It was written as the Backlinks
 * tab of the Connect sidebar, but nothing in it was ever about the graph — it
 * takes a resolved node + entries and renders rows. It has NO caller today;
 * it lives here as a ready-made surface for the next host that needs one, and
 * the version with a caller is `web/src/wikitag/LinkPanel.tsx` (which took the
 * icon + count treatment from this file but reads its own data).
 *
 * Presentational and injection-only: the host computes `entries` from the
 * unified item-link data and resolves copy into `labels` — no DataService, no
 * useTranslation (CLAUDE.md §6.4). lumen-* tokens, opaque surfaces.
 */
export function BacklinkView({
  node,
  entries,
  labels,
  onSelect,
}: BacklinkViewProps) {
  if (!node) {
    return (
      <div className="rounded-lumen-sm bg-lumen-surface-sunken px-3 py-2.5 text-xs text-lumen-text-secondary">
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
          <span className="truncate text-xs font-medium text-lumen-text">
            {node.label}
          </span>
          <span className="truncate font-mono text-xs text-lumen-text-tertiary">
            {node.id}
          </span>
        </span>
      </div>

      <div>
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-lumen-text-tertiary">
          <ArrowLeft size={11} />
          <span>{labels.incomingLinks}</span>
          <span className="ml-auto font-mono font-normal">
            {entries.length}
          </span>
        </div>
        {entries.length === 0 ? (
          <div className="rounded-lumen-sm bg-lumen-surface-sunken px-3 py-2.5 text-xs text-lumen-text-secondary">
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
                  <span className="min-w-0 flex-1 truncate text-xs text-lumen-text">
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
