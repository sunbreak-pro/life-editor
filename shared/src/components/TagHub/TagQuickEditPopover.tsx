import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "../Button";
import { cn } from "../cn";
import { ITEM_COLOR_PRESETS } from "../colorPresets";
import { ItemActionPopover } from "../itemActions/ItemActionPopover";
import { CARD_BTN_TAP, FOCUS_RING_TIGHT } from "../styleTokens";
import { isImeComposing } from "../../utils/imeGuard";
import { TagIconPicker } from "./TagIconPicker";
import { type TagHubEditLabels } from "./types";
import {
  useTagEditDrafts,
  type TagEditDraftTarget,
  type TagEditWriters,
} from "./useTagEditDrafts";

/*
 * The small tag editor that opens under a tag chip (#2395, the note header).
 * Name, icon and colour, then 「タグを削除」「タグの画面で開く」 on the left of the
 * footer and 「キャンセル」「保存」 on the right.
 *
 * It rides ItemActionPopover for the portal, the viewport clamp and the Escape +
 * outside-press dismissal. The host works out the point under the tag row and
 * passes it as `position`, so nothing about that placement needed a panel of its
 * own. `hostsDialogs` is what lets the icon picker's Modal, and the host's
 * question before a delete, open on top of it.
 *
 * ONE COMMIT (#715). The drafts are useTagEditDrafts' overlay, and they live and
 * die with this component: closing it any way but 保存 forgets them. The hub keeps
 * drafts in its host because its rail can unmount a row mid-edit. Nothing here
 * unmounts until the panel itself closes.
 *
 * COLOUR is picked from the colours tags already wear, which is what the design
 * asks for. The twelve presets and the free hue stay on the tag screen, one
 * button away. Only when no tag has a colour yet do the presets stand in, because
 * an empty row would leave the first colour impossible to give from here.
 *
 * DELETE is the same contract as TagHubEditBlock and TagActionsMenu: the button
 * only reports the press, and the host asks first. The design had no delete, and
 * こうだいさん asked for one on 2026-11-02. It is off while a save is running,
 * because the two writes would otherwise race over the same tag.
 *
 * It is not TagHubEditBlock. That block's save button is off until something
 * changes and its footer states saved / unsaved, where here 保存 is off only for
 * an empty name.
 *
 * Pure presentation (§6.4): copy and writers are injected, lumen-* tokens only,
 * opaque surface (§5). The swatch hexes are user data, applied inline.
 */

export type TagQuickEditLabels = Pick<
  TagHubEditLabels,
  | "nameLabel"
  | "iconLabel"
  | "colorLabel"
  | "iconMore"
  | "iconCount"
  | "iconClose"
  | "iconClear"
  | "iconSearch"
  | "iconNoMatch"
  | "colorDefault"
  | "deleteTag"
  | "save"
  | "duplicateName"
  | "saveFailed"
> & {
  saving: string;
  cancel: string;
  openInTags: string;
};

export interface TagQuickEditPopoverProps {
  /** The live tag being edited. */
  tag: TagEditDraftTarget;
  /** Every tag: for the duplicate-name check and the colours in use. */
  tags: readonly TagEditDraftTarget[];
  writers: TagEditWriters;
  /** Viewport point for the panel's top-left corner. */
  position: { x: number; y: number };
  /**
   * The chip it opened from, which gets the focus back on close. A press on it
   * does not count as outside: see the effect below.
   */
  anchor: HTMLElement | null;
  /** Already-translated name of the dialog. */
  label: string;
  labels: TagQuickEditLabels;
  onClose: () => void;
  /** Open this tag on the tag screen. Omit and the button is not drawn. */
  onOpenInTags?: (tagId: string) => void;
  /**
   * The delete button was pressed. Omit and the button is not drawn. Nothing is
   * written from here: the host owns the question and the write, and the panel
   * stays up under the question until the host closes it.
   */
  onDelete?: (tagId: string) => void;
}

const WIDTH = 360;
/** The popover's own gap to the viewport edge, on both sides of a phone. */
const VIEWPORT_MARGIN = 16;

