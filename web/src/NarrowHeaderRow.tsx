import type { ReactNode } from "react";
import type { NarrowHeader } from "./sectionDescriptors";

/*
 * The narrow-layout row above the section body (#1035).
 *
 * It used to be a private helper in MainScreen that returned one of four
 * shapes, and for two of them — Analytics and Trash — it returned nothing at
 * all. That was fine while the row carried only per-section chrome. It stopped
 * being fine once app-global actions had to live there: Undo/Redo existed on
 * mobile in exactly one place, the bottom bar's "More" sheet (#472), which is
 * two taps and a mode switch away from the edit you want to take back.
 *
 * So the row is now UNCONDITIONAL and has three slots, left to right:
 *
 *   [hamburger] [tabs ····························] [actions]
 *
 * `shape` still decides the first two — that part is verbatim from the old
 * helper — but `actions` is drawn on every section, pinned to the right end
 * (the far side from the hamburger, which is where the Issue asks for it).
 * When a section has no tabs, a flex-1 spacer stands in for them so the
 * actions stay at the edge instead of sliding in beside the hamburger.
 *
 * Every slot is a ReactNode the host builds, so this file stays free of
 * context reads and renders identically in a test as it does in the shell.
 * That matters here specifically: MainScreen needs a DataService and the whole
 * Provider stack to mount, so the row could not otherwise be asserted on at
 * all (rules/frontend.md §テスト環境の制約 — the escape hatch for screens jsdom
 * cannot carry).
 */
export interface NarrowHeaderRowProps {
  /** Which per-section chrome the active descriptor asked for. */
  shape: NarrowHeader;
  /**
   * The section's in-band tab control, when it has one. Pass it already
   * carrying `flex-1` — it is what pushes `actions` to the right edge.
   */
  tabs?: ReactNode;
  /** The detail-panel (rightSidebar) hamburger. */
  hamburger: ReactNode;
  /**
   * App-global controls pinned to the right end — Undo/Redo (#1035). Drawn on
   * every section, including the two that have no chrome of their own.
   */
  actions: ReactNode;
}

export function NarrowHeaderRow({
  shape,
  tabs,
  hamburger,
  actions,
}: NarrowHeaderRowProps) {
  const showHamburger = shape === "hamburger" || shape === "tabs+hamburger";
  // A `tabs*` shape without a band is impossible by construction (a descriptor
  // that asks for tabs also names a tabBand), but falling back to the spacer
  // keeps the row whole rather than half-drawn if that ever stops holding.
  const showTabs =
    (shape === "tabs" || shape === "tabs+hamburger") && tabs != null;

  return (
    <div className="flex items-center gap-2">
      {showHamburger && hamburger}
      {showTabs ? tabs : <span className="flex-1" />}
      {actions}
    </div>
  );
}
