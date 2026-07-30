import { useCallback, useSyncExternalStore } from "react";

/** The part of the layout viewport the user can actually see right now. */
export interface VisualViewportRect {
  /** Offset of the visible area INSIDE the layout viewport (CSS px). */
  offsetTop: number;
  offsetLeft: number;
  width: number;
  height: number;
}

/*
 * visualViewport tracker (#473). The soft keyboard shrinks the VISUAL viewport
 * while `vh` / `100%` keep reporting the full LAYOUT viewport, so a fixed
 * overlay sized in `vh` happily runs underneath the keyboard on mobile. Reading
 * the visual viewport is the only way to size an overlay to what is on screen.
 *
 * Mirrors the measurement `web/src/notes/suggestionPopup.ts` does imperatively
 * for the `[[` menu, in the React shape shared components need.
 *
 * Returns null while `active` is false and on platforms without the API (jsdom,
 * older browsers) — callers keep their CSS fallback in that case rather than
 * getting a half-measured rect. Subscribing is scoped to `active` so a closed
 * overlay holds no listeners.
 *
 * Pure display hook: no DataService / i18n (§3.1 / §6.4).
 */

/** Last measurement, shared by every caller — the browser has one viewport. */
let snapshot: VisualViewportRect | null = null;

function readSnapshot(): VisualViewportRect | null {
  const vv = typeof window === "undefined" ? null : window.visualViewport;
  if (!vv) return null;
  // useSyncExternalStore compares snapshots by IDENTITY, so handing back a
  // fresh object on every read would re-render forever. Rebuild only when a
  // number actually moved.
  if (
    !snapshot ||
    snapshot.offsetTop !== vv.offsetTop ||
    snapshot.offsetLeft !== vv.offsetLeft ||
    snapshot.width !== vv.width ||
    snapshot.height !== vv.height
  ) {
    snapshot = {
      offsetTop: vv.offsetTop,
      offsetLeft: vv.offsetLeft,
      width: vv.width,
      height: vv.height,
    };
  }
  return snapshot;
}

export function useVisualViewport(active = true): VisualViewportRect | null {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const vv = typeof window === "undefined" ? null : window.visualViewport;
      if (!active || !vv) return () => {};
      // resize = keyboard opening/closing or a pinch-zoom; scroll = the visible
      // area sliding within the layout viewport (both move the overlay).
      vv.addEventListener("resize", onChange);
      vv.addEventListener("scroll", onChange);
      return () => {
        vv.removeEventListener("resize", onChange);
        vv.removeEventListener("scroll", onChange);
      };
    },
    [active],
  );

  const getSnapshot = useCallback(
    () => (active ? readSnapshot() : null),
    [active],
  );

  // Read during render, so an overlay is correctly sized on its FIRST paint
  // rather than flashing at the layout-viewport size for a frame.
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
