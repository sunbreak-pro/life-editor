import { useCallback, useEffect, useMemo, useRef } from "react";
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";

/*
 * Swipe left / right across a surface to page it (#2034 — the Mobile month
 * calendar steps to the next / previous month).
 *
 * The same gesture grammar as the two swipes already in the app — #792's
 * swipe-to-dismiss and #1050's edge swipe — so a finger that has learnt one
 * learns this one:
 *
 * - THE THRESHOLD IS A FIXED PIXEL COUNT. jsdom has no layout (CLAUDE.md
 *   §7.1), so a fraction of the width would read 0 there and could not be
 *   tested; a constant is also predictable across phones.
 *
 * - THE AXIS IS DECIDED ONCE PER PRESS, after AXIS_LOCK_DISTANCE of travel.
 *   A press that is at least as horizontal as it is vertical is ours; one that
 *   is clearly vertical is handed back to the page for the rest of the press,
 *   so scrolling the month never turns into a page turn halfway through. A
 *   tap never travels that far, so it is never claimed and its click goes
 *   through untouched.
 *
 * - A CLAIMED PRESS SWALLOWS ITS OWN CLICK. The press starts and ends on day
 *   cells, and a release over the cell it began on is a click on that cell —
 *   which on the month grid opens the drawer on that day. `onClickCapture`
 *   drops the one click that follows a claimed press, and nothing else.
 *
 * - THE GESTURE IS DEFENDED FROM THE BROWSER, narrowly (#1204). On a real
 *   finger the browser claims a horizontal pan after a few px and cancels the
 *   pointer stream (`pointercancel`, no `pointerup`), so the threshold would be
 *   unreachable while the mouse-driven check passed. The surface says
 *   `touch-action: pan-y pinch-zoom` (TOUCH_CLASS) — vertical scrolling and
 *   zoom stay the browser's, the horizontal pan is ours — and a non-passive
 *   `touchmove` holds the browser off while a tracked press leans horizontal,
 *   for engines that do not honour touch-action on every descendant.
 *
 * - PRESSES THAT START AT THE LEFT SCREEN EDGE ARE NOT OURS. That strip
 *   belongs to the drawer's edge swipe (useEdgeSwipeOpen, #1050 / #1402),
 *   which listens on window and would fire on the same rightward drag — one
 *   finger, two results (the month steps back AND the drawer opens). The rule
 *   is "the edge wins": within `edgeZone` px of the left screen edge this hook
 *   does not start at all, in either direction, so the drawer keeps working
 *   exactly as before. The default matches that hook's zone (44px).
 *
 * The gesture commits on RELEASE rather than following the finger; the page
 * changes in one step, the way the ‹ › buttons change it.
 */

/** Travel in px past which a release pages. Same as the edge swipe's. */
const DEFAULT_THRESHOLD = 56;

/** Movement needed before the press commits to an axis. Matches #792 / #1050. */
const AXIS_LOCK_DISTANCE = 8;

/**
 * The drawer's edge zone (useEdgeSwipeOpen's DEFAULT_EDGE_ZONE — 44px, the
 * touch-target floor). Kept equal by hand; the reasoning lives there.
 */
const DEFAULT_EDGE_ZONE = 44;

/**
 * Horizontal travel past which we start holding the browser off. Under
 * Chrome's ~8px touch slop on purpose, like the other two swipes.
 */
const PAN_DEFENCE_DISTANCE = 4;

/**
 * Spread onto the surface's className: vertical scroll and pinch-zoom stay
 * the browser's, the horizontal pan is the hook's.
 */
export const HORIZONTAL_SWIPE_TOUCH_CLASS = "touch-pan-y touch-pinch-zoom";

export interface HorizontalSwipeOptions {
  /** The finger travelled LEFT past the threshold (the next page). */
  onSwipeLeft: () => void;
  /** The finger travelled RIGHT past the threshold (the previous page). */
  onSwipeRight: () => void;
  /** Travel in px past which a release pages. */
  threshold?: number;
  /** Presses starting within this many px of the left screen edge are left alone. */
  edgeZone?: number;
  /** False leaves the surface inert. */
  enabled?: boolean;
}

