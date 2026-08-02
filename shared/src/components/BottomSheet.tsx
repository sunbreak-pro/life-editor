import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { useDialogA11y, DIALOG_AUTOFOCUS_SKIP } from "../hooks/useDialogA11y";
import { cn } from "./cn";
import { FOCUS_RING_TIGHT } from "./styleTokens";

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  /** Already-translated accessible title (props-injected i18n, §6.4). */
  title?: string;
  /**
   * Already-translated name for the close button (§6.4). Required, not
   * optional: the button itself is unconditional (#525), so an optional label
   * would leave "a sheet whose only exit no screen reader can announce" as the
   * one broken sheet the types still allow.
   */
  closeLabel: string;
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
 * Every sheet carries a close button (#525). The tall detail sheets (#470 /
 * #471 run 70–92vh) had only two exits, and on a phone neither one works: the
 * backdrop is down to 8vh of target at full height, and Escape needs a physical
 * keyboard. The handle above LOOKS like the third exit but is aria-hidden
 * decoration with no drag wired to it. Hence a real button, unconditional
 * rather than opt-in — a sheet with no way out should not be constructible.
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
  closeLabel,
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
        {/*
         * Header row: title (when given) and the always-present close button.
         * The row renders even without a title so no sheet can exist without a
         * visible exit — the whole point of #525.
         *
         * The button carries a 44px touch target (mobile-scope floor) but pulls
         * it back into the panel's own padding with negative margins, so the
         * row keeps the ~24px height every sheet had before and no header
         * shifts. `truncate` on the heading is what keeps a long title from
         * running under the button.
         */}
        <div className="mb-3 flex min-h-6 items-center justify-between gap-2">
          {title ? (
            <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-lumen-text">
              {title}
            </h2>
          ) : (
            <span className="flex-1" />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            {...DIALOG_AUTOFOCUS_SKIP}
            className={cn(
              "-my-2.5 -mr-2 grid size-11 shrink-0 place-items-center rounded-full",
              "text-lumen-text-secondary transition-colors",
              "hover:bg-lumen-hover hover:text-lumen-text",
              FOCUS_RING_TIGHT,
            )}
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
