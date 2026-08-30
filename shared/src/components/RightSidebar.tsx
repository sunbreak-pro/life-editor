import { useEffect, useRef } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
import { useRightSidebarContext } from "../hooks/useRightSidebarContext";
import { RightSidebarContents } from "./RightSidebarContents";

/*
 * RightSidebar — Desktop push-in detail panel (App Shell Turn 2).
 *
 * Rendered as a flex sibling of <main> inside AppShell's wide layout, so it
 * PUSHES the main area (main shrinks) rather than overlaying it — no `fixed`,
 * per brief §3 (overlay 禁止). Opaque subsidebar surface + left border (§5).
 * A left-edge handle resizes the width (clamped 240–560px) via pointer capture
 * and ←/→ keys. Pure presentation: copy injected already-translated (§6.4).
 *
 * Opening slides it in from the right (#1050) instead of the layout jumping.
 * The panel unmounts when closed, so the animation replays on each open and
 * never re-runs on a resize (that changes `width`, not the mounted-ness).
 * There is no matching CLOSE animation: the panel is gone from the tree the
 * moment it closes, and keeping it mounted to animate out would hold its
 * portal target — and whatever a section rendered into it — alive past the
 * close. That trade is not worth a 200ms exit.
 */
export interface RightSidebarProps {
  /** Already-translated panel title ("詳細"). */
  title: string;
  /** Already-translated empty-state copy. */
  emptyLabel: string;
  /** Already-translated aria-label for the resize handle (names the action). */
  resizeLabel: string;
}

const MIN_WIDTH = 240;
const MAX_WIDTH = 560;
const KEY_STEP = 16;

function clampWidth(w: number): number {
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(w)));
}

export function RightSidebar({
  title,
  emptyLabel,
  resizeLabel,
}: RightSidebarProps) {
  const { isOpen, width, setWidth, contentCount, setPortalTarget } =
    useRightSidebarContext();
  const asideRef = useRef<HTMLElement>(null);
  const resizingRef = useRef(false);
  /*
   * #1103 — rAF throttle for the drag (D-20260818-shared-fix-1 = A).
   *
   * A pointermove fires far more often than the screen repaints, and every
   * `setWidth` here is not just a React state update: it is `useLocalStorage`'s
   * setter, so each call also does a synchronous JSON.stringify + setItem. And
   * because RightSidebarContext keeps `width` in the same memoized value as
   * `open` / `close`, one tick re-renders every consumer of that context —
   * NotesView and KanbanView included — not just this panel.
   *
   * So we hold the newest width in a ref and commit it once per frame. Nothing
   * outside this file changes: `setWidth` keeps its contract, it just gets
   * called at the rate the screen can actually show.
   */
  const pendingWidthRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const queueWidth = (next: number) => {
    // Last move inside the frame wins — intermediate positions are never drawn.
    pendingWidthRef.current = next;
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const queued = pendingWidthRef.current;
      pendingWidthRef.current = null;
      if (queued !== null) setWidth(queued);
    });
  };

  /*
   * Cancel the queued frame AND apply its value now. Called when the gesture
   * ends, which is what keeps the release position from being thrown away: a
   * pointerup one millisecond after the last pointermove would otherwise leave
   * the newest width sitting in the ref with its frame cancelled by unmount.
   */
  const flushWidth = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const queued = pendingWidthRef.current;
    pendingWidthRef.current = null;
    if (queued !== null) setWidth(queued);
  };

  // The file's first teardown. Null-checked so StrictMode's double-invoke and a
  // close with no drag in flight are both no-ops.
  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const onHandlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    resizingRef.current = true;
  };

  const onHandlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!resizingRef.current || !asideRef.current) return;
    // Panel is pinned to the right; its right edge is fixed, so width is the
    // distance from the pointer to that edge — robust regardless of start point.
    const right = asideRef.current.getBoundingClientRect().right;
    queueWidth(clampWidth(right - e.clientX));
  };

  const endResize = (e: PointerEvent<HTMLDivElement>) => {
    resizingRef.current = false;
    flushWidth();
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const onHandleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Arrow keys stay synchronous: they step from the CURRENT width, so N
    // presses inside one frame have to be N steps, not one. Flushing first only
    // stops a frame queued by an in-flight drag from landing after this press
    // and undoing it — a no-op when nothing is pending, which is the norm.
    flushWidth();
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setWidth(clampWidth(width + KEY_STEP));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setWidth(clampWidth(width - KEY_STEP));
    }
  };

  if (!isOpen) return null;

  // Persisted width can be out of range (hand-edited storage, or MIN/MAX
  // changed across versions) — re-clamp at render so a stale value can never
  // squeeze <main> below its minimum.
  const renderWidth = clampWidth(width);

  return (
    <aside
      ref={asideRef}
      /*
       * `--lumen-panel-w` feeds the open animation (#1050), which slides the
       * panel in from the right by running `margin-right` from -width to 0.
       *
       * Animating the MARGIN rather than the width is what keeps the contents
       * still: the panel is its final width for the whole slide, so nothing
       * inside reflows, and <main> (flex-1) takes back the space frame by
       * frame — the push-in this panel is supposed to be. The parent flex row
       * is overflow-hidden, so the off-screen part is clipped rather than
       * spilling. A width animation would squash every row inside it instead.
       */
      style={
        {
          width: renderWidth,
          "--lumen-panel-w": `${renderWidth}px`,
        } as CSSProperties
      }
      className="lumen-panel-in-right relative flex flex-shrink-0 flex-col border-l border-lumen-border bg-lumen-bg-subsidebar"
    >
      {/* Left-edge resize handle. role=separator + arrow keys for a11y. */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={renderWidth}
        aria-valuemin={MIN_WIDTH}
        aria-valuemax={MAX_WIDTH}
        aria-label={resizeLabel}
        tabIndex={0}
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={endResize}
        onPointerCancel={endResize}
        onKeyDown={onHandleKeyDown}
        className="absolute inset-y-0 left-0 z-10 w-[6px] cursor-col-resize hover:bg-lumen-accent/30 focus-visible:bg-lumen-accent/30 focus-visible:outline-none"
      />
      {/* No close × of our own (#1284): the SectionHeader's
          <RightSidebarToggle> sits right above this panel and already closes
          it. That path is still the GUARDED one — RightSidebarContext's
          toggle() calls requestClose while open — so #753's unsaved-draft
          question is untouched by dropping the button. */}
      <RightSidebarContents
        title={title}
        emptyLabel={emptyLabel}
        contentCount={contentCount}
        setPortalTarget={setPortalTarget}
      />
    </aside>
  );
}
