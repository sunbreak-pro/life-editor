import { useCallback } from "react";
import { ArrowLeft, Check, Trash2 } from "lucide-react";
import { Button } from "../Button";
import { ColorPicker } from "../ColorPicker";
import { cn } from "../cn";
import { isImeComposing } from "../../utils/imeGuard";
import { TagIconPicker } from "./TagIconPicker";
import { TaggedItemList } from "./TaggedItemList";
import { type TagRowEdits } from "./tagRowPatch";
import { type TagEditModalLabels, type TagEditRow } from "./types";

interface TagDetailPaneProps {
  tag: TagEditRow;
  /** The selected tag's unsaved edits, overlaid on `tag` for display (#715). */
  edits: TagRowEdits;
  /** Whether those edits amount to something the save button would write. */
  dirty: boolean;
  wide: boolean;
  onBack: () => void;
  onEdit: (tagId: string, patch: TagRowEdits) => void;
  onDropEdit: (tagId: string, field: keyof TagRowEdits) => void;
  onSave: () => void;
  onDelete: (id: string) => void;
  onUnassign?: (assignmentId: string) => void;
  formatCount: (count: number) => string;
  labels: TagEditModalLabels;
}

/*
 * The detail column (#740): everything that edits ONE tag, with the single save
 * button in the footer (#681's arrangement — delete on the left, state text and
 * save on the right) so no control moves as drafts come and go.
 *
 * Before #740 every row of the list carried all six controls — icon, name,
 * save, count, color, delete — squeezed into one line, and the save button
 * appeared only on the row being typed into, which shoved the three controls
 * right of it sideways on every keystroke that started or ended a draft. With
 * one editing surface there is exactly ONE save button, and nothing in the
 * layout depends on whether a draft exists.
 *
 * On narrow this pane REPLACES the list rather than stacking under it, hence
 * the back link at the top: two half-height panes on a phone would make both of
 * them unusable, and side-by-side would need a horizontal scroll.
 */
export function TagDetailPane({
  tag,
  edits,
  dirty,
  wide,
  onBack,
  onEdit,
  onDropEdit,
  onSave,
  onDelete,
  onUnassign,
  formatCount,
  labels,
}: TagDetailPaneProps) {
  // Live tag underneath, the user's own edits on top. An untouched field has no
  // local state at all, so an outside rename (#586: another surface, sync, MCP)
  // simply shows up.
  const name = edits.name ?? tag.name;
  const color = edits.color !== undefined ? edits.color : tag.color;
  const icon = edits.icon !== undefined ? edits.icon : tag.icon;

  // A blank field is not a name (`tagRowPatch` refuses to save one), so leaving
  // it empty would show one thing and mean another. Dropping the edit puts the
  // stored name back on screen, which is what the panel is actually holding.
  const restoreClearedName = useCallback(() => {
    if (edits.name !== undefined && !edits.name.trim())
      onDropEdit(tag.id, "name");
  }, [edits.name, onDropEdit, tag.id]);

  // The membership list is opt-in per tag: a tag without `items` keeps the
  // pre-#409 count-only shape (nothing to list).
  const items = tag.items;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* Narrow only: the list is not on screen, so the editor has to offer the
          way back to it. */}
      {!wide && (
        <div className="flex-shrink-0 border-b border-lumen-border px-3 py-2">
          <button
            type="button"
            onClick={onBack}
            className={cn(
              "flex items-center gap-1.5 rounded-lumen-sm px-1.5 py-1 text-sm font-medium text-lumen-text-secondary",
              "transition-colors hover:bg-lumen-hover hover:text-lumen-text",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
            )}
          >
            <ArrowLeft size={14} aria-hidden />
            {labels.backLabel}
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
        {/* Identity row: icon, name, color — the three fields one save covers. */}
        <div className="flex items-center gap-2">
          <TagIconPicker
            current={icon}
            color={color}
            onPick={(next) => onEdit(tag.id, { icon: next })}
            labels={labels}
          />

          <input
            value={name}
            onChange={(e) => onEdit(tag.id, { name: e.target.value })}
            onBlur={restoreClearedName}
            onKeyDown={(e) => {
              // Never commit mid-IME-composition (§frontend gotcha): the Enter
              // that confirms a Japanese conversion must not save the tag.
              if (isImeComposing(e)) return;
              // Enter saves rather than blurs. Blur no longer commits anything
              // (#715), so "Enter blurs to commit" would have left the key
              // doing nothing visible at all. Escape is not handled here: the
              // dialog layer takes it in the capture phase to close the panel
              // (useDialogA11y), which discards the drafts either way.
              if (e.key === "Enter") {
                e.preventDefault();
                onSave();
              }
            }}
            aria-label={labels.renameLabel}
            className={cn(
              "min-w-0 flex-1 rounded-lumen-md border border-lumen-border bg-lumen-bg px-2.5 py-1.5 text-sm text-lumen-text",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
              // An unsaved field says so on itself, not only through the
              // footer's state text.
              dirty && "border-lumen-accent",
            )}
          />

          <ColorPicker
            current={color ?? undefined}
            label={labels.colorLabel}
            clearLabel={labels.colorClearLabel}
            customLabel={labels.colorCustomLabel}
            onPick={(next) => onEdit(tag.id, { color: next })}
          />
        </div>

        {/* The items carrying this tag (#409). No disclosure any more: the
            editor pane is already about this one tag, so the list that used to
            hide under a count pill is simply the rest of the pane. */}
        {items && (
          <section aria-label={labels.itemsHeading} className="min-w-0">
            <h3 className="mb-1.5 flex items-baseline gap-2 text-xs font-semibold uppercase tracking-wide text-lumen-text-secondary">
              {labels.itemsHeading}
              <span className="text-xs font-medium normal-case tracking-normal tabular-nums text-lumen-text-tertiary">
                {formatCount(tag.count)}
              </span>
            </h3>
            <TaggedItemList
              items={items}
              onUnassign={onUnassign}
              labels={labels}
            />
          </section>
        )}
      </div>

      {/* Footer (#740, #681's arrangement). Both controls are always here and
          always in the same place; only the save button's enabled state moves,
          with the reason spelled out beside it so "why can I not press this"
          has an answer on screen rather than only in the button's opacity
          (#434 S-1). */}
      <div className="flex flex-shrink-0 items-center justify-between gap-3 border-t border-lumen-border px-5 py-3">
        <button
          type="button"
          onClick={() => onDelete(tag.id)}
          aria-label={labels.deleteLabel}
          className={cn(
            "flex items-center gap-1.5 rounded-lumen-sm px-1.5 py-1 text-sm font-medium text-lumen-danger",
            "transition-colors hover:bg-lumen-danger-subtle",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
          )}
        >
          <Trash2 size={14} aria-hidden />
          {labels.deleteLabel}
        </button>

        <div className="flex items-center gap-3">
          <span
            aria-live="polite"
            className={cn(
              "text-xs",
              dirty ? "text-lumen-accent" : "text-lumen-text-secondary",
            )}
          >
            {dirty ? labels.unsavedLabel : labels.savedLabel}
          </span>
          <Button
            variant="primary"
            size="sm"
            leadingIcon={<Check size={13} aria-hidden />}
            onClick={onSave}
            disabled={!dirty}
          >
            {labels.saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
