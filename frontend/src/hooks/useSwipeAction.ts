import { useState, useRef, useCallback, useEffect } from "react";

const SNAP_DELAY = 150;

interface UseSwipeActionOptions {
  actionWidth: number;
  onSwipeOpen?: () => void;
  onSwipeClose?: () => void;
}

interface UseSwipeActionReturn {
  isOpen: boolean;
  translateX: number;
  isScrolling: boolean;
  close: () => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function useSwipeAction({
  actionWidth,
  onSwipeOpen,
  onSwipeClose,
}: UseSwipeActionOptions): UseSwipeActionReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [translateX, setTranslateX] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentTranslate = useRef(0);
  const snapTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const isOpenRef = useRef(false);

  const close = useCallback(() => {
    setIsOpen(false);
    isOpenRef.current = false;
    setTranslateX(0);
    currentTranslate.current = 0;
    onSwipeClose?.();
  }, [onSwipeClose]);

  // Wheel-based swipe via useEffect (passive: false for preventDefault)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      // Only handle when horizontal component is dominant
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;

      e.preventDefault();

      setIsScrolling(true);

      let newX = currentTranslate.current - e.deltaX;
      newX = Math.max(-actionWidth, Math.min(0, newX));
      currentTranslate.current = newX;
      setTranslateX(newX);

      // Reset snap timer
      if (snapTimeoutRef.current) {
        clearTimeout(snapTimeoutRef.current);
      }
      snapTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
        if (currentTranslate.current <= -actionWidth / 2) {
          setIsOpen(true);
          isOpenRef.current = true;
          setTranslateX(-actionWidth);
          currentTranslate.current = -actionWidth;
          onSwipeOpen?.();
        } else {
          const wasOpen = isOpenRef.current;
          setIsOpen(false);
          isOpenRef.current = false;
          setTranslateX(0);
          currentTranslate.current = 0;
          if (wasOpen) onSwipeClose?.();
        }
      }, SNAP_DELAY);
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [actionWidth, onSwipeOpen, onSwipeClose]);

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

  // Cleanup snap timeout on unmount
  useEffect(() => {
    return () => {
      if (snapTimeoutRef.current) {
        clearTimeout(snapTimeoutRef.current);
      }
    };
  }, []);

  return {
    isOpen,
    translateX,
    isScrolling,
    close,
    containerRef,
  };
}
