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
  ArrowLeft,
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
  /** number of items linking TO this node (shown as a meta-row jump link) */
  backlinkCount?: number;
  /** jump to the backlinks tab (opens the rightSidebar + selects the tab) */
  onViewBacklinks?: () => void;
  /** datalist candidates for the "add link" input (self/tag nodes excluded) */
  linkableItems?: LinkableItem[];
  /** neighbourId → wiki_tag_connections.id for deletable outgoing links */
  outgoingLinkIds?: Map<string, string>;
  /**
   * Create a directed item↔item link from this node to `toId`. May return a
   * promise; a rejection is reported through `onLinkError` (host toast).
   */
  onCreateLink?: (fromId: string, toId: string) => void | Promise<void>;
  /** Delete the link identified by `linkId`. Rejection → `onLinkError`. */
  onDeleteLink?: (linkId: string) => void | Promise<void>;
  /**
   * Report a create/delete failure with already-translated copy
   * (labels.linkCreateFailed / linkDeleteFailed). The card is presentational
   * and has no toast context of its own, so the host wires this to its toast
   * (ConnectScreen → useToast().showToast). Unwired = failures are swallowed.
   */
  onLinkError?: (message: string) => void;
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
  backlinkCount,
  onViewBacklinks,
  linkableItems = [],
  outgoingLinkIds,
  onCreateLink,
  onDeleteLink,
  onLinkError,
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

  // Await the wired mutator and report a rejection through onLinkError (the
  // host turns it into a toast). A void return resolves immediately (no-op),
  // so fire-and-forget hosts simply never hit the failure path.
  const runLinkMutation = async (
    op: () => void | Promise<void>,
    failMessage: string,
  ) => {
    try {
      await op();
    } catch {
      onLinkError?.(failMessage);
    }
  };

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
    const create = onCreateLink;
    setTarget("");
    void runLinkMutation(
      () => create(node.id, targetId),
      labels.linkCreateFailed,
    );
  };

  return (
    <div className="absolute bottom-3 left-4 w-80 rounded-lumen-lg bg-lumen-bg border border-lumen-border p-3.5 space-y-3 shadow-lumen-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="mt-0.5 w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-lumen-hover text-lumen-text">
            <Icon size={14} />
          </span>
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => onActivate?.(node.id)}
              disabled={!onActivate || node.type === "tag"}
              className="text-[13px] font-medium truncate text-lumen-text text-left hover:underline disabled:hover:no-underline disabled:cursor-default"
            >
              {node.label}
            </button>
            <div className="text-[10px] font-mono truncate text-lumen-text-secondary">
              {node.id}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={labels.closePanel}
          className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-lumen-text-secondary hover:bg-lumen-hover"
        >
          <X size={12} />
        </button>
      </div>

      <div className="flex items-center gap-3 text-[11px] text-lumen-text-secondary">
        <span className="flex items-center gap-1">
          <Link2 size={11} /> {linkCount} {labels.links}
        </span>
        <span className="flex items-center gap-1">
          <Hash size={11} /> {tagCount} {labels.tagsShort}
        </span>
        {onViewBacklinks && (
          <button
            type="button"
            onClick={onViewBacklinks}
            className="flex items-center gap-1 text-lumen-accent hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lumen-accent rounded-lumen-sm"
          >
            <ArrowLeft size={11} />
            {labels.viewBacklinks.replace(
              "{{count}}",
              String(backlinkCount ?? 0),
            )}
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 text-[10px] pt-1 border-t border-lumen-border">
        <Crosshair size={10} className="text-lumen-accent" />
        <span className="text-lumen-text-secondary">{labels.localGraph}:</span>
        {[0, 1, 2].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onLocalDepthChange(d)}
            aria-pressed={localDepth === d}
            className={
              "px-1.5 py-0.5 rounded font-mono border transition-colors " +
              (localDepth === d
                ? "border-lumen-accent text-lumen-accent bg-lumen-hover"
                : "border-lumen-border text-lumen-text-secondary hover:bg-lumen-hover")
            }
          >
            {d === 0 ? labels.off : `${d}-hop`}
          </button>
        ))}
      </div>

      {canEditLinks && (
        <div className="flex items-center gap-1.5 pt-1 border-t border-lumen-border">
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
            className="min-w-0 flex-1 rounded-md border border-lumen-border bg-lumen-bg px-2 py-1 text-[11px] text-lumen-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lumen-accent"
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
            className="inline-flex items-center gap-0.5 rounded-md border border-lumen-border bg-lumen-bg px-2 py-1 text-[11px] text-lumen-text hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lumen-accent"
          >
            <Plus size={11} aria-hidden />
          </button>
        </div>
      )}

      {neighbors.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-lumen-text-secondary">
            {labels.connections}
          </div>
          <div className="max-h-32 overflow-y-auto space-y-0.5 pr-1">
            {neighbors.map((n) => {
              const NIcon = TYPE_ICON[n.type];
              const linkId = outgoingLinkIds?.get(n.id);
              // Only rows with a resolved outgoing link id AND a wired deleter
              // are removable; capturing both here narrows away the optional
              // callback so the click handler needs no `?.` guard.
              const removeLink =
                linkId && onDeleteLink
                  ? () =>
                      void runLinkMutation(
                        () => onDeleteLink(linkId),
                        labels.linkDeleteFailed,
                      )
                  : null;
              return (
                <div
                  key={n.id}
                  className="group flex items-center gap-1 rounded hover:bg-lumen-hover"
                >
                  <button
                    type="button"
                    onClick={() => onSelect(n.id)}
                    className="flex-1 min-w-0 flex items-center gap-2 px-2 py-1 text-left"
                  >
                    <NIcon
                      size={11}
                      className="text-lumen-text-secondary shrink-0"
                    />
                    <span className="text-[11px] truncate text-lumen-text">
                      {n.label}
                    </span>
                  </button>
                  {removeLink && (
                    <button
                      type="button"
                      onClick={removeLink}
                      aria-label={labels.removeLink}
                      className="shrink-0 mr-1 w-4 h-4 rounded flex items-center justify-center text-lumen-text-secondary hover:text-lumen-danger focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lumen-accent"
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
