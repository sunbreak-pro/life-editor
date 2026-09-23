import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Tag as TagIcon } from "lucide-react";
import {
  isImeComposing,
  ItemRoleBadge,
  TagHeadingIcon,
  TagPill,
  TAP_TARGET,
  useToastOptional,
  useEscapeLayer,
  useTranslation,
  useWikiTagsUnifiedContext,
  type WikiTagUnified,
} from "@life-editor/shared";

/*
 * TagPicker — reusable Tag UI for a single items_meta row (DU-F Step 6).
 *
 * Pattern: lives next to each row / inside the detail panel of the 4
 * roles (todo / event / note / daily). The legacy host context (e.g. the
 * host note context) is untouched — only the Tag layer talks to
 * WikiTagsUnifiedContext. itemId is `items_meta.id` for any role (id
 * 不変式 — see plan §採用アーキテクチャ).
 *
 * State strategy: assignments come from the Context's bulk-loaded
 * `getTagsForItem(itemId)` selector — one `wiki_tag_assignments` query
 * feeds every row, so a list of N rows no longer issues N fetches
 * (the former per-item `listTagsForItem` effect is gone). Mutations go
 * through the Context mutators, which keep the bulk cache in sync, so the
 * pills here update reactively.
 *
 * UI: pill list + Plus button. The picker dropdown shows existing tags
 * filtered by query + "Create new" affordance when the query has no
 * exact match.
 *
 * Kind cue (#412): with `itemRole`, the row's leading element is the shared
 * <ItemRoleBadge> — the SAME contract the tag editor's item list renders from
 * (shared components/items/itemRole), so the tag-side and item-side views of
 * the same assignment cannot drift into two visual languages. It REPLACES the
 * generic "Tags" caption rather than sitting next to it: the row's own
 * contents (colored pills + the "+ Tag" affordance) already say "tags"; what
 * the row could not say was WHICH KIND of thing it is tagging, which is what
 * matters once Phase 2 puts this same row on events / dailies / notes.
 * Callers that pass no `itemRole` keep the generic caption unchanged.
 *
 * Failures (#1667): a write that throws raises an error toast. Logging alone
 * left the picker looking as if nothing had been clicked.
 */
interface TagPickerProps {
  itemId: string;
  /** Show a leading caption before the pills (detail-panel only). */
  showLabel?: boolean;
  /**
   * Raw `items_meta.role` of the item being tagged. When set (and showLabel),
   * the caption becomes the shared kind badge. Unknown values are safe — they
   * render the badge's neutral fallback.
   */
  itemRole?: string;
  size?: "sm" | "md";
}

