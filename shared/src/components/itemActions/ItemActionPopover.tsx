import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Pencil } from "lucide-react";
import type { ItemAction } from "./types";
import { ItemActionRow } from "./ItemActionRow";
import { clampToViewport, useFloatingDismiss } from "./floating";

/*
 * ItemActionPopover (Issue #307) — the generic click bubble for an item.
 * A fixed-positioned portal at the click point (viewport-clamped, Escape +
 * outside-mousedown close) showing: a host-rendered `summary` (title + meta),
 * a declarative list of quick `actions`, and a primary "edit detail" button
 * that hands off to the detail overlay.
 *
 * Consumer: Schedule (#299 single-click summary + "詳細を編集"; #551 unified
 * it with the right-click path and retired the separate ItemContextMenu, so
 * the inline-input swap that menu owned lives here now: selecting an action
 * with `inlineInput` (e.g. rename) replaces the action list with a seeded
 * text input — Enter commits, Escape cancels, IME-safe. The edit-detail
 * button hides while the input is up so Enter has exactly one meaning.
 *
 * Pure presentation (§3.1/§6.4): no DataService, no useTranslation; `summary`
 * and every label arrive already translated. lumen-* tokens only; opaque (§5).
 *
 * @example
 * <ItemActionPopover
 *   position={{ x, y }}
 *   summary={<><p className="font-semibold">{item.title}</p><p>{when}</p></>}
 *   actions={[
 *     { id: "rename", label: t("rename"),
 *       inlineInput: { value: title, ariaLabel: t("rename"), onCommit: rename } },
 *     { id: "duplicate", label: t("duplicate"), onSelect: dup },
 *   ]}
 *   onEditDetail={openOverlay}
 *   editDetailLabel={t("editDetail")}
 *   onClose={close}
 * />
 */

const DEFAULT_WIDTH = 248;
const EDGE_GAP = 8;
const EST_HEIGHT = 220;
// The inline input replaces the action list AND the edit-detail button, so
// the panel is much shorter — clamping with the full estimate would push it
// needlessly far up from the bottom edge.
const EST_HEIGHT_INLINE = 120;

export interface ItemActionPopoverProps {
  /** Anchor point in viewport coordinates (from the click event). */
  position: { x: number; y: number };
  /** Host-rendered summary block (title + meta). Already-translated content. */
  summary: ReactNode;
  actions?: ItemAction[];
  /** Primary hand-off to the detail overlay. */
  onEditDetail?: () => void;
  /** Already-translated label for the edit-detail button. */
  editDetailLabel?: string;
  onClose: () => void;
  /** Already-translated a11y label for the popover. */
  label?: string;
  /** Already-translated badge shown on stub rows (e.g. "soon"). */
  stubBadge?: string;
  /** Popover width in px (default 248). */
  width?: number;
}

export function ItemActionPopover({
  position,
  summary,
  actions,
  onEditDetail,
  editDetailLabel,
  onClose,
  label,
  stubBadge,
  width = DEFAULT_WIDTH,
}: ItemActionPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inlineId, setInlineId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  useFloatingDismiss(panelRef, onClose);

  const inlineAction =
    inlineId != null
      ? (actions?.find((a) => a.id === inlineId && a.inlineInput) ?? null)
      : null;

  // Focus + select the input when entering inline mode. Keyed on the id, not
  // the action object: hosts rebuild `actions` every render (CalendarTab
  // re-renders on its 1-minute now ticker), and re-selecting the text mid-type
  // would let the next keystroke wipe the draft.
  useLayoutEffect(() => {
    if (inlineId != null) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [inlineId]);

  const { top, left } = clampToViewport(
    position,
    width,
    inlineAction ? EST_HEIGHT_INLINE : EST_HEIGHT,
    EDGE_GAP,
  );

  const commitInline = () => {
    if (!inlineAction?.inlineInput) return;
    const trimmed = draft.trim();
    if (trimmed) inlineAction.inlineInput.onCommit(trimmed);
    onClose();
  };

  const activate = (action: ItemAction) => {
    if (action.inlineInput) {
      setDraft(action.inlineInput.value);
      setInlineId(action.id);
      return;
    }
    action.onSelect?.();
    onClose();
  };

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={label}
      className="fixed z-[60] overflow-hidden rounded-lumen-md border border-lumen-border bg-lumen-bg py-1 shadow-lumen-lg"
      style={{ top, left, width }}
    >
      <div className="px-3 py-2 text-xs text-lumen-text">{summary}</div>

      {inlineAction?.inlineInput ? (
        <div className="border-t border-lumen-border px-2 py-2">
          <input
            ref={inputRef}
            value={draft}
            placeholder={inlineAction.inlineInput.placeholder}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === "Enter") {
                e.preventDefault();
                // Stop the document-level Escape/close listener from also
                // reacting to this same native event.
                e.stopPropagation();
                commitInline();
              } else if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }
            }}
            aria-label={inlineAction.inlineInput.ariaLabel}
            // bg-secondary, not bg: same-color + thin border reads as no
            // input at all (#552's conclusion on this exact pairing).
            className="w-full rounded-lumen-md border border-lumen-border bg-lumen-bg-secondary px-2 py-1 text-xs text-lumen-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
          />
        </div>
      ) : (
        <>
          {actions && actions.length > 0 && (
            <div className="border-t border-lumen-border py-1">
              {actions.map((action) => (
                <ItemActionRow
                  key={action.id}
                  action={action}
                  stubBadge={stubBadge}
                  onActivate={activate}
                />
              ))}
            </div>
          )}

          {onEditDetail && (
            <div className="border-t border-lumen-border p-2">
              <button
                type="button"
                onClick={() => {
                  onEditDetail();
                  onClose();
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-lumen-md bg-lumen-accent px-3 py-1.5 text-xs font-medium text-lumen-on-accent transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
              >
                <Pencil aria-hidden className="size-3.5 shrink-0" />
                {editDetailLabel}
              </button>
            </div>
          )}
        </>
      )}
    </div>,
    document.body,
  );
}
