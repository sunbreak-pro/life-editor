import { useCallback, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

/*
 * Swipe-to-dismiss for the two mobile overlays (#792).
 *
 * Both panels enter from an edge and, until now, could only be closed by
 * tapping outside or hitting the × — neither of which is a one-thumb move.
 * This hook is the shared half: it turns a press-drag into a follow-the-finger
 * offset and a single dismiss decision on release. The panels own the
 * transform; the hook owns the gesture.
 *
 * Three decisions worth stating, because each one is load-bearing:
 *
 * - THE THRESHOLD IS A FIXED PIXEL COUNT, not a fraction of the panel. jsdom
 *   has no layout — every rect is 0 (CLAUDE.md §7.1) — so a measured threshold
 *   would read as "already past it" in tests and could not be verified at all.
 *   A constant is both testable and predictable across panel sizes.
 *
 * - THE AXIS IS LOCKED ONCE, after AXIS_LOCK_DISTANCE of travel, and only when
 *   the exit axis dominates AND the finger is heading OUT. A drag along the
 *   other axis (scrolling the drawer's contents) is handed back to the browser
 *   and never revisited for that press, so a scroll cannot turn into a dismiss
 *   halfway through.
 *
 * - REDUCED MOTION NEEDS NO CODE HERE. The snap-back is a CSS transition on the
 *   panel, and tokens.css already neutralises every transition app-wide under
 *   `prefers-reduced-motion` (its three-state `data-reduce-motion` block). A JS
 *   media query would be a second, drifting source of truth for the same
 *   preference.
 */

/** Which edge the panel leaves by. */
export type SwipeDismissDirection = "down" | "left";

export interface SwipeToDismissOptions {
  /** A bottom sheet exits "down"; a left drawer exits "left". */
  direction: SwipeDismissDirection;
  /** Called once, on release, when the drag passed `threshold`. */
  onDismiss: () => void;
  /** Travel in px past which a release closes instead of springing back. */
  threshold?: number;
  /** False leaves the gesture inert (the panel still renders normally). */
  enabled?: boolean;
}

export interface SwipeToDismissHandlers {
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => void;
}

export interface SwipeToDismiss {
  /** Travel along the exit direction in px. 0 when idle; never negative. */
  offset: number;
  /** True between a committed press and its release. */
  dragging: boolean;
  /** Spread onto the element the finger grabs. */
  handlers: SwipeToDismissHandlers;
}

/** Travel past which a release dismisses. */
const DEFAULT_THRESHOLD = 72;

/** Movement needed before the gesture commits to an axis. */
const AXIS_LOCK_DISTANCE = 8;

/**
 * Pointer capture keeps move events coming after the finger leaves the element.
 * It is an optimisation, not a requirement — jsdom does not implement it, and a
 * browser rejects a stale id — so a failure here degrades to "tracking stops at
 * the element's edge" rather than breaking the gesture.
 */
function capturePointer(target: Element, pointerId: number | undefined): void {
  if (pointerId === undefined) return;
  try {
    (
      target as Element & { setPointerCapture?: (id: number) => void }
    ).setPointerCapture?.(pointerId);
  } catch {
    /* no capture available — see above */
  }
}

function releasePointer(target: Element, pointerId: number | undefined): void {
  if (pointerId === undefined) return;
  try {
    const el = target as Element & {
      hasPointerCapture?: (id: number) => boolean;
      releasePointerCapture?: (id: number) => void;
    };
    if (el.hasPointerCapture?.(pointerId))
      el.releasePointerCapture?.(pointerId);
  } catch {
    /* no capture available — see above */
  }
}

export function useSwipeToDismiss({
  direction,
  onDismiss,
  threshold = DEFAULT_THRESHOLD,
  enabled = true,
}: SwipeToDismissOptions): SwipeToDismiss {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startRef = useRef<{ x: number; y: number; id: number | undefined }>(
    null,
  );
  /** null = axis undecided, true = ours, false = handed back to the browser. */
  const claimedRef = useRef<boolean | null>(null);

  const reset = useCallback(() => {
    startRef.current = null;
    claimedRef.current = null;
    setDragging(false);
    setOffset(0);
  }, []);

  /** Signed travel toward the exit edge (positive = on its way out). */
  const travelOf = useCallback(
    (dx: number, dy: number) => (direction === "down" ? dy : -dx),
    [direction],
  );

  /** Travel along the axis we do NOT own. */
  const crossOf = useCallback(
    (dx: number, dy: number) => (direction === "down" ? dx : dy),
    [direction],
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      // Secondary mouse buttons are menus, not swipes. Touch and pen both
      // report button 0 on press, so this excludes nothing real.
      if (!enabled || e.button !== 0) return;
      startRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
      claimedRef.current = null;
    },
    [enabled],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const start = startRef.current;
      if (!start || start.id !== e.pointerId) return;
      const travel = travelOf(e.clientX - start.x, e.clientY - start.y);
      const cross = crossOf(e.clientX - start.x, e.clientY - start.y);

      if (claimedRef.current === null) {
        if (Math.max(Math.abs(travel), Math.abs(cross)) < AXIS_LOCK_DISTANCE) {
          return;
        }
        // Claim only an outward drag along our own axis. An inward or sideways
        // one belongs to the content (scrolling), and dropping `start` here is
        // what stops it being reconsidered later in the same press.
        const ours = travel > 0 && Math.abs(travel) > Math.abs(cross);
        claimedRef.current = ours;
        if (!ours) {
          startRef.current = null;
          return;
        }
        capturePointer(e.currentTarget, e.pointerId);
        setDragging(true);
      }
      // Only outward travel moves the panel: dragging back past the start
      // returns it home rather than lifting it off its edge.
      setOffset(Math.max(0, travel));
    },
    [travelOf, crossOf],
  );

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const start = startRef.current;
      const claimed = claimedRef.current;
      releasePointer(e.currentTarget, e.pointerId);
      reset();
      if (!start || !claimed) return;
      const travel = travelOf(e.clientX - start.x, e.clientY - start.y);
      if (travel >= threshold) onDismiss();
    },
    [travelOf, threshold, onDismiss, reset],
  );

  const onPointerCancel = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      releasePointer(e.currentTarget, e.pointerId);
      reset();
    },
    [reset],
  );

  return {
    offset,
    dragging,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  };
}
