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
  Search,
  type LucideIcon,
} from "lucide-react";
import type { GraphNode, GraphNodeType } from "../graph/graph-types";
import { isTagNodeId } from "../graph/graph-types";
import type { BacklinkEntry } from "../BacklinkView";
import type { LinkableItem } from "../SelectedNodeCard";
import type { ConnectGraphLabels } from "../labels";

const TYPE_ICON: Record<GraphNodeType, LucideIcon> = {
  project: Folder,
  note: FileText,
  daily: Calendar,
  tag: Hash,
};

type DetailTab = "links" | "backlinks";

interface NodeDetailSheetProps {
  labels: ConnectGraphLabels;
  node: GraphNode;
  /** full-adjacency neighbours (depth-filter independent) */
  neighbors: GraphNode[];
  /** items linking TO this node (host-resolved) */
  backlinks: BacklinkEntry[];
  localDepth: number;
  onLocalDepthChange: (d: number) => void;
  /** select a neighbour / backlink source (re-centers the graph) */
  onSelect: (id: string) => void;
  /** dismiss the sheet (clears selection) */
  onClose: () => void;
  /** open intent (note/daily navigation) */
  onActivate?: (id: string) => void;
  /** datalist candidates for the add-link input (self/tag/linked excluded) */
  linkableItems?: LinkableItem[];
  /** neighbourId → wiki_tag_connections.id for deletable outgoing links */
  outgoingLinkIds?: Map<string, string>;
  onCreateLink?: (fromId: string, toId: string) => void | Promise<void>;
  onDeleteLink?: (linkId: string) => void | Promise<void>;
  onLinkError?: (message: string) => void;
}

/*
 * Mobile node-detail PEEK sheet — a NON-modal card that rises above the shell's
 * bottom tab bar when a node is selected. No backdrop / aria-modal: the graph
 * keeps panning behind it (only the sheet itself captures pointer events). Two
 * tabs (Connections / Backlinks) + a local-depth chip row + inline link
 * add/remove. Mirrors SelectedNodeCard's submitLink (IME-guarded — §Gotchas)
 * but with a touch layout. lumen-* tokens, opaque surface (§5 / §6.4).
 *
 * Positioned by the caller region (absolute inset-0 graph area); the sheet pins
 * itself to the bottom edge of that region, which already sits above the tab
 * bar (the tab bar is the shell's sibling, outside Connect).
 */
