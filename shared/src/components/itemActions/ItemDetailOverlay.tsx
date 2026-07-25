import type { ReactNode } from "react";
import { Modal } from "../Modal";
import { cn } from "../cn";
import type { ItemAction } from "./types";
import { ItemActionRow } from "./ItemActionRow";

/*
 * ItemDetailOverlay (Issue #307) — the generic double-click detail-edit surface
 * for an item. A centered modal frame (reuses <Modal>: portal, opaque panel,
 * backdrop, Escape-to-close, focus trap, body-scroll lock) with a host-provided
 * edit body and an optional footer of secondary `actions` (duplicate / delete /
 * stubs). The domain-specific edit form is passed as `children` — #299 fills it.
 *
 * Not wired into any live surface by #307 — created ready for #299 to adopt.
 *
 * Pure presentation (§3.1/§6.4): `title`, `children` and every action label
 * arrive already translated. lumen-* tokens only.
 *
 * @example
 * <ItemDetailOverlay
 *   open={open}
 *   title={t("editDetail")}
 *   onClose={close}
 *   actions={[{ id: "delete", label: t("delete"), danger: true, onSelect: del }]}
 * >
 *   <EventEditForm ... />
 * </ItemDetailOverlay>
 */

export interface ItemDetailOverlayProps {
  open: boolean;
  /** Already-translated dialog title (rendered by <Modal>). */
  title?: string;
  onClose: () => void;
  /** Host-provided edit form / detail body. */
  children: ReactNode;
  /** Optional footer actions (secondary operations under the form). */
  actions?: ItemAction[];
  /** Already-translated badge shown on stub footer actions (e.g. "soon"). */
  stubBadge?: string;
  /** Extra classes for the Modal panel. */
  className?: string;
}

export function ItemDetailOverlay({
  open,
  title,
  onClose,
  children,
  actions,
  stubBadge,
  className,
}: ItemDetailOverlayProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      className={cn("max-w-lg", className)}
    >
      <div className="flex min-h-0 flex-col gap-4">
        <div className="min-h-0">{children}</div>
        {actions && actions.length > 0 && (
          <div className="-mx-1 flex flex-col border-t border-lumen-border pt-2">
            {actions.map((action) => (
              <ItemActionRow
                key={action.id}
                action={action}
                stubBadge={stubBadge}
                onActivate={(a) => a.onSelect?.()}
              />
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
