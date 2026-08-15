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
  Plus,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  balanceByRole,
  isImeComposing,
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
 *     icon + count treatment of <BacklinkView> in Connect.
 *   - TITLES RESOLVE CROSS-ROLE. `resolveTitle` only knows the host's own
 *     domain (Notes), so a Note→Todo link rendered as an id fragment. The
 *     candidate pool doubles as the title source for every role it carries;
 *     the id fragment is now only the last resort.
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
}

/** Keep the popover compact — the pool is balanced across roles, not sliced. */
const MAX_CANDIDATES = 8;

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
}: LinkPanelProps) {
  const wiki = useWikiTagsUnifiedContext();
  const { t } = useTranslation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [targets, setTargets] = useState<LinkPanelTarget[]>([]);
  const [error, setError] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);
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
        !linkedIds.has(target.id) &&
        (q ? target.label.toLowerCase().includes(q) : true),
    );
    // balanceByRole, not slice: the pool is concatenated per role, so a plain
    // cut would hand all 8 slots to notes and never surface a todo (#370).
    return balanceByRole(pool, MAX_CANDIDATES);
  }, [targets, itemId, linkedIds, query]);

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

  const itemTitle = (id: string): string => {
    const fromResolver = resolveTitle?.(id);
    if (fromResolver) return fromResolver;
    const fromPool = targetsById.get(id)?.label;
    if (fromPool) return fromPool;
    // Last resort: shorten the id — the full one stays in the row's title
    // attribute, so a link that outlives its target is still identifiable.
    return id.length > 12 ? `…${id.slice(-8)}` : id;
  };

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
    const role = targetsById.get(targetId)?.role;
    const Icon = roleIcon(role);
    const title = itemTitle(targetId);
    // A chip opens only when BOTH halves are known: the host has a navigator,
    // and the pool told us the target's role (the route keys off it). An id
    // whose item is gone from the pool stays a plain, honest label.
    const openTarget = onNavigateToItem && role ? { id: targetId, role } : null;

    const body = (
      <>
        <Icon size={12} aria-hidden className="shrink-0" />
        <span className="max-w-[12rem] truncate text-left">{title}</span>
      </>
    );

    return (
      <span
        key={targetId}
        className="inline-flex items-center gap-0.5 rounded-md border border-lumen-border bg-lumen-bg px-1.5 py-1 text-xs text-lumen-text"
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

  const listboxId = `link-picker-${itemId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

  return (
    <div
      role="group"
      aria-label={t("materials.links.panelLabel")}
      className="inline-flex flex-wrap items-center gap-1.5"
    >
      {loading && <span className="text-xs text-lumen-text-secondary">…</span>}
      {!loading && linked.map(renderChip)}

      {error && (
        <span role="alert" className="text-xs text-lumen-danger">
          {error}
        </span>
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
    </div>
  );
}
