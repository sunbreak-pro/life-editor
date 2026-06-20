import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { cn } from "./cn";

const FOCUSABLE =
  'button, [href], input, textarea, select, [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

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
 *
 * A11y/UX (shared by every Modal consumer): Esc closes (IME-guarded so a
 * Japanese conversion-cancel never tears the dialog down — §frontend gotcha),
 * Tab is trapped inside the panel, the first focusable is focused on open,
 * body scroll is locked while open, and focus is restored to the trigger on
 * close.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  className,
  closeOnBackdrop = true,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Esc-to-close (IME-guarded) + Tab focus trap.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // Never intervene mid-composition (Japanese IME) — §frontend gotcha.
      // Esc here would cancel an IME conversion, not close the dialog.
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  // Body scroll lock + focus management while open.
  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    });
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = prevOverflow;
      restoreFocusRef.current?.focus?.();
    };
  }, [open]);

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
        aria-label={title}
        className={cn(
          "w-full max-w-md rounded-lg border border-notion-border",
          "bg-notion-bg p-5 shadow-notion-lg",
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
