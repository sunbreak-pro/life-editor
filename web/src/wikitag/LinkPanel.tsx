import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Link2, Network, Plus, Trash2 } from "lucide-react";
import {
  balanceByRole,
  buildItemRelations,
  isImeComposing,
  itemLinkVisual,
  NoticePanel,
  useToastOptional,
  useTranslation,
  useWikiTagsUnifiedContext,
} from "@life-editor/shared";
import type { ItemLinkPreviewSource } from "../notes/useItemLinkPreview";
import { LinkChip } from "./LinkChip";
import { useLinkChipPopover } from "./useLinkChipPopover";

/*
 * LinkPanel — the item↔item links of a single item, as a chip row.
 *
 * Self-contained: reads both directions from useWikiTagsUnifiedContext's bulk
 * cache (`getLinksForItem`), so a list of N rows costs one query per table
 * instead of two per row.
 *
 * #884 moved it out of the Notes rightSidebar and onto the detail header, right
 * of the "+ tag" pill, and dropped DIRECTION from the vocabulary: a link is a
 * relation between two items, so both ends show it and neither is captioned
 * "from" or "to". The two stored directions are therefore merged into one list
 * keyed by the OTHER item — a pair linked both ways is one chip, and removing
 * it clears every row that binds the pair. The storage model is untouched;
 * only what the user is asked to think about got smaller.
 *
 * #749 brought the panel up to the level of the app's two newer link surfaces,
 * which it had fallen a generation behind:
 *
 *   - ADDING is a SEARCH PICKER, not an id field. The old input asked for an
 *     `items_meta.id` ("Link to id…") with a <datalist> whose option values
 *     were ids, so even picking from the completion list meant knowing ids.
 *     The picker here filters the cross-role candidate pool by TITLE and reads
 *     like `ItemLinkMenu` (the body's "[[" menu): icon + title + role hint,
 *     listbox semantics, ↑/↓/Enter/Esc. Two pickers, one system.
 *   - ROWS ARE CLICKABLE. Outgoing / backlink rows were a <span> and an <li>;
 *     they are buttons now and route through the host's item navigation (the
 *     same `pendingSelect…` handoff a "[[" link click uses — #475), with the
 *     icon + count treatment the old <BacklinkView> used. That component is
 *     gone (#1152 retired the Connect section it was written for, #1239 deleted
 *     the salvaged copy once no caller appeared) — this panel never imported
 *     it, only borrowed its look, so nothing here changed when it went.
 *   - TITLES RESOLVE CROSS-ROLE. `resolveTitle` only knows the host's own
 *     domain (Notes), so a Note→Todo link rendered as an id fragment. The
 *     candidate pool doubles as the title source for every role it carries;
 *     the id fragment is now only the last resort.
 *
 * #1172 made it a RELATED panel. #1152 retired the Connect section's
 * force-directed graph, and the question that graph existed to answer — "what
 * is this note sitting next to?" — is better asked from inside the note than
 * from a map of everything. So beside the "+ link" pill there is now a
 * "related" pill, and behind it the three relations that were never editable
 * anyway:
 *
 *   - LINKS. Both stored directions, still merged into one list keyed by the
 *     other item (#884): a relation is a relation, and neither end is "from".
 *     They are the chips too — the chips are the editable summary, this is the
 *     reading surface that sits beside the other two.
 *   - SHARES A TAG. Anything else carrying a tag this item carries. Derived
 *     from the same `allAssignments` bulk cache TagPicker reads, so it costs
 *     no query — and already-linked items are left out, so each item appears
 *     under one relation rather than two.
 *   - THAT DAY'S DAILY. The daily for the item's own date, which the host
 *     supplies as a key rather than an instant (only the host knows what
 *     "its date" means for the role it is rendering).
 *
 * Every row here resolves through the SAME candidate pool the picker uses, so
 * an item the pool cannot name is left out rather than shown as an id: a
 * "related" list is for following, and a row with no role has nowhere to go.
 *
 * #2391 made each link a SQUARE CHIP with only its kind's icon, in a row headed
 * by a rule and a `Link2` + count: square here against the tag's round pill, so
 * the two read apart beside each other. The title is no longer on screen, so it
 * lives in the chip's accessible name and tooltip. Two consequences:
 *
 *   - The chip's X had no room left, so REMOVING moved into the "+" popover,
 *     under the candidates. One place that works for a mouse, a thumb, a
 *     keyboard and a screen reader, and for a dead link that has no button.
 *     #2392's panel adds a second way out from the chip itself, and #2630 made
 *     it the only one: the prototype's "+" popover only adds, so the "linked"
 *     list under the candidates went away.
 *   - The row reaches Mobile. Below the breakpoint the chips are 2.25rem with a
 *     44px hit area (the `::after` in LINK_CHIP_BOX), and they scroll sideways
 *     so the row stays one line, as the tag chips do. The popover hangs from the
 *     header row there, because right-aligned to the "+" it could run off the
 *     left edge. Related stays Desktop only, as it was: the phone row has no
 *     room for a third control the design does not have.
 *
 * #2392 gave the chip a panel, so the title is on screen again when asked for:
 * hover or focus opens it, a click or tap pins it, and it is the chip's only
 * action. Opening the item moved to the panel's bottom row, next to removing the
 * link, which goes on the Undo stack from here and from the "+" popover alike.
 * See LinkChip for how the panel hangs and what closes it. The native tooltip
 * went with it: it would have opened over the panel with the same words.
 *
 * Copy comes from the catalog through `useTranslation` — the same call the
 * sibling TagPicker makes. (The props-injected-labels rule is for the shared
 * component layer; this is web's own host layer.)
 */

