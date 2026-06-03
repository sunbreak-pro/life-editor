import { useEffect } from "react";

/**
 * Closes an overlay when Escape is pressed while it is active. Shared by the
 * Drawer / BottomSheet / SearchOverlay and the in-screen modals so keyboard
 * users can always dismiss — previously every overlay lacked this.
 */
export function useDismissOnEscape(
  active: boolean,
  onDismiss: () => void,
): void {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, onDismiss]);
}
