import { useCallback, useMemo, useRef } from "react";
import {
  useToastOptional,
  useTranslation,
  useWikiTagsUnifiedContext,
  type ItemCreateTagPool,
} from "@life-editor/shared";

/*
 * useCreatePanelTags (#2220) — the tag half of the creation panel, host side.
 *
 * The panel only STAGES tags (`pools.tags`); they are written here, once the
 * row they go on exists — `wiki_tag_assignments` carries an FK to
 * `items_meta`, the same ordering the staged note follows (useCreatePanelNotes'
 * header). The create flow takes the staged set at the press, synchronously,
 * and applies it from the create's `onSaved` / companion.
 *
 * The staged set is the WHOLE set the item should end up with, not a list of
 * additions: picking an existing todo seeds the field with the tags it already
 * wears, and the user may take some of them off. `applyTags` therefore writes
 * the difference against what the item carries now.
 *
 * No undo entry of its own, like the goal links staged beside it: undoing the
 * create trashes the item, and a trashed item drops out of every tag view.
 */

export interface CreatePanelTagsApi {
  /** For `pools.tags`. */
  tagPool: ItemCreateTagPool;
  /** The staged set, taken (and cleared) at the press; null = no field. */
  takeStagedTags: () => string[] | null;
  /** Make `itemId` carry exactly `tagIds`. Call once its row exists. */
  applyTags: (itemId: string, tagIds: readonly string[]) => void;
}

export function useCreatePanelTags(): CreatePanelTagsApi {
  const { t } = useTranslation();
  const toast = useToastOptional();
  const wiki = useWikiTagsUnifiedContext();
  const { allTags, getTagsForItem, assignTagToItem, unassignTagFromItem } =
    wiki;
  // A ref, not state: read once, at the press, and nothing on screen depends
  // on the host's copy — the panel draws its own.
  const stagedRef = useRef<string[] | null>(null);

  const onStagedChange = useCallback((ids: string[]) => {
    stagedRef.current = ids;
  }, []);

  const tagsOf = useCallback(
    (itemId: string) => getTagsForItem(itemId).map((a) => a.tagId),
    [getTagsForItem],
  );

  const tagPool = useMemo<ItemCreateTagPool>(
    () => ({
      tags: allTags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
      })),
      tagsOf,
      onStagedChange,
      labels: {
        field: t("scheduleScreen.createTagField"),
        add: t("scheduleScreen.createTagAdd"),
        remove: (name: string) => t("scheduleScreen.createTagRemove", { name }),
        empty: t("scheduleScreen.createTagEmpty"),
      },
    }),
    [allTags, tagsOf, onStagedChange, t],
  );

  const takeStagedTags = useCallback(() => {
    const staged = stagedRef.current;
    stagedRef.current = null;
    return staged;
  }, []);

  const applyTags = useCallback(
    (itemId: string, tagIds: readonly string[]) => {
      const current = getTagsForItem(itemId);
      const has = new Set(current.map((a) => a.tagId));
      const want = new Set(tagIds);
      const writes = [
        ...tagIds
          .filter((id) => !has.has(id))
          .map((id) => assignTagToItem(itemId, id)),
        ...current
          .filter((a) => !want.has(a.tagId))
          .map((a) => unassignTagFromItem(a.id)),
      ];
      if (writes.length === 0) return;
      void Promise.all(writes).catch((e: unknown) => {
        console.error("[Schedule] applying the staged tags failed", e);
        // The panel has closed by now, so a toast is the only way the user
        // learns the item is missing a tag they picked.
        toast?.showToast("danger", t("materials.tags.assignFailed"));
      });
    },
    [getTagsForItem, assignTagToItem, unassignTagFromItem, toast, t],
  );

  return { tagPool, takeStagedTags, applyTags };
}