export function NodeDetailSheet({
  labels,
  node,
  neighbors,
  backlinks,
  localDepth,
  onLocalDepthChange,
  onSelect,
  onClose,
  onActivate,
  linkableItems = [],
  outgoingLinkIds,
  onCreateLink,
  onDeleteLink,
  onLinkError,
}: NodeDetailSheetProps) {
  const Icon = TYPE_ICON[node.type];
  const [tab, setTab] = useState<DetailTab>("links");
  const [target, setTarget] = useState("");

  const canEditLinks = !!onCreateLink && !isTagNodeId(node.id);
  const linkCount = neighbors.filter((n) => !isTagNodeId(n.id)).length;
  const datalistId = useMemo(
    () => `connect-m-link-targets-${node.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`,
    [node.id],
  );

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

  const tabClass = (active: boolean) =>
    "flex items-center gap-1.5 -mb-px border-b-2 pb-2 pt-1 text-[13px] focus-visible:outline-none " +
    (active
      ? "border-lumen-accent font-medium text-lumen-text"
      : "border-transparent text-lumen-text-secondary");

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 flex max-h-[62%] flex-col gap-2.5 rounded-t-2xl border-t border-lumen-border bg-lumen-bg px-4 pb-4 pt-2 shadow-lumen-lg">
      <div
        aria-hidden
        className="mx-auto h-1.5 w-10 rounded-lumen-full bg-lumen-border"
      />

      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-lumen-hover text-lumen-text">
          <Icon size={15} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <button
            type="button"
            onClick={() => onActivate?.(node.id)}
            disabled={!onActivate || node.type === "tag"}
            className="truncate text-left text-[14px] font-medium text-lumen-text hover:underline disabled:cursor-default disabled:hover:no-underline"
          >
            {node.label}
          </button>
          <span className="truncate font-mono text-[10px] text-lumen-text-tertiary">
            {node.id}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={labels.closePanel}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-lumen-text-tertiary hover:bg-lumen-hover hover:text-lumen-text"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex items-center gap-2 text-[11px]">
        <Crosshair size={11} className="shrink-0 text-lumen-accent" />
        <span className="text-lumen-text-secondary">{labels.localGraph}:</span>
        <span className="flex gap-1">
          {[0, 1, 2].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onLocalDepthChange(d)}
              aria-pressed={localDepth === d}
              className={
                "rounded px-2.5 py-0.5 font-mono text-[10px] border transition-colors " +
                (localDepth === d
                  ? "border-lumen-accent bg-lumen-accent-subtle text-lumen-accent"
                  : "border-lumen-border text-lumen-text-secondary")
              }
            >
              {d === 0 ? labels.off : `${d}-hop`}
            </button>
          ))}
        </span>
      </div>

      <div
        role="tablist"
        aria-label={node.label}
        className="flex items-stretch gap-4 border-b border-lumen-border"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "links"}
          onClick={() => setTab("links")}
          className={tabClass(tab === "links")}
        >
          <Link2 size={12} />
          {labels.mobileLinksTab}
          <span className="inline-flex h-4 items-center rounded-lumen-sm bg-lumen-surface-sunken px-1.5 font-mono text-[10px] font-semibold text-lumen-text-secondary tabular-nums">
            {linkCount}
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "backlinks"}
          onClick={() => setTab("backlinks")}
          className={tabClass(tab === "backlinks")}
        >
          <ArrowLeft size={12} />
          {labels.mobileBacklinksTab}
          <span className="inline-flex h-4 items-center rounded-lumen-sm bg-lumen-accent-subtle px-1.5 font-mono text-[10px] font-semibold text-lumen-accent tabular-nums">
            {backlinks.length}
          </span>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "links" ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-0.5">
              {neighbors.map((n) => {
                const NIcon = TYPE_ICON[n.type];
                const linkId = outgoingLinkIds?.get(n.id);
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
                    className="group flex items-center gap-1 rounded-lumen-sm hover:bg-lumen-hover"
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(n.id)}
                      className="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-2 text-left"
                    >
                      <NIcon
                        size={13}
                        className="shrink-0 text-lumen-text-secondary"
                      />
                      <span className="min-w-0 flex-1 truncate text-[13px] text-lumen-text">
                        {n.label}
                      </span>
                    </button>
                    {removeLink && (
                      <button
                        type="button"
                        onClick={removeLink}
                        aria-label={labels.removeLink}
                        className="mr-1 grid h-6 w-6 shrink-0 place-items-center rounded text-lumen-text-tertiary hover:text-lumen-danger focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lumen-accent"
                      >
                        <X size={12} aria-hidden />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {canEditLinks && (
              <div className="flex items-center gap-1.5">
                <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-lumen-border bg-lumen-surface-sunken px-2.5 py-2">
                  <Search
                    size={12}
                    className="shrink-0 text-lumen-text-tertiary"
                  />
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
                    className="min-w-0 flex-1 bg-transparent text-[12px] text-lumen-text outline-none placeholder:text-lumen-text-tertiary"
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
                </div>
                <button
                  type="button"
                  onClick={submitLink}
                  aria-label={labels.addLink}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-lumen-border bg-lumen-bg text-lumen-text hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lumen-accent"
                >
                  <Plus size={14} aria-hidden />
                </button>
              </div>
            )}
          </div>
        ) : backlinks.length === 0 ? (
          <div className="rounded-lumen-sm bg-lumen-surface-sunken px-3 py-2.5 text-[12px] text-lumen-text-secondary">
            {labels.backlinksEmpty}
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {backlinks.map((entry) => {
              const RowIcon = TYPE_ICON[entry.type ?? "note"];
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => onSelect(entry.id)}
                  className="flex items-center gap-2.5 rounded-lumen-sm px-2 py-2 text-left hover:bg-lumen-hover"
                >
                  <RowIcon
                    size={13}
                    className="shrink-0 text-lumen-text-secondary"
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-lumen-text">
                    {entry.label}
                  </span>
                  <ArrowLeft
                    size={12}
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
