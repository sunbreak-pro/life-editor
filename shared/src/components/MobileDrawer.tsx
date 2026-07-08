import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useRightSidebarContext } from "../hooks/useRightSidebarContext";
import { RightSidebarContents } from "./RightSidebarContents";

/*
 * MobileDrawer — the narrow-width counterpart of <RightSidebar> (App Shell
 * Turn 2). Follows the BottomSheet construction (portal to <body>, Escape to
 * close, backdrop-click to close) but slides in from the LEFT and holds the
 * SAME detail content as the Desktop panel. This is the "詳細" drawer opened by
 * the hamburger toggle — role-separate from the nav "More" bottom sheet.
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

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex bg-black/30" onMouseDown={close}>
      <div
        role="dialog"
        aria-modal="true"
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
