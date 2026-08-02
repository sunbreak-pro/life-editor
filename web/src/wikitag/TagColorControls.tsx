import { useMemo } from "react";
import {
  ColorPicker,
  useTranslation,
  useWikiTagsUnifiedContext,
  type WikiTagUnified,
} from "@life-editor/shared";

/*
 * TagColorControls (#551) — per-assigned-tag color editing for one items_meta
 * row. Sits under the <TagPicker> in a detail surface: one shared
 * <ColorPicker> per tag the row carries, labelled with the tag's name, writing
 * through the Context's setTagColor.
 *
 * The color belongs to the TAG, not the item — an item shows color only
 * through its tags — so a change here repaints every surface that renders the
 * tag (pills, Kanban tag columns, the calendar lens chips). Same pattern as
 * TagPicker: assignments come from the Context's bulk cache, mutations go
 * through the Context so those pills update reactively.
 */
export function TagColorControls({ itemId }: { itemId: string }) {
  const wiki = useWikiTagsUnifiedContext();
  const { t } = useTranslation();

  const assignments = wiki.getTagsForItem(itemId);
  const tagsById = useMemo(() => {
    const map = new Map<string, WikiTagUnified>();
    for (const tag of wiki.allTags) map.set(tag.id, tag);
    return map;
  }, [wiki.allTags]);

  if (wiki.loading || assignments.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {assignments.map((a) => {
        const tag = tagsById.get(a.tagId);
        if (!tag) return null;
        return (
          <ColorPicker
            key={a.id}
            current={tag.color ?? undefined}
            label={t("itemActions.tagColor", { name: tag.name })}
            // Same copy as the Kanban color control — one key per fact.
            clearLabel={t("kanban.colorClearLabel")}
            customLabel={t("kanban.colorCustomLabel")}
            onPick={(color) => {
              void wiki.setTagColor(tag.id, color).catch((err) => {
                console.error("setTagColor failed", err);
              });
            }}
          />
        );
      })}
    </div>
  );
}
