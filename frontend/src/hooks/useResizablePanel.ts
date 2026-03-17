import { useState, useCallback, useEffect, useRef } from "react";

interface UseResizablePanelOptions {
  storageKey: string;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
}

export function useResizablePanel({
  storageKey,
  defaultWidth,
  minWidth,
  maxWidth,
}: UseResizablePanelOptions) {
  const [width, setWidth] = useState<number>(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const val = parseInt(stored, 10);
      if (val >= minWidth && val <= maxWidth) return val;
    }
    return defaultWidth;
  });

  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const isResizing = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const baseXRef = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    baseXRef.current = containerRef.current?.getBoundingClientRect().left ?? 0;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const clamped = Math.max(
        minWidth,
        Math.min(maxWidth, e.clientX - baseXRef.current),
      );
      setDragWidth(clamped);
    };

    const handleMouseUp = () => {
      if (!isResizing.current) return;
      isResizing.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setDragWidth((prev) => {
        if (prev !== null) {
          setWidth(prev);
          localStorage.setItem(storageKey, String(prev));
        }
        return null;
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [storageKey, minWidth, maxWidth]);

  return { width, dragWidth, handleMouseDown, containerRef };
}