const FIELD_LABEL = "text-xs text-lumen-text-secondary";

/** Distinct colours in use, first-seen order, compared case-insensitively. */
function swatchesFrom(tags: readonly TagEditDraftTarget[]): readonly string[] {
  const seen = new Map<string, string>();
  for (const { color } of tags) {
    if (color && !seen.has(color.toLowerCase())) {
      seen.set(color.toLowerCase(), color);
    }
  }
  return seen.size > 0 ? [...seen.values()] : ITEM_COLOR_PRESETS;
}

export function TagQuickEditPopover({
  tag,
  tags,
  writers,
  position,
  anchor,
  label,
  labels,
  onClose,
  onOpenInTags,
  onDelete,
}: TagQuickEditPopoverProps) {
  const drafts = useTagEditDrafts(tags, writers);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement | null>(null);

  const edits = drafts.editsFor(tag.id);
  // Live tag underneath, the user's own edits on top (#628).
  const name = edits.name ?? tag.name;
  const color = edits.color !== undefined ? edits.color : tag.color;
  const icon = edits.icon !== undefined ? edits.icon : tag.icon;
  const canSave = name.trim().length > 0;

  const swatches = useMemo(() => swatchesFrom(tags), [tags]);

  const failure = drafts.errorFor(tag.id);
  const error =
    failure === "duplicate"
      ? labels.duplicateName
      : failure === "failed"
        ? labels.saveFailed
        : null;
  const errorId = `tag-quick-edit-error-${tag.id}`;

  // The focus moves in on open, to the field the panel is mostly opened for.
  useLayoutEffect(() => {
    nameRef.current?.focus({ preventScroll: true });
    nameRef.current?.select();
  }, []);

  /*
   * The focus goes back to the chip on close, with the same two guards the tag
   * picker has (#1841): a focus that has already landed somewhere else is not
   * ours to move, and a detached chip is skipped, because the note may have
   * changed under the panel.
   */
  useEffect(() => {
    return () => {
      const now = document.activeElement;
      if (now && now !== document.body) return;
      if (anchor?.isConnected) anchor.focus();
    };
  }, [anchor]);

  /*
   * A press on the chip is not "outside". The panel opens while the finger is
   * still down on a long press, and a platform that follows the hold with mouse
   * events (the click useLongPress swallows comes with a mousedown) would close
   * it on the lift. Stopped in the capture phase, ahead of the popover's listener
   * on the same node, with the default off so the press does not take the focus
   * out of the name field either.
   */
  useEffect(() => {
    if (!anchor) return;
    const onPress = (e: MouseEvent) => {
      if (!anchor.contains(e.target as Node)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    document.addEventListener("mousedown", onPress, true);
    return () => document.removeEventListener("mousedown", onPress, true);
  }, [anchor]);

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    const ok = await drafts.save(tag.id);
    setSaving(false);
    // Stays open on a refused or failed save, showing why (#1847).
    if (ok) onClose();
  };

  return (
    <ItemActionPopover
      position={position}
      label={label}
      width={Math.min(WIDTH, window.innerWidth - VIEWPORT_MARGIN)}
      onClose={onClose}
      hostsDialogs
      summary={
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={`tag-quick-edit-${tag.id}`} className={FIELD_LABEL}>
              {labels.nameLabel}
            </label>
            <input
              id={`tag-quick-edit-${tag.id}`}
              ref={nameRef}
              value={name}
              onChange={(e) => drafts.edit(tag.id, { name: e.target.value })}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              onKeyDown={(e) => {
                // The Enter that confirms a Japanese conversion must not save.
                if (isImeComposing(e)) return;
                if (e.key === "Enter") {
                  e.preventDefault();
                  void save();
                }
              }}
              className={cn(
                "w-full rounded-lumen-md border border-lumen-border bg-lumen-bg-secondary px-2 py-1 text-sm text-lumen-text",
                "max-md:min-h-11 max-md:text-base",
                FOCUS_RING_TIGHT,
              )}
            />
          </div>

          <div className="flex flex-col gap-1">
            <span className={FIELD_LABEL}>{labels.iconLabel}</span>
            <TagIconPicker
              current={icon}
              color={color}
              onPick={(next) => drafts.edit(tag.id, { icon: next })}
              labels={{
                iconLabel: labels.iconLabel,
                clearIconLabel: labels.iconClear,
                searchLabel: labels.iconSearch,
                noMatchLabel: labels.iconNoMatch,
                moreLabel: labels.iconMore,
                countLabel: labels.iconCount,
                closeLabel: labels.iconClose,
              }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <span className={FIELD_LABEL}>{labels.colorLabel}</span>
            <div
              role="group"
              aria-label={labels.colorLabel}
              className="flex flex-wrap items-center gap-2 p-0.5"
            >
              <button
                type="button"
                aria-pressed={color === null}
                onClick={() => drafts.edit(tag.id, { color: null })}
                className={cn(
                  "rounded-lumen-md border border-lumen-border-strong bg-lumen-bg px-2 py-1 text-xs text-lumen-text-secondary",
                  "transition-colors hover:bg-lumen-hover hover:text-lumen-text",
                  color === null && "ring-2 ring-lumen-text",
                  FOCUS_RING_TIGHT,
                  CARD_BTN_TAP,
                )}
              >
                {labels.colorDefault}
              </button>
              {swatches.map((swatch) => {
                const active = color?.toLowerCase() === swatch.toLowerCase();
                return (
                  <button
                    key={swatch}
                    type="button"
                    aria-label={swatch}
                    aria-pressed={active}
                    title={swatch}
                    onClick={() => drafts.edit(tag.id, { color: swatch })}
                    className={cn(
                      "h-6 w-6 rounded-full max-md:h-11 max-md:w-11",
                      active &&
                        "ring-2 ring-lumen-text ring-offset-2 ring-offset-lumen-bg",
                      FOCUS_RING_TIGHT,
                    )}
                    style={{ backgroundColor: swatch }}
                  />
                );
              })}
            </div>
          </div>

          {error && (
            <p id={errorId} role="alert" className="text-xs text-lumen-danger">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-lumen-border pt-2">
            {(onDelete || onOpenInTags) && (
              <div className="flex flex-wrap items-center gap-2">
                {onDelete && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={(e) => {
                      // WebKit does not focus a button on a click, and the
                      // question reads the focus to know where to return it.
                      // Without this, a "no" would leave it on <body> there.
                      e.currentTarget.focus({ preventScroll: true });
                      onDelete(tag.id);
                    }}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lumen-sm px-1.5 py-1 text-xs font-medium text-lumen-danger",
                      "transition-colors enabled:hover:bg-lumen-danger-subtle",
                      "disabled:cursor-not-allowed disabled:opacity-50",
                      FOCUS_RING_TIGHT,
                      CARD_BTN_TAP,
                    )}
                  >
                    <Trash2 size={14} aria-hidden />
                    {labels.deleteTag}
                  </button>
                )}
                {onOpenInTags && (
                  <button
                    type="button"
                    onClick={() => {
                      // Closed first: the move can be refused by the leave guard,
                      // and the panel must not be left standing over that question.
                      onClose();
                      onOpenInTags(tag.id);
                    }}
                    className={cn(
                      "rounded-lumen-sm px-1 py-1 text-xs font-medium text-lumen-accent hover:underline",
                      FOCUS_RING_TIGHT,
                      CARD_BTN_TAP,
                    )}
                  >
                    {labels.openInTags}
                  </button>
                )}
              </div>
            )}
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className={CARD_BTN_TAP}
                onClick={onClose}
              >
                {labels.cancel}
              </Button>
              <Button
                variant="primary"
                size="sm"
                className={CARD_BTN_TAP}
                disabled={!canSave}
                busy={saving}
                busyLabel={labels.saving}
                onClick={() => void save()}
              >
                {labels.save}
              </Button>
            </div>
          </div>
        </div>
      }
    />
  );
}
