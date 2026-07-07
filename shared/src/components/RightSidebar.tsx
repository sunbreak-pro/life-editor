import { useRef } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
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
 */
export interface RightSidebarProps {
  /** Already-translated panel title ("詳細"). */
  title: string;
  /** Already-translated aria-label for the close button. */
  closeLabel: string;
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
  closeLabel,
  emptyLabel,
  resizeLabel,
}: RightSidebarProps) {
  const { isOpen, close, width, setWidth, contentCount, setPortalTarget } =
    useRightSidebarContext();
  const asideRef = useRef<HTMLElement>(null);
  const resizingRef = useRef(false);

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
    setWidth(clampWidth(right - e.clientX));
  };

  const endResize = (e: PointerEvent<HTMLDivElement>) => {
    resizingRef.current = false;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const onHandleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
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
      style={{ width: renderWidth }}
      className="relative flex flex-shrink-0 flex-col border-l border-lumen-border bg-lumen-bg-subsidebar"
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
      <RightSidebarContents
        title={title}
        closeLabel={closeLabel}
        emptyLabel={emptyLabel}
        onClose={close}
        contentCount={contentCount}
        setPortalTarget={setPortalTarget}
      />
    </aside>
  );
}