/** One candidate the picker can link to — the shape `useItemLinkTargets` loads. */
export interface LinkPanelTarget {
  id: string;
  label: string;
  role: string;
  /**
   * The event's day (#2391). The Schedule cannot select an event without it,
   * and it tells apart the occurrences of a repeating title in the picker.
   */
  date?: string;
  /**
   * Soft-deleted (#1292). Present so an EXISTING link can still name its
   * target; every list that offers a NEW one filters these out.
   */
  isDeleted?: boolean;
}

interface LinkPanelProps {
  itemId: string;
  /**
   * Host-domain title lookup (Notes' own context). Tried FIRST because it is
   * live, where the pool below is a snapshot taken when the panel opened.
   */
  resolveTitle?: (itemId: string) => string | undefined;
  /**
   * Cross-role candidate pool loader (notes / dailies / events / todos). Lazy by
   * contract — the panel sits behind a disclosure, so mounting is the "someone
   * actually asked" signal. Absent → the picker has no candidates and titles
   * fall back to `resolveTitle`.
   */
  loadTargets?: (options: {
    allowStale: boolean;
  }) => Promise<LinkPanelTarget[]>;
  /**
   * Open a link target. The host owns the section + tab switch, so without it
   * the rows stay non-interactive rather than pretending to be clickable.
   */
  onNavigateToItem?: (target: {
    id: string;
    role: string;
    date?: string;
  }) => void;
  /**
   * `YYYY-MM-DD` for the "that day's daily" relation (#1172). Supplied by the
   * host because only it knows which of the item's dates counts as "its" day —
   * a note's is when it was written, and another role's may not be either
   * timestamp. Absent → the section is not shown at all.
   */
  relatedDailyDate?: string;
  /**
   * What a chip's panel says about its target (#2392), read when a panel opens.
   * Absent → the panel shows the kind and the title and its two buttons.
   */
  previews?: ItemLinkPreviewSource;
}

/** Keep the popover compact — the pool is balanced across roles, not sliced. */
const MAX_CANDIDATES = 8;

/** Rows per related section. The heading carries the true count (#1172). */
const MAX_RELATED_ROWS = 8;

/** A link whose target is in the trash: its kind no longer matters. */
const DELETED_LINK_VISUAL = {
  Icon: Trash2,
  iconClass: "text-lumen-text-tertiary",
};

