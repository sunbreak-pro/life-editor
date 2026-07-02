import { useMemo, useState } from "react";
import {
  Folder,
  FileText,
  Calendar,
  Hash,
  X,
  Link2,
  Plus,
  Crosshair,
  type LucideIcon,
} from "lucide-react";
import type { GraphNode, GraphNodeType } from "./graph/graph-types";
import { isTagNodeId } from "./graph/graph-types";
import type { ConnectGraphLabels } from "./labels";

export interface LinkableItem {
  id: string;
  label: string;
}

const TYPE_ICON: Record<GraphNodeType, LucideIcon> = {
  project: Folder,
  note: FileText,
  daily: Calendar,
  tag: Hash,
};

interface SelectedNodeCardProps {
  labels: ConnectGraphLabels;
  node: GraphNode;
  neighbors: GraphNode[];
  localDepth: number;
  onLocalDepthChange: (d: number) => void;
  onSelect: (id: string) => void;
  onClose: () => void;
  /** double-click / open intent (note/daily navigation) */
  onActivate?: (id: string) => void;
  /** datalist candidates for the "add link" input (self/tag nodes excluded) */
  linkableItems?: LinkableItem[];
  /** neighbourId → wiki_tag_connections.id for deletable outgoing links */
  outgoingLinkIds?: Map<string, string>;
  /** create a directed item↔item link from this node to `toId` */
  onCreateLink?: (fromId: string, toId: string) => void;
  /** delete the link identified by `linkId` */
  onDeleteLink?: (linkId: string) => void;
}

export function SelectedNodeCard({
  labels,
  node,
  neighbors,
  localDepth,
  onLocalDepthChange,
  onSelect,
  onClose,
  onActivate,
  linkableItems = [],
  outgoingLinkIds,
  onCreateLink,
  onDeleteLink,
}: SelectedNodeCardProps) {
  const Icon = TYPE_ICON[node.type];
  const linkCount = neighbors.filter((n) => !isTagNodeId(n.id)).length;
  const tagCount = neighbors.filter((n) => isTagNodeId(n.id)).length;

  // Item↔item links originate from item nodes only — a tag node's id is the
  // synthetic `tag:<id>`, not an items_meta id, so it can't be a link source.
  const canEditLinks = !!onCreateLink && !isTagNodeId(node.id);
  const [target, setTarget] = useState("");
  const datalistId = useMemo(
    () => `connect-link-targets-${node.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`,
    [node.id],
  );

  const submitLink = () => {
    if (!onCreateLink) return;
    const trimmed = target.trim();
    if (!trimmed) return;
    // Datalist matches may send the label as value; resolve back to an id,
    // else treat the raw value as a pasted items_meta.id (cross-role link).
    const byId = linkableItems.find((i) => i.id === trimmed);
    const byLabel = linkableItems.find((i) => i.label === trimmed);
    const targetId = byId?.id ?? byLabel?.id ?? trimmed;
    if (targetId === node.id) return; // self-loop guard (DB also rejects)
    if (outgoingLinkIds?.has(targetId)) return; // already linked — no dup row
    onCreateLink(node.id, targetId);
    setTarget("");
  };

  return (
    <div className="absolute bottom-3 left-3 w-80 rounded-lg bg-ink-bg border border-ink-border p-3.5 space-y-3 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="mt-0.5 w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-ink-hover text-ink-text">
            <Icon size={14} />
          </span>
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => onActivate?.(node.id)}
              disabled={!onActivate || node.type === "tag"}
              className="text-[13px] font-medium truncate text-ink-text text-left hover:underline disabled:hover:no-underline disabled:cursor-default"
            >
              {node.label}
            </button>
            <div className="text-[10px] font-mono truncate text-ink-text-secondary">
              {node.id}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={labels.closePanel}
          className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-ink-text-secondary hover:bg-ink-hover"
        >
          <X size={12} />
        </button>
      </div>

      <div className="flex items-center gap-3 text-[10px] text-ink-text-secondary">
        <span className="flex items-center gap-1">
          <Link2 size={10} /> {linkCount} {labels.links}
        </span>
        <span className="flex items-center gap-1">
          <Hash size={10} /> {tagCount} {labels.tagsShort}
        </span>
      </div>

      <div className="flex items-center gap-2 text-[10px] pt-1 border-t border-ink-border">
        <Crosshair size={10} className="text-ink-accent" />
        <span className="text-ink-text-secondary">{labels.localGraph}:</span>
        {[0, 1, 2].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onLocalDepthChange(d)}
            aria-pressed={localDepth === d}
            className={
              "px-1.5 py-0.5 rounded font-mono border transition-colors " +
              (localDepth === d
                ? "border-ink-accent text-ink-accent bg-ink-hover"
                : "border-ink-border text-ink-text-secondary hover:bg-ink-hover")
            }
          >
            {d === 0 ? labels.off : `${d}-hop`}
          </button>
        ))}
      </div>

      {canEditLinks && (
        <div className="flex items-center gap-1.5 pt-1 border-t border-ink-border">
          <input
            type="text"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submitLink();
              }
            }}
            list={linkableItems.length > 0 ? datalistId : undefined}
            placeholder={labels.linkTargetPlaceholder}
            aria-label={labels.linkTargetPlaceholder}
            className="min-w-0 flex-1 rounded-md border border-ink-border bg-ink-bg px-2 py-1 text-[11px] text-ink-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink-accent"
          />
          {linkableItems.length > 0 && (
            <datalist id={datalistId}>
              {linkableItems.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label}
                </option>
              ))}
            </datalist>
          )}
          <button
            type="button"
            onClick={submitLink}
            aria-label={labels.addLink}
            className="inline-flex items-center gap-0.5 rounded-md border border-ink-border bg-ink-bg px-2 py-1 text-[11px] text-ink-text hover:bg-ink-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink-accent"
          >
            <Plus size={11} aria-hidden />
          </button>
        </div>
      )}

      {neighbors.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-ink-text-secondary">
            {labels.connections}
          </div>
          <div className="max-h-32 overflow-y-auto space-y-0.5 pr-1">
            {neighbors.map((n) => {
              const NIcon = TYPE_ICON[n.type];
              const linkId = outgoingLinkIds?.get(n.id);
              const deletable = !!linkId && !!onDeleteLink;
              return (
                <div
                  key={n.id}
                  className="group flex items-center gap-1 rounded hover:bg-ink-hover"
                >
                  <button
                    type="button"
                    onClick={() => onSelect(n.id)}
                    className="flex-1 min-w-0 flex items-center gap-2 px-2 py-1 text-left"
                  >
                    <NIcon
                      size={11}
                      className="text-ink-text-secondary shrink-0"
                    />
                    <span className="text-[11px] truncate text-ink-text">
                      {n.label}
                    </span>
                  </button>
                  {deletable && (
                    <button
                      type="button"
                      onClick={() => onDeleteLink?.(linkId)}
                      aria-label={labels.removeLink}
                      className="shrink-0 mr-1 w-4 h-4 rounded flex items-center justify-center text-ink-text-secondary hover:text-ink-danger focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink-accent"
                    >
                      <X size={10} aria-hidden />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
