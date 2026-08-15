import { createPortal } from "react-dom";
import { useDialogA11y } from "../hooks/useDialogA11y";
import { useSwipeToDismiss } from "../hooks/useSwipeToDismiss";
import { useRightSidebarContext } from "../hooks/useRightSidebarContext";
import { RightSidebarContents } from "./RightSidebarContents";

/*
 * MobileDrawer — the narrow-width counterpart of <RightSidebar> (App Shell
 * Turn 2). Follows the BottomSheet construction (portal to <body>, Escape to
 * close, backdrop-click to close) but slides in from the LEFT and holds the
 * SAME detail content as the Desktop panel. This is the "詳細" drawer opened by
 * the hamburger toggle — role-separate from the nav "More" bottom sheet.
 *
 * Keyboard/focus behaviour comes from useDialogA11y, the same hook Modal and
 * BottomSheet use (#508): Escape closes, Tab cycles inside the panel, focus
 * lands inside on open and goes back to the opener on close. Joining the hook's
 * layer stack also fixes stacking: a dialog opened on top of the drawer now
 * takes the Escape instead of the drawer's own document listener racing it
 * (#517). Scroll is not locked, matching BottomSheet.
 *
 * Swiping the panel toward its own edge closes it (#792) — the drawer enters
 * from the left, so it leaves to the left. The gesture sits on the whole panel
 * rather than a grab strip (unlike BottomSheet): the exit axis is horizontal
 * and the contents scroll vertically, so the two never compete. `touch-pan-y`
 * says exactly that to the browser — keep owning vertical scroll, hand us the
 * horizontal moves. The hook additionally drops any press whose first 8px lean
 * vertical, so a scroll that wanders sideways cannot turn into a dismiss.
 *
 * §5: the drawer panel is opaque (bg-subsidebar); the black/30 scrim is the
 * allowed overlay exception (brief specifies .3 for this drawer). Safe-area
 * insets are held INSIDE the drawer so the header/body clear the notch + home
 * indicator. Copy injected already-translated (§6.4).
 */
export interface MobileDrawerProps {
  /** Already-translated panel title ("詳細"). */
  title: string;
  /** Already-translated aria-label for the close button. */
  closeLabel: string;
  /** Already-translated empty-state copy. */
  emptyLabel: string;
}

export function MobileDrawer({
  title,
  closeLabel,
  emptyLabel,
}: MobileDrawerProps) {
  // #753: Escape, the scrim and the close button are all the user asking, so
  // all three take the guarded route — the drawer holds the same portalled
  // panel the Desktop sidebar does, and closing it unmounts the draft inside.
  const { isOpen, requestClose, contentCount, setPortalTarget } =
    useRightSidebarContext();
  const panelRef = useDialogA11y<HTMLDivElement>({
    open: isOpen,
    onClose: requestClose,
  });
  // Swipe goes through requestClose for the same reason the scrim and the ×
  // do: it is the user asking, so the unsaved-draft guard gets its say (#753).
  const swipe = useSwipeToDismiss({
    direction: "left",
    onDismiss: requestClose,
  });

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex bg-black/30"
      onMouseDown={requestClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        {...swipe.handlers}
        style={{
          transform:
            swipe.offset > 0 ? `translateX(-${swipe.offset}px)` : undefined,
          transition: swipe.dragging ? "none" : undefined,
        }}
        className="flex h-full w-80 touch-pan-y flex-col border-r border-lumen-border bg-lumen-bg-subsidebar shadow-lumen-lg pl-[env(safe-area-inset-left)] pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] transition-transform duration-200 ease-out"
      >
        <RightSidebarContents
          title={title}
          closeLabel={closeLabel}
          emptyLabel={emptyLabel}
          onClose={requestClose}
          contentCount={contentCount}
          setPortalTarget={setPortalTarget}
        />
      </div>
    </div>,
    document.body,
  );
}
