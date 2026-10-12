import { useMemo } from "react";
import {
  cn,
  pickDisplayAssignment,
  useTranslation,
  useWikiTagsUnifiedContext,
  type WikiTagUnified,
} from "@life-editor/shared";

/*
 * TagColorControls (#551) — which of an item's tags gives it its colour.
 * Sits beside the <TagPicker> in a detail surface (the Schedule's event
 * editor and, since #2219, its todo detail too).
 *
 * The color belongs to the TAG, not the item — an item shows color only
 * through its tags (migration 0030). #1580 added the choice this part is now
 * made of: with the Schedule drawing items in their tag's colour, an item
 * wearing two coloured tags needs to say which one speaks for it. That choice
 * is the ONLY thing the item stores (`wiki_tag_assignments.is_display_color`).
 *
 * #2219 took the per-tag colour picker out. Changing a tag's colour here
 * repainted every item wearing that tag, from a panel that reads as editing
 * one item — so the tag's own colour is edited on the Connect screen's tag
 * editor alone. What is left is the choice, drawn as the tag labels: the one
 * the colour comes from wears that colour as its border and a small square,
 * and a line above says it in words ("shown in the colour of 「仕事」").
 *
 * A choice is shown even for a single tag, and deliberately: with one tag it
 * is the sentence "this tag is what colours this item", which is the fact a
 * reader of a one-tag item is missing.
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
   * Which tag is chosen — the explicit pick when there is one, and otherwise
   * the earliest-assigned tag, which is what the Schedule is ALREADY drawing.
   * Showing nothing chosen until someone picks would be accurate about the
   * stored value and wrong about the screen.
   */
  const display = useMemo(
    () => pickDisplayAssignment(assignments, itemId),
    [assignments, itemId],
  );

  if (wiki.loading) return null;

  // No tag, no tag colour: the item is drawn in the standard colour.
  if (assignments.length === 0) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-lumen-text-secondary">
        <span
          aria-hidden
          className="size-3 shrink-0 rounded-sm border border-lumen-schedule-event-border bg-lumen-schedule-event-bg"
        />
        {t("itemActions.displayColorNone")}
      </p>
    );
  }

  const displayTag = display ? tagsById.get(display.tagId) : undefined;
  const swatch = (color: string | null | undefined) =>
    color ? { backgroundColor: color } : undefined;

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="sr-only">{t("itemActions.displayColorLegend")}</legend>
      {displayTag && (
        <p
          data-display-color-line=""
          className="flex items-center gap-1.5 text-xs text-lumen-text"
        >
          <span
            aria-hidden
            style={swatch(displayTag.color)}
            className={cn(
              "size-3 shrink-0 rounded-sm border border-lumen-border",
              !displayTag.color && "bg-lumen-schedule-event-bg",
            )}
          />
          {t("itemActions.displayColorFrom", { name: displayTag.name })}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        {assignments.map((a) => {
          const tag = tagsById.get(a.tagId);
          if (!tag) return null;
          const chosen = display?.id === a.id;
          return (
            <label
              key={a.id}
              data-display-color-chip={chosen ? "chosen" : ""}
              // The chosen tag wears its own colour as the border. A tag with
              // no colour keeps the plain border either way.
              style={
                chosen && tag.color ? { borderColor: tag.color } : undefined
              }
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-lumen-md border px-2 py-0.5 text-xs text-lumen-text transition-colors hover:bg-lumen-hover has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-lumen-accent",
                chosen ? "border-2" : "border-lumen-border",
              )}
            >
              <input
                type="radio"
                // One group per ITEM, so two of these panels open at once (the
                // Schedule's todo detail and its event editor) cannot end up
                // sharing a selection.
                name={`display-color-${itemId}`}
                checked={chosen}
                aria-label={t("itemActions.displayColorPick", {
                  name: tag.name,
                })}
                onChange={() => {
                  void wiki.setDisplayColorTag(itemId, tag.id).catch((err) => {
                    console.error("setDisplayColorTag failed", err);
                  });
                }}
                className="sr-only"
              />
              {chosen && (
                <span
                  aria-hidden
                  style={swatch(tag.color)}
                  className={cn(
                    "size-2 shrink-0 rounded-[2px]",
                    !tag.color && "bg-lumen-text-secondary",
                  )}
                />
              )}
              {tag.name}
            </label>
          );
        })}
      </div>
      {/* Says why a tag is already chosen on an item nobody has picked for. */}
      <p className="text-[0.6875rem] text-lumen-text-tertiary">
        {t("itemActions.displayColorDefaultHint")}
      </p>
    </fieldset>
  );
}
