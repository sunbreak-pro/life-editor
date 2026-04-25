import { useEffect, useRef } from "react";

interface Options {
  enabled: boolean;
  onSwipeBack: () => void;
  edgeWidthPx?: number;
  thresholdPx?: number;
  isBlocked?: () => boolean;
}

export function useEdgeSwipeBack({
  enabled,
  onSwipeBack,
  edgeWidthPx = 24,
  thresholdPx = 60,
  isBlocked,
}: Options): void {
  const stateRef = useRef<{
    startX: number;
    startY: number;
    active: boolean;
    locked: "h" | "v" | null;
  }>({ startX: 0, startY: 0, active: false, locked: null });

  // Latest-callback refs so the effect doesn't re-attach listeners every render
  // when callers pass inline `() => isDrawerOpen` style callbacks.
  const onSwipeBackRef = useRef(onSwipeBack);
  const isBlockedRef = useRef(isBlocked);
  onSwipeBackRef.current = onSwipeBack;
  isBlockedRef.current = isBlocked;

  useEffect(() => {
    if (!enabled) return;

    const onTouchStart = (e: TouchEvent) => {
      if (isBlockedRef.current?.()) return;
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      if (touch.clientX > edgeWidthPx) return;

      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-no-edge-swipe]")) return;
      if (target?.closest(".ProseMirror")) return;

      stateRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        active: true,
        locked: null,
      };
    };

    const onTouchMove = (e: TouchEvent) => {
      const s = stateRef.current;
      if (!s.active) return;
      const touch = e.touches[0];
      const dx = touch.clientX - s.startX;
      const dy = touch.clientY - s.startY;

      if (s.locked === null) {
        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
          s.locked = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
        }
        return;
      }
      if (s.locked === "v") {
        s.active = false;
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      const s = stateRef.current;
      if (!s.active) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - s.startX;
      const dy = touch.clientY - s.startY;

      s.active = false;
      s.locked = null;

      if (Math.abs(dy) > Math.abs(dx)) return;
      if (dx >= thresholdPx) onSwipeBackRef.current();
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [enabled, edgeWidthPx, thresholdPx]);
}
