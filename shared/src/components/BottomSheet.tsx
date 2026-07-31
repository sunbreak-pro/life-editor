import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { useDialogA11y } from "../hooks/useDialogA11y";
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
 * §5: sheet PANEL is opaque (bg-lumen-bg); backdrop bg-black/40 is the
 * allowed overlay exception. A grab-handle bar communicates draggability
 * visually (gesture wiring is the host's concern).
 *
 * Keyboard/focus behaviour comes from useDialogA11y, the same hook Modal uses:
 * Escape closes, Tab cycles inside the panel, focus lands inside on open and
 * goes back to the opener on close. The sheet claimed aria-modal from the start
 * but had none of that — every sheet so far happened to hold an input that
 * focused itself, so the gap only surfaced with #470's detail sheet, the first
 * one made of plain rows (#508). Body scroll is deliberately NOT locked: a
 * sheet sits over a list the user is still scrolling behind it.
 *
 * Backdrop dismissal checks that the press LANDED on the backdrop, instead of
 * having the panel stopPropagation its way out (#470). React dispatches portal
 * events from the portal container — document.body — so the panel's
 * stopPropagation also killed the native event before it reached document, and
 * every click-outside popover placed inside a sheet (the TagPicker in the mobile
 * task detail is the first) lost its only way to close.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  className,
  closeOnBackdrop = true,
}: BottomSheetProps) {
  const panelRef = useDialogA11y<HTMLDivElement>({ open, onClose });

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onMouseDown={
        closeOnBackdrop
          ? (e) => {
              if (e.target === e.currentTarget) onClose();
            }
          : undefined
      }
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-label={title}
        className={cn(
          "w-full max-w-lg rounded-t-2xl border-t border-lumen-border",
          "bg-lumen-bg px-5 pb-6 pt-3 shadow-xl",
          className,
        )}
      >
        <div
          aria-hidden="true"
          className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-lumen-border"
        />
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
