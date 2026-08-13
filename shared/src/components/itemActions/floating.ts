import { useEffect, type RefObject } from "react";
import { isImeComposing } from "../../utils/imeGuard";

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
      if (e.key === "Escape" && !isImeComposing(e)) onClose();
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

export interface ClampedPlacement {
  top: number;
  left: number;
  /**
   * Only set when the panel is taller than the viewport can hold even flush
   * against both edges — the caller caps the panel there and lets it scroll
   * internally. Absent means the panel fits and needs no cap.
   */
  maxHeight?: number;
}

/**
 * Clamp a cursor anchor so a panel of the given size stays fully on screen
 * (never spills past a viewport edge).
 *
 * `height` must be the panel's REAL height, not a per-host guess: a panel
 * taller than the estimate spills past the bottom edge with its last row
 * unreachable (#826 — the estimate was a fixed 220px while an event's panel
 * with 4 actions + the edit-detail button runs well past it).
 */
export function clampToViewport(
  position: { x: number; y: number },
  width: number,
  height: number,
  gap = 8,
): ClampedPlacement {
  const left = Math.max(
    gap,
    Math.min(position.x, window.innerWidth - width - gap),
  );
  const available = window.innerHeight - gap * 2;
  // `>=`, not `>`: the caller feeds the MEASURED height back in, and a capped
  // panel measures exactly `available`. With `>` the cap would be dropped on
  // the next pass, the panel would grow back, and the two states would
  // alternate forever.
  if (height >= available) {
    return { top: gap, left, maxHeight: Math.max(available, 0) };
  }
  const top = Math.max(
    gap,
    Math.min(position.y, window.innerHeight - height - gap),
  );
  return { top, left };
}
