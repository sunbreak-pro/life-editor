import { useCallback, useEffect, useRef, useState } from "react";

/*
 * Which link chip has its panel open, and why (#2392). One at a time, so it is
 * one state for the row rather than one per chip.
 *
 * The reason decides what closes it:
 *
 *   - hover: leaving the chip and its panel.
 *   - focus: the focus leaving them, whatever the pointer does on the way past.
 *   - pinned: only a click or tap on the chip, a click elsewhere, or Esc.
 *
 * A hover waits a moment before opening, so a pointer crossing the row does not
 * read every item it passes, and a moment before closing, so the small gap
 * between the chip and its panel can be crossed.
 */

const HOVER_OPEN_DELAY_MS = 120;
const HOVER_CLOSE_DELAY_MS = 150;

type OpenMode = "hover" | "focus" | "pinned";

interface OpenChip {
  /** The item whose row this is. Selecting another note closes the panel. */
  ownerId: string;
  id: string;
  mode: OpenMode;
}

export interface LinkChipPopover {
  openId: string | null;
  hoverIn: (id: string) => void;
  hoverOut: (id: string) => void;
  focusIn: (id: string) => void;
  focusOut: (id: string) => void;
  press: (id: string) => void;
  close: () => void;
}

export function useLinkChipPopover(ownerId: string): LinkChipPopover {
  const [open, setOpen] = useState<OpenChip | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const clearTimers = useCallback(() => {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const hoverIn = useCallback(
    (id: string) => {
      clearTimers();
      openTimer.current = setTimeout(() => {
        setOpen((prev) => {
          // A panel someone pinned or walked into stays put.
          if (prev && prev.ownerId === ownerId && prev.mode !== "hover") {
            return prev;
          }
          return { ownerId, id, mode: "hover" };
        });
      }, HOVER_OPEN_DELAY_MS);
    },
    [clearTimers, ownerId],
  );

  const hoverOut = useCallback(
    (id: string) => {
      clearTimers();
      closeTimer.current = setTimeout(() => {
        setOpen((prev) =>
          prev?.id === id && prev.mode === "hover" ? null : prev,
        );
      }, HOVER_CLOSE_DELAY_MS);
    },
    [clearTimers],
  );

  const focusIn = useCallback(
    (id: string) => {
      clearTimers();
      setOpen((prev) =>
        prev?.ownerId === ownerId && prev.id === id && prev.mode === "pinned"
          ? prev
          : { ownerId, id, mode: "focus" },
      );
    },
    [clearTimers, ownerId],
  );

  const focusOut = useCallback((id: string) => {
    setOpen((prev) => (prev?.id === id && prev.mode === "focus" ? null : prev));
  }, []);

  const press = useCallback(
    (id: string) => {
      clearTimers();
      setOpen((prev) =>
        prev?.ownerId === ownerId && prev.id === id && prev.mode === "pinned"
          ? null
          : { ownerId, id, mode: "pinned" },
      );
    },
    [clearTimers, ownerId],
  );

  const close = useCallback(() => {
    clearTimers();
    setOpen(null);
  }, [clearTimers]);

  return {
    openId: open?.ownerId === ownerId ? open.id : null,
    hoverIn,
    hoverOut,
    focusIn,
    focusOut,
    press,
    close,
  };
}
