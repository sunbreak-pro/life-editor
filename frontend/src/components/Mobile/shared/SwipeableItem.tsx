import { useCallback, useRef, useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";

const DEFAULT_SWIPE_DELETE_THRESHOLD = 80;
const ACTION_WIDTH = 120;
const DIRECTION_LOCK_THRESHOLD = 10;

interface SwipeableItemProps {
  children: ReactNode;
  onDelete: () => void;
  /** Pixel distance to trigger the reveal. Defaults to 80. */
  threshold?: number;
  /** Label shown under the trash icon. Defaults to "Delete". */
  deleteLabel?: string;
}

/**
 * Horizontal swipe-to-reveal delete action for Mobile list rows.
 * Swiping left past `threshold` reveals a red delete button; tapping elsewhere
 * on the row closes the reveal.
 */
export function SwipeableItem({
  children,
  onDelete,
  threshold = DEFAULT_SWIPE_DELETE_THRESHOLD,
  deleteLabel = "Delete",
}: SwipeableItemProps) {
  const [offsetX, setOffsetX] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const touchRef = useRef<{
    startX: number;
    startY: number;
    locked: boolean | null;
  }>({ startX: 0, startY: 0, locked: null });

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      locked: null,
    };
    setIsTransitioning(false);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchRef.current.startX;
    const deltaY = touch.clientY - touchRef.current.startY;

    if (touchRef.current.locked === null) {
      if (
        Math.abs(deltaX) > DIRECTION_LOCK_THRESHOLD ||
        Math.abs(deltaY) > DIRECTION_LOCK_THRESHOLD
      ) {
        touchRef.current.locked = Math.abs(deltaX) > Math.abs(deltaY);
      }
      return;
    }

    if (!touchRef.current.locked) return;

    const clampedX = Math.min(0, Math.max(-ACTION_WIDTH, deltaX));
    setOffsetX(clampedX);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (touchRef.current.locked !== true) return;

    setIsTransitioning(true);
    if (Math.abs(offsetX) > threshold) {
      setOffsetX(-ACTION_WIDTH);
    } else {
      setOffsetX(0);
    }
    touchRef.current.locked = null;
  }, [offsetX, threshold]);

  const resetSwipe = useCallback(() => {
    setIsTransitioning(true);
    setOffsetX(0);
  }, []);

  return (
    <div className="relative overflow-hidden">
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-center bg-notion-danger"
        style={{ width: ACTION_WIDTH }}
      >
        <button
          onClick={() => {
            onDelete();
            resetSwipe();
          }}
          className="flex flex-col items-center gap-1 text-white"
        >
          <Trash2 size={18} />
          <span className="text-xs">{deleteLabel}</span>
        </button>
      </div>

      <div
        className="relative bg-notion-bg"
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isTransitioning ? "transform 200ms ease-out" : "none",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => {
          if (Math.abs(offsetX) > DIRECTION_LOCK_THRESHOLD) {
            resetSwipe();
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
