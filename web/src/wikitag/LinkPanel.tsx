import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  CalendarDays,
  CheckSquare,
  FileText,
  Link2,
  Network,
  Plus,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  balanceByRole,
  isImeComposing,
  NoticePanel,
  useTranslation,
  useWikiTagsUnifiedContext,
} from "@life-editor/shared";

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
   * Cross-role candidate pool loader (notes / dailies / todos). Lazy by
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
  onNavigateToItem?: (target: { id: string; role: string }) => void;
  /**
   * `YYYY-MM-DD` for the "that day's daily" relation (#1172). Supplied by the
   * host because only it knows which of the item's dates counts as "its" day —
   * a note's is when it was written, and another role's may not be either
   * timestamp. Absent → the section is not shown at all.
   */
  relatedDailyDate?: string;
}

/** Keep the popover compact — the pool is balanced across roles, not sliced. */
const MAX_CANDIDATES = 8;

/** Rows per related section. The heading carries the true count (#1172). */
const MAX_RELATED_ROWS = 8;

const ROLE_ICON: Record<string, LucideIcon> = {
  note: FileText,
  daily: CalendarDays,
  task: CheckSquare,
};

function roleIcon(role: string | undefined): LucideIcon {
  return (role && ROLE_ICON[role]) || Link2;
}

