import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { cn } from "./cn";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Already-translated accessible title (props-injected i18n, §6.4). */
  title?: string;
  children: ReactNode;
  /** Extra classes for the dialog panel. */
  className?: string;
  /** Close when the backdrop is clicked. Default true. */
  closeOnBackdrop?: boolean;
}

/*
 * Centered modal dialog rendered through a portal to <body>.
 *
 * §5 transparency policy: the dialog PANEL is opaque (bg-notion-bg); the
 * BACKDROP uses bg-black/40, which is an allowed exception (overlay layer
 * for focus). role="dialog" + aria-modal + Escape-to-close for a11y.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  className,
  closeOnBackdrop = true,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={closeOnBackdrop ? onClose : undefined}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "w-full max-w-md rounded-lg border border-notion-border",
          "bg-notion-bg p-5 shadow-xl",
          className,
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {title ? (
          <h2 className="mb-3 text-base font-semibold text-notion-text">
            {title}
          </h2>
        ) : null}
        {children}
      </div>
    </div>,
    document.body,
  );
}
