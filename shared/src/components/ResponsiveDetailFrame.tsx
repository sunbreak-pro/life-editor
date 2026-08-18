import type { ReactNode } from "react";
import { ItemDetailOverlay } from "./itemActions";
import { BottomSheet } from "./BottomSheet";

/*
 * One detail body, whichever frame the width calls for (#889).
 *
 * Schedule shows the same two panels — the event editor and the todo detail —
 * in a body-level overlay on Desktop and a full-height BottomSheet on Mobile.
 * Because the host has two separate returns, each panel was written out twice:
 * one `<ItemDetailOverlay>` const for the wide branch and one `<BottomSheet>`
 * for the narrow one, with the same title, the same body and the same close
 * guard copied between them.
 *
 * The comment above the todo pair already named the hazard — "one body rather
 * than two copies: the save button, the convert and the hand-off each carry a
 * guard, and a second literal is how one of the two layouts eventually loses
 * one of them" — and then kept two literals of the FRAME anyway. This is that
 * sentence applied one level out: the body was already shared, so the frame is
 * the last thing left to pick, and picking it is what this does.
 *
 * `open` and `onClose` stay the caller's, because they genuinely differ. The
 * event editor closes by dropping the overlay flag on Desktop and by clearing
 * the selection on Mobile — on Mobile the selection IS the sheet — so the
 * frame must not guess which one it is looking at.
 */
export interface ResponsiveDetailFrameProps {
  /** True on Desktop widths: the overlay. False: the sheet. */
  wide: boolean;
  open: boolean;
  /** Already-translated heading (§6.4). */
  title: string;
  /**
   * One-glyph kind cue beside the title (#1044). Forwarded to both frames —
   * which is the whole point of this part: a cue wired into only one of them
   * is exactly the drift it exists to prevent.
   */
  titleIcon?: ReactNode;
  /** Already-translated accessible name for the sheet's close button. */
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}

export function ResponsiveDetailFrame({
  wide,
  open,
  title,
  titleIcon,
  closeLabel,
  onClose,
  children,
}: ResponsiveDetailFrameProps) {
  if (wide) {
    return (
      <ItemDetailOverlay
        open={open}
        title={title}
        titleIcon={titleIcon}
        onClose={onClose}
      >
        {children}
      </ItemDetailOverlay>
    );
  }
  // fullScreen since #874: a 92svh sheet left a live strip of the screen
  // behind it that re-flowed on every keyboard open, and the scroller that
  // keeps a tall editor from pushing its own top edge off-screen comes with
  // it rather than being rebuilt per host.
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={title}
      titleIcon={titleIcon}
      closeLabel={closeLabel}
      fullScreen
    >
      {children}
    </BottomSheet>
  );
}
