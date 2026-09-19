import { useCallback, useMemo, useState } from "react";
import { NO_EDITS, tagRowPatch, type TagRowEdits } from "./tagRowPatch";
import type { TagRowPatchTarget } from "./tagRowPatch";

/*
 * The unsaved drafts behind TagHubEditBlock's save button (#715 / #1643),
 * lifted out of the Connect host (#1676) so any surface that shows the block —
 * the Materials note sidebar is next (#1677) — gets the same one-commit
 * contract instead of re-deriving it.
 *
 * `edits` is keyed by tag id and holds ONLY the fields typed against, as an
 * overlay on the live tag (#628 / tagRowPatch) — so a rename arriving from sync
 * or MCP still reaches a field the user never touched. The drafts are kept for
 * EVERY tag rather than the one open: a host whose list can unmount a row (a
 * filter, a selection change) must not lose a draft by hiding it.
 *
 * No DataService here (§3.1): the host hands in the three writers, which in
 * practice are the WikiTagsUnified context's own methods.
 */

/** The live tag the drafts overlay — an id plus the three editable fields. */
export interface TagEditDraftTarget extends TagRowPatchTarget {
  readonly id: string;
}

/** Where a save goes. `useWikiTagsUnifiedContext()` satisfies it as-is. */
export interface TagEditWriters {
  renameTag: (id: string, name: string) => Promise<unknown>;
  setTagIcon: (id: string, icon: string | null) => Promise<unknown>;
  setTagColor: (id: string, color: string | null) => Promise<unknown>;
}

export interface TagEditDrafts {
  /** One tag's draft, or the stable empty draft. */
  editsFor: (tagId: string) => TagRowEdits;
  /** Whether that draft amounts to something save would write. */
  isDirty: (tagId: string) => boolean;
  /** Merge typed / picked fields into a tag's draft. */
  edit: (tagId: string, patch: TagRowEdits) => void;
  /**
   * Forget one pending field. Dropping the KEY (rather than writing the stored
   * value into it) is what puts the field back under the live tag.
   */
  drop: (tagId: string, field: keyof TagRowEdits) => void;
  /** Throw a tag's whole draft away (discard, or the tag was deleted). */
  discard: (tagId: string) => void;
  /**
   * The only commit (#715). Writes every field of the tag that moved, rename
   * first — the order the editor has always used. The draft is deliberately
   * NOT cleared: it is an overlay, so it stops being pending the moment the
   * write comes back through the cache, and clearing it here would snap the
   * field back to the old name for the length of the round trip.
   */
  save: (tagId: string) => void;
}

export function useTagEditDrafts(
  tags: readonly TagEditDraftTarget[],
  writers: TagEditWriters,
): TagEditDrafts {
  const [edits, setEdits] = useState<Readonly<Record<string, TagRowEdits>>>({});

  // What save would write, per tag. Over ALL tags (see the note above).
  const patchByTag = useMemo(() => {
    const map = new Map<string, TagRowEdits>();
    for (const tag of tags) {
      const patch = tagRowPatch(tag, edits[tag.id]);
      if (Object.keys(patch).length > 0) map.set(tag.id, patch);
    }
    return map;
  }, [tags, edits]);

  const editsFor = useCallback(
    (tagId: string) => edits[tagId] ?? NO_EDITS,
    [edits],
  );

  const isDirty = useCallback(
    (tagId: string) => patchByTag.has(tagId),
    [patchByTag],
  );

  const edit = useCallback((tagId: string, patch: TagRowEdits) => {
    setEdits((prev) => ({ ...prev, [tagId]: { ...prev[tagId], ...patch } }));
  }, []);

  const drop = useCallback((tagId: string, field: keyof TagRowEdits) => {
    setEdits((prev) => {
      const row = prev[tagId];
      if (!row || row[field] === undefined) return prev;
      const next = { ...row };
      delete next[field];
      return { ...prev, [tagId]: next };
    });
  }, []);

  const discard = useCallback((tagId: string) => {
    setEdits((prev) => {
      if (!prev[tagId]) return prev;
      const next = { ...prev };
      delete next[tagId];
      return next;
    });
  }, []);

  const { renameTag, setTagIcon, setTagColor } = writers;
  const save = useCallback(
    (tagId: string) => {
      const patch = patchByTag.get(tagId);
      if (!patch) return;
      if (patch.name !== undefined) void renameTag(tagId, patch.name);
      if (patch.icon !== undefined) void setTagIcon(tagId, patch.icon);
      if (patch.color !== undefined) void setTagColor(tagId, patch.color);
    },
    [patchByTag, renameTag, setTagIcon, setTagColor],
  );

  // One stable object while nothing changed, so a host can list `drafts` as a
  // dependency without rebuilding its callbacks on every render.
  return useMemo(
    () => ({ editsFor, isDirty, edit, drop, discard, save }),
    [editsFor, isDirty, edit, drop, discard, save],
  );
}
