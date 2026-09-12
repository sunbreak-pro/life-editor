import { useMemo } from "react";
import {
  ColorPicker,
  pickDisplayAssignment,
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
 *
 * #1580 added the radio in front of each row: with the Schedule drawing items
 * in their tag's colour, an item wearing two coloured tags needs to say which
 * one speaks for it. That choice is the ONLY thing the item stores — the
 * colours themselves stay on the tags, exactly as above — and it lives here
 * rather than on a surface of its own because this is already the place a
 * reader comes to ask "what colour is this, and why".
 *
 * The radio is rendered even for a single tag, and deliberately: with one row
 * it is the sentence "this tag is what colours this item", which is the fact a
 * reader of a one-tag item is missing. Hiding it until a second tag appears
 * would make the control show up the first time it is least expected.
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

  /*
   * Which row is checked — the explicit pick when there is one, and otherwise
   * the earliest-assigned tag, which is what the Schedule is ALREADY drawing.
   * Showing nothing checked until someone picks would be accurate about the
   * stored value and wrong about the screen.
   */
  const displayId = useMemo(
    () => pickDisplayAssignment(assignments, itemId)?.id ?? null,
    [assignments, itemId],
  );

  if (wiki.loading) return null;

  // #572: an empty return left "change this item's color" undiscoverable —
  // the color lives on the TAG (see header note), so the route is to attach a
  // tag first. Say so instead of rendering nothing.
  if (assignments.length === 0) {
    return (
      <p className="text-xs text-lumen-text-secondary">
        {t("itemActions.tagColorEmpty")}
      </p>
    );
  }

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="sr-only">{t("itemActions.displayColorLegend")}</legend>
      {assignments.map((a) => {
        const tag = tagsById.get(a.tagId);
        if (!tag) return null;
        return (
          <div key={a.id} className="flex items-center gap-2">
            <input
              type="radio"
              // One group per ITEM, so two of these panels open at once (the
              // Schedule's todo detail and its event editor) cannot end up
              // sharing a selection.
              name={`display-color-${itemId}`}
              checked={displayId === a.id}
              aria-label={t("itemActions.displayColorPick", {
                name: tag.name,
              })}
              onChange={() => {
                void wiki.setDisplayColorTag(itemId, tag.id).catch((err) => {
                  console.error("setDisplayColorTag failed", err);
                });
              }}
              className="size-4 shrink-0 accent-lumen-accent"
            />
            <span className="min-w-0 flex-1 truncate text-xs text-lumen-text">
              {tag.name}
            </span>
            <ColorPicker
              current={tag.color ?? undefined}
              label={t("itemActions.tagColor", { name: tag.name })}
              // #1388: these two used to borrow the retired Kanban board's
              // keys. They now live beside this component's other labels in
              // `itemActions.*`, with the same strings.
              clearLabel={t("itemActions.tagColorClearLabel")}
              customLabel={t("itemActions.tagColorCustomLabel")}
              onPick={(color) => {
                void wiki.setTagColor(tag.id, color).catch((err) => {
                  console.error("setTagColor failed", err);
                });
              }}
            />
          </div>
        );
      })}
      {/* Says why a row is already checked on an item nobody has picked for. */}
      <p className="text-[0.6875rem] text-lumen-text-tertiary">
        {t("itemActions.displayColorDefaultHint")}
      </p>
    </fieldset>
  );
}
