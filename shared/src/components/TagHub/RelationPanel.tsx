import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowUpRight, Plus, X } from "lucide-react";
import { cn } from "../cn";
import { ItemRoleBadge } from "../items/ItemRoleBadge";
import type { ItemRoleLabels } from "../items/itemRole";
import { FOCUS_RING_TIGHT } from "../styleTokens";
import { isImeComposing } from "../../utils/imeGuard";
import type { TagHubItem } from "./types";

/*
 * The right panel's relations mode (#1645 / D13, "mode B"): what the one
 * selected item sits next to, and the place to add or remove its links.
 *
 * D-20260912-main-1 Q2-A put links here rather than in a second tab. Links
 * could only be made from a note's header before this, which is why only four
 * exist — this panel works the same for a todo, an event or a daily.
 *
 * Top to bottom (brief §4.1): back to the tag's breakdown, the item card with
 * "open in its section ↗", then three sections — links (each with a remove ×
 * on hover or focus), items sharing a tag, that day's daily — and a pinned
 * "+ Add a link" that opens a title search over the hub's own rows. The
 * relations are derived by the host through buildItemRelations, the same rule
 * the note header's "related" popover reads.
 *
 * Pure presentation: data and copy injected (§6.4), lumen-* tokens only,
 * opaque surfaces (§5).
 */

export interface RelationPanelLabels {
  /** "← Back to this tag's breakdown". */
  back: string;
  /** "Open in its section". */
  openItem: string;
  links: string;
  sharedTags: string;
  sameDayDaily: string;
  /** "{label} ({count})". */
  formatSection: (label: string, count: number) => string;
  /** Shown under a section with nothing in it. */
  sectionEmpty: string;
  /** "Remove the link to “{title}”". */
  formatRemoveLink: (title: string) => string;
  addLink: string;
  /** The add popover's accessible name. */
  addLinkDialog: string;
  searchPlaceholder: string;
  /** Heads the rows the search offers — "Candidates" in formatSection. */
  candidates: string;
  noCandidates: string;
  roles: ItemRoleLabels;
}

export interface RelationLink {
  item: TagHubItem;
  /** Every stored link binding the pair (#884). */
  linkIds: readonly string[];
}

export interface RelationPanelProps {
  item: TagHubItem;
  linked: readonly RelationLink[];
  sharedTagItems: readonly TagHubItem[];
  sameDayDaily: TagHubItem | null;
  /** What a new link may point at — the host leaves out self and linked. */
  candidates: readonly TagHubItem[];
  onBack: () => void;
  onOpenItem: (item: TagHubItem) => void;
  onRemoveLink: (linkIds: readonly string[]) => void;
  onAddLink: (target: TagHubItem) => void;
  /**
   * Open the add-link chooser BELOW its button instead of above (#1846). The
   * narrow host shows this panel in a bottom sheet whose body scrolls, and a
   * scroller clips what overflows its top edge for good — a chooser opening
   * upward from a short sheet lost its search field. Overflow at the bottom
   * scrolls instead, and the field's autofocus scrolls it into view.
   */
  addLinkOpensDown?: boolean;
  labels: RelationPanelLabels;
}

/** Candidate rows shown at once; the search narrows the rest. */
const MAX_CANDIDATES = 8;

