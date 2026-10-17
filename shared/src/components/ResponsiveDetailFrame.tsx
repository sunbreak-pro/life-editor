import { useId, type ReactNode } from "react";
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
 *
 * #2219: no visible heading on either width. The body's first field is the
 * item's own title, so a heading above it ("予定の詳細") only repeated what
 * kind of panel this is. `title` still names the dialog for a screen reader;
 * the close (×) sits in the top-right corner on both widths — Desktop had
 * none, so Escape and the backdrop were its only exits.
 */
export interface ResponsiveDetailFrameProps {
  /** True on Desktop widths: the overlay. False: the sheet. */
  wide: boolean;
  open: boolean;
  /**
   * Already-translated name of the dialog (§6.4). Read by assistive tech
   * only since #2219 — the frame draws no heading.
   */
  title: string;
  /** Already-translated accessible name for the corner close (×) button. */
  closeLabel: string;
  onClose: () => void;
  /**
   * Widen the Desktop overlay (#1664) — for a body that lays its fields out in
   * two columns. Ignored by the sheet, which is the phone's full width either
   * way.
   */
  wideOverlay?: boolean;
  children: ReactNode;
}

export function ResponsiveDetailFrame({
  wide,
  open,
  title,
  closeLabel,
  onClose,
  wideOverlay,
  children,
}: ResponsiveDetailFrameProps) {
  const headingId = useId();
  if (wide) {
    return (
      <ItemDetailOverlay
        open={open}
        // #2219: named by a heading only a screen reader sees, so the panel
        // opens on the body's title field rather than on a caption.
        labelledBy={headingId}
        closeLabel={closeLabel}
        size={wideOverlay ? "panel" : undefined}
        onClose={onClose}
        /*
         * #1728: always — the sheet below has had a scroller since #874, and
         * the overlay had none, so the SAME body was reachable on a phone and
         * unreachable on a 1440x900 desktop once the repeat section unfolded
         * its weekday pills. Both branches of this fold now guarantee one
         * scrolling box around the body, which is what makes "the detail body
         * may grow" a safe thing for a host to assume.
         *
         * Not a prop for the caller to pass: a host that had to remember it
         * is a host that will forget it, and this component exists precisely
         * to stop the two frames drifting apart.
         */
        fitViewport
      >
        <h2 id={headingId} className="sr-only">
          {title}
        </h2>
        {/* Clears the corner close button, which sits over the panel's
            padding rather than in a header row of its own. */}
        <div className="pt-6">{children}</div>
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
      hideTitle
      closeLabel={closeLabel}
      fullScreen
    >
      {children}
    </BottomSheet>
  );
}