export interface HorizontalSwipeHandlers {
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => void;
  onClickCapture: (e: ReactMouseEvent<HTMLElement>) => void;
}

/** See useSwipeToDismiss: capture is an optimisation jsdom does not have. */
function capturePointer(target: Element, pointerId: number | undefined): void {
  if (pointerId === undefined) return;
  try {
    (
      target as Element & { setPointerCapture?: (id: number) => void }
    ).setPointerCapture?.(pointerId);
  } catch {
    /* no capture available */
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
    /* no capture available */
  }
}

export function useHorizontalSwipe({
  onSwipeLeft,
  onSwipeRight,
  threshold = DEFAULT_THRESHOLD,
  edgeZone = DEFAULT_EDGE_ZONE,
  enabled = true,
}: HorizontalSwipeOptions): HorizontalSwipeHandlers {
  // Latest callbacks without re-creating the handlers mid-gesture.
  const latest = useRef({ onSwipeLeft, onSwipeRight, threshold });
  useEffect(() => {
    latest.current = { onSwipeLeft, onSwipeRight, threshold };
  });

  const startRef = useRef<{ x: number; y: number; id: number | undefined }>(
    null,
  );
  /** null = axis undecided, true = ours, false = handed back to the page. */
  const claimedRef = useRef<boolean | null>(null);
  /** The click the browser sends after a claimed press — dropped once. */
  const swallowClickRef = useRef(false);

  const reset = useCallback(() => {
    startRef.current = null;
    claimedRef.current = null;
  }, []);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      reset();
      swallowClickRef.current = false;
      // Secondary mouse buttons are menus, not swipes.
      if (!enabled || e.button !== 0) return;
      if (e.clientX <= edgeZone) return;
      startRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    },
    [enabled, edgeZone, reset],
  );

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    const start = startRef.current;
    if (!start || start.id !== e.pointerId || claimedRef.current !== null)
      return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < AXIS_LOCK_DISTANCE) return;
    // `>=` rather than `>`: a 45° diagonal arrives with the two equal, and on
    // a surface that only scrolls vertically a diagonal is a page turn.
    const ours = Math.abs(dx) >= Math.abs(dy);
    claimedRef.current = ours;
    if (!ours) {
      startRef.current = null;
      return;
    }
    capturePointer(e.currentTarget, e.pointerId);
  }, []);

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const start = startRef.current;
      const claimed = claimedRef.current;
      releasePointer(e.currentTarget, e.pointerId);
      reset();
      if (!start || !claimed || start.id !== e.pointerId) return;
      // A claimed press was a drag, not a tap, whether or not it went far
      // enough to page — the click it ends in is not the user's.
      swallowClickRef.current = true;
      const dx = e.clientX - start.x;
      if (dx <= -latest.current.threshold) latest.current.onSwipeLeft();
      else if (dx >= latest.current.threshold) latest.current.onSwipeRight();
    },
    [reset],
  );

  const onPointerCancel = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      releasePointer(e.currentTarget, e.pointerId);
      reset();
    },
    [reset],
  );

  const onClickCapture = useCallback((e: ReactMouseEvent<HTMLElement>) => {
    if (!swallowClickRef.current) return;
    swallowClickRef.current = false;
    e.preventDefault();
    e.stopPropagation();
  }, []);

  /*
   * The browser defence (see the header). On window because `touchmove` has
   * to be registered non-passive to cancel anything, which React cannot say.
   * Inert unless this instance is tracking a press.
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onTouchMove = (e: TouchEvent) => {
      const start = startRef.current;
      if (!start || !e.cancelable || e.touches.length !== 1) return;
      const touch = e.touches[0];
      if (!touch) return;
      const dx = Math.abs(touch.clientX - start.x);
      const dy = Math.abs(touch.clientY - start.y);
      if (!claimedRef.current && (dx < PAN_DEFENCE_DISTANCE || dx < dy)) return;
      e.preventDefault();
    };
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => window.removeEventListener("touchmove", onTouchMove);
  }, []);

  return useMemo(
    () => ({
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onClickCapture,
    }),
    [
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onClickCapture,
    ],
  );
}
