import { useRef } from "react";

interface SwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
  maxVerticalDrift?: number;
  maxDurationMs?: number;
}

export interface SwipeHandlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
  onClickCapture: (e: React.MouseEvent) => void;
}

export function useSwipe({
  onSwipeLeft,
  onSwipeRight,
  threshold = 50,
  maxVerticalDrift = 60,
  maxDurationMs = 600,
}: SwipeOptions): SwipeHandlers {
  const startRef = useRef<{
    x: number;
    y: number;
    t: number;
    pid: number;
  } | null>(null);
  const swipedRef = useRef(false);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    startRef.current = {
      x: e.clientX,
      y: e.clientY,
      t: Date.now(),
      pid: e.pointerId,
    };
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const s = startRef.current;
    startRef.current = null;
    if (!s || s.pid !== e.pointerId) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Date.now() - s.t > maxDurationMs) return;
    if (Math.abs(dy) > maxVerticalDrift) return;
    if (Math.abs(dx) < threshold) return;
    if (Math.abs(dx) < Math.abs(dy) * 1.5) return;
    swipedRef.current = true;
    window.setTimeout(() => {
      swipedRef.current = false;
    }, 300);
    if (dx < 0) onSwipeLeft?.();
    else onSwipeRight?.();
  };

  const onPointerCancel = () => {
    startRef.current = null;
  };

  const onClickCapture = (e: React.MouseEvent) => {
    if (swipedRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return { onPointerDown, onPointerUp, onPointerCancel, onClickCapture };
}
