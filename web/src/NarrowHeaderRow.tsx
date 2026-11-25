import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
 * So the row is now UNCONDITIONAL and has these slots, left to right:
 *
 *   [hamburger] [tabs ·······················] [actions][section slot]
 *
 * (The section slot is empty except on the Notes tab — see
 * NarrowHeaderActionPortal below.)
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
  /**
   * The section's translated name (#1873). Drawn only when the row has no tab
   * band: a band already names where you are, but Settings / Work / Analytics
   * / Connect showed no heading of any level on narrow — and the bottom bar
   * highlights "More" for some of them, so the screen's name appeared nowhere.
   * Takes the spacer's place, so the actions still sit at the right edge.
   */
  title?: string;
  /** The detail-panel (rightSidebar) hamburger. */
  hamburger: ReactNode;
  /**
   * App-global controls pinned to the right end — Undo/Redo (#1035). Drawn on
   * every section, including the two that have no chrome of their own.
   */
  actions: ReactNode;
}

/*
 * The slot right of `actions` that a section BODY can fill (#2795).
 *
 * The Notes tab's "+" lives in this row on a phone, beside Redo, so it no
 * longer takes a band above the note. But the row is built by MainScreen and
 * the create handler belongs to NotesView, which mounts far below it inside a
 * lazy chunk. The body therefore portals its button up into this slot, the way
 * the list goes to the right sidebar through <RightSidebarPortal>.
 *
 * A module-level store rather than a context: a Provider would have to wrap
 * both the row and the body, which only MainScreen / AppProviders can do.
 * One narrow header is on screen at a time, so one slot is enough; the ref's
 * cleanup only clears the slot it set, so a row replaced in the same commit
 * cannot wipe its successor.
 */
let actionSlot: HTMLElement | null = null;
const slotListeners = new Set<() => void>();

function setActionSlot(next: HTMLElement | null): void {
  if (actionSlot === next) return;
  actionSlot = next;
  for (const listener of slotListeners) listener();
}

function subscribeActionSlot(listener: () => void): () => void {
  slotListeners.add(listener);
  return () => {
    slotListeners.delete(listener);
  };
}

const readActionSlot = (): HTMLElement | null => actionSlot;
const readNoActionSlot = (): HTMLElement | null => null;

// Module-level, so the ref is the same function every render and React does
// not detach and re-attach it on each one.
function attachActionSlot(
  el: HTMLSpanElement | null,
): (() => void) | undefined {
  if (!el) return undefined;
  setActionSlot(el);
  return () => {
    if (actionSlot === el) setActionSlot(null);
  };
}

/**
 * Draws its children in the narrow header row's right-end slot (#2795), or in
 * place when no narrow header is mounted — a host without the row, or a test
 * of the body alone — so the control is never left with nowhere to be.
 */
export function NarrowHeaderActionPortal({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  const slot = useSyncExternalStore(
    subscribeActionSlot,
    readActionSlot,
    readNoActionSlot,
  );
  return slot ? createPortal(children, slot) : <>{children}</>;
}

export function NarrowHeaderRow({
  shape,
  tabs,
  title,
  hamburger,
  actions,
}: NarrowHeaderRowProps) {
  const showHamburger = shape === "hamburger" || shape === "tabs+hamburger";
  // A `tabs*` shape without a band is impossible by construction (a descriptor
  // that asks for tabs also names a tabBand), but falling back to the spacer
  // keeps the row whole rather than half-drawn if that ever stops holding.
  const showTabs =
    (shape === "tabs" || shape === "tabs+hamburger") && tabs != null;

  // `gap-1` (#2216): the band's slots sit closer than they did at gap-2 —
  // each control already carries its own touch box, so the gap is only air.
  return (
    <div className="flex items-center gap-1">
      {showHamburger && hamburger}
      {showTabs ? (
        tabs
      ) : title ? (
        // Same level and weight as the wide SectionHeader's title.
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-lumen-text">
          {title}
        </h2>
      ) : (
        <span className="flex-1" />
      )}
      {/* No gap inside: a section's button sits flush against Redo, as two
          icon buttons side by side do on narrow (#2673). `contents`, so an
          empty slot adds no box and no gap. */}
      <div className="flex items-center">
        {actions}
        <span
          ref={attachActionSlot}
          data-testid="narrow-header-action-slot"
          className="contents"
        />
      </div>
    </div>
  );
}
