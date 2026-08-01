import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { useDialogA11y } from "../hooks/useDialogA11y";
import { cn } from "./cn";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Already-translated accessible title (props-injected i18n, §6.4). */
  title?: string;
  /** id of a heading inside `children` that names the dialog — for consumers
      that render their own layout instead of the default `title` heading. */
  labelledBy?: string;
  children: ReactNode;
  /** Extra classes for the dialog panel. */
  className?: string;
  /** Close when the backdrop is clicked. Default true. */
  closeOnBackdrop?: boolean;
}

/*
 * Centered modal dialog rendered through a portal to <body>.
 *
 * §5 transparency policy: the dialog PANEL is opaque (bg-lumen-bg); the
 * BACKDROP uses bg-black/40, which is an allowed exception (overlay layer
 * for focus). role="dialog" + aria-modal + Escape-to-close for a11y.
 *
 * A11y/UX (shared by every Modal consumer): Esc closes (IME-guarded so a
 * Japanese conversion-cancel never tears the dialog down — §frontend gotcha),
 * Tab is trapped inside the panel, the first focusable is focused on open,
 * body scroll is locked while open, and focus is restored to the trigger on
 * close. All of that now lives in useDialogA11y, shared with BottomSheet —
 * which declared aria-modal without any of it until #508.
 */
export function Modal({
  open,
  onClose,
  title,
  labelledBy,
  children,
  className,
  closeOnBackdrop = true,
}: ModalProps) {
  const panelRef = useDialogA11y<HTMLDivElement>({
    open,
    onClose,
    lockScroll: true,
  });

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={closeOnBackdrop ? onClose : undefined}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-label={labelledBy ? undefined : title}
        aria-labelledby={labelledBy}
        className={cn(
          "w-full max-w-md rounded-lg border border-lumen-border",
          "bg-lumen-bg p-5 shadow-lumen-lg",
          className,
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {title ? (
          <h2 className="mb-3 text-base font-semibold text-lumen-text">
            {title}
          </h2>
        ) : null}
        {children}
      </div>
    </div>,
    document.body,
  );
}
