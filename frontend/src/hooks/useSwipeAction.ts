import { useState, useRef, useCallback, useEffect } from "react";

const SWIPE_THRESHOLD = 40;
const DIRECTION_LOCK_THRESHOLD = 8;

interface UseSwipeActionOptions {
  actionWidth: number;
  onSwipeOpen?: () => void;
  onSwipeClose?: () => void;
}

interface UseSwipeActionReturn {
  isOpen: boolean;
  translateX: number;
  isSwipingHorizontal: boolean;
  close: () => void;
  swipeHandlers: {
    onMouseDown: (e: React.MouseEvent) => void;
    onTouchStart: (e: React.TouchEvent) => void;
  };
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function useSwipeAction({
  actionWidth,
  onSwipeOpen,
  onSwipeClose,
}: UseSwipeActionOptions): UseSwipeActionReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [translateX, setTranslateX] = useState(0);
  const [isSwipeActive, setIsSwipeActive] = useState(false);
  const [isHorizontalLocked, setIsHorizontalLocked] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const startPos = useRef({ x: 0, y: 0 });
  const isSwiping = useRef(false);
  const directionLocked = useRef<"horizontal" | "vertical" | null>(null);
  const currentTranslate = useRef(0);
  const wasOpen = useRef(false);

  const close = useCallback(() => {
    setIsOpen(false);
    setTranslateX(0);
    currentTranslate.current = 0;
    onSwipeClose?.();
  }, [onSwipeClose]);

  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!isSwiping.current) return;

      const dx = clientX - startPos.current.x;
      const dy = clientY - startPos.current.y;

      // Lock direction after small movement
      if (!directionLocked.current) {
        if (
          Math.abs(dx) < DIRECTION_LOCK_THRESHOLD &&
          Math.abs(dy) < DIRECTION_LOCK_THRESHOLD
        ) {
          return;
        }
        directionLocked.current =
          Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
        if (directionLocked.current === "horizontal") {
          setIsHorizontalLocked(true);
        }
      }

      if (directionLocked.current !== "horizontal") return;

      const baseX = wasOpen.current ? -actionWidth : 0;
      let newX = baseX + dx;
      // Clamp: allow from -actionWidth to 0
      newX = Math.max(-actionWidth, Math.min(0, newX));
      currentTranslate.current = newX;
      setTranslateX(newX);
    },
    [actionWidth],
  );

  const handleEnd = useCallback(() => {
    if (!isSwiping.current) return;
    isSwiping.current = false;
    directionLocked.current = null;
    setIsSwipeActive(false);
    setIsHorizontalLocked(false);

    const threshold = wasOpen.current
      ? -actionWidth + SWIPE_THRESHOLD
      : -SWIPE_THRESHOLD;

    if (currentTranslate.current <= threshold) {
      setIsOpen(true);
      setTranslateX(-actionWidth);
      currentTranslate.current = -actionWidth;
      onSwipeOpen?.();
    } else {
      setIsOpen(false);
      setTranslateX(0);
      currentTranslate.current = 0;
      if (wasOpen.current) onSwipeClose?.();
    }
  }, [actionWidth, onSwipeOpen, onSwipeClose]);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => handleMove(e.clientX, e.clientY),
    [handleMove],
  );

  const handleMouseUp = useCallback(() => handleEnd(), [handleEnd]);

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (directionLocked.current === "horizontal") {
        e.preventDefault();
      }
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    },
    [handleMove],
  );

  const handleTouchEnd = useCallback(() => handleEnd(), [handleEnd]);

  // Only register global listeners while swiping is active
  useEffect(() => {
    if (!isSwipeActive) return;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [
    isSwipeActive,
    handleMouseMove,
    handleMouseUp,
    handleTouchMove,
    handleTouchEnd,
  ]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        close();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen, close]);

  const onStart = useCallback(
    (clientX: number, clientY: number) => {
      startPos.current = { x: clientX, y: clientY };
      isSwiping.current = true;
      directionLocked.current = null;
      wasOpen.current = isOpen;
      currentTranslate.current = isOpen ? -actionWidth : 0;
      setIsSwipeActive(true);
    },
    [isOpen, actionWidth],
  );

  const swipeHandlers = {
    onMouseDown: (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      onStart(e.clientX, e.clientY);
    },
    onTouchStart: (e: React.TouchEvent) => {
      onStart(e.touches[0].clientX, e.touches[0].clientY);
    },
  };

  return {
    isOpen,
    translateX,
    isSwipingHorizontal: isSwipeActive && isHorizontalLocked,
    close,
    swipeHandlers,
    containerRef,
  };
}