export function RelationPanel({
  item,
  linked,
  sharedTagItems,
  sameDayDaily,
  candidates,
  onBack,
  onOpenItem,
  onRemoveLink,
  onAddLink,
  addLinkOpensDown = false,
  labels,
}: RelationPanelProps) {
  const rowButton = (row: TagHubItem) => (
    <button
      type="button"
      onClick={() => onOpenItem(row)}
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2 rounded-lumen-sm px-2 py-1.5 text-left",
        "transition-colors hover:bg-lumen-hover",
        FOCUS_RING_TIGHT,
      )}
    >
      <ItemRoleBadge role={row.role} labels={labels.roles} compact />
      <span
        className="min-w-0 flex-1 truncate text-[13px] text-lumen-text"
        title={row.title}
      >
        {row.title}
      </span>
    </button>
  );

  const section = (label: string, count: number, body: ReactNode) => (
    <section aria-label={labels.formatSection(label, count)}>
      <h3 className="mb-1.5 text-xs font-medium text-lumen-text-tertiary">
        {labels.formatSection(label, count)}
      </h3>
      {count === 0 ? (
        <p className="px-2 text-xs text-lumen-text-tertiary">
          {labels.sectionEmpty}
        </p>
      ) : (
        <ul className="flex flex-col">{body}</ul>
      )}
    </section>
  );

  return (
    <div className="flex min-h-full flex-col gap-5">
      <button
        type="button"
        onClick={onBack}
        className={cn(
          "flex items-center gap-1.5 self-start rounded-lumen-sm px-1 py-0.5 text-xs text-lumen-text-secondary",
          "transition-colors hover:text-lumen-text",
          FOCUS_RING_TIGHT,
        )}
      >
        <ArrowLeft size={13} aria-hidden />
        {labels.back}
      </button>

      <div className="flex flex-col gap-2 rounded-lumen-md border border-lumen-border bg-lumen-bg-secondary p-3">
        <div className="flex min-w-0 items-center gap-2">
          <ItemRoleBadge role={item.role} labels={labels.roles} compact />
          <h2
            className="min-w-0 flex-1 truncate text-sm font-semibold text-lumen-text"
            title={item.title}
          >
            {item.title}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => onOpenItem(item)}
          className={cn(
            "flex items-center gap-1 self-start rounded-lumen-sm text-xs font-medium text-lumen-accent",
            "hover:underline",
            FOCUS_RING_TIGHT,
          )}
        >
          {labels.openItem}
          <ArrowUpRight size={12} aria-hidden />
        </button>
      </div>

      {section(
        labels.links,
        linked.length,
        linked.map((link) => (
          <li key={link.item.id} className="group flex items-center">
            {rowButton(link.item)}
            <button
              type="button"
              onClick={() => onRemoveLink(link.linkIds)}
              aria-label={labels.formatRemoveLink(link.item.title)}
              className={cn(
                "shrink-0 rounded-lumen-sm p-1 text-lumen-text-secondary",
                "opacity-0 transition-opacity hover:text-lumen-danger group-hover:opacity-100 focus-visible:opacity-100",
                FOCUS_RING_TIGHT,
              )}
            >
              <X size={13} aria-hidden />
            </button>
          </li>
        )),
      )}
      {section(
        labels.sharedTags,
        sharedTagItems.length,
        sharedTagItems.map((row) => (
          <li key={row.id} className="flex">
            {rowButton(row)}
          </li>
        )),
      )}
      {section(
        labels.sameDayDaily,
        sameDayDaily ? 1 : 0,
        sameDayDaily && <li className="flex">{rowButton(sameDayDaily)}</li>,
      )}

      <div className="mt-auto">
        <AddLinkButton
          candidates={candidates}
          onAddLink={onAddLink}
          opensDown={addLinkOpensDown}
          labels={labels}
        />
      </div>
    </div>
  );
}

function AddLinkButton({
  candidates,
  onAddLink,
  opensDown,
  labels,
}: {
  candidates: readonly TagHubItem[];
  onAddLink: (target: TagHubItem) => void;
  opensDown: boolean;
  labels: RelationPanelLabels;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const boxRef = useRef<HTMLDivElement | null>(null);
  const candidatesHeadingId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer, true);
    return () => document.removeEventListener("pointerdown", onPointer, true);
  }, [open]);

  const needle = query.trim().toLowerCase();
  const matches = (
    needle
      ? candidates.filter((c) => c.title.toLowerCase().includes(needle))
      : candidates
  ).slice(0, MAX_CANDIDATES);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          "flex w-full items-center justify-center gap-1.5 rounded-lumen-md border border-lumen-border-strong bg-lumen-bg px-3 py-1.5 text-sm text-lumen-text-secondary",
          "transition-colors hover:bg-lumen-hover hover:text-lumen-text",
          FOCUS_RING_TIGHT,
        )}
      >
        <Plus size={14} aria-hidden />
        {labels.addLink}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={labels.addLinkDialog}
          onKeyDown={(e) => {
            if (isImeComposing(e)) return;
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              close();
            }
          }}
          className={cn(
            "absolute left-0 right-0 z-50 rounded-lumen-md border border-lumen-border bg-lumen-bg p-2 shadow-lumen-lg",
            opensDown ? "top-full mt-2" : "bottom-full mb-2",
          )}
        >
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={labels.searchPlaceholder}
            aria-label={labels.searchPlaceholder}
            className={cn(
              "w-full rounded-lumen-sm border border-lumen-border bg-lumen-bg-secondary px-2 py-1 text-xs text-lumen-text",
              "placeholder:text-lumen-text-tertiary",
              FOCUS_RING_TIGHT,
            )}
          />
          {/*
           * The brief's M5 heads the rows with "Candidates (N)", the same
           * shape the panel's own sections use, so the count of what the
           * search narrowed to is readable without counting the rows.
           */}
          <h3
            className="mb-1.5 mt-2 px-1 text-xs font-medium text-lumen-text-tertiary"
            id={candidatesHeadingId}
          >
            {labels.formatSection(labels.candidates, matches.length)}
          </h3>
          {matches.length === 0 ? (
            <p className="px-1 py-1 text-xs text-lumen-text-tertiary">
              {labels.noCandidates}
            </p>
          ) : (
            <ul
              aria-labelledby={candidatesHeadingId}
              className="max-h-60 overflow-y-auto"
            >
              {matches.map((target) => (
                <li key={target.id}>
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      onAddLink(target);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lumen-sm px-1.5 py-1.5 text-left text-xs",
                      "text-lumen-text transition-colors hover:bg-lumen-hover",
                      FOCUS_RING_TIGHT,
                    )}
                  >
                    <ItemRoleBadge
                      role={target.role}
                      labels={labels.roles}
                      compact
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {target.title}
                    </span>
                    <span className="shrink-0 text-[0.6875rem] text-lumen-text-tertiary">
                      {labels.roles[target.role]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
