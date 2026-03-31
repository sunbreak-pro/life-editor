import { useState, useLayoutEffect, type RefObject } from "react";

/**
 * Clamp a popover/popup position to stay within the viewport.
 * Returns the adjusted { x, y } after measuring the element.
 */
export function useClampedPosition(
  ref: RefObject<HTMLElement | null>,
  position: { x: number; y: number },
  pad = 8,
): { x: number; y: number } {
  const [adjusted, setAdjusted] = useState(position);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.max(
      pad,
      Math.min(position.x, window.innerWidth - rect.width - pad),
    );
    const y = Math.max(
      pad,
      Math.min(position.y, window.innerHeight - rect.height - pad),
    );
    setAdjusted({ x, y });
  }, [position, pad, ref]);

  return adjusted;
}
