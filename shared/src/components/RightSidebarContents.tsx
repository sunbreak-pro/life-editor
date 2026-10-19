import { useEffect, useRef } from "react";
import { PanelRight } from "lucide-react";

/*
 * Internal (NOT barrel-exported) shared body for the detail panel — reused by
 * both the Desktop push-in <RightSidebar> and the Mobile <MobileDrawer> so the
 * scrollable portal well + empty state stay in lockstep (App Shell Turn 2).
 * Pure presentation: all copy is injected already-translated (§6.4); lumen-*
 * tokens only (§5).
 *
 * No header row (#2279). The panel used to open with a 48px "Details" row,
 * which said nothing the open panel did not, and pushed every section's own
 * first row (Schedule's three tabs, for one) down by its height. The panel's
 * name now lives only where assistive tech reads it — the `aria-label` on the
 * Desktop <aside> and on the Mobile dialog — and the drawer's × floats beside
 * the drawer instead (MobileDrawer).
 *
 * The body div is the portal target: it registers itself via setPortalTarget
 * on mount and clears to null on unmount. Only one of the panel/drawer is ever
 * mounted at a time (AppShell picks by wide/narrow), so a plain null-on-cleanup
 * never clobbers a live sibling target.
 */
export interface RightSidebarContentsProps {
  /** Already-translated empty-state copy (nothing selected). */
  emptyLabel: string;
  /** 0 ⇒ show the empty state; >0 ⇒ portalled content fills the well. */
  contentCount: number;
  setPortalTarget: (el: HTMLElement | null) => void;
}

export function RightSidebarContents({
  emptyLabel,
  contentCount,
  setPortalTarget,
}: RightSidebarContentsProps) {
  const bodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setPortalTarget(bodyRef.current);
    return () => setPortalTarget(null);
  }, [setPortalTarget]);

  return (
    /* Scrollable well, 12px on every side (#2279 — the 16px the header row
        started its title at is gone with the row). The portal target div is
        always mounted so a RightSidebarPortal can attach; the empty state
        shows over it while no section has registered content.

        `touch-pan-y` says what this element actually does: it scrolls
        vertically and nothing else. Left at the default `auto` it advertised
        horizontal panning it cannot perform, and inside <MobileDrawer> that
        was enough for the browser to claim a finger sliding left and cancel
        the pointer stream — swipe-to-close (#792) never reached its
        threshold on a real touch (#1204). Harmless in the Desktop
        <RightSidebar>, which has no horizontal gesture either. */
    <div
      data-testid="right-sidebar-well"
      className="min-h-0 flex-1 touch-pan-y overflow-y-auto p-3"
    >
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
  );
}
