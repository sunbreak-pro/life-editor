import { useEffect, type RefObject } from "react";

/*
 * Shared floating-panel behaviour for a cursor-anchored item panel
 * (ItemActionPopover — the unified panel since #551). It portals to <body>,
 * sits at a viewport-clamped cursor position, and dismisses on Escape /
 * outside mousedown.
 */

/**
 * Escape (IME-guarded) + outside-mousedown dismissal for a portalled panel.
 * Escape ignores IME composition so cancelling a kanji conversion does not also
 * close the panel (§frontend gotcha).
 */
export function useFloatingDismiss(
  ref: RefObject<HTMLElement | null>,
  onClose: () => void,
): void {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.isComposing) onClose();
    };
    const handleOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleOutside);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleOutside);
    };
  }, [ref, onClose]);
}

/**
 * Clamp a cursor anchor so a panel of the given size stays fully on screen
 * (never spills past a viewport edge).
 */
export function clampToViewport(
  position: { x: number; y: number },
  width: number,
  height: number,
  gap = 8,
): { top: number; left: number } {
  const left = Math.max(
    gap,
    Math.min(position.x, window.innerWidth - width - gap),
  );
  const top = Math.max(
    gap,
    Math.min(position.y, window.innerHeight - height - gap),
  );
  return { top, left };
}
