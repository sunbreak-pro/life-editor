import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Tag as TagIcon } from "lucide-react";
import {
  ItemRoleBadge,
  useTranslation,
  useWikiTagsUnifiedContext,
  type WikiTagUnified,
} from "@life-editor/shared";
import { TagPill } from "./TagPill";

/*
 * TagPicker — reusable Tag UI for a single items_meta row (DU-F Step 6).
 *
 * Pattern: lives next to each row / inside the detail panel of the 4
 * roles (task / event / note / daily). The legacy host context (e.g. the
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

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
    }
  };

  const handleUnassign = async (assignmentId: string) => {
    try {
      await wiki.unassignTagFromItem(assignmentId);
    } catch (err) {
      console.error("unassignTagFromItem failed", err);
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
            <TagIcon size={12} aria-hidden />
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
              size={size}
              removeLabel={t("materials.tags.pickerRemove", { name: tag.name })}
              onRemove={() => void handleUnassign(a.id)}
            />
          );
        })}
      <button
        type="button"
        onClick={() => setPickerOpen((v) => !v)}
        aria-label={t("materials.tags.pickerAdd")}
        aria-expanded={pickerOpen}
        className="inline-flex items-center gap-0.5 rounded-md border border-dashed border-lumen-border px-1.5 py-0.5 text-xs text-lumen-text-secondary hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lumen-accent"
      >
        <Plus size={12} aria-hidden />
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
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                if (exactMatch && !assignedTagIds.has(exactMatch.id)) {
                  void handleAssign(exactMatch.id);
                } else if (!exactMatch && query.trim()) {
                  void handleCreateAndAssign();
                }
              } else if (e.key === "Escape") {
                setPickerOpen(false);
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
                  onClick={() => void handleAssign(tag.id)}
                  className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm text-lumen-text hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lumen-accent"
                >
                  {tag.color && (
                    <span
                      aria-hidden
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                  )}
                  <span>{tag.name}</span>
                </button>
              </li>
            ))}
            {query.trim() && !exactMatch && (
              <li>
                <button
                  type="button"
                  onClick={() => void handleCreateAndAssign()}
                  className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm text-lumen-accent hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lumen-accent"
                >
                  <Plus size={12} aria-hidden />
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
