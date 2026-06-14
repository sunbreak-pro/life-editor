import { FileText, ArrowLeft } from "lucide-react";

/** One incoming-link entry, already resolved to a display label by the host. */
export interface BacklinkEntry {
  /** source item id (the item that links to the selected node) */
  id: string;
  /** resolved display label (host falls back to "Untitled") */
  label: string;
}

export interface BacklinkViewLabels {
  /** backlinks.title */
  title: string;
  /** backlinks.empty */
  empty: string;
}

interface BacklinkViewProps {
  /** label of the currently selected node (null = nothing selected) */
  targetLabel: string | null;
  entries: BacklinkEntry[];
  labels: BacklinkViewLabels;
  /** select a backlink source (re-centers the graph on it) */
  onSelect: (id: string) => void;
}

/**
 * Presentational backlink panel. The host computes `entries` from the unified
 * item-link data (filtering `listAllTagConnections` by selected id, or calling
 * `listLinksToItem`) and resolves labels — this part only renders + emits
 * select intents. notion-* tokens, opaque panel (§6.4 / §5).
 */
export function BacklinkView({
  targetLabel,
  entries,
  labels,
  onSelect,
}: BacklinkViewProps) {
  return (
    <aside className="flex flex-col h-full w-64 shrink-0 border-l border-notion-border bg-notion-bg">
      <div className="px-3 py-2.5 border-b border-notion-border">
        <div className="text-[11px] uppercase tracking-[0.14em] font-medium text-notion-text-secondary">
          {labels.title}
        </div>
        {targetLabel && (
          <div className="mt-0.5 text-[12px] truncate text-notion-text">
            {targetLabel}
          </div>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="flex-1 flex items-center justify-center px-4 text-center text-[12px] text-notion-text-secondary">
          {labels.empty}
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
          {entries.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => onSelect(entry.id)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-notion-hover text-left"
              >
                <ArrowLeft
                  size={11}
                  className="text-notion-text-secondary shrink-0"
                />
                <FileText
                  size={12}
                  className="text-notion-text-secondary shrink-0"
                />
                <span className="text-[12px] truncate text-notion-text">
                  {entry.label}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
