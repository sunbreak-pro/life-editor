import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { cn } from "./cn";

const FOCUSABLE =
  'button, [href], input, textarea, select, [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

export type SheetSide = "bottom" | "top" | "left" | "right";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Edge the panel slides in from. Default "bottom" (mobile sheet). */
  side?: SheetSide;
  /** Already-translated accessible title (props-injected i18n, §6). */
  title?: string;
  children: ReactNode;
  /** Extra classes for the sheet panel. */
  className?: string;
  /** Close when the backdrop is clicked. Default true. */
  closeOnBackdrop?: boolean;
}

/*
 * Lumen sheet / drawer (ClaudeDesign catalog: components/sheet.html). The
 * generalized, any-edge counterpart to the mobile-tuned BottomSheet — slides
 * in from bottom / top / left / right, portal-rendered to <body>.
 *
 * §3.5 transparency: the PANEL is opaque (bg-lumen-bg); the BACKDROP uses
 * bg-black/40, the allowed overlay exception. A11y mirrors Modal: role=dialog
 * + aria-modal, Esc-to-close (IME-guarded so a Japanese conversion-cancel
 * never tears the sheet down — §7 gotcha), a Tab focus-trap, first-focusable
 * focused on open, body scroll locked while open, focus restored on close.
 * The bottom variant shows a grab-handle to signal draggability (gesture
 * wiring stays the host's concern). lumen-* tokens only (§3.1).
 */
const BACKDROP_ALIGN: Record<SheetSide, string> = {
  bottom: "items-end justify-center",
  top: "items-start justify-center",
  left: "items-stretch justify-start",
  right: "items-stretch justify-end",
};

const PANEL_CLASSES: Record<SheetSide, string> = {
  bottom:
    "w-full max-w-lg max-h-[85vh] rounded-t-lumen-xl border-t px-5 pb-6 pt-3",
  top: "w-full max-w-lg max-h-[85vh] rounded-b-lumen-xl border-b p-5",
  left: "h-full w-80 max-w-[85vw] rounded-r-lumen-xl border-r p-5",
  right: "h-full w-80 max-w-[85vw] rounded-l-lumen-xl border-l p-5",
};

export function Sheet({
  open,
  onClose,
  side = "bottom",
  title,
  children,
  className,
  closeOnBackdrop = true,
}: SheetProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Esc-to-close (IME-guarded) + Tab focus trap.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
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
      className={cn(
        "fixed inset-0 z-50 flex bg-black/40",
        BACKDROP_ALIGN[side],
      )}
      onMouseDown={closeOnBackdrop ? onClose : undefined}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "flex flex-col overflow-y-auto border-lumen-border bg-lumen-bg shadow-lumen-lg",
          PANEL_CLASSES[side],
          className,
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {side === "bottom" ? (
          <div
            aria-hidden="true"
            className="mx-auto mb-3 h-1.5 w-10 shrink-0 rounded-lumen-full bg-lumen-border"
          />
        ) : null}
        {title ? (
          <h2 className="mb-3 shrink-0 text-base font-semibold text-lumen-text">
            {title}
          </h2>
        ) : null}
        {children}
      </div>
    </div>,
    document.body,
  );
}
