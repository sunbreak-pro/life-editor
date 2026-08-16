import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { ArrowLeft, X } from "lucide-react";
import { useDialogA11y, DIALOG_AUTOFOCUS_SKIP } from "../hooks/useDialogA11y";
import { useSwipeToDismiss } from "../hooks/useSwipeToDismiss";
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
  /**
   * Inert under `fullScreen`: the panel covers the scrim, so no press can land
   * on it. The exit that still works there is the header button.
   */
  closeOnBackdrop?: boolean;
  /**
   * Cover the whole screen instead of rising part-way up it (#874).
   *
   * A partial sheet leaves the shell visible behind its backdrop, and the shell
   * MOVES: focus an input, the soft keyboard opens, the bottom tab bar stands
   * down (#608) and everything above it re-flows upward. The user reads that as
   * the page heaving under the panel they are typing into. Covering the screen
   * removes the audience for it — there is nothing behind to watch.
   *
   * For the editors and detail views this is also the more honest shape: they
   * run 70–92vh already, which is a full screen wearing a sheet's costume. The
   * short ones (quick add, a delete confirm, a settings popover) stay sheets —
   * a one-field panel taking over the display is a heavier gesture than the act
   * it carries.
   *
   * The close affordance changes with it: a back arrow, not an ×, because a
   * screen is somewhere you LEAVE while a sheet is something you dismiss. The
   * grab handle and swipe-down go away for the same reason — nothing is left to
   * drag down to.
   */
  fullScreen?: boolean;
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
 * keyboard. Hence a real button, unconditional rather than opt-in — a sheet
 * with no way out should not be constructible.
 *
 * Swipe-down closes it too (#792). The handle used to be exactly what it looked
 * like it wasn't: decoration, with no drag behind it. The gesture now lives on
 * the whole header strip (handle + title row), NOT the panel — `children` is
 * often scrollable, and a sheet that closed when you flicked its content would
 * be worse than one that never closed by gesture at all. The strip is
 * `touch-none` so the browser hands us the move events instead of scrolling.
 * The handle bar itself stays aria-hidden: a swipe is not reachable by
 * assistive tech, and the close button beside it already is.
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
 * todo detail is the first) lost its only way to close.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  closeLabel,
  children,
  className,
  closeOnBackdrop = true,
  fullScreen = false,
}: BottomSheetProps) {
  const panelRef = useDialogA11y<HTMLDivElement>({ open, onClose });
  const swipe = useSwipeToDismiss({ direction: "down", onDismiss: onClose });

  if (!open || typeof document === "undefined") return null;

  const exitButton = (
    <button
      type="button"
      onClick={onClose}
      aria-label={closeLabel}
      {...DIALOG_AUTOFOCUS_SKIP}
      className={cn(
        "-my-2.5 grid size-11 shrink-0 place-items-center rounded-full",
        fullScreen ? "-ml-2" : "-mr-2",
        "text-lumen-text-secondary transition-colors",
        "hover:bg-lumen-hover hover:text-lumen-text",
        FOCUS_RING_TIGHT,
      )}
    >
      {fullScreen ? (
        <ArrowLeft size={20} aria-hidden />
      ) : (
        <X size={18} aria-hidden />
      )}
    </button>
  );

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50 flex justify-center bg-black/40",
        fullScreen ? "items-stretch" : "items-end",
      )}
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
        /*
         * The drag follows the finger 1:1; the release either springs back
         * (offset returns to 0 through the transition) or the sheet unmounts.
         * `transition: none` while dragging keeps the panel under the finger
         * instead of easing behind it. Under `prefers-reduced-motion` the
         * spring-back is flattened by tokens.css, app-wide — nothing to do here.
         */
        style={{
          transform:
            !fullScreen && swipe.offset > 0
              ? `translateY(${swipe.offset}px)`
              : undefined,
          transition: swipe.dragging ? "none" : undefined,
          /*
           * Safe areas, inline rather than as `pt-[env(...)]` utilities. The
           * panel is portalled to <body>, so it sits OUTSIDE the shell's own
           * inset padding and has to clear the status bar and home indicator
           * itself — and at full height it spans both. Inline because `cn` is
           * plain string concatenation, not tailwind-merge (rules/frontend.md):
           * a second padding utility would not beat `pt-3`, it would race it in
           * source order. An inline style wins outright.
           */
          ...(fullScreen
            ? {
                paddingTop: "calc(0.75rem + env(safe-area-inset-top))",
                paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))",
              }
            : null),
        }}
        className={cn(
          /*
           * `overflow-hidden` belongs HERE, not in each caller's `className`.
           * It is not decoration: the panel is a fixed-height flex column, and
           * without it a tall child grows straight out through the bottom of
           * the screen. Every full-screen host was passing the same string to
           * supply it, which is one host away from a panel that overflows
           * because someone copied the tag and not the class.
           */
          fullScreen
            ? "flex h-full w-full flex-col overflow-hidden"
            : "w-full max-w-lg rounded-t-2xl border-t border-lumen-border",
          /*
           * The bottom pad clears the home indicator (#1008). The panel is
           * `items-end` inside a `fixed inset-0` parent, so its bottom edge
           * IS the bottom of the screen — under iOS standalone a flat `pb-6`
           * put the last row under the indicator bar. `max()` rather than a
           * sum, matching AuthScreen (#805): 24px is already clearance on a
           * phone whose inset is smaller, and where the inset is 0 (Desktop,
           * Android browsers) the spacing is unchanged.
           *
           * fullScreen overrides this from the inline style above, where the
           * inset is ADDED instead — that panel spans the whole screen, so it
           * needs its own padding on top of the indicator rather than the
           * larger of the two.
           */
          "bg-lumen-bg px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 shadow-xl",
          "transition-transform duration-200 ease-out",
          className,
        )}
      >
        {/*
         * The swipe-down strip (#792): handle + header row, and nothing that
         * scrolls. `touch-none` is what makes the browser deliver the moves
         * rather than treating the gesture as a scroll.
         */}
        <div
          {...(fullScreen ? {} : swipe.handlers)}
          // `shrink-0` because this strip carries the only exit: in a column
          // that runs out of room, the header is the last thing that may give.
          className={fullScreen ? "shrink-0" : "touch-none"}
        >
          {/* A handle advertises a drag. At full height there is nowhere to
              drag TO, so showing one would promise a gesture that does nothing. */}
          {!fullScreen && (
            <div
              aria-hidden="true"
              className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-lumen-border"
            />
          )}
          {/*
           * Header row: title (when given) and the always-present close button.
           * The row renders even without a title so no sheet can exist without a
           * visible exit — the whole point of #525.
           *
           * The button carries a 44px touch target (mobile-scope floor) but
           * pulls it back into the panel's own padding with negative margins, so
           * the row keeps the ~24px height every sheet had before and no header
           * shifts. `truncate` on the heading is what keeps a long title from
           * running under the button. A tap on it still reaches onClick: a press
           * that never travels 8px never becomes a swipe.
           */}
          {/*
           * Full height puts the exit FIRST, where a screen's back control
           * lives, and turns it into a back arrow; a sheet keeps the × on the
           * right, where a dismiss lives. Same button, same `closeLabel`, same
           * callback — only its seat at the row and its glyph move, so nothing
           * that queries it by name has to know which shape it got.
           */}
          <div className="mb-3 flex min-h-6 items-center justify-between gap-2">
            {fullScreen && exitButton}
            {title ? (
              <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-lumen-text">
                {title}
              </h2>
            ) : (
              <span className="flex-1" />
            )}
            {!fullScreen && exitButton}
          </div>
        </div>
        {/*
         * At full height the panel is the viewport, so the scroll has to happen
         * INSIDE it or the header scrolls away with the content and the only
         * exit leaves the screen. The negative inset lets the scrollbar and the
         * content's own edges reach the panel's sides while the padding keeps
         * the text off them. A partial sheet keeps `children` bare — it grows to
         * fit and the page behind it still scrolls (see the header comment).
         */}
        {fullScreen ? (
          <div className="-mx-5 flex min-h-0 flex-1 flex-col overflow-y-auto px-5">
            {children}
          </div>
        ) : (
          children
        )}
      </div>
    </div>,
    document.body,
  );
}