export function TagPicker({
  itemId,
  showLabel = false,
  itemRole,
  size = "sm",
}: TagPickerProps) {
  const wiki = useWikiTagsUnifiedContext();
  const { t } = useTranslation();
  const toast = useToastOptional();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  // The "+ Tag" button, so the picker can hand the focus back to it (#1841).
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  // Assignments for this row come from the Context's bulk cache (one
  // query for the whole list, bucketed by itemId). `loading` follows the
  // Context's initial bulk load.
  const assignments = wiki.getTagsForItem(itemId);
  const loading = wiki.loading;

  // Close picker on click-outside (keeps the picker self-contained — no
  // global click listener registry).
  useEffect(() => {
    if (!pickerOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [pickerOpen]);

  /*
   * Escape closes the picker and stops there (#1952).
   *
   * The handler used to sit on the search field alone, so it had two holes.
   * With the focus on a candidate row Escape did nothing at all. Inside the
   * Schedule detail modal it never reached the field in the first place: the
   * modal listens on `document` in the capture phase and closed itself, picker
   * and all. Joining the dialog layer stack makes the topmost surface the only
   * one Escape reaches, wherever the focus is inside it, so the first press
   * closes the picker and the second closes the modal. Same fix as the tag icon
   * picker (#1342). The hook carries the IME guard, so the Escape that cancels
   * a conversion in the search field reaches neither surface.
   */
  const closePicker = useCallback(() => setPickerOpen(false), []);
  useEscapeLayer({ open: pickerOpen, onEscape: closePicker });

  /*
   * Hand the focus back when the picker closes (#1841).
   *
   * Escape used to leave `document.activeElement` on <body>, so the next Tab
   * restarted from the top of the page and the row the user was tagging was
   * gone from under them. Same cleanup CommandPalette runs (#1874), and the
   * same two guards:
   *
   *   - a focus that has already landed somewhere else is not ours to move.
   *     Clicking outside the picker to close it means the user is looking at
   *     whatever they clicked.
   *   - a detached trigger is skipped. Focusing one does nothing, in silence,
   *     and this picker is drawn inside menus that unmount with it.
   *
   * CommandPalette's other half -- reading the opener during render, because
   * autoFocus may take it first -- is not needed here: the opener is this
   * component's own button and nothing else can claim it.
   */
  useEffect(() => {
    if (!pickerOpen) return;
    return () => {
      const now = document.activeElement;
      if (now && now !== document.body) return;
      if (triggerRef.current?.isConnected) triggerRef.current.focus();
    };
  }, [pickerOpen]);

  const roleLabels = useMemo(
    () => ({
      task: t("itemRole.task"),
      event: t("itemRole.event"),
      note: t("itemRole.note"),
      daily: t("itemRole.daily"),
      unknown: t("itemRole.unknown"),
    }),
    [t],
  );

  const tagsById = useMemo(() => {
    const map = new Map<string, WikiTagUnified>();
    for (const t of wiki.allTags) map.set(t.id, t);
    return map;
  }, [wiki.allTags]);

  const assignedTagIds = useMemo(
    () => new Set(assignments.map((a) => a.tagId)),
    [assignments],
  );

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return wiki.allTags
      .filter((t) => !assignedTagIds.has(t.id))
      .filter((t) => (q ? t.name.toLowerCase().includes(q) : true))
      .slice(0, 8);
  }, [wiki.allTags, assignedTagIds, query]);

  const exactMatch = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return wiki.allTags.find((t) => t.name.toLowerCase() === q) ?? null;
  }, [wiki.allTags, query]);

  const handleAssign = async (tagId: string) => {
    try {
      // The Context mutator updates the bulk cache, so the pills here
      // re-render without a local copy.
      await wiki.assignTagToItem(itemId, tagId);
      setQuery("");
    } catch (err) {
      console.error("assignTagToItem failed", err);
      toast?.showToast("danger", t("materials.tags.assignFailed"));
    }
  };

  const handleUnassign = async (assignmentId: string) => {
    try {
      await wiki.unassignTagFromItem(assignmentId);
    } catch (err) {
      console.error("unassignTagFromItem failed", err);
      toast?.showToast("danger", t("materials.tags.unassignFailed"));
    }
  };

  const handleCreateAndAssign = async () => {
    const name = query.trim();
    if (!name) return;
    try {
      const tag = await wiki.createTag(name, null);
      await handleAssign(tag.id);
    } catch (err) {
      console.error("createTag failed", err);
      toast?.showToast("danger", t("materials.tags.createFailed"));
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative inline-flex flex-wrap items-center gap-1"
    >
      {showLabel &&
        (itemRole ? (
          <ItemRoleBadge role={itemRole} labels={roleLabels} />
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-lumen-text-secondary">
            <TagIcon size={14} aria-hidden />
            {t("materials.tags.pickerLabel")}
          </span>
        ))}
      {loading && <span className="text-xs text-lumen-text-secondary">…</span>}
      {!loading &&
        assignments.map((a) => {
          const tag = tagsById.get(a.tagId);
          if (!tag) return null;
          return (
            <TagPill
              key={a.id}
              name={tag.name}
              color={tag.color}
              icon={tag.icon}
              size={size}
              removeLabel={t("materials.tags.pickerRemove", { name: tag.name })}
              onRemove={() => void handleUnassign(a.id)}
            />
          );
        })}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setPickerOpen((v) => !v)}
        aria-label={t("materials.tags.pickerAdd")}
        aria-expanded={pickerOpen}
        // TAP_TARGET is 1.75rem, which is 31.5px — the app's icon floor, not
        // a thumb's (#1840). The narrow-width floor is added here rather than
        // to TAP_TARGET itself, which every icon button in the app shares.
        className={`${TAP_TARGET} max-md:min-h-11 max-md:min-w-11 gap-1 rounded-md border border-dashed border-lumen-border px-2 py-1 text-xs text-lumen-text-secondary hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lumen-accent`}
      >
        <Plus size={14} aria-hidden />
        {assignments.length === 0 && !loading && (
          <span>{t("materials.tags.pickerLabelShort")}</span>
        )}
      </button>

      {pickerOpen && (
        <div
          role="dialog"
          aria-label={t("materials.tags.pickerDialog")}
          className="absolute z-20 left-0 top-full mt-1 w-64 max-w-[calc(100vw-2rem)] rounded-md border border-lumen-border bg-lumen-bg p-2 shadow-lg"
        >
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isImeComposing(e)) {
                e.preventDefault();
                if (exactMatch && !assignedTagIds.has(exactMatch.id)) {
                  void handleAssign(exactMatch.id);
                } else if (!exactMatch && query.trim()) {
                  void handleCreateAndAssign();
                }
              }
            }}
            placeholder={t("materials.tags.pickerSearch")}
            className="w-full rounded-md border border-lumen-border bg-lumen-bg-secondary px-2 py-1 text-sm text-lumen-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lumen-accent"
          />
          <ul className="mt-2 max-h-48 space-y-0.5 overflow-y-auto">
            {candidates.length === 0 && !query.trim() && (
              <li className="px-2 py-1 text-xs text-lumen-text-secondary">
                {t("materials.tags.pickerNoCandidates")}
              </li>
            )}
            {candidates.map((tag) => (
              <li key={tag.id}>
                <button
                  type="button"
                  // Keep the focus in the field (#1841). Assigning a tag drops
                  // it out of the candidate list, so the row the pointer just
                  // pressed unmounts -- and a browser that had moved the focus
                  // onto it drops that focus to <body>, where Escape no longer
                  // closes anything. Same guard TimeRangeField's list uses.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void handleAssign(tag.id)}
                  className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm text-lumen-text hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lumen-accent"
                >
                  {/* The same glyph the chip above will draw once this tag is
                      assigned, so the candidate and the result are recognisably
                      the same tag (#1291). It replaces the colour dot, which
                      only appeared for tags that had a colour. */}
                  <TagHeadingIcon icon={tag.icon} color={tag.color} size={14} />
                  <span>{tag.name}</span>
                </button>
              </li>
            ))}
            {query.trim() && !exactMatch && (
              <li>
                <button
                  type="button"
                  // The row the issue was filed about: creating clears the
                  // query, which is the condition that draws this row at all,
                  // so it unmounts under the pointer. Same guard, same reason.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void handleCreateAndAssign()}
                  className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm text-lumen-accent hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lumen-accent"
                >
                  <Plus size={14} aria-hidden />
                  <span>
                    {t("materials.tags.pickerCreate", { name: query.trim() })}
                  </span>
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
