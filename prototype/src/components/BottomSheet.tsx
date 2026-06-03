import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { C } from "../lib/theme";
import { useDismissOnEscape } from "../hooks/useDismissOnEscape";

/**
 * Draggable bottom sheet shared by every section.
 *
 * Grab the handle (or header) and drag: the sheet follows the finger, then on
 * release snaps to the nearest `snapPoints` height (half ↔ near-fullscreen by
 * default). Drag far enough below the smallest snap and it dismisses. The
 * backdrop stays semi-transparent so the screen behind is partly visible.
 *
 * Height-based (not translate) so content never gets clipped at the half snap.
 * No gesture library — pointer events only (prototype keeps deps minimal).
 */
const ENTER_MS = 260;

export function BottomSheet({
  open,
  onClose,
  title,
  rightLabel,
  onRightClick,
  snapPoints = [0.5, 0.92],
  initialSnapIndex = 0,
  backdropOpacity = 0.45,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  rightLabel?: string;
  onRightClick?: () => void;
  /** Fractions of the viewport height, ascending (e.g. [0.5, 0.92]). */
  snapPoints?: number[];
  initialSnapIndex?: number;
  backdropOpacity?: number;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(open);
  const [heightPx, setHeightPx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    startY: number;
    startH: number;
    pid: number;
  } | null>(null);

  const snapsPx = () => {
    const h = window.innerHeight;
    return snapPoints.map((s) => Math.round(s * h));
  };

  // Enter / exit animation driven by `open`.
  useEffect(() => {
    if (open) {
      setMounted(true);
      const snaps = snapPoints.map((s) => Math.round(s * window.innerHeight));
      const target =
        snaps[Math.min(initialSnapIndex, snaps.length - 1)] ?? snaps[0];
      const raf = requestAnimationFrame(() => setHeightPx(target));
      return () => cancelAnimationFrame(raf);
    }
    setHeightPx(0);
    const t = window.setTimeout(() => setMounted(false), ENTER_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useDismissOnEscape(open, onClose);

  const handlePointerDown = (e: ReactPointerEvent) => {
    // Claim the gesture before the page's pan-y scroll can pick up the first
    // 1-2px of movement (iOS Safari). Combined with touchAction:none on the
    // handle, this keeps the drag initiation reliable.
    e.preventDefault();
    dragRef.current = { startY: e.clientY, startH: heightPx, pid: e.pointerId };
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: ReactPointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pid !== e.pointerId) return;
    const dy = e.clientY - d.startY;
    const maxPx = snapsPx()[snapPoints.length - 1];
    const next = Math.max(0, Math.min(maxPx, d.startH - dy));
    setHeightPx(next);
  };

  const handlePointerUp = (e: ReactPointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    setDragging(false);
    if (!d || d.pid !== e.pointerId) return;
    const snaps = snapsPx();
    const h = heightPx;
    // Dragged below half of the smallest snap → dismiss.
    if (h < snaps[0] * 0.5) {
      onClose();
      return;
    }
    // Otherwise snap to the nearest defined point.
    let nearest = snaps[0];
    let best = Infinity;
    for (const s of snaps) {
      const dist = Math.abs(s - h);
      if (dist < best) {
        best = dist;
        nearest = s;
      }
    }
    setHeightPx(nearest);
  };

  if (!mounted) return null;

  return (
    <>
      {/* Backdrop — semi-transparent so the screen behind stays visible */}
      <button
        type="button"
        onClick={onClose}
        aria-label="閉じる"
        className="fixed inset-0 z-[80]"
        style={{
          background: C.crust,
          opacity: open ? backdropOpacity : 0,
          transition: "opacity 260ms",
        }}
      />
      {/* Panel */}
      <div
        className="fixed left-1/2 -translate-x-1/2 bottom-0 w-full max-w-md rounded-t-2xl flex flex-col z-[81] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          height: heightPx,
          background: C.mantle,
          boxShadow: "0 -8px 24px rgba(0,0,0,0.4)",
          transition: dragging ? "none" : `height ${ENTER_MS}ms ease-out`,
          touchAction: "none",
        }}
      >
        {/* Grab area: handle + optional header. Drives the drag. */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="shrink-0 cursor-grab active:cursor-grabbing"
          style={{ touchAction: "none" }}
        >
          <div className="flex flex-col items-center pt-2 pb-1">
            <span
              className="w-10 h-1 rounded-full"
              style={{ background: C.overlay0 }}
            />
          </div>
          {(title !== undefined || rightLabel) && (
            <header
              className="h-10 flex items-center px-3"
              style={{ borderBottom: `1px solid ${C.surface1}` }}
            >
              <div
                className="flex-1 text-sm font-medium"
                style={{ color: C.text }}
              >
                {title}
              </div>
              {rightLabel && onRightClick && (
                <button
                  type="button"
                  onClick={onRightClick}
                  className="text-xs px-2 min-h-[36px]"
                  style={{ color: C.mauve }}
                >
                  {rightLabel}
                </button>
              )}
            </header>
          )}
        </div>
        {/* Scrollable content */}
        <div
          className="flex-1 min-h-0 overflow-auto"
          style={{ touchAction: "pan-y" }}
        >
          {children}
        </div>
      </div>
    </>
  );
}
