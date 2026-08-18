import { useEffect, useRef } from "react";

/*
 * Edge-swipe to OPEN the mobile drawer (#1050).
 *
 * #792 gave the drawer a one-thumb exit; this is the matching entrance. The
 * drawer enters from the left, so it opens by dragging IN from the left screen
 * edge — the direction every mobile OS already teaches — and the hamburger
 * stops being the only way in.
 *
 * The reason this is a window listener rather than a real element is the DoD's
 * other half: the gesture must not take anything away from the calendar, the
 * lists, or dnd-kit. An invisible strip pinned over the left edge WOULD take
 * something away — it swallows the press before whatever is underneath sees
 * it, so a tap on a row's left end would stop working. Listening on window
 * instead means:
 *
 *   - the handlers NEVER call preventDefault or stopPropagation, so every
 *     press continues to its real target exactly as before, and
 *   - the only thing that can go wrong is a false POSITIVE (an intentional
 *     rightward drag begun within `edge` px of the screen edge), not a
 *     swallowed tap.
 *
 * Three guards keep even that narrow: the press must start inside the edge
 * zone, the drag must commit to the horizontal axis within the first 8px AND
 * be heading right, and `shouldStart` gets a veto on the press itself — which
 * is how a sheet or modal already on screen keeps the drawer from opening
 * behind it.
 *
 * The gesture commits on RELEASE rather than following the finger. A
 * follow-the-finger open would have to render the drawer, and its contents are
 * portalled in by whatever section is on screen (RightSidebarPortal), so
 * "peeking" it would mount that content for a gesture the user may abandon.
 * The slide-in animation carries the motion instead.
 */

/** How far from the left edge a press must start, in px. */
const DEFAULT_EDGE_ZONE = 24;

/**
 * Rightward travel past which a release opens. Lower than the dismiss
 * threshold (#792 uses 72): closing throws away a panel you were reading, so
 * it should take some conviction, while an unwanted open costs one tap to undo.
 */
const DEFAULT_THRESHOLD = 56;

/** Movement needed before the gesture commits to an axis. Matches #792. */
const AXIS_LOCK_DISTANCE = 8;

export interface EdgeSwipeOpenOptions {
  /** Called once, on release, when the drag started at the edge and passed `threshold`. */
  onOpen: () => void;
  /**
   * Consulted on press. Return false to leave that press entirely alone — the
   * caller uses it to stand down while anything is already open on top.
   */
  shouldStart?: () => boolean;
  /** How far from the left edge a press must start, in px. */
  edge?: number;
  /** Rightward travel past which a release opens. */
  threshold?: number;
}

export function useEdgeSwipeOpen({
  onOpen,
  shouldStart,
  edge = DEFAULT_EDGE_ZONE,
  threshold = DEFAULT_THRESHOLD,
}: EdgeSwipeOpenOptions): void {
  // Latest values without re-binding the listeners on every render — a
  // re-registration mid-gesture would drop the press being tracked.
  const latest = useRef({ onOpen, shouldStart, edge, threshold });
  useEffect(() => {
    latest.current = { onOpen, shouldStart, edge, threshold };
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    let start: { x: number; y: number; id: number | undefined } | null = null;
    /** null = axis undecided, true = ours, false = handed back to the page. */
    let claimed: boolean | null = null;

    const reset = () => {
      start = null;
      claimed = null;
    };

    const onPointerDown = (e: PointerEvent) => {
      reset();
      // Secondary mouse buttons are menus, not swipes. Touch and pen both
      // report button 0 on press, so this excludes nothing real.
      if (e.button !== 0) return;
      if (e.clientX > latest.current.edge) return;
      if (latest.current.shouldStart && !latest.current.shouldStart()) return;
      start = { x: e.clientX, y: e.clientY, id: e.pointerId };
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!start || start.id !== e.pointerId || claimed !== null) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < AXIS_LOCK_DISTANCE) return;
      // Claim only a rightward drag that beats its vertical component. A
      // scroll, or a leftward drag, is handed back for good — dropping `start`
      // is what stops it being reconsidered later in the same press.
      claimed = dx > 0 && Math.abs(dx) > Math.abs(dy);
      if (!claimed) start = null;
    };

    const onPointerUp = (e: PointerEvent) => {
      const from = start;
      const ours = claimed;
      reset();
      if (!from || !ours || from.id !== e.pointerId) return;
      if (e.clientX - from.x >= latest.current.threshold)
        latest.current.onOpen();
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", reset);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", reset);
    };
  }, []);
}
