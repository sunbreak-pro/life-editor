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

/**
 * Why the last save of a tag did not land (#1847): the new name is already
 * another tag's (caught before sending — the unique constraint would refuse it
 * with a 409), or a write came back failed. Cleared by the next edit.
 */
export type TagEditError = "duplicate" | "failed";

/** The live tag the drafts overlay — an id plus the three editable fields. */
export interface TagEditDraftTarget extends TagRowPatchTarget {
  readonly id: string;
}

/** Where a save goes. `useWikiTagsUnifiedContext()` satisfies it as-is. */
export interface TagEditWriters {
  setTagName: (id: string, name: string) => Promise<unknown>;
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
  /** Why the tag's last save did not land, or null (#1847). */
  errorFor: (tagId: string) => TagEditError | null;
  /**
   * The only commit (#715). Writes every field of the tag that moved, rename
   * first — the order the editor has always used. The draft is deliberately
   * NOT cleared: it is an overlay, so it stops being pending the moment the
   * write comes back through the cache, and clearing it here would snap the
   * field back to the old name for the length of the round trip.
   *
   * Resolves true once every write landed, false when the save was refused or
   * failed (#1847) — `errorFor` then says which, and the draft stays so the
   * user's typing is not lost. A name another tag already has (compared
   * trimmed and case-insensitively, as the tag chooser does) is refused before
   * anything is sent.
   */
  save: (tagId: string) => Promise<boolean>;
}

export function useTagEditDrafts(
  tags: readonly TagEditDraftTarget[],
  writers: TagEditWriters,
): TagEditDrafts {
  const [edits, setEdits] = useState<Readonly<Record<string, TagRowEdits>>>({});
  const [errors, setErrors] = useState<Readonly<Record<string, TagEditError>>>(
    {},
  );

  const setError = useCallback((tagId: string, error: TagEditError | null) => {
    setErrors((prev) => {
      if ((prev[tagId] ?? null) === error) return prev;
      const next = { ...prev };
      if (error) next[tagId] = error;
      else delete next[tagId];
      return next;
    });
  }, []);

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

  const errorFor = useCallback(
    (tagId: string) => errors[tagId] ?? null,
    [errors],
  );

  // Any change to the draft answers the error it was showing.
  const edit = useCallback(
    (tagId: string, patch: TagRowEdits) => {
      setEdits((prev) => ({ ...prev, [tagId]: { ...prev[tagId], ...patch } }));
      setError(tagId, null);
    },
    [setError],
  );

  const drop = useCallback(
    (tagId: string, field: keyof TagRowEdits) => {
      setError(tagId, null);
      setEdits((prev) => {
        const row = prev[tagId];
        if (!row || row[field] === undefined) return prev;
        const next = { ...row };
        delete next[field];
        return { ...prev, [tagId]: next };
      });
    },
    [setError],
  );

  const discard = useCallback(
    (tagId: string) => {
      setError(tagId, null);
      setEdits((prev) => {
        if (!prev[tagId]) return prev;
        const next = { ...prev };
        delete next[tagId];
        return next;
      });
    },
    [setError],
  );

  const { setTagName, setTagIcon, setTagColor } = writers;
  const save = useCallback(
    async (tagId: string): Promise<boolean> => {
      const patch = patchByTag.get(tagId);
      if (!patch) return true;
      if (patch.name !== undefined) {
        const needle = patch.name.trim().toLowerCase();
        const taken = tags.some(
          (tag) => tag.id !== tagId && tag.name.trim().toLowerCase() === needle,
        );
        if (taken) {
          setError(tagId, "duplicate");
          return false;
        }
      }
      setError(tagId, null);
      // Started in the editor's order (rename first), awaited together.
      const writes: Promise<unknown>[] = [];
      if (patch.name !== undefined) writes.push(setTagName(tagId, patch.name));
      if (patch.icon !== undefined) writes.push(setTagIcon(tagId, patch.icon));
      if (patch.color !== undefined)
        writes.push(setTagColor(tagId, patch.color));
      try {
        await Promise.all(writes);
        return true;
      } catch {
        setError(tagId, "failed");
        return false;
      }
    },
    [patchByTag, tags, setTagName, setTagIcon, setTagColor, setError],
  );

  // One stable object while nothing changed, so a host can list `drafts` as a
  // dependency without rebuilding its callbacks on every render.
  return useMemo(
    () => ({ editsFor, isDirty, edit, drop, discard, errorFor, save }),
    [editsFor, isDirty, edit, drop, discard, errorFor, save],
  );
}
