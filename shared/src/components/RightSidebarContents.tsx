import { useEffect, useRef } from "react";
import { PanelRight, X } from "lucide-react";

/*
 * Internal (NOT barrel-exported) shared body for the detail panel — reused by
 * both the Desktop push-in <RightSidebar> and the Mobile <MobileDrawer> so the
 * 48px "詳細" header + scrollable portal well + empty state stay in lockstep
 * (App Shell Turn 2). Pure presentation: all copy is injected already-
 * translated (§6.4); lumen-* tokens only (§5).
 *
 * The body div is the portal target: it registers itself via setPortalTarget
 * on mount and clears to null on unmount. Only one of the panel/drawer is ever
 * mounted at a time (AppShell picks by wide/narrow), so a plain null-on-cleanup
 * never clobbers a live sibling target.
 */
export interface RightSidebarContentsProps {
  /** Already-translated panel title ("詳細" / "Details"). */
  title: string;
  /** Already-translated aria-label for the close (X) button. */
  closeLabel: string;
  /** Already-translated empty-state copy (nothing selected). */
  emptyLabel: string;
  onClose: () => void;
  /** 0 ⇒ show the empty state; >0 ⇒ portalled content fills the well. */
  contentCount: number;
  setPortalTarget: (el: HTMLElement | null) => void;
}

export function RightSidebarContents({
  title,
  closeLabel,
  emptyLabel,
  onClose,
  contentCount,
  setPortalTarget,
}: RightSidebarContentsProps) {
  const bodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setPortalTarget(bodyRef.current);
    return () => setPortalTarget(null);
  }, [setPortalTarget]);

  return (
    <>
      {/* 48px header — same height as the SidebarNav header. */}
      <div className="flex h-12 flex-shrink-0 items-center justify-between border-b border-lumen-border pl-4 pr-3">
        <span className="text-[13px] font-semibold text-lumen-text">
          {title}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="grid h-7 w-7 place-items-center rounded-lumen-sm text-lumen-text-secondary transition-colors hover:bg-lumen-hover hover:text-lumen-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
        >
          <X size={16} />
        </button>
      </div>
      {/* Scrollable well. The portal target div is always mounted so a
          RightSidebarPortal can attach; the empty state shows over it while
          no section has registered content. */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {contentCount === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
            <PanelRight size={24} className="text-lumen-text-tertiary" />
            <span className="text-sm text-lumen-text-secondary">
              {emptyLabel}
            </span>
          </div>
        )}
        <div ref={bodyRef} />
      </div>
    </>
  );
}
