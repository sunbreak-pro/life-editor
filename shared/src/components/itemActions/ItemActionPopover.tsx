import { useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Pencil } from "lucide-react";
import type { ItemAction } from "./types";
import { ItemActionRow } from "./ItemActionRow";
import { clampToViewport, useFloatingDismiss } from "./floating";

/*
 * ItemActionPopover (Issue #307) — the generic single-click bubble for an item.
 * A fixed-positioned portal at the click point (viewport-clamped, Escape +
 * outside-mousedown close) showing: a host-rendered `summary` (title + meta),
 * a declarative list of quick `actions`, and a primary "edit detail" button
 * that hands off to the detail overlay.
 *
 * Intended consumer: Schedule #299 (single-click summary + "詳細を編集"). Not
 * wired into any live surface by #307 — created ready for #299 to adopt.
 *
 * Pure presentation (§3.1/§6.4): no DataService, no useTranslation; `summary`
 * and every label arrive already translated. lumen-* tokens only; opaque (§5).
 *
 * @example
 * <ItemActionPopover
 *   position={{ x, y }}
 *   summary={<><p className="font-semibold">{item.title}</p><p>{when}</p></>}
 *   actions={[{ id: "duplicate", label: t("duplicate"), onSelect: dup }]}
 *   onEditDetail={openOverlay}
 *   editDetailLabel={t("editDetail")}
 *   onClose={close}
 * />
 */

const DEFAULT_WIDTH = 248;
const EDGE_GAP = 8;
const EST_HEIGHT = 220;

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
  useFloatingDismiss(panelRef, onClose);

  const { top, left } = clampToViewport(position, width, EST_HEIGHT, EDGE_GAP);

  const activate = (action: ItemAction) => {
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
    </div>,
    document.body,
  );
}
