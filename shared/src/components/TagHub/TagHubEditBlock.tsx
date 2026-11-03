import { useEffect, useRef } from "react";
import { Check, Trash2 } from "lucide-react";
import { Button } from "../Button";
import { cn } from "../cn";
import { ITEM_COLOR_PRESETS } from "../colorPresets";
import { CARD_BTN_TAP, FOCUS_RING_TIGHT } from "../styleTokens";
import { isImeComposing } from "../../utils/imeGuard";
import { TagIconPicker } from "./TagIconPicker";
import { type TagRowEdits } from "./tagRowPatch";
import { type TagHubEditLabels, type TagHubTagSummary } from "./types";

/*
 * The hub's tag editor (#1643 / D7) — everything that changes ONE tag's
 * identity, inline above its items.
 *
 * It is the tag edit modal's detail pane, moved. That modal listed the same
 * tags the hub's rail lists, in deliberately the same row shape, and was the
 * only one of the two that could edit them (D-20260912-main-1 Q1-A). Folding it
 * in means the list you read a topic from is the list you fix it in, and there
 * is one tag master again instead of two views that have to be kept looking
 * alike.
 *
 * ONE COMMIT (#715, kept verbatim). Typing a name, picking a colour and picking
 * an icon are DRAFTS; nothing reaches the host until the save button is
 * pressed. Blur writes nothing. A wiki tag is referenced from every item
 * carrying it, so a rename that fires because the user tabbed out of a field is
 * a change to all of them.
 *
 * The drafts live in the HOST, not here (ConnectScreen). The rail's filter
 * unmounts the rows it hides and selecting another tag unmounts this block, so
 * a draft held at this level would be thrown away by typing in the search box —
 * silently, which is the exact loss the save button exists to prevent.
 *
 * Pure presentation: copy injected (§6.4), lumen-* tokens only, opaque surface
 * (§5). The swatch hexes are user DATA (colorPresets.ts), applied inline — the
 * no-hardcoded-colour rule is about theme chrome.
 */

/*
 * Phone layout (#2499). The rows are not one height: the icon strip and the
 * swatch grid are taller than a line of text, and `items-center` parked each
 * label halfway down its row instead of beside the row's first line. On narrow
 * the grid aligns to the top and every label is given the height of its
 * control's FIRST line (the name field's 44px floor, the 48px icon strip, one
 * 44px swatch row), so the label sits level with what it names.
 *
 * Desktop keeps `items-center` and its painted sizes — every change here is a
 * `max-md:` class.
 */
const NARROW_LABEL = "max-md:flex max-md:items-center";

export interface TagHubEditBlockProps {
  /** The live tag being edited (the rail's own row, counts and all). */
  tag: TagHubTagSummary;
  /** Its unsaved edits, overlaid on `tag` for display (#715). */
  edits: TagRowEdits;
  /** Whether those edits amount to something the save button would write. */
  dirty: boolean;
  /**
   * Put the caret in the name field (selected) when the block appears — the
   * menu's "Edit tag" asks for it. Consumed once by the host, which clears it
   * after the first edit — see the effect below.
   */
  focusName?: boolean;
  onEdit: (patch: TagRowEdits) => void;
  onDropEdit: (field: keyof TagRowEdits) => void;
  onSave: () => void;
  onDelete: () => void;
  /**
   * Why the last save did not land, already translated (#1847) — shown under
   * the fields and tied to the name input. A 409 on a duplicate name used to
   * leave only "Unsaved" behind, with no reason.
   */
  error?: string | null;
  labels: TagHubEditLabels;
}

