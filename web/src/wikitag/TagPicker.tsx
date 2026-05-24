import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Tag as TagIcon } from "lucide-react";
import {
  useWikiTagsUnifiedContext,
  type WikiTagUnified,
  type WikiTagAssignmentUnified,
} from "@life-editor/shared";
import { TagPill } from "./TagPill";

/*
 * TagPicker — reusable Tag UI for a single items_meta row (DU-F Step 6).
 *
 * Pattern: lives next to each row / inside the detail panel of the 4
 * roles (task / event / note / daily). The legacy host context (e.g.
 * NoteContext) is untouched — only the Tag layer talks to
 * WikiTagsUnifiedContext. itemId is `items_meta.id` for any role (id
 * 不変式 — see plan §採用アーキテクチャ).
 *
 * State strategy: local cache of assignments + optimistic mutations. The
 * shared hook only exposes the tag master cache (`allTags`) — per-item
 * assignments are loaded on demand. A bulk pre-load would be cleaner but
 * is out of DU-F scope (each row's pill list is small; this is the
 * N=1-friendly MVP).
 *
 * UI: pill list + Plus button. The picker dropdown shows existing tags
 * filtered by query + "Create new" affordance when the query has no
 * exact match.
 */
interface TagPickerProps {
  itemId: string;
  /** Show a small "Tags" label before pills (detail-panel only). */
  showLabel?: boolean;
  size?: "sm" | "md";
}

export function TagPicker({
  itemId,
  showLabel = false,
  size = "sm",
}: TagPickerProps) {
  const wiki = useWikiTagsUnifiedContext();
  const [assignments, setAssignments] = useState<WikiTagAssignmentUnified[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Load assignments for this item on mount + when allTags identity flips
  // (a Sync round bumps it). Empty cleanup is fine — fetch races on
  // itemId change resolve via React strict mode's double-invoke.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    wiki
      .listTagsForItem(itemId)
      .then((rows) => {
        if (!cancelled) setAssignments(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Re-fetch when the item flips OR when the tag master changes (a
    // Sync round bumps `allTags`). `listTagsForItem` is a stable
    // useCallback so it never re-triggers on its own.
  }, [itemId, wiki.allTags, wiki.listTagsForItem]);

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
      const created = await wiki.assignTagToItem(itemId, tagId);
      setAssignments((prev) => [...prev, created]);
      setQuery("");
    } catch (err) {
      console.error("assignTagToItem failed", err);
    }
  };

  const handleUnassign = async (assignmentId: string) => {
    try {
      await wiki.unassignTagFromItem(assignmentId);
      setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
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
      {showLabel && (
        <span className="inline-flex items-center gap-1 text-xs text-notion-text-secondary">
          <TagIcon size={12} aria-hidden />
          Tags
        </span>
      )}
      {loading && <span className="text-xs text-notion-text-secondary">…</span>}
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
              onRemove={() => void handleUnassign(a.id)}
            />
          );
        })}
      <button
        type="button"
        onClick={() => setPickerOpen((v) => !v)}
        aria-label="Add tag"
        aria-expanded={pickerOpen}
        className="inline-flex items-center gap-0.5 rounded-md border border-dashed border-notion-border px-1.5 py-0.5 text-xs text-notion-text-secondary hover:bg-notion-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-notion-accent"
      >
        <Plus size={12} aria-hidden />
        {assignments.length === 0 && !loading && <span>Tag</span>}
      </button>

      {pickerOpen && (
        <div
          role="dialog"
          aria-label="Tag picker"
          className="absolute z-20 left-0 top-full mt-1 w-64 rounded-md border border-notion-border bg-notion-bg p-2 shadow-lg"
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
            placeholder="Search or create tag…"
            className="w-full rounded-md border border-notion-border bg-notion-bg-secondary px-2 py-1 text-sm text-notion-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-notion-accent"
          />
          <ul className="mt-2 max-h-48 space-y-0.5 overflow-y-auto">
            {candidates.length === 0 && !query.trim() && (
              <li className="px-2 py-1 text-xs text-notion-text-secondary">
                No more tags to assign.
              </li>
            )}
            {candidates.map((tag) => (
              <li key={tag.id}>
                <button
                  type="button"
                  onClick={() => void handleAssign(tag.id)}
                  className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm text-notion-text hover:bg-notion-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-notion-accent"
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
                  className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm text-notion-accent hover:bg-notion-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-notion-accent"
                >
                  <Plus size={12} aria-hidden />
                  <span>Create &ldquo;{query.trim()}&rdquo;</span>
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
