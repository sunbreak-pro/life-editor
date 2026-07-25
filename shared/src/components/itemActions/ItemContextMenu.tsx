import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ItemAction } from "./types";
import { ItemActionRow } from "./ItemActionRow";
import { clampToViewport, useFloatingDismiss } from "./floating";

/*
 * ItemContextMenu (Issue #307) — the generic right-click menu for any item /
 * element / surface. A fixed-positioned portal to <body> (z above the grid +
 * rightSidebar), Escape + outside-mousedown close, and viewport-edge clamping
 * so it never spills off screen.
 *
 * Actions are declarative (`ItemAction[]`): each row can be a plain select, a
 * danger action, a disabled/stub placeholder (rendered with a "soon" badge via
 * `stubBadge`), or an inline-input action (e.g. rename — selecting it swaps the
 * whole menu for a seeded text input; Enter commits, Escape cancels, IME-safe).
 *
 * Pure presentation (§3.1/§6.4): no DataService, no useTranslation. All copy
 * arrives already translated via the action `label`s. lumen-* tokens only; the
 * surface is opaque (§5). Desktop-first (mobile long-press is out of scope).
 *
 * @example
 * <ItemContextMenu
 *   position={{ x, y }}
 *   stubBadge={t("common.soon")}
 *   actions={[
 *     { id: "rename", label: t("rename"), icon: <Pencil />,
 *       inlineInput: { value: title, ariaLabel: t("rename"), onCommit: rename } },
 *     { id: "duplicate", label: t("duplicate"), icon: <CopyPlus />, onSelect: dup },
 *     { id: "delete", label: t("delete"), icon: <Trash2 />, danger: true, onSelect: del },
 *     { id: "pin", label: t("pin"), icon: <Pin />, stub: true },
 *   ]}
 *   onClose={close}
 * />
 */

const DEFAULT_WIDTH = 190;
const EDGE_GAP = 8;
const EST_ROW = 30;
const EST_INPUT = 96;

export interface ItemContextMenuProps {
  /** Anchor point in viewport coordinates (from the contextmenu event). */
  position: { x: number; y: number };
  actions: ItemAction[];
  onClose: () => void;
  /** Already-translated a11y label for the menu. */
  label?: string;
  /** Already-translated badge shown on stub rows (e.g. "soon"). */
  stubBadge?: string;
  /** Menu width in px (default 190). */
  width?: number;
}

export function ItemContextMenu({
  position,
  actions,
  onClose,
  label,
  stubBadge,
  width = DEFAULT_WIDTH,
}: ItemContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inlineId, setInlineId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  useFloatingDismiss(menuRef, onClose);

  const inlineAction =
    inlineId != null
      ? (actions.find((a) => a.id === inlineId && a.inlineInput) ?? null)
      : null;

  // Focus + select the input when entering inline mode.
  useLayoutEffect(() => {
    if (inlineAction) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [inlineAction]);

  const estHeight = inlineAction
    ? EST_INPUT
    : Math.max(EST_ROW, actions.length * EST_ROW + EDGE_GAP);
  const { top, left } = clampToViewport(position, width, estHeight, EDGE_GAP);

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
      ref={menuRef}
      role="menu"
      aria-label={label}
      className="fixed z-[60] overflow-hidden rounded-lumen-md border border-lumen-border bg-lumen-bg py-1 shadow-lumen-lg"
      style={{ top, left, width }}
    >
      {inlineAction?.inlineInput ? (
        <div className="px-2 py-1">
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
            className="w-full rounded-lumen-md border border-lumen-border bg-lumen-bg px-2 py-1 text-xs text-lumen-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
          />
        </div>
      ) : (
        actions.map((action) => (
          <ItemActionRow
            key={action.id}
            action={action}
            stubBadge={stubBadge}
            onActivate={activate}
          />
        ))
      )}
    </div>,
    document.body,
  );
}
