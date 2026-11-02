/*
 * Keeping a link chip's Desktop panel inside what can show it (#2446).
 *
 * The panel hangs from its chip with `position: absolute`, so any ancestor that
 * clips its overflow cuts it off, not only the window. On the Notes screen the
 * editor sits in a scrolling column with the note list to its right: a panel
 * from a chip near that column's right edge ran under the list and made the
 * column scroll sideways. So the right edge to keep to is the nearest of the
 * window's and every clipping ancestor's.
 */

export interface HorizontalBounds {
  left: number;
  right: number;
}

/** The `overflow-x` values that cut a descendant off at the padding box. */
const CLIPPING = new Set(["auto", "scroll", "hidden", "clip"]);
/** The `overflow-y` values that make the other axis clip too. */
const SCROLLING = new Set(["auto", "scroll", "hidden"]);

/**
 * The horizontal span, in viewport pixels, where `el`'s overflow is not cut
 * off: the window, narrowed by the inner box (padding box, scrollbar excluded)
 * of every ancestor whose `overflow-x` clips.
 */
export function visibleBoundsOf(el: Element): HorizontalBounds {
  const view = el.ownerDocument.defaultView;
  let left = 0;
  let right = view ? view.innerWidth : Number.POSITIVE_INFINITY;
  if (!view) return { left, right };
  const root = el.ownerDocument.documentElement;
  // An absolute box is clipped only by its containing block and the boxes
  // around that, not by an ancestor in between. Below the breakpoint the chip
  // strip scrolls sideways between the panel and the header row it hangs
  // from, and it does not cut the panel off.
  const start =
    (el instanceof HTMLElement ? el.offsetParent : null) ?? el.parentElement;
  for (
    let node = start;
    node && node !== root;
    node = node.parentElement
  ) {
    const style = view.getComputedStyle(node);
    // `overflow-y: auto` alone turns a `visible` x into `auto` as well, which
    // is how the Notes column clips. Browsers report that computed value, but
    // a reader that does not still has to treat the box as clipping.
    if (!CLIPPING.has(style.overflowX) && !SCROLLING.has(style.overflowY)) {
      continue;
    }
    const box = node.getBoundingClientRect();
    const innerLeft = box.left + node.clientLeft;
    left = Math.max(left, innerLeft);
    right = Math.min(right, innerLeft + node.clientWidth);
  }
  return { left, right };
}

/**
 * How far to move a panel sideways so its right edge keeps `gap` from the
 * bounds' right edge. Never so far that its left edge passes the bounds' left
 * edge plus `gap`: when the space is narrower than the panel, its start stays
 * in view. Zero when it already fits.
 */
export function shiftIntoBounds(
  panel: HorizontalBounds,
  bounds: HorizontalBounds,
  gap: number,
): number {
  const past = panel.right - (bounds.right - gap);
  if (past <= 0) return 0;
  return Math.min(0, Math.max(-past, bounds.left + gap - panel.left));
}
