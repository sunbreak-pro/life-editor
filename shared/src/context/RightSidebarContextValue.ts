import { createContext } from "react";

/*
 * RightSidebar (detail panel) context value — Pattern A 1/3 (CLAUDE.md §6.3).
 *
 * App Shell Turn 2. Owns the shared open/closed + width state for the target-IA
 * "詳細" detail panel (Desktop push-in <aside> / Mobile left drawer) and the
 * portal plumbing that lets a section body render its detail UI INTO the panel
 * DOM from inside its own Provider tree (旧 frontend RightSidebarContext の目標
 * IA 版). Pure UI state — DataService-free (§3.1).
 *
 *   isOpen        — panel visibility. NOT persisted (a fresh session starts
 *                   closed); toggled from the header/segment toggle.
 *   width         — Desktop panel width in px, persisted (localStorage). The
 *                   left-edge resize handle clamps it to [240, 560].
 *   portalTarget  — the panel body element the mounted panel/drawer registers;
 *                   RightSidebarPortal renders its children into it via
 *                   createPortal. null when no panel is mounted (or closed).
 *   contentCount  — how many RightSidebarPortal instances are currently
 *                   mounted. 0 ⇒ the panel shows its empty state.
 *   registerContent — called on RightSidebarPortal mount; the returned cleanup
 *                   decrements on unmount (mount = +1 / unmount = −1).
 */
export interface RightSidebarContextValue {
  isOpen: boolean;
  open: () => void;
  /**
   * Close it, no questions asked. For the PROGRAMMATIC closes — a wide→narrow
   * crossing that would leave the drawer covering the screen, a section body
   * tidying up after itself. A resize is not the user saying "throw my draft
   * away", so it must not be able to raise that question (#753).
   */
  close: () => void;
  /**
   * The user asked to close it (the panel's close button, the drawer's
   * backdrop, the header toggle). Consults the unsaved guard first, so a draft
   * inside the panel is asked about before the portal target goes null and
   * takes the panel's children with it (#753). Falls back to a plain close
   * when no UnsavedGuardProvider is mounted.
   */
  requestClose: () => void;
  /** The header/hamburger toggle. Opens directly, closes via `requestClose`. */
  toggle: () => void;
  /** Desktop panel width in px (persisted). Clamped to [240, 560]. */
  width: number;
  setWidth: (w: number) => void;
  /** The mounted panel/drawer body element that portals render into. */
  portalTarget: HTMLElement | null;
  setPortalTarget: (el: HTMLElement | null) => void;
  /** Number of mounted RightSidebarPortal instances (0 ⇒ empty state). */
  contentCount: number;
  /** Register a portal instance; returns the cleanup that deregisters it. */
  registerContent: () => () => void;
}

export const RightSidebarContext =
  createContext<RightSidebarContextValue | null>(null);
