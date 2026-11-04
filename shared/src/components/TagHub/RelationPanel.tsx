import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, ExternalLink, Plus, X } from "lucide-react";
import { cn } from "../cn";
import { ItemRoleBadge } from "../items/ItemRoleBadge";
import {
  ITEM_ROLE_ICON,
  ITEM_ROLE_ICON_CLASS,
  UNKNOWN_ITEM_ROLE_ICON,
  UNKNOWN_ITEM_ROLE_ICON_CLASS,
  itemRoleLabel,
  resolveItemRole,
  type ItemRoleLabels,
} from "../items/itemRole";
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
 * Top to bottom (#2602, the prototype's order): the item's kind and title with
 * no card, then three sections — links (each with a remove × on hover or
 * focus, and "+ Add a link" under them, which opens a title search over the
 * hub's own rows), items sharing a tag, that day's daily — and a bottom row
 * with "open in its section" and "back to this tag". The prototype's links
 * are read-only; adding and removing stay because they are the only place a
 * todo, event or daily gets a link. The relations are derived by the host
 * through buildItemRelations, the same rule the note header's "related"
 * popover reads.
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
  /**
   * "{label} ({count})" — a section's accessible name and the picker's
   * heading. The sections' visible headings carry the label alone.
   */
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
   * Open the add-link chooser BELOW its button (the default) or above it.
   * #1846 turned the phone's sheet downward: a scroller clips what overflows
   * its top edge for good, and a chooser opening upward lost its search
   * field. Since #2602 the button sits under the links, near the top of the
   * Desktop sidebar too, so opening upward would clip there as well; overflow
   * at the bottom scrolls instead, and the field's autofocus scrolls it into
   * view.
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
  addLinkOpensDown = true,
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
      <RoleIcon role={row.role} labels={labels.roles} announce />
      <span
        className="min-w-0 flex-1 truncate text-[13px] text-lumen-text"
        title={row.title}
      >
        {row.title}
      </span>
    </button>
  );

  // The visible heading drops the count (#2602 — the prototype heads each
  // section with its name alone); the region's accessible name keeps it so a
  // screen reader still hears how many rows follow before entering them.
  const section = (
    label: string,
    count: number,
    body: ReactNode,
    footer?: ReactNode,
  ) => (
    <section aria-label={labels.formatSection(label, count)}>
      <h3 className="mb-1.5 text-xs font-bold text-lumen-text-secondary">
        {label}
      </h3>
      {count === 0 ? (
        <p className="px-2 text-xs text-lumen-text-tertiary">
          {labels.sectionEmpty}
        </p>
      ) : (
        <ul className="flex flex-col">{body}</ul>
      )}
      {footer}
    </section>
  );

  return (
    <div className="flex min-h-full flex-col gap-5">
      <header className="flex min-w-0 flex-col gap-1">
        <p className="flex min-w-0 items-center gap-1.5 text-xs text-lumen-text-secondary">
          <RoleIcon role={item.role} labels={labels.roles} />
          <span className="truncate">
            {itemRoleLabel(item.role, labels.roles)}
          </span>
        </p>
        <h2
          className="min-w-0 truncate text-sm font-semibold text-lumen-text"
          title={item.title}
        >
          {item.title}
        </h2>
      </header>

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
        <AddLinkButton
          candidates={candidates}
          onAddLink={onAddLink}
          opensDown={addLinkOpensDown}
          labels={labels}
        />,
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

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => onOpenItem(item)}
          className={cn(
            "flex items-center gap-1.5 rounded-lumen-md border border-lumen-border-strong bg-lumen-bg px-3 py-1.5 text-xs font-medium text-lumen-text",
            "transition-colors hover:bg-lumen-hover max-md:min-h-11",
            FOCUS_RING_TIGHT,
          )}
        >
          <ExternalLink size={13} aria-hidden />
          {labels.openItem}
        </button>
        <button
          type="button"
          onClick={onBack}
          className={cn(
            "flex items-center gap-1.5 rounded-lumen-md px-2 py-1.5 text-xs text-lumen-text-secondary",
            "transition-colors hover:bg-lumen-hover hover:text-lumen-text max-md:min-h-11",
            FOCUS_RING_TIGHT,
          )}
        >
          <ArrowLeft size={13} aria-hidden />
          {labels.back}
        </button>
      </div>
    </div>
  );
}

/**
 * The bare kind glyph, tinted like ItemRoleBadge's but without its chip: the
 * prototype marks rows and the header with the icon alone. `announce` gives
 * it the kind as its accessible name where no visible word says it (rows);
 * the header prints the kind beside it, so there it stays decorative.
 */
function RoleIcon({
  role,
  labels,
  announce = false,
}: {
  role: string;
  labels: ItemRoleLabels;
  announce?: boolean;
}): React.JSX.Element {
  const resolved = resolveItemRole(role);
  const Icon = resolved ? ITEM_ROLE_ICON[resolved] : UNKNOWN_ITEM_ROLE_ICON;
  const tint = resolved
    ? ITEM_ROLE_ICON_CLASS[resolved]
    : UNKNOWN_ITEM_ROLE_ICON_CLASS;
  const label = itemRoleLabel(role, labels);
  return (
    <span
      role={announce ? "img" : undefined}
      aria-label={announce ? label : undefined}
      aria-hidden={announce ? undefined : true}
      title={announce ? label : undefined}
      className="inline-flex shrink-0"
    >
      <Icon size={13} aria-hidden className={tint} />
    </span>
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
    <div ref={boxRef} className="relative mt-1">
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          "flex items-center gap-1.5 rounded-lumen-sm px-2 py-1 text-xs text-lumen-text-secondary",
          "transition-colors hover:bg-lumen-hover hover:text-lumen-text max-md:min-h-11",
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
