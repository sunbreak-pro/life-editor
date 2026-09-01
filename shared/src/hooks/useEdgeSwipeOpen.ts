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
 * instead means the only thing that can go wrong is a false POSITIVE (an
 * intentional rightward drag begun within `edge` px of the screen edge), not a
 * swallowed tap.
 *
 * TAPS AND VERTICAL SCROLLING ARE NEVER TAKEN — with one narrow exception, and
 * the exception is the whole reason the gesture works on a real finger at all
 * (#1204). On touch, `touch-action: auto` lets the browser claim the pan as
 * soon as it sees a few px of horizontal travel, and claiming it CANCELS the
 * pointer stream: `pointercancel` at ~20px, no `pointerup`, so the 56px
 * threshold below was unreachable on every real device while the mouse-driven
 * desktop check passed. The fix is a non-passive `touchmove` listener that
 * calls preventDefault ONLY while a tracked, edge-born press is leaning
 * horizontal (see `onTouchMove`). A press that leans vertical is never
 * defended, so the browser keeps ownership of scrolling from the first sample;
 * pinch (2+ touches) is never defended either. Blanket `touch-action: pan-y`
 * on the app was the alternative and was rejected: the narrow layout has a
 * horizontally scrolling tab strip, so the blast radius is the whole screen.
 *
 * Three guards keep the false positive narrow: the press must start inside the
 * edge zone, the drag must commit to the horizontal axis AND be heading right,
 * and `shouldStart` gets a veto on the press itself — which is how a sheet or
 * modal already on screen keeps the drawer from opening behind it.
 *
 * The axis decision is CUMULATIVE, not a verdict on the first sample (#1204).
 * It used to be decided once, at 8px of travel in either axis, which threw
 * away two gestures a finger actually makes: an 8px vertical wobble at the
 * start of a 80px rightward pull (dropped for good), and a 41° diagonal (`dx >
 * dy` is false when they arrive equal). Now a press is claimed as soon as it
 * has 8px of rightward travel that is at least its vertical travel, and it is
 * handed back only once it is unmistakably vertical — 16px of it, exceeding
 * the horizontal. Between those two it stays undecided and keeps watching, so
 * a wobble costs nothing and a pure scroll is still released early.
 *
 * The gesture commits on RELEASE rather than following the finger. A
 * follow-the-finger open would have to render the drawer, and its contents are
 * portalled in by whatever section is on screen (RightSidebarPortal), so
 * "peeking" it would mount that content for a gesture the user may abandon.
 * The slide-in animation carries the motion instead.
 */

/**
 * How far from the left edge a press must start, in px — widened from 24
 * (#1402).
 *
 * 24px is about half a fingertip, and on Android's gesture navigation the
 * system claims roughly the outermost 20–24px for its own back swipe. Between
 * the two, the part of the zone a thumb could actually land in was close to
 * nothing: a swipe begun a finger's width in did nothing at all, which is the
 * reported "判定領域が狭い". 44px is the smallest target a finger is expected to
 * hit reliably — the number the touch-target rules use — so there is a usable
 * strip left inside the system's.
 *
 * Widening this only widens where a gesture may START. The three guards that
 * keep it from taking anything from the page are untouched: the drag must
 * commit to the horizontal axis AND head right, it must travel the threshold
 * below, and `shouldStart` still vetoes the press. So the cost of a wider zone
 * is still at worst a false open, undone by one tap.
 */
const DEFAULT_EDGE_ZONE = 44;

/**
 * Rightward travel past which a release opens. Lower than the dismiss
 * threshold (#792 uses 72): closing throws away a panel you were reading, so
 * it should take some conviction, while an unwanted open costs one tap to undo.
 */
const DEFAULT_THRESHOLD = 56;

/** Rightward travel needed before the gesture commits to our axis. Matches #792. */
const AXIS_LOCK_DISTANCE = 8;

/**
 * Vertical travel past which an undecided press is handed back to the page for
 * good. Deliberately twice the claim distance: the two are not symmetric, since
 * "not yet horizontal" must not read as "vertical" while a finger is still
 * making up its mind (#1204).
 */
const VERTICAL_RELEASE_DISTANCE = AXIS_LOCK_DISTANCE * 2;

/**
 * Horizontal travel past which we start holding the browser off (see the
 * touchmove note above). Under Chrome's ~8px touch slop on purpose — by the
 * time the browser is deciding whether to pan, we have already said no.
 */
const PAN_DEFENCE_DISTANCE = 4;

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

    /** Cumulative axis verdict for the sample at (dx, dy). See the header note. */
    const judge = (dx: number, dy: number) => {
      // Claim a rightward drag that is at least its vertical component. `>=`
      // rather than `>`: a 41° diagonal arrives with dx and dy equal, and a
      // diagonal begun at the screen edge is a drawer pull, not a scroll.
      if (dx >= AXIS_LOCK_DISTANCE && dx >= Math.abs(dy)) claimed = true;
      // Hand an unmistakably vertical drag back for good — dropping `start` is
      // what stops it being reconsidered later in the same press, and what
      // stops us defending it from the browser's scroll.
      else if (Math.abs(dy) >= VERTICAL_RELEASE_DISTANCE && Math.abs(dy) > dx) {
        claimed = false;
        start = null;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!start || start.id !== e.pointerId || claimed !== null) return;
      judge(e.clientX - start.x, e.clientY - start.y);
    };

    /**
     * The only place this hook ever cancels anything, and only for a tracked
     * press that is heading right — otherwise the browser takes the pan and
     * kills the pointer stream mid-gesture (#1204). Registered non-passive, or
     * preventDefault would be ignored.
     */
    const onTouchMove = (e: TouchEvent) => {
      if (!start || !e.cancelable) return;
      // Two fingers is a pinch or a zoom; never ours.
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      if (!touch) return;
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      // Judge here too rather than trusting pointermove to have run first: the
      // two streams' ordering is the browser's business, not ours.
      if (claimed === null) judge(dx, dy);
      if (!start) return;
      if (!claimed && (dx < PAN_DEFENCE_DISTANCE || dx < Math.abs(dy))) return;
      e.preventDefault();
    };

    /**
     * A press landing on text left selected by the PREVIOUS swipe starts a
     * native drag instead of a gesture, which is why the second swipe in a row
     * did nothing (#1204). Refusing the drag costs nothing here — there is
     * nothing draggable in the edge zone — and, unlike killing `selectstart`
     * outright, it leaves ordinary text selection working.
     */
    const onDragStart = (e: Event) => {
      if (start) e.preventDefault();
    };

    /** Once the swipe is ours, painting a selection behind it is never wanted. */
    const onSelectStart = (e: Event) => {
      if (claimed) e.preventDefault();
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
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("dragstart", onDragStart);
    window.addEventListener("selectstart", onSelectStart);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", reset);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("dragstart", onDragStart);
      window.removeEventListener("selectstart", onSelectStart);
    };
  }, []);
}