/*
 * The square both the chips and the "+" are drawn on: 1.5rem, or 2.25rem with a
 * 44px hit area below the breakpoint.
 *
 * The hit area is an `::after` rather than a bigger box so a row of them keeps
 * the design's size; the strip's narrow gap is what keeps two neighbours' areas
 * from overlapping. `min-h-0 min-w-0` undo the 1.75rem floor tokens.css gives
 * every icon-only button, which would otherwise win over the 1.5rem here.
 */
const LINK_CHIP_BOX =
  "relative inline-flex size-6 min-h-0 min-w-0 shrink-0 items-center justify-center rounded-lumen-sm max-md:size-9 max-md:after:absolute max-md:after:left-1/2 max-md:after:top-1/2 max-md:after:size-11 max-md:after:-translate-x-1/2 max-md:after:-translate-y-1/2 max-md:after:content-['']";

const LINK_CHIP_ICON = "size-lumen-icon-sm max-md:size-lumen-icon-md";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lumen-accent";

/** Which edge of its trigger a popover hangs from. */
type PopoverAlign = "end" | "start";

/** The popovers' `w-60`, in rem, for the room check below. */
const POPOVER_WIDTH_REM = 15;

/*
 * #2618: the popovers used to hang from the trigger's RIGHT edge and grow
 * left. When the link row wraps under the tags, the "+" sits at the left of
 * the header, so a 15rem panel grew past the detail pane and its left part —
 * search field included — went under the nav. Right-aligned stays the default
 * (it is what keeps a panel opened near the right edge on screen); only when
 * there is not a full panel's width to the left does it flip to hang from the
 * left edge and grow right.
 *
 * When neither side has a full panel's width (a pane narrower than the
 * panel plus the trigger), the side with more room wins, so the panel loses
 * as little as it can past the pane's edge.
 *
 * Kept a pure function of numbers so the rule reads on its own; the reading
 * of the DOM is in `measurePopoverAlign`.
 */
function popoverAlignFor(room: {
  triggerLeft: number;
  triggerRight: number;
  panelWidth: number;
  boundaryLeft: number;
  boundaryRight: number;
}): PopoverAlign {
  const roomLeftward = room.triggerRight - room.boundaryLeft;
  const roomRightward = room.boundaryRight - room.triggerLeft;
  if (roomLeftward >= room.panelWidth) return "end";
  if (roomRightward >= room.panelWidth) return "start";
  return roomLeftward >= roomRightward ? "end" : "start";
}

/*
 * The edges the panel must not cross are the nearest ancestor that clips
 * (the detail pane's scroller), not the viewport: the nav occupies the
 * viewport's left, and a panel that only clears the viewport still lands
 * under it. With no clipping ancestor, the viewport is the boundary.
 */
function measurePopoverAlign(trigger: HTMLElement | null): PopoverAlign {
  if (!trigger) return "end";
  let boundaryLeft = 0;
  let boundaryRight = window.innerWidth;
  for (let el = trigger.parentElement; el; el = el.parentElement) {
    const { overflowX } = getComputedStyle(el);
    if (overflowX && overflowX !== "visible") {
      const pane = el.getBoundingClientRect();
      boundaryLeft = pane.left;
      boundaryRight = pane.right;
      break;
    }
  }
  const rootFontSize =
    parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const rect = trigger.getBoundingClientRect();
  return popoverAlignFor({
    triggerLeft: rect.left,
    triggerRight: rect.right,
    panelWidth: POPOVER_WIDTH_REM * rootFontSize,
    boundaryLeft,
    boundaryRight,
  });
}

/*
 * Static class strings per side (a built `${side}-0` is invisible to
 * Tailwind's scanner). The picker's "start" keeps `max-md:right-0` because
 * below the breakpoint it spans the header row edge to edge with
 * `max-md:left-0 max-md:w-auto`, which the "end" side gets from `right-0`.
 */
const PICKER_ALIGN_CLASSES: Record<PopoverAlign, string> = {
  end: "right-0",
  start: "left-0 max-md:right-0",
};

const RELATED_ALIGN_CLASSES: Record<PopoverAlign, string> = {
  end: "right-0",
  start: "left-0",
};

