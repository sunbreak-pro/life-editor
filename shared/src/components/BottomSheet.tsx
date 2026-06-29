import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { cn } from "./cn";

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  /** Already-translated accessible title (props-injected i18n, §6.4). */
  title?: string;
  children: ReactNode;
  className?: string;
  closeOnBackdrop?: boolean;
}

/*
 * Mobile-style bottom sheet — the tap-friendly counterpart to Modal for
 * the 2-layer model's "complex screen / Mobile split" path. Slides up
 * from the bottom edge, portal-rendered to <body>.
 *
 * §5: sheet PANEL is opaque (bg-ink-bg); backdrop bg-black/40 is the
 * allowed overlay exception. A grab-handle bar communicates draggability
 * visually (gesture wiring is the host's concern). Escape closes for a11y
 * / desktop testing.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  className,
  closeOnBackdrop = true,
}: BottomSheetProps) {
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onMouseDown={closeOnBackdrop ? onClose : undefined}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "w-full max-w-lg rounded-t-2xl border-t border-ink-border",
          "bg-ink-bg px-5 pb-6 pt-3 shadow-xl",
          className,
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          aria-hidden="true"
          className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-ink-border"
        />
        {title ? (
          <h2 className="mb-3 text-base font-semibold text-ink-text">
            {title}
          </h2>
        ) : null}
        {children}
      </div>
    </div>,
    document.body,
  );
}
