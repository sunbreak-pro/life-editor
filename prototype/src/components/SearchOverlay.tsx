import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { C } from "../lib/theme";
import { CrossSearchBody } from "./CrossSearchBody";

/**
 * Global cross-cutting search modal (2026-05-30 requirements).
 *
 * Opened from the persistent Header search button. Presented as a bottom sheet
 * that leaves a gap at the top so the screen behind stays partly visible
 * (modal, not a flat full-screen page). The handle can be dragged to resize
 * between two snap heights; dragging down far enough dismisses it.
 *
 * Mounted only while open so the input auto-focuses and the query resets each
 * time. Its own drag logic (rather than the generic BottomSheet) because the
 * search input must keep autofocus and the sheet enters near-fullscreen.
 */
const ENTER_MS = 260;
const SNAPS = [0.6, 0.94]; // fractions of viewport height

export function SearchOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(open);
  const [heightPx, setHeightPx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    startY: number;
    startH: number;
    pid: number;
  } | null>(null);

  const snapsPx = () => SNAPS.map((s) => Math.round(s * window.innerHeight));

  useEffect(() => {
    if (open) {
      setMounted(true);
      const target = Math.round(SNAPS[1] * window.innerHeight);
      const raf = requestAnimationFrame(() => setHeightPx(target));
      return () => cancelAnimationFrame(raf);
    }
    setHeightPx(0);
    const t = window.setTimeout(() => setMounted(false), ENTER_MS);
    return () => window.clearTimeout(t);
  }, [open]);

  const onDown = (e: ReactPointerEvent) => {
    dragRef.current = { startY: e.clientY, startH: heightPx, pid: e.pointerId };
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: ReactPointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pid !== e.pointerId) return;
    const dy = e.clientY - d.startY;
    const maxPx = snapsPx()[SNAPS.length - 1];
    setHeightPx(Math.max(0, Math.min(maxPx, d.startH - dy)));
  };
  const onUp = (e: ReactPointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    setDragging(false);
    if (!d || d.pid !== e.pointerId) return;
    const snaps = snapsPx();
    if (heightPx < snaps[0] * 0.5) {
      onClose();
      return;
    }
    let nearest = snaps[0];
    let best = Infinity;
    for (const s of snaps) {
      const dist = Math.abs(s - heightPx);
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
      {/* Backdrop — semi-transparent, screen behind partly visible */}
      <button
        type="button"
        onClick={onClose}
        aria-label="検索を閉じる"
        className="fixed inset-0 z-[80]"
        style={{
          background: C.crust,
          opacity: open ? 0.45 : 0,
          transition: "opacity 260ms",
        }}
      />
      <div
        className="fixed left-1/2 -translate-x-1/2 bottom-0 w-full max-w-md rounded-t-2xl flex flex-col z-[81] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="横断検索"
        style={{
          height: heightPx,
          background: C.base,
          boxShadow: "0 -8px 24px rgba(0,0,0,0.45)",
          transition: dragging ? "none" : `height ${ENTER_MS}ms ease-out`,
        }}
      >
        {/* Grab handle */}
        <div
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className="shrink-0 flex flex-col items-center pt-2 pb-1 cursor-grab active:cursor-grabbing"
          style={{ touchAction: "none", background: C.mantle }}
        >
          <span
            className="w-10 h-1 rounded-full"
            style={{ background: C.overlay0 }}
          />
        </div>
        <div className="flex-1 min-h-0">
          <CrossSearchBody onNavigate={onClose} />
        </div>
      </div>
    </>
  );
}