export function TagHubEditBlock({
  tag,
  edits,
  dirty,
  focusName = false,
  onEdit,
  onDropEdit,
  onSave,
  onDelete,
  labels,
  error = null,
}: TagHubEditBlockProps) {
  const errorId = `taghub-edit-error-${tag.id}`;
  // Live tag underneath, the user's own edits on top. An untouched field has no
  // local state at all, so an outside rename (#586: another surface, sync, MCP)
  // simply shows up.
  const name = edits.name ?? tag.name;
  const color = edits.color !== undefined ? edits.color : tag.color;
  const icon = edits.icon !== undefined ? edits.icon : tag.icon;

  /*
   * "Edit tag" in the row menu lands the caret in the name field (#1886).
   * Keyed on the tag too: picking it on another tag has to move focus again,
   * and the block is not remounted between them.
   */
  const nameRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (!focusName) return;
    nameRef.current?.focus();
    nameRef.current?.select();
  }, [focusName, tag.id]);

  // A blank field is not a name (`tagRowPatch` refuses to save one), so leaving
  // it empty would show one thing and mean another. Dropping the edit puts the
  // stored name back on screen, which is what the block is actually holding.
  const restoreClearedName = () => {
    if (edits.name !== undefined && !edits.name.trim()) onDropEdit("name");
  };

  return (
    <div
      className={cn(
        "flex flex-shrink-0 flex-col gap-3.5 rounded-lumen-md border border-lumen-border-strong",
        "bg-lumen-bg-secondary p-4",
      )}
    >
      <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3 text-sm text-lumen-text-secondary max-md:items-start">
        <>
          <label
            htmlFor={`taghub-name-${tag.id}`}
            className={cn(NARROW_LABEL, "max-md:min-h-11")}
          >
            {labels.nameLabel}
          </label>
          <input
            id={`taghub-name-${tag.id}`}
            ref={nameRef}
            value={name}
            onChange={(e) => onEdit({ name: e.target.value })}
            onBlur={restoreClearedName}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onKeyDown={(e) => {
              // Never commit mid-IME-composition (§frontend gotcha): the Enter
              // that confirms a Japanese conversion must not save the tag.
              if (isImeComposing(e)) return;
              // Enter saves rather than blurs. Blur commits nothing (#715), so
              // "Enter blurs to commit" would leave the key doing nothing.
              if (e.key === "Enter") {
                e.preventDefault();
                onSave();
              }
            }}
            className={cn(
              "min-w-0 rounded-lumen-md border border-lumen-border bg-lumen-bg px-2.5 py-1.5 text-sm text-lumen-text",
              // 44px on a phone (#1561); height only, so the row is no wider.
              "max-md:min-h-11",
              FOCUS_RING_TIGHT,
              // An unsaved field says so on itself, not only through the
              // footer's state text.
              dirty && "border-lumen-accent",
            )}
          />
        </>

        <>
          {/* The strip TagIconPicker draws first is 48px tall on narrow. */}
          <span className={cn(NARROW_LABEL, "max-md:min-h-12")}>
            {labels.iconLabel}
          </span>
          <div className="flex items-center gap-2">
            <TagIconPicker
              current={icon}
              color={color}
              onPick={(next) => onEdit({ icon: next })}
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
        </>

        <>
          <span className={cn(NARROW_LABEL, "max-md:min-h-11")}>
            {labels.colorLabel}
          </span>
          {/*
           * The swatches are laid out INLINE rather than behind the shared
           * ColorPicker's trigger (D7): the block is already the disclosure — you
           * opened it to change this tag — so a second one would put the twelve
           * colours two clicks away from the pencil that exists to reach them.
           */}
          <div className="flex flex-wrap items-center gap-4 max-md:items-start">
            {/*
             * On narrow each swatch is a 44px button around the same 24px dot
             * (#2499): the dot stays the size it is, the hit area reaches the
             * touch floor. Six 44px cells are wider than the sheet's field
             * column at 390px, so the grid drops to four columns and closes
             * its gap — the cells' own padding is the gap between the dots.
             */}
            <div
              role="group"
              aria-label={labels.colorLabel}
              className="grid grid-cols-6 gap-2 max-md:grid-cols-4 max-md:gap-0"
            >
              {ITEM_COLOR_PRESETS.map((preset) => {
                const active = color?.toLowerCase() === preset.toLowerCase();
                return (
                  <button
                    key={preset}
                    type="button"
                    aria-label={preset}
                    aria-pressed={active}
                    title={preset}
                    onClick={() => onEdit({ color: preset })}
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full",
                      "max-md:h-11 max-md:w-11",
                      FOCUS_RING_TIGHT,
                    )}
                  >
                    <span
                      aria-hidden
                      data-swatch-dot=""
                      className={cn(
                        "h-6 w-6 shrink-0 rounded-full",
                        active &&
                          "ring-2 ring-lumen-text ring-offset-2 ring-offset-lumen-bg-secondary",
                      )}
                      style={{ backgroundColor: preset }}
                    />
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => onEdit({ color: null })}
                className={cn(
                  "rounded-lumen-md border border-lumen-border-strong bg-lumen-bg px-2.5 py-1 text-xs text-lumen-text-secondary",
                  "transition-colors hover:bg-lumen-hover hover:text-lumen-text",
                  FOCUS_RING_TIGHT,
                  CARD_BTN_TAP,
                )}
              >
                {labels.colorDefault}
              </button>
              {/* The free-form hue. A <label> wrapping the native input, so the
                whole pill is the hit area and the swatch the browser paints
                stays out of the row's rhythm. */}
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded-lumen-md border border-lumen-border-strong bg-lumen-bg",
                  "px-2.5 py-1 text-xs text-lumen-text-secondary",
                  "transition-colors hover:bg-lumen-hover hover:text-lumen-text",
                  CARD_BTN_TAP,
                )}
              >
                <input
                  type="color"
                  value={color ?? ITEM_COLOR_PRESETS[0]}
                  onChange={(e) => onEdit({ color: e.target.value })}
                  aria-label={labels.colorCustom}
                  className="h-3.5 w-3.5 shrink-0 cursor-pointer rounded border border-lumen-border bg-transparent p-0"
                />
                {labels.colorCustom}
              </label>
            </div>
          </div>
        </>
      </div>

      {error && (
        <p id={errorId} role="alert" className="text-xs text-lumen-danger">
          {error}
        </p>
      )}

      {/* Footer (#681's arrangement, kept): delete on the left, state text and
          save on the right, both always in the same place — only the save
          button's enabled state moves, with the reason spelled out beside it. */}
      <div className="flex items-center justify-between gap-3 border-t border-lumen-border pt-3">
        <button
          type="button"
          onClick={onDelete}
          className={cn(
            "flex items-center gap-1.5 rounded-lumen-sm px-1.5 py-1 text-sm font-medium text-lumen-danger",
            "transition-colors hover:bg-lumen-danger-subtle",
            FOCUS_RING_TIGHT,
            CARD_BTN_TAP,
          )}
        >
          <Trash2 size={14} aria-hidden />
          {labels.deleteTag}
        </button>

        <div className="flex items-center gap-3">
          <span
            aria-live="polite"
            className={cn(
              "flex items-center gap-1.5 text-xs",
              dirty ? "text-lumen-text-secondary" : "text-lumen-text-tertiary",
            )}
          >
            {dirty && (
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full bg-lumen-warning"
              />
            )}
            {dirty ? labels.unsaved : labels.saved}
          </span>
          <Button
            variant="primary"
            size="sm"
            className={CARD_BTN_TAP}
            leadingIcon={<Check size={13} aria-hidden />}
            onClick={onSave}
            disabled={!dirty}
          >
            {labels.save}
          </Button>
        </div>
      </div>
    </div>
  );
}