export function LinkPanel({
  itemId,
  resolveTitle,
  loadTargets,
  onNavigateToItem,
  relatedDailyDate,
}: LinkPanelProps) {
  const wiki = useWikiTagsUnifiedContext();
  const { t } = useTranslation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [relatedOpen, setRelatedOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [targets, setTargets] = useState<LinkPanelTarget[]>([]);
  const [error, setError] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const relatedRef = useRef<HTMLDivElement | null>(null);
  // Last-write-wins for the pool: an open racing the mount load must not let
  // the older answer overwrite the newer one.
  const requestRef = useRef(0);

  // Both directions come from the Context's bulk cache (one query per table
  // for the whole list). `loading` follows the initial bulk load.
  const links = wiki.getLinksForItem(itemId);
  const loading = wiki.loading;

  const outgoing = useMemo(
    () => links.outgoing.filter((l) => !l.isDeleted),
    [links.outgoing],
  );
  const incoming = useMemo(
    () => links.incoming.filter((l) => !l.isDeleted),
    [links.incoming],
  );

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
   * One entry per LINKED ITEM, not per stored link row (#884). `linkIds` keeps
   * every row that binds the pair — both the outgoing and the incoming one when
   * the two items were linked from each side — so removing the chip removes the
   * relation rather than half of it.
   */
  const linked = useMemo(() => {
    const byItem = new Map<string, { targetId: string; linkIds: string[] }>();
    const add = (targetId: string, linkId: string) => {
      const entry = byItem.get(targetId);
      if (entry) entry.linkIds.push(linkId);
      else byItem.set(targetId, { targetId, linkIds: [linkId] });
    };
    for (const l of outgoing) add(l.toItemId, l.id);
    for (const l of incoming) add(l.fromItemId, l.id);
    return [...byItem.values()];
  }, [outgoing, incoming]);

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
        (q ? target.label.toLowerCase().includes(q) : true),
    );
    // balanceByRole, not slice: the pool is concatenated per role, so a plain
    // cut would hand all 8 slots to notes and never surface a todo (#370).
    return balanceByRole(pool, MAX_CANDIDATES);
  }, [targets, itemId, linkedIds, query]);

  /*
   * #1172 — the two relations that are not links.
   *
   * Both derive from caches the panel already holds (`allAssignments` is the
   * same bulk read TagPicker uses; the pool is the picker's), so opening the
   * related popover costs no query. Items the pool cannot name are dropped
   * rather than shown as an id fragment: the navigation route keys off the
   * role, and a row that cannot be followed is not a relation worth listing.
   */
  const sharedTagItems = useMemo(() => {
    const mine = new Set(
      wiki
        .getTagsForItem(itemId)
        .filter((a) => !a.isDeleted)
        .map((a) => a.tagId),
    );
    if (mine.size === 0) return [] as LinkPanelTarget[];
    const seen = new Set<string>();
    const out: LinkPanelTarget[] = [];
    for (const a of wiki.allAssignments) {
      if (a.isDeleted || a.itemId === itemId) continue;
      if (!mine.has(a.tagId)) continue;
      if (seen.has(a.itemId)) continue;
      seen.add(a.itemId);
      // Already linked → it is in the links section. One item, one relation:
      // listing it twice makes the panel look busier than the graph is.
      if (linkedIds.has(a.itemId)) continue;
      const target = targetsById.get(a.itemId);
      // A deleted item is not a relation to follow (#1292) — the links section
      // above shows dead ends because the user built them; this one would be
      // inventing one.
      if (target && !target.isDeleted) out.push(target);
    }
    return out.sort((a, b) => a.label.localeCompare(b.label));
  }, [wiki, itemId, linkedIds, targetsById]);

  const sameDayDaily = useMemo(() => {
    if (!relatedDailyDate) return null;
    // Daily ids are `daily-<YYYY-MM-DD>` (CLAUDE.md §4), so the day IS the
    // lookup — no extra read to find out whether that entry exists.
    const id = `daily-${relatedDailyDate}`;
    if (linkedIds.has(id)) return null;
    const target = targetsById.get(id);
    return target && !target.isDeleted ? target : null;
  }, [relatedDailyDate, linkedIds, targetsById]);

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

  const handleDelete = async (linkIds: string[]) => {
    try {
      // Sequential, not Promise.all: the Context mutator rewrites the same bulk
      // cache each time, and two writes landing together can drop one update.
      for (const linkId of linkIds) await wiki.deleteItemLink(linkId);
    } catch (err) {
      console.error("deleteItemLink failed", err);
    }
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
   * name at all — a role outside the pool (an event), or a row not yet loaded.
   * That is genuinely "unknown", not "deleted", and claiming otherwise would be
   * the same lie in the other direction.
   */
  const resolveRow = (id: string): { title: string; deleted: boolean } => {
    const fromResolver = resolveTitle?.(id);
    if (fromResolver) return { title: fromResolver, deleted: false };
    const pooled = targetsById.get(id);
    if (pooled?.label) {
      return { title: pooled.label, deleted: !!pooled.isDeleted };
    }
    // The full id stays in the row's `title` attribute either way, so a link
    // nothing can name is still identifiable on hover.
    return {
      title: id.length > 12 ? `…${id.slice(-8)}` : id,
      deleted: false,
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

  /** One linked item, as a chip sitting beside the tag pills. */
  const renderChip = (entry: { targetId: string; linkIds: string[] }) => {
    const { targetId, linkIds } = entry;
    const row = resolveRow(targetId);
    const role = targetsById.get(targetId)?.role;
    const Icon = row.deleted ? Trash2 : roleIcon(role);
    const title = rowLabel(row);
    // A chip opens only when BOTH halves are known: the host has a navigator,
    // and the pool told us the target's role (the route keys off it). An id
    // whose item is gone from the pool stays a plain, honest label — and so
    // does a DELETED one (#1292): its role still resolves, but there is nothing
    // left to open, and the remove button beside it is the useful action.
    const openTarget =
      onNavigateToItem && role && !row.deleted ? { id: targetId, role } : null;

    const body = (
      <>
        <Icon size={12} aria-hidden className="shrink-0" />
        <span
          className={`max-w-[12rem] truncate text-left${row.deleted ? " line-through" : ""}`}
        >
          {title}
        </span>
      </>
    );

    return (
      <span
        key={targetId}
        className={`inline-flex items-center gap-0.5 rounded-md border border-lumen-border bg-lumen-bg px-1.5 py-1 text-xs ${row.deleted ? "text-lumen-text-tertiary" : "text-lumen-text"}`}
      >
        {openTarget ? (
          <button
            type="button"
            title={targetId}
            onClick={() => onNavigateToItem?.(openTarget)}
            aria-label={t("materials.links.open", { title })}
            className="inline-flex min-w-0 items-center gap-1.5 rounded-lumen-sm px-0.5 text-lumen-text hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lumen-accent"
          >
            {body}
          </button>
        ) : (
          <span
            title={targetId}
            className="inline-flex min-w-0 items-center gap-1.5 px-0.5"
          >
            {body}
          </span>
        )}
        <button
          type="button"
          onClick={() => void handleDelete(linkIds)}
          aria-label={t("materials.links.remove", { title })}
          className="shrink-0 rounded-lumen-sm p-0.5 text-lumen-text-secondary hover:text-lumen-danger focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lumen-accent"
        >
          <X size={10} aria-hidden />
        </button>
      </span>
    );
  };

  /** One related row: icon + title, opening the item if it can be opened. */
  const renderRelatedRow = (id: string) => {
    const row = resolveRow(id);
    const role = targetsById.get(id)?.role;
    const Icon = row.deleted ? Trash2 : roleIcon(role);
    const title = rowLabel(row);
    const open = onNavigateToItem && role && !row.deleted ? { id, role } : null;
    const body = (
      <>
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-lumen-sm border border-lumen-border bg-lumen-bg text-lumen-text-secondary">
          <Icon size={12} aria-hidden />
        </span>
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
      className="inline-flex flex-wrap items-center gap-1.5"
    >
      {/* The chips below stay the LINK row — add, read, remove. The related
          pill after them opens everything else this item sits next to. */}
      {loading && <span className="text-xs text-lumen-text-secondary">…</span>}
      {!loading && linked.map(renderChip)}

      {error && (
        // Text variant at the row's own xs size (#1278): this sits inline
        // among the chips, where a band would break the row into two lines.
        <NoticePanel variant="text" size="xs" tone="danger" message={error} />
      )}

      {/* The "+ link" pill mirrors the sibling "+ tag" pill it sits next to:
          same dashed outline, and the word only while there is nothing yet to
          read the row by. */}
      <div ref={pickerRef} className="relative">
        <button
          type="button"
          onClick={() => (pickerOpen ? closePicker() : openPicker())}
          aria-label={t("materials.links.add")}
          aria-expanded={pickerOpen}
          className="inline-flex items-center gap-1 rounded-md border border-dashed border-lumen-border px-2 py-1 text-xs text-lumen-text-secondary hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lumen-accent"
        >
          <Link2 size={12} aria-hidden />
          <Plus size={12} aria-hidden />
          {linked.length === 0 && !loading && (
            <span>{t("materials.links.pickerLabelShort")}</span>
          )}
        </button>

        {pickerOpen && (
          <div
            role="dialog"
            aria-label={t("materials.links.pickerDialog")}
            className="absolute right-0 top-full z-20 mt-1 w-60 max-w-[calc(100vw-2rem)] rounded-lumen-md border border-lumen-border bg-lumen-bg p-2 shadow-lumen-md"
          >
            <input
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
                  const Icon = roleIcon(target.role);
                  return (
                    <button
                      key={target.id}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onMouseEnter={() => setHighlightIndex(index)}
                      onClick={() => void handleAdd(target)}
                      className={[
                        "flex w-full items-center gap-2 rounded-lumen-sm px-1.5 py-1.5 text-left text-xs font-normal",
                        isActive
                          ? "bg-lumen-accent-subtle text-lumen-text"
                          : "text-lumen-text-secondary hover:bg-lumen-hover",
                      ].join(" ")}
                    >
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-lumen-sm border border-lumen-border bg-lumen-bg text-lumen-text-secondary">
                        <Icon size={12} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {target.label}
                      </span>
                      <span className="shrink-0 text-[0.6875rem] text-lumen-text-tertiary">
                        {roleLabels[target.role] ?? target.role}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Related (#1172) — the same pill shape as its two neighbours, carrying
          the count rather than a word, because it is the third control on a row
          that already spells out what it is. */}
      <div ref={relatedRef} className="relative">
        <button
          type="button"
          onClick={() => setRelatedOpen((v) => !v)}
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
            className="absolute right-0 top-full z-20 mt-1 max-h-80 w-60 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lumen-md border border-lumen-border bg-lumen-bg p-2 shadow-lumen-md"
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
