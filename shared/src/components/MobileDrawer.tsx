import { createPortal } from "react-dom";
import { useDialogA11y } from "../hooks/useDialogA11y";
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
  const { isOpen, close, contentCount, setPortalTarget } =
    useRightSidebarContext();
  const panelRef = useDialogA11y<HTMLDivElement>({
    open: isOpen,
    onClose: close,
  });

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex bg-black/30" onMouseDown={close}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className="flex h-full w-80 flex-col border-r border-lumen-border bg-lumen-bg-subsidebar shadow-lumen-lg pl-[env(safe-area-inset-left)] pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]"
      >
        <RightSidebarContents
          title={title}
          closeLabel={closeLabel}
          emptyLabel={emptyLabel}
          onClose={close}
          contentCount={contentCount}
          setPortalTarget={setPortalTarget}
        />
      </div>
    </div>,
    document.body,
  );
}