export function LinkPanel({
  itemId,
  resolveTitle,
  loadTargets,
  onNavigateToItem,
  relatedDailyDate,
  previews,
}: LinkPanelProps) {
  const wiki = useWikiTagsUnifiedContext();
  const { t } = useTranslation();
  const toast = useToastOptional();
  const chipPopover = useLinkChipPopover(itemId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [relatedOpen, setRelatedOpen] = useState(false);
  const [pickerAlign, setPickerAlign] = useState<PopoverAlign>("end");
  const [relatedAlign, setRelatedAlign] = useState<PopoverAlign>("end");
  const [query, setQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [targets, setTargets] = useState<LinkPanelTarget[]>([]);
  const [error, setError] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const pickerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const pickerInputRef = useRef<HTMLInputElement | null>(null);
  const relatedRef = useRef<HTMLDivElement | null>(null);
  const relatedTriggerRef = useRef<HTMLButtonElement | null>(null);
  // Last-write-wins for the pool: an open racing the mount load must not let
  // the older answer overwrite the newer one.
  const requestRef = useRef(0);

  // `loading` follows the initial bulk load of the Context's caches. Both
  // link directions come from the bulk cache (one query per table for the
  // whole list), and the two buckets are what the shared rule is given below.
  const links = wiki.getLinksForItem(itemId);
  const loading = wiki.loading;

  // allowStale: false — a surface OPENING is exactly when the pool should catch
  // up (an item created since the last open has to be linkable). The state
  // lands in the `then` CALLBACK rather than in the effect body below, which is
  // both the shape react-hooks wants for an external read and the truth here:
  // the answer arrives from outside React, later.
  const refreshTargets = useCallback((): Promise<void> => {
    if (!loadTargets) return Promise.resolve();
    const token = ++requestRef.current;
    return loadTargets({ allowStale: false }).then(
      (pool) => {
        if (token === requestRef.current) setTargets(pool);
      },
      () => {
        // Keep whatever is already loaded; the next open retries.
      },
    );
  }, [loadTargets]);

  useEffect(() => {
    void refreshTargets();
  }, [refreshTargets]);

  // Close the picker on click-outside (self-contained — no global registry).
  useEffect(() => {
    if (!pickerOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [pickerOpen]);

  // Same click-outside contract for the related popover — its own listener, so
  // one popover closing never depends on the other's state.
  useEffect(() => {
    if (!relatedOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (
        relatedRef.current &&
        !relatedRef.current.contains(e.target as Node)
      ) {
        setRelatedOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [relatedOpen]);

  const roleLabels = useMemo<Record<string, string>>(
    () => ({
      note: t("itemRole.note"),
      daily: t("itemRole.daily"),
      task: t("itemRole.task"),
      event: t("itemRole.event"),
    }),
    [t],
  );

  const targetsById = useMemo(() => {
    const map = new Map<string, LinkPanelTarget>();
    for (const target of targets) map.set(target.id, target);
    return map;
  }, [targets]);

  /*
   * The three relations (#884 links, #1172 shared tags and that day's daily),
   * derived by the rule Connect's relations panel reads too (#1645) — see
   * buildItemRelations for why each row is kept or left out. All of it comes
   * from caches this panel already holds, so opening "related" costs no query.
   */
  const { linked, sharedTagItems, sameDayDaily } = useMemo(
    () =>
      buildItemRelations({
        itemId,
        assignments: wiki.allAssignments,
        links,
        itemsById: targetsById,
        dailyDate: relatedDailyDate,
      }),
    [itemId, wiki.allAssignments, links, targetsById, relatedDailyDate],
  );

  const linkedIds = useMemo(
    () => new Set(linked.map((entry) => entry.targetId)),
    [linked],
  );

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = targets.filter(
      (target) =>
        target.id !== itemId &&
        // #1292: the pool carries soft-deleted rows so a dead link can be
        // named. Offering one as a NEW link would mint an edge into the trash.
        !target.isDeleted &&
        !linkedIds.has(target.id) &&
        // An event is often remembered by its day, and a repeating one has
        // nothing else to tell its rows apart (same rule as the palette).
        (q
          ? target.label.toLowerCase().includes(q) || target.date?.includes(q)
          : true),
    );
    // balanceByRole, not slice: the pool is concatenated per role, so a plain
    // cut would hand all 8 slots to notes and never surface a todo (#370).
    return balanceByRole(pool, MAX_CANDIDATES);
  }, [targets, itemId, linkedIds, query]);

  const relatedCount =
    linked.length + sharedTagItems.length + (sameDayDaily ? 1 : 0);

  // Clamp rather than reset-in-an-effect: the list also shrinks when the pool
  // lands or a link is added, and a stored index past the end would highlight
  // nothing (and Enter would commit nothing). Typing resets it to 0 at the
  // keystroke itself — see the input's onChange.
  const activeIndex =
    candidates.length === 0
      ? 0
      : Math.min(highlightIndex, candidates.length - 1);

  const openPicker = () => {
    setError(null);
    setQuery("");
    // Measured on open, not on every render: the row only moves when the
    // header reflows, and a panel that jumped sides while open would be worse.
    setPickerAlign(measurePopoverAlign(pickerTriggerRef.current));
    setPickerOpen(true);
    void refreshTargets();
  };

  const closePicker = () => {
    setPickerOpen(false);
    setQuery("");
  };

  const handleAdd = async (target: LinkPanelTarget) => {
    setError(null);
    if (target.id === itemId) {
      setError(t("materials.links.selfLink"));
      return;
    }
    try {
      // The Context mutator updates the bulk cache, so the lists here
      // re-render without a local copy.
      await wiki.createItemLink(itemId, target.id);
      closePicker();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  /** The chip's panel is the one way out (#2630). */
  const removeLink = async (linkIds: string[], title: string) => {
    setError(null);
    try {
      await wiki.removeItemLinks(linkIds);
      toast?.showToast("info", t("materials.links.unlinked", { title }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  /** The name a kind goes by; a target the pool cannot place is "other". */
  const kindOf = (role: string | undefined): string =>
    (role && roleLabels[role]) || t("itemRole.unknown");

  /*
   * Where a row opens. It opens only when BOTH halves are known: the host has a
   * navigator, and the pool told us the target's role (the route keys off it).
   * An id whose item is gone from the pool stays a plain label, and so does a
   * DELETED one (#1292): its role still resolves, but there is nothing left to
   * open. An event carries its date, because the Schedule selects by it.
   */
  const openTargetFor = (id: string, deleted: boolean) => {
    const target = targetsById.get(id);
    if (!onNavigateToItem || !target || deleted) return null;
    return target.date
      ? { id, role: target.role, date: target.date }
      : { id, role: target.role };
  };

  /*
   * How a row names its target, and what it says when the target is gone.
   *
   * #1292: deleting a linked todo used to leave the row printing `…56123478` —
   * the id, shortened. The user's reading of that was "a run of digits", which
   * is fair: it names nothing and looks like a bug. The pool now carries
   * soft-deleted rows flagged, so the row can keep the TITLE the link was made
   * with and mark it deleted instead.
   *
   * The id fragment survives as the third case only, for a target no side can
   * name at all — a role outside the pool (a goal), or a row not yet loaded.
   * That is genuinely "unknown", not "deleted", and claiming otherwise would be
   * the same lie in the other direction.
   */
  const resolveRow = (
    id: string,
  ): { title: string; deleted: boolean; named: boolean } => {
    const fromResolver = resolveTitle?.(id);
    if (fromResolver) {
      return { title: fromResolver, deleted: false, named: true };
    }
    const pooled = targetsById.get(id);
    if (pooled?.label) {
      return { title: pooled.label, deleted: !!pooled.isDeleted, named: true };
    }
    // A row with no name shows its full id in the `title` attribute, so a link
    // nothing can name is still identifiable on hover.
    return {
      title: id.length > 12 ? `…${id.slice(-8)}` : id,
      deleted: false,
      named: false,
    };
  };

  /** The row's visible text — a deleted target is named AND said to be gone. */
  const rowLabel = (row: { title: string; deleted: boolean }): string =>
    row.deleted
      ? t("materials.links.deletedTarget", { title: row.title })
      : row.title;

  const handlePickerKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    // IME guard (rules/frontend.md §Gotchas): while a Japanese conversion is
    // open, Enter CONFIRMS the conversion and Escape CANCELS it — neither is
    // meant for the picker. WebKit reports the confirming Enter with
    // isComposing false, so the shared helper (not the raw flag) is the check.
    if (isImeComposing(e)) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (candidates.length > 0) {
        setHighlightIndex((activeIndex + 1) % candidates.length);
      }
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (candidates.length > 0) {
        setHighlightIndex(
          (activeIndex + candidates.length - 1) % candidates.length,
        );
      }
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const picked = candidates[activeIndex];
      if (picked) void handleAdd(picked);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      closePicker();
    }
  };

  /** One linked item: a square with its kind's icon, named for the title. */
  const renderChip = (entry: { targetId: string; linkIds: string[] }) => {
    const { targetId, linkIds } = entry;
    const row = resolveRow(targetId);
    const target = targetsById.get(targetId);
    const role = target?.role;
    const { Icon, iconClass } = row.deleted
      ? DELETED_LINK_VISUAL
      : itemLinkVisual(role);
    const title = rowLabel(row);
    const kind = kindOf(role);
    const name = t("materials.links.chipName", { kind, title });

    return (
      <LinkChip
        key={targetId}
        id={targetId}
        name={name}
        boxClass={`${LINK_CHIP_BOX} border ${FOCUS_RING}`}
        closedClass="border-lumen-border bg-lumen-bg hover:bg-lumen-hover"
        openClass="border-lumen-accent bg-lumen-accent-subtle"
        glyph={
          <Icon aria-hidden className={`${LINK_CHIP_ICON} ${iconClass}`} />
        }
        popover={chipPopover}
        previews={previews}
        panel={() => {
          const openTarget = openTargetFor(targetId, row.deleted);
          return {
            dialogLabel: name,
            kindLabel: kind,
            kindIcon: <Icon aria-hidden className={`size-3.5 ${iconClass}`} />,
            title,
            // Only part of the id is showing, and nothing else can identify it.
            titleHint: row.named ? undefined : targetId,
            struck: row.deleted,
            previewTarget:
              target && !row.deleted
                ? { id: targetId, role: target.role, date: target.date }
                : null,
            // A dismissed event, or a kind the pool does not carry (a goal).
            note: row.named
              ? undefined
              : t("materials.links.previewUnavailable"),
            onOpen: openTarget
              ? () => {
                  chipPopover.close();
                  onNavigateToItem?.(openTarget);
                }
              : undefined,
            onUnlink: () => {
              chipPopover.close();
              // The chip that held the focus is about to go.
              pickerTriggerRef.current?.focus();
              void removeLink(linkIds, title);
            },
          };
        }}
      />
    );
  };

  /** A kind's glyph on the small tile the popover rows lead with. */
  const renderRowTile = (role: string | undefined, deleted: boolean) => {
    const { Icon, iconClass } = deleted
      ? DELETED_LINK_VISUAL
      : itemLinkVisual(role);
    return (
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-lumen-sm border border-lumen-border bg-lumen-bg">
        <Icon size={12} aria-hidden className={iconClass} />
      </span>
    );
  };

  /** One related row: icon + title, opening the item if it can be opened. */
  const renderRelatedRow = (id: string) => {
    const row = resolveRow(id);
    const role = targetsById.get(id)?.role;
    const title = rowLabel(row);
    const open = openTargetFor(id, row.deleted);
    const body = (
      <>
        {renderRowTile(role, row.deleted)}
        <span
          className={`min-w-0 flex-1 truncate text-left${row.deleted ? " line-through" : ""}`}
        >
          {title}
        </span>
      </>
    );
    return (
      <li key={id}>
        {open ? (
          <button
            type="button"
            title={id}
            onClick={() => {
              onNavigateToItem?.(open);
              setRelatedOpen(false);
            }}
            aria-label={t("materials.links.open", { title })}
            className="flex w-full items-center gap-2 rounded-lumen-sm px-1.5 py-1.5 text-xs font-normal text-lumen-text-secondary hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lumen-accent"
          >
            {body}
          </button>
        ) : (
          <span
            title={id}
            className="flex w-full items-center gap-2 px-1.5 py-1.5 text-xs font-normal text-lumen-text-tertiary"
          >
            {body}
          </span>
        )}
      </li>
    );
  };

  /** A named group of related rows. Empty groups are not drawn at all. */
  const renderRelatedSection = (label: string, ids: string[]) => {
    if (ids.length === 0) return null;
    return (
      <div key={label} className="flex flex-col gap-0.5">
        <p className="px-1.5 pt-1 text-[0.6875rem] uppercase tracking-wide text-lumen-text-tertiary">
          {t("materials.related.sectionCount", {
            label,
            count: ids.length,
          })}
        </p>
        {/* The heading counts them all; the list shows the first few. A
            silently truncated list that also claimed the short number would
            read as "that is everything". */}
        <ul>{ids.slice(0, MAX_RELATED_ROWS).map(renderRelatedRow)}</ul>
      </div>
    );
  };

  const listboxId = `link-picker-${itemId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

  return (
    <div
      role="group"
      aria-label={t("materials.links.panelLabel")}
      className="inline-flex flex-wrap items-center gap-1.5 max-md:min-w-0 max-md:flex-nowrap"
    >
      {/* The rule closes the tag row off; the chips below are the LINK row. */}
      <span
        role="separator"
        aria-orientation="vertical"
        className="h-4 w-px shrink-0 bg-lumen-border-strong"
      />
      <span
        role="img"
        aria-label={t("materials.links.countLabel", { total: linked.length })}
        className="inline-flex shrink-0 items-center gap-1 text-xs text-lumen-text-secondary"
      >
        <Link2 size={12} aria-hidden />
        <span aria-hidden>{loading ? "…" : linked.length}</span>
      </span>

      {/* Same strip as the tag chips (TagPicker `singleRow`): nothing of its
          own at Desktop, one sideways-scrolling line below the breakpoint. The
          popovers stay outside it, where its overflow cannot clip them. */}
      <span className="contents max-md:flex max-md:min-h-11 max-md:min-w-0 max-md:items-center max-md:gap-2 max-md:overflow-x-auto max-md:overflow-y-hidden max-md:px-1">
        {!loading && linked.map(renderChip)}
      </span>

      {error && (
        // Text variant at the row's own xs size (#1278): this sits inline
        // among the chips, where a band would break the row into two lines.
        <NoticePanel variant="text" size="xs" tone="danger" message={error} />
      )}

      {/* The "+" closes the row as one more square, dashed because it holds
          nothing yet. `max-md:static` hands the popover to the header row. */}
      <div ref={pickerRef} className="relative shrink-0 max-md:static">
        <button
          ref={pickerTriggerRef}
          type="button"
          onClick={() => (pickerOpen ? closePicker() : openPicker())}
          aria-label={t("materials.links.add")}
          title={t("materials.links.add")}
          aria-expanded={pickerOpen}
          className={`${LINK_CHIP_BOX} border border-dashed border-lumen-border-strong text-lumen-text-secondary hover:bg-lumen-hover ${FOCUS_RING}`}
        >
          <Plus aria-hidden className={LINK_CHIP_ICON} />
        </button>

        {pickerOpen && (
          <div
            role="dialog"
            aria-label={t("materials.links.pickerDialog")}
            onKeyDown={(e) => {
              if (e.key !== "Escape" || isImeComposing(e)) return;
              closePicker();
              pickerTriggerRef.current?.focus();
            }}
            className={`absolute ${PICKER_ALIGN_CLASSES[pickerAlign]} top-full z-20 mt-1 w-60 max-w-[calc(100vw-2rem)] rounded-lumen-md border border-lumen-border bg-lumen-bg p-2 shadow-lumen-md max-md:left-0 max-md:w-auto`}
          >
            <input
              ref={pickerInputRef}
              type="text"
              autoFocus
              role="combobox"
              aria-expanded
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-label={t("materials.links.searchLabel")}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                // A narrower list is a different list — start at its top.
                setHighlightIndex(0);
              }}
              onKeyDown={handlePickerKeyDown}
              placeholder={t("materials.links.searchPlaceholder")}
              className="w-full rounded-lumen-sm border border-lumen-border bg-lumen-bg-secondary px-2 py-1 text-xs font-normal text-lumen-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lumen-accent"
            />
            {candidates.length === 0 ? (
              <p className="mt-2 px-1 py-1 text-xs font-normal text-lumen-text-tertiary">
                {t("materials.links.noCandidates")}
              </p>
            ) : (
              <div
                id={listboxId}
                role="listbox"
                aria-label={t("materials.links.pickerDialog")}
                className="mt-2 max-h-48 overflow-y-auto"
              >
                {candidates.map((target, index) => {
                  const isActive = index === activeIndex;
                  return (
                    <button
                      key={target.id}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onMouseEnter={() => setHighlightIndex(index)}
                      onClick={() => void handleAdd(target)}
                      className={[
                        "flex w-full items-center gap-2 rounded-lumen-sm px-1.5 py-1.5 text-left text-xs font-normal max-md:min-h-11",
                        isActive
                          ? "bg-lumen-accent-subtle text-lumen-text"
                          : "text-lumen-text-secondary hover:bg-lumen-hover",
                      ].join(" ")}
                    >
                      {renderRowTile(target.role, false)}
                      {/* #2474: below the breakpoint the kind and the day drop
                          under the title, which then has the row's whole width.
                          Beside it, they took so much of a phone-width list
                          that an event's title was cut to one letter. On
                          Desktop this box is `contents`, so the row is the same
                          three items it always was. */}
                      <span className="contents max-md:flex max-md:min-w-0 max-md:flex-1 max-md:flex-col max-md:items-start">
                        <span className="min-w-0 flex-1 truncate max-md:w-full max-md:flex-none">
                          {target.label}
                        </span>
                        <span className="shrink-0 text-[0.6875rem] text-lumen-text-tertiary max-md:max-w-full max-md:truncate">
                          {roleLabels[target.role] ?? target.role}
                          {target.date ? ` ${target.date}` : ""}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Related (#1172) — a pill carrying the count rather than a word, because
          it is the third control on a row that already spells out what it is.
          Desktop only (see the header note on #2391). */}
      <div ref={relatedRef} className="relative max-md:hidden">
        <button
          ref={relatedTriggerRef}
          type="button"
          onClick={() => {
            if (!relatedOpen) {
              setRelatedAlign(measurePopoverAlign(relatedTriggerRef.current));
            }
            setRelatedOpen(!relatedOpen);
          }}
          aria-label={t("materials.related.open")}
          aria-expanded={relatedOpen}
          className="inline-flex items-center gap-1 rounded-md border border-dashed border-lumen-border px-2 py-1 text-xs text-lumen-text-secondary hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lumen-accent"
        >
          <Network size={12} aria-hidden />
          <span>{relatedCount}</span>
        </button>

        {relatedOpen && (
          <div
            role="dialog"
            aria-label={t("materials.related.dialog")}
            className={`absolute ${RELATED_ALIGN_CLASSES[relatedAlign]} top-full z-20 mt-1 max-h-80 w-60 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lumen-md border border-lumen-border bg-lumen-bg p-2 shadow-lumen-md`}
          >
            {relatedCount === 0 ? (
              <p className="px-1.5 py-1 text-xs font-normal text-lumen-text-tertiary">
                {t("materials.related.empty")}
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {renderRelatedSection(
                  t("materials.related.links"),
                  linked.map((entry) => entry.targetId),
                )}
                {renderRelatedSection(
                  t("materials.related.sharedTags"),
                  sharedTagItems.map((target) => target.id),
                )}
                {renderRelatedSection(
                  t("materials.related.sameDayDaily"),
                  sameDayDaily ? [sameDayDaily.id] : [],
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
